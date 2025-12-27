'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SafeImage } from './safe-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Play,
  Pause,
  Library,
  Download,
  MoreHorizontal,
  Pin,
  PinOff,
  Trash2,
  Send,
  Share2,
  CheckCircle,
  XCircle,
  ArrowDown,
  Search,
  X,
  LogOut,
  LogIn,
  Sparkles,
  Clock,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown as ArrowDownIcon,
  Pencil,
  Check
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { isAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useFeaturePermissions } from '@/contexts/FeaturePermissionsContext';
import { usePricingModal } from '@/contexts/PricingModalContext';
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { LoadingState } from './loading-dots';
import { Progress } from './progress';
import { LibraryTrack } from '@/types/track';
import { getEventBus, TRACK_EVENTS } from '@/lib/event-bus';
import { TrackCover } from './track-cover';
import { formatDuration, formatDateTime } from '@/lib/format-utils';
import { LibraryTrackActions } from './library-track-actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EditMusicInfoDialog } from '@/components/ui/edit-music-info-dialog';

interface LibraryPanelProps {
  tracks: LibraryTrack[];
  isLoading?: boolean;
  onTrackSelect?: (track: LibraryTrack) => void;
  onTrackPlay?: (track: LibraryTrack) => void;
  onTrackAction?: (track: LibraryTrack, action: string) => void;
  currentPlayingTrack?: string | null;
  selectedLibraryTrack?: string | null;
  isPlaying?: boolean;
  userId?: string | null;
  hasPlayer?: boolean; // 新增：是否有播放器显示
  onFavoriteToggle?: (track: LibraryTrack) => void; // 收藏/取消收藏回调
}

