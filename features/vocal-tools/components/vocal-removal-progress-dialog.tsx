"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AudioLines, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { CLIENT_VOCAL_SEPARATION_CREDITS } from "@/lib/credits-config";
import { useI18n } from "@/lib/i18n/provider";

type SeparatePreviewEntry = {
  key: 'vocal' | 'instrumental';
  label: string;
  url: string;
  hasError: boolean;
  errorMessage: string;
};

export interface VocalRemovalProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle?: string;
  progress: number;
  status: 'checking' | 'ready' | 'processing' | 'completed' | 'error';
  statusText?: string;
  errorMessage?: string;
  vocalUrl?: string;
  instrumentalUrl?: string;
  onReSeparate?: () => void;
  onStartSeparation?: () => void;
}

export const VocalRemovalProgressDialog: React.FC<VocalRemovalProgressDialogProps> = ({
  isOpen,
  onClose,
  trackTitle,
  progress,
  status,
  statusText,
  errorMessage,
  vocalUrl,
  instrumentalUrl,
  onReSeparate,
  onStartSeparation,
}) => {
  const { t } = useI18n();
  const [isVocalsPlaying, setIsVocalsPlaying] = useState(false);
  const [isInstrumentalPlaying, setIsInstrumentalPlaying] = useState(false);
  const [hasVocalsError, setHasVocalsError] = useState(false);
  const [hasInstrumentalError, setHasInstrumentalError] = useState(false);

  const resolvedTrackTitle = trackTitle || t("vocalTools.common.trackFallback");
  const canClose = status !== 'processing';
  const canTriggerAction = status !== 'checking' && status !== 'processing';
  const hasActionHandler = status === 'completed' ? Boolean(onReSeparate) : Boolean(onStartSeparation);
  const actionDisabled = !canTriggerAction || !hasActionHandler;
  const creditCost = CLIENT_VOCAL_SEPARATION_CREDITS.studio;
  const hasSeparateVocalResult = Boolean(vocalUrl || instrumentalUrl);

  const separateVocalEntries = useMemo<SeparatePreviewEntry[]>(() => {
    const entries: SeparatePreviewEntry[] = [];
    if (vocalUrl && vocalUrl.trim().length > 0) {
      entries.push({
        key: 'vocal',
        label: t("vocalSeparationPage.results.vocal"),
        url: vocalUrl,
        hasError: hasVocalsError,
        errorMessage: t("vocalTools.vocalRemovalDialog.failedLoadVocalTrack"),
      });
    }
    if (instrumentalUrl && instrumentalUrl.trim().length > 0) {
      entries.push({
        key: 'instrumental',
        label: t("vocalSeparationPage.results.instrumental"),
        url: instrumentalUrl,
        hasError: hasInstrumentalError,
        errorMessage: t("vocalTools.vocalRemovalDialog.failedLoadInstrumentalTrack"),
      });
    }
    return entries;
  }, [hasInstrumentalError, hasVocalsError, instrumentalUrl, t, vocalUrl]);

  const showSeparateVocalCards = status === 'completed' && hasSeparateVocalResult;

  const getStatusText = () => {
    if (statusText) return statusText;

    switch (status) {
      case 'checking':
        return t("vocalTools.common.checkingExistingResults");
      case 'ready':
        return t("vocalTools.vocalRemovalDialog.statusReady");
      case 'processing':
        return t("vocalTools.vocalRemovalDialog.statusProcessing");
      case 'completed':
        return t("vocalTools.vocalRemovalDialog.statusCompleted");
      case 'error':
        return t("vocalTools.vocalRemovalDialog.statusError");
      default:
        return t("vocalTools.vocalRemovalDialog.statusDefault");
    }
  };

  const handleAction = () => {
    if (status === 'completed') {
      onReSeparate?.();
      return;
    }
    onStartSeparation?.();
  };

  const handleWaveformPlayPause = (audioType: 'vocals' | 'instrumental') => {
    if (audioType === 'vocals') {
      if (isVocalsPlaying) {
        setIsVocalsPlaying(false);
      } else {
        setIsInstrumentalPlaying(false);
        setIsVocalsPlaying(true);
      }
      return;
    }

    if (isInstrumentalPlaying) {
      setIsInstrumentalPlaying(false);
    } else {
      setIsVocalsPlaying(false);
      setIsInstrumentalPlaying(true);
    }
  };

  const handleWaveformFinish = () => {
    setIsVocalsPlaying(false);
    setIsInstrumentalPlaying(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setIsVocalsPlaying(false);
      setIsInstrumentalPlaying(false);
      setHasVocalsError(false);
      setHasInstrumentalError(false);
    }
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canClose) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn(
          "studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[760px] max-h-[84vh] flex flex-col overflow-hidden p-0 border-0 shadow-xl"
        )}
        onInteractOutside={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="flex-shrink-0 px-5 pr-14 pt-4 pb-3 text-left sm:pr-16">
          <div className="min-w-0 space-y-1 pr-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("vocalTools.vocalRemovalDialog.title")}
            </DialogTitle>
            <p className="truncate text-sm text-muted-foreground">
              {t("vocalTools.vocalRemovalDialog.subtitle")}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-3">
          {status === 'ready' && (
            <section className="studio-panel-card rounded-2xl p-6 text-center">
              <div className="mb-4 flex justify-center">
                <AudioLines className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-foreground">
                {t("vocalTools.vocalRemovalDialog.noResultsTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("vocalTools.vocalRemovalDialog.noResultsDescription")}
              </p>
            </section>
          )}

          {status === 'checking' && (
            <section className="studio-panel-card rounded-2xl p-6 text-center">
              <div className="mb-4 flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <p className="text-base font-medium text-foreground">
                {t("vocalTools.vocalRemovalDialog.checkingTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t("vocalTools.vocalRemovalDialog.checkingDescription")}</p>
            </section>
          )}

          {status !== 'completed' && status !== 'ready' && status !== 'checking' && (
            <section className="studio-panel-card rounded-2xl p-3 space-y-3">
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

              {status === 'error' && errorMessage && (
                <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}
            </section>
          )}

          {showSeparateVocalCards && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {resolvedTrackTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("vocalTools.vocalRemovalDialog.trackCount", { count: separateVocalEntries.length })}
                </p>
              </div>

              <div className="space-y-3">
                {separateVocalEntries.map((entry) => (
                  <div key={entry.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={entry.hasError}
                        className="h-8 gap-1 rounded-full bg-transparent px-2 text-foreground/70 transition-colors hover:bg-transparent hover:text-foreground"
                        onClick={() => !entry.hasError && window.open(entry.url, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                        <span>{t("trackActions.download")}</span>
                      </Button>
                    </div>
                    <section className="studio-panel-card rounded-2xl p-3">
                      <WaveformPlayer
                        key={`${entry.key}-${entry.url}`}
                        audioUrl={entry.url}
                        isPlaying={
                          entry.key === 'vocal'
                            ? isVocalsPlaying
                            : isInstrumentalPlaying
                        }
                        onPlayPause={() =>
                          handleWaveformPlayPause(
                            entry.key === 'vocal' ? 'vocals' : 'instrumental'
                          )
                        }
                        onFinish={handleWaveformFinish}
                        isLoading={!entry.url || entry.url.trim() === ''}
                        onLoadError={
                          entry.key === 'vocal'
                            ? setHasVocalsError
                            : setHasInstrumentalError
                        }
                        backend="MediaElement"
                        playButtonVariant="icon"
                        waveHeight={56}
                        className="pl-2"
                      />
                    </section>
                    {entry.hasError && (
                      <p className="text-sm text-red-500">{entry.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {status === 'completed' && !showSeparateVocalCards && (
            <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              {t("vocalTools.common.processedSuccessfully")}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-5 pt-1 pb-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border-0 bg-foreground/5 text-sm font-semibold text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
              disabled={!canClose}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAction}
              className="h-11 flex-1 rounded-2xl text-sm font-semibold"
              disabled={actionDisabled || !canClose}
            >
              {status === 'completed'
                ? t("vocalTools.vocalRemovalDialog.actionReseparate", { credits: creditCost })
                : t("vocalTools.vocalRemovalDialog.actionSeparate", { credits: creditCost })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
