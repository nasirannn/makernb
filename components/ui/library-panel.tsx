'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SafeImage } from './safe-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  Pause,
  Heart,
  Library,
  Download,
  Pin,
  PinOff,
  Trash2,
  Eye,
  EyeOff,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  HeartCrack,
  ArrowDown,
  Search,
  X
} from 'lucide-react';
import { isAdmin } from '@/lib/auth-utils-optimized';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { LoadingState } from './loading-dots';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Track {
  id: string;
  title: string;
  genre: string;
  tags: string;
  duration: number;
  cover_r2_url?: string;
  audio_url?: string;
  side_letter?: string;
  created_at: string;
  is_published?: boolean;
  is_deleted?: boolean;
  is_favorited?: boolean;
  is_pinned?: boolean; // 从admin_pinned表获取
}

interface LibraryPanelProps {
  tracks: Track[];
  isLoading?: boolean;
  onTrackSelect?: (track: Track) => void;
  onTrackPlay?: (track: Track) => void;
  onTrackAction?: (track: Track, action: string) => void;
  currentPlayingTrack?: string | null;
  selectedLibraryTrack?: string | null;
  isPlaying?: boolean;
  userId?: string | null;
  onFavoriteToggle?: (trackId: string, isFavorited: boolean) => void;
  onLyricsToggle?: () => void;
  showLyrics?: boolean;
  hasPlayer?: boolean; // 新增：是否有播放器显示
}

