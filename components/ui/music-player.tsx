'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, VolumeX, Volume1, Volume2, FileText } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { CassetteTape } from '@/components/ui/cassette-tape';

interface Track {
    id: string;
    title: string;
    audioUrl: string;
    streamAudioUrl?: string;
    finalAudioUrl?: string;
    isUsingStreamAudio?: boolean;
    duration?: number;
    coverImage?: string;
    sideLetter?: string;
}

interface MusicPlayerProps {
    // 当前播放状态
    currentTrack: Track | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    
    // 音量控制
    volume: number;
    isMuted: boolean;
    
    // 播放控制回调
    onPlayPause: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSeek: (time: number) => void;
    onVolumeChange: (volume: number) => void;
    onMuteToggle: () => void;
    onLyricsToggle?: () => void;
    onCassetteClick?: () => void;
    
    // 播放器状态
    canGoPrevious?: boolean;
    canGoNext?: boolean;
    
    // 磁带显示信息
    sideLetter?: string;
    cassetteDuration?: string;

    // 标签信息
    tags?: string;
    
    // 歌词显示状态
    showLyrics?: boolean;
}

const formatTime = (seconds: number, hasTrack: boolean = true): string => {
    if (!hasTrack) return '--:--';
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return hasTrack ? '00:00' : '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
    currentTrack,
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
    onLyricsToggle,
    onCassetteClick,
    canGoPrevious = true,
    canGoNext = true,
    sideLetter = 'A',
    cassetteDuration,
    tags,
    showLyrics = true
}) => {


    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const newTime = percent * duration;
            onSeek(newTime);
        }
    };

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0] / 100;
        onVolumeChange(newVolume);
    };

    return (
        <div className="w-full px-2 pt-1 pb-2 relative z-30 bg-transparent">
            <div className="max-w-7xl mx-auto p-4 bg-gradient-to-r from-card/80 via-card/60 to-card/80 rounded-3xl backdrop-blur-md border border-border/30 shadow-2xl hover:shadow-3xl transition-all duration-500">
                {/* 播放器布局 - 磁带和控制区域 */}
                <div className="flex gap-6">
                    {/* 左侧：磁带 */}
                    <div className="flex-shrink-0">
                        <div className="w-48 h-32 relative group">
                            {/* 磁带容器 */}
                            <div className={`relative z-10 w-full h-full transition-all duration-500 transform ${
                                isPlaying
                                    ? 'hover:scale-105 hover:-translate-y-2 hover:rotate-3 hover:rotate-y-6'
                                    : 'hover:scale-103 hover:-translate-y-1 hover:rotate-2 hover:rotate-y-3'
                            }`}
                            style={{
                                transformStyle: 'preserve-3d',
                                perspective: '1000px'
                            }}>
                                <CassetteTape
                                    sideLetter={sideLetter}
                                    duration={cassetteDuration || (duration && isFinite(duration) ? `${Math.floor(duration / 60)}min` : '--min')}
                                    title={currentTrack?.title || ''}
                                    isPlaying={isPlaying}
                                    onSideClick={onCassetteClick}
                                    className="w-full h-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 右侧：控制区域 - 垂直居中，上下两行布局，间距紧凑 */}
                    <div className="flex-1 flex items-center h-32 bg-transparent">
                        <div className="w-full space-y-8 bg-transparent">
                            {/* 第一行：播放控制按钮、音量控制、下载按钮 */}
                            <div className="flex items-center justify-between bg-transparent">
                            {/* 左侧：播放控制按钮组 */}
                            <div className="flex items-center gap-3">
                                {/* 上一首 */}
                                <button
                                    onClick={onPrevious}
                                    disabled={!currentTrack || !canGoPrevious}
                                    className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                    title="Previous Track"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                {/* 播放/暂停 */}
                                <button
                                    onClick={onPlayPause}
                                    disabled={!currentTrack}
                                    className="w-12 h-12 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                    title={isPlaying ? "Pause" : "Play"}
                                >
                                    {isPlaying ? (
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-4 bg-white rounded-sm"></div>
                                                <div className="w-1 h-4 bg-white rounded-sm"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Play className="w-5 h-5 ml-0.5" />
                                    )}
                                </button>

                                {/* 下一首 */}
                                <button
                                    onClick={onNext}
                                    disabled={!currentTrack || !canGoNext}
                                    className="w-10 h-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                    title="Next Track"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>

                            {/* 中间：Style 标签 - 横向滚动显示 */}
                            {tags && (
                                <div className="flex-1 mx-3 max-w-xs overflow-hidden relative">
                                    <div className="text-sm text-muted-foreground whitespace-nowrap animate-scroll">
                                        {tags} &nbsp;&nbsp;&nbsp;&nbsp; {tags}
                                    </div>
                                </div>
                            )}

                            {/* 右侧：音量控制和歌词按钮 */}
                            <div className="flex items-center gap-4">
                                {/* 音量控制 */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={onMuteToggle}
                                        className="w-10 h-10 rounded-xl transition-all duration-300 flex items-center justify-center hover:scale-105 active:scale-95 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        title={isMuted ? "Unmute" : "Mute"}
                                    >
                                        {isMuted || volume === 0 ? (
                                            <VolumeX className="w-4 h-4" />
                                        ) : volume < 0.5 ? (
                                            <Volume1 className="w-4 h-4" />
                                        ) : (
                                            <Volume2 className="w-4 h-4" />
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
                                </div>

                                {/* 歌词按钮 */}
                                <button
                                    onClick={onLyricsToggle}
                                    disabled={!currentTrack}
                                    className={`h-10 w-10 p-0 rounded-xl transition-all duration-300 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 ${
                                        showLyrics 
                                            ? 'bg-primary/20 text-primary shadow-sm' 
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                    }`}
                                    title={showLyrics ? "Hide Lyrics" : "Show Lyrics"}
                                >
                                    <FileText className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                            {/* 第二行：进度条 */}
                            <div className="flex items-center gap-4 bg-transparent">
                            {/* 当前时间 */}
                            <div className="text-sm text-muted-foreground min-w-[3rem] text-right">
                                {formatTime(currentTime, !!currentTrack)}
                            </div>

                            {/* 进度条 */}
                            <div className="flex-1 group">
                                <div
                                    className="h-2 bg-gradient-to-r from-muted to-muted/80 rounded-full cursor-pointer overflow-hidden shadow-inner hover:h-3 transition-all duration-300 border border-border/50"
                                    onClick={handleProgressClick}
                                >
                                    <div
                                        className="h-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-l-full transition-all duration-200 shadow-sm group-hover:shadow-lg"
                                        style={{
                                            width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                                        }}
                                    >
                                    </div>
                                </div>
                            </div>

                            {/* 总时长 */}
                            <div className="text-sm text-muted-foreground min-w-[3rem] text-left">
                                {(() => {
                                    // 如果当前使用的是 stream audio，显示 --:--
                                    if (currentTrack?.isUsingStreamAudio) {
                                        return '--:--';
                                    }
                                    return formatTime(duration, !!currentTrack);
                                })()}
                            </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
