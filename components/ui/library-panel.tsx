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
  HeartCrack,
  ArrowDown
} from 'lucide-react';
import { isAdmin } from '@/lib/auth-utils';
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
  showLyrics = false
}: LibraryPanelProps) => {
  const [activeTab, setActiveTab] = useState('All Tracks');
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);

  // Check if user is admin
  const userIsAdmin = userId ? isAdmin(userId) : false;

  // Dynamic tabs based on user role
  const TABS = userIsAdmin
    ? ['All Tracks', 'Favorites', 'Pinned', 'Published']
    : ['All Tracks', 'Favorites', 'Published'];

  // Filter tracks based on active tab
  const filteredTracks = tracks.filter(track => {
    // Filter by tab
    if (activeTab === 'Favorites') {
      return track.is_favorited === true && !track.is_deleted;
    } else if (activeTab === 'Pinned') {
      return track.is_pinned === true && !track.is_deleted;
    } else if (activeTab === 'Published') {
      return track.is_published === true && !track.is_deleted;
    }
    // All Tracks shows all non-deleted tracks
    return !track.is_deleted;
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
    console.log('handleTrackAction called:', { trackId: track.id, action, hasOnTrackPlay: !!onTrackPlay });
    
    if (action === 'play' && onTrackPlay) {
      console.log('Calling onTrackPlay');
      onTrackPlay(track);
    } else if (action === 'select' && onTrackSelect) {
      console.log('Calling onTrackSelect');
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
      
      if (result.success) {
        // 通知父组件更新发布状态
        onTrackAction?.(track, 'publish_toggle');
        toast(result.message);
      } else {
        toast(result.error || 'Failed to toggle publication');
      }
    } catch (error) {
      console.error('Error toggling publication:', error);
      toast('Failed to toggle publication');
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
        
        toast(data.message);
      } else {
        toast(data.error || 'Failed to toggle pin');
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast('Failed to toggle pin');
    }
  };

  const handleDeleteClick = (track: Track) => {
    setTrackToDelete(track);
    setDeleteDialogOpen(true);
  };

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
        <div className="flex items-center justify-between gap-4">
          {/* Navigation Tabs */}
          <div className="bg-muted/30 rounded-xl p-1 inline-flex">
            <div className={`grid gap-1 ${
              TABS.length === 5 ? 'grid-cols-5' : 
              TABS.length === 4 ? 'grid-cols-4' : 
              TABS.length === 3 ? 'grid-cols-3' : 
              'grid-cols-2'
            }`}>
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-3 text-sm font-medium transition-all duration-200 rounded-lg whitespace-nowrap ${
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

        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden border-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingState message="Loading your music library" size="lg" vertical />
          </div>
        ) : paginatedTracks.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-muted-foreground mb-2">No tracks found</div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="space-y-2 px-6 pb-24">
              {paginatedTracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-colors duration-200 group cursor-pointer backdrop-blur-sm ${
                    selectedLibraryTrack === track.id
                      ? 'bg-primary/20 shadow-sm'
                      : `${index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'} hover:bg-white/10`
                  }`}
                  onClick={(e) => {
                    console.log('Track row clicked!', {
                      trackId: track.id,
                      target: e.target,
                      currentTarget: e.currentTarget,
                      event: e
                    });
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
                          console.log('Button clicked!', {
                            trackId: track.id,
                            isPlaying,
                            currentPlayingTrack,
                            event: e
                          });
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
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <div className="flex-1 min-w-0 max-w-xs">
                      <h3 className="font-medium text-foreground truncate mb-1">
                        {track.title}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {(() => {
                          const tags = track.tags;
                          return tags && tags.length > 50 ? `${tags.substring(0, 50)}...` : tags;
                        })()}
                      </p>
                    </div>

                  </div>

                  {/* Duration */}
                  <div className="text-sm text-muted-foreground flex-shrink-0 w-16 text-center mr-2">
                    {formatDuration(track.duration)}
                  </div>

                  {/* Created Date */}
                  <div className="text-sm text-muted-foreground flex-shrink-0 w-24 text-center mr-2">
                    {formatDate(track.created_at)}
                  </div>

                   {/* Action Buttons - Only show when lyrics panel is closed */}
                   {!showLyrics && (
                     <div className="flex items-center gap-1 flex-shrink-0">
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

                </div>
              ))}
            </div>

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
