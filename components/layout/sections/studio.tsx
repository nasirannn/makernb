"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Custom Hooks
import { useMusicGeneration } from "@/features/music-generation/hooks/use-music-generation";
import { useLyricsGeneration } from "@/features/lyrics-cover/hooks/use-lyrics-generation";
import { useExtendMusic } from "@/features/music-upload/hooks/use-extend-music";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import {
    useStudioGenerationActions,
} from "@/hooks/use-studio-generation-actions";
import { useStudioTrackDownload } from "@/hooks/use-studio-track-download";
import { useStudioInlineTrackPanel } from "@/hooks/use-studio-inline-track-panel";
import { useStudioTrackPlayback } from "@/hooks/use-studio-track-playback";
import { useStudioUploadCoverAction } from "@/hooks/use-studio-upload-cover-action";
import { useStudioTrackActions } from "@/hooks/use-studio-track-actions";
import { useStudioUserTracks } from "@/hooks/use-studio-user-tracks";
import { getAudioService } from "@/lib/audio-service";
import { useTrackGenerationMonitor } from "@/features/music-generation/hooks/use-track-generation-monitor";
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";

// 导入统一的 Track 类型
import { StudioTrack } from "@/types/track";

// Components
import { CommonSidebar } from "@/components/ui/sidebar";
import { StudioTracksList } from "@/components/ui/studio-tracks-list";
import { InlineTrackDetailsPanel } from "@/components/ui/inline-track-details";
import { MusicPlayer } from "@/components/ui/music-player";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileStudioHeader } from "@/components/ui/mobile-studio-header";
import { MobileCreateDrawer } from "@/components/ui/mobile-create-drawer";
import { GenerationConfirmDialog } from "@/components/ui/generation-confirm-dialog";
import { DownloadProgressDialog } from "@/components/ui/download-progress-dialog";
import { Mp4BrandingDialog } from "@/components/ui/mp4-branding-dialog";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AuthModal from "@/components/ui/auth-modal";
import { LoadingDots } from "@/components/ui/loading-dots";
import { Music } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { ExtendSourceTrack } from "@/types/extend-track-source";
import type {
    GenerationStartOptions,
    StudioFeaturePanelProps,
    StudioFeaturePanelStateProps,
} from "@/types/studio-feature-panel";
import {
    getStudioFeaturePath,
    type StudioFeatureKey,
} from "@/lib/studio-features";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";
import { getZIndexClass } from "@/lib/z-index";

const USER_TRACKS_PAGE_SIZE = 10;

type StudioContentProps = {
    feature: StudioFeatureKey;
    FeaturePanel: React.ComponentType<StudioFeaturePanelProps>;
    panelMode: "simple" | "custom";
    lockPanelMode: boolean;
};

