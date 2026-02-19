"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileAudio, FileVideo, Image as ImageIcon, Music2, Star, Share2, Check, Download, MoreVertical, Trash2, Expand, Scissors, Pencil, ThumbsDown, ThumbsUp, FileText, ChevronDown, Users, Send, Split, Layers } from "lucide-react";
import { LibraryTrack } from '@/types/track';
import { SolidThumbsUpIcon } from '@/components/icons/solid-thumbs-up-icon';
import { SolidThumbsDownIcon } from '@/components/icons/solid-thumbs-down-icon';
import { useI18n } from "@/lib/i18n/provider";

interface TrackActionButtonsProps {
  track: LibraryTrack & any;
  isMobile?: boolean;
  
  // 状态
  isFavorited?: boolean;
  isLiked?: boolean;
  isDisliked?: boolean;
  isCopied?: boolean;
  isPublished?: boolean;
  isPublishing?: boolean;
  
  // 权限
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadMP4?: boolean;
  canDownloadCover?: boolean;
  canVocalRemoval?: boolean;
  canSplitStem?: boolean;
  canGenerateMidi?: boolean;
  canExtendMusic?: boolean;
  canReplaceSection?: boolean;
  canCreatePersona?: boolean;

  // 回调函数
  onFavoriteToggle?: () => void;
  onShare?: () => void;
  onDislikeToggle?: () => void;
  onLikeToggle?: () => void;
  onDownload?: (format: 'mp3' | 'wav' | 'mp4' | 'cover') => void;
  onVocalRemoval?: () => void;
  onSplitStem?: () => void;
  onGenerateMidi?: () => void;
  onExtendMusic?: () => void;
  onReplaceSection?: () => void;
  onCreatePersona?: () => void;
  onDelete?: () => void;
  onPublishToggle?: () => void;
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
  isPublished = false,
  isPublishing = false,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  canDownloadMP4 = false,
  canDownloadCover = false,
  canVocalRemoval = false,
  canSplitStem = false,
  canGenerateMidi = false,
  canExtendMusic = false,
  canReplaceSection = false,
  canCreatePersona = false,
  onFavoriteToggle,
  onShare,
  onDislikeToggle,
  onLikeToggle,
  onDownload,
  onVocalRemoval,
  onSplitStem,
  onGenerateMidi,
  onExtendMusic,
  onReplaceSection,
  onCreatePersona,
  onDelete,
  onPublishToggle,
  onViewLyrics,
  onEditMusicInfo,
  onPricingModalOpen,
}) => {
  const { t } = useI18n();
  const isInstrumental = track.musicGeneration?.isInstrumental || track.isInstrumental;
  const hasAudioUrl = !!track.audioUrl;
  const hasCoverImage = Boolean(
    track.coverR2Url ||
    track.coverImage ||
    track.coverImageUrl ||
    track.musicGeneration?.coverImage ||
    track.musicGeneration?.coverImageUrl
  );
  
  const shouldShowMoreMenu = Boolean(onDelete || onViewLyrics || onEditMusicInfo || onDislikeToggle || onPublishToggle);
  const shouldShowEditMenu = hasAudioUrl && (onVocalRemoval || onSplitStem || onGenerateMidi || onExtendMusic || onReplaceSection || onCreatePersona);
  const currentPublished = Boolean(isPublished ?? track.isPublished);
  const desktopNeutralTextButtonClass =
    "h-8 rounded-full px-3 text-xs font-semibold bg-foreground/5 text-foreground/45 transition-colors hover:bg-foreground/10 group-hover:text-foreground/80 group-hover:hover:text-foreground data-[state=open]:text-foreground dark:bg-white/4 dark:hover:bg-white/8";
  const desktopNeutralIconButtonClass =
    "h-8 w-8 rounded-full text-xs font-semibold bg-foreground/5 text-foreground/45 transition-colors hover:bg-foreground/10 group-hover:text-foreground/80 group-hover:hover:text-foreground data-[state=open]:text-foreground dark:bg-white/4 dark:hover:bg-white/8";
  const mobileNeutralIconButtonClass =
    "h-8 w-8 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-foreground/5 text-foreground/45 transition-colors hover:bg-foreground/10 hover:text-foreground/80 dark:bg-white/4 dark:hover:bg-white/8";


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
                className={desktopNeutralTextButtonClass}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label={t("trackActions.editOptions")}
                title={t("trackActions.editOptions")}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t("trackActions.edit")}
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
                    <Split className="h-3.5 w-3.5" />
                    <span>{t("trackActions.vocalSeparation")}</span>
                  </div>
                </DropdownMenuItem>
              )}
              {onSplitStem && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canSplitStem) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onSplitStem();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{t("trackActions.splitStem")}</span>
                </DropdownMenuItem>
              )}
              {onGenerateMidi && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canGenerateMidi) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onGenerateMidi();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <FileAudio className="h-3.5 w-3.5" />
                  <span>{t("trackActions.generateMidi")}</span>
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
                  <Expand className="h-3.5 w-3.5" />
                  <span>{t("trackActions.extendMusic")}</span>
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
                  <span>{t("trackActions.replaceSection")}</span>
                </DropdownMenuItem>
              )}
              {onCreatePersona && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!canCreatePersona) {
                      onPricingModalOpen?.();
                      return;
                    }
                    onCreatePersona();
                  }}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 text-xs"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{t("trackActions.persona")}</span>
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
                className={desktopNeutralIconButtonClass}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label={t("trackActions.downloadTrack")}
                title={t("trackActions.downloadTrack")}
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
                    {t("trackActions.pngCoverArt")}
                  </span>
                </DropdownMenuItem>
              )}

              <div className="px-2.5 py-1 text-xs text-muted-foreground uppercase">
                {t("trackActions.advancedFeatures")}
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
                  {t("trackActions.mp3Song")}
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
                    {t("trackActions.wavHighQualitySong")}
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
                    {t("trackActions.mp4MusicVideo")}
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
                className={desktopNeutralIconButtonClass}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                aria-label={t("trackActions.moreOptions")}
                title={t("trackActions.moreOptions")}
              >
                <MoreVertical className="h-3.5 w-3.5" />
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
                  <span>{t("trackActions.editTitleAndCover")}</span>
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
                  <span>{t("trackActions.viewLyrics")}</span>
                </DropdownMenuItem>
              )}
              {onPublishToggle && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isPublishing) return;
                    onPublishToggle();
                  }}
                  disabled={isPublishing}
                  className={`flex items-center gap-2 px-3 py-2 text-xs ${
                    isPublishing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                  }`}
                >
                  <Send className={`h-3.5 w-3.5 ${currentPublished ? 'text-green-500' : ''}`} />
                  <span>{isPublishing ? t("trackActions.updating") : (currentPublished ? t("trackActions.unpublish") : t("trackActions.publish"))}</span>
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
                  <span>{isDisliked ? t("trackActions.removeDislike") : t("trackActions.dislike")}</span>
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
                  <span>{t("trackActions.delete")}</span>
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
          aria-label={isCopied ? t("trackActions.linkCopied") : t("trackActions.shareTrack")}
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
          aria-label={isFavorited ? t("trackActions.removeFromLibrary") : t("trackActions.addToLibrary")}
          title={isFavorited ? t("trackActions.removeFromLibrary") : t("trackActions.addToLibrary")}
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
          aria-label={isLiked ? t("trackActions.unlikeTrack") : t("trackActions.likeTrack")}
          title={isLiked ? t("trackActions.unlikeTrack") : t("trackActions.likeTrack")}
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
              className={mobileNeutralIconButtonClass}
              aria-label={t("trackActions.downloadTrack")}
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
                    {t("trackActions.pngCoverArt")}
                  </span>
                </DropdownMenuItem>
              )}

              <div className="px-2.5 py-1 text-xs text-muted-foreground uppercase">
                {t("trackActions.advancedFeatures")}
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
                  {t("trackActions.mp3Song")}
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
                    {t("trackActions.wavHighQualitySong")}
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
                    {t("trackActions.mp4MusicVideo")}
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
              className={mobileNeutralIconButtonClass}
              aria-label={t("trackActions.moreOptions")}
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
                <span>{t("trackActions.editTitleAndCover")}</span>
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
                  <span>{t("trackActions.viewLyrics")}</span>
                </DropdownMenuItem>
              )}
              {onPublishToggle && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isPublishing) return;
                    onPublishToggle();
                  }}
                  disabled={isPublishing}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs ${
                    isPublishing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                  }`}
                >
                  <Send className={`h-3.5 w-3.5 ${currentPublished ? 'text-green-500' : ''}`} />
                  <span>{isPublishing ? t("trackActions.updating") : (currentPublished ? t("trackActions.unpublish") : t("trackActions.publish"))}</span>
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
                  <span>{isDisliked ? t("trackActions.removeDislike") : t("trackActions.dislike")}</span>
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
                <span>{t("trackActions.delete")}</span>
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
              className={mobileNeutralIconButtonClass}
              aria-label={t("trackActions.editOptions")}
              title={t("trackActions.editOptions")}
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
                  <Split className="h-3.5 w-3.5" />
                  <span>{t("trackActions.vocalSeparation")}</span>
                </div>
              </DropdownMenuItem>
            )}
            {onSplitStem && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canSplitStem) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onSplitStem();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{t("trackActions.splitStem")}</span>
              </DropdownMenuItem>
            )}
            {onGenerateMidi && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canGenerateMidi) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onGenerateMidi();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <FileAudio className="h-3.5 w-3.5" />
                <span>{t("trackActions.generateMidi")}</span>
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
                <Expand className="h-3.5 w-3.5" />
                <span>{t("trackActions.extendMusic")}</span>
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
                <span>{t("trackActions.replaceSection")}</span>
              </DropdownMenuItem>
            )}
            {onCreatePersona && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!canCreatePersona) {
                    onPricingModalOpen?.();
                    return;
                  }
                  onCreatePersona();
                }}
                className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs"
              >
                <Users className="h-3.5 w-3.5" />
                <span>{t("trackActions.persona")}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
