"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[420px] p-0 border border-border/60 dark:border-transparent bg-background shadow-xl">
        <AlertDialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
            <div className="w-2 h-2 bg-primary/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
          </div>
          <AlertDialogTitle className="text-lg font-semibold text-foreground">
            Music Generation Started
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
            Your music is being generated. You can preview it in about 30 ~ 60 seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-6 pb-6 pt-4">
          <Button
            onClick={onClose}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium"
          >
            Got it
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
});

GenerationConfirmDialog.displayName = 'GenerationConfirmDialog';
