"use client";

import React from "react";
import { Pause, Play, RefreshCw, X } from "lucide-react";

type UploadAudioPlayerCardProps = {
  title: string;
  subtitle: string;
  durationLabel?: string;
  isPlaying: boolean;
  isDisabled?: boolean;
  progressPercent: number;
  currentTimeLabel: string;
  totalTimeLabel: string;
  playLabel: string;
  pauseLabel: string;
  replaceLabel: string;
  removeLabel: string;
  onPlayPause: () => void;
  onReplace: () => void;
  onRemove: () => void;
  waveform: React.ReactNode;
  footer?: React.ReactNode;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

export const UploadAudioPlayerCard: React.FC<UploadAudioPlayerCardProps> = ({
  title,
  subtitle,
  durationLabel,
  isPlaying,
  isDisabled = false,
  progressPercent,
  currentTimeLabel,
  totalTimeLabel,
  playLabel,
  pauseLabel,
  replaceLabel,
  removeLabel,
  onPlayPause,
  onReplace,
  onRemove,
  waveform,
  footer,
}) => {
  const normalizedProgress = clampPercent(progressPercent);

  return (
    <div className="rounded-[22px] bg-gradient-to-br from-primary/12 via-background to-background p-3.5 shadow-[0_16px_40px_rgba(12,18,38,0.12)] dark:shadow-[0_18px_42px_rgba(0,0,0,0.38)] md:p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-foreground">{title}</p>
            {durationLabel ? (
              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary/90">
                {durationLabel}
              </span>
            ) : null}
          </div>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onReplace}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:bg-primary/12 hover:text-foreground"
            title={replaceLabel}
            aria-label={replaceLabel}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:bg-primary/12 hover:text-foreground"
            title={removeLabel}
            aria-label={removeLabel}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-background/75 px-3 py-2">{waveform}</div>

      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={onPlayPause}
          disabled={isDisabled}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/30 transition-transform duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
          title={isPlaying ? pauseLabel : playLabel}
          aria-label={isPlaying ? pauseLabel : playLabel}
        >
          {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2.5 text-sm">
        <span className="w-12 shrink-0 text-left font-medium text-foreground/85">{currentTimeLabel}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-300"
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
        <span className="w-12 shrink-0 text-right font-medium text-foreground/85">{totalTimeLabel}</span>
      </div>

      {footer ? <div className="mt-2 text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
};
