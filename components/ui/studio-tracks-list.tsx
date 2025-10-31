"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause, Music, Trash2, Download, Star, Share2, Check, Search, X } from "lucide-react";
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { LoadingDots, LoadingState } from './loading-dots';
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from 'sonner';
import { LibraryTrack } from '@/types/track';
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";

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
  allTracks: LibraryTrack[];
  totalDuration: number;
  errorInfo?: any;
}

interface StudioTracksListProps {
  userTracks: MusicGeneration[];
  isLoading: boolean;
  onTrackSelect?: (trackId: string) => void;  // 修改：接收 trackId 而不是完整对象
  onTrackPlay?: (track: LibraryTrack, music: MusicGeneration) => void;
  // currentlyPlaying?: string | null; // ❌ 冗余 - 使用 EventBus
  selectedTrack?: string | null;
  // isPlaying?: boolean; // ❌ 冗余 - 使用 EventBus
  // 新增：生成中的tracks
  generatedTracks?: any[];
  // 新增：panel状态和展开函数
  panelOpen?: boolean;
  onExpandPanel?: () => void;
  // 新增：专门处理生成tracks的回调
  onGeneratedTrackSelect?: (trackId: string) => void;  // 修改：接收 trackId 而不是完整对象
  // 新增：下载和收藏回调
  onDownload?: (track: LibraryTrack, music: MusicGeneration, format?: 'mp3' | 'wav') => void;
  onFavoriteToggle?: (track: LibraryTrack, music: MusicGeneration) => void;
  onDelete?: (track: LibraryTrack, music: MusicGeneration) => void;
  hasPlayer?: boolean; // 新增：是否有播放器显示
}

