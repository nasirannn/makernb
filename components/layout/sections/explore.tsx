"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, ArrowRight, Music } from "lucide-react";
import Link from "next/link";
import { SafeImage } from '@/components/ui/safe-image';
import { MusicPlayer } from "@/components/ui/music-player";
import { LoadingDots } from "@/components/ui/loading-dots";
import { Skeleton } from "@/components/ui/skeleton";

interface Track {
  id: string;
  audio_url: string;
  duration: number;
  side_letter: string;
  cover_r2_url?: string;
  artist?: string;
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

export const ExploreSection = () => {
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // 播放器状态
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<{trackId: string, audioUrl: string} | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchExploreData();
  }, []);

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 组件卸载时清理音频
  useEffect(() => {
    const audioElement = audioRef.current;
    
    return () => {
      // 立即停止音频播放
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.load();
      }
      // 重置所有播放状态
      setIsPlaying(false);
      setCurrentlyPlaying(null);
      setCurrentPlayingTrack(null);
      setCurrentTime(0);
      setDuration(0);
    };
  }, []);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pinned-tracks?limit=8&offset=0');
      const data = await response.json();
      
      if (data.success) {
        // 将pinned tracks转换为MusicGeneration格式
        const musicGenerations = data.data.tracks.map((track: any) => ({
          id: track.id, // 直接使用track.id作为唯一标识
          title: track.title,
          genre: track.genre,
          tags: track.tags,
          prompt: track.prompt,
          lyrics: null,
          createdAt: track.created_at,
          updatedAt: track.updated_at,
          primaryTrack: {
            id: track.id,
            audio_url: track.audio_url,
            duration: track.duration,
            side_letter: track.side_letter,
            cover_r2_url: track.cover_r2_url
          },
          allTracks: [{
            id: track.id,
            audio_url: track.audio_url,
            duration: track.duration,
            side_letter: track.side_letter,
            cover_r2_url: track.cover_r2_url
          }],
          totalDuration: track.duration,
          trackCount: 1
        }));
        
        setExploreData({
          music: musicGenerations,
          count: data.data.count,
          limit: data.data.limit,
          offset: data.data.offset
        });
        setPlaylist(musicGenerations);
      }
    } catch (err) {
      console.error('Error fetching pinned tracks:', err);
    } finally {
      setLoading(false);
    }
  };

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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    (audioRef as React.MutableRefObject<HTMLAudioElement | null>).current = audio;

    // 设置当前播放的歌曲信息
    setCurrentTrackIndex(index);
    setCurrentlyPlaying(trackId);
    setCurrentPlayingTrack({ trackId, audioUrl });
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

  const handleSideChange = (trackId: string, audioUrl: string) => {
    playTrack(currentTrackIndex, trackId, audioUrl);
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

  return (
    <section id="explore" className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
            Explore
          </h2>

          <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
            Listen to The AI-Generated R&B Songs
          </h2>

          <h3 className="md:w-1/2 mx-auto text-lg text-center text-muted-foreground mb-8">
            Experience soulful R&B music crafted by artificial intelligence
          </h3>
        </div>

        {/* Music Grid */}
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 mb-12">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="group">
                  {/* 封面骨架 */}
                  <Skeleton className="aspect-square rounded-xl" />

                  {/* 歌曲信息骨架 - 居中显示 */}
                  <div className="mt-3 text-center">
                    <Skeleton className="h-4 mb-2 mx-auto w-1/2" />
                    <Skeleton className="h-3 w-3/4 mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          ) : exploreData && exploreData.music.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 mb-12">
              {exploreData.music.map((music, index) => (
                <div
                  key={music.id}
                  className="group cursor-pointer transition-all duration-300"
                  onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audio_url, music)}
                >
                  {/* Cover Image */}
                  <div className="relative aspect-square rounded-xl overflow-hidden">
                    {music.primaryTrack.cover_r2_url ? (
                      <SafeImage
                        src={music.primaryTrack.cover_r2_url}
                        alt={music.title}
                        fill
                        className="object-cover"
                        fallbackContent={<Music className="w-16 h-16 text-white/50" />}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-600 flex items-center justify-center">
                        <Music className="w-16 h-16 text-white/50" />
                      </div>
                    )}

                    {/* Duration - 右上角 */}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                      <span className="text-white text-xs font-medium">
                        {formatDuration(music.totalDuration)}
                      </span>
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-12 w-12 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPause(music.primaryTrack.id, music.primaryTrack.audio_url, music);
                        }}
                      >
                        {currentlyPlaying === music.primaryTrack.id && isPlaying ? (
                          <Pause className="h-5 w-5 text-white" />
                        ) : (
                          <Play className="h-5 w-5 text-white" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Track Info - 居中显示 */}
                  <div className="mt-3 text-center">
                    <h3 className="text-white font-bold text-base mb-1 truncate">
                      {music.title}
                    </h3>
                    <p className="text-white/70 text-sm truncate capitalize">
                      {music.tags}
                    </p>
                  </div>
                </div>
            ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No music available yet</p>
            </div>
          )}
        </div>

        {/* Explore More Button */}
        <div className="text-center">
          <Link href="/explore">
            <Button className="text-primary border border-primary hover:bg-primary hover:text-white px-8 py-3 rounded-lg transition-colors bg-transparent">
              Explore More Tracks
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

      {/* 播放器 - 固定在底部 */}
      {playlist.length > 0 && currentlyPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
                            <MusicPlayer
            tracks={playlist.map(music => ({
              id: music.primaryTrack.id,
              title: music.title,
              audioUrl: music.primaryTrack.audio_url,
              duration: music.totalDuration,
              coverImage: music.primaryTrack.cover_r2_url,
              artist: music.primaryTrack.artist || 'Unknown Artist',
              allTracks: music.allTracks
            }))}
            currentTrackIndex={currentTrackIndex}
            currentPlayingTrack={currentPlayingTrack}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            hideProgress={isMobile}
            onPlayPause={handlePlayerPlayPause}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onTrackChange={handleTrackChange}
            onSideChange={handleSideChange}
          />
        </div>
      )}
      </div>
    </section>
  );
};
