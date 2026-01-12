'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX, MessageSquare, Mic } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { VocalSeparationButton } from '@/features/vocal-tools/components/vocal-separation-button';
import { supabase } from '@/lib/supabase';
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
        "hover:text-foreground hover:bg-foreground/5",
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
        "group relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-foreground/10",
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
        className="absolute inset-y-0 left-0 bg-primary"
        style={{ width: `${progressPercentage}%` }}
      />
      <div
        className={cn(
          "absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary shadow-sm ring-2 ring-background",
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
  };

  variant?: 'default' | 'studio';
  
  // 音频引用 - 由父组件管理
  audioRef?: React.RefObject<HTMLAudioElement>;
}

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MusicPlayer: React.FC<MusicPlayerProps> = React.memo(function MusicPlayer({
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
  onVolumeChange,
  onMuteToggle,
  onTrackChange,
  onTrackInfoClick,
  playTrackById,
  currentPlayingTrack,
  variant = 'default',
  audioRef,
}) {
  const currentTrack = tracks[currentTrackIndex];
  const [isMobile, setIsMobile] = useState(false);

  // 通过 track ID 获取 track 信息
  const fetchTrackInfo = useCallback(async (trackId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/track-info/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch track info:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.track) {
        return data.track;
      } else {
        console.error('Invalid track data:', data);
        return null;
      }
    } catch (error) {
      console.error('Error fetching track info:', error);
      return null;
    }
  }, []);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // 初始检查
    checkScreenSize();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);
  // 检查当前歌曲是否有多个tracks
  const hasMultipleTracks = currentTrack?.allTracks && currentTrack.allTracks.length > 1;

  // 获取当前播放的track的描述信息
  const getCurrentArtist = () => {
    return currentTrack?.artist || 'Unknown Artist';
  };

  // 获取当前播放的track的时长
  const getCurrentDuration = () => {
    // 优先使用 tracks 中的 duration，fallback 到 prop
    return currentTrack?.duration || duration || 0;
  };
  const currentArtist = getCurrentArtist();
  const currentDuration = getCurrentDuration();

  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * currentDuration;
    onSeek(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    onVolumeChange(newVolume);
  };

  const progressPercentage = currentDuration > 0 ? (currentTime / currentDuration) * 100 : 0;

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

  const trackTitle =
    currentTrack?.title ||
    currentPlayingTrack?.title ||
    'Untitled';

  if (variant === 'studio') {
    return (
      <div
        ref={rootRef}
        className={cn(
          "app-card relative rounded-3xl px-3 py-2 md:px-4 md:py-2",
          "shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl"
        )}
      >
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3">
          {/* Left: transport */}
          <div className="flex items-center gap-1">
            <PlayerIconButton
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              title="Previous"
              className="h-8 w-8"
            >
              <Rewind className="h-4 w-4 fill-current" />
            </PlayerIconButton>

            <button
              type="button"
              onClick={onPlayPause}
              aria-label={isPlaying ? "Pause" : "Play"}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full",
                "bg-primary text-primary-foreground shadow-[0_12px_34px_rgba(0,0,0,0.22)]",
                "transition-transform hover:scale-[1.03] active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current translate-x-[1px]" />
              )}
            </button>

            <PlayerIconButton
              onClick={onNext}
              disabled={currentTrackIndex === tracks.length - 1}
              title="Next"
              className="h-8 w-8"
            >
              <FastForward className="h-4 w-4 fill-current" />
            </PlayerIconButton>
          </div>

          {/* Middle: meta + progress */}
          <div className="min-w-0">
            <button
              type="button"
              onClick={onTrackInfoClick}
              disabled={!onTrackInfoClick}
              className={cn(
                "w-full text-left",
                onTrackInfoClick ? "cursor-pointer" : "cursor-default"
              )}
              title={trackTitle}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {trackTitle}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span className="opacity-50">/</span>
                  <span>{formatTime(currentDuration)}</span>
                </div>
              </div>
            </button>

            <div className="mt-2">
              <PlayerProgressRail
                currentDuration={currentDuration}
                currentTime={currentTime}
                progressPercentage={progressPercentage}
                onSeek={onSeek}
              />
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
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
  }

  return (
    <div ref={rootRef} className="app-card relative rounded-2xl pl-3 pr-3 md:pr-4 py-2 md:px-4 md:py-1.5 pb-0 md:pb-1.5">
      <div className="relative flex items-center w-full sm:max-w-6xl sm:mx-auto h-full sm:h-9 pb-2 md:pb-0">
        
        {/* 移动端：左侧播放控制按钮 */}
        {isMobile && (
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* 上一首按钮 */}
            <button
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Rewind className="w-5 h-5 fill-current" />
            </button>

            {/* 播放/暂停按钮 - 主要按钮，在中间 */}
            <button
              onClick={onPlayPause}
              className="text-foreground hover:text-primary transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current" />
              )}
            </button>

            {/* 下一首按钮 */}
            <button
              onClick={onNext}
              disabled={currentTrackIndex === tracks.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FastForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}

        {/* 移动端：中间进度条区域 */}
        {isMobile && (
          <div className="flex items-center space-x-2 flex-1 min-w-0 h-full px-4">
            {/* 当前时间 */}
            <div className="text-sm text-foreground flex-shrink-0 w-10 text-right">
              {formatTime(currentTime)}
            </div>
            
            {/* 进度条 */}
            <div 
              className="flex-1 h-1 bg-foreground rounded-full overflow-hidden cursor-pointer group relative"
              onClick={(e) => {
                if (currentDuration > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percentage = (clickX / rect.width) * 100;
                  const newTime = (percentage / 100) * currentDuration;
                  onSeek(newTime);
                }
              }}
            >
              {/* 进度条背景 */}
              <div 
                className="absolute top-0 left-0 h-full bg-primary"
                style={{ width: `${progressPercentage}%` }}
              />
              {/* 进度条手柄 */}
              <div 
                className="absolute top-1/2 w-1 h-1 bg-primary rounded-full shadow-md transform -translate-y-1/2 transition-all duration-300 group-hover:scale-110"
                style={{ left: `calc(${progressPercentage}% - 2px)` }}
              />
            </div>
            
            {/* 总时长 */}
            <div className="text-sm text-foreground flex-shrink-0 w-10 text-left">
              {formatTime(currentDuration)}
            </div>
          </div>
        )}

        {/* 移动端：右侧功能按钮 */}
        {isMobile && (
          <div className="flex items-center space-x-5 flex-shrink-0">
            {/* 歌词按钮 */}
            {onTrackInfoClick && (
              <button
                onClick={onTrackInfoClick}
                className={`transition-colors ${
                  hideProgress 
                    ? 'text-primary hover:text-primary/80' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={hideProgress ? "Hide lyrics" : "Show lyrics"}
              >
                <MessageSquare className="w-5 h-5 fill-current" />
              </button>
            )}
          </div>
        )}

        {/* 桌面端：左侧播放控制按钮 */}
        {!isMobile && (
          <div className="flex items-center space-x-3 flex-shrink-0">
            {/* 上一首按钮 */}
            <button
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Rewind className="w-5 h-5 fill-current" />
            </button>

            {/* 播放/暂停按钮 - 主要按钮，在中间 */}
            <button
              onClick={onPlayPause}
              className="text-foreground hover:text-primary transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current" />
              )}
            </button>

            {/* 下一首按钮 */}
            <button
              onClick={onNext}
              disabled={currentTrackIndex === tracks.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FastForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}

        {/* 桌面端：中间进度条区域 */}
        {!isMobile && (
          <div className="flex items-center space-x-2 flex-1 min-w-0 h-full px-4">
            {/* 当前时间 */}
            <div className="text-sm text-foreground flex-shrink-0 w-10 text-right">
              {formatTime(currentTime)}
            </div>
            
            {/* 进度条 */}
            <div 
              className="flex-1 h-1 bg-foreground rounded-full overflow-hidden cursor-pointer group relative"
              onClick={(e) => {
                if (currentDuration > 0) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const percentage = (clickX / rect.width) * 100;
                  const newTime = (percentage / 100) * currentDuration;
                  onSeek(newTime);
                }
              }}
            >
              {/* 进度条背景 */}
              <div 
                className="absolute top-0 left-0 h-full bg-primary"
                style={{ width: `${progressPercentage}%` }}
              />
              {/* 进度条手柄 */}
              <div 
                className="absolute top-1/2 w-1 h-1 bg-primary rounded-full shadow-md transform -translate-y-1/2 transition-all duration-300 group-hover:scale-110"
                style={{ left: `calc(${progressPercentage}% - 2px)` }}
              />
            </div>
            
            {/* 总时长 */}
            <div className="text-sm text-foreground flex-shrink-0 w-10 text-left">
              {formatTime(currentDuration)}
            </div>
          </div>
        )}


        {/* 右侧：歌词和音量控制 - 桌面端显示 */}
        {!isMobile && (
          <div className="flex items-center space-x-5 flex-shrink-0">
            {/* 人声分离按钮 */}
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

            {/* 歌词按钮 */}
            {onTrackInfoClick && (
              <button
                onClick={onTrackInfoClick}
                className={`transition-colors ${
                  hideProgress 
                    ? 'text-primary hover:text-primary/80' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={hideProgress ? "Hide lyrics" : "Show lyrics"}
              >
                <MessageSquare className="w-5 h-5 fill-current" />
              </button>
            )}

            {/* 音量控制 */}
            <button
              onClick={onMuteToggle}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 sm:w-5 sm:h-5" />
              ) : (
                <Volume2 className="w-5 h-5 sm:w-5 sm:h-5" />
              )}
            </button>

            <div className="w-0 overflow-hidden" aria-hidden="true" />
          </div>
        )}
      </div>
      
      {/* Audio element - 移除重复的audio元素，由父组件studio.tsx管理 */}
    </div>
  );
});
