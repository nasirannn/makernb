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
  onPublish?: () => void;
  onPin?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
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
  onPublish,
  onShare,
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

  // Desktop: Show all action buttons
  return (
    <div className="flex items-center gap-2">
      {/* Publish/Unpublish Button */}
      {onPublish && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={track.isPublished ? "Unpublish" : "Publish"}
          onClick={(e) => {
            e.stopPropagation();
            onPublish();
          }}
        >
          {track.isPublished ? (
            <Send className="h-4 w-4 text-green-600" />
          ) : (
            <Send className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      )}

      {/* Share Button */}
      {onShare && (
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${isCopied ? 'text-green-500' : 'text-muted-foreground hover:text-foreground'} hover:bg-muted/50 transition-colors`}
          title="Share track"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
        >
          {isCopied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Download Button - Dropdown Menu */}
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
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="p-1.5 min-w-[160px]">
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
              className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
            >
              <span className="font-medium">Download MP3</span>
            </DropdownMenuItem>
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
              className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
            >
              <span className="font-medium">Download WAV</span>
            </DropdownMenuItem>
            {hasCoverImage ? (
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
                className="flex items-center justify-between gap-1.5 cursor-pointer px-2.5 py-1.5 text-xs data-[highlighted]:bg-transparent data-[highlighted]:text-primary focus:bg-transparent"
              >
                <span className="font-medium">Download PNG</span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* More Actions Dropdown */}
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

          {/* Pin/Unpin - Only for admins */}
          {userIsAdmin && onPin && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
              className="cursor-pointer"
            >
              {track.isPinned ? (
                <PinOff className="mr-2 h-4 w-4" />
              ) : (
                <Pin className="mr-2 h-4 w-4" />
              )}
              {track.isPinned ? "Unpin" : "Pin"}
            </DropdownMenuItem>
          )}

          {/* Delete - Available for all users */}
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
