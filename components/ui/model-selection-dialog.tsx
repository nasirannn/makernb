"use client";

import React from "react";
import { Check, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MusicModel = "V4" | "V4_5" | "V4_5PLUS" | "V5";

type ModelHighlightTone = "cyan" | "sunset" | "emerald" | "azure" | "slate";

export interface ModelHighlightBadge {
  label: string;
  tone?: ModelHighlightTone;
  withCrown?: boolean;
}

export interface ModelOption {
  value: MusicModel;
  label: string;
  description: string;
  capabilities: string[];
  tierHint?: string;
  highlightBadges?: ModelHighlightBadge[];
}

const MODEL_HIGHLIGHT_TONE_CLASS: Record<ModelHighlightTone, string> = {
  cyan:
    "bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 shadow-[0_8px_16px_rgba(56,189,248,0.26)]",
  sunset:
    "bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 shadow-[0_8px_16px_rgba(251,146,60,0.26)]",
  emerald:
    "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 shadow-[0_8px_16px_rgba(45,212,191,0.24)]",
  azure:
    "bg-gradient-to-r from-sky-300 via-blue-300 to-cyan-300 shadow-[0_8px_16px_rgba(59,130,246,0.24)]",
  slate:
    "bg-gradient-to-r from-slate-200 via-zinc-200 to-stone-200 shadow-[0_8px_16px_rgba(71,85,105,0.2)]",
};

export const modelOptions: ModelOption[] = [
  {
    value: "V5",
    label: "V5",
    description: "Best melody control and richer expression for premium outputs.",
    capabilities: ["Genuine Vocals", "Creative Control", "Up to 8 min", "High Fidelity"],
    tierHint: "Hobby+",
    highlightBadges: [
      { label: "Premium model", tone: "cyan", withCrown: true },
      { label: "Latest", tone: "sunset" },
    ],
  },
  {
    value: "V4_5PLUS",
    label: "V4.5+",
    description: "Long-form, cleaner stems, and stronger composition stability.",
    capabilities: ["Long-form", "Cleaner Stems", "Rich Harmonies", "Stable Structure"],
  },
  {
    value: "V4_5",
    label: "V4.5",
    description: "Balanced quality with fast turnaround for daily generation.",
    capabilities: ["Fast Generation", "Balanced Quality", "Smarter Prompts", "Up to 8 min"],
  },
  {
    value: "V4",
    label: "V4",
    description: "Lightweight model optimized for quick iteration.",
    capabilities: ["Quick Drafts", "Richer Timbral Detail", "Reliable Vocals", "Up to 4 min"],
  },
];

interface ModelSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedModel: MusicModel;
  onSelectModel: (model: MusicModel) => void;
  options?: ModelOption[];
  isModelLocked?: (model: MusicModel) => boolean;
  onLockedModelSelect?: (model: MusicModel) => void;
}

export const ModelSelectionDialog: React.FC<ModelSelectionDialogProps> = ({
  open,
  onOpenChange,
  selectedModel,
  onSelectModel,
  options = modelOptions,
  isModelLocked,
  onLockedModelSelect,
}) => {
  const [pendingModel, setPendingModel] = React.useState<MusicModel>(selectedModel);

  React.useEffect(() => {
    if (open) {
      setPendingModel(selectedModel);
    }
  }, [open, selectedModel]);

  const handleConfirm = React.useCallback(() => {
    const isPendingLocked = isModelLocked?.(pendingModel) ?? false;
    if (isPendingLocked) {
      onOpenChange(false);
      onLockedModelSelect?.(pendingModel);
      return;
    }

    if (pendingModel !== selectedModel) {
      onSelectModel(pendingModel);
    }

    onOpenChange(false);
  }, [isModelLocked, onLockedModelSelect, onOpenChange, onSelectModel, pendingModel, selectedModel]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="studio-panel-card max-w-[calc(100vw-2rem)] sm:max-w-[700px] max-h-[86vh] flex flex-col overflow-hidden p-0 border border-black/10 dark:border-white/10 shadow-[0_28px_86px_rgba(2,8,23,0.34)]">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.28)_0%,rgba(56,189,248,0)_70%)]" />
            <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.2)_0%,rgba(99,102,241,0)_72%)]" />
          </div>

          <DialogHeader className="relative z-[1] flex-shrink-0 px-5 pt-4 pb-3 text-left">
          <div className="pr-8">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Select Model
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Compare quality, speed, and creative control to choose the best fit for this track.
          </DialogDescription>
          </DialogHeader>

          <div className="relative z-[1] flex-1 overflow-y-auto px-5 pb-5 pt-3.5">
            <div className="space-y-2.5">
            {options.map((option) => {
              const isSelected = option.value === pendingModel;
              const isLocked = isModelLocked?.(option.value) ?? false;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPendingModel(option.value)}
                  className={cn(
                    "group relative w-full cursor-pointer overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200",
                    isSelected
                      ? "animate-border-marquee animate-border-marquee-slow border-transparent bg-[linear-gradient(145deg,rgba(240,249,255,0.96),rgba(238,242,255,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_12px_24px_rgba(14,165,233,0.16)] dark:border-transparent dark:bg-none dark:bg-primary/16 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "border-black/10 bg-white/90 hover:border-black/20 hover:bg-white/95 hover:shadow-[0_8px_18px_rgba(2,8,23,0.08)] dark:border-white/12 dark:bg-white/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.1] dark:hover:shadow-[0_10px_20px_rgba(0,0,0,0.24)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isLocked && "opacity-85"
                  )}
                  aria-pressed={isSelected}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0",
                      isSelected
                        ? "bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.34),transparent_54%)] dark:bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.06),transparent_58%)]"
                        : "bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.2),transparent_56%)] dark:bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.11),transparent_58%)]"
                    )}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[1.15rem] leading-none font-semibold tracking-tight text-foreground">
                          {option.label}
                        </h3>
                        {option.highlightBadges?.map((badge, index) => (
                          <span
                            key={`${option.value}-highlight-${badge.label}-${index}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-950",
                              MODEL_HIGHLIGHT_TONE_CLASS[badge.tone ?? "cyan"]
                            )}
                          >
                            {badge.withCrown ? <Crown className="h-3 w-3" /> : null}
                            {badge.label}
                          </span>
                        ))}
                        {isLocked && option.tierHint ? (
                          <span className="inline-flex items-center rounded-full border border-black/12 bg-white/75 px-2 py-0.5 text-[10px] font-medium text-foreground/75 dark:border-white/15 dark:bg-white/[0.12] dark:text-foreground/85">
                            Requires {option.tierHint}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1.5 text-sm leading-[1.45] text-muted-foreground">
                        {option.description}
                      </p>

                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {option.capabilities.map((capability) => (
                          <span
                            key={`${option.value}-${capability}`}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none tracking-[0.01em] transition-colors",
                              isSelected
                                ? "border-transparent bg-primary text-primary-foreground"
                                : "border-black/10 bg-white/72 text-foreground/80 dark:border-white/15 dark:bg-white/[0.1] dark:text-foreground/85"
                            )}
                          >
                            {capability}
                          </span>
                        ))}
                      </div>
                    </div>

                    {isSelected ? (
                      <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_16px_hsl(var(--primary)/0.34)]">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            </div>
          </div>

          <div className="relative z-[1] flex-shrink-0 px-5 pb-5">
            <Button
              type="button"
              variant="default"
              onClick={handleConfirm}
              className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
