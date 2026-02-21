"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AudioLines, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { CLIENT_FEATURE_CREDITS } from "@/lib/credits-config";
import { useI18n } from "@/lib/i18n/provider";

export interface SplitStemProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  trackTitle?: string;
  progress: number;
  status: 'checking' | 'ready' | 'processing' | 'completed' | 'error';
  statusText?: string;
  errorMessage?: string;
  stemsData?: Record<string, string> | null;
  onStartSplitStem?: () => void;
  onReSplitStem?: () => void;
}

export const SplitStemProgressDialog: React.FC<SplitStemProgressDialogProps> = ({
  isOpen,
  onClose,
  trackTitle,
  progress,
  status,
  statusText,
  errorMessage,
  stemsData,
  onStartSplitStem,
  onReSplitStem,
}) => {
  const { t } = useI18n();
  const [activeStemKey, setActiveStemKey] = useState<string | null>(null);
  const [activeStemTabKey, setActiveStemTabKey] = useState<string | null>(null);
  const [stemErrorMap, setStemErrorMap] = useState<Record<string, boolean>>({});

  const resolvedTrackTitle = trackTitle || t("vocalTools.common.trackFallback");
  const canClose = status !== 'processing';
  const canTriggerAction = status !== 'checking' && status !== 'processing';
  const hasActionHandler = status === 'completed'
    ? Boolean(onReSplitStem || onStartSplitStem)
    : Boolean(onStartSplitStem);
  const actionDisabled = !canTriggerAction || !hasActionHandler;
  const creditCost = CLIENT_FEATURE_CREDITS.split_stem_from_music_studio.credits;

  const splitStemEntries = useMemo(
    () =>
      Object.entries(stemsData || {}).filter(
        ([, value]) => typeof value === 'string' && value.trim().length > 0
      ),
    [stemsData]
  );

  const hasSplitStemEntries = splitStemEntries.length > 0;
  const showSplitStemCards = status === 'completed' && hasSplitStemEntries;
  const isViewingSplitStemWithoutData = status === 'completed' && !hasSplitStemEntries;

  const activeSplitStemEntry = useMemo(() => {
    if (!showSplitStemCards || !hasSplitStemEntries) {
      return null;
    }
    const matched = splitStemEntries.find(([stemKey]) => stemKey === activeStemTabKey);
    return matched ?? splitStemEntries[0];
  }, [activeStemTabKey, hasSplitStemEntries, showSplitStemCards, splitStemEntries]);

  const handleStemPlayPause = (stemKey: string) => {
    setActiveStemKey((prev) => (prev === stemKey ? null : stemKey));
  };

  const handleStemFinish = () => {
    setActiveStemKey(null);
  };

  const handleStemLoadError = useCallback((stemKey: string, hasError: boolean) => {
    setStemErrorMap((prev) => {
      const currentValue = Boolean(prev[stemKey]);
      if (currentValue === hasError) {
        return prev;
      }

      if (!hasError) {
        if (!(stemKey in prev)) return prev;
        const next = { ...prev };
        delete next[stemKey];
        return next;
      }

      return {
        ...prev,
        [stemKey]: true,
      };
    });
  }, []);

  const stemLoadErrorHandlers = useMemo(() => {
    const handlers: Record<string, (hasError: boolean) => void> = {};
    splitStemEntries.forEach(([stemKey]) => {
      handlers[stemKey] = (hasError: boolean) => handleStemLoadError(stemKey, hasError);
    });
    return handlers;
  }, [handleStemLoadError, splitStemEntries]);

  const getStemLabel = (stemKey: string) =>
    stemKey
      .split('_')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');

  const handleSplitStemAction = () => {
    if (status === 'completed') {
      (onReSplitStem || onStartSplitStem)?.();
      return;
    }
    onStartSplitStem?.();
  };

  const getStatusText = () => {
    if (statusText) return statusText;

    switch (status) {
      case 'checking':
        return t("vocalTools.common.checkingExistingResults");
      case 'ready':
        return t("vocalTools.splitStemDialog.statusReady");
      case 'processing':
        return t("vocalTools.splitStemDialog.statusProcessing");
      case 'completed':
        return t("vocalTools.splitStemDialog.statusCompleted");
      case 'error':
        return t("vocalTools.splitStemDialog.statusError");
      default:
        return t("vocalTools.splitStemDialog.statusDefault");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setActiveStemKey(null);
      setActiveStemTabKey(null);
      setStemErrorMap({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showSplitStemCards || !hasSplitStemEntries) {
      if (activeStemTabKey !== null) {
        setActiveStemTabKey(null);
      }
      return;
    }

    const hasSelectedStem = activeStemTabKey
      ? splitStemEntries.some(([stemKey]) => stemKey === activeStemTabKey)
      : false;

    if (!hasSelectedStem) {
      setActiveStemTabKey(splitStemEntries[0][0]);
    }
  }, [activeStemTabKey, hasSplitStemEntries, showSplitStemCards, splitStemEntries]);

  useEffect(() => {
    if (activeStemKey && activeStemTabKey && activeStemKey !== activeStemTabKey) {
      setActiveStemKey(null);
    }
  }, [activeStemKey, activeStemTabKey]);

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
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        onInteractOutside={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader className="flex-shrink-0 px-5 pr-14 pt-4 pb-3 text-left sm:pr-16">
          <div className="min-w-0 space-y-1 pr-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("vocalTools.splitStemDialog.title")}
            </DialogTitle>
            <p className="truncate text-sm text-muted-foreground">
              {t("vocalTools.splitStemDialog.subtitle")}
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-3">
          {(status === 'ready' || isViewingSplitStemWithoutData) && (
            <section className="studio-panel-card rounded-2xl p-6 text-center">
              <div className="mb-4 flex justify-center">
                <AudioLines className="h-12 w-12 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-foreground">
                {t("vocalTools.splitStemDialog.noResultsTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("vocalTools.splitStemDialog.noResultsDescription")}
              </p>
            </section>
          )}

          {status === 'checking' && (
            <section className="studio-panel-card rounded-2xl p-6 text-center">
              <div className="mb-4 flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <p className="text-base font-medium text-foreground">
                {t("vocalTools.splitStemDialog.checkingTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{t("vocalTools.splitStemDialog.checkingDescription")}</p>
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

          {showSplitStemCards && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {resolvedTrackTitle}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("vocalTools.splitStemDialog.stemCount", { count: splitStemEntries.length })}
                </p>
              </div>
              <div
                role="tablist"
                aria-label={t("vocalTools.splitStemDialog.tabListLabel")}
                className="studio-panel-card flex gap-1 overflow-x-auto rounded-xl p-1"
              >
                {splitStemEntries.map(([stemKey]) => (
                  <button
                    key={stemKey}
                    type="button"
                    role="tab"
                    aria-selected={activeSplitStemEntry?.[0] === stemKey}
                    className={cn(
                      "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors",
                      activeSplitStemEntry?.[0] === stemKey
                        ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/40"
                        : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    )}
                    onClick={() => setActiveStemTabKey(stemKey)}
                  >
                    {getStemLabel(stemKey)}
                  </button>
                ))}
              </div>

              {activeSplitStemEntry && (
                <div key={activeSplitStemEntry[0]} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{getStemLabel(activeSplitStemEntry[0])}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={stemErrorMap[activeSplitStemEntry[0]]}
                      className="h-8 gap-1 rounded-full bg-transparent px-2 text-foreground/70 transition-colors hover:bg-transparent hover:text-foreground"
                      onClick={() => !stemErrorMap[activeSplitStemEntry[0]] && window.open(activeSplitStemEntry[1], '_blank')}
                    >
                      <Download className="h-4 w-4" />
                      <span>{t("trackActions.download")}</span>
                    </Button>
                  </div>
                  <section className="studio-panel-card rounded-2xl p-3">
                    <WaveformPlayer
                      key={`${activeSplitStemEntry[0]}-${activeSplitStemEntry[1]}`}
                      audioUrl={activeSplitStemEntry[1]}
                      isPlaying={activeStemKey === activeSplitStemEntry[0]}
                      onPlayPause={() => handleStemPlayPause(activeSplitStemEntry[0])}
                      onFinish={handleStemFinish}
                      isLoading={!activeSplitStemEntry[1] || activeSplitStemEntry[1].trim() === ''}
                      onLoadError={stemLoadErrorHandlers[activeSplitStemEntry[0]]}
                      backend="MediaElement"
                      playButtonVariant="icon"
                      waveHeight={56}
                      className="pl-2"
                    />
                  </section>
                  {stemErrorMap[activeSplitStemEntry[0]] && (
                    <p className="text-sm text-red-500">
                      {t("vocalTools.splitStemDialog.failedLoadStemTrack", {
                        stem: getStemLabel(activeSplitStemEntry[0]),
                      })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'completed' && !showSplitStemCards && !isViewingSplitStemWithoutData && (
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
              onClick={handleSplitStemAction}
              className="h-11 flex-1 rounded-2xl text-sm font-semibold"
              disabled={actionDisabled || !canClose}
            >
              {status === 'completed'
                ? t("vocalTools.splitStemDialog.actionResplit", { credits: creditCost })
                : t("vocalTools.splitStemDialog.actionSplit", { credits: creditCost })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
