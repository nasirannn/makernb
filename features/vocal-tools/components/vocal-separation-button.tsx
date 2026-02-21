'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { VocalSeparationPanel } from '@/features/vocal-tools/components/vocal-separation-panel';
import { useI18n } from '@/lib/i18n/provider';
import { Mic } from 'lucide-react';

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
  const { t } = useI18n();

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
          {t("vocalTools.panel.buttonLabel")}
        </Button>
      </DialogTrigger>
      <DialogContent className="studio-panel-card max-w-4xl max-h-[90vh] overflow-y-auto border-0 p-5 shadow-xl">
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
