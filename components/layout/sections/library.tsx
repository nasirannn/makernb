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
import { InlineTrackDetailsPanel } from "@/components/ui/inline-track-details";
import AuthModal from "@/components/ui/auth-modal";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface LibraryInlineTrackDetails {
    id: string;
    title: string;
    tags?: string;
    lyrics?: string;
    coverImage?: string | null;
    createdAt?: string;
    duration?: string;
}

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
    const [inlineTrackDetails, setInlineTrackDetails] = useState<LibraryInlineTrackDetails | null>(null);
    const [lyricsPanelOpen, setLyricsPanelOpen] = useState(false);
    // Sidebar宽度状态
    const [sidebarWidth, setSidebarWidth] = useState(80); // 默认收起状态的宽度
    const sidebarOffsetRef = React.useRef(sidebarWidth);

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

    const convertToInlineTrackDetails = React.useCallback((track: any): LibraryInlineTrackDetails => ({
        id: track.id,
        title: track.title || 'Untitled Track',
        tags: track.tags || '',
        lyrics: track.lyrics || '',
        coverImage: track.coverImage || track.coverR2Url || track.coverUrl || null,
        createdAt: track.createdAt ?? new Date().toISOString(),
        duration: track.duration
            ? (typeof track.duration === 'number' ? track.duration.toString() : track.duration)
            : undefined,
    }), []);

    // ==================== 选中状态同步 ====================
    // 当 URL 有 track 参数时，更新内部选中状态以及右侧歌词面板数据
    React.useEffect(() => {
        if (!selectedTrackId) {
            setLyricsPanelOpen(false);
            setInlineTrackDetails(null);
            return;
        }

        const foundTrack = tracks.find(track => track.id === selectedTrackId);
        if (foundTrack) {
            setSelectedLibraryTrack(selectedTrackId);
            setInlineTrackDetails(convertToInlineTrackDetails(foundTrack));
            setLyricsPanelOpen(true);
        }
    }, [selectedTrackId, tracks, convertToInlineTrackDetails]);

    // 当歌词面板打开时，播放器切歌需要同步面板内容
    React.useEffect(() => {
        if (!lyricsPanelOpen) return;
        const currentTrackId = audioPlayer.currentTrack?.id;
        if (!currentTrackId || inlineTrackDetails?.id === currentTrackId) return;

        const foundTrack = tracks.find(track => track.id === currentTrackId);
        if (!foundTrack) return;

        setSelectedLibraryTrack(currentTrackId);
        setInlineTrackDetails(convertToInlineTrackDetails(foundTrack));

        if (selectedTrackId !== currentTrackId) {
            router.replace(`/library?track=${currentTrackId}`);
        }
    }, [
        lyricsPanelOpen,
        audioPlayer.currentTrack?.id,
        tracks,
        inlineTrackDetails?.id,
        convertToInlineTrackDetails,
        selectedTrackId,
        router,
    ]);

    // 页面卸载时清理选中状态
    React.useEffect(() => {
        return () => {
            setSelectedLibraryTrack(null);
        };
    }, []);

    // ==================== 数据转换 ====================

    // 为MusicPlayer准备tracks数据
    const musicPlayerTracks = React.useMemo(() => {
        return tracks
            .filter(track => !(track.isDeleted ?? false))
            .map(track => ({
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
            isDeleted: track.isDeleted ?? false,
            coverR2Url: (track as any).coverR2Url || track.coverImage || undefined, // 优先使用新字段名
            coverUrl: track.coverImage || undefined,
            coverImage: track.coverImage || undefined,
            lyrics: track.lyrics,
            createdAt: track.createdAt ?? new Date().toISOString(),
            favoritedAt: track.favoritedAt ?? undefined,
            status: 'completed',
            allTracks: [{
                id: track.id,
                audioUrl: track.audioUrl,
                duration: track.duration,
                coverR2Url: (track as any).coverR2Url || track.coverImage || undefined, // 映射为 JavaScript 字段名
                lyrics: track.lyrics || undefined,
                isDeleted: track.isDeleted ?? false, // 映射为 JavaScript 字段名
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
        setLyricsPanelOpen(false);
        setInlineTrackDetails(null);
    }, [router]);

    // 点击歌曲卡片 - 跳转到详情页
    const handleTrackSelect = React.useCallback((track: any) => {
        setSelectedLibraryTrack(track.id);
        setInlineTrackDetails(convertToInlineTrackDetails(track));
        setLyricsPanelOpen(true);

        // 更新URL参数，保持可分享的详情链接
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
    }, [handleViewTrackDetail, player, convertToInlineTrackDetails]);

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
            const updates: Record<string, any> = {};
            if (typeof track.title !== 'undefined') {
                updates.title = track.title;
            }
            if (typeof track.coverImage !== 'undefined') {
                updates.coverImage = track.coverImage;
            }
            if (Object.keys(updates).length > 0) {
                updateTrack(track.id, updates);
            }
            if (inlineTrackDetails?.id === track.id) {
                setInlineTrackDetails(convertToInlineTrackDetails(track));
            }
        } else if (action === 'publish_toggle') {
            const currentIsPublished = track.isPublished ?? false;
            updateTrack(track.id, { isPublished: !currentIsPublished });
        } else if (action === 'delete') {
            updateTrack(track.id, { isDeleted: true });
            // 如果删除的是当前正在查看的歌曲，返回列表
            if (selectedTrackId === track.id) {
                handleBackToList();
            }
        }
    }, [updateTrack, selectedTrackId, handleBackToList, inlineTrackDetails, convertToInlineTrackDetails]);

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

    const showInlinePanel = Boolean(inlineTrackDetails) && lyricsPanelOpen;
    const isInlineTrackPlaying = !!(inlineTrackDetails && player.currentTrack?.id === inlineTrackDetails.id && player.isPlaying);

    // ==================== Render ====================
    return (
        <>
            <section
                id="library"
                className="h-screen flex flex-col bg-background relative overflow-hidden"
            >
                {/* Main Library Interface */}
                <div
                    className="flex-1 h-full flex z-10 relative pb-[var(--mobile-nav-height,64px)] md:pb-0 transition-[margin] duration-500"
                    style={{
                        marginLeft: 'var(--sidebar-offset, 0px)'
                    }}
                >
                    <div className={`flex flex-col md:flex-row flex-1 min-h-0 min-w-0 ${showInlinePanel ? 'md:gap-6' : 'md:gap-0'}`}>
                        <div className={`flex-1 min-h-0 min-w-0 ${showInlinePanel ? 'md:pl-6 md:pr-0' : ''}`}>
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
                        </div>

                        <div
                            className={`transition-all duration-300 flex-shrink-0 overflow-hidden ${
                                showInlinePanel
                                    ? 'opacity-100 w-full md:w-80 px-6 md:px-0'
                                    : 'opacity-0 pointer-events-none w-0 md:w-0 px-0'
                            }`}
                        >
                            {showInlinePanel && (
                                <div className="h-full">
                                    <InlineTrackDetailsPanel
                                        track={inlineTrackDetails}
                                        isPlaying={isInlineTrackPlaying}
                                        onClose={() => {
                                            setLyricsPanelOpen(false);
                                            handleBackToList();
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

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
                <CommonSidebar onWidthChange={setSidebarWidth} />
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
        <Suspense fallback={null}>
            <LibraryContent />
        </Suspense>
    );
};
