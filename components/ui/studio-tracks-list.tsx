"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Image from "next/image";
import { ArrowDownUp, AudioLines, AudioWaveform, Blend, Check, Disc3, Expand, Mic, Music, Music2, Search, ThumbsDown, X, Wand2, Filter } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from "@/lib/supabase";
import { toast } from 'sonner';
import type { LibraryTrack, MidiGenerationData } from '@/types/track';
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { VocalRemovalProgressDialog } from '@/features/vocal-tools/components/vocal-removal-progress-dialog';
import { SplitStemProgressDialog } from '@/features/vocal-tools/components/split-stem-progress-dialog';
import { MidiResultDialog } from '@/features/vocal-tools/components/midi-result-dialog';
import { ReplaceSectionDialog, ReplaceSectionParams } from '@/features/music-upload/components/replace-section-dialog';
import { CLIENT_FEATURE_CREDITS, CLIENT_VOCAL_SEPARATION_CREDITS } from '@/lib/credits-config';
import { useVocalRemovalManager } from '@/features/vocal-tools/hooks/use-vocal-removal-manager';
import { TrackItem } from './track-item';
import { formatDurationInMinutes } from '@/lib/format-utils';
import { getStudioFeatureMusicTypes, type StudioFeatureKey } from '@/lib/studio-features';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";
import type { MusicType } from "@/types/music";
import type { ExtendSourceTrack } from "@/types/extend-track-source";
import { MusicPersonaDialogs } from "@/components/ui/music-persona-dialogs";
import { useStudioPersonaManager } from "@/hooks/use-studio-persona-manager";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";
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
    initialTracks?: any[] // 初始占位 tracks
  ) => void;
  onCreate?: () => void;
}

// 稳定的 no-op 函数，用于替代未提供的 extendMusicStartPolling
const noOpExtendMusicPolling = () => {};

type TrackTypeFilter =
  | "all"
  | "music-generator"
  | "sound-generator"
  | "music-extender"
  | "music-cover"
  | "mashup"
  | "add-vocal"
  | "add-melody"
  | "disliked";

type MidiTrackState = {
  status: 'idle' | 'checking' | 'generating' | 'completed' | 'error' | 'requires_split_stem';
  taskId?: string;
  instrumentsCount?: number;
  midiData?: MidiGenerationData | null;
  errorMessage?: string;
};

const STUDIO_FEATURE_LABEL_KEYS: Record<StudioFeatureKey, string> = {
  "music-generator": "studioFeatures.musicGenerator",
  "sound-generator": "studioFeatures.soundGenerator",
  "music-extender": "studioFeatures.musicExtender",
  "music-cover": "studioFeatures.musicCover",
  "mashup": "studioFeatures.mashup",
  "add-track": "studioFeatures.addTrack",
  "add-vocal": "studioFeatures.addVocal",
  "add-melody": "studioFeatures.addMelody",
};

