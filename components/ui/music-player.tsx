'use client';

import React from 'react';
import Image from 'next/image';
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX, MessageSquare, Music } from 'lucide-react';
import { VocalSeparationButton } from '@/features/vocal-tools/components/vocal-separation-button';
import { AudioPlayerTrack } from '@/types/track';
import { cn } from '@/lib/utils';

function PlayerIconButton({
  onClick,
  disabled,
  title,
  className,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors",
        "hover:text-foreground hover:bg-foreground/10",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
    >
      {children}
    </button>
  );
}

function PlayerProgressRail({
  currentDuration,
  currentTime,
  progressPercentage,
  onSeek,
  className,
}: {
  currentDuration: number;
  currentTime: number;
  progressPercentage: number;
  onSeek: (time: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative h-2 w-full cursor-pointer overflow-hidden rounded-full",
        "bg-gradient-to-r from-foreground/10 via-foreground/15 to-foreground/10",
        "ring-1 ring-black/10 dark:ring-white/10",
        className
      )}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.floor(currentDuration))}
      aria-valuenow={Math.min(Math.max(0, Math.floor(currentTime)), Math.max(0, Math.floor(currentDuration)))}
      tabIndex={0}
      onClick={(e) => {
        if (currentDuration > 0) {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const percentage = (clickX / rect.width) * 100;
          const newTime = (percentage / 100) * currentDuration;
          onSeek(newTime);
        }
      }}
      onKeyDown={(e) => {
        if (!currentDuration) return;
        if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 5));
        if (e.key === "ArrowRight") onSeek(Math.min(currentDuration, currentTime + 5));
        if (e.key === "Home") onSeek(0);
        if (e.key === "End") onSeek(currentDuration);
      }}
    >
      <div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/90 to-primary/60"
        style={{ width: `${progressPercentage}%` }}
      />
      <div
        className={cn(
          "absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_2px_rgba(255,255,255,0.8)] dark:shadow-[0_0_0_2px_rgba(0,0,0,0.5)]",
          "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        )}
        style={{ left: `calc(${progressPercentage}% - 4px)` }}
      />
    </div>
  );
}

interface MusicPlayerProps {
  // 播放列表
  tracks: AudioPlayerTrack[];
  currentTrackIndex: number;

  // 播放状态
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // 音量控制
  volume: number;
  isMuted: boolean;

  // 歌词面板展开时的简化模式
  hideProgress?: boolean;

  // 人声分离功能
  enableVocalSeparation?: boolean; // 是否启用人声分离功能

  // 控制回调
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onTrackChange: (index: number) => void;
  onTrackInfoClick?: () => void; // 点击歌曲信息区域的回调

  // 新增：支持通过 track ID 播放
  playTrackById?: (trackId: string) => void; // 通过 track ID 播放歌曲
  
  // 新增：当前播放的 track 信息
  currentPlayingTrack?: {
    id: string;
    title: string;
    audioUrl?: string;
    duration?: number;
    genre?: string;
    coverImage?: string;
    coverR2Url?: string;
    tags?: string;
  };
  
  // 音频引用 - 由父组件管理
  audioRef?: React.RefObject<HTMLAudioElement>;
}

