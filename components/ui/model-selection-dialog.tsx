"use client";

import React from "react";
import { Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { getZIndexClass } from "@/lib/z-index";

export type MusicModel = "V4" | "V4_5" | "V4_5PLUS" | "V5";

type ModelHighlightTone = "cyan" | "sunset" | "emerald" | "azure" | "slate";

export interface ModelHighlightBadge {
  label: string;
  tone?: ModelHighlightTone;
  withCrown?: boolean;
  i18nKey?: string;
}

export interface ModelOption {
  value: MusicModel;
  label: string;
  description: string;
  capabilities: string[];
  descriptionKey?: string;
  capabilityKeys?: string[];
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
    descriptionKey: "modelSelectionDialog.models.V5.description",
    capabilities: ["Genuine Vocals", "Creative Control", "Up to 8 min", "High Fidelity"],
    capabilityKeys: [
      "modelSelectionDialog.models.V5.capabilities.genuineVocals",
      "modelSelectionDialog.models.V5.capabilities.creativeControl",
      "modelSelectionDialog.models.V5.capabilities.upTo8Min",
      "modelSelectionDialog.models.V5.capabilities.highFidelity",
    ],
    tierHint: "Hobby+",
    highlightBadges: [
      {
        label: "Premium model",
        tone: "cyan",
        withCrown: true,
        i18nKey: "modelSelectionDialog.badges.premiumModel",
      },
      { label: "Latest", tone: "sunset", i18nKey: "modelSelectionDialog.badges.latest" },
    ],
  },
  {
    value: "V4_5PLUS",
    label: "V4.5+",
    description: "Long-form, cleaner stems, and stronger composition stability.",
    descriptionKey: "modelSelectionDialog.models.V4_5PLUS.description",
    capabilities: ["Long-form", "Cleaner Stems", "Rich Harmonies", "Stable Structure"],
    capabilityKeys: [
      "modelSelectionDialog.models.V4_5PLUS.capabilities.longForm",
      "modelSelectionDialog.models.V4_5PLUS.capabilities.cleanerStems",
      "modelSelectionDialog.models.V4_5PLUS.capabilities.richHarmonies",
      "modelSelectionDialog.models.V4_5PLUS.capabilities.stableStructure",
    ],
  },
  {
    value: "V4_5",
    label: "V4.5",
    description: "Balanced quality with fast turnaround for daily generation.",
    descriptionKey: "modelSelectionDialog.models.V4_5.description",
    capabilities: ["Fast Generation", "Balanced Quality", "Smarter Prompts", "Up to 8 min"],
    capabilityKeys: [
      "modelSelectionDialog.models.V4_5.capabilities.fastGeneration",
      "modelSelectionDialog.models.V4_5.capabilities.balancedQuality",
      "modelSelectionDialog.models.V4_5.capabilities.smarterPrompts",
      "modelSelectionDialog.models.V4_5.capabilities.upTo8Min",
    ],
  },
  {
    value: "V4",
    label: "V4",
    description: "Lightweight model optimized for quick iteration.",
    descriptionKey: "modelSelectionDialog.models.V4.description",
    capabilities: ["Quick Drafts", "Richer Timbral Detail", "Reliable Vocals", "Up to 4 min"],
    capabilityKeys: [
      "modelSelectionDialog.models.V4.capabilities.quickDrafts",
      "modelSelectionDialog.models.V4.capabilities.richerTimbralDetail",
      "modelSelectionDialog.models.V4.capabilities.reliableVocals",
      "modelSelectionDialog.models.V4.capabilities.upTo4Min",
    ],
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
  const { t } = useI18n();
  const [pendingModel, setPendingModel] = React.useState<MusicModel>(selectedModel);

  const getLocalizedText = React.useCallback(
    (key: string | undefined, fallback: string) => {
      if (!key) return fallback;
      const translated = t(key);
      return translated === key ? fallback : translated;
    },
    [t]
  );

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

          <DialogHeader className={`relative ${getZIndexClass("BASE_CONTENT")} flex-shrink-0 px-5 pt-4 pb-3 text-left`}>
          <div className="pr-8">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("modelSelectionDialog.title")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("modelSelectionDialog.description")}
          </DialogDescription>
          </DialogHeader>

          <div className={`relative ${getZIndexClass("BASE_CONTENT")} flex-1 overflow-y-auto px-5 pb-5 pt-3.5`}>
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
                    "group relative w-full cursor-pointer overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0",
                    isSelected
                      ? "animate-border-marquee animate-border-marquee-slow border-transparent bg-[linear-gradient(145deg,rgba(255,255,255,0.24),hsl(var(--primary)/0.20))] shadow-[0_10px_22px_rgba(37,99,235,0.08)] dark:border-white/[0.16] dark:bg-[linear-gradient(145deg,rgba(30,41,59,0.58),rgba(15,23,42,0.74))]"
                      : "border-white/[0.14] bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(255,255,255,0.12))] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:border-transparent dark:bg-primary/16 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
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
                        ? "bg-[radial-gradient(120%_95%_at_0%_0%,rgba(255,255,255,0.34),rgba(56,189,248,0.04)_42%,transparent_72%)] dark:bg-[radial-gradient(110%_90%_at_0%_0%,rgba(148,163,184,0.2),transparent_60%)]"
                        : "bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.12),transparent_58%)] dark:bg-[radial-gradient(110%_90%_at_0%_0%,rgba(255,255,255,0.06),transparent_58%)]"
                    )}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          className={cn(
                            "text-lg leading-none font-semibold tracking-tight transition-colors",
                            isSelected
                              ? "text-slate-900 dark:text-foreground"
                              : "text-foreground/85 dark:text-foreground/90"
                          )}
                        >
                          {option.label}
                        </h3>
                        {option.highlightBadges?.map((badge, index) => (
                          <span
                            key={`${option.value}-highlight-${badge.label}-${index}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.04em] text-slate-950",
                              MODEL_HIGHLIGHT_TONE_CLASS[badge.tone ?? "cyan"]
                            )}
                          >
                            {badge.withCrown ? <Crown className="h-3 w-3" /> : null}
                            {getLocalizedText(badge.i18nKey, badge.label)}
                          </span>
                        ))}
                        {isLocked && option.tierHint ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                              isSelected
                                ? "bg-white/50 text-slate-700 dark:bg-white/[0.14] dark:text-foreground/90"
                                : "bg-foreground/5 text-foreground/75 dark:bg-white/[0.08] dark:text-foreground/80"
                            )}
                          >
                            {t("modelSelectionDialog.requiresTier", { tier: option.tierHint })}
                          </span>
                        ) : null}
                      </div>

                      <p
                        className={cn(
                          "mt-1.5 text-sm leading-[1.45] transition-colors",
                          isSelected
                            ? "text-slate-700 dark:text-foreground/75"
                            : "text-foreground/70 dark:text-foreground/72"
                        )}
                      >
                        {getLocalizedText(option.descriptionKey, option.description)}
                      </p>

                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {option.capabilities.map((capability, index) => (
                          <span
                            key={`${option.value}-${capability}`}
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none tracking-[0.01em] transition-colors",
                              isSelected
                                ? "bg-white/58 text-slate-800 dark:bg-white/[0.16] dark:text-foreground/95"
                                : "bg-foreground/5 text-foreground/72 dark:bg-white/[0.08] dark:text-foreground/80"
                            )}
                          >
                            {getLocalizedText(option.capabilityKeys?.[index], capability)}
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>
                </button>
              );
            })}
            </div>
          </div>

          <div className={`relative ${getZIndexClass("BASE_CONTENT")} flex-shrink-0 px-5 pb-5`}>
            <Button
              type="button"
              variant="default"
              onClick={handleConfirm}
              className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("modelSelectionDialog.confirm")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
