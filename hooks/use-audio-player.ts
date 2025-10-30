/**
 * 音乐播放器Hook
 * 连接音频服务和React组件，提供音频播放控制和状态管理
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getAudioService, AudioService } from '@/lib/audio-service';
import { getCoverManager, CoverManager } from '@/lib/cover-manager';
import { getEventBus, EventBus, AUDIO_EVENTS, COVER_EVENTS, TRACK_EVENTS } from '@/lib/event-bus';
import { AudioPlayerTrack } from '@/types/track';

export interface AudioState {
  currentTrack: AudioPlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export const useAudioPlayer = () => {
  // ==================== 状态管理 ====================
  const [audioState, setAudioState] = useState<AudioState>({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
  });

  // ==================== 服务引用 ====================
  const audioService = useRef<AudioService | null>(null);
  const coverManager = useRef<CoverManager | null>(null);
  const eventBus = useRef<EventBus | null>(null);

  // ==================== 初始化 ====================
  // 确保只在客户端初始化服务
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioService.current = getAudioService();
      coverManager.current = getCoverManager();
      eventBus.current = getEventBus();
    }
  }, []);

  // ==================== 状态同步 ====================
  // 定期检查并同步音频服务状态与React状态
  useEffect(() => {
    const audio = audioService.current;
    if (!audio) return;

    const syncState = () => {
      const actualIsPlaying = audio.isPlaying();
      setAudioState(prev => {
        // 只在状态不一致时才更新
        if (prev.isPlaying !== actualIsPlaying) {
          return { ...prev, isPlaying: actualIsPlaying };
        }
        return prev;
      });
    };

    // 每500ms检查一次状态同步
    const syncInterval = setInterval(syncState, 500);

    return () => {
      clearInterval(syncInterval);
    };
  }, []);

  // ==================== 事件监听 ====================
  // 监听音频服务事件并更新状态
  useEffect(() => {
    const audio = audioService.current;
    const bus = eventBus.current;
    
    if (!audio || !bus) return;

    // 事件处理器
    const handlePlay = () => {
      // 🎯 只在状态不一致时才更新，避免覆盖乐观更新
      setAudioState(prev => {
        if (prev.isPlaying) return prev; // 已经是播放状态，无需更新
        return { ...prev, isPlaying: true };
      });
      bus.emit(AUDIO_EVENTS.PLAY);
    };

    const handlePause = () => {
      // 🎯 只在状态不一致时才更新，避免覆盖乐观更新
      setAudioState(prev => {
        if (!prev.isPlaying) return prev; // 已经是暂停状态，无需更新
        return { ...prev, isPlaying: false };
      });
      bus.emit(AUDIO_EVENTS.PAUSE);
    };

    const handleTimeUpdate = (data: { currentTime: number; duration: number }) => {
      setAudioState(prev => ({
        ...prev,
        currentTime: data.currentTime,
        duration: data.duration,
      }));
      bus.emit(AUDIO_EVENTS.TIMEUPDATE, data);
    };

    const handleLoadedMetadata = (data: { duration: number }) => {
      setAudioState(prev => ({
        ...prev,
        duration: data.duration,
      }));
    };

    const handleTrackChanged = (data: { trackId: string; audioUrl: string }) => {
      bus.emit(AUDIO_EVENTS.TRACK_CHANGED, data);
    };

    const handleError = (error: Error) => {
      console.error('Audio error:', error);
      bus.emit(AUDIO_EVENTS.ERROR, error);
    };

    const handleEnded = () => {
      // 🎯 当歌曲播放完毕时，重置进度条和播放状态
      // 先重置 Audio 元素的 currentTime，防止后续 timeupdate 事件覆盖状态
      if (audio) {
        audio.seek(0);
      }
      
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0, // 重置进度到开始
        // duration 保持不变，继续显示歌曲总时长
      }));
      bus.emit(AUDIO_EVENTS.ENDED);
    };

    // 注册事件监听器
    audio.on('play', handlePlay);
    audio.on('pause', handlePause);
    audio.on('timeupdate', handleTimeUpdate);
    audio.on('loadedmetadata', handleLoadedMetadata);
    audio.on('trackChanged', handleTrackChanged);
    audio.on('error', handleError);
    audio.on('ended', handleEnded);

    // 清理事件监听器
    return () => {
      audio.off('play', handlePlay);
      audio.off('pause', handlePause);
      audio.off('timeupdate', handleTimeUpdate);
      audio.off('loadedmetadata', handleLoadedMetadata);
      audio.off('trackChanged', handleTrackChanged);
      audio.off('error', handleError);
      audio.off('ended', handleEnded);
    };
  }, []);

  // ==================== 监听歌曲完成事件 ====================
  // 监听 EventBus 的歌曲完成事件，更新当前播放歌曲的 duration
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const bus = eventBus.current;
    if (!bus) return;

    const handleTrackCompleted = (data: { trackId: string; duration: number; audioUrl: string }) => {
      
      // 如果完成的歌曲是当前播放的歌曲，更新 duration
      setAudioState(prev => {
        if (prev.currentTrack?.id === data.trackId) {
          
          
          // ✅ 只更新 duration，不更新 audioUrl
          // 原因：如果歌曲正在播放，切换 audioUrl 会导致音频重新加载和播放位置重置
          // 当前已经在播放的 streamAudioUrl 可以继续使用
          return {
            ...prev,
            duration: data.duration, // 更新总时长
            // currentTime 保持不变，进度条会自动调整到正确位置
            currentTrack: {
              ...prev.currentTrack,
              duration: data.duration,
              // 不更新 audioUrl，避免重新加载音频
              // audioUrl: data.audioUrl  // ❌ 注释掉
            }
          };
        }
        return prev;
      });
    };

    bus.on(TRACK_EVENTS.COMPLETED, handleTrackCompleted);

    return () => {
      bus.off(TRACK_EVENTS.COMPLETED, handleTrackCompleted);
    };
  }, []);

  // ==================== 监听歌曲删除事件 ====================
  // 如果正在播放的歌曲被删除，停止播放
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const bus = eventBus.current;
    if (!bus) return;

    const handleTrackDeleted = (data: { trackId: string }) => {
      
      setAudioState(prev => {
        // 如果删除的是当前播放的歌曲
        if (prev.currentTrack?.id === data.trackId) {
          
          
          // 停止播放
          if (audioService.current) {
            audioService.current.pause();
          }
          
          // 清空播放器状态
          return {
            ...prev,
            isPlaying: false,
            currentTrack: null,
            currentTime: 0,
            duration: 0,
          };
        }
        return prev;
      });
    };

    bus.on(TRACK_EVENTS.DELETED, handleTrackDeleted);

    return () => {
      bus.off(TRACK_EVENTS.DELETED, handleTrackDeleted);
    };
  }, []);

  // ==================== 播放控制 ====================
  // 播放指定歌曲
  const playTrack = useCallback(async (track: AudioPlayerTrack) => {
    if (!audioService.current) return;
    
    try {
      // 智能选择音频URL：优先使用本地音频，如果没有则使用stream音频
      const audioUrl = track.audioUrl || '';
      const streamAudioUrl = track.streamAudioUrl || '';
      
      // 🎯 乐观更新：立即设置播放状态和当前歌曲
      setAudioState(prev => ({
        ...prev,
        currentTrack: track,
        duration: track.duration || 0,
        isPlaying: true, // 假设播放会成功
      }));
      
      await audioService.current.playTrack(track.id, audioUrl, streamAudioUrl);
    } catch (error) {
      console.error('Failed to play track:', error);
      // 播放失败时回滚状态
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
      }));
    }
  }, []);

  // 暂停/恢复播放 - 使用乐观更新策略
  const togglePlayPause = useCallback(async () => {
    if (!audioService.current) return;
    
    // 🎯 乐观更新：立即更新UI状态，不等待异步操作
    const currentIsPlaying = audioState.isPlaying;
    setAudioState(prev => ({ ...prev, isPlaying: !currentIsPlaying }));
    
    try {
      await audioService.current.togglePlayPause();
    } catch (error) {
      // 如果操作失败，回滚状态
      console.error('Toggle play/pause failed:', error);
      setAudioState(prev => ({ ...prev, isPlaying: currentIsPlaying }));
    }
  }, [audioState.isPlaying]);

  // 跳转到指定时间
  const seek = useCallback((time: number) => {
    if (!audioService.current) return;
    audioService.current.seek(time);
  }, []);

  // ==================== 音量控制 ====================
  // 设置音量
  const setVolume = useCallback((volume: number) => {
    if (!audioService.current) return;
    audioService.current.setVolume(volume);
    setAudioState(prev => ({ ...prev, volume }));
  }, []);

  // 切换静音状态
  const toggleMute = useCallback(() => {
    if (!audioService.current) return;
    const newMuted = !audioState.isMuted;
    audioService.current.setMuted(newMuted);
    setAudioState(prev => ({ ...prev, isMuted: newMuted }));
  }, [audioState.isMuted]);

  // ==================== 状态管理 ====================
  // 更新当前播放歌曲的duration
  const updateCurrentTrackDuration = useCallback((duration: number) => {
    setAudioState(prev => ({
      ...prev,
      duration: duration,
    }));
  }, []);

  // 清理当前播放状态
  const clearCurrentTrack = useCallback(() => {
    if (!audioService.current) {
      setAudioState(prev => ({
        ...prev,
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
      }));
      return;
    }
    
    // 只调用AudioService的clearCurrentTrack方法（它内部会调用pause）
    audioService.current.clearCurrentTrack();
    
    // 清理React状态
    setAudioState(prev => ({
      ...prev,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
    }));
  }, []);

  // ==================== 预览功能 ====================
  // 简单的音频预览功能（用于乐器预览等）
  const playPreviewAudio = useCallback((audioUrl: string, audioId: string) => {
    if (!audioService.current) return;
    
    // 创建临时的音频元素用于预览
    const previewAudio = new Audio(audioUrl);
    
    // 如果当前有预览音频在播放，先停止
    const currentPreview = document.querySelector('audio[data-preview="true"]') as HTMLAudioElement;
    if (currentPreview) {
      currentPreview.pause();
      currentPreview.remove();
    }
    
    // 标记为预览音频
    previewAudio.setAttribute('data-preview', 'true');
    previewAudio.setAttribute('data-audio-id', audioId);
    
    // 播放预览音频
    previewAudio.play().catch(error => {
      console.error('Preview audio play failed:', error);
    });
    
    // 播放结束后清理
    previewAudio.addEventListener('ended', () => {
      previewAudio.remove();
    });
  }, []);

  // ==================== 封面管理 ====================
  // 获取封面URL
  const getCoverUrl = useCallback((trackId: string) => {
    if (!coverManager.current) return undefined;
    return coverManager.current.getCoverUrl(trackId);
  }, []);

  // ==================== 返回值 ====================
  return {
    // 音频状态
    ...audioState,
    // 播放控制
    playTrack,
    togglePlayPause,
    seek,
    // 音量控制
    setVolume,
    toggleMute,
    // 状态管理
    updateCurrentTrackDuration,
    clearCurrentTrack,
    // 预览功能
    playPreviewAudio,
    // 封面管理
    getCoverUrl,
  };
};

/**
 * 封面更新Hook
 * 监听封面更新事件并更新UI状态，提供封面管理功能
 */
