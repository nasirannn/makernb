'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { SkipBack, Play, Pause, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

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
    duration: number;
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
  onSideChange?: (trackId: string, audioUrl: string) => void;
}

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  onSideChange
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
    <div ref={rootRef} className="bg-background/30 backdrop-blur-md border-t border-border/20 px-3 sm:px-4 py-2 sm:py-3">
      <div className="flex items-center space-x-3 sm:space-x-4 w-full sm:max-w-6xl sm:mx-auto h-16 sm:h-12">
        
        {/* 左侧：歌曲信息 */}
        <div className="flex items-center space-x-3 sm:space-x-3 min-w-0 flex-shrink-0 w-40 sm:w-48">
          {currentCoverImage && (
            <div className="relative w-12 h-12 sm:w-12 sm:h-12 flex-shrink-0 group">
              {/* 封面图片容器 */}
              <div
                className="relative w-12 h-12 sm:w-12 sm:h-12 rounded-md overflow-hidden"
                style={{
                  transformOrigin: 'left bottom'
                }}
              >
                <Image
                  src={currentCoverImage}
                  alt={currentTrack?.title || 'Track'}
                  width={48}
                  height={48}
                  className="w-12 h-12 sm:w-12 sm:h-12 rounded-md object-cover"
                />
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm sm:text-sm font-medium text-white truncate">
              {currentTrack?.title || 'Unknown Track'}
            </div>
          </div>
        </div>

        {/* 移动端：始终显示圆环模式 */}
        {isMobile && (
          <div className="flex items-center justify-center space-x-2 flex-1 min-w-0 h-full">
            {/* 上一首按钮 */}
            <button
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-2"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* 圆环内部播放按钮 */}
            <div className="relative">
              {/* 外圆环 */}
              <div className="w-11 h-11 rounded-full border-2 border-white/30 flex items-center justify-center">
                {/* 内圆环 - 始终显示进度 */}
                <div 
                  className="absolute inset-0 rounded-full transition-all duration-300"
                  style={{
                    border: 'none',
                    background: `conic-gradient(from 0deg, hsl(var(--primary)) 0deg, hsl(var(--primary)) ${progressPercentage * 3.6}deg, transparent ${progressPercentage * 3.6}deg)`,
                    WebkitMask: 'radial-gradient(circle, transparent 15px, black 15px)',
                    mask: 'radial-gradient(circle, transparent 15px, black 15px)'
                  }}
                />
                
                {/* 播放/暂停按钮 */}
                <button
                  onClick={onPlayPause}
                  className="relative z-10 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center hover:scale-105 transition-transform duration-200 shadow-lg"
                >
                  {isPlaying ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className="w-3 h-3 ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 下一首按钮 */}
            <button
              onClick={onNext}
              disabled={currentTrackIndex === tracks.length - 1}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-2"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* 桌面端：根据hideProgress决定显示模式 */}
        {!isMobile && hideProgress && (
          /* 桌面端圆环模式（歌词面板打开时） */
          <div className="flex items-center justify-center space-x-6 flex-1 min-w-0 h-full">
            {/* 上一首按钮 */}
            <button
              onClick={onPrevious}
              disabled={currentTrackIndex === 0}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-2"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            {/* 圆环内部播放按钮 */}
            <div className="relative">
              {/* 外圆环 */}
              <div className="w-10 h-10 rounded-full border-2 border-white/30 flex items-center justify-center">
                {/* 内圆环 - 始终显示进度 */}
                <div 
                  className="absolute inset-0 rounded-full transition-all duration-300"
                  style={{
                    border: 'none',
                    background: `conic-gradient(from 0deg, hsl(var(--primary)) 0deg, hsl(var(--primary)) ${progressPercentage * 3.6}deg, transparent ${progressPercentage * 3.6}deg)`,
                    WebkitMask: 'radial-gradient(circle, transparent 12px, black 12px)',
                    mask: 'radial-gradient(circle, transparent 12px, black 12px)'
                  }}
                />
                
                {/* 播放/暂停按钮 */}
                <button
                  onClick={onPlayPause}
                  className="relative z-10 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center hover:scale-105 transition-transform duration-200 shadow-lg"
                >
                  {isPlaying ? (
                    <Pause className="w-2.5 h-2.5" />
                  ) : (
                    <Play className="w-2.5 h-2.5 ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 下一首按钮 */}
            <button
              onClick={onNext}
              disabled={currentTrackIndex === tracks.length - 1}
              className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-2"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        )}

        {!isMobile && !hideProgress && (
          /* 桌面端完整模式（歌词面板关闭时） */
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            {/* 控制按钮 */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <button
                onClick={onPrevious}
                disabled={currentTrackIndex === 0}
                className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={onPlayPause}
                className="bg-white text-black rounded-full p-2 hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={onNext}
                disabled={currentTrackIndex === tracks.length - 1}
                className="text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {/* 进度条和时间 */}
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <span className="text-gray-400 text-xs font-mono flex-shrink-0">
                {formatTime(currentTime)}
              </span>

              <div className="flex-1 min-w-0">
                <Slider
                  value={[progressPercentage]}
                  onValueChange={handleProgressChange}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <span className="text-gray-400 text-xs font-mono flex-shrink-0">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        )}

        {/* 右侧：音量控制 */}
        <div className="flex items-center justify-end space-x-3 sm:space-x-3 flex-shrink-0 w-24 sm:w-32">
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
      </div>
    </div>
  );
};