export const LibraryPanel = ({
  tracks = [],
  isLoading = false,
  onTrackSelect,
  onTrackPlay,
  onTrackAction,
  currentPlayingTrack,
  selectedLibraryTrack,
  isPlaying = false,
  userId,
  onFavoriteToggle,
  onLyricsToggle,
  showLyrics = false,
  hasPlayer = false
}: LibraryPanelProps) => {
  const [activeTab, setActiveTab] = useState('All Tracks');
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTrackForMenu, setSelectedTrackForMenu] = useState<Track | null>(null);
  
  // 滚动位置管理
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const isRestoringScrollRef = useRef(false);

  // Check if user is admin
  const userIsAdmin = userId ? isAdmin(userId) : false;

  // Dynamic tabs based on user role
  const TABS = userIsAdmin
    ? ['All Tracks', 'Favorites', 'Pinned', 'Published']
    : ['All Tracks', 'Favorites', 'Published'];

  // 保存当前滚动位置
  const saveScrollPosition = useCallback(() => {
    if (scrollContainerRef.current && !isRestoringScrollRef.current) {
      scrollPositionsRef.current[activeTab] = scrollContainerRef.current.scrollTop;
    }
  }, [activeTab]);

  // 恢复滚动位置
  const restoreScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      const savedPosition = scrollPositionsRef.current[activeTab] || 0;
      isRestoringScrollRef.current = true;
      
      // 使用 requestAnimationFrame 确保在DOM更新后恢复滚动位置
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedPosition;
          // 延迟重置标志，避免滚动事件触发时误保存位置
          setTimeout(() => {
            isRestoringScrollRef.current = false;
          }, 100);
        }
      });
    }
  }, [activeTab]);

  // Filter tracks based on active tab and search query
  const filteredTracks = tracks.filter(track => {
    // Filter by tab
    let matchesTab = false;
    if (activeTab === 'Favorites') {
      matchesTab = track.is_favorited === true && !track.is_deleted;
    } else if (activeTab === 'Pinned') {
      matchesTab = track.is_pinned === true && !track.is_deleted;
    } else if (activeTab === 'Published') {
      matchesTab = track.is_published === true && !track.is_deleted;
    } else {
      // All Tracks shows all non-deleted tracks
      matchesTab = !track.is_deleted;
    }

    // Filter by search query
    if (!matchesTab) return false;
    
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      track.title.toLowerCase().includes(query) ||
      track.tags.toLowerCase().includes(query) ||
      track.genre.toLowerCase().includes(query)
    );
  });


  // Show all tracks without pagination
  const paginatedTracks = filteredTracks;

  // 监听滚动事件，保存滚动位置
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      saveScrollPosition();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [saveScrollPosition]);

  // Tab切换时恢复滚动位置
  useEffect(() => {
    restoreScrollPosition();
  }, [activeTab, filteredTracks.length, restoreScrollPosition]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  const handleTrackAction = (track: Track, action: 'play' | 'select') => {
    
    if (action === 'play' && onTrackPlay) {
      onTrackPlay(track);
    } else if (action === 'select' && onTrackSelect) {
      onTrackSelect(track);
      // 不自动展开歌词面板，用户可以通过点击播放器中的歌曲信息来展开
    }
  };

  const handleFavoriteToggle = async (track: Track) => {
    if (!userId) {
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
        // 通知父组件更新收藏状态
        if (onFavoriteToggle) {
          onFavoriteToggle(track.id, data.isFavorited);
        }
        
        // 显示toast提示
        if (data.isFavorited) {
          toast('Added to favorites!', {
            icon: <Heart className="h-4 w-4 text-red-500 fill-red-500" />,
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

  const handleDownload = (track: Track) => {
    if (track.audio_url) {
      const link = document.createElement('a');
      link.href = track.audio_url;
      link.download = `${track.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('Download started!', {
        icon: <ArrowDown className="h-4 w-4 text-blue-500" />
      });
    } else {
      toast('No audio file available for download');
    }
  };

  const handlePublishToggle = async (track: Track) => {
    if (!userId) {
      toast('Please log in to publish tracks');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to publish tracks');
        return;
      }

      const response = await fetch('/api/track-publish/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ trackId: track.id })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // 通知父组件更新发布状态
        onTrackAction?.(track, 'publish_toggle');
        toast(result.message, {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />
        });
      } else {
        toast(result.error || 'Failed to toggle publication', {
          icon: <XCircle className="h-4 w-4 text-red-500" />
        });
      }
    } catch (error) {
      console.error('Error toggling publication:', error);
      toast('Failed to toggle publication', {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
    }
  };

  const handlePinToggle = async (track: Track) => {
    if (!userId) {
      toast('Please log in to pin tracks');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to pin tracks');
        return;
      }

      const response = await fetch('/api/toggle-track-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ trackId: track.id })
      });

      const data = await response.json();

      if (data.success) {
        // 通知父组件更新置顶状态
        if (onTrackAction) {
          onTrackAction(track, 'pin');
        }
        
        toast(data.message, {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />
        });
      } else {
        toast(data.error || 'Failed to toggle pin', {
          icon: <XCircle className="h-4 w-4 text-red-500" />
        });
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast('Failed to toggle pin', {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
    }
  };

  const handleDeleteClick = (track: Track) => {
    setTrackToDelete(track);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!trackToDelete) return;

    try {
      // 获取当前session的access token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to delete tracks');
        return;
      }

      const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      const data = await response.json();

      if (data.success) {
        // 直接调用父组件的onTrackAction来更新状态，不重复显示对话框
        if (onTrackAction) {
          onTrackAction(trackToDelete, 'delete');
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
    <div className="h-full flex flex-col bg-transparent">
      {/* Mobile Header - 移动端显示 logo 和品牌 */}
      <div className="flex-shrink-0 md:hidden px-6 py-3 bg-background/60 backdrop-blur-sm">
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
      </div>

      {/* Desktop Header - 桌面端显示 Library 标题 */}
      <div className="hidden md:block flex-shrink-0 px-6 pt-6 pb-4 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <Library className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-semibold">Library</h1>
        </div>
      </div>

      <div className="flex-shrink-0 px-6 pb-4 bg-transparent">
        {/* Tabs and Search Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="bg-muted/30 rounded-lg p-1 inline-flex w-full md:w-auto">
            <div className="flex gap-1 w-full">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    // 切换前保存当前tab的滚动位置
                    saveScrollPosition();
                    setActiveTab(tab);
                  }}
                  className={`py-2 px-3 text-sm font-medium transition-all duration-200 rounded-md whitespace-nowrap flex-1 ${
                    activeTab === tab
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 w-full md:w-64 bg-muted/30 border border-border/20 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content - 正确的flex布局 */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto px-3 md:px-6 relative ${hasPlayer ? 'pb-20' : 'pb-3'}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full relative">
            <LoadingState message="Loading your music library" size="lg" vertical />
          </div>
        ) : paginatedTracks.length === 0 ? (
          <div className="flex items-center justify-center h-full relative">
            <div className="text-center max-w-md px-6 py-12">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <Library className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {searchQuery ? 'No matching tracks' : 'Your library is empty'}
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {searchQuery 
                  ? `No tracks found for "${searchQuery}". Try a different search term.`
                  : 'Start creating your first R&B track in the Studio.'
                }
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => window.location.href = '/studio'}
                  className="group bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground px-8 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25 inline-flex items-center gap-2"
                >
                  <span>Start creating</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative space-y-0">
              {paginatedTracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-4 px-4 py-2 transition-all duration-300 group cursor-pointer ${
                    selectedLibraryTrack === track.id
                      ? 'bg-muted/30'
                      : 'hover:bg-muted/20'
                  }`}
                  onClick={(e) => {
                    handleTrackAction(track, 'select');
                  }}
                >

                  {/* Cover Image */}
                  <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 group/cover">
                    {track.cover_r2_url ? (
                      <SafeImage
                        src={track.cover_r2_url}
                        alt={track.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        fallbackContent={
                          <span className="text-sm font-bold text-primary">
                            {track.side_letter || 'A'}
                          </span>
                        }
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {track.side_letter || 'A'}
                        </span>
                      </div>
                    )}

                    {/* Play Button Overlay - 鼠标悬浮时显示 */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrackAction(track, 'play');
                        }}
                      >
                        {currentPlayingTrack === track.id && isPlaying ? (
                          <Pause className="h-4 w-4 text-white" />
                        ) : (
                          <Play className="h-4 w-4 text-white" />
                        )}
                      </Button>
                    </div>

                    {/* Audio Wave Indicator - 只在播放时显示，鼠标悬浮时隐藏 */}
                    {currentPlayingTrack === track.id && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                        <CustomAudioWaveIndicator 
                          isPlaying={isPlaying} 
                          size="sm" 
                          className="text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0 flex items-center h-16 border-b border-border/30">
                      <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h3 className={`font-medium truncate text-sm ${
                            currentPlayingTrack === track.id ? 'text-primary' : 'text-foreground'
                          }`}>
                            {track.title}
                          </h3>
                          {/* Tags */}
                          {track.tags && (
                            <p className="text-xs text-muted-foreground truncate md:line-clamp-2 mt-0.5">
                              {(() => {
                                const tags = track.tags;
                                return tags && tags.length > 120 ? `${tags.substring(0, 120)}...` : tags;
                              })()}
                            </p>
                          )}
                        </div>
                        {/* Duration */}
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDuration(track.duration)}
                        </div>
                      </div>
                    </div>
                  </div>

                   {/* Action Buttons - Hidden on mobile, only show on desktop when lyrics panel is closed */}
                   {!showLyrics && (
                     <div className="hidden md:flex items-center gap-5 flex-shrink-0">
                       {/* Favorite Button */}
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-8 w-8 p-0"
                         title={track.is_favorited ? "Remove from favourites" : "Add to favourites"}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleFavoriteToggle(track);
                         }}
                         disabled={favoriteLoading[track.id]}
                       >
                         <Heart className={`h-4 w-4 ${track.is_favorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'} ${favoriteLoading[track.id] ? 'opacity-50' : ''}`} />
                       </Button>

                      {/* Download Button */}
                      <Button
                       variant="ghost"
                       size="sm"
                       className="h-8 w-8 p-0"
                       title="Download"
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDownload(track);
                       }}
                     >
                       <Download className="h-4 w-4" />
                     </Button>

                     {/* More Actions Dropdown */}
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button
                           variant="ghost"
                           size="sm"
                           className="h-8 w-8 p-0"
                           title="More actions"
                           onClick={(e) => e.stopPropagation()}
                         >
                           <MoreHorizontal className="h-4 w-4" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="w-48">
                         {/* Publish/Unpublish */}
                         <DropdownMenuItem
                           onClick={(e) => {
                             e.stopPropagation();
                             handlePublishToggle(track);
                           }}
                           className="cursor-pointer"
                         >
                           {track.is_published ? (
                             <EyeOff className="mr-2 h-4 w-4" />
                           ) : (
                             <Eye className="mr-2 h-4 w-4" />
                           )}
                           {track.is_published ? "Unpublish" : "Publish"}
                         </DropdownMenuItem>

                         {/* Pin/Unpin - Only for admins */}
                         {userIsAdmin && (
                           <DropdownMenuItem
                             onClick={(e) => {
                               e.stopPropagation();
                               handlePinToggle(track);
                             }}
                             className="cursor-pointer"
                           >
                             {track.is_pinned ? (
                               <PinOff className="mr-2 h-4 w-4" />
                             ) : (
                               <Pin className="mr-2 h-4 w-4" />
                             )}
                             {track.is_pinned ? "Unpin" : "Pin"}
                           </DropdownMenuItem>
                         )}

                         {/* Separator before delete */}
                         {userIsAdmin && <DropdownMenuSeparator />}

                         {/* Delete - Only for admins */}
                         {userIsAdmin && (
                           <DropdownMenuItem
                             onClick={(e) => {
                               e.stopPropagation();
                               handleDeleteClick(track);
                             }}
                             className="cursor-pointer text-destructive focus:text-destructive"
                           >
                             <Trash2 className="mr-2 h-4 w-4" />
                             Delete
                           </DropdownMenuItem>
                         )}
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </div>
                 )}

                 {/* Mobile More Actions Button - 移动端更多按钮 */}
                 {!showLyrics && (
                   <div className="md:hidden flex items-center flex-shrink-0">
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-8 w-8 p-0"
                       title="More actions"
                       onClick={(e) => {
                         e.stopPropagation();
                         setSelectedTrackForMenu(track);
                         setMobileMenuOpen(true);
                       }}
                     >
                       <MoreHorizontal className="h-5 w-5" />
                     </Button>
                   </div>
                 )}

                </div>
              ))}
              
              {/* No More Tracks Indicator */}
              {paginatedTracks.length > 0 && (
                <div className="text-center py-6">
                  <span className="text-sm text-muted-foreground font-medium">
                    No more tracks
                  </span>
                </div>
              )}
          </div>
        )}
      </div>

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

      {/* Mobile Bottom Sheet Menu */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 [&>button]:hidden md:hidden bottom-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl rounded-b-none border-0">
          {/* Drag Handle - 拖动指示器 */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              (e.currentTarget as any).dragStartY = touch.clientY;
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              const dragStartY = (e.currentTarget as any).dragStartY;
              if (dragStartY !== undefined) {
                (e.currentTarget as any).dragCurrentY = touch.clientY;
              }
            }}
            onTouchEnd={(e) => {
              const dragStartY = (e.currentTarget as any).dragStartY;
              const dragCurrentY = (e.currentTarget as any).dragCurrentY;
              
              if (dragStartY !== undefined && dragCurrentY !== undefined) {
                const dragDistance = dragCurrentY - dragStartY;
                // 向下拖动超过100px，关闭面板
                if (dragDistance > 100) {
                  setMobileMenuOpen(false);
                }
              }
              
              // 清除拖动数据
              delete (e.currentTarget as any).dragStartY;
              delete (e.currentTarget as any).dragCurrentY;
            }}
            className="flex items-center justify-center py-3 cursor-pointer active:cursor-grabbing touch-none"
          >
            <div className="w-12 h-1 bg-border/50 rounded-full" />
          </div>

          <DialogHeader className="p-4 pb-3 border-b">
            <div className="flex items-center gap-3">
              {selectedTrackForMenu?.cover_r2_url && (
                <SafeImage
                  src={selectedTrackForMenu.cover_r2_url}
                  alt={selectedTrackForMenu.title}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
              )}
              <DialogTitle className="text-base font-semibold text-left flex-1 min-w-0">
                <div className="truncate">{selectedTrackForMenu?.title}</div>
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex flex-col py-2">
            {selectedTrackForMenu && (
              <>
                {/* Favorite */}
                <button
                  onClick={() => {
                    handleFavoriteToggle(selectedTrackForMenu);
                    setMobileMenuOpen(false);
                  }}
                  disabled={favoriteLoading[selectedTrackForMenu.id]}
                  className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Heart className={`h-5 w-5 ${selectedTrackForMenu.is_favorited ? 'fill-red-500 text-red-500' : ''}`} />
                  <span className="text-sm">
                    {selectedTrackForMenu.is_favorited ? "Remove from favorites" : "Add to favorites"}
                  </span>
                </button>

                {/* Download */}
                <button
                  onClick={() => {
                    handleDownload(selectedTrackForMenu);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent transition-colors"
                >
                  <Download className="h-5 w-5" />
                  <span className="text-sm">Download</span>
                </button>

                {/* Publish/Unpublish */}
                <button
                  onClick={() => {
                    handlePublishToggle(selectedTrackForMenu);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent transition-colors"
                >
                  {selectedTrackForMenu.is_published ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                  <span className="text-sm">
                    {selectedTrackForMenu.is_published ? "Unpublish" : "Publish"}
                  </span>
                </button>

                {/* Pin/Unpin - Only for admins */}
                {userIsAdmin && (
                  <button
                    onClick={() => {
                      handlePinToggle(selectedTrackForMenu);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent transition-colors"
                  >
                    {selectedTrackForMenu.is_pinned ? (
                      <PinOff className="h-5 w-5" />
                    ) : (
                      <Pin className="h-5 w-5" />
                    )}
                    <span className="text-sm">
                      {selectedTrackForMenu.is_pinned ? "Unpin" : "Pin"}
                    </span>
                  </button>
                )}

                {/* Delete - Only for admins */}
                {userIsAdmin && (
                  <button
                    onClick={() => {
                      handleDeleteClick(selectedTrackForMenu);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3.5 text-left hover:bg-accent transition-colors text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="text-sm">Delete</span>
                  </button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
