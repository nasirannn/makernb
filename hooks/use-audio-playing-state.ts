/**
 * 音频播放状态 Hook
 * 通过 EventBus 监听全局音频播放状态
 */
import { useState, useEffect } from 'react';
import { getEventBus, AUDIO_EVENTS } from '@/lib/event-bus';
import { getAudioService } from '@/lib/audio-service';

interface UseAudioPlayingStateOptions {
  trackId?: string | null; // 可选：只关心特定歌曲的播放状态
}

interface AudioPlayingState {
  isPlaying: boolean; // 是否正在播放
  isCurrentTrack: boolean; // 是否是当前播放的歌曲
  currentPlayingTrackId: string | null; // 当前播放的歌曲ID
}

/**
 * 监听音频播放状态的 Hook
 * 
 * @param options.trackId - 可选，指定要监听的歌曲 ID
 * @returns 播放状态信息
 * 
 * @example
 * // 监听全局播放状态
 * const { isPlaying } = useAudioPlayingState();
 * 
 * @example
 * // 监听特定歌曲的播放状态
 * const { isPlaying, isCurrentTrack } = useAudioPlayingState({ trackId: 'track-123' });
 */
export const useAudioPlayingState = (
  options: UseAudioPlayingStateOptions = {}
): AudioPlayingState => {
  const { trackId } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingTrackId, setCurrentPlayingTrackId] = useState<string | null>(null);

  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') return;
    
    const eventBus = getEventBus();
    const audioService = getAudioService();

    // 🎯 获取初始状态
    const initialIsPlaying = audioService.isPlaying();
    const initialTrackId = audioService.getCurrentTrackId();
    
    if (initialIsPlaying !== isPlaying) {
      setIsPlaying(initialIsPlaying);
    }
    if (initialTrackId !== currentPlayingTrackId) {
      setCurrentPlayingTrackId(initialTrackId);
    }
    
    

    // 播放事件处理
    const handlePlay = () => {
      setIsPlaying(true);
    };

    // 暂停事件处理
    const handlePause = () => {
      setIsPlaying(false);
    };

    // 歌曲切换事件处理
    const handleTrackChanged = (data: { trackId: string; audioUrl: string }) => {
      setCurrentPlayingTrackId(data.trackId);
    };

    // 注册事件监听器
    eventBus.on(AUDIO_EVENTS.PLAY, handlePlay);
    eventBus.on(AUDIO_EVENTS.PAUSE, handlePause);
    eventBus.on(AUDIO_EVENTS.TRACK_CHANGED, handleTrackChanged);

    

    // 清理事件监听器
    return () => {
      eventBus.off(AUDIO_EVENTS.PLAY, handlePlay);
      eventBus.off(AUDIO_EVENTS.PAUSE, handlePause);
      eventBus.off(AUDIO_EVENTS.TRACK_CHANGED, handleTrackChanged);
      
    };
  }, []);

  // 判断是否是当前播放的歌曲
  const isCurrentTrack = trackId ? currentPlayingTrackId === trackId : false;

  return {
    isPlaying,
    isCurrentTrack,
    currentPlayingTrackId,
  };
};

