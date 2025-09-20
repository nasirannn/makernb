"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, VolumeX, ArrowRight, Music } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SimpleMusicPlayer } from "@/components/ui/simple-music-player";

interface Track {
  id: string;
  audio_url: string;
  duration: number;
  side_letter: string;
  cover_r2_url?: string;
}

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  style: string;
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

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pinned-tracks?limit=4&offset=0');
      const data = await response.json();
      
      if (data.success) {
        // 将pinned tracks转换为MusicGeneration格式
        const musicGenerations = data.data.tracks.map((track: any) => ({
          id: track.music_generation_id,
          title: track.music_title,
          genre: track.genre,
          style: track.style,
          prompt: track.prompt,
          lyrics: null,
          createdAt: track.generation_created_at,
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
            Listen to The AI-Generated Contemporary & 90s R&B Songs
          </h2>

          <h3 className="md:w-1/2 mx-auto text-xl text-center text-muted-foreground mb-8">
            Experience soulful R&B music crafted by artificial intelligence
          </h3>
        </div>

        {/* Music Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-12">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden border border-white/10"
              >
                <div className="relative aspect-square bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-white/20 rounded animate-pulse"></div>
                  <div className="h-3 bg-white/20 rounded animate-pulse w-2/3"></div>
                  <div className="h-3 bg-white/20 rounded animate-pulse w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : exploreData && exploreData.music.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-12">
            {exploreData.music.map((music) => (
              <div
                key={music.id}
                className="bg-black/20 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-black/30 transition-all duration-300 group cursor-pointer border border-white/10"
              >
                {/* Cover Image */}
                <div className="relative aspect-square">
                  {music.primaryTrack.cover_r2_url ? (
                    <Image
                      src={music.primaryTrack.cover_r2_url}
                      alt={music.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Music className="w-16 h-16 text-white/50" />
                    </div>
                  )}


                  {/* Playing Wave Effect - 播放时音波效果 */}
                  {currentlyPlaying === music.primaryTrack.id && isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                      <div className="flex items-end gap-1">
                        <div className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 h-6 bg-white animate-pulse" style={{ animationDelay: '100ms' }}></div>
                        <div className="w-1 h-3 bg-white animate-pulse" style={{ animationDelay: '200ms' }}></div>
                        <div className="w-1 h-8 bg-white animate-pulse" style={{ animationDelay: '300ms' }}></div>
                        <div className="w-1 h-5 bg-white animate-pulse" style={{ animationDelay: '400ms' }}></div>
                        <div className="w-1 h-7 bg-white animate-pulse" style={{ animationDelay: '500ms' }}></div>
                        <div className="w-1 h-2 bg-white animate-pulse" style={{ animationDelay: '600ms' }}></div>
                        <div className="w-1 h-4 bg-white animate-pulse" style={{ animationDelay: '700ms' }}></div>
                      </div>
                    </div>
                  )}

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <Button
                      onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audio_url, music)}
                      size="lg"
                      className="rounded-full bg-white/90 hover:bg-white text-black hover:text-black border-0 shadow-lg"
                    >
                      {currentlyPlaying === music.primaryTrack.id && isPlaying ? (
                        <Pause className="w-6 h-6" />
                      ) : (
                        <Play className="w-6 h-6 ml-1" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Track Info */}
                <div className="p-4">
                  <h3 className="text-white font-bold text-base mb-1 truncate">
                    {music.title}
                  </h3>
                  <p className="text-white/70 text-sm mb-2 truncate capitalize whitespace-nowrap overflow-hidden">
                    {music.style}
                  </p>
                  <div className="flex items-center text-white/50 text-xs">
                    <span className="capitalize">{music.genre}</span>
                  </div>
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

        {/* Explore More Button */}
        <div className="text-center">
          <Link href="/explore">
            <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-lg">
              Explore More Tracks
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

      {/* 播放器 - 固定在底部 */}
      {playlist.length > 0 && currentlyPlaying && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <SimpleMusicPlayer
            tracks={playlist.map(music => ({
              id: music.primaryTrack.id,
              title: music.title,
              audioUrl: music.primaryTrack.audio_url,
              duration: music.totalDuration,
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
