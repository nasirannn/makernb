"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Music, Clock, Share2, ThumbsUp, Loader2 } from 'lucide-react';
import { SafeImage } from '@/components/ui/safe-image';
import { MusicPlayer } from '@/components/ui/music-player';
import { CustomAudioWaveIndicator } from '@/components/ui/audio-wave-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineTrackDetailsPanel } from '@/components/ui/inline-track-details';
import { FooterSection } from '@/components/layout/sections/footer';
import { stopAllAudioGlobally } from '@/lib/audio-service';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { SolidThumbsUpIcon } from '@/components/icons/solid-thumbs-up-icon';

interface Track {
  id: string;
  audioUrl: string;
  duration: number | string;
  coverR2Url?: string;
  playCount?: number;
  isFavorited?: boolean;
}

interface MusicGeneration {
  id: string;
  title: string;
  tags: string;
  prompt?: string;
  lyrics?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  isFavorited?: boolean;
  primaryTrack: Track;
  allTracks: Track[];
  totalDuration: number;
  trackCount: number;
}

interface ExploreData {
  music: MusicGeneration[];
  count: number;
  limit: number;
  offset: number;
}


export default function ExplorePage() {
  const router = useRouter();
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null);

  // 播放器状态 - 使用统一的AudioService
  const audioPlayer = useAudioPlayer();
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);
  const [favoriteLoadingTrackId, setFavoriteLoadingTrackId] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/explore?limit=20&offset=0`, {
          method: 'GET',
          headers: await getAuthHeaders(),
          cache: 'no-store'
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setExploreData(result.data);
            setPlaylist(result.data.music || []);
          } else {
            setError('Failed to load music data');
          }
        } else {
          setError('Failed to load music data');
        }
      } catch (error) {
        console.error('Error fetching explore data:', error);
        setError('Failed to load music data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [getAuthHeaders]);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      // 使用全局清理函数停止所有音频播放
      stopAllAudioGlobally();
      
      // 重置本地状态
      setCurrentlyPlaying(null);
      setLyricsTrackId(null);
    };
  }, []);

  useEffect(() => {
    if (!lyricsTrackId || !currentlyPlaying || lyricsTrackId === currentlyPlaying) return;
    setLyricsTrackId(currentlyPlaying);
  }, [lyricsTrackId, currentlyPlaying]);

  const fetchExploreData = useCallback(async (offset = 0, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`/api/explore?limit=20&offset=${offset}`, {
        method: 'GET',
        headers: await getAuthHeaders(),
        cache: 'no-store'
      });
      const data = await response.json();
      
      if (data.success) {
        if (append && exploreData && exploreData.music) {
          const newData = {
            ...data.data,
            music: [...exploreData.music, ...data.data.music]
          };
          setExploreData(newData);
          setPlaylist(newData.music);
          // 检查是否还有更多数据
          setHasMore(newData.music.length < data.data.count);
        } else {
          setExploreData(data.data);
          setPlaylist(data.data.music);
          // 检查是否还有更多数据
          setHasMore(data.data.music.length < data.data.count);
        }
      } else {
        setError(data.error || 'Failed to load music');
      }
    } catch (err) {
      setError('Failed to load music');
      console.error('Error fetching explore data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [exploreData, getAuthHeaders]);

  const loadMore = useCallback(() => {
    if (exploreData && exploreData.music && !loadingMore && hasMore) {
      fetchExploreData(exploreData.music.length, true);
    }
  }, [exploreData, loadingMore, hasMore, fetchExploreData]);

  // 滚动监听 - 自动加载更多
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // 当滚动到距离底部100px时触发加载
      if (scrollTop + windowHeight >= docHeight - 100) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, hasMore, loadMore]);

  const formatDuration = (seconds: number | string) => {
    const numSeconds = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
    const mins = Math.floor(numSeconds / 60);
    const secs = Math.floor(numSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = async (trackId: string) => {
    try {
      if (!trackId) return;
      const shareUrl = `${window.location.origin}/track/${trackId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied', {
        duration: 1500,
      });
    } catch (error) {
      console.error("Error copying share link:", error);
      toast("Copy failed", { duration: 2000 });
    }
  };

  const updateFavoriteState = useCallback((trackId: string, isFavorited: boolean) => {
    const applyFavoriteState = (music: MusicGeneration) => {
      if (music.primaryTrack.id !== trackId) {
        return music;
      }

      return {
        ...music,
        isFavorited,
        primaryTrack: {
          ...music.primaryTrack,
          isFavorited,
        },
        allTracks: music.allTracks.map((track) =>
          track.id === trackId ? { ...track, isFavorited } : track
        ),
      };
    };

    setExploreData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        music: prev.music.map(applyFavoriteState),
      };
    });

    setPlaylist((prev) => prev.map(applyFavoriteState));
  }, []);

  const handleToggleFavorite = useCallback(async (trackId: string) => {
    if (!trackId || favoriteLoadingTrackId === trackId) {
      return;
    }

    setFavoriteLoadingTrackId(trackId);

    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        toast('Please log in to like songs');
        router.push('/login');
        return;
      }

      const response = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers,
        body: JSON.stringify({ trackId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        if (response.status === 401) {
          toast('Please log in to like songs');
          router.push('/login');
          return;
        }

        throw new Error(result.error || 'Failed to update like status');
      }

      const isFavorited = Boolean(result.isFavorited);
      updateFavoriteState(trackId, isFavorited);
      toast.success(isFavorited ? 'Liked' : 'Like removed', {
        duration: 1200,
      });
    } catch (error) {
      console.error('Error toggling favorite on explore:', error);
      toast.error('Failed to update like status.');
    } finally {
      setFavoriteLoadingTrackId(null);
    }
  }, [favoriteLoadingTrackId, getAuthHeaders, router, updateFavoriteState]);

  const formatPlayCount = (count?: number) => {
    if (!count || count < 0) return '0';
    if (count >= 1000) {
      const value = count / 1000;
      const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
      return `${formatted}k`;
    }
    return count.toString();
  };

  const PlayTriangleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
      <path d="M8 5.75v12.5c0 .8.88 1.28 1.55.84l9.5-6.25a1 1 0 0 0 0-1.68l-9.5-6.25A1 1 0 0 0 8 5.75z" />
    </svg>
  );


  // 歌曲卡片Skeleton组件
  const SongCardSkeleton = () => (
    <div className="rounded-xl overflow-hidden">
      {/* Cover Image Skeleton */}
      <div className="relative aspect-square overflow-hidden rounded-b-xl">
        <Skeleton className="w-full h-full bg-white/10" />
      </div>
      
      {/* Track Info Skeleton */}
      <div className="pt-1 pb-4 pr-4 pl-0">
        <Skeleton className="h-4 w-3/4 mb-1 bg-white/10" />
        <Skeleton className="h-3 w-1/2 mb-2 bg-white/10" />
      </div>
    </div>
  );

  const handlePlayPause = (trackId: string, _audioUrl: string, _music: MusicGeneration) => {
    // 找到歌曲在播放列表中的索引
    const trackIndex = playlist.findIndex(track => track.primaryTrack.id === trackId);
    if (trackIndex === -1) return;

    // 如果点击的是当前播放的歌曲，则暂停/继续
    if (currentlyPlaying === trackId) {
      audioPlayer.togglePlayPause();
      return;
    }

    // 切换到新歌曲
    playTrack(trackIndex);
  };

  const playTrack = async (index: number, specificTrackId?: string, specificAudioUrl?: string) => {
    if (index < 0 || index >= playlist.length) return;

    const music = playlist[index];
    const trackId = specificTrackId || music.primaryTrack.id;
    const audioUrl = specificAudioUrl || music.primaryTrack.audioUrl;

    // 使用AudioService播放歌曲
    await audioPlayer.playTrack({
      id: trackId,
      title: music.title,
      audioUrl: audioUrl,
      duration: typeof music.primaryTrack.duration === 'string' ? parseFloat(music.primaryTrack.duration) : music.primaryTrack.duration,
      coverImage: music.primaryTrack.coverR2Url,
    });

    // 更新本地状态
    setCurrentlyPlaying(trackId);
  };

  // 播放器控制函数
  const handlePlayerPlayPause = () => {
    audioPlayer.togglePlayPause();
  };

  const handlePrevious = () => {
    const currentIndex = playlist.findIndex(music => music.primaryTrack.id === currentlyPlaying);
    if (currentIndex > 0) {
      playTrack(currentIndex - 1);
    }
  };

  const handleNext = () => {
    const currentIndex = playlist.findIndex(music => music.primaryTrack.id === currentlyPlaying);
    if (currentIndex < playlist.length - 1) {
      playTrack(currentIndex + 1);
    }
  };

  const handleSeek = (time: number) => {
    audioPlayer.seek(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    audioPlayer.setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    audioPlayer.toggleMute();
  };

  const handleTrackChange = (index: number) => {
    playTrack(index);
  };

  const handleClosePlayer = () => {
    audioPlayer.clearCurrentTrack();
    setCurrentlyPlaying(null);
    setLyricsTrackId(null);
  };

  const handlePlayerLyricsToggle = useCallback(() => {
    if (!currentlyPlaying) return;
    setLyricsTrackId((prev) => (prev === currentlyPlaying ? null : currentlyPlaying));
  }, [currentlyPlaying]);

  const inlineTrackDetails = React.useMemo(() => {
    if (!lyricsTrackId) return null;

    const matched = playlist.find((music) => music.primaryTrack.id === lyricsTrackId);
    if (!matched) return null;

    return {
      id: matched.primaryTrack.id,
      title: matched.title || 'Untitled Track',
      tags: matched.tags || '',
      lyrics: matched.lyrics || '',
      coverImage: matched.primaryTrack.coverR2Url || null,
      createdAt: matched.createdAt,
      duration: String(
        typeof matched.totalDuration === 'string'
          ? parseFloat(matched.totalDuration)
          : matched.totalDuration || matched.primaryTrack.duration || 0
      ),
      status: 'completed',
      isGenerating: false,
      isCompleted: true,
      audioUrl: matched.primaryTrack.audioUrl || '',
    };
  }, [lyricsTrackId, playlist]);

  const isInlineTrackPlaying = Boolean(
    inlineTrackDetails &&
    currentlyPlaying === inlineTrackDetails.id &&
    audioPlayer.isPlaying
  );
  const panelCurrentTime =
    inlineTrackDetails && currentlyPlaying === inlineTrackDetails.id ? audioPlayer.currentTime : 0;
  const showInlinePanel = Boolean(inlineTrackDetails);

  if (loading) {
    return (
      <div className="min-h-screen bg-background ">
        <div className="container mx-auto px-4 pt-32 pb-6 sm:pb-12">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                MUSIC & CREATIVITY RESOURCES
              </p>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
                Listen to The AI-Generated R&B Songs
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
                Experience soulful R&B music crafted by artificial intelligence
              </p>
            </div>

            {/* Skeleton Grid - 显示一行的数量 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <SongCardSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background ">
        <div className="container mx-auto px-4 pt-32 pb-6 sm:pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={() => fetchExploreData()} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background ">
      <div className={`container mx-auto px-4 pt-32 pb-6 sm:pb-12 ${playlist.length > 0 && currentlyPlaying ? 'pb-20 md:pb-20' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              MUSIC & CREATIVITY RESOURCES
            </p>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
              Listen to The AI-Generated R&B Songs
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              Experience soulful R&B music crafted by artificial intelligence
            </p>
          </div>

          {/* Music Grid */}
          {exploreData && exploreData.music && exploreData.music.length > 0 ? (
            <>
              <div className="relative">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4">
                  {exploreData.music.map((music) => {
                    const hasCover = Boolean(music.primaryTrack.coverR2Url);
                    const isActiveTrack = currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying;
                    return (
                      <div
                        key={music.id}
                        className="rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer"
                      >
                      {/* Cover Image */}
                      <div className="relative aspect-square overflow-hidden rounded-b-xl">
                        {hasCover ? (
                          <SafeImage
                            src={music.primaryTrack.coverR2Url || ''}
                            alt={music.title}
                            fill
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            fallbackContent={
                              <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                                <div className="flex h-full w-full items-center justify-center">
                                  <Music className="h-7 w-7 text-slate-700 drop-shadow-[0_3px_10px_rgba(15,23,42,0.2)] dark:text-white/75 dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]" />
                                </div>
                              </div>
                            }
                          />
                        ) : (
                          <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 transition-transform duration-300 group-hover:scale-[1.02] dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                            <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_42%)] dark:[background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_42%)]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Music className="h-7 w-7 text-slate-700 drop-shadow-[0_3px_10px_rgba(15,23,42,0.2)] dark:text-white/75 dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]" />
                            </div>
                          </div>
                        )}

                        {/* Playing Wave Effect - 播放时音波效果 */}
                        {isActiveTrack && (
                          <div
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                              hasCover ? 'bg-black/20 group-hover:opacity-0' : 'bg-white/15 dark:bg-black/20'
                            }`}
                          >
                            <CustomAudioWaveIndicator
                              isPlaying={audioPlayer.isPlaying}
                              size="lg"
                              className={hasCover ? 'text-white' : 'text-foreground/80 dark:text-white/85'}
                            />
                          </div>
                        )}

                        {/* Play Button Overlay - 只在有封面图时显示 */}
                        {hasCover && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0 text-white/90 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShare(music.primaryTrack.id);
                                }}
                                aria-label="Share track"
                                title="Copy share link"
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-10 w-10 p-0 ${music.primaryTrack.isFavorited ? 'text-pink-200 hover:text-pink-100' : 'text-white/90 hover:text-white'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(music.primaryTrack.id);
                                }}
                                aria-label={music.primaryTrack.isFavorited ? 'Unlike track' : 'Like track'}
                                title={music.primaryTrack.isFavorited ? 'Unlike track' : 'Like track'}
                                disabled={favoriteLoadingTrackId === music.primaryTrack.id}
                              >
                                {favoriteLoadingTrackId === music.primaryTrack.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                                ) : music.primaryTrack.isFavorited ? (
                                  <SolidThumbsUpIcon className="h-4 w-4 fill-current" />
                                ) : (
                                  <ThumbsUp className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-12 w-12 p-0 bg-white/20 backdrop-blur-sm hover:bg-white/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl, music);
                                }}
                                aria-label={currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? 'Pause track' : 'Play track'}
                                title={currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? 'Pause' : 'Play'}
                              >
                                {currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? (
                                  <Pause className="h-5 w-5 text-white" />
                                ) : (
                                  <Play className="h-5 w-5 text-white" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {!hasCover && (
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="absolute inset-0 bg-white/20 dark:bg-black/25" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              {isActiveTrack ? (
                                <Pause className="h-5 w-5 text-slate-800 drop-shadow-[0_3px_10px_rgba(15,23,42,0.28)] dark:text-white dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]" />
                              ) : (
                                <Play className="h-5 w-5 translate-x-[1px] text-slate-800 drop-shadow-[0_3px_10px_rgba(15,23,42,0.28)] dark:text-white dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]" />
                              )}
                            </div>
                          </div>
                        )}

                        {/* Duration Overlay */}
                        <div className="absolute inset-x-0 bottom-0">
                          <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-2">
                            <div className="text-xs font-semibold text-white/85 flex items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <PlayTriangleIcon />
                                {formatPlayCount(music.primaryTrack.playCount)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(music.totalDuration)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Track Info */}
                      <div className="pt-1 pb-4 pr-4 pl-0 bg-transparent">
                        <h3 className="text-foreground font-bold text-base mb-1 truncate">
                          {music.title}
                        </h3>
                        <p className="text-muted-foreground text-xs mb-2 truncate capitalize whitespace-nowrap overflow-hidden">
                          {music.tags}
                        </p>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>

              {/* Loading More Skeleton */}
              {loadingMore && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4 mt-6">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <SongCardSkeleton key={`loading-${index}`} />
                  ))}
                </div>
              )}

              {/* Show total count when all loaded */}
              {exploreData && exploreData.music && !hasMore && exploreData.music.length > 0 && (
                <div className="text-center mt-8 py-4">
                  <span className="text-sm text-muted-foreground font-medium">
                    All songs loaded
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No public music available yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <FooterSection />

      <div
        className={`fixed inset-0 z-[70] transition-opacity duration-200 ${
          showInlinePanel ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!showInlinePanel}
      >
        <button
          type="button"
          aria-label="Close lyrics panel"
          onClick={() => setLyricsTrackId(null)}
          className="absolute inset-0 bg-background/20 backdrop-blur-[1px] md:bg-background/10"
        />
        <div
          className={`absolute right-0 top-0 h-full w-full max-w-[min(90vw,400px)] transform-gpu transition-transform duration-300 ease-out ${
            showInlinePanel ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {showInlinePanel && (
            <div className="h-full p-2 md:py-4 md:pl-3 md:pr-2">
              <InlineTrackDetailsPanel
                track={inlineTrackDetails}
                isPlaying={isInlineTrackPlaying}
                currentTime={panelCurrentTime}
                onClose={() => setLyricsTrackId(null)}
                variant="studio"
              />
            </div>
          )}
        </div>
      </div>

      {/* 播放器 - 移动端固定，桌面端固定带底部边距，与内容区域宽度一致 */}
      {playlist.length > 0 && currentlyPlaying && (
        <>
          <style dangerouslySetInnerHTML={{
            __html: `
              .player-container-explore-page {
                position: fixed;
                left: 0.75rem;
                right: 0.75rem;
                bottom: calc(var(--mobile-nav-height, 0px) + 0.75rem);
                z-index: 60;
              }
              @media (min-width: 768px) {
                .player-container-explore-page {
                  bottom: 0.75rem !important;
                  left: 50% !important;
                  right: auto !important;
                  transform: translateX(-50%) !important;
                  max-width: 80rem !important;
                  width: calc(100% - 3rem) !important;
                }
              }
            `
          }} />
	          <div className="player-container-explore-page">
	            <MusicPlayer
              tracks={playlist.map(music => ({
                id: music.primaryTrack.id,
                title: music.title,
                audioUrl: music.primaryTrack.audioUrl,
                duration: typeof music.totalDuration === 'string' ? parseFloat(music.totalDuration) : music.totalDuration,
                coverImage: music.primaryTrack.coverR2Url,
                artist: music.tags || "Unknown Artist",
                tags: music.tags || "",
                lyrics: music.lyrics || "",
                allTracks: music.allTracks.map(track => ({
                  id: track.id,
                  audioUrl: track.audioUrl,
                  duration: track.duration
                }))
              }))}
              currentTrackIndex={playlist.findIndex(music => music.primaryTrack.id === currentlyPlaying)}
              isPlaying={audioPlayer.isPlaying}
              currentTime={audioPlayer.currentTime}
              duration={audioPlayer.duration}
              volume={audioPlayer.volume}
              isMuted={audioPlayer.isMuted}
              hideProgress={false}
              onPlayPause={handlePlayerPlayPause}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSeek={handleSeek}
	              onVolumeChange={handleVolumeChange}
	              onMuteToggle={handleMuteToggle}
	              onTrackChange={handleTrackChange}
                onTrackInfoClick={handlePlayerLyricsToggle}
	              onClose={handleClosePlayer}
	            />
	          </div>
	        </>
	      )}
	    </div>
	  );
}
