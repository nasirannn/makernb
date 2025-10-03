'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface LyricsPlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onMuteToggle: () => void;
}

const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const LyricsPlayer: React.FC<LyricsPlayerProps> = ({
  isPlaying,
  currentTime,
  duration,
  isMuted,
  onPlayPause,
  onMuteToggle
}) => {
  return (
    <div className="h-16 bg-gradient-to-r from-black/20 via-black/10 to-black/20 backdrop-blur-md border-t border-white/5 flex items-center px-6">
      {/* 左侧：播放按钮 */}
      <div className="flex items-center">
        <button
          onClick={onPlayPause}
          className="w-12 h-12 rounded-full bg-white/90 text-black flex items-center justify-center hover:bg-white hover:scale-105 transition-all duration-200 shadow-lg"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
      </div>

      {/* 中间：时间信息 */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-white/80 font-mono tracking-wider">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* 右侧：音量控制 */}
      <div className="flex items-center">
        <button
          onClick={onMuteToggle}
          className="w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all duration-200"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