const TRACK_TYPE_FILTER_CONFIG: Array<{
  value: TrackTypeFilter;
  labelKey?: string;
  featureKey?: StudioFeatureKey;
  musicTypes: MusicType[];
  icon: React.ElementType;
}> = [
  { value: "all", labelKey: "studioTracks.all", musicTypes: [], icon: Filter },
  { value: "music-generator", featureKey: "music-generator", musicTypes: getStudioFeatureMusicTypes("music-generator"), icon: Music2 },
  { value: "sound-generator", featureKey: "sound-generator", musicTypes: getStudioFeatureMusicTypes("sound-generator"), icon: AudioWaveform },
  { value: "music-extender", featureKey: "music-extender", musicTypes: getStudioFeatureMusicTypes("music-extender"), icon: Expand },
  { value: "music-cover", featureKey: "music-cover", musicTypes: getStudioFeatureMusicTypes("music-cover"), icon: Disc3 },
  { value: "mashup", featureKey: "mashup", musicTypes: getStudioFeatureMusicTypes("mashup"), icon: Blend },
  { value: "add-vocal", featureKey: "add-vocal", musicTypes: getStudioFeatureMusicTypes("add-vocal"), icon: Mic },
  { value: "add-melody", featureKey: "add-melody", musicTypes: getStudioFeatureMusicTypes("add-melody"), icon: Music },
  { value: "disliked", labelKey: "studioTracks.disliked", musicTypes: [], icon: ThumbsDown },
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
  const { t, locale } = useI18n();
  const withCurrentLocale = useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const getStudioFeatureLabel = useCallback(
    (featureKey: StudioFeatureKey) => t(STUDIO_FEATURE_LABEL_KEYS[featureKey]),
    [t]
  );
  const trackTypeFilterOptions = useMemo(
    () =>
      TRACK_TYPE_FILTER_CONFIG.map((option) => ({
        ...option,
        label: option.featureKey ? getStudioFeatureLabel(option.featureKey) : t(option.labelKey || "studioTracks.all"),
      })),
    [getStudioFeatureLabel, t]
  );
  const untitledTrackLabel = t("studioTracks.untitledTrack");
  const unknownTrackLabel = t("studioTracks.unknownTrack");
  
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
  const canSplitStem = hasPermission('split_stem_from_music_studio');
  const canGenerateMidi = hasPermission('generate_midi');
  const canExtendMusic = hasPermission('extend_music');
  const canReplaceSection = hasPermission('replace_section');
  const canCreatePersona = hasPermission('generate_persona');
  
  // UI 状态
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createdAtSortOrder, setCreatedAtSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<TrackTypeFilter>('all');
  const selectedTypeFilterOption = useMemo(
    () => trackTypeFilterOptions.find((option) => option.value === selectedTypeFilter) ?? trackTypeFilterOptions[0],
    [selectedTypeFilter, trackTypeFilterOptions]
  );
  const selectedTypeFilterMusicTypes = selectedTypeFilterOption.musicTypes;
  const hasActiveTypeFilter = selectedTypeFilter !== 'all';
  
  // Vocal Removal 管理
  const vocalRemovalManager = useVocalRemovalManager();
  const [midiTrackStates, setMidiTrackStates] = useState<Map<string, MidiTrackState>>(new Map());
  const midiPollingTimersRef = React.useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  
  // Extend Music 函数（从父组件传递，确保使用同一个 hook 实例）
  // 使用 useMemo 稳定值，避免每次渲染创建新函数
  const startExtendMusicPolling = useMemo(
    () => extendMusicStartPolling || noOpExtendMusicPolling,
    [extendMusicStartPolling]
  );
  
  // Track processing 弹窗状态（checking -> ready -> processing -> completed/error）
  const [showTrackProcessingDialog, setShowTrackProcessingDialog] = useState(false);
  const [showMidiResultDialog, setShowMidiResultDialog] = useState(false);
  const [currentProcessingTrackId, setCurrentProcessingTrackId] = useState<string | null>(null);
  const [currentProcessingTrackTitle, setCurrentProcessingTrackTitle] = useState<string>('');
  const [currentProcessingFeatureMode, setCurrentProcessingFeatureMode] = useState<'separate_vocal' | 'split_stem'>('separate_vocal');

  const getMidiTrackState = useCallback((trackId: string): MidiTrackState => {
    return midiTrackStates.get(trackId) || { status: 'idle' };
  }, [midiTrackStates]);

  const updateMidiTrackState = useCallback((trackId: string, updates: Partial<MidiTrackState>) => {
    setMidiTrackStates((prev) => {
      const next = new Map(prev);
      const current = next.get(trackId) || { status: 'idle' as const };
      next.set(trackId, { ...current, ...updates });
      return next;
    });
  }, []);

  const resetMidiTrackState = useCallback(
    (
      trackId: string,
      status: MidiTrackState["status"],
      taskId?: string
    ) => {
      updateMidiTrackState(trackId, {
        status,
        taskId,
        instrumentsCount: undefined,
        midiData: undefined,
        errorMessage: undefined,
      });
    },
    [updateMidiTrackState]
  );

  const clearMidiPollingForTrack = useCallback((trackId: string) => {
    const pollingTimer = midiPollingTimersRef.current.get(trackId);
    if (pollingTimer) {
      clearInterval(pollingTimer);
      midiPollingTimersRef.current.delete(trackId);
    }
  }, []);

  useEffect(() => {
    const pollingTimers = midiPollingTimersRef.current;
    return () => {
      pollingTimers.forEach((timerId) => clearInterval(timerId));
      pollingTimers.clear();
    };
  }, []);

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
        musicStatus: music.status,
        musicGeneration: music,
        isError: !track.audioUrl || track.audioUrl.trim() === '',
        errorMessage: (!track.audioUrl || track.audioUrl.trim() === '')
          ? (music.errorInfo?.errorMessage || trackErrorMessage || t("toasts.trackAudioUnavailable"))
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
      lyrics: track.lyrics || '',
      isFavorited: false,
      isPublished: publishStatusOverrides[track.id] ?? Boolean(track.isPublished),
      isDisliked: track.isDisliked ?? track.is_disliked ?? false,
      musicTitle: track.title,
      musicTags: track.tags || '',
      musicStatus: track.isError ? 'error' : (track.isGenerating ? 'generating' : (track.isCompleted ? 'complete' : 'generating')),
      musicGeneration: {
        id: track.generationId,
        title: track.title,
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
          originalTrackTitle: originalTrack?.title || unknownTrackLabel,
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
  }, [currentTracks, allTracksCombined, createdAtSortOrder, unknownTrackLabel]);

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
    const url = `${window.location.origin}${withCurrentLocale(`/track/${trackId}`)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTrackId(trackId);
      setTimeout(() => setCopiedTrackId(null), 2000);
    });
  }, [withCurrentLocale]);

  const handleCreatePersonaFromTrack = useCallback((track: any) => {
    if (!user) {
      toast.error(t("toasts.pleaseSignInCreatePersona"));
      return;
    }

    openCreatePersonaDialog(track.id, {
      title: track.title || track.musicTitle || untitledTrackLabel,
      duration: typeof track.duration === 'string' ? Number.parseFloat(track.duration) || 0 : (track.duration || 0),
      createdAt: track.createdAt || track.musicGeneration?.createdAt || '',
      model: track.model || track.musicGeneration?.model || null,
      musicType: track.musicType || track.musicGeneration?.type || null,
      audioId: track.audioId || null,
      coverR2Url: track.coverR2Url || track.coverImage || null,
      hasPersona: Boolean(track.personaId || track.persona_id),
      personaId: track.personaId || track.persona_id || null,
    });
  }, [openCreatePersonaDialog, t, untitledTrackLabel, user]);
  
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

  const getAccessTokenWithRefresh = useCallback(async () => {
    let { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (!session?.access_token || sessionError) {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData?.session?.access_token) {
        return null;
      }
      session = refreshData.session;
    }

    return session.access_token;
  }, []);

  const requireAccessToken = useCallback(
    async (onMissingToken?: () => void) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        onMissingToken?.();
        return null;
      }

      return session.access_token;
    },
    []
  );

  const getAuthHeaders = useCallback(
    (accessToken: string) => ({
      'Authorization': `Bearer ${accessToken}`,
    }),
    []
  );

  const getJsonAuthHeaders = useCallback(
    (accessToken: string) => ({
      'Content-Type': 'application/json',
      ...getAuthHeaders(accessToken),
    }),
    [getAuthHeaders]
  );

  const getResponseArrayData = useCallback((payload: any): any[] => {
    return Array.isArray(payload?.data) ? payload.data : [];
  }, []);

  const getMidiInstrumentsCount = useCallback((midiData: any): number => {
    return Array.isArray(midiData?.instruments) ? midiData.instruments.length : 0;
  }, []);

  const handlePublishToggle = useCallback(async (track: any) => {
    if (!track?.id) {
      toast.error(t("toasts.trackNotFound"));
      return;
    }

    if (publishingTrackIds.includes(track.id)) {
      return;
    }

    const nextPublished = !(track.isPublished ?? false);

    setPublishingTrackIds((prev) => [...prev, track.id]);

    try {
      const accessToken = await getAccessTokenWithRefresh();
      if (!accessToken) {
        toast.error(t("toasts.sessionExpiredLogInAgain"));
        return;
      }

      const response = await fetch('/api/toggle-track-publish', {
        method: 'POST',
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify({
          trackId: track.id,
          isPublished: nextPublished,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        toast.error(data?.error || data?.message || t("toasts.failedUpdatePublishStatus"));
        return;
      }

      const updatedStatus = Boolean(data.isPublished);
      setPublishStatusOverrides((prev) => ({
        ...prev,
        [track.id]: updatedStatus,
      }));

      toast.success(data.message || (updatedStatus ? t("toasts.trackPublishedSuccessfully") : t("toasts.trackUnpublishedSuccessfully")));
    } catch (error) {
      console.error('Toggle publish error:', error);
      toast.error(t("toasts.failedUpdatePublishStatus"));
    } finally {
      setPublishingTrackIds((prev) => prev.filter((id) => id !== track.id));
    }
  }, [publishingTrackIds, getAccessTokenWithRefresh, getJsonAuthHeaders, t]);
  
  // 处理删除 - 显示确认弹窗
  const handleDelete = useCallback((trackId: string) => {
    const track = findTrackById(trackId);
    if (track) {
      setTrackToDelete({
        id: trackId,
        title: track.title || track.musicTitle || untitledTrackLabel
      });
      setDeleteDialogOpen(true);
    }
  }, [findTrackById, untitledTrackLabel]);

  // 确认删除
  const handleDeleteConfirm = useCallback(async () => {
    if (!trackToDelete) return;

    try {
      const accessToken = await getAccessTokenWithRefresh();
      if (!accessToken) {
        toast.error(t("toasts.sessionExpiredLogInAgain"));
        return;
      }

      console.log('[Delete Track] Sending DELETE request to:', `/api/delete-track/${trackToDelete.id}`);
      const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
        method: 'DELETE',
        headers: getJsonAuthHeaders(accessToken),
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
          
          toast.success(t("toasts.trackDeletedSuccessfully"));
        } else {
          toast.error(data.error || t("toasts.failedDeleteTrack"));
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || t("toasts.failedDeleteTrack"));
      }
    } catch (error) {
      console.error('Delete track error:', error);
      toast.error(t("toasts.failedDeleteTrack"));
    } finally {
      setDeleteDialogOpen(false);
      setTrackToDelete(null);
    }
  }, [getAccessTokenWithRefresh, getJsonAuthHeaders, t, trackToDelete]);

  // 处理 Extend Music
  const handleExtendMusic = useCallback((trackId: string) => {
    if (!user) {
      toast.error(t("toasts.pleaseLogInExtendMusic"));
      return;
    }

    const track = findTrackById(trackId);
    if (!track) {
      toast.error(t("toasts.trackNotFound"));
      return;
    }

    const trackAudioUrl = (track.audioUrl || track.streamAudioUrl || '').trim();
    if (!trackAudioUrl) {
      toast.error(t("toasts.trackAudioUnavailable"));
      return;
    }

    if (!onExtendTrackSelect) {
      toast.error(
        t("toasts.openFeatureToContinue", { feature: getStudioFeatureLabel("music-extender") })
      );
      return;
    }

    onExtendTrackSelect?.({
      id: track.id,
      audioId: (track.audioId || '').trim() || undefined,
      title: track.title || track.musicTitle || untitledTrackLabel,
      audioUrl: trackAudioUrl,
      duration: typeof track.duration === 'string' ? parseFloat(track.duration) || 0 : (track.duration || 0),
      tags: track.musicTags || track.tags || '',
      coverImage: track.coverImage,
      coverR2Url: track.coverR2Url,
      musicType: track.musicType,
      createdAt: track.createdAt || track.musicGeneration?.createdAt,
    });
  }, [findTrackById, getStudioFeatureLabel, onExtendTrackSelect, t, untitledTrackLabel, user]);

  // 处理 Replace Section
  const handleReplaceSection = useCallback((trackId: string) => {
    if (!user) {
      toast.error(t("toasts.pleaseSignInReplaceSection"));
      return;
    }

    const track = findTrackById(trackId);
    if (!track) {
      toast.error(t("toasts.trackNotFound"));
      return;
    }

    // 设置待处理的曲目信息并打开对话框
    setPendingReplaceSectionTrackId(trackId);
    setPendingReplaceSectionTrackTitle(track.title || untitledTrackLabel);
    setPendingReplaceSectionTrackDuration(track.duration || 120);
    setPendingReplaceSectionOriginalStyle(track.musicGeneration?.tags || '');
    setPendingReplaceSectionAudioUrl(track.audioUrl || track.streamAudioUrl || '');
    setShowReplaceSectionDialog(true);
  }, [findTrackById, t, untitledTrackLabel, user]);

  // 确认 Replace Section
  const handleConfirmReplaceSection = useCallback(async (params: ReplaceSectionParams): Promise<{ taskId: string } | void> => {
    if (!pendingReplaceSectionTrackId) return;

    try {
      // 获取认证令牌
      const accessToken = await requireAccessToken(() => {
        toast.error(t("toasts.authRequiredLogInAgain"));
      });
      if (!accessToken) {
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
        headers: getJsonAuthHeaders(accessToken),
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

        throw new Error(errorData.error || t("toasts.failedReplaceSection"));
      }

      const result = await response.json();

      if (result.success && result.data) {
        const { taskId, musicId, initialTracks } = result.data;

        // 使用 startExtendMusicPolling 来处理轮询（复用延长音乐的轮询逻辑）
        startExtendMusicPolling(
          taskId,
          musicId,
          params.title,
          initialTracks
        );

        toast.success(t("toasts.replaceSectionStarted"), {
          description: t("toasts.replaceSectionGeneratingDesc"),
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
        throw new Error(result.error || t("toasts.failedReplaceSection"));
      }

    } catch (error: any) {
      console.error('Replace section error:', error);
      toast.error(error.message || t("toasts.failedReplaceSection"));
      return;
    }
  }, [getJsonAuthHeaders, pendingReplaceSectionTrackId, refreshCredits, requireAccessToken, startExtendMusicPolling, t]);

  const startMidiStatusPolling = useCallback(async (trackId: string, taskId: string) => {
    const POLL_INTERVAL = 3000;
    const MAX_POLL_DURATION = 5 * 60 * 1000;

    const accessToken = await requireAccessToken(() => {
      updateMidiTrackState(trackId, {
        status: 'error',
        taskId,
        midiData: undefined,
        errorMessage: t("toasts.authRequiredLogInAgain"),
      });
    });
    if (!accessToken) {
      return;
    }

    const startedAt = Date.now();
    let requestInFlight = false;

    clearMidiPollingForTrack(trackId);

    const pollOnce = async () => {
      if (requestInFlight) return;
      requestInFlight = true;

      try {
        if (Date.now() - startedAt > MAX_POLL_DURATION) {
          clearMidiPollingForTrack(trackId);
          updateMidiTrackState(trackId, {
            status: 'error',
            taskId,
            midiData: undefined,
            errorMessage: 'MIDI generation timeout. Please try again.',
          });
          return;
        }

        const response = await fetch(`/api/midi-status?taskId=${encodeURIComponent(taskId)}`, {
          headers: getAuthHeaders(accessToken),
        });

        if (!response.ok) {
          return;
        }

        const result = await response.json();
        if (!result?.success || !result?.data) {
          return;
        }

        const midiStatus = result.data.status as string;

        if (midiStatus === 'completed') {
          clearMidiPollingForTrack(trackId);
          const instrumentsCount = getMidiInstrumentsCount(result.data?.midiData);

          updateMidiTrackState(trackId, {
            status: 'completed',
            taskId,
            instrumentsCount,
            midiData: result.data?.midiData || null,
            errorMessage: undefined,
          });

          if (refreshCredits) {
            await refreshCredits();
          }
          toast.success(t("toasts.midiReady"));
          return;
        }

        if (midiStatus === 'error' || midiStatus === 'expired') {
          clearMidiPollingForTrack(trackId);
          updateMidiTrackState(trackId, {
            status: 'error',
            taskId,
            midiData: undefined,
            errorMessage: 'MIDI generation failed. Please retry.',
          });
          return;
        }

        updateMidiTrackState(trackId, {
          status: 'generating',
          taskId,
          midiData: undefined,
          errorMessage: undefined,
        });
      } catch (error) {
        console.error('MIDI status polling error:', error);
      } finally {
        requestInFlight = false;
      }
    };

    const timerId = setInterval(pollOnce, POLL_INTERVAL);
    midiPollingTimersRef.current.set(trackId, timerId);
    await pollOnce();
  }, [clearMidiPollingForTrack, getAuthHeaders, getMidiInstrumentsCount, refreshCredits, requireAccessToken, t, updateMidiTrackState]);

  const handleGenerateMidi = useCallback(async (
    trackId: string,
    options?: { separationTaskId?: string }
  ) => {
    const midiCreditCost = CLIENT_FEATURE_CREDITS.generate_midi.credits;
    if ((credits ?? 0) < midiCreditCost) {
      openPricingModal();
      return;
    }

    try {
      const accessToken = await requireAccessToken(() => {
        toast.error(t("toasts.authRequired"));
      });
      if (!accessToken) {
        return;
      }

      resetMidiTrackState(trackId, 'generating');

      const response = await fetch('/api/generate-midi', {
        method: 'POST',
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify({
          trackId,
          separationTaskId: options?.separationTaskId,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        const errorMessage = result?.error || result?.message || t("toasts.failedStartMidiGeneration");

        if (response.status === 402 || result?.insufficientCredits) {
          if (refreshCredits) {
            await refreshCredits();
          }
          openPricingModal();
        }

        updateMidiTrackState(trackId, {
          status: 'error',
          midiData: undefined,
          errorMessage,
        });

        toast.error(errorMessage);
        return;
      }

      const generatedTaskId = typeof result.data?.taskId === 'string' ? result.data.taskId : undefined;

      if (result.data?.status === 'completed' && result.data?.midiData) {
        const instrumentsCount = getMidiInstrumentsCount(result.data.midiData);

        updateMidiTrackState(trackId, {
          status: 'completed',
          taskId: generatedTaskId,
          instrumentsCount,
          midiData: result.data.midiData,
          errorMessage: undefined,
        });
        toast.success(t("toasts.midiReady"));
        return;
      }

      if (!generatedTaskId) {
        updateMidiTrackState(trackId, {
          status: 'error',
          midiData: undefined,
          errorMessage: 'Missing MIDI task id from API response.',
        });
        toast.error(t("toasts.failedStartMidiGeneration"));
        return;
      }

      resetMidiTrackState(trackId, 'generating', generatedTaskId);

      toast.success(t("toasts.midiGenerationStarted"));
      await startMidiStatusPolling(trackId, generatedTaskId);
    } catch (error) {
      console.error('Generate MIDI error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate MIDI';
      updateMidiTrackState(trackId, {
        status: 'error',
        midiData: undefined,
        errorMessage,
      });
      toast.error(errorMessage);
    }
  }, [credits, getJsonAuthHeaders, getMidiInstrumentsCount, openPricingModal, refreshCredits, requireAccessToken, resetMidiTrackState, startMidiStatusPolling, t, updateMidiTrackState]);

  const openRemovalDialogForMode = useCallback(async (
    trackId: string,
    mode: 'separate_vocal' | 'split_stem'
  ) => {
    const track = findTrackById(trackId);
    try {
      const accessToken = await requireAccessToken(() => {
        toast.error(t("toasts.authRequired"));
      });
      if (!accessToken) {
        return;
      }

      const trackTitle = track?.title || unknownTrackLabel;
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(trackTitle);
      setCurrentProcessingFeatureMode(mode);
      setShowTrackProcessingDialog(true);
      setShowMidiResultDialog(false);
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'checking',
        progress: 0,
        errorMessage: undefined,
        taskId: undefined,
        vocalUrl: undefined,
        instrumentalUrl: undefined,
        separationType: mode,
        stemsData: null,
      });

      if (mode === 'split_stem') {
        resetMidiTrackState(trackId, 'idle');
      }

      const statusResponse = await fetch(`/api/vocal/removal-status?trackId=${trackId}`, {
        headers: getAuthHeaders(accessToken),
      });

      let completedRemoval: any = null;
      let processingRemoval: any = null;

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        const statusRecords = getResponseArrayData(statusResult);
        if (statusResult.success && statusRecords.length > 0) {
          if (mode === 'split_stem') {
            completedRemoval =
              statusRecords.find(
                (r: any) =>
                  r.status === 'completed' &&
                  r.separationType === 'split_stem' &&
                  r.stemsData &&
                  Object.keys(r.stemsData).length > 0
              ) || null;
            processingRemoval =
              statusRecords.find(
                (r: any) =>
                  r.status === 'processing' &&
                  r.taskId &&
                  r.separationType === 'split_stem'
              ) || null;
          } else {
            completedRemoval =
              statusRecords.find(
                (r: any) =>
                  r.status === 'completed' &&
                  r.separationType !== 'split_stem' &&
                  (r.vocalUrl || r.instrumentalUrl)
              ) ||
              statusRecords.find(
                (r: any) =>
                  r.status === 'completed' &&
                  (r.vocalUrl || r.instrumentalUrl)
              ) ||
              null;
            processingRemoval =
              statusRecords.find(
                (r: any) =>
                  r.status === 'processing' &&
                  r.taskId &&
                  r.separationType !== 'split_stem'
              ) || null;
          }
        }
      }

      if (completedRemoval) {
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'completed',
          progress: 100,
          taskId: completedRemoval.taskId,
          vocalUrl: mode === 'separate_vocal' ? completedRemoval.vocalUrl : undefined,
          instrumentalUrl: mode === 'separate_vocal' ? completedRemoval.instrumentalUrl : undefined,
          separationType: mode,
          stemsData: mode === 'split_stem' ? (completedRemoval.stemsData || null) : null,
        });
        return;
      }

      if (processingRemoval) {
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'processing',
          progress: 10,
          taskId: processingRemoval.taskId,
          vocalUrl: mode === 'separate_vocal' ? processingRemoval.vocalUrl : undefined,
          instrumentalUrl: mode === 'separate_vocal' ? processingRemoval.instrumentalUrl : undefined,
          separationType: mode,
          stemsData: mode === 'split_stem' ? (processingRemoval.stemsData || null) : null,
        });
        vocalRemovalManager.startPolling(trackId, processingRemoval.taskId);
        return;
      }

      vocalRemovalManager.updateTrackState(trackId, {
        status: 'ready',
        progress: 0,
        taskId: undefined,
        vocalUrl: undefined,
        instrumentalUrl: undefined,
        separationType: mode,
        stemsData: null,
      });
    } catch (error) {
      console.error('Vocal removal error:', error);
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'error',
        progress: 0,
        errorMessage: error instanceof Error ? error.message : 'Failed to check separation status',
      });
    }
  }, [findTrackById, getAuthHeaders, getResponseArrayData, requireAccessToken, resetMidiTrackState, t, unknownTrackLabel, vocalRemovalManager]);

  const handleMidiAction = useCallback(async (trackId: string) => {
    if (!canGenerateMidi) {
      openPricingModal();
      return;
    }

    const track = findTrackById(trackId);
    const trackTitle = track?.title || unknownTrackLabel;

    try {
      clearMidiPollingForTrack(trackId);
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(trackTitle);
      setCurrentProcessingFeatureMode('split_stem');
      setShowTrackProcessingDialog(false);
      setShowMidiResultDialog(true);
      resetMidiTrackState(trackId, 'checking');

      const accessToken = await requireAccessToken(() => {
        updateMidiTrackState(trackId, {
          status: 'error',
          errorMessage: t("toasts.authRequired"),
        });
        toast.error(t("toasts.authRequired"));
      });
      if (!accessToken) {
        return;
      }

      const splitStemStatusResponse = await fetch(
        `/api/vocal/removal-status?trackId=${encodeURIComponent(trackId)}`,
        {
          headers: getAuthHeaders(accessToken),
        }
      );

      if (!splitStemStatusResponse.ok) {
        updateMidiTrackState(trackId, {
          status: 'error',
          errorMessage: t("toasts.failedCheckSplitStemStatus"),
        });
        toast.error(t("toasts.failedCheckSplitStemStatus"));
        return;
      }

      const splitStemStatusResult = await splitStemStatusResponse.json();
      const splitStemRecords = getResponseArrayData(splitStemStatusResult);

      const completedSplitStem = splitStemRecords.find(
        (record: any) =>
          record.status === 'completed' &&
          record.separationType === 'split_stem' &&
          record.stemsData &&
          Object.keys(record.stemsData).length > 0
      );

      if (!completedSplitStem) {
        updateMidiTrackState(trackId, {
          status: 'requires_split_stem',
          taskId: undefined,
          instrumentsCount: undefined,
          midiData: undefined,
          errorMessage: t("toasts.splitStemRequiredBeforeMidi"),
        });
        return;
      }

      vocalRemovalManager.updateTrackState(trackId, {
        status: 'completed',
        progress: 100,
        taskId: completedSplitStem.taskId,
        separationType: 'split_stem',
        stemsData: completedSplitStem.stemsData || null,
        vocalUrl: undefined,
        instrumentalUrl: undefined,
        errorMessage: undefined,
      });

      const midiStatusResponse = await fetch(`/api/midi-status?trackId=${encodeURIComponent(trackId)}`, {
        headers: getAuthHeaders(accessToken),
      });

      if (!midiStatusResponse.ok) {
        updateMidiTrackState(trackId, {
          status: 'error',
          errorMessage: t("toasts.failedCheckMidiStatus"),
        });
        toast.error(t("toasts.failedCheckMidiStatus"));
        return;
      }

      const midiStatusResult = await midiStatusResponse.json();
      const midiRecords = getResponseArrayData(midiStatusResult);

      const completedMidiRecord = midiRecords.find(
        (record: any) => record.status === 'completed' && record.midiData
      );

      if (completedMidiRecord) {
        const midiData = completedMidiRecord.midiData;
        const instrumentsCount = getMidiInstrumentsCount(midiData);

        clearMidiPollingForTrack(trackId);
        updateMidiTrackState(trackId, {
          status: 'completed',
          taskId: completedMidiRecord.taskId,
          instrumentsCount,
          midiData,
          errorMessage: undefined,
        });
        return;
      }

      const generatingMidiRecord = midiRecords.find(
        (record: any) =>
          record.status === 'generating' &&
          typeof record.taskId === 'string' &&
          record.taskId.trim().length > 0
      );

      if (generatingMidiRecord) {
        clearMidiPollingForTrack(trackId);
        resetMidiTrackState(trackId, 'generating', generatingMidiRecord.taskId);
        await startMidiStatusPolling(trackId, generatingMidiRecord.taskId);
        return;
      }

      await handleGenerateMidi(trackId, {
        separationTaskId: completedSplitStem.taskId,
      });
    } catch (error) {
      console.error('MIDI action error:', error);
      toast.error(error instanceof Error ? error.message : t("toasts.failedPrepareMidiAction"));
    }
  }, [
    canGenerateMidi,
    clearMidiPollingForTrack,
    findTrackById,
    handleGenerateMidi,
    openPricingModal,
    resetMidiTrackState,
    startMidiStatusPolling,
    getAuthHeaders,
    getMidiInstrumentsCount,
    getResponseArrayData,
    requireAccessToken,
    t,
    unknownTrackLabel,
    updateMidiTrackState,
    vocalRemovalManager,
  ]);

  const handleOpenSplitStemFromMidiDialog = useCallback(async () => {
    if (!currentProcessingTrackId) return;
    if (!canSplitStem) {
      openPricingModal();
      return;
    }
    setShowMidiResultDialog(false);
    await openRemovalDialogForMode(currentProcessingTrackId, 'split_stem');
  }, [canSplitStem, currentProcessingTrackId, openPricingModal, openRemovalDialogForMode]);

  // 处理 Vocal Removal：仅 separate_vocal 模式
  const handleVocalRemoval = useCallback(async (trackId: string) => {
    const track = findTrackById(trackId);
    if (track?.musicGeneration?.isInstrumental) {
      toast.error(t("toasts.instrumentalCannotVocalRemoval"));
      return;
    }
    await openRemovalDialogForMode(trackId, 'separate_vocal');
  }, [findTrackById, openRemovalDialogForMode, t]);

  // 处理 Split Stem：独立入口
  const handleSplitStem = useCallback(async (trackId: string) => {
    if (!canSplitStem) {
      openPricingModal();
      return;
    }
    await openRemovalDialogForMode(trackId, 'split_stem');
  }, [canSplitStem, openPricingModal, openRemovalDialogForMode]);

  // 开始 Vocal Removal 处理
  const startVocalRemovalProcess = useCallback(async (
    trackId: string,
    options?: { force?: boolean; type?: 'separate_vocal' | 'split_stem' }
  ) => {
    try {
      const accessToken = await requireAccessToken(() => {
        toast.error(t("toasts.authRequired"));
      });
      if (!accessToken) {
        return;
      }
      
      const track = findTrackById(trackId);
      const trackTitle = track?.title || unknownTrackLabel;
      const requestedMode: 'separate_vocal' | 'split_stem' = options?.type === 'split_stem' ? 'split_stem' : 'separate_vocal';
      
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(trackTitle);
      setCurrentProcessingFeatureMode(requestedMode);
      setShowTrackProcessingDialog(true);
      setShowMidiResultDialog(false);

      resetMidiTrackState(trackId, 'idle');
      clearMidiPollingForTrack(trackId);
      
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'processing',
        progress: 0,
        errorMessage: undefined,
        taskId: undefined,
        vocalUrl: undefined,
        instrumentalUrl: undefined,
        separationType: requestedMode,
        stemsData: null,
      });

      const response = await fetch('/api/vocal/removal', {
        method: 'POST',
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify({
          trackId,
          type: requestedMode,
          force: !!options?.force,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to start vocal removal';
        let errorData: any = null;
        try {
          errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }

        const isPermissionDenied = response.status === 403 && (
          errorData?.error === 'Permission denied' ||
          (typeof errorData?.message === 'string' &&
            errorData.message.toLowerCase().includes('hobby plan'))
        );

        if (isPermissionDenied) {
          vocalRemovalManager.updateTrackState(trackId, {
            status: 'ready',
            progress: 0,
            errorMessage: undefined,
            separationType: requestedMode,
          });
          setShowTrackProcessingDialog(false);
          setCurrentProcessingTrackId(null);
          setCurrentProcessingTrackTitle('');
          setCurrentProcessingFeatureMode('separate_vocal');
          openPricingModal();
          return;
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
            separationType: result.data.type || requestedMode,
            stemsData: result.data.stemsData || null,
          });
          return;
        }

        const taskId = result.data.taskId;
        
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'processing',
          taskId,
          separationType: result.data.type || requestedMode,
          stemsData: null,
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
  }, [clearMidiPollingForTrack, findTrackById, getJsonAuthHeaders, openPricingModal, requireAccessToken, resetMidiTrackState, t, unknownTrackLabel, vocalRemovalManager]);

  // 渲染空状态
  const showEmptyState = !isLoading && (!userTracks || userTracks.length === 0 || allTracks.length === 0) 
    && stableGeneratedTracks.length === 0;

  const shouldShowLoadMore = Boolean(onLoadMore) && !searchQuery.trim() && hasMore;
  const shouldShowNoResults = currentTracks.length === 0 && (Boolean(searchQuery.trim()) || hasActiveTypeFilter);
  const allTracksSummaryText = useMemo(() => {
    const totalSongs = summary?.totalTracks ?? allTracksCombined.length;
    const totalDuration = summary?.totalDuration
      ?? allTracksCombined.reduce((sum, track) => {
        const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
        return sum + (isNaN(duration) ? 0 : duration);
      }, 0);
    const durationText = formatDurationInMinutes(totalDuration);
    const songLabel = totalSongs > 1 ? t("studioTracks.songPlural") : t("studioTracks.songSingular");
    const songsText = `${totalSongs} ${songLabel}`;
    return durationText
      ? t("studioTracks.summaryWithDuration", { songs: songsText, duration: durationText })
      : songsText;
  }, [allTracksCombined, summary, t]);
  const currentVocalRemovalState = currentProcessingTrackId
    ? vocalRemovalManager.getTrackState(currentProcessingTrackId)
    : null;
  const currentMidiTrackState: MidiTrackState = currentProcessingTrackId
    ? getMidiTrackState(currentProcessingTrackId)
    : { status: 'idle' };

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
                alt={t("studioTracks.noTracksYetAlt")}
                width={96}
                height={96}
                className="h-20 w-20 opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-foreground">
              {t("studioTracks.noTracksData")}
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed">
              {t("studioTracks.noTracksDescription")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Search Bar */}
      <div className="flex-shrink-0 px-3 pt-4 md:pt-4 pb-3">
        <div className="studio-panel-card rounded-2xl p-2.5 md:p-3">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative h-11 flex-1 rounded-xl bg-background/70 text-foreground/90 transition-colors">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/55" />
                <input
                  type="text"
                  placeholder={t("studioTracks.searchBySongTitle")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-full w-full rounded-xl bg-transparent pl-10 pr-9 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                    aria-label={t("common.clear")}
                    title={t("common.clear")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {onCreate && (
                  <button
                    type="button"
                    onClick={onCreate}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                    aria-label={t("studioTracks.startCreating")}
                    title={t("studioTracks.startCreating")}
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 min-w-[130px] items-center justify-center gap-1.5 rounded-xl bg-background/70 px-3 text-xs md:text-sm font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
                      aria-label={t("studioTracks.filterTracksByType")}
                      title={t("studioTracks.filterTracksByType")}
                    >
                      {React.createElement(selectedTypeFilterOption.icon, { className: "h-3.5 w-3.5" })}
                      <span className="truncate">{selectedTypeFilterOption.label}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {trackTypeFilterOptions.map((option) => {
                      const isSelected = option.value === selectedTypeFilter;
                      return (
                        <React.Fragment key={option.value}>
                          {option.value === "disliked" && <DropdownMenuSeparator className="my-1" />}
                          <DropdownMenuItem
                            onClick={() => setSelectedTypeFilter(option.value)}
                            className="group flex items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs md:text-sm transition-colors hover:bg-black/5 focus:bg-black/5 data-[highlighted]:bg-black/5 dark:hover:bg-white/5 dark:focus:bg-white/5 dark:data-[highlighted]:bg-white/5"
                          >
                            {option.value === 'all' ? (
                              <span className="flex min-w-0 items-start gap-2">
                                {React.createElement(option.icon, {
                                  className: `mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-foreground/60"}`
                                })}
                                <span className="min-w-0">
                                  <span className="block font-medium leading-tight text-foreground">
                                    {option.label}
                                  </span>
                                  <span className="block text-[11px] leading-tight text-muted-foreground/80">
                                    {allTracksSummaryText}
                                  </span>
                                </span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                {React.createElement(option.icon, {
                                  className: `h-4 w-4 ${isSelected ? "text-primary" : "text-foreground/60"}`
                                })}
                                <span className="font-medium text-foreground">{option.label}</span>
                              </span>
                            )}
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
                  className={`inline-flex h-10 min-w-[112px] items-center justify-center gap-1.5 rounded-xl bg-background/70 px-3 text-xs md:text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground ${
                    createdAtSortOrder === 'desc'
                      ? 'text-foreground'
                      : 'text-foreground/80'
                  }`}
                  aria-label={createdAtSortOrder === 'desc' ? t("studioTracks.sortByNewestFirst") : t("studioTracks.sortByOldestFirst")}
                  title={createdAtSortOrder === 'desc' ? t("studioTracks.sortedNewestFirst") : t("studioTracks.sortedOldestFirst")}
                  aria-pressed={createdAtSortOrder === 'asc'}
                >
                  <ArrowDownUp
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      createdAtSortOrder === 'asc' ? 'rotate-180' : ''
                    }`}
                  />
                  <span>{createdAtSortOrder === 'desc' ? t("studioTracks.newest") : t("studioTracks.oldest")}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-hidden">
        <div 
          className="h-full overflow-y-auto scrollbar-hidden px-0 relative"
          ref={scrollContainerRef}
          style={{
            paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 0.5rem)' : '5rem'
          }}
        >
        <div className="relative min-h-full">
          {isLoading ? (
            <TrackListSkeleton />
          ) : (
            <>
            {/* All Tracks (包含 generatedTracks 和 userTracks，统一平铺间距) */}
          {flatTracks.length > 0 && (
            <div className="space-y-2.5 px-3 pb-1">
              {flatTracks.map((track) => {
                const isGeneratedTrack = track.isGenerating !== undefined || track.isPlaceholder !== undefined;
                const isSelectedTrack = selectedTrack === track.id;
                const canFloatOnHover = !track.isError && !track.isPlaceholder;
                const isSoundTrack = track.musicType === 'generated_sound';
                return (
                  <div
                    key={track.id}
                    className={`studio-panel-card overflow-hidden rounded-2xl p-0 ${
                      isSelectedTrack
                        ? "md:-translate-y-0.5 shadow-[0_16px_38px_rgba(2,8,23,0.14)] dark:shadow-[0_20px_46px_rgba(0,0,0,0.48)]"
                        : canFloatOnHover
                          ? "transform-gpu transition-[transform,box-shadow,background-color] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none md:hover:-translate-y-1 md:hover:shadow-[0_18px_42px_rgba(2,8,23,0.18)] dark:md:hover:shadow-[0_24px_56px_rgba(0,0,0,0.52)]"
                          : ""
                    }`}
                  >
                    <TrackItem
                      track={track}
                      variant="studio"
                      isSelected={isSelectedTrack}
                      isPlaying={globalAudioState.isPlaying}
                      isCurrentTrack={globalAudioState.currentPlayingTrackId === track.id}
                      isCopied={copiedTrackId === track.id}
                      modelBadgePlacement="title"
                      canDownloadMP3={canDownloadMP3}
                      canDownloadWAV={canDownloadWAV}
                      canDownloadMP4={canDownloadMP4}
                      canDownloadCover={canDownloadCover}
                      canVocalRemoval={!isSoundTrack && canVocalRemoval}
                      canSplitStem={!isSoundTrack && canSplitStem}
                      canGenerateMidi={!isSoundTrack && canGenerateMidi}
                      canExtendMusic={!isSoundTrack && canExtendMusic}
                      canReplaceSection={!isSoundTrack && canReplaceSection}
                      canCreatePersona={!isSoundTrack && canCreatePersona}
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
                      onVocalRemoval={!isSoundTrack ? () => handleVocalRemoval(track.id) : undefined}
                      onSplitStem={!isSoundTrack ? () => handleSplitStem(track.id) : undefined}
                      onGenerateMidi={!isSoundTrack ? () => handleMidiAction(track.id) : undefined}
                      onExtendMusic={!isSoundTrack ? () => handleExtendMusic(track.id) : undefined}
                      onReplaceSection={!isSoundTrack ? () => handleReplaceSection(track.id) : undefined}
                      onCreatePersona={!isSoundTrack ? () => handleCreatePersonaFromTrack(track) : undefined}
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
            <div className="absolute inset-0 flex items-center justify-center px-3">
              <div className="w-full max-w-[560px] px-6 py-9 text-center">
                <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background/65 text-foreground/60 dark:border-white/15 dark:bg-white/[0.08]">
                  <Search className="h-4 w-4" strokeWidth={1.9} />
                </div>

                <h3 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
                  {searchQuery.trim() ? t("studioTracks.noMatchingTracks") : t("studioTracks.noTracksInType")}
                </h3>

                <p className="mx-auto mt-2 max-w-[44ch] text-sm md:text-base text-muted-foreground leading-relaxed">
                  {searchQuery.trim()
                    ? t("studioTracks.noTracksForQuery", { query: searchQuery })
                    : t("studioTracks.noTracksForType", { type: selectedTypeFilterOption.label })}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTypeFilter('all');
                    }}
                    className="inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-foreground/80 studio-panel-card transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {t("studioTracks.reset")}
                  </button>

                  {onCreate && (
                    <button
                      type="button"
                      onClick={onCreate}
                      className="inline-flex h-10 items-center justify-center rounded-2xl bg-gradient-create px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      {t("studioTracks.startCreating")}
                    </button>
                  )}
                </div>
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

      {currentProcessingTrackId && currentProcessingFeatureMode === 'separate_vocal' && (
        <VocalRemovalProgressDialog
          isOpen={showTrackProcessingDialog}
          onClose={() => {
            setShowTrackProcessingDialog(false);
            const status = currentVocalRemovalState?.status;
            if (status === 'completed' || status === 'error' || status === 'ready') {
              setCurrentProcessingTrackId(null);
              setCurrentProcessingTrackTitle('');
              setCurrentProcessingFeatureMode('separate_vocal');
            }
          }}
          onReSeparate={() => startVocalRemovalProcess(currentProcessingTrackId, {
            force: true,
            type: 'separate_vocal',
          })}
          onStartSeparation={() => {
            if ((credits ?? 0) < CLIENT_VOCAL_SEPARATION_CREDITS.studio) {
              openPricingModal();
              return;
            }
            startVocalRemovalProcess(currentProcessingTrackId, { type: 'separate_vocal' });
          }}
          trackTitle={currentProcessingTrackTitle}
          progress={currentVocalRemovalState?.progress || 0}
          status={currentVocalRemovalState?.status || 'checking'}
          errorMessage={
            currentVocalRemovalState?.status === 'error'
              ? currentVocalRemovalState?.errorMessage || t("toasts.vocalSeparationFailedTryAgain")
              : undefined
          }
          vocalUrl={currentVocalRemovalState?.vocalUrl}
          instrumentalUrl={currentVocalRemovalState?.instrumentalUrl}
        />
      )}

      {currentProcessingTrackId && currentProcessingFeatureMode === 'split_stem' && (
        <SplitStemProgressDialog
          isOpen={showTrackProcessingDialog}
          onClose={() => {
            setShowTrackProcessingDialog(false);
            const status = currentVocalRemovalState?.status;
            if (status === 'completed' || status === 'error' || status === 'ready') {
              setCurrentProcessingTrackId(null);
              setCurrentProcessingTrackTitle('');
              setCurrentProcessingFeatureMode('separate_vocal');
            }
          }}
          onStartSplitStem={() => {
            if ((credits ?? 0) < CLIENT_FEATURE_CREDITS.split_stem_from_music_studio.credits) {
              openPricingModal();
              return;
            }
            startVocalRemovalProcess(currentProcessingTrackId, { force: true, type: 'split_stem' });
          }}
          onReSplitStem={() => {
            if ((credits ?? 0) < CLIENT_FEATURE_CREDITS.split_stem_from_music_studio.credits) {
              openPricingModal();
              return;
            }
            startVocalRemovalProcess(currentProcessingTrackId, { force: true, type: 'split_stem' });
          }}
          trackTitle={currentProcessingTrackTitle}
          progress={currentVocalRemovalState?.progress || 0}
          status={currentVocalRemovalState?.status || 'checking'}
          errorMessage={
            currentVocalRemovalState?.status === 'error'
              ? currentVocalRemovalState?.errorMessage || t("toasts.splitStemFailedTryAgain")
              : undefined
          }
          stemsData={currentVocalRemovalState?.stemsData}
        />
      )}

      {currentProcessingTrackId && (
        <MidiResultDialog
          isOpen={showMidiResultDialog}
          onClose={() => {
            setShowMidiResultDialog(false);
            if (!showTrackProcessingDialog) {
              const status = currentVocalRemovalState?.status;
              if (
                currentMidiTrackState.status === 'requires_split_stem' ||
                status === 'completed' ||
                status === 'error' ||
                status === 'ready'
              ) {
                setCurrentProcessingTrackId(null);
                setCurrentProcessingTrackTitle('');
                setCurrentProcessingFeatureMode('separate_vocal');
              }
            }
          }}
          trackTitle={currentProcessingTrackTitle}
          midiStatus={currentMidiTrackState.status}
          midiErrorMessage={currentMidiTrackState.errorMessage}
          midiInstrumentsCount={currentMidiTrackState.instrumentsCount}
          midiData={currentMidiTrackState.midiData}
          onStartSplitStem={handleOpenSplitStemFromMidiDialog}
          splitStemRequiredMessage={t("toasts.splitStemRequiredBeforeMidi")}
          splitStemActionLabel={t("trackActions.splitStem")}
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
            <AlertDialogTitle className="text-lg sm:text-xl">{t("studioTracks.deleteTrackTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base whitespace-nowrap">
              {t("studioTracks.deleteTrackDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setTrackToDelete(null);
              }}
              className="w-full sm:w-[160px] h-10 rounded-lg"
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="w-full sm:w-[160px] h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
