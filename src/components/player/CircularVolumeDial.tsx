import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Volume2, Zap, Sliders, X, Check, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMusic } from '../../context/MusicContext';
import { triggerHaptic } from '../../services/nativeAudioBridge';

interface CircularVolumeDialProps {
  className?: string;
}

export const CircularVolumeDial: React.FC<CircularVolumeDialProps> = ({ className = '' }) => {
  const { playerState, setVolume, setVolumeBooster, toggleVolumeBooster } = useMusic();
  const { volume, volumeBooster, isBoosterActive, isMuted } = playerState;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const handleBackdropClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDraggingSlider) return;
    if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
      setIsExpanded(false);
    }
  };

  const radius = 28;
  const circumference = Math.PI * radius;

  // Upper arc (Volume): 0 to 1
  const effectiveVol = isMuted ? 0 : volume;
  const volDashoffset = circumference * (1 - effectiveVol);

  // Lower arc (Booster): 1.0x to 3.0x (normalized 0 to 1)
  const boosterRatio = isBoosterActive ? Math.min(1, Math.max(0, (volumeBooster - 1.0) / 2.0)) : 0;
  const boosterDashoffset = circumference * (1 - boosterRatio);

  const boosterPresets = [1.0, 1.5, 2.0, 2.5, 3.0];

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* COLLAPSED STATE: Liquid Glass Circular Audio Dial */}
      <motion.button
        type="button"
        onClick={() => {
          triggerHaptic();
          setIsExpanded(true);
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="relative w-18 h-18 rounded-full p-1 bg-[#0D1626]/90 backdrop-blur-3xl border border-[#24C7DB]/30 shadow-[0_8px_32px_rgba(0,0,0,0.7)] flex items-center justify-center cursor-pointer select-none group"
        title="Tap to adjust Volume & Audio Booster"
        aria-label="Audio dial - tap to expand"
      >
        {/* Specular glass highlight */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-[#24C7DB]/20 via-transparent to-white/20 pointer-events-none" />

        {/* Semicircle SVG Arcs */}
        <svg className="w-16 h-16 -rotate-90 pointer-events-none" viewBox="0 0 72 72">
          {/* Upper Track (Volume Background) */}
          <path
            d="M 36,8 A 28,28 0 0,1 36,64"
            fill="none"
            stroke="currentColor"
            className="text-white/10"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Upper Active (Volume Value - Cyan) */}
          <path
            d="M 36,8 A 28,28 0 0,1 36,64"
            fill="none"
            stroke="#24C7DB"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={volDashoffset}
            strokeLinecap="round"
            className="transition-all duration-200 drop-shadow-[0_0_6px_rgba(36,199,219,0.5)]"
          />

          {/* Lower Track (Booster Background) */}
          <path
            d="M 36,64 A 28,28 0 0,1 36,8"
            fill="none"
            stroke="currentColor"
            className="text-white/10"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Lower Active (Booster Value - Gold) */}
          <path
            d="M 36,64 A 28,28 0 0,1 36,8"
            fill="none"
            stroke={isBoosterActive ? '#E5B842' : '#7E8F9E'}
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={boosterDashoffset}
            strokeLinecap="round"
            className="transition-all duration-200 drop-shadow-[0_0_6px_rgba(229,184,66,0.5)]"
          />
        </svg>

        {/* Center Glass Core */}
        <div className="absolute inset-3.5 rounded-full bg-[#070E1A]/95 border border-[#24C7DB]/20 shadow-inner flex flex-col items-center justify-center text-center">
          {isBoosterActive && volumeBooster > 1.05 ? (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] font-mono font-black text-[#E5B842]">
                {volumeBooster.toFixed(1)}x
              </span>
              <span className="text-[7.5px] font-mono font-bold text-[#E5B842] mt-0.5">
                BOOST
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10.5px] font-mono font-black text-[#F0F4FA]">
                {Math.round(effectiveVol * 100)}%
              </span>
              <span className="text-[7.5px] font-mono font-bold text-[#7E8F9E] mt-0.5">
                VOL
              </span>
            </div>
          )}
        </div>
      </motion.button>

      {/* EXPANDED INTERACTIVE MODAL */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleBackdropClick}
                className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center items-center bg-black/75 backdrop-blur-md p-3 sm:p-6 pb-[max(env(safe-area-inset-bottom,0px),1rem)] select-none"
              >
                <motion.div
                  ref={cardRef}
                  initial={{ opacity: 0, y: 50, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 40, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-sm rounded-[2.2rem] bg-[#0A1322]/95 backdrop-blur-3xl border border-[#24C7DB]/30 shadow-[0_24px_70px_rgba(0,0,0,0.85)] p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-y-auto"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#24C7DB] to-[#0E8B9C] text-[#070E1A] flex items-center justify-center font-bold shadow-md">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-black tracking-wide uppercase text-[#F0F4FA] font-mono">
                          Audio Dial & Booster
                        </div>
                        <p className="text-[10px] text-[#24C7DB] font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-[#24C7DB]" />
                          DSP Soft-Knee Limiter Active
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic();
                        setIsExpanded(false);
                      }}
                      className="p-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[#F0F4FA] transition active:scale-90"
                      aria-label="Close menu"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* MASTER VOLUME */}
                  <div className="p-3.5 rounded-2xl bg-[#0D1524]/80 border border-white/10 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-[#F0F4FA]">
                      <span className="flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-[#24C7DB]" />
                        <span>Master Volume</span>
                      </span>
                      <span className="font-mono text-xs font-black text-[#24C7DB]">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>

                    <div className="relative py-1 flex items-center">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(volume * 100)}
                        onMouseDown={() => setIsDraggingSlider(true)}
                        onTouchStart={() => setIsDraggingSlider(true)}
                        onMouseUp={() => setIsDraggingSlider(false)}
                        onTouchEnd={() => setIsDraggingSlider(false)}
                        onChange={(e) => setVolume(Number(e.target.value) / 100)}
                        className="w-full h-3 rounded-full appearance-none cursor-pointer bg-white/15 accent-[#24C7DB]"
                      />
                    </div>
                  </div>

                  {/* REAL 3X DIGITAL AUDIO BOOSTER STAGE */}
                  <div className="p-3.5 rounded-2xl bg-[#0D1524]/80 border border-[#E5B842]/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#F0F4FA]">
                          <Zap className="w-4 h-4 text-[#E5B842]" />
                          <span>Volume Booster (1.0x – 3.0x)</span>
                        </div>
                        <span className="text-[10px] text-[#E5B842] font-mono">
                          {isBoosterActive && volumeBooster > 1.0
                            ? `Amplified to ${(volumeBooster * 100).toFixed(0)}%`
                            : 'Standard Line Output'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleVolumeBooster()}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 ${
                          isBoosterActive && volumeBooster > 1.0
                            ? 'bg-[#E5B842] text-[#070E1A] shadow-[0_0_12px_rgba(229,184,66,0.4)]'
                            : 'bg-white/10 text-[#7E8F9E] hover:text-[#F0F4FA]'
                        }`}
                        title="Toggle volume booster"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>{isBoosterActive && volumeBooster > 1.0 ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>

                    {/* Booster Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-[#7E8F9E]">
                        <span>1.0x (100%)</span>
                        <span className="font-bold text-[#E5B842]">
                          {(volumeBooster * 100).toFixed(0)}%
                        </span>
                        <span>3.0x (300%)</span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={300}
                        step={5}
                        value={Math.round(volumeBooster * 100)}
                        onMouseDown={() => setIsDraggingSlider(true)}
                        onTouchStart={() => setIsDraggingSlider(true)}
                        onMouseUp={() => setIsDraggingSlider(false)}
                        onTouchEnd={() => setIsDraggingSlider(false)}
                        onChange={(e) => setVolumeBooster(Number(e.target.value) / 100)}
                        className="w-full h-3 rounded-full appearance-none cursor-pointer bg-white/15 accent-[#E5B842]"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center justify-between gap-1 pt-1">
                      {boosterPresets.map((mult) => {
                        const isSelected = isBoosterActive && Math.abs(volumeBooster - mult) < 0.08;
                        return (
                          <button
                            key={mult}
                            type="button"
                            onClick={() => setVolumeBooster(mult)}
                            className={`flex-1 py-1 rounded-lg text-[10.5px] font-mono font-bold transition active:scale-90 border ${
                              isSelected
                                ? 'bg-[#E5B842] text-[#070E1A] border-[#E5B842] shadow-sm'
                                : 'bg-white/5 text-[#7E8F9E] border-white/10 hover:text-[#F0F4FA]'
                            }`}
                          >
                            {mult.toFixed(1)}x
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-[#7E8F9E] leading-relaxed">
                      Real digital gain amplification with soft-knee limiting dynamics compressor. Prevents clipping and crackling while preserving iOS background audio playback.
                    </p>
                  </div>

                  {/* Done Button */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      setIsExpanded(false);
                    }}
                    className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#24C7DB] to-[#0E8B9C] text-[#070E1A] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Done</span>
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
