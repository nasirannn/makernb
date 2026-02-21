'use client';

import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, GripVertical } from 'lucide-react';
import { getZIndexClass } from '@/lib/z-index';

interface WaveformPlayerProps {
  audioUrl?: string | null;
  audioBlob?: Blob | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onFinish?: () => void;
  onReadyDuration?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  showControls?: boolean;
  syncWithIsPlaying?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
  backend?: 'WebAudio' | 'MediaElement';
  isLoading?: boolean;
  onLoadError?: (hasError: boolean) => void;
  className?: string;
  externalCurrentTime?: number;
  mediaElement?: HTMLMediaElement | null;
  waveColor?: string;
  progressColor?: string;
  cursorColor?: string;
  cursorWidth?: number;
  /** 是否分离播放按钮 (如果为 true, 播放按钮将不显示在波形中) */
  separateControls?: boolean;
  /** 波形高度 */
  waveHeight?: number;
  /** 是否显示选择器（用于 Replace Section） */
  showSelector?: boolean;
  /** 选择器是否覆盖在波形上 */
  selectorOverlay?: boolean;
  /** 波形区域是否显示边框 */
  showWaveBorder?: boolean;
  /** 播放按钮样式 */
  playButtonVariant?: 'icon' | 'round';
  /** 圆形播放按钮尺寸（仅 playButtonVariant='round' 生效） */
  playButtonSize?: 'sm' | 'md' | 'lg';
  /** 是否显示容器背景/圆角等外观（默认 true） */
  chrome?: boolean;
  /** 是否显示结束手柄 */
  showSelectorEndHandle?: boolean;
  /** 选择器高亮颜色 */
  selectorColor?: string;
  /** 选择器开始时间 */
  selectorStart?: number;
  /** 选择器结束时间 */
  selectorEnd?: number;
  /** 选择器开始时间变化回调 */
  onSelectorStartChange?: (time: number) => void;
  /** 选择器结束时间变化回调 */
  onSelectorEndChange?: (time: number) => void;
  /** 手柄拖拽结束回调 */
  onSelectorHandleRelease?: (handle: "start" | "end") => void;
  /** 手柄拖拽结束后自动定位到哪个手柄，默认 both */
  seekOnSelectorHandleRelease?: "both" | "start" | "end" | "none";
  /** 是否显示手柄时间标签 */
  showSelectorLabels?: boolean;
  /** 音频总时长（用于选择器） */
  audioDuration?: number;
}

export interface WaveformPlayerHandle {
  play: () => boolean;
  pause: () => boolean;
  toggle: () => boolean;
  isPlaying: () => boolean;
  setTime: (time: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
}

export const WaveformPlayer = React.forwardRef<WaveformPlayerHandle, WaveformPlayerProps>(({
  audioUrl,
  audioBlob,
  isPlaying,
  onPlayPause,
  onFinish,
  onReadyDuration,
  onTimeUpdate,
  showControls = true,
  syncWithIsPlaying = true,
  onPlayStateChange,
  backend = 'WebAudio',
  isLoading = false,
  onLoadError,
  className = '',
  externalCurrentTime,
  mediaElement,
  waveColor = '#d1d5db',
  progressColor = 'hsl(262, 100%, 70%)',
  cursorColor = 'hsl(262, 100%, 70%)',
  cursorWidth = 2,
  separateControls = false,
  waveHeight = 60,
  showSelector = false,
  selectorOverlay = false,
  showWaveBorder = false,
  playButtonVariant = 'icon',
  playButtonSize = 'md',
  chrome = true,
  showSelectorEndHandle = true,
  selectorColor,
  selectorStart = 0,
  selectorEnd = 10,
  onSelectorStartChange,
  onSelectorEndChange,
  onSelectorHandleRelease,
  seekOnSelectorHandleRelease = "both",
  showSelectorLabels = false,
  audioDuration: propAudioDuration
}, ref) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const isReadyRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const loadAttemptRef = useRef(0);
  const lastLoadKeyRef = useRef<string | null>(null);
  const [isWaveformLoading, setIsWaveformLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // 选择器拖动状态
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const selectorBorderStyle = selectorColor ? { borderColor: selectorColor } : undefined;
  const selectorFillStyle = selectorColor ? { backgroundColor: selectorColor } : undefined;
  const selectorOverlayTintStyle = selectorColor
    ? { backgroundColor: selectorColor, opacity: 0.22 }
    : undefined;
  const effectiveProgressColor = showSelector && selectorOverlay ? waveColor : progressColor;
  const isSingleHandleSelector = showSelector && !showSelectorEndHandle;

  // 使用 prop 传入的 duration 或组件内部的 duration
  const effectiveDuration = propAudioDuration ?? duration;

  // 全局错误处理 - 捕获 WaveSurfer 内部的 fetch 错误
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // 检查是否是音频加载错误
      if (!audioUrl) return;
      if (event.message && event.message.includes('Failed to fetch') && event.message.includes(audioUrl)) {
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
        waveColor,
        progressColor: effectiveProgressColor,
        cursorColor,
        cursorWidth,
        barWidth: 2,
        barRadius: 1,
        height: waveHeight,
        normalize: true,
        backend,
        media: mediaElement || undefined,
      });

      wavesurferRef.current = wavesurfer;

      // Event listeners
      wavesurfer.on('ready', () => {
        setIsWaveformLoading(false);
        const readyDuration = wavesurfer.getDuration();
        setDuration(readyDuration);
        isReadyRef.current = true;
        if (onReadyDuration) onReadyDuration(readyDuration);
        if (onLoadError) onLoadError(false);
        if (pendingPlayRef.current) {
          try {
            wavesurfer.play();
          } catch {
            // ignore play failures on ready
          }
          pendingPlayRef.current = false;
        }
      });

      wavesurfer.on('error', (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          (error instanceof DOMException && error.name === 'AbortError') ||
          errorMessage.includes('AbortError') ||
          errorMessage.includes('BodyStreamBuffer')
        ) {
          return;
        }
        console.error('WaveSurfer error:', error);
        setIsWaveformLoading(false);
        setLoadError('Failed to load audio. The file may have expired or been deleted.');
        if (onLoadError) onLoadError(true);
      });

