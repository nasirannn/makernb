"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, ArrowRight, Music } from "lucide-react";
import Link from "next/link";
import { SafeImage } from '@/components/ui/safe-image';
import { MusicPlayer } from "@/components/ui/music-player";
import { LoadingDots } from "@/components/ui/loading-dots";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from '@/hooks/use-audio-player';

interface Track {
  id: string;
  audio_url: string;
  duration: number;
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
  
  // 播放器状态 - 使用统一的AudioService
  const audioPlayer = useAudioPlayer();
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);

  useEffect(() => {
    fetchExploreData();
  }, []);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      // AudioService会自动处理清理，这里只需要重置本地状态
      setCurrentlyPlaying(null);
    };
  }, []);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
            cover_r2_url: track.cover_r2_url
          },
          allTracks: [{
            id: track.id,
            audio_url: track.audio_url,
            duration: track.duration,
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
    const audioUrl = specificAudioUrl || music.primaryTrack.audio_url;

    // 使用AudioService播放歌曲
    await audioPlayer.playTrack({
      id: trackId,
      title: music.title,
      audioUrl: audioUrl,
      duration: music.primaryTrack.duration,
      coverImage: music.primaryTrack.cover_r2_url,
      genre: music.genre,
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
                        {currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? (
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
              View All Songs
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

      {/* 播放器 - 移动端固定，桌面端固定带底部边距，与内容区域宽度一致 */}
      {playlist.length > 0 && currentlyPlaying && (
        <>
          <style dangerouslySetInnerHTML={{
            __html: `
              .player-container-explore {
                position: fixed;
                left: 0.75rem;
                right: 0.75rem;
                bottom: calc(var(--mobile-nav-height, 0px) + 0.75rem);
                z-index: 60;
              }
              @media (min-width: 768px) {
                .player-container-explore {
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
          <div className="player-container-explore">
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
          />
          </div>
        </>
      )}
      </div>
    </section>
  );
};
