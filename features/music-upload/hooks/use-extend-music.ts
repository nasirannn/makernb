/**
 * 扩展音乐轮询 Hook
 * 参考 use-music-generation.ts 的实现
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { MusicGenerationTrack } from '@/types/track';

// 轮询配置
const POLLING_CONFIG = {
  INTERVAL: 5000, // 5秒轮询一次
  INITIAL_DELAY: 2000, // 首次轮询延迟2秒
  MAX_DURATION: 10 * 60 * 1000, // 最大轮询时长10分钟
  MAX_RETRIES: 5, // 最大重试次数
};

type ExtendMusicStatus = 'generating' | 'complete' | 'error';

interface PollingState {
  isPolling: boolean;
  taskId: string | null;
  startTime: number;
  retryCount: number;
  timeoutId: NodeJS.Timeout | null;
  abortController: AbortController | null;
}

// 扩展音乐状态接口（用于弹窗）
export interface ExtendMusicState {
  status?: 'processing' | 'completed' | 'error';
  taskId?: string;
  progress?: number;
  errorMessage?: string;
  trackTitle?: string;
  extendedTracks?: Array<{
    id: string;
    title: string;
    audioUrl?: string;
    streamAudioUrl?: string;
    duration?: number;
  }>;
}

/**
 * 扩展音乐轮询 Hook
 * @param onTracksUpdate 回调函数，用于直接更新 generatedTracks（轮询过程中显示）
 * @param onComplete 回调函数，延长音乐完成时调用（用于刷新 userTracks）
 */
