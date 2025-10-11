'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, Download, Pin, PinOff, Trash2, Eye, EyeOff, Heart, HeartCrack, ChevronDown } from 'lucide-react';
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
  const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      // 当滚动超过图片高度(96px) + 间距(16px) = 112px时显示顶部栏
      setIsStickyHeaderVisible(scrollTop > 112);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`bg-background border-l border-border/30 shadow-lg flex-shrink-0 relative overflow-hidden transition-all duration-300 ease-out h-full ${
        isOpen ? 'w-full p-4 sm:p-3 md:p-4 lg:p-6' : 'w-0 p-0 border-0'
      } md:border-l md:border-border/30 border-t md:border-t-0 border-border/30 rounded-t-3xl md:rounded-none`}
      style={{
        transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      <div className="flex h-full flex-col">
        {/* Mobile Header - Only show on mobile and when sticky */}
        {isStickyHeaderVisible && (
          <div className="md:hidden flex items-center gap-2 py-3 sm:py-4 border-b border-border/20 mb-4 sm:mb-5">
            {/* Small Cover Image */}
            <div className="relative w-12 h-12 flex-shrink-0 overflow-hidden rounded-md">
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

              {/* Title and Tags */}
              <div className="flex-1 min-w-0">
                {title && (
                  <h3 className="text-sm font-semibold text-foreground truncate mb-1">
                    {title}
                  </h3>
                )}
                {tags && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {tags}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                {/* Publish Button */}
                {onPublishToggle && (
                  <button
                    onClick={onPublishToggle}
                    className="h-8 px-3 text-xs font-semibold bg-muted/50 border border-border/30 text-foreground shadow-sm hover:bg-muted/70 hover:text-foreground transition-all duration-300 rounded-lg"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {isPublished ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </div>
                  </button>
                )}
                {/* Favorite Button */}
                {onFavoriteToggle && (
                  <button
                    onClick={onFavoriteToggle}
                    className={`h-8 px-3 text-xs font-semibold border border-border/30 shadow-sm transition-all duration-300 rounded-lg ${
                      isFavorited
                        ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                        : 'bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                    title={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Heart className={`h-3 w-3 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                    </div>
                  </button>
                )}
                
                {/* Download Button */}
                {onDownload && (
                  <button
                    onClick={onDownload}
                    disabled={isGenerating || !coverImage}
                    className={`h-8 px-3 text-xs font-semibold border border-border/30 shadow-sm transition-all duration-300 rounded-lg ${
                      isGenerating || !coverImage
                        ? 'bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50'
                        : 'bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Download className="h-3 w-3" />
                    </div>
                  </button>
                )}
              </div>
              
              {/* Close Button - Always on the right */}
              <button
                onClick={onClose}
                className="h-8 px-3 text-xs font-semibold bg-muted/50 border border-border/30 text-foreground shadow-sm hover:bg-muted/70 hover:text-foreground transition-all duration-300 rounded-lg flex-shrink-0"
              >
                <div className="flex items-center justify-center gap-1">
                  <ChevronDown className="h-3 w-3" />
                </div>
              </button>
            </div>
          )}

        {/* Scrollable Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pb-6 md:pb-0" 
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          {/* Mobile Layout */}
          <div className="md:hidden">
            {/* Cover Image and Info Row */}
            <div className="flex items-center gap-4 mb-6">
              {/* Cover Image - Smaller */}
              <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg">
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

              {/* Title and Tags Column */}
              <div className="flex-1 min-w-0">
                {/* Title Row with Buttons */}
                <div className="flex items-center gap-2 mb-1">
                  {title && (
                    <h2 className="text-base font-semibold text-foreground truncate flex-1">
                      {title}
                    </h2>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Publish Button */}
                    {onPublishToggle && (
                      <button
                        onClick={onPublishToggle}
                        className="h-8 px-3 text-xs font-semibold bg-muted/50 border border-border/30 text-foreground shadow-sm hover:bg-muted/70 hover:text-foreground transition-all duration-300 rounded-lg"
                      >
                        <div className="flex items-center justify-center gap-1">
                          {isPublished ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </div>
                      </button>
                    )}
                    {/* Favorite Button */}
                    {onFavoriteToggle && (
                      <button
                        onClick={onFavoriteToggle}
                        className={`h-8 px-3 text-xs font-semibold border border-border/30 shadow-sm transition-all duration-300 rounded-lg ${
                          isFavorited
                            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                            : 'bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground'
                        }`}
                        title={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Heart className={`h-3 w-3 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                        </div>
                      </button>
                    )}
                    
                    {/* Download Button */}
                    {onDownload && (
                      <button
                        onClick={onDownload}
                        disabled={isGenerating || !coverImage}
                        className={`h-8 px-3 text-xs font-semibold border border-border/30 shadow-sm transition-all duration-300 rounded-lg ${
                          isGenerating || !coverImage
                            ? 'bg-muted/30 text-muted-foreground cursor-not-allowed opacity-50'
                            : 'bg-muted/50 text-foreground hover:bg-muted/70 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Download className="h-3 w-3" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {tags && (
                  <div
                    className="cursor-pointer transition-colors -ml-2 -mr-2 p-2"
                    onClick={() => {
                      setIsTagsExpanded(!isTagsExpanded);
                    }}
                    title="Click to expand/collapse"
                  >
                    <p
                      className={`text-xs text-muted-foreground leading-relaxed break-words ${
                        !isTagsExpanded ? 'line-clamp-2' : ''
                      }`}
                    >
                      {tags}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile spacing */}
          <div className="md:hidden h-4"></div>

          {/* Desktop Layout */}
          <div className="hidden md:block">
          {/* Cover Image */}
            <div className="relative w-full aspect-square overflow-hidden rounded-2xl mb-4">
            {/* Close Button - Overlay on cover */}
            <Button
              variant="ghost"
              size="sm"
                onClick={onClose}
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white z-50"
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
              <div className="text-left mb-3">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {title}
              </h2>
            </div>
          )}

          {/* Tags */}
          {tags && (
              <div className="mb-3">
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
          </div>

          {/* Lyrics */}
          {lyrics ? (
            <div className="py-6">
              <div className="text-foreground/85 text-sm md:text-sm text-lg leading-6 md:leading-6 leading-8 whitespace-pre-line font-normal tracking-wide">
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

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex flex-row gap-2 pt-4 border-t border-border/20">
            {/* Publish Button */}
            {onPublishToggle && (
            <Button
                onClick={onPublishToggle}
              variant="outline"
              className="flex-1"
              >
                <div className="flex items-center justify-center gap-2">
                  {isPublished ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                    Unpublish
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                    Publish
                    </>
                  )}
                </div>
            </Button>
            )}
            {/* Favorite Button */}
            {onFavoriteToggle && (
              <Button
                onClick={onFavoriteToggle}
                variant={isFavorited ? 'default' : 'outline'}
                className="flex-1"
              >
                <div className="flex items-center justify-center gap-2">
                  <Heart className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                  {isFavorited ? 'Favourited' : 'Favourite'}
                </div>
              </Button>
            )}
            
            {/* Download Button */}
            {onDownload && (
            <Button
                onClick={onDownload}
              disabled={isGenerating || !coverImage}
              variant="outline"
              className="flex-1"
              >
                <div className="flex items-center justify-center gap-2">
                  <Download className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Download'}
                </div>
            </Button>
            )}
        </div>
      </div>
    </div>
  );
};