export const LibraryPanel = ({
  tracks = [],
  isLoading = false,
  onTrackSelect,
  onTrackPlay,
  onTrackAction,
  currentPlayingTrack,
  selectedLibraryTrack,
  isPlaying = false,
  userId,
  hasPlayer = false,
  onFavoriteToggle
}: LibraryPanelProps) => {
  const { user, signOut } = useAuth();
  const { credits } = useCredits();
  const { openModal: openPricingModal } = usePricingModal();
  
  // 获取权限检查函数
  const { hasPermission } = useFeaturePermissions();
  
  // 检查下载权限
  const canDownloadMP3 = hasPermission('download_mp3_track');
  const canDownloadWAV = hasPermission('download_wav_track');
  const canDownloadCover = hasPermission('download_cover_track');
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<LibraryTrack | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [trackToPublish, setTrackToPublish] = useState<LibraryTrack | null>(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [trackToRemoveFavorite, setTrackToRemoveFavorite] = useState<LibraryTrack | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTrackForMenu, setSelectedTrackForMenu] = useState<LibraryTrack | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'pinned'>('all');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  // tags展开状态管理
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  
  // 编辑对话框状态管理
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [trackToEdit, setTrackToEdit] = useState<LibraryTrack | null>(null);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  
  // 切换tags展开状态
  const toggleTagsExpansion = (trackId: string) => {
    setExpandedTags(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };
  
  // Check if user is admin
  const userIsAdmin = userId ? isAdmin(userId) : false;

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shareResetTimeout = useRef<number | null>(null);

  // Filter tracks based on search query and active filter
  const filteredTracks = tracks.filter(track => {
    if (track.isDeleted) return false;

    if (activeFilter === 'published') {
      if (!track.isPublished) return false;
    } else if (activeFilter === 'pinned') {
      if (!track.isPinned) return false;
    } else {
      if (!track.isFavorited) return false;
    }

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      track.title.toLowerCase().includes(query) ||
      (track.tags || '').toLowerCase().includes(query)
    );
  });

  // 处理排序
  const handleSortClick = () => {
    if (sortOrder === null) {
      setSortOrder('desc'); // 默认降序（最新的在前）
    } else if (sortOrder === 'desc') {
      setSortOrder('asc'); // 升序（旧的在前）
    } else {
      setSortOrder(null); // 取消排序
    }
  };

  // 根据排序规则对tracks进行排序
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (sortOrder === null) return 0;
    
    // 对于收藏歌曲，使用favoritedAt（收藏时间）而不是createdAt（歌曲创建时间）
    const dateA = new Date(a.favoritedAt || a.createdAt).getTime();
    const dateB = new Date(b.favoritedAt || b.createdAt).getTime();
    
    if (sortOrder === 'asc') {
      return dateA - dateB; // 升序：旧的在前面
    } else {
      return dateB - dateA; // 降序：新的在前面
    }
  });

  // Show all tracks without pagination
  const paginatedTracks = sortedTracks;

  useEffect(() => {
    return () => {
      if (shareResetTimeout.current !== null) {
        clearTimeout(shareResetTimeout.current);
      }
    };
  }, []);

  const handleTrackAction = (track: LibraryTrack, action: 'play' | 'select') => {
    
    if (action === 'play' && onTrackPlay) {
      onTrackPlay(track);
    } else if (action === 'select' && onTrackSelect) {
      onTrackSelect(track);
      // 不自动展开歌词面板，用户可以通过点击播放器中的歌曲信息来展开
    }
  };

  const handleShare = useCallback(async (track: LibraryTrack): Promise<boolean> => {
    if (!track?.id) {
      toast.error('Track ID is required to share');
      return false;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error('Sharing is not supported in this environment');
      return false;
    }

    try {
      const shareUrl = `${window.location.origin}/track/${track.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedTrackId(track.id);

      if (shareResetTimeout.current !== null) {
        clearTimeout(shareResetTimeout.current);
      }
      shareResetTimeout.current = window.setTimeout(() => {
        setCopiedTrackId(prev => (prev === track.id ? null : prev));
        shareResetTimeout.current = null;
      }, 2000);

      return true;
    } catch (error) {
      console.error('Error copying share link:', error);
      toast.error('Failed to copy link');
      return false;
    }
  }, []);

  const handleDownload = async (track: LibraryTrack, format: 'mp3' | 'wav' | 'cover' = 'mp3') => {
    if (format === 'cover' && !canDownloadCover) {
      openPricingModal();
      return;
    }
    if (!track.id) {
      toast.error('Track ID is required');
      return;
    }

    try {
      // 显示下载开始提示
      const downloadToast = toast.loading('Downloading...', {
        description: 'Preparing your file...',
        icon: <ArrowDown className="h-4 w-4 text-blue-500" />
      });

      // Cover格式：下载封面图片（通过 API 代理下载，避免 CORS 问题）
      if (format === 'cover') {
        const coverUrl = track.coverImage || track.coverR2Url || track.allTracks?.[0]?.coverR2Url;
        if (!coverUrl) {
          toast.error('No cover image available', {
            id: downloadToast
          });
          return;
        }

        try {
          // 获取 session token
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            toast.error('Authentication required', {
              id: downloadToast,
              description: 'Please log in to download cover image'
            });
            return;
          }

          // 通过 API 代理下载封面
          const response = await fetch(`/api/download-cover?trackId=${track.id}`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
          }

          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${track.title || 'cover'}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);

          toast.success('Download started!', {
            id: downloadToast,
            description: `${track.title || 'cover'}.png`,
            icon: <ArrowDown className="h-4 w-4 text-blue-500" />
          });
        } catch (error) {
          console.error('Cover download error:', error);
          toast.error('Download failed', {
            id: downloadToast,
            description: error instanceof Error ? error.message : 'Unable to download cover image'
          });
        }
        return;
      }

      // WAV格式：统一通过下载 API 处理（API 会查询 track_wav_conversions 表）
      if (format === 'wav') {
        await handleWavDownloadWithPolling(track, downloadToast);
        return;
      }

      // MP3格式直接下载
      const response = await fetch(`/api/download-track?trackId=${track.id}&format=${format}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      // 检查是否是 fallback 模式（返回 JSON 包含 audioUrl）
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.fallback && data.audioUrl) {
          // Fallback 模式：直接下载原始URL
          const audioResponse = await fetch(data.audioUrl);
          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
          }
          const blob = await audioResponse.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${track.title}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } else {
          throw new Error(data.error || 'Download failed');
        }
      } else {
        // 正常模式：直接获取音频文件
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${track.title}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }
      
      // 更新 toast 为成功状态
      toast.success('Download started!', {
        id: downloadToast,
        description: `${track.title}.${format}`,
        icon: <ArrowDown className="h-4 w-4 text-blue-500" />
      });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed', {
        description: error instanceof Error ? error.message : 'Unable to download file'
      });
    }
  };

  // WAV下载轮询函数
  const handleWavDownloadWithPolling = async (
    track: LibraryTrack,
    downloadToast: string | number
  ) => {
    const POLL_INTERVAL = 3000; // 每3秒轮询一次
    const MAX_POLL_TIME = 180000; // 最大轮询时间：3分钟
    const startTime = Date.now();
    let lastProgress = 0;

    // 计算进度百分比
    const calculateProgress = (hasWavUrl: boolean, elapsedTime: number): number => {
      // 基于状态和时间计算进度
      if (hasWavUrl) {
        // 回调已收到，WAV URL 存在，进度在 70-90% 之间
        const baseProgress = 70;
        const timeBasedProgress = Math.min(20, (elapsedTime / MAX_POLL_TIME) * 20);
        return Math.min(90, baseProgress + timeBasedProgress);
      } else {
        // 还在等待回调，进度在 10-50% 之间
        const baseProgress = 10;
        const timeBasedProgress = Math.min(40, (elapsedTime / MAX_POLL_TIME) * 40);
        return Math.min(50, baseProgress + timeBasedProgress);
      }
    };

    const pollForWav = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/download-track?trackId=${track.id}&format=wav`);
        const elapsedTime = Date.now() - startTime;
        
        // 检查是否超时
        if (elapsedTime > MAX_POLL_TIME) {
          toast.error('WAV generation timeout', {
            id: downloadToast,
            description: 'WAV conversion is taking longer than expected. Please try again later.'
          });
          return;
        }

        if (response.status === 202) {
          // WAV正在生成中，继续轮询
          const data = await response.json();
          if (data.status === 'generating') {
            // 根据状态计算进度
            const progress = calculateProgress(data.hasWavUrl || false, elapsedTime);
            lastProgress = Math.max(lastProgress, progress); // 确保进度不会倒退
            
            // 显示带进度条的 toast
            const statusText = data.hasWavUrl 
              ? 'Processing WAV file...' 
              : 'Waiting for conversion...';
            
            toast.loading('Generating WAV...', {
              id: downloadToast,
              description: (
                <div className="w-full space-y-2">
                  <p className="text-sm">{statusText}</p>
                  <Progress value={lastProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{Math.round(lastProgress)}%</p>
                </div>
              )
            });
            
            // 继续轮询
            setTimeout(pollForWav, POLL_INTERVAL);
            return;
          } else {
            throw new Error(data.error || data.message || 'WAV generation failed');
          }
        } else if (response.status === 200) {
          // WAV已准备好，显示完成进度
          toast.loading('Finalizing download...', {
            id: downloadToast,
            description: (
              <div className="w-full space-y-2">
                <p className="text-sm">Preparing file for download</p>
                <Progress value={100} className="h-2" />
                <p className="text-xs text-muted-foreground">100%</p>
              </div>
            )
          });

          // 检查响应类型
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            // 可能是fallback模式或错误
            const data = await response.json();
            if (data.fallback && data.wavUrl) {
              // Fallback模式：直接下载原始URL
              const wavResponse = await fetch(data.wavUrl);
              if (!wavResponse.ok) {
                throw new Error(`Failed to fetch WAV: ${wavResponse.status}`);
              }
              const blob = await wavResponse.blob();
              downloadFile(blob, track.title || 'track', 'wav');
              toast.success('Download started!', {
                id: downloadToast,
                description: `${track.title}.wav`,
                icon: <ArrowDown className="h-4 w-4 text-blue-500" />
              });
            } else {
              throw new Error(data.error || 'Download failed');
            }
          } else {
            // 正常模式：直接获取WAV文件
            const blob = await response.blob();
            downloadFile(blob, track.title || 'track', 'wav');
            toast.success('Download started!', {
              id: downloadToast,
              description: `${track.title}.wav`,
              icon: <ArrowDown className="h-4 w-4 text-blue-500" />
            });
          }
        } else {
          // 其他错误状态
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error('WAV download polling error:', error);
        toast.error('WAV download failed', {
          id: downloadToast,
          description: error instanceof Error ? error.message : 'Unable to download WAV file'
        });
      }
    };

    // 开始首次请求
    await pollForWav();
  };

  // 辅助函数：下载文件
  const downloadFile = (blob: Blob, filename: string, format: string) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  };

  const handlePublishClick = (track: LibraryTrack) => {
    setTrackToPublish(track);
    setPublishDialogOpen(true);
  };

  const handlePublishConfirm = async () => {
    if (!trackToPublish || !userId) {
      toast('Please log in to publish tracks');
      setPublishDialogOpen(false);
      setTrackToPublish(null);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to publish tracks');
        setPublishDialogOpen(false);
        setTrackToPublish(null);
        return;
      }

      const response = await fetch('/api/toggle-track-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          trackId: trackToPublish.id,
          isPublished: !trackToPublish.isPublished
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // 通知父组件更新发布状态
        onTrackAction?.(trackToPublish, 'publish_toggle');
        toast(result.message, {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />
        });
      } else {
        toast(result.error || 'Failed to toggle publication', {
          icon: <XCircle className="h-4 w-4 text-red-500" />
        });
      }
    } catch (error) {
      console.error('Error toggling publication:', error);
      toast('Failed to toggle publication', {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
    } finally {
      setPublishDialogOpen(false);
      setTrackToPublish(null);
    }
  };

  const handlePinToggle = async (track: LibraryTrack) => {
    if (!userId) {
      toast('Please log in to pin tracks');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to pin tracks');
        return;
      }

      const response = await fetch('/api/toggle-track-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ trackId: track.id })
      });

      const data = await response.json();

      if (data.success) {
        // 通知父组件更新置顶状态
        if (onTrackAction) {
          onTrackAction(track, 'pin');
        }
        
        toast(data.message, {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />
        });
      } else {
        toast(data.error || 'Failed to toggle pin', {
          icon: <XCircle className="h-4 w-4 text-red-500" />
        });
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast('Failed to toggle pin', {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
    }
  };

  const handleDeleteClick = (track: LibraryTrack) => {
    setTrackToDelete(track);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!trackToDelete) return;

    try {
      // 获取当前session的access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to delete tracks');
        return;
      }

      const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      const data = await response.json();

      if (data.success) {
        // 直接调用父组件的onTrackAction来更新状态，不重复显示对话框
        if (onTrackAction) {
          onTrackAction(trackToDelete, 'delete');
        }
        
        // 发送删除事件到 EventBus
        if (typeof window !== 'undefined') {
          const eventBus = getEventBus();
          eventBus.emit(TRACK_EVENTS.DELETED, {
            trackId: trackToDelete.id
          });
        }
        
        toast('Track deleted successfully', {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />
        });
      } else {
        toast(data.error || 'Failed to delete track');
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      toast('Failed to delete track, please try again');
    } finally {
      setDeleteDialogOpen(false);
      setTrackToDelete(null);
    }
  };

  const handleFavoriteRemoveConfirm = () => {
    if (!trackToRemoveFavorite || !onFavoriteToggle) return;
    onFavoriteToggle(trackToRemoveFavorite);
    setFavoriteDialogOpen(false);
    setTrackToRemoveFavorite(null);
  };

  const handleEditStart = (track: LibraryTrack, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setTrackToEdit(track);
    setEditDialogOpen(true);
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setTrackToEdit(null);
  };

  const handleEditSave = async (data: { title: string; coverImageUrl?: string }) => {
    if (!userId || !trackToEdit) {
      toast('Please log in to edit track info');
      throw new Error('Not authenticated');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to edit track info');
        throw new Error('Authentication required');
      }

      const body: Record<string, any> = {
        trackId: trackToEdit.id,
        title: data.title,
      };

      if (data.coverImageUrl !== undefined) {
        body.coverImageUrl = data.coverImageUrl;
      }

      const response = await fetch('/api/update-track-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update track info');
      }

      const updatedTitle = result.data?.title || data.title;
      const updatedCoverImage = result.data?.coverImageUrl !== undefined
        ? (result.data.coverImageUrl || null)
        : trackToEdit.coverImage || null;

      const updatedTrack = {
        ...trackToEdit,
        title: updatedTitle,
        coverImage: updatedCoverImage,
      };

      onTrackAction?.(updatedTrack as LibraryTrack, 'update');

      toast('Track info updated successfully', {
        icon: <CheckCircle className="h-4 w-4 text-green-500" />
      });

      setEditDialogOpen(false);
      setTrackToEdit(null);
    } catch (error) {
      console.error('Error updating track info:', error);
      toast(error instanceof Error ? error.message : 'Failed to update track info', {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
      throw error;
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Mobile Header - 移动端显示 logo 和品牌 */}
      <div className="flex-shrink-0 md:hidden px-6 py-4 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-bold text-lg flex items-center">
            <Image
              src="/logo.svg"
              alt="MakeRNB Logo"
              width={36}
              height={36}
              className="mr-3"
            />
            MakeRNB
          </Link>
          <div className="flex items-center gap-3">
            {/* Credits Display - Only show when logged in */}
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/10 backdrop-blur-sm rounded-lg">
                <Sparkles className="h-3.5 w-3.5 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {credits === null ? '...' : credits}
                </span>
              </div>
            )}
            {/* User Avatar */}
            {user ? (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <Button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-full"
                >
                  <Avatar className="w-9 h-9">
                    <AvatarImage
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                      alt="User Avatar"
                    />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                      {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
                
                {/* User Menu Dropdown */}
                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-border/30 rounded-lg shadow-lg z-[60]">
                    <div className="flex flex-col gap-1 p-2">
                      <div className="px-3 py-2 border-b border-border/20 mb-2">
                        <div className="text-sm font-medium text-foreground truncate">
                          {user.user_metadata?.full_name || user.email}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {user.email}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTimeout(() => {
                            setUserMenuOpen(false);
                            signOut();
                          }, 50);
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                onClick={() => {}}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground rounded-full flex items-center justify-center"
              >
                <LogIn className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Title - 移动端标题和筛选器在同一行 */}
      <div className="flex-shrink-0 md:hidden px-6 py-4 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Library className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold">Library</h1>
          </div>
          {/* 筛选器 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              title="Favourites"
            >
              <Star className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveFilter('published')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'published'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              title="Published"
            >
              <Send className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveFilter('pinned')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'pinned'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              title="Pinned"
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Row - 移动端搜索框 */}
      <div className="flex-shrink-0 md:hidden px-6 pb-4 bg-background/60 backdrop-blur-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tracks..."
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

      {/* Desktop Header removed as requested */}

      {/* Desktop Filter and Search */}
      <div className="flex-shrink-0 hidden md:block px-6 pt-6 pb-4 bg-transparent">
        <div className="flex flex-row items-center justify-between gap-4">
          {/* Filter Tabs - Studio Style */}
          <div className="bg-muted/30 rounded-xl p-1 flex-shrink-0">
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={`py-2 px-4 text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                  activeFilter === 'all'
                    ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Star className="h-4 w-4 mr-1.5 inline" />
                Favourites
              </button>
              <button
                onClick={() => setActiveFilter('published')}
                className={`py-2 px-4 text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                  activeFilter === 'published'
                    ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Send className="h-4 w-4 mr-1.5 inline" />
                Published
              </button>
              <button
                onClick={() => setActiveFilter('pinned')}
                className={`py-2 px-4 text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                  activeFilter === 'pinned'
                    ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Pin className="h-4 w-4 mr-1.5 inline" />
                Pinned
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title and tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 w-64 bg-muted/30 border border-border/20 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
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

      {/* Content - 正确的flex布局 */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative"
        style={{
          // 🎯 让内容延伸到页面底部，播放器悬浮遮挡
          // 有播放器：播放器高度 + 间距，让播放器悬浮遮挡内容
          // 无播放器：较大padding用于底部留白
          paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 1.5rem)' : '5rem'
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full relative">
            <LoadingState message="Loading your music library" size="lg" vertical />
          </div>
        ) : paginatedTracks.length === 0 ? (
          <div className="flex items-center justify-center h-full relative">
            <div className="text-center max-w-md px-6 py-12">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <Library className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {searchQuery ? 'No matching tracks' : 'No tracks found'}
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {searchQuery 
                  ? `No tracks found for "${searchQuery}". Try a different search term.`
                  : activeFilter === 'published'
                    ? 'No published tracks yet. Publish tracks to make them public.'
                    : activeFilter === 'pinned'
                      ? 'No pinned tracks yet. Pin songs you want to highlight.'
                      : 'No favourites yet. Add songs to your library to see them here.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Table Header - 只在桌面端显示 */}
            <div className="hidden md:block">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-muted-foreground">
                <div className="col-span-1 flex items-center justify-center">
                  <span></span>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <span>Tracks</span>
                </div>
                <div className="col-span-4 flex items-center">
                  <span>Tags</span>
                </div>
                <div 
                  className="col-span-2 flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={handleSortClick}
                >
                  <span>Created Time</span>
                  <div className="relative inline-flex items-center">
                    {sortOrder === null && (
                      <ArrowUpDown className="h-4 w-4" />
                    )}
                    {sortOrder === 'asc' && (
                      <ArrowUp className="h-4 w-4 text-primary" />
                    )}
                    {sortOrder === 'desc' && (
                      <ArrowDownIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <span>Duration</span>
                </div>
                <div className="col-span-2 flex items-center justify-center">
                  <span>Actions</span>
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="space-y-1">
              {paginatedTracks.map((track, index) => (
                <div key={track.id}>
                  {/* Desktop Track Item - 桌面端 */}
                  <div
                    className={`hidden md:grid grid-cols-12 gap-4 px-2 mx-2 transition-all duration-300 group cursor-pointer rounded-lg border ${
                      selectedLibraryTrack === track.id || currentPlayingTrack === track.id
                        ? 'bg-muted/60 border-border/60'
                        : index % 2 === 0 
                          ? 'bg-background hover:bg-muted/30 border-transparent'
                          : 'bg-muted/10 hover:bg-muted/40 border-transparent'
                    }`}
                    onClick={(e) => {
                      handleTrackAction(track, 'select');
                    }}
                  >
                  {/* Play/Pause Button - 桌面端 */}
                  <div className="col-span-1 flex items-center justify-center py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title={currentPlayingTrack === track.id && isPlaying ? 'Pause' : 'Play'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrackAction(track, 'play');
                      }}
                    >
                      {currentPlayingTrack === track.id && isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Cover Image and Play Button - 桌面端统一 */}
                  <div className="col-span-2 flex items-center gap-3 py-2">
                    <TrackCover
                      coverUrl={track.coverR2Url}
                      title={track.title}
                      isPlaying={isPlaying}
                      isCurrentTrack={currentPlayingTrack === track.id}
                      trackId={track.id}
                    />
                    {/* Song Title */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className={`font-semibold text-sm truncate ${
                        selectedLibraryTrack === track.id || currentPlayingTrack === track.id ? 'text-primary' : 'text-foreground group-hover:text-primary'
                      }`}>
                        {track.title}
                      </h3>
                    </div>
                  </div>

                  {/* Tags Column - 标签信息 - 桌面端 */}
                  <div className="col-span-4 flex items-center py-2">
                    <span 
                      className="text-sm text-muted-foreground truncate"
                      title={track.tags || undefined}
                    >
                      {track.tags ? (
                        track.tags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                          <span key={index}>
                            <span>{tag.trim()}</span>
                            {index < array.length - 1 && <span className="mx-1">•</span>}
                          </span>
                        ))
                      ) : '-'}
                      {track.tags && track.tags.length > 70 && '...'}
                    </span>
                  </div>

                  {/* Created Time Column - 桌面端 */}
                  <div className="col-span-2 flex items-center py-2">
                    <span className="text-sm text-muted-foreground truncate">
                      {track.createdAt ? formatDateTime(track.createdAt) : 'Unknown'}
                    </span>
                  </div>

                  {/* Duration Column - 时长 - 桌面端 */}
                  <div className="col-span-1 flex items-center justify-end py-2">
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0))}
                    </span>
                  </div>

                  {/* Actions Column - 操作按钮 */}
                  <div className="col-span-2 flex items-center justify-center py-2">
                    <LibraryTrackActions
                      track={track}
                      isMobile={false}
                      userIsAdmin={userIsAdmin}
                      canDownloadMP3={canDownloadMP3}
                      canDownloadWAV={canDownloadWAV}
                      canDownloadCover={canDownloadCover}
                      onDownload={(format) => handleDownload(track, format)}
                      onPublish={() => handlePublishClick(track)}
                      onShare={() => handleShare(track)}
                      onPin={() => handlePinToggle(track)}
                      onEdit={() => handleEditStart(track)}
                      onDelete={() => handleDeleteClick(track)}
                      onPricingModalOpen={openPricingModal}
                      isCopied={copiedTrackId === track.id}
                    />
                  </div>
                  </div>
                  
                  {/* Mobile Track Item - 移动端 */}
                  <div
                    className={`md:hidden flex items-center gap-4 py-2 mx-3 transition-all duration-300 group cursor-pointer rounded-lg border ${
                      selectedLibraryTrack === track.id || currentPlayingTrack === track.id
                        ? 'bg-muted/60 border-border/60'
                        : 'hover:bg-muted/20 border-transparent'
                    }`}
                    onClick={(e) => {
                      handleTrackAction(track, 'select');
                    }}
                  >
                  {/* Cover Image and Play Button - 移动端 */}
                  <div className="ml-2">
                    <TrackCover
                      coverUrl={track.coverR2Url}
                      title={track.title}
                      isPlaying={isPlaying}
                      isCurrentTrack={currentPlayingTrack === track.id}
                      onPlayPause={() => handleTrackAction(track, 'play')}
                      trackId={track.id}
                    />
                  </div>

                  {/* Song Title and Info - 移动端 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={`font-semibold text-sm truncate ${
                      selectedLibraryTrack === track.id || currentPlayingTrack === track.id ? 'text-primary' : 'text-foreground group-hover:text-primary'
                    }`}>
                      {track.title}
                    </h3>
                    {track.tags && track.tags.trim() !== '' && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* 时长显示在 tags 前面，用竖线分隔 */}
                        {track.duration && track.duration > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDuration(typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0))}
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
                    )}
                    {track.createdAt && (
                      <p className="text-xs text-muted-foreground/60 truncate mt-1">
                        {formatDateTime(track.createdAt)}
                      </p>
                    )}
                  </div>


                  {/* Mobile More Actions Button - 移动端更多按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 mr-2"
                    title="More actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrackForMenu(track);
                      setMobileMenuOpen(true);
                    }}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                  </div>
                </div>
              ))}
              
              {/* Tracks Summary */}
              {paginatedTracks.length > 0 && (
                <div className="flex justify-center items-center py-3 px-4">
                  <div className="text-sm text-muted-foreground font-medium">
                    {(() => {
                      const totalSongs = paginatedTracks.length;
                      const totalDuration = paginatedTracks.reduce((sum, track) => {
                        const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
                        return sum + (isNaN(duration) ? 0 : duration);
                      }, 0);
                      
                      // 底部汇总使用分钟格式
                      const totalMinutes = Math.floor(totalDuration / 60);
                      const durationText = totalMinutes > 0 ? `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}` : '';
                      
                      return `${totalSongs} song${totalSongs > 1 ? 's' : ''}${durationText ? `, ${durationText}` : ''}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Track</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Are you sure you want to delete &quot;{trackToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={(open) => {
        setPublishDialogOpen(open);
        if (!open) {
          setTrackToPublish(null);
        }
      }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">
              {trackToPublish?.isPublished ? 'Unpublish Track' : 'Publish Track'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {trackToPublish?.isPublished
                ? `Unpublish "${trackToPublish?.title}" so it is private again.`
                : `Publish "${trackToPublish?.title}" so it can be shared publicly.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublishConfirm}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {trackToPublish?.isPublished ? 'Unpublish' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Favorite Remove Confirmation Dialog */}
      {/* Edit Music Info Dialog */}
      <EditMusicInfoDialog
        isOpen={editDialogOpen && !!trackToEdit}
        onClose={handleEditCancel}
        onSave={handleEditSave}
        initialTitle={trackToEdit?.title || ''}
        initialCoverImage={trackToEdit?.coverR2Url || trackToEdit?.coverImage || undefined}
      />

      {/* Mobile Bottom Sheet Menu */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 [&>button]:hidden md:hidden bottom-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl rounded-b-none border-0">
          <DialogDescription className="sr-only">
            Track options menu. Use the options below to manage your track.
          </DialogDescription>
          {/* Drag Handle - 拖动指示器 */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any).dragStartY = touch.clientY;
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const dragStartY = (e.currentTarget as any).dragStartY;
              if (dragStartY !== undefined) {
                (e.currentTarget as any).dragCurrentY = touch.clientY;
              }
            }}
            onTouchEnd={(e) => {
              const dragStartY = (e.currentTarget as any).dragStartY;
              const dragCurrentY = (e.currentTarget as any).dragCurrentY;
              
              if (dragStartY !== undefined && dragCurrentY !== undefined) {
                const dragDistance = dragCurrentY - dragStartY;
                // 向下拖动超过100px，关闭面板
                if (dragDistance > 100) {
                  setMobileMenuOpen(false);
                }
              }
              
              // 清除拖动数据
              delete (e.currentTarget as any).dragStartY;
              delete (e.currentTarget as any).dragCurrentY;
            }}
            className="flex items-center justify-center py-3 cursor-pointer active:cursor-grabbing touch-none"
          >
            <div className="w-12 h-1 bg-border/50 rounded-full" />
          </div>

          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle className="flex items-center gap-3 mb-3 text-left">
              {selectedTrackForMenu?.coverR2Url && (
                <SafeImage
                  src={selectedTrackForMenu.coverR2Url}
                  alt={selectedTrackForMenu.title}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-left">
                  <h3 className="text-lg font-semibold truncate">
                    {selectedTrackForMenu?.title}
                  </h3>
                  {selectedTrackForMenu?.duration && selectedTrackForMenu.duration > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(typeof selectedTrackForMenu.duration === 'string' ? parseFloat(selectedTrackForMenu.duration) : (selectedTrackForMenu.duration || 0))}
                      </span>
                    </div>
                  )}
                </div>
                {selectedTrackForMenu?.createdAt && (
                  <div className="text-xs text-muted-foreground/60 mt-1 text-left">
                    {formatDateTime(selectedTrackForMenu.createdAt)}
                  </div>
                )}
              </div>
            </DialogTitle>
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (selectedTrackForMenu?.tags && selectedTrackForMenu.tags.length > 100) {
                  toggleTagsExpansion(selectedTrackForMenu.id);
                }
              }}
              className={`${selectedTrackForMenu?.tags && selectedTrackForMenu.tags.length > 100 ? 'cursor-pointer' : ''}`}
            >
              <div className="text-sm text-foreground/70 mt-2 text-left">
                {selectedTrackForMenu?.tags && selectedTrackForMenu.tags.length > 100 ? (
                  <p className={expandedTags[selectedTrackForMenu.id] ? 'break-words' : 'line-clamp-3 break-words'}>
                    {expandedTags[selectedTrackForMenu.id] 
                      ? selectedTrackForMenu.tags 
                      : selectedTrackForMenu.tags
                    }
                  </p>
                ) : (
                  <p className="break-words">
                    {selectedTrackForMenu?.tags}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 space-y-2">
            {/* Edit Title */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleEditStart(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Pencil className="h-5 w-5" />
                <span className="font-medium">Edit Music Info</span>
              </button>
            )}

            {/* Download MP3 */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  if (!canDownloadMP3) {
                    setMobileMenuOpen(false);
                    openPricingModal();
                    return;
                  }
                  handleDownload(selectedTrackForMenu, 'mp3');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5" />
                  <span className="font-medium">Download MP3</span>
                </div>
                {!canDownloadMP3 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                    Basic
                  </Badge>
                )}
              </button>
            )}

            {/* Download WAV */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  if (!canDownloadWAV) {
                    setMobileMenuOpen(false);
                    openPricingModal();
                    return;
                  }
                  handleDownload(selectedTrackForMenu, 'wav');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5" />
                  <span className="font-medium">Download WAV</span>
                </div>
              </button>
            )}

            {/* Download Cover */}
            {selectedTrackForMenu && (selectedTrackForMenu.coverImage || selectedTrackForMenu.coverR2Url || selectedTrackForMenu.allTracks?.[0]?.coverR2Url) && (
              <button
                onClick={() => {
                  if (!canDownloadCover) {
                    setMobileMenuOpen(false);
                    openPricingModal();
                    return;
                  }
                  handleDownload(selectedTrackForMenu, 'cover');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Download className="h-5 w-5" />
                <div className="flex-1 flex items-center justify-between gap-3">
                  <span className="font-medium">Download PNG</span>
                  {!canDownloadCover && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                      Basic
                    </Badge>
                  )}
                </div>
              </button>
            )}

            {/* Remove from library */}
            {onFavoriteToggle && selectedTrackForMenu && (
              <button
                onClick={() => {
                  setTrackToRemoveFavorite(selectedTrackForMenu);
                  setFavoriteDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Star className="h-5 w-5 text-red-500 fill-current" />
                <span className="font-medium">Remove from library</span>
              </button>
            )}

            {/* Publish/Unpublish */}
            {selectedTrackForMenu && (
              <div 
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={() => {
                  handlePublishClick(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
              >
                <div className="flex items-center gap-3">
                  {selectedTrackForMenu.isPublished ? (
                    <Send className="h-5 w-5" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {selectedTrackForMenu.isPublished ? "Unpublish" : "Publish"}
                  </span>
                </div>
                <Switch
                  checked={selectedTrackForMenu.isPublished}
                  onCheckedChange={() => {
                    handlePublishClick(selectedTrackForMenu);
                    setMobileMenuOpen(false);
                  }}
                />
              </div>
            )}

            {/* Share */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleShare(selectedTrackForMenu).then((success) => {
                    if (success) {
                      setMobileMenuOpen(false);
                    }
                  });
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                {copiedTrackId === selectedTrackForMenu.id ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Share2 className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {copiedTrackId === selectedTrackForMenu.id ? 'Link copied' : 'Copy share link'}
                </span>
              </button>
            )}

            {/* Pin/Unpin - Only for admins */}
            {userIsAdmin && selectedTrackForMenu && (
              <button
                onClick={() => {
                  handlePinToggle(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                {selectedTrackForMenu.isPinned ? (
                  <PinOff className="h-5 w-5" />
                ) : (
                  <Pin className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {selectedTrackForMenu.isPinned ? "Unpin" : "Pin"}
                </span>
              </button>
            )}

            {/* Delete */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleDeleteClick(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-red-600"
              >
                <Trash2 className="h-5 w-5" />
                <span className="font-medium">Delete</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
