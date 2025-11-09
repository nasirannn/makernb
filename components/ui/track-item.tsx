"use client";

import React from 'react';
import { LoadingDots } from './loading-dots';
import { TrackCover } from './track-cover';
import { TrackInfo } from './track-info';
import { TrackActionButtons } from './track-action-buttons';
import { LibraryTrack } from '@/types/track';

interface TrackItemProps {
  track: LibraryTrack & any;
  isSelected?: boolean;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  isCopied?: boolean;
  
  // 权限
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  
  // 回调函数
  onSelect?: () => void;
  onPlayPause?: () => void;
  onFavoriteToggle?: () => void;
  onShare?: () => void;
  onDownload?: (format: 'mp3' | 'wav') => void;
  onVocalRemoval?: () => void;
  onDelete?: () => void;
  onPricingModalOpen?: () => void;
  onPublishToggle?: (trackId: string, isPublished: boolean) => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
}

export const TrackItem: React.FC<TrackItemProps> = ({
  track,
  isSelected = false,
  isPlaying = false,
  isCurrentTrack = false,
  isCopied = false,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  onSelect,
  onPlayPause,
  onFavoriteToggle,
  onShare,
  onDownload,
  onVocalRemoval,
  onDelete,
  onPricingModalOpen,
  onPublishToggle,
  onEditTitle,
}) => {
  const isError = track.isError || (!track.audioUrl && !track.isGenerating && !track.isLoading);
  const isGenerating = track.isGenerating || track.isLoading;
  const isClickable = !isError && !track.isPlaceholder;
  const showActions = !isError && track.audioUrl && track.musicStatus !== 'generating';
  
  // 确定封面图片来源
  const coverUrl = track.coverR2Url || track.coverImage;
  
  // 确定标题和标签
  const title = track.title || track.musicTitle || 'Untitled Track';
  const tags = track.tags || track.musicTags;
  
  return (
    <div
      className={`relative flex items-center gap-4 px-2 py-2 mx-3 transition-all duration-300 group rounded-lg border
        ${isError
          ? 'cursor-default'
          : isClickable
            ? `cursor-pointer ${isSelected
                ? 'bg-muted/60 border-border/60'
                : 'hover:bg-muted/20 border-transparent'
              }`
            : 'cursor-default border-transparent'
        }`}
      onClick={() => {
        if (isClickable && onSelect) {
          onSelect();
        }
      }}
    >
      {/* Loading 状态遮罩 */}
      {track.isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-10">
          <LoadingDots size="md" color="white" />
        </div>
      )}
      
      {/* 封面 */}
      <TrackCover
        coverUrl={coverUrl}
        title={title}
        isError={isError}
        isGenerating={isGenerating}
        isPlaying={isPlaying}
        isCurrentTrack={isCurrentTrack}
        onPlayPause={onPlayPause}
        trackId={track.id}
      />
      
      {/* Track Info */}
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <div className="flex-1 min-w-0 flex items-center h-16">
          <div className="flex items-center justify-between gap-2 w-full">
            {/* 歌曲信息 */}
            <TrackInfo
              title={title}
              tags={tags}
              duration={track.duration}
              createdAt={track.createdAt || track.musicGeneration?.createdAt}
              isError={isError}
              errorMessage={track.errorMessage || track.originalPrompt}
              isGenerating={isGenerating}
              isSelected={isSelected}
              showDuration={true}
            />
            
            {/* 操作按钮 - 桌面端 */}
            {showActions && (
              <div className="flex items-center justify-end gap-1 flex-shrink-0">
                <TrackActionButtons
                  track={track}
                  isMobile={false}
                  isFavorited={track.isFavorited}
                  isCopied={isCopied}
                  isPublished={track.isPublished}
                  canDownloadMP3={canDownloadMP3}
                  canDownloadWAV={canDownloadWAV}
                  onFavoriteToggle={onFavoriteToggle}
                  onShare={onShare}
                  onDownload={onDownload}
                  onVocalRemoval={onVocalRemoval}
                  onDelete={onDelete}
                  onPricingModalOpen={onPricingModalOpen}
                  onPublishToggle={onPublishToggle}
                  onEditTitle={onEditTitle}
                />
              </div>
            )}
            
            {/* 错误状态的删除按钮 */}
            {isError && onDelete && (
              <div className="flex items-center justify-end gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="h-6 w-6 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Delete track"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* 操作按钮 - 移动端 */}
        {showActions && (
          <TrackActionButtons
            track={track}
            isMobile={true}
            isFavorited={track.isFavorited}
            isCopied={isCopied}
            isPublished={track.isPublished}
            canDownloadMP3={canDownloadMP3}
            canDownloadWAV={canDownloadWAV}
            onFavoriteToggle={onFavoriteToggle}
            onShare={onShare}
            onDownload={onDownload}
            onVocalRemoval={onVocalRemoval}
            onDelete={onDelete}
            onPricingModalOpen={onPricingModalOpen}
            onPublishToggle={onPublishToggle}
            onEditTitle={onEditTitle}
          />
        )}
        
        {/* 错误状态的移动端删除按钮 */}
        {isError && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="md:hidden flex-shrink-0 h-7 w-7 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
            aria-label="Delete track"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

