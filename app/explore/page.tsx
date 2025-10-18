"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Music } from 'lucide-react';
import { CoverImage } from '@/components/ui/optimized-image';
import { MusicPlayer } from '@/components/ui/music-player';
import { CustomAudioWaveIndicator } from '@/components/ui/audio-wave-indicator';
import { Skeleton } from '@/components/ui/skeleton';
import { FooterSection } from '@/components/layout/sections/footer';

interface Track {
  id: string;
  audio_url: string;
  duration: number | string;
  side_letter: string;
  cover_r2_url?: string;
}

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  tags: string;
  prompt?: string;
  lyrics?: string;
  createdAt: string;
  updatedAt: string;
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
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  // 播放器状态
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<{trackId: string, audioUrl: string} | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/explore?limit=20&offset=0`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
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
  }, []);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      // 立即停止音频播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      }
      // 重置所有播放状态
      setIsPlaying(false);
      setCurrentlyPlaying(null);
      setCurrentPlayingTrack(null);
      setCurrentTime(0);
      setDuration(0);
    };
  }, []);

  const fetchExploreData = useCallback(async (offset = 0, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`/api/explore?limit=20&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
  }, [exploreData]);

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

  // 歌曲卡片Skeleton组件
  const SongCardSkeleton = () => (
    <div className="bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden">
      {/* Cover Image Skeleton */}
      <div className="relative aspect-square">
        <Skeleton className="w-full h-full bg-white/10" />
      </div>
      
      {/* Track Info Skeleton */}
      <div className="p-4">
        <Skeleton className="h-4 w-3/4 mb-2 bg-white/10" />
        <Skeleton className="h-3 w-1/2 mb-2 bg-white/10" />
        <Skeleton className="h-3 w-1/4 bg-white/10" />
      </div>
    </div>
  );

  const handlePlayPause = (trackId: string, audioUrl: string, music: MusicGeneration) => {
    // 找到歌曲在播放列表中的索引
    const trackIndex = playlist.findIndex(track => track.primaryTrack.id === trackId);
    if (trackIndex === -1) return;

    // 如果点击的是当前播放的歌曲，则暂停/继续
    if (currentlyPlaying === trackId) {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }
      return;
    }

    // 切换到新歌曲
    playTrack(trackIndex);
  };

  const playTrack = (index: number, specificTrackId?: string, specificAudioUrl?: string) => {
    if (index < 0 || index >= playlist.length) return;

    const music = playlist[index];
    const trackId = specificTrackId || music.primaryTrack.id;
    const audioUrl = specificAudioUrl || music.primaryTrack.audio_url;

    // 停止当前播放
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // 创建新的音频元素
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    // 设置当前播放的歌曲信息
    setCurrentTrackIndex(index);
    setCurrentlyPlaying(trackId);
    setCurrentPlayingTrack({ trackId, audioUrl }); // 跟踪当前播放的具体track
    setCurrentTime(0);
    setDuration(0);

    // 音频事件监听
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration || 0);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // 自动播放下一首
      if (index < playlist.length - 1) {
        playTrack(index + 1);
      }
    });

    // 设置音量
    audio.volume = isMuted ? 0 : volume;

    // 播放音频
    audio.play();
    setIsPlaying(true);
  };

  // 播放器控制函数
  const handlePlayerPlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handlePrevious = () => {
    if (currentTrackIndex > 0) {
      playTrack(currentTrackIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentTrackIndex < playlist.length - 1) {
      playTrack(currentTrackIndex + 1);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVolume;
    }
  };

  const handleMuteToggle = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (audioRef.current) {
      audioRef.current.volume = newMuted ? 0 : volume;
    }
  };

  const handleTrackChange = (index: number) => {
    playTrack(index);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
              MUSIC & CREATIVITY RESOURCES
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Listen to The AI-Generated R&B Songs
            </h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
              Explore soulful tracks crafted by artificial intelligence
            </p>
          </div>

          {/* Skeleton Grid - 显示一行的数量 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <SongCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Button onClick={() => fetchExploreData()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className={`container mx-auto px-4 py-8 ${playlist.length > 0 && currentlyPlaying ? 'pb-20 md:pb-20' : ''}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4">
            MUSIC & CREATIVITY RESOURCES
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Listen to The AI-Generated R&B Songs
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Explore soulful tracks crafted by artificial intelligence
          </p>
        </div>


        {/* Music Grid */}
        {exploreData && exploreData.music && exploreData.music.length > 0 ? (
          <>
            <div className="relative">

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {exploreData.music.map((music) => (
                <div
                  key={music.id}
                  className="bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-black/30 transition-all duration-300 group cursor-pointer"
                >
                  {/* Cover Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <CoverImage
                      src={music.primaryTrack.cover_r2_url || ''}
                      alt={music.title}
                      fill
                      size="lg"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      fallbackContent={
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-600/80 via-purple-700/60 to-purple-800/80 flex items-center justify-center">
                          <Music className="w-16 h-16 text-white/70" />
                        </div>
                      }
                    />


                    {/* Playing Wave Effect - 播放时音波效果 */}
                    {currentlyPlaying === music.primaryTrack.id && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                        <CustomAudioWaveIndicator
                          isPlaying={isPlaying}
                          size="lg"
                          className="text-white"
                        />
                      </div>
                    )}

                    {/* Play Button Overlay - 只在有封面图时显示 */}
                    {music.primaryTrack.cover_r2_url && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-12 w-12 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                          onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audio_url, music)}
                        >
                          {currentlyPlaying === music.primaryTrack.id && isPlaying ? (
                            <Pause className="h-5 w-5 text-white" />
                          ) : (
                            <Play className="h-5 w-5 text-white" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="p-4">
                    <h3 className="text-white font-bold text-base mb-1 truncate">
                      {music.title}
                    </h3>
                    <p className="text-white/70 text-sm mb-2 truncate capitalize whitespace-nowrap overflow-hidden">
                      {music.tags}
                    </p>
                    <div className="flex items-center text-white/50 text-xs">
                      <span>{formatDuration(music.totalDuration)}</span>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>

            {/* Loading More Skeleton */}
            {loadingMore && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mt-6">
                {Array.from({ length: 4 }).map((_, index) => (
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
            <Music className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/70 text-lg">No public music available yet</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <FooterSection />

      {/* 播放器 - 固定在底部 */}
      {playlist.length > 0 && currentlyPlaying && (
        <>
          {/* Mobile Music Player - 移动端播放器 */}
          <div className="fixed md:hidden left-3 right-3 bottom-6 z-50">
            <div className="[&>div]:!pr-3">
              <MusicPlayer
                tracks={playlist.map(music => ({
                  id: music.primaryTrack.id,
                  title: music.title,
                  audioUrl: music.primaryTrack.audio_url,
                  duration: typeof music.totalDuration === 'string' ? parseFloat(music.totalDuration) : music.totalDuration,
                  coverImage: music.primaryTrack.cover_r2_url,
                  artist: music.genre,
                  allTracks: music.allTracks
                }))}
                currentTrackIndex={currentTrackIndex}
                currentPlayingTrack={currentPlayingTrack}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                isMuted={isMuted}
                hideProgress={true}
                onPlayPause={handlePlayerPlayPause}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onSeek={handleSeek}
                onVolumeChange={handleVolumeChange}
                onMuteToggle={handleMuteToggle}
                onTrackChange={handleTrackChange}
              />
            </div>
          </div>

          {/* Desktop Music Player - 桌面端播放器 */}
          <div className="hidden md:block fixed bottom-0 left-0 right-0 z-50">
            <MusicPlayer
              tracks={playlist.map(music => ({
                id: music.primaryTrack.id,
                title: music.title,
                audioUrl: music.primaryTrack.audio_url,
                duration: typeof music.totalDuration === 'string' ? parseFloat(music.totalDuration) : music.totalDuration,
                coverImage: music.primaryTrack.cover_r2_url,
                artist: music.genre,
                allTracks: music.allTracks
              }))}
              currentTrackIndex={currentTrackIndex}
              currentPlayingTrack={currentPlayingTrack}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              isMuted={isMuted}
              hideProgress={false}
              onPlayPause={handlePlayerPlayPause}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSeek={handleSeek}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onTrackChange={handleTrackChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
