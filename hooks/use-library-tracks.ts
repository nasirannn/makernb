/**
 * useLibraryTracks Hook
 * 管理Library页面的歌曲数据获取和状态
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface LibraryTrack {
  id: string;
  title: string;
  genre: string;
  tags: string;
  audioUrl: string;
  duration: number;
  coverImage: string | null;
  lyrics: string;
  isFavorited?: boolean;
  isPublished?: boolean;
  isPinned?: boolean;
  createdAt?: string;
  favoritedAt?: string;
}

export const useLibraryTracks = (userId: string | undefined) => {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取收藏的歌曲列表
   */
  const fetchTracks = useCallback(async () => {
    if (!userId) {
      setTracks([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/favorites?limit=50&offset=0`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }
      
      const data = await response.json();
      const favorites = data.data?.favorites || [];
      
      // 转换为统一的track格式（API 已经返回 camelCase，直接使用）
      const formattedTracks: LibraryTrack[] = favorites.map((fav: any) => ({
        id: fav.id,
        title: fav.title,
        genre: fav.genre || '',
        tags: fav.tags || '',
        audioUrl: fav.audioUrl,
        duration: fav.duration || 0,
        coverImage: fav.coverR2Url || null,
        lyrics: fav.lyrics || '',
        isFavorited: true,
        isPublished: fav.isPublished ?? false,
        isPinned: fav.isPinned ?? false,
        createdAt: fav.createdAt,
        favoritedAt: fav.favoritedAt
      }));
      
      setTracks(formattedTracks);
    } catch (err) {
      console.error('Error fetching library tracks:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * 更新单个track的状态
   */
  const updateTrack = useCallback((trackId: string, updates: Partial<LibraryTrack>) => {
    setTracks(prevTracks =>
      prevTracks.map(track =>
        track.id === trackId ? { ...track, ...updates } : track
      )
    );
  }, []);

  /**
   * 从列表中移除track
   */
  const removeTrack = useCallback((trackId: string) => {
    setTracks(prevTracks => prevTracks.filter(track => track.id !== trackId));
  }, []);

  /**
   * 切换收藏状态（在library中主要用于移除）
   */
  const toggleFavorite = useCallback(async (trackId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ trackId })
      });

      if (!response.ok) {
        throw new Error('Failed to toggle favorite');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to toggle favorite');
      }
      
      // 如果取消收藏，从列表中移除
      if (!data.isFavorited) {
        removeTrack(trackId);
      } else {
        updateTrack(trackId, { isFavorited: true });
      }
      
      return data.isFavorited;
    } catch (err) {
      console.error('Error toggling favorite:', err);
      throw err;
    }
  }, [removeTrack, updateTrack]);

  /**
   * 初始化：获取tracks
   */
  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  return {
    tracks,
    isLoading,
    error,
    fetchTracks,
    updateTrack,
    removeTrack,
    toggleFavorite
  };
};

