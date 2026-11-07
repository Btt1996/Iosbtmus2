/**
 * Spotify Public Discovery & User Profile Explorer
 * Enables browsing public Spotify user profiles (e.g. /user/{userId}),
 * retrieving public playlists, exploring curated playlists, and one-click import.
 */

import { NormalizedPlaylist, NormalizedTrackMetadata } from '../../types/playlistImport';
import { parseSpotifyTarget } from './x1Spotify';
import { isNativePlatform } from '../nativeAudioBridge';

export interface SpotifyPublicUser {
  id: string;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string;
  playlists: SpotifyPublicPlaylistSummary[];
}

export interface SpotifyPublicPlaylistSummary {
  id: string;
  name: string;
  description?: string;
  trackCount: number;
  coverUrl?: string;
  ownerName: string;
  externalUrl: string;
}

/**
 * Clean and extract a Spotify username or user ID from input string:
 * - https://open.spotify.com/user/spotify?si=...
 * - spotify:user:spotify
 * - @spotify or just "spotify"
 */
export function parseSpotifyUserId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  const urlMatch = trimmed.match(/open\.spotify\.com\/user\/([a-zA-Z0-9_.-]+)/i);
  if (urlMatch) return urlMatch[1];

  const uriMatch = trimmed.match(/^spotify:user:([a-zA-Z0-9_.-]+)/i);
  if (uriMatch) return uriMatch[1];

  // Plain username
  const clean = trimmed.replace(/^@/, '');
  if (/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Discover public playlists for a Spotify user
 */
export async function discoverUserPlaylists(
  usernameOrUrl: string
): Promise<SpotifyPublicUser> {
  const userId = parseSpotifyUserId(usernameOrUrl);
  if (!userId) {
    throw new Error('Please enter a valid Spotify username or profile URL.');
  }

  // 1. If not native, call backend proxy if available
  if (!isNativePlatform) {
    try {
      const res = await fetch(`/api/spotify/user?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.playlists && Array.isArray(data.playlists)) {
          return {
            id: userId,
            displayName: data.displayName || userId,
            profileUrl: `https://open.spotify.com/user/${userId}`,
            avatarUrl: data.avatarUrl,
            playlists: data.playlists,
          };
        }
      }
    } catch {
      // fallback to public embed resolution
    }
  }

  // 2. Open public embed discovery
  try {
    const embedUrl = `https://open.spotify.com/embed/user/${userId}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(embedUrl)}`;
    const res = await fetch(proxyUrl);

    if (res.ok) {
      const html = await res.text();
      const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        const parsed = JSON.parse(match[1]);
        const entity = parsed.props?.pageProps?.state?.data?.entity;
        if (entity) {
          const playlists: SpotifyPublicPlaylistSummary[] = (entity.publicPlaylists || []).map((pl: any) => ({
            id: pl.id || String(pl.uri || '').replace('spotify:playlist:', ''),
            name: pl.name || 'Untitled Playlist',
            description: pl.description || '',
            trackCount: pl.trackCount || (pl.tracks && pl.tracks.total) || 0,
            coverUrl: pl.images?.[0]?.url || pl.coverArt?.sources?.[0]?.url,
            ownerName: pl.owner?.displayName || userId,
            externalUrl: `https://open.spotify.com/playlist/${pl.id}`,
          }));

          return {
            id: userId,
            displayName: entity.name || entity.displayName || userId,
            profileUrl: `https://open.spotify.com/user/${userId}`,
            avatarUrl: entity.visualIdentity?.image?.[0]?.url,
            playlists,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Embed discovery fallback failed:', err);
  }

  // Return formatted user container with direct link
  return {
    id: userId,
    displayName: userId,
    profileUrl: `https://open.spotify.com/user/${userId}`,
    playlists: [],
  };
}

/**
 * Searches curated and popular playlists matching query
 */
export async function searchSpotifyPlaylists(
  query: string
): Promise<SpotifyPublicPlaylistSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // If input is direct Spotify link or ID, return single summary
  const target = parseSpotifyTarget(trimmed);
  if (target && target.type === 'playlist') {
    return [
      {
        id: target.id,
        name: `Spotify Playlist (${target.id.substring(0, 8)}...)`,
        ownerName: 'Spotify User',
        trackCount: 0,
        externalUrl: `https://open.spotify.com/playlist/${target.id}`,
      },
    ];
  }

  // Common popular discovery presets if user searches generic genres
  const presetResults: Record<string, SpotifyPublicPlaylistSummary[]> = {
    chill: [
      {
        id: '37i9dQZF1DX4WYpdgoIcn6',
        name: 'Chill Hits',
        ownerName: 'Spotify',
        trackCount: 100,
        description: 'Kick back to the best new and recent chill hits.',
        coverUrl: 'https://i.scdn.co/image/ab67706f00000002b60db5d10442d99d1e389e87',
        externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX4WYpdgoIcn6',
      },
      {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        name: "Today's Top Hits",
        ownerName: 'Spotify',
        trackCount: 50,
        description: 'The hottest tracks right now.',
        coverUrl: 'https://i.scdn.co/image/ab67706f00000002fe24d7084be472288cd6ee6c',
        externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
      },
    ],
    lofi: [
      {
        id: '37i9dQZF1DXdLEN7aqioXM',
        name: 'lofi beats',
        ownerName: 'Spotify',
        trackCount: 150,
        description: 'Beats to relax and study to.',
        coverUrl: 'https://i.scdn.co/image/ab67706f000000025f187a05dd85de8e792e3a09',
        externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DXdLEN7aqioXM',
      },
    ],
    workout: [
      {
        id: '37i9dQZF1DX76Wlfdnj7AP',
        name: 'Beast Mode',
        ownerName: 'Spotify',
        trackCount: 75,
        description: 'High energy hip hop and electronic beats for heavy lifting.',
        coverUrl: 'https://i.scdn.co/image/ab67706f000000027b407b489d816cb1eeec6990',
        externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX76Wlfdnj7AP',
      },
    ],
  };

  const lower = trimmed.toLowerCase();
  for (const [key, list] of Object.entries(presetResults)) {
    if (lower.includes(key)) return list;
  }

  return [];
}
