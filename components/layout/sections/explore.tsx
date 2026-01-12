"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, ArrowRight, Music, Share2, Clock } from "lucide-react";
import Link from "next/link";
import { SafeImage } from '@/components/ui/safe-image';
import { CustomAudioWaveIndicator } from '@/components/ui/audio-wave-indicator';
import { MusicPlayer } from "@/components/ui/music-player";
import { LoadingDots } from "@/components/ui/loading-dots";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { toast } from "sonner";

interface Track {
  id: string;
  audioUrl?: string;
  duration: number;
  coverR2Url?: string;
  artist?: string;
  playCount?: number;
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
  const audioPlayerRef = useRef(audioPlayer);

  useEffect(() => {
    audioPlayerRef.current = audioPlayer;
  }, [audioPlayer]);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);

  useEffect(() => {
    fetchExploreData();
  }, []);

  // 组件卸载时清理音频
  useEffect(() => {
    return () => {
      // AudioService会自动处理清理，这里只需要重置本地状态
      setCurrentlyPlaying(null);
      audioPlayerRef.current.clearCurrentTrack();
    };
  }, []);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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

  const handleShare = async (trackId: string) => {
    try {
      if (!trackId) return;
      const shareUrl = `${window.location.origin}/track/${trackId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast("Link copied", { duration: 1500 });
    } catch (error) {
      console.error("Error copying share link:", error);
      toast("Copy failed", { duration: 2000 });
    }
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
          createdAt: track.createdAt,
          updatedAt: track.updatedAt,
          primaryTrack: {
            id: track.id,
            audioUrl: track.audioUrl || '',
            duration: track.duration,
            coverR2Url: track.coverR2Url || '',
            playCount: track.playCount ?? 0
          },
          allTracks: [{
            id: track.id,
            audioUrl: track.audioUrl || '',
            duration: track.duration,
            coverR2Url: track.coverR2Url || '',
            playCount: track.playCount ?? 0
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
    const audioUrl = specificAudioUrl || music.primaryTrack.audioUrl || '';

    // 使用AudioService播放歌曲
    await audioPlayer.playTrack({
      id: trackId,
      title: music.title,
      audioUrl: audioUrl,
      duration: music.primaryTrack.duration,
      coverImage: music.primaryTrack.coverR2Url || '',
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

  const currentTrackTitle = currentlyPlaying
    ? playlist.find((music) => music.primaryTrack.id === currentlyPlaying)?.title || 'Unknown Track'
    : '';

  const formatTags = (tags?: string) => {
    if (!tags) return '';
    const normalized = tags
      .split(/[,，/|]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(', ');
    return normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized;
  };

  return (
    <section id="explore" className="py-20">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
            Explore
          </h2>

          <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
            Listen to The AI-Generated R&B Songs
          </h2>

          <h3 className="md:w-1/2 mx-auto text-base md:text-lg text-center text-muted-foreground mb-8">
            Experience soulful R&B music crafted by artificial intelligence
          </h3>
        </div>

        {/* Music Grid */}
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="app-card flex items-stretch gap-5 rounded-[20px] py-4 pl-4">
                  <div className="w-20 aspect-square">
                    <Skeleton className="h-full w-full rounded-sm" />
                  </div>
                  <div className="flex-1 space-y-2 self-center">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center pr-4">
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : exploreData && exploreData.music.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {exploreData.music.slice(0, 8).map((music) => (
                <div
                  key={music.id}
                  className="app-card group flex items-stretch gap-5 rounded-[20px] py-4 pl-4 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || '', music)}
                >
                  {/* Cover Image */}
                  <div className="relative w-20 aspect-square shrink-0 overflow-hidden rounded-sm">
                    {music.primaryTrack.coverR2Url ? (
                      <SafeImage
                        src={music.primaryTrack.coverR2Url}
                        alt={music.title}
                        fill
                        className="object-cover"
                        fallbackContent={<Music className="w-8 h-8 text-black/40" />}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-black/10 to-black/20 flex items-center justify-center">
                        <Music className="w-8 h-8 text-black/40" />
                      </div>
                    )}

                    {/* Audio Wave Indicator - playing state */}
                    {currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                        <CustomAudioWaveIndicator isPlaying={audioPlayer.isPlaying} size="sm" className="text-primary" />
                      </div>
                    )}

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 bg-white/80 hover:bg-white border border-black/10 backdrop-blur-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || '', music);
                        }}
                      >
                        {currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? (
                          <Pause className="h-4 w-4 text-foreground" />
                        ) : (
                          <Play className="h-4 w-4 text-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="min-w-0 self-center">
                    <h3 className={`text-lg font-semibold mb-1 truncate ${
                      currentlyPlaying === music.primaryTrack.id ? 'text-primary' : 'text-foreground'
                    }`}>
                      {music.title}
                    </h3>
                    <p className="text-muted-foreground text-xs truncate capitalize">
                      {formatTags(music.tags)}
                    </p>
                    <p className="text-muted-foreground/80 text-xs mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <PlayTriangleIcon />
                        {formatPlayCount(music.primaryTrack.playCount)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(music.totalDuration)}
                      </span>
                    </p>
                  </div>
                  <div className="ml-auto flex items-center pr-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(music.primaryTrack.id);
                      }}
                      className="h-8 w-8 rounded-full text-foreground/55 transition-colors hover:text-foreground hover:bg-black/5 flex items-center justify-center"
                      aria-label="Share track"
                      title="Copy share link"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
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
          {!loading && exploreData && exploreData.music.length > 0 && (
            <div className="flex justify-center">
              <Link
                href="/explore"
                className="inline-flex items-center justify-center rounded-full border border-black/10 outline-none ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 px-7 py-3 text-sm font-semibold text-foreground transition-all hover:bg-black/5 hover:translate-y-[-1px]"
                style={{
                  background: 'linear-gradient(90deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.32), hsl(var(--primary) / 0.18))'
                }}
              >
                Explore All Published Tracks
                <ArrowRight className="ml-2 h-4 w-4 text-foreground/60" />
              </Link>
            </div>
          )}
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
              audioUrl: music.primaryTrack.audioUrl || '',
              duration: music.totalDuration,
              coverImage: music.primaryTrack.coverR2Url || '',
              artist: music.primaryTrack.artist || 'Unknown Artist',
              allTracks: music.allTracks.map(track => ({
                id: track.id,
                audioUrl: track.audioUrl || '',
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
          />
          </div>
        </>
      )}
      </div>
    </section>
  );
};
