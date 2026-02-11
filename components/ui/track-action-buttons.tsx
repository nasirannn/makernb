"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileAudio, FileVideo, Image as ImageIcon, Music2, Star, Share2, Check, Download, MoreVertical, Mic, Trash2, Maximize2, Scissors, Pencil, ThumbsDown, ThumbsUp, FileText, ChevronDown } from "lucide-react";
import { LibraryTrack } from '@/types/track';
import { SolidThumbsUpIcon } from '@/components/icons/solid-thumbs-up-icon';
import { SolidThumbsDownIcon } from '@/components/icons/solid-thumbs-down-icon';

interface TrackActionButtonsProps {
  track: LibraryTrack & any;
  isMobile?: boolean;
  
  // 状态
  isFavorited?: boolean;
  isLiked?: boolean;
  isDisliked?: boolean;
  isCopied?: boolean;
  
  // 权限
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadMP4?: boolean;
  canDownloadCover?: boolean;
  canVocalRemoval?: boolean;
  canExtendMusic?: boolean;
  canReplaceSection?: boolean;

  // 回调函数
  onFavoriteToggle?: () => void;
  onShare?: () => void;
  onDislikeToggle?: () => void;
  onLikeToggle?: () => void;
  onDownload?: (format: 'mp3' | 'wav' | 'mp4' | 'cover') => void;
  onVocalRemoval?: () => void;
  onExtendMusic?: () => void;
  onReplaceSection?: () => void;
  onDelete?: () => void;
  onViewLyrics?: () => void;
  onEditMusicInfo?: () => void;
  onPricingModalOpen?: () => void;
}

