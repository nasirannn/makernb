"use client";

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TrackItem } from './track-item';
import { LibraryTrack } from '@/types/track';

interface TrackGroupProps {
  /** 原曲 */
  originalTrack: LibraryTrack & any;
  /** 延长版本列表 */
  extensionTracks: Array<LibraryTrack & any>;
  /** 是否默认展开所有延长版本 */
  defaultExpanded?: boolean;
  /** 默认显示的延长版本数量 */
  defaultVisibleCount?: number;
  
  // TrackItem 的所有 props
  isSelected?: string | null;
  isPlaying?: boolean;
  currentPlayingTrackId?: string | null;
  isCopied?: string | null;
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadCover?: boolean;
  canVocalRemoval?: boolean;
  canExtendMusic?: boolean;
  canReplaceSection?: boolean;

  // 回调函数
  onTrackSelect?: (trackId: string) => void;
  onTrackPlay?: (track: LibraryTrack, music: any) => void;
  onFavoriteToggle?: (track: LibraryTrack, music: any) => void;
  onShare?: (trackId: string) => void;
  onDownload?: (track: LibraryTrack, music: any, format?: 'mp3' | 'wav' | 'cover') => void;
  onVocalRemoval?: (trackId: string) => void;
  onExtendMusic?: (trackId: string) => void;
  onReplaceSection?: (trackId: string) => void;
  onDelete?: (trackId: string) => void;
  onPricingModalOpen?: () => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  onEditMusicInfo?: (trackId: string, data: { title: string; coverImageUrl?: string }) => Promise<void>;
}

/**
 * 曲目分组组件
 * 用于显示原曲和其延长版本的分组
 */
export const TrackGroup: React.FC<TrackGroupProps> = ({
  originalTrack,
  extensionTracks,
  defaultExpanded = false,
  defaultVisibleCount = 2,
  isSelected,
  isPlaying,
  currentPlayingTrackId,
  isCopied,
  canDownloadMP3,
  canDownloadWAV,
  canDownloadCover,
  canVocalRemoval,
  canExtendMusic,
  canReplaceSection,
  onTrackSelect,
  onTrackPlay,
  onFavoriteToggle,
  onShare,
  onDownload,
  onVocalRemoval,
  onExtendMusic,
  onReplaceSection,
  onDelete,
  onPricingModalOpen,
  onEditTitle,
  onEditMusicInfo,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // 按创建时间排序延长版本（最新的在前）
  const sortedExtensions = useMemo(() => {
    return [...extensionTracks].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.musicGeneration?.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.musicGeneration?.createdAt || 0).getTime();
      return dateB - dateA; // 降序排列
    });
  }, [extensionTracks]);
  
  // 计算显示的延长版本
  const visibleExtensions = useMemo(() => {
    if (isExpanded) {
      return sortedExtensions;
    }
    return sortedExtensions.slice(0, defaultVisibleCount);
  }, [isExpanded, sortedExtensions, defaultVisibleCount]);
  
  const hasMoreExtensions = sortedExtensions.length > defaultVisibleCount;
  const remainingCount = sortedExtensions.length - defaultVisibleCount;
  
  // 处理原曲的点击事件
  const handleOriginalTrackSelect = () => {
    if (onTrackSelect) {
      onTrackSelect(originalTrack.id);
    }
  };
  
  const handleOriginalTrackPlay = () => {
    if (onTrackPlay) {
      onTrackPlay(originalTrack, originalTrack.musicGeneration);
    }
  };
  
  // 处理延长版本的点击事件
  const handleExtensionTrackSelect = (track: LibraryTrack & any) => {
    if (onTrackSelect) {
      onTrackSelect(track.id);
    }
  };
  
  const handleExtensionTrackPlay = (track: LibraryTrack & any) => {
    if (onTrackPlay) {
      onTrackPlay(track, track.musicGeneration);
    }
  };
  
  return (
    <div className="space-y-3">
      <TrackItem
        track={originalTrack}
        isSelected={isSelected === originalTrack.id}
        isPlaying={isPlaying}
        isCurrentTrack={currentPlayingTrackId === originalTrack.id}
        isCopied={isCopied === originalTrack.id}
        canDownloadMP3={canDownloadMP3}
        canDownloadWAV={canDownloadWAV}
        canDownloadCover={canDownloadCover}
        canVocalRemoval={canVocalRemoval}
        canExtendMusic={canExtendMusic}
        canReplaceSection={canReplaceSection}
        onSelect={handleOriginalTrackSelect}
        onPlayPause={handleOriginalTrackPlay}
        onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(originalTrack, originalTrack.musicGeneration) : undefined}
        onShare={onShare ? () => onShare(originalTrack.id) : undefined}
        onDownload={onDownload ? (format) => onDownload(originalTrack, originalTrack.musicGeneration, format) : undefined}
        onVocalRemoval={onVocalRemoval ? () => onVocalRemoval(originalTrack.id) : undefined}
        onExtendMusic={onExtendMusic ? () => onExtendMusic(originalTrack.id) : undefined}
        onReplaceSection={onReplaceSection ? () => onReplaceSection(originalTrack.id) : undefined}
        onDelete={onDelete ? () => onDelete(originalTrack.id) : undefined}
        onPricingModalOpen={onPricingModalOpen}
        onEditTitle={onEditTitle}
        onEditMusicInfo={onEditMusicInfo}
      />

      {sortedExtensions.length > 0 && (
        <div className="relative pl-4 space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/40 pl-2">Extensions</p>

          {visibleExtensions.map((extensionTrack) => (
            <div key={extensionTrack.id} className="relative">
              <TrackItem
                track={extensionTrack}
                isSelected={isSelected === extensionTrack.id}
                isPlaying={isPlaying}
                isCurrentTrack={currentPlayingTrackId === extensionTrack.id}
                isCopied={isCopied === extensionTrack.id}
                canDownloadMP3={canDownloadMP3}
                canDownloadWAV={canDownloadWAV}
                canDownloadCover={canDownloadCover}
                canVocalRemoval={canVocalRemoval}
                canExtendMusic={canExtendMusic}
                canReplaceSection={canReplaceSection}
                onSelect={() => handleExtensionTrackSelect(extensionTrack)}
                onPlayPause={() => handleExtensionTrackPlay(extensionTrack)}
                onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(extensionTrack, extensionTrack.musicGeneration) : undefined}
                onShare={onShare ? () => onShare(extensionTrack.id) : undefined}
                onDownload={onDownload ? (format) => onDownload(extensionTrack, extensionTrack.musicGeneration, format) : undefined}
                onVocalRemoval={onVocalRemoval ? () => onVocalRemoval(extensionTrack.id) : undefined}
                onExtendMusic={onExtendMusic ? () => onExtendMusic(extensionTrack.id) : undefined}
                onReplaceSection={onReplaceSection ? () => onReplaceSection(extensionTrack.id) : undefined}
                onDelete={onDelete ? () => onDelete(extensionTrack.id) : undefined}
                onPricingModalOpen={onPricingModalOpen}
                onEditTitle={onEditTitle}
                onEditMusicInfo={onEditMusicInfo}
              />
            </div>
          ))}

          {hasMoreExtensions && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.02] py-2.5 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <span>Show {remainingCount} more extension{remainingCount > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