export const StudioTracksList: React.FC<StudioTracksListProps> = React.memo(function StudioTracksList({
  userTracks,
  isLoading,
  onTrackSelect,
  onTrackPlay,
  // currentlyPlaying, // ❌ 冗余 - 不再使用
  selectedTrack,
  // isPlaying = false, // ❌ 冗余 - 不再使用
  generatedTracks = [],
  onGeneratedTrackSelect,
  onDownload,
  onFavoriteToggle,
  onDelete,
  hasPlayer = false,
}) {
  
  // 移除分页状态，显示所有歌曲
  const { user } = useAuth();
  
  // 使用 EventBus 监听全局播放状态
  const globalAudioState = useAudioPlayingState();
  
  // 获取权限检查函数
  const { hasPermission } = useFeaturePermissions();
  
  // 检查下载权限
  const canDownloadMP3 = hasPermission('download_mp3_track');
  const canDownloadWAV = hasPermission('download_wav_track');
  
  // 分享按钮状态 - 跟踪复制成功的歌曲
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  
  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('');

  // 删除歌曲函数
  const handleDeleteTrack = async (trackId: string) => {
    try {
      // 获取当前session的access token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`/api/delete-track/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        toast.success('Track deleted successfully');
        // 刷新页面或更新状态
        window.location.reload();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete track');
      }
    } catch (error) {
      console.error('Delete track error:', error);
      toast.error('Failed to delete track');
    }
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    // 处理 NaN 或无效值
    if (isNaN(seconds) || seconds <= 0) {
      return '0:00';
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        musicGeneration: music,
        // 检查是否有audio_url，如果没有则标记为错误状态
        isError: !(track as any).audio_url || (track as any).audio_url.trim() === '',
        errorMessage: (!(track as any).audio_url || (track as any).audio_url.trim() === '') ? 'Audio file missing' : undefined
      }));
  });

  // 搜索过滤函数 - 只按名称和标签匹配
  const filterTracks = React.useCallback((tracks: any[]) => {
    if (!searchQuery.trim()) return tracks;
    
    const query = searchQuery.toLowerCase();
    return tracks.filter(track => {
      // 搜索标题
      if (track.title?.toLowerCase().includes(query)) return true;
      if (track.musicTitle?.toLowerCase().includes(query)) return true;
      
      // 搜索标签
      if (track.tags?.toLowerCase().includes(query)) return true;
      if (track.musicTags?.toLowerCase().includes(query)) return true;
      
      return false;
    });
  }, [searchQuery]);

  // 使用 useMemo 稳定 generatedTracks 数组并应用搜索过滤
  const stableGeneratedTracks = React.useMemo(() => {
    const tracks = generatedTracks || [];
    return filterTracks(tracks);
  }, [generatedTracks, filterTracks]);

  // 显示所有歌曲，不分页，应用搜索过滤
  const currentTracks = filterTracks(allTracks);

  // 处理歌曲选择（点击歌曲行）- 调用父组件回调
  const handleTrackSelect = (track: any) => {
    // 🚫 阻止占位数据的点击
    if (track.isPlaceholder) {
      return;
    }
    
    // 调用父组件传递的回调，传递 track.id
    if (onTrackSelect) {
      onTrackSelect(track.id);
    }
  };

  // 处理播放/暂停（点击播放按钮）
  const handlePlayPause = (track: any) => {
    // 🚫 阻止占位数据的播放
    if (track.isPlaceholder) {
      return;
    }
    
    if (onTrackPlay) {
      onTrackPlay(track, track.musicGeneration);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <LoadingState message="Loading your tracks..." size="lg" vertical />
      </div>
    );
  }

  // 如果没有任何tracks，显示空状态
  const showEmptyState = (!userTracks || userTracks.length === 0 || allTracks.length === 0) 
    && stableGeneratedTracks.length === 0;

  if (showEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <div className="text-center max-w-md space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Music className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-foreground">
              Your tracks will appear here
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed">
            Choose your style, describe the vibe, and create your track.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search Bar - 搜索框 */}
      <div className="flex-shrink-0 px-6 pb-4 md:pt-6 md:pb-4 md:px-6">
        <div className="flex items-center justify-end">
          {/* Search Input */}
          <div className="relative w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title and tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 w-full bg-muted/30 border border-border/20 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Studio Tracks - 可滚动区域 */}
      <div className="flex-1 overflow-hidden">
        <div 
          className="h-full overflow-y-auto px-0 relative"
          style={{
            // 🎯 让内容延伸到页面底部，播放器悬浮遮挡
            // 有播放器：播放器高度 + 间距 + 额外padding，让播放器悬浮遮挡内容
            // 无播放器：较大padding用于底部留白
            paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 1.5rem)' : '5rem'
          }}
        >
        <div className="relative">
          {/* Generated Tracks - 新生成的歌曲 */}
          {stableGeneratedTracks.length > 0 && (
            <div className="space-y-1">
              {stableGeneratedTracks.map((track, index) => (
                <div
                  key={`generated-${index}`}
                  className={`relative flex items-center gap-4 px-2 py-2 mx-3 transition-all duration-300 group rounded-lg border
                    ${track.isError || (!track.audioUrl && !track.isGenerating)
                      ? 'cursor-default'
                      : `cursor-pointer ${selectedTrack === track.id
                          ? 'bg-muted/60 border-border/60'
                          : 'hover:bg-muted/20 border-transparent'
                        }`
                    }`}
                  onClick={() => {
                    if (!track.isError && track.audioUrl && onGeneratedTrackSelect) {
                      // 调用父组件回调
                      onGeneratedTrackSelect(track.id);
                    }
                  }}
                >
                  {/* Loading 状态显示遮罩和 Progress indicators - 只在generating状态显示 */}
                  {track.isLoading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-10">
                      <LoadingDots size="md" color="white" />
                    </div>
                  )}
                  
                  
                  <div className={`relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover ${!track.isLoading && !track.isError && !(!track.audioUrl && !track.isGenerating) ? 'group-hover:scale-105' : ''}`}>
                    {track.isError || (!track.audioUrl && !track.isGenerating) ? (
                      // 错误状态或没有音频URL时显示logo图片作为封面
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
                        {track.isGenerating ? (
                          // text回调后显示旋转的loading效果
                          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                        ) : (
                          <Music className="h-6 w-6 text-primary" />
                        )}
                      </div>
                    )}

                    {/* Play Button Overlay for Generated Tracks - 鼠标悬浮时显示 */}
                    {!track.isError && track.audioUrl && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            // 处理新生成歌曲的播放逻辑
                            if (onGeneratedTrackSelect) {
                              onGeneratedTrackSelect(track);
                            }
                          }}
                        >
                          {globalAudioState.currentPlayingTrackId === track.id && globalAudioState.isPlaying ? (
                            <Pause className="h-4 w-4 text-white" />
                          ) : (
                            <Play className="h-4 w-4 text-white" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Audio Wave Indicator for Generated Tracks - 只在播放时显示，鼠标悬浮时隐藏 */}
                    {globalAudioState.currentPlayingTrackId === track.id && globalAudioState.isPlaying && !track.isError && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                        <CustomAudioWaveIndicator
                          isPlaying={globalAudioState.isPlaying}
                          size="sm"
                          className="text-white"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Track Info */}
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className="flex-1 min-w-0 flex items-center h-16">
                      <div className="flex items-center justify-between gap-2 w-full">
                        {/* 歌曲信息列 - 自适应宽度 */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center h-16">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold text-sm truncate ${
                              track.isError || (!track.audioUrl && !track.isGenerating)
                                ? 'text-red-400'
                                : selectedTrack === track.id
                                  ? 'text-primary'
                                  : 'text-foreground'
                            }`}>
                              {track.isError || (!track.audioUrl && !track.isGenerating) 
                                ? (track.errorMessage || track.originalPrompt || track.title || 'Generation failed') 
                                : (track.title || 'Untitled Track')
                              }
                            </h3>
                            {/* 时长紧跟在歌曲名称后面 */}
                            {!track.isError && track.audioUrl && (!track.duration || track.duration === 0) && (
                              <div className="flex items-center gap-1">
                                <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse"></div>
                                <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                <div className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                              </div>
                            )}
                          </div>
                          {/* 优先显示 tags，没有 tags 才显示生成提示 */}
                          {!track.isError && (
                            <>
                              {track.tags && track.tags.trim() !== '' ? (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {/* 时长显示在 tags 前面，用竖线分隔 */}
                                  {track.audioUrl && track.duration && track.duration > 0 && (
                                    <>
                                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDuration(track.duration || 0)}
                                      </span>
                                      <span className="text-xs text-muted-foreground/60">|</span>
                                    </>
                                  )}
                                  <p 
                                    className="text-xs text-muted-foreground truncate flex-1"
                                    title={track.tags}
                                  >
                                    {track.tags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                                      <span key={index}>
                                        <span>{tag.trim()}</span>
                                        {index < array.length - 1 && <span className="mx-1">•</span>}
                                      </span>
                                    ))}
                                    {track.tags.length > 100 && '...'}
                                  </p>
                                </div>
                              ) : (
                                track.isGenerating && !track.audioUrl && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    Generating your track, please wait...
                                  </p>
                                )
                              )}
                            </>
                          )}
                          {/* 所有卡片都显示创建时间（包括生成中的卡片） */}
                          {!track.isError && track.createdAt && (
                            <p className="text-xs text-muted-foreground/60 truncate mt-1">
                              {new Date(track.createdAt).toLocaleString('en-US', {
                                month: 'numeric',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                              })}
                            </p>
                          )}
                          {(track.isError || (!track.audioUrl && !track.isGenerating)) && (
                            <p className="text-xs text-red-400/80 truncate mt-1">
                              Click delete to remove this failed track
                            </p>
                          )}
                        </div>
                        
                        {/* 操作按钮列 - 自适应宽度 */}
                        <div className="flex items-center justify-end gap-1 flex-shrink-0">
                          {(track.isError || (!track.audioUrl && !track.isGenerating)) ? (
                            // 失败状态：显示删除按钮
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (track.id) {
                                  handleDeleteTrack(track.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          ) : (
                            <>
                              {/* 只有在歌曲完成生成后才显示操作按钮 */}
                              {track.audio_url && track.musicStatus !== 'generating' && (
                               <div className="flex items-center gap-1">
                                 {/* 桌面端操作按钮 */}
                                 <div className="hidden md:flex items-center gap-3">
                                   {/* 收藏按钮 */}
                                   {!track.isError && onFavoriteToggle && (
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       className={`h-6 w-6 p-0 hover:bg-muted/50 ${
                                         track.is_favorited 
                                           ? 'text-red-500 hover:text-red-600' 
                                           : 'text-muted-foreground hover:text-foreground'
                                       }`}
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         onFavoriteToggle(track, track.musicGeneration);
                                       }}
                                       aria-label={track.is_favorited ? "Remove from library" : "Add to library"}
                                     >
                                       <Star className={`h-3 w-3 ${track.is_favorited ? 'fill-current' : ''}`} />
                                     </Button>
                                   )}
                                   
                                   {/* 分享按钮 */}
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     className={`h-6 w-6 p-0 hover:bg-muted/50 transition-colors ${
                                       copiedTrackId === track.id 
                                         ? 'text-green-500' 
                                         : 'text-muted-foreground hover:text-foreground'
                                     }`}
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const url = `${window.location.origin}/studio?track=${track.id}`;
                                       navigator.clipboard.writeText(url).then(() => {
                                         setCopiedTrackId(track.id);
                                         setTimeout(() => setCopiedTrackId(null), 2000);
                                       });
                                     }}
                                     aria-label="Share track"
                                   >
                                     {copiedTrackId === track.id ? (
                                       <Check className="h-3 w-3" />
                                     ) : (
                                       <Share2 className="h-3 w-3" />
                                     )}
                                   </Button>
                                   
                                  {/* 下载按钮 - 下拉菜单 */}
                                  {onDownload && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                          aria-label="Download track"
                                        >
                                          <Download className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 min-w-[180px]">
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!canDownloadMP3) {
                                              toast.error('Download MP3 requires Basic subscription');
                                              // 跳转到订阅页面
                                              window.location.href = '/#pricing';
                                              return;
                                            }
                                            onDownload(track, track.musicGeneration, 'mp3');
                                          }}
                                          className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                                        >
                                          <span className="text-sm font-medium">Download MP3</span>
                                          {!canDownloadMP3 && (
                                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                              Subscription
                                            </Badge>
                                          )}
                                        </DropdownMenuItem>
                                        {/* <DropdownMenuItem
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!canDownloadWAV) {
                                              toast.error('Download WAV requires Premium subscription');
                                              // 跳转到订阅页面
                                              window.location.href = '/#pricing';
                                              return;
                                            }
                                            onDownload(track, track.musicGeneration, 'wav');
                                          }}
                                          className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                                        >
                                          <span className="text-sm font-medium">Download WAV</span>
                                          <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                            Premium
                                          </Badge>
                                        </DropdownMenuItem> */}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                  
                                  {/* 删除按钮 */}
                                  {onDelete && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-muted/50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(track, track.musicGeneration);
                                      }}
                                      aria-label="Delete track"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                                
                                {/* 移动端操作按钮 */}
                                <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
                                   {/* 收藏按钮 */}
                                   {!track.isError && onFavoriteToggle && (
                                     <button
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         onFavoriteToggle(track, track.musicGeneration);
                                       }}
                                       className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${
                                         track.is_favorited 
                                           ? 'text-red-500' 
                                           : 'text-muted-foreground hover:text-foreground'
                                       }`}
                                       aria-label={track.is_favorited ? "Remove from library" : "Add to library"}
                                     >
                                       <Star className={`h-4 w-4 ${track.is_favorited ? 'fill-current' : ''}`} />
                                     </button>
                                   )}
                                   
                                   {/* 分享按钮 */}
                                   <button
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const url = `${window.location.origin}/studio?track=${track.id}`;
                                       navigator.clipboard.writeText(url).then(() => {
                                         setCopiedTrackId(track.id);
                                         setTimeout(() => setCopiedTrackId(null), 2000);
                                       });
                                     }}
                                     className={`h-7 w-7 flex items-center justify-center transition-colors ${
                                       copiedTrackId === track.id
                                         ? 'text-green-500'
                                         : 'text-muted-foreground hover:text-foreground'
                                     }`}
                                     aria-label="Share track"
                                   >
                                     {copiedTrackId === track.id ? (
                                       <Check className="h-4 w-4" />
                                     ) : (
                                       <Share2 className="h-4 w-4" />
                                     )}
                                   </button>
                                   
                                   {/* 下载按钮 - 下拉菜单 */}
                                   {onDownload && (
                                     <DropdownMenu>
                                       <DropdownMenuTrigger asChild>
                                         <button
                                           onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                           }}
                                           className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                           aria-label="Download track"
                                         >
                                           <Download className="h-4 w-4" />
                                         </button>
                                       </DropdownMenuTrigger>
                                       <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 min-w-[180px]">
                                         <DropdownMenuItem
                                           onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             if (!canDownloadMP3) {
                                               toast.error('Download MP3 requires Basic subscription');
                                               // 跳转到订阅页面
                                               window.location.href = '/#pricing';
                                               return;
                                             }
                                             onDownload(track, track.musicGeneration, 'mp3');
                                           }}
                                           className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                                         >
                                           <span className="text-sm font-medium">Download MP3</span>
                                           {!canDownloadMP3 && (
                                             <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                               Subscription
                                             </Badge>
                                           )}
                                         </DropdownMenuItem>
                                         {/* <DropdownMenuItem
                                           onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             if (!canDownloadWAV) {
                                               toast.error('Download WAV requires Premium subscription');
                                               // 跳转到订阅页面
                                               window.location.href = '/#pricing';
                                               return;
                                             }
                                             onDownload(track, track.musicGeneration, 'wav');
                                           }}
                                           className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                                         >
                                           <span className="text-sm font-medium">Download WAV</span>
                                           <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                             Premium
                                           </Badge>
                                         </DropdownMenuItem> */}
                                       </DropdownMenuContent>
                                     </DropdownMenu>
                                   )}
                                  
                                  {/* 删除按钮 */}
                                  {onDelete && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(track, track.musicGeneration);
                                      }}
                                      className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                                      aria-label="Delete track"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                           </>
                         )}
                       </div>
                     </div>
                   </div>
                 </div>

               </div>
             ))}
           </div>
         )}

         {/* User Tracks - 用户已保存的歌曲 */}
          {currentTracks.length > 0 && (
            <div className="space-y-1">
              {currentTracks.map((track) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-4 px-2 py-2 mx-3 transition-all duration-300 group rounded-lg border
                    ${track.isError
                      ? 'cursor-default'
                      : `cursor-pointer ${selectedTrack === track.id
                          ? 'bg-muted/60 border-border/60'
                          : 'hover:bg-muted/20 border-transparent'
                        }`
                    }`}
                  onClick={() => {
                    if (!track.isError) {
                      handleTrackSelect(track);
                    }
                  }}
                >
              

              {/* 封面 */}
              <div 
                className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 group/cover"
              >
                {track.isError ? (
                  // 错误状态：显示logo图片作为封面
                  <Image
                    src="/logo.svg"
                    alt="Error"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover transition-all duration-300"
                  />
                ) : track.cover_r2_url ? (
                  <Image
                    src={track.cover_r2_url}
                    alt={track.musicTitle}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center cursor-pointer">
                    <span className="text-sm font-bold text-primary">
                      {track.id.slice(-2).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Play Button Overlay - 鼠标悬浮时显示，错误状态不显示 */}
                {!track.isError && (
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
                      {globalAudioState.currentPlayingTrackId === track.id && globalAudioState.isPlaying ? (
                        <Pause className="h-4 w-4 text-white" />
                      ) : (
                        <Play className="h-4 w-4 text-white" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Audio Wave Indicator - 只在播放时显示，鼠标悬浮时隐藏，错误状态不显示 */}
                {globalAudioState.currentPlayingTrackId === track.id && globalAudioState.isPlaying && !track.isError && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                    <CustomAudioWaveIndicator
                      isPlaying={globalAudioState.isPlaying}
                      size="sm"
                      className="text-white"
                    />
                  </div>
                )}
                
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0 flex items-center gap-4">
                <div className="flex-1 min-w-0 flex items-center h-16">
                  <div className="flex items-center justify-between gap-2 w-full">
                    {/* 歌曲信息列 - 自适应宽度 */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center h-16">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold text-sm truncate ${
                          track.isError
                            ? 'text-red-400'
                            : selectedTrack === track.id
                              ? 'text-primary'
                              : 'text-foreground'
                        }`}>
                          {track.isError 
                            ? (track.errorMessage || track.musicTitle || 'Unknown')
                            : track.musicTitle
                          }
                        </h3>
                      </div>
                      {/* 标签信息 - 进一步增加显示长度 */}
                      {!track.isError && track.musicTags && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {/* 时长显示在 tags 前面，用竖线分隔 */}
                          {!track.isError && (
                            <>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDuration(track.duration || 0)}
                              </span>
                              <span className="text-xs text-muted-foreground/60">|</span>
                            </>
                          )}
                          <p 
                            className="text-xs text-muted-foreground truncate flex-1"
                            title={track.musicTags}
                          >
                            {track.musicTags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                              <span key={index}>
                                <span>{tag.trim()}</span>
                                {index < array.length - 1 && <span className="mx-1">•</span>}
                              </span>
                            ))}
                            {track.musicTags.length > 100 && '...'}
                          </p>
                        </div>
                      )}
                      {track.isError && (
                        <p className="text-xs text-red-400/80 truncate mt-1">
                          Click delete to remove this failed track
                        </p>
                      )}
                      {!track.isError && track.musicGeneration?.created_at && (
                        <p className="text-xs text-muted-foreground/60 truncate mt-1">
                          {new Date(track.musicGeneration.created_at).toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })}
                        </p>
                      )}
                    </div>
                    
                    {/* 操作按钮列 - 自适应宽度 */}
                    <div className="flex items-center justify-end gap-1 flex-shrink-0">
                      {track.isError ? (
                        // 失败状态：显示删除按钮
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (track.id) {
                              handleDeleteTrack(track.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      ) : track.musicGeneration?.status !== 'generating' && (track as any).audio_url ? (
                        <div className="flex items-center gap-1">
                          {/* 桌面端操作按钮 - 只在歌曲完成后显示 */}
                          <div className="hidden md:flex items-center gap-3">
                            {/* 收藏按钮 */}
                            {!track.isError && onFavoriteToggle && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 hover:bg-muted/50 ${
                                  track.is_favorited 
                                    ? 'text-red-500 hover:text-red-600' 
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFavoriteToggle(track, track.musicGeneration);
                                }}
                                aria-label={track.is_favorited ? "Remove from library" : "Add to library"}
                              >
                                <Star className={`h-3 w-3 ${track.is_favorited ? 'fill-current' : ''}`} />
                              </Button>
                            )}
                            
                            {/* 分享按钮 */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-6 w-6 p-0 hover:bg-muted/50 transition-colors ${
                                copiedTrackId === track.id
                                  ? 'text-green-500'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `${window.location.origin}/studio?track=${track.id}`;
                                navigator.clipboard.writeText(url).then(() => {
                                  setCopiedTrackId(track.id);
                                  setTimeout(() => setCopiedTrackId(null), 2000);
                                });
                              }}
                              aria-label="Share track"
                            >
                              {copiedTrackId === track.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Share2 className="h-3 w-3" />
                              )}
                            </Button>
                            
                            {/* 下载按钮 - 下拉菜单 */}
                            {onDownload && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    aria-label="Download track"
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 min-w-[180px]">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!canDownloadMP3) {
                                        toast.error('Download MP3 requires Basic subscription');
                                        // 跳转到订阅页面
                                        window.location.href = '/#pricing';
                                        return;
                                      }
                                      onDownload(track, track.musicGeneration, 'mp3');
                                    }}
                                    className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                                  >
                                    <span className="text-sm font-medium">Download MP3</span>
                                    {!canDownloadMP3 && (
                                      <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                        Subscription
                                      </Badge>
                                    )}
                                  </DropdownMenuItem>
                                  {/* <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!canDownloadWAV) {
                                        toast.error('Download WAV requires Premium subscription');
                                        // 跳转到订阅页面
                                        window.location.href = '/#pricing';
                                        return;
                                      }
                                      onDownload(track, track.musicGeneration, 'wav');
                                    }}
                                    className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                                  >
                                    <span className="text-sm font-medium">Download WAV</span>
                                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                      Premium
                                    </Badge>
                                  </DropdownMenuItem> */}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            
                            {/* 删除按钮 */}
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-muted/50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDelete(track, track.musicGeneration);
                                }}
                                aria-label="Delete track"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                
                {/* Mobile Action Buttons - 移动端操作按钮 */}
                {!track.isError && (track as any).audio_url && track.musicGeneration?.status !== 'generating' && (
                  <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
                    {/* 收藏按钮 */}
                    {onFavoriteToggle && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFavoriteToggle(track, track.musicGeneration);
                        }}
                        className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors ${
                          track.is_favorited 
                            ? 'text-red-500' 
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        aria-label={track.is_favorited ? "Remove from library" : "Add to library"}
                      >
                        <Star className={`h-4 w-4 ${track.is_favorited ? 'fill-current' : ''}`} />
                      </button>
                    )}
                    
                    {/* 分享按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `${window.location.origin}/studio?track=${track.id}`;
                        navigator.clipboard.writeText(url).then(() => {
                          setCopiedTrackId(track.id);
                          setTimeout(() => setCopiedTrackId(null), 2000);
                        });
                      }}
                      className={`h-7 w-7 flex items-center justify-center transition-colors ${
                        copiedTrackId === track.id
                          ? 'text-green-500'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label="Share track"
                    >
                      {copiedTrackId === track.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Share2 className="h-4 w-4" />
                      )}
                    </button>
                    
                    {/* 下载按钮 - 下拉菜单 */}
                    {onDownload && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Download track"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 min-w-[180px]">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!canDownloadMP3) {
                                toast.error('Download MP3 requires Basic subscription');
                                // 跳转到订阅页面
                                window.location.href = '/#pricing';
                                return;
                              }
                              onDownload(track, track.musicGeneration, 'mp3');
                            }}
                            className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                          >
                            <span className="text-sm font-medium">Download MP3</span>
                            {!canDownloadMP3 && (
                              <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                                Subscription
                              </Badge>
                            )}
                          </DropdownMenuItem>
                          {/* <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!canDownloadWAV) {
                                toast.error('Download WAV requires Premium subscription');
                                // 跳转到订阅页面
                                window.location.href = '/#pricing';
                                return;
                              }
                              onDownload(track, track.musicGeneration, 'wav');
                            }}
                            className="flex items-center justify-between gap-3 cursor-pointer px-3 py-2.5"
                          >
                            <span className="text-sm font-medium">Download WAV</span>
                            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                              Premium
                            </Badge>
                          </DropdownMenuItem> */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    
                    {/* 删除按钮 */}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(track, track.musicGeneration);
                        }}
                        className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete track"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
                {/* Mobile Delete Button - 移动端删除按钮，错误状态显示 */}
                {track.isError && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (track.id) {
                        handleDeleteTrack(track.id);
                      }
                    }}
                    className="md:hidden flex-shrink-0 h-7 w-7 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                    aria-label="Delete track"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
              ))}
              
              {/* Tracks Summary */}
              {currentTracks.length > 0 && (
                <div className="flex justify-center items-center py-3 px-4">
                  <div className="text-sm text-muted-foreground font-medium">
                    {(() => {
                      const totalSongs = currentTracks.length;
                      const totalDuration = currentTracks.reduce((sum, track) => {
                        // 使用与 LibraryPanel 相同的数据源：track.duration
                        const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
                        return sum + (isNaN(duration) ? 0 : duration);
                      }, 0);
                      
                      // 底部汇总使用分钟格式，与 LibraryPanel 保持一致
                      const totalMinutes = Math.floor(totalDuration / 60);
                      const durationText = totalMinutes > 0 ? `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}` : '';
                      
                      return `${totalSongs} song${totalSongs > 1 ? 's' : ''}${durationText ? `, ${durationText}` : ''}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Search Results - 无搜索结果提示 */}
          {searchQuery && currentTracks.length === 0 && stableGeneratedTracks.length === 0 && (
            <div className="flex items-center justify-center h-full relative min-h-[400px]">
              <div className="text-center max-w-md px-6 py-12">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <Search className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  No matching tracks
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  No tracks found for &quot;{searchQuery}&quot;. Try a different search term.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
});
