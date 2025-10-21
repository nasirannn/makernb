'use client';

import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';

interface WaveformPlayerProps {
  audioUrl?: string | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onFinish?: () => void;
  isLoading?: boolean;
  onLoadError?: (hasError: boolean) => void;
  className?: string;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioUrl,
  isPlaying,
  onPlayPause,
  onFinish,
  isLoading = false,
  onLoadError,
  className = ''
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // 全局错误处理 - 捕获 WaveSurfer 内部的 fetch 错误
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // 检查是否是音频加载错误
      if (event.message && event.message.includes('Failed to fetch') && event.message.includes(audioUrl || '')) {
        event.preventDefault(); // 阻止错误冒泡到 Next.js 的错误边界
        console.warn('Audio load error caught:', event.message);
        setLoadError('Failed to load audio. The file may have expired or been deleted.');
        setIsWaveformLoading(false);
        if (onLoadError) onLoadError(true);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [audioUrl, onLoadError]);

  useEffect(() => {
    if (!waveformRef.current) {
      return;
    }
    if (wavesurferRef.current) {
      return;
    }
    
    // 清空容器，确保没有残留的 WaveSurfer 元素
    waveformRef.current.innerHTML = '';
    
    try {
      // Initialize WaveSurfer
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#d1d5db',
        progressColor: 'hsl(262, 100%, 70%)',
        cursorColor: 'hsl(262, 100%, 70%)',
        barWidth: 2,
        barRadius: 1,
        height: 60,
        normalize: true,
      });

      wavesurferRef.current = wavesurfer;

      // Event listeners
      wavesurfer.on('ready', () => {
        setIsWaveformLoading(false);
        setDuration(wavesurfer.getDuration());
        if (onLoadError) onLoadError(false);
      });

      wavesurfer.on('error', (error) => {
        console.error('WaveSurfer error:', error);
        setIsWaveformLoading(false);
        setLoadError('Failed to load audio. The file may have expired or been deleted.');
        if (onLoadError) onLoadError(true);
      });

      wavesurfer.on('audioprocess', () => {
        setCurrentTime(wavesurfer.getCurrentTime());
      });

      wavesurfer.on('finish', () => {
        if (onFinish) {
          onFinish();
        } else {
          onPlayPause();
        }
      });
    } catch (error) {
      console.error('Failed to initialize WaveSurfer:', error);
      setLoadError('Failed to initialize audio player.');
    }
  }, []);

  useEffect(() => {
    if (!audioUrl || audioUrl.trim() === '') {
      setIsWaveformLoading(false);
      setLoadError(null);
      return;
    }

    if (wavesurferRef.current) {
      const loadAudio = async () => {
        try {
          setIsWaveformLoading(true);
          setLoadError(null);
          if (onLoadError) onLoadError(false);
          
          await wavesurferRef.current!.load(audioUrl);
        } catch (error) {
          console.error('Failed to load audio:', error);
          setIsWaveformLoading(false);
          setLoadError('Failed to load audio. The file may have expired or been deleted.');
          if (onLoadError) onLoadError(true);
        }
      };
      
      loadAudio();
    }
  }, [audioUrl, onLoadError]);

  useEffect(() => {
    if (!wavesurferRef.current) return;

    try {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    } catch (error) {
      console.warn('Error controlling playback:', error);
    }
  }, [isPlaying]);

  // 组件卸载时的清理
  useEffect(() => {
    return () => {
      // 不在清理函数中销毁，让浏览器自然回收
      // 只清空引用即可
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.pause();
        } catch (error) {
          // 忽略暂停错误
        }
        wavesurferRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`bg-background/30 backdrop-blur-md border border-border/20 rounded-xl p-4 ${className}`}>
      {/* Waveform and Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPlayPause}
          disabled={!audioUrl || isLoading || loadError !== null}
          className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current" />
          )}
        </button>

        <div className="flex-1">
          {/* 状态1: Loading - 显示圆点加载指示器 */}
          {isLoading && (
            <div className="flex items-center gap-2 h-[60px]">
              <div className="flex-1 flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}

          {/* 状态2: 有音频链接 - 显示波形图 */}
          {!isLoading && audioUrl && audioUrl.trim() !== '' && (
            <>
              {loadError ? (
                <div className="flex items-center justify-center h-[60px] text-destructive text-sm">
                  <div className="flex flex-col items-center gap-1">
                    <span>{loadError}</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full">
                  <div ref={waveformRef} className="w-full" style={{ minHeight: '60px' }} />
                  {isWaveformLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 状态3: 默认状态 - 显示普通进度条 */}
          {!isLoading && (!audioUrl || audioUrl.trim() === '') && (
            <div className="flex items-center h-[60px]">
              <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                <div className="h-full bg-muted/40 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
