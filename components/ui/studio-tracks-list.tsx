"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Image from "next/image";
import { ArrowDownUp, Blend, Check, Disc3, Expand, Mic, Music, Music2, Search, ThumbsDown, X, Wand2, Filter } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from "@/lib/supabase";
import { toast } from 'sonner';
import { LibraryTrack } from '@/types/track';
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { VocalRemovalProgressDialog } from '@/features/vocal-tools/components/vocal-removal-progress-dialog';
import { ReplaceSectionDialog, ReplaceSectionParams } from '@/features/music-upload/components/replace-section-dialog';
import { CLIENT_VOCAL_SEPARATION_CREDITS } from '@/lib/credits-config';
import { useVocalRemovalManager } from '@/features/vocal-tools/hooks/use-vocal-removal-manager';
import { TrackItem } from './track-item';
import { formatDurationInMinutes } from '@/lib/format-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";
import type { MusicType } from "@/types/music";
import type { ExtendSourceTrack } from "@/types/extend-track-source";
import { MusicPersonaDialogs } from "@/components/ui/music-persona-dialogs";
import { useStudioPersonaManager } from "@/hooks/use-studio-persona-manager";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  tags: string;
  prompt: string;
  isInstrumental: boolean;
  status: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  lyricsContent?: string;
  allTracks: LibraryTrack[];
  totalDuration: number;
  errorInfo?: any;
}