const formatTime = (seconds: number): string => {
  if (seconds === null || seconds === undefined || isNaN(seconds) || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const truncateText = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};

export const MusicPlayer: React.FC<MusicPlayerProps> = React.memo(function MusicPlayer(props) {
  const {
    tracks,
    currentTrackIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    hideProgress = false,
    enableVocalSeparation = false,
    onPlayPause,
    onPrevious,
    onNext,
    onSeek,
    onMuteToggle,
    onTrackInfoClick,
    currentPlayingTrack,
  } = props;

  const currentTrack = tracks[currentTrackIndex];

  // 获取当前播放的track的时长
  const getCurrentDuration = () => {
    // 优先使用 tracks 中的 duration，fallback 到 prop
    return currentTrack?.duration || duration || 0;
  };
  const currentDuration = getCurrentDuration();

  const rawPercentage = currentDuration > 0 ? (currentTime / currentDuration) * 100 : 0;
  const progressPercentage = Number.isFinite(rawPercentage) ? Math.min(100, Math.max(0, rawPercentage)) : 0;

  // 动态测量播放器高度，设置 CSS 变量 --player-height
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = rootRef.current;

    const updateHeight = () => {
      const height = el ? el.offsetHeight : 0;
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--player-height', `${height}px`);
      }
    };

    // 初次和下一帧更新，确保布局稳定后取值
    updateHeight();
    const raf = requestAnimationFrame(updateHeight);

    // 监听窗口变化
    window.addEventListener('resize', updateHeight);

    // 使用 ResizeObserver 监听自身高度变化（例如样式切换/字体变化）
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && el) {
      ro = new ResizeObserver(updateHeight);
      ro.observe(el);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateHeight);
      if (ro && el) ro.disconnect();
    };
  }, []);

  // 在布局模式变化/播放状态变化时刷新一次（圆环模式高度不同）
  React.useEffect(() => {
    const el = rootRef.current;
    const height = el ? el.offsetHeight : 0;
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--player-height', `${height}px`);
    }
  }, [hideProgress, isPlaying]);

  const trackTitle = currentTrack?.title || currentPlayingTrack?.title || 'Untitled';
  const coverUrl =
    currentTrack?.coverR2Url ||
    currentTrack?.coverImage ||
    currentPlayingTrack?.coverR2Url ||
    currentPlayingTrack?.coverImage;
  const trackTags = currentTrack?.tags || currentPlayingTrack?.tags;
  const tagsText = typeof trackTags === "string" ? truncateText(trackTags, 50) : "";

  return (
    <div
      ref={rootRef}
      className={cn(
        "app-card relative rounded-2xl px-4 py-3 md:px-5 md:py-3",
        "bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,0.72))] dark:bg-[linear-gradient(180deg,rgba(10,11,15,0.96),rgba(6,7,10,0.92))]",
        "shadow-[0_16px_48px_rgba(0,0,0,0.12)] dark:shadow-[0_26px_70px_rgba(0,0,0,0.58)]",
        "ring-1 ring-black/10 dark:ring-white/10 backdrop-blur-xl"
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3">
        {/* Left: cover + meta */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-11 w-11 overflow-hidden rounded-md bg-foreground/10 ring-1 ring-black/10 dark:ring-white/10">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={trackTitle}
                fill
                sizes="40px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-foreground/40">
                <Music className="h-5 w-5" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onTrackInfoClick}
            disabled={!onTrackInfoClick}
            className={cn(
              "min-w-0 text-left",
              onTrackInfoClick ? "cursor-pointer" : "cursor-default"
            )}
            title={trackTitle}
          >
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              {trackTitle}
            </div>
            {tagsText && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground/80">
                {tagsText}
              </div>
            )}
          </button>
        </div>

        {/* Center: transport */}
        <div className="flex items-center gap-1 justify-center">
          <PlayerIconButton
            onClick={onPrevious}
            disabled={currentTrackIndex === 0}
            title="Previous"
            className="h-9 w-9"
          >
            <Rewind className="h-4 w-4 fill-current" />
          </PlayerIconButton>

          <button
            type="button"
            onClick={onPlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={cn(
              "inline-flex h-12 w-12 items-center justify-center rounded-full",
              "border border-primary text-primary-foreground shadow-[0_14px_32px_rgba(0,0,0,0.22)]",
              "bg-primary",
              "transition-transform active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            {isPlaying ? (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 text-primary-foreground"
                aria-hidden="true"
                focusable="false"
              >
                <rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
                <rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6 translate-x-[1px] text-primary-foreground"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M8 5.5L19 12L8 18.5V5.5Z" fill="currentColor" />
              </svg>
            )}
          </button>

          <PlayerIconButton
            onClick={onNext}
            disabled={currentTrackIndex === tracks.length - 1}
            title="Next"
            className="h-9 w-9"
          >
            <FastForward className="h-4 w-4 fill-current" />
          </PlayerIconButton>
        </div>

        {/* Right: progress + time */}
        <div className="flex items-center gap-3 w-full min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
          </div>
          {!hideProgress && (
            <div className="flex-1 min-w-[140px]">
              <PlayerProgressRail
                currentDuration={currentDuration}
                currentTime={currentTime}
                progressPercentage={progressPercentage}
                onSeek={onSeek}
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{formatTime(currentDuration)}</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 justify-self-end">
          {enableVocalSeparation && currentTrack?.audioId && currentTrack?.taskId && currentTrack?.audioUrl && (
            <VocalSeparationButton
              trackId={currentTrack.id}
              audioId={currentTrack.audioId}
              taskId={currentTrack.taskId}
              trackTitle={currentTrack.title}
              audioUrl={currentTrack.audioUrl}
              duration={duration || 0}
              variant="ghost"
              size="sm"
            />
          )}

          {onTrackInfoClick && (
            <PlayerIconButton
              onClick={onTrackInfoClick}
              title={hideProgress ? "Hide lyrics" : "Show lyrics"}
              className={cn(hideProgress ? "text-primary hover:text-primary" : undefined)}
            >
              <MessageSquare className="h-4 w-4 fill-current" />
            </PlayerIconButton>
          )}

          <PlayerIconButton onClick={onMuteToggle} title={isMuted || volume === 0 ? "Unmute" : "Mute"}>
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </PlayerIconButton>
        </div>
      </div>
    </div>
  );
});
