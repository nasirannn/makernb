"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import { Music, Library, Minus, Plus, Sparkles, ChevronLeft, Download, Trash2, Play, Pause, Pin, PinOff } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import Image from "next/image";
import Link from "next/link";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { isAdmin } from '@/lib/auth-utils';
import AuthModal from '@/components/ui/auth-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// 统一的选项按钮样式
const getOptionButtonClasses = (isSelected: boolean, layout: 'horizontal' | 'vertical' = 'vertical') => {
  const baseClasses = "px-3 py-2 rounded-lg border transition-all duration-200";
  const layoutClasses = layout === 'vertical' 
    ? "flex flex-col items-center gap-1" 
    : "flex items-center gap-2";
  const selectedClasses = "bg-primary/20 border-transparent text-primary shadow-sm";
  const unselectedClasses = "bg-background/50 border-input/30 text-muted-foreground hover:bg-muted/20 hover:border-input/50 hover:text-foreground";
  
  return `${baseClasses} ${layoutClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
};

// 智能Tooltip组件
const SmartTooltip = ({ children, content, position = "right" }: { 
  children: React.ReactNode; 
  content: string | React.ReactNode; 
  position?: "right" | "left" | "top" | "bottom" 
}) => {
  const getTooltipClasses = () => {
    const baseClasses = "absolute px-4 py-3 bg-gradient-to-r from-card/95 via-card/90 to-card/95 backdrop-blur-md text-foreground text-sm rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out z-[9999] shadow-2xl border border-border/30 pointer-events-none transform scale-95 group-hover:scale-100";
    
    // 如果是 React 元素，使用多行样式；如果是字符串，使用单行样式
    const whitespaceClass = typeof content === 'string' ? 'whitespace-nowrap' : 'whitespace-normal';
    
    switch (position) {
      case "left":
        return `${baseClasses} ${whitespaceClass} right-full mr-4 top-1/2 transform -translate-y-1/2`;
      case "top":
        return `${baseClasses} ${whitespaceClass} bottom-full mb-4 left-1/2 transform -translate-x-1/2`;
      case "bottom":
        return `${baseClasses} ${whitespaceClass} top-full mt-4 left-1/2 transform -translate-x-1/2`;
      default: // right
        return `${baseClasses} ${whitespaceClass} left-full ml-4 top-1/2 transform -translate-y-1/2`;
    }
  };

  return (
    <div className="relative group">
      {children}
      <div className={getTooltipClasses()}>
        {content}
      </div>
    </div>
  );
};

const { 
  genres, 
  vibes, 
  grooveTypes, 
  leadInstruments, 
  drumKits, 
  bassTones, 
  vocalGenders, 
  harmonyPalettes
} = musicOptions;

interface StudioSidebarProps {
  sidebarOpen: boolean;
  showLibrary: boolean;
  selectedLibraryTrack: string | null;
  setSidebarOpen: (open: boolean) => void;
  setShowLibrary: (show: boolean) => void;
  setSelectedLibraryTrack: (id: string | null) => void;
  libraryTracks: any[];
  setLibraryTracks: React.Dispatch<React.SetStateAction<any[]>>;
  isLoadingLibrary: boolean;
  isPlaying: boolean;
  audioRef: React.RefObject<HTMLAudioElement>;
  onPlayPause: () => void;
  
  // Music generation states
  mode: "basic" | "custom";
  setMode: (mode: "basic" | "custom") => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  selectedMood: string;
  setSelectedMood: (mood: string) => void;
  selectedVibe: string;
  setSelectedVibe: (vibe: string) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  songTitle: string;
  setSongTitle: (title: string) => void;
  instrumentalMode: boolean;
  setInstrumentalMode: (mode: boolean) => void;
  keepPrivate: boolean;
  setKeepPrivate: (isPrivate: boolean) => void;
  bpm: number[];
  setBpm: (bpm: number[]) => void;
  grooveType: string;
  setGrooveType: (type: string) => void;
  leadInstrument: string[];
  setLeadInstrument: (instruments: string[]) => void;
  drumKit: string;
  setDrumKit: (kit: string) => void;
  bassTone: string;
  setBassTone: (tone: string) => void;
  vocalGender: string;
  setVocalGender: (gender: string) => void;
  harmonyPalette: string;
  setHarmonyPalette: (palette: string) => void;
  
  // Lyrics generation
  showLyricsDialog: boolean;
  setShowLyricsDialog: (show: boolean) => void;
  handleGenerateLyrics: () => void;
  isGeneratingLyrics: boolean;
  lyricsPrompt: string;
  setLyricsPrompt: (prompt: string) => void;
  
  // Generation
  isGenerating: boolean;
  handleGenerate: () => void;
  pendingTasksCount: number;
  allGeneratedTracks: any[];
  setAllGeneratedTracks: React.Dispatch<React.SetStateAction<any[]>>;
  generationTimer: number;
}

export const StudioSidebar = (props: StudioSidebarProps) => {
  const {
    sidebarOpen,
    showLibrary,
    selectedLibraryTrack,
    setSidebarOpen,
    setShowLibrary,
    setSelectedLibraryTrack,
    libraryTracks,
    setLibraryTracks,
    isLoadingLibrary,
    isPlaying,
    audioRef,
    onPlayPause,
    mode,
    setMode,
    selectedGenre,
    setSelectedGenre,
    selectedVibe,
    setSelectedVibe,
    customPrompt,
    setCustomPrompt,
    songTitle,
    setSongTitle,
    instrumentalMode,
    setInstrumentalMode,
    keepPrivate,
    setKeepPrivate,
    bpm,
    setBpm,
    grooveType,
    setGrooveType,
    leadInstrument,
    setLeadInstrument,
    drumKit,
    setDrumKit,
    bassTone,
    setBassTone,
    vocalGender,
    setVocalGender,
    harmonyPalette,
    setHarmonyPalette,
    setShowLyricsDialog,
    isGenerating,
    handleGenerate,
    pendingTasksCount,
    allGeneratedTracks,
    setAllGeneratedTracks,
  } = props;

  const [bpmMode, setBpmMode] = React.useState<'slow' | 'moderate' | 'medium' | 'custom'>('slow');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [trackToDelete, setTrackToDelete] = React.useState<any>(null);
  const [generationConfirmOpen, setGenerationConfirmOpen] = React.useState(false);

  // 置顶功能状态
  const [pinnedTracks, setPinnedTracks] = React.useState<Set<string>>(new Set());

  // 置顶功能处理函数
  const handleTogglePin = async (trackId: string) => {
    if (!user) {
      toast.error('Please log in to pin tracks');
      return;
    }

    if (!isAdmin(user.id)) {
      toast.error('Only administrators can pin tracks');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('/api/toggle-track-pin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to toggle pin');
      }

      const result = await response.json();
      
      // 更新本地状态
      setPinnedTracks(prev => {
        const newSet = new Set(prev);
        if (result.isPinned) {
          newSet.add(trackId);
        } else {
          newSet.delete(trackId);
        }
        return newSet;
      });

      toast.success(result.message);
    } catch (error) {
      console.error('Error toggling pin:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to toggle pin');
    }
  };
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;
  const totalItems = libraryTracks.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Calculate paginated tracks
  const paginatedTracks = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return libraryTracks.slice(startIndex, endIndex);
  }, [libraryTracks, currentPage, itemsPerPage]);
  
  // Reset to first page when library tracks change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [libraryTracks.length]);

  // 独立的滚动位置管理
  const [studioScrollPosition, setStudioScrollPosition] = React.useState(0);
  const [libraryScrollPosition, setLibraryScrollPosition] = React.useState(0);

  // 保存Studio滚动位置
  const saveStudioScrollPosition = () => {
    const scrollContainer = document.querySelector('[data-studio-panel="true"]');
    if (scrollContainer) {
      setStudioScrollPosition(scrollContainer.scrollTop);
    }
  };

  // 恢复Studio滚动位置
  const restoreStudioScrollPosition = () => {
    // 使用requestAnimationFrame确保DOM更新后立即设置滚动位置
    requestAnimationFrame(() => {
      const scrollContainer = document.querySelector('[data-studio-panel="true"]');
      if (scrollContainer) {
        scrollContainer.scrollTop = studioScrollPosition;
      }
    });
  };

  // 保存Library滚动位置
  const saveLibraryScrollPosition = () => {
    const scrollContainer = document.querySelector('[data-library-panel="true"]');
    if (scrollContainer) {
      setLibraryScrollPosition(scrollContainer.scrollTop);
    }
  };

  // 恢复Library滚动位置
  const restoreLibraryScrollPosition = () => {
    // 使用requestAnimationFrame确保DOM更新后立即设置滚动位置
    requestAnimationFrame(() => {
      const scrollContainer = document.querySelector('[data-library-panel="true"]');
      if (scrollContainer) {
        scrollContainer.scrollTop = libraryScrollPosition;
      }
    });
  };

  // 监听Studio滚动事件，自动保存位置
  React.useEffect(() => {
    const scrollContainer = document.querySelector('[data-studio-panel="true"]');
    if (scrollContainer && !showLibrary) {
      const handleScroll = () => {
        setStudioScrollPosition(scrollContainer.scrollTop);
      };

      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [showLibrary]);

  // 监听Library滚动事件，自动保存位置
  React.useEffect(() => {
    const scrollContainer = document.querySelector('[data-library-panel="true"]');
    if (scrollContainer && showLibrary) {
      const handleScroll = () => {
        setLibraryScrollPosition(scrollContainer.scrollTop);
      };

      scrollContainer.addEventListener('scroll', handleScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }
  }, [showLibrary]);

  // Authentication state
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false);
  
  // Credits state
  const { credits } = useCredits();
  
  // Handle generate button click with auth and credits check
  const handleGenerateWithAuth = () => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    // 检查积分是否足够（点击后才检查）
    if (credits === null) {
      toast.loading("Loading credits, please wait...");
      return;
    }

    const requiredCredits = mode === 'custom' ? 10 : 7; // Custom Mode需要10积分，Basic Mode需要7积分
    const modelName = mode === 'custom' ? 'V4_5' : 'V3_5';

    if (credits < requiredCredits) {
      // 使用 sonner 显示积分不足提示
      toast.warning(`Insufficient Credits`, {
        description: `Need ${requiredCredits} credits (you have ${credits}). Please wait for daily rewards.`,
      });
      return;
    }
    
    // 立即开始生成
    handleGenerate();
    // 显示生成确认弹窗
    setGenerationConfirmOpen(true);
  };

  // 确认弹窗并跳转到library
  const handleConfirmGeneration = () => {
    setGenerationConfirmOpen(false);
    // 从studio切换到library时，保存studio位置
    saveStudioScrollPosition();
    // 跳转到library
    setShowLibrary(true);
    // 立即恢复library滚动位置
    restoreLibraryScrollPosition();
  };

  return (
    <div className={`transition-all duration-300 ease-in-out bg-muted/30 ${sidebarOpen ? 'w-[32rem]' : 'w-16'} h-full flex`}>
      {/* Always Visible Navigation Tab */}
      <div className="w-16 h-full flex flex-col bg-muted/30">
        <div className="flex flex-col items-center gap-4 p-4">
          {/* Home Button */}
          <SmartTooltip content="🏠 Home" position="right">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="w-12 h-12 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all duration-300 rounded-lg"
            >
              <Link href="/">
                <Image
                  src="/logo.svg"
                  alt="Logo"
                  width={48}
                  height={48}
                  className="h-12 w-12"
                />
              </Link>
            </Button>
          </SmartTooltip>

          {/* Studio Button */}
          <SmartTooltip content="🎵 Studio" position="right">
            <Button
              onClick={() => {
                // 从library切换到studio时，保存library位置
                if (showLibrary) {
                  saveLibraryScrollPosition();
                }
                setShowLibrary(false);
                setSidebarOpen(true);
                // 立即恢复studio滚动位置
                restoreStudioScrollPosition();
              }}
              variant="ghost"
              size="sm"
              className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${sidebarOpen && !showLibrary ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              <Music className="h-5 w-5" />
            </Button>
          </SmartTooltip>

          {/* Library Button */}
          <SmartTooltip content="🎶 Library" position="right">
            <Button
              onClick={() => {
                // 从studio切换到library时，保存studio位置
                if (!showLibrary) {
                  saveStudioScrollPosition();
                }
                setShowLibrary(true);
                setSidebarOpen(true);
                // 立即恢复library滚动位置
                restoreLibraryScrollPosition();
              }}
              variant="ghost"
              size="sm"
              className={`w-12 h-12 flex items-center justify-center hover:bg-muted/50 hover:text-white hover:scale-110 transition-all duration-300 rounded-lg ${sidebarOpen && showLibrary ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
              ) : (
                <Library className="h-5 w-5" />
              )}
            </Button>
          </SmartTooltip>
        </div>

        {/* User Avatar or Sign In Button - Fixed at bottom */}
        <div className="mt-auto mb-4 flex justify-center">
          {user ? (
            // Show user's actual avatar when logged in
            <SmartTooltip 
              content={
                <div className="flex items-center space-x-2">
                  <span className="text-sm">⚡️</span>
                  <div className="text-sm font-medium text-white">
                    {credits !== null ? credits.toLocaleString() : 'Loading...'}
                  </div>
                </div>
              } 
              position="right"
            >
              <Avatar className="w-10 h-10 cursor-pointer hover:scale-110 transition-all duration-300 border-2 border-transparent hover:border-white/20">
                <AvatarImage 
                  src={user.user_metadata?.avatar_url || user.user_metadata?.picture} 
                  alt="User Avatar"
                />
                <AvatarFallback className="bg-gradient-to-br from-purple-400 to-purple-600 text-white font-semibold text-sm">
                  {user.user_metadata?.full_name?.charAt(0)?.toUpperCase() || 
                   user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </SmartTooltip>
          ) : (
            // Show Sign In button when not logged in
            <SmartTooltip content="🔐 Sign In to access all features" position="right">
              <Button
                onClick={() => setIsAuthModalOpen(true)}
                size="sm"
                className="w-10 h-10 p-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full hover:scale-110 transition-all duration-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </Button>
            </SmartTooltip>
          )}
        </div>
      </div>

      {/* Right Panel Content */}
      {sidebarOpen && (
        <div className="flex-1 flex flex-col h-full relative">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {showLibrary ? (
                  <Library className="h-8 w-8 text-primary" />
                ) : (
                  <Music className="h-8 w-8 text-primary" />
                )}
                <h2 className="text-4xl font-semibold">{showLibrary ? "Library" : "Studio"}</h2>
              </div>

              {/* 收起按钮 - 简单精致 */}
              <Button
                onClick={() => {
                  setSidebarOpen(false);
                  setShowLibrary(false);
                }}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/20 rounded-lg transition-all duration-200"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6 relative" data-studio-panel={!showLibrary ? true : undefined} data-library-panel={showLibrary ? true : undefined}>
            {/* Library Content */}
            {showLibrary && (
              <div className="space-y-3 pt-4">
                {/* Generated Tracks */}
                {allGeneratedTracks.length > 0 && (
                  <div className="space-y-3">
                    {allGeneratedTracks.map((track, index) => (
                      <div
                        key={`generated-${index}`}
                        onClick={track.isLoading || track.isError ? undefined : () => setSelectedLibraryTrack(`generated-${index}`)}
                        className={`flex items-center gap-4 p-4 transition-all duration-300 group relative bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl border border-border/30 shadow-lg ${
                          track.isLoading || track.isError
                            ? 'cursor-default'
                            : `cursor-pointer hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl ${selectedLibraryTrack === `generated-${index}`
                              ? 'shadow-xl'
                              : 'hover:shadow-2xl'
                            }`
                          } ${track.isError ? 'border-red-500/30' : ''}`}
                      >
                        {/* Loading 状态显示遮罩和 Progress indicators */}
                        {track.isLoading && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none z-10">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                              <div className="w-3 h-3 bg-white/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                              <div className="w-3 h-3 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                            </div>
                          </div>
                        )}
                        
                        {/* 选中状态遮罩 */}
                        {selectedLibraryTrack === `generated-${index}` && !track.isLoading && (
                          <div className="absolute inset-0 bg-primary/10 rounded-3xl pointer-events-none z-5"></div>
                        )}
                        <div className={`w-16 h-16 rounded-md overflow-hidden flex-shrink-0 relative transition-transform duration-300 ${!track.isLoading && !track.isError ? 'group-hover:scale-105' : ''}`}>
                          {track.isError ? (
                            // 错误状态直接显示logo图片作为封面
                            <Image
                              src="/logo.svg"
                              alt="Error"
                              width={64}
                              height={64}
                              className="w-full h-full object-cover transition-all duration-300"
                            />
                          ) : track.coverImage ? (
                            <Image
                              src={track.coverImage}
                              alt={track.title}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover transition-all duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center transition-all duration-300">
                              <Music className="h-6 w-6 text-primary" />
                            </div>
                          )}
                          
                          {/* 封面交互层 */}
                          {!track.isLoading && !track.isError && (
                            <div className="absolute inset-0">
                              {/* 播放时音波效果 */}
                              {selectedLibraryTrack === `generated-${index}` && isPlaying && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                                  <div className="flex items-end gap-0.5">
                                    <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-0.5 h-3 bg-white animate-pulse" style={{ animationDelay: '100ms' }}></div>
                                    <div className="w-0.5 h-1.5 bg-white animate-pulse" style={{ animationDelay: '200ms' }}></div>
                                    <div className="w-0.5 h-4 bg-white animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                    <div className="w-0.5 h-2.5 bg-white animate-pulse" style={{ animationDelay: '400ms' }}></div>
                                    <div className="w-0.5 h-3.5 bg-white animate-pulse" style={{ animationDelay: '500ms' }}></div>
                                    <div className="w-0.5 h-1 bg-white animate-pulse" style={{ animationDelay: '600ms' }}></div>
                                    <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '700ms' }}></div>
                                  </div>
                                </div>
                              )}

                              {/* 悬停按钮层 */}
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {selectedLibraryTrack === `generated-${index}` && isPlaying ? (
                                  // 播放中显示暂停按钮
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('暂停按钮被点击');
                                      if (onPlayPause) {
                                        onPlayPause();
                                      }
                                    }}
                                    className="w-8 h-8 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                                  >
                                    <Pause className="w-4 h-4" />
                                  </button>
                                ) : (
                                  // 暂停中显示播放按钮
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('播放按钮被点击');
                                      setSelectedLibraryTrack(`generated-${index}`);
                                      if (onPlayPause) {
                                        onPlayPause();
                                      }
                                    }}
                                    className="w-8 h-8 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                                  >
                                    <Play className="w-4 h-4 ml-0.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 w-0">
                          <div className={`font-medium text-base transition-colors flex items-center gap-2 ${
                            track.isError
                              ? 'text-red-400'
                              : selectedLibraryTrack === `generated-${index}`
                                ? 'text-primary'
                                : track.isLoading ? '' : 'group-hover:text-primary'
                            }`}>
                            <span className="flex-1 truncate">
                              {track.isError ? (track.originalPrompt || track.title || 'Unknown') : (track.title || 'Unknown')}
                            </span>
                            {track.duration && track.duration > 0 && !track.isLoading && !track.isGenerating && !track.isError && (
                              <span className="text-xs text-muted-foreground">
                                {Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}
                              </span>
                            )}
                          </div>
                          {track.isError ? (
                            <div className="text-xs text-muted-foreground mt-1 leading-relaxed w-full" style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {track.errorMessage || 'Generation failed'}
                            </div>
                          ) : (
                            <div className="text-xs mt-1 leading-relaxed w-full text-muted-foreground" style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {track.tags || `${track.style}, ${track.mood}`}
                            </div>
                          )}
                          
                          {/* 操作按钮 - 只在非loading状态显示 */}
                          {!track.isLoading && (
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                {/* 只有非错误状态才显示下载按钮 */}
                                {!track.isError && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // 下载逻辑
                                    }}
                                    className="p-1 hover:bg-muted/50 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                                    title="下载"
                                  >
                                    <Download className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors duration-200" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('Delete button clicked for track:', track);
                                    setTrackToDelete(track);
                                    setDeleteDialogOpen(true);
                                  }}
                                  className="p-1 hover:bg-muted/50 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                                  title="删除"
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive transition-colors duration-200" />
                                </button>
                              </div>
                              {/* Side A/B Badge - 右侧对齐，错误状态不显示 */}
                              {track.sideLetter && !track.isError && (
                                <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-muted-foreground rounded border border-border shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-200">
                                  {track.sideLetter}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Skeleton Loading State - 在生成过程中显示 */}
                {pendingTasksCount > 0 && (
                  <div className="space-y-3">
                    {Array.from({ length: pendingTasksCount }).map((_, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl backdrop-blur-md border border-border/30 shadow-lg">
                        <Skeleton className="w-16 h-16 rounded-md flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-4 w-8" />
                          </div>
                          <Skeleton className="h-3 w-2/3" />
                          {/* 操作按钮骨架 */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-6 w-6 rounded" />
                              <Skeleton className="h-6 w-6 rounded" />
                            </div>
                            {/* Side Letter Badge 骨架 */}
                            <Skeleton className="h-4 w-4 rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Library List */}
                <div className="space-y-3">
                  {/* Loading状态 */}
                  {isLoadingLibrary ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                      <p>Loading your library...</p>
                    </div>
                  ) : (
                    /* 只有在没有skeleton和没有生成的tracks时才显示空状态 */
                    libraryTracks.length === 0 && allGeneratedTracks.length === 0 && pendingTasksCount === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Music className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Your library is empty</p>
                      </div>
                    ) : (
                      paginatedTracks.map((track) => {
                        const isCurrentlyPlaying = selectedLibraryTrack === track.id && isPlaying;

                        return (
                          <div
                            key={track.id}
                            onClick={track.isError ? undefined : () => setSelectedLibraryTrack(track.id)}
                            className={`flex items-center gap-4 p-4 transition-all duration-300 group relative bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl backdrop-blur-md border border-border/30 shadow-lg ${
                              track.isError 
                                ? 'cursor-default' 
                                : 'cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]'
                            } ${selectedLibraryTrack === track.id
                              ? 'shadow-xl'
                              : 'hover:shadow-2xl'
                              }`}
                          >
                            {/* 选中状态遮罩 */}
                            {selectedLibraryTrack === track.id && (
                              <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-3xl pointer-events-none z-5"></div>
                            )}

                            <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-muted/20 relative z-10 group-hover:scale-105 transition-transform duration-300">
                              {track.coverUrl ? (
                                <Image
                                  src={track.coverUrl}
                                  alt={track.title || 'Music Track'}
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : track.isError ? (
                                // 错误状态直接显示logo图片作为封面
                                <Image
                                  src="/logo.svg"
                                  alt="Error"
                                  width={64}
                                  height={64}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                                  <Music className="h-6 w-6 text-white" />
                                </div>
                              )}
                              
                              {/* 封面交互层 */}
                              <div className="absolute inset-0">
                                {/* 播放时音波效果 */}
                                {selectedLibraryTrack === track.id && isPlaying && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:opacity-0 transition-opacity duration-300">
                                    <div className="flex items-end gap-0.5">
                                      <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                      <div className="w-0.5 h-3 bg-white animate-pulse" style={{ animationDelay: '100ms' }}></div>
                                      <div className="w-0.5 h-1.5 bg-white animate-pulse" style={{ animationDelay: '200ms' }}></div>
                                      <div className="w-0.5 h-4 bg-white animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                      <div className="w-0.5 h-2.5 bg-white animate-pulse" style={{ animationDelay: '400ms' }}></div>
                                      <div className="w-0.5 h-3.5 bg-white animate-pulse" style={{ animationDelay: '500ms' }}></div>
                                      <div className="w-0.5 h-1 bg-white animate-pulse" style={{ animationDelay: '600ms' }}></div>
                                      <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '700ms' }}></div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* 悬停按钮层 - 错误状态不显示播放按钮 */}
                                {!track.isError && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    {selectedLibraryTrack === track.id && isPlaying ? (
                                      // 播放中显示暂停按钮
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('库歌曲暂停按钮被点击');
                                          if (onPlayPause) {
                                            onPlayPause();
                                          }
                                        }}
                                        className="w-8 h-8 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                                      >
                                        <Pause className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      // 暂停中显示播放按钮
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          console.log('库歌曲播放按钮被点击');
                                          setSelectedLibraryTrack(track.id);
                                          if (onPlayPause) {
                                            onPlayPause();
                                          }
                                        }}
                                        className="w-8 h-8 text-white flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
                                      >
                                        <Play className="w-4 h-4 ml-0.5" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 w-0 relative z-10">
                              <div className={`font-medium text-base transition-colors flex items-center gap-2 ${selectedLibraryTrack === track.id
                                ? 'text-primary'
                                : 'group-hover:text-primary'
                                }`}>
                                <span className="flex-1">
                                  {track.isError ? (track.originalPrompt || track.title || 'Untitled Track') : (track.title || 'Untitled Track')}
                                </span>
                                {/* Duration 显示 - 错误状态不显示duration */}
                                {!track.isError && track.duration && track.duration > 0 && (
                                  <span className={`text-xs ${track.isGenerating
                                      ? 'text-primary animate-pulse'
                                      : 'text-muted-foreground'
                                    }`}>
                                    {Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              {/* Tags 行 */}
                              <div className="text-xs text-muted-foreground mt-1 leading-relaxed w-full" style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {track.isError ? (track.errorMessage || 'Generation failed') : track.style}
                              </div>

                              {/* 操作按钮行 */}
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-2">
                                  {/* 置顶按钮 - 仅管理员可见 */}
                                  {user && isAdmin(user.id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePin(track.id);
                                      }}
                                      className={`p-1 hover:bg-muted/50 rounded transition-all duration-200 hover:scale-110 active:scale-95 ${
                                        pinnedTracks.has(track.id) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                                      }`}
                                      title={pinnedTracks.has(track.id) ? '取消置顶' : '置顶到探索页面'}
                                    >
                                      {pinnedTracks.has(track.id) ? (
                                        <PinOff className="h-3 w-3" />
                                      ) : (
                                        <Pin className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}
                                  {/* 只有非错误状态才显示下载按钮 */}
                                  {!track.isError && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (track.audioUrl) {
                                          const link = document.createElement('a');
                                          link.href = track.audioUrl;
                                          link.download = `${track.title || 'track'}.mp3`;
                                          document.body.appendChild(link);
                                          link.click();
                                          document.body.removeChild(link);
                                        }
                                      }}
                                      className="p-1 hover:bg-muted/50 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                                      title="下载"
                                    >
                                      <Download className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors duration-200" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Delete button clicked for library track:', track);
                                      setTrackToDelete(track);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="p-1 hover:bg-muted/50 rounded transition-all duration-200 hover:scale-110 active:scale-95"
                                    title="删除"
                                  >
                                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive transition-colors duration-200" />
                                  </button>
                                </div>
                                {/* Side A/B Badge - 右侧对齐 */}
                                {track.sideLetter && (
                                  <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-muted-foreground rounded border border-border shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-200">
                                    {track.sideLetter}
                                  </span>
                                )}
                              </div>

                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>

                {/* Library Pagination - Bottom */}
                {showLibrary && libraryTracks.length > 0 && (
                  <div className="sticky bottom-0 mt-8 z-50">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl backdrop-blur-md border border-border/30 shadow-lg">
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        title="Previous Page"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      {/* Page Info */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-foreground">
                          {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)}
                        </span>
                        <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                        <span className="text-muted-foreground">
                          <span className="font-semibold">total</span> {totalItems}
                        </span>
                      </div>

                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        title="Next Page"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Studio Content */}
            {!showLibrary && (
              <>
                {/* Mode Tabs - Internal at top */}
                <div className="mb-6 mt-4">
                  <div className="bg-muted/30 rounded-xl p-1">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setMode("basic")}
                        title="Create random R&B songs with polished production in 90s style. Simple and fast setup."
                        className={`py-2 px-4 text-sm font-medium transition-all duration-200 rounded-lg ${mode === "basic"
                            ? "bg-primary/20 border-transparent text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                      >
                        Basic Mode
                      </button>
                      <button
                        onClick={() => setMode("custom")}
                        title="Fine-tune every aspect of your track with detailed controls for genre, instruments, and style."
                        className={`py-2 px-4 text-sm font-medium transition-all duration-200 rounded-lg ${mode === "custom"
                            ? "bg-primary/20 border-transparent text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          }`}
                      >
                        Custom Mode
                      </button>
                    </div>
                  </div>
                </div>



                {/* Mode Content */}
                {mode === "basic" ? (
                  <>
                    {/* Basic Mode Content - 流式布局 */}
                    <div className="space-y-6">
                      {/* Basic Settings Section */}
                      <section className="pb-4 border-b border-border/20">

                        {/* Instrumental Mode */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between py-3">
                            <div className="flex-1">
                              <div className="font-medium text-foreground">
                                Instrumental Mode
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                {instrumentalMode
                                  ? "Without lyrics"
                                  : "Include lyrics"
                                }
                              </div>
                            </div>
                            <div className="ml-4">
                              <Switch
                                checked={instrumentalMode}
                                onCheckedChange={setInstrumentalMode}
                              />
                            </div>
                          </div>
                        </div>
                      </section>





                      {/* Custom Prompt Section */}
                      <section className="pb-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          Prompt
                          <span className="text-white text-sm">*</span>
                          <div className="group relative">
                            <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg cursor-help">
                              💡
                            </div>
                            <div className="absolute left-0 top-full mt-1 p-3 bg-gradient-to-r from-card/95 via-card/90 to-card/95 backdrop-blur-md text-foreground text-xs rounded-lg border border-border/30 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64">
                              describe your desired themes of the song
                            </div>
                          </div>
                        </h3>
                        <div className="space-y-1">
                          <div className="relative">
                            <Textarea
                              placeholder="describe your desired themes of the song"
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              maxLength={400}
                              className="min-h-[120px] resize-none pr-16 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                              {customPrompt.length}/400
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Keep Private Section - Basic Mode */}
                      <section className="pb-3 border-b border-border/20">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              Private
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {keepPrivate
                                ? "Your song will be private"
                                : "Your song will be visible to other users"
                              }
                            </div>
                          </div>
                          <div className="ml-4">
                            <Switch
                              checked={keepPrivate}
                              onCheckedChange={setKeepPrivate}
                            />
                          </div>
                        </div>
                      </section>

                    </div>
                  </>
                ) : (
                  <>
                    {/* Tune Mode Content - 流式布局 */}
                    <div className="space-y-6">
                      {/* Basic Settings Section */}
                      <section className="pb-4 border-b border-border/20">
                        {/* Instrumental Mode */}
                        <div className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-foreground">
                              Instrumental Mode
                            </div>
                            <Switch
                              checked={instrumentalMode}
                              onCheckedChange={setInstrumentalMode}
                            />
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {instrumentalMode
                              ? "Without lyrics"
                              : "Include lyrics"
                            }
                          </div>
                        </div>

                        {/* Vocal Gender - Only show when not in instrumental mode */}
                        {!instrumentalMode && (
                          <div className="mt-3 flex items-center justify-between">
                            <Label className="text-sm font-medium text-foreground">Vocal Gender</Label>
                            <div className="bg-muted/30 rounded-xl p-1">
                              <div className="flex gap-1">
                                {vocalGenders.map((gender: any) => (
                                  <button
                                    key={gender.id}
                                    onClick={() => setVocalGender(gender.id)}
                                    className={`py-1.5 px-3 text-xs font-medium transition-all duration-200 rounded-lg ${vocalGender === gender.id
                                        ? "bg-primary/20 border-transparent text-primary shadow-sm"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                      }`}
                                  >
                                    {gender.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Song Title Section */}
                      <section className="pb-4 border-b border-border/20">
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          Title
                          <span className="text-white text-sm">*</span>
                        </h3>
                        <div className="space-y-3">
                          <div className="relative">
                            <Textarea
                              placeholder="Enter your song title..."
                              value={songTitle}
                              onChange={(e) => setSongTitle(e.target.value)}
                              maxLength={80}
                              className="min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            />
                            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                              {songTitle.length}/80
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Style & Vibe Section */}
                      <section className="pb-4 border-b border-border/20">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            Style & Vibe
                            <span className="text-white text-sm">*</span>
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedGenre("");
                              setSelectedVibe("");
                              setGrooveType("");
                              setBpm([60]);
                            }}
                            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-all duration-200"
                          >
                            Reset
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {/* Style Options - 圆角标签样式 */}
                          <div className="grid grid-cols-3 gap-3">


                            {/* Genre Selection */}
                            <div className="relative">
                              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                                <SelectTrigger className={`w-full px-4 py-2 h-auto font-medium rounded-xl transition-all duration-200 border-0 focus:ring-0 focus:ring-offset-0 ${selectedGenre
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                  }`}>
                                  <SelectValue placeholder="Genre">
                                    {selectedGenre && (
                                      <span className="font-medium">
                                        {genres.find((g: any) => g.id === selectedGenre)?.name}
                                      </span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {genres.map((genre: any) => (
                                    <SelectItem key={genre.id} value={genre.id} className="py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="text-left">
                                          <div className="font-medium text-left">{genre.name}</div>
                                          <div className="text-sm text-muted-foreground text-left">{genre.description}</div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Vibe Selection */}
                            <div className="relative">
                              <Select value={selectedVibe} onValueChange={setSelectedVibe}>
                                <SelectTrigger className={`w-full px-4 py-2 h-auto font-medium rounded-xl transition-all duration-200 border-0 focus:ring-0 focus:ring-offset-0 ${selectedVibe
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                  }`}>
                                  <SelectValue placeholder="Vibe">
                                    {selectedVibe && (
                                      <span className="font-medium">
                                        {vibes.find((v: any) => v.id === selectedVibe)?.name}
                                      </span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {vibes.map((vibe: any) => (
                                    <SelectItem key={vibe.id} value={vibe.id} className="py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="text-left">
                                          <div className="font-medium text-left">{vibe.name}</div>
                                          <div className="text-sm text-muted-foreground text-left">{vibe.description}</div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Groove Type */}
                            <div className="relative">
                              <Select value={grooveType} onValueChange={setGrooveType}>
                                <SelectTrigger className={`w-full px-4 py-2 h-auto font-medium rounded-xl transition-all duration-200 border-0 focus:ring-0 focus:ring-offset-0 ${grooveType
                                    ? 'bg-green-500 text-white hover:bg-green-600'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                                  }`}>
                                  <SelectValue placeholder="Groove">
                                    {grooveType && (
                                      <span className="font-medium">
                                        {grooveTypes.find((t: any) => t.id === grooveType)?.name}
                                      </span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {grooveTypes.map((type: any) => (
                                    <SelectItem key={type.id} value={type.id} className="py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="text-left">
                                          <div className="font-medium text-left">{type.name}</div>
                                          <div className="text-sm text-muted-foreground text-left">{type.description}</div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* BPM Selection */}
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => {
                                  setBpm([60]); // 60-80 的起始值
                                  setBpmMode('slow');
                                }}
                                className={getOptionButtonClasses(bpmMode === 'slow', 'vertical')}
                              >
                                <div className="font-medium">Slow</div>
                                <div className="text-xs text-muted-foreground">60-80 BPM</div>
                              </button>

                              <button
                                onClick={() => {
                                  setBpm([90]); // 80-100 的中间值
                                  setBpmMode('moderate');
                                }}
                                className={getOptionButtonClasses(bpmMode === 'moderate', 'vertical')}
                              >
                                <div className="font-medium">Moderate</div>
                                <div className="text-xs text-muted-foreground">80-100 BPM</div>
                              </button>

                              <button
                                onClick={() => {
                                  setBpm([110]); // 100-120 的中间值
                                  setBpmMode('medium');
                                }}
                                className={getOptionButtonClasses(bpmMode === 'medium', 'vertical')}
                              >
                                <div className="font-medium">Medium</div>
                                <div className="text-xs text-muted-foreground">100-120 BPM</div>
                              </button>

                              <button
                                onClick={() => {
                                  setBpmMode('custom');
                                }}
                                className={getOptionButtonClasses(bpmMode === 'custom', 'vertical')}
                              >
                                <div className="font-medium">Custom</div>
                                <div className="text-xs text-muted-foreground">Manual input</div>
                              </button>
                            </div>

                            {/* Custom BPM Input - Only show when custom is selected */}
                            {bpmMode === 'custom' && (
                              <div className="space-y-3 pt-2 border-t border-border/20">
                                <div className="flex items-center gap-3">
                                  <SmartTooltip content={bpm[0] <= 60 ? "⚠️ Minimum BPM is 60" : "⬇️ Decrease BPM"} position="top">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setBpm([Math.max(60, bpm[0] - 0.5)])}
                                      disabled={bpm[0] <= 60}
                                      className="h-10 w-10 p-0 rounded-lg border-input/50 hover:border-input hover:bg-muted/20 transition-all duration-200"
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                  </SmartTooltip>

                                  <div className="flex-1 relative">
                                    <input
                                      type="number"
                                      value={bpm[0]}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                          setBpm([60]);
                                        } else {
                                          const numValue = parseFloat(value);
                                          if (!isNaN(numValue)) {
                                            setBpm([numValue]);
                                          }
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const value = parseFloat(e.target.value);
                                        if (isNaN(value) || value < 60) {
                                          setBpm([60]);
                                        } else if (value > 120) {
                                          setBpm([120]);
                                        }
                                      }}
                                      min="60"
                                      max="120"
                                      step="0.5"
                                      className="w-full h-10 pr-12 text-center text-sm border border-input/50 bg-background/50 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                                      BPM
                                    </div>
                                  </div>

                                  <SmartTooltip content={bpm[0] >= 120 ? "⚠️ Maximum BPM is 120" : "⬆️ Increase BPM"} position="top">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setBpm([Math.min(120, bpm[0] + 0.5)])}
                                      disabled={bpm[0] >= 120}
                                      className="h-10 w-10 p-0 rounded-lg border-input/50 hover:border-input hover:bg-muted/20 transition-all duration-200"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </SmartTooltip>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </section>

                      {/* Arrangement Section */}
                      <section className="pb-4 border-b border-border/20">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">
                            Arrangement & Performance
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLeadInstrument([]);
                              setDrumKit("");
                              setBassTone("");
                              setHarmonyPalette("");
                            }}
                            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-all duration-200"
                          >
                            Reset
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {/* Lead Instrument */}
                          <div className="space-y-3">
                            <Select value={leadInstrument.join(',')} onValueChange={(value) => {
                              const selectedIds = value.split(',').filter(Boolean);
                              setLeadInstrument(selectedIds);
                            }}>
                              <SelectTrigger className={`cursor-pointer border-0 focus:ring-0 focus:ring-offset-0 ${leadInstrument.length > 0 ? "" : "text-muted-foreground"}`}>
                                <SelectValue placeholder="Lead Instrument">
                                  {leadInstrument.length > 0 ? (
                                    <div className="flex items-center gap-1 max-w-full">
                                      {leadInstrument.map((id, index) => (
                                        <span key={id} className="font-medium">
                                          {leadInstruments.find((i: any) => i.id === id)?.name}
                                          {index < leadInstrument.length - 1 && ", "}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">Select up to 2 instruments</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="w-full">
                                <div className="p-2 space-y-2">
                                  {leadInstruments.map((instrument: any) => {
                                    const isSelected = leadInstrument.includes(instrument.id);
                                    const isDisabled = !isSelected && leadInstrument.length >= 2;

                                    return (
                                      <div
                                        key={instrument.id}
                                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected
                                          ? 'bg-primary/10 border border-primary/20'
                                          : isDisabled
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-muted'
                                          }`}
                                        onClick={() => {
                                          if (isDisabled) return;
                                          if (isSelected) {
                                            setLeadInstrument(leadInstrument.filter((id: string) => id !== instrument.id));
                                          } else {
                                            setLeadInstrument([...leadInstrument, instrument.id]);
                                          }
                                        }}
                                      >
                                        <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${isSelected
                                          ? 'bg-primary border-primary'
                                          : 'border-muted-foreground'
                                          }`}>
                                          {isSelected && (
                                            <div className="w-2 h-2 bg-white rounded-sm" />
                                          )}
                                        </div>
                                        <div className="flex-1 text-left">
                                          <div className="font-medium">{instrument.name}</div>
                                          <div className="text-sm text-muted-foreground">{instrument.description}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {leadInstrument.length > 0 && (
                                  <div className="p-2 border-t">
                                    <button
                                      onClick={() => setLeadInstrument([])}
                                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                      Clear selection
                                    </button>
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Drum Kit & Bass Tone */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex-1">
                              <Select value={drumKit} onValueChange={setDrumKit}>
                                <SelectTrigger className={`border-0 focus:ring-0 focus:ring-offset-0 ${drumKit ? "" : "text-muted-foreground"}`}>
                                  <SelectValue placeholder="Drum Kit">
                                    {drumKit && (
                                      <span className="font-medium">
                                        {drumKits.find((k: any) => k.id === drumKit)?.name}
                                      </span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {drumKits.map((kit: any) => (
                                    <SelectItem key={kit.id} value={kit.id} className="py-3">
                                      <div className="flex items-center gap-3">
                                        <div className="text-left">
                                          <div className="font-medium text-left">{kit.name}</div>
                                          <div className="text-sm text-muted-foreground text-left">{kit.description}</div>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex-1">
                              <Select value={bassTone} onValueChange={setBassTone}>
                                <SelectTrigger className={`border-0 focus:ring-0 focus:ring-offset-0 ${bassTone ? "" : "text-muted-foreground"}`}>
                                  <SelectValue placeholder="Bass Tone">
                                    {bassTone && (
                                      <span className="font-medium">
                                        {bassTones.find((t: any) => t.id === bassTone)?.name}
                                      </span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {bassTones.map((tone: any) => (
                                    <SelectItem key={tone.id} value={tone.id} className="py-3">
                                      <div className="text-left">
                                        <div className="font-medium text-left">{tone.name}</div>
                                        <div className="text-sm text-muted-foreground text-left">{tone.description}</div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Harmony Palette */}
                          <div className="space-y-3">
                            <Select value={harmonyPalette} onValueChange={setHarmonyPalette}>
                              <SelectTrigger className={`border-0 focus:ring-0 focus:ring-offset-0 ${harmonyPalette ? "" : "text-muted-foreground"}`}>
                                <SelectValue placeholder="Harmony Palette">
                                  {harmonyPalette && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-lg">
                                        {harmonyPalettes.find((p: any) => p.id === harmonyPalette)?.emoji}
                                      </span>
                                      <span className="text-sm font-medium">
                                        {harmonyPalettes.find((p: any) => p.id === harmonyPalette)?.name}
                                      </span>
                                    </div>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {harmonyPalettes.map((palette: any) => (
                                  <SelectItem key={palette.id} value={palette.id} className="py-3">
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg">
                                        {palette.emoji}
                                      </span>
                                      <div className="text-left">
                                        <div className="font-medium text-left">{palette.name}</div>
                                        <div className="text-sm text-muted-foreground text-left">{palette.description}</div>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </section>

                      {/* Lyrics Section */}
                      {!instrumentalMode && (
                        <section className="pb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                              Lyrics
                              <span className="text-white text-sm">*</span>
                            </h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowLyricsDialog(true)}
                              className="h-6 px-2 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                              title="Generate lyrics with AI"
                            >
                              <Sparkles className="h-3 w-3" />
                              <span className="text-xs font-medium">Generate with AI</span>
                            </Button>
                          </div>
                          <div className="space-y-3">
                            <div className="relative">
                              <Textarea
                                placeholder="Write your song lyrics here..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                maxLength={5000}
                                className="min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                              {/* Character count - Inside textarea, bottom right */}
                              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                                {customPrompt.length}/5000
                              </div>
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Keep Private Section - Custom Mode */}
                      <section className="pb-3 border-b border-border/20">
                        <div className="flex items-center justify-between py-2">
                          <div className="flex-1">
                            <div className="font-medium text-foreground">
                              Private
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {keepPrivate
                                ? "Your song will be private"
                                : "Your song will be visible to other users"
                              }
                            </div>
                          </div>
                          <div className="ml-4">
                            <Switch
                              checked={keepPrivate}
                              onCheckedChange={setKeepPrivate}
                            />
                          </div>
                        </div>
                      </section>

                    </div>
                  </>
                )}
              </>
            )}

            {/* Generate Button - Bottom of Panel */}
            {!showLibrary && (
              <div className="mt-8">
                {(() => {
                  // 只根据prompt输入内容来禁用按钮，积分检查移到点击后
                  let isDisabled = isGenerating;

                  if (mode === 'basic') {
                    // Basic Mode: 只需要prompt字段
                    isDisabled = isDisabled || !customPrompt.trim();
                  } else {
                    // Custom Mode: 根据instrumental模式确定required字段
                    if (instrumentalMode) {
                      // instrumental: true - style和title是required
                      isDisabled = isDisabled || !selectedGenre || !selectedVibe || !songTitle.trim();
                    } else {
                      // instrumental: false - style, prompt(lyrics), title是required
                      isDisabled = isDisabled || !selectedGenre || !selectedVibe || !songTitle.trim() || !customPrompt.trim();
                    }
                  }
                  
                  return (
                    <button
                      onClick={() => {
                        handleGenerateWithAuth();
                      }}
                      disabled={isDisabled}
                      className="w-full h-16 px-6 text-base font-semibold bg-primary border-transparent text-white shadow-sm hover:bg-primary/80 hover:text-white disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] rounded-3xl relative overflow-hidden"
                    >
                      {/* 光效动画 - 只在可点击状态显示 */}
                      {!isDisabled && (
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine"></div>
                      )}
                      {isGenerating ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Creating...</span>
                        </div>
                      ) : (
                        'Generate Track'
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{trackToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!trackToDelete) return;

                try {
                  // 检查是否是失败的生成tracks或library中的错误tracks
                  if (trackToDelete.isError) {
                    // 检查是否是allGeneratedTracks中的失败track
                    const generatedTrackIndex = allGeneratedTracks.findIndex(track => track.id === trackToDelete.id);
                    if (generatedTrackIndex !== -1) {
                      // 从allGeneratedTracks中移除
                      setAllGeneratedTracks((prev: any[]) =>
                        prev.filter((track: any) => track.id !== trackToDelete.id)
                      );

                      // 如果删除的是当前选中的歌曲，清除选择
                      if (selectedLibraryTrack === `generated-${generatedTrackIndex}`) {
                        setSelectedLibraryTrack(null);
                        if (audioRef.current) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                        }
                      }
                    } else {
                      // 对于错误状态的歌曲，调用软删除API
                      console.log('Calling soft delete API for id:', trackToDelete.id);
                      
                      // 获取 Supabase session token
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.access_token) {
                        throw new Error('No valid session found');
                      }
                      
                      const response = await fetch(`/api/delete-music-generation?id=${trackToDelete.id}`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${session.access_token}`,
                          'Content-Type': 'application/json',
                        },
                      });

                      console.log('Delete API response:', response.status, response.statusText);
                      
                      if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Delete API error:', errorText);
                        throw new Error(`Failed to delete music generation: ${errorText}`);
                      }
                      
                      const responseData = await response.json();
                      console.log('Delete API success response:', responseData);

                      // 从libraryTracks中移除错误的track
                      setLibraryTracks((prev: any[]) => prev.filter((track: any) => track.id !== trackToDelete.id));

                      // 如果删除的是当前播放的歌曲，停止播放
                      if (selectedLibraryTrack === trackToDelete.id) {
                        setSelectedLibraryTrack(null);
                        if (audioRef.current) {
                          audioRef.current.pause();
                          audioRef.current.currentTime = 0;
                        }
                      }
                    }
                  } else {
                    // 正常的tracks调用删除API
                    const response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
                      method: 'DELETE',
                    });

                    if (!response.ok) {
                      throw new Error('Failed to delete track');
                    }

                    // 从本地状态中移除
                    setLibraryTracks((prev: any[]) => prev.filter((track: any) => track.id !== trackToDelete.id));

                    // 如果删除的是当前播放的歌曲，停止播放
                    if (selectedLibraryTrack === trackToDelete.id) {
                      setSelectedLibraryTrack(null);
                      if (audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                      }
                    }
                  }
                } catch (error) {
                  console.error('Failed to delete track:', error);
                } finally {
                  setDeleteDialogOpen(false);
                  setTrackToDelete(null);
                }
              }}
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
