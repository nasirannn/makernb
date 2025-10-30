"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, Share2, Download, Clock, Calendar, Play, Pause, Star, Check, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, Pin, PinOff } from "lucide-react";
import Image from "next/image";
import { LoadingDots } from "./loading-dots";
import { CassetteTape } from "./cassette-tape";
import { toast } from 'sonner';
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { getEventBus, COVER_EVENTS, TRACK_EVENTS } from "@/lib/event-bus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TrackDetailViewProps {
  // 优先使用 trackData，如果没有则使用 trackId 请求API
  trackData?: TrackInfo;
  trackId?: string;
  onBack: () => void;
  // 播放状态相关props（通过 EventBus 自动获取，不再需要 props 传递）
  // currentPlayingTrackId?: string | null; // ❌ 冗余 - 使用 EventBus
  // isPlaying?: boolean; // ❌ 冗余 - 使用 EventBus
  onPlayTrack?: (trackInfo: TrackInfo) => void;
  // 操作按钮回调
  onFavoriteToggle?: (trackId: string, isFavorited: boolean) => void;
  onDownload?: (trackInfo: TrackInfo) => void;
  isFavorited?: boolean;
  // 更多操作回调
  onPublishToggle?: (trackId: string, isPublished: boolean) => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  onDelete?: (trackId: string) => void;
  onPinToggle?: (trackId: string, isPinned: boolean) => void;
  isPublished?: boolean;
  isPinned?: boolean;
  isAdmin?: boolean;
  // 用户权限
  currentUserId?: string | null;
}

interface TrackInfo {
  id: string;
  title: string;
  tags: string;
  lyrics: string;
  coverImage: string | null;
  audioUrl: string;
  createdAt: string;
  duration: string;
  isPublished: boolean;
  isFavorited: boolean;
  userId?: string;
  status?: string;
}

