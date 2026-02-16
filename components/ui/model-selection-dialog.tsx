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

export type MusicModel = 'V4' | 'V4_5' | 'V4_5PLUS' | 'V5';

interface ModelOption {
  value: MusicModel;
  label: string;
  description: string;
  requiresSubscription: boolean;
}

const modelOptions: ModelOption[] = [
  { value: 'V5', label: 'V5', description: 'Superior musical expression, faster generation.', requiresSubscription: false },
  { value: 'V4_5PLUS', label: 'V4.5+', description: 'Best sound quality, max 8 min, creative rhythms, rich harmonies', requiresSubscription: false },
  { value: 'V4_5', label: 'V4.5', description: 'High-quality vocals, smarter prompts, faster generation, up to 8 minutes', requiresSubscription: false },
  { value: 'V4', label: 'V4', description: 'Improved vocal quality, up to 4 minutes.', requiresSubscription: false },
];

interface ModelSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: MusicModel;
  onSelectModel: (model: MusicModel) => void;
  hasSubscription?: boolean;
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

  React.useEffect(() => {
    if (isOpen) {
      setTempSelectedModel(selectedModel);
    }
  }, [isOpen, selectedModel]);

  const handleConfirm = () => {
    const selectedOption = modelOptions.find((option) => option.value === tempSelectedModel);

    if (!hasSubscription && selectedOption?.requiresSubscription) {
      onClose();
      onShowPricing?.();
      return;
    }

    onSelectModel(tempSelectedModel);
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
        <AlertDialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/40">
          <AlertDialogTitle className="text-xl font-semibold pr-8 tracking-tight">
            Select Model Version
          </AlertDialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select the AI model for music generation
          </p>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-2.5">
            {modelOptions.map((option) => {
              const isSelected = tempSelectedModel === option.value;

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
                    <h3 className="text-base font-semibold">{option.label}</h3>
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

export { modelOptions };
