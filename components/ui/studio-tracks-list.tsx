"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Music, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoadingState } from './loading-dots';
import { supabase } from "@/lib/supabase";
import { toast } from 'sonner';
import { LibraryTrack } from '@/types/track';
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { VocalRemovalProgressDialog } from './vocal-removal-progress-dialog';
import { ExtendMusicDialog, ExtendMusicParams } from './extend-music-dialog';
import { ReplaceSectionDialog, ReplaceSectionParams } from './replace-section-dialog';
import { CLIENT_VOCAL_SEPARATION_CREDITS } from '@/lib/credits-config';
import { useVocalRemovalManager } from '@/hooks/use-vocal-removal-manager';
import { TrackItem } from './track-item';
import { TrackGroup } from './track-group';
import { formatDurationInMinutes } from '@/lib/format-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  tags: string;
  prompt: string;
  isInstrumental: boolean;
  status: string;
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
  onTrackSelect?: (trackId: string) => void;
  onTrackPreview?: (track: any) => void;
  onTrackPlay?: (track: LibraryTrack, music: MusicGeneration) => void;
  selectedTrack?: string | null;
  generatedTracks?: any[];
  onGeneratedTrackSelect?: (trackId: string) => void;
  onDownload?: (track: LibraryTrack, music: MusicGeneration, format?: 'mp3' | 'wav' | 'cover') => void;
  onFavoriteToggle?: (track: LibraryTrack, music: MusicGeneration) => void;
  onDelete?: (track: LibraryTrack, music: MusicGeneration) => void;
  onPublishToggle?: (trackId: string, isPublished: boolean) => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  onEditMusicInfo?: (trackId: string, data: { title: string; coverImageUrl?: string }) => Promise<void>;
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
  extendMusicGetState?: (taskId: string) => any;
  extendMusicClearState?: (taskId: string) => void;
}

// 稳定的 no-op 函数，用于替代未提供的 extendMusicStartPolling
const noOpExtendMusicPolling = () => {};

