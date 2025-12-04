"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, CreditCard, Scissors } from "lucide-react";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { getFeatureCredits } from '@/lib/credits-config';

// Replace Section API 参数接口
export interface ReplaceSectionParams {
  infillStartS: number;
  infillEndS: number;
  prompt: string;
  tags: string;
  title: string;
  fullLyrics: string;
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
  const audioDuration = trackDuration;

  // 播放/暂停切换
  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // 播放结束
  const handleFinish = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // ==================== 初始化默认值 ====================
  useEffect(() => {
    if (isOpen) {
      setTitle(trackTitle || 'Untitled Track');
      setTags(originalStyle || '');
      // 默认替换前10秒
      setInfillStartS(0);
      setInfillEndS(Math.min(10, trackDuration));
    }
  }, [isOpen, trackTitle, originalStyle, trackDuration]);

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
  }, []);

  // 关闭对话框
  const handleClose = useCallback(() => {
    setIsPlaying(false);
    resetState();
    onClose();
  }, [onClose, resetState]);

  // 计算积分
  const credits = userCredits ?? null;
  const cost = getFeatureCredits('replace_section');
  const insufficientCredits = credits !== null && credits < cost;

  // 表单验证
  const isFormValid =
    prompt.trim() !== '' &&
    tags.trim() !== '' &&
    title.trim() !== '' &&
    fullLyrics.trim() !== '' &&
    infillStartS < infillEndS &&
    infillEndS <= audioDuration;

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
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
        <AlertDialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <AlertDialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              Replace Section
            </AlertDialogTitle>
            <button
              onClick={handleClose}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <AlertDialogDescription>
            Replace a section of &ldquo;{trackTitle}&rdquo; with new content
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* 音频播放器和时间选择 */}
          {audioUrl && (
            <div className="space-y-4">
              {/* WaveformPlayer 播放器（包含选择器） */}
              <WaveformPlayer
                audioUrl={audioUrl}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onFinish={handleFinish}
                separateControls={true}
                waveHeight={40}
                showSelector={true}
                selectorStart={infillStartS}
                selectorEnd={infillEndS}
                onSelectorStartChange={setInfillStartS}
                onSelectorEndChange={setInfillEndS}
                audioDuration={audioDuration}
              />

              {/* 时间范围手动输入 */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>Start from</span>
                <Input
                  type="number"
                  min={0}
                  max={infillEndS - 0.5}
                  step={0.01}
                  value={infillStartS.toFixed(2)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      setInfillStartS(Math.max(0, Math.min(value, infillEndS - 0.5)));
                    }
                  }}
                  className="w-20 h-8 text-center px-2"
                />
                <span>to</span>
                <Input
                  type="number"
                  min={infillStartS + 0.5}
                  max={audioDuration}
                  step={0.01}
                  value={infillEndS.toFixed(2)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value)) {
                      setInfillEndS(Math.min(audioDuration, Math.max(value, infillStartS + 0.5)));
                    }
                  }}
                  className="w-20 h-8 text-center px-2"
                />
                <span>seconds</span>
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter track title"
            />
          </div>

          {/* Tags/Style */}
          <div className="space-y-2">
            <Label htmlFor="tags">Style Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., pop, acoustic, upbeat"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label htmlFor="fullLyrics">Full Lyrics</Label>
            <Textarea
              id="fullLyrics"
              value={fullLyrics}
              onChange={(e) => setFullLyrics(e.target.value)}
              placeholder="Enter the full lyrics with the modified section..."
              rows={4}
            />
          </div>

          {/* Credits */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cost:</span>
              </div>
              <span className="font-semibold text-primary">{cost} credits</span>
            </div>
            {credits !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your balance:</span>
                <span className={`font-medium ${insufficientCredits ? 'text-destructive' : 'text-foreground'}`}>
                  {credits} credits
                </span>
              </div>
            )}
          </div>

          {insufficientCredits && (
            <p className="text-sm text-destructive">
              Insufficient credits. You need {cost} credits but only have {credits}.
            </p>
          )}
        </div>

        <AlertDialogFooter className="flex-shrink-0 pt-4">
          <AlertDialogAction
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
              'Replace Section'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ReplaceSectionDialog;
