import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface VocalRemovalState {
  status?: 'checking' | 'ready' | 'processing' | 'completed' | 'error';
  taskId?: string;
  progress?: number;
  errorMessage?: string;
  vocalUrl?: string;
  instrumentalUrl?: string;
}

export const useVocalRemovalManager = () => {
  // 统一的状态存储
  const [trackStates, setTrackStates] = useState<Map<string, VocalRemovalState>>(new Map());

  // 获取某个 track 的状态
  const getTrackState = useCallback((trackId: string): VocalRemovalState => {
    return trackStates.get(trackId) || {};
  }, [trackStates]);

  // 更新某个 track 的状态
  const updateTrackState = useCallback((trackId: string, updates: Partial<VocalRemovalState>) => {
    setTrackStates(prev => {
      const newMap = new Map(prev);
      const currentState = newMap.get(trackId) || {};
      newMap.set(trackId, { ...currentState, ...updates });
      return newMap;
    });
  }, []);

  // 删除某个 track 的状态
  const clearTrackState = useCallback((trackId: string) => {
    setTrackStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(trackId);
      return newMap;
    });
  }, []);

  // 查询单个 track 的 vocal removal 状态
  const fetchTrackStatus = useCallback(async (trackId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const response = await fetch(`/api/vocal/removal-status?trackId=${trackId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const result = await response.json();
      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        // 查找最新的记录（优先 completed，其次是 processing，最后是 error）
        const removals = result.data;
        const latestRemoval = removals.sort((a: any, b: any) => {
          const statusPriority = { completed: 3, processing: 2, error: 1 };
          return statusPriority[b.status as keyof typeof statusPriority] - statusPriority[a.status as keyof typeof statusPriority];
        })[0];
        
        updateTrackState(trackId, {
          status: latestRemoval.status,
          taskId: latestRemoval.taskId,
          vocalUrl: latestRemoval.vocalUrl,
          instrumentalUrl: latestRemoval.instrumentalUrl,
        });
      } else {
        // 如果没有记录，清除状态
        clearTrackState(trackId);
      }
    } catch (error) {
      console.error('Error fetching track vocal removal status:', error);
    }
  }, [updateTrackState, clearTrackState]);

  // 轮询状态
  const startPolling = useCallback((
    trackId: string, 
    taskId: string, 
    onComplete?: (data: { vocalUrl?: string; instrumentalUrl?: string }) => void,
    onError?: (errorMessage: string) => void
  ) => {
    const POLL_INTERVAL = 3000; // 每3秒轮询一次
    const MAX_POLL_TIME = 5 * 60 * 1000; // 最大轮询时间：5分钟
    const startTime = Date.now();

    // 计算进度百分比
    const calculateProgress = (elapsed: number, hasResults: boolean): number => {
      if (hasResults) {
        const baseProgress = 60;
        const timeBasedProgress = Math.min(30, (elapsed / MAX_POLL_TIME) * 30);
        return Math.min(90, baseProgress + timeBasedProgress);
      } else {
        const baseProgress = 10;
        const timeBasedProgress = Math.min(40, (elapsed / MAX_POLL_TIME) * 40);
        return Math.min(50, baseProgress + timeBasedProgress);
      }
    };

    const pollInterval = setInterval(async () => {
      try {
        const elapsed = Date.now() - startTime;
        
        // 检查是否超时
        if (elapsed > MAX_POLL_TIME) {
          clearInterval(pollInterval);
          const errorMsg = 'Vocal removal timeout. Please try again.';
          updateTrackState(trackId, {
            status: 'error',
            progress: 0,
            errorMessage: errorMsg,
          });
          onError?.(errorMsg);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          clearInterval(pollInterval);
          return;
        }

        const response = await fetch(`/api/vocal/removal-status?taskId=${taskId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const hasResults = false;
          const progress = calculateProgress(elapsed, hasResults);
          updateTrackState(trackId, { progress });
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          const { status, vocalUrl, instrumentalUrl, accompanimentUrl } = result.data;
          const hasResults = !!(vocalUrl || instrumentalUrl || accompanimentUrl);
          
          const progress = calculateProgress(elapsed, hasResults);
          updateTrackState(trackId, { progress });

          if (status === 'completed') {
            clearInterval(pollInterval);
            updateTrackState(trackId, {
              status: 'completed',
              progress: 100,
              vocalUrl,
              instrumentalUrl,
            });
            onComplete?.({ vocalUrl, instrumentalUrl });
          } else if (status === 'error') {
            clearInterval(pollInterval);
            const errorMsg = 'Vocal removal failed. Please try again.';
            updateTrackState(trackId, {
              status: 'error',
              progress: 0,
              errorMessage: errorMsg,
            });
            onError?.(errorMsg);
          }
        }
      } catch (error) {
        console.error('Error polling vocal removal status:', error);
        const elapsed = Date.now() - startTime;
        const progress = calculateProgress(elapsed, false);
        updateTrackState(trackId, { progress });
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [updateTrackState]);

  return {
    trackStates,
    getTrackState,
    updateTrackState,
    clearTrackState,
    fetchTrackStatus,
    startPolling,
  };
};
