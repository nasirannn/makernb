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
import { CheckCircle, Heart, HeartCrack, Music, ListMusic, X, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { isAdmin } from "@/lib/auth-utils-optimized";
import Image from "next/image";
import Link from "next/link";

const StudioContent = () => {
    // Custom Hooks
    const musicGeneration = useMusicGeneration();
    const lyricsGeneration = useLyricsGeneration();
    const { user } = useAuth();
    const { credits, refreshCredits } = useCredits();

    // UI States
    const [panelOpen, setPanelOpen] = useState(true);
    const [showLyrics, setShowLyrics] = useState(false);
    // 移动端：底部弹出歌曲列表面板
    const [mobileTracksOpen, setMobileTracksOpen] = useState(false);

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
        
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        
        setCurrentPlayingTrack(playingTrack);
        setSelectedStudioTrack(playingTrack);
        
        // 桌面端：显示歌词面板；移动端：不显示歌词面板
        if (!isMobile) {
            setShowLyrics(true);
        }
        
        // 不关闭移动端歌曲列表，让用户可以继续浏览
        // setMobileTracksOpen(false);
        
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

    // 歌曲选择处理（点击歌曲行，播放歌曲）
    const handleUserTrackSelect = React.useCallback((track: any, music: any) => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const selectedTrack = createUserTrackObject(track, music);
        
        // 如果点击的是当前播放的歌曲，则暂停/继续
        if (currentPlayingTrack?.id === track.id) {
            togglePlayPause();
            return;
        }
        
        setSelectedStudioTrack(selectedTrack);
        setCurrentPlayingTrack(selectedTrack);
        
        // 移动端：只播放，不显示歌词；桌面端：播放并显示歌词
        if (!isMobile) {
            setShowLyrics(true);
        }
        
        playAudioWithDelay(selectedTrack.audioUrl);
    }, [createUserTrackObject, currentPlayingTrack, togglePlayPause, playAudioWithDelay]);

    // 歌曲播放处理（点击播放按钮）
    const handleUserTrackPlay = React.useCallback((track: any, music: any) => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        
        // 如果点击的是当前播放的歌曲，则暂停/继续
        if (currentPlayingTrack?.id === track.id) {
            togglePlayPause();
        } else {
            const playingTrack = createUserTrackObject(track, music);
            setCurrentPlayingTrack(playingTrack);
            
            // 移动端：只播放，不显示歌词，不关闭歌曲列表；桌面端：播放并显示歌词
            if (!isMobile) {
                setSelectedStudioTrack(playingTrack);
                setShowLyrics(true);
            }

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
        // 不关闭移动端歌曲列表，歌词面板会覆盖在上方
        // setMobileTracksOpen(false);

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
            
            // 不自动打开歌词面板，只有用户点击歌曲时才展开
            // setShowLyrics(true);

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
            <section id="studio" className="relative h-screen flex flex-col md:flex-row bg-background">
                {/* Common Sidebar */}
                <CommonSidebar hideMobileNav={mobileTracksOpen || showLyrics} />

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

                

                {/* Mobile Create Panel - 移动端常显 */}
                <div className="md:hidden flex-1 relative overflow-hidden flex flex-col">
                    {/* Mobile Header */}
                    <div className="flex-shrink-0 px-6 py-3 bg-background/60 backdrop-blur-sm">
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
                            {/* Credits Display - Only show when logged in */}
                            {user && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/10 backdrop-blur-sm border border-foreground/20 rounded-lg">
                                    <Sparkles className="h-3.5 w-3.5 text-foreground" />
                                    <span className="text-sm font-medium text-foreground">
                                        {credits === null ? '...' : credits}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <StudioPanel
                                    forceVisibleOnMobile
                                    onCollapse={() => {}}
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

                {/* MAIN CONTENT - STUDIO */}
                <div className="hidden md:flex flex-1 flex-col md:flex-row relative min-w-0 overflow-hidden h-screen">
                    {/* Background Image for Studio Area */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-5"
                        style={{
                            backgroundImage: "url('/bg-studio-background.webp')"
                        }}
                    />

                    {/* 歌曲列表区域 - 桌面端显示；移动端在弹窗中 */}
                    <div className={`hidden md:flex h-full flex-col relative min-w-0 transition-all duration-300 w-full ${showLyrics ? 'md:w-2/3' : 'md:w-full'}`}>
                        
                        {/* 歌曲列表区域 - 可滚动 */}
                        <div className={`flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 ${
                            currentPlayingTrack ? 'pb-12' : 'pb-0'
                        }`}>
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

                        {/* Desktop Music Player - 桌面端播放器（在歌曲列表列底部） */}
                        {currentPlayingTrack && (
                            <div className="absolute left-0 right-0 bottom-0 z-40">
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
                                        const selectedTrack = allTracks[index];
                                        if (selectedTrack) {
                                            switchToTrack(selectedTrack);
                                        }
                                    }}
                                    onTrackInfoClick={() => {
                                        setShowLyrics(true);
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Desktop Lyrics Panel - 桌面端歌词面板（在 MAIN CONTENT 内） */}
                    {(showLyrics && selectedStudioTrack) && (
                        <div
                            className="hidden md:block relative w-1/3 h-full flex-shrink-0"
                        >
                            {/* 歌词内容区域 */}
                            <div className="flex-1 min-h-0 h-full">
                                <LyricsPanel
                                isOpen={showLyrics}
                                onClose={() => {
                                    setShowLyrics(false);
                                    // 不清除 selectedStudioTrack，保留歌曲数据以便再次打开
                                    // setSelectedStudioTrack(null);
                                    // setGeneratingTrack(null);
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
                    )}
                </div>

                {/* Mobile Tracks List Panel - 移动端歌曲列表弹窗 */}
                {mobileTracksOpen && (
                    <div className="md:hidden fixed inset-0 z-50">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileTracksOpen(false)} />
                        <div className="absolute bottom-0 left-0 right-0 bg-background border-t border-border/30 rounded-t-2xl shadow-2xl overflow-hidden transform-gpu transition-transform duration-300 ease-out will-change-transform" style={{ bottom: 'var(--mobile-nav-height, 0px)', height: 'calc(85vh - var(--mobile-nav-height, 0px))' }}>
                            <div className="h-full flex flex-col">
                                {/* Header */}
                                <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-background/60 backdrop-blur-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <h1 className="text-2xl font-semibold">My Tracks</h1>
                                        <button
                                            onClick={() => setMobileTracksOpen(false)}
                                            className="h-10 w-10 flex items-center justify-center text-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted/50 active:bg-muted/70"
                                            aria-label="Close tracks list"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tracks List */}
                                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
                                    <StudioTracksList
                                        userTracks={userTracks}
                                        isLoading={isLoadingUserTracks}
                                        onTrackSelect={handleUserTrackSelect}
                                        onTrackPlay={handleUserTrackPlay}
                                        currentlyPlaying={currentPlayingTrack?.id}
                                        selectedTrack={selectedStudioTrack?.id}
                                        isPlaying={isPlaying && currentTime > 0}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Lyrics Panel - 移动端歌词面板（浮层） */}
                {(showLyrics && selectedStudioTrack) && (
                    <>
                    {/* Backdrop for mobile */}
                    <div
                        className="md:hidden fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300"
                        onClick={() => {
                            setShowLyrics(false);
                            // 不清除 selectedStudioTrack，保留歌曲数据以便再次打开
                            // setSelectedStudioTrack(null);
                            // setGeneratingTrack(null);
                        }}
                        style={{ touchAction: 'none' }}
                    />
                    <div
                        className="md:hidden fixed bottom-0 left-0 right-0 w-full h-dvh flex-shrink-0 z-[60]"
                        style={{ touchAction: 'pan-y' }}
                    >
                        {/* 歌词内容区域 */}
                        <div className="flex-1 min-h-0 h-full">
                            <LyricsPanel
                            isOpen={showLyrics}
                            onClose={() => {
                                setShowLyrics(false);
                                // 不清除 selectedStudioTrack，保留歌曲数据以便再次打开
                                // setSelectedStudioTrack(null);
                                // setGeneratingTrack(null);
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

                {/* Mobile Player Placeholder - 移动端播放器占位（始终显示，除非歌词面板或歌曲列表打开） */}
                {!showLyrics && !currentPlayingTrack && !mobileTracksOpen && (
                    <div className="md:hidden fixed left-3 right-3 z-30 bg-background/30 backdrop-blur-md rounded-xl pl-3 pr-3 py-2" style={{ bottom: 'calc(var(--mobile-nav-height, 0px) + 0.75rem)', height: 'var(--player-height, 60px)' }}>
                        <div className="flex items-center space-x-3 h-full">
                            {/* Left: Placeholder Cover and Song Info */}
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                {/* Cassette Tape Icon */}
                                <div className="relative w-12 h-12 flex-shrink-0 rounded-md overflow-hidden flex items-center justify-center">
                                    <Image
                                        src="/cassette-tape.svg"
                                        alt="Cassette Tape"
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-contain opacity-70"
                                    />
                                </div>
                                {/* Song Info */}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-muted-foreground truncate">
                                        No track playing
                                    </div>
                                </div>
                            </div>

                            {/* Right: List Button / Loading Indicator */}
                            <button
                                onClick={() => setMobileTracksOpen(true)}
                                className="flex-shrink-0 h-12 w-12 flex items-center justify-center text-foreground hover:text-primary transition-colors rounded-lg hover:bg-muted/50 active:bg-muted/70"
                                aria-label="Open tracks list"
                            >
                                {isGenerating ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground"></div>
                                ) : (
                                    <ListMusic className="w-6 h-6" />
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Mobile Music Player - 移动端播放器 */}
                {currentPlayingTrack && !mobileTracksOpen && (
                <div className="md:hidden fixed left-3 right-3 z-40" style={{ bottom: 'calc(var(--mobile-nav-height, 0px) + 0.75rem)' }}>
                    <div className="relative">
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
                            const selectedTrack = allTracks[index];
                            if (selectedTrack) {
                                switchToTrack(selectedTrack);
                            }
                        }}
                        onTrackInfoClick={() => {
                            setShowLyrics(true);
                        }}
                        />
                        
                        {/* Mobile List Button / Loading Indicator - 移动端列表按钮（覆盖在播放器右侧） */}
                        <button
                            onClick={() => setMobileTracksOpen(true)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-12 w-12 flex items-center justify-center text-foreground hover:text-primary transition-colors rounded-lg hover:bg-black/20 active:bg-black/30 z-50"
                            aria-label="Open tracks list"
                        >
                            {isGenerating ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-foreground"></div>
                            ) : (
                                <ListMusic className="w-6 h-6" />
                            )}
                        </button>
                    </div>
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

            {/* Generation Confirmation Dialog */}
            {generationConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300 p-4">
                    {/* 自定义背景遮罩 - 使用登录界面的样式 */}
                    <div
                        className="fixed inset-0 bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-slate-900/90 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setGenerationConfirmOpen(false)}
                    />

                    {/* 自定义弹窗内容 - 使用登录界面的样式 */}
                    <div className="relative w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                        <div className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl text-white rounded-xl sm:rounded-2xl p-5 sm:p-6">
                            {/* Header */}
                            <div className="text-left mb-5 sm:mb-6">
                                <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
                                    <Image
                                        src="/icons/Generate-Tip-Info-Coffee.svg"
                                        alt="Coffee with music notes"
                                        width={28}
                                        height={28}
                                        className="w-7 h-7 sm:w-8 sm:h-8"
                                    />
                                    <h2 className="text-lg sm:text-xl font-bold text-white">Music Generation Started</h2>
                                </div>
                                <p className="text-white/70 text-sm sm:text-base">
                                    Grab a coffee while we generate your music...
                                </p>
                            </div>

                            {/* Main Content Panel */}
                            <div className="bg-white/5 rounded-xl p-5 sm:p-6 space-y-5 sm:space-y-6 mt-5 sm:mt-6">
                                {/* Loading Indicator */}
                                <div className="flex justify-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-400 rounded-full animate-pulse"></div>
                                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-400/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-purple-400/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                                    </div>
                                </div>

                                {/* Primary Information */}
                                <div className="text-center text-xs sm:text-sm text-white/80 space-y-1.5 sm:space-y-2">
                                    <div>
                                        <span>Music generation in progress, you can preview in</span>
                                    </div>
                                    <div>
                                        <span>30s, full generation takes about 3 minutes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Button */}
                            <div className="flex justify-center pt-5 sm:pt-6">
                                <button
                                    onClick={() => setGenerationConfirmOpen(false)}
                                    className="w-full px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl transition-all duration-200 font-medium text-sm sm:text-base"
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
