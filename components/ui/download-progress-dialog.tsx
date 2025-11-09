"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Download, CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";

export interface DownloadProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle?: string;
  progress: number; // 0-100
  status: 'preparing' | 'generating' | 'downloading' | 'completed' | 'error';
  statusText?: string;
  errorMessage?: string;
}

/**
 * 下载进度弹窗组件
 * 用于显示 WAV 下载的进度和状态
 */
export const DownloadProgressDialog: React.FC<DownloadProgressDialogProps> = ({
  isOpen,
  onClose,
  trackTitle = 'Track',
  progress,
  status,
  statusText,
  errorMessage,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md border-0">
        {status === 'completed' ? (
          // 成功状态 - 优化后的样式
          <div className="py-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* 成功图标 - 大号带动画 */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-primary rounded-full p-4 shadow-lg">
                  <CheckCircle2 className="h-12 w-12 text-primary-foreground" />
                </div>
                <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-primary animate-pulse" />
              </div>

              {/* 成功标题 */}
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-foreground">
                  Download Complete!
                </h3>
                <p className="text-sm text-muted-foreground">
                  {trackTitle}
                </p>
              </div>

              {/* 成功消息 */}
              <div className="w-full rounded-lg bg-primary/10 dark:bg-primary/20 p-4 border border-primary/30 dark:border-primary/30">
                <p className="text-sm font-medium text-primary dark:text-primary-foreground">
                  Your WAV file has been downloaded successfully.
                </p>
              </div>

              {/* 操作按钮 */}
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        ) : status === 'preparing' ? (
          // 准备状态 - 优化后的样式
          <div className="py-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* 准备图标 - 大号带动画 */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-primary/10 dark:bg-primary/20 rounded-full p-4 shadow-lg">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
              </div>

              {/* 准备标题 */}
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-foreground">
                  Preparing Download
                </h3>
                <p className="text-sm text-muted-foreground">
                  {trackTitle}
                </p>
              </div>

              {/* 准备消息 */}
              <div className="w-full rounded-lg bg-muted/50 dark:bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  {statusText || 'Setting up your download...'}
                </p>
              </div>
            </div>
          </div>
        ) : status === 'generating' ? (
          // 生成中状态 - 优化后的样式
          <div className="py-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* 生成图标 - 大号带动画 */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-primary/10 dark:bg-primary/20 rounded-full p-4 shadow-lg">
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                </div>
              </div>

              {/* 生成标题 */}
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-foreground">
                  Generating WAV File
                </h3>
                <p className="text-sm text-muted-foreground">
                  {trackTitle}
                </p>
              </div>

              {/* 进度条 */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {statusText || 'Creating your audio file...'}
                  </span>
                  <span className="font-medium text-primary">{Math.round(progress)}%</span>
                </div>
                <Progress 
                  value={progress} 
                  className="h-2.5"
                />
              </div>

              {/* 状态消息 */}
              <div className="w-full rounded-lg bg-muted/50 dark:bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Please wait while we generate your WAV file...
                </p>
              </div>
            </div>
          </div>
        ) : status === 'downloading' ? (
          // 下载中状态 - 优化后的样式
          <div className="py-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* 下载图标 - 大号带动画 */}
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-primary/10 dark:bg-primary/20 rounded-full p-4 shadow-lg">
                  <Download className="h-12 w-12 text-primary animate-bounce" />
                </div>
              </div>

              {/* 下载标题 */}
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-foreground">
                  Downloading File
                </h3>
                <p className="text-sm text-muted-foreground">
                  {trackTitle}
                </p>
              </div>

              {/* 进度条 */}
              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {statusText || 'Downloading your file...'}
                  </span>
                  <span className="font-medium text-primary">{Math.round(progress)}%</span>
                </div>
                <Progress 
                  value={progress} 
                  className="h-2.5"
                />
              </div>

              {/* 状态消息 */}
              <div className="w-full rounded-lg bg-muted/50 dark:bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Your download is in progress...
                </p>
              </div>
            </div>
          </div>
        ) : status === 'error' ? (
          // 错误状态 - 优化后的样式
          <div className="py-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* 错误图标 - 大号带动画 */}
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative bg-red-500 rounded-full p-4 shadow-lg">
                  <XCircle className="h-12 w-12 text-white" />
                </div>
              </div>

              {/* 错误标题 */}
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-foreground">
                  Download Failed
                </h3>
                <p className="text-sm text-muted-foreground">
                  {trackTitle}
                </p>
              </div>

              {/* 错误消息 */}
              <div className="w-full rounded-lg bg-red-50 dark:bg-red-950/20 p-4 border border-red-200 dark:border-red-800/50">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  {errorMessage || 'An error occurred during the download process. Please try again.'}
                </p>
              </div>

              {/* 操作按钮 */}
              <button
                onClick={onClose}
                className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

