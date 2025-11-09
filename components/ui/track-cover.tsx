"use client";

import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { CustomAudioWaveIndicator } from './audio-wave-indicator';
import { Play, Pause, Music } from "lucide-react";

interface TrackCoverProps {
  coverUrl?: string;
  title: string;
  isError?: boolean;
  isGenerating?: boolean;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  onPlayPause?: () => void;
  trackId?: string;
}

export const TrackCover: React.FC<TrackCoverProps> = ({
  coverUrl,
  title,
  isError = false,
  isGenerating = false,
  isPlaying = false,
  isCurrentTrack = false,
  onPlayPause,
  trackId,
}) => {
  const showPlayButton = !isError && onPlayPause;
  const showWaveIndicator = isCurrentTrack && isPlaying && !isError;

  return (
    <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover">
      {/* 封面图片 */}
      {isError ? (
        <Image
          src="/logo.svg"
          alt="Error"
          width={64}
          height={64}
          className="w-full h-full object-cover transition-all duration-300"
        />
      ) : coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          width={64}
          height={64}
          className="w-full h-full object-cover transition-all duration-300"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center transition-all duration-300">
          {isGenerating ? (
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
          ) : (
            <Music className="h-6 w-6 text-primary" />
          )}
        </div>
      )}

      {/* Play Button Overlay - 鼠标悬浮时显示 */}
      {showPlayButton && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 bg-white/20 hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              onPlayPause?.();
            }}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause className="h-4 w-4 text-white" />
            ) : (
              <Play className="h-4 w-4 text-white" />
            )}
          </Button>
        </div>
      )}

      {/* Audio Wave Indicator - 只在播放时显示，鼠标悬浮时隐藏 */}
      {showWaveIndicator && (
        <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
          <CustomAudioWaveIndicator
            isPlaying={isPlaying}
            size="sm"
            className="text-white"
          />
        </div>
      )}
    </div>
  );
};

