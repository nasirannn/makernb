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
import { SimpleMusicPlayer } from "@/components/ui/simple-music-player";
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
import AuthModal from "@/components/ui/auth-modal";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { isAdmin } from "@/lib/auth-utils";
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

    // Destructure states and functions
    const {
        mode, setMode,
        selectedGenre, setSelectedGenre,
        selectedVibe, setSelectedVibe,
        customPrompt, setCustomPrompt,
        songTitle, setSongTitle,
        instrumentalMode, setInstrumentalMode,
        keepPrivate, setKeepPrivate,
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

    // 上一首歌曲回调
    const handlePrevious = React.useCallback(() => {
        if (allGeneratedTracks.length === 0) return;
        const newIndex = activeTrackIndex === 0 ? 1 : 0;
        if (allGeneratedTracks[newIndex]) {
            setActiveTrackIndex(newIndex);
        }
    }, [allGeneratedTracks, activeTrackIndex, setActiveTrackIndex]);

    // 下一首歌曲回调
    const handleNext = React.useCallback(() => {
        if (allGeneratedTracks.length === 0) return;
        const newIndex = activeTrackIndex === 0 ? 1 : 0;
        if (allGeneratedTracks[newIndex]) {
            setActiveTrackIndex(newIndex);
        }
    }, [allGeneratedTracks, activeTrackIndex, setActiveTrackIndex]);

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
                audioRef.current.src = currentPlayingTrack.audioUrl;
                audioRef.current.load();
                // 重置播放状态
                setIsPlaying(false);
                setCurrentTime(0);
            }
            // 设置duration，优先使用currentPlayingTrack.duration，如果没有则使用0
            setDuration(currentPlayingTrack.duration || 0);
        }
    }, [currentPlayingTrack]);

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
        handleGenerateLyricsHook(setCustomPrompt, user.id);
        // 歌词生成后刷新积分显示
        if (refreshCredits) {
            refreshCredits().catch(console.error);
        }
    }, [user?.id, handleGenerateLyricsHook, setCustomPrompt, refreshCredits]);

    // 歌曲选择处理（点击歌曲行，不播放）
    const handleUserTrackSelect = React.useCallback((track: any, music: any) => {     
        // 创建歌曲对象用于歌词面板
        const selectedTrack = {
            id: track.id,
            generationId: music.id,
            title: music.title,
            audioUrl: track.audio_url,
            duration: track.duration,
            coverImage: track.cover_r2_url,
            tags: music.tags,
            genre: music.genre,
            lyrics: track.lyrics || music.lyrics,
            side_letter: track.side_letter
        };

        // 设置选中的歌曲（用于歌词面板）
        setSelectedStudioTrack(selectedTrack);
        // 显示歌词面板
        setShowLyrics(true);
    }, []);

    // 歌曲播放处理（点击播放按钮）
    const handleUserTrackPlay = React.useCallback((track: any, music: any) => {
        // 创建播放器需要的歌曲对象
        const playingTrack = {
            id: track.id,
            generationId: music.id,
            title: music.title,
            audioUrl: track.audio_url,
            duration: track.duration,
            coverImage: track.cover_r2_url,
            tags: music.tags,
            genre: music.genre,
            lyrics: track.lyrics || music.lyrics
        };

        // 如果点击的是当前播放的歌曲，则暂停/继续
        if (currentPlayingTrack?.id === track.id) {
            togglePlayPause();
        } else {
            // 设置新的播放歌曲
            setCurrentPlayingTrack(playingTrack);
            // 同时设置为选中歌曲
            setSelectedStudioTrack(playingTrack);
            // 显示歌词面板
            setShowLyrics(true);

            // 自动播放新选择的歌曲
            setTimeout(() => {
                if (audioRef.current) {
                    audioRef.current.play().catch(console.error);
                }
            }, 100);
        }
    }, [currentPlayingTrack, togglePlayPause]);

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
            is_published: false,
            is_deleted: false,
            is_favorited: false,
            is_pinned: false
        };

        setSelectedStudioTrack(selectedTrack);
        setShowLyrics(true);

        // 自动播放生成的歌曲
        setTimeout(() => {
            if (audioRef.current && audioUrl) {
                audioRef.current.play().catch(console.error);
            }
        }, 100);
    }, []);

    // 监听生成状态变化，当text回调完成时自动显示歌词面板
    React.useEffect(() => {
        if (allGeneratedTracks.length > 0) {
            const firstGeneratedSong = allGeneratedTracks[0]; // 第一首生成的歌曲

            // 检查是否是text回调完成（有streamAudioUrl即可，歌词可有可无）
            const isTextCallbackComplete = firstGeneratedSong.streamAudioUrl &&
                                         firstGeneratedSong.streamAudioUrl.trim() !== '';

            // 如果text回调完成且还没有显示歌词面板，则自动显示
            if (isTextCallbackComplete && !showLyrics && !generatingTrack) {
                // 创建生成中的歌曲对象，优先使用final audio
                const generatedTrack = {
                    id: firstGeneratedSong.id, // 使用真实的track ID
                    generationId: firstGeneratedSong.generationId, // 使用真实的generation ID
                    title: firstGeneratedSong.title,
                    audioUrl: firstGeneratedSong.audioUrl || firstGeneratedSong.streamAudioUrl, // 优先使用final audio
                    duration: firstGeneratedSong.duration,
                    coverImage: firstGeneratedSong.coverImage, // 可能有也可能没有
                    tags: firstGeneratedSong.tags,
                    genre: firstGeneratedSong.genre,
                    lyrics: firstGeneratedSong.lyrics,
                    isGenerating: !firstGeneratedSong.coverImage, // 如果没有封面图则标记为生成中
                    isUsingStreamAudio: firstGeneratedSong.isUsingStreamAudio
                };

                // 设置为选中的歌曲并显示歌词面板
                setSelectedStudioTrack(generatedTrack);
                setGeneratingTrack(generatedTrack);
                setShowLyrics(true);

                // 如果没有正在播放的歌曲，则开始播放这首生成的歌曲
                if (!currentPlayingTrack) {
                    // 确保 playingTrack 包含 isUsingStreamAudio 属性
                    const playingTrack = {
                        ...generatedTrack,
                        isUsingStreamAudio: firstGeneratedSong.isUsingStreamAudio || false
                    };
                    setCurrentPlayingTrack(playingTrack);
                    
                    // 实际播放音频，优先使用final audio
                    setTimeout(() => {
                        const audioUrl = firstGeneratedSong.audioUrl || firstGeneratedSong.streamAudioUrl;
                        if (audioRef.current && audioUrl) {
                            audioRef.current.src = audioUrl;
                            audioRef.current.load();
                            audioRef.current.play().catch(console.error);
                        }
                    }, 100);
                }
            }
        }
    }, [allGeneratedTracks, showLyrics, generatingTrack, currentPlayingTrack]);

    // 监听complete回调完成，更新currentPlayingTrack的duration
    React.useEffect(() => {
        if (allGeneratedTracks.length > 0 && currentPlayingTrack) {
            const firstGeneratedSong = allGeneratedTracks[0];
            
            // 检查是否是complete回调完成（有最终音频和真实duration）
            const isCompleteCallbackComplete = firstGeneratedSong.audioUrl && 
                                             firstGeneratedSong.duration && 
                                             firstGeneratedSong.duration > 0 &&
                                             !firstGeneratedSong.isGenerating;
            
            // 如果complete回调完成且当前播放的是这首歌曲，更新duration和音频源
            if (isCompleteCallbackComplete && currentPlayingTrack.id === firstGeneratedSong.id) {
                const finalDuration = firstGeneratedSong.duration!; // 使用非空断言，因为条件检查已确认存在
                
                // 先更新duration状态，不触发音频重新加载
                setDuration(finalDuration);
                
                // 更新currentPlayingTrack的duration字段，但不改变audioUrl以避免重新加载
                setCurrentPlayingTrack((prev: any) => ({
                    ...prev,
                    duration: finalDuration,
                    isUsingStreamAudio: false
                }));
                
                // Complete回调完成后，刷新userTracks列表，清空allGeneratedTracks
                setTimeout(() => {
                    fetchUserTracks(); // 刷新数据库中的歌曲列表
                    setAllGeneratedTracks([]); // 清空新生成的歌曲，避免重复显示
                }, 1000); // 延迟1秒，确保数据库已更新
            }
        }
    }, [allGeneratedTracks, currentPlayingTrack, fetchUserTracks, setAllGeneratedTracks]);

    // 监听封面图生成完成，替换磁带占位图
    React.useEffect(() => {
        if (generatingTrack && allGeneratedTracks.length > 0) {
            const firstGeneratedSong = allGeneratedTracks[0];

            // 检查封面图是否已生成（之前没有，现在有了）
            if (firstGeneratedSong.coverImage && generatingTrack.isGenerating && !generatingTrack.coverImage) {
                // 更新生成中的歌曲，添加封面图并移除生成中标记
                const updatedTrack = {
                    ...generatingTrack,
                    coverImage: firstGeneratedSong.coverImage,
                    isGenerating: false // 移除生成中标记，不再显示磁带
                };

                setSelectedStudioTrack(updatedTrack);
                setGeneratingTrack(null); // 清除生成中状态

                // 如果这首歌正在播放，只更新封面信息，不重新加载音频
                if (currentPlayingTrack?.id === generatingTrack.id) {
                    setCurrentPlayingTrack((prev: any) => ({
                        ...prev,
                        coverImage: firstGeneratedSong.coverImage
                    }));
                }
            }
        }
    }, [allGeneratedTracks, generatingTrack, currentPlayingTrack]);

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
            <section id="studio" className="h-screen flex bg-background">
                {/* Common Sidebar */}
                <CommonSidebar />

                {/* Studio Control Panel */}
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
                    keepPrivate={keepPrivate}
                    setKeepPrivate={setKeepPrivate}
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
                    isGenerating={isGenerating}
                    pendingTasksCount={pendingTasksCount}
                    onGenerationStart={handleGenerationStart}
                />

                {/* MAIN CONTENT - STUDIO */}
                <div className="flex-1 h-full flex relative min-w-0 overflow-hidden">
                    {/* Background Image for Studio Area */}
                    <div 
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
                        style={{
                            backgroundImage: "url('/bg-studio-background.png')"
                        }}
                    />

                    <div
                        className={`h-full flex flex-col relative transition-all duration-300 ease-in-out ${
                            showLyrics ? 'flex-1 min-w-0' : 'w-full'
                        }`}
                        style={{
                            minWidth: showLyrics ? '300px' : 'auto'
                        }}
                    >
                        {/* User Tracks List */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* 歌曲列表区域 - 可滚动 */}
                            <div className="flex-1 overflow-hidden">
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

                            {/* Music Player - 固定在底部 */}
                            {currentPlayingTrack && (
                                <div className="flex-shrink-0 border-t border-border/20 bg-background/30 backdrop-blur-md">
                                    <SimpleMusicPlayer
                                        tracks={[{
                                            id: currentPlayingTrack.id || '',
                                            title: currentPlayingTrack.title || '',
                                            audioUrl: currentPlayingTrack.audioUrl || '',
                                            duration: currentPlayingTrack.duration || 0,
                                            coverImage: currentPlayingTrack.coverImage,
                                            artist: 'AI Generated',
                                            allTracks: [{
                                                id: currentPlayingTrack.id || '',
                                                audio_url: currentPlayingTrack.audioUrl || '',
                                                duration: currentPlayingTrack.duration || 0,
                                                side_letter: 'A',
                                                cover_r2_url: currentPlayingTrack.coverImage
                                            }]
                                        }]}
                                        currentTrackIndex={0}
                                        currentPlayingTrack={currentPlayingTrack ? { trackId: currentPlayingTrack.id || '', audioUrl: currentPlayingTrack.audioUrl || '' } : null}
                                        isPlaying={isPlaying}
                                        currentTime={currentTime}
                                        duration={duration}
                                        volume={volume}
                                        isMuted={isMuted}
                                        isCollapsed={showLyrics}
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
                                        onTrackChange={() => {}}
                                        onSideChange={() => {}}
                                    />
                                </div>
                            )}
                        </div>

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

                    {/* Lyrics Panel - 只在有选中歌曲且显示歌词时渲染 */}
                    {showLyrics && selectedStudioTrack && (
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
                            onDelete={() => {
                                if (selectedStudioTrack) {
                                    handleDeleteClick(selectedStudioTrack);
                                }
                            }}
                        />
                    )}
                </div>
            </section>

            {/* Lyrics Generation Dialog */}
            <Dialog open={showLyricsDialog} onOpenChange={setShowLyricsDialog}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Generate Lyrics</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Lyrics Prompt</label>
                            <textarea
                                value={lyricsPrompt}
                                onChange={(e) => setLyricsPrompt(e.target.value)}
                                placeholder="Describe the theme, mood, or story for your lyrics..."
                                className="w-full mt-1 p-3 border rounded-lg resize-none h-32"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowLyricsDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerateLyrics}
                                disabled={isGeneratingLyrics || !lyricsPrompt.trim()}
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
                                        src="/icons/generate_tip_info_coffee.svg"
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
