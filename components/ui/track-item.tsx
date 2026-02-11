"use client";

import React, { useState } from 'react';
import { LoadingDots } from './loading-dots';
import { Button } from '@/components/ui/button';
import { TrackCover } from '@/features/lyrics-cover/components/track-cover';
import { TrackInfo } from './track-info';
import { TrackActionButtons } from './track-action-buttons';
import { EditMusicInfoDialog } from './edit-music-info-dialog';
import { LibraryTrack } from '@/types/track';
import { Check, Share2, Star, ThumbsUp, Trash2 } from 'lucide-react';
import { SolidThumbsUpIcon } from '@/components/icons/solid-thumbs-up-icon';
import { formatDuration } from '@/lib/format-utils';

interface TrackItemProps {
  track: LibraryTrack & any;
  isSelected?: boolean;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  isCopied?: boolean;
  modelBadgePlacement?: 'title' | 'meta' | 'none';
  variant?: 'default' | 'studio';
  
  // 权限
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadMP4?: boolean;
  canDownloadCover?: boolean;
  canVocalRemoval?: boolean;
  canExtendMusic?: boolean;
  canReplaceSection?: boolean;

  // 回调函数
  onSelect?: () => void;
  onPlayPause?: () => void;
  onFavoriteToggle?: () => void;
  onDislikeToggle?: () => void;
  onLikeToggle?: () => void;
  onShare?: () => void;
  onDownload?: (format: 'mp3' | 'wav' | 'mp4' | 'cover') => void;
  onVocalRemoval?: () => void;
  onExtendMusic?: () => void;
  onReplaceSection?: () => void;
  onDelete?: () => void;
  onPublishToggle?: () => void;
  onPreviewLyrics?: () => void;
  onPricingModalOpen?: () => void;
  onEditTitle?: (trackId: string, newTitle: string) => void;
  onEditMusicInfo?: (trackId: string, data: { title: string; coverImageUrl?: string }) => Promise<void>;
  isPublishing?: boolean;
}