export const useCoverUpdates = (tracks: AudioPlayerTrack[]) => {
  // ==================== 状态管理 ====================
  const [trackCovers, setTrackCovers] = useState<Record<string, string>>({});
  const eventBus = useRef<EventBus | null>(null);
  const coverManager = useRef<CoverManager | null>(null);

  // ==================== 初始化 ====================
  // 确保只在客户端初始化服务
  useEffect(() => {
    if (typeof window !== 'undefined') {
      eventBus.current = getEventBus();
      coverManager.current = getCoverManager();
      
      // 设置CoverManager的EventBus引用，建立桥接
      if (coverManager.current && eventBus.current) {
        coverManager.current.setEventBus(eventBus.current);
      }
    }
  }, []);

  // ==================== 事件监听 ====================
  // 监听封面更新事件
  useEffect(() => {
    const bus = eventBus.current;
    
    if (!bus) return;

    const handleCoverUpdated = (data: { trackId: string; coverUrl: string }) => {
      setTrackCovers(prev => ({
        ...prev,
        [data.trackId]: data.coverUrl,
      }));
    };

    const handleCoverError = (data: { trackId: string; error: Error }) => {
      console.error('Cover update error for track:', data.trackId, data.error);
    };

    // 注册事件监听器
    bus.on(COVER_EVENTS.UPDATED, handleCoverUpdated);
    bus.on(COVER_EVENTS.ERROR, handleCoverError);

    // 清理事件监听器
    return () => {
      bus.off(COVER_EVENTS.UPDATED, handleCoverUpdated);
      bus.off(COVER_EVENTS.ERROR, handleCoverError);
    };
  }, []);

  // ==================== 封面管理 ====================
  // 更新封面
  const updateCover = useCallback(async (trackId: string, coverUrl: string) => {
    if (!coverManager.current) return;
    await coverManager.current.updateCoverAsync(trackId, coverUrl);
  }, []);

  // 获取带封面的tracks
  const getTracksWithCovers = useCallback(() => {
    return tracks.map(track => ({
      ...track,
      coverImage: trackCovers[track.id] || track.coverImage,
    }));
  }, [tracks, trackCovers]);

  // ==================== 返回值 ====================
  return {
    trackCovers,
    updateCover,
    getTracksWithCovers,
  };
};
