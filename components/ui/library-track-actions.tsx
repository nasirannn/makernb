"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  MoreHorizontal,
  Trash2,
  Pin,
  PinOff,
  Pencil,
  Star,
  Send,
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
  onDownload?: (format: 'mp3' | 'wav') => void;
  onPublish?: () => void;
  onPin?: () => void;
  onEdit?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
  onPricingModalOpen?: () => void;
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
  onDownload,
  onPublish,
  onPin,
  onEdit,
  onFavorite,
  onDelete,
  onPricingModalOpen,
}) => {
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
              {!canDownloadMP3 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                  Basic
                </Badge>
              )}
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
              {!canDownloadWAV && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gradient-create text-white border-0 shrink-0">
                  Premium
                </Badge>
              )}
            </DropdownMenuItem>
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
              Edit Title
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