interface StudioTracksListProps {
  userTracks: MusicGeneration[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  summary?: { totalTracks: number; totalDuration: number };
  onTrackSelect?: (trackId: string) => void;
  onTrackPreview?: (track: any) => void;
  onTrackPlay?: (track: LibraryTrack, music: MusicGeneration) => void;
  selectedTrack?: string | null;
  generatedTracks?: any[];
  onGeneratedTrackSelect?: (trackId: string) => void;
  onDownload?: (track: LibraryTrack, music: MusicGeneration, format?: 'mp3' | 'wav' | 'mp4' | 'cover') => void;
  onFavoriteToggle?: (track: LibraryTrack, music: MusicGeneration) => void;
  onLikeToggle?: (track: LibraryTrack, music: MusicGeneration) => void;
  onDislikeToggle?: (track: LibraryTrack, music: MusicGeneration) => void;
  onDelete?: (track: LibraryTrack, music: MusicGeneration) => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  onEditMusicInfo?: (trackId: string, data: { title: string; coverImageUrl?: string }) => Promise<void>;
  onExtendTrackSelect?: (track: ExtendSourceTrack) => void;
  hasPlayer?: boolean;
  // Extend Music 相关函数（从父组件传递，确保使用同一个 hook 实例）
  extendMusicStartPolling?: (
    taskId: string,
    musicId: string,
    title: string,
    genre?: string,
    tags?: string,
    initialTracks?: any[] // 初始占位 tracks
  ) => void;
  onCreate?: () => void;
}

// 稳定的 no-op 函数，用于替代未提供的 extendMusicStartPolling
const noOpExtendMusicPolling = () => {};

type TrackTypeFilter =
  | "all"
  | "music-generator"
  | "music-extender"
  | "music-cover"
  | "mashup"
  | "add-vocal"
  | "add-melody"
  | "disliked";

const TRACK_TYPE_FILTER_OPTIONS: Array<{
  value: TrackTypeFilter;
  label: string;
  musicTypes: MusicType[];
  icon: React.ElementType;
}> = [
  { value: "all", label: "All", musicTypes: [], icon: Filter },
  { value: "music-generator", label: "Generator", musicTypes: ["generated"], icon: Music2 },
  { value: "music-extender", label: "Extender", musicTypes: ["upload_extend", "extended"], icon: Expand },
  { value: "music-cover", label: "Cover", musicTypes: ["upload_cover"], icon: Disc3 },
  { value: "mashup", label: "Mashup", musicTypes: ["upload_mashup"], icon: Blend },
  { value: "add-vocal", label: "Vocal", musicTypes: ["upload_vocal"], icon: Mic },
  { value: "add-melody", label: "Melody", musicTypes: ["upload_melody"], icon: Music },
  { value: "disliked", label: "Disliked", musicTypes: [], icon: ThumbsDown },
];

const TrackListSkeleton = ({ count = 5, className = '' }: { count?: number; className?: string }) => (
  <div className={`space-y-3 pb-6 ${className}`.trim()}>
    {[...Array(count)].map((_, index) => (
      <div key={index} className="rounded-2xl px-2.5 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[80px] w-[80px] rounded-md flex-shrink-0" />

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-[58%]" />
              <Skeleton className="ml-auto h-4 w-10 rounded-full" />
            </div>
            <Skeleton className="h-3 w-[76%]" />
            <Skeleton className="h-3 w-[62%]" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const StudioTracksList: React.FC<StudioTracksListProps> = React.memo(function StudioTracksList({
  userTracks,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  summary,
  onTrackSelect,
  onTrackPreview,
  onTrackPlay,
  selectedTrack,
  generatedTracks = [],
  onGeneratedTrackSelect,
  onDownload,
  onFavoriteToggle,
  onLikeToggle,
  onDislikeToggle,
  onDelete,
  onEditTitle,
  onEditMusicInfo,
  onExtendTrackSelect,
  hasPlayer = false,
  extendMusicStartPolling,
  onCreate,
}) {
  
  const { user } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const { openModal: openPricingModal } = usePricingModal();
  const globalAudioState = useAudioPlayingState();
  const { hasPermission } = useFeaturePermissions();

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const loadMoreTriggerRef = React.useRef<HTMLDivElement | null>(null);
  
  // 权限检查
  const canDownloadMP3 = hasPermission('download_mp3_track');
  const canDownloadWAV = hasPermission('download_wav_track');
  const canDownloadMP4 = hasPermission('download_mp4_track');
  const canDownloadCover = hasPermission('download_cover_track');
  const canVocalRemoval = hasPermission('vocal_removal_studio');
  const canExtendMusic = hasPermission('extend_music');
  const canReplaceSection = hasPermission('replace_section');
  const canCreatePersona = hasPermission('generate_persona');
  
  // UI 状态
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createdAtSortOrder, setCreatedAtSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<TrackTypeFilter>('all');
  const selectedTypeFilterOption = useMemo(
    () => TRACK_TYPE_FILTER_OPTIONS.find((option) => option.value === selectedTypeFilter) ?? TRACK_TYPE_FILTER_OPTIONS[0],
    [selectedTypeFilter]
  );
  const selectedTypeFilterMusicTypes = selectedTypeFilterOption.musicTypes;
  const hasActiveTypeFilter = selectedTypeFilter !== 'all';
  
  // Vocal Removal 管理
  const vocalRemovalManager = useVocalRemovalManager();
  
  // Extend Music 函数（从父组件传递，确保使用同一个 hook 实例）
  // 使用 useMemo 稳定值，避免每次渲染创建新函数
  const startExtendMusicPolling = useMemo(
    () => extendMusicStartPolling || noOpExtendMusicPolling,
    [extendMusicStartPolling]
  );
  
  // Vocal Removal 弹窗状态（统一结果弹窗：checking -> ready -> processing -> completed/error）
  const [showVocalRemovalProgressDialog, setShowVocalRemovalProgressDialog] = useState(false);
  const [currentProcessingTrackId, setCurrentProcessingTrackId] = useState<string | null>(null);
  const [currentProcessingTrackTitle, setCurrentProcessingTrackTitle] = useState<string>('');

  // Replace Section 弹窗状态
  const [showReplaceSectionDialog, setShowReplaceSectionDialog] = useState(false);
  const [pendingReplaceSectionTrackId, setPendingReplaceSectionTrackId] = useState<string | null>(null);
  const [pendingReplaceSectionTrackTitle, setPendingReplaceSectionTrackTitle] = useState<string>('');
  const [pendingReplaceSectionTrackDuration, setPendingReplaceSectionTrackDuration] = useState<number>(120);
  const [pendingReplaceSectionOriginalStyle, setPendingReplaceSectionOriginalStyle] = useState<string>('');
  const [pendingReplaceSectionAudioUrl, setPendingReplaceSectionAudioUrl] = useState<string>('');
  
  
  // 删除确认弹窗状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<{ id: string; title: string } | null>(null);
  const [publishStatusOverrides, setPublishStatusOverrides] = useState<Record<string, boolean>>({});
  const [publishingTrackIds, setPublishingTrackIds] = useState<string[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState('');

  const {
    isPersonaDialogOpen,
    setIsPersonaDialogOpen,
    isPersonaLoading,
    personaOptions,
    isSelectMusicOpen,
    setIsSelectMusicOpen,
    isSelectMusicLoading,
    selectMusicOptions,
    selectedMusicTrackId,
    pendingMusicTrackId,
    setPendingMusicTrackId,
    pendingMusicTrack,
    pendingMusicTrackUnavailableReason,
    openSelectMusicDialog,
    closeSelectMusicDialog,
    confirmSelectMusicDialog,
    isCreatePersonaDialogOpen,
    setIsCreatePersonaDialogOpen,
    selectedMusicTrack,
    createPersonaName,
    setCreatePersonaName,
    createPersonaDescription,
    setCreatePersonaDescription,
    closeCreatePersonaDialog,
    handleCreatePersona,
    isCreatingPersona,
    getPersonaTrackUnavailableReason,
    formatTrackCreatedAt,
    deletingPersonaRecordId,
    handleDeletePersona,
    openCreatePersonaDialog,
  } = useStudioPersonaManager({
    user,
    selectedPersonaId,
    setSelectedPersonaId,
  });
  
  // 将所有 tracks 展平
  const allTracks = userTracks.flatMap(music => {
    if (!music.allTracks || !Array.isArray(music.allTracks)) {
      return [];
    }
    return music.allTracks
      .filter(track => !(track.isDeleted ?? false))
      .map(track => {
        const trackErrorMessage = (track as { errorMessage?: string }).errorMessage;
        return ({
        ...track,
        isFavorited: track.isFavorited ?? false,
        isPublished: publishStatusOverrides[track.id] ?? Boolean(track.isPublished),
        coverR2Url: track.coverR2Url ?? undefined,
        musicTitle: music.title,
        musicTags: music.tags,
        musicGenre: music.genre,
        musicStatus: music.status,
        musicGeneration: music,
        isError: !track.audioUrl || track.audioUrl.trim() === '',
        errorMessage: (!track.audioUrl || track.audioUrl.trim() === '')
          ? (music.errorInfo?.errorMessage || trackErrorMessage || 'Audio file missing')
          : undefined
      });
      });
  });

  // 搜索过滤
  const filterTracks = useCallback((tracks: any[]) => {
    const visibleTracks = tracks.filter((track) => {
      const isDislikedTrack = Boolean(track.isDisliked ?? track.is_disliked ?? false);

      if (selectedTypeFilter === "disliked") {
        return isDislikedTrack;
      }

      if (isDislikedTrack) {
        return false;
      }

      if (!hasActiveTypeFilter) {
        return true;
      }

      const normalizedType = (track?.musicType ?? 'generated') as MusicType;
      return selectedTypeFilterMusicTypes.includes(normalizedType);
    });

    if (!searchQuery.trim()) return visibleTracks;
    const query = searchQuery.toLowerCase();
    return visibleTracks.filter(track => {
      if (track.title?.toLowerCase().includes(query)) return true;
      if (track.musicTitle?.toLowerCase().includes(query)) return true;
      if (track.tags?.toLowerCase().includes(query)) return true;
      if (track.musicTags?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [searchQuery, hasActiveTypeFilter, selectedTypeFilter, selectedTypeFilterMusicTypes]);

  // 格式化 generatedTracks（包含延长音乐），使其与 allTracks 格式一致
  const stableGeneratedTracks = React.useMemo(() => {
    const tracks = generatedTracks || [];
    return tracks.map(track => ({
      ...track,
      id: track.id,
      title: track.title,
      audioUrl: track.audioUrl || '',
      streamAudioUrl: track.streamAudioUrl || '',
      duration: track.duration || 0,
      coverImage: track.coverImage,
      coverR2Url: track.coverImage,
      tags: track.tags || '',
      genre: track.genre || '',
      lyrics: track.lyrics || '',
      isFavorited: false,
      isPublished: publishStatusOverrides[track.id] ?? Boolean(track.isPublished),
      isDisliked: track.isDisliked ?? track.is_disliked ?? false,
      musicTitle: track.title,
      musicTags: track.tags || '',
      musicGenre: track.genre || '',
      musicStatus: track.isError ? 'error' : (track.isGenerating ? 'generating' : (track.isCompleted ? 'complete' : 'generating')),
      musicGeneration: {
        id: track.generationId,
        title: track.title,
        genre: track.genre || '',
        tags: track.tags || '',
        status: track.isError ? 'error' : (track.isGenerating ? 'generating' : (track.isCompleted ? 'complete' : 'generating')),
        model: track.model,
      } as MusicGeneration,
      isGenerating: track.isGenerating,
      isPlaceholder: track.isPlaceholder,
      isExtension: track.isExtension,
      isError: track.isError || false,
      errorMessage: track.errorMessage,
    }));
  }, [generatedTracks, publishStatusOverrides]);

  // 合并所有 tracks：生成音乐（已包含延长音乐）+ 用户 tracks
  // 注意：延长音乐已通过 studio.tsx 合并到 generatedTracks 中
  // 去重：基于track.id去重，优先保留generatedTracks中的track（因为它有最新的生成状态）
  const allTracksCombined = React.useMemo(() => {
    // 创建一个Map来存储track.id -> track的映射
    const trackMap = new Map();

    // 先添加stableGeneratedTracks（优先级更高，因为是正在生成的）
    stableGeneratedTracks.forEach(track => {
      trackMap.set(track.id, track);
    });

    // 再添加allTracks（只添加不存在的track）
    allTracks.forEach(track => {
      if (!trackMap.has(track.id)) {
        trackMap.set(track.id, track);
      }
    });

    // 转换为数组
    return Array.from(trackMap.values());
  }, [stableGeneratedTracks, allTracks]);

  const currentTracks = filterTracks(allTracksCombined);

  // 统一的 track 查找函数（从所有 tracks 中查找）
  const findTrackById = useCallback((trackId: string) => {
    return allTracksCombined.find(t => t.id === trackId);
  }, [allTracksCombined]);

  // 平铺布局逻辑：所有音乐平铺显示，并添加来源信息
  const flatTracks = React.useMemo(() => {
    // 为所有音乐添加来源信息
    const tracksWithSource = currentTracks.map(track => {
      // 如果有原始音乐ID，查找原始音乐的标题
      if (track.originalTrackId) {
        const originalTrack = allTracksCombined.find(t => t.id === track.originalTrackId);
        return {
          ...track,
          originalTrackTitle: originalTrack?.title || 'Unknown Track',
        };
      }
      return track;
    });

    // 按创建时间排序（默认最新在前）
    tracksWithSource.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.musicGeneration?.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.musicGeneration?.createdAt || 0).getTime();
      return createdAtSortOrder === 'desc' ? (dateB - dateA) : (dateA - dateB);
    });

    return tracksWithSource;
  }, [currentTracks, allTracksCombined, createdAtSortOrder]);

  const groupedTracks = React.useMemo(() => {
    const groups: Array<{ id: string; tracks: any[] }> = [];
    const groupMap = new Map<string, number>();

    flatTracks.forEach((track) => {
      const groupId = track.generationId || track.musicGeneration?.id || track.id;

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, groups.length);
        groups.push({
          id: groupId,
          tracks: [track],
        });
        return;
      }

      const index = groupMap.get(groupId);
      if (index !== undefined) {
        groups[index].tracks.push(track);
      }
    });

    return groups;
  }, [flatTracks]);

  // 处理歌曲选择
  const handleTrackSelect = useCallback((track: any) => {
    if (track.isPlaceholder) return;
    if (onTrackPreview) {
      onTrackPreview(track);
    }
    if (onTrackSelect) {
      onTrackSelect(track.id);
    }
  }, [onTrackSelect, onTrackPreview]);

  // 处理播放/暂停
  const handlePlayPause = useCallback((track: any) => {
    if (track.isPlaceholder) return;
    if (onTrackPlay) {
      onTrackPlay(track, track.musicGeneration);
    }
  }, [onTrackPlay]);
  
  // 处理分享
  const handleShare = useCallback((trackId: string) => {
    const url = `${window.location.origin}/track/${trackId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTrackId(trackId);
      setTimeout(() => setCopiedTrackId(null), 2000);
    });
  }, []);

  const handleCreatePersonaFromTrack = useCallback((track: any) => {
    if (!user) {
      toast.error('Please sign in to create a persona.');
      return;
    }

    openCreatePersonaDialog(track.id, {
      title: track.title || track.musicTitle || 'Untitled Track',
      duration: typeof track.duration === 'string' ? Number.parseFloat(track.duration) || 0 : (track.duration || 0),
      createdAt: track.createdAt || track.musicGeneration?.createdAt || '',
      audioId: track.audioId || null,
      coverR2Url: track.coverR2Url || track.coverImage || null,
      hasPersona: Boolean(track.personaId || track.persona_id),
      personaId: track.personaId || track.persona_id || null,
    });
  }, [openCreatePersonaDialog, user]);
  
  // 处理下载
  const handleDownload = useCallback((track: any, music: any, format: 'mp3' | 'wav' | 'mp4' | 'cover' = 'mp3') => {
    if (onDownload) {
      onDownload(track, music ?? track.musicGeneration, format);
    }
  }, [onDownload]);
  
  // 处理收藏
  const handleFavoriteToggle = useCallback((track: any) => {
    if (onFavoriteToggle) {
      onFavoriteToggle(track, track.musicGeneration);
    }
  }, [onFavoriteToggle]);

  const handleLikeToggle = useCallback((track: any) => {
    if (onLikeToggle) {
      onLikeToggle(track, track.musicGeneration);
    }
  }, [onLikeToggle]);

  const handleDislikeToggle = useCallback((track: any) => {
    if (onDislikeToggle) {
      onDislikeToggle(track, track.musicGeneration);
    }
  }, [onDislikeToggle]);

  const handlePublishToggle = useCallback(async (track: any) => {
    if (!track?.id) {
      toast.error('Track not found');
      return;
    }

    if (publishingTrackIds.includes(track.id)) {
      return;
    }

    const nextPublished = !(track.isPublished ?? false);

    setPublishingTrackIds((prev) => [...prev, track.id]);

    try {
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (!session?.access_token || sessionError) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData?.session?.access_token) {
          toast.error('Session expired. Please log in again.');
          return;
        }
        session = refreshData.session;
      }

      const response = await fetch('/api/toggle-track-publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trackId: track.id,
          isPublished: nextPublished,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        toast.error(data?.error || data?.message || 'Failed to update publish status');
        return;
      }

      const updatedStatus = Boolean(data.isPublished);
      setPublishStatusOverrides((prev) => ({
        ...prev,
        [track.id]: updatedStatus,
      }));

      toast.success(data.message || (updatedStatus ? 'Track published successfully' : 'Track unpublished successfully'));
    } catch (error) {
      console.error('Toggle publish error:', error);
      toast.error('Failed to update publish status');
    } finally {
      setPublishingTrackIds((prev) => prev.filter((id) => id !== track.id));
    }
  }, [publishingTrackIds]);
  
  // 处理删除 - 显示确认弹窗
  const handleDelete = useCallback((trackId: string) => {
    const track = findTrackById(trackId);
    if (track) {
      setTrackToDelete({
        id: trackId,
        title: track.title || track.musicTitle || 'Untitled Track'
      });
      setDeleteDialogOpen(true);
    }
  }, [findTrackById]);

  // 确认删除
  const handleDeleteConfirm = useCallback(async () => {
    if (!trackToDelete) return;

    try {
      // Get session with refresh to ensure token is valid
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();

      console.log('[Delete Track] Initial session check:', {
        hasSession: !!session,
        hasToken: !!session?.access_token,
        tokenLength: session?.access_token?.length,
        sessionError: sessionError?.message,
      });

      // If no session or error, try to refresh
      if (!session?.access_token || sessionError) {
        console.log('[Delete Track] Attempting to refresh session');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData?.session?.access_token) {
          console.error('[Delete Track] Session refresh failed:', refreshError?.message);
          toast.error('Session expired. Please log in again.');
          setDeleteDialogOpen(false);
          setTrackToDelete(null);
          return;
        }

        session = refreshData.session;
        console.log('[Delete Track] Session refreshed successfully');
      }

      console.log('[Delete Track] Sending DELETE request to:', `/api/delete-track/${trackToDelete.id}`);
      const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('[Delete Track] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // 发送删除事件到 EventBus（用于父组件和 AudioPlayer 等组件监听）
          // 父组件会通过 EventBus 监听来更新状态，不需要调用 onDelete 回调
          // 因为 onDelete 回调会触发父组件的删除确认弹窗，导致重复弹窗
          if (typeof window !== 'undefined') {
            const eventBus = getEventBus();
            eventBus.emit(TRACK_EVENTS.DELETED, {
              trackId: trackToDelete.id
            });
          }
          
          toast.success('Track deleted successfully');
        } else {
          toast.error(data.error || 'Failed to delete track');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete track');
      }
    } catch (error) {
      console.error('Delete track error:', error);
      toast.error('Failed to delete track');
    } finally {
      setDeleteDialogOpen(false);
      setTrackToDelete(null);
    }
  }, [trackToDelete]);

  // 处理 Extend Music
  const handleExtendMusic = useCallback((trackId: string) => {
    if (!user) {
      toast.error('Please log in to extend music');
      return;
    }

    const track = findTrackById(trackId);
    if (!track) {
      toast.error('Track not found');
      return;
    }

    const trackAudioUrl = (track.audioUrl || track.streamAudioUrl || '').trim();
    if (!trackAudioUrl) {
      toast.error('Track audio is unavailable.');
      return;
    }

    if (!onExtendTrackSelect) {
      toast.error('Open Music Extender to continue.');
      return;
    }

    onExtendTrackSelect?.({
      id: track.id,
      audioId: (track.audioId || '').trim() || undefined,
      title: track.title || track.musicTitle || 'Untitled Track',
      audioUrl: trackAudioUrl,
      duration: typeof track.duration === 'string' ? parseFloat(track.duration) || 0 : (track.duration || 0),
      tags: track.musicTags || track.tags || '',
      genre: track.musicGenre || track.genre || '',
      coverImage: track.coverImage,
      coverR2Url: track.coverR2Url,
      musicType: track.musicType,
      createdAt: track.createdAt || track.musicGeneration?.createdAt,
    });
  }, [user, findTrackById, onExtendTrackSelect]);

  // 处理 Replace Section
  const handleReplaceSection = useCallback((trackId: string) => {
    if (!user) {
      toast.error('Please sign in to replace section');
      return;
    }

    const track = findTrackById(trackId);
    if (!track) {
      toast.error('Track not found');
      return;
    }

    // 设置待处理的曲目信息并打开对话框
    setPendingReplaceSectionTrackId(trackId);
    setPendingReplaceSectionTrackTitle(track.title || 'Untitled Track');
    setPendingReplaceSectionTrackDuration(track.duration || 120);
    setPendingReplaceSectionOriginalStyle(track.musicGeneration?.tags || '');
    setPendingReplaceSectionAudioUrl(track.audioUrl || track.streamAudioUrl || '');
    setShowReplaceSectionDialog(true);
  }, [user, findTrackById]);

  // 确认 Replace Section
  const handleConfirmReplaceSection = useCallback(async (params: ReplaceSectionParams): Promise<{ taskId: string } | void> => {
    if (!pendingReplaceSectionTrackId) return;

    try {
      // 获取认证令牌
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      // 准备 API 请求数据
      const requestBody: any = {
        trackId: pendingReplaceSectionTrackId,
        infillStartS: params.infillStartS,
        infillEndS: params.infillEndS,
        prompt: params.prompt,
        tags: params.tags,
        title: params.title,
        fullLyrics: params.fullLyrics || '', // 使用用户输入的歌词，如果为空则传空字符串
      };

      // 调用 Replace Section API
      const response = await fetch('/api/music/replace-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // 如果是积分不足错误，刷新积分余额
        if (response.status === 402 || errorData.insufficientCredits) {
          if (refreshCredits) {
            await refreshCredits();
          }
        }

        throw new Error(errorData.error || 'Failed to replace section');
      }

      const result = await response.json();

      if (result.success && result.data) {
        const { taskId, musicId, initialTracks } = result.data;

        // 使用 startExtendMusicPolling 来处理轮询（复用延长音乐的轮询逻辑）
        startExtendMusicPolling(
          taskId,
          musicId,
          params.title,
          params.tags,
          params.tags,
          initialTracks
        );

        toast.success('Replace section started successfully!', {
          description: 'Your modified track is being generated.',
        });

        // 清理状态
        setPendingReplaceSectionTrackId(null);
        setPendingReplaceSectionTrackTitle('');
        setPendingReplaceSectionTrackDuration(120);
        setPendingReplaceSectionOriginalStyle('');
        setPendingReplaceSectionAudioUrl('');

        // 刷新积分
        if (refreshCredits) {
          await refreshCredits();
        }

        // 返回 taskId，通知弹窗可以关闭了
        return { taskId };
      } else {
        throw new Error(result.error || 'Failed to replace section');
      }

    } catch (error: any) {
      console.error('Replace section error:', error);
      toast.error(error.message || 'Failed to replace section. Please try again.');
      return;
    }
  }, [pendingReplaceSectionTrackId, startExtendMusicPolling, refreshCredits]);

  // 处理 Vocal Removal：点击即打开结果弹窗，查询/启动都在弹窗内完成
  const handleVocalRemoval = useCallback(async (trackId: string) => {
    const track = findTrackById(trackId);
    if (track?.musicGeneration?.isInstrumental) {
      toast.error('Instrumental tracks cannot be processed for vocal removal');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }
      
      const trackTitle = track?.title || 'Unknown Track';
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(trackTitle);
      setShowVocalRemovalProgressDialog(true);
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'checking',
        progress: 0,
        errorMessage: undefined,
        vocalUrl: undefined,
        instrumentalUrl: undefined,
      });

      const statusResponse = await fetch(`/api/vocal/removal-status?trackId=${trackId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      let completedRemoval: any = null;
      let processingRemoval: any = null;

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        if (statusResult.success && statusResult.data && Array.isArray(statusResult.data) && statusResult.data.length > 0) {
          completedRemoval = statusResult.data.find((r: any) => r.status === 'completed' && (r.vocalUrl || r.instrumentalUrl));
          processingRemoval = statusResult.data.find((r: any) => r.status === 'processing' && r.taskId);
        }
      }

      if (completedRemoval) {
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'completed',
          progress: 100,
          vocalUrl: completedRemoval?.vocalUrl,
          instrumentalUrl: completedRemoval?.instrumentalUrl,
        });
        return;
      }

      if (processingRemoval) {
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'processing',
          progress: 10,
          taskId: processingRemoval.taskId,
        });
        vocalRemovalManager.startPolling(trackId, processingRemoval.taskId);
        return;
      }

      // 没有任何记录：在同一个弹窗里展示“开始分离”
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'ready',
        progress: 0,
      });
    } catch (error) {
      console.error('Vocal removal error:', error);
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'error',
        progress: 0,
        errorMessage: error instanceof Error ? error.message : 'Failed to check separation status',
      });
    }
  }, [findTrackById, vocalRemovalManager]);

  // 开始 Vocal Removal 处理
  const startVocalRemovalProcess = useCallback(async (trackId: string, options?: { force?: boolean }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }
      
      const track = findTrackById(trackId);
      const trackTitle = track?.title || 'Unknown Track';
      
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(trackTitle);
      setShowVocalRemovalProgressDialog(true);
      
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'processing',
        progress: 0,
        errorMessage: undefined,
      });

      const response = await fetch('/api/vocal/removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trackId,
          type: 'separate_vocal',
          force: !!options?.force,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to start vocal removal';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'error',
          progress: 0,
          errorMessage,
        });
        return;
      }

      const result = await response.json();

      if (result.success && result.data?.taskId) {
        // Cache hit: completed result can be rendered immediately without polling.
        if (result.cacheHit && result.data.status === 'completed') {
          vocalRemovalManager.updateTrackState(trackId, {
            status: 'completed',
            progress: 100,
            taskId: result.data.taskId,
            vocalUrl: result.data.vocalUrl,
            instrumentalUrl: result.data.instrumentalUrl,
          });
          return;
        }

        const taskId = result.data.taskId;
        
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'processing',
          taskId,
        });
        
        // 开始轮询
        vocalRemovalManager.startPolling(trackId, taskId);
      } else {
        const errorMessage = result.error || result.message || 'Failed to start vocal removal';
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'error',
          progress: 0,
          errorMessage,
        });
      }
    } catch (error) {
      console.error('Vocal removal error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start vocal removal';
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'error',
        progress: 0,
        errorMessage,
      });
    }
  }, [findTrackById, vocalRemovalManager]);

  // 渲染空状态
  const showEmptyState = !isLoading && (!userTracks || userTracks.length === 0 || allTracks.length === 0) 
    && stableGeneratedTracks.length === 0;

  const shouldShowLoadMore = Boolean(onLoadMore) && !searchQuery.trim() && hasMore;
  const shouldShowNoResults = currentTracks.length === 0 && (Boolean(searchQuery.trim()) || hasActiveTypeFilter);

  React.useEffect(() => {
    if (!shouldShowLoadMore || !loadMoreTriggerRef.current || !scrollContainerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (isLoading || isLoadingMore) return;
        onLoadMore?.();
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreTriggerRef.current);

    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, onLoadMore, shouldShowLoadMore]);

  if (showEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 overflow-hidden">
        <div className="text-center max-w-md space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Image
                src="/icons/Studio-Empty-Coffee.svg"
                alt="No tracks yet"
                width={96}
                height={96}
                className="h-20 w-20 opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-foreground">
              No tracks data
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              Let{"'"}s bring your R&amp;B track to life.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Search Bar */}
      <div className="flex-shrink-0 px-3 pt-4 md:pt-6 pb-4">
        <div className="flex items-center gap-4 flex-wrap md:justify-end flex-1 min-w-[240px] self-center w-full">
          <div className="app-card-muted rounded-2xl flex-1 h-11 px-1 bg-foreground/5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10">
          <div className="relative h-full w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/55" />
            <input
              type="text"
              placeholder="Enter title and tags"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-full rounded-2xl bg-transparent pl-11 pr-10 text-sm text-foreground placeholder:text-foreground/40 transition-colors focus:bg-transparent focus:outline-none border-0"
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-11 min-w-[130px] items-center justify-center gap-1.5 rounded-2xl bg-foreground/5 px-3 text-xs font-semibold text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors hover:bg-foreground/10 dark:bg-white/10"
                aria-label="Filter tracks by type"
                title="Filter tracks by type"
              >
                {React.createElement(selectedTypeFilterOption.icon, { className: "h-3.5 w-3.5" })}
                <span className="truncate">{selectedTypeFilterOption.label}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {TRACK_TYPE_FILTER_OPTIONS.map((option) => {
                const isSelected = option.value === selectedTypeFilter;
                return (
                  <React.Fragment key={option.value}>
                    {option.value === "disliked" && <DropdownMenuSeparator className="my-1" />}
                    <DropdownMenuItem
                      onClick={() => setSelectedTypeFilter(option.value)}
                      className="group flex items-center justify-between gap-2 rounded-xl px-3.5 py-2 transition-colors hover:bg-black/5 focus:bg-black/5 data-[highlighted]:bg-black/5 dark:hover:bg-white/5 dark:focus:bg-white/5 dark:data-[highlighted]:bg-white/5"
                    >
                      <span className="flex items-center gap-2">
                        {React.createElement(option.icon, {
                          className: `h-4 w-4 ${isSelected ? "text-primary" : "text-foreground/60"}`
                        })}
                        <span className="text-sm font-medium text-foreground">{option.label}</span>
                      </span>
                      {isSelected && (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      )}
                    </DropdownMenuItem>
                  </React.Fragment>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => setCreatedAtSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className={`inline-flex h-11 w-[108px] items-center justify-center gap-1.5 rounded-2xl bg-foreground/5 px-3 text-xs font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-colors hover:bg-foreground/10 dark:bg-white/10 ${
              createdAtSortOrder === 'desc'
                ? 'text-foreground'
                : 'text-foreground/80 hover:text-foreground'
            }`}
            aria-label={createdAtSortOrder === 'desc' ? 'Sort by newest first' : 'Sort by oldest first'}
            title={createdAtSortOrder === 'desc' ? 'Sorted: Newest first' : 'Sorted: Oldest first'}
            aria-pressed={createdAtSortOrder === 'asc'}
          >
            <ArrowDownUp
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                createdAtSortOrder === 'asc' ? 'rotate-180' : ''
              }`}
            />
            <span>{createdAtSortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
          {onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              aria-label="Start Creating"
              title="Start Creating"
            >
              <Wand2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-hidden">
        <div 
          className="h-full overflow-y-auto scrollbar-hidden px-0 relative"
          ref={scrollContainerRef}
          style={{
            paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 1.5rem)' : '5rem'
          }}
        >
        <div className="relative">
          {isLoading ? (
            <TrackListSkeleton />
          ) : (
            <>
            {/* All Tracks (包含 generatedTracks 和 userTracks，使用分组显示) */}
          {groupedTracks.length > 0 && (
            <div className="space-y-2">
              {groupedTracks.map((group) => (
                <div key={group.id} className="space-y-2">

                  <div className="space-y-1 px-3">
                    {group.tracks.map((track) => {
                      const isGeneratedTrack = track.isGenerating !== undefined || track.isPlaceholder !== undefined;
                      return (
                        <div key={track.id} className="p-0">
                          <TrackItem
                            track={track}
                            variant="studio"
                            isSelected={selectedTrack === track.id}
                            isPlaying={globalAudioState.isPlaying}
                            isCurrentTrack={globalAudioState.currentPlayingTrackId === track.id}
                            isCopied={copiedTrackId === track.id}
                            modelBadgePlacement="title"
                            canDownloadMP3={canDownloadMP3}
                            canDownloadWAV={canDownloadWAV}
                            canDownloadMP4={canDownloadMP4}
                            canDownloadCover={canDownloadCover}
                            canVocalRemoval={canVocalRemoval}
                            canExtendMusic={canExtendMusic}
                            canReplaceSection={canReplaceSection}
                            canCreatePersona={canCreatePersona}
                            onSelect={() => {
                              if (isGeneratedTrack && !track.isError && track.audioUrl && onGeneratedTrackSelect) {
                                onTrackPreview?.(track);
                                onGeneratedTrackSelect(track.id);
                              } else {
                                handleTrackSelect(track);
                              }
                            }}
                            onPreviewLyrics={onTrackPreview ? () => onTrackPreview(track) : undefined}
                            onPlayPause={() => handlePlayPause(track)}
                            onFavoriteToggle={onFavoriteToggle ? () => handleFavoriteToggle(track) : undefined}
                            onShare={() => handleShare(track.id)}
                            onDislikeToggle={onDislikeToggle ? () => handleDislikeToggle(track) : undefined}
                            onLikeToggle={onLikeToggle ? () => handleLikeToggle(track) : undefined}
                            onDownload={onDownload ? (format) => handleDownload(track, track.musicGeneration, format) : undefined}
                            onVocalRemoval={() => handleVocalRemoval(track.id)}
                            onExtendMusic={() => handleExtendMusic(track.id)}
                            onReplaceSection={() => handleReplaceSection(track.id)}
                            onCreatePersona={() => handleCreatePersonaFromTrack(track)}
                            onDelete={onDelete ? () => handleDelete(track.id) : undefined}
                            onPublishToggle={() => handlePublishToggle(track)}
                            isPublishing={publishingTrackIds.includes(track.id)}
                            onPricingModalOpen={openPricingModal}
                            onEditTitle={onEditTitle}
                            onEditMusicInfo={onEditMusicInfo}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {/* Tracks Summary */}
              {currentTracks.length > 0 && (
                <div className="flex justify-center items-center py-2 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold tracking-tight text-foreground/80 dark:text-foreground/85">
                    {(() => {
                      const useTotalSummary = Boolean(summary) && !searchQuery.trim() && !hasActiveTypeFilter;
                      const totalSongs = useTotalSummary ? summary!.totalTracks : currentTracks.length;
                      const totalDuration = useTotalSummary
                        ? summary!.totalDuration
                        : currentTracks.reduce((sum, track) => {
                            const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
                            return sum + (isNaN(duration) ? 0 : duration);
                          }, 0);
                      const durationText = formatDurationInMinutes(totalDuration);
                      return `${totalSongs} song${totalSongs > 1 ? 's' : ''}${durationText ? `, ${durationText}` : ''}`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}

            {shouldShowLoadMore && (
              <div ref={loadMoreTriggerRef} className="h-1" />
            )}

            {isLoadingMore && (
              <div className="px-3">
                <TrackListSkeleton count={3} className="pt-3" />
              </div>
            )}

            {/* No Search Results */}
          {shouldShowNoResults && (
            <div className="flex items-center justify-center h-full relative min-h-[400px]">
              <div className="text-center max-w-md px-6 py-12">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <Search className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {searchQuery.trim() ? 'No matching tracks' : 'No tracks in this type'}
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {searchQuery.trim()
                    ? `No tracks found for "${searchQuery}". Try a different search term.`
                    : `No tracks found in "${selectedTypeFilterOption.label}".`}
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTypeFilter('all');
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
        </div>
      </div>
      
      <MusicPersonaDialogs
        isPersonaDialogOpen={isPersonaDialogOpen}
        setIsPersonaDialogOpen={setIsPersonaDialogOpen}
        isPersonaLoading={isPersonaLoading}
        personaOptions={personaOptions}
        selectedPersonaId={selectedPersonaId}
        setSelectedPersonaId={setSelectedPersonaId}
        deletingPersonaRecordId={deletingPersonaRecordId}
        onDeletePersona={handleDeletePersona}
        onOpenSelectMusicDialog={openSelectMusicDialog}
        isSelectMusicOpen={isSelectMusicOpen}
        setIsSelectMusicOpen={setIsSelectMusicOpen}
        closeSelectMusicDialog={closeSelectMusicDialog}
        isSelectMusicLoading={isSelectMusicLoading}
        selectMusicOptions={selectMusicOptions}
        pendingMusicTrackId={pendingMusicTrackId}
        setPendingMusicTrackId={setPendingMusicTrackId}
        selectedMusicTrackId={selectedMusicTrackId}
        pendingMusicTrack={pendingMusicTrack}
        pendingMusicTrackUnavailableReason={pendingMusicTrackUnavailableReason}
        getPersonaTrackUnavailableReason={getPersonaTrackUnavailableReason}
        formatTrackCreatedAt={formatTrackCreatedAt}
        confirmSelectMusicDialog={confirmSelectMusicDialog}
        isCreatePersonaDialogOpen={isCreatePersonaDialogOpen}
        setIsCreatePersonaDialogOpen={setIsCreatePersonaDialogOpen}
        selectedMusicTrack={selectedMusicTrack}
        createPersonaName={createPersonaName}
        setCreatePersonaName={setCreatePersonaName}
        createPersonaDescription={createPersonaDescription}
        setCreatePersonaDescription={setCreatePersonaDescription}
        closeCreatePersonaDialog={closeCreatePersonaDialog}
        handleCreatePersona={handleCreatePersona}
        isCreatingPersona={isCreatingPersona}
      />

      {/* Vocal Removal 进度弹窗 */}
      {currentProcessingTrackId && (
        <VocalRemovalProgressDialog
          isOpen={showVocalRemovalProgressDialog}
          onClose={() => {
            setShowVocalRemovalProgressDialog(false);
            const status = vocalRemovalManager.getTrackState(currentProcessingTrackId).status;
            if (status === 'completed' || status === 'error' || status === 'ready') {
              setCurrentProcessingTrackId(null);
              setCurrentProcessingTrackTitle('');
            }
          }}
          onReSeparate={() => startVocalRemovalProcess(currentProcessingTrackId, { force: true })}
          onStartSeparation={() => {
            if ((credits ?? 0) < CLIENT_VOCAL_SEPARATION_CREDITS.studio) {
              openPricingModal();
              return;
            }
            startVocalRemovalProcess(currentProcessingTrackId);
          }}
          trackTitle={currentProcessingTrackTitle}
          progress={vocalRemovalManager.getTrackState(currentProcessingTrackId).progress || 0}
          status={vocalRemovalManager.getTrackState(currentProcessingTrackId).status || 'checking'}
          errorMessage={
            vocalRemovalManager.getTrackState(currentProcessingTrackId).status === 'error'
              ? vocalRemovalManager.getTrackState(currentProcessingTrackId).errorMessage || 'Vocal removal failed. Please try again.'
              : undefined
          }
          vocalUrl={vocalRemovalManager.getTrackState(currentProcessingTrackId).vocalUrl}
          instrumentalUrl={vocalRemovalManager.getTrackState(currentProcessingTrackId).instrumentalUrl}
        />
      )}

      {/* Replace Section 对话框 */}
      <ReplaceSectionDialog
        isOpen={showReplaceSectionDialog}
        onClose={() => {
          setShowReplaceSectionDialog(false);
          setPendingReplaceSectionTrackId(null);
          setPendingReplaceSectionTrackTitle('');
          setPendingReplaceSectionTrackDuration(120);
          setPendingReplaceSectionOriginalStyle('');
          setPendingReplaceSectionAudioUrl('');
        }}
        onConfirm={handleConfirmReplaceSection}
        trackTitle={pendingReplaceSectionTrackTitle}
        trackDuration={pendingReplaceSectionTrackDuration}
        originalStyle={pendingReplaceSectionOriginalStyle}
        audioUrl={pendingReplaceSectionAudioUrl}
        userCredits={credits ?? undefined}
      />

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Track</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base whitespace-nowrap">
              Are you sure you want to delete the current track?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setTrackToDelete(null);
              }}
              className="w-full sm:w-[160px] h-10 rounded-lg bg-muted/70 text-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="w-full sm:w-[160px] h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
