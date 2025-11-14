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
  isExtension?: boolean;
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
  isExtension = false,
}) => {
  const showPlayButton = !isError && onPlayPause;
  const showWaveIndicator = isCurrentTrack && isPlaying && !isError;
  const sizeClass = isExtension ? 'w-12 h-12' : 'w-16 h-16';
  const imageSize = isExtension ? 48 : 64;
  const iconSize = isExtension ? 'h-4 w-4' : 'h-6 w-6';
  const buttonSize = isExtension ? 'h-8 w-8' : 'h-10 w-10';
  const iconButtonSize = isExtension ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className={`relative ${sizeClass} rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover`}>
      {/* 封面图片 */}
      {isError ? (
        <Image
          src="/logo.svg"
          alt="Error"
          width={imageSize}
          height={imageSize}
          className="w-full h-full object-cover transition-all duration-300"
        />
      ) : coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          width={imageSize}
          height={imageSize}
          className="w-full h-full object-cover transition-all duration-300"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center transition-all duration-300">
          {isGenerating ? (
            <div className={`animate-spin rounded-full ${iconSize} border-2 border-primary border-t-transparent`}></div>
          ) : (
            <Music className={`${iconSize} text-primary`} />
          )}
        </div>
      )}

      {/* Play Button Overlay - 鼠标悬浮时显示 */}
      {showPlayButton && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0 bg-white/20 hover:bg-white/30`}
            onClick={(e) => {
              e.stopPropagation();
              onPlayPause?.();
            }}
          >
            {isPlaying && isCurrentTrack ? (
              <Pause className={`${iconButtonSize} text-white`} />
            ) : (
              <Play className={`${iconButtonSize} text-white`} />
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

