"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Play, Pause } from "lucide-react";
import { WaveformPlayer, WaveformPlayerHandle } from "@/components/ui/waveform-player";
import { getFeatureCredits } from '@/lib/credits-config';

// Replace Section API 参数接口
export interface ReplaceSectionParams {
  infillStartS: number;
  infillEndS: number;
  prompt: string;
  tags: string;
  title: string;
  fullLyrics?: string;
}

export interface ReplaceSectionDialogProps {
  /** 是否打开对话框 */
  isOpen: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 确认替换分区回调 */
  onConfirm: (params: ReplaceSectionParams) => Promise<{ taskId: string } | void> | void;
  /** 曲目标题 */
  trackTitle?: string;
  /** 曲目时长（秒） */
  trackDuration?: number;
  /** 原始曲目的风格 */
  originalStyle?: string;
  /** 音频文件 URL */
  audioUrl?: string;
  /** 用户当前积分 */
  userCredits?: number;
}

/**
 * Replace Section 对话框组件
 * 允许用户选择音乐片段进行替换
 */
export const ReplaceSectionDialog: React.FC<ReplaceSectionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  trackTitle = 'Track',
  trackDuration = 120,
  originalStyle = '',
  audioUrl,
  userCredits,
}) => {
  // ==================== 基础状态 ====================
  const [isReplacing, setIsReplacing] = useState(false);

  // ==================== 替换参数 ====================
  const [infillStartS, setInfillStartS] = useState(0);
  const [infillEndS, setInfillEndS] = useState(10);
  const [prompt, setPrompt] = useState('');
  const [tags, setTags] = useState('');
  const [title, setTitle] = useState('');
  const [fullLyrics, setFullLyrics] = useState('');

  // ==================== 音频播放器状态 ====================
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(trackDuration);
  const minSegmentSeconds = 6;
  const maxSegmentSeconds = 60;
  const waveformRef = useRef<WaveformPlayerHandle | null>(null);
  const selectionStartRef = useRef(0);
  const selectionEndRef = useRef(0);

  const formatClockTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "00:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startPlayback = useCallback(() => {
    const current = waveformRef.current?.getCurrentTime() ?? 0;
    if (current < selectionStartRef.current || current > selectionEndRef.current) {
      waveformRef.current?.setTime(selectionStartRef.current);
    }
    waveformRef.current?.play();
  }, []);

  const getDefaultEnd = useCallback(
    (duration: number) => {
      if (duration <= minSegmentSeconds) {
        return duration;
      }
      return Math.min(
        Math.max(minSegmentSeconds, Math.min(10, duration)),
        Math.min(maxSegmentSeconds, duration)
      );
    },
    [minSegmentSeconds, maxSegmentSeconds]
  );

  const clampStart = useCallback(
    (value: number) => {
      const maxStart = Math.max(0, audioDuration - minSegmentSeconds);
      return Math.max(0, Math.min(value, maxStart));
    },
    [audioDuration, minSegmentSeconds]
  );

  const clampEndForStart = useCallback(
    (startValue: number, endValue: number) => {
      const minEnd = startValue + minSegmentSeconds;
      const maxEnd = Math.min(audioDuration, startValue + maxSegmentSeconds);
      if (maxEnd < minEnd) {
        return Math.min(audioDuration, Math.max(endValue, startValue));
      }
      return Math.min(Math.max(endValue, minEnd), maxEnd);
    },
    [audioDuration, minSegmentSeconds, maxSegmentSeconds]
  );

  const handleStartChange = useCallback(
    (value: number) => {
      const nextStart = clampStart(value);
      const nextEnd = clampEndForStart(nextStart, infillEndS);
      setInfillStartS(nextStart);
      setInfillEndS(nextEnd);
    },
    [clampStart, clampEndForStart, infillEndS]
  );

  const handleEndChange = useCallback(
    (value: number) => {
      const minEnd = infillStartS + minSegmentSeconds;
      const maxEnd = Math.min(audioDuration, infillStartS + maxSegmentSeconds);
      let nextEnd = Math.min(Math.max(value, minEnd), maxEnd);
      if (maxEnd < minEnd) {
        nextEnd = Math.min(audioDuration, Math.max(value, infillStartS));
      }
      setInfillEndS(nextEnd);
    },
    [audioDuration, infillStartS, maxSegmentSeconds, minSegmentSeconds]
  );

  // 播放/暂停切换
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      waveformRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    startPlayback();
  }, [isPlaying, startPlayback]);

  // 播放结束
  const handleFinish = useCallback(() => {
    setIsPlaying(false);
    waveformRef.current?.setTime(selectionStartRef.current);
    setCurrentTime(selectionStartRef.current);
  }, []);

  // ==================== 初始化默认值 ====================
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTags('');
      setAudioDuration(trackDuration);
      setCurrentTime(0);
      // 默认替换前10秒
      setInfillStartS(0);
      setInfillEndS(getDefaultEnd(trackDuration));
    }
  }, [getDefaultEnd, isOpen, trackTitle, originalStyle, trackDuration]);

  // 重置状态
  const resetState = useCallback(() => {
    setIsReplacing(false);
    setInfillStartS(0);
    setInfillEndS(10);
    setPrompt('');
    setTags('');
    setTitle('');
    setFullLyrics('');
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  // 关闭对话框
  const handleClose = useCallback(() => {
    waveformRef.current?.pause();
    setIsPlaying(false);
    resetState();
    onClose();
  }, [onClose, resetState]);

  useEffect(() => {
    selectionStartRef.current = infillStartS;
  }, [infillStartS]);

  useEffect(() => {
    selectionEndRef.current = infillEndS;
  }, [infillEndS]);

  // 计算积分
  const credits = userCredits ?? null;
  const cost = getFeatureCredits('replace_section');
  const insufficientCredits = credits !== null && credits < cost;
  const selectionLength = Math.max(0, infillEndS - infillStartS);
  const isSelectionLengthValid =
    selectionLength >= minSegmentSeconds &&
    selectionLength <= Math.min(maxSegmentSeconds, audioDuration);
  const isSelectionOverHalf = audioDuration > 0 && selectionLength > audioDuration * 0.5;

  // 表单验证
  const isFormValid =
    prompt.trim() !== '' &&
    tags.trim() !== '' &&
    title.trim() !== '' &&
    infillStartS < infillEndS &&
    infillEndS <= audioDuration &&
    isSelectionLengthValid;

  // 提交处理
  const handleConfirm = async () => {
    if (!isFormValid || insufficientCredits) return;

    const params: ReplaceSectionParams = {
      infillStartS: Number(infillStartS.toFixed(2)),
      infillEndS: Number(infillEndS.toFixed(2)),
      prompt,
      tags,
      title,
      fullLyrics,
    };

    setIsReplacing(true);

    // 停止音频播放
    setIsPlaying(false);

    try {
      const result = await onConfirm(params);
      if (result && result.taskId) {
        handleClose();
      }
    } catch (error) {
      console.error('Replace section error:', error);
    } finally {
      setIsReplacing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden p-0 border border-border/60 bg-background shadow-xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-border/40 text-left relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="flex items-center justify-between pr-8">
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Replace Section
              </div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Replace Section
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Replace a section of &ldquo;{trackTitle}&rdquo; with new content
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 px-6 py-2">
          {/* 音频播放器和时间选择 */}
          {audioUrl && (
            <div className="space-y-2">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-full text-left text-sm font-medium text-muted-foreground">
                  {title || trackTitle || "Untitled"}
                </div>
                <div className="flex w-full items-baseline justify-between gap-3">
                  <div className="text-left text-lg font-mono tracking-widest text-foreground">
                    {formatClockTime(currentTime)} / {formatClockTime(audioDuration || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Selection must be 6–60 seconds.
                  </div>
                </div>

                <div className="w-full flex items-center gap-4 items-stretch">
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="flex h-[68px] w-[68px] items-center justify-center rounded-full border border-primary/40 bg-transparent text-primary shadow-sm transition-colors hover:bg-white/5"
                    disabled={!audioUrl}
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6 fill-current" />
                    ) : (
                      <Play className="h-6 w-6 fill-current" />
                    )}
                  </button>

                  <div className="flex-1 h-[68px]">
                    <WaveformPlayer
                      ref={waveformRef}
                      audioUrl={audioUrl}
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onFinish={handleFinish}
                      onReadyDuration={(readyDuration) => {
                        setAudioDuration(readyDuration);
                        setInfillStartS(0);
                        setInfillEndS(getDefaultEnd(readyDuration));
                      }}
                      onTimeUpdate={(time) => {
                        setCurrentTime(time);
                        if (isPlaying && time >= selectionEndRef.current - 0.02) {
                          waveformRef.current?.pause();
                          waveformRef.current?.setTime(selectionStartRef.current);
                          setIsPlaying(false);
                          setCurrentTime(selectionStartRef.current);
                        }
                      }}
                      onPlayStateChange={(playing) => setIsPlaying(playing)}
                      showControls={false}
                      separateControls={false}
                      showSelector={true}
                      selectorOverlay={true}
                      showSelectorLabels={false}
                      selectorStart={infillStartS}
                      selectorEnd={infillEndS}
                      onSelectorStartChange={handleStartChange}
                      onSelectorEndChange={handleEndChange}
                      onSelectorHandleRelease={(handle) => {
                        if (handle !== "end") return;
                        waveformRef.current?.setTime(selectionStartRef.current);
                        waveformRef.current?.pause();
                        setIsPlaying(false);
                        setCurrentTime(selectionStartRef.current);
                      }}
                      waveHeight={60}
                      waveColor="rgba(255, 255, 255, 0.35)"
                      progressColor="rgb(255, 255, 255)"
                      cursorColor="rgb(255, 255, 255)"
                      cursorWidth={3}
                      audioDuration={audioDuration}
                      backend="MediaElement"
                    />
                  </div>
                </div>
              </div>

              {/* 时间范围手动输入 */}
              <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">Range</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={Math.max(0, infillEndS - minSegmentSeconds)}
                    step={0.01}
                    value={infillStartS.toFixed(2)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        handleStartChange(value);
                      }
                    }}
                    className="w-20 h-7 text-center px-2"
                  />
                  <span className="text-muted-foreground/80">to</span>
                  <Input
                    type="number"
                    min={infillStartS + minSegmentSeconds}
                    max={Math.min(audioDuration, infillStartS + maxSegmentSeconds)}
                    step={0.01}
                    value={infillEndS.toFixed(2)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        handleEndChange(value);
                      }
                    }}
                    className="w-20 h-7 text-center px-2"
                  />
                  <span className="text-muted-foreground/80">sec</span>
                </div>
                <span className="whitespace-nowrap text-muted-foreground/80">
                  {selectionLength.toFixed(2)}s
                </span>
              </div>
              {!isSelectionLengthValid && (
                <div className="text-xs text-destructive">
                  {audioDuration < minSegmentSeconds
                    ? `Track must be at least ${minSegmentSeconds}s to replace.`
                    : `Selection must be between ${minSegmentSeconds}s and ${Math.min(maxSegmentSeconds, Math.floor(audioDuration))}s.`}
                </div>
              )}
              {isSelectionOverHalf && (
                <div className="text-xs text-muted-foreground">
                  Tip: keep the replacement under 50% of the track for best results.
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter track title"
            />
          </div>

          {/* Tags/Style */}
          <div className="space-y-1">
            <Label htmlFor="tags">Style Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., pop, acoustic, upbeat"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the music for this section..."
              rows={3}
            />
          </div>

          {/* Full Lyrics */}
          <div className="space-y-1">
            <Label htmlFor="fullLyrics">Full Lyrics (optional)</Label>
            <Textarea
              id="fullLyrics"
              value={fullLyrics}
              onChange={(e) => setFullLyrics(e.target.value)}
              placeholder="Enter the full lyrics with the modified section..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Provide merged lyrics to keep the replaced section aligned with the full song.
            </p>
          </div>

          {insufficientCredits && (
            <p className="text-sm text-destructive">
              Insufficient credits. You need {cost} credits but only have {credits}.
            </p>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-6 pt-3 pb-4 border-t border-border/40">
          <Button
            onClick={handleConfirm}
            disabled={!isFormValid || insufficientCredits || isReplacing}
            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {isReplacing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Replacing...
              </>
            ) : (
              `Replace Section (-${cost} credits)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReplaceSectionDialog;
