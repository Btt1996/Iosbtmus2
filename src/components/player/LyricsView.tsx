import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, RefreshCw, X, Music, AlertCircle, ExternalLink, ChevronDown, Check, Mic2 } from 'lucide-react';
import { Track } from '../../types/music';
import { SongLyrics, LyricLine, fetchLyricsForTrack } from '../../services/lyricsService';

interface LyricsViewProps {
  track: Track;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  onClose: () => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  track,
  currentTime,
  duration,
  onSeek,
  onClose,
}) => {
  const [lyrics, setLyrics] = useState<SongLyrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);

  // Load lyrics on track change
  useEffect(() => {
    let isCancelled = false;

    const loadLyrics = async () => {
      setIsLoading(true);
      setHasSearched(false);
      try {
        const result = await fetchLyricsForTrack(track.id, track.title, track.artist, duration || track.duration);
        if (!isCancelled) {
          setLyrics(result);
          setHasSearched(true);
        }
      } catch (err) {
        if (!isCancelled) {
          setHasSearched(true);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadLyrics();

    return () => {
      isCancelled = true;
    };
  }, [track.id, track.title, track.artist, duration]);

  // Determine active synced line based on currentTime
  useEffect(() => {
    if (!lyrics?.syncedLyrics || lyrics.syncedLyrics.length === 0) {
      setActiveLineIndex(-1);
      return;
    }

    const lines = lyrics.syncedLyrics;
    let index = -1;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time - 0.2) {
        index = i;
      } else {
        break;
      }
    }

    setActiveLineIndex(index);

    // Auto-scroll active line into view smoothly if user is not actively scrolling
    if (index >= 0 && !isUserScrollingRef.current && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime, lyrics?.syncedLyrics]);

  // Handle user manual scroll detection
  const handleScroll = () => {
    isUserScrollingRef.current = true;
    if (userScrollTimeoutRef.current) {
      window.clearTimeout(userScrollTimeoutRef.current);
    }
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 2500);
  };

  const handleManualRetry = async () => {
    setIsLoading(true);
    const result = await fetchLyricsForTrack(track.id, track.title, track.artist, duration);
    setLyrics(result);
    setHasSearched(true);
    setIsLoading(false);
  };

  return (
    <div className="relative rounded-[2.2rem] bg-[#0D1524]/90 dark:bg-[#0D1524]/95 text-[#070E1A] dark:text-[#F0F4FA] overflow-hidden shadow-2xl border border-[#0E8B9C]/25 dark:border-[#24C7DB]/30 flex flex-col h-[380px] sm:h-[440px] transition-all select-none">
      {/* Dynamic ambient backdrop glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0E8B9C]/15 dark:from-[#24C7DB]/10 via-transparent to-black/20 pointer-events-none" />

      {/* Header Bar */}
      <div className="relative z-10 px-5 pt-4 pb-3 flex items-center justify-between border-b border-[#070E1A]/10 dark:border-white/10 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#24C7DB] text-[#070E1A] flex items-center justify-center font-bold">
            <Mic2 className="w-3.5 h-3.5 text-[#0E8B9C]" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-[#0E8B9C] dark:text-[#24C7DB] font-mono">
            Lyrics
          </span>
          {lyrics?.syncedLyrics && (
            <span className="px-2 py-0.5 rounded-full bg-[#24C7DB] text-[#070E1A] text-[9px] font-bold tracking-wider uppercase">
              Synced
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleManualRetry}
            disabled={isLoading}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#0E8B9C] dark:text-[#24C7DB] transition active:scale-95"
            title="Refresh lyrics"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#777267] dark:text-[#92998F] transition active:scale-95"
            aria-label="Close lyrics"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Lyrics Content Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative z-10 flex-1 overflow-y-auto px-6 py-6 space-y-4 scroll-smooth"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
            <div className="w-8 h-8 rounded-full border-3 border-[#24C7DB] border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-[#777267] dark:text-[#92998F]">
              Searching lyrics for {track.title}...
            </p>
          </div>
        ) : lyrics?.syncedLyrics && lyrics.syncedLyrics.length > 0 ? (
          /* Real-time Synced Lyrics */
          lyrics.syncedLyrics.map((line, idx) => {
            const isActive = idx === activeLineIndex;
            const isPast = idx < activeLineIndex;

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => onSeek(line.time)}
                className={`cursor-pointer transition-all duration-200 py-1.5 rounded-xl px-2.5 -mx-2.5 leading-relaxed ${
                  isActive
                    ? 'text-[#0E8B9C] dark:text-[#24C7DB] text-xl sm:text-2xl font-black bg-[#24C7DB]/20 scale-[1.02] shadow-xs'
                    : isPast
                    ? 'text-[#777267] dark:text-[#92998F] text-base sm:text-lg font-medium hover:text-[#070E1A] dark:hover:text-[#F0F4FA]'
                    : 'text-[#777267]/60 dark:text-[#92998F]/60 text-base sm:text-lg font-medium hover:text-[#070E1A] dark:hover:text-[#F0F4FA]'
                }`}
              >
                {line.text}
              </div>
            );
          })
        ) : lyrics?.plainLyrics && lyrics.plainLyrics.length > 0 ? (
          /* Plain Unsynced Lyrics */
          <div className="space-y-2.5 py-2">
            {lyrics.plainLyrics.map((line, idx) => (
              <p
                key={idx}
                className="text-base sm:text-lg text-[#070E1A] dark:text-[#F0F4FA] font-medium leading-relaxed"
              >
                {line}
              </p>
            ))}
          </div>
        ) : hasSearched ? (
          /* No Lyrics Found State */
          <div className="h-full flex flex-col items-center justify-center text-center py-8 space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#24C7DB]/20 text-[#0E8B9C] dark:text-[#24C7DB] flex items-center justify-center">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-[#070E1A] dark:text-[#F0F4FA]">
                Couldn't find lyrics
              </h4>
              <p className="text-xs text-[#777267] dark:text-[#92998F] mt-1 max-w-xs">
                Lyrics for "{track.title}" are not yet catalogued on LRCLIB.
              </p>
            </div>
            <button
              onClick={handleManualRetry}
              className="mt-2 px-4 py-2 rounded-xl bg-[#0E8B9C] text-[#0D1524] dark:bg-[#24C7DB] dark:text-[#070E1A] text-xs font-bold active:scale-95 transition shadow-xs"
            >
              Search Again
            </button>
          </div>
        ) : null}
      </div>

      {/* Footer Attribution */}
      {lyrics && (
        <div className="relative z-10 px-5 py-2.5 border-t border-[#070E1A]/10 dark:border-white/10 bg-black/5 dark:bg-black/30 text-[10px] text-[#777267] dark:text-[#92998F] flex items-center justify-between font-mono shrink-0">
          <span>Source: {lyrics.source}</span>
          <span className="text-[#0E8B9C] dark:text-[#24C7DB] font-semibold">Tap line to jump</span>
        </div>
      )}
    </div>
  );
};
