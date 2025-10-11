"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";

// Custom Hooks
import { useMusicGeneration } from "@/hooks/use-music-generation";
import { useLyricsGeneration } from "@/hooks/use-lyrics-generation";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";

// Components
import { CommonSidebar } from "@/components/ui/sidebar";
import { StudioPanel } from "@/components/ui/studio-panel";
import { MusicPlayer } from "@/components/ui/music-player";
import { LyricsPanel } from "@/components/ui/lyrics-panel";
import { StudioTracksList } from "@/components/ui/studio-tracks-list";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { CheckCircle, Heart, HeartCrack } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { isAdmin } from "@/lib/auth-utils-optimized";
import Image from "next/image";

const StudioContent = () => {
    // Custom Hooks
    const musicGeneration = useMusicGeneration();
    const lyricsGeneration = useLyricsGeneration();
    const { user } = useAuth();
    const { refreshCredits } = useCredits();

    // UI States
    const [panelOpen, setPanelOpen] = useState(true);
    const [showLyrics, setShowLyrics] = useState(false);
    // 移动端：底部弹出创作面板
    const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

    // 进入 Studio 时：移动端默认打开 Create 弹窗
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setMobilePanelOpen(true);
        }
    }, []);

    // 监听全局登录弹窗事件
    useEffect(() => {
        const openAuthHandler = () => setIsAuthModalOpen(true);
        window.addEventListener('auth:open' as any, openAuthHandler as any);
        return () => {
            window.removeEventListener('auth:open' as any, openAuthHandler as any);
        };
    }, []);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [trackToDelete, setTrackToDelete] = useState<any>(null);
    const [generationConfirmOpen, setGenerationConfirmOpen] = useState(false);
    
    // User Tracks States
    const [userTracks, setUserTracks] = useState<any[]>([]);
    const [isLoadingUserTracks, setIsLoadingUserTracks] = useState(false);

    // 播放器状态
    const [currentPlayingTrack, setCurrentPlayingTrack] = React.useState<any>(null);
    // 选中的歌曲状态（用于歌词面板）
    const [selectedStudioTrack, setSelectedStudioTrack] = React.useState<any>(null);
    // 生成中的歌曲状态（用于text回调后自动显示歌词面板）
    const [generatingTrack, setGeneratingTrack] = React.useState<any>(null);
    // 收藏状态管理
    const [favoriteLoading, setFavoriteLoading] = React.useState<Record<string, boolean>>({});
    
    // BPM Mode状态
    const [bpmMode, setBpmMode] = React.useState<'slow' | 'moderate' | 'medium' | ''>('');

    // Destructure states and functions
    const {
        mode, setMode,
        selectedGenre, setSelectedGenre,
        selectedVibe, setSelectedVibe,
        customPrompt, setCustomPrompt,
        songTitle, setSongTitle,
        instrumentalMode, setInstrumentalMode,
        isPublished, setIsPublished,
        bpm, setBpm,
        grooveType, setGrooveType,
        leadInstrument, setLeadInstrument,
        drumKit, setDrumKit,
        bassTone, setBassTone,
        vocalGender, setVocalGender,
        harmonyPalette, setHarmonyPalette,
        isGenerating,
        allGeneratedTracks, setAllGeneratedTracks,
        activeTrackIndex, setActiveTrackIndex,
        pendingTasksCount,
    } = musicGeneration;

    // 简化的播放器状态管理
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    // 音量控制
    const changeVolume = (newVolume: number) => {
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    // 计算当前播放的歌曲
    const currentTrack = React.useMemo(() => {
        return activeTrackIndex !== null ? allGeneratedTracks[activeTrackIndex] : null;
    }, [allGeneratedTracks, activeTrackIndex]);

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
        sideLetter: string = 'A'
    ) => ({
        id,
        generationId,
        title,
        audioUrl,
        duration,
        coverImage,
        tags,
        genre,
        lyrics,
        side_letter: sideLetter
    }), []);

    // 合并所有歌曲的所有 tracks 来创建完整的 track 列表
    const allTracks = React.useMemo(() => {
        const tracks: any[] = [];
        
        // 添加 allGeneratedTracks 的 tracks
        allGeneratedTracks.forEach(track => {
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
                'A'
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
                        track.audio_url,
                        track.duration,
                        track.cover_r2_url,
                        music.tags,
                        music.genre,
                        track.lyrics || music.lyrics,
                        track.side_letter
                    ));
                });
            }
        });
        
        return tracks;
    }, [allGeneratedTracks, userTracks, createTrackObject]);

    // 播放/暂停控制
    const togglePlayPause = React.useCallback(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(console.error);
            }
        }
    }, [isPlaying]);

    // 统一的音频播放函数
    const playAudioWithDelay = React.useCallback((audioUrl?: string) => {
        setTimeout(() => {
            if (audioRef.current && audioUrl) {
                audioRef.current.play().catch(console.error);
            }
        }, 100);
    }, []);

    // 统一的播放切换逻辑
    const switchToTrack = React.useCallback((track: any) => {
        const playingTrack = createTrackObject(
            track.id,
            track.generationId,
            track.title,
            track.audioUrl,
            track.duration,
            track.coverImage,
            track.tags,
            track.genre,
            track.lyrics,
            track.side_letter
        );
        
        setCurrentPlayingTrack(playingTrack);
        setSelectedStudioTrack(playingTrack);
        setShowLyrics(true);
        // 关闭移动端创作抽屉，避免遮挡播放器
        setMobilePanelOpen(false);
        
        playAudioWithDelay(track.audioUrl);
    }, [createTrackObject, playAudioWithDelay]);

    // 上一首歌曲回调
    const handlePrevious = React.useCallback(() => {
        if (!currentPlayingTrack || allTracks.length === 0) return;
        
        const currentIndex = allTracks.findIndex(track => track.id === currentPlayingTrack.id);
        if (currentIndex === -1) return;
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : allTracks.length - 1;
        const prevTrack = allTracks[prevIndex];
        
        if (prevTrack) {
            switchToTrack(prevTrack);
        }
    }, [currentPlayingTrack, allTracks, switchToTrack]);

    // 下一首歌曲回调
    const handleNext = React.useCallback(() => {
        if (!currentPlayingTrack || allTracks.length === 0) return;
        
        const currentIndex = allTracks.findIndex(track => track.id === currentPlayingTrack.id);
        if (currentIndex === -1) return;
        
        const nextIndex = currentIndex < allTracks.length - 1 ? currentIndex + 1 : 0;
        const nextTrack = allTracks[nextIndex];
        
        if (nextTrack) {
            switchToTrack(nextTrack);
        }
    }, [currentPlayingTrack, allTracks, switchToTrack]);

    // 获取用户 tracks
    const fetchUserTracks = React.useCallback(async () => {
        if (!user?.id) return;

        setIsLoadingUserTracks(true);
        try {
            // 获取当前session的access token
            const { data: { session } } = await supabase.auth.getSession();
            
            const response = await fetch(`/api/user-music/${user.id}?limit=50&offset=0`, {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setUserTracks(data.data?.music || []);
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

    // 组件卸载时清理音频资源
    useEffect(() => {
        const audio = audioRef.current;
        return () => {
            if (audio) {
                audio.pause();
                audio.src = '';
            }
        };
    }, []);
    
    // 监听currentTrack变化，更新音频源（仅用于新生成的歌曲，当没有用户选择的歌曲时）
    React.useEffect(() => {
        if (currentTrack?.audioUrl && audioRef.current && !currentPlayingTrack) {
            audioRef.current.src = currentTrack.audioUrl;
            audioRef.current.load();
        }
    }, [currentTrack, currentPlayingTrack]);

    // 监听currentPlayingTrack变化，更新音频源
    React.useEffect(() => {
        if (currentPlayingTrack?.audioUrl && audioRef.current) {
            // 只有当音频URL真正变化时才重新加载音频
            if (audioRef.current.src !== currentPlayingTrack.audioUrl) {
                // 检查是否正在播放，如果是则不打断播放
                const wasPlaying = !audioRef.current.paused;
                const currentTime = audioRef.current.currentTime;
                
                audioRef.current.src = currentPlayingTrack.audioUrl;
                audioRef.current.load();
                
                // 如果之前正在播放，恢复播放状态和进度
                if (wasPlaying) {
                    audioRef.current.addEventListener('canplay', () => {
                        if (audioRef.current) {
                            audioRef.current.currentTime = currentTime;
                            audioRef.current.play().catch(console.error);
                        }
                    }, { once: true });
                } else {
                    // 重置播放状态
                    setIsPlaying(false);
                    setCurrentTime(0);
                }
            }
            // 只有当 duration 真正变化时才更新，避免触发循环
            const newDuration = currentPlayingTrack.duration || 0;
            if (duration !== newDuration) {
                setDuration(newDuration);
            }
        }
    }, [currentPlayingTrack, duration]);

    // Audio event handlers
    const handleAudioLoad = () => {
        if (audioRef.current) {
            // 优先使用currentPlayingTrack.duration（如果歌曲生成完成），否则使用音频文件的duration
            if (currentPlayingTrack?.duration && currentPlayingTrack.duration > 0) {
                setDuration(currentPlayingTrack.duration);
            } else {
                setDuration(audioRef.current.duration || 0);
            }
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleAudioEnd = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const handlePlay = () => {
        setIsPlaying(true);
    };

    const handlePause = () => {
        setIsPlaying(false);
    };

    const handleMuteToggle = () => {
        if (audioRef.current) {
            const newMutedState = !isMuted;
            setIsMuted(newMutedState);
            audioRef.current.muted = newMutedState;
        }
    };

    // Lyrics generation
    const {
        showLyricsDialog, setShowLyricsDialog,
        lyricsPrompt, setLyricsPrompt,
        isGeneratingLyrics,
        handleGenerateLyrics: handleGenerateLyricsHook,
    } = lyricsGeneration;

    // Event handlers
    const handleGenerate = async () => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return false;
        }

        // 清除之前的歌词面板状态
        setShowLyrics(false);
        setSelectedStudioTrack(null);
        setGeneratingTrack(null);
        setCurrentPlayingTrack(null);

        try {
            await musicGeneration.handleGenerate(
                refreshCredits, 
                setIsPlaying, 
                () => setGenerationConfirmOpen(true) // API成功后立即显示确认弹窗
            );
            return true;
        } catch (error) {
            console.error('Generation failed:', error);
            return false;
        }
    };

    // Handle generation start - remove library loading
    const handleGenerationStart = async () => {
        // 调用音乐生成逻辑，API成功后立即显示确认弹窗
        await handleGenerate();
    };

    // 移除自动关闭逻辑，让用户手动关闭确认弹窗

    const handleGenerateLyrics = React.useCallback(() => {
        if (!user?.id) {
            setIsAuthModalOpen(true);
            return;
        }
        setShowLyricsDialog(true);
    }, [user?.id, setShowLyricsDialog]);

    // 统一的用户歌曲处理逻辑
    const createUserTrackObject = React.useCallback((track: any, music: any) => 
        createTrackObject(
            track.id,
            music.id,
            music.title,
            track.audio_url,
            track.duration,
            track.cover_r2_url,
            music.tags,
            music.genre,
            track.lyrics || music.lyrics,
            track.side_letter
        ), [createTrackObject]);

    // 歌曲选择处理（点击歌曲行，不播放）
    const handleUserTrackSelect = React.useCallback((track: any, music: any) => {     
        const selectedTrack = createUserTrackObject(track, music);
        setSelectedStudioTrack(selectedTrack);
        setShowLyrics(true);
    }, [createUserTrackObject]);

    // 歌曲播放处理（点击播放按钮）
    const handleUserTrackPlay = React.useCallback((track: any, music: any) => {
        // 如果点击的是当前播放的歌曲，则暂停/继续
        if (currentPlayingTrack?.id === track.id) {
            togglePlayPause();
        } else {
            const playingTrack = createUserTrackObject(track, music);
            setCurrentPlayingTrack(playingTrack);
        setSelectedStudioTrack(playingTrack);
        setShowLyrics(true);
        // 关闭移动端创作抽屉，避免遮挡播放器
        setMobilePanelOpen(false);

            playAudioWithDelay(playingTrack.audioUrl);
        }
    }, [currentPlayingTrack, togglePlayPause, createUserTrackObject, playAudioWithDelay]);

    // 处理生成的tracks选择/播放
    const handleGeneratedTrackSelect = React.useCallback((generatedTrack: any) => {
        // 优先使用final audio，如果没有则使用stream audio
        const audioUrl = generatedTrack.audioUrl || generatedTrack.streamAudioUrl || '';

        // 创建播放器需要的歌曲对象
        const playingTrack = {
            id: generatedTrack.id,
            generationId: generatedTrack.generationId,
            title: generatedTrack.title,
            audioUrl: audioUrl,
            duration: generatedTrack.duration,
            coverImage: generatedTrack.coverImage,
            tags: generatedTrack.tags,
            genre: generatedTrack.genre,
            lyrics: generatedTrack.lyrics || '',
            isUsingStreamAudio: generatedTrack.isUsingStreamAudio || false
        };
        setCurrentPlayingTrack(playingTrack);

        // 也可以设置为选中状态用于歌词显示
        const selectedTrack = {
            id: generatedTrack.id ,
            title: generatedTrack.title ,
            genre: generatedTrack.genre ,
            tags: generatedTrack.tags ,
            lyrics: generatedTrack.lyrics || '',
            duration: generatedTrack.duration,
            cover_r2_url: generatedTrack.coverImage,
            audio_url: audioUrl,
            side_letter: generatedTrack.sideLetter,
            created_at: new Date().toISOString(),
            is_published: isPublished, // 直接使用isPublished：true=公开，false=私有
            is_deleted: false,
            is_favorited: false,
            is_pinned: false
        };

        setSelectedStudioTrack(selectedTrack);
        setShowLyrics(true);
        // 关闭移动端创作抽屉，避免遮挡播放器
        setMobilePanelOpen(false);

        // 自动播放生成的歌曲
        playAudioWithDelay(audioUrl);
    }, [isPublished, playAudioWithDelay, setCurrentPlayingTrack, setSelectedStudioTrack, setShowLyrics]);

    // 监听生成状态变化，当text回调完成时自动显示歌词面板
    React.useEffect(() => {
        if (allGeneratedTracks.length === 0) return;
        const firstGeneratedSong = allGeneratedTracks[0];

        const isTextCallbackComplete = !!firstGeneratedSong.streamAudioUrl &&
                                       firstGeneratedSong.streamAudioUrl.trim() !== '';

        // 幂等性保护：如果已设置过同一首歌，则不再重复设置，避免循环更新
        if (selectedStudioTrack?.id === firstGeneratedSong.id || generatingTrack?.id === firstGeneratedSong.id) {
            return;
        }

        if (isTextCallbackComplete && !showLyrics && !generatingTrack) {
            const generatedTrack = {
                id: firstGeneratedSong.id,
                generationId: firstGeneratedSong.generationId,
                title: firstGeneratedSong.title,
                audioUrl: firstGeneratedSong.audioUrl || firstGeneratedSong.streamAudioUrl,
                duration: firstGeneratedSong.duration,
                coverImage: firstGeneratedSong.coverImage,
                tags: firstGeneratedSong.tags,
                genre: firstGeneratedSong.genre,
                lyrics: firstGeneratedSong.lyrics,
                isGenerating: !firstGeneratedSong.coverImage,
                isUsingStreamAudio: firstGeneratedSong.isUsingStreamAudio
            };

            setSelectedStudioTrack(generatedTrack);
            setGeneratingTrack(generatedTrack);
            setShowLyrics(true);
            // 关闭移动端创作抽屉，避免遮挡播放器
            setMobilePanelOpen(false);

            if (!currentPlayingTrack) {
                const playingTrack = {
                    ...generatedTrack,
                    isUsingStreamAudio: firstGeneratedSong.isUsingStreamAudio || false
                };
                setCurrentPlayingTrack(playingTrack);

                const audioUrl = firstGeneratedSong.audioUrl || firstGeneratedSong.streamAudioUrl;
                if (audioRef.current && audioUrl) {
                    audioRef.current.src = audioUrl;
                    audioRef.current.load();
                    playAudioWithDelay(audioUrl);
                }
            }
        }
    }, [allGeneratedTracks, showLyrics, generatingTrack, currentPlayingTrack, selectedStudioTrack, playAudioWithDelay]);

    // 监听complete回调完成，更新currentPlayingTrack的duration
    React.useEffect(() => {
        if (allGeneratedTracks.length === 0 || !currentPlayingTrack) return;
        const firstGeneratedSong = allGeneratedTracks[0];

        const isCompleteCallbackComplete = !!firstGeneratedSong.audioUrl &&
                                           !!firstGeneratedSong.duration &&
                                           firstGeneratedSong.duration > 0 &&
                                           !firstGeneratedSong.isGenerating;

        // 幂等性保护：仅当正在使用流式音频或时长不同才更新，避免重复 setState
        const needsUpdate =
            isCompleteCallbackComplete &&
            currentPlayingTrack.id === firstGeneratedSong.id &&
            (currentPlayingTrack.isUsingStreamAudio || (firstGeneratedSong.duration !== duration));

        if (!needsUpdate) return;

        const finalDuration = firstGeneratedSong.duration!;
        setDuration(finalDuration);
        setCurrentPlayingTrack((prev: any) => ({
            ...prev,
            duration: finalDuration,
            isUsingStreamAudio: false
        }));

        // 使用 ref 存储 timeout，组件卸载时清理
        const timeoutId = setTimeout(() => {
            fetchUserTracks();
            // 只有在确实非空时才清空，避免无意义的重复 state 更新
            setAllGeneratedTracks([]);
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [allGeneratedTracks, currentPlayingTrack, duration, fetchUserTracks, setAllGeneratedTracks]);

    // 监听封面图生成完成，替换磁带占位图
    React.useEffect(() => {
        if (!generatingTrack || allGeneratedTracks.length === 0) return;
        const firstGeneratedSong = allGeneratedTracks[0];

        // 幂等性保护：只在封面图刚生成（之前没有，现在有了）时更新一次
        const shouldUpdateCover = 
            firstGeneratedSong.coverImage && 
            generatingTrack.isGenerating && 
            !generatingTrack.coverImage &&
            firstGeneratedSong.id === generatingTrack.id;

        if (!shouldUpdateCover) return;

        const updatedTrack = {
            ...generatingTrack,
            coverImage: firstGeneratedSong.coverImage,
            isGenerating: false
        };

        setSelectedStudioTrack(updatedTrack);
        setGeneratingTrack(null);

        // 只在播放中且 ID 匹配时才更新封面
        if (currentPlayingTrack?.id === generatingTrack.id && 
            currentPlayingTrack.coverImage !== firstGeneratedSong.coverImage) {
            setCurrentPlayingTrack((prev: any) => ({
                ...prev,
                coverImage: firstGeneratedSong.coverImage
            }));
        }
    }, [allGeneratedTracks, generatingTrack, currentPlayingTrack]);

    // Favorite handlers
    const handleFavoriteToggle = async (track: any) => {
        if (!user?.id) {
            toast('Please log in to favorite tracks');
            return;
        }

        setFavoriteLoading(prev => ({ ...prev, [track.id]: true }));

        try {
            // 获取当前session的access token
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                toast('Please log in to favorite tracks');
                return;
            }

            const response = await fetch('/api/favorites/toggle', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ trackId: track.id })
            });

            const data = await response.json();

            if (data.success) {
                // 更新本地状态
                setUserTracks(prevTracks =>
                    prevTracks.map(generation => ({
                        ...generation,
                        allTracks: generation.allTracks.map((t: any) =>
                            t.id === track.id
                                ? { ...t, is_favorited: data.isFavorited }
                                : t
                        )
                    }))
                );

                // 更新selectedStudioTrack状态
                if (selectedStudioTrack?.id === track.id) {
                    setSelectedStudioTrack((prev: any) => ({
                        ...prev,
                        is_favorited: data.isFavorited
                    }));
                }

                // 显示toast提示
                if (data.isFavorited) {
                    toast('Added to favorites!', {
                        icon: <Heart className="h-4 w-4 text-red-500" />,
                        description: `"${track.title}" has been added to your favorites.`
                    });
                } else {
                    toast('Removed from favorites!', {
                        icon: <HeartCrack className="h-4 w-4 text-gray-500" />,
                        description: `"${track.title}" has been removed from your favorites.`
                    });
                }
            } else {
                console.error('Failed to toggle favorite:', data.error);
                toast(data.error || 'Failed to toggle favorite');
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast('Failed to toggle favorite');
        } finally {
            setFavoriteLoading(prev => ({ ...prev, [track.id]: false }));
        }
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
                    // 场景1：删除了错误的generation，从allGeneratedTracks中移除
                    setAllGeneratedTracks(prevTracks =>
                        prevTracks.filter(track => track.generationId !== trackToDelete.generationId)
                    );
                } else {
                    // 场景2：删除了单个track，从allGeneratedTracks中移除该track
                    setAllGeneratedTracks(prevTracks =>
                        prevTracks.filter(track => track.id !== trackToDelete.id)
                    );

                    // 同时从userTracks中移除（如果存在）
                    setUserTracks(prevTracks =>
                        prevTracks.map(generation => ({
                            ...generation,
                            allTracks: generation.allTracks.map((t: any) =>
                                t.id === trackToDelete.id
                                    ? { ...t, is_deleted: true }
                                    : t
                            )
                        }))
                    );
                }

                // If the deleted track is currently playing, stop playback
                if (currentPlayingTrack?.id === trackToDelete.id ||
                    currentPlayingTrack?.generationId === trackToDelete.generationId) {
                    setCurrentPlayingTrack(null);
                    setIsPlaying(false);
                    if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.src = '';
                    }
                }

                // If the deleted track is selected for lyrics, close lyrics panel
                if (selectedStudioTrack?.id === trackToDelete.id ||
                    selectedStudioTrack?.generationId === trackToDelete.generationId) {
                    setSelectedStudioTrack(null);
                    setShowLyrics(false);
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
            <section id="studio" className="h-screen flex flex-col md:flex-row bg-background">
                {/* Common Sidebar */}
                <CommonSidebar hideMobileNav={mobilePanelOpen || showLyrics} />

                {/* Mobile Tabs removed per requirement */}

                {/* Studio Control Panel - 桌面左侧固定；移动端底部抽屉 */}
                <div className="hidden md:block">
                <StudioPanel
                    panelOpen={panelOpen}
                    setPanelOpen={setPanelOpen}
                    mode={mode}
                    setMode={setMode}
                    selectedGenre={selectedGenre}
                    setSelectedGenre={setSelectedGenre}
                    selectedVibe={selectedVibe}
                    setSelectedVibe={setSelectedVibe}
                    customPrompt={customPrompt}
                    setCustomPrompt={setCustomPrompt}
                    songTitle={songTitle}
                    setSongTitle={setSongTitle}
                    instrumentalMode={instrumentalMode}
                    setInstrumentalMode={setInstrumentalMode}
                    isPublished={isPublished}
                    setIsPublished={setIsPublished}
                    bpm={bpm}
                    setBpm={setBpm}
                    grooveType={grooveType}
                    setGrooveType={setGrooveType}
                    leadInstrument={leadInstrument}
                    setLeadInstrument={setLeadInstrument}
                    drumKit={drumKit}
                    setDrumKit={setDrumKit}
                    bassTone={bassTone}
                    setBassTone={setBassTone}
                    vocalGender={vocalGender}
                    setVocalGender={setVocalGender}
                    harmonyPalette={harmonyPalette}
                    setHarmonyPalette={setHarmonyPalette}
                    bpmMode={bpmMode}
                    setBpmMode={setBpmMode}
                    isGenerating={isGenerating}
                    pendingTasksCount={pendingTasksCount}
                    onGenerationStart={handleGenerationStart}
                    onGenerateLyrics={handleGenerateLyrics}
                    isAuthModalOpen={isAuthModalOpen}
                    setIsAuthModalOpen={setIsAuthModalOpen}
                />
                </div>

                

                {/* Mobile bottom sheet for StudioPanel */}
                {mobilePanelOpen && (
                    <div className="md:hidden fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setMobilePanelOpen(false)} />
                        <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] h-[85vh] bg-background border-t border-border/30 rounded-t-2xl shadow-2xl overflow-hidden transform-gpu transition-transform duration-300 ease-out will-change-transform" id="mobile-create-sheet" style={{ bottom: currentPlayingTrack ? 'var(--player-height, 64px)' : '0px', height: currentPlayingTrack ? 'calc(85vh - var(--player-height, 64px))' : '85vh' }}>
                            <div className="h-full overflow-hidden">
                                <StudioPanel
                                    forceVisibleOnMobile
                                    onCollapse={() => {
                                        // 动效：吸入到 Studio 导航按钮
                                        try {
                                            const sheet = document.getElementById('mobile-create-sheet');
                                            const target = document.getElementById('mobile-studio-nav');
                                            if (sheet && target) {
                                                const sheetRect = sheet.getBoundingClientRect();
                                                const targetRect = target.getBoundingClientRect();
                                                const translateX = targetRect.left + targetRect.width/2 - (sheetRect.left + sheetRect.width/2);
                                                const translateY = targetRect.top + targetRect.height/2 - (sheetRect.top + sheetRect.height/2);
                                                sheet.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(0.1)`;
                                                sheet.style.opacity = '0.6';
                                                setTimeout(() => setMobilePanelOpen(false), 250);
                                            } else {
                                                setMobilePanelOpen(false);
                                            }
                                        } catch {
                                            setMobilePanelOpen(false);
                                        }
                                    }}
                                    panelOpen={true}
                                    setPanelOpen={() => {}}
                                    mode={mode}
                                    setMode={setMode}
                                    selectedGenre={selectedGenre}
                                    setSelectedGenre={setSelectedGenre}
                                    selectedVibe={selectedVibe}
                                    setSelectedVibe={setSelectedVibe}
                                    customPrompt={customPrompt}
                                    setCustomPrompt={setCustomPrompt}
                                    songTitle={songTitle}
                                    setSongTitle={setSongTitle}
                                    instrumentalMode={instrumentalMode}
                                    setInstrumentalMode={setInstrumentalMode}
                                    isPublished={isPublished}
                                    setIsPublished={setIsPublished}
                                    bpm={bpm}
                                    setBpm={setBpm}
                                    grooveType={grooveType}
                                    setGrooveType={setGrooveType}
                                    leadInstrument={leadInstrument}
                                    setLeadInstrument={setLeadInstrument}
                                    drumKit={drumKit}
                                    setDrumKit={setDrumKit}
                                    bassTone={bassTone}
                                    setBassTone={setBassTone}
                                    vocalGender={vocalGender}
                                    setVocalGender={setVocalGender}
                                    harmonyPalette={harmonyPalette}
                                    setHarmonyPalette={setHarmonyPalette}
                                    bpmMode={bpmMode}
                                    setBpmMode={setBpmMode}
                                    isGenerating={isGenerating}
                                    pendingTasksCount={pendingTasksCount}
                                    onGenerationStart={handleGenerationStart}
                                    onGenerateLyrics={handleGenerateLyrics}
                                    isAuthModalOpen={isAuthModalOpen}
                                    setIsAuthModalOpen={setIsAuthModalOpen}
                                />
                            </div>
                            
                        </div>
                    </div>
                )}

                {/* MAIN CONTENT - STUDIO */}
                <div className="flex-1 flex flex-col md:flex-row relative min-w-0 overflow-hidden h-screen">
                    {/* Background Image for Studio Area */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                        style={{
                            backgroundImage: "url('/bg-studio-background.webp')"
                        }}
                    />

                    {/* 歌曲列表区域 - 移动端默认显示；桌面端在歌词面板显示时占 2/3 */}
                    <div className={`h-full flex flex-col relative min-w-0 transition-all duration-300 w-full ${showLyrics ? 'md:w-2/3' : 'md:w-full'}`}>
                        {/* 歌曲列表区域 - 可滚动 */}
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200" style={{ 
                            // 仅预留播放器高度；播放器本身已上移到底部导航之上
                            paddingBottom: 'var(--player-height, 64px)'
                        }}>
                            <StudioTracksList
                                userTracks={userTracks}
                                isLoading={isLoadingUserTracks}
                                onTrackSelect={handleUserTrackSelect}
                                onTrackPlay={handleUserTrackPlay}
                                currentlyPlaying={currentPlayingTrack?.id}
                                selectedTrack={selectedStudioTrack?.id}
                                isPlaying={isPlaying && currentTime > 0}
                                allGeneratedTracks={allGeneratedTracks}
                                pendingTasksCount={pendingTasksCount}
                                panelOpen={panelOpen}
                                onExpandPanel={() => setPanelOpen(true)}
                                onGeneratedTrackSelect={handleGeneratedTrackSelect}
                            />
                        </div>

                        {/* Music Player - 固定在歌曲列表底部 */}
                        {currentPlayingTrack && (
                        <div className={`fixed md:absolute left-0 right-0 z-[60] transition-all duration-300 ease-in-out md:bottom-0`} style={{ bottom: showLyrics ? '0px' : 'var(--mobile-nav-height, 0px)' }}>
                                <MusicPlayer
                                tracks={allTracks.map(track => ({
                                    id: track.id,
                                    title: track.title,
                                    audioUrl: track.audioUrl,
                                    duration: track.duration,
                                    coverImage: track.coverImage,
                                    artist: track.genre,
                                    allTracks: [{
                                        id: track.id,
                                        audio_url: track.audioUrl,
                                        duration: track.duration,
                                        side_letter: track.side_letter,
                                        cover_r2_url: track.coverImage
                                    }]
                                }))}
                                currentTrackIndex={allTracks.findIndex(track => track.id === currentPlayingTrack?.id)}
                                currentPlayingTrack={currentPlayingTrack ? { trackId: currentPlayingTrack.id || '', audioUrl: currentPlayingTrack.audioUrl || '' } : null}
                                isPlaying={isPlaying}
                                currentTime={currentTime}
                                duration={duration}
                                volume={volume}
                                isMuted={isMuted}
                                onPlayPause={togglePlayPause}
                                onPrevious={handlePrevious}
                                onNext={handleNext}
                                onSeek={(time) => {
                                    if (audioRef.current && duration > 0 && currentPlayingTrack) {
                                        audioRef.current.currentTime = time;
                                    }
                                }}
                                onVolumeChange={(newVolume) => {
                                    changeVolume(newVolume);
                                }}
                                onMuteToggle={handleMuteToggle}
                                hideProgress={showLyrics}
                                onTrackChange={(index) => {
                                    // 修复：使用 allTracks 而不是 userTracks
                                    const selectedTrack = allTracks[index];
                                    if (selectedTrack) {
                                        switchToTrack(selectedTrack);
                                    }
                                }}
                                onSideChange={() => {}}
                                />
                            </div>
                        )}

                        <audio
                            ref={audioRef}
                            src={currentPlayingTrack?.audioUrl || ''}
                            onLoadedMetadata={handleAudioLoad}
                            onTimeUpdate={handleTimeUpdate}
                            onEnded={handleAudioEnd}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            preload="metadata"
                        />
                    </div>

                    {/* Lyrics Panel - 右侧（移动端：浮层；桌面端：右侧栏） */}
                    {(showLyrics && selectedStudioTrack) && (
                        <>
                        {/* Backdrop for mobile - 只覆盖到播放器上缘 */}
                        <div
                            className="fixed left-0 right-0 top-0 bg-black/50 z-[50] md:hidden transition-opacity duration-300"
                            style={{ bottom: showLyrics ? 'var(--player-height, 64px)' : 'calc(var(--mobile-nav-height, 0px) + var(--player-height, 64px))' }}
                            onClick={() => {
                                setShowLyrics(false);
                                setSelectedStudioTrack(null);
                                setGeneratingTrack(null);
                            }}
                        />
                        <div
                            className="fixed md:relative left-0 right-0 md:left-auto md:right-auto w-full md:w-1/3 md:h-full flex-shrink-0 z-[55] md:z-auto"
                            style={{
                                bottom: showLyrics ? '0px' : 'var(--mobile-nav-height, 0px)',
                                height: showLyrics ? 'calc(100vh - var(--player-height, 64px))' : 'calc(100vh - var(--mobile-nav-height, 0px) - var(--player-height, 64px))'
                            }}
                        >
                            {/* 歌词内容区域 */}
                            <div className="flex-1 min-h-0">
                                <LyricsPanel
                                isOpen={showLyrics}
                                onClose={() => {
                                    setShowLyrics(false);
                                    setSelectedStudioTrack(null);
                                    setGeneratingTrack(null); // 清除生成中状态
                                }}
                                lyrics={selectedStudioTrack?.lyrics}
                                title={selectedStudioTrack?.title}
                                tags={selectedStudioTrack?.tags}
                                genre={selectedStudioTrack?.genre}
                                coverImage={selectedStudioTrack?.coverImage || selectedStudioTrack?.cover_r2_url}
                                sideLetter={selectedStudioTrack?.side_letter || 'A'}
                                isFavorited={selectedStudioTrack?.is_favorited || false}
                                isAdmin={isAdmin(user?.id || '')}
                                isGenerating={selectedStudioTrack?.isGenerating || false}
                                isPlaying={isPlaying && currentPlayingTrack?.id === selectedStudioTrack?.id && currentTime > 0}
                                onDownload={() => {
                                    if (selectedStudioTrack?.audioUrl) {
                                        const link = document.createElement('a');
                                        link.href = selectedStudioTrack.audioUrl;
                                        link.download = `${selectedStudioTrack.title || 'track'}.mp3`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                    }
                                }}
                                onFavoriteToggle={() => {
                                    if (selectedStudioTrack) {
                                        handleFavoriteToggle(selectedStudioTrack);
                                    }
                                }}
                                onDelete={() => {
                                    if (selectedStudioTrack) {
                                        handleDeleteClick(selectedStudioTrack);
                                    }
                                }}
                            />
                            </div>
                        </div>
                        </>
                    )}
                </div>

                {/* Floating Action Button - Mobile Only - 右下角悬浮按钮 */}
                {!mobilePanelOpen && (
                    <button
                        onClick={() => setMobilePanelOpen(true)}
                        className="md:hidden fixed right-6 z-50 w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
                        style={{
                            bottom: currentPlayingTrack ? 'calc(5rem + var(--mobile-nav-height, 0px))' : 'calc(1rem + var(--mobile-nav-height, 0px))'
                        }}
                        aria-label="Open create panel"
                    >
                        <Image 
                            src="/icons/Two-Flexible-Creation-Modes.svg" 
                            alt="Create" 
                            width={28} 
                            height={28} 
                            className="h-7 w-7"
                        />
                    </button>
                )}

            </section>

            {/* Lyrics Generation Dialog */}
            <Dialog open={showLyricsDialog} onOpenChange={setShowLyricsDialog}>
                <DialogContent className="sm:max-w-[600px] border-0">
                    <DialogHeader>
                        <DialogTitle>Generate Lyrics</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Lyrics Prompt</label>
                            <Textarea
                                value={lyricsPrompt}
                                onChange={(e) => setLyricsPrompt(e.target.value)}
                                placeholder="Describe the theme, mood, or story for your lyrics..."
                                className="w-full mt-4 resize-none h-32 border focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                        </div>
                        <div className="w-full">
                            <Button
                                onClick={() => handleGenerateLyricsHook(setCustomPrompt, user?.id || '')}
                                disabled={isGeneratingLyrics || !lyricsPrompt.trim()}
                                className="w-full"
                            >
                                {isGeneratingLyrics ? 'Generating...' : 'Generate Lyrics'}
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Track</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{trackToDelete?.title}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Generation Confirmation Dialog */}
            {generationConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300">
                    {/* 自定义背景遮罩 - 使用登录界面的样式 */}
                    <div
                        className="fixed inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-slate-900/90 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setGenerationConfirmOpen(false)}
                    />

                    {/* 自定义弹窗内容 - 使用登录界面的样式 */}
                    <div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl text-white rounded-lg p-6">
                            {/* Header */}
                            <div className="text-left mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Image
                                        src="/icons/Generate-Tip-Info-Coffee.svg"
                                        alt="Coffee with music notes"
                                        width={32}
                                        height={32}
                                        className="w-8 h-8"
                                    />
                                    <h2 className="text-xl font-bold text-white">Music Generation Started</h2>
                                </div>
                                <p className="text-white/70 text-base">
                                    Grab a coffee while we generate your music...
                                </p>
                            </div>

                            {/* Main Content Panel */}
                            <div className="bg-white/5 rounded-xl p-6 space-y-6 mt-6">
                                {/* Loading Indicator */}
                                <div className="flex justify-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
                                        <div className="w-3 h-3 bg-purple-400/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                        <div className="w-3 h-3 bg-purple-400/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                                    </div>
                                </div>

                                {/* Primary Information */}
                                <div className="text-center text-sm text-white/80 space-y-2">
                                    <div>
                                        <span>Music generation in progress, you can preview in</span>
                                    </div>
                                    <div>
                                        <span>30s, full generation takes about 3 minutes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="flex justify-center pt-6">
                                <button
                                    onClick={() => setGenerationConfirmOpen(false)}
                                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl transition-all duration-200 font-medium"
                                >
                                    Check it out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
