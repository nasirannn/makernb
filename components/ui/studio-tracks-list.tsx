"use client";

import React, { useState, useCallback } from 'react';
import { Music, Search, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LoadingState } from './loading-dots';
import { supabase } from "@/lib/supabase";
import { toast } from 'sonner';
import { LibraryTrack } from '@/types/track';
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { VocalRemovalProgressDialog } from './vocal-removal-progress-dialog';
import { CLIENT_VOCAL_SEPARATION_CREDITS } from '@/lib/credits-config';
import { useVocalRemovalManager } from '@/hooks/use-vocal-removal-manager';
import { TrackItem } from './track-item';
import { formatDuration, formatDurationInMinutes } from '@/lib/format-utils';

interface MusicGeneration {
  id: string;
  title: string;
  genre: string;
  tags: string;
  prompt: string;
  isInstrumental: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  lyricsContent?: string;
  allTracks: LibraryTrack[];
  totalDuration: number;
  errorInfo?: any;
}

interface StudioTracksListProps {
  userTracks: MusicGeneration[];
  isLoading: boolean;
  onTrackSelect?: (trackId: string) => void;
  onTrackPlay?: (track: LibraryTrack, music: MusicGeneration) => void;
  selectedTrack?: string | null;
  generatedTracks?: any[];
  onGeneratedTrackSelect?: (trackId: string) => void;
  onDownload?: (track: LibraryTrack, music: MusicGeneration, format?: 'mp3' | 'wav') => void;
  onFavoriteToggle?: (track: LibraryTrack, music: MusicGeneration) => void;
  onDelete?: (track: LibraryTrack, music: MusicGeneration) => void;
  onPublishToggle?: (trackId: string, isPublished: boolean) => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  hasPlayer?: boolean;
}

