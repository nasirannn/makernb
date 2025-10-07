'use client';

import React, { useState, useEffect } from 'react';
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

  // Check if user is admin
  const userIsAdmin = userId ? isAdmin(userId) : false;

  // Dynamic tabs based on user role
  const TABS = userIsAdmin
    ? ['All Tracks', 'Favorites', 'Pinned', 'Published']
    : ['All Tracks', 'Favorites', 'Published'];

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
      // Only show lyrics panel if it's not already open
      if (!showLyrics) {
        onLyricsToggle?.();
      }
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
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <Library className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-semibold">Library</h1>
        </div>

        {/* Tabs and Search Row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="bg-muted/30 rounded-xl p-1 inline-flex w-full md:w-auto">
            <div className="flex gap-1 w-full">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-3 text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap flex-1 ${
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
      <div className={`flex-1 overflow-y-auto px-3 md:px-6 relative ${hasPlayer ? 'pb-20' : 'pb-3'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full relative">
            <LoadingState message="Loading your music library" size="lg" vertical />
          </div>
        ) : paginatedTracks.length === 0 ? (
          <div className="flex items-center justify-center h-full relative">
            <div className="text-center">
              <div className="text-muted-foreground mb-2">No tracks found</div>
            </div>
          </div>
        ) : (
          <div className="relative space-y-3">
              {paginatedTracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 md:gap-4 p-3 md:p-5 rounded-2xl transition-all duration-300 group cursor-pointer backdrop-blur-sm border ${
                    selectedLibraryTrack === track.id
                      ? 'bg-black/40 shadow-lg border-white/20'
                      : 'bg-black/20 hover:bg-black/30 border border-border/10 hover:border-border/30 hover:shadow-md'
                  }`}
                  onClick={(e) => {
                    handleTrackAction(track, 'select');
                  }}
                >

                  {/* Cover Image */}
                  <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-md overflow-hidden flex-shrink-0 group/cover">
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
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate mb-1 text-sm md:text-base">
                        {track.title}
                      </h3>
                      {/* 桌面端显示完整的tags */}
                      <p className="hidden md:block text-sm text-muted-foreground truncate">
                        {(() => {
                          const tags = track.tags;
                          return tags && tags.length > 100 ? `${tags.substring(0, 100)}...` : tags;
                        })()}
                      </p>
                      {/* 移动端显示更短的tags */}
                      <p className="block md:hidden text-xs text-muted-foreground truncate">
                        {(() => {
                          const tags = track.tags;
                          return tags && tags.length > 30 ? `${tags.substring(0, 30)}...` : tags;
                        })()}
                      </p>
                    </div>

                    {/* Date - Hidden on mobile */}
                    <div className="hidden md:flex items-center gap-4">
                      <div className="text-sm text-muted-foreground flex-shrink-0 w-24 text-center">
                        {formatDate(track.created_at)}
                      </div>
                    </div>
                  </div>

                   {/* Action Buttons - Only show when lyrics panel is closed */}
                   {!showLyrics && (
                     <div className="flex items-center gap-1 flex-shrink-0">
                       {/* Duration */}
                       <div className="text-xs md:text-sm text-muted-foreground flex-shrink-0 w-12 md:w-16 text-center mr-1">
                         {formatDuration(track.duration)}
                       </div>
                       
                       {/* Favorite Button */}
                       <Button
                         variant="ghost"
                         size="sm"
                         className="h-7 w-7 md:h-8 md:w-8 p-0"
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
                           className="h-7 w-7 md:h-8 md:w-8 p-0"
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

                </div>
              ))}
          </div>
        )}
      </div>

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
    </div>
  );
};
