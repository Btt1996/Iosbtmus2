/**
 * Smart Synchro Service for Btt Music v2.00
 *
 * Scans offline IndexedDB music library, repairs broken metadata,
 * matches missing high-resolution artwork against official registries (iTunes / MusicBrainz),
 * cleans orphaned playlist references, deduplicates library tracks,
 * and maintains continuous uninterrupted playback during sync.
 */

import * as db from './db';
import { Track, Playlist } from '../types/music';
import { identifyTrackViaCatalog, cleanSongMetadata } from './playlistImport/x1Identification';

export interface SynchroScanResult {
  totalScanned: number;
  tracksWithMissingArt: Track[];
  tracksWithMissingMetadata: Track[];
  potentialDuplicates: Array<{
    canonicalTrack: Track;
    duplicateTracks: Track[];
  }>;
  orphanedPlaylistReferences: Array<{
    playlistId: string;
    playlistName: string;
    missingTrackIds: string[];
  }>;
}

export interface SynchroProgress {
  current: number;
  total: number;
  stage: 'scanning' | 'enriching_metadata' | 'fetching_artwork' | 'healing_playlists' | 'complete';
  currentTrackTitle?: string;
  repairedCount: number;
}

export type SynchroProgressCallback = (progress: SynchroProgress) => void;

/**
 * Perform a diagnostic scan of the library without writing changes
 */
export async function scanLibraryForRepairs(): Promise<SynchroScanResult> {
  const tracks = await db.getAllTracks();
  const playlists = await db.getAllPlaylists();

  const tracksWithMissingArt: Track[] = [];
  const tracksWithMissingMetadata: Track[] = [];
  const validTrackIds = new Set(tracks.map((t) => t.id));

  // Detect missing artwork or incomplete tags
  for (const t of tracks) {
    const isMissingArt = !t.artworkUrl || t.artworkUrl.trim() === '' || t.artworkUrl.includes('placeholder');
    if (isMissingArt) {
      tracksWithMissingArt.push(t);
    }

    const cleaned = cleanSongMetadata(t.title, t.artist);
    const isMissingArtist = !t.artist || t.artist.trim() === '' || t.artist.toLowerCase() === 'unknown artist';
    const isMissingAlbum = !t.album || t.album.trim() === '' || t.album.toLowerCase() === 'unknown album';
    const isGenericTitle = /^track\s*\d+$/i.test(t.title) || /^audio\s*\d+$/i.test(t.title);

    if (isMissingArtist || isMissingAlbum || isGenericTitle) {
      tracksWithMissingMetadata.push(t);
    }
  }

  // Detect duplicates (normalized title + artist)
  const groupMap = new Map<string, Track[]>();
  for (const t of tracks) {
    const normKey = `${(t.title || '').trim().toLowerCase()}:::${(t.artist || '').trim().toLowerCase()}`;
    const existing = groupMap.get(normKey) || [];
    existing.push(t);
    groupMap.set(normKey, existing);
  }

  const potentialDuplicates: SynchroScanResult['potentialDuplicates'] = [];
  for (const [, group] of groupMap.entries()) {
    if (group.length > 1) {
      // Pick track with artwork and highest size/duration as canonical
      const sorted = [...group].sort((a, b) => {
        const aHasArt = a.artworkUrl ? 1 : 0;
        const bHasArt = b.artworkUrl ? 1 : 0;
        if (aHasArt !== bHasArt) return bHasArt - aHasArt;
        return (b.fileSize || 0) - (a.fileSize || 0);
      });

      potentialDuplicates.push({
        canonicalTrack: sorted[0],
        duplicateTracks: sorted.slice(1),
      });
    }
  }

  // Detect orphaned playlist tracks
  const orphanedPlaylistReferences: SynchroScanResult['orphanedPlaylistReferences'] = [];
  for (const pl of playlists) {
    const missing = pl.trackIds.filter((id) => !validTrackIds.has(id));
    if (missing.length > 0) {
      orphanedPlaylistReferences.push({
        playlistId: pl.id,
        playlistName: pl.name,
        missingTrackIds: missing,
      });
    }
  }

  return {
    totalScanned: tracks.length,
    tracksWithMissingArt,
    tracksWithMissingMetadata,
    potentialDuplicates,
    orphanedPlaylistReferences,
  };
}

/**
 * Execute Smart Synchro Auto-Repair:
 * Enriches missing metadata, retrieves official artwork, heals playlists
 */
