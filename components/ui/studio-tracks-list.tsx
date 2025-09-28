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
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const tracksPerPage = 10;

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

  // 计算分页数据
  const totalPages = Math.ceil(allTracks.length / tracksPerPage);
  const startIndex = (currentPage - 1) * tracksPerPage;
  const endIndex = startIndex + tracksPerPage;
  const currentTracks = allTracks.slice(startIndex, endIndex);

  // 重置到第一页当数据变化时
  useEffect(() => {
    setCurrentPage(1);
  }, [allTracks.length]);

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {/* Expand Panel Button - Only show when panel is closed */}
            {!panelOpen && onExpandPanel && (
              <button
                onClick={onExpandPanel}
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
                title="Open Studio Panel"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-2xl font-semibold text-foreground">Studio Tracks</h2>
          </div>
          {/* Pagination - Only show if more than 1 page */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-2 bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-2xl backdrop-blur-md border border-border/30 shadow-lg">
              {/* Previous Button */}
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                title="Previous Page"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Page Info */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">
                  {((currentPage - 1) * tracksPerPage) + 1} - {Math.min(currentPage * tracksPerPage, allTracks.length)}
                </span>
                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                <span className="text-muted-foreground">
                  <span className="font-semibold">total</span> {allTracks.length}
                </span>
              </div>

              {/* Next Button */}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                title="Next Page"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Studio Tracks */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-1">
          {/* Generated Tracks - 新生成的歌曲 */}
          {allGeneratedTracks.length > 0 && (
            <div className="space-y-1 mb-4">
              {allGeneratedTracks.map((track, index) => (
                <div
                  key={`generated-${index}`}
                  className={`flex items-center gap-4 p-4 transition-all duration-300 group relative bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl border border-border/30 shadow-lg ${
                    track.isLoading || track.isError
                      ? 'cursor-default'
                      : `cursor-pointer hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl ${currentlyPlaying === `generated-${index}`
                        ? 'shadow-xl'
                        : 'hover:shadow-2xl'
                      }`
                    } ${track.isError ? 'border-red-500/30' : ''}`}
                  onClick={() => {
                    if (!track.isLoading && !track.isError && onGeneratedTrackSelect) {
                      // 直接传递生成的track数据，不需要mock
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
                          size="md"
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
                              `${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60).toString().padStart(2, '0')}`
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
            <div className="space-y-1 mb-4">
              {Array.from({ length: pendingTasksCount }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl backdrop-blur-md shadow-lg">
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
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors duration-200 group cursor-pointer ${
                selectedTrack === track.id
                  ? 'bg-primary/20 shadow-sm'
                  : 'hover:bg-white/10'
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
                      size="md"
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
                <p className="text-muted-foreground text-xs mb-1 truncate capitalize">
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
  );
};
