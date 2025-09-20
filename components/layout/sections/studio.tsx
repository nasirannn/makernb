"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
// Custom Hooks
import { useMusicGeneration } from "@/hooks/use-music-generation";
import { useLyricsGeneration } from "@/hooks/use-lyrics-generation";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { DEV_MOCK_ENABLED, mockLibraryTracks } from '@/lib/dev-mock';

// Components
import { StudioSidebar } from "./studio-sidebar";
import { MusicPlayer } from "@/components/ui/music-player";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";



const StudioContent = () => {
    // Custom Hooks
    const musicGeneration = useMusicGeneration();
    const lyricsGeneration = useLyricsGeneration();
    const { user } = useAuth();
    const { refreshCredits } = useCredits();
    const searchParams = useSearchParams();

    // UI States
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showLibrary, setShowLibrary] = useState(false);
    const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<string | null>(null);
    const [libraryTracks, setLibraryTracks] = useState<any[]>([]);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
    const [currentLibraryTrack, setCurrentLibraryTrack] = useState<any>(null);
    const [currentSide, setCurrentSide] = useState<'A' | 'B'>('A');
    const [showLyrics, setShowLyrics] = useState(true);

    // 处理URL参数，如果有tab=library则显示library
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'library') {
            setShowLibrary(true);
            setSidebarOpen(true);
        }
    }, [searchParams]);

    // 重置滚动位置 - 只重置studio区域的滚动
    const resetScrollPosition = () => {
        // 只重置studio主内容区的滚动位置，不影响sidebar
        const studioMainContent = document.querySelector('#studio .flex-1.h-full.flex.flex-col.relative');
        if (studioMainContent) {
            studioMainContent.scrollTop = 0;
        }

        // 重置整个页面的滚动位置
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
     // 处理磁带side切换
     const handleSideToggle = () => {
         if (!selectedLibraryTrack) return;

         const currentTrack = libraryTracks.find(track => track.id === selectedLibraryTrack);
         if (!currentTrack) return;

         // 找到同一首歌的另一个track（通过title匹配）
         const sameSongTracks = libraryTracks.filter(track =>
             track.title === currentTrack.title && track.id !== currentTrack.id
         );

         if (sameSongTracks.length === 0) {
             return; // 没有另一个track
         }

         // 切换到另一个track
         const otherTrack = sameSongTracks[0];
         setSelectedLibraryTrack(otherTrack.id);
         setCurrentSide(otherTrack.sideLetter);
         updateCurrentTrackFromLibrary(otherTrack, true); // 自动播放
     };

    // 获取唯一的歌曲列表（按title分组，每首歌只取一个代表track）
    const getUniqueSongs = React.useCallback(() => {
        const songMap = new Map();

        libraryTracks.forEach(track => {
            if (!songMap.has(track.title)) {
                // 优先选择A面，如果没有A面则选择第一个track
                songMap.set(track.title, track);
            } else {
                // 如果当前track是A面，替换之前的track
                if (track.sideLetter === 'A') {
                    songMap.set(track.title, track);
                }
            }
        });

        return Array.from(songMap.values());
    }, [libraryTracks]);

    // 获取库数据
    const fetchLibraryTracks = React.useCallback(async () => {
        if (!user?.id && !DEV_MOCK_ENABLED) return;

        setIsLoadingLibrary(true);
        try {
            let tracks;

            if (DEV_MOCK_ENABLED) {
                // 开发模式：使用 mock 数据
                tracks = mockLibraryTracks;
            } else {
                // 生产模式：调用真实 API
                const response = await fetch(`/api/user-music/${user?.id}?limit=50`);
                const data = await response.json();

                if (data.success) {
                    tracks = data.data.music;
                } else {
                    throw new Error('Failed to fetch library tracks');
                }
            }

            // 为每首歌的每个track（A面和B面）创建独立的library条目
            const musicTracks: any[] = [];

            tracks.forEach((song: any) => {
                // 检查是否是错误状态的歌曲
                if (song.status === 'error') {
                    // 为错误状态的歌曲创建一个特殊的条目
                    musicTracks.push({
                        id: song.id, // 直接使用song.id，不需要error-前缀
                        title: song.title || 'Unknown',
                        genre: song.genre,
                        style: song.style,
                        created_at: song.created_at,
                        lyrics: '',
                        lyrics_title: song.title || 'Unknown',
                        audioUrl: null,
                        coverUrl: null,
                        duration: 0,
                        sideLetter: null,
                        isError: true,
                        errorMessage: song.errorInfo?.error_message || 'Generation failed',
                        originalPrompt: song.prompt, // 添加用户输入的prompt
                        originalSong: song
                    });
                } else if (song.allTracks && Array.isArray(song.allTracks)) {
                    // 为每个track创建独立条目
                    song.allTracks.forEach((track: any) => {
                        musicTracks.push({
                            // 使用track的独立ID
                            id: track.id,
                            // 保持相同的歌曲标题，这样可以通过title找到同一首歌的其他track
                            title: song.title,
                            genre: song.genre,
                            style: song.style,
                            created_at: song.created_at,
                            // 歌词信息 - 歌词是歌曲级别的，Side A和Side B共享同一份歌词
                            lyrics: song.lyrics_content || '',
                            lyrics_title: song.title,
                            // 使用track特定的信息
                            audioUrl: track.audio_url || '',
                            coverUrl: track.cover_r2_url || '',
                            duration: track.duration || 0,
                            sideLetter: track.side_letter,
                            // 保存原始歌曲信息
                            originalSong: song
                        });
                    });
                }
                // 如果没有allTracks且不是错误状态，跳过这首歌
            });

            setLibraryTracks(musicTracks);
        } catch (error) {
            console.error('Failed to fetch library tracks:', error);
        } finally {
            setIsLoadingLibrary(false);
        }
    }, [user?.id]);

    // 用户登录时获取库数据
    React.useEffect(() => {
        if (user?.id || DEV_MOCK_ENABLED) {
            fetchLibraryTracks();
        } else {
            setLibraryTracks([]);
        }
    }, [user?.id, fetchLibraryTracks]);

    // Destructure states and functions
    const {
        mode, setMode,
        selectedGenre, setSelectedGenre,
        selectedMood, setSelectedMood,
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
        isGenerating, setIsGenerating,
        allGeneratedTracks, setAllGeneratedTracks,
        activeTrackIndex, setActiveTrackIndex,
        pendingTasksCount, setPendingTasksCount,
        generationTimer,
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

    // 静音切换
    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (audioRef.current) {
            audioRef.current.muted = !isMuted;
        }
    };


    // 音频事件处理函数
    const handleAudioLoad = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime || 0);
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
        toggleMute();
    };


    const {
        showLyricsDialog, setShowLyricsDialog,
        lyricsPrompt, setLyricsPrompt,
        isGeneratingLyrics, setIsGeneratingLyrics,
        handleGenerateLyrics: handleGenerateLyricsHook,
    } = lyricsGeneration;

    // 监听第一首歌的loading状态，当loading消失时自动播放并显示磁带
    React.useEffect(() => {
        // 检查第一首生成的歌曲是否从loading状态变为就绪状态
        const firstTrack = allGeneratedTracks[0];
        if (firstTrack && !firstTrack.isLoading && (firstTrack.audioUrl || firstTrack.streamAudioUrl)) {
            // 检查是否已经自动播放过，避免重复设置音频源
            const hasAutoPlayed = (window as any).hasAutoPlayedRef?.current;
            if (hasAutoPlayed) {
                console.log('Already auto-played, skipping duplicate audio setup');
                return;
            }

            // 自动选择第一首歌并播放
            setSelectedLibraryTrack('generated-0');
            setActiveTrackIndex(0);

            // 延迟一点时间确保UI更新完成后再播放
            setTimeout(() => {
                const audioElement = document.querySelector('audio') as HTMLAudioElement;
                if (audioElement && (firstTrack.audioUrl || firstTrack.streamAudioUrl)) {
                    // 优先使用audioUrl，没有的话使用streamAudioUrl
                    const playUrl = firstTrack.audioUrl || firstTrack.streamAudioUrl;
                    audioElement.src = playUrl;
                    audioElement.load();
                    audioElement.play().then(() => {
                        // 播放成功，状态由音频事件处理
                    }).catch(console.error);
                }
            }, 300);
        }
    }, [allGeneratedTracks, setActiveTrackIndex, setSelectedLibraryTrack]);

     // 更新当前歌曲信息（从库歌曲）
     const updateCurrentTrackFromLibrary = React.useCallback((libraryTrack: any, autoPlay: boolean = false) => {
         if (libraryTrack && libraryTrack.audioUrl) {
             const newCurrentTrack = {
                 audioUrl: libraryTrack.audioUrl,
                 title: libraryTrack.title,
                 duration: libraryTrack.duration,
                 genre: libraryTrack.genre,
                 mood: libraryTrack.mood,
                 style: libraryTrack.style,
                 coverImage: libraryTrack.coverUrl || '',
                 tags: `${libraryTrack.style}, ${libraryTrack.mood}`,
                 lyrics: libraryTrack.lyrics || '',
                 isLoading: false
             };

            // 设置当前library歌曲
            setCurrentLibraryTrack(newCurrentTrack);

            // 如果autoPlay为true，延迟播放确保音频元素已渲染
            if (autoPlay) {
                setTimeout(() => {
                    if (audioRef.current) {
                        // 为流式音频优化设置
                        audioRef.current.preload = 'none';
                        audioRef.current.src = libraryTrack.audioUrl;
                        audioRef.current.load();
                        
                        // 添加错误处理
                        const handleError = (error: any) => {
                            console.error('Auto play failed:', error);
                            // 只在真正的网络错误时显示提示
                            if (error.name === 'NotSupportedError' || 
                                (error.message && error.message.includes('network') && error.message.includes('error')) ||
                                (error.target && error.target.error && error.target.error.code === 2)) {
                                alert('网络连接问题，无法播放音频。请检查网络连接后重试。');
                            }
                        };
                        
                        audioRef.current.addEventListener('error', handleError, { once: true });
                        
                        audioRef.current.play().then(() => {
                            // 播放成功，状态由音频事件处理
                        }).catch(handleError);
                    }
                }, 100);
            }
        }
    }, [setCurrentLibraryTrack, audioRef]);

    // 处理库歌曲选择和播放
    const handleLibraryTrackSelect = React.useCallback((musicGenerationId: string) => {
        // 检查是否是生成的track
        if (musicGenerationId.startsWith('generated-')) {
            const trackIndex = parseInt(musicGenerationId.replace('generated-', ''));
            if (allGeneratedTracks[trackIndex]) {
                setActiveTrackIndex(trackIndex);
                // 生成的tracks不需要调用updateCurrentTrackFromLibrary
                return;
            }
        }

        // 处理库中的tracks
        const libraryTrack = libraryTracks.find(track => track.id === musicGenerationId);
        if (libraryTrack) {
            // 检查是否是同一首歌，如果是同一首歌则不重新加载音频
            const isSameTrack = selectedLibraryTrack === musicGenerationId;
            
            // 设置当前side
            setCurrentSide(libraryTrack.sideLetter);
            
            // 只有在切换到不同歌曲时才重新加载音频
            if (!isSameTrack) {
                updateCurrentTrackFromLibrary(libraryTrack, true);
            }
        }
    }, [libraryTracks, updateCurrentTrackFromLibrary, allGeneratedTracks, setActiveTrackIndex, selectedLibraryTrack]);

    // 提取歌曲切换逻辑
    const switchToTrack = React.useCallback((trackId: string) => {
        setSelectedLibraryTrack(trackId);
        const track = libraryTracks.find(t => t.id === trackId);
        if (track) {
            setCurrentSide(track.sideLetter);
            updateCurrentTrackFromLibrary(track, true);
        }
    }, [libraryTracks, updateCurrentTrackFromLibrary]);

    // 计算当前播放的歌曲
    const currentTrack = React.useMemo(() => {
        if (selectedLibraryTrack?.startsWith('generated-')) {
            const trackIndex = parseInt(selectedLibraryTrack.replace('generated-', ''));
            return allGeneratedTracks[trackIndex] || allGeneratedTracks[activeTrackIndex ?? 0];
        }
        return selectedLibraryTrack ? currentLibraryTrack : (activeTrackIndex !== null ? allGeneratedTracks[activeTrackIndex] : null);
    }, [selectedLibraryTrack, allGeneratedTracks, activeTrackIndex, currentLibraryTrack]);

    // 播放/暂停控制
    const togglePlayPause = React.useCallback(() => {
        if (!audioRef.current || !currentTrack) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
    }, [isPlaying, currentTrack]);

    // 上一首歌曲回调
    const handlePrevious = React.useCallback(() => {
        if (selectedLibraryTrack?.startsWith('generated-')) {
            // 生成歌曲切换
            if (allGeneratedTracks.length === 0) return;
            const newIndex = activeTrackIndex === 0 ? 1 : 0;
            if (allGeneratedTracks[newIndex]) {
                setActiveTrackIndex(newIndex);
            }
        } else {
            // 库歌曲切换 - 在不同歌曲之间切换
            const uniqueSongs = getUniqueSongs();
            if (uniqueSongs.length === 0) return;

            const currentTrack = libraryTracks.find(track => track.id === selectedLibraryTrack);
            if (!currentTrack) return;

            const currentSongIndex = uniqueSongs.findIndex(song => song.title === currentTrack.title);
            const prevSongIndex = currentSongIndex > 0 ? currentSongIndex - 1 : uniqueSongs.length - 1;
            const prevSong = uniqueSongs[prevSongIndex];

            // 找到这首歌的A面，如果没有A面则选择第一个track
            const prevSongTracks = libraryTracks.filter(track => track.title === prevSong.title);
            const targetTrack = prevSongTracks.find(track => track.sideLetter === 'A') || prevSongTracks[0];

            switchToTrack(targetTrack.id);
        }
    }, [selectedLibraryTrack, allGeneratedTracks, activeTrackIndex, getUniqueSongs, libraryTracks, switchToTrack, setActiveTrackIndex]);

    // 下一首歌曲回调
    const handleNext = React.useCallback(() => {
        if (selectedLibraryTrack?.startsWith('generated-')) {
            // 生成歌曲切换
            if (allGeneratedTracks.length === 0) return;
            const newIndex = activeTrackIndex === 0 ? 1 : 0;
            if (allGeneratedTracks[newIndex]) {
                setActiveTrackIndex(newIndex);
            }
        } else {
            // 库歌曲切换 - 在不同歌曲之间切换
            const uniqueSongs = getUniqueSongs();
            if (uniqueSongs.length === 0) return;

            const currentTrack = libraryTracks.find(track => track.id === selectedLibraryTrack);
            if (!currentTrack) return;

            const currentSongIndex = uniqueSongs.findIndex(song => song.title === currentTrack.title);
            const nextSongIndex = currentSongIndex < uniqueSongs.length - 1 ? currentSongIndex + 1 : 0;
            const nextSong = uniqueSongs[nextSongIndex];

            // 找到这首歌的A面，如果没有A面则选择第一个track
            const nextSongTracks = libraryTracks.filter(track => track.title === nextSong.title);
            const targetTrack = nextSongTracks.find(track => track.sideLetter === 'A') || nextSongTracks[0];

            switchToTrack(targetTrack.id);
        }
    }, [selectedLibraryTrack, allGeneratedTracks, activeTrackIndex, getUniqueSongs, libraryTracks, switchToTrack, setActiveTrackIndex]);

    // 计算磁带时长
    const calculateCassetteDuration = React.useCallback(() => {
        if (!currentTrack) return "0min";
        
        let totalDuration = 0;
        
        if (selectedLibraryTrack?.startsWith('generated-')) {
            // 生成歌曲：计算两首生成歌曲的总时长
            allGeneratedTracks.forEach(track => {
                const duration = track.duration;
                const numericDuration = typeof duration === 'string' ? parseFloat(duration) : (duration || 0);
                totalDuration += numericDuration;
            });
        } else {
            // 库歌曲：直接使用API返回的totalDuration
            const currentLibraryTrack = libraryTracks.find(track => track.id === selectedLibraryTrack);
            if (currentLibraryTrack?.originalSong?.totalDuration) {
                const duration = currentLibraryTrack.originalSong.totalDuration;
                totalDuration = typeof duration === 'string' ? parseFloat(duration) : (duration || 0);
            } else if (currentTrack.duration) {
                // 如果没有totalDuration信息，使用当前歌曲的时长
                const duration = currentTrack.duration;
                totalDuration = typeof duration === 'string' ? parseFloat(duration) : (duration || 0);
            }
        }
        
        // 确保totalDuration是有效数字
        if (isNaN(totalDuration) || totalDuration <= 0) {
            return "0min";
        }
        
        // 只显示min的整数部分
        const durationInMinutes = Math.floor(totalDuration / 60);
        return `${durationInMinutes}min`;
    }, [currentTrack, selectedLibraryTrack, allGeneratedTracks, libraryTracks]);
    
    // 监听currentTrack变化，更新音频源和duration
    React.useEffect(() => {
        if (!audioRef.current || !currentTrack) return;

        const audioUrl = currentTrack.audioUrl;
        if (!audioUrl) return;

        // 如果音频源发生变化，重新加载
        if (audioRef.current.src !== audioUrl) {
            audioRef.current.src = audioUrl;
            audioRef.current.load();

            // 重置时间和duration
            setCurrentTime(0);
            setDuration(0);
        }
    }, [currentTrack]);

    // 监听自动播放时的selectedLibraryTrack设置
    React.useEffect(() => {
        const handleSetSelectedLibraryTrack = (e: CustomEvent) => {
            setSelectedLibraryTrack(e.detail);
        };

        window.addEventListener('setSelectedLibraryTrack', handleSetSelectedLibraryTrack as EventListener);
        return () => window.removeEventListener('setSelectedLibraryTrack', handleSetSelectedLibraryTrack as EventListener);
    }, []);

    // 键盘快捷键支持
    React.useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            // 只在播放器区域响应键盘事件
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (selectedLibraryTrack && libraryTracks.length > 0) {
                switch (e.code) {
                    case 'Space':
                        e.preventDefault();
                        togglePlayPause();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        // 上一首
                        const currentIndex = libraryTracks.findIndex(track => track.id === selectedLibraryTrack);
                        const prevIndex = currentIndex > 0 ? currentIndex - 1 : libraryTracks.length - 1;
                        const prevTrack = libraryTracks[prevIndex];
                        switchToTrack(prevTrack.id);
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        // 下一首
                        const nextCurrentIndex = libraryTracks.findIndex(track => track.id === selectedLibraryTrack);
                        const nextIndex = nextCurrentIndex < libraryTracks.length - 1 ? nextCurrentIndex + 1 : 0;
                        const nextTrack = libraryTracks[nextIndex];
                        switchToTrack(nextTrack.id);
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [selectedLibraryTrack, libraryTracks, togglePlayPause, switchToTrack]);

    // Event handlers
    const handleGenerate = () => {
        if (!user?.id) {
            alert('Please log in to generate music');
            return;
        }
        musicGeneration.handleGenerate(refreshCredits);
        // 生成音乐后自动跳转到library选项
        setShowLibrary(true);
        setSidebarOpen(true);
    };

    const handleGenerateLyrics = React.useCallback(() => {
        if (!user?.id) {
            alert('Please log in to generate lyrics');
            return;
        }
        handleGenerateLyricsHook(setCustomPrompt, user.id);
        // 歌词生成后刷新积分显示
        if (refreshCredits) {
            refreshCredits().catch(console.error);
        }
    }, [user?.id, handleGenerateLyricsHook, setCustomPrompt, refreshCredits]);

    // 提取内联函数
    const handleSidebarOpen = React.useCallback((open: boolean) => {
        setSidebarOpen(open);
        if (open) resetScrollPosition();
    }, []);

    const handleShowLibrary = React.useCallback((show: boolean) => {
        setShowLibrary(show);
        resetScrollPosition();
    }, []);

    const handleSelectedLibraryTrack = React.useCallback((id: string | null) => {
        setSelectedLibraryTrack(id);
        if (id) {
            handleLibraryTrackSelect(id);
        }
        resetScrollPosition();
    }, [handleLibraryTrackSelect]);

    return (
        <>
            <section id="studio" className="h-screen flex bg-background">
                {/* ========================================================================= */}
                {/* LEFT SIDEBAR */}
                {/* ========================================================================= */}
                <StudioSidebar
                    sidebarOpen={sidebarOpen}
                    showLibrary={showLibrary}
                    selectedLibraryTrack={selectedLibraryTrack}
                    onPlayPause={togglePlayPause}
                    setSidebarOpen={handleSidebarOpen}
                    setShowLibrary={handleShowLibrary}
                    setSelectedLibraryTrack={handleSelectedLibraryTrack}
                    libraryTracks={libraryTracks}
                    setLibraryTracks={setLibraryTracks}
                    isLoadingLibrary={isLoadingLibrary}
                    isPlaying={isPlaying}
                    audioRef={audioRef}
                    mode={mode}
                    setMode={setMode}
                    selectedGenre={selectedGenre}
                    setSelectedGenre={setSelectedGenre}
                    selectedMood={selectedMood}
                    setSelectedMood={setSelectedMood}
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
                    showLyricsDialog={showLyricsDialog}
                    setShowLyricsDialog={setShowLyricsDialog}
                    handleGenerateLyrics={handleGenerateLyrics}
                    isGeneratingLyrics={isGeneratingLyrics}
                    lyricsPrompt={lyricsPrompt}
                    setLyricsPrompt={setLyricsPrompt}
                    isGenerating={isGenerating}
                    handleGenerate={handleGenerate}
                    pendingTasksCount={pendingTasksCount}
                    allGeneratedTracks={allGeneratedTracks}
                    setAllGeneratedTracks={setAllGeneratedTracks}
                    generationTimer={generationTimer}
                />

                {/* ========================================================================= */}
                {/* RIGHT CONTENT AREA */}
                {/* ========================================================================= */}
                <div
                    className={`h-full flex flex-col relative transition-all duration-300 ${sidebarOpen ? 'ml-0' : 'ml-0'}`}
                    style={{
                        width: sidebarOpen ? 'calc(100% - 32rem)' : 'calc(100% - 4rem)',
                        backgroundImage: (() => {
                            // 优先使用当前播放的歌曲封面
                            if (currentTrack?.coverImage) {
                                return `url(${currentTrack.coverImage})`;
                            }
                            // 如果没有当前歌曲，使用选中的库歌曲当前side的封面
                            if (selectedLibraryTrack !== null) {
                                const libraryTrack = libraryTracks.find(track => track.id === selectedLibraryTrack);
                                 if (libraryTrack) {
                                     // 直接使用当前track的封面
                                     const coverUrl = libraryTrack.coverUrl || '';
                                    if (coverUrl) {
                                        return `url(${coverUrl})`;
                                    }
                                }
                            }
                            // 默认使用bg-studio-background.png
                            return 'url(/bg-studio-background.png)';
                        })(),
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                    }}
                >
                    {/* 背景遮罩层 - 只在显示歌词时显示 */}
                    {showLyrics && <div className="absolute inset-0 bg-background/20 backdrop-blur-md z-0" />}
                    
                    {/* 歌词区域 - 占据剩余空间，居中显示 */}
                    <div className="flex-1 flex flex-col justify-center px-8 pt-4 relative z-20">
                        {(allGeneratedTracks.length > 0 && (selectedLibraryTrack?.startsWith('generated-') || !isGenerating)) || selectedLibraryTrack !== null ? (
                            <div className="w-full flex-1 flex flex-col justify-center items-center">
                                {/* 统一的歌词显示 - 只在showLyrics为true时显示 */}
                                {showLyrics && currentTrack && (
                                    <div className="max-w-3xl w-full">
                                        {/* 歌词区域 */}
                                        {currentTrack.lyrics ? (
                                            <div className="text-foreground leading-relaxed whitespace-pre-line text-base text-center max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                                                {currentTrack.lyrics}
                                            </div>
                                        ) : (
                                            <div className="text-center max-h-[calc(100vh-200px)] flex flex-col justify-center">
                                                <h3 className="text-xl font-bold text-primary mb-2">Instrumental</h3>
                                                <p className="text-muted-foreground">
                                                    This is an instrumental piece, please enjoy the melody
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Empty State */
                            <div className="flex flex-col items-center justify-center text-center space-y-8">
                                <div className="space-y-4">
                                    <Image
                                        src="/studio-right-icon.svg"
                                        alt="Studio Icon"
                                        width={64}
                                        height={64}
                                        className="mx-auto"
                                    />
                                    <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
                                        🌹 Tell us the vibe. We&apos;ll handle the candlelight.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 重构后的播放器 - 在右侧主内容区底部，只有选中歌曲时才显示 */}
                    {(selectedLibraryTrack || currentTrack) && (
                        <div className="flex-shrink-0 relative">
                            {/* 播放器背景遮罩 - 只在隐藏歌词时显示 */}
                            <div className="relative z-10">
                                <MusicPlayer
                        currentTrack={currentTrack}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        duration={duration}
                        volume={volume}
                        isMuted={isMuted}
                        onPlayPause={togglePlayPause}
                        onPrevious={handlePrevious}
                        onNext={handleNext}
                        onSeek={(time) => {
                            if (audioRef.current && duration > 0 && currentTrack) {
                                audioRef.current.currentTime = time;
                                // 时间更新由音频事件处理
                            }
                        }}
                        onVolumeChange={(newVolume) => {
                            changeVolume(newVolume);
                        }}
                        onMuteToggle={handleMuteToggle}
                        onLyricsToggle={() => setShowLyrics(!showLyrics)}
                        onCassetteClick={() => {
                            if (selectedLibraryTrack?.startsWith('generated-')) {
                                // 生成歌曲的 side 切换
                                const newIndex = activeTrackIndex === 0 ? 1 : 0;
                                if (allGeneratedTracks[newIndex]) {
                                    setActiveTrackIndex(newIndex);
                                    setSelectedLibraryTrack(`generated-${newIndex}`);
                                    // 如果当前正在播放，切换后继续播放
                                    if (isPlaying) {
                                        setTimeout(() => {
                                            if (audioRef.current) {
                                                audioRef.current.play().catch(console.error);
                                            }
                                        }, 100);
                                    }
                                }
                            } else {
                                // 库歌曲的 side 切换
                                handleSideToggle();
                            }
                        }}
                        canGoPrevious={selectedLibraryTrack?.startsWith('generated-') ? allGeneratedTracks.length > 1 : getUniqueSongs().length > 1}
                        canGoNext={selectedLibraryTrack?.startsWith('generated-') ? allGeneratedTracks.length > 1 : getUniqueSongs().length > 1}
                        sideLetter={
                            selectedLibraryTrack?.startsWith('generated-')
                                ? (activeTrackIndex === 0 ? 'A' : 'B')
                                : currentSide
                        }
                        cassetteDuration={calculateCassetteDuration()}
                        style={currentTrack?.style}
                        showLyrics={showLyrics}
                        />
                            </div>
                        </div>
                    )}

                    {/* Audio Element */}
                    <audio
                        ref={audioRef}
                        src={currentTrack?.audioUrl || ''}
                        onLoadedMetadata={handleAudioLoad}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleAudioEnd}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        preload="metadata"
                    />

                </div>
            </section>

            {/* Lyrics Generation Dialog */}
            <Dialog open={showLyricsDialog} onOpenChange={setShowLyricsDialog}>
                <DialogContent className="max-w-lg p-6">
                    <DialogHeader>
                        <DialogTitle>Generate Lyrics with AI</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        <div>
                            <label className="text-sm font-medium text-muted-foreground mb-6 block">
                                Let AI craft lyrics for your song
                            </label>
                            <div className="relative">
                                <textarea
                                    value={lyricsPrompt}
                                    onChange={(e) => setLyricsPrompt(e.target.value)}
                                    placeholder="e.g., A romantic song about falling in love..."
                                    maxLength={200}
                                    disabled={isGeneratingLyrics}
                                    className="w-full h-32 px-3 py-3 pr-16 border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <div className="absolute bottom-3 right-3 text-xs text-muted-foreground pointer-events-none">
                                    {lyricsPrompt.length}/200
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    handleGenerateLyrics();
                                }}
                                disabled={!lyricsPrompt.trim() || isGeneratingLyrics}
                                className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isGeneratingLyrics ? 'Generating...' : 'Generate Lyrics'}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export const StudioSection = () => {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <StudioContent />
        </Suspense>
    );
};
