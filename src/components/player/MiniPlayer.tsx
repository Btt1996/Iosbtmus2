import React, { useState } from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { useMusic } from '../../context/MusicContext';
import { BttPlaybackAnimation, BttAnimationTrigger } from './BttPlaybackAnimation';
import { triggerHaptic } from '../../services/nativeAudioBridge';

export const MiniPlayer: React.FC = () => {
  const { playerState, togglePlayPause, nextTrack, setIsFullScreenPlayerOpen, isFullScreenPlayerOpen } = useMusic();
  const { currentTrack, isPlaying, currentTime, duration, isLoading, isSmartMixBlending, volumeBooster, isBoosterActive } = playerState;
  const [bttTrigger, setBttTrigger] = useState<BttAnimationTrigger | null>(null);
  const [activeButton, setActiveButton] = useState<'play' | 'next' | null>(null);

  // If no track or full screen player is open, hide mini player to prevent any interference
  if (!currentTrack || isFullScreenPlayerOpen) return null;

  const activeDuration = duration > 0 ? duration : currentTrack.duration || 180;
  const progressPercent = activeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / activeDuration) * 100)) : 0;

  const handleMiniPlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    togglePlayPause();
    setBttTrigger({ id: Date.now(), type: 'play' });
    setActiveButton('play');
    setTimeout(() => setActiveButton(null), 400);
  };

  const handleMiniNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic();
    nextTrack();
    setBttTrigger({ id: Date.now(), type: 'next' });
    setActiveButton('next');
    setTimeout(() => setActiveButton(null), 400);
  };

  return (
    <div
      className="fixed bottom-[calc(5.75rem+max(env(safe-area-inset-bottom,0px),0.75rem))] left-3.5 right-3.5 z-35 max-w-md mx-auto pointer-events-auto select-none"
      onClick={() => setIsFullScreenPlayerOpen(true)}
    >
      <div className="relative overflow-hidden rounded-[1.8rem] bg-[#0D1626]/92 backdrop-blur-3xl border border-[#24C7DB]/25 shadow-[0_16px_44px_rgba(0,0,0,0.85)] p-2.5 flex items-center gap-3.5 cursor-pointer active:scale-[0.98] transition-all">
        {/* Specular Liquid Top Highlight */}
        <div className="absolute inset-x-5 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#24C7DB]/50 to-transparent pointer-events-none" />

        {/* BTT signature micro-interaction animation overlay */}
        <BttPlaybackAnimation currentTrigger={bttTrigger} />

        {/* Bottom Micro Scrubber Progress Line in Cyan & Gold */}
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-[#24C7DB] to-[#E5B842] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Small Album Artwork */}
        <div className="w-12 h-12 rounded-xl bg-[#070E1A] shrink-0 overflow-hidden relative shadow-md border border-[#24C7DB]/25 flex items-center justify-center">
          {currentTrack.artworkUrl ? (
            <img
              src={currentTrack.artworkUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <img
              src="/app-logo.png"
              alt="btmu"
              className="w-full h-full object-cover"
            />
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#24C7DB] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Track Title and Artist */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs sm:text-sm font-bold text-[#F0F4FA] truncate leading-snug">
              {currentTrack.title}
            </h4>
            {isSmartMixBlending && (
              <span className="px-1.5 py-0.2 rounded bg-[#24C7DB]/20 text-[#24C7DB] text-[9px] font-mono font-bold shrink-0">
                Mix
              </span>
            )}
            {isBoosterActive && volumeBooster > 1.0 && (
              <span className="px-1 py-0.2 rounded bg-[#E5B842]/20 text-[#E5B842] text-[8.5px] font-mono font-bold shrink-0">
                {(volumeBooster * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#7E8F9E] font-medium truncate mt-0.5">
            {currentTrack.artist || 'Unknown Artist'}
          </p>
        </div>

        {/* Mini Controls with BTT tactile animation */}
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleMiniPlayPause}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-85 ${
              activeButton === 'play'
                ? 'scale-115 bg-[#24C7DB]/30 shadow-[0_0_16px_rgba(36,199,219,0.5)]'
                : 'hover:bg-white/10'
            }`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-[#24C7DB] fill-[#24C7DB]" />
            ) : (
              <Play className="w-5 h-5 text-[#24C7DB] fill-[#24C7DB] ml-0.5" />
            )}
          </button>

          <button
            onClick={handleMiniNext}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-85 ${
              activeButton === 'next'
                ? 'scale-115 bg-[#24C7DB]/30 shadow-[0_0_16px_rgba(36,199,219,0.5)]'
                : 'hover:bg-white/10 text-[#7E8F9E] hover:text-[#F0F4FA]'
            }`}
            aria-label="Next track"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
