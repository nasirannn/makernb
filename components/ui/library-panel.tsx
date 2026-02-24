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
  Trash2,
  Send,
  Share2,
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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useFeaturePermissions } from '@/contexts/FeaturePermissionsContext';
import { usePricingModal } from '@/contexts/PricingModalContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from './progress';
import { LibraryTrack } from '@/types/track';
import { getEventBus, TRACK_EVENTS } from '@/lib/event-bus';
import { formatDuration, formatDateTime } from '@/lib/format-utils';
import { LibraryTrackActions } from './library-track-actions';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EditMusicInfoDialog } from '@/components/ui/edit-music-info-dialog';
import { Mp4BrandingDialog } from '@/components/ui/mp4-branding-dialog';
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { useI18n } from '@/lib/i18n/provider';
import { withLocalePrefix } from '@/lib/i18n/routing';
import { getZIndexClass } from '@/lib/z-index';

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

type LibraryFilter = 'all' | 'favourite' | 'published';

const LibraryListSkeleton = () => (
  <div className="pb-6">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={`library-skeleton-card-${index}`}
          className="studio-panel-card overflow-hidden rounded-3xl p-0"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-3 px-4 py-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-7 w-24 rounded-full" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-full" />
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

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
  const { user, loading: authLoading, signOut } = useAuth();
  const { t, locale } = useI18n();
  const withCurrentLocale = useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const { credits } = useCredits();
  const { openModal: openPricingModal } = usePricingModal();
  const displayName = user?.user_metadata?.nickname || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  
  // 获取权限检查函数
  const { hasPermission } = useFeaturePermissions();
  
  // 检查下载权限
  const canDownloadMP3 = hasPermission('download_mp3_track');
  const canDownloadWAV = hasPermission('download_wav_track');
  const canDownloadMP4 = hasPermission('download_mp4_track');
  const canDownloadCover = hasPermission('download_cover_track');
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<LibraryTrack | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [trackToPublish, setTrackToPublish] = useState<LibraryTrack | null>(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [trackToRemoveFavorite, setTrackToRemoveFavorite] = useState<LibraryTrack | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTrackForMenu, setSelectedTrackForMenu] = useState<LibraryTrack | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  // tags展开状态管理
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  
  // 编辑对话框状态管理
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [trackToEdit, setTrackToEdit] = useState<LibraryTrack | null>(null);
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [mp4DialogOpen, setMp4DialogOpen] = useState(false);
  const [mp4TrackToDownload, setMp4TrackToDownload] = useState<LibraryTrack | null>(null);
  const [mp4Author, setMp4Author] = useState('');
  const [mp4DomainName, setMp4DomainName] = useState('');
  const isLibraryLoading = authLoading || isLoading;

  type Mp4BrandingOptions = {
    author?: string;
    domainName?: string;
    skipPrompt?: boolean;
  };

  const formatModelLabel = (model?: string | null) => {
    if (!model) return null;
    if (model === 'V4_5PLUS') return 'V4.5+';
    if (model === 'V4_5ALL') return 'V4.5ALL';
    if (model === 'V4_5') return 'V4.5';
    if (model === 'V4') return 'V4';
    if (model === 'V5') return 'V5';
    return model.replace('_', '.');
  };
  
  // 切换tags展开状态
  const toggleTagsExpansion = (trackId: string) => {
    setExpandedTags(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };
  
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shareResetTimeout = useRef<number | null>(null);

  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const getAuthHeaders = useCallback((accessToken: string) => ({
    'Authorization': `Bearer ${accessToken}`
  }), []);

  const getJsonAuthHeaders = useCallback((accessToken: string) => ({
    'Content-Type': 'application/json',
    ...getAuthHeaders(accessToken)
  }), [getAuthHeaders]);

  // Filter tracks based on active filter + search query
  const filteredTracks = tracks.filter(track => {
    if (track.isDeleted) return false;

    if (activeFilter === 'favourite' && !track.isFavorited) return false;
    if (activeFilter === 'published' && !track.isPublished) return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      track.title.toLowerCase().includes(query) ||
      (track.tags || '').toLowerCase().includes(query)
    );
  });

  const filterEmptyDescription =
    activeFilter === 'favourite'
      ? t("libraryPage.noFavoritedTracksYet")
      : activeFilter === 'published'
        ? t("libraryPage.noPublishedTracksYet")
        : t("libraryPage.noTracksYet");

  const handleSortClick = () => {
    if (sortOrder === 'desc') {
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder(null);
    } else {
      setSortOrder('desc');
    }
  };

  // 根据排序规则对tracks进行排序
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (sortOrder === null) return 0;

    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
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

  const handleFavoriteRemoveClick = (track: LibraryTrack) => {
    setTrackToRemoveFavorite(track);
    setFavoriteDialogOpen(true);
  };

  const handleFavoriteToggleAction = (track: LibraryTrack) => {
    if (!onFavoriteToggle) return;

    if (track.isFavorited) {
      handleFavoriteRemoveClick(track);
      return;
    }

    onFavoriteToggle(track);
  };

  const handleShare = useCallback(async (track: LibraryTrack): Promise<boolean> => {
    if (!track?.id) {
      toast.error(t("download.trackIdRequired"));
      return false;
    }

    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      toast.error(t("toasts.sharingNotSupported"));
      return false;
    }

    try {
      const shareUrl = `${window.location.origin}${withCurrentLocale(`/track/${track.id}`)}`;
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
      toast.error(t("toasts.failedCopyLink"));
      return false;
    }
  }, [t, withCurrentLocale]);

  const handleDownload = async (
    track: LibraryTrack,
    format: 'mp3' | 'wav' | 'mp4' | 'cover' = 'mp3',
    mp4Options?: Mp4BrandingOptions
  ) => {
    if (format === 'cover' && !canDownloadCover) {
      openPricingModal();
      return;
    }

    if (format === 'mp4' && !mp4Options?.skipPrompt) {
      setMp4TrackToDownload(track);
      if (!mp4Author.trim() && displayName?.trim()) {
        setMp4Author(displayName.trim().slice(0, 50));
      }
      setMp4DialogOpen(true);
      return;
    }

    if (!track.id) {
      toast.error(t("download.trackIdRequired"));
      return;
    }

    try {
      // 显示下载开始提示
      const downloadToast = toast.loading(t("download.downloading"), {
        description: t("download.preparingYourFile"),
        icon: <ArrowDown className="h-4 w-4 text-blue-500" />
      });

      // Cover格式：下载封面图片（通过 API 代理下载，避免 CORS 问题）
      if (format === 'cover') {
        const coverUrl = track.coverImage || track.coverR2Url || track.allTracks?.[0]?.coverR2Url;
        if (!coverUrl) {
          toast.error(t("download.noCoverImageAvailable"), {
            id: downloadToast
          });
          return;
        }

        try {
          const accessToken = await getAccessToken();
          if (!accessToken) {
            toast.error(t("toasts.authRequired"), {
              id: downloadToast,
              description: t("download.pleaseLogInDownloadTracks")
            });
            return;
          }

          // 通过 API 代理下载封面
          const response = await fetch(`/api/download-cover?trackId=${track.id}`, {
            headers: getAuthHeaders(accessToken)
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
          }

          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = `${track.title || t("download.coverDefaultTitle")}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);

          toast.success(t("download.downloadStarted"), {
            id: downloadToast,
            description: `${track.title || t("download.coverDefaultTitle")}.png`,
          });
        } catch (error) {
          console.error('Cover download error:', error);
          toast.error(t("download.downloadFailed"), {
            id: downloadToast,
            description: error instanceof Error ? error.message : t("download.unableDownloadCoverImage")
          });
        }
        return;
      }

      // WAV格式：统一通过下载 API 处理（API 会查询 track_wav_conversions 表）
      if (format === 'wav') {
        await handleWavDownloadWithPolling(track, downloadToast);
        return;
      }

      // MP4格式：统一通过下载 API 处理（API 会查询 track_mp4_generations 表）
      if (format === 'mp4') {
        await handleMp4DownloadWithPolling(track, downloadToast, {
          author: mp4Options?.author,
          domainName: mp4Options?.domainName,
        });
        return;
      }

      // MP3格式直接下载
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error(t("trackDetail.authenticationRequired"));
      }

      const response = await fetch(`/api/download-track?trackId=${track.id}&format=${format}`, {
        headers: getAuthHeaders(accessToken)
      });
      
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
          throw new Error(data.error || t("download.downloadFailed"));
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
      toast.success(t("download.downloadStarted"), {
        id: downloadToast,
        description: `${track.title}.${format}`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast.error(t("download.downloadFailed"), {
        description: error instanceof Error ? error.message : t("download.unableDownloadFile")
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
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error(t("trackDetail.authenticationRequired"));
        }

        const response = await fetch(`/api/download-track?trackId=${track.id}&format=wav`, {
          headers: getAuthHeaders(accessToken)
        });
        const elapsedTime = Date.now() - startTime;
        
        // 检查是否超时
        if (elapsedTime > MAX_POLL_TIME) {
          toast.error(t("download.downloadTimeout"), {
            id: downloadToast,
            description: t("download.wavTakingLong")
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
              ? t("download.processingWavFile")
              : t("download.waitingForConversion");
            
            toast.loading(t("download.generatingWavFile"), {
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
            throw new Error(data.error || data.message || t("download.downloadFailed"));
          }
        } else if (response.status === 200) {
          // WAV已准备好，显示完成进度
          toast.loading(t("download.finalizingDownload"), {
            id: downloadToast,
            description: (
              <div className="w-full space-y-2">
                <p className="text-sm">{t("download.preparingFileForDownload")}</p>
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
              downloadFile(blob, track.title || t("download.trackDefaultTitle"), 'wav');
              toast.success(t("download.downloadStarted"), {
                id: downloadToast,
                description: `${track.title || t("download.trackDefaultTitle")}.wav`,
              });
            } else {
              throw new Error(data.error || t("download.downloadFailed"));
            }
          } else {
            // 正常模式：直接获取WAV文件
            const blob = await response.blob();
            downloadFile(blob, track.title || t("download.trackDefaultTitle"), 'wav');
            toast.success(t("download.downloadStarted"), {
              id: downloadToast,
              description: `${track.title || t("download.trackDefaultTitle")}.wav`,
            });
          }
        } else {
          // 其他错误状态
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error('WAV download polling error:', error);
        toast.error(t("download.wavDownloadFailed"), {
          id: downloadToast,
          description: error instanceof Error ? error.message : t("download.unableDownloadWavFile")
        });
      }
    };

    // 开始首次请求
    await pollForWav();
  };

  // MP4下载轮询函数
  const handleMp4DownloadWithPolling = async (
    track: LibraryTrack,
    downloadToast: string | number,
    options?: {
      author?: string;
      domainName?: string;
    }
  ) => {
    const POLL_INTERVAL = 3000;
    const MAX_POLL_TIME = 180000;
    const startTime = Date.now();

    const mp4Params = new URLSearchParams({
      trackId: track.id,
      format: 'mp4',
    });

    if (options?.author?.trim()) {
      mp4Params.set('author', options.author.trim().slice(0, 50));
    }

    if (options?.domainName?.trim()) {
      mp4Params.set('domainName', options.domainName.trim().slice(0, 50));
    }

    const mp4RequestUrl = `/api/download-track?${mp4Params.toString()}`;

    const pollForMp4 = async (): Promise<void> => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error(t("trackDetail.authenticationRequired"));
        }

        const response = await fetch(mp4RequestUrl, {
          headers: getAuthHeaders(accessToken)
        });
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime > MAX_POLL_TIME) {
          toast.error(t("download.mp4GenerationTimeout"), {
            id: downloadToast,
            description: t("download.mp4TakingLong")
          });
          return;
        }

        if (response.status === 202) {
          const data = await response.json();
          if (data.status === 'generating') {
            toast.loading(t("download.generatingMp4Video"), {
              id: downloadToast,
              description: t("download.generatingMp4Description")
            });
            setTimeout(pollForMp4, POLL_INTERVAL);
            return;
          }
          throw new Error(data.error || data.message || t("download.mp4GenerationFailed"));
        }

        if (response.status === 200) {
          const contentType = response.headers.get('content-type');

          if (contentType?.includes('application/json')) {
            const data = await response.json();
            if (data.fallback && data.videoUrl) {
              const videoResponse = await fetch(data.videoUrl);
              if (!videoResponse.ok) {
                throw new Error(`Failed to fetch MP4: ${videoResponse.status}`);
              }
              const blob = await videoResponse.blob();
              downloadFile(blob, track.title || t("download.trackDefaultTitle"), 'mp4');
              toast.success(t("download.downloadStarted"), {
                id: downloadToast,
                description: `${track.title || t("download.trackDefaultTitle")}.mp4`,
              });
              return;
            }
            throw new Error(data.error || t("download.downloadFailed"));
          }

          const blob = await response.blob();
          downloadFile(blob, track.title || t("download.trackDefaultTitle"), 'mp4');
          toast.success(t("download.downloadStarted"), {
            id: downloadToast,
            description: `${track.title || t("download.trackDefaultTitle")}.mp4`,
          });
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      } catch (error) {
        console.error('MP4 download polling error:', error);
        toast.error(t("download.mp4DownloadFailed"), {
          id: downloadToast,
          description: error instanceof Error ? error.message : t("download.unableDownloadMp4File")
        });
      }
    };

    await pollForMp4();
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
      toast(t("toasts.pleaseLogInPublishTracks"));
      setPublishDialogOpen(false);
      setTrackToPublish(null);
      return;
    }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast(t("toasts.pleaseLogInPublishTracks"));
        setPublishDialogOpen(false);
        setTrackToPublish(null);
        return;
      }

      const response = await fetch('/api/toggle-track-publish', {
        method: 'POST',
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify({
          trackId: trackToPublish.id,
          isPublished: !trackToPublish.isPublished
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // 通知父组件更新发布状态
        onTrackAction?.(trackToPublish, 'publish_toggle');
        toast.success(
          trackToPublish.isPublished
            ? t("toasts.trackUnpublishedSuccessfully")
            : t("toasts.trackPublishedSuccessfully")
        );
      } else {
        toast(result.error || t("toasts.failedTogglePublication"), {
          icon: <XCircle className="h-4 w-4 text-red-500" />
        });
      }
    } catch (error) {
      console.error('Error toggling publication:', error);
      toast(t("toasts.failedTogglePublication"), {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
    } finally {
      setPublishDialogOpen(false);
      setTrackToPublish(null);
    }
  };


  const handleDeleteClick = (track: LibraryTrack) => {
    setTrackToDelete(track);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!trackToDelete) return;

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast(t("toasts.pleaseLogInDeleteTracks"));
        return;
      }

      const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
        method: 'DELETE',
        headers: getJsonAuthHeaders(accessToken),
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
        
        toast.success(t("toasts.trackDeletedSuccessfully"));
      } else {
        toast(data.error || t("toasts.failedDeleteTrack"));
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      toast(t("toasts.failedDeleteTrackTryAgain"));
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
      toast(t("toasts.pleaseLogInEditTrackInfo"));
      throw new Error(t("trackDetail.authenticationRequired"));
    }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast(t("toasts.pleaseLogInEditTrackInfo"));
        throw new Error(t("trackDetail.authenticationRequired"));
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
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || t("toasts.failedUpdateMusicInfo"));
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

      toast.success(t("toasts.musicInfoUpdatedSuccessfully"));

      setEditDialogOpen(false);
      setTrackToEdit(null);
    } catch (error) {
      console.error('Error updating track info:', error);
      toast(error instanceof Error ? error.message : t("toasts.failedUpdateMusicInfo"), {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
      throw error;
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Mobile Header - 移动端显示 logo 和品牌 */}
      <div className="app-card-muted app-hairline flex-shrink-0 md:hidden px-6 py-4 border-0 border-b-0">
        <div className="flex items-center justify-between gap-3">
          <Link href={withCurrentLocale("/")} className="font-bold text-lg flex items-center">
            <Image
              src="/logo.svg"
              alt={t("common.brandLogo")}
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
                      alt={t("common.userAvatar")}
                    />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                      {displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
                
                {/* User Menu Dropdown */}
                {userMenuOpen && (
                  <div className={`absolute top-full right-0 mt-2 w-48 bg-background border border-border/30 rounded-lg shadow-lg ${getZIndexClass('DROPDOWN')}`}>
                    <div className="flex flex-col gap-1 p-2">
                      <div className="px-3 py-2 border-b border-border/20 mb-2">
                        <div className="text-sm font-medium text-foreground truncate">
                          {displayName || user.email}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 truncate">
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
                        {t("common.signOut")}
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

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 md:py-6 bg-background/60 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="app-card-muted inline-flex items-center rounded-2xl p-1 gap-1 bg-foreground/5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`h-10 px-4 text-xs md:text-sm font-medium transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  activeFilter === 'all'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {t("libraryPage.filterAll")}
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('favourite')}
                className={`h-10 px-4 text-xs md:text-sm font-medium transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  activeFilter === 'favourite'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {t("libraryPage.filterFavourite")}
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('published')}
                className={`h-10 px-4 text-xs md:text-sm font-medium transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  activeFilter === 'published'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {t("libraryPage.filterPublished")}
              </button>
            </div>
          </div>

          <div className="flex items-center w-full md:w-auto md:justify-end gap-2">
            <button
              type="button"
              onClick={handleSortClick}
              className="app-card-muted inline-flex h-12 items-center justify-center gap-1 rounded-2xl bg-foreground/5 px-3 text-foreground/75 shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors hover:text-foreground dark:bg-white/10"
              aria-label={t("libraryPage.createdTimeColumn")}
              title={t("libraryPage.createdTimeColumn")}
            >
              <span className="hidden md:inline text-sm font-medium">{t("libraryPage.createdTimeColumn")}</span>
              {sortOrder === null ? (
                <ArrowUpDown className="h-4 w-4" />
              ) : sortOrder === 'asc' ? (
                <ArrowUp className="h-4 w-4 text-primary" />
              ) : (
                <ArrowDownIcon className="h-4 w-4 text-primary" />
              )}
            </button>

            <div className="relative w-full md:w-auto">
              <div className="app-card-muted rounded-2xl p-1 bg-foreground/5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/55" />
                  <input
                    type="text"
                    placeholder={t("libraryPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-72 h-10 rounded-2xl bg-transparent pl-11 pr-10 text-sm text-foreground placeholder:text-foreground/40 transition-colors focus:bg-transparent focus:outline-none border-0"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/45 hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
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
          paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 0.5rem)' : '5rem'
        }}
      >
        <div className="relative px-3 md:px-6">
          {isLibraryLoading ? (
            <LibraryListSkeleton />
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
                  {searchQuery ? t("libraryPage.noMatchingTracks") : t("libraryPage.noTracksFound")}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {searchQuery 
                    ? t("libraryPage.noTracksForQuery", { query: searchQuery })
                    : filterEmptyDescription
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-1">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {paginatedTracks.map((track) => {
                  const isActive = selectedLibraryTrack === track.id || currentPlayingTrack === track.id;
                  const rawDuration = typeof track.duration === 'string'
                    ? parseFloat(track.duration)
                    : (track.duration || 0);
                  const normalizedDuration = Number.isFinite(rawDuration) ? rawDuration : 0;
                  const coverUrl = track.coverR2Url || track.coverImage || track.allTracks?.[0]?.coverR2Url || '';
                  const hasCover = Boolean(coverUrl);
                  const isPlayingTrack = currentPlayingTrack === track.id && isPlaying;
                  const modelLabel = formatModelLabel(track.model);

                  return (
                    <article
                      key={track.id}
                      className={`studio-panel-card group overflow-hidden rounded-3xl p-0 cursor-pointer ${
                        isActive
                          ? 'md:-translate-y-0.5 shadow-[0_18px_42px_rgba(2,8,23,0.16)] dark:shadow-[0_26px_54px_rgba(0,0,0,0.52)]'
                          : 'transform-gpu transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none md:hover:-translate-y-1 md:hover:shadow-[0_20px_45px_rgba(2,8,23,0.18)] dark:md:hover:shadow-[0_28px_56px_rgba(0,0,0,0.56)]'
                      }`}
                      onClick={() => handleTrackAction(track, 'select')}
                    >
                      <div className="relative aspect-square overflow-hidden">
                        {coverUrl ? (
                          <SafeImage
                            src={coverUrl}
                            alt={track.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            fallbackContent={
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-foreground/10">
                                <Library className="h-12 w-12 text-foreground/35" strokeWidth={1.6} />
                              </div>
                            }
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-foreground/10">
                            <Library className="h-12 w-12 text-foreground/35" strokeWidth={1.6} />
                          </div>
                        )}

                        <div
                          className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                            isActive
                              ? 'bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-100'
                              : 'bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80 group-hover:opacity-100'
                          }`}
                        />

                        {isPlayingTrack && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`absolute inset-0 h-auto w-auto flex items-center justify-center p-0 transition-opacity duration-300 md:pointer-events-none ${
                              hasCover ? 'bg-black/20' : 'bg-white/15 dark:bg-black/20'
                            } md:group-hover:opacity-0 md:group-focus-within:opacity-0`}
                            title={t("trackActions.pause")}
                            aria-label={t("trackActions.pause")}
                            disabled={!track.audioUrl}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!track.audioUrl) return;
                              handleTrackAction(track, 'play');
                            }}
                          >
                            <CustomAudioWaveIndicator
                              isPlaying={isPlaying}
                              size="lg"
                              className={hasCover ? 'text-white' : 'text-foreground/80 dark:text-white/85'}
                            />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          className={`absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/45 p-0 text-white backdrop-blur-sm transition-[opacity,transform,background-color] duration-200 hover:bg-black/65 hover:text-white focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-45 md:scale-95 md:opacity-0 md:pointer-events-none md:group-hover:scale-100 md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:scale-100 md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto ${
                            isPlayingTrack
                              ? 'opacity-0 pointer-events-none scale-95'
                              : 'opacity-100 pointer-events-auto scale-100'
                          }`}
                          title={currentPlayingTrack === track.id && isPlaying ? t("trackActions.pause") : t("trackActions.play")}
                          disabled={!track.audioUrl}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!track.audioUrl) return;
                            handleTrackAction(track, 'play');
                          }}
                        >
                          {currentPlayingTrack === track.id && isPlaying ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>

                        <div className="absolute right-3 top-3 flex items-center gap-1.5">
                          {track.isFavorited && (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-red-400 backdrop-blur-sm">
                              <Star className="h-3.5 w-3.5 fill-current" />
                            </span>
                          )}
                          {track.isPublished && (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-emerald-300 backdrop-blur-sm">
                              <Send className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>

                        {normalizedDuration > 0 && (
                          <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm md:hidden">
                            {formatDuration(normalizedDuration)}
                          </span>
                        )}
                      </div>

                      <div className="relative bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(246,248,252,0.955)_100%)] px-3.5 pb-3.5 pt-3 shadow-[inset_0_14px_24px_-20px_rgba(15,23,42,0.45)] md:px-4 md:pb-4 md:pt-3.5 dark:bg-[linear-gradient(180deg,rgba(24,26,36,0.96)_0%,rgba(15,17,25,0.94)_100%)] dark:shadow-none">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className={`line-clamp-1 text-sm font-semibold md:text-base ${
                            isActive ? 'text-primary' : 'text-foreground'
                          }`}>
                            {track.title}
                          </h3>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="md:hidden h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                            title={t("trackActions.moreActions")}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTrackForMenu(track);
                              setMobileMenuOpen(true);
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {modelLabel && (
                            <span className="inline-flex shrink-0 items-center rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-medium text-foreground/75 dark:bg-white/10 dark:text-white/70">
                              {modelLabel}
                            </span>
                          )}
                          <span className="truncate">
                            {track.createdAt ? formatDateTime(track.createdAt) : t("libraryPage.unknown")}
                          </span>
                        </div>

                        <p
                          className="mt-2 min-h-[2.5rem] text-sm leading-5 text-muted-foreground/90 line-clamp-2 break-words"
                          title={track.tags || undefined}
                        >
                          {track.tags && track.tags.trim() !== '' ? track.tags : '-'}
                        </p>

                        <div className="mt-3 hidden md:flex items-center justify-between gap-3">
                          {normalizedDuration > 0 ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDuration(normalizedDuration)}
                            </span>
                          ) : (
                            <span />
                          )}
                          <LibraryTrackActions
                            track={track}
                            isMobile={false}
                            canDownloadMP3={canDownloadMP3}
                            canDownloadWAV={canDownloadWAV}
                            canDownloadCover={canDownloadCover}
                            canDownloadMP4={canDownloadMP4}
                            onDownload={(format) => handleDownload(track, format)}
                            onFavorite={() => handleFavoriteToggleAction(track)}
                            onShare={() => handleShare(track)}
                            onPublish={() => handlePublishClick(track)}
                            onEdit={() => handleEditStart(track)}
                            onDelete={() => handleDeleteClick(track)}
                            onPricingModalOpen={openPricingModal}
                            isCopied={copiedTrackId === track.id}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

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
                      const durationText = totalMinutes > 0
                        ? t("libraryPage.minutesSummary", { minutes: totalMinutes, mSuffix: totalMinutes > 1 ? "s" : "" })
                        : '';
                      
                      return t("libraryPage.songsSummary", {
                        songs: totalSongs,
                        sSuffix: totalSongs > 1 ? "s" : "",
                        durationPart: durationText,
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">{t("studioTracks.deleteTrackTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base whitespace-nowrap">
              {t("studioTracks.deleteTrackDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.confirm")}
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
              {trackToPublish?.isPublished ? t("libraryPage.unpublishTrackTitle") : t("libraryPage.publishTrackTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {trackToPublish?.isPublished
                ? t("libraryPage.unpublishTrackDescription", { title: trackToPublish?.title || t("download.trackDefaultTitle") })
                : t("libraryPage.publishTrackDescription", { title: trackToPublish?.title || t("download.trackDefaultTitle") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublishConfirm}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {trackToPublish?.isPublished ? t("trackActions.unpublish") : t("trackActions.publish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Favorite Remove Confirmation Dialog */}
      <AlertDialog
        open={favoriteDialogOpen}
        onOpenChange={(open) => {
          setFavoriteDialogOpen(open);
          if (!open) {
            setTrackToRemoveFavorite(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">{t("trackActions.removeFromLibrary")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {t("libraryPage.removeFromLibraryDescription", {
                title: trackToRemoveFavorite?.title || t("download.trackDefaultTitle"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFavoriteRemoveConfirm}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("featurePanel.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Music Info Dialog */}
      <EditMusicInfoDialog
        isOpen={editDialogOpen && !!trackToEdit}
        onClose={handleEditCancel}
        onSave={handleEditSave}
        initialTitle={trackToEdit?.title || ''}
        initialCoverImage={trackToEdit?.coverR2Url || trackToEdit?.coverImage || undefined}
        trackId={trackToEdit?.id}
      />

      <Mp4BrandingDialog
        open={mp4DialogOpen}
        onOpenChange={(open) => {
          setMp4DialogOpen(open);
          if (!open) {
            setMp4TrackToDownload(null);
          }
        }}
        author={mp4Author}
        domainName={mp4DomainName}
        onAuthorChange={setMp4Author}
        onDomainNameChange={setMp4DomainName}
        onGenerate={() => {
          if (!mp4TrackToDownload) {
            setMp4DialogOpen(false);
            return;
          }

          const targetTrack = mp4TrackToDownload;
          const authorValue = mp4Author.trim();
          const domainValue = mp4DomainName.trim();

          setMp4DialogOpen(false);
          setMp4TrackToDownload(null);

          handleDownload(targetTrack, 'mp4', {
            skipPrompt: true,
            author: authorValue || undefined,
            domainName: domainValue || undefined,
          });
        }}
      />

      {/* Mobile Bottom Sheet Menu */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 [&>button]:hidden md:hidden bottom-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl rounded-b-none border-0">
          <DialogDescription className="sr-only">
            {t("libraryPage.trackOptionsDescription")}
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
                  <div className="text-sm text-muted-foreground/60 mt-1 text-left">
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
                <span className="font-medium">{t("trackActions.editTitleAndCover")}</span>
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
                  <span className="font-medium">{t("trackActions.pngCoverArt")}</span>
                  {!canDownloadCover && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                      {t("libraryPage.basicBadge")}
                    </Badge>
                  )}
                </div>
              </button>
            )}

            {selectedTrackForMenu && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground uppercase">
                {t("trackActions.advancedFeatures")}
              </div>
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
                  <span className="font-medium">{t("trackActions.mp3Song")}</span>
                </div>
                {!canDownloadMP3 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                    {t("libraryPage.basicBadge")}
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
                  <span className="font-medium">{t("trackActions.wavHighQualitySong")}</span>
                </div>
              </button>
            )}

            {/* Download MP4 */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  if (!canDownloadMP4) {
                    setMobileMenuOpen(false);
                    openPricingModal();
                    return;
                  }
                  handleDownload(selectedTrackForMenu, 'mp4');
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5" />
                  <span className="font-medium">{t("trackActions.mp4MusicVideo")}</span>
                </div>
                {!canDownloadMP4 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                    {t("libraryPage.hobbyBadge")}
                  </Badge>
                )}
              </button>
            )}

            {/* Add/Remove from library */}
            {onFavoriteToggle && selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleFavoriteToggleAction(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Star className={`h-5 w-5 ${selectedTrackForMenu.isFavorited ? 'text-red-500 fill-current' : ''}`} />
                <span className="font-medium">
                  {selectedTrackForMenu.isFavorited ? t("trackActions.removeFromLibrary") : t("trackActions.addToLibrary")}
                </span>
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
                  <Send
                    className={`h-5 w-5 ${
                      selectedTrackForMenu.isPublished ? 'text-green-500' : ''
                    }`}
                  />
                  <span className="font-medium">
                    {selectedTrackForMenu.isPublished ? t("trackActions.unpublish") : t("trackActions.publish")}
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
                  {copiedTrackId === selectedTrackForMenu.id ? t("trackActions.linkCopied") : t("trackActions.copyShareLink")}
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
                <span className="font-medium">{t("trackActions.delete")}</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
