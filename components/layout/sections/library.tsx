"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// Custom Hooks
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";

// Supabase
import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth-utils";

// Components
import { CommonSidebar } from "@/components/ui/sidebar";
import { LibraryPanel } from "@/components/ui/library-panel";
import { SimpleMusicPlayer } from "@/components/ui/simple-music-player";
import { LyricsPanel } from "@/components/ui/lyrics-panel";
import { Button } from "@/components/ui/button";
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
import AuthModal from "@/components/ui/auth-modal";
import { Library, Download, Share2, Heart, Music, ChevronLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const LibraryContent = () => {
    // Custom Hooks
    const { user } = useAuth();
    const { refreshCredits } = useCredits();
    const router = useRouter();

    // UI States
    const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<string | null>(null);
    const [selectedForLyrics, setSelectedForLyrics] = useState<string | null>(null);
    const [libraryTracks, setLibraryTracks] = useState<any[]>([]);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
    const [currentLibraryTrack, setCurrentLibraryTrack] = useState<any>(null);
    const [currentSide, setCurrentSide] = useState<'A' | 'B'>('A');
    const [showLyrics, setShowLyrics] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [trackToDelete, setTrackToDelete] = useState<any>(null);

    // Audio States
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<any>(null);

    // 获取所有歌曲tracks（包括A面和B面）
    const getAllTracks = React.useCallback(() => {
        const allTracks: any[] = [];

        libraryTracks.forEach(generation => {
            // 数据库返回的字段是 allTracks，不是 tracks
            if (generation.allTracks) {
                generation.allTracks.forEach((track: any) => {
                    allTracks.push({
                        ...track,
                        title: generation.title,
                        tags: generation.tags,
                        genre: generation.genre,
                        is_published: track.is_published, // 使用发布状态替代私有状态
                        is_favorited: track.is_favorited, // 确保传递收藏状态
                        coverUrl: track.cover_r2_url
                    });
                });
            }
        });


        // 按创建时间排序
        return allTracks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [libraryTracks]);

    // 获取选中歌曲的信息（用于歌词面板）
    const getSelectedTrackForLyrics = React.useCallback(() => {
        if (!selectedForLyrics) return null;
        const allTracks = getAllTracks();
        const selectedTrack = allTracks.find(track => track.id === selectedForLyrics);
        return selectedTrack;
    }, [selectedForLyrics, getAllTracks]);

    // 获取库歌曲
    const fetchLibraryTracks = React.useCallback(async () => {
        if (!user?.id) return;

        setIsLoadingLibrary(true);
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
                setLibraryTracks(data.data?.music || []);
            } else {
                console.error('Failed to fetch library tracks:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error fetching library tracks:', error);
        } finally {
            setIsLoadingLibrary(false);
        }
    }, [user?.id]);

    // 初始化时获取库歌曲
    useEffect(() => {
        if (user?.id) {
            fetchLibraryTracks();
        }
    }, [user?.id, fetchLibraryTracks]);


    // 更新当前播放的库歌曲
    const updateCurrentTrackFromLibrary = React.useCallback((track: any, autoPlay = false) => {
        if (!track) return;

        setCurrentTrack({
            id: track.id,
            title: track.title,
            audioUrl: track.audioUrl,
            coverImage: track.coverUrl,
            lyrics: track.lyrics,
            tags: track.tags,
            mood: track.mood,
            duration: track.duration
        });


        if (audioRef.current) {
            // 先暂停当前播放
            audioRef.current.pause();
            audioRef.current.src = track.audioUrl;
            audioRef.current.load();

            if (autoPlay) {
                // 等待音频加载完成后再播放
                const handleCanPlay = () => {
                    if (audioRef.current) {
                        audioRef.current.play().catch(error => {
                            // 忽略 AbortError，这通常是因为新的加载请求中断了播放
                            if (error.name !== 'AbortError') {
                                console.error('Auto-play failed:', error);
                            }
                        });
                        audioRef.current.removeEventListener('canplay', handleCanPlay);
                    }
                };
                
                audioRef.current.addEventListener('canplay', handleCanPlay);
            }
        }
    }, []);

    // Audio event handlers
    const handleAudioLoad = React.useCallback(() => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
        }
    }, []);

    const handleTimeUpdate = React.useCallback(() => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    }, []);


    const handleNext = React.useCallback(() => {
        const allTracks = getAllTracks();
        const currentIndex = allTracks.findIndex(track => track.id === selectedLibraryTrack);
        if (currentIndex < allTracks.length - 1) {
            const nextTrack = allTracks[currentIndex + 1];
            setSelectedLibraryTrack(nextTrack.id);
            // 直接调用而不作为依赖，避免循环依赖
            handleLibraryTrackSelect(nextTrack.id);
        }
    }, [selectedLibraryTrack, getAllTracks]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleAudioEnd = React.useCallback(() => {
        setIsPlaying(false);
        setCurrentTime(0);
        // Auto play next track
        handleNext();
    }, [handleNext]);

    const handlePlay = React.useCallback(() => {
        console.log('Audio play event triggered');
        setIsPlaying(true);
    }, []);

    const handlePause = React.useCallback(() => {
        console.log('Audio pause event triggered');
        setIsPlaying(false);
    }, []);

    // 播放/暂停控制
    const togglePlayPause = React.useCallback(() => {
        console.log('togglePlayPause called:', {
            isPlaying,
            audioRef: !!audioRef.current,
            audioSrc: audioRef.current?.src,
            audioPaused: audioRef.current?.paused
        });
        
        if (audioRef.current) {
            if (isPlaying) {
                console.log('Pausing audio');
                audioRef.current.pause();
                // 手动更新状态作为备用
                setTimeout(() => {
                    if (audioRef.current?.paused) {
                        console.log('Manually setting isPlaying to false');
                        setIsPlaying(false);
                    }
                }, 100);
            } else {
                console.log('Playing audio');
                audioRef.current.play().catch(console.error);
                // 手动更新状态作为备用
                setTimeout(() => {
                    if (!audioRef.current?.paused) {
                        console.log('Manually setting isPlaying to true');
                        setIsPlaying(true);
                    }
                }, 100);
            }
        } else {
            console.log('No audioRef available');
        }
    }, [isPlaying]);

    // 绑定音频事件监听器
    React.useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            console.log('No audio element available for event binding');
            return;
        }

        console.log('Binding audio event listeners');
        audio.addEventListener('loadedmetadata', handleAudioLoad);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleAudioEnd);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            console.log('Removing audio event listeners');
            audio.removeEventListener('loadedmetadata', handleAudioLoad);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleAudioEnd);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [handleAudioLoad, handleTimeUpdate, handleAudioEnd, handlePlay, handlePause]);

    // 音量控制
    const changeVolume = (newVolume: number) => {
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };

    // 静音切换
    const handleMuteToggle = () => {
        if (audioRef.current) {
            const newMutedState = !isMuted;
            setIsMuted(newMutedState);
            audioRef.current.muted = newMutedState;
        }
    };

    // 处理库歌曲选择和播放
    const handleLibraryTrackSelect = React.useCallback((trackId: string) => {
        // Find the track in the nested structure
        let selectedTrack = null;
        let selectedGeneration = null;

        for (const generation of libraryTracks) {
            // 数据库返回的字段是 allTracks，不是 tracks
            if (generation.allTracks) {
                const track = generation.allTracks.find((t: any) => t.id === trackId);
                if (track) {
                    selectedTrack = track;
                    selectedGeneration = generation;
                    break;
                }
            }
        }

        if (!selectedTrack || !selectedGeneration) return;

        // 检查是否是同一首歌，如果是同一首歌则不重新加载音频
        const isSameTrack = selectedLibraryTrack === trackId;

        // 设置当前side
        setCurrentSide(selectedTrack.side_letter || 'A');

        // 只有在切换到不同歌曲时才重新加载音频
        if (!isSameTrack) {
            const trackData = {
                id: selectedTrack.id,
                title: selectedGeneration.title,
                audioUrl: selectedTrack.audio_url,
                coverUrl: selectedTrack.cover_r2_url,
                lyrics: selectedGeneration.lyrics_content,
                tags: selectedGeneration.tags,
                mood: selectedGeneration.mood || selectedGeneration.genre,
                duration: selectedTrack.duration,
                sideLetter: selectedTrack.side_letter
            };
            updateCurrentTrackFromLibrary(trackData, true);
        }
    }, [libraryTracks, selectedLibraryTrack, updateCurrentTrackFromLibrary]);

    // 处理磁带side切换
    const handleSideToggle = () => {
        if (!selectedLibraryTrack) return;

        // 找到当前歌曲的所有tracks（A面和B面）
        const currentTrack = libraryTracks.find(track => track.id === selectedLibraryTrack);
        if (!currentTrack) return;

        // 找到同一首歌的其他tracks
        const sameSongTracks = libraryTracks.filter(track =>
            track.title === currentTrack.title && track.id !== selectedLibraryTrack
        );

        if (sameSongTracks.length === 0) return;

        // 切换到另一个track
        const otherTrack = sameSongTracks[0];
        setSelectedLibraryTrack(otherTrack.id);
        setCurrentSide(otherTrack.sideLetter);
        updateCurrentTrackFromLibrary(otherTrack, true); // 自动播放
    };

    // Navigation handlers
    const handlePrevious = () => {
        const allTracks = getAllTracks();
        const currentIndex = allTracks.findIndex(track => track.id === selectedLibraryTrack);
        if (currentIndex > 0) {
            const prevTrack = allTracks[currentIndex - 1];
            setSelectedLibraryTrack(prevTrack.id);
            handleLibraryTrackSelect(prevTrack.id);
        }
    };


    const calculateCassetteDuration = () => {
        return duration || 0;
    };

    const handleSelectedLibraryTrack = React.useCallback((id: string | null) => {
        setSelectedLibraryTrack(id);
        if (id) {
            handleLibraryTrackSelect(id);
            // Show lyrics area when a song is selected
            setShowLyrics(true);
        } else {
            // Hide lyrics area when no song is selected
            setShowLyrics(false);
        }
    }, [handleLibraryTrackSelect]);

    // 删除确认处理
    const handleDeleteConfirm = async () => {
        if (!trackToDelete) return;

        try {
            const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (data.success) {
                // 更新本地tracks数据中的删除状态
                setLibraryTracks(prevTracks =>
                    prevTracks.map(generation => ({
                        ...generation,
                        allTracks: generation.allTracks.map((t: any) =>
                            t.id === trackToDelete.id
                                ? { ...t, is_deleted: true }
                                : t
                        )
                    }))
                );

                // 如果当前播放的是被删除的歌曲，停止播放
                if (selectedLibraryTrack === trackToDelete.id) {
                    setSelectedLibraryTrack(null);
                    setIsPlaying(false);
                }

                toast('歌曲已删除', {
                    icon: <CheckCircle className="h-4 w-4 text-green-500" />
                });
            } else {
                toast(data.error || '删除失败');
            }
        } catch (error) {
            console.error('Error deleting track:', error);
            toast('删除失败，请重试');
        } finally {
            setDeleteDialogOpen(false);
            setTrackToDelete(null);
        }
    };

    return (
        <>
            <section 
                id="library" 
                className="h-screen flex bg-background relative"
            >

                {/* Common Sidebar */}
                <div className="relative z-50">
                    <CommonSidebar />
                </div>

                {/* Main Library Interface */}
                <div className="flex-1 h-full flex overflow-hidden relative z-10">
                    <div 
                        className={`h-full transition-all duration-300 ease-in-out ${
                            showLyrics ? 'flex-1 min-w-0' : 'w-full'
                        }`}
                        style={{ minWidth: showLyrics ? '300px' : 'auto' }}
                    >
                        <LibraryPanel
                            tracks={getAllTracks()}
                            isLoading={isLoadingLibrary}
                            onTrackSelect={(track) => {
                                // Set both selectedLibraryTrack and selectedForLyrics
                                setSelectedLibraryTrack(track.id);
                                setSelectedForLyrics(track.id);
                                setShowLyrics(true);
                            }}
                            onTrackPlay={(track) => {
                                console.log('onTrackPlay called:', {
                                    trackId: track.id,
                                    currentTrackId: currentTrack?.id,
                                    isPlaying,
                                    audioRef: !!audioRef.current,
                                    audioPaused: audioRef.current?.paused,
                                    audioSrc: audioRef.current?.src
                                });

                                // 检查是否是同一首歌
                                const isSameTrack = currentTrack?.id === track.id;

                                if (isSameTrack && audioRef.current) {
                                    // 同一首歌：切换播放/暂停
                                    console.log('Same track - toggling play/pause');
                                    if (isPlaying) {
                                        audioRef.current.pause();
                                        setIsPlaying(false);
                                    } else {
                                        audioRef.current.play().then(() => {
                                            setIsPlaying(true);
                                        }).catch(error => {
                                            console.error('Play failed:', error);
                                            setIsPlaying(false);
                                        });
                                    }
                                } else {
                                    // 不同的歌或没有当前歌曲：加载并播放新歌
                                    console.log('Different track - loading and playing');

                                    // 设置选中状态
                                    setSelectedLibraryTrack(track.id);
                                    setSelectedForLyrics(track.id);
                                    setShowLyrics(true);

                                    // 找到完整的track数据
                                    let selectedTrack = null;
                                    let selectedGeneration = null;

                                    for (const generation of libraryTracks) {
                                        if (generation.allTracks) {
                                            const foundTrack = generation.allTracks.find((t: any) => t.id === track.id);
                                            if (foundTrack) {
                                                selectedTrack = foundTrack;
                                                selectedGeneration = generation;
                                                break;
                                            }
                                        }
                                    }

                                    if (selectedTrack && selectedGeneration && audioRef.current) {
                                        // 更新currentTrack
                                        const trackData = {
                                            id: selectedTrack.id,
                                            title: selectedGeneration.title,
                                            audioUrl: selectedTrack.audio_url,
                                            coverImage: selectedTrack.cover_r2_url,
                                            lyrics: selectedGeneration.lyrics_content,
                                            tags: selectedGeneration.tags,
                                            mood: selectedGeneration.mood || selectedGeneration.genre,
                                            duration: selectedTrack.duration
                                        };

                                        setCurrentTrack(trackData);
                                        setCurrentSide(selectedTrack.side_letter || 'A');

                                        // 加载并播放音频
                                        audioRef.current.pause();
                                        audioRef.current.src = selectedTrack.audio_url;
                                        audioRef.current.load();

                                        audioRef.current.addEventListener('loadeddata', () => {
                                            if (audioRef.current) {
                                                audioRef.current.play().then(() => {
                                                    setIsPlaying(true);
                                                }).catch(error => {
                                                    console.error('Play failed:', error);
                                                    setIsPlaying(false);
                                                });
                                            }
                                        }, { once: true });
                                    }
                                }
                            }}
                            onTrackAction={(track, action) => {
                                // Handle other track actions like pin, delete, etc.
                                console.log('Track action:', action, track.id);
                                
                                if (action === 'pin') {
                                    // 更新本地tracks数据中的置顶状态
                                    setLibraryTracks(prevTracks =>
                                        prevTracks.map(generation => ({
                                            ...generation,
                                            allTracks: generation.allTracks.map((t: any) =>
                                                t.id === track.id
                                                    ? { ...t, is_pinned: !t.is_pinned }
                                                    : t
                                            )
                                        }))
                                    );
                                } else if (action === 'delete') {
                                    // 直接执行删除操作，不显示对话框（因为已经在library-panel中显示了）
                                    (async () => {
                                        try {
                                            const response = await fetch(`/api/delete-track/${track.id}`, {
                                                method: 'DELETE',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                            });

                                            const data = await response.json();

                                            if (data.success) {
                                                // 更新本地tracks数据中的删除状态
                                                setLibraryTracks(prevTracks =>
                                                    prevTracks.map(generation => ({
                                                        ...generation,
                                                        allTracks: generation.allTracks.map((t: any) =>
                                                            t.id === track.id
                                                                ? { ...t, is_deleted: true }
                                                                : t
                                                        )
                                                    }))
                                                );

                                                // 如果当前播放的是被删除的歌曲，停止播放
                                                if (selectedLibraryTrack === track.id) {
                                                    setSelectedLibraryTrack(null);
                                                    setIsPlaying(false);
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
                                        }
                                    })();
                                }
                            }}
                            currentPlayingTrack={currentTrack?.id || null}
                            selectedLibraryTrack={selectedLibraryTrack}
                            isPlaying={isPlaying}
                            userId={user?.id}
                            onLyricsToggle={() => setShowLyrics(!showLyrics)}
                            showLyrics={showLyrics}
                            onFavoriteToggle={(trackId, isFavorited) => {
                                // 更新本地tracks数据中的收藏状态
                                setLibraryTracks(prevTracks =>
                                    prevTracks.map(generation => ({
                                        ...generation,
                                        allTracks: generation.allTracks.map((track: any) =>
                                            track.id === trackId
                                                ? { ...track, is_favorited: isFavorited }
                                                : track
                                        )
                                    }))
                                );
                            }}
                        />
                    </div>

                    {/* Lyrics Panel - Inline */}
                    <LyricsPanel
                        isOpen={showLyrics}
                        onClose={() => {
                            setShowLyrics(false);
                            setSelectedForLyrics(null);
                            setSelectedLibraryTrack(null);
                        }}
                        lyrics={getSelectedTrackForLyrics()?.lyrics}
                        title={getSelectedTrackForLyrics()?.title}
                        tags={getSelectedTrackForLyrics()?.tags}
                        genre={getSelectedTrackForLyrics()?.genre}
                        coverImage={getSelectedTrackForLyrics()?.coverUrl}
                        sideLetter={getSelectedTrackForLyrics()?.side_letter || 'A'}
                        isPublished={getSelectedTrackForLyrics()?.is_published}
                        isPinned={getSelectedTrackForLyrics()?.is_pinned}
                        isAdmin={isAdmin(user?.id || '')}
                        onDownload={() => {
                            const track = getSelectedTrackForLyrics();
                            if (track?.audio_url) {
                                const link = document.createElement('a');
                                link.href = track.audio_url;
                                link.download = `${track.title}.mp3`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }
                        }}
                        onPublishToggle={() => {
                            // TODO: 实现发布/取消发布功能
                            console.log('Publish toggle');
                        }}
                        onPinToggle={async () => {
                            const track = getSelectedTrackForLyrics();
                            if (!track) return;
                            
                            try {
                                // 获取当前session的access token
                                const { data: { session } } = await supabase.auth.getSession();
                                if (!session?.access_token) {
                                    toast('Please log in to pin tracks');
                                    return;
                                }
                                
                                const response = await fetch('/api/toggle-track-pin', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${session.access_token}`,
                                    },
                                    body: JSON.stringify({ trackId: track.id }),
                                });
                                
                                const data = await response.json();
                                
                                if (data.success) {
                                    // 更新本地状态
                                    setLibraryTracks(prevTracks =>
                                        prevTracks.map(generation => ({
                                            ...generation,
                                            allTracks: generation.allTracks.map((t: any) =>
                                                t.id === track.id
                                                    ? { ...t, is_pinned: data.isPinned }
                                                    : t
                                            )
                                        }))
                                    );
                                    
                                    // 显示成功消息
                                    toast(data.message || (data.isPinned ? 'Track pinned successfully' : 'Track unpinned successfully'), {
                                        icon: <CheckCircle className="h-4 w-4 text-green-500" />
                                    });
                                } else {
                                    toast(data.error || 'Failed to toggle pin status');
                                }
                            } catch (error) {
                                console.error('Error toggling pin:', error);
                                toast('Failed to toggle pin status');
                            }
                        }}
                        onDelete={() => {
                            // 删除功能通过onTrackAction处理
                            console.log('Delete action triggered');
                        }}
                    />
                </div>

                {/* Music Player - Fixed at bottom when track is loaded */}
                {currentTrack && (
                    <div className={`fixed bottom-0 left-16 z-50 transition-all duration-300 ease-in-out ${
                        showLyrics ? 'right-56 sm:right-60 md:right-64 lg:right-72' : 'right-0'
                    }`}>
                        <div className="relative">
                            <SimpleMusicPlayer
                                tracks={[{
                                    id: currentTrack.id || '',
                                    title: currentTrack.title || '',
                                    audioUrl: currentTrack.audioUrl || '',
                                    duration: currentTrack.duration || 0,
                                    coverImage: currentTrack.coverImage,
                                    artist: 'AI Generated',
                                    allTracks: [{
                                        id: currentTrack.id || '',
                                        audio_url: currentTrack.audioUrl || '',
                                        duration: currentTrack.duration || 0,
                                        side_letter: currentSide,
                                        cover_r2_url: currentTrack.coverImage
                                    }]
                                }]}
                                currentTrackIndex={0}
                                currentPlayingTrack={currentTrack ? { trackId: currentTrack.id || '', audioUrl: currentTrack.audioUrl || '' } : null}
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
                                    }
                                }}
                                onVolumeChange={(newVolume) => {
                                    changeVolume(newVolume);
                                }}
                                onMuteToggle={handleMuteToggle}
                                isCollapsed={showLyrics}
                            onTrackChange={() => {}}
                            onSideChange={() => {}}
                        />
                        </div>
                    </div>
                )}

                {/* Hidden Audio Element */}
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
            </section>

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

            {/* Auth Modal */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </>
    );
};

import { PageLoading } from '@/components/ui/loading-dots';

export const LibrarySection = () => {
    return (
        <Suspense fallback={<PageLoading message="Loading library" />}>
            <LibraryContent />
        </Suspense>
    );
};