export async function executeSmartSynchro(
  options: {
    enrichMetadata?: boolean;
    fetchMissingArtwork?: boolean;
    healPlaylists?: boolean;
    mergeDuplicates?: boolean;
    currentlyPlayingTrackId?: string | null;
  } = {},
  onProgress?: SynchroProgressCallback
): Promise<{
  repairedTracks: number;
  healedPlaylists: number;
  mergedDuplicates: number;
}> {
  const {
    enrichMetadata = true,
    fetchMissingArtwork = true,
    healPlaylists = true,
    mergeDuplicates = false,
    currentlyPlayingTrackId = null,
  } = options;

  let repairedTracks = 0;
  let healedPlaylists = 0;
  let mergedDuplicatesCount = 0;

  // 1. Diagnostic scan
  if (onProgress) {
    onProgress({
      current: 0,
      total: 100,
      stage: 'scanning',
      repairedCount: 0,
    });
  }

  const scan = await scanLibraryForRepairs();
  const tracksToRepair = new Map<string, Track>();

  if (fetchMissingArtwork) {
    for (const t of scan.tracksWithMissingArt) {
      tracksToRepair.set(t.id, t);
    }
  }

  if (enrichMetadata) {
    for (const t of scan.tracksWithMissingMetadata) {
      tracksToRepair.set(t.id, t);
    }
  }

  const repairList = Array.from(tracksToRepair.values());
  const totalItems = repairList.length;

  // 2. Metadata & Artwork Repair
  for (let i = 0; i < totalItems; i++) {
    const track = repairList[i];

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: totalItems,
        stage: fetchMissingArtwork ? 'fetching_artwork' : 'enriching_metadata',
        currentTrackTitle: track.title,
        repairedCount: repairedTracks,
      });
    }

    try {
      // Query official catalog (X1 identification)
      const identification = await identifyTrackViaCatalog(track.title, track.artist, track.duration);

      if (identification && identification.confidence >= 0.55) {
        let changed = false;
        const updated: Track = { ...track };

        // Enrich missing artwork
        if ((!updated.artworkUrl || updated.artworkUrl.includes('placeholder')) && identification.artworkUrl) {
          updated.artworkUrl = identification.artworkUrl;
          changed = true;
        }

        // Enrich missing album
        if ((!updated.album || updated.album.toLowerCase() === 'unknown album') && identification.album) {
          updated.album = identification.album;
          changed = true;
        }

        // Enrich missing or unknown artist
        if (
          (!updated.artist || updated.artist.toLowerCase() === 'unknown artist') &&
          identification.canonicalArtist
        ) {
          updated.artist = identification.canonicalArtist;
          changed = true;
        }

        // Clean generic title (e.g. "Track 01")
        if (/^track\s*\d+$/i.test(updated.title) && identification.canonicalTitle) {
          updated.title = identification.canonicalTitle;
          changed = true;
        }

        if (changed) {
          // Do not mutate audio blob or break current playback
          await db.updateTrackMetadata(updated);
          repairedTracks++;
        }
      }
    } catch (err) {
      console.warn(`Smart Synchro: failed to enrich track "${track.title}":`, err);
    }

    // Gentle delay to keep UI fluid and respect public rate limits
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  // 3. Heal Orphaned Playlist References
  if (healPlaylists && scan.orphanedPlaylistReferences.length > 0) {
    if (onProgress) {
      onProgress({
        current: totalItems,
        total: totalItems,
        stage: 'healing_playlists',
        repairedCount: repairedTracks,
      });
    }

    const playlists = await db.getAllPlaylists();
    const allTracks = await db.getAllTracks();
    const validIds = new Set(allTracks.map((t) => t.id));

    for (const pl of playlists) {
      const filtered = pl.trackIds.filter((id) => validIds.has(id));
      if (filtered.length !== pl.trackIds.length) {
        await db.savePlaylist({
          ...pl,
          trackIds: filtered,
          updatedAt: Date.now(),
        });
        healedPlaylists++;
      }
    }
  }

  // 4. Merge Duplicates (if explicitly requested)
  if (mergeDuplicates && scan.potentialDuplicates.length > 0) {
    for (const item of scan.potentialDuplicates) {
      // Do not delete track if it is currently playing
      const duplicatesToDelete = item.duplicateTracks
        .map((d) => d.id)
        .filter((id) => id !== currentlyPlayingTrackId);

      if (duplicatesToDelete.length > 0) {
        await db.deleteTracks(duplicatesToDelete);
        mergedDuplicatesCount += duplicatesToDelete.length;
      }
    }
  }

  if (onProgress) {
    onProgress({
      current: totalItems,
      total: totalItems,
      stage: 'complete',
      repairedCount: repairedTracks,
    });
  }

  return {
    repairedTracks,
    healedPlaylists,
    mergedDuplicates: mergedDuplicatesCount,
  };
}
