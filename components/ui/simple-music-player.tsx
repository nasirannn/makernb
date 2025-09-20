'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { SkipBack, Play, Pause, SkipForward, Volume2, VolumeX, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
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

interface SimpleMusicPlayerProps {
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
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const SimpleMusicPlayer: React.FC<SimpleMusicPlayerProps> = ({
  tracks,
  currentTrackIndex,
  currentPlayingTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
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
  const [showTip, setShowTip] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 检查当前歌曲是否有多个tracks
  const hasMultipleTracks = currentTrack?.allTracks && currentTrack.allTracks.length > 1;

  // 获取当前播放的track的封面图片
  const getCurrentCoverImage = () => {
    if (!currentPlayingTrack || !currentTrack?.allTracks) {
      return currentTrack?.coverImage;
    }
    
    // 找到当前播放的track
    const playingTrack = currentTrack.allTracks.find(track => track.id === currentPlayingTrack.trackId);
    return playingTrack?.cover_r2_url || currentTrack?.coverImage;
  };

  // 获取当前播放的track的描述信息
  const getCurrentArtist = () => {
    if (!currentPlayingTrack || !currentTrack?.allTracks) {
      return currentTrack?.artist;
    }
    
    // 找到当前播放的track
    const playingTrack = currentTrack.allTracks.find(track => track.id === currentPlayingTrack.trackId);
    // 如果有side_letter，显示side信息，否则显示原来的artist
    if (playingTrack?.side_letter) {
      return `${currentTrack?.artist} - Side ${playingTrack.side_letter}`;
    }
    return currentTrack?.artist;
  };

  const currentCoverImage = getCurrentCoverImage();
  const currentArtist = getCurrentArtist();

  // 当播放器显示且有多个tracks时，显示提示（只在第一次进入页面时显示）
  useEffect(() => {
    if (hasMultipleTracks && currentCoverImage) {
      // 检查用户是否已经看过提示
      const hasSeenTip = localStorage.getItem('music-player-tip-seen');
      if (!hasSeenTip) {
        const timer = setTimeout(() => {
          setShowTip(true);
        }, 1000); // 1秒后显示提示
        return () => clearTimeout(timer);
      }
    }
  }, [hasMultipleTracks, currentCoverImage]);

  // 处理切换side
  const handleSideChange = () => {
    if (!hasMultipleTracks || !onSideChange || !currentTrack?.allTracks || !currentPlayingTrack) return;

    // 隐藏提示并记录用户已经看过提示
    setShowTip(false);
    localStorage.setItem('music-player-tip-seen', 'true');

    // 找到当前播放的track在allTracks中的索引
    const currentIndex = currentTrack.allTracks.findIndex(track => track.id === currentPlayingTrack.trackId);
    if (currentIndex === -1) return;

    const nextIndex = (currentIndex + 1) % currentTrack.allTracks.length;
    const nextTrack = currentTrack.allTracks[nextIndex];

    onSideChange(nextTrack.id, nextTrack.audio_url);
  };

  // 处理提示点击
  const handleTipClick = () => {
    setShowTip(false);
    // 记录用户已经看过提示
    localStorage.setItem('music-player-tip-seen', 'true');
  };

  const handleProgressChange = (value: number[]) => {
    const newTime = (value[0] / 100) * duration;
    onSeek(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    onVolumeChange(newVolume);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-background/30 backdrop-blur-md border-t border-border/20 px-4 ${isCollapsed ? 'py-2' : 'py-3'}`}>
      <div className="flex items-center space-x-4 max-w-6xl mx-auto">
        
        {/* 左侧：歌曲信息 */}
        <div className={`flex items-center space-x-3 min-w-0 flex-shrink-0 ${isCollapsed ? 'w-0' : 'w-64'}`}>
          {currentCoverImage && !isCollapsed && (
            <div className="relative w-12 h-12 flex-shrink-0 group">
              {/* 封面图片容器 */}
              <div 
                className={`relative w-12 h-12 rounded overflow-hidden transition-all duration-500 ease-out ${
                  showTip ? 'transform -rotate-12 -translate-y-2' : 'transform rotate-0 translate-y-0'
                }`}
                style={{
                  transformOrigin: 'left bottom'
                }}
              >
                <Image
                  src={currentCoverImage}
                  alt={currentTrack?.title || 'Track'}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded object-cover"
                />

                {/* Side Change Button - 切换side按钮 */}
                {hasMultipleTracks && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded cursor-pointer"
                    onClick={handleSideChange}
                  >
                    <RotateCcw className="w-4 h-4 text-white" />
                  </div>
                )}

                {/* Playing Wave Effect - 播放时音波效果 (只在没有悬停时显示) */}
                {isPlaying && !hasMultipleTracks && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                    <div className="flex items-end gap-0.5">
                      <div className="w-0.5 h-2 bg-white animate-pulse" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-0.5 h-3 bg-white animate-pulse" style={{ animationDelay: '100ms' }}></div>
                      <div className="w-0.5 h-1.5 bg-white animate-pulse" style={{ animationDelay: '200ms' }}></div>
                      <div className="w-0.5 h-3.5 bg-white animate-pulse" style={{ animationDelay: '300ms' }}></div>
                      <div className="w-0.5 h-2.5 bg-white animate-pulse" style={{ animationDelay: '400ms' }}></div>
                      <div className="w-0.5 h-3 bg-white animate-pulse" style={{ animationDelay: '500ms' }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 提示文字 */}
              {showTip && hasMultipleTracks && (
                <div 
                  className="absolute -top-8 left-0 bg-black/80 text-white text-xs px-2 py-1 rounded whitespace-nowrap cursor-pointer z-10 animate-pulse"
                  onClick={handleTipClick}
                >
                  Click cover to switch track
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className={`text-white font-medium truncate ${isCollapsed ? 'text-sm' : 'text-sm'}`}>
              {currentTrack?.title || 'No track selected'}
            </div>
            {currentArtist && !isCollapsed && (
              <div className="text-gray-400 text-xs truncate">
                {currentArtist}
              </div>
            )}
          </div>
        </div>

        {/* 收起状态：紧凑布局 - 水平居中 */}
        {isCollapsed ? (
          <div className="flex items-center justify-center space-x-6 flex-1 min-w-0">
            {/* 歌曲名称 */}
            <div className="text-white text-sm font-medium truncate max-w-64">
              {currentTrack?.title || 'No track selected'}
            </div>

            {/* 切换track按钮 - 只在有多个tracks时显示 */}
            {hasMultipleTracks && (
              <button
                onClick={handleSideChange}
                className="text-gray-400 hover:text-white transition-colors"
                title="切换track"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* 播放按钮 */}
            <button
              onClick={onPlayPause}
              className="bg-white text-black rounded-full p-1.5 hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>

            {/* 时间显示 */}
            <div className="text-gray-400 text-xs font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        ) : (
          /* 展开状态：完整的播放控制 */
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
                  <Play className="w-6 h-6 ml-0.5" />
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

        {/* 右侧：音量控制和收起/展开按钮 */}
        <div className={`flex items-center justify-end space-x-4 flex-shrink-0 ${isCollapsed ? 'w-12' : 'w-48'}`}>
          {!isCollapsed && (
            <>
              <button
                onClick={onMuteToggle}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume * 100]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </>
          )}
          
          {/* 收起/展开按钮 */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white transition-colors"
            title={isCollapsed ? '展开播放器' : '收起播放器'}
          >
            {isCollapsed ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
