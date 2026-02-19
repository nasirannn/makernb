"use client";

import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { CustomAudioWaveIndicator } from '@/components/ui/audio-wave-indicator';
import { Play, Pause } from "lucide-react";

interface TrackCoverProps {
  coverUrl?: string;
  title: string;
  isError?: boolean;
  isGenerating?: boolean;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
  hasPlayableAudio?: boolean;
  onPlayPause?: () => void;
  trackId?: string;
  isExtension?: boolean;
  durationLabel?: string | null;
}

export const TrackCover: React.FC<TrackCoverProps> = ({
  coverUrl,
  title,
  isError = false,
  isGenerating = false,
  isPlaying = false,
  isCurrentTrack = false,
  hasPlayableAudio = false,
  onPlayPause,
  trackId: _trackId,
  isExtension = false,
  durationLabel,
}) => {
  const showPlayButton = !isError && hasPlayableAudio && onPlayPause;
  const showWaveIndicator = isCurrentTrack && isPlaying && !isError;
  const sizeClass = isExtension ? 'w-12 h-12' : 'w-[80px] h-[80px]';
  const imageSize = isExtension ? 48 : 80;
  const buttonSize = isExtension ? 'h-7 w-7' : 'h-8 w-8';
  const iconButtonSize = isExtension ? 'h-3 w-3' : 'h-4 w-4';
  const showAnimatedPlaceholder = !isError && !coverUrl && isGenerating;

  return (
    <div
      className={`relative ${sizeClass} rounded-md overflow-hidden flex-shrink-0 transition-transform duration-300 group/cover border border-white/10`}
    >
      {/* 封面图片 */}
      {isError ? (
        <Image
          src="/logo.svg"
          alt="Error"
          width={imageSize}
          height={imageSize}
          className="w-full h-full object-cover transition-all duration-300 border-0"
        />
      ) : coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          width={imageSize}
          height={imageSize}
          className="w-full h-full object-cover transition-all duration-300 border-0"
        />
      ) : (
        <div className="relative h-full w-full overflow-hidden bg-muted/55 dark:bg-muted/25">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10" />
          {showAnimatedPlaceholder && (
            <div className="audio-preview-sheen absolute inset-0" />
          )}
        </div>
      )}

      {/* Play Button Overlay - 鼠标悬浮时显示 */}
      {showPlayButton && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className={`${buttonSize} p-0 rounded-full bg-white/20 hover:bg-white/30`}
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

      {durationLabel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-center justify-center">
          <span className="inline-flex items-center rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium leading-none text-white/90 backdrop-blur-sm">
            {durationLabel}
          </span>
        </div>
      )}
    </div>
  );
};