export const TrackActionButtons: React.FC<TrackActionButtonsProps> = ({
  track,
  isMobile = false,
  isFavorited = false,
  isLiked = false,
  isDisliked = false,
  isCopied = false,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  canDownloadMP4 = false,
  canDownloadCover = false,
  canVocalRemoval = false,
  canExtendMusic = false,
  canReplaceSection = false,
  onFavoriteToggle,
  onShare,
  onDislikeToggle,
  onLikeToggle,
  onDownload,
  onVocalRemoval,
  onExtendMusic,
  onReplaceSection,
  onDelete,
  onViewLyrics,
  onEditMusicInfo,
  onPricingModalOpen,
}) => {
  const isInstrumental = track.musicGeneration?.isInstrumental || track.isInstrumental;
  const hasAudioUrl = !!track.audioUrl;
  const hasCoverImage = Boolean(
    track.coverR2Url ||
    track.coverImage ||
    track.coverImageUrl ||
    track.musicGeneration?.coverImage ||
    track.musicGeneration?.coverImageUrl
  );
  
  const shouldShowMoreMenu = Boolean(onDelete || onViewLyrics || onEditMusicInfo || onDislikeToggle);
  const shouldShowEditMenu = hasAudioUrl && (onVocalRemoval || onExtendMusic || onReplaceSection);


  // 桌面端按钮
  if (!isMobile) {
    return (
      <div className="hidden md:flex items-center gap-2.5">
        {shouldShowEditMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-3 text-xs font-medium bg-foreground/5 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-all duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto dark:bg-white/4 dark:hover:bg-white/8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="Edit options"
                title="Edit options"
              >
                <span className="inline-flex items-center gap-1.5">
                  Edit
                  <ChevronDown className="h-3.5 w-3.5" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 w-64">
              {onVocalRemoval && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isInstrumental) return;
                    if (!canVocalRemoval) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onVocalRemoval();
                  }}
                  disabled={isInstrumental}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                    isInstrumental ? 'cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5" />
                    <span>Vocal Separation</span>
                  </div>
                </DropdownMenuItem>
              )}
              {onExtendMusic && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canExtendMusic) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onExtendMusic();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Extend Music</span>
                </DropdownMenuItem>
              )}
              {onReplaceSection && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canReplaceSection) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onReplaceSection();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  <span>Replace Section</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 下载按钮 */}
        {onDownload && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full text-xs font-semibold bg-foreground/5 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-all duration-150 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto dark:bg-white/4 dark:hover:bg-white/8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="Download track"
                title="Download track"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[160px]">
              {hasCoverImage && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canDownloadCover) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onDownload('cover');
                  }}
                  className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <ImageIcon className="h-3.5 w-3.5" />
                    PNG (Cover Art)
                  </span>
                </DropdownMenuItem>
              )}

              <div className="px-2.5 py-1 text-[10px] text-muted-foreground uppercase">
                Advanced Features
              </div>

              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadMP3) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('mp3');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Music2 className="h-3.5 w-3.5" />
                  MP3 (Song)
                </span>
              </DropdownMenuItem>
              {canDownloadWAV !== undefined && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canDownloadWAV) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onDownload('wav');
                  }}
                  className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileAudio className="h-3.5 w-3.5" />
                    WAV (High Quality Song)
                  </span>
                </DropdownMenuItem>
              )}
              {canDownloadMP4 !== undefined && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canDownloadMP4) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onDownload('mp4');
                  }}
                  className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <FileVideo className="h-3.5 w-3.5" />
                    MP4 (Music Video)
                  </span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 收藏按钮 */}
        {/* 更多按钮 */}
        {shouldShowMoreMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full text-xs font-semibold bg-foreground/5 text-foreground/80 hover:text-foreground hover:bg-foreground/10 dark:bg-white/4 dark:hover:bg-white/8"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label="More options"
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[180px]">
              {onEditMusicInfo && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditMusicInfo();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit title and cover</span>
                </DropdownMenuItem>
              )}
              {onViewLyrics && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewLyrics();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>View Lyrics</span>
                </DropdownMenuItem>
              )}
              {onDislikeToggle && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDislikeToggle();
                  }}
                  className={`flex items-center gap-2 cursor-pointer px-3 py-2 text-xs ${
                    isDisliked
                      ? 'text-amber-600 dark:text-amber-400 data-[highlighted]:bg-amber-500/10'
                      : ''
                  }`}
                >
                  {isDisliked ? (
                    <SolidThumbsDownIcon className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <ThumbsDown className="h-3.5 w-3.5" />
                  )}
                  <span>{isDisliked ? 'Remove Dislike' : 'Dislike'}</span>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <div className="md:hidden flex items-center gap-1.5 flex-shrink-0">
      {onShare && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className={`h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 transition-colors dark:bg-white/4 dark:hover:bg-white/8 ${
            isCopied
              ? 'text-green-500'
              : 'text-foreground/70 hover:text-foreground'
          }`}
          aria-label={isCopied ? 'Link copied' : 'Share track'}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {onFavoriteToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle();
          }}
          className={`h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 transition-colors dark:bg-white/4 dark:hover:bg-white/8 ${
            isFavorited
              ? 'text-red-500 hover:text-red-500'
              : 'text-foreground/70 hover:text-foreground'
          }`}
          aria-label={isFavorited ? 'Remove from library' : 'Add to library'}
          title={isFavorited ? 'Remove from library' : 'Add to library'}
        >
          <Star className={`h-3.5 w-3.5 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      )}

      {onLikeToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLikeToggle();
          }}
          className={`h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 transition-colors dark:bg-white/4 dark:hover:bg-white/8 ${
            isLiked
              ? 'text-pink-500 hover:text-pink-500'
              : 'text-foreground/70 hover:text-foreground'
          }`}
          aria-label={isLiked ? 'Unlike track' : 'Like track'}
          title={isLiked ? 'Unlike track' : 'Like track'}
        >
          {isLiked ? (
            <SolidThumbsUpIcon className="h-3.5 w-3.5 fill-current" />
          ) : (
            <ThumbsUp className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {onDownload && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-colors dark:bg-white/4 dark:hover:bg-white/8"
              aria-label="Download track"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[160px]">
            {hasCoverImage && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadCover) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('cover');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <ImageIcon className="h-3.5 w-3.5" />
                  PNG (Cover Art)
                </span>
              </DropdownMenuItem>
            )}

            <div className="px-2.5 py-1 text-[10px] text-muted-foreground uppercase">
              Advanced Features
            </div>

            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!canDownloadMP3) {
                  onPricingModalOpen?.();
                  return;
                }
                onDownload('mp3');
              }}
              className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
            >
              <span className="flex items-center gap-2 font-medium">
                <Music2 className="h-3.5 w-3.5" />
                MP3 (Song)
              </span>
            </DropdownMenuItem>
            {canDownloadWAV !== undefined && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadWAV) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('wav');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileAudio className="h-3.5 w-3.5" />
                  WAV (High Quality Song)
                </span>
              </DropdownMenuItem>
            )}
            {canDownloadMP4 !== undefined && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canDownloadMP4) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onDownload('mp4');
                }}
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileVideo className="h-3.5 w-3.5" />
                  MP4 (Music Video)
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {shouldShowMoreMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-colors dark:bg-white/4 dark:hover:bg-white/8"
              aria-label="More options"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[180px]">
            {onEditMusicInfo && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEditMusicInfo();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit title and cover</span>
              </DropdownMenuItem>
            )}
              {onViewLyrics && (
                <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onViewLyrics();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <FileText className="h-3.5 w-3.5" />
                  <span>View Lyrics</span>
                </DropdownMenuItem>
              )}
              {onDislikeToggle && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDislikeToggle();
                  }}
                  className={`flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs ${
                    isDisliked
                      ? 'text-amber-600 dark:text-amber-400 data-[highlighted]:bg-amber-500/10'
                      : ''
                  }`}
                >
                  {isDisliked ? (
                    <SolidThumbsDownIcon className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <ThumbsDown className="h-3.5 w-3.5" />
                  )}
                  <span>{isDisliked ? 'Remove Dislike' : 'Dislike'}</span>
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {shouldShowEditMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 text-foreground/80 hover:text-foreground hover:bg-foreground/10 transition-colors dark:bg-white/4 dark:hover:bg-white/8"
              aria-label="Edit options"
              title="Edit options"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[160px]">
            {onVocalRemoval && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isInstrumental) return;
                  if (!canVocalRemoval) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onVocalRemoval();
                }}
                disabled={isInstrumental}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs ${
                  isInstrumental ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5" />
                  <span>Vocal Separation</span>
                </div>
              </DropdownMenuItem>
            )}
            {onExtendMusic && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canExtendMusic) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onExtendMusic();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Extend Music</span>
              </DropdownMenuItem>
            )}
            {onReplaceSection && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canReplaceSection) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onReplaceSection();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <Scissors className="h-3.5 w-3.5" />
                <span>Replace Section</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
