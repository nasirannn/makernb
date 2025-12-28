"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Download,
  MoreHorizontal,
  Trash2,
  Pin,
  PinOff,
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
  userIsAdmin?: boolean;
  canDownloadMP3?: boolean;
  canDownloadWAV?: boolean;
  canDownloadCover?: boolean;
  onDownload?: (format: 'mp3' | 'wav' | 'cover') => void;
  onPin?: () => void;
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
 * Handles all action buttons for library tracks (Publish, Download, Pin, Edit, Favorite, Delete)
 * Provides both desktop and mobile layouts
 */
export const LibraryTrackActions: React.FC<LibraryTrackActionsProps> = ({
  track,
  isMobile = false,
  userIsAdmin = false,
  canDownloadMP3 = false,
  canDownloadWAV = false,
  canDownloadCover = false,
  onDownload,
  onShare,
  onPublish,
  onPin,
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

      {userIsAdmin && onPin && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={track.isPinned ? 'Unpin track' : 'Pin track'}
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
        >
          {track.isPinned ? (
            <PinOff className="h-4 w-4 text-primary" />
          ) : (
            <Pin className="h-4 w-4 text-muted-foreground" />
          )}
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
        <DropdownMenuContent align="end" className="w-52">
          {onEdit && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Music Info
            </DropdownMenuItem>
          )}

          {onEdit && (onShare || onDownload) && <DropdownMenuSeparator />}

          {onShare && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="cursor-pointer"
            >
              {isCopied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              {isCopied ? 'Link copied' : 'Copy share link'}
            </DropdownMenuItem>
          )}

          {onDownload && (
            <>
              <DropdownMenuItem
                onClick={(e) => handleDownloadClick(e, 'mp3')}
                className="cursor-pointer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download MP3
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => handleDownloadClick(e, 'wav')}
                className="cursor-pointer"
              >
                <Download className="mr-2 h-4 w-4" />
                Download WAV
              </DropdownMenuItem>
              {hasCoverImage && (
                <DropdownMenuItem
                  onClick={(e) => handleDownloadClick(e, 'cover')}
                  className="cursor-pointer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download PNG
                </DropdownMenuItem>
              )}
            </>
          )}

          {(onShare || onDownload) && onDelete && <DropdownMenuSeparator />}

          {onDelete && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
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
  );
};
