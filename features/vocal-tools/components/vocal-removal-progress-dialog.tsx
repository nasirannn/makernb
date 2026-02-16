"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AudioLines, Loader2, Mic, Music, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { CLIENT_VOCAL_SEPARATION_CREDITS } from "@/lib/credits-config";

export interface VocalRemovalProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle?: string;
  progress: number; // 0-100
  status: 'checking' | 'ready' | 'processing' | 'completed' | 'error';
  statusText?: string;
  errorMessage?: string;
  vocalUrl?: string;
  instrumentalUrl?: string;
  onReSeparate?: () => void;
  onStartSeparation?: () => void;
}

/**
 * Vocal Removal 进度弹窗组件
 * 用于显示人声移除的进度和状态
 */
export const VocalRemovalProgressDialog: React.FC<VocalRemovalProgressDialogProps> = ({
  isOpen,
  onClose,
  trackTitle = 'Track',
  progress,
  status,
  statusText,
  errorMessage,
  vocalUrl,
  instrumentalUrl,
  onReSeparate,
  onStartSeparation,
}) => {
  // 播放状态管理
  const [isVocalsPlaying, setIsVocalsPlaying] = useState(false);
  const [isInstrumentalPlaying, setIsInstrumentalPlaying] = useState(false);
  const [hasVocalsError, setHasVocalsError] = useState(false);
  const [hasInstrumentalError, setHasInstrumentalError] = useState(false);

  // 根据状态决定是否可以关闭（processing 时避免误关）
  const canClose = status !== 'processing';
  const canTriggerAction = status !== 'checking' && status !== 'processing';
  const hasActionHandler = status === 'completed' ? !!onReSeparate : !!onStartSeparation;
  const actionDisabled = !canTriggerAction || !hasActionHandler;
  const creditCost = CLIENT_VOCAL_SEPARATION_CREDITS.studio;
  const handleAction = () => {
    if (status === 'completed') {
      onReSeparate?.();
      return;
    }
    onStartSeparation?.();
  };

  // 获取状态文本
  const getStatusText = () => {
    if (statusText) return statusText;

    switch (status) {
      case 'checking':
        return 'Checking existing results...';
      case 'ready':
        return 'No existing separation results found.';
      case 'processing':
        return 'Removing vocals from track...';
      case 'completed':
        return 'Vocal removal completed!';
      case 'error':
        return 'Vocal removal failed';
      default:
        return 'Processing...';
    }
  };

  // 处理波形播放器播放/暂停
  const handleWaveformPlayPause = (audioType: 'vocals' | 'instrumental') => {
    if (audioType === 'vocals') {
      if (isVocalsPlaying) {
        // 暂停 vocals
        setIsVocalsPlaying(false);
      } else {
        // 停止 instrumental 并播放 vocals
        setIsInstrumentalPlaying(false);
        setIsVocalsPlaying(true);
      }
    } else if (audioType === 'instrumental') {
      if (isInstrumentalPlaying) {
        // 暂停 instrumental
        setIsInstrumentalPlaying(false);
      } else {
        // 停止 vocals 并播放 instrumental
        setIsVocalsPlaying(false);
        setIsInstrumentalPlaying(true);
      }
    }
  };

  // 处理音频播放完成
  const handleWaveformFinish = () => {
    setIsVocalsPlaying(false);
    setIsInstrumentalPlaying(false);
  };

  // 当弹窗关闭时重置播放状态
  useEffect(() => {
    if (!isOpen) {
      setIsVocalsPlaying(false);
      setIsInstrumentalPlaying(false);
      setHasVocalsError(false);
      setHasInstrumentalError(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && canClose) {
        onClose();
      }
    }}>
      <DialogContent className={cn(
        "studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[760px] max-h-[84vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl"
      )} onInteractOutside={(e) => {
        if (!canClose) {
          e.preventDefault();
        }
      }}>
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
          <div className="space-y-1 pr-8">
            <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Vocal Separation
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Vocal Separation
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Separate track into vocal and instrumental.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 px-5 py-3">
          {/* No existing result placeholder */}
          {status === 'ready' && (
            <section className="studio-panel-card rounded-2xl p-6 text-center">
              <div className="mb-4 flex justify-center">
                <AudioLines className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-foreground">No separation results yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start vocal separation to generate vocal and instrumental tracks.
              </p>
            </section>
          )}

          {/* Checking placeholder (no progress bar) */}
          {status === 'checking' && (
            <section className="studio-panel-card rounded-2xl p-6 text-center">
              <div className="mb-4 flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <p className="text-base font-medium text-foreground">Vocal Separation</p>
              <p className="mt-1 text-sm text-muted-foreground">Checking existing results...</p>
            </section>
          )}

          {/* processing/error 时显示进度条 */}
          {status !== 'completed' && status !== 'ready' && status !== 'checking' && (
            <section className="studio-panel-card rounded-2xl p-3 space-y-3">
              {/* 进度条 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{getStatusText()}</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  className={cn(
                    "h-2",
                    status === 'error' && "[&>div]:bg-red-500"
                  )}
                />
              </div>

              {/* 错误信息 */}
              {status === 'error' && errorMessage && (
                <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}
            </section>
          )}

          {/* 成功时显示音频 */}
          {status === 'completed' && (vocalUrl || instrumentalUrl) && (
            <div className="space-y-3">
              {/* Vocal Track */}
              {vocalUrl && (
                <section className="studio-panel-card space-y-2.5 rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mic className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Vocal</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={hasVocalsError}
                      className="studio-panel-card h-8 gap-1 rounded-full px-3 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      onClick={() => !hasVocalsError && window.open(vocalUrl, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </Button>
                  </div>
                  <WaveformPlayer
                    key={`vocals-${vocalUrl}`}
                    audioUrl={vocalUrl}
                    isPlaying={isVocalsPlaying}
                    onPlayPause={() => handleWaveformPlayPause('vocals')}
                    onFinish={handleWaveformFinish}
                    isLoading={!vocalUrl || vocalUrl.trim() === ''}
                    onLoadError={setHasVocalsError}
                    backend="MediaElement"
                    playButtonVariant="icon"
                    waveHeight={56}
                    className="pl-2"
                  />
                  {hasVocalsError && (
                    <p className="text-xs text-red-500">Failed to load vocal track.</p>
                  )}
                </section>
              )}

              {/* Instrumental Track */}
              {instrumentalUrl && (
                <section className="studio-panel-card space-y-2.5 rounded-2xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Music className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Instrumental</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={hasInstrumentalError}
                      className="studio-panel-card h-8 gap-1 rounded-full px-3 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      onClick={() => !hasInstrumentalError && window.open(instrumentalUrl, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </Button>
                  </div>
                  <WaveformPlayer
                    key={`instrumental-${instrumentalUrl}`}
                    audioUrl={instrumentalUrl}
                    isPlaying={isInstrumentalPlaying}
                    onPlayPause={() => handleWaveformPlayPause('instrumental')}
                    onFinish={handleWaveformFinish}
                    isLoading={!instrumentalUrl || instrumentalUrl.trim() === ''}
                    onLoadError={setHasInstrumentalError}
                    backend="MediaElement"
                    playButtonVariant="icon"
                    waveHeight={56}
                    className="pl-2"
                  />
                  {hasInstrumentalError && (
                    <p className="text-xs text-red-500">Failed to load instrumental track.</p>
                  )}
                </section>
              )}
            </div>
          )}

          {/* 成功但没有音频 URL 时显示成功信息 */}
          {status === 'completed' && !vocalUrl && !instrumentalUrl && (
            <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              Your track has been successfully processed.
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="flex-shrink-0 px-5 pt-1 pb-4">
          <Button
            onClick={handleAction}
            className="h-11 w-full rounded-2xl text-sm font-semibold"
            disabled={actionDisabled || !canClose}
          >
            Start Separate • cost {creditCost} credits
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
