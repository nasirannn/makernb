'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX, MessageSquare, Mic } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { VocalSeparationButton } from './vocal-separation-button';
import { supabase } from '@/lib/supabase';
import { AudioPlayerTrack } from '@/types/track';

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

  return (
    <div ref={rootRef} className="relative bg-background/30 backdrop-blur-md border border-border/20 rounded-xl pl-3 pr-3 md:pr-4 py-2 md:px-4 md:py-1.5 pb-0 md:pb-1.5">
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
          <div className="flex items-center space-x-4 flex-1 min-w-0 h-full px-6">
            {/* 当前时间 */}
            <div className="text-sm text-foreground flex-shrink-0 w-12 text-right">
              {formatTime(currentTime)}
            </div>
            
            {/* 进度条 */}
            <div 
              className="flex-1 h-1.5 bg-foreground rounded-full overflow-hidden cursor-pointer group relative"
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
                className="absolute top-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-md transform -translate-y-1/2 transition-all duration-300 group-hover:scale-110"
                style={{ left: `calc(${progressPercentage}% - 3px)` }}
              />
            </div>
            
            {/* 总时长 */}
            <div className="text-sm text-foreground flex-shrink-0 w-12 text-left">
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
          <div className="flex items-center space-x-4 flex-1 min-w-0 h-full px-6">
            {/* 当前时间 */}
            <div className="text-sm text-foreground flex-shrink-0 w-12 text-right">
              {formatTime(currentTime)}
            </div>
            
            {/* 进度条 */}
            <div 
              className="flex-1 h-1.5 bg-foreground rounded-full overflow-hidden cursor-pointer group relative"
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
                className="absolute top-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-md transform -translate-y-1/2 transition-all duration-300 group-hover:scale-110"
                style={{ left: `calc(${progressPercentage}% - 3px)` }}
              />
            </div>
            
            {/* 总时长 */}
            <div className="text-sm text-foreground flex-shrink-0 w-12 text-left">
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

            <div className="w-16 sm:w-16">
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Audio element - 移除重复的audio元素，由父组件studio.tsx管理 */}
    </div>
  );
});