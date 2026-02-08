"use client";

import React from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { CustomAudioWaveIndicator } from '@/components/ui/audio-wave-indicator';
import { Play, Pause, Loader2 } from "lucide-react";

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
  showLoadingOverlay?: boolean;
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
  trackId,
  isExtension = false,
  showLoadingOverlay = true,
  durationLabel,
}) => {
  const showPlayButton = !isError && hasPlayableAudio && onPlayPause;
  const showWaveIndicator = isCurrentTrack && isPlaying && !isError;
  const sizeClass = isExtension ? 'w-12 h-12' : 'w-[80px] h-[80px]';
  const imageSize = isExtension ? 48 : 80;
  const buttonSize = isExtension ? 'h-7 w-7' : 'h-8 w-8';
  const iconButtonSize = isExtension ? 'h-3 w-3' : 'h-4 w-4';
  const showLoading = showLoadingOverlay && !isError && !hasPlayableAudio;
  const showAnimatedPlaceholder = !isError && !coverUrl && (isGenerating || showLoading);

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
        <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-primary/85 via-primary/45 to-primary/20 dark:from-primary/70 dark:via-primary/35 dark:to-primary/10">
          <div className={`absolute -left-1/4 -top-1/4 h-14 w-14 rounded-full bg-white/20 blur-2xl ${showAnimatedPlaceholder ? 'animate-pulse' : ''}`} />
          <div
            className={`absolute -bottom-1/4 -right-1/4 h-16 w-16 rounded-full bg-primary-foreground/20 blur-2xl ${showAnimatedPlaceholder ? 'animate-pulse' : ''}`}
            style={showAnimatedPlaceholder ? { animationDelay: '500ms' } : undefined}
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_12%,rgba(255,255,255,0.12)_48%,transparent_82%)]" />
        </div>
      )}

      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 text-white/90 animate-spin" />
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

      {durationLabel && !showLoading && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-center justify-center">
          <span className="inline-flex items-center rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium leading-none text-white/90 backdrop-blur-sm">
            {durationLabel}
          </span>
        </div>
      )}
    </div>
  );
};
