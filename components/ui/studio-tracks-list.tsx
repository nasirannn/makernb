"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, Music, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { LoadingDots, LoadingState } from './loading-dots';
import Image from "next/image";

interface Track {
  id: string;
  audio_url: string;
  duration: number;
  side_letter: string;
  cover_r2_url?: string;
  is_deleted?: boolean;
}

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  tags: string;
  prompt: string;
  is_instrumental: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  lyrics_content?: string;
  allTracks: Track[];
  totalDuration: number;
  errorInfo?: any;
}

interface StudioTracksListProps {
  userTracks: MusicGeneration[];
  isLoading: boolean;
  onTrackSelect?: (track: Track, music: MusicGeneration) => void;
  onTrackPlay?: (track: Track, music: MusicGeneration) => void;
  currentlyPlaying?: string | null;
  selectedTrack?: string | null;
  isPlaying?: boolean;
  // 新增：生成中的tracks和skeleton数量
  allGeneratedTracks?: any[];
  pendingTasksCount?: number;
  // 新增：panel状态和展开函数
  panelOpen?: boolean;
  onExpandPanel?: () => void;
  // 新增：专门处理生成tracks的回调
  onGeneratedTrackSelect?: (generatedTrack: any) => void;
}

export const StudioTracksList: React.FC<StudioTracksListProps> = ({
  userTracks,
  isLoading,
  onTrackSelect,
  onTrackPlay,
  currentlyPlaying,
  selectedTrack,
  isPlaying = false,
  allGeneratedTracks = [],
  pendingTasksCount = 0,
  panelOpen = true,
  onExpandPanel,
  onGeneratedTrackSelect
}) => {
  
  // 移除分页状态，显示所有歌曲

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 将所有 tracks 展平，过滤掉已删除的tracks
  const allTracks = userTracks.flatMap(music => {
    // 安全检查：确保 allTracks 存在且是数组
    if (!music.allTracks || !Array.isArray(music.allTracks)) {
      return [];
    }
    return music.allTracks
      .filter(track => !track.is_deleted) // 过滤掉已删除的tracks
      .map(track => ({
        ...track,
        musicTitle: music.title,
        musicTags: music.tags,
        musicGenre: music.genre,
        musicStatus: music.status,
        musicGeneration: music
      }));
  });

  // 显示所有歌曲，不分页
  const currentTracks = allTracks;

  // 处理歌曲选择（点击歌曲行）
  const handleTrackSelect = (track: any) => {
    if (onTrackSelect) {
      onTrackSelect(track, track.musicGeneration);
    } else {
    }
  };

  // 处理播放/暂停（点击播放按钮）
  const handlePlayPause = (track: any) => {
    if (onTrackPlay) {
      onTrackPlay(track, track.musicGeneration);
    } else {
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <LoadingState message="Loading your tracks..." size="lg" vertical />
      </div>
    );
  }

  if (!userTracks || userTracks.length === 0 || allTracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8">
        <div className="space-y-4">
          <Image
            src="/studio-right-icon.svg"
            alt="Studio Icon"
            width={64}
            height={64}
            className="mx-auto"
          />
          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed text-center">
            🌹 Tell us the vibe. We&apos;ll handle the candlelight.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Studio Tracks - 可滚动区域 */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-6 pb-3 relative">
        <div className="relative space-y-3 pt-6">
          {/* Generated Tracks - 新生成的歌曲 */}
          {allGeneratedTracks.length > 0 && (
            <div className="space-y-3">
              {allGeneratedTracks.map((track, index) => (
                <div
                  key={`generated-${index}`}
                  className={`flex items-center gap-4 p-5 transition-all duration-300 group cursor-pointer backdrop-blur-sm border rounded-2xl ${
                    track.isLoading || track.isError
                      ? 'cursor-default bg-black/20 border-border/10'
                      : `${currentlyPlaying === `generated-${index}`
                          ? 'bg-black/40 shadow-lg border-white/20'
                          : 'bg-black/20 hover:bg-black/30 border-border/10 hover:border-border/30 hover:shadow-md'
                        }`
                    } ${track.isError ? 'border-red-500/30' : ''}`}
                  onClick={() => {
                    if (!track.isLoading && !track.isError && onGeneratedTrackSelect) {
                      onGeneratedTrackSelect(track);
                    }
                  }}
                >
                  {/* Loading 状态显示遮罩和 Progress indicators */}
                  {track.isLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-3xl pointer-events-none z-10">
                      <LoadingDots size="md" color="white" />
                    </div>
                  )}
                  
                  {/* 选中状态遮罩 */}
                  {currentlyPlaying === `generated-${index}` && !track.isLoading && (
                    <div className="absolute inset-0 bg-primary/10 rounded-3xl pointer-events-none z-5"></div>
                  )}
                  
                  <div className={`relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover ${!track.isLoading && !track.isError ? 'group-hover:scale-105' : ''}`}>
                    {track.isError ? (
                      // 错误状态直接显示logo图片作为封面
                      <Image
                        src="/logo.svg"
                        alt="Error"
                        width={64}
                        height={64}
                        className="w-full h-full object-cover transition-all duration-300"
                      />
                    ) : track.coverImage ? (
                      <Image
                        src={track.coverImage}
                        alt={track.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover transition-all duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center transition-all duration-300">
                        <Music className="h-6 w-6 text-primary" />
                      </div>
                    )}

                    {/* Play Button Overlay for Generated Tracks - 鼠标悬浮时显示 */}
                    {!track.isLoading && !track.isError && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 处理新生成歌曲的播放逻辑
                            if (onGeneratedTrackSelect) {
                              // 直接传递生成的track数据，不需要mock
                              onGeneratedTrackSelect(track);
                            }
                          }}
                        >
                          {currentlyPlaying === `generated-${index}` && isPlaying ? (
                            <Pause className="h-4 w-4 text-white" />
                          ) : (
                            <Play className="h-4 w-4 text-white" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Audio Wave Indicator for Generated Tracks - 只在播放时显示，鼠标悬浮时隐藏 */}
                    {currentlyPlaying === `generated-${index}` && isPlaying && !track.isLoading && !track.isError && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                        <CustomAudioWaveIndicator
                          isPlaying={isPlaying}
                          size="sm"
                          className="text-white"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 w-0">
                    <div className={`font-medium text-sm transition-colors ${
                      track.isError
                        ? 'text-red-400'
                        : currentlyPlaying === `generated-${index}`
                          ? 'text-primary'
                          : track.isLoading ? '' : 'group-hover:text-primary'
                      }`}>
                      <span className="truncate block">
                        {track.isError ? (track.originalPrompt || track.title || 'Unknown') : (track.title || 'Unknown')}
                      </span>
                    </div>
                    {track.isError ? (
                      <div className="text-xs text-muted-foreground mt-1 leading-relaxed w-full" style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {track.errorMessage || 'Generation failed'}
                      </div>
                    ) : (
                      <>
                        <div className="text-xs mt-1 leading-relaxed w-full text-muted-foreground" style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {track.tags}
                        </div>
                        {!track.isLoading && !track.isError && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {track.isGenerating || !track.duration ? (
                              '--:--'
                            ) : (
                              formatDuration(track.duration)
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Skeleton Loading State - 在生成过程中显示 */}
          {pendingTasksCount > 0 && (
            <div className="space-y-3 mb-6">
              {Array.from({ length: pendingTasksCount }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 p-5 bg-gradient-to-r from-card/95 via-card/85 to-card/95 backdrop-blur-sm rounded-3xl border border-border/50 shadow-lg">
                  <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center">
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* User Tracks - 用户已保存的歌曲 */}
          {currentTracks.map((track) => (
            <div
              key={track.id}
              className={`flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 group cursor-pointer backdrop-blur-sm border ${
                selectedTrack === track.id
                  ? 'bg-black/40 shadow-lg border-white/20'
                  : 'bg-black/20 hover:bg-black/30 border border-border/10 hover:border-border/30 hover:shadow-md'
              }`}
              onClick={() => handleTrackSelect(track)}
            >
              {/* 封面 */}
              <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 group/cover">
                {track.cover_r2_url ? (
                  <Image
                    src={track.cover_r2_url}
                    alt={track.musicTitle}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">
                      {track.side_letter || 'A'}
                    </span>
                  </div>
                )}

                {/* Play Button Overlay - 鼠标悬浮时显示 */}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPause(track);
                    }}
                  >
                    {currentlyPlaying === track.id && isPlaying ? (
                      <Pause className="h-4 w-4 text-white" />
                    ) : (
                      <Play className="h-4 w-4 text-white" />
                    )}
                  </Button>
                </div>

                {/* Audio Wave Indicator - 只在播放时显示，鼠标悬浮时隐藏 */}
                {currentlyPlaying === track.id && isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                    <CustomAudioWaveIndicator
                      isPlaying={isPlaying}
                      size="sm"
                      className="text-white"
                    />
                  </div>
                )}
                
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-foreground font-medium text-sm mb-1 truncate">
                  {track.musicTitle}
                </h3>
                <p className="text-muted-foreground text-xs mb-1 truncate">
                  {track.musicTags}
                </p>
                <div className="flex items-center text-muted-foreground text-xs">
                  <span>{formatDuration(track.duration)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
};
