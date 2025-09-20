'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Track {
    id: string;
    title: string;
    audioUrl: string;
    duration?: number;
    coverImage?: string;
    sideLetter?: string;
}

interface UseMusicPlayerProps {
    tracks?: Track[];
    autoPlay?: boolean;
    onTrackChange?: (track: Track | null) => void;
    onPlayStateChange?: (isPlaying: boolean) => void;
}

export const useMusicPlayer = ({
    tracks = [],
    autoPlay = false,
    onTrackChange,
    onPlayStateChange
}: UseMusicPlayerProps = {}) => {
    // 播放状态
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);

    // Audio element ref
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // 初始化音频元素
    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio();
            audioRef.current.volume = volume;
            
            const audio = audioRef.current;
            
            // 音频事件监听
            const handleLoadedMetadata = () => {
                setDuration(audio.duration || 0);
            };
            
            const handleTimeUpdate = () => {
                setCurrentTime(audio.currentTime || 0);
            };
            
            const handleEnded = () => {
                setIsPlaying(false);
                onPlayStateChange?.(false);
                // 自动播放下一首
                handleNext();
            };
            
            const handleError = (e: Event) => {
                console.error('Audio error:', e);
                setIsPlaying(false);
                onPlayStateChange?.(false);
            };
            
            audio.addEventListener('loadedmetadata', handleLoadedMetadata);
            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);
            
            return () => {
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
                audio.removeEventListener('timeupdate', handleTimeUpdate);
                audio.removeEventListener('ended', handleEnded);
                audio.removeEventListener('error', handleError);
                audio.pause();
            };
        }
    }, [volume, onPlayStateChange]);

    // 加载新曲目
    const loadTrack = useCallback((track: Track | null) => {
        if (!audioRef.current || !track) return;
        
        const audio = audioRef.current;
        audio.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        
        if (track.audioUrl) {
            audio.src = track.audioUrl;
            audio.load();
            setCurrentTrack(track);
            onTrackChange?.(track);
        }
    }, [onTrackChange]);

    // 播放/暂停
    const togglePlayPause = useCallback(() => {
        if (!audioRef.current || !currentTrack) return;
        
        const audio = audioRef.current;
        
        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
            onPlayStateChange?.(false);
        } else {
            audio.play().then(() => {
                setIsPlaying(true);
                onPlayStateChange?.(true);
            }).catch(error => {
                console.error('Play failed:', error);
                setIsPlaying(false);
                onPlayStateChange?.(false);
            });
        }
    }, [isPlaying, currentTrack, onPlayStateChange]);

    // 跳转到指定时间
    const seekTo = useCallback((time: number) => {
        if (!audioRef.current) return;
        
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);

    // 音量控制
    const changeVolume = useCallback((newVolume: number) => {
        if (!audioRef.current) return;
        
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        setVolume(clampedVolume);
        audioRef.current.volume = clampedVolume;
        
        if (clampedVolume > 0 && isMuted) {
            setIsMuted(false);
        }
    }, [isMuted]);

    // 静音切换
    const toggleMute = useCallback(() => {
        if (!audioRef.current) return;
        
        if (isMuted) {
            audioRef.current.volume = volume;
            setIsMuted(false);
        } else {
            audioRef.current.volume = 0;
            setIsMuted(true);
        }
    }, [isMuted, volume]);

    // 上一首
    const handlePrevious = useCallback(() => {
        if (tracks.length === 0) return;
        
        const newIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : tracks.length - 1;
        const newTrack = tracks[newIndex];
        
        if (newTrack) {
            setCurrentTrackIndex(newIndex);
            loadTrack(newTrack);
            
            if (autoPlay && isPlaying) {
                setTimeout(() => {
                    togglePlayPause();
                }, 100);
            }
        }
    }, [tracks, currentTrackIndex, loadTrack, autoPlay, isPlaying, togglePlayPause]);

    // 下一首
    const handleNext = useCallback(() => {
        if (tracks.length === 0) return;
        
        const newIndex = currentTrackIndex < tracks.length - 1 ? currentTrackIndex + 1 : 0;
        const newTrack = tracks[newIndex];
        
        if (newTrack) {
            setCurrentTrackIndex(newIndex);
            loadTrack(newTrack);
            
            if (autoPlay && isPlaying) {
                setTimeout(() => {
                    togglePlayPause();
                }, 100);
            }
        }
    }, [tracks, currentTrackIndex, loadTrack, autoPlay, isPlaying, togglePlayPause]);

    // 播放指定曲目
    const playTrack = useCallback((track: Track, trackIndex?: number) => {
        loadTrack(track);
        
        if (trackIndex !== undefined) {
            setCurrentTrackIndex(trackIndex);
        } else {
            const index = tracks.findIndex(t => t.id === track.id);
            setCurrentTrackIndex(index);
        }
        
        if (autoPlay) {
            setTimeout(() => {
                togglePlayPause();
            }, 100);
        }
    }, [loadTrack, tracks, autoPlay, togglePlayPause]);

    // 下载当前曲目
    const downloadTrack = useCallback(() => {
        if (!currentTrack?.audioUrl) return;
        
        if (process.env.NODE_ENV === 'development') {
            alert('下载功能将在实际部署时启用');
            return;
        }
        
        // 实际下载逻辑
        const link = document.createElement('a');
        link.href = currentTrack.audioUrl;
        link.download = `${currentTrack.title}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [currentTrack]);

    return {
        // 状态
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        currentTrackIndex,
        
        // 控制方法
        loadTrack,
        playTrack,
        togglePlayPause,
        seekTo,
        changeVolume,
        toggleMute,
        handlePrevious,
        handleNext,
        downloadTrack,
        
        // 能力检查
        canGoPrevious: tracks.length > 1,
        canGoNext: tracks.length > 1,
        
        // Audio ref (用于外部访问)
        audioRef
    };
};
