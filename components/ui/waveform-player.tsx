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
  /** 是否分离播放按钮 (如果为 true, 播放按钮将不显示在波形中) */
  separateControls?: boolean;
  /** 波形高度 */
  waveHeight?: number;
  /** 是否显示选择器（用于 Replace Section） */
  showSelector?: boolean;
  /** 选择器开始时间 */
  selectorStart?: number;
  /** 选择器结束时间 */
  selectorEnd?: number;
  /** 选择器开始时间变化回调 */
  onSelectorStartChange?: (time: number) => void;
  /** 选择器结束时间变化回调 */
  onSelectorEndChange?: (time: number) => void;
  /** 音频总时长（用于选择器） */
  audioDuration?: number;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  audioUrl,
  isPlaying,
  onPlayPause,
  onFinish,
  isLoading = false,
  onLoadError,
  className = '',
  separateControls = false,
  waveHeight = 60,
  showSelector = false,
  selectorStart = 0,
  selectorEnd = 10,
  onSelectorStartChange,
  onSelectorEndChange,
  audioDuration: propAudioDuration
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // 选择器拖动状态
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingBar, setIsDraggingBar] = useState(false);

  // 使用 prop 传入的 duration 或组件内部的 duration
  const effectiveDuration = propAudioDuration ?? duration;

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
        height: waveHeight,
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
  }, [onFinish, onLoadError, onPlayPause, waveHeight]);

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

  // ==================== 选择器拖动逻辑 ====================
  const getTimeFromMousePosition = React.useCallback(
    (clientX: number): number => {
      if (!progressBarRef.current) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return percentage * effectiveDuration;
    },
    [effectiveDuration]
  );

  const handleStartHandleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStart(true);
  }, []);

  const handleEndHandleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnd(true);
  }, []);

  const handleBarMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBar(true);
  }, []);

  const handleProgressBarClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingStart || isDraggingEnd || isDraggingBar) return;

      const time = getTimeFromMousePosition(e.clientX);
      const distToStart = Math.abs(time - selectorStart);
      const distToEnd = Math.abs(time - selectorEnd);

      if (distToStart < distToEnd) {
        onSelectorStartChange?.(Math.min(time, selectorEnd - 0.5));
      } else {
        onSelectorEndChange?.(Math.max(time, selectorStart + 0.5));
      }
    },
    [getTimeFromMousePosition, selectorStart, selectorEnd, isDraggingStart, isDraggingEnd, isDraggingBar, onSelectorStartChange, onSelectorEndChange]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingStart) {
        const time = getTimeFromMousePosition(e.clientX);
        onSelectorStartChange?.(Math.max(0, Math.min(time, selectorEnd - 0.5)));
      } else if (isDraggingEnd) {
        const time = getTimeFromMousePosition(e.clientX);
        onSelectorEndChange?.(Math.min(effectiveDuration, Math.max(time, selectorStart + 0.5)));
      } else if (isDraggingBar) {
        const time = getTimeFromMousePosition(e.clientX);
        const duration = selectorEnd - selectorStart;
        const halfDuration = duration / 2;

        let newStart = time - halfDuration;
        let newEnd = time + halfDuration;

        if (newStart < 0) {
          newStart = 0;
          newEnd = duration;
        } else if (newEnd > effectiveDuration) {
          newEnd = effectiveDuration;
          newStart = effectiveDuration - duration;
        }

        onSelectorStartChange?.(newStart);
        onSelectorEndChange?.(newEnd);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingBar(false);
    };

    if (isDraggingStart || isDraggingEnd || isDraggingBar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [
    isDraggingStart,
    isDraggingEnd,
    isDraggingBar,
    getTimeFromMousePosition,
    selectorStart,
    selectorEnd,
    effectiveDuration,
    onSelectorStartChange,
    onSelectorEndChange,
  ]);

  // 格式化时间为 mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-muted/20 backdrop-blur-md border border-border/20 rounded-xl p-4 ${className}`}>
      {/* 分离的控制按钮 + 时间显示 */}
      {separateControls && (
        <div className="flex items-center gap-3 mb-3">
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

          {/* 时间显示 */}
          <div className="text-sm text-muted-foreground font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      )}

      {/* Waveform and Controls */}
      <div className="flex items-center gap-3">
        {!separateControls && (
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
        )}

        <div className="flex-1">
          {/* 状态1: Loading - 显示圆点加载指示器 */}
          {isLoading && (
            <div className="flex items-center gap-2" style={{ height: `${waveHeight}px` }}>
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
                <div className="flex items-center justify-center text-destructive text-sm" style={{ height: `${waveHeight}px` }}>
                  <div className="flex flex-col items-center gap-1">
                    <span>{loadError}</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full">
                  <div ref={waveformRef} className="w-full" style={{ minHeight: `${waveHeight}px` }} />
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
            <div className="flex items-center" style={{ height: `${waveHeight}px` }}>
              <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                <div className="h-full bg-muted/40 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 选择器进度条 - 在波形下方 */}
      {showSelector && !isLoading && audioUrl && effectiveDuration > 0 && (
        <div className="mt-4">
          <div
            ref={progressBarRef}
            className="relative h-8 cursor-pointer select-none"
            onClick={handleProgressBarClick}
            style={{ userSelect: 'none' }}
          >
            {/* 底层轨道 */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-white/10 rounded-full" />

            {/* 选中区域 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-primary/80 to-primary rounded-full cursor-move transition-all duration-200 hover:h-2"
              style={{
                left: `${(selectorStart / effectiveDuration) * 100}%`,
                width: `${((selectorEnd - selectorStart) / effectiveDuration) * 100}%`,
              }}
              onMouseDown={handleBarMouseDown}
            />

            {/* 开始手柄 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize z-10 group"
              style={{ left: `${(selectorStart / effectiveDuration) * 100}%` }}
              onMouseDown={handleStartHandleMouseDown}
            >
              <div className="w-3 h-6 bg-primary rounded shadow-md border border-primary-foreground/20 transition-all duration-200 hover:scale-110 hover:shadow-lg group-active:scale-95 flex items-center justify-center">
                <div className="flex flex-col gap-0.5">
                  <div className="w-0.5 h-2 bg-primary-foreground/60 rounded-full" />
                  <div className="w-0.5 h-2 bg-primary-foreground/60 rounded-full" />
                </div>
              </div>
            </div>

            {/* 结束手柄 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize z-10 group"
              style={{ left: `${(selectorEnd / effectiveDuration) * 100}%` }}
              onMouseDown={handleEndHandleMouseDown}
            >
              <div className="w-3 h-6 bg-primary rounded shadow-md border border-primary-foreground/20 transition-all duration-200 hover:scale-110 hover:shadow-lg group-active:scale-95 flex items-center justify-center">
                <div className="flex flex-col gap-0.5">
                  <div className="w-0.5 h-2 bg-primary-foreground/60 rounded-full" />
                  <div className="w-0.5 h-2 bg-primary-foreground/60 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
