"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Custom Hooks
import { useAuth } from "@/contexts/AuthContext";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useLibraryTracks } from "@/hooks/use-library-tracks";

// Components
import { CommonSidebar } from "@/components/ui/sidebar";
import { LibraryPanel } from "@/components/ui/library-panel";
import { MusicPlayer } from "@/components/ui/music-player";
import { TrackDetailView } from "@/components/ui/track-detail-view";
import AuthModal from "@/components/ui/auth-modal";
import { PageLoading } from '@/components/ui/loading-dots';
import { Star } from "lucide-react";
import { toast } from "sonner";

const LibraryContent = () => {
    // ==================== Hooks ====================
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedTrackId = searchParams?.get('track') || null;
    
    const { user } = useAuth();
    const audioPlayer = useAudioPlayer();
    const { tracks, isLoading, toggleFavorite, updateTrack } = useLibraryTracks(user?.id);

    // ==================== UI States ====================
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    // 内部选中状态 - 用于在列表中保持选中高亮，即使URL参数被清除
    const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<string | null>(null);

    // ==================== 播放器稳定引用 ====================
    const audioPlayerRef = React.useRef(audioPlayer);
    React.useEffect(() => {
        audioPlayerRef.current = audioPlayer;
    }, [audioPlayer]);

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
    }), []);

    // ==================== 选中状态同步 ====================
    // 当 URL 有 track 参数时，更新内部选中状态
    // 返回列表页时保持选中状态，不清除 selectedLibraryTrack
    React.useEffect(() => {
        if (selectedTrackId) {
            // URL 有参数时，更新内部选中状态
            setSelectedLibraryTrack(selectedTrackId);
        }
        // 注意：不在 else 分支清除状态，以保持返回列表时的选中高亮
    }, [selectedTrackId]);

    // 页面卸载时清理选中状态
    React.useEffect(() => {
        return () => {
            setSelectedLibraryTrack(null);
        };
    }, []);

    // ==================== 数据转换 ====================

    // 为MusicPlayer准备tracks数据
    const musicPlayerTracks = React.useMemo(() => {
        return tracks.map(track => ({
            id: track.id,
            title: track.title,
            audioUrl: track.audioUrl,
            duration: track.duration,
            artist: track.genre || 'Unknown Artist',
            coverImage: track.coverImage || undefined,
            allTracks: [{
                id: track.id,
                audioUrl: track.audioUrl,
                duration: track.duration,
                coverR2Url: track.coverImage // 映射为 JavaScript 字段名
            }]
        }));
    }, [tracks]);

    // 为LibraryPanel准备tracks数据（兼容旧格式）
    const libraryPanelTracks = React.useMemo(() => {
        return tracks.map(track => ({
            id: track.id,
            title: track.title,
            tags: track.tags,
            genre: track.genre,
            audioUrl: track.audioUrl,
            duration: track.duration,
            isPublished: track.isPublished ?? false,
            isFavorited: track.isFavorited ?? false,
            isPinned: track.isPinned ?? false,
            coverR2Url: (track as any).coverR2Url || track.coverImage || undefined, // 优先使用新字段名
            coverUrl: track.coverImage || undefined,
            coverImage: track.coverImage || undefined,
            lyrics: track.lyrics,
            createdAt: track.createdAt ?? new Date().toISOString(),
            favoritedAt: track.favoritedAt,
            status: 'completed',
            allTracks: [{
                id: track.id,
                audioUrl: track.audioUrl,
                duration: track.duration,
                coverR2Url: (track as any).coverR2Url || track.coverImage || undefined, // 映射为 JavaScript 字段名
                lyrics: track.lyrics || undefined,
                isDeleted: false, // 映射为 JavaScript 字段名
                isFavorited: track.isFavorited ?? false
            }]
        }));
    }, [tracks]);

    // ==================== 播放控制 ====================
    // 导航到歌曲详情页
    const handleViewTrackDetail = React.useCallback((trackId: string) => {
        router.push(`/library?track=${trackId}`);
    }, [router]);

    // 返回列表
    const handleBackToList = React.useCallback(() => {
        // 使用 replace 替换当前 URL，不创建新的历史记录
        router.replace('/library');
    }, [router]);

    // 点击歌曲卡片 - 跳转到详情页
    const handleTrackSelect = React.useCallback((track: any) => {
        // 跳转到详情页
        handleViewTrackDetail(track.id);
        
        // 自动播放选中的歌曲
        if (player.currentTrack?.id === track.id) {
            // 如果是当前播放的歌曲，直接跳转，不暂停
            return;
        } else {
            // 播放新歌曲
            player.playTrack({
                id: track.id,
                title: track.title,
                audioUrl: track.audioUrl,
                duration: track.duration,
                genre: track.genre,
                lyrics: track.lyrics,
                tags: track.tags,
                coverImage: track.coverImage,
            });
        }
    }, [handleViewTrackDetail, player]);

    // 点击播放按钮 - 播放歌曲
    const handleTrackPlay = React.useCallback((track: any) => {
        // 如果点击的是当前播放的歌曲，则暂停/继续
        if (player.currentTrack?.id === track.id) {
            player.togglePlayPause();
            return;
        }

        // 播放新歌曲
        player.playTrack({
            id: track.id,
            title: track.title,
            audioUrl: track.audioUrl,
            duration: track.duration,
            genre: track.genre,
            lyrics: track.lyrics,
            tags: track.tags,
            coverImage: track.coverImage ?? track.coverR2Url,
        });
    }, [player]);

    const handlePrevious = React.useCallback(() => {
        if (!player.currentTrack || tracks.length === 0) return;
        
        const currentIndex = tracks.findIndex(track => track.id === player.currentTrack?.id);
        if (currentIndex === -1) return;
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
        const prevTrack = tracks[prevIndex];
        
        if (prevTrack) {
            handleTrackPlay(prevTrack);
        }
    }, [player, tracks, handleTrackPlay]);

    const handleNext = React.useCallback(() => {
        if (!player.currentTrack || tracks.length === 0) return;
        
        const currentIndex = tracks.findIndex(track => track.id === player.currentTrack?.id);
        if (currentIndex === -1) return;
        
        const nextIndex = currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
        const nextTrack = tracks[nextIndex];
        
        if (nextTrack) {
            handleTrackPlay(nextTrack);
        }
    }, [player, tracks, handleTrackPlay]);

    // ==================== Track Actions ====================
    const handleFavoriteToggle = React.useCallback(async (track: any) => {
        if (!user?.id) {
            toast('Please log in to manage favorites');
            return;
        }

        try {
            const isFavorited = await toggleFavorite(track.id);

            // 显示toast提示
            if (isFavorited) {
                toast('Added to favorites!', {
                    icon: <Star className="h-4 w-4 text-red-500 fill-current" />,
                    description: `"${track.title}" has been added to library.`
                });
            } else {
                toast('Removed from favorites', {
                    icon: <Star className="h-4 w-4 text-gray-500" />,
                    description: `"${track.title}" has been removed from library.`
                });
                
                // 如果在详情页取消收藏，返回列表页
                if (selectedTrackId === track.id) {
                    handleBackToList();
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast.error('Failed to update favorite status');
        }
    }, [user?.id, toggleFavorite, selectedTrackId, handleBackToList]);

    const handleTrackAction = React.useCallback((track: any, action: string) => {
        if (action === 'update') {
            updateTrack(track.id, { title: track.title });
        } else if (action === 'publish_toggle') {
            const currentIsPublished = track.isPublished ?? false;
            updateTrack(track.id, { isPublished: !currentIsPublished });
        } else if (action === 'pin') {
            const currentIsPinned = track.isPinned ?? false;
            updateTrack(track.id, { isPinned: !currentIsPinned });
        } else if (action === 'delete') {
            // 如果删除的是当前正在查看的歌曲，返回列表
            if (selectedTrackId === track.id) {
                handleBackToList();
            }
        }
    }, [updateTrack, selectedTrackId, handleBackToList]);

    // ==================== Music Player Props ====================
    const musicPlayerProps = {
        tracks: musicPlayerTracks,
        currentTrackIndex: tracks.findIndex(track => track.id === player.currentTrack?.id),
        currentPlayingTrack: player.currentTrack || undefined,
        isPlaying: player.isPlaying,
        currentTime: player.currentTime,
        duration: player.duration,
        volume: player.volume,
        isMuted: player.isMuted,
        onPlayPause: () => player.togglePlayPause(),
        onPrevious: handlePrevious,
        onNext: handleNext,
        onSeek: (time: number) => player.seek(time),
        onVolumeChange: (vol: number) => player.setVolume(vol),
        onMuteToggle: () => player.toggleMute(),
        hideProgress: false,
        onTrackChange: (index: number) => {
            const track = tracks[index];
            if (track) handleTrackPlay(track);
        },
    };

    // ==================== Render ====================
    return (
        <>
            <section 
                id="library" 
                className="h-screen flex flex-col md:flex-row bg-background relative overflow-hidden"
            >
                {/* Main Library Interface */}
                <div 
                    className="flex-1 h-full flex z-10 md:order-2 relative pb-[var(--mobile-nav-height,64px)] md:pb-0"
                >
                    {selectedTrackId ? (
                        /* 歌曲详情视图 */
                        <TrackDetailView 
                            trackId={selectedTrackId}
                            trackData={
                                (() => {
                                    const foundTrack = tracks.find(t => t.id === selectedTrackId);
                                    if (foundTrack) {
                                        return {
                                            id: foundTrack.id,
                                            title: foundTrack.title,
                                            tags: foundTrack.tags || '',
                                            lyrics: foundTrack.lyrics || '',
                                            coverImage: foundTrack.coverImage || null,
                                            audioUrl: foundTrack.audioUrl || '',
                                            createdAt: foundTrack.createdAt ?? new Date().toISOString(),
                                            duration: foundTrack.duration?.toString() || '0',
                                            isPublished: foundTrack.isPublished ?? false,
                                            isFavorited: foundTrack.isFavorited ?? false,
                                            userId: undefined,
                                            status: 'complete'
                                        };
                                    }
                                    return undefined;
                                })()
                            }
                            onBack={handleBackToList}
                            // currentPlayingTrackId 和 isPlaying 通过 EventBus 自动获取
                            onPlayTrack={(trackInfo) => {
                                // 如果点击的是当前播放的歌曲，则暂停/继续
                                if (player.currentTrack?.id === trackInfo.id) {
                                    player.togglePlayPause();
                                    return;
                                }
                                
                                // 播放新歌曲
                                player.playTrack({
                                    id: trackInfo.id,
                                    title: trackInfo.title,
                                    audioUrl: trackInfo.audioUrl,
                                    duration: parseFloat(trackInfo.duration),
                                    genre: trackInfo.tags,
                                    lyrics: trackInfo.lyrics,
                                    tags: trackInfo.tags,
                                    coverImage: trackInfo.coverImage,
                                });
                            }}
                            onDownload={async (trackInfo) => {
                                if (!trackInfo.id) {
                                    toast.error('Track ID is required');
                                    return;
                                }

                                // 显示下载开始提示
                                const downloadToast = toast.loading('Downloading...', {
                                    description: 'Preparing your file...'
                                });

                                try {
                                    // 使用新的下载API
                                    const response = await fetch(`/api/download-track?trackId=${trackInfo.id}`);
                                    
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
                                            const blobUrl = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = blobUrl;
                                            link.download = `${trackInfo.title || 'track'}.mp3`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            window.URL.revokeObjectURL(blobUrl);
                                        } else {
                                            throw new Error(data.error || 'Download failed');
                                        }
                                    } else {
                                        // 正常模式：直接获取音频文件
                                        const blob = await response.blob();
                                        const blobUrl = window.URL.createObjectURL(blob);
                                        const link = document.createElement('a');
                                        link.href = blobUrl;
                                        link.download = `${trackInfo.title || 'track'}.mp3`;
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                        window.URL.revokeObjectURL(blobUrl);
                                    }
                                    
                                    // 更新 toast 为成功状态
                                    toast.success('Download started!', {
                                        id: downloadToast,
                                        description: `${trackInfo.title || 'track'}.mp3`
                                    });
                                } catch (error) {
                                    console.error('Download error:', error);
                                    toast.error('Download failed', {
                                        id: downloadToast,
                                        description: error instanceof Error ? error.message : 'Unable to download file'
                                    });
                                }
                            }}
                        />
                    ) : (
                        /* 歌曲列表 */
                        <div className="min-h-0 h-full flex flex-col relative w-full">
                            {/* Library Panel */}
                            <LibraryPanel
                                tracks={libraryPanelTracks}
                                isLoading={isLoading}
                                hasPlayer={!!player.currentTrack}
                                onTrackSelect={(track) => {
                                    handleTrackSelect(track);
                                }}
                                onTrackPlay={handleTrackPlay}
                                onTrackAction={handleTrackAction}
                                currentPlayingTrack={player.currentTrack?.id || null}
                                selectedLibraryTrack={selectedLibraryTrack}
                                isPlaying={player.isPlaying}
                                userId={user?.id}
                                onFavoriteToggle={handleFavoriteToggle}
                            />
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


                {/* Common Sidebar */}
                <div className="md:relative md:z-[40] md:order-1">
                    <CommonSidebar />
                </div>
            </section>

            {/* Auth Modal */}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </>
    );
};

export const LibrarySection = () => {
    return (
        <Suspense fallback={<PageLoading message="Loading library" />}>
            <LibraryContent />
        </Suspense>
    );
};
