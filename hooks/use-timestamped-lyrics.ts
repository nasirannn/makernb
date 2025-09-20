'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  getTimestampedLyrics, 
  formatLyricsForKaraoke, 
  getCurrentLyricIndex,
  generateWaveformBars,
  type AlignedWord 
} from '@/lib/timestamped-lyrics-api';

export interface FormattedLyric {
  id: number;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  isActive: boolean;
}

export interface UseTimestampedLyricsOptions {
  taskId?: string;
  audioId?: string;
  currentTime?: number;
  autoFetch?: boolean;
}

export interface UseTimestampedLyricsReturn {
  lyrics: FormattedLyric[];
  currentLyricIndex: number;
  waveformData: number[];
  isLoading: boolean;
  error: string | null;
  fetchLyrics: (taskId: string, audioId: string) => Promise<void>;
  updateCurrentTime: (time: number) => void;
  clearLyrics: () => void;
}

export function useTimestampedLyrics(options: UseTimestampedLyricsOptions = {}): UseTimestampedLyricsReturn {
  const { taskId, audioId, currentTime = 0, autoFetch = false } = options;
  
  const [lyrics, setLyrics] = useState<FormattedLyric[]>([]);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);

  // 获取时间戳歌词
  const fetchLyrics = useCallback(async (taskId: string, audioId: string) => {
    if (!taskId || !audioId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/get-timestamped-lyrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ taskId, audioId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch lyrics');
      }
      
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        const formattedLyrics = formatLyricsForKaraoke(data.data.alignedWords);
        setLyrics(formattedLyrics);
        setWaveformData(data.data.waveformData || []);
      } else {
        throw new Error(data.msg || 'Failed to get lyrics data');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching timestamped lyrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 更新当前时间并计算应该高亮的歌词
  const updateCurrentTime = useCallback((time: number) => {
    const newIndex = getCurrentLyricIndex(lyrics, time);
    setCurrentLyricIndex(newIndex);
    
    // 更新歌词的激活状态
    setLyrics(prevLyrics => 
      prevLyrics.map((lyric, index) => ({
        ...lyric,
        isActive: index === newIndex
      }))
    );
  }, [lyrics]);

  // 清空歌词数据
  const clearLyrics = useCallback(() => {
    setLyrics([]);
    setWaveformData([]);
    setCurrentLyricIndex(-1);
    setError(null);
  }, []);

  // 自动获取歌词
  useEffect(() => {
    if (autoFetch && taskId && audioId) {
      fetchLyrics(taskId, audioId);
    }
  }, [autoFetch, taskId, audioId, fetchLyrics]);

  // 当时间变化时更新当前歌词
  useEffect(() => {
    if (lyrics.length > 0) {
      updateCurrentTime(currentTime);
    }
  }, [currentTime, lyrics, updateCurrentTime]);

  return {
    lyrics,
    currentLyricIndex,
    waveformData,
    isLoading,
    error,
    fetchLyrics,
    updateCurrentTime,
    clearLyrics,
  };
}

/**
 * 生成波形可视化数据
 */
export function useWaveformVisualization(waveformData: number[], width: number = 200) {
  const [bars, setBars] = useState<number[]>([]);
  
  useEffect(() => {
    if (waveformData.length > 0) {
      const generatedBars = generateWaveformBars(waveformData, width);
      setBars(generatedBars);
    }
  }, [waveformData, width]);
  
  return bars;
}
