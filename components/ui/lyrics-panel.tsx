'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, Download, Pin, PinOff, Trash2, Eye, EyeOff, Heart, HeartCrack } from 'lucide-react';
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
  isFavorited?: boolean; // 新增：是否已收藏
  isAdmin?: boolean;
  isGenerating?: boolean; // 新增：是否正在生成中（用于显示磁带占位）
  isPlaying?: boolean; // 新增：是否正在播放（用于磁带转动动画）
  onDownload?: () => void;
  onPublishToggle?: () => void;
  onPinToggle?: () => void;
  onFavoriteToggle?: () => void; // 新增：收藏切换回调
  onDelete?: () => void;
  // 播放器相关 props
  currentPlayingTrack?: any;
  isPlayerPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  onPlayPause?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onSeek?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onMuteToggle?: () => void;
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
  isFavorited = false,
  isAdmin = false,
  isGenerating = false,
  isPlaying = false,
  onDownload,
  onPublishToggle,
  onPinToggle,
  onFavoriteToggle,
  onDelete,
  // 播放器相关参数
  currentPlayingTrack,
  isPlayerPlaying = false,
  currentTime = 0,
  duration = 0,
  volume = 1,
  isMuted = false,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onMuteToggle
}) => {
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  return (
    <div
      className={`bg-background border-l border-border/30 shadow-lg flex-shrink-0 relative overflow-hidden transition-all duration-300 ease-out h-full ${
        isOpen ? 'w-full p-6' : 'w-0 p-0 border-0'
      }`}
      style={{
        transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      <div className="flex h-full flex-col">
        {/* Scrollable Content - Everything scrolls together */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {/* Cover Image */}
          <div className="relative w-full aspect-square overflow-hidden rounded-2xl">
            {/* Close Button - Overlay on cover */}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked'); // 添加调试日志
                onClose?.();
              }}
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white z-50 pointer-events-auto"
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
            <div className="text-left mt-3">
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

          {/* Tags */}
          {tags && (
            <div className="mt-2">
              <div
                className="relative cursor-pointer rounded-lg p-2 -m-2 transition-colors"
                onClick={() => {
                  setIsTagsExpanded(!isTagsExpanded);
                }}
                title="Click to expand/collapse"
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
            <div className="py-4">
              <div className="text-foreground/85 text-sm leading-6 whitespace-pre-line font-normal tracking-wide">
                {lyrics}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">Instrumental Music</p>
                <p className="text-sm text-muted-foreground">
                  Please enjoy
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex-shrink-0 pt-4">
          <div className="flex gap-2">
            {/* Publish Button */}
            {onPublishToggle && (
              <button
                onClick={onPublishToggle}
                className="flex-1 h-12 px-4 text-sm font-semibold bg-muted/50 border border-border/30 text-foreground shadow-sm hover:bg-muted/70 hover:text-foreground transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] rounded-2xl"
              >
                <div className="flex items-center justify-center gap-2">
                  {isPublished ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span>Unpublish</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>Publish</span>
                    </>
                  )}
                </div>
              </button>
            )}
            
            {/* Download Button */}
            {onDownload && (
              <button
                onClick={onDownload}
                disabled={isGenerating || !coverImage} // 禁用条件：正在生成中 或 没有封面图片（表示还未完成）
                className={`flex-1 h-12 px-4 text-sm font-semibold border border-border/30 shadow-sm transition-all duration-300 rounded-2xl ${
                  isGenerating || !coverImage
                    ? 'bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50'
                    : 'bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground hover:-translate-y-1 hover:scale-[1.02]'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" />
                  <span>{isGenerating ? 'Generating...' : 'Download'}</span>
                </div>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};