      wavesurfer.on('audioprocess', () => {
        const time = wavesurfer.getCurrentTime();
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      });

      wavesurfer.on('play', () => {
        if (onPlayStateChange) onPlayStateChange(true);
      });

      wavesurfer.on('pause', () => {
        if (onPlayStateChange) onPlayStateChange(false);
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
  }, [
    onFinish,
    onLoadError,
    onPlayPause,
    onPlayStateChange,
    onReadyDuration,
    onTimeUpdate,
    waveHeight,
    backend,
    mediaElement,
    waveColor,
    effectiveProgressColor,
    cursorColor,
    cursorWidth,
  ]);

  useEffect(() => {
    if (!wavesurferRef.current) return;
    try {
      wavesurferRef.current.setOptions({
        waveColor,
        progressColor: effectiveProgressColor,
        cursorColor,
        cursorWidth,
        height: waveHeight,
      });
    } catch (error) {
      console.warn('Failed to update waveform options:', error);
    }
  }, [waveColor, effectiveProgressColor, cursorColor, cursorWidth, waveHeight]);

  useEffect(() => {
    if (!wavesurferRef.current || !mediaElement) return;
    try {
      const currentMedia = wavesurferRef.current.getMediaElement?.();
      if (currentMedia !== mediaElement) {
        wavesurferRef.current.setMediaElement(mediaElement);
      }
    } catch (error) {
      console.warn('Failed to attach media element:', error);
    }
  }, [mediaElement]);

