"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Download,
  MoreHorizontal,
  Trash2,
  Pencil,
  Star,
  Send,
  Share2,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LibraryTrack } from '@/types/track';

interface LibraryTrackActionsProps {
  track: LibraryTrack;
  isMobile?: boolean;
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadCover?: boolean;
  onDownload?: (format: 'mp3' | 'wav' | 'cover') => void;
  onEdit?: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
  onPricingModalOpen?: () => void;
  isCopied?: boolean;
}

/**
 * Library Track Actions Component
 * 
 * Handles all action buttons for library tracks (Publish, Download, Edit, Favorite, Delete)
 * Provides both desktop and mobile layouts
 */
export const LibraryTrackActions: React.FC<LibraryTrackActionsProps> = ({
  track,
  isMobile = false,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  canDownloadCover = false,
  onDownload,
  onShare,
  onPublish,
  onEdit,
  onFavorite,
  onDelete,
  onPricingModalOpen,
  isCopied = false,
}) => {
  const hasCoverImage = Boolean(
    track.coverImage ||
    track.coverR2Url ||
    track.allTracks?.[0]?.coverR2Url
  );
  const canDownload = {
    mp3: !!canDownloadMP3,
    wav: !!canDownloadWAV,
    cover: !!canDownloadCover,
  };

  const handleDownloadClick = (
    e: React.MouseEvent,
    format: 'mp3' | 'wav' | 'cover'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDownload) return;

    const canDownloadFormat =
      (format === 'mp3' && canDownload.mp3) ||
      (format === 'wav' && canDownload.wav) ||
      (format === 'cover' && canDownload.cover);

    if (!canDownloadFormat) {
      onPricingModalOpen?.();
      return;
    }

    onDownload(format);
  };

  // Mobile: Return "More" button only (triggers bottom sheet in parent)
  if (isMobile) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 mr-2"
        title="More actions"
        onClick={(e) => {
          e.stopPropagation();
          // Mobile menu is handled by parent component
        }}
      >
        <MoreHorizontal className="h-5 w-5" />
      </Button>
    );
  }

  const handleFavoriteToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onFavorite?.();
  };

  // Desktop: Show action buttons
  return (
    <div className="flex items-center gap-2">
      {onDownload && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Download"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              aria-label="Download track"
            >
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-2 min-w-[160px]">
            <DropdownMenuItem
              onClick={(e) => handleDownloadClick(e, 'mp3')}
              className="flex items-center justify-between gap-2 cursor-pointer px-3 py-2 text-xs"
            >
              <span className="font-medium">Download MP3</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => handleDownloadClick(e, 'wav')}
              className="flex items-center justify-between gap-2 cursor-pointer px-3 py-2 text-xs"
            >
              <span className="font-medium">Download WAV</span>
            </DropdownMenuItem>
            {hasCoverImage ? (
              <DropdownMenuItem
                onClick={(e) => handleDownloadClick(e, 'cover')}
                className="flex items-center justify-between gap-2 cursor-pointer px-3 py-2 text-xs"
              >
                <span className="font-medium">Download PNG</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {onFavorite && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={track.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          onClick={handleFavoriteToggle}
        >
          <Star
            className={`h-4 w-4 ${
              track.isFavorited ? 'text-red-500 fill-current' : 'text-muted-foreground'
            }`}
          />
        </Button>
      )}

      {onPublish && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={track.isPublished ? 'Unpublish track' : 'Publish track'}
          onClick={(e) => {
            e.stopPropagation();
            onPublish();
          }}
        >
          <Send
            className={`h-4 w-4 ${
              track.isPublished ? 'text-green-500' : 'text-muted-foreground'
            }`}
          />
        </Button>
      )}

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
          <DropdownMenuContent align="end" className="w-64 p-2">
          {onEdit && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="cursor-pointer px-3 py-2"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Music Info
            </DropdownMenuItem>
          )}

          {onShare && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="cursor-pointer px-3 py-2"
            >
              {isCopied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              {isCopied ? 'Link copied' : 'Copy share link'}
            </DropdownMenuItem>
          )}

          {onDelete && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="cursor-pointer px-3 py-2 text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
