'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { X, Download, Pin, PinOff, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CassetteTape } from '@/components/ui/cassette-tape';

interface LyricsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lyrics?: string;
  title?: string;
  tags?: string;
  genre?: string;
  coverImage?: string;
  sideLetter?: string;
  isPublished?: boolean;
  isPinned?: boolean;
  isAdmin?: boolean;
  isGenerating?: boolean; // 新增：是否正在生成中（用于显示磁带占位）
  isPlaying?: boolean; // 新增：是否正在播放（用于磁带转动动画）
  onDownload?: () => void;
  onPublishToggle?: () => void;
  onPinToggle?: () => void;
  onDelete?: () => void;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({
  isOpen,
  onClose,
  lyrics,
  title,
  tags,
  genre,
  coverImage,
  sideLetter,
  isPublished = false,
  isPinned = false,
  isAdmin = false,
  isGenerating = false,
  isPlaying = false,
  onDownload,
  onPublishToggle,
  onPinToggle,
  onDelete
}) => {
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);



  return (
    <div
      className={`bg-background border-l border-border/30 shadow-lg flex-shrink-0 relative overflow-hidden p-6 transition-all duration-300 ease-out ${
        isOpen ? 'w-56 sm:w-60 md:w-64 lg:w-72 max-w-xs' : 'w-0 p-0 border-0'
      }`}
      style={{
        transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
        opacity: isOpen ? 1 : 0
      }}
    >
      <div className="flex h-full flex-col">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-16">
          {/* Cover Image */}
          <div className="">
            <div className="relative w-full aspect-square overflow-hidden">
              {/* Close Button - Overlay on cover */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white z-10"
              >
                <X className="h-4 w-4" />
              </Button>
              {coverImage ? (
                <Image
                  src={coverImage}
                  alt={title || 'Track Cover'}
                  fill
                  className="object-cover"
                />
              ) : (
                <CassetteTape
                  sideLetter={sideLetter}
                  duration="--:--"
                  isPlaying={isPlaying}
                  className="w-full h-full"
                />
              )}
            </div>

            {/* Title */}
            {title && (
              <div className="text-center mt-3">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {title}
                </h2>
                {/* Genre Badge */}
                {genre && (
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Style/Tags */}
          {tags && (
            <div className="pb-4 mt-2">
              <div
                className={`relative cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors ${
                  tags.length > 80 ? 'hover:bg-muted/30' : ''
                }`}
                onClick={() => tags.length > 80 && setIsTagsExpanded(!isTagsExpanded)}
              >
                <p
                  className={`text-sm text-muted-foreground leading-relaxed ${
                    !isTagsExpanded ? 'overflow-hidden' : ''
                  }`}
                  style={{
                    display: !isTagsExpanded ? '-webkit-box' : 'block',
                    WebkitLineClamp: !isTagsExpanded ? 2 : 'unset',
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {tags}
                </p>
              </div>
            </div>
          )}


          {/* Lyrics */}
          {lyrics ? (
            <div className="pb-4">
              <div className="text-foreground/85 text-sm leading-6 whitespace-pre-line font-normal tracking-wide">
                {lyrics}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">Instrumental Music</p>
                <p className="text-sm text-muted-foreground">
                  Please enjoy
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Floating Action Buttons - Fixed at bottom of lyrics panel */}
        <div className="absolute bottom-0 left-0 right-0 h-16 flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-center w-full gap-4">
            {/* Download Button - Only show if onDownload is provided */}
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Download"
                onClick={onDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}

            {/* Publish/Unpublish Button - Only show if onPublishToggle is provided */}
            {onPublishToggle && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title={isPublished ? "Unpublish" : "Publish"}
                onClick={onPublishToggle}
              >
                {isPublished ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Pin Button - Only for admins and if onPinToggle is provided */}
            {isAdmin && onPinToggle && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title={isPinned ? "Unpin" : "Pin"}
                onClick={onPinToggle}
              >
                {isPinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Delete Button - Only for admins and if onDelete is provided */}
            {isAdmin && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                title="Delete"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