  useEffect(() => {
    if (mediaElement) return;
    if (!audioBlob && (!audioUrl || audioUrl.trim() === '')) {
      setIsWaveformLoading(false);
      setLoadError(null);
      return;
    }

    if (wavesurferRef.current) {
      const loadAudio = async () => {
        try {
          setIsWaveformLoading(true);
          setLoadError(null);
          isReadyRef.current = false;
          loadAttemptRef.current += 1;
          lastLoadKeyRef.current = audioBlob ? 'blob' : (audioUrl || null);
          if (onLoadError) onLoadError(false);
          
          if (audioBlob) {
            await wavesurferRef.current!.loadBlob(audioBlob);
          } else if (audioUrl) {
            await wavesurferRef.current!.load(audioUrl);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (
            (error instanceof DOMException && error.name === 'AbortError') ||
            errorMessage.includes('AbortError') ||
            errorMessage.includes('BodyStreamBuffer')
          ) {
            if (loadAttemptRef.current < 2 && lastLoadKeyRef.current === (audioBlob ? 'blob' : (audioUrl || null))) {
              setTimeout(() => {
                if (wavesurferRef.current) {
                  loadAudio();
                }
              }, 120);
            }
            return;
          }
          console.error('Failed to load audio:', error);
          setIsWaveformLoading(false);
          setLoadError('Failed to load audio. The file may have expired or been deleted.');
          if (onLoadError) onLoadError(true);
        }
      };
      
      loadAudio();
    }
  }, [audioBlob, audioUrl, mediaElement, onLoadError]);

  useEffect(() => {
    if (!wavesurferRef.current) return;
    if (!syncWithIsPlaying) return;

    try {
      if (isPlaying) {
        if (!isReadyRef.current) {
          pendingPlayRef.current = true;
          return;
        }
        wavesurferRef.current.play();
      } else {
        pendingPlayRef.current = false;
        wavesurferRef.current.pause();
      }
    } catch (error) {
      console.warn('Error controlling playback:', error);
    }
  }, [isPlaying, syncWithIsPlaying]);

  useEffect(() => {
    if (mediaElement) return;
    if (externalCurrentTime === undefined || externalCurrentTime === null) return;
    if (!wavesurferRef.current || !isReadyRef.current) return;
    if (isDraggingStart || isDraggingEnd) return;

    const durationValue = wavesurferRef.current.getDuration();
    if (!durationValue || !Number.isFinite(durationValue)) return;

    const clampedTime = Math.max(0, Math.min(externalCurrentTime, durationValue));
    const current = wavesurferRef.current.getCurrentTime();
    if (Math.abs(current - clampedTime) > 0.2) {
      wavesurferRef.current.seekTo(clampedTime / durationValue);
    }
    setCurrentTime(clampedTime);
  }, [externalCurrentTime, isDraggingStart, isDraggingEnd, mediaElement]);

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

  React.useImperativeHandle(ref, () => ({
    play: () => {
      if (!wavesurferRef.current) return false;
      try {
        if (!isReadyRef.current) {
          pendingPlayRef.current = true;
          return false;
        }
        wavesurferRef.current.play();
        return wavesurferRef.current.isPlaying();
      } catch {
        return false;
      }
    },
    pause: () => {
      if (!wavesurferRef.current) return false;
      try {
        pendingPlayRef.current = false;
        wavesurferRef.current.pause();
        return wavesurferRef.current.isPlaying();
      } catch {
        return false;
      }
    },
    toggle: () => {
      if (!wavesurferRef.current) return false;
      try {
        if (!isReadyRef.current) {
          pendingPlayRef.current = true;
          return false;
        }
        wavesurferRef.current.playPause();
        return wavesurferRef.current.isPlaying();
      } catch {
        return false;
      }
    },
    isPlaying: () => {
      if (!wavesurferRef.current) return false;
      return wavesurferRef.current.isPlaying();
    },
    setTime: (time: number) => {
      if (!wavesurferRef.current) return;
      try {
        wavesurferRef.current.setTime(time);
      } catch {
        // ignore seek failures
      }
    },
    getDuration: () => {
      if (!wavesurferRef.current) return 0;
      return wavesurferRef.current.getDuration();
    },
    getCurrentTime: () => {
      if (!wavesurferRef.current) return 0;
      return wavesurferRef.current.getCurrentTime();
    },
  }), []);

  // ==================== 选择器拖动逻辑 ====================
  const seekToTime = React.useCallback((time: number) => {
    if (!wavesurferRef.current || !isReadyRef.current) return;
    const durationValue = wavesurferRef.current.getDuration();
    if (!durationValue || !Number.isFinite(durationValue)) return;
    const clampedTime = Math.max(0, Math.min(time, durationValue));
    try {
      wavesurferRef.current.setTime(clampedTime);
      setCurrentTime(clampedTime);
    } catch {
      // ignore seek errors
    }
  }, []);

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

  const handleProgressBarClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingStart || isDraggingEnd) return;

      const time = getTimeFromMousePosition(e.clientX);
      const distToStart = Math.abs(time - selectorStart);
      const distToEnd = Math.abs(time - selectorEnd);

