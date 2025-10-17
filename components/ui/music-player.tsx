'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, Pause, Rewind, FastForward, Volume2, VolumeX, MessageSquare } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { SafeImage } from './safe-image';

interface Track {
  id: string;
  title: string;
  audioUrl: string;
  duration?: number;
  coverImage?: string;
  artist?: string;
  allTracks?: Array<{
    id: string;
    audio_url: string;
    duration: number | string;
    side_letter: string;
    cover_r2_url?: string;
  }>;
}

interface MusicPlayerProps {
  // 播放列表
  tracks: Track[];
  currentTrackIndex: number;
  currentPlayingTrack?: {trackId: string, audioUrl: string} | null;

  // 播放状态
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // 音量控制
  volume: number;
  isMuted: boolean;

  // 歌词面板展开时的简化模式
  hideProgress?: boolean;

  // 控制回调
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onTrackChange: (index: number) => void;
  onTrackInfoClick?: () => void; // 点击歌曲信息区域的回调
}

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  tracks,
  currentTrackIndex,
  currentPlayingTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  hideProgress = false,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onTrackChange,
  onTrackInfoClick,
}) => {
  const currentTrack = tracks[currentTrackIndex];
  const [isMobile, setIsMobile] = useState(false);

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

  // 获取当前播放的track的封面图片
  const getCurrentCoverImage = () => {
    // 如果当前track有封面图片，直接返回
    if (currentTrack?.coverImage) {
      return currentTrack.coverImage;
    }
    
    // 如果有currentPlayingTrack和allTracks，尝试匹配
    if (currentPlayingTrack && currentTrack?.allTracks) {
      const playingTrack = currentTrack.allTracks.find(track => track.id === currentPlayingTrack.trackId);
      return playingTrack?.cover_r2_url || currentTrack?.coverImage;
    }
    
    return currentTrack?.coverImage;
  };

  // 获取当前播放的track的描述信息
  const getCurrentArtist = () => {
    // 直接返回当前track的artist信息
    return currentTrack?.artist || 'Unknown Artist';
  };

  const currentCoverImage = getCurrentCoverImage();
  const currentArtist = getCurrentArtist();

  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * duration;
    onSeek(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    onVolumeChange(newVolume);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

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
    <div ref={rootRef} className="relative bg-background/30 backdrop-blur-md border-t-0 md:border-t md:border-border/20 rounded-xl md:rounded-none pl-3 pr-14 md:pr-4 py-2 md:px-4 md:py-3 pb-0 md:pb-3">
      <div className="flex items-center w-full sm:max-w-6xl sm:mx-auto h-full sm:h-12 pb-2 md:pb-0">
        
        {/* 左侧：歌曲信息 */}
        <div 
          className={`flex items-center space-x-3 min-w-0 ${
            isMobile ? 'flex-1' : 'flex-initial flex-shrink-0 max-w-64'
          } cursor-pointer hover:opacity-80 transition-opacity`}
          onClick={() => {
            if (isMobile && onTrackInfoClick) {
              onTrackInfoClick();
            }
          }}
        >
          {/* 封面图片或磁带占位符 - 始终显示 */}
          <div className="relative w-12 h-12 sm:w-12 sm:h-12 flex-shrink-0 group">
            <div
              className="relative w-12 h-12 sm:w-12 sm:h-12 rounded-md overflow-hidden flex items-center justify-center"
              style={{
                transformOrigin: 'left bottom'
              }}
            >
              <SafeImage
                src={currentCoverImage || ''}
                alt={currentTrack?.title || 'Track'}
                width={48}
                height={48}
                className="w-12 h-12 sm:w-12 sm:h-12 rounded-md object-cover"
                fallbackContent={
                  <Image
                    src="/cassette-tape.svg"
                    alt="Cassette Tape"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain opacity-70"
                  />
                }
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-sm font-medium text-white truncate">
              {currentTrack?.title || 'Unknown Track'}
            </div>
            {/* 时长显示 */}
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* 桌面端：中间控制按钮 */}
        {!isMobile && (
          <div className="flex items-center justify-center space-x-3 flex-1 min-w-0 h-full">
            {/* 上一首按钮 */}
            <button
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Rewind className="w-5 h-5 fill-current" />
            </button>

            {/* 播放/暂停按钮 */}
            <button
              onClick={onPlayPause}
              className="text-gray-400 hover:text-white transition-colors"
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
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FastForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}

        {/* 移动端：右侧控制按钮 */}
        {isMobile && (
          <div className="flex items-center space-x-3 flex-shrink-0 h-full">
            {/* 上一首按钮 */}
            <button
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Rewind className="w-5 h-5 fill-current" />
            </button>

            {/* 播放/暂停按钮 */}
            <button
              onClick={onPlayPause}
              className="text-gray-400 hover:text-white transition-colors"
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
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FastForward className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}

        {/* 右侧：歌词和音量控制 - 桌面端显示 */}
        {!isMobile && (
          <div className="flex items-center space-x-5 flex-shrink-0">
            {/* 歌词按钮 */}
            {onTrackInfoClick && (
              <button
                onClick={onTrackInfoClick}
                className={`transition-colors ${
                  hideProgress 
                    ? 'text-primary hover:text-primary/80' 
                    : 'text-gray-400 hover:text-white'
                }`}
                title={hideProgress ? "Hide lyrics" : "Show lyrics"}
              >
                <MessageSquare className="w-5 h-5 fill-current" />
              </button>
            )}

            {/* 音量控制 */}
            <button
              onClick={onMuteToggle}
              className="text-gray-400 hover:text-white transition-colors"
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
      
      {/* Bottom Border Progress Bar - 移动端和桌面端，始终显示 */}
      <div 
        className="absolute bottom-0 h-1 bg-foreground/10 rounded-full overflow-hidden cursor-pointer group"
        style={{ left: '0.75rem', right: '0.75rem' }}
        onClick={(e) => {
          if (duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = (clickX / rect.width) * 100;
            const newTime = (percentage / 100) * duration;
            onSeek(newTime);
          }
        }}
      >
        <div 
          className="absolute top-0 left-0 h-full bg-foreground/50 transition-all duration-300 group-hover:bg-primary"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
};