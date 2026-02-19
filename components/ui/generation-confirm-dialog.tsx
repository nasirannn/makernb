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
import { useI18n } from "@/lib/i18n/provider";

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
  const { t } = useI18n();
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[520px] p-0 border-0 shadow-xl">
        <AlertDialogHeader className="flex-shrink-0 px-5 pt-4 pb-2 text-left">
          <div className="mb-1.5 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-primary/70 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
            <div className="w-2 h-2 bg-primary/50 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
          </div>
          <AlertDialogTitle className="text-xl font-semibold tracking-tight text-foreground">
            {t("generationConfirm.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {t("generationConfirm.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="px-5 pb-5 pt-3">
          <Button
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("generationConfirm.gotIt")}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
});

GenerationConfirmDialog.displayName = 'GenerationConfirmDialog';
