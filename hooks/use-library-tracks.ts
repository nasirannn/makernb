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
  streamAudioUrl?: string;
  duration: number;
  coverImage: string | null;
  coverR2Url?: string | null;
  lyrics: string;
  isFavorited?: boolean;
  isPublished?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  status?: string;
  createdAt?: string;
  favoritedAt?: string | null;
  allTracks?: Array<{
    id: string;
    audioUrl: string;
    streamAudioUrl?: string;
    duration: number;
    coverR2Url?: string | null;
    lyrics?: string;
    isDeleted?: boolean;
    isFavorited?: boolean;
  }>;
}

export const useLibraryTracks = (userId: string | undefined) => {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取用户的所有歌曲数据
   */
  const fetchTracks = useCallback(async () => {
    if (!userId) {
      setTracks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const timestamp = Date.now();
      const response = await fetch(`/api/user-music/${userId}?limit=100&offset=0&_t=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch library tracks');
      }
      
      const data = await response.json();
      const musicGenerations = data.data?.music || [];

      const flattenedTracks: LibraryTrack[] = musicGenerations.flatMap((generation: any) => {
        const generationTags = generation.tags || '';
        const generationGenre = generation.genre || '';
        const generationLyrics = generation.lyricsContent || '';
        const generationStatus = generation.status || 'completed';
        const generationCreatedAt = generation.createdAt || generation.generationCreatedAt;

        return (generation.allTracks || []).map((track: any) => {
          const duration = typeof track.duration === 'string'
            ? parseFloat(track.duration)
            : (track.duration || 0);

          const trackFavoritedAt =
            track.favoritedAt ??
            track.favorited_at ??
            track.favoriteAt ??
            track.favorite_at ??
            generation.favoritedAt ??
            generation.favorited_at ??
            null;

          const normalizedTrack: LibraryTrack = {
            id: track.id,
            title: track.title || generation.title || 'Untitled Track',
            genre: generationGenre,
            tags: generationTags,
            audioUrl: track.audioUrl || '',
            streamAudioUrl: track.streamAudioUrl || '',
            duration,
            coverImage: track.coverR2Url || null,
            coverR2Url: track.coverR2Url || null,
            lyrics: track.lyrics || generationLyrics || '',
            isFavorited: track.isFavorited ?? false,
            isPublished: track.isPublished ?? false,
            isPinned: track.isPinned ?? false,
            isDeleted: track.isDeleted ?? false,
            status: generationStatus,
            createdAt: track.createdAt || generationCreatedAt,
            favoritedAt: trackFavoritedAt,
            allTracks: [
              {
                id: track.id,
                audioUrl: track.audioUrl || '',
                streamAudioUrl: track.streamAudioUrl || '',
                duration,
                coverR2Url: track.coverR2Url || null,
                lyrics: track.lyrics || '',
                isDeleted: track.isDeleted ?? false,
                isFavorited: track.isFavorited ?? false,
              }
            ]
          };
          return normalizedTrack;
        });
      });
      
      setTracks(flattenedTracks);
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
      
      updateTrack(trackId, { isFavorited: data.isFavorited });
      
      return data.isFavorited;
    } catch (err) {
      console.error('Error toggling favorite:', err);
      throw err;
    }
  }, [updateTrack]);

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
