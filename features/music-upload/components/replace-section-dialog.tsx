"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Play, Pause, ChevronDown } from "lucide-react";
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
  const [isFullLyricsOpen, setIsFullLyricsOpen] = useState(false);

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

  const toHandlePercent = useCallback(
    (value: number) => {
      if (!Number.isFinite(audioDuration) || audioDuration <= 0) return 0;
      return Math.max(0, Math.min(100, (value / audioDuration) * 100));
    },
    [audioDuration]
  );

  const selectorStartPercent = useMemo(() => toHandlePercent(infillStartS), [toHandlePercent, infillStartS]);
  const selectorEndPercent = useMemo(() => toHandlePercent(infillEndS), [toHandlePercent, infillEndS]);

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
      setIsFullLyricsOpen(false);
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
    setIsFullLyricsOpen(false);
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
        <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl">
          <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
          <div className="pr-8">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Replace Section
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Replace a selected part of the track. Selection must be 6–60 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 px-5 py-3">
          {/* 音频播放器和时间选择 */}
          {audioUrl && (
            <section className="space-y-3">
              <div className="flex flex-col items-center gap-2">
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <div className="truncate text-left text-sm font-semibold leading-tight tracking-tight text-foreground">
                    {trackTitle}
                  </div>
                  <div className="tabular-nums whitespace-nowrap text-right text-sm text-muted-foreground">
                    {formatClockTime(currentTime)} / {formatClockTime(audioDuration || 0)}
                  </div>
                </div>

                <div className="w-full flex items-start gap-3 pb-6">
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="inline-flex h-[68px] w-[68px] items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(0,0,0,0.22)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!audioUrl}
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6 fill-current" />
                    ) : (
                      <Play className="h-6 w-6 fill-current" />
                    )}
                  </button>

                  <div className="relative flex-1 h-[68px]">
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
                      seekOnSelectorHandleRelease="start"
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
                      cursorWidth={3}
                      audioDuration={audioDuration}
                      backend="MediaElement"
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-full mt-1 h-4">
                      <span
                        className="absolute -translate-x-1/2 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium leading-none text-foreground/80 shadow-sm"
                        style={{ left: `${selectorStartPercent}%` }}
                      >
                        {infillStartS.toFixed(2)}s
                      </span>
                      <span
                        className="absolute -translate-x-1/2 rounded-md bg-background/85 px-1.5 py-0.5 text-xs font-medium leading-none text-foreground/80 shadow-sm"
                        style={{ left: `${selectorEndPercent}%` }}
                      >
                        {infillEndS.toFixed(2)}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {!isSelectionLengthValid && (
                <div className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {audioDuration < minSegmentSeconds
                    ? `Track must be at least ${minSegmentSeconds}s to replace.`
                    : `Selection must be between ${minSegmentSeconds}s and ${Math.min(maxSegmentSeconds, Math.floor(audioDuration))}s.`}
                </div>
              )}
              {isSelectionOverHalf && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Tip: keep the replacement under 50% of the track for best results.
                </div>
              )}
            </section>
          )}

          {/* Title */}
          <section className="studio-panel-card rounded-2xl p-3 space-y-2">
            <Label htmlFor="title" className="text-xs md:text-sm font-semibold text-foreground">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter track title"
              className="h-11 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </section>

          {/* Tags/Style */}
          <section className="studio-panel-card rounded-2xl p-3 space-y-2">
            <Label htmlFor="tags" className="text-xs md:text-sm font-semibold text-foreground">Style Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., pop, acoustic, upbeat"
              className="h-11 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </section>

          {/* Prompt */}
          <section className="studio-panel-card rounded-2xl p-3 space-y-2">
            <Label htmlFor="prompt" className="text-xs md:text-sm font-semibold text-foreground">Prompt</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the music for this section..."
              rows={3}
              className="min-h-[104px] resize-y border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </section>

          {/* Lyrics */}
          <section className="studio-panel-card rounded-2xl p-3 min-h-[52px]">
            <button
              type="button"
              className="flex w-full min-h-[28px] items-center justify-between gap-3 rounded-xl p-1 text-left"
              onClick={() => setIsFullLyricsOpen((prev) => !prev)}
              aria-expanded={isFullLyricsOpen}
              aria-label="Toggle lyrics section"
            >
              <h3 className="text-xs md:text-sm font-semibold text-foreground">Lyrics</h3>
              <span className="inline-flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Optional</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    isFullLyricsOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            {isFullLyricsOpen && (
              <div className="mt-3 space-y-2">
                <Label htmlFor="fullLyrics" className="text-sm font-medium text-muted-foreground">
                  Lyrics Content
                </Label>
                <Textarea
                  id="fullLyrics"
                  value={fullLyrics}
                  onChange={(e) => setFullLyrics(e.target.value)}
                  placeholder="Enter the full lyrics with the modified section..."
                  rows={4}
                  className="min-h-[120px] resize-y border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <p className="text-sm text-muted-foreground">
                  Provide merged lyrics to keep the replaced section aligned with the full song.
                </p>
              </div>
            )}
          </section>

          {insufficientCredits && (
            <div className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Insufficient credits. You need {cost} credits but only have {credits}.
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-5 pt-1 pb-4">
          <Button
            onClick={handleConfirm}
            disabled={!isFormValid || insufficientCredits || isReplacing}
            className="h-11 w-full rounded-2xl bg-primary text-primary-foreground text-sm font-semibold transition-colors hover:bg-primary/90"
          >
            {isReplacing ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Replacing...
              </>
            ) : (
              `Replace Section • cost ${cost} credits`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReplaceSectionDialog;