export const useExtendMusic = (
  onTracksUpdate?: (updater: (prev: MusicGenerationTrack[]) => MusicGenerationTrack[]) => void,
  onComplete?: () => void
) => {
  const [isExtending, setIsExtending] = useState(false);
  
  // 状态存储（用于弹窗显示）
  const [extendMusicStates, setExtendMusicStates] = useState<Map<string, ExtendMusicState>>(new Map());
  
  const pollingStateRef = useRef<PollingState>({
    isPolling: false,
    taskId: null,
    startTime: 0,
    retryCount: 0,
    timeoutId: null,
    abortController: null,
  });

  // 清理轮询资源
  const cleanup = useCallback(() => {
    const state = pollingStateRef.current;
    
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    
    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }
    
    state.isPolling = false;
    state.taskId = null;
    state.retryCount = 0;
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 转换API返回的数据为Track
  const convertToTracks = (
    tracks: any[],
    status: ExtendMusicStatus,
    generationId: string
  ): MusicGenerationTrack[] => {
    return tracks.map((t: any) => {
      const isGenerating = status === 'generating';
      
      return {
        id: t.id,
        generationId: generationId || '',
        sunoTrackId: t.suno_track_id || null,
        title: t.title || 'Untitled Track',
        audioUrl: t.audioUrl || '',
        streamAudioUrl: t.streamAudioUrl || '',
        duration: t.duration,
        coverImage: t.coverImage,
        tags: t.tags || '',
        genre: t.genre,
        prompt: t.prompt || '',
        lyrics: t.lyrics || '',
        createdAt: t.createdAt || new Date().toISOString(),
        isGenerating,
        isCompleted: status === 'complete',
        isPlaceholder: false,
        isExtension: true, // 标记为扩展音乐
        originalTrackId: t.originalTrackId || null, // 设置原歌曲ID，用于分组
      };
    });
  };

  // 不再创建占位符 track，等待回调创建 tracks 后再显示

  // 智能合并新数据和现有数据
  const mergeTracks = (
    prevTracks: MusicGenerationTrack[],
    newTracks: MusicGenerationTrack[],
    status: ExtendMusicStatus
  ): MusicGenerationTrack[] => {
    const merged = [...prevTracks];
    
    newTracks.forEach((newTrack) => {
      // 通过 ID 查找现有 track
      const existingIndex = merged.findIndex(
        (t) => t.id === newTrack.id
      );
      
      if (existingIndex >= 0) {
        // 更新现有 track
        const existing = merged[existingIndex];
        merged[existingIndex] = {
          ...existing,
          ...newTrack,
          // 保持扩展标记
          isExtension: true,
          // 如果状态为 complete，标记为已完成
          isCompleted: status === 'complete',
          isGenerating: status !== 'complete',
        };
      } else {
        // 添加新 track（回调创建的新 track）
        merged.push(newTrack);
      }
    });
    
    return merged;
  };

  // 计算进度百分比
  const calculateProgress = useCallback((elapsed: number, hasTracks: boolean): number => {
    if (hasTracks) {
      // 有 tracks 时，进度在 60-90% 之间
      const baseProgress = 60;
      const timeBasedProgress = Math.min(30, (elapsed / POLLING_CONFIG.MAX_DURATION) * 30);
      return Math.min(90, baseProgress + timeBasedProgress);
    } else {
      // 没有 tracks 时，进度在 10-50% 之间（等待回调创建 tracks）
      const baseProgress = 10;
      const timeBasedProgress = Math.min(40, (elapsed / POLLING_CONFIG.MAX_DURATION) * 40);
      return Math.min(50, baseProgress + timeBasedProgress);
    }
  }, []);

  // 更新状态（用于弹窗）
  const updateExtendMusicState = useCallback((taskId: string, updates: Partial<ExtendMusicState>) => {
    setExtendMusicStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(taskId) || {};
      newMap.set(taskId, { ...currentState, ...updates });
      return newMap;
    });
  }, []);

  // 获取状态
  const getExtendMusicState = useCallback((taskId: string): ExtendMusicState => {
    return extendMusicStates.get(taskId) || {};
  }, [extendMusicStates]);

  // 清除状态
  const clearExtendMusicState = useCallback((taskId: string) => {
    setExtendMusicStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(taskId);
      return newMap;
    });
  }, []);

  // 轮询状态
  const pollStatus = useCallback(async () => {
    const state = pollingStateRef.current;
    
    // 检查是否应该继续轮询
    if (!state.isPolling || !state.taskId) {
      return;
    }

    // 计算已用时间
    const elapsed = Date.now() - state.startTime;
    
    // 检查超时
    if (elapsed > POLLING_CONFIG.MAX_DURATION) {
      console.error('[Extend Music Polling] Timeout after', elapsed / 1000, 'seconds');
      const errorMsg = 'Music extension timeout. Please try again.';
      updateExtendMusicState(state.taskId, {
        status: 'error',
        progress: 0,
        errorMessage: errorMsg,
      });
      cleanup();
      setIsExtending(false);
      toast.error(errorMsg);
      return;
    }

    // 检查网络连接
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      state.timeoutId = setTimeout(pollStatus, 5000);
      return;
    }

    try {
      // 创建新的 AbortController
      state.abortController = new AbortController();
      
      const res = await fetch(`/api/music/extend-status/${state.taskId}`, {
        signal: state.abortController.signal,
        cache: 'no-store',
      });

      // 请求成功后重置重试计数
      state.retryCount = 0;

      if (!res.ok) {
        console.warn('[Extend Music Polling] HTTP error:', res.status);
        // 继续轮询，不中断
        state.timeoutId = setTimeout(pollStatus, POLLING_CONFIG.INTERVAL);
        return;
      }

      const payload = await res.json();

      // 处理404状态码 - 任务不存在
      if (payload.code === 404) {
        console.warn('[Extend Music Polling] Task not found:', payload.msg);
        cleanup();
        setIsExtending(false);
        toast.error('Extend music task not found');
        return;
      }

      // 处理错误响应
      if (payload.code !== 200) {
        console.error('[Extend Music Polling] API error:', payload.msg);
        cleanup();
        setIsExtending(false);
        toast.error(payload.msg || 'Extension failed');
        return;
      }

      const { status, tracks, generationId } = payload.data;
      const hasTracks = tracks && Array.isArray(tracks) && tracks.length > 0;
      const progress = calculateProgress(elapsed, hasTracks);
      
      // 更新状态（用于弹窗）
      updateExtendMusicState(state.taskId, {
        status: status === 'complete' ? 'completed' : (status === 'error' ? 'error' : 'processing'),
        progress,
        extendedTracks: hasTracks ? tracks.map((t: any) => ({
          id: t.id,
          title: t.title || 'Untitled Track',
          audioUrl: t.audioUrl || '',
          streamAudioUrl: t.streamAudioUrl || '',
          duration: t.duration,
          coverImage: t.coverImage || null,
        })) : undefined,
      });
      
      // 更新tracks：只有当有 tracks 数据时才显示
      if (onTracksUpdate) {
        onTracksUpdate((prev) => {
          if (hasTracks) {
            // 有 tracks 数据，合并更新
            const newTracks = mergeTracks(prev, convertToTracks(tracks, status, generationId), status);
            // 如果 mergeTracks 返回的是同一个数组引用，说明没有变化，不触发重新渲染
            if (newTracks === prev) {
              return prev;
            }
            return newTracks;
          }
          // 没有 tracks 数据时，不显示任何内容（等待回调创建 tracks）
          // 移除该 generationId 的所有 tracks（如果有的话）
          return prev.filter(track => track.generationId !== generationId);
        });
      }

      // 检查是否完成
      if (status === 'complete') {
        // 确保在完成时保留 extendedTracks（使用当前轮询返回的数据）
        updateExtendMusicState(state.taskId, {
          status: 'completed',
          progress: 100,
          extendedTracks: hasTracks ? tracks.map((t: any) => ({
            id: t.id,
            title: t.title || 'Untitled Track',
            audioUrl: t.audioUrl || '',
            streamAudioUrl: t.streamAudioUrl || '',
            duration: t.duration,
            coverImage: t.coverImage || null,
          })) : undefined,
        });
        
        // 延长音乐完成，从 generatedTracks 中移除（数据已写入数据库，应该从 userTracks 显示）
        if (onTracksUpdate && generationId) {
          onTracksUpdate((prev) => 
            prev.filter(track => track.generationId !== generationId)
          );
        }
        
        cleanup();
        setIsExtending(false);
        
        // 调用完成回调，刷新 userTracks
        if (onComplete) {
          onComplete();
        }
        
        return;
      }

      if (status === 'error') {
        console.error('[Extend Music Polling] Extension failed');
        const errorMsg = payload.data?.errorInfo?.errorMessage || 'Music extension failed';
        updateExtendMusicState(state.taskId, {
          status: 'error',
          progress: 0,
          errorMessage: errorMsg,
        });
        cleanup();
        setIsExtending(false);
        toast.error(errorMsg);
        return;
      }

      // 继续轮询
      state.timeoutId = setTimeout(pollStatus, POLLING_CONFIG.INTERVAL);

    } catch (error: any) {
      // 忽略 abort 错误
      if (error.name === 'AbortError') {
        return;
      }

      console.error('[Extend Music Polling] Error:', error);

      // 重试逻辑
      state.retryCount++;
      if (state.retryCount >= POLLING_CONFIG.MAX_RETRIES) {
        console.error('[Extend Music Polling] Max retries reached');
        const errorMsg = 'Network error. Please check your connection.';
        updateExtendMusicState(state.taskId, {
          status: 'error',
          progress: 0,
          errorMessage: errorMsg,
        });
        cleanup();
        setIsExtending(false);
        toast.error(errorMsg);
        return;
      }

      // 更新进度（即使出错也显示进度）
      const elapsed = Date.now() - state.startTime;
      const progress = calculateProgress(elapsed, false);
      updateExtendMusicState(state.taskId, {
        progress,
      });

      // 指数退避重试
      const retryDelay = POLLING_CONFIG.INTERVAL * Math.pow(2, state.retryCount - 1);
      state.timeoutId = setTimeout(pollStatus, retryDelay);
    }
  }, [cleanup, calculateProgress, updateExtendMusicState, onTracksUpdate, onComplete]);

  // 转换初始数据库tracks为前端Track格式（与普通生成音乐保持一致）
  const convertInitialTracks = useCallback((initialTracks: any[]): MusicGenerationTrack[] => {
    return initialTracks.map((t: any) => ({
      id: t.id,
      generationId: t.generationId || '',
      sunoTrackId: t.suno_track_id || t.sunoTrackId || null,
      title: t.title || 'Untitled Track',
      audioUrl: t.audioUrl || '',
      streamAudioUrl: t.streamAudioUrl || '',
      duration: t.duration,
      coverImage: t.coverImage,
      tags: t.tags || '',
      genre: t.genre || '',
      lyrics: t.lyrics || '',
      createdAt: t.createdAt || new Date().toISOString(),
      isGenerating: true, // 初始状态都在生成中
      isCompleted: false, // 初始状态都未完成
      isPlaceholder: false, // 使用真实ID，不是placeholder
      isExtension: true, // 标记为扩展音乐
      originalTrackId: t.originalTrackId || null, // 设置原歌曲ID，用于分组
    }));
  }, []);

  // 开始轮询
  const startPolling = useCallback((
    taskId: string,
    musicId: string,
    title: string,
    genre?: string,
    tags?: string,
    initialTracks?: any[] // 初始占位 tracks
  ) => {
    // 清理旧的轮询
    cleanup();

    // 如果有初始占位 tracks，立即显示它们（与普通生成音乐保持一致）
    if (initialTracks && Array.isArray(initialTracks) && initialTracks.length > 0 && onTracksUpdate) {
      const convertedTracks = convertInitialTracks(initialTracks);
      onTracksUpdate((prev) => {
        // 保留已完成的歌曲，将新的tracks添加到顶部
        const completedTracks = prev.filter(track => track.isCompleted && !convertedTracks.find(nt => nt.id === track.id));
        return [...convertedTracks, ...completedTracks];
      });
    }

    // 初始化轮询状态
    pollingStateRef.current = {
      isPolling: true,
      taskId,
      startTime: Date.now(),
      retryCount: 0,
      timeoutId: null,
      abortController: null,
    };

    // 初始化状态（用于弹窗）
    updateExtendMusicState(taskId, {
      status: 'processing',
      taskId,
      progress: 0,
      trackTitle: title,
    });

    setIsExtending(true);

    // 延迟后开始首次轮询
    pollingStateRef.current.timeoutId = setTimeout(() => {
      pollStatus();
    }, POLLING_CONFIG.INITIAL_DELAY);
  }, [cleanup, pollStatus, updateExtendMusicState, convertInitialTracks, onTracksUpdate]);

  // 停止轮询
  const stopPolling = useCallback(() => {
    cleanup();
    setIsExtending(false);
  }, [cleanup]);

  return {
    isExtending,
    startPolling,
    stopPolling,
    // 状态管理（用于弹窗）
    extendMusicStates,
    getExtendMusicState,
    clearExtendMusicState,
  };
};