export const TrackItem: React.FC<TrackItemProps> = ({
  track,
  isSelected = false,
  isPlaying = false,
  isCurrentTrack = false,
  isCopied = false,
  modelBadgePlacement = 'meta',
  variant = 'default',
  canDownloadMP3 = false,
  canDownloadWAV = false,
  canDownloadMP4 = false,
  canDownloadCover = false,
  canVocalRemoval = false,
  canExtendMusic = false,
  canReplaceSection = false,
  onSelect,
  onPlayPause,
  onFavoriteToggle,
  onDislikeToggle,
  onLikeToggle,
  onShare,
  onDownload,
  onVocalRemoval,
  onExtendMusic,
  onReplaceSection,
  onDelete,
  onPublishToggle,
  onPreviewLyrics,
  onPricingModalOpen,
  onEditTitle,
  onEditMusicInfo,
  isPublishing = false,
}) => {
  const isError = track.isError || (!track.audioUrl && !track.isGenerating && !track.isLoading);
  const isGenerating = track.isGenerating || track.isLoading;
  const isClickable = !isError && !track.isPlaceholder;
  const showActions = !isError && track.audioUrl && track.musicStatus !== 'generating';
  // 确定封面图片来源
  const coverUrl = track.coverR2Url || track.coverImage;
  const hasPlayableAudio = Boolean(track.audioUrl || track.streamAudioUrl);
  
  // 确定标题和标签
  const title = track.title || track.musicTitle || 'Untitled Track';
  const callbackTags = track.musicGeneration?.tags;
  const promptFallback = track.prompt || track.musicGeneration?.prompt;
  const tags =
    callbackTags ||
    track.tags ||
    promptFallback ||
    track.genre ||
    (Array.isArray(track.tagList) ? track.tagList.join(', ') : undefined);
  const isPromptFallbackTags = Boolean(
    !callbackTags &&
    promptFallback &&
    tags &&
    String(tags).trim() === String(promptFallback).trim()
  );
  const shouldRenderTagsAsPlainText = Boolean(
    !callbackTags &&
    tags &&
    (isPromptFallbackTags || isGenerating || !track.audioUrl)
  );
  const model = track.model || track.musicGeneration?.model;
  const numericDuration =
    typeof track.duration === 'string'
      ? Number.parseFloat(track.duration)
      : (track.duration || 0);
  const durationLabel = numericDuration > 0 ? formatDuration(numericDuration) : null;
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const canEditMusicInfo = Boolean(onEditMusicInfo || onEditTitle);

  const handleEditMusicInfoClick = () => {
    if (!canEditMusicInfo) return;
    setIsEditDialogOpen(true);
  };

  const handleSaveMusicInfo = async (data: { title: string; coverImageUrl?: string }) => {
    if (onEditMusicInfo) {
      await onEditMusicInfo(track.id, data);
      setIsEditDialogOpen(false);
      return;
    }

    if (onEditTitle && data.title) {
      onEditTitle(track.id, data.title);
      setIsEditDialogOpen(false);
    }
  };
  
  // 统一样式，不再区分延长版本
  const isExtension = false; // 统一样式
  const paddingClass = variant === 'studio' ? 'px-3 py-2.5' : 'px-2 py-2';
  const gapClass = variant === 'studio' ? 'gap-2.5 md:gap-3' : 'gap-2';
  const infoHeightClass = variant === 'studio'
    ? (isExtension ? 'h-12' : 'h-[90px]')
    : '';

  const containerClassName =
    variant === 'studio'
      ? `relative flex items-center ${gapClass} ${paddingClass} w-full transition-all duration-150 group rounded-2xl`
      : `relative flex items-center ${gapClass} ${paddingClass} w-full transition-all duration-200 group rounded-2xl border`;
  
  return (
    <div
      className={`${containerClassName} ${
        isError
          ? 'cursor-default border-transparent bg-transparent'
          : isClickable
            ? `cursor-pointer ${isSelected
              ? (variant === 'studio'
                  ? 'bg-muted/80'
                  : 'border-primary/35 bg-white/75 shadow-[0_12px_34px_rgba(0,0,0,0.08)]')
              : (variant === 'studio'
                ? 'bg-transparent hover:bg-black/5 dark:hover:bg-white/5'
                : 'border-black/10 bg-white/40 hover:bg-white/70 hover:border-black/15')
              }`
            : 'cursor-default border-transparent bg-transparent'
      }`}
      onClick={() => {
        if (isClickable && onSelect) {
          onSelect();
        }
      }}
    >
      {/* Loading 状态遮罩 */}
      {track.isLoading && !track.isGenerating && (
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
        hasPlayableAudio={hasPlayableAudio}
        onPlayPause={onPlayPause}
        trackId={track.id}
        isExtension={isExtension}
      />
      
      {/* Track Info */}
      <div className={`flex-1 min-w-0 flex items-center ${gapClass} ${infoHeightClass}`}>
        <div className={`flex-1 min-w-0 flex ${variant === 'studio' ? 'h-full items-stretch' : 'items-center min-h-16'}`}>
          <div className={`w-full ${variant === 'studio' ? 'h-full' : ''}`}>
            <TrackInfo
              title={title}
              tags={tags}
              duration={track.duration}
              createdAt={track.createdAt || track.musicGeneration?.createdAt}
              model={model}
              modelPlacement={modelBadgePlacement}
              isError={isError}
              errorMessage={track.errorMessage || track.originalPrompt}
              isGenerating={isGenerating}
              isSelected={isSelected}
              showDuration={true}
              isExtension={isExtension}
              originalTrackTitle={track.originalTrackTitle}
              sourceType={track.sourceType}
              variant={variant}
              renderTagsAsText={shouldRenderTagsAsPlainText}
              footerActions={
                variant === 'studio' && !isError ? (
                  <div className="flex h-8 items-center gap-1.5 text-xs">
                    {onFavoriteToggle && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onFavoriteToggle();
                        }}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-xs font-semibold transition-colors dark:bg-white/4 dark:hover:bg-white/8 ${
                          track.isFavorited
                            ? 'text-red-500 hover:text-red-500 hover:bg-foreground/10 dark:hover:bg-white/8'
                            : 'text-foreground/80 hover:text-foreground hover:bg-foreground/10 dark:hover:bg-white/8'
                        }`}
                        aria-label={track.isFavorited ? 'Remove from library' : 'Add to library'}
                        title={track.isFavorited ? 'Remove from library' : 'Add to library'}
                      >
                        <Star className={`h-3.5 w-3.5 ${track.isFavorited ? 'fill-current' : ''}`} />
                      </button>
                    )}

                    {onShare && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onShare();
                        }}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-xs font-semibold transition-colors dark:bg-white/4 dark:hover:bg-white/8 ${
                          isCopied
                            ? 'text-green-500 hover:text-green-500 hover:bg-foreground/10 dark:hover:bg-white/8'
                            : 'text-foreground/80 hover:text-foreground hover:bg-foreground/10 dark:hover:bg-white/8'
                        }`}
                        aria-label={isCopied ? 'Link copied' : 'Share track'}
                        title={isCopied ? 'Link copied' : 'Share track'}
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                      </button>
                    )}

                    {onLikeToggle && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onLikeToggle();
                        }}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 text-xs font-semibold transition-colors dark:bg-white/4 dark:hover:bg-white/8 ${
                          track.isLiked
                            ? 'text-pink-500 hover:text-pink-500 hover:bg-foreground/10 dark:hover:bg-white/8'
                            : 'text-foreground/80 hover:text-foreground hover:bg-foreground/10 dark:hover:bg-white/8'
                        }`}
                        aria-label={track.isLiked ? 'Unlike track' : 'Like track'}
                        title={track.isLiked ? 'Unlike track' : 'Like track'}
                      >
                        {track.isLiked ? (
                          <SolidThumbsUpIcon className="h-3.5 w-3.5 fill-current" />
                        ) : (
                          <ThumbsUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                ) : undefined
              }
              titleActions={
                <>
                  {/* 操作按钮 - 桌面端 */}
                  {showActions && (
                    <div className="flex items-center justify-end gap-2 flex-shrink-0 pl-1">
                      <TrackActionButtons
                        track={track}
                        isMobile={false}
                        isFavorited={track.isFavorited}
                        isDisliked={track.isDisliked}
                        isCopied={isCopied}
                        canDownloadMP3={canDownloadMP3}
                        canDownloadWAV={canDownloadWAV}
                        canDownloadMP4={canDownloadMP4}
                        canDownloadCover={canDownloadCover}
                        canVocalRemoval={canVocalRemoval}
                        canExtendMusic={canExtendMusic}
                        canReplaceSection={canReplaceSection}
                        onFavoriteToggle={undefined}
                        onShare={onShare}
                        onDislikeToggle={onDislikeToggle}
                        onDownload={onDownload}
                        onVocalRemoval={onVocalRemoval}
                        onExtendMusic={onExtendMusic}
                        onReplaceSection={onReplaceSection}
                        onDelete={onDelete}
                        onPublishToggle={onPublishToggle}
                        isPublished={track.isPublished ?? false}
                        isPublishing={isPublishing}
                        onViewLyrics={onPreviewLyrics}
                        onEditMusicInfo={canEditMusicInfo ? handleEditMusicInfoClick : undefined}
                        onPricingModalOpen={onPricingModalOpen}
                      />
                    </div>
                  )}

                  {/* 错误状态的删除按钮 */}
                  {isError && onDelete && (
                    <div className="flex items-center justify-end flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete();
                        }}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </>
              }
            />
          </div>
        </div>
        
        {/* 操作按钮 - 移动端 */}
        {showActions && (
          <TrackActionButtons
            track={track}
            isMobile={true}
            isFavorited={track.isFavorited}
            isLiked={track.isLiked}
            isDisliked={track.isDisliked}
            isCopied={isCopied}
            canDownloadMP3={canDownloadMP3}
            canDownloadWAV={canDownloadWAV}
            canDownloadMP4={canDownloadMP4}
            canDownloadCover={canDownloadCover}
            canVocalRemoval={canVocalRemoval}
            canExtendMusic={canExtendMusic}
            canReplaceSection={canReplaceSection}
            onFavoriteToggle={undefined}
            onShare={onShare}
            onLikeToggle={onLikeToggle}
            onDislikeToggle={onDislikeToggle}
            onDownload={onDownload}
            onVocalRemoval={onVocalRemoval}
            onExtendMusic={onExtendMusic}
            onReplaceSection={onReplaceSection}
            onDelete={onDelete}
            onPublishToggle={onPublishToggle}
            isPublished={track.isPublished ?? false}
            isPublishing={isPublishing}
            onViewLyrics={onPreviewLyrics}
            onEditMusicInfo={canEditMusicInfo ? handleEditMusicInfoClick : undefined}
            onPricingModalOpen={onPricingModalOpen}
          />
        )}
        
      </div>

      {canEditMusicInfo && (
        <EditMusicInfoDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={handleSaveMusicInfo}
          initialTitle={title}
          initialCoverImage={track.coverImage || track.coverR2Url}
          trackId={track.id}
        />
      )}
    </div>
  );
};
