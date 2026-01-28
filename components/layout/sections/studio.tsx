"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

// Custom Hooks
import { useMusicGeneration } from "@/features/music-generation/hooks/use-music-generation";
import { useLyricsGeneration } from "@/features/lyrics-cover/hooks/use-lyrics-generation";
import { useExtendMusic } from "@/features/music-upload/hooks/use-extend-music";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { getAudioService } from "@/lib/audio-service";
import { useTrackGenerationMonitor } from "@/features/music-generation/hooks/use-track-generation-monitor";
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";

// 导入统一的 Track 类型
import { StudioTrack } from "@/types/track";

// Components
import { CommonSidebar } from "@/components/ui/sidebar";
import { StudioPanel } from "@/components/ui/studio-panel";
import { StudioTracksList } from "@/components/ui/studio-tracks-list";
import { InlineTrackDetailsPanel } from "@/components/ui/inline-track-details";
import { MusicPlayer } from "@/components/ui/music-player";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MobileStudioHeader } from "@/components/ui/mobile-studio-header";
import { MobileCreateDrawer } from "@/components/ui/mobile-create-drawer";
import { GenerationConfirmDialog } from "@/components/ui/generation-confirm-dialog";
import { DownloadProgressDialog } from "@/components/ui/download-progress-dialog";
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
import { Music, Wand2, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const USER_TRACKS_PAGE_SIZE = 10;

const StudioContent = () => {
    // Router 和 Search Params
    const router = useRouter();

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

    // UI States
    const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [trackToDelete, setTrackToDelete] = useState<any>(null);
    const [generationConfirmOpen, setGenerationConfirmOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isFetchingUserTracks, setIsFetchingUserTracks] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    
    // WAV 下载进度弹窗状态
    const [wavDownloadDialogOpen, setWavDownloadDialogOpen] = useState(false);
    const [wavDownloadProgress, setWavDownloadProgress] = useState(0);
    const [wavDownloadStatus, setWavDownloadStatus] = useState<'preparing' | 'generating' | 'downloading' | 'completed' | 'error'>('preparing');
    const [wavDownloadStatusText, setWavDownloadStatusText] = useState<string>('');
    const [wavDownloadErrorMessage, setWavDownloadErrorMessage] = useState<string>('');
    const [wavDownloadTrackTitle, setWavDownloadTrackTitle] = useState<string>('');

    // 本地状态管理 - 替换zustand store
    const [userTracks, setUserTracks] = useState<any[]>([]);
    const [userTracksOffset, setUserTracksOffset] = useState(0);
    const [hasMoreUserTracks, setHasMoreUserTracks] = useState(true);
    const [isFetchingMoreUserTracks, setIsFetchingMoreUserTracks] = useState(false);
    const [userTracksSummary, setUserTracksSummary] = useState<{ totalTracks: number; totalDuration: number }>({
        totalTracks: 0,
        totalDuration: 0,
    });
    const [selectedStudioTrack, setSelectedStudioTrack] = useState<StudioTrack | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const [lyricsPanelOpen, setLyricsPanelOpen] = useState(true);
    const lastSelectedTrackIdRef = useRef<string | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(80);
    const sidebarOffsetRef = React.useRef(sidebarWidth);

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
        mode, setMode,
        selectedGenre, setSelectedGenre,
        selectedVibe, setSelectedVibe,
        simplePrompt, setSimplePrompt,
        customLyrics, setCustomLyrics,
        songTitle, setSongTitle,
        instrumentalMode, setInstrumentalMode,
        isPublished,
        styleText, setStyleText,
        bpm, setBpm,
        grooveType, setGrooveType,
        leadInstrument, setLeadInstrument,
        drumKit, setDrumKit,
        bassTone, setBassTone,
        vocalGender, setVocalGender,
        harmonyPalette, setHarmonyPalette,
        trackExistingTask,
    } = musicGeneration;

    React.useEffect(() => {
        const updateSidebarOffset = () => {
            if (typeof document === 'undefined') return;
            const isDesktopViewport = typeof window !== 'undefined' && window.innerWidth >= 768;
            const offsetValue = isDesktopViewport ? `${sidebarOffsetRef.current}px` : '0px';
            document.documentElement.style.setProperty('--sidebar-offset', offsetValue);
        };

        sidebarOffsetRef.current = sidebarWidth;
        updateSidebarOffset();
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', updateSidebarOffset);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', updateSidebarOffset);
            }
        };
    }, [sidebarWidth]);

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
    }, []);

    // 统一的Track对象创建函数
    const createTrackObject = React.useCallback((
        id: string,
        generationId: string,
        title: string,
        audioUrl: string,
        duration: number,
        coverImage?: string,
        tags?: string,
        genre?: string,
        lyrics?: string,
        isFavorited: boolean = false,
        streamAudioUrl?: string,
        createdAt?: string,
        generationMode?: string
    ) => ({
        id,
        generationId,
        title,
        audioUrl,
        streamAudioUrl,
        duration,
        coverImage,
        coverR2Url: coverImage, // 使用驼峰命名
        tags,
        genre,
        lyrics,
        generationMode,
        isFavorited: isFavorited, // 使用驼峰命名
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
                track.genre,
                track.lyrics,
                track.isFavorited ?? false,
                track.streamAudioUrl ?? '',
                track.createdAt || new Date().toISOString(),
                track.generationMode
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
                        music.genre,
                        track.lyrics ?? music.lyrics ?? '',
                        track.isFavorited ?? false,
                        track.streamAudioUrl ?? '',
                        track.createdAt ?? music.createdAt ?? new Date().toISOString(),
                        music.generationMode
                    ));
                });
            }
        });        
        return tracks;
    }, [generatedTracks, userTracks, createTrackObject]);

    // 为 MusicPlayer 创建稳定的 tracks 数组，避免不必要的重新渲染
    // 注意：移动端播放器不再显示封面，只显示歌曲标题和时长
    const musicPlayerTracks = React.useMemo(() => {
        return allTracks.map(track => ({
            id: track.id,
            title: track.title,
            audioUrl: track.audioUrl,
            duration: track.duration,
            artist: track.genre,
            allTracks: [{
                id: track.id,
                audioUrl: track.audioUrl,
                duration: track.duration,
            }]
        }));
    }, [allTracks]);

    const playableTracks = React.useMemo(() => {
        return allTracks;
    }, [allTracks]);

    // ==================== 播放歌曲核心函数 ====================
    const playTrackById = React.useCallback(async (trackId: string) => {
        try {
            // 首先查找本地track信息
            let localTrack = allTracks.find(track => track.id === trackId);

            // 如果在本地找不到，可能是新创建的延长音乐track，尝试从数据库获取
            if (!localTrack || !localTrack.audioUrl) {
                console.log('Track not found in local cache, fetching from server:', trackId);
                
                try {
                    // 获取当前会话
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    const response = await fetch(`/api/track-info/${trackId}`, {
                        headers: {
                            'Authorization': `Bearer ${session?.access_token}`,
                        },
                    });
                    
                    if (response.ok) {
                        const trackData = await response.json();
                        if (trackData.success && trackData.track) {
                            const track = trackData.track;
                            localTrack = createTrackObject(
                                track.id,
                                track.musicId,
                                track.title,
                                track.audioUrl,
                                track.duration,
                                track.coverR2Url,
                                track.tags,
                                track.genre,
                                track.lyrics,
                                track.isFavorited || false,
                            track.streamAudioUrl,
                            track.createdAt,
                            track.generationMode
                            );
                            console.log('Successfully fetched track from server:', localTrack);
                        }
                    }
                } catch (fetchError) {
                    console.error('Failed to fetch track from server:', fetchError);
                }
            }
            
            // 最终检查
            if (!localTrack || !localTrack.audioUrl) {
                console.warn('Track not found or no audio URL:', trackId);
                return;
            }
            
            // 使用新的音频播放器播放
            await player.playTrack({
                id: localTrack.id,
                title: localTrack.title,
                audioUrl: localTrack.audioUrl,
                streamAudioUrl: localTrack.streamAudioUrl,
                duration: localTrack.duration,
                genre: localTrack.genre,
                lyrics: localTrack.lyrics,
                tags: localTrack.tags,
                generationId: localTrack.generationId,
                isFavorited: localTrack.isFavorited,
            });
            
        } catch (error) {
            console.error('Error playing track:', error);
        }
    }, [allTracks, player, createTrackObject]);

    // ==================== 上一首/下一首函数 ====================
    const handlePrevious = React.useCallback(() => {
        if (!player.currentTrack || playableTracks.length === 0) return;
        
        const currentIndex = playableTracks.findIndex(track => track.id === player.currentTrack?.id);
        if (currentIndex === -1) return;
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : playableTracks.length - 1;
        const prevTrack = playableTracks[prevIndex];
        
        if (prevTrack) {
            playTrackById(prevTrack.id);
            // 更新选中状态
            setSelectedStudioTrack(prevTrack);
            setLyricsPanelOpen(true);
        }
    }, [player, playableTracks, playTrackById]);

    const handleNext = React.useCallback(() => {
        if (!player.currentTrack || playableTracks.length === 0) return;
        
        const currentIndex = playableTracks.findIndex(track => track.id === player.currentTrack?.id);
        if (currentIndex === -1) return;
        
        const nextIndex = currentIndex < playableTracks.length - 1 ? currentIndex + 1 : 0;
        const nextTrack = playableTracks[nextIndex];
        
        if (nextTrack) {
            playTrackById(nextTrack.id);
            // 更新选中状态
            setSelectedStudioTrack(nextTrack);
            setLyricsPanelOpen(true);
        }
    }, [player, playableTracks, playTrackById]);

    // 获取用户 tracks
    const fetchUserTracks = React.useCallback(async (options?: { mode?: 'reset' | 'append' | 'merge' }) => {
        const mode = options?.mode ?? 'reset';
        const isAppend = mode === 'append';
        const isMerge = mode === 'merge';

        if (!user?.id) {
            setUserTracks([]);
            setUserTracksOffset(0);
            setHasMoreUserTracks(false);
            setIsFetchingUserTracks(false);
            setIsFetchingMoreUserTracks(false);
            setUserTracksSummary({ totalTracks: 0, totalDuration: 0 });
            return;
        }

        if (isAppend && (isFetchingMoreUserTracks || isFetchingUserTracks || !hasMoreUserTracks)) {
            return;
        }

        if (isAppend) {
            setIsFetchingMoreUserTracks(true);
        } else {
            setIsFetchingUserTracks(true);
        }

        try {
            // 获取当前session的access token
            const { data: { session } } = await supabase.auth.getSession();
            
            // 添加时间戳参数强制刷新缓存
            const timestamp = Date.now();
            const offset = isAppend ? userTracksOffset : 0;
            const response = await fetch(`/api/user-music/${user.id}?limit=${USER_TRACKS_PAGE_SIZE}&offset=${offset}&_t=${timestamp}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            if (response.ok) {
                const data = await response.json();
                const tracks = (Array.isArray(data.data?.music) ? data.data.music : []) as any[];
                const totalTracks = Number(data.data?.totalTracks ?? 0);
                const totalDuration = Number(data.data?.totalDuration ?? 0);

                setUserTracks(prevTracks => {
                    if (isAppend) {
                        const existingIds = new Set(prevTracks.map((track: any) => track.id));
                        const merged = [...prevTracks];
                        tracks.forEach((track: any) => {
                            if (!existingIds.has(track.id)) {
                                merged.push(track);
                            }
                        });
                        return merged;
                    }

                    if (isMerge) {
                        const incomingIds = new Set(tracks.map((track: any) => track.id));
                        const merged = [...tracks];
                        prevTracks.forEach((track: any) => {
                            if (!incomingIds.has(track.id)) {
                                merged.push(track);
                            }
                        });
                        return merged;
                    }

                    return tracks;
                });

                if (Number.isFinite(totalTracks) && Number.isFinite(totalDuration)) {
                    setUserTracksSummary({
                        totalTracks,
                        totalDuration,
                    });
                }

                if (isAppend) {
                    setUserTracksOffset(prevOffset => prevOffset + tracks.length);
                } else if (isMerge) {
                    setUserTracksOffset(prevOffset => (prevOffset === 0 ? tracks.length : prevOffset));
                } else {
                    setUserTracksOffset(tracks.length);
                }

                if (!isMerge) {
                    setHasMoreUserTracks(tracks.length === USER_TRACKS_PAGE_SIZE);
                }
            } else {
                console.error('Failed to fetch user tracks:', response.status, response.statusText);
                if (!isAppend) {
                    setUserTracks([]);
                }
            }
        } catch (error) {
            console.error('Error fetching user tracks:', error);
        } finally {
            if (isAppend) {
                setIsFetchingMoreUserTracks(false);
            } else {
                setIsFetchingUserTracks(false);
            }
        }
    }, [user?.id, userTracksOffset, isFetchingMoreUserTracks, isFetchingUserTracks, hasMoreUserTracks]);

    // 使用 ref 存储 fetchUserTracks，供 useExtendMusic 使用
    const fetchUserTracksRef = React.useRef(fetchUserTracks);
    React.useEffect(() => {
        fetchUserTracksRef.current = fetchUserTracks;
    }, [fetchUserTracks]);

    const handleLoadMoreUserTracks = React.useCallback(() => {
        fetchUserTracks({ mode: 'append' });
    }, [fetchUserTracks]);

    // 传递 updateTracks 回调给 useExtendMusic，直接更新 generatedTracks
    // 延长音乐完成时，刷新 userTracks（数据已写入数据库）
    const extendMusic = useExtendMusic(
        updateTracks,
        () => fetchUserTracksRef.current({ mode: 'merge' })
    );

    // 初始化时获取用户 tracks 或使用模拟数据
    useEffect(() => {
        if (isAuthLoading) return;
        if (user?.id) {
            setUserTracks([]);
            setUserTracksOffset(0);
            setHasMoreUserTracks(true);
            fetchUserTracksRef.current({ mode: 'reset' });
        } else {
            setUserTracks([]);
            setUserTracksOffset(0);
            setHasMoreUserTracks(false);
            setIsFetchingMoreUserTracks(false);
            setIsFetchingUserTracks(false);
            setUserTracksSummary({ totalTracks: 0, totalDuration: 0 });
        }
    }, [user?.id, isAuthLoading]);

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
    }, [updateTracks, selectedStudioTrack]);

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
                () => setGenerationConfirmOpen(true)
            );
            return true;
        } catch (error) {
            console.error('Generation failed:', error);
            return false;
        }
    }, [user?.id, musicGeneration, refreshCredits]);

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
                return { prompt: 5000, style: 1000, title: 100 };
        }
    }, []);

    const handleUploadCover = React.useCallback(async (options?: {
        uploadFile?: File | null;
        uploadUrl?: string | null;
        mode?: "cover" | "extend";
        continueAt?: number;
    }) => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return false;
        }

        const trimmedSimplePrompt = simplePrompt.trim();
        const trimmedCustomLyrics = customLyrics.trim();
        const trimmedStyle = styleText.trim();
        const trimmedTitle = songTitle.trim();
        const isSimpleMode = mode === "simple";
        const isCustomMode = mode === "custom";

        if (isSimpleMode && !trimmedSimplePrompt) {
            toast.error("Please enter a prompt.");
            return false;
        }

        if (isCustomMode) {
            if (!trimmedStyle) {
                toast.error("Please enter a style.");
                return false;
            }
            if (!trimmedTitle) {
                toast.error("Please enter a title.");
                return false;
            }
            if (!instrumentalMode && !trimmedCustomLyrics) {
                toast.error("Please enter lyrics.");
                return false;
            }
        }

        const uploadFile = options?.uploadFile ?? null;
        const uploadUrl = options?.uploadUrl ?? null;
        const continueAt = options?.continueAt ?? 0;
        if (!uploadUrl) {
            toast.error("Upload URL is required. Please upload your audio first.");
            return false;
        }

        if (options?.mode === "extend" && isCustomMode && continueAt <= 0) {
            toast.error("Start time must be greater than 0s.");
            return false;
        }

        setSelectedStudioTrack(null);

        const placeholderGenerationId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const placeholderTags = isCustomMode ? trimmedStyle : trimmedSimplePrompt;
        const placeholderPrompt = isCustomMode ? trimmedStyle : trimmedSimplePrompt;
        const placeholderTitle = trimmedTitle || (uploadFile?.name ? uploadFile.name.replace(/\.[^/.]+$/, "") : "Untitled Track");
        const generationMode = isCustomMode ? 'custom' : 'simple';

        flushSync(() => {
            updateTracks((prevTracks) => ([
                {
                    id: `${placeholderGenerationId}_placeholder_0`,
                    generationId: placeholderGenerationId,
                    sunoTrackId: null,
                    title: placeholderTitle,
                    audioUrl: '',
                    streamAudioUrl: '',
                    duration: undefined,
                    coverImage: undefined,
                    tags: placeholderTags,
                    genre: '',
                    prompt: placeholderPrompt,
                    lyrics: '',
                    model: selectedModel,
                    createdAt: new Date().toISOString(),
                    isGenerating: true,
                    isCompleted: false,
                    isPlaceholder: true,
                    generationMode,
                },
                {
                    id: `${placeholderGenerationId}_placeholder_1`,
                    generationId: placeholderGenerationId,
                    sunoTrackId: null,
                    title: placeholderTitle,
                    audioUrl: '',
                    streamAudioUrl: '',
                    duration: undefined,
                    coverImage: undefined,
                    tags: placeholderTags,
                    genre: '',
                    prompt: placeholderPrompt,
                    lyrics: '',
                    model: selectedModel,
                    createdAt: new Date().toISOString(),
                    isGenerating: true,
                    isCompleted: false,
                    isPlaceholder: true,
                    generationMode,
                },
                ...prevTracks
            ]));
        });

        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                updateTracks(prevTracks =>
                    prevTracks.filter(track => !(track.isPlaceholder && track.generationId === placeholderGenerationId))
                );
                throw new Error("Authentication expired. Please sign in again.");
            }

            const formData = new FormData();
            const limits = getModelLimits(selectedModel);
            const uploadMode = options?.mode === "extend" ? "extend" : "cover";
            formData.append("mode", uploadMode);
            formData.append("uploadUrl", uploadUrl);
            if (uploadMode === "extend") {
                formData.append("defaultParamFlag", isCustomMode ? "true" : "false");
            } else {
                formData.append("customMode", isCustomMode ? "true" : "false");
            }
            formData.append("instrumental", isCustomMode ? (instrumentalMode ? "true" : "false") : "false");
            formData.append("model", selectedModel);
            if (uploadMode === "extend" && isCustomMode) {
                formData.append("continueAt", continueAt.toString());
            }

            if (isCustomMode) {
                if (trimmedStyle) {
                    formData.append("style", trimmedStyle.slice(0, limits.style));
                }
                if (trimmedTitle) {
                    formData.append("title", trimmedTitle.slice(0, limits.title));
                }
                if (!instrumentalMode && trimmedCustomLyrics) {
                    formData.append("prompt", trimmedCustomLyrics.slice(0, limits.prompt));
                }
            } else if (trimmedSimplePrompt) {
                const maxSimplePrompt = 400;
                formData.append("prompt", trimmedSimplePrompt.slice(0, maxSimplePrompt));
            }

            const response = await fetch("/api/music/upload", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const result = await response.json();
            if (!response.ok || !result?.success) {
                updateTracks(prevTracks =>
                    prevTracks.filter(track => !(track.isPlaceholder && track.generationId === placeholderGenerationId))
                );
                if (response.status === 402) {
                    toast.error(result?.error || "Insufficient credits. Please top up credits.");
                } else {
                    toast.error(result?.error || "Upload failed. Please try again.");
                }
                return false;
            }

            const taskId = result?.data?.taskId;
            const initialTracks = result?.data?.initialTracks;

            if (taskId) {
                updateTracks(prevTracks =>
                    prevTracks.filter(track => !(track.isPlaceholder && track.generationId === placeholderGenerationId))
                );
                musicGeneration.trackExistingTask(taskId, initialTracks);
                setGenerationConfirmOpen(true);
            }

            await refreshCredits?.();
            return true;
        } catch (error) {
            console.error("Upload audio error:", error);
            updateTracks(prevTracks =>
                prevTracks.filter(track => !(track.isPlaceholder && track.generationId === placeholderGenerationId))
            );
            const message =
                error instanceof Error ? error.message : "Upload failed. Please try again.";
            toast.error(message);
            return false;
        }
    }, [
        user?.id,
        simplePrompt,
        customLyrics,
        styleText,
        songTitle,
        instrumentalMode,
        mode,
        selectedModel,
        getModelLimits,
        refreshCredits,
        updateTracks,
        musicGeneration,
        setIsAuthModalOpen,
        setSelectedStudioTrack,
    ]);

    const handleGenerationStart = React.useCallback(async (options?: {
        uploadFile?: File | null;
        uploadUrl?: string | null;
        mode?: "cover" | "extend";
        continueAt?: number;
    }) => {
        if (options?.uploadFile || options?.uploadUrl) {
            return await handleUploadCover(options);
        }
        return await handleGenerate();
    }, [handleGenerate, handleUploadCover]);

    // 移除自动关闭逻辑，让用户手动关闭确认弹窗
    const handleGenerateLyrics = React.useCallback(() => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return;
        }
        setShowLyricsDialog(true);
    }, [user?.id, setShowLyricsDialog]);

    // ==================== 歌曲选择处理函数 ====================
    // 通用的 track 选择处理函数
    const handleTrackSelect = React.useCallback((
        track: any, 
        music: any, 
        options: { autoPlay?: boolean } = {}
    ) => {
        const { autoPlay = true } = options;
        
        // 如果点击的是当前播放的歌曲
        if (player.currentTrack?.id === track.id) {
            // 设置选中的track（用于歌词面板和选中状态显示）
                const selectedTrack = createTrackObject(
                    track.id,
                    music.id,
                    track.title || music.title || 'Untitled Track',
                    track.audioUrl || '',
                    track.duration,
                    track.coverR2Url || track.coverImage,
                    music.tags,
                    music.genre,
                    track.lyrics || music.lyrics,
                    track.isFavorited || false,
                    track.streamAudioUrl || '',
                    track.createdAt || music.createdAt || new Date().toISOString(),
                    music.generationMode
                );
            setSelectedStudioTrack(selectedTrack);
            setLyricsPanelOpen(true);
            
            // 如果是 autoPlay 模式（点击了播放/暂停按钮），则切换播放状态
            if (autoPlay) {
                togglePlayPause();
            }
            return;
        }
        
        // 设置选中的track（用于歌词面板和选中状态显示）
        const selectedTrack = createTrackObject(
            track.id,
            music.id,
            track.title || music.title || 'Untitled Track',
            track.audioUrl || track.audio_url || '', // 优先使用 audioUrl，兼容旧数据
            track.duration,
            track.coverR2Url || track.cover_r2_url || track.coverImage,
            music.tags,
            music.genre,
            track.lyrics || music.lyrics,
            track.isFavorited ?? track.is_favorited ?? false,
            track.streamAudioUrl || track.stream_audio_url,
            track.createdAt || music.createdAt || new Date().toISOString(),
            music.generationMode
        );
        setSelectedStudioTrack(selectedTrack);
        setLyricsPanelOpen(true);
        
        // 播放新歌曲
        if (autoPlay) {
            playTrackById(track.id);
        }
        
        // 歌词面板始终显示，无需手动控制
    }, [player, togglePlayPause, playTrackById, createTrackObject]);

    const handleInlineTrackPreview = React.useCallback((track: any) => {
        if (!track) return;
        const normalized = createTrackObject(
            track.id,
            track.generationId || track.musicGeneration?.id || track.musicId || '',
            track.title || track.musicTitle || 'Untitled Track',
            track.audioUrl || track.audio_url || '',
            typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0),
            track.coverR2Url || track.coverImage,
            track.tags || track.musicTags || '',
            track.genre || track.musicGenre || '',
            track.lyrics || track.musicGeneration?.lyricsContent || '',
            track.isFavorited ?? false,
            track.streamAudioUrl || '',
            track.createdAt || track.musicGeneration?.createdAt || new Date().toISOString(),
            track.musicGeneration?.generationMode
        );
        setSelectedStudioTrack(normalized);
        setLyricsPanelOpen(true);
    }, [createTrackObject]);

    // ==================== 下载和收藏处理函数 ====================
    // 辅助函数：下载文件
    const downloadFile = React.useCallback((blob: Blob, filename: string, format: string) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filename}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    }, []);

    // WAV下载轮询函数
    const handleWavDownloadWithPolling = React.useCallback(async (
        track: any,
        music: any,
        accessToken: string
    ) => {
        const POLL_INTERVAL = 3000; // 每3秒轮询一次
        const MAX_POLL_TIME = 180000; // 最大轮询时间：3分钟
        const startTime = Date.now();
        let lastProgress = 0;

        // 初始化弹窗状态
        setWavDownloadDialogOpen(true);
        setWavDownloadProgress(0);
        setWavDownloadStatus('preparing');
        setWavDownloadStatusText('Preparing download...');
        setWavDownloadErrorMessage('');
        setWavDownloadTrackTitle(track.title || music.title || 'Track');

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
                const response = await fetch(`/api/download-track?trackId=${track.id}&format=wav`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                
                const elapsedTime = Date.now() - startTime;
                
                // 检查是否超时
                if (elapsedTime > MAX_POLL_TIME) {
                    setWavDownloadStatus('error');
                    setWavDownloadStatusText('Download timeout');
                    setWavDownloadErrorMessage('WAV conversion is taking longer than expected. Please try again later.');
                    return;
                }

                if (response.status === 202) {
                    // WAV正在生成中，继续轮询
                    const data = await response.json();
                    if (data.status === 'generating') {
                        // 根据状态计算进度
                        const progress = calculateProgress(data.hasWavUrl || false, elapsedTime);
                        lastProgress = Math.max(lastProgress, progress); // 确保进度不会倒退
                        
                        // 更新弹窗状态
                        const statusText = data.hasWavUrl 
                            ? 'Processing WAV file...' 
                            : 'Waiting for conversion...';
                        
                        setWavDownloadProgress(lastProgress);
                        setWavDownloadStatus(data.hasWavUrl ? 'generating' : 'preparing');
                        setWavDownloadStatusText(statusText);
                        
                        // 继续轮询
                        setTimeout(pollForWav, POLL_INTERVAL);
                        return;
                    } else {
                        throw new Error(data.error || data.message || 'WAV generation failed');
                    }
                } else if (response.status === 200) {
                    // WAV已准备好，更新状态为下载中
                    setWavDownloadProgress(95);
                    setWavDownloadStatus('downloading');
                    setWavDownloadStatusText('Preparing file for download');
                    
                    // WAV已准备好，检查响应类型
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
                            downloadFile(blob, track.title || music.title || 'track', 'wav');
                            
                            // 更新为完成状态
                            setWavDownloadProgress(100);
                            setWavDownloadStatus('completed');
                            setWavDownloadStatusText('Download completed!');
                        } else {
                            throw new Error(data.error || 'Download failed');
                        }
                    } else {
                        // 正常模式：直接获取WAV文件
                        const blob = await response.blob();
                        downloadFile(blob, track.title || music.title || 'track', 'wav');
                        
                        // 更新为完成状态
                        setWavDownloadProgress(100);
                        setWavDownloadStatus('completed');
                        setWavDownloadStatusText('Download completed!');
                    }
                } else {
                    // 其他错误状态
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('WAV download polling error:', error);
                setWavDownloadStatus('error');
                setWavDownloadStatusText('Download failed');
                setWavDownloadErrorMessage(error instanceof Error ? error.message : 'Unable to download WAV file');
            }
        };

        // 开始首次请求
        await pollForWav();
    }, [downloadFile]);

    const handleDownload = React.useCallback(async (track: any, music: any, format: 'mp3' | 'wav' | 'cover' = 'mp3') => {
        if (!track.id) {
            toast.error('Track ID is required');
            return;
        }

        // 注意：权限检查现在在按钮层面完成，这里只处理实际下载逻辑
        // 后端API仍然会验证权限作为双重保险

        try {
            // 获取Supabase session token
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session?.access_token) {
                toast.error('Authentication required', {
                    description: 'Please log in to download tracks'
                });
                return;
            }

        // Cover格式：通过后端API代理下载，确保权限校验与CORS安全
            if (format === 'cover') {
            try {
                const apiUrl = `/api/download-cover?trackId=${encodeURIComponent(track.id)}`;
                const coverResponse = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: 'no-store',
                });
                if (!coverResponse.ok) {
                    const text = await coverResponse.text().catch(() => '');
                    throw new Error(text || `Failed to download cover: ${coverResponse.status}`);
                }
                const blob = await coverResponse.blob();
                const contentType = coverResponse.headers.get('content-type') || '';
                const lowerType = contentType.toLowerCase();
                let ext = 'png';
                if (lowerType.includes('jpeg') || lowerType.includes('jpg')) {
                    ext = 'jpg';
                } else if (lowerType.includes('png')) {
                    ext = 'png';
                } else if (lowerType.includes('webp')) {
                    ext = 'webp';
                } else if (lowerType.includes('gif')) {
                    ext = 'gif';
                } else if (lowerType.includes('bmp')) {
                    ext = 'bmp';
                } else if (lowerType.includes('tiff')) {
                    ext = 'tiff';
                }
                downloadFile(blob, track.title || music.title || 'cover', ext);
            } catch (error) {
                console.error('Cover download error:', error);
                toast.error('Download failed', {
                    description: error instanceof Error ? error.message : 'Unable to download cover image'
                });
            }
            return;
            }

            // WAV格式：统一通过下载 API 处理（API 会查询 track_wav_conversions 表）
            if (format === 'wav') {
                await handleWavDownloadWithPolling(track, music, session.access_token);
                return;
            }

            // MP3格式：直接检查 track.audioUrl 字段
            const audioUrl = track.audioUrl;
            
            // 严格检查：必须是字符串且不为空
            const hasAudioUrl = audioUrl && typeof audioUrl === 'string' && audioUrl.trim() !== '';
            
            if (hasAudioUrl) {
                // 直接下载，不显示任何toast
                try {
                    const audioResponse = await fetch(audioUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (compatible; MakernbBot/1.0)',
                        },
                    });

                    if (!audioResponse.ok) {
                        throw new Error(`Failed to fetch MP3: ${audioResponse.status}`);
                    }

                    const blob = await audioResponse.blob();
                    downloadFile(blob, track.title || music.title || 'track', 'mp3');
                    return;
                } catch (error) {
                    console.error('[DOWNLOAD] Error downloading MP3 from audio URL:', error);
                    // 如果直接下载失败，继续走API流程
                }
            }

            // 如果 audioUrl 不存在或下载失败，使用API下载（后端会验证权限）
            const response = await fetch(`/api/download-track?trackId=${track.id}&format=mp3`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
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
                    downloadFile(blob, track.title || music.title || 'track', 'mp3');
                } else {
                    throw new Error(data.error || 'Download failed');
                }
            } else {
                // 正常模式：直接获取音频文件
                const blob = await response.blob();
                downloadFile(blob, track.title || music.title || 'track', 'mp3');
            }
        } catch (error) {
            console.error('Download error:', error);
            // 不显示toast，直接静默失败
        }
    }, [downloadFile, handleWavDownloadWithPolling]);

    const handleFavoriteToggle = React.useCallback(async (track: any, music: any) => {
        if (!user?.id) {
            toast('Please log in to favorite tracks');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            const response = await fetch('/api/favorites/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    trackId: track.id
                })
            });

            if (!response.ok) {
                throw new Error('Failed to toggle favorite');
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to toggle favorite');
            }
            
            // 更新本地状态
            updateTrack(track.id, (t) => ({ ...t, isFavorited: data.isFavorited }));

            // 更新selectedStudioTrack状态，使用函数式更新避免依赖
            setSelectedStudioTrack(prev => {
                if (prev?.id === track.id) {
                    return {
                        ...prev,
                        isFavorited: data.isFavorited
                    } as StudioTrack;
                }
                return prev;
            });

            // 显示toast提示
            if (data.isFavorited) {
                toast.success('Added to favorites!', {
                    description: `"${music.title}" has been added to library.`
                });
            } else {
                toast.success('Removed from favorites', {
                    description: `"${music.title}" has been removed from library.`
                });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast.error('Failed to update favorite status');
        }
    }, [user?.id, updateTrack]);

    // ==================== 歌曲列表删除处理函数 ====================
    const handleTrackDelete = React.useCallback((track: any, music: any) => {
        // 设置要删除的track并打开确认对话框
        setTrackToDelete(track);
        setDeleteDialogOpen(true);
    }, []);

    const handleEditTitle = React.useCallback(async (trackId: string, newTitle: string) => {
        try {
            const response = await fetch('/api/update-track-title', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId, title: newTitle })
            });

            if (!response.ok) {
                throw new Error('Failed to update title');
            }

            // 更新本地状态 - 更新特定track的title而不是generation的title
            updateTrack(trackId, (t) => ({ ...t, title: newTitle }));

            // 如果当前选中的 track 被编辑了，更新 selectedStudioTrack
            if (selectedStudioTrack?.id === trackId) {
                setSelectedStudioTrack({
                    ...selectedStudioTrack,
                    title: newTitle
                });
            }

            toast.success('Title updated successfully');
        } catch (error) {
            console.error('Error updating title:', error);
            toast.error('Failed to update title');
        }
    }, [updateTrack, selectedStudioTrack]);

    const handleEditMusicInfo = React.useCallback(async (trackId: string, data: { title: string; coverImageUrl?: string }) => {
        try {
            // Ensure we include a valid Supabase access token for auth-protected APIs
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                toast.error('Please log in to update music info');
                return;
            }

            const response = await fetch('/api/update-track-info', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                    trackId, 
                    title: data.title,
                    coverImageUrl: data.coverImageUrl 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update music info');
            }

            const result = await response.json();

            // 更新本地状态
            updateTrack(trackId, (t) => ({ 
                ...t, 
                title: result.data?.title || data.title,
                coverImage: result.data?.coverImageUrl || t.coverImage,
                coverR2Url: result.data?.coverImageUrl || t.coverR2Url
            }));

            // 如果当前选中的 track 被编辑了，更新 selectedStudioTrack
            if (selectedStudioTrack?.id === trackId) {
                setSelectedStudioTrack({
                    ...selectedStudioTrack,
                    title: result.data?.title || data.title,
                    coverImage: result.data?.coverImageUrl || selectedStudioTrack.coverImage,
                    coverR2Url: result.data?.coverImageUrl || selectedStudioTrack.coverR2Url
                });
            }

            toast.success('Music info updated successfully');
        } catch (error) {
            console.error('Error updating music info:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update music info');
        }
    }, [updateTrack, selectedStudioTrack]);

    const handleDeleteTrack = React.useCallback(async (trackId: string) => {
        try {
            const response = await fetch('/api/delete-track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId })
            });

            if (!response.ok) {
                throw new Error('Failed to delete track');
            }

            const removedTrack = userTracks
                .flatMap(generation => generation.allTracks || [])
                .find((track: any) => track.id === trackId);
            const removedDuration = normalizeDuration(removedTrack?.duration);

            // 从本地状态中移除
            const updatedUserTracks = userTracks.map(generation => ({
                ...generation,
                allTracks: generation.allTracks.filter((t: any) => t.id !== trackId)
            })).filter(generation => generation.allTracks.length > 0);
            
            setUserTracks(updatedUserTracks);
            if (removedTrack) {
                setUserTracksSummary(prev => ({
                    totalTracks: Math.max(0, prev.totalTracks - 1),
                    totalDuration: Math.max(0, prev.totalDuration - removedDuration),
                }));
            }

            toast.success('Track deleted successfully');
        } catch (error) {
            console.error('Error deleting track:', error);
            toast.error('Failed to delete track');
        }
    }, [userTracks, normalizeDuration]);

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
            genre: completedTrack.genre || '',
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
                isFavorited: false
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
    }, [updateTracks]); // 🔧 移除 generatedTracks 依赖，避免不必要的重新创建


    // ==================== 使用 Track Generation Monitor Hook ====================
    // 将生成状态监听逻辑提取到自定义hook中，提高可维护性
    useTrackGenerationMonitor({
        generatedTracks,
        player,
        onTrackUpdate: (updater) => {
            setSelectedStudioTrack((prev) => {
                const next = updater(prev);
                if (next) {
                    setLyricsPanelOpen(true);
                }
                return next;
            });
        },
        onTrackCompleted: handleTrackCompleted, // 🆕 添加单个歌曲完成的回调
        onAllTracksCompleted: async () => {

            // 🔧 清理已处理的歌曲记录
            processedTracksRef.current.clear();

            // 🔧 刷新 userTracks，确保上传任务完成后同步到列表
            if (user?.id) {
                await fetchUserTracksRef.current({ mode: 'merge' });
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

    const inlineTrackDetails = React.useMemo(() => {
        if (!selectedStudioTrack) return null;

        const base = {
            id: selectedStudioTrack.id,
            title: selectedStudioTrack.title || 'Untitled Track',
            tags: selectedStudioTrack.tags || '',
            lyrics: selectedStudioTrack.lyrics || '',
            coverImage: selectedStudioTrack.coverImage || null,
            createdAt: selectedStudioTrack.createdAt || new Date().toISOString(),
            duration: selectedStudioTrack.duration ? selectedStudioTrack.duration.toString() : undefined
        };

        const { track: userTrack, music } = findTrackAndMusic(selectedStudioTrack.id);
        if (userTrack && music) {
            return {
                ...base,
                title: userTrack.title || music.title || base.title,
                tags: music.tags || base.tags,
                lyrics: userTrack.lyrics || music.lyrics || base.lyrics,
                coverImage: userTrack.coverR2Url || base.coverImage,
                createdAt: music.createdAt || base.createdAt,
                duration: userTrack.duration
                    ? userTrack.duration.toString()
                    : base.duration
            };
        }

        const generated = generatedTracks.find(t => t.id === selectedStudioTrack.id);
        if (generated) {
            return {
                ...base,
                title: generated.title || base.title,
                tags: generated.tags || base.tags,
                lyrics: generated.lyrics || base.lyrics,
                coverImage: generated.coverImage || base.coverImage,
                createdAt: generated.createdAt || base.createdAt,
                duration: generated.duration ? generated.duration.toString() : base.duration
            };
        }

        return base;
    }, [selectedStudioTrack, findTrackAndMusic, generatedTracks]);

    const isInitialUserTracksLoading = isFetchingUserTracks && userTracks.length === 0;

    React.useEffect(() => {
        if (!selectedStudioTrack) {
            lastSelectedTrackIdRef.current = null;
            return;
        }

        if (lastSelectedTrackIdRef.current !== selectedStudioTrack.id) {
            setLyricsPanelOpen(true);
        }

        lastSelectedTrackIdRef.current = selectedStudioTrack.id;
    }, [selectedStudioTrack]);

    const isInlineTrackPlaying = !!(selectedStudioTrack && player.currentTrack?.id === selectedStudioTrack.id && player.isPlaying);
    const showInlinePanel = Boolean(selectedStudioTrack) && lyricsPanelOpen;

    const handleInlinePanelPlay = React.useCallback(() => {
        if (!selectedStudioTrack) return;

        if (player.currentTrack?.id === selectedStudioTrack.id) {
            togglePlayPause();
        } else {
            playTrackById(selectedStudioTrack.id);
        }
    }, [selectedStudioTrack, togglePlayPause, playTrackById, player]);

    // ==================== 导航处理函数 ====================
    // 处理歌曲选择 - 跳转详情页
    const handleViewTrackDetail = React.useCallback((trackId: string) => {
        router.push(`/track/${trackId}`);
    }, [router]);

    // 用户歌曲选择（点击即播放并展示详情）
    const handleUserTrackSelect = React.useCallback((trackId: string) => {
        const shouldAutoPlay = !(player.currentTrack?.id === trackId && player.isPlaying);
        const { track: found, music } = findTrackAndMusic(trackId);
        if (found && music) {
            handleTrackSelect(found, music, { autoPlay: shouldAutoPlay });
            return;
        }

        const fallbackTrack = allTracks.find(track => track.id === trackId);
        if (fallbackTrack) {
            handleTrackSelect(fallbackTrack, fallbackTrack, { autoPlay: shouldAutoPlay });
        }
    }, [findTrackAndMusic, handleTrackSelect, allTracks, player.currentTrack?.id, player.isPlaying]);

    // 用户歌曲播放（点击播放按钮时直接播放）
    const handleUserTrackPlay = React.useCallback((track: any, music: any) => {
        if (!track) return;
        if (player.currentTrack?.id === track.id) {
            togglePlayPause();
            return;
        }
        playTrackById(track.id);
    }, [player, togglePlayPause, playTrackById]);
    
    // 生成的歌曲选择（点击即播放并展示详情）
    const handleGeneratedTrackSelect = React.useCallback((trackId: string) => {
        const track = generatedTracks.find(t => t.id === trackId);
        if (track) {
            const shouldAutoPlay = !(player.currentTrack?.id === trackId && player.isPlaying);
            handleTrackSelect(track, track, { autoPlay: shouldAutoPlay });
        }
    }, [generatedTracks, handleTrackSelect, player.currentTrack?.id, player.isPlaying]);

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
    // StudioPanel 通用 props
    const studioPanelProps = React.useMemo(() => ({
        mode,
        setMode,
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
        bpmMode,
        setBpmMode,
        isGenerating,
        onGenerationStart: handleGenerationStart,
        onGenerateLyrics: handleGenerateLyrics,
        isAuthModalOpen,
        setIsAuthModalOpen,
        selectedModel,
        setSelectedModel,
    }), [
        mode, setMode, selectedGenre, setSelectedGenre, selectedVibe, setSelectedVibe,
        simplePrompt, setSimplePrompt, customLyrics, setCustomLyrics, songTitle, setSongTitle, instrumentalMode, setInstrumentalMode,
        isPublished, styleText, setStyleText, bpm, setBpm, grooveType, setGrooveType,
        leadInstrument, setLeadInstrument, drumKit, setDrumKit, bassTone, setBassTone,
        vocalGender, setVocalGender, harmonyPalette, setHarmonyPalette, bpmMode, setBpmMode,
        isGenerating, handleGenerationStart, handleGenerateLyrics,
        isAuthModalOpen, setIsAuthModalOpen, selectedModel, setSelectedModel
    ]);

    // MusicPlayer 通用 props
    // ✅ 直接创建对象，不缓存，因为 player 使用 getter 模式
    // 这样可以确保每次渲染都读取到最新的播放器状态
    // 性能影响：创建对象本身很轻量，且 React.memo 会处理不必要的渲染
    const musicPlayerProps = {
        tracks: musicPlayerTracks,
        currentTrackIndex: allTracks.findIndex(track => track.id === player.currentTrack?.id),
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
        hideProgress: false,
        onTrackChange: (index: number) => {
            const selectedTrack = allTracks[index];
            if (selectedTrack) {
                handleTrackSelect(selectedTrack, selectedTrack, { autoPlay: true });
            }
        },
        playTrackById,
        // 在 Studio 中不传递 onTrackInfoClick，移除歌词按钮
    };

    // Delete handlers
    const handleDeleteClick = (track: any) => {
        setTrackToDelete(track);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!trackToDelete) return;

        try {
            // 获取当前session的access token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                toast('Authentication required. Please log in again.');
                return;
            }

            let response;

            // 判断删除场景：
            // 1. 如果是错误状态的generation（没有有效的tracks），删除整个generation
            // 2. 如果是正常的track，删除单个track
            if (trackToDelete.isError || !trackToDelete.id || trackToDelete.id.startsWith('error-')) {
                // 场景1：删除错误的music_generation
                response = await fetch(`/api/delete-music-generation?id=${trackToDelete.generationId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });
            } else {
                // 场景2：删除单个track
                response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });
            }

            const data = await response.json();

            if (data.success) {
                if (trackToDelete.isError || !trackToDelete.id || trackToDelete.id.startsWith('error-')) {
                    // 场景1：删除错误的generation，从tracks中移除
                    // 🔧 使用函数式更新，避免闭包陷阱
                    updateTracks((prevTracks) => 
                        prevTracks.filter(track => track.generationId !== trackToDelete.generationId)
                    );
                } else {
                    // 场景2：删除单个track，从tracks中移除
                    // 🔧 使用函数式更新，避免闭包陷阱
                    updateTracks((prevTracks) => 
                        prevTracks.filter(track => track.id !== trackToDelete.id)
                    );

                    // 同时从userTracks中更新（如果存在）
                    const updatedUserTracks = userTracks.map(generation => ({
                        ...generation,
                        allTracks: generation.allTracks.map((t: any) =>
                            t.id === trackToDelete.id
                                ? { ...t, isDeleted: true }
                                : t
                        )
                    }));
                    setUserTracks(updatedUserTracks);
                    setUserTracksSummary(prev => ({
                        totalTracks: Math.max(0, prev.totalTracks - 1),
                        totalDuration: Math.max(0, prev.totalDuration - normalizeDuration(trackToDelete.duration)),
                    }));

                    // 发送删除事件到 EventBus
                    if (typeof window !== 'undefined') {
                        const eventBus = getEventBus();
                        eventBus.emit(TRACK_EVENTS.DELETED, {
                            trackId: trackToDelete.id
                        });
                    }
                }

                // If the deleted track is currently playing, stop playback
                // 现在通过 EventBus 自动处理，AudioPlayer 会监听 TRACK_EVENTS.DELETED 事件并自动停止播放

                // If the deleted track is selected for lyrics, close lyrics panel
                if (selectedStudioTrack?.id === trackToDelete.id ||
                    selectedStudioTrack?.generationId === trackToDelete.generationId) {
                    setSelectedStudioTrack(null);
                }

                toast.success('Track deleted successfully');
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

    const studioMainLayout = (
        <section
            id="studio"
            className="relative h-screen overflow-hidden"
        >
            <div
                className="relative h-full flex flex-col md:flex-row md:gap-0 md:px-4 md:py-0 transition-[margin] duration-500"
                style={{ marginLeft: 'var(--sidebar-offset, 0px)' }}
            >
                <div className="hidden md:block md:order-2 flex-shrink-0 md:pr-4">
                    <StudioPanel
                        {...studioPanelProps}
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
                    className="flex-1 min-w-0 h-full flex z-10 md:order-3 relative pb-[calc(var(--mobile-nav-height,64px)+var(--player-height,48px)+1rem)] md:pb-0 md:pl-4 md:shadow-[-1px_0_0_rgba(0,0,0,0.06)] md:dark:shadow-[-1px_0_0_rgba(255,255,255,0.08)]"
                    style={{
                        paddingBottom: player.currentTrack 
                            ? undefined
                            : 'calc(var(--mobile-nav-height, 64px))'
                    }}
                >
                    <div className="min-h-0 h-full flex flex-col relative w-full z-10">
                        <div className="md:hidden flex-shrink-0">
                            <div className="px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Music className="h-8 w-8 text-primary" />
                                        <h1 className="text-2xl font-semibold">Studio</h1>
                                    </div>
                                    <button
                                        onClick={() => setMobileCreateOpen(true)}
                                        className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                                        title="Start Creating"
                                    >
                                        <Wand2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                    <div className={`flex flex-col md:flex-row flex-1 min-h-0 min-w-0 ${showInlinePanel ? 'md:gap-4' : 'md:gap-0'}`}>
                        <div className={`flex-1 min-h-0 min-w-0 px-4 md:px-0 ${showInlinePanel ? 'md:pl-0 md:pr-0' : ''}`}>
                                <div className="flex-1 min-h-0 md:hidden">
                                    <StudioTracksList
                                        userTracks={convertUserTracksToMusicGeneration(userTracks)}
                                        generatedTracks={generatedTracks}
                                        onTrackSelect={handleUserTrackSelect}
                                        onTrackPreview={handleInlineTrackPreview}
                                        onTrackPlay={handleUserTrackPlay}
                                        onGeneratedTrackSelect={handleGeneratedTrackSelect}
                                        onDelete={handleDeleteClick}
                                        onFavoriteToggle={handleFavoriteToggle}
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
                                        extendMusicStartPolling={extendMusic.startPolling}
                                        extendMusicGetState={extendMusic.getExtendMusicState}
                                        extendMusicClearState={extendMusic.clearExtendMusicState}
                                        selectedModel={selectedModel}
                                    />
                                </div>

                                <div className="hidden md:block min-h-0 h-full">
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
                                        onDelete={handleTrackDelete}
                                        hasPlayer={!!player.currentTrack}
                                        onEditTitle={handleEditTitle}
                                        onEditMusicInfo={handleEditMusicInfo}
                                        extendMusicStartPolling={extendMusic.startPolling}
                                        extendMusicGetState={extendMusic.getExtendMusicState}
                                        extendMusicClearState={extendMusic.clearExtendMusicState}
                                        selectedModel={selectedModel}
                                    />
                                </div>
                            </div>

                        <div
                            className={`relative transition-all duration-300 flex-shrink-0 z-[80] ${
                                showInlinePanel
                                    ? 'opacity-100 w-full md:w-80 px-0 md:px-0 md:py-4 overflow-visible'
                                    : 'opacity-0 pointer-events-none w-0 md:w-0 px-0 overflow-hidden'
                            }`}
                        >
                                {showInlinePanel && (
                                    <div className="h-full">
                                    <InlineTrackDetailsPanel
                                        track={inlineTrackDetails}
                                        isPlaying={isInlineTrackPlaying}
                                        onClose={() => setLyricsPanelOpen(false)}
                                        variant="studio"
                                    />
                                    </div>
                                )}
                            </div>
	                    </div>
	                </div>

	            </div>

                {player.currentTrack && (
                    <div
                        className="fixed md:absolute left-3 right-3 md:left-4 md:right-[calc(var(--studio-player-right)+1rem)] bottom-[calc(var(--mobile-nav-height,0px)+0.75rem)] md:bottom-4 z-[45] pointer-events-auto"
                        style={{
                            ['--studio-player-right' as any]: showInlinePanel ? 'calc(20rem + 1rem)' : '0px',
                        }}
                    >
                        <MusicPlayer {...musicPlayerProps} />
                    </div>
                )}

                <MobileCreateDrawer
                    isOpen={mobileCreateOpen}
                    onClose={() => setMobileCreateOpen(false)}
                    studioPanelProps={studioPanelProps}
                />
            </div>

            {/* Removed pulse-line (ECG) animation for Studio page */}
        </section>
    );

    return (
        <>
            <CommonSidebar onWidthChange={setSidebarWidth} />
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
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
                    <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 text-left relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
                        <DialogTitle className="text-xl font-semibold tracking-tight">
                            Generate Lyrics
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Describe the theme, mood, or story you want for your lyrics.
                        </p>
                    </DialogHeader>
                    <div className="flex-1 px-6 py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium block">Lyrics Prompt</label>
                            <div className="relative">
                                <Textarea
                                    value={lyricsPrompt}
                                    onChange={(e) => setLyricsPrompt(e.target.value)}
                                    placeholder="Describe the theme, mood, or story for your lyrics..."
                                    maxLength={200}
                                    className="w-full resize-none h-32 border focus-visible:ring-0 focus-visible:ring-offset-0 text-sm pr-16"
                                />
                                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                                    {lyricsPrompt.length}/200
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-shrink-0 px-6 pb-6">
                        <Button
                            onClick={() => handleGenerateLyricsHook(setCustomLyrics, user?.id || '')}
                            disabled={isGeneratingLyrics || !lyricsPrompt.trim()}
                            className="w-full h-11 text-sm font-medium"
                        >
                            {isGeneratingLyrics ? (
                                <div className="flex items-center gap-2">
                                    <span>Generating</span>
                                    <LoadingDots size="sm" color="white" />
                                </div>
                            ) : (
                                'Generate Lyrics'
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
                        <AlertDialogTitle className="text-lg sm:text-xl">Delete Track</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm sm:text-base whitespace-nowrap">
                            Are you sure you want to delete the current track?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                        <AlertDialogCancel className="w-full sm:w-auto text-foreground hover:text-foreground dark:hover:text-accent-foreground">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Confirm
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
                onClose={() => {
                    setWavDownloadDialogOpen(false);
                    // 重置状态
                    setWavDownloadProgress(0);
                    setWavDownloadStatus('preparing');
                    setWavDownloadStatusText('');
                    setWavDownloadErrorMessage('');
                    setWavDownloadTrackTitle('');
                }}
                trackTitle={wavDownloadTrackTitle}
                progress={wavDownloadProgress}
                status={wavDownloadStatus}
                statusText={wavDownloadStatusText}
                errorMessage={wavDownloadErrorMessage}
            />
        </>
    );
};

export const StudioSection = () => {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <StudioContent />
        </Suspense>
    );
};