export const StudioTracksList: React.FC<StudioTracksListProps> = React.memo(function StudioTracksList({
  userTracks,
  isLoading,
  onTrackSelect,
  onTrackPlay,
  selectedTrack,
  generatedTracks = [],
  onGeneratedTrackSelect,
  onDownload,
  onFavoriteToggle,
  onDelete,
  onPublishToggle,
  onEditTitle,
  hasPlayer = false,
}) {
  
  const { openModal: openPricingModal } = usePricingModal();
  const globalAudioState = useAudioPlayingState();
  const { hasPermission } = useFeaturePermissions();
  
  // 权限检查
  const canDownloadMP3 = hasPermission('download_mp3_track');
  const canDownloadWAV = hasPermission('download_wav_track');
  
  // UI 状态
  const [copiedTrackId, setCopiedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Vocal Removal 管理
  const vocalRemovalManager = useVocalRemovalManager();
  
  // Vocal Removal 弹窗状态
  const [showVocalRemovalConfirmDialog, setShowVocalRemovalConfirmDialog] = useState(false);
  const [pendingVocalRemovalTrackId, setPendingVocalRemovalTrackId] = useState<string | null>(null);
  const [existingVocalRemovalData, setExistingVocalRemovalData] = useState<{
    trackTitle: string;
    vocalUrl?: string;
    instrumentalUrl?: string;
    hasExistingResults?: boolean;
  } | null>(null);
  
  const [showVocalRemovalProgressDialog, setShowVocalRemovalProgressDialog] = useState(false);
  const [currentProcessingTrackId, setCurrentProcessingTrackId] = useState<string | null>(null);
  const [currentProcessingTrackTitle, setCurrentProcessingTrackTitle] = useState<string>('');
  
  // 将所有 tracks 展平
  const allTracks = userTracks.flatMap(music => {
    if (!music.allTracks || !Array.isArray(music.allTracks)) {
      return [];
    }
    return music.allTracks
      .filter(track => !(track.isDeleted ?? false))
      .map(track => ({
        ...track,
        isFavorited: track.isFavorited ?? false,
        coverR2Url: track.coverR2Url ?? undefined,
        musicTitle: music.title,
        musicTags: music.tags,
        musicGenre: music.genre,
        musicStatus: music.status,
        musicGeneration: music,
        isError: !track.audioUrl || track.audioUrl.trim() === '',
        errorMessage: (!track.audioUrl || track.audioUrl.trim() === '') ? 'Audio file missing' : undefined
      }));
  });

  // 搜索过滤
  const filterTracks = useCallback((tracks: any[]) => {
    if (!searchQuery.trim()) return tracks;
    const query = searchQuery.toLowerCase();
    return tracks.filter(track => {
      if (track.title?.toLowerCase().includes(query)) return true;
      if (track.musicTitle?.toLowerCase().includes(query)) return true;
      if (track.tags?.toLowerCase().includes(query)) return true;
      if (track.musicTags?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [searchQuery]);

  const stableGeneratedTracks = React.useMemo(() => {
    const tracks = generatedTracks || [];
    return filterTracks(tracks);
  }, [generatedTracks, filterTracks]);

  const currentTracks = filterTracks(allTracks);

  // 处理歌曲选择
  const handleTrackSelect = useCallback((track: any) => {
    if (track.isPlaceholder) return;
    if (onTrackSelect) {
      onTrackSelect(track.id);
    }
  }, [onTrackSelect]);

  // 处理播放/暂停
  const handlePlayPause = useCallback((track: any) => {
    if (track.isPlaceholder) return;
    if (onTrackPlay) {
      onTrackPlay(track, track.musicGeneration);
    }
  }, [onTrackPlay]);
  
  // 处理分享
  const handleShare = useCallback((trackId: string) => {
    const url = `${window.location.origin}/studio?track=${trackId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTrackId(trackId);
      setTimeout(() => setCopiedTrackId(null), 2000);
    });
  }, []);
  
  // 处理下载
  const handleDownload = useCallback((track: any, format: 'mp3' | 'wav') => {
    if (onDownload) {
      onDownload(track, track.musicGeneration, format);
    }
  }, [onDownload]);
  
  // 处理收藏
  const handleFavoriteToggle = useCallback((track: any) => {
    if (onFavoriteToggle) {
      onFavoriteToggle(track, track.musicGeneration);
    }
  }, [onFavoriteToggle]);
  
  // 处理删除
  const handleDelete = useCallback(async (trackId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`/api/delete-track/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        toast.success('Track deleted successfully');
        window.location.reload();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to delete track');
      }
    } catch (error) {
      console.error('Delete track error:', error);
      toast.error('Failed to delete track');
    }
  }, []);

  // 处理 Vocal Removal
  const handleVocalRemoval = useCallback(async (trackId: string) => {
    const track = allTracks.find(t => t.id === trackId);
    if (track?.musicGeneration?.isInstrumental) {
      toast.error('Instrumental tracks cannot be processed for vocal removal');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }
      
      const trackTitle = track?.title || 'Unknown Track';
      setCurrentProcessingTrackTitle(trackTitle);

      // 检查是否存在分离结果
      const statusResponse = await fetch(`/api/vocal-removal-status?trackId=${trackId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      let hasCompletedResults = false;
      let completedRemoval: any = null;

      if (statusResponse.ok) {
        const statusResult = await statusResponse.json();
        if (statusResult.success && statusResult.data && Array.isArray(statusResult.data) && statusResult.data.length > 0) {
          completedRemoval = statusResult.data.find((r: any) => {
            return r.status === 'completed' && (r.vocalUrl || r.instrumentalUrl);
          });
          
          if (completedRemoval) {
            hasCompletedResults = true;
          }
        }
      }

      // 显示确认弹窗
            setPendingVocalRemovalTrackId(trackId);
            setExistingVocalRemovalData({
              trackTitle: track?.title || 'Unknown Track',
        vocalUrl: completedRemoval?.vocalUrl,
        instrumentalUrl: completedRemoval?.instrumentalUrl,
        hasExistingResults: hasCompletedResults,
            });
            setShowVocalRemovalConfirmDialog(true);
    } catch (error) {
      console.error('Vocal removal error:', error);
    }
  }, [allTracks]);

  // 开始 Vocal Removal 处理
  const startVocalRemovalProcess = useCallback(async (trackId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication required');
        return;
      }
      
      const track = allTracks.find(t => t.id === trackId);
      const trackTitle = track?.title || 'Unknown Track';
      
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(trackTitle);
      setShowVocalRemovalProgressDialog(true);
      
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'processing',
        progress: 0,
      });

      const response = await fetch('/api/vocal-removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trackId,
          type: 'separate_vocal'
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to start vocal removal';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'error',
          progress: 0,
          errorMessage,
        });
        return;
      }

      const result = await response.json();

      if (result.success && result.data?.taskId) {
        const taskId = result.data.taskId;
        
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'processing',
          taskId,
        });
        
        // 开始轮询
        vocalRemovalManager.startPolling(trackId, taskId);
      } else {
        const errorMessage = result.error || result.message || 'Failed to start vocal removal';
        vocalRemovalManager.updateTrackState(trackId, {
          status: 'error',
          progress: 0,
          errorMessage,
        });
      }
    } catch (error) {
      console.error('Vocal removal error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start vocal removal';
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'error',
        progress: 0,
        errorMessage,
      });
    }
  }, [allTracks, vocalRemovalManager]);

  // 确认重新分离
  const handleConfirmReSeparation = useCallback(() => {
    setShowVocalRemovalConfirmDialog(false);
    if (pendingVocalRemovalTrackId) {
      startVocalRemovalProcess(pendingVocalRemovalTrackId);
      setPendingVocalRemovalTrackId(null);
    }
  }, [pendingVocalRemovalTrackId, startVocalRemovalProcess]);

  // 查看已有结果
  const handleViewExistingResults = useCallback(() => {
    setShowVocalRemovalConfirmDialog(false);
    if (existingVocalRemovalData?.hasExistingResults && pendingVocalRemovalTrackId) {
      const trackId = pendingVocalRemovalTrackId;
      
      setCurrentProcessingTrackId(trackId);
      setCurrentProcessingTrackTitle(existingVocalRemovalData.trackTitle);
      
      vocalRemovalManager.updateTrackState(trackId, {
        status: 'completed',
        progress: 100,
          vocalUrl: existingVocalRemovalData.vocalUrl,
          instrumentalUrl: existingVocalRemovalData.instrumentalUrl,
      });
      
      setShowVocalRemovalProgressDialog(true);
    }
    setPendingVocalRemovalTrackId(null);
  }, [existingVocalRemovalData, pendingVocalRemovalTrackId, vocalRemovalManager]);

  // 渲染 Loading 状态
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <LoadingState message="Loading your tracks..." size="lg" vertical />
      </div>
    );
  }

  // 渲染空状态
  const showEmptyState = (!userTracks || userTracks.length === 0 || allTracks.length === 0) 
    && stableGeneratedTracks.length === 0;

  if (showEmptyState) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12">
        <div className="text-center max-w-md space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Music className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold text-foreground">
              Your tracks will appear here
            </h3>
            <p className="text-base text-muted-foreground leading-relaxed">
            Choose your style, describe the vibe, and create your track.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search Bar */}
      <div className="flex-shrink-0 px-6 pb-4 md:pt-6 md:pb-4 md:px-6">
        <div className="flex items-center justify-end">
          <div className="relative w-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title and tags..."
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
        </div>
      </div>

      {/* Tracks List */}
      <div className="flex-1 overflow-hidden">
        <div 
          className="h-full overflow-y-auto px-0 relative"
          style={{
            paddingBottom: hasPlayer ? 'calc(var(--player-height, 80px) + 1.5rem)' : '5rem'
          }}
        >
        <div className="relative">
            {/* Generated Tracks */}
          {stableGeneratedTracks.length > 0 && (
            <div className="space-y-1">
              {stableGeneratedTracks.map((track, index) => (
                  <TrackItem
                  key={`generated-${index}`}
                    track={track}
                    isSelected={selectedTrack === track.id}
                    isPlaying={globalAudioState.isPlaying}
                    isCurrentTrack={globalAudioState.currentPlayingTrackId === track.id}
                    isCopied={copiedTrackId === track.id}
                    canDownloadMP3={canDownloadMP3}
                    canDownloadWAV={canDownloadWAV}
                    onSelect={() => {
                    if (!track.isError && track.audioUrl && onGeneratedTrackSelect) {
                      onGeneratedTrackSelect(track.id);
                    }
                  }}
                    onPlayPause={() => handlePlayPause(track)}
                    onFavoriteToggle={onFavoriteToggle ? () => handleFavoriteToggle(track) : undefined}
                    onShare={() => handleShare(track.id)}
                    onDownload={onDownload ? (format) => handleDownload(track, format) : undefined}
                    onVocalRemoval={() => handleVocalRemoval(track.id)}
                    onDelete={onDelete ? () => handleDelete(track.id) : undefined}
                    onPricingModalOpen={openPricingModal}
                    onPublishToggle={onPublishToggle}
                    onEditTitle={onEditTitle}
                  />
                ))}
                                </div>
            )}

            {/* User Tracks */}
          {currentTracks.length > 0 && (
            <div className="space-y-1">
              {currentTracks.map((track) => (
                  <TrackItem
                  key={track.id}
                    track={track}
                    isSelected={selectedTrack === track.id}
                      isPlaying={globalAudioState.isPlaying}
                    isCurrentTrack={globalAudioState.currentPlayingTrackId === track.id}
                    isCopied={copiedTrackId === track.id}
                    canDownloadMP3={canDownloadMP3}
                    canDownloadWAV={canDownloadWAV}
                    onSelect={() => handleTrackSelect(track)}
                    onPlayPause={() => handlePlayPause(track)}
                    onFavoriteToggle={onFavoriteToggle ? () => handleFavoriteToggle(track) : undefined}
                    onShare={() => handleShare(track.id)}
                    onDownload={onDownload ? (format) => handleDownload(track, format) : undefined}
                    onVocalRemoval={() => handleVocalRemoval(track.id)}
                    onDelete={onDelete ? () => handleDelete(track.id) : undefined}
                    onPricingModalOpen={openPricingModal}
                    onPublishToggle={onPublishToggle}
                    onEditTitle={onEditTitle}
                  />
              ))}
              
              {/* Tracks Summary */}
              {currentTracks.length > 0 && (
                <div className="flex justify-center items-center py-3 px-4">
                  <div className="text-sm text-muted-foreground font-medium">
                    {(() => {
                      const totalSongs = currentTracks.length;
                      const totalDuration = currentTracks.reduce((sum, track) => {
                        const duration = typeof track.duration === 'string' ? parseFloat(track.duration) : (track.duration || 0);
                        return sum + (isNaN(duration) ? 0 : duration);
                      }, 0);
                        const durationText = formatDurationInMinutes(totalDuration);
                      return `${totalSongs} song${totalSongs > 1 ? 's' : ''}${durationText ? `, ${durationText}` : ''}`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

            {/* No Search Results */}
          {searchQuery && currentTracks.length === 0 && stableGeneratedTracks.length === 0 && (
            <div className="flex items-center justify-center h-full relative min-h-[400px]">
              <div className="text-center max-w-md px-6 py-12">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <Search className="h-20 w-20 text-muted-foreground/30" strokeWidth={1.5} />
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  No matching tracks
                </h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  No tracks found for &quot;{searchQuery}&quot;. Try a different search term.
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Clear search
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
      
      {/* Vocal Removal 确认弹窗 */}
      <AlertDialog open={showVocalRemovalConfirmDialog} onOpenChange={setShowVocalRemovalConfirmDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
          <button
            onClick={() => {
              setShowVocalRemovalConfirmDialog(false);
              setPendingVocalRemovalTrackId(null);
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {existingVocalRemovalData?.hasExistingResults 
                ? 'Separation Result Exists' 
                : 'Confirm Vocal Removal'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {existingVocalRemovalData && (
                <span>
                  {existingVocalRemovalData.hasExistingResults ? (
                    <>
                      &quot;{existingVocalRemovalData.trackTitle}&quot; already has separation results. Do you want to separate again? It will cost <span className="font-semibold text-primary">{CLIENT_VOCAL_SEPARATION_CREDITS.studio}</span> credits.
                    </>
                  ) : (
                    <>
                      Separate &quot;{existingVocalRemovalData.trackTitle}&quot; into vocals and instrumental? This will cost <span className="font-semibold text-primary">{CLIENT_VOCAL_SEPARATION_CREDITS.studio}</span> credits.
                    </>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            {existingVocalRemovalData?.hasExistingResults ? (
              <>
            <AlertDialogCancel 
              onClick={handleConfirmReSeparation}
              className="w-full sm:w-auto"
            >
                  Separate
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleViewExistingResults}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
                  View
            </AlertDialogAction>
              </>
            ) : (
              <>
                <AlertDialogCancel className="w-full sm:w-auto">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleConfirmReSeparation}
                  className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Confirm
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vocal Removal 进度弹窗 */}
      {currentProcessingTrackId && (
        <VocalRemovalProgressDialog
          isOpen={showVocalRemovalProgressDialog}
          onClose={() => {
            setShowVocalRemovalProgressDialog(false);
            const status = vocalRemovalManager.getTrackState(currentProcessingTrackId).status;
            if (status === 'completed' || status === 'error') {
              setCurrentProcessingTrackId(null);
              setCurrentProcessingTrackTitle('');
            }
          }}
          trackTitle={currentProcessingTrackTitle}
          progress={vocalRemovalManager.getTrackState(currentProcessingTrackId).progress || 0}
          status={vocalRemovalManager.getTrackState(currentProcessingTrackId).status || 'processing'}
          errorMessage={
            vocalRemovalManager.getTrackState(currentProcessingTrackId).status === 'error'
              ? vocalRemovalManager.getTrackState(currentProcessingTrackId).errorMessage || 'Vocal removal failed. Please try again.'
              : undefined
          }
          vocalUrl={vocalRemovalManager.getTrackState(currentProcessingTrackId).vocalUrl}
          instrumentalUrl={vocalRemovalManager.getTrackState(currentProcessingTrackId).instrumentalUrl}
        />
      )}
    </div>
  );
});

