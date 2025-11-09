"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Custom Hooks
import { useMusicGeneration } from "@/hooks/use-music-generation";
import { useLyricsGeneration } from "@/hooks/use-lyrics-generation";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { getAudioService } from "@/lib/audio-service";
import { useTrackGenerationMonitor } from "@/hooks/use-track-generation-monitor";
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";

// 导入统一的 Track 类型
import { StudioTrack } from "@/types/track";

// Components
import { CommonSidebar } from "@/components/ui/sidebar";
import { StudioPanel } from "@/components/ui/studio-panel";
import { StudioTracksList } from "@/components/ui/studio-tracks-list";
import { TrackDetailView } from "@/components/ui/track-detail-view";
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
import { CheckCircle, Star, Music, Wand2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const StudioContent = () => {
    // Router 和 Search Params
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedTrackId = searchParams?.get('track') || null;

    // Custom Hooks
    const musicGeneration = useMusicGeneration();
    const lyricsGeneration = useLyricsGeneration();
    const { user, signOut } = useAuth();
    const { credits, refreshCredits } = useCredits();
    const { hasPermission } = useFeaturePermissions();

    // UI States
    const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [trackToDelete, setTrackToDelete] = useState<any>(null);
    const [generationConfirmOpen, setGenerationConfirmOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isLoadingUserTracks, setIsLoadingUserTracks] = useState(false);
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
    const [selectedStudioTrack, setSelectedStudioTrack] = useState<StudioTrack | null>(null);
    const [panelOpen, setPanelOpen] = useState(true);

    // ==================== 播放器状态管理 ====================
    const audioPlayer = useAudioPlayer();
    
    // 🎯 使用 ref 保存 audioPlayer 的最新引用，创建稳定的访问接口
    const audioPlayerRef = React.useRef(audioPlayer);
    React.useEffect(() => {
        audioPlayerRef.current = audioPlayer;
    }, [audioPlayer]);
    
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
    
    // 收藏状态管理
    const [favoriteLoading, setFavoriteLoading] = React.useState<Record<string, boolean>>({});
    
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
        customPrompt, setCustomPrompt,
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
        isGenerating,
        generatedTracks,
        state,
        updateTracks,
    } = musicGeneration;

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
        streamAudioUrl?: string
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
        isFavorited: isFavorited // 使用驼峰命名
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
                track.streamAudioUrl ?? ''
            ));
        });
        
        // 添加 userTracks 的所有 tracks
        userTracks.forEach(music => {
            if (music.allTracks && music.allTracks.length > 0) {
                music.allTracks.forEach((track: any) => {
                    tracks.push(createTrackObject(
                        track.id,
                        music.id,
                        music.title,
                        track.audioUrl ?? '',
                        track.duration,
                        track.coverR2Url ?? undefined,
                        music.tags,
                        music.genre,
                        track.lyrics ?? music.lyrics ?? '',
                        track.isFavorited ?? false,
                        track.streamAudioUrl ?? ''
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

    // ==================== 播放歌曲核心函数 ====================
    const playTrackById = React.useCallback(async (trackId: string) => {
        try {
            // 查找track信息
            const localTrack = allTracks.find(track => track.id === trackId);
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
    }, [allTracks, player]);

    // ==================== 上一首/下一首函数 ====================
    const handlePrevious = React.useCallback(() => {
        if (!player.currentTrack || allTracks.length === 0) return;
        
        const currentIndex = allTracks.findIndex(track => track.id === player.currentTrack?.id);
        if (currentIndex === -1) return;
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : allTracks.length - 1;
        const prevTrack = allTracks[prevIndex];
        
        if (prevTrack) {
            playTrackById(prevTrack.id);
            // 更新选中状态
            setSelectedStudioTrack(prevTrack);
        }
    }, [player, allTracks, playTrackById]);

    const handleNext = React.useCallback(() => {
        if (!player.currentTrack || allTracks.length === 0) return;
        
        const currentIndex = allTracks.findIndex(track => track.id === player.currentTrack?.id);
        if (currentIndex === -1) return;
        
        const nextIndex = currentIndex < allTracks.length - 1 ? currentIndex + 1 : 0;
        const nextTrack = allTracks[nextIndex];
        
        if (nextTrack) {
            playTrackById(nextTrack.id);
            // 更新选中状态
            setSelectedStudioTrack(nextTrack);
        }
    }, [player, allTracks, playTrackById]);

    // 获取用户 tracks
    const fetchUserTracks = React.useCallback(async () => {
        if (!user?.id) return;
        setIsLoadingUserTracks(true);
        try {
            // 获取当前session的access token
            const { data: { session } } = await supabase.auth.getSession();
            
            // 添加时间戳参数强制刷新缓存
            const timestamp = Date.now();
            const response = await fetch(`/api/user-music/${user.id}?limit=50&offset=0&_t=${timestamp}`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            if (response.ok) {
                const data = await response.json();
                const tracks = data.data?.music || [];
                setUserTracks(tracks);
            } else {
                console.error('Failed to fetch user tracks:', response.status, response.statusText);
                setUserTracks([]);
            }
        } catch (error) {
            console.error('Error fetching user tracks:', error);
        } finally {
            setIsLoadingUserTracks(false);
        }
    }, [user?.id]);

    // 初始化时获取用户 tracks 或使用模拟数据
    useEffect(() => {
        if (user?.id) {
            fetchUserTracks();
        }
    }, [user?.id, fetchUserTracks]);

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
    const handleGenerationStart = React.useCallback(async () => {
        await handleGenerate();
    }, [handleGenerate]);

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
                music.title,
                track.audioUrl || '',
                track.duration,
                track.coverR2Url || track.coverImage,
                music.tags,
                music.genre,
                track.lyrics || music.lyrics,
                track.isFavorited || false,
                track.streamAudioUrl || ''
            );
            setSelectedStudioTrack(selectedTrack);
            
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
            music.title,
            track.audioUrl || track.audio_url || '', // 优先使用 audioUrl，兼容旧数据
            track.duration,
            track.coverR2Url || track.cover_r2_url || track.coverImage,
            music.tags,
            music.genre,
            track.lyrics || music.lyrics,
            track.isFavorited ?? track.is_favorited ?? false,
            track.streamAudioUrl || track.stream_audio_url
        );
        setSelectedStudioTrack(selectedTrack);
        
        // 播放新歌曲
        if (autoPlay) {
            playTrackById(track.id);
        }
        
        // 歌词面板始终显示，无需手动控制
    }, [player, togglePlayPause, playTrackById, createTrackObject]);

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
        setWavDownloadTrackTitle(music.title || track.title || 'Track');

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
                            downloadFile(blob, music.title || 'track', 'wav');
                            
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
                        downloadFile(blob, music.title || 'track', 'wav');
                        
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

    const handleDownload = React.useCallback(async (track: any, music: any, format: 'mp3' | 'wav' = 'mp3') => {
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
                    downloadFile(blob, music.title || 'track', 'mp3');
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
                    downloadFile(blob, music.title || 'track', 'mp3');
                } else {
                    throw new Error(data.error || 'Download failed');
                }
            } else {
                // 正常模式：直接获取音频文件
                const blob = await response.blob();
                downloadFile(blob, music.title || 'track', 'mp3');
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
            const updatedUserTracks = userTracks.map(generation => ({
                ...generation,
                allTracks: generation.allTracks.map((t: any) =>
                    t.id === track.id
                        ? { ...t, isFavorited: data.isFavorited }
                        : t
                )
            }));
            setUserTracks(updatedUserTracks);

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
                toast('Added to favorites!', {
                    icon: <Star className="h-4 w-4 text-red-500 fill-current" />,
                    description: `"${music.title}" has been added to library.`
                });
            } else {
                toast('Removed from favorites', {
                    icon: <Star className="h-4 w-4 text-gray-500" />,
                    description: `"${music.title}" has been removed from library.`
                });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast.error('Failed to update favorite status');
        }
    }, [user?.id, userTracks]);

    // ==================== 歌曲列表删除处理函数 ====================
    const handleTrackDelete = React.useCallback((track: any, music: any) => {
        // 设置要删除的track并打开确认对话框
        setTrackToDelete(track);
        setDeleteDialogOpen(true);
    }, []);

    // ==================== 其他Track操作函数 ====================
    const handlePublishToggle = React.useCallback(async (trackId: string, isPublished: boolean) => {
        try {
            const response = await fetch('/api/toggle-track-publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId, isPublished: !isPublished })
            });

            if (!response.ok) {
                throw new Error('Failed to toggle publish status');
            }

            // 更新本地状态
            const updatedUserTracks = userTracks.map(generation => ({
                ...generation,
                allTracks: generation.allTracks.map((t: any) =>
                    t.id === trackId
                        ? { ...t, isPublished: !isPublished }
                        : t
                )
            }));
            setUserTracks(updatedUserTracks);

            toast(isPublished ? 'Track unpublished' : 'Track published');
        } catch (error) {
            console.error('Error toggling publish:', error);
            toast.error('Failed to update publish status');
        }
    }, [userTracks]);

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
            const updatedUserTracks = userTracks.map(generation => {
                const trackIndex = generation.allTracks.findIndex((t: any) => t.id === trackId);
                if (trackIndex !== -1) {
                    const updatedTracks = [...generation.allTracks];
                    updatedTracks[trackIndex] = {
                        ...updatedTracks[trackIndex],
                        title: newTitle
                    };
                    return {
                        ...generation,
                        allTracks: updatedTracks
                    };
                }
                return generation;
            });
            setUserTracks(updatedUserTracks);

            // 如果当前选中的 track 被编辑了，更新 selectedStudioTrack
            if (selectedStudioTrack?.id === trackId) {
                setSelectedStudioTrack({
                    ...selectedStudioTrack,
                    title: newTitle
                });
            }

            toast('Title updated successfully');
        } catch (error) {
            console.error('Error updating title:', error);
            toast.error('Failed to update title');
        }
    }, [userTracks, selectedStudioTrack]);

    const handlePinToggle = React.useCallback(async (trackId: string, isPinned: boolean) => {
        try {
            const response = await fetch('/api/toggle-track-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId, isPinned: !isPinned })
            });

            if (!response.ok) {
                throw new Error('Failed to toggle pin status');
            }

            // 更新本地状态
            const updatedUserTracks = userTracks.map(generation => ({
                ...generation,
                allTracks: generation.allTracks.map((t: any) =>
                    t.id === trackId
                        ? { ...t, isPinned: !isPinned }
                        : t
                )
            }));
            setUserTracks(updatedUserTracks);

            toast(isPinned ? 'Track unpinned' : 'Track pinned');
        } catch (error) {
            console.error('Error toggling pin:', error);
            toast.error('Failed to update pin status');
        }
    }, [userTracks]);

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

            // 从本地状态中移除
            const updatedUserTracks = userTracks.map(generation => ({
                ...generation,
                allTracks: generation.allTracks.filter((t: any) => t.id !== trackId)
            })).filter(generation => generation.allTracks.length > 0);
            
            setUserTracks(updatedUserTracks);

            toast('Track deleted successfully');
        } catch (error) {
            console.error('Error deleting track:', error);
            toast.error('Failed to delete track');
        }
    }, [userTracks]);

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
            prompt: '', // 生成时没有 prompt，可以留空
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

    // ==================== 同步 URL 参数和选中状态 ====================
    // 当 URL 有 track 参数时，如果当前没有选中状态，尝试从播放器状态恢复
    // 注意：返回列表页时保持选中状态，不清除 selectedStudioTrack
    React.useEffect(() => {
        if (selectedTrackId && !selectedStudioTrack && player.currentTrack) {
            // 如果 URL 有参数但没有选中状态，且正在播放，恢复选中状态
            if (player.currentTrack.id === selectedTrackId) {
                setSelectedStudioTrack(player.currentTrack);
            }
        }
    }, [selectedTrackId, selectedStudioTrack, player.currentTrack]);

    // ==================== 使用 Track Generation Monitor Hook ====================
    // 将生成状态监听逻辑提取到自定义hook中，提高可维护性
    useTrackGenerationMonitor({
        generatedTracks,
        player,
        onTrackUpdate: setSelectedStudioTrack,
        onTrackCompleted: handleTrackCompleted, // 🆕 添加单个歌曲完成的回调
        onAllTracksCompleted: async () => {
            
            // 🔧 清理已处理的歌曲记录
            processedTracksRef.current.clear();
            
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

    // ==================== 导航处理函数 ====================
    // 处理歌曲选择 - 更新 URL 参数
    const handleViewTrackDetail = React.useCallback((trackId: string) => {
        router.push(`/studio?track=${trackId}`, { scroll: false });
    }, [router]);

    // 处理返回列表 - 清除 URL 参数
    const handleBackToList = React.useCallback(() => {
        // 使用 replace 替换当前 URL，不创建新的历史记录
        router.replace('/studio', { scroll: false });
    }, [router]);

    // 用户歌曲选择（打开详情页并根据情况播放）
    const handleUserTrackSelect = React.useCallback((trackId: string) => {
        // 跳转到详情页
        handleViewTrackDetail(trackId);
        
        // 从 userTracks 中找到对应的 track
        const found = userTracks.flatMap(gen => gen.allTracks).find((t: any) => t.id === trackId);
        if (found) {
            const music = userTracks.find(gen => gen.allTracks.some((t: any) => t.id === trackId));
            if (music) {
                // 🎯 如果点击的是当前播放的歌曲，则不播放（只选中）
                // 如果点击的是不同的歌曲，则自动播放
                const isDifferentTrack = player.currentTrack?.id !== trackId;
                handleTrackSelect(found, music, { autoPlay: isDifferentTrack });
            }
        }
    }, [handleViewTrackDetail, userTracks, handleTrackSelect, player.currentTrack?.id]);

    // 用户歌曲播放（点击播放按钮时直接播放）
    const handleUserTrackPlay = React.useCallback((track: any, music: any) => {
        handleTrackSelect(track, music, { autoPlay: true });
    }, [handleTrackSelect]);
    
    // 生成的歌曲选择（打开详情页并根据情况播放）
    const handleGeneratedTrackSelect = React.useCallback((trackId: string) => {
        // 跳转到详情页
        handleViewTrackDetail(trackId);
        
        // 从 generatedTracks 中找到对应的 track
        const track = generatedTracks.find(t => t.id === trackId);
        if (track) {
            // 🎯 如果点击的是当前播放的歌曲，则不播放（只选中）
            // 如果点击的是不同的歌曲，则自动播放
            const isDifferentTrack = player.currentTrack?.id !== trackId;
            handleTrackSelect(track, track, { autoPlay: isDifferentTrack });
        }
    }, [handleViewTrackDetail, generatedTracks, handleTrackSelect, player.currentTrack?.id]);

    // 转换 UserTrack 到 MusicGeneration 格式
    const convertUserTracksToMusicGeneration = (userTracks: any[]): any[] => {
        return userTracks.map(userTrack => ({
            ...userTrack,
            prompt: userTrack.title, // 使用 title 作为 prompt
            isInstrumental: false, // 默认值
            updatedAt: userTrack.createdAt, // 使用 createdAt
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
        customPrompt,
        setCustomPrompt,
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
    }), [
        mode, setMode, selectedGenre, setSelectedGenre, selectedVibe, setSelectedVibe,
        customPrompt, setCustomPrompt, songTitle, setSongTitle, instrumentalMode, setInstrumentalMode,
        isPublished, styleText, setStyleText, bpm, setBpm, grooveType, setGrooveType,
        leadInstrument, setLeadInstrument, drumKit, setDrumKit, bassTone, setBassTone,
        vocalGender, setVocalGender, harmonyPalette, setHarmonyPalette, bpmMode, setBpmMode,
        isGenerating, handleGenerationStart, handleGenerateLyrics,
        isAuthModalOpen, setIsAuthModalOpen
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

    return (
        <>
            <section id="studio" className="relative h-screen flex flex-col md:flex-row bg-background overflow-hidden">
                {/* Common Sidebar - 桌面端最左侧，移动端底部导航 */}
                <div className="md:relative md:z-[40] md:order-1 flex-shrink-0">
                    <CommonSidebar />
                </div>

                {/* Studio Control Panel - 桌面端中间；移动端底部抽屉 - 只在非详情页时显示 */}
                {!selectedTrackId && (
                    <div className="hidden md:block md:order-2 flex-shrink-0">
                        <StudioPanel
                            {...studioPanelProps}
                            panelOpen={panelOpen}
                            setPanelOpen={setPanelOpen}
                        />
                    </div>
                )}

                {/* Mobile Tabs removed per requirement */}

                {/* Mobile Header - 仅在歌曲列表页显示，详情页不显示（与library保持一致） */}
                {!selectedTrackId && (
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
                )}

                {/* MAIN CONTENT - Unified Responsive Layout */}
                <div 
                    className="flex-1 min-w-0 h-full flex z-10 md:order-3 relative pb-[calc(var(--mobile-nav-height,64px)+var(--player-height,48px)+1rem)] md:pb-0"
                    style={{
                        paddingBottom: player.currentTrack 
                            ? undefined
                            : 'calc(var(--mobile-nav-height, 64px))'
                    }}
                >
                    {/* Background Image for Studio Area - Desktop only */}
                    <div 
                        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat opacity-5 pointer-events-none"
                        style={{
                            backgroundImage: "url('/bg-studio-background.webp')"
                        }}
                    />

                    {selectedTrackId ? (
                        /* Track Detail View - Responsive */
                        <TrackDetailView 
                            trackId={selectedTrackId}
                            trackData={
                                (() => {
                                    const generatedTrack = generatedTracks.find(t => t.id === selectedTrackId);
                                    if (generatedTrack) {
                                        return {
                                            id: generatedTrack.id,
                                            title: generatedTrack.title,
                                            tags: generatedTrack.tags || '',
                                            lyrics: generatedTrack.lyrics || '',
                                            coverImage: generatedTrack.coverImage || null,
                                            audioUrl: generatedTrack.audioUrl || '',
                                            createdAt: generatedTrack.createdAt || new Date().toISOString(),
                                            duration: generatedTrack.duration?.toString() || '0',
                                            isPublished: false,
                                            isFavorited: generatedTrack.isFavorited || false,
                                            userId: user?.id,
                                            status: generatedTrack.isCompleted ? 'complete' : 'generating'
                                        };
                                    }
                                    
                                    const foundUserTrack = userTracks
                                        .flatMap(gen => gen.allTracks || [])
                                        .find((t: any) => t.id === selectedTrackId);
                                    
                                    if (foundUserTrack) {
                                        const music = userTracks.find(gen => 
                                            gen.allTracks?.some((t: any) => t.id === selectedTrackId)
                                        );
                                        
                                        if (music) {
                                            return {
                                                id: foundUserTrack.id,
                                                title: music.title || foundUserTrack.title || '',
                                                tags: music.tags || '',
                                                lyrics: foundUserTrack.lyrics || music.lyrics || '',
                                                coverImage: foundUserTrack.coverR2Url || null,
                                                audioUrl: foundUserTrack.audioUrl || '',
                                                createdAt: music.createdAt || new Date().toISOString(),
                                                duration: foundUserTrack.duration?.toString() || '0',
                                                isPublished: music.isPublished || false,
                                                isFavorited: foundUserTrack.isFavorited || false,
                                                userId: user?.id,
                                                status: music.status || 'complete'
                                            };
                                        }
                                    }
                                    
                                    return undefined;
                                })()
                            }
                            onBack={handleBackToList}
                            // currentPlayingTrackId 和 isPlaying 通过 EventBus 自动获取
                            onPlayTrack={(trackInfo) => {
                                // 如果点击的是当前播放的歌曲，则暂停/继续
                                if (player.currentTrack?.id === trackInfo.id) {
                                    togglePlayPause();
                                    return;
                                }
                                
                                // 播放新歌曲 - 构造track和music对象
                                const track = {
                                    id: trackInfo.id,
                                    audioUrl: trackInfo.audioUrl,
                                    duration: parseFloat(trackInfo.duration),
                                    coverR2Url: trackInfo.coverImage,
                                    lyrics: trackInfo.lyrics,
                                    isFavorited: trackInfo.isFavorited
                                };
                                
                                const music = {
                                    id: trackInfo.id,
                                    title: trackInfo.title,
                                    tags: trackInfo.tags,
                                    genre: '',
                                    lyrics: trackInfo.lyrics
                                };
                                
                                handleTrackSelect(track, music, { autoPlay: true });
                            }}
                            onFavoriteToggle={(trackId, isFavorited) => {
                                // 从userTracks中找到对应的track
                                const found = userTracks.flatMap(gen => gen.allTracks).find((t: any) => t.id === trackId);
                                if (found) {
                                    const music = userTracks.find(gen => gen.allTracks.some((t: any) => t.id === trackId));
                                    if (music) {
                                        handleFavoriteToggle(found, music);
                                    }
                                }
                            }}
                            onDownload={(trackInfo) => {
                                const track = {
                                    id: trackInfo.id,
                                    audioUrl: trackInfo.audioUrl
                                };
                                const music = {
                                    title: trackInfo.title
                                };
                                handleDownload(track, music);
                            }}
                            isFavorited={
                                userTracks.flatMap(gen => gen.allTracks)
                                    .find((t: any) => t.id === selectedTrackId)?.isFavorited || false
                            }
                            onPublishToggle={handlePublishToggle}
                            onEditTitle={handleEditTitle}
                            onDelete={handleDeleteTrack}
                            onPinToggle={handlePinToggle}
                            isPublished={
                                userTracks.flatMap(gen => gen.allTracks)
                                    .find((t: any) => t.id === selectedTrackId)?.isPublished || false
                            }
                            isPinned={
                                userTracks.flatMap(gen => gen.allTracks)
                                    .find((t: any) => t.id === selectedTrackId)?.isPinned || false
                            }
                            isAdmin={false}
                            currentUserId={user?.id || null}
                        />
                    ) : (
                        /* Tracks List - Responsive */
                        <div className="min-h-0 h-full flex flex-col relative w-full z-10">
                            {/* Mobile-only Header and Controls */}
                            <div className="md:hidden flex-shrink-0">
                                {/* Header */}
                                <div className="px-6 py-4 bg-background/60 backdrop-blur-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Music className="h-8 w-8 text-primary" />
                                            <h1 className="text-2xl font-semibold">Studio</h1>
                                        </div>
                                        {/* Create Button */}
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

                            {/* Tracks List Container - Shows on mobile, wrapped in StudioTracksList on desktop */}
                            <div className="flex-1 min-h-0 md:hidden">
                                <StudioTracksList
                                    userTracks={convertUserTracksToMusicGeneration(userTracks)}
                                    generatedTracks={generatedTracks}
                                    onTrackSelect={handleUserTrackSelect}
                                    onTrackPlay={handleUserTrackPlay}
                                    onGeneratedTrackSelect={handleGeneratedTrackSelect}
                                    onDelete={handleDeleteClick}
                                    onFavoriteToggle={handleFavoriteToggle}
                                    onDownload={handleDownload}
                                    isLoading={isLoadingUserTracks}
                                    selectedTrack={selectedStudioTrack?.id}
                                    hasPlayer={!!player.currentTrack}
                                    onPublishToggle={handlePublishToggle}
                                    onEditTitle={handleEditTitle}
                                />
                            </div>

                            {/* Desktop StudioTracksList - with full features */}
                            <div className="hidden md:block flex-1 min-h-0">
                                <StudioTracksList
                                    userTracks={convertUserTracksToMusicGeneration(userTracks)}
                                    isLoading={isLoadingUserTracks}
                                    onTrackSelect={handleUserTrackSelect}
                                    onTrackPlay={handleUserTrackPlay}
                                    // currentlyPlaying 和 isPlaying 通过 EventBus 自动获取
                                    selectedTrack={selectedStudioTrack?.id}
                                    generatedTracks={stableGeneratedTracks}
                                    onGeneratedTrackSelect={handleGeneratedTrackSelect}
                                    onDownload={handleDownload}
                                    onFavoriteToggle={handleFavoriteToggle}
                                    onDelete={handleTrackDelete}
                                    hasPlayer={!!player.currentTrack}
                                    onPublishToggle={handlePublishToggle}
                                    onEditTitle={handleEditTitle}
                                />
                            </div>
                        </div>
                    )}

                    {/* Music Player - Fixed on mobile, Absolute on desktop */}
                    {player.currentTrack && (
                        <div className="fixed md:absolute left-3 right-3 md:right-3 z-[60]" style={{
                            bottom: 'calc(var(--mobile-nav-height, 0px) + 0.75rem)'
                        }}>
                            <MusicPlayer {...musicPlayerProps} />
                        </div>
                    )}
                </div>

                {/* Mobile Create Panel - 使用提取的组件 */}
                <MobileCreateDrawer
                    isOpen={mobileCreateOpen}
                    onClose={() => setMobileCreateOpen(false)}
                    studioPanelProps={studioPanelProps}
                />

            </section>

            {/* Lyrics Generation Dialog */}
            <Dialog open={showLyricsDialog} onOpenChange={setShowLyricsDialog}>
                <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] border-0 p-4 sm:p-6 gap-4 sm:gap-6">
                    <DialogHeader className="space-y-1.5 sm:space-y-3">
                        <DialogTitle className="text-lg sm:text-xl">Generate Lyrics</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 sm:space-y-5">
                        <div className="space-y-2 sm:space-y-3">
                            <label className="text-sm font-medium block">Lyrics Prompt</label>
                            <Textarea
                                value={lyricsPrompt}
                                onChange={(e) => setLyricsPrompt(e.target.value)}
                                placeholder="Describe the theme, mood, or story for your lyrics..."
                                className="w-full resize-none h-28 sm:h-32 border focus-visible:ring-0 focus-visible:ring-offset-0 text-sm sm:text-base"
                            />
                        </div>
                        <div className="w-full pt-2">
                            <Button
                                onClick={() => handleGenerateLyricsHook(setCustomPrompt, user?.id || '')}
                                disabled={isGeneratingLyrics || !lyricsPrompt.trim()}
                                className="w-full h-11 sm:h-10 text-base sm:text-sm"
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
                <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
                    <AlertDialogHeader className="space-y-2 sm:space-y-3">
                        <AlertDialogTitle className="text-lg sm:text-xl">Delete Track</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm sm:text-base">
                            Are you sure you want to delete &quot;{trackToDelete?.musicTitle || trackToDelete?.title}&quot;? This action cannot be undone.
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
