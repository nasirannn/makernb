'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Eye, EyeOff, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CassetteTape } from '@/components/ui/cassette-tape';

interface LyricsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  lyrics?: string;
  title?: string;
  tags?: string;
  coverImage?: string;
  isPublished?: boolean;
  isGenerating?: boolean; // 新增：是否正在生成中（用于显示磁带占位）
  isPlaying?: boolean; // 新增：是否正在播放（用于磁带转动动画）
  onPublishToggle?: () => void;
  // 播放器相关 props
  currentPlayingTrack?: any;
}

export const LyricsPanel: React.FC<LyricsPanelProps> = ({
  isOpen,
  onClose,
  lyrics,
  title,
  tags,
  coverImage,
  isPublished = false,
  isGenerating = false,
  isPlaying = false,
  onPublishToggle,
  // 播放器相关参数
  currentPlayingTrack,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
  
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string | undefined>(coverImage);


  // 预加载封面图片 - 简化逻辑
  useEffect(() => {
    if (!coverImage) {
      setCurrentCoverUrl(undefined);
      return;
    }

    // 如果封面URL没有变化，不需要重新加载
    if (currentCoverUrl === coverImage) {
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      setCurrentCoverUrl(coverImage);
    };
    img.onerror = () => {
      console.error('[LyricsPanel] Cover failed to load:', coverImage);
      setCurrentCoverUrl(coverImage);
    };
    img.src = coverImage;
  }, [coverImage, currentCoverUrl]); // 依赖 coverImage prop

  // 处理拖动手势
  useEffect(() => {
    const dragHandle = dragHandleRef.current;
    if (!dragHandle) return;

    const handleTouchStart = (e: TouchEvent) => {
      setDragStartY(e.touches[0].clientY);
      setDragCurrentY(e.touches[0].clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (dragStartY === null) return;
      setDragCurrentY(e.touches[0].clientY);
      
      // 如果正在拖拽，阻止默认的滚动行为
      const dragDistance = Math.abs(e.touches[0].clientY - dragStartY);
      if (dragDistance > 10) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (dragStartY === null || dragCurrentY === null) {
        setDragStartY(null);
        setDragCurrentY(null);
        return;
      }

      const dragDistance = dragCurrentY - dragStartY;
      
      // 如果向下拖动超过100px，关闭面板
      if (dragDistance > 100) {
        onClose();
      }

      setDragStartY(null);
      setDragCurrentY(null);
    };

    dragHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
    dragHandle.addEventListener('touchmove', handleTouchMove, { passive: false });
    dragHandle.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      dragHandle.removeEventListener('touchstart', handleTouchStart);
      dragHandle.removeEventListener('touchmove', handleTouchMove);
      dragHandle.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragStartY, dragCurrentY, onClose]);

  return (
    <div
      className={`bg-background border-l border-border/30 shadow-lg flex-shrink-0 relative overflow-hidden transition-all duration-300 ease-out h-full ${
        isOpen ? 'w-full md:w-80 md:p-4 lg:p-6' : 'w-0 md:w-0 p-0 border-0'
      } md:border-l md:border-border/30 border-t md:border-t-0 border-border/30 rounded-t-3xl md:rounded-none`}
      style={{
        transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
      data-mobile-panel
    >
      <div className="flex h-full flex-col">
        {/* Close Button - Desktop only - REMOVED */}


        {/* Scrollable Content */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pb-2 px-4 md:px-0 md:pb-0 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Cover and Track Info - Desktop and Mobile */}
          <div className="py-4 md:py-6 flex flex-col justify-center min-h-full">
            {/* Desktop Layout: Top-Bottom */}
            <div className="hidden md:flex md:flex-col md:items-center md:mb-4">
              {/* Cover Image - Top */}
                <div className="mb-3 flex justify-center">
                  {currentCoverUrl ? (
                    <div className={`relative w-56 aspect-square overflow-hidden rounded-full`}>
                      <Image
                        src={currentCoverUrl}
                        alt={title || 'Track Cover'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="relative w-56 aspect-square overflow-hidden rounded-xl">
                    <CassetteTape
                      duration="--:--"
                      isPlaying={isPlaying}
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>

              {/* Track Info - Bottom */}
              <div className="text-center">
                {title ? (
                  <h2 className="text-lg font-semibold text-foreground line-clamp-2 mb-2">
                    {title}
                  </h2>
                ) : (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Click a track to view its information</p>
                  </div>
                )}

                {/* Tags */}
                {tags && tags.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                      {tags.split(/[,;.]/).filter(tag => tag.trim()).map((tag, index, array) => (
                        <span key={index} className="hover:text-foreground transition-colors cursor-default">
                          {tag.trim()}
                          {index < array.length - 1 && <span className="mx-1">•</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Layout: Top-Bottom */}
            <div className="md:hidden">
              {/* Cover Image */}
              <div className="flex justify-center mb-4">
                {currentCoverUrl ? (
                  <div className={`relative w-56 aspect-square overflow-hidden rounded-full`}>
                    <Image
                      src={currentCoverUrl}
                      alt={title || 'Track Cover'}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative w-72 aspect-square overflow-hidden rounded-xl">
                    <CassetteTape
                      duration="--:--"
                      isPlaying={isPlaying}
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="text-center mb-3">
                {title ? (
                  <h2 className="text-lg font-semibold text-foreground truncate mb-2">
                    {title}
                  </h2>
                ) : (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Click a track to view its information</p>
                  </div>
                )}

                {/* Tags */}
                {tags && tags.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground flex flex-wrap justify-center gap-x-1.5 gap-y-0.5">
                      {tags.split(/[,;.]/).filter(tag => tag.trim()).map((tag, index, array) => (
                        <span key={index} className="hover:text-foreground transition-colors cursor-default">
                          {tag.trim()}
                          {index < array.length - 1 && <span className="mx-1">•</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lyrics */}
            {lyrics && (
              <div className="pt-2 pb-3">
                <div className="text-foreground/85 text-sm md:text-base leading-6 md:leading-7 whitespace-pre-line font-semibold tracking-wide text-left">
                  {lyrics}
                </div>
              </div>
            )}
          </div>
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
        </div>

        {/* Drag Handle - Mobile only (at bottom) */}
        <div 
          ref={dragHandleRef}
          onClick={onClose}
          className="md:hidden flex items-center justify-center py-3 cursor-pointer active:cursor-grabbing touch-none"
        >
          <div className="w-12 h-1 bg-border/50 rounded-full" />
        </div>
      </div>
    </div>
  );
};