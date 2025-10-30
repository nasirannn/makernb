"use client";

import React from 'react';

interface GenerationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 音乐生成确认弹窗
 * 显示生成开始的简洁提示
 */
export const GenerationConfirmDialog = React.memo(({
  isOpen,
  onClose,
}: GenerationConfirmDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-300 p-4">
      {/* 简洁背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* 简洁弹窗内容 */}
      <div className="relative w-full max-w-sm animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="bg-background border border-border shadow-lg rounded-lg p-6">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
              <div className="w-2 h-2 bg-primary/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Music Generation Started</h2>
            <p className="text-sm text-muted-foreground">
              Your music is being generated. You can preview it in about 30 seconds.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-md transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

GenerationConfirmDialog.displayName = 'GenerationConfirmDialog';

