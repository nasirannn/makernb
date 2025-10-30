'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SafeImage } from './safe-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Play,
  Pause,
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
  ArrowDown,
  Search,
  X,
  LogOut,
  LogIn,
  Sparkles,
  Clock,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown as ArrowDownIcon,
  Pencil,
  Check,
  X as XIcon,
  Send
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { isAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { LoadingState } from './loading-dots';
import { LibraryTrack } from '@/types/track';
import { getEventBus, TRACK_EVENTS } from '@/lib/event-bus';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// 格式化时长显示
const formatDuration = (totalSeconds: number) => {
  // 处理 NaN 或无效值
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '';
  }
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

interface LibraryPanelProps {
  tracks: LibraryTrack[];
  isLoading?: boolean;
  onTrackSelect?: (track: LibraryTrack) => void;
  onTrackPlay?: (track: LibraryTrack) => void;
  onTrackAction?: (track: LibraryTrack, action: string) => void;
  currentPlayingTrack?: string | null;
  selectedLibraryTrack?: string | null;
  isPlaying?: boolean;
  userId?: string | null;
  hasPlayer?: boolean; // 新增：是否有播放器显示
  onFavoriteToggle?: (track: LibraryTrack) => void; // 收藏/取消收藏回调
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
  hasPlayer = false,
  onFavoriteToggle
}: LibraryPanelProps) => {
  const { user, signOut } = useAuth();
  const { credits } = useCredits();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trackToDelete, setTrackToDelete] = useState<LibraryTrack | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [trackToPublish, setTrackToPublish] = useState<LibraryTrack | null>(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [trackToRemoveFavorite, setTrackToRemoveFavorite] = useState<LibraryTrack | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedTrackForMenu, setSelectedTrackForMenu] = useState<LibraryTrack | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'pinned'>('all');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  // tags展开状态管理
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({});
  
  // 编辑对话框状态管理
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [trackToEdit, setTrackToEdit] = useState<LibraryTrack | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  
  // 切换tags展开状态
  const toggleTagsExpansion = (trackId: string) => {
    setExpandedTags(prev => ({
      ...prev,
      [trackId]: !prev[trackId]
    }));
  };
  
  // Check if user is admin
  const userIsAdmin = userId ? isAdmin(userId) : false;

  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter tracks based on search query and active filter
  const filteredTracks = tracks.filter(track => {
    // 根据筛选条件过滤
    if (activeFilter === 'published') {
      // 只显示已发布的收藏歌曲
      if (!track.is_published || track.is_deleted) return false;
    } else if (activeFilter === 'pinned') {
      // 只显示被pin的收藏歌曲
      if (!track.is_pinned || track.is_deleted) return false;
    } else if (activeFilter === 'all') {
      // 显示所有收藏的歌曲（未删除的）
      if (track.is_deleted) return false;
    }
    
    // 搜索过滤
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      track.title.toLowerCase().includes(query) ||
      (track.tags || '').toLowerCase().includes(query)
    );
  });

  // 处理排序
  const handleSortClick = () => {
    if (sortOrder === null) {
      setSortOrder('desc'); // 默认降序（最新的在前）
    } else if (sortOrder === 'desc') {
      setSortOrder('asc'); // 升序（旧的在前）
    } else {
      setSortOrder(null); // 取消排序
    }
  };

  // 根据排序规则对tracks进行排序
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (sortOrder === null) return 0;
    
    // 对于收藏歌曲，使用favorited_at（收藏时间）而不是created_at（歌曲创建时间）
    const dateA = new Date(a.favorited_at || a.created_at).getTime();
    const dateB = new Date(b.favorited_at || b.created_at).getTime();
    
    if (sortOrder === 'asc') {
      return dateA - dateB; // 升序：旧的在前面
    } else {
      return dateB - dateA; // 降序：新的在前面
    }
  });

  // Show all tracks without pagination
  const paginatedTracks = sortedTracks;


  const formatDate = (dateString: string) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  const handleTrackAction = (track: LibraryTrack, action: 'play' | 'select') => {
    
    if (action === 'play' && onTrackPlay) {
      onTrackPlay(track);
    } else if (action === 'select' && onTrackSelect) {
      onTrackSelect(track);
      // 不自动展开歌词面板，用户可以通过点击播放器中的歌曲信息来展开
    }
  };

  const handleDownload = (track: LibraryTrack) => {
    if (track.audioUrl) {
      const link = document.createElement('a');
      link.href = track.audioUrl;
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

  const handlePublishClick = (track: LibraryTrack) => {
    setTrackToPublish(track);
    setPublishDialogOpen(true);
  };

  const handlePublishConfirm = async () => {
    if (!trackToPublish || !userId) {
      toast('Please log in to publish tracks');
      setPublishDialogOpen(false);
      setTrackToPublish(null);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to publish tracks');
        setPublishDialogOpen(false);
        setTrackToPublish(null);
        return;
      }

      const response = await fetch('/api/track-publish/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ trackId: trackToPublish.id })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // 通知父组件更新发布状态
        onTrackAction?.(trackToPublish, 'publish_toggle');
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
    } finally {
      setPublishDialogOpen(false);
      setTrackToPublish(null);
    }
  };

  const handlePinToggle = async (track: LibraryTrack) => {
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

  const handleDeleteClick = (track: LibraryTrack) => {
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
        
        // 发送删除事件到 EventBus
        if (typeof window !== 'undefined') {
          const eventBus = getEventBus();
          eventBus.emit(TRACK_EVENTS.DELETED, {
            trackId: trackToDelete.id
          });
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

  const handleFavoriteRemoveConfirm = () => {
    if (!trackToRemoveFavorite || !onFavoriteToggle) return;
    onFavoriteToggle(trackToRemoveFavorite);
    setFavoriteDialogOpen(false);
    setTrackToRemoveFavorite(null);
  };

  const handleEditStart = (track: LibraryTrack, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setTrackToEdit(track);
    setEditTitle(track.title);
    setEditDialogOpen(true);
  };

  const handleEditCancel = () => {
    setEditDialogOpen(false);
    setTrackToEdit(null);
    setEditTitle('');
  };

  const handleEditSave = async () => {
    if (!userId || !trackToEdit || !editTitle.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast('Please log in to edit track title');
        setIsSaving(false);
        return;
      }

      const response = await fetch('/api/update-track-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ trackId: trackToEdit.id, title: editTitle.trim() })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // 更新本地tracks状态
        const updatedTrack = { ...trackToEdit, title: editTitle.trim() };
        onTrackAction?.(updatedTrack, 'update');
        
        toast('Track title updated successfully', {
          icon: <CheckCircle className="h-4 w-4 text-green-500" />
        });
        
        setEditDialogOpen(false);
        setTrackToEdit(null);
        setEditTitle('');
      } else {
        toast(result.error || 'Failed to update track title', {
          icon: <XCircle className="h-4 w-4 text-red-500" />
        });
      }
    } catch (error) {
      console.error('Error updating track title:', error);
      toast('Failed to update track title', {
        icon: <XCircle className="h-4 w-4 text-red-500" />
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Mobile Header - 移动端显示 logo 和品牌 */}
      <div className="flex-shrink-0 md:hidden px-6 py-4 bg-background/60 backdrop-blur-sm">
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
          <div className="flex items-center gap-3">
            {/* Credits Display - Only show when logged in */}
            {user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/10 backdrop-blur-sm rounded-lg">
                <Sparkles className="h-3.5 w-3.5 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {credits === null ? '...' : credits}
                </span>
              </div>
            )}
            {/* User Avatar */}
            {user ? (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <Button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 rounded-full"
                >
                  <Avatar className="w-9 h-9">
                    <AvatarImage
                      src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                      alt="User Avatar"
                    />
                    <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                      {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
                
                {/* User Menu Dropdown */}
                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-border/30 rounded-lg shadow-lg z-[60]">
                    <div className="flex flex-col gap-1 p-2">
                      <div className="px-3 py-2 border-b border-border/20 mb-2">
                        <div className="text-sm font-medium text-foreground truncate">
                          {user.user_metadata?.full_name || user.email}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {user.email}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTimeout(() => {
                            setUserMenuOpen(false);
                            signOut();
                          }, 50);
                        }}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                onClick={() => {}}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground rounded-full flex items-center justify-center"
              >
                <LogIn className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Title - 移动端标题和筛选器在同一行 */}
      <div className="flex-shrink-0 md:hidden px-6 py-4 bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Library className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-semibold">Library</h1>
          </div>
          {/* 筛选器 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'all'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              title="Favourites"
            >
              <Star className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveFilter('published')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'published'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              title="Published"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveFilter('pinned')}
              className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'pinned'
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              title="Pinned"
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Row - 移动端搜索框 */}
      <div className="flex-shrink-0 md:hidden px-6 pb-4 bg-background/60 backdrop-blur-sm">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 py-2 w-full bg-muted/30 border border-border/20 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
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

      {/* Desktop Header removed as requested */}

      {/* Desktop Filter and Search */}
      <div className="flex-shrink-0 hidden md:block px-6 pt-6 pb-4 bg-transparent">
        <div className="flex flex-row items-center justify-between gap-4">
          {/* Filter Tabs - Studio Style */}
          <div className="bg-muted/30 rounded-xl p-1 flex-shrink-0">
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={`py-2 px-4 text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                  activeFilter === 'all'
                    ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Star className="h-4 w-4 mr-1.5 inline" />
                Favourites
              </button>
              <button
                onClick={() => setActiveFilter('published')}
                className={`py-2 px-4 text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                  activeFilter === 'published'
                    ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Eye className="h-4 w-4 mr-1.5 inline" />
                Published
              </button>
              <button
                onClick={() => setActiveFilter('pinned')}
                className={`py-2 px-4 text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                  activeFilter === 'pinned'
                    ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <Pin className="h-4 w-4 mr-1.5 inline" />
                Pinned
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title and tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 w-64 bg-muted/30 border border-border/20 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200"
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
        className="flex-1 overflow-y-auto relative"
        style={{
          // 🎯 让内容延伸到页面底部，播放器悬浮遮挡
          // 有播放器：播放器高度 + 间距，让播放器悬浮遮挡内容
          // 无播放器：较大padding用于底部留白
          paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 1.5rem)' : '5rem'
        }}
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
                {searchQuery ? 'No matching tracks' : 'No tracks found'}
              </h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {searchQuery 
                  ? `No tracks found for "${searchQuery}". Try a different search term.`
                  : activeFilter === 'published'
                    ? 'No published tracks yet. Publish some tracks to make them public.'
                    : activeFilter === 'pinned'
                      ? 'No pinned tracks yet. Pin some tracks to organize your favorites.'
                      : 'No tracks found. Generate some music in the Studio to get started.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Table Header - 只在桌面端显示 */}
            <div className="hidden md:block">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-sm font-medium text-muted-foreground">
                <div className="col-span-1 flex items-center justify-center">
                  <span></span>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <span>Tracks</span>
                </div>
                <div className="col-span-4 flex items-center">
                  <span>Tags</span>
                </div>
                <div 
                  className="col-span-2 flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={handleSortClick}
                >
                  <span>Favorited Time</span>
                  <div className="relative inline-flex items-center">
                    {sortOrder === null && (
                      <ArrowUpDown className="h-4 w-4" />
                    )}
                    {sortOrder === 'asc' && (
                      <ArrowUp className="h-4 w-4 text-primary" />
                    )}
                    {sortOrder === 'desc' && (
                      <ArrowDownIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <span>Duration</span>
                </div>
                <div className="col-span-2 flex items-center justify-center">
                  <span>Actions</span>
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="space-y-1">
              {paginatedTracks.map((track, index) => (
                <div key={track.id}>
                  {/* Desktop Track Item - 桌面端 */}
                  <div
                    className={`hidden md:grid grid-cols-12 gap-4 px-2 mx-2 transition-all duration-300 group cursor-pointer rounded-lg border ${
                      selectedLibraryTrack === track.id || currentPlayingTrack === track.id
                        ? 'bg-muted/60 border-border/60'
                        : index % 2 === 0 
                          ? 'bg-background hover:bg-muted/30 border-transparent'
                          : 'bg-muted/10 hover:bg-muted/40 border-transparent'
                    }`}
                    onClick={(e) => {
                      handleTrackAction(track, 'select');
                    }}
                  >
                  {/* Favorite Button - 收藏按钮 - 桌面端 */}
                  <div className="col-span-1 flex items-center justify-center py-2">
                    {onFavoriteToggle && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Remove from library"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTrackToRemoveFavorite(track);
                          setFavoriteDialogOpen(true);
                        }}
                      >
                        <Star className="h-4 w-4 text-red-500 fill-current" />
                      </Button>
                    )}
                  </div>

                  {/* Cover Image and Play Button - 桌面端统一 */}
                  <div className="col-span-2 flex items-center gap-3 py-2">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover group-hover:scale-105">
                    {track.cover_r2_url ? (
                      <SafeImage
                        src={track.cover_r2_url}
                        alt={track.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        fallbackContent={
                          <span className="text-sm font-bold text-primary">
                            {track.id.slice(-2).toUpperCase()}
                          </span>
                        }
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {track.id.slice(-2).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Play Button Overlay - 鼠标悬浮时显示 */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30"
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
                    {/* Song Title */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className={`font-semibold text-sm truncate ${
                        selectedLibraryTrack === track.id || currentPlayingTrack === track.id ? 'text-primary' : 'text-foreground group-hover:text-primary'
                      }`}>
                        {track.title}
                      </h3>
                    </div>
                  </div>

                  {/* Tags Column - 标签信息 - 桌面端 */}
                  <div className="col-span-4 flex items-center py-2">
                    <span 
                      className="text-sm text-muted-foreground truncate"
                      title={track.tags || undefined}
                    >
                      {track.tags ? (
                        track.tags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                          <span key={index}>
                            <span>{tag.trim()}</span>
                            {index < array.length - 1 && <span className="mx-1">•</span>}
                          </span>
                        ))
                      ) : '-'}
                      {track.tags && track.tags.length > 70 && '...'}
                    </span>
                  </div>

                  {/* Favorited Time Column - 收藏时间 - 桌面端 */}
                  <div className="col-span-2 flex items-center py-2">
                    <span className="text-sm text-muted-foreground truncate">
                      {track.favorited_at ? new Date(track.favorited_at).toLocaleString('en-US', {
                        month: 'numeric',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      }) : 'Unknown'}
                    </span>
                  </div>

                  {/* Duration Column - 时长 - 桌面端 */}
                  <div className="col-span-1 flex items-center justify-end py-2">
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0))}
                    </span>
                  </div>

                  {/* Actions Column - 操作按钮 */}
                  <div className="col-span-2 flex items-center justify-center py-2">
                    <div className="flex items-center gap-2">
                      {/* Publish/Unpublish Button - 桌面端直接显示 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title={track.is_published ? "Unpublish" : "Publish"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublishClick(track);
                        }}
                      >
                        {track.is_published ? (
                          <Send className="h-4 w-4 text-green-600" />
                        ) : (
                          <Send className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {/* Download Button - 只在桌面端显示 */}
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

                      {/* More Actions Dropdown - 桌面端 */}
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
                          {/* Edit Title */}
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditStart(track);
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Title
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

                          {/* Delete - Available for all users */}
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  </div>
                  
                  {/* Mobile Track Item - 移动端 */}
                  <div
                    className={`md:hidden flex items-center gap-4 py-2 mx-3 transition-all duration-300 group cursor-pointer rounded-lg border ${
                      selectedLibraryTrack === track.id || currentPlayingTrack === track.id
                        ? 'bg-muted/60 border-border/60'
                        : 'hover:bg-muted/20 border-transparent'
                    }`}
                    onClick={(e) => {
                      handleTrackAction(track, 'select');
                    }}
                  >
                  {/* Cover Image and Play Button - 移动端 */}
                  <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover group-hover:scale-105 ml-2">
                    {track.cover_r2_url ? (
                      <SafeImage
                        src={track.cover_r2_url}
                        alt={track.title}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        fallbackContent={
                          <span className="text-sm font-bold text-primary">
                            {track.id.slice(-2).toUpperCase()}
                          </span>
                        }
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {track.id.slice(-2).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30"
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

                  {/* Song Title and Info - 移动端 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={`font-semibold text-sm truncate ${
                      selectedLibraryTrack === track.id || currentPlayingTrack === track.id ? 'text-primary' : 'text-foreground group-hover:text-primary'
                    }`}>
                      {track.title}
                    </h3>
                    {track.tags && track.tags.trim() !== '' && (
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* 时长显示在 tags 前面，用竖线分隔 */}
                        {track.duration && track.duration > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDuration(typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0))}
                            </span>
                            <span className="text-xs text-muted-foreground/60">|</span>
                          </>
                        )}
                        <p 
                          className="text-xs text-muted-foreground truncate flex-1"
                          title={track.tags}
                        >
                          {track.tags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                            <span key={index}>
                              <span>{tag.trim()}</span>
                              {index < array.length - 1 && <span className="mx-1">•</span>}
                            </span>
                          ))}
                          {track.tags.length > 100 && '...'}
                        </p>
                      </div>
                    )}
                    {!track.tags || track.tags.trim() === '' ? (
                      track.favorited_at && (
                        <p className="text-xs text-muted-foreground/60 truncate mt-1">
                          {new Date(track.favorited_at).toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true
                          })}
                        </p>
                      )
                    ) : track.favorited_at && (
                      <p className="text-xs text-muted-foreground/60 truncate mt-1">
                        {new Date(track.favorited_at).toLocaleString('en-US', {
                          month: 'numeric',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </p>
                    )}
                  </div>


                  {/* Mobile More Actions Button - 移动端更多按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 mr-2"
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
                </div>
              ))}
              
              {/* Tracks Summary */}
              {paginatedTracks.length > 0 && (
                <div className="flex justify-center items-center py-3 px-4">
                  <div className="text-sm text-muted-foreground font-medium">
                    {(() => {
                      const totalSongs = paginatedTracks.length;
                      const totalDuration = paginatedTracks.reduce((sum, track) => {
                        const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
                        return sum + (isNaN(duration) ? 0 : duration);
                      }, 0);
                      
                      // 底部汇总使用分钟格式
                      const totalMinutes = Math.floor(totalDuration / 60);
                      const durationText = totalMinutes > 0 ? `${totalMinutes} minute${totalMinutes > 1 ? 's' : ''}` : '';
                      
                      return `${totalSongs} song${totalSongs > 1 ? 's' : ''}${durationText ? `, ${durationText}` : ''}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
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

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">
              {trackToPublish?.is_published ? 'Unpublish Track' : 'Publish Track'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {trackToPublish?.is_published 
                ? `Are you sure you want to unpublish "${trackToPublish?.title}"? It will no longer be visible in explore.`
                : `Are you sure you want to publish "${trackToPublish?.title}"? It will be visible in explore.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handlePublishConfirm}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {trackToPublish?.is_published ? 'Unpublish' : 'Publish'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Favorite Remove Confirmation Dialog */}
      <AlertDialog open={favoriteDialogOpen} onOpenChange={setFavoriteDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">Remove from Library</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              Are you sure you want to remove &quot;{trackToRemoveFavorite?.title}&quot; from your library?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleFavoriteRemoveConfirm}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Title Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          handleEditCancel();
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Track Title</DialogTitle>
            <DialogDescription>
              Enter a new title for your track.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Enter track title"
              maxLength={80}
              className="w-full px-4 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSave();
                }
              }}
              autoFocus
            />
            <div className="text-right text-sm text-muted-foreground mt-1">
              {editTitle.length}/80
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-3 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleEditCancel}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={isSaving || !editTitle.trim()}
              className="w-full sm:w-auto"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Sheet Menu */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="sm:max-w-md p-0 gap-0 [&>button]:hidden md:hidden bottom-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl rounded-b-none border-0">
          <DialogDescription className="sr-only">
            Track options menu. Use the options below to manage your track.
          </DialogDescription>
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
            <DialogTitle className="flex items-center gap-3 mb-3 text-left">
              {selectedTrackForMenu?.cover_r2_url && (
                <SafeImage
                  src={selectedTrackForMenu.cover_r2_url}
                  alt={selectedTrackForMenu.title}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-left">
                  <h3 className="text-lg font-semibold truncate">
                    {selectedTrackForMenu?.title}
                  </h3>
                  {selectedTrackForMenu?.duration && selectedTrackForMenu.duration > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(typeof selectedTrackForMenu.duration === 'string' ? parseFloat(selectedTrackForMenu.duration) : (selectedTrackForMenu.duration || 0))}
                      </span>
                    </div>
                  )}
                </div>
                {selectedTrackForMenu?.favorited_at && (
                  <div className="text-xs text-muted-foreground/60 mt-1 text-left">
                    {new Date(selectedTrackForMenu.favorited_at).toLocaleString('en-US', {
                      month: 'numeric',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                  </div>
                )}
              </div>
            </DialogTitle>
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (selectedTrackForMenu?.tags && selectedTrackForMenu.tags.length > 100) {
                  toggleTagsExpansion(selectedTrackForMenu.id);
                }
              }}
              className={`${selectedTrackForMenu?.tags && selectedTrackForMenu.tags.length > 100 ? 'cursor-pointer' : ''}`}
            >
              <div className="text-sm text-foreground/70 mt-2 text-left">
                {selectedTrackForMenu?.tags && selectedTrackForMenu.tags.length > 100 ? (
                  <p className={expandedTags[selectedTrackForMenu.id] ? 'break-words' : 'line-clamp-3 break-words'}>
                    {expandedTags[selectedTrackForMenu.id] 
                      ? selectedTrackForMenu.tags 
                      : selectedTrackForMenu.tags
                    }
                  </p>
                ) : (
                  <p className="break-words">
                    {selectedTrackForMenu?.tags}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 space-y-2">
            {/* Edit Title */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleEditStart(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Pencil className="h-5 w-5" />
                <span className="font-medium">Edit Title</span>
              </button>
            )}

            {/* Download */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleDownload(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Download className="h-5 w-5" />
                <span className="font-medium">Download</span>
              </button>
            )}

            {/* Remove from library */}
            {onFavoriteToggle && selectedTrackForMenu && (
              <button
                onClick={() => {
                  setTrackToRemoveFavorite(selectedTrackForMenu);
                  setFavoriteDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Star className="h-5 w-5 text-red-500 fill-current" />
                <span className="font-medium">Remove from library</span>
              </button>
            )}

            {/* Publish/Unpublish */}
            {selectedTrackForMenu && (
              <div 
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                onClick={() => {
                  handlePublishClick(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
              >
                <div className="flex items-center gap-3">
                  {selectedTrackForMenu.is_published ? (
                    <Send className="h-5 w-5" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  <span className="font-medium">
                    {selectedTrackForMenu.is_published ? "Unpublish" : "Publish"}
                  </span>
                </div>
                <Switch
                  checked={selectedTrackForMenu.is_published}
                  onCheckedChange={() => {
                    handlePublishClick(selectedTrackForMenu);
                    setMobileMenuOpen(false);
                  }}
                />
              </div>
            )}

            {/* Pin/Unpin - Only for admins */}
            {userIsAdmin && selectedTrackForMenu && (
              <button
                onClick={() => {
                  handlePinToggle(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
              >
                {selectedTrackForMenu.is_pinned ? (
                  <PinOff className="h-5 w-5" />
                ) : (
                  <Pin className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {selectedTrackForMenu.is_pinned ? "Unpin" : "Pin"}
                </span>
              </button>
            )}

            {/* Delete */}
            {selectedTrackForMenu && (
              <button
                onClick={() => {
                  handleDeleteClick(selectedTrackForMenu);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 transition-colors text-red-600"
              >
                <Trash2 className="h-5 w-5" />
                <span className="font-medium">Delete</span>
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