      if (!showSelectorEndHandle || distToStart < distToEnd) {
        const nextStart = Math.min(time, selectorEnd - 0.5);
        onSelectorStartChange?.(nextStart);
      } else {
        const nextEnd = Math.max(time, selectorStart + 0.5);
        onSelectorEndChange?.(nextEnd);
      }
    },
    [getTimeFromMousePosition, selectorStart, selectorEnd, isDraggingStart, isDraggingEnd, onSelectorStartChange, onSelectorEndChange, showSelectorEndHandle]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingStart) {
        const time = getTimeFromMousePosition(e.clientX);
        const nextStart = Math.max(0, Math.min(time, selectorEnd - 0.5));
        onSelectorStartChange?.(nextStart);
      } else if (isDraggingEnd) {
        const time = getTimeFromMousePosition(e.clientX);
        const nextEnd = Math.min(effectiveDuration, Math.max(time, selectorStart + 0.5));
        onSelectorEndChange?.(nextEnd);
      }
    };

    const handleMouseUp = () => {
      if (isDraggingStart) {
        onSelectorHandleRelease?.("start");
        if (seekOnSelectorHandleRelease === "both" || seekOnSelectorHandleRelease === "start") {
          seekToTime(selectorStart);
        }
      }
      if (isDraggingEnd) {
        onSelectorHandleRelease?.("end");
        if (seekOnSelectorHandleRelease === "both" || seekOnSelectorHandleRelease === "end") {
          seekToTime(selectorEnd);
        }
      }
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    if (isDraggingStart || isDraggingEnd) {
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
    getTimeFromMousePosition,
    selectorStart,
    selectorEnd,
    effectiveDuration,
    onSelectorStartChange,
    onSelectorEndChange,
    onSelectorHandleRelease,
    seekOnSelectorHandleRelease,
    seekToTime,
  ]);

  // 格式化时间为 mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const roundPlayButtonSizeClassName =
    playButtonSize === 'lg'
      ? 'h-[68px] w-[68px]'
      : playButtonSize === 'sm'
        ? 'h-8 w-8'
        : 'h-10 w-10';

  const playIconClassName =
    playButtonVariant === 'round' && playButtonSize === 'sm' ? 'w-5 h-5 fill-current' : 'w-6 h-6 fill-current';

  return (
    <div className={chrome ? `bg-muted/20 backdrop-blur-md rounded-md ${className}` : className}>
      {/* 分离的控制按钮 + 时间显示 */}
      {showControls && separateControls && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onPlayPause}
            disabled={!audioUrl || isLoading || loadError !== null}
            className={
              playButtonVariant === 'round'
                ? `flex ${roundPlayButtonSizeClassName} items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`
                : 'text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'
            }
          >
            {isPlaying ? (
              <Pause className={playIconClassName} />
            ) : (
              <Play className={playIconClassName} />
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
        {showControls && !separateControls && (
          <button
            onClick={onPlayPause}
            disabled={!audioUrl || isLoading || loadError !== null}
            className={
              playButtonVariant === 'round'
                ? `flex ${roundPlayButtonSizeClassName} items-center justify-center rounded-full bg-muted/40 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`
                : 'text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed'
            }
          >
            {isPlaying ? (
              <Pause className={playIconClassName} />
            ) : (
              <Play className={playIconClassName} />
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
          {!isLoading && ((audioBlob && audioBlob.size > 0) || (audioUrl && audioUrl.trim() !== '')) && (
            <>
              {loadError ? (
                <div className="flex items-center justify-center text-destructive text-sm" style={{ height: `${waveHeight}px` }}>
                  <div className="flex flex-col items-center gap-1">
                    <span>{loadError}</span>
                  </div>
                </div>
              ) : (
                <div className="relative w-full">
                  <div
                    ref={waveformRef}
                    className={`w-full ${showWaveBorder ? 'rounded-lg border border-primary/40' : ''}`}
                    style={{ minHeight: `${waveHeight}px`, height: `${waveHeight}px` }}
                  />
                  {isWaveformLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                  {showSelector && selectorOverlay && effectiveDuration > 0 && (
                    <div
                      className={`absolute inset-0 ${getZIndexClass('MAIN_CONTENT')} cursor-pointer select-none`}
                      style={{ userSelect: 'none' }}
                    >
                      <div
                        ref={progressBarRef}
                        className="absolute inset-0"
                        onClick={handleProgressBarClick}
                      >
                        {!isSingleHandleSelector && (
                          <div
                            className="absolute inset-y-0 rounded-2xl border-[3px] border-primary bg-transparent"
                            style={{
                              left: `${(selectorStart / effectiveDuration) * 100}%`,
                              width: `${((selectorEnd - selectorStart) / effectiveDuration) * 100}%`,
                              ...(selectorBorderStyle || {}),
                            }}
                          >
                            <div
                              className={selectorColor ? "pointer-events-none absolute inset-0" : "pointer-events-none absolute inset-0 bg-primary/25"}
                              style={selectorOverlayTintStyle}
                            />
                            <div
                              className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-primary"
                              style={selectorFillStyle}
                            >
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-[4px] border-x-transparent border-b-[6px] border-b-white/90" />
                              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-[4px] border-x-transparent border-t-[6px] border-t-white/90" />
                            </div>
                            {showSelectorEndHandle && (
                              <div
                                className="pointer-events-none absolute inset-y-0 right-0 w-[2px] bg-primary"
                                style={selectorFillStyle}
                              >
                                <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-[4px] border-x-transparent border-b-[6px] border-b-white/90" />
                                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0 w-0 border-x-[4px] border-x-transparent border-t-[6px] border-t-white/90" />
                              </div>
                            )}
                          </div>
                        )}
                        {isSingleHandleSelector && (
                          <div
                            className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-primary"
                            style={{
                              left: `${(selectorStart / effectiveDuration) * 100}%`,
                              ...(selectorFillStyle || {}),
                            }}
                          >
                            <div
                              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-7 w-5 items-center justify-center rounded-md border border-white/70 text-primary-foreground ${
                                isDraggingStart
                                  ? 'bg-primary shadow-md ring-2 ring-primary/30'
                                  : 'bg-primary/95 shadow-sm'
                              }`}
                            >
                              <GripVertical className="h-3 w-3" />
                            </div>
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary shadow-sm">
                              Start
                            </span>
                          </div>
                        )}
                        <div
                          className={`absolute inset-y-0 w-8 -translate-x-1/2 ${
                            isSingleHandleSelector ? 'cursor-grab active:cursor-grabbing' : 'cursor-ew-resize'
                          }`}
                          style={{ left: `${(selectorStart / effectiveDuration) * 100}%` }}
                          onMouseDown={handleStartHandleMouseDown}
                        />
                        {showSelectorLabels && (
                          <div
                            className="absolute top-full mt-2 -translate-x-1/2 text-xs font-mono text-muted-foreground"
                            style={{ left: `${(selectorStart / effectiveDuration) * 100}%` }}
                          >
                            {formatTime(selectorStart)}
                          </div>
                        )}
                        {showSelectorEndHandle && (
                          <div
                            className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize"
                            style={{ left: `${(selectorEnd / effectiveDuration) * 100}%` }}
                            onMouseDown={handleEndHandleMouseDown}
                          />
                        )}
                        {showSelectorLabels && showSelectorEndHandle && (
                          <div
                            className="absolute top-full mt-2 -translate-x-1/2 text-xs font-mono text-muted-foreground"
                            style={{ left: `${(selectorEnd / effectiveDuration) * 100}%` }}
                          >
                            {formatTime(selectorEnd)}
                          </div>
                        )}
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
      {showSelector && !selectorOverlay && !isLoading && audioUrl && effectiveDuration > 0 && (
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
              className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-200 hover:h-2"
              style={{
                left: `${(selectorStart / effectiveDuration) * 100}%`,
                width: `${((selectorEnd - selectorStart) / effectiveDuration) * 100}%`,
              }}
            />

            {/* 开始手柄 */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize ${getZIndexClass('MAIN_CONTENT')} group`}
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
            {showSelectorLabels && (
              <div
                className="absolute top-full mt-2 -translate-x-1/2 text-xs font-mono text-muted-foreground"
                style={{ left: `${(selectorStart / effectiveDuration) * 100}%` }}
              >
                {formatTime(selectorStart)}
              </div>
            )}

            {/* 结束手柄 */}
            {showSelectorEndHandle && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-ew-resize ${getZIndexClass('MAIN_CONTENT')} group`}
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
            )}
            {showSelectorLabels && showSelectorEndHandle && (
              <div
                className="absolute top-full mt-2 -translate-x-1/2 text-xs font-mono text-muted-foreground"
                style={{ left: `${(selectorEnd / effectiveDuration) * 100}%` }}
              >
                {formatTime(selectorEnd)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

WaveformPlayer.displayName = 'WaveformPlayer';
