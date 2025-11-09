"use client";

import React from 'react';
import { LyricsPanel } from "@/components/ui/lyrics-panel";

interface MobileLyricsOverlayProps {
  isVisible: boolean;
  selectedTrack: any;
  isPlaying: boolean;
  currentPlayingTrack: any;
  onClose: () => void;
}

/**
 * 移动端歌词浮层组件
 * 全屏显示歌词面板
 */
export const MobileLyricsOverlay = React.memo(({
  isVisible,
  selectedTrack,
  isPlaying,
  currentPlayingTrack,
  onClose,
}: MobileLyricsOverlayProps) => {
  if (!selectedTrack || !isVisible) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="md:hidden fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300"
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 w-full h-dvh flex-shrink-0 z-[60] bg-background"
        style={{ touchAction: 'pan-y' }}
      >
        {/* 歌词内容区域 */}
        <div className="flex-1 min-h-0 h-full">
          <LyricsPanel
            isOpen={isVisible}
            onClose={onClose}
            lyrics={selectedTrack?.lyrics}
            title={selectedTrack?.title}
            tags={selectedTrack?.tags}
            coverImage={selectedTrack?.coverImage || selectedTrack?.coverR2Url || undefined}
            isGenerating={selectedTrack?.isGenerating || false}
            isPlaying={isPlaying && currentPlayingTrack?.id === selectedTrack?.id}
            currentPlayingTrack={currentPlayingTrack}
          />
        </div>
      </div>
    </>
  );
});

MobileLyricsOverlay.displayName = 'MobileLyricsOverlay';