const StudioContent = ({ feature, FeaturePanel, panelMode, lockPanelMode }: StudioContentProps) => {
    // Router 和 Search Params
    const router = useRouter();
    const searchParams = useSearchParams();

    // Custom Hooks
    const musicGeneration = useMusicGeneration();
    const lyricsGeneration = useLyricsGeneration();
    const {
        isGenerating,
        generatedTracks,
        updateTracks,
        selectedModel,
        setSelectedModel,
    } = musicGeneration;
    const { user, signOut, loading: isAuthLoading } = useAuth();
    const { credits, refreshCredits } = useCredits();
    const { t, locale } = useI18n();
    const withCurrentLocale = React.useCallback((path: string) => withLocalePrefix(path, locale), [locale]);

    // UI States
    const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [trackToDelete, setTrackToDelete] = useState<any>(null);
    const [generationConfirmOpen, setGenerationConfirmOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [isWritingNextLyricLine, setIsWritingNextLyricLine] = useState(false);
    
    // 本地状态管理 - 替换zustand store
    const [selectedStudioTrack, setSelectedStudioTrack] = useState<StudioTrack | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const [pendingExtendSourceTrack, setPendingExtendSourceTrack] = useState<ExtendSourceTrack | null>(null);
    const [lyricsPanelOpen, setLyricsPanelOpen] = useState(false);
    const [musicGeneratorMode, setMusicGeneratorMode] = useState<"simple" | "custom">("simple");

    const normalizeDuration = React.useCallback((value: unknown) => {
        const parsed = typeof value === 'string' ? parseFloat(value) : value;
        return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
    }, []);

    // ==================== 播放器状态管理 ====================
    const audioPlayer = useAudioPlayer();
    
    // 🎯 使用 ref 保存 audioPlayer 的最新引用，创建稳定的访问接口
    const audioPlayerRef = React.useRef(audioPlayer);
    audioPlayerRef.current = audioPlayer;
    
    // 🎯 创建稳定的播放器访问接口 - 统一使用 ref，避免依赖项问题
    const player = React.useMemo(() => ({
        get currentTrack() { return audioPlayerRef.current.currentTrack; },
        get isPlaying() { return audioPlayerRef.current.isPlaying; },
        get currentTime() { return audioPlayerRef.current.currentTime; },
        get duration() { return audioPlayerRef.current.duration; },
        get volume() { return audioPlayerRef.current.volume; },
        get isMuted() { return audioPlayerRef.current.isMuted; },
        playTrack: (track: any) => audioPlayerRef.current.playTrack(track),
        togglePlayPause: () => audioPlayerRef.current.togglePlayPause(),
        setVolume: (vol: number) => audioPlayerRef.current.setVolume(vol),
        toggleMute: () => audioPlayerRef.current.toggleMute(),
        seek: (time: number) => audioPlayerRef.current.seek(time),
        updateCurrentTrackDuration: (duration: number) => audioPlayerRef.current.updateCurrentTrackDuration(duration),
        clearCurrentTrack: () => audioPlayerRef.current.clearCurrentTrack(),
    }), []); // ✅ 空依赖，完全稳定
    
    // BPM Mode状态
    const [bpmMode, setBpmMode] = React.useState<'slow' | 'moderate' | 'medium' | ''>('');

    // ==================== 播放控制函数 ====================
    // 播放器控制函数 - 使用稳定的 player 接口，无需依赖项
    const togglePlayPause = React.useCallback(() => player.togglePlayPause(), [player]);
    const changeVolume = React.useCallback((vol: number) => player.setVolume(vol), [player]);
    const toggleMute = React.useCallback(() => player.toggleMute(), [player]);

    // Destructure from hook
    const {
        selectedGenre, setSelectedGenre,
        selectedVibe, setSelectedVibe,
        simplePrompt, setSimplePrompt,
        customLyrics, setCustomLyrics,
        songTitle, setSongTitle,
        instrumentalMode, setInstrumentalMode,
        isPublished,
        setIsPublished,
        styleText, setStyleText,
        bpm, setBpm,
        grooveType, setGrooveType,
        leadInstrument, setLeadInstrument,
        drumKit, setDrumKit,
        bassTone, setBassTone,
        vocalGender, setVocalGender,
        harmonyPalette, setHarmonyPalette,
        selectedPersonaId, setSelectedPersonaId,
        selectedPersonaModel, setSelectedPersonaModel,
        styleWeight, setStyleWeight,
        weirdnessConstraint, setWeirdnessConstraint,
        audioWeight, setAudioWeight,
        enhanceStyle, setEnhanceStyle,
        trackExistingTask,
    } = musicGeneration;

    const promptFromQuery = React.useMemo(() => {
        const value = searchParams?.get("prompt");
        return typeof value === "string" ? value.trim() : "";
    }, [searchParams]);
    const modeFromQuery = React.useMemo(() => {
        const value = searchParams?.get("mode");
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }, [searchParams]);
    const tabFromQuery = React.useMemo(() => {
        const value = searchParams?.get("tab");
        return typeof value === "string" ? value.trim().toLowerCase() : "";
    }, [searchParams]);
    const shouldForceLyricsModeFromQuery = React.useMemo(() => (
        modeFromQuery === "custom" || modeFromQuery === "lyrics" || tabFromQuery === "lyrics"
    ), [modeFromQuery, tabFromQuery]);
    const lyricsPrefillKeyFromQuery = React.useMemo(() => {
        const value = searchParams?.get("lyricsPrefillKey");
        return typeof value === "string" ? value.trim() : "";
    }, [searchParams]);
    const [lyricsPrefillPayload, setLyricsPrefillPayload] = React.useState<{ lyrics: string; title: string } | null>(null);
    const lyricsFromQuery = React.useMemo(() => {
        if (lyricsPrefillPayload?.lyrics) {
            return lyricsPrefillPayload.lyrics.trim();
        }
        const value = searchParams?.get("lyrics");
        return typeof value === "string" ? value.trim() : "";
    }, [lyricsPrefillPayload, searchParams]);
    const titleFromLyricsQuery = React.useMemo(() => {
        if (lyricsPrefillPayload?.title) {
            return lyricsPrefillPayload.title.trim();
        }
        const value = searchParams?.get("title");
        return typeof value === "string" ? value.trim() : "";
    }, [lyricsPrefillPayload, searchParams]);
    const lyricsPrefillSignature = React.useMemo(() => {
        if (lyricsPrefillKeyFromQuery) {
            return `key:${lyricsPrefillKeyFromQuery}`;
        }
        if (!lyricsFromQuery) {
            return "";
        }
        return `inline:${lyricsFromQuery}\n\ntitle:${titleFromLyricsQuery}`;
    }, [lyricsPrefillKeyFromQuery, lyricsFromQuery, titleFromLyricsQuery]);
    const appliedPromptFromQueryRef = React.useRef<string | null>(null);
    const appliedLyricsPrefillSignatureRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (!lyricsPrefillKeyFromQuery || typeof window === "undefined") {
            setLyricsPrefillPayload(null);
            return;
        }
        try {
            const rawPayload = window.sessionStorage.getItem(lyricsPrefillKeyFromQuery);
            if (!rawPayload) {
                return;
            }
            const parsed = JSON.parse(rawPayload) as { lyrics?: unknown; title?: unknown };
            const lyrics = typeof parsed?.lyrics === "string" ? parsed.lyrics.trim() : "";
            if (!lyrics) {
                return;
            }
            const title = typeof parsed?.title === "string" ? parsed.title.trim() : "";
            setLyricsPrefillPayload({ lyrics, title });
            window.sessionStorage.removeItem(lyricsPrefillKeyFromQuery);
        } catch (error) {
            console.warn("Failed to parse lyrics prefill payload:", error);
        }
    }, [lyricsPrefillKeyFromQuery]);

    React.useEffect(() => {
        if (feature !== "music-generator" || lockPanelMode) {
            return;
        }
        if (!shouldForceLyricsModeFromQuery) {
            return;
        }
        setMusicGeneratorMode("custom");
    }, [feature, lockPanelMode, shouldForceLyricsModeFromQuery]);

    React.useEffect(() => {
        if (feature !== "music-generator" || !promptFromQuery || shouldForceLyricsModeFromQuery) {
            return;
        }
        if (appliedPromptFromQueryRef.current === promptFromQuery) {
            return;
        }

        setSimplePrompt(promptFromQuery);
        if (!lockPanelMode) {
            setMusicGeneratorMode("simple");
        }
        appliedPromptFromQueryRef.current = promptFromQuery;
    }, [feature, lockPanelMode, promptFromQuery, setSimplePrompt, shouldForceLyricsModeFromQuery]);

    React.useEffect(() => {
        if (feature !== "music-generator" || !lyricsFromQuery) {
            return;
        }
        if (appliedLyricsPrefillSignatureRef.current === lyricsPrefillSignature) {
            return;
        }

        setCustomLyrics(lyricsFromQuery);
        if (titleFromLyricsQuery) {
            setSongTitle(titleFromLyricsQuery.slice(0, 80));
        }
        setPanelOpen(true);
        if (typeof window !== "undefined" && window.innerWidth < 768) {
            setMobileCreateOpen(true);
        }
        if (!lockPanelMode) {
            setMusicGeneratorMode("custom");
        }
        setInstrumentalMode(false);
        appliedLyricsPrefillSignatureRef.current = lyricsPrefillSignature;
    }, [
        feature,
        lockPanelMode,
        lyricsFromQuery,
        lyricsPrefillSignature,
        setCustomLyrics,
        setInstrumentalMode,
        setSongTitle,
        titleFromLyricsQuery,
    ]);

    const activeFeatureMode = React.useMemo<"simple" | "custom">(() => {
        if (feature === "music-generator" && !lockPanelMode) {
            return musicGeneratorMode;
        }
        return panelMode;
    }, [feature, lockPanelMode, musicGeneratorMode, panelMode]);

    const setActiveFeatureMode = React.useCallback((nextMode: "simple" | "custom") => {
        if (feature !== "music-generator" || lockPanelMode) {
            return;
        }
        setMusicGeneratorMode(nextMode);
    }, [feature, lockPanelMode]);

    const {
        userTracks,
        setUserTracks,
        userTracksSummary,
        setUserTracksSummary,
        hasMoreUserTracks,
        isFetchingMoreUserTracks,
        isFetchingUserTracks,
        handleLoadMoreUserTracks,
        fetchUserTracksByMode,
    } = useStudioUserTracks({
        userId: user?.id,
        isAuthLoading,
        pageSize: USER_TRACKS_PAGE_SIZE,
    });

    // 页面卸载时清理状态
    React.useEffect(() => {
        // 在 effect 内部捕获当前值，避免在清理函数中直接访问 ref
        const processedTracks = processedTracksRef.current;
        
        return () => {
            const audioService = getAudioService();
            audioService.stopAllAudio();
            setSelectedStudioTrack(null);
            // 🔧 清理已处理的歌曲记录
            processedTracks.clear();
        };
    }, []);

    // ==================== Track 对象管理 ====================
    // 统一的 track 查找函数（从 userTracks 中查找 track 和对应的 music）
    const findTrackAndMusic = React.useCallback((trackId: string) => {
        const track = userTracks.flatMap(gen => gen.allTracks || []).find((t: any) => t.id === trackId);
        if (!track) return { track: null, music: null };
        
        const music = userTracks.find(gen => gen.allTracks?.some((t: any) => t.id === trackId));
        return { track, music: music || null };
    }, [userTracks]);

    // 统一的 userTracks 更新函数
    const updateTrack = React.useCallback((
        trackId: string,
        updater: (track: any) => any
    ) => {
        setUserTracks((prevUserTracks) => 
            prevUserTracks.map(generation => ({
                ...generation,
                allTracks: generation.allTracks.map((t: any) =>
                    t.id === trackId ? updater(t) : t
                )
            }))
        );
    }, [setUserTracks]);

    // 统一的Track对象创建函数
    const createTrackObject = React.useCallback((
        id: string,
        generationId: string,
        title: string,
        audioUrl: string,
        duration: number,
        coverImage?: string,
        tags?: string,
        lyrics?: string,
        isFavorited: boolean = false,
        isLiked: boolean = false,
        isDisliked: boolean = false,
        streamAudioUrl?: string,
        createdAt?: string,
        generationMode?: string,
        sunoTrackId?: string | null
    ) => ({
        id,
        generationId,
        sunoTrackId: sunoTrackId ?? null,
        audioId: sunoTrackId ?? undefined,
        title,
        audioUrl,
        streamAudioUrl,
        duration,
        coverImage,
        coverR2Url: coverImage, // 使用驼峰命名
        tags,
        lyrics,
        generationMode,
        isFavorited: isFavorited, // 使用驼峰命名
        isLiked: isLiked,
        isDisliked: isDisliked,
        createdAt
    }), []);

    // 合并所有歌曲的所有 tracks 来创建完整的 track 列表
    const allTracks = React.useMemo(() => {
        const tracks: any[] = [];
        
        // 添加 generatedTracks 的 tracks
        generatedTracks.forEach(track => {
            tracks.push(createTrackObject(
                track.id || '',
                track.generationId || '',
                track.title || '',
                track.audioUrl || '',
                track.duration || 0,
                track.coverImage,
                track.tags,
                track.lyrics,
                track.isFavorited ?? false,
                track.isLiked ?? false,
                track.isDisliked ?? false,
                track.streamAudioUrl ?? '',
                track.createdAt || new Date().toISOString(),
                track.generationMode,
                track.sunoTrackId ?? null
            ));
        });
        
        // 添加 userTracks 的所有 tracks
        userTracks.forEach(music => {
            if (music.allTracks && music.allTracks.length > 0) {
                music.allTracks.forEach((track: any) => {
                    tracks.push(createTrackObject(
                        track.id,
                        music.id,
                        track.title || music.title || 'Untitled Track',
                        track.audioUrl ?? '',
                        track.duration,
                        track.coverR2Url ?? undefined,
                        music.tags,
                        track.lyrics ?? music.lyrics ?? '',
                        track.isFavorited ?? false,
                        track.isLiked ?? false,
                        track.isDisliked ?? false,
                        track.streamAudioUrl ?? '',
                        track.createdAt ?? music.createdAt ?? new Date().toISOString(),
                        music.generationMode,
                        track.sunoTrackId ?? track.suno_track_id ?? null
                    ));
                });
            }
        });        
        return tracks;
    }, [generatedTracks, userTracks, createTrackObject]);

    const extendSourceTracks = React.useMemo<ExtendSourceTrack[]>(() => {
        const deduped = new Map<string, ExtendSourceTrack>();

        allTracks.forEach((track) => {
            if (!track?.id) return;
            const audioUrl = (track.audioUrl || track.streamAudioUrl || '').trim();
            if (!audioUrl) return;

            deduped.set(track.id, {
                id: track.id,
                title: track.title || 'Untitled Track',
                audioUrl,
                duration: normalizeDuration(track.duration),
                audioId: (track.audioId || '').trim() || undefined,
                tags: track.tags || '',
                coverImage: track.coverImage,
                coverR2Url: track.coverR2Url,
                musicType: track.musicType,
                createdAt: track.createdAt,
            });
        });

        return Array.from(deduped.values()).sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateB - dateA;
        });
    }, [allTracks, normalizeDuration]);

    // 为 MusicPlayer 创建稳定的 tracks 数组，避免不必要的重新渲染
    const musicPlayerTracks = React.useMemo(() => {
        return allTracks.map(track => ({
            id: track.id,
            title: track.title,
            audioUrl: track.audioUrl,
            duration: track.duration,
            artist: track.tags || 'Unknown Artist',
            tags: track.tags,
            coverImage: track.coverImage,
            coverR2Url: track.coverR2Url,
            allTracks: [{
                id: track.id,
                audioUrl: track.audioUrl,
                duration: track.duration,
            }]
        }));
    }, [allTracks]);

    const {
        handleDownload,
        wavDownloadDialogOpen,
        wavDownloadProgress,
        wavDownloadStatus,
        wavDownloadStatusText,
        wavDownloadErrorMessage,
        wavDownloadTrackTitle,
        closeWavDownloadDialog,
        mp4DialogOpen,
        handleMp4DialogOpenChange,
        mp4Author,
        mp4DomainName,
        setMp4Author,
        setMp4DomainName,
        handleMp4Generate,
    } = useStudioTrackDownload({
        user,
    });

    const {
        playTrackById,
        handlePrevious,
        handleNext,
        handleTrackSelect,
        handleInlineTrackPreview,
        handleUserTrackSelect,
        handleUserTrackPlay,
        handleGeneratedTrackSelect,
        handlePlayerLyricsToggle,
    } = useStudioTrackPlayback({
        allTracks,
        generatedTracks,
        findTrackAndMusic,
        createTrackObject,
        player,
        selectedStudioTrack,
        lyricsPanelOpen,
        setSelectedStudioTrack,
        setLyricsPanelOpen,
    });

    // 传递 updateTracks 回调给 useExtendMusic，直接更新 generatedTracks
    // 延长音乐完成时，刷新 userTracks（数据已写入数据库）
    const extendMusic = useExtendMusic(
        updateTracks,
        () => fetchUserTracksByMode('merge')
    );

    // 监听状态机变化，当歌曲生成完成时更新播放器duration
    useEffect(() => {
        if (!player.currentTrack || generatedTracks.length === 0) return;
        
        // 查找当前播放的歌曲是否在 generatedTracks 中
        const currentTrackInGenerated = generatedTracks.find(track => track.id === player.currentTrack?.id);
        
        if (currentTrackInGenerated && currentTrackInGenerated.duration && currentTrackInGenerated.duration > 0) {
            // 如果当前播放的歌曲有新的duration信息，更新播放器
            player.updateCurrentTrackDuration(currentTrackInGenerated.duration);
        }
    }, [generatedTracks, player]);

    // 监听 EventBus 删除事件，更新本地状态
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const eventBus = getEventBus();
        if (!eventBus) return;

        const handleTrackDeleted = (data: { trackId: string }) => {
            const deletedTrackId = data.trackId;
            
            // 从 generatedTracks 中移除
            updateTracks((prevTracks) => 
                prevTracks.filter(track => track.id !== deletedTrackId)
            );

            // 从 userTracks 中更新（标记为已删除或直接过滤）
            setUserTracks((prevUserTracks) => {
                return prevUserTracks.map(generation => ({
                    ...generation,
                    allTracks: generation.allTracks
                        .map((t: any) => 
                            t.id === deletedTrackId
                                ? { ...t, isDeleted: true }
                                : t
                        )
                        .filter((t: any) => !(t.isDeleted ?? false))
                })).filter(generation => generation.allTracks.length > 0);
            });

            // 如果删除的是当前选中的 track，清空选中状态
            if (selectedStudioTrack?.id === deletedTrackId) {
                setSelectedStudioTrack(null);
            }
        };

        eventBus.on(TRACK_EVENTS.DELETED, handleTrackDeleted);

        return () => {
            eventBus.off(TRACK_EVENTS.DELETED, handleTrackDeleted);
        };
    }, [updateTracks, selectedStudioTrack, setUserTracks]);

    // Lyrics generation
    const {
        showLyricsDialog, setShowLyricsDialog,
        lyricsPrompt, setLyricsPrompt,
        isGeneratingLyrics,
        handleGenerateLyrics: handleGenerateLyricsHook,
    } = lyricsGeneration;

    // Event handlers
    const handleGenerate = React.useCallback(async () => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return false;
        }

        setSelectedStudioTrack(null);

        try {
            await musicGeneration.handleGenerate(
                refreshCredits, 
                () => setGenerationConfirmOpen(true),
                { modeOverride: activeFeatureMode }
            );
            return true;
        } catch (error) {
            console.error('Generation failed:', error);
            return false;
        }
    }, [activeFeatureMode, user?.id, musicGeneration, refreshCredits]);

    // Handle generation start - remove library loading
    const getModelLimits = React.useCallback((model: string) => {
        switch (model) {
            case "V4":
                return { prompt: 3000, style: 200, title: 80 };
            case "V4_5ALL":
                return { prompt: 5000, style: 1000, title: 80 };
            case "V4_5":
            case "V4_5PLUS":
            case "V5":
            default:
                return { prompt: 5000, style: 1000, title: 80 };
        }
    }, []);

    const handleUploadCover = useStudioUploadCoverAction({
        userId: user?.id,
        simplePrompt,
        customLyrics,
        styleText,
        songTitle,
        instrumentalMode,
        feature,
        activeFeatureMode,
        selectedModel,
        selectedPersonaId,
        selectedPersonaModel,
        isPublished,
        getModelLimits,
        refreshCredits,
        updateTracks,
        trackExistingTask,
        setIsAuthModalOpen,
        clearSelectedStudioTrack: () => setSelectedStudioTrack(null),
        openGenerationConfirm: () => setGenerationConfirmOpen(true),
    });

    const {
        handleMashupGenerationStart,
        handleUploadTransformGenerationStart,
        handleExtendGenerationStart,
    } = useStudioGenerationActions({
        userId: user?.id,
        customLyrics,
        styleText,
        songTitle,
        selectedModel,
        selectedPersonaId,
        vocalGender,
        getModelLimits,
        refreshCredits,
        trackExistingTask,
        setIsAuthModalOpen,
        openGenerationConfirm: () => setGenerationConfirmOpen(true),
    });

    const handleGenerationStart = React.useCallback(async (options?: GenerationStartOptions) => {
        if (options?.mode === 'mashup') {
            return await handleMashupGenerationStart(options);
        }

        if (options?.mode === 'vocal' || options?.mode === 'melody') {
            return await handleUploadTransformGenerationStart(options);
        }

        if (options?.mode === 'extend' && options?.trackId) {
            return await handleExtendGenerationStart(options);
        }

        if (options?.uploadFile || options?.uploadUrl) {
            return await handleUploadCover({
                uploadFile: options.uploadFile,
                uploadUrl: options.uploadUrl,
                audioDuration: options.audioDuration,
                mode: options.mode === "extend" ? "extend" : "cover",
                continueAt: options.continueAt,
                isPublished: options.isPublished,
                styleWeight: options.styleWeight,
                weirdnessConstraint: options.weirdnessConstraint,
                audioWeight: options.audioWeight,
            });
        }
        return await handleGenerate();
    }, [
        handleMashupGenerationStart,
        handleUploadTransformGenerationStart,
        handleExtendGenerationStart,
        handleUploadCover,
        handleGenerate,
    ]);

    // 移除自动关闭逻辑，让用户手动关闭确认弹窗
    const handleGenerateLyrics = React.useCallback(() => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return;
        }
        setShowLyricsDialog(true);
    }, [user?.id, setShowLyricsDialog]);

    const getAccessTokenOrThrow = React.useCallback(async () => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            throw new Error(t("toasts.failedGetSessionTryLogInAgain"));
        }

        if (!session?.access_token) {
            throw new Error(t("toasts.pleaseLogInToContinue"));
        }

        return session.access_token;
    }, [t]);

    const getJsonAuthHeaders = React.useCallback((accessToken: string) => ({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
    }), []);

    const handleWriteNextLyricLine = React.useCallback(async () => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return;
        }

        const trimmedLyrics = customLyrics.trim();
        if (!trimmedLyrics) {
            toast.error(t("toasts.pleaseEnterLyrics"));
            return;
        }

        setIsWritingNextLyricLine(true);

        try {
            const accessToken = await getAccessTokenOrThrow();

            const response = await fetch('/api/lyrics/next-line', {
                method: 'POST',
                headers: getJsonAuthHeaders(accessToken),
                body: JSON.stringify({
                    lyrics: trimmedLyrics,
                }),
            });

            const result = await response.json().catch(() => ({}));

            if (!response.ok || !result?.success) {
                if (response.status === 401) {
                    throw new Error(t("toasts.sessionExpiredLogInAgain"));
                }
                throw new Error(result?.error || t("toasts.failedWriteNextLyricLine"));
            }

            const nextLine = typeof result?.data?.line === 'string' ? result.data.line.trim() : '';
            if (!nextLine) {
                throw new Error(t("toasts.modelReturnedEmptyPromptTryAgain"));
            }

            setCustomLyrics((prevLyrics) => {
                const baseLyrics = prevLyrics.trimEnd();
                return baseLyrics ? baseLyrics + '\n' + nextLine : nextLine;
            });
            toast.success(t("toasts.nextLyricLineAdded"));
        } catch (error) {
            console.error('Write next lyric line failed:', error);
            const message = error instanceof Error ? error.message : t("toasts.failedWriteNextLyricLine");
            toast.error(message);
        } finally {
            setIsWritingNextLyricLine(false);
        }
    }, [user?.id, customLyrics, getAccessTokenOrThrow, getJsonAuthHeaders, setCustomLyrics, setIsAuthModalOpen, t]);

    const {
        handleFavoriteToggle,
        handleLikeToggle,
        handleDislikeToggle,
        handleEditTitle,
        handleEditMusicInfo,
        openDeleteDialogForTrack,
        handleDeleteConfirm,
    } = useStudioTrackActions({
        userId: user?.id,
        userTracks,
        selectedStudioTrack,
        trackToDelete,
        normalizeDuration,
        updateTrack,
        updateTracks,
        setUserTracks,
        setUserTracksSummary,
        setSelectedStudioTrack,
        setTrackToDelete,
        setDeleteDialogOpen,
        setIsAuthModalOpen,
    });

    const handleTrackDelete = React.useCallback((track: any, _music: any) => {
        openDeleteDialogForTrack(track);
    }, [openDeleteDialogForTrack]);

    // ==================== 实时更新用户歌曲列表 ====================
    // 使用 ref 记录已处理的歌曲，防止重复添加
    const processedTracksRef = React.useRef<Set<string>>(new Set());
    
    // 将完成的歌曲直接添加到 userTracks，避免刷新整个列表
    const handleTrackCompleted = React.useCallback((completedTrack: StudioTrack) => {
        // 🔧 幂等性保护：检查是否已处理过该歌曲
        if (processedTracksRef.current.has(completedTrack.id)) {
            return;
        }
        
        // 标记为已处理
        processedTracksRef.current.add(completedTrack.id);
        
        // ✅ 方案1：立即从 generatedTracks 中移除该歌曲，避免重复显示
        // 🔧 使用函数式更新，避免闭包陷阱，确保基于最新状态过滤
        updateTracks((prevTracks) => 
            prevTracks.filter((t) => t.id !== completedTrack.id)
        );
        // 将完成的歌曲转换为 userTracks 格式
        const newUserTrack = {
            id: completedTrack.generationId || completedTrack.id,
            title: completedTrack.title,
            tags: completedTrack.tags || '',
            prompt: completedTrack.prompt || '', // 使用生成时的 prompt
            status: 'completed',
            createdAt: completedTrack.createdAt || new Date().toISOString(),
            lyricsContent: completedTrack.lyrics || '',
                allTracks: [{
                    id: completedTrack.id,
                    audioUrl: completedTrack.audioUrl || completedTrack.streamAudioUrl,
                    duration: completedTrack.duration || 0,
                    isPublished: false,
                    isPinned: false,
                    coverR2Url: completedTrack.coverImage || completedTrack.coverR2Url,
                    lyrics: completedTrack.lyrics || '',
                    isFavorited: false,
                    isLiked: false,
                    isDisliked: false
                }]
            };

        // 将新歌曲添加到 userTracks 列表的顶部
        setUserTracks(prevTracks => {
            // 双重检查：确保没有重复添加
            const exists = prevTracks.some(track => 
                track.allTracks.some((t: any) => t.id === completedTrack.id)
            );
            
            if (exists) {
                return prevTracks;
            }
            
            return [newUserTrack, ...prevTracks];
        });
    }, [updateTracks, setUserTracks]); // 🔧 移除 generatedTracks 依赖，避免不必要的重新创建


    // ==================== 使用 Track Generation Monitor Hook ====================
    // 将生成状态监听逻辑提取到自定义hook中，提高可维护性
    useTrackGenerationMonitor({
        generatedTracks,
        player,
        onTrackUpdate: (updater) => {
            setSelectedStudioTrack((prev) => updater(prev));
        },
        onTrackCompleted: handleTrackCompleted, // 🆕 添加单个歌曲完成的回调
        onAllTracksCompleted: async () => {

            // 🔧 清理已处理的歌曲记录
            processedTracksRef.current.clear();

            // 🔧 刷新 userTracks，确保上传任务完成后同步到列表
            if (user?.id) {
                await fetchUserTracksByMode('merge');
            }

            // 🔧 延迟清理，确保所有回调都已完成
            setTimeout(() => {
                musicGeneration.updateTracks([]); // 清空生成的tracks
            }, 1000); // 延迟1秒确保所有状态更新完成
        },
    });
    
    // 为 StudioTracksList 创建稳定的 generatedTracks 数组
    // 🔒 使用 useMemo 避免每次渲染都创建新数组
    const stableGeneratedTracks = React.useMemo(() => 
        generatedTracks.map(track => ({
            ...track,
            key: `${track.id}-${track.coverImage || 'no-cover'}`
        })),
        [generatedTracks]
    );

    const {
        inlineTrackDetails,
        isInlineTrackPlaying,
        showInlinePanel,
    } = useStudioInlineTrackPanel({
        selectedStudioTrack,
        generatedTracks,
        findTrackAndMusic,
        playerCurrentTrackId: player.currentTrack?.id,
        playerIsPlaying: player.isPlaying,
        lyricsPanelOpen,
        setLyricsPanelOpen,
    });

    const isInitialUserTracksLoading = isFetchingUserTracks && userTracks.length === 0;

    const handleExtendTrackSelect = React.useCallback((track: ExtendSourceTrack) => {
        if (!track?.audioUrl) return;

        setPendingExtendSourceTrack(track);
        setPanelOpen(true);

        if (feature !== "music-extender") {
            router.push(withCurrentLocale(getStudioFeaturePath("music-extender")));
        }

        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setMobileCreateOpen(true);
        }
    }, [feature, router, withCurrentLocale]);

    const handlePendingExtendSourceTrackConsumed = React.useCallback(() => {
        setPendingExtendSourceTrack(null);
    }, []);

    // 转换 UserTrack 到 MusicGeneration 格式
    const convertUserTracksToMusicGeneration = (userTracks: any[]): any[] => {
        return userTracks.map(userTrack => ({
            ...userTrack,
            prompt: userTrack.prompt || '', // 使用 music 表的 prompt
            isInstrumental: false, // 默认值
            updatedAt: userTrack.createdAt, // 使用 createdAt
            generationMode: userTrack.generationMode,
            totalDuration: userTrack.allTracks.reduce((total: number, track: any) => total + track.duration, 0)
        }));
    };

    // ==================== 通用 Props ====================
    const featurePanelProps = React.useMemo<StudioFeaturePanelStateProps>(() => ({
        mode: activeFeatureMode,
        setMode: setActiveFeatureMode,
        selectedGenre,
        setSelectedGenre,
        selectedVibe,
        setSelectedVibe,
        simplePrompt,
        setSimplePrompt,
        customLyrics,
        setCustomLyrics,
        songTitle,
        setSongTitle,
        instrumentalMode,
        setInstrumentalMode,
        isPublished,
        setIsPublished,
        styleText,
        setStyleText,
        bpm,
        setBpm,
        grooveType,
        setGrooveType,
        leadInstrument,
        setLeadInstrument,
        drumKit,
        setDrumKit,
        bassTone,
        setBassTone,
        vocalGender,
        setVocalGender,
        harmonyPalette,
        setHarmonyPalette,
        styleWeight,
        setStyleWeight,
        weirdnessConstraint,
        setWeirdnessConstraint,
        audioWeight,
        setAudioWeight,
        bpmMode,
        setBpmMode,
        isGenerating,
        onGenerationStart: handleGenerationStart,
        onGenerateLyrics: handleGenerateLyrics,
        onWriteNextLyricLine: handleWriteNextLyricLine,
        isWritingNextLyricLine,
        isAuthModalOpen,
        setIsAuthModalOpen,
        selectedModel,
        setSelectedModel,
        selectedPersonaId,
        setSelectedPersonaId,
        selectedPersonaModel,
        setSelectedPersonaModel,
        enhanceStyle,
        setEnhanceStyle,
        extendSourceTracks,
        pendingExtendSourceTrack,
        onPendingExtendSourceTrackConsumed: handlePendingExtendSourceTrackConsumed,
    }), [
        activeFeatureMode, setActiveFeatureMode, selectedGenre, setSelectedGenre, selectedVibe, setSelectedVibe,
        simplePrompt, setSimplePrompt, customLyrics, setCustomLyrics, songTitle, setSongTitle, instrumentalMode, setInstrumentalMode,
        isPublished, setIsPublished, styleText, setStyleText, bpm, setBpm, grooveType, setGrooveType,
        leadInstrument, setLeadInstrument, drumKit, setDrumKit, bassTone, setBassTone,
        vocalGender, setVocalGender, harmonyPalette, setHarmonyPalette,
        styleWeight, setStyleWeight, weirdnessConstraint, setWeirdnessConstraint, audioWeight, setAudioWeight,
        bpmMode, setBpmMode,
        selectedPersonaId, setSelectedPersonaId, selectedPersonaModel, setSelectedPersonaModel, enhanceStyle, setEnhanceStyle,
        extendSourceTracks, pendingExtendSourceTrack, handlePendingExtendSourceTrackConsumed,
        isGenerating, handleGenerationStart, handleGenerateLyrics, handleWriteNextLyricLine,
        isWritingNextLyricLine,
        isAuthModalOpen, setIsAuthModalOpen, selectedModel, setSelectedModel
    ]);

    // MusicPlayer 通用 props
    // ✅ 直接创建对象，不缓存，因为 player 使用 getter 模式
    // 这样可以确保每次渲染都读取到最新的播放器状态
    // 性能影响：创建对象本身很轻量，且 React.memo 会处理不必要的渲染
    const musicPlayerProps = {
        tracks: musicPlayerTracks,
        currentTrackIndex: allTracks.findIndex(track => track.id === player.currentTrack?.id),
        currentPlayingTrack: player.currentTrack || undefined,
        isPlaying: player.isPlaying,
        currentTime: player.currentTime,
        duration: player.duration,
        volume: player.volume,
        isMuted: player.isMuted,
        onPlayPause: togglePlayPause,
        onPrevious: handlePrevious,
        onNext: handleNext,
        onSeek: (time: number) => player.seek(time),
        onVolumeChange: changeVolume,
        onMuteToggle: toggleMute,
        onClose: () => {
            player.clearCurrentTrack();
            setLyricsPanelOpen(false);
            setSelectedStudioTrack(null);
        },
        hideProgress: false,
        onTrackInfoClick: handlePlayerLyricsToggle,
        onTrackChange: (index: number) => {
            const selectedTrack = allTracks[index];
            if (selectedTrack) {
                handleTrackSelect(selectedTrack, selectedTrack, { autoPlay: true });
            }
        },
        playTrackById,
    };

    // Delete handlers
    const handleDeleteClick = React.useCallback((track: any) => {
        openDeleteDialogForTrack(track);
    }, [openDeleteDialogForTrack]);

    const studioMainLayout = (
        <section
            id="studio"
            className="relative h-screen overflow-hidden"
        >
            <div
                className={`relative h-full flex flex-col md:flex-row md:gap-0 md:px-4 md:py-0 md:pl-[calc(var(--studio-sidebar-width,72px)+1rem)]`}
            >
                <div className="hidden md:block md:order-2 flex-shrink-0 md:pr-2 md:py-2">
                    <FeaturePanel
                        {...featurePanelProps}
                        panelOpen={panelOpen}
                        setPanelOpen={setPanelOpen}
                        hasPlayer={!!player.currentTrack}
                    />
                </div>

                <div className="md:hidden">
                    <MobileStudioHeader
                        user={user}
                        credits={credits}
                        userMenuOpen={userMenuOpen}
                        setUserMenuOpen={setUserMenuOpen}
                        setIsAuthModalOpen={setIsAuthModalOpen}
                        signOut={signOut}
                    />
                </div>

                <div 
                    className={`flex-1 min-w-0 h-full flex ${getZIndexClass('MAIN_CONTENT')} md:order-3 relative pb-[calc(var(--mobile-nav-height,64px)+var(--player-height,48px)+1rem)] md:pb-0 md:pl-2`}
                    style={{
                        paddingBottom: player.currentTrack 
                            ? undefined
                            : 'calc(var(--mobile-nav-height, 64px))'
                    }}
                >
                    <div className={`min-h-0 h-full flex flex-col relative w-full ${getZIndexClass('MAIN_CONTENT')}`}>
                <div className="md:hidden flex-shrink-0 px-6 py-4 bg-background/60 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Music className="h-8 w-8 text-primary" />
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            Studio
                        </h1>
                    </div>
                </div>

                    <div className="flex flex-col flex-1 min-h-0 min-w-0">
                        <div className="relative flex flex-col flex-1 min-h-0 min-w-0 px-0 md:px-0 md:py-2">
                                <div className="flex-1 min-h-0 md:hidden">
                                    <StudioTracksList
                                        userTracks={convertUserTracksToMusicGeneration(userTracks)}
                                        generatedTracks={stableGeneratedTracks}
                                        onTrackSelect={handleUserTrackSelect}
                                        onTrackPreview={handleInlineTrackPreview}
                                        onTrackPlay={handleUserTrackPlay}
                                        onGeneratedTrackSelect={handleGeneratedTrackSelect}
                                        onDelete={handleDeleteClick}
                                        onFavoriteToggle={handleFavoriteToggle}
                                        onDislikeToggle={handleDislikeToggle}
                                        onLikeToggle={handleLikeToggle}
                                        onDownload={handleDownload}
                                        isLoading={isInitialUserTracksLoading}
                                        isLoadingMore={isFetchingMoreUserTracks}
                                        hasMore={hasMoreUserTracks}
                                        onLoadMore={handleLoadMoreUserTracks}
                                        summary={userTracksSummary}
                                        selectedTrack={selectedStudioTrack?.id}
                                        hasPlayer={!!player.currentTrack}
                                        onEditTitle={handleEditTitle}
                                        onEditMusicInfo={handleEditMusicInfo}
                                        onExtendTrackSelect={handleExtendTrackSelect}
                                        extendMusicStartPolling={extendMusic.startPolling}
                                        onCreate={() => setMobileCreateOpen(true)}
                                    />
                                </div>

                                <div className="hidden md:flex md:flex-col min-h-0 flex-1 studio-panel-cards overflow-hidden">
                                    <StudioTracksList
                                        userTracks={convertUserTracksToMusicGeneration(userTracks)}
                                        isLoading={isInitialUserTracksLoading}
                                        isLoadingMore={isFetchingMoreUserTracks}
                                        hasMore={hasMoreUserTracks}
                                        onLoadMore={handleLoadMoreUserTracks}
                                        summary={userTracksSummary}
                                        onTrackSelect={handleUserTrackSelect}
                                        onTrackPreview={handleInlineTrackPreview}
                                        onTrackPlay={handleUserTrackPlay}
                                        selectedTrack={selectedStudioTrack?.id}
                                        generatedTracks={stableGeneratedTracks}
                                        onGeneratedTrackSelect={handleGeneratedTrackSelect}
                                        onDownload={handleDownload}
                                        onFavoriteToggle={handleFavoriteToggle}
                                        onDislikeToggle={handleDislikeToggle}
                                        onLikeToggle={handleLikeToggle}
                                        onDelete={handleTrackDelete}
                                        hasPlayer={!!player.currentTrack}
                                        onEditTitle={handleEditTitle}
                                        onEditMusicInfo={handleEditMusicInfo}
                                        onExtendTrackSelect={handleExtendTrackSelect}
                                        extendMusicStartPolling={extendMusic.startPolling}
                                    />
                                </div>
                                <div
                                    className={`absolute inset-0 ${getZIndexClass('INLINE_PANEL_STUDIO_OVERLAY')} transition-opacity duration-200 ${
                                        showInlinePanel ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                                    }`}
                                    aria-hidden={!showInlinePanel}
                                >
                                    <button
                                        type="button"
                                        aria-label={t("studioPage.closeLyricsPanel")}
                                        onClick={() => setLyricsPanelOpen(false)}
                                        className="absolute inset-0 bg-background/20 backdrop-blur-[1px] md:bg-background/10"
                                    />

                                    <div
                                        className={`absolute right-0 top-0 h-full w-full max-w-[min(90vw,400px)] md:right-0 md:max-w-[20rem] ${
                                            player.currentTrack ? 'md:h-[calc(100%-var(--player-height,0px)-0.5rem)]' : ''
                                        } transform-gpu transition-transform duration-300 ease-out ${
                                            showInlinePanel ? 'translate-x-0' : 'translate-x-full'
                                        }`}
                                    >
                                        {showInlinePanel && (
                                            <div className="h-full p-2 md:py-2 md:pl-3 md:pr-0">
                                                <InlineTrackDetailsPanel
                                                    track={inlineTrackDetails}
                                                    isPlaying={isInlineTrackPlaying}
                                                    currentTime={isInlineTrackPlaying ? player.currentTime : 0}
                                                    onClose={() => setLyricsPanelOpen(false)}
                                                    variant="studio"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
		                    </div>
		                </div>

	            </div>

                {player.currentTrack && (
                    <div
                        className={`fixed left-3 right-3 bottom-[calc(var(--mobile-nav-height,0px)+0.75rem)] md:bottom-2 md:left-[calc(var(--studio-sidebar-width,72px)+1rem)] md:right-4 ${getZIndexClass('MUSIC_PLAYER')} pointer-events-auto`}
                    >
                        <MusicPlayer {...musicPlayerProps} />
                    </div>
                )}

                <MobileCreateDrawer
                    isOpen={mobileCreateOpen}
                    onClose={() => setMobileCreateOpen(false)}
                    FeaturePanel={FeaturePanel}
                    featurePanelProps={featurePanelProps}
                />
            </div>

            {/* Removed pulse-line (ECG) animation for Studio page */}
        </section>
    );

    return (
        <>
            <CommonSidebar variant="studio" />
            {studioMainLayout}

            {/* Lyrics Generation Dialog */}
            <Dialog
                open={showLyricsDialog}
                onOpenChange={(open) => {
                    if (!open) {
                        setLyricsPrompt('');
                    }
                    setShowLyricsDialog(open);
                }}
            >
                <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl">
                    <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
                        <div className="pr-8">
                            <DialogTitle className="text-xl font-semibold tracking-tight">
                                {t("studioPage.generateLyricsTitle")}
                            </DialogTitle>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t("studioPage.generateLyricsDescription")}
                        </p>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-3 px-5 py-3">
                        <section className="studio-panel-card rounded-2xl p-3 space-y-2">
                            <label className="text-xs md:text-sm font-semibold text-foreground block">{t("studioPage.lyricsPromptLabel")}</label>
                            <div className="relative">
                                <Textarea
                                    value={lyricsPrompt}
                                    onChange={(e) => setLyricsPrompt(e.target.value)}
                                    placeholder={t("studioPage.lyricsPromptPlaceholder")}
                                    maxLength={200}
                                    className="min-h-[128px] w-full resize-none border-0 bg-transparent px-0 text-sm pr-16 focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                <div className="absolute bottom-2 right-0 rounded-full bg-foreground/10 px-2 py-1 text-xs text-muted-foreground">
                                    {lyricsPrompt.length}/200
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className="flex-shrink-0 px-5 pt-1 pb-4">
                        <Button
                            onClick={() => handleGenerateLyricsHook(setCustomLyrics, user?.id || '')}
                            disabled={isGeneratingLyrics || !lyricsPrompt.trim()}
                            className="h-11 w-full rounded-2xl text-sm font-semibold"
                        >
                            {isGeneratingLyrics ? (
                                <div className="flex items-center gap-2">
                                    <span>{t("studioPage.generating")}</span>
                                    <LoadingDots size="sm" color="white" />
                                </div>
                            ) : (
                                t("studioPage.generateLyricsAction")
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Auth Modal */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
                    <AlertDialogHeader className="space-y-2 sm:space-y-3">
                        <AlertDialogTitle className="text-lg sm:text-xl">{t("studioTracks.deleteTrackTitle")}</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm sm:text-base whitespace-nowrap">
                            {t("studioTracks.deleteTrackDescription")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
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

            {/* Generation Confirmation Dialog - 使用提取的组件 */}
            <GenerationConfirmDialog
                isOpen={generationConfirmOpen}
                onClose={() => {
                    setGenerationConfirmOpen(false);
                    // 🔧 修复：移动端关闭生成确认弹窗时，同时关闭create music panel
                    setMobileCreateOpen(false);
                }}
            />

            {/* WAV Download Progress Dialog */}
            <DownloadProgressDialog
                isOpen={wavDownloadDialogOpen}
                onClose={closeWavDownloadDialog}
                trackTitle={wavDownloadTrackTitle}
                progress={wavDownloadProgress}
                status={wavDownloadStatus}
                statusText={wavDownloadStatusText}
                errorMessage={wavDownloadErrorMessage}
            />

            <Mp4BrandingDialog
                open={mp4DialogOpen}
                onOpenChange={handleMp4DialogOpenChange}
                author={mp4Author}
                domainName={mp4DomainName}
                onAuthorChange={setMp4Author}
                onDomainNameChange={setMp4DomainName}
                onGenerate={handleMp4Generate}
            />
        </>
    );
};

type FeatureWorkspaceSectionProps = StudioContentProps;

export const FeatureWorkspaceSection = ({
    feature,
    FeaturePanel,
    panelMode,
    lockPanelMode,
}: FeatureWorkspaceSectionProps) => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <StudioContent
                feature={feature}
                FeaturePanel={FeaturePanel}
                panelMode={panelMode}
                lockPanelMode={lockPanelMode}
            />
        </Suspense>
    );
};
