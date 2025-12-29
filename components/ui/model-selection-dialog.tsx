"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// 模型类型定义 - 与后端 API 保持一致
export type MusicModel = 'V3_5' | 'V4' | 'V4_5' | 'V4_5PLUS' | 'V5';

interface ModelOption {
  value: MusicModel;
  label: string;
  description: string;
  requiresSubscription: boolean; // 是否需要订阅
}

const modelOptions: ModelOption[] = [
  { value: 'V5', label: 'v5', description: 'Superior musical expression, faster generation.', requiresSubscription: true },
  { value: 'V4_5PLUS', label: 'v4.5+', description: 'Best sound quality, max 8 min, creative rhythms, rich harmonies', requiresSubscription: true },
  { value: 'V4_5', label: 'v4.5', description: 'High-quality vocals, smarter prompts, faster generation, up to 8 minutes', requiresSubscription: true },
  { value: 'V4', label: 'v4', description: 'Basic model with improved vocal quality, up to 4 minutes', requiresSubscription: true },
  { value: 'V3_5', label: 'v3.5', description: 'Better song structure, max 4 min.', requiresSubscription: false },
];

interface ModelSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: MusicModel;
  onSelectModel: (model: MusicModel) => void;
  /** 用户是否有订阅 */
  hasSubscription?: boolean;
  /** 当无订阅用户选择付费模型时的回调 */
  onShowPricing?: () => void;
}

export const ModelSelectionDialog: React.FC<ModelSelectionDialogProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
  hasSubscription = false,
  onShowPricing,
}) => {
  const [tempSelectedModel, setTempSelectedModel] = React.useState<MusicModel>(selectedModel);

  // 当弹窗打开时，同步当前选中的模型
  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedModel(selectedModel);
    }
  }, [isOpen, selectedModel]);

  const handleConfirm = () => {
    // 如果用户没有订阅且选择了非V3.5模型，显示pricing弹窗
    if (!hasSubscription && tempSelectedModel !== 'V3_5') {
      onClose();
      if (onShowPricing) {
        onShowPricing();
      }
      return;
    }

    // 否则正常选择模型
    onSelectModel(tempSelectedModel);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* 固定头部 */}
        <AlertDialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/40">
          <AlertDialogTitle className="text-xl font-semibold pr-8 tracking-tight">
            Select Model Version
          </AlertDialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select the AI model for music generation
          </p>
        </AlertDialogHeader>

        {/* 可滚动的主要内容区域 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-2.5">
            {modelOptions.map((option) => {
              const isSelected = tempSelectedModel === option.value;
              // 所有模型都可以选择
              const isClickable = true;

              return (
                <button
                  key={option.value}
                  onClick={() => setTempSelectedModel(option.value)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border/50 hover:border-border/80 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold">
                    {option.label}
                    </h3>
                    {/* 只有在用户无订阅时显示订阅标识 */}
                    {!hasSubscription && option.requiresSubscription && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-border/60 text-[11px] font-medium text-muted-foreground">
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 固定底部按钮 */}
        <AlertDialogFooter className="flex-shrink-0 px-6 pt-4 pb-6 border-t border-border/40">
          <Button
            onClick={handleConfirm}
            className="w-full px-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Confirm Selection
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// 导出模型选项供其他组件使用
export { modelOptions };
