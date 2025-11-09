"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Music2, Mic, Music, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformPlayer } from "@/components/ui/waveform-player";

export interface VocalRemovalProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle?: string;
  progress: number; // 0-100
  status: 'processing' | 'completed' | 'error';
  statusText?: string;
  errorMessage?: string;
  vocalUrl?: string;
  instrumentalUrl?: string;
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
}) => {
  // 播放状态管理
  const [isVocalsPlaying, setIsVocalsPlaying] = useState(false);
  const [isInstrumentalPlaying, setIsInstrumentalPlaying] = useState(false);
  const [hasVocalsError, setHasVocalsError] = useState(false);
  const [hasInstrumentalError, setHasInstrumentalError] = useState(false);

  // 根据状态决定是否可以关闭
  const canClose = status === 'completed' || status === 'error';

  // 获取状态图标
  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Music2 className="h-5 w-5 text-primary" />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    if (statusText) return statusText;
    
    switch (status) {
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
        "sm:max-w-lg",
        status === 'completed' && (vocalUrl || instrumentalUrl) && "sm:max-w-xl"
      )} onInteractOutside={(e) => {
        if (!canClose) {
          e.preventDefault();
        }
      }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {getStatusIcon()}
            <span>Separation Results</span>
          </DialogTitle>
          <DialogDescription>
            {trackTitle}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 处理中或错误时显示进度条 */}
          {status !== 'completed' && (
            <>
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
                <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
                  {errorMessage}
                </div>
              )}
            </>
          )}

          {/* 成功时显示音频 */}
          {status === 'completed' && (vocalUrl || instrumentalUrl) && (
            <div className="space-y-3">
              {/* Vocal Track */}
              {vocalUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Vocal</span>
                    </div>
                    <button
                      disabled={hasVocalsError}
                      className="p-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => !hasVocalsError && window.open(vocalUrl, '_blank')}
                    >
                      <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <WaveformPlayer
                    key={`vocals-${vocalUrl}`}
                    audioUrl={vocalUrl}
                    isPlaying={isVocalsPlaying}
                    onPlayPause={() => handleWaveformPlayPause('vocals')}
                    onFinish={handleWaveformFinish}
                    isLoading={!vocalUrl || vocalUrl.trim() === ''}
                    onLoadError={setHasVocalsError}
                    className="mt-2"
                  />
                </div>
              )}
              
              {/* Instrumental Track */}
              {instrumentalUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">Instrumental</span>
                    </div>
                    <button
                      disabled={hasInstrumentalError}
                      className="p-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => !hasInstrumentalError && window.open(instrumentalUrl, '_blank')}
                    >
                      <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                  <WaveformPlayer
                    key={`instrumental-${instrumentalUrl}`}
                    audioUrl={instrumentalUrl}
                    isPlaying={isInstrumentalPlaying}
                    onPlayPause={() => handleWaveformPlayPause('instrumental')}
                    onFinish={handleWaveformFinish}
                    isLoading={!instrumentalUrl || instrumentalUrl.trim() === ''}
                    onLoadError={setHasInstrumentalError}
                    className="mt-2"
                  />
                </div>
              )}
            </div>
          )}

          {/* 成功但没有音频 URL 时显示成功信息 */}
          {status === 'completed' && !vocalUrl && !instrumentalUrl && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-3 text-sm text-green-600 dark:text-green-400">
              Your track has been successfully processed.
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {canClose && (
          <DialogFooter className="mt-4">
            <Button
              onClick={onClose}
              size="sm"
            >
              {status === 'completed' ? 'Done' : 'Close'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