export const StudioTracksList: React.FC<StudioTracksListProps> = React.memo(function StudioTracksList({
  userTracks,
  isLoading,
  onTrackSelect,
  onTrackPreview,
  onTrackPlay,
  selectedTrack,
  generatedTracks = [],
  onGeneratedTrackSelect,
  onDownload,
  onFavoriteToggle,
  onDelete,
  onPublishToggle,
  onEditTitle,
  onEditMusicInfo,
  hasPlayer = false,
  extendMusicStartPolling,
  extendMusicGetState,
  extendMusicClearState,
}) {
  
  const { user } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const { openModal: openPricingModal } = usePricingModal();
  const globalAudioState = useAudioPlayingState();
  const { hasPermission } = useFeaturePermissions();
  
  // 权限检查
  const canDownloadMP3 = hasPermission('download_mp3_track');
  const canDownloadWAV = hasPermission('download_wav_track');
  const canDownloadCover = hasPermission('download_cover_track');
  const canVocalRemoval = hasPermission('vocal_removal_studio');
  const canExtendMusic = hasPermission('extend_music');
  const canReplaceSection = hasPermission('replace_section');
  
  // UI 状态
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Vocal Removal 管理
  const vocalRemovalManager = useVocalRemovalManager();
  
  // Extend Music 函数（从父组件传递，确保使用同一个 hook 实例）
  // 使用 useMemo 稳定值，避免每次渲染创建新函数
  const startExtendMusicPolling = useMemo(
    () => extendMusicStartPolling || noOpExtendMusicPolling,
    [extendMusicStartPolling]
  );
  
  // Vocal Removal 弹窗状态
  const [showVocalRemovalConfirmDialog, setShowVocalRemovalConfirmDialog] = useState(false);
  const [pendingVocalRemovalTrackId, setPendingVocalRemovalTrackId] = useState<string | null>(null);
  const [existingVocalRemovalData, setExistingVocalRemovalData] = useState<{
    trackTitle: string;
    vocalUrl?: string;
    instrumentalUrl?: string;
    hasExistingResults?: boolean;
  } | null>(null);
  
  const [showVocalRemovalProgressDialog, setShowVocalRemovalProgressDialog] = useState(false);
  const [currentProcessingTrackId, setCurrentProcessingTrackId] = useState<string | null>(null);
  const [currentProcessingTrackTitle, setCurrentProcessingTrackTitle] = useState<string>('');
  
  // Extend Music 弹窗状态
  const [showExtendMusicDialog, setShowExtendMusicDialog] = useState(false);
  const [pendingExtendMusicTrackId, setPendingExtendMusicTrackId] = useState<string | null>(null);
  const [pendingExtendMusicTrackTitle, setPendingExtendMusicTrackTitle] = useState<string>('');
  const [pendingExtendMusicTrackDuration, setPendingExtendMusicTrackDuration] = useState<number>(120);
  const [pendingExtendMusicOriginalStyle, setPendingExtendMusicOriginalStyle] = useState<string>('');
  const [pendingExtendMusicAudioUrl, setPendingExtendMusicAudioUrl] = useState<string>('');

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
  
  // 将所有 tracks 展平
  const allTracks = userTracks.flatMap(music => {
    if (!music.allTracks || !Array.isArray(music.allTracks)) {
      return [];
    }
    return music.allTracks
      .filter(track => !(track.isDeleted ?? false))
      .map(track => ({
        ...track,
        isFavorited: track.isFavorited ?? false,
        coverR2Url: track.coverR2Url ?? undefined,
        musicTitle: music.title,
        musicTags: music.tags,
        musicGenre: music.genre,
        musicStatus: music.status,
        musicGeneration: music,
        isError: !track.audioUrl || track.audioUrl.trim() === '',
        errorMessage: (!track.audioUrl || track.audioUrl.trim() === '') ? 'Audio file missing' : undefined
      }));
  });

  // 搜索过滤
  const filterTracks = useCallback((tracks: any[]) => {
    if (!searchQuery.trim()) return tracks;
    const query = searchQuery.toLowerCase();
    return tracks.filter(track => {
      if (track.title?.toLowerCase().includes(query)) return true;
      if (track.musicTitle?.toLowerCase().includes(query)) return true;
      if (track.tags?.toLowerCase().includes(query)) return true;
      if (track.musicTags?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [searchQuery]);

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
      musicTitle: track.title,
      musicTags: track.tags || '',
      musicGenre: track.genre || '',
      musicStatus: track.isGenerating ? 'generating' : (track.isCompleted ? 'complete' : 'generating'),
      musicGeneration: {
        id: track.generationId,
        title: track.title,
        genre: track.genre || '',
        tags: track.tags || '',
        status: track.isGenerating ? 'generating' : (track.isCompleted ? 'complete' : 'generating'),
      } as MusicGeneration,
      isGenerating: track.isGenerating,
      isPlaceholder: track.isPlaceholder,
      isExtension: track.isExtension,
      isError: false,
      errorMessage: undefined,
    }));
  }, [generatedTracks]);

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

    // 按创建时间排序（最新的在前）
    tracksWithSource.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.musicGeneration?.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.musicGeneration?.createdAt || 0).getTime();
      return dateB - dateA; // 降序排列
    });

    return tracksWithSource;
  }, [currentTracks, allTracksCombined]);

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
    if (onTrackPreview) {
      onTrackPreview(track);
    }
    if (onTrackPlay) {
      onTrackPlay(track, track.musicGeneration);
    }
  }, [onTrackPlay, onTrackPreview]);
  
  // 处理分享
  const handleShare = useCallback((trackId: string) => {
    const url = `${window.location.origin}/track/${trackId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTrackId(trackId);
      setTimeout(() => setCopiedTrackId(null), 2000);
    });
  }, []);
  
  // 处理下载
  const handleDownload = useCallback((track: any, music: any, format: 'mp3' | 'wav' | 'cover' = 'mp3') => {
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
    // 检查用户是否登录
    if (!user) {
      toast.error('Please log in to extend music');
      return;
    }

    // 查找曲目（从所有 tracks 中查找）
    const track = findTrackById(trackId);
    if (!track) {
      toast.error('Track not found');
      return;
    }

    // 设置待处理的曲目信息并打开对话框
    setPendingExtendMusicTrackId(trackId);
    setPendingExtendMusicTrackTitle(track.title || 'Untitled Track');
    setPendingExtendMusicTrackDuration(track.duration || 120);
    setPendingExtendMusicOriginalStyle(track.musicGeneration?.genre || '');
    // 优先使用 audioUrl，如果没有则使用 streamAudioUrl
    setPendingExtendMusicAudioUrl(track.audioUrl || track.streamAudioUrl || '');
    setShowExtendMusicDialog(true);
  }, [user, findTrackById]);

  // 确认 Extend Music
  const handleConfirmExtendMusic = useCallback(async (params: ExtendMusicParams): Promise<{ taskId: string } | void> => {
    if (!pendingExtendMusicTrackId) return;

    // 获取原始 track 信息（从所有 tracks 中查找）
    const originalTrack = findTrackById(pendingExtendMusicTrackId);
    const trackTitle = params.defaultParamFlag 
      ? `${pendingExtendMusicTrackTitle} (Extended)`
      : (params.title || pendingExtendMusicTrackTitle);

    try {
      // 获取认证令牌
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      // 准备 API 请求数据
      const requestBody: any = {
        trackId: pendingExtendMusicTrackId,
        model: params.model,
        defaultParamFlag: params.defaultParamFlag,
      };

      // 如果是自定义模式，添加自定义参数
      if (!params.defaultParamFlag) {
        requestBody.prompt = params.prompt;
        requestBody.style = params.style;
        requestBody.title = params.title;
        requestBody.continueAt = params.continueAt;

        // 添加可选的高级参数
        if (params.vocalGender) requestBody.vocalGender = params.vocalGender;
        if (params.styleWeight !== undefined) requestBody.styleWeight = params.styleWeight;
        if (params.weirdnessConstraint !== undefined) requestBody.weirdnessConstraint = params.weirdnessConstraint;
        if (params.audioWeight !== undefined) requestBody.audioWeight = params.audioWeight;
        if (params.personaId) requestBody.personaId = params.personaId;
      }

      // 调用扩展音乐 API
      const response = await fetch('/api/extend-music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // 如果是积分不足错误，刷新积分余额以便用户看到最新状态
        if (response.status === 402 || errorData.insufficientCredits) {
          if (refreshCredits) {
            await refreshCredits();
          }
        }
        
        throw new Error(errorData.error || 'Failed to extend music');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const { taskId, musicId, initialTracks } = result.data;
        
        // 如果有初始占位 tracks，转换为 MusicGenerationTrack 格式并添加到 generatedTracks
        if (initialTracks && Array.isArray(initialTracks) && initialTracks.length > 0) {
          // 需要访问 updateTracks，但这里没有直接访问，需要通过 props 传递
          // 暂时通过 startExtendMusicPolling 传递 initialTracks
        }
        
        // 开始轮询（后台更新 tracks），传递 initialTracks
        startExtendMusicPolling(
          taskId,
          musicId,
          trackTitle,
          originalTrack?.musicGenre,
          originalTrack?.musicTags || pendingExtendMusicOriginalStyle,
          initialTracks // 传递初始占位 tracks
        );
        
        toast.success('Music extension started successfully!', {
          description: 'Your extended track is being generated.',
        });
        
        // 清理状态
        setPendingExtendMusicTrackId(null);
        setPendingExtendMusicTrackTitle('');
        setPendingExtendMusicTrackDuration(120);
        setPendingExtendMusicOriginalStyle('');
        setPendingExtendMusicAudioUrl('');
        
        // 刷新积分（不刷新页面）
        if (refreshCredits) {
          await refreshCredits();
        }
        
        // 返回 taskId，通知配置弹窗可以关闭了
        return { taskId };
      } else {
        throw new Error(result.error || 'Failed to extend music');
      }
      
    } catch (error: any) {
      console.error('Extend music error:', error);
      toast.error(error.message || 'Failed to extend music. Please try again.');
      return;
    }
  }, [pendingExtendMusicTrackId, findTrackById, startExtendMusicPolling, refreshCredits, pendingExtendMusicOriginalStyle, pendingExtendMusicTrackTitle]);

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
    setPendingReplaceSectionOriginalStyle(track.musicGeneration?.genre || '');
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
      const response = await fetch('/api/replace-section', {
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

  // 处理 Vocal Removal
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
      setCurrentProcessingTrackTitle(trackTitle);

      // 检查是否存在分离结果
      const statusResponse = await fetch(`/api/vocal-removal-status?trackId=${trackId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      let hasCompletedResults = false;
      let completedRemoval: any = null;

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        if (statusResult.success && statusResult.data && Array.isArray(statusResult.data) && statusResult.data.length > 0) {
          completedRemoval = statusResult.data.find((r: any) => {
            return r.status === 'completed' && (r.vocalUrl || r.instrumentalUrl);
          });
          
          if (completedRemoval) {
            hasCompletedResults = true;
          }
        }
      }

      // 显示确认弹窗
            setPendingVocalRemovalTrackId(trackId);
            setExistingVocalRemovalData({
              trackTitle: track?.title || 'Unknown Track',
        vocalUrl: completedRemoval?.vocalUrl,
        instrumentalUrl: completedRemoval?.instrumentalUrl,
        hasExistingResults: hasCompletedResults,
            });
            setShowVocalRemovalConfirmDialog(true);
    } catch (error) {
      console.error('Vocal removal error:', error);
    }
  }, [findTrackById]);

  // 开始 Vocal Removal 处理
  const startVocalRemovalProcess = useCallback(async (trackId: string) => {
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
      });

      const response = await fetch('/api/vocal-removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trackId,
          type: 'separate_vocal'
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

  // 确认重新分离
  const handleConfirmReSeparation = useCallback(() => {
    setShowVocalRemovalConfirmDialog(false);
    if (pendingVocalRemovalTrackId) {
      startVocalRemovalProcess(pendingVocalRemovalTrackId);
      setPendingVocalRemovalTrackId(null);
    }
  }, [pendingVocalRemovalTrackId, startVocalRemovalProcess]);

  // 查看已有结果
  const handleViewExistingResults = useCallback(() => {
    setShowVocalRemovalConfirmDialog(false);
    if (existingVocalRemovalData?.hasExistingResults && pendingVocalRemovalTrackId) {
      const trackId = pendingVocalRemovalTrackId;
      
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(existingVocalRemovalData.trackTitle);
      
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'completed',
        progress: 100,
          vocalUrl: existingVocalRemovalData.vocalUrl,
          instrumentalUrl: existingVocalRemovalData.instrumentalUrl,
      });
      
      setShowVocalRemovalProgressDialog(true);
    }
    setPendingVocalRemovalTrackId(null);
  }, [existingVocalRemovalData, pendingVocalRemovalTrackId, vocalRemovalManager]);

  // 渲染 Loading 状态
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <LoadingState message="Loading your tracks..." size="lg" vertical />
      </div>
    );
  }

  // 渲染空状态
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
      {/* Search Bar */}
      <div className="flex-shrink-0 pt-6 pb-3">
        <div className="rounded-[28px] p-1.5">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <input
              type="text"
              placeholder="Search by title and tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-10 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-0"
            />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-hidden">
        <div 
          className="h-full overflow-y-auto px-0 relative"
          style={{
            paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 1.5rem)' : '5rem'
          }}
        >
        <div className="relative">
            {/* All Tracks (包含 generatedTracks 和 userTracks，使用分组显示) */}
          {flatTracks.length > 0 && (
            <div className="space-y-1">
              {flatTracks.map((track) => {
                // 判断是否为 generated track（通过检查是否有 isGenerating 或 isPlaceholder 属性）
                const isGeneratedTrack = track.isGenerating !== undefined || track.isPlaceholder !== undefined;

                // 直接渲染 TrackItem，平铺显示
                return (
                  <div
                    key={track.id}
                    className="rounded-[28px] p-1.5"
                  >
                    <TrackItem
                      track={track}
                      isSelected={selectedTrack === track.id}
                      isPlaying={globalAudioState.isPlaying}
                      isCurrentTrack={globalAudioState.currentPlayingTrackId === track.id}
                      isCopied={copiedTrackId === track.id}
                        canDownloadMP3={canDownloadMP3}
                      canDownloadWAV={canDownloadWAV}
                      canDownloadCover={canDownloadCover}
                      canVocalRemoval={canVocalRemoval}
                      canExtendMusic={canExtendMusic}
                      canReplaceSection={canReplaceSection}
                      onSelect={() => {
                        if (isGeneratedTrack && !track.isError && track.audioUrl && onGeneratedTrackSelect) {
                          onTrackPreview?.(track);
                          onGeneratedTrackSelect(track.id);
                        } else {
                          handleTrackSelect(track);
                        }
                      }}
                      onPlayPause={() => handlePlayPause(track)}
                      onFavoriteToggle={onFavoriteToggle ? () => handleFavoriteToggle(track) : undefined}
                      onShare={() => handleShare(track.id)}
                      onDownload={onDownload ? (format) => handleDownload(track, track.musicGeneration, format) : undefined}
                      onVocalRemoval={() => handleVocalRemoval(track.id)}
                      onExtendMusic={() => handleExtendMusic(track.id)}
                      onReplaceSection={() => handleReplaceSection(track.id)}
                      onDelete={onDelete ? () => handleDelete(track.id) : undefined}
                      onPricingModalOpen={openPricingModal}
                      onPublishToggle={onPublishToggle}
                      onEditTitle={onEditTitle}
                      onEditMusicInfo={onEditMusicInfo}
                    />
                  </div>
                );
              })}
              
              {/* Tracks Summary */}
              {currentTracks.length > 0 && (
                <div className="flex justify-center items-center py-2 px-4">
                  <div className="text-sm text-muted-foreground font-medium">
                    {(() => {
                      const totalSongs = currentTracks.length;
                      const totalDuration = currentTracks.reduce((sum, track) => {
                        const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
                        return sum + (isNaN(duration) ? 0 : duration);
                      }, 0);
                        const durationText = formatDurationInMinutes(totalDuration);
                      return `${totalSongs} song${totalSongs > 1 ? 's' : ''}${durationText ? `, ${durationText}` : ''}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

            {/* No Search Results */}
          {searchQuery && currentTracks.length === 0 && (
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
      
      {/* Vocal Removal 确认弹窗 */}
      <AlertDialog open={showVocalRemovalConfirmDialog} onOpenChange={setShowVocalRemovalConfirmDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <button
            onClick={() => {
              setShowVocalRemovalConfirmDialog(false);
              setPendingVocalRemovalTrackId(null);
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {existingVocalRemovalData?.hasExistingResults 
                ? 'Separation Result Exists' 
                : 'Confirm Vocal Removal'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {existingVocalRemovalData && (
                <span>
                  {existingVocalRemovalData.hasExistingResults ? (
                    <>
                      &quot;{existingVocalRemovalData.trackTitle}&quot; already has separation results. Do you want to separate again? It will cost <span className="font-semibold text-primary">{CLIENT_VOCAL_SEPARATION_CREDITS.studio}</span> credits.
                    </>
                  ) : (
                    <>
                      Separate &quot;{existingVocalRemovalData.trackTitle}&quot; into vocals and instrumental? This will cost <span className="font-semibold text-primary">{CLIENT_VOCAL_SEPARATION_CREDITS.studio}</span> credits.
                    </>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            {existingVocalRemovalData?.hasExistingResults ? (
              <>
            <AlertDialogCancel 
              onClick={handleConfirmReSeparation}
              className="w-full sm:w-auto"
            >
                  Separate
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleViewExistingResults}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
                  View
            </AlertDialogAction>
              </>
            ) : (
              <>
                <AlertDialogCancel className="w-full sm:w-auto">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleConfirmReSeparation}
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Confirm
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vocal Removal 进度弹窗 */}
      {currentProcessingTrackId && (
        <VocalRemovalProgressDialog
          isOpen={showVocalRemovalProgressDialog}
          onClose={() => {
            setShowVocalRemovalProgressDialog(false);
            const status = vocalRemovalManager.getTrackState(currentProcessingTrackId).status;
            if (status === 'completed' || status === 'error') {
              setCurrentProcessingTrackId(null);
              setCurrentProcessingTrackTitle('');
            }
          }}
          trackTitle={currentProcessingTrackTitle}
          progress={vocalRemovalManager.getTrackState(currentProcessingTrackId).progress || 0}
          status={vocalRemovalManager.getTrackState(currentProcessingTrackId).status || 'processing'}
          errorMessage={
            vocalRemovalManager.getTrackState(currentProcessingTrackId).status === 'error'
              ? vocalRemovalManager.getTrackState(currentProcessingTrackId).errorMessage || 'Vocal removal failed. Please try again.'
              : undefined
          }
          vocalUrl={vocalRemovalManager.getTrackState(currentProcessingTrackId).vocalUrl}
          instrumentalUrl={vocalRemovalManager.getTrackState(currentProcessingTrackId).instrumentalUrl}
        />
      )}

      {/* Extend Music 对话框 */}
      <ExtendMusicDialog
        isOpen={showExtendMusicDialog}
        onClose={() => {
          setShowExtendMusicDialog(false);
          setPendingExtendMusicTrackId(null);
          setPendingExtendMusicTrackTitle('');
          setPendingExtendMusicTrackDuration(120);
          setPendingExtendMusicOriginalStyle('');
          setPendingExtendMusicAudioUrl('');
        }}
        onConfirm={handleConfirmExtendMusic}
        trackTitle={pendingExtendMusicTrackTitle}
        trackDuration={pendingExtendMusicTrackDuration}
        originalStyle={pendingExtendMusicOriginalStyle}
        audioUrl={pendingExtendMusicAudioUrl}
        userCredits={credits ?? undefined}
        getExtendMusicState={extendMusicGetState}
      />

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
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg sm:text-xl">Delete Track</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Are you sure you want to delete &quot;{trackToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setTrackToDelete(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