export const TrackDetailView: React.FC<TrackDetailViewProps> = ({ 
  trackData, 
  trackId, 
  onBack,
  onPlayTrack,
  onFavoriteToggle,
  onDownload,
  isFavorited = false,
  onPublishToggle,
  onEditTitle,
  onDelete,
  onPinToggle,
  isPublished = false,
  isPinned = false,
  isAdmin = false,
  currentUserId = null
}) => {
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(trackData || null);
  const [isLoading, setIsLoading] = useState(!trackData); // 如果有数据，不显示loading
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [shouldShowTagsToggle, setShouldShowTagsToggle] = useState(false);
  const tagsRef = React.useRef<HTMLParagraphElement | null>(null);
  
  // 使用 EventBus 监听播放状态
  const audioState = useAudioPlayingState({ trackId: trackInfo?.id });
  
  // 调试：监控播放状态变化
  React.useEffect(() => {
  }, [audioState.isPlaying, audioState.currentPlayingTrackId, audioState.isCurrentTrack, trackInfo?.id, trackInfo?.title]);
  
  // 编辑和删除状态
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // 判断当前用户是否是歌曲所有者
  const isOwner = React.useMemo(() => {
    if (!currentUserId || !trackInfo?.userId) {
      return false;
    }
    const owner = currentUserId === trackInfo.userId;
    return owner;
  }, [currentUserId, trackInfo?.userId]);
  
  // 判断歌曲是否在生成中或未完成
  const isGenerating = React.useMemo(() => {
    if (!trackInfo) return false;
    // 如果没有音频URL，说明还未生成完成
    if (!trackInfo.audioUrl) return true;
    // 检查 status 是否为生成中
    const generating = trackInfo.status === 'generating' || trackInfo.status === 'pending';
    return generating;
  }, [trackInfo]);
  
  // 计算最终的收藏状态：优先使用 prop，其次是 trackInfo
  const finalIsFavorited = React.useMemo(() => {
    // 如果 prop 有定义，优先使用 prop（父组件知道最新状态）
    if (isFavorited !== undefined) {
      return isFavorited;
    }
    // 否则使用 trackInfo 中的值
    return trackInfo?.isFavorited ?? false;
  }, [isFavorited, trackInfo?.isFavorited]);
  
  // 调试：监控收藏状态
  React.useEffect(() => {
  }, [finalIsFavorited, trackInfo?.isFavorited, isFavorited, trackInfo?.id]);


  // 获取歌曲详情（仅在没有直接提供数据时）
  useEffect(() => {
    // 如果已经有trackData，直接使用，不请求API
    if (trackData) {
      setTrackInfo(trackData);
      setIsLoading(false);
      return;
    }

    // 如果没有trackData但有trackId，请求API
    if (!trackData && trackId) {
      const fetchTrackInfo = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          const response = await fetch(`/api/track-info/${trackId}`);
          
          if (!response.ok) {
            throw new Error('Failed to fetch track info');
          }
          
          const data = await response.json();
          
          // API 返回 { success: true, track: {...} } 格式
          if (data.success && data.track) {
            setTrackInfo(data.track);
          } else {
            throw new Error('Invalid response format');
          }
        } catch (err) {
          console.error('Error fetching track info:', err);
          setError('Failed to load track information');
          toast.error('Failed to load track');
        } finally {
          setIsLoading(false);
        }
      };

      fetchTrackInfo();
    }
  }, [trackData, trackId]);

  // 监听封面更新事件（通过 EventBus）
  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') return;
    
    const eventBus = getEventBus();
    
    // 封面更新事件处理
    const handleCoverUpdated = (data: { trackId: string; coverUrl: string }) => {
      
      // 只更新当前歌曲的封面
      if (trackInfo?.id === data.trackId) {
        setTrackInfo(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            coverImage: data.coverUrl
          };
        });
        
      }
    };
    
    // 注册事件监听器
    eventBus.on(COVER_EVENTS.UPDATED, handleCoverUpdated);
    
    
    // 清理事件监听器
    return () => {
      eventBus.off(COVER_EVENTS.UPDATED, handleCoverUpdated);
    };
  }, [trackInfo?.id]);

  // 监听歌曲完成事件（通过 EventBus）
  useEffect(() => {
    // 只在客户端执行
    if (typeof window === 'undefined') return;
    
    const eventBus = getEventBus();
    
    // 歌曲完成事件处理
    const handleTrackCompleted = (data: { trackId: string; duration: number; audioUrl: string }) => {
      
      // 只更新当前歌曲的信息
      if (trackInfo?.id === data.trackId) {
        setTrackInfo(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            duration: data.duration.toString(),
            audioUrl: data.audioUrl,
            status: 'complete' // 更新状态为已完成
          };
        });
      }
    };
    
    // 注册事件监听器
    eventBus.on(TRACK_EVENTS.COMPLETED, handleTrackCompleted);
    
    // 清理事件监听器
    return () => {
      eventBus.off(TRACK_EVENTS.COMPLETED, handleTrackCompleted);
    };
  }, [trackInfo?.id]);

  // 解析 tags（放在早期，确保下面的 hook 顺序稳定）
  const tagsArray = React.useMemo(
    () => trackInfo?.tags ? trackInfo.tags.split(',').map(tag => tag.trim()) : [],
    [trackInfo?.tags]
  );
  
  // 创建稳定的 tags 字符串用于依赖项检查
  const tagsString = React.useMemo(() => tagsArray.join(' · '), [tagsArray]);

  // 仅当 tags 超过两行时显示"展开/收起"按钮（保持在任何 return 之前，避免 Hook 顺序变化）
  React.useEffect(() => {
    const evaluate = () => {
      if (!tagsRef.current) {
        setShouldShowTagsToggle(false);
        return;
      }
      const el = tagsRef.current;
      const computed = window.getComputedStyle(el);
      const lineHeightValue = parseFloat(computed.lineHeight || '0');
      const lineHeight = Number.isFinite(lineHeightValue) && lineHeightValue > 0 ? lineHeightValue : 20;

      const prevWebkitLineClamp = (el.style as any).webkitLineClamp;
      (el.style as any).webkitLineClamp = 'unset';
      const naturalHeight = el.scrollHeight;
      (el.style as any).webkitLineClamp = prevWebkitLineClamp || '';

      const twoLinesHeight = lineHeight * 2;
      setShouldShowTagsToggle(naturalHeight > twoLinesHeight + 1);
    };

    const id = window.requestAnimationFrame(evaluate);
    const onResize = () => evaluate();
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [tagsString, showAllTags]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background">
        <LoadingDots size="lg" />
      </div>
    );
  }

  // 错误状态
  if (error || !trackInfo) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background p-6">
        <p className="text-muted-foreground mb-4">{error || 'Track not found'}</p>
        <Button onClick={onBack} variant="outline">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </div>
    );
  }


  // 格式化时长
  const formatDuration = (duration: string | number) => {
    const seconds = typeof duration === 'string' ? parseFloat(duration) : duration;
    
    // 处理 NaN 或无效值
    if (isNaN(seconds) || seconds <= 0) {
      return '0:00';
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full overflow-y-auto overscroll-contain">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 backdrop-blur-lg bg-background/80 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* 返回按钮 */}
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 hover:bg-muted/50 hover:text-white hover:scale-105 transition-all duration-300 rounded-lg text-muted-foreground px-3 py-2"
          >
            <ChevronLeft className="h-5 w-5" />
            <span>Back</span>
          </Button>
        </div>
      </div>

      {/* 主内容容器 */}
      <div className="relative">
        {/* 内容区域 */}
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {/* 桌面端：封面图和标题区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-8 mb-8">
            {/* 左侧：封面图 */}
            {trackInfo?.coverImage ? (
              <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg">
                <Image
                  src={trackInfo.coverImage}
                  alt={trackInfo.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="relative w-full aspect-square flex items-center justify-center">
                <CassetteTape 
                  className="w-full h-full"
                  isPlaying={audioState.isPlaying && audioState.isCurrentTrack}
                />
              </div>
            )}

            {/* 右侧：歌曲信息（播放按钮与封面图底部对齐）*/}
            <div className="hidden lg:flex lg:flex-col lg:h-[256px]">
              {/* 上方内容区域 */}
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">{trackInfo.title}</h1>
                
                {/* Tags */}
                {tagsArray.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {tagsArray.map((tag, index) => (
                      <span key={index}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 元数据 */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(trackInfo.createdAt).toLocaleString()}</span>
                  </div>
                  {trackInfo.duration && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(trackInfo.duration)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 播放和操作按钮 - 与封面图底部对齐 */}
              <div className="flex-1 flex items-end gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-20 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
                  onClick={() => {
                    if (trackInfo && onPlayTrack) {
                      onPlayTrack(trackInfo);
                    }
                  }}
                  aria-label={audioState.isPlaying && audioState.isCurrentTrack ? "Pause" : "Play"}
                >
                  {audioState.isPlaying && audioState.isCurrentTrack ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </Button>

                {/* 操作按钮组 */}
                <div className="flex items-center gap-2">
                  {/* 收藏按钮 - 仅所有者可见，且非生成中 */}
                  {!isGenerating && isOwner && onFavoriteToggle && (
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-10 w-10 ${
                        finalIsFavorited
                          ? 'text-red-500 hover:bg-red-50' 
                          : 'hover:text-red-500'
                      }`}
                      onClick={() => {
                        if (trackInfo) {
                          // 调用父组件的回调
                          onFavoriteToggle(trackInfo.id, finalIsFavorited);
                        }
                      }}
                      aria-label={finalIsFavorited ? "Remove from library" : "Add to library"}
                    >
                      <Star className={`h-5 w-5 ${finalIsFavorited ? 'fill-current' : ''}`} />
                    </Button>
                  )}

                  {/* 分享按钮 - 所有人可见，且非生成中 */}
                  {!isGenerating && (
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-10 w-10 transition-colors ${
                        copied ? 'text-green-500 border-green-500' : ''
                      }`}
                      onClick={() => {
                        if (trackInfo) {
                          const url = `${window.location.origin}/studio?track=${trackInfo.id}`;
                          navigator.clipboard.writeText(url).then(() => {
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          });
                        }
                      }}
                      aria-label="Share track"
                    >
                      {copied ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Share2 className="h-5 w-5" />
                      )}
                    </Button>
                  )}

                  {/* 下载按钮 - 仅所有者可见，且非生成中 */}
                  {!isGenerating && isOwner && onDownload && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => {
                        if (trackInfo) {
                          onDownload(trackInfo);
                        }
                      }}
                      aria-label="Download track"
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  )}

                  {/* 更多操作按钮 - 仅所有者可见，且非生成中 */}
                  {!isGenerating && isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {/* 发布/取消发布 */}
                        {onPublishToggle && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (trackInfo) {
                                onPublishToggle(trackInfo.id, isPublished);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {isPublished ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Unpublish
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Publish
                              </>
                            )}
                          </DropdownMenuItem>
                        )}

                        {/* 编辑标题 */}
                        {onEditTitle && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (trackInfo) {
                                setEditingTitle(trackInfo.title);
                                setIsEditDialogOpen(true);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Title
                          </DropdownMenuItem>
                        )}

                        {/* Pin/Unpin - 仅管理员可见 */}
                        {isAdmin && onPinToggle && (
                          <DropdownMenuItem
                            onClick={() => {
                              if (trackInfo) {
                                onPinToggle(trackInfo.id, isPinned);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {isPinned ? (
                              <PinOff className="mr-2 h-4 w-4" />
                            ) : (
                              <Pin className="mr-2 h-4 w-4" />
                            )}
                            {isPinned ? "Unpin" : "Pin"}
                          </DropdownMenuItem>
                        )}

                        {/* 删除 */}
                        {onDelete && (
                          <>
                            {(onPublishToggle || onEditTitle || (isAdmin && onPinToggle)) && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteDialogOpen(true);
                              }}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 移动端：歌曲信息 */}
          <div className="lg:hidden space-y-4 mt-6">
            <h1 className="text-3xl font-bold tracking-tight">{trackInfo.title}</h1>
            
            {/* Tags */}
            {tagsArray.length > 0 && (
              <div className="space-y-2">
                <p ref={tagsRef} className={`text-sm text-muted-foreground ${showAllTags ? '' : 'line-clamp-2'}`}>
                  {tagsArray.join(' · ')}
                </p>
                {shouldShowTagsToggle && (
                  <button
                    type="button"
                    onClick={() => setShowAllTags(prev => !prev)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAllTags ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* 元数据 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(trackInfo.createdAt).toLocaleDateString()}</span>
              </div>
              {trackInfo.duration && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{formatDuration(trackInfo.duration)}</span>
                </div>
              )}
            </div>
          </div>

        {/* 移动端操作区（仅在小屏显示） */}
        <div className="lg:hidden mt-6 flex items-center gap-3 pt-2">
          {/* 播放按钮 */}
          <Button
            variant="outline"
            className="h-11 flex-1 min-w-0 bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:text-primary-foreground"
            onClick={() => {
              if (trackInfo && onPlayTrack) {
                onPlayTrack(trackInfo);
              }
            }}
            aria-label={audioState.isPlaying && audioState.isCurrentTrack ? "Pause" : "Play"}
          >
            {audioState.isPlaying && audioState.isCurrentTrack ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </Button>

          {/* 收藏 */}
          {!isGenerating && isOwner && onFavoriteToggle && (
            <Button
              variant="outline"
              size="icon"
              className={`h-11 w-11 ${
                finalIsFavorited ? 'text-red-500 hover:bg-red-50' : 'hover:text-red-500'
              }`}
              onClick={() => {
                if (trackInfo) {
                  onFavoriteToggle(trackInfo.id, finalIsFavorited);
                }
              }}
              aria-label={finalIsFavorited ? "Remove from library" : "Add to library"}
            >
              <Star className={`h-5 w-5 ${finalIsFavorited ? 'fill-current' : ''}`} />
            </Button>
          )}

          {/* 分享 */}
          {!isGenerating && (
            <Button
              variant="outline"
              size="icon"
              className={`h-11 w-11 transition-colors ${copied ? 'text-green-500 border-green-500' : ''}`}
              onClick={() => {
                if (trackInfo) {
                  const url = `${window.location.origin}/studio?track=${trackInfo.id}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }
              }}
              aria-label="Share track"
            >
              {copied ? (
                <Check className="h-5 w-5" />
              ) : (
                <Share2 className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* 下载 */}
          {!isGenerating && isOwner && onDownload && (
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => {
                if (trackInfo) {
                  onDownload(trackInfo);
                }
              }}
              aria-label="Download track"
            >
              <Download className="h-5 w-5" />
            </Button>
          )}

          {/* 更多 */}
          {!isGenerating && isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onPublishToggle && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (trackInfo) {
                        onPublishToggle(trackInfo.id, isPublished);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {isPublished ? (
                      <>
                        <EyeOff className="mr-2 h-4 w-4" />
                        Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="mr-2 h-4 w-4" />
                        Publish
                      </>
                    )}
                  </DropdownMenuItem>
                )}

                {onEditTitle && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (trackInfo) {
                        setEditingTitle(trackInfo.title);
                        setIsEditDialogOpen(true);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Title
                  </DropdownMenuItem>
                )}

                {isAdmin && onPinToggle && (
                  <DropdownMenuItem
                    onClick={() => {
                      if (trackInfo) {
                        onPinToggle(trackInfo.id, isPinned);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    {isPinned ? (
                      <PinOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Pin className="mr-2 h-4 w-4" />
                    )}
                    {isPinned ? 'Unpin' : 'Pin'}
                  </DropdownMenuItem>
                )}

                {onDelete && (
                  <>
                    {(onPublishToggle || onEditTitle || (isAdmin && onPinToggle)) && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteDialogOpen(true);
                      }}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

          {/* 歌词部分 - 与封面图左对齐 */}
          <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr] gap-8 pb-8 mt-8 lg:mt-0">
            {/* 左侧：歌词内容，与封面图左对齐 */}
            <div>
              <pre className="whitespace-pre-wrap font-sans text-lg font-normal leading-relaxed text-foreground/90">
                {trackInfo.lyrics || 'No lyrics available'}
              </pre>
            </div>
            
            {/* 右侧：空白占位 */}
            <div className="hidden lg:block"></div>
          </div>

        </div>
      </div>


      {/* 编辑标题对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Title</DialogTitle>
            <DialogDescription>
              Enter a new title for your track.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Track title"
              maxLength={80}
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (trackInfo && onEditTitle && editingTitle.trim()) {
                  onEditTitle(trackInfo.id, editingTitle.trim());
                  setIsEditDialogOpen(false);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Track</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Are you sure you want to delete &quot;{trackInfo?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (trackInfo && onDelete) {
                  onDelete(trackInfo.id);
                  setDeleteDialogOpen(false);
                  onBack(); // 删除后返回列表
                }
              }}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

