'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { VocalSeparationPanel } from '@/features/vocal-tools/components/vocal-separation-panel';
import { Mic, Loader2 } from 'lucide-react';

interface VocalSeparationButtonProps {
  trackId: string;
  audioId: string;
  taskId: string;
  trackTitle: string;
  audioUrl: string;
  duration: number;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export const VocalSeparationButton: React.FC<VocalSeparationButtonProps> = ({
  trackId,
  audioId,
  taskId,
  trackTitle,
  audioUrl,
  duration,
  disabled = false,
  variant = 'outline',
  size = 'sm'
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Mic className="h-4 w-4" />
          Vocal Separation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Vocal Separation</DialogTitle>
          <DialogDescription>
            Use advanced AI to split vocals and instrumental tracks.
          </DialogDescription>
        </DialogHeader>
        <VocalSeparationPanel
          trackId={trackId}
          audioId={audioId}
          taskId={taskId}
          trackTitle={trackTitle}
          audioUrl={audioUrl}
          duration={duration}
          onClose={() => setIsOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

// 简化版本，只显示按钮和基本功能
export const VocalSeparationButtonSimple: React.FC<VocalSeparationButtonProps> = ({
  trackId,
  audioId,
  taskId,
  trackTitle,
  audioUrl,
  duration,
  disabled = false,
  variant = 'ghost',
  size = 'sm'
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuickSeparation = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      // 这里可以调用快速分离API
      // 暂时显示提示
      
      // 模拟处理时间
      setTimeout(() => {
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('Quick separation failed:', error);
      setIsProcessing(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || isProcessing}
      onClick={handleQuickSeparation}
      className="flex items-center gap-2"
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {isProcessing ? 'Separating...' : 'Vocal Separation'}
    </Button>
  );
};
