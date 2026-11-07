import { registerPlugin, Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface NowPlayingPayload {
  title: string;
  artist: string;
  album: string;
  duration: number;
  currentTime: number;
  playbackRate: number;
  artworkUrl?: string;
}

export type RemoteCommandType =
  | 'play'
  | 'pause'
  | 'togglePlayPause'
  | 'nextTrack'
  | 'previousTrack'
  | 'seekTo';

export interface RemoteCommandEvent {
  command: RemoteCommandType;
  position?: number;
}

export interface AudioInterruptionEvent {
  type: 'began' | 'ended';
  shouldResume?: boolean;
}

export interface RouteChangeEvent {
  reason: string;
}

export interface AudioBridgePlugin {
  configureAudioSession(): Promise<{ configured: boolean }>;
  setNowPlayingInfo(options: NowPlayingPayload): Promise<{ success: boolean }>;
  updatePlaybackState(options: { currentTime?: number; playbackRate: number }): Promise<{ success: boolean }>;
  clearNowPlayingInfo(): Promise<{ success: boolean }>;
  beginBackgroundTask(): Promise<{ taskId: number }>;
  endBackgroundTask(): Promise<{ ended: boolean }>;
  addListener(
    eventName: 'remoteCommand',
    listenerFunc: (event: RemoteCommandEvent) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'audioInterruption',
    listenerFunc: (event: AudioInterruptionEvent) => void
  ): Promise<{ remove: () => void }>;
  addListener(
    eventName: 'routeChange',
    listenerFunc: (event: RouteChangeEvent) => void
  ): Promise<{ remove: () => void }>;
}

/**
 * Register native AudioBridge plugin with safe Web/PWA fallback
 */
export const AudioBridge = registerPlugin<AudioBridgePlugin>('AudioBridge', {
  web: {
    configureAudioSession: async () => ({ configured: false }),
    setNowPlayingInfo: async () => ({ success: false }),
    updatePlaybackState: async () => ({ success: false }),
    clearNowPlayingInfo: async () => ({ success: false }),
    beginBackgroundTask: async () => ({ taskId: 0 }),
    endBackgroundTask: async () => ({ ended: true }),
    addListener: async () => ({ remove: () => {} }),
  },
});

export const isNativePlatform = Capacitor.isNativePlatform();
export const isIOSNative = isNativePlatform && Capacitor.getPlatform() === 'ios';

/**
 * Haptic feedback helper for native iOS tactile response
 */
export async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!isNativePlatform) return;
  try {
    await Haptics.impact({ style });
  } catch {
    // ignore on unsupported devices
  }
}
