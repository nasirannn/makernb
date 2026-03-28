"use client";

import React from "react";
import { ChevronDown, Disc3, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelectionDialog, MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import { PanelPricingModal } from "@/components/ui/feature-panels/shared/panel-pricing-modal";
import { useFeaturePermissions } from '@/contexts/FeaturePermissionsContext';
import { useI18n } from "@/lib/i18n/provider";
import { CLIENT_SOUND_CREDITS } from '@/lib/credits-config';
import { formatMusicModelLabel, isPremiumMusicModel } from '@/lib/music-model-utils';
import {
  SOUND_KEY_MAJOR_OPTIONS,
  SOUND_KEY_MINOR_OPTIONS,
} from '@/lib/sound-generation-config';
import type { FeatureCreatePanelProps } from "@/types/studio-feature-panel";
import { getZIndexClass } from "@/lib/z-index";

type SoundKeyMode = 'any' | 'major' | 'minor';

function getSoundKeyMode(value: string): SoundKeyMode {
  if (!value) return 'any';
  if (SOUND_KEY_MINOR_OPTIONS.includes(value as typeof SOUND_KEY_MINOR_OPTIONS[number])) {
    return 'minor';
  }
  return 'major';
}

export const SoundGeneratorPanel = (props: FeatureCreatePanelProps) => {
  const {
    panelOpen,
    panelTitle,
    isGenerating,
    onGenerationStart,
    selectedModel = 'V4',
    setSelectedModel,
    forceVisibleOnMobile = false,
    hasPlayer = false,
  } = props;

  const { t } = useI18n();
  const { hasPermission } = useFeaturePermissions();
  const canUseV5Model = hasPermission('model_v5');
  const resolvedPanelTitle = panelTitle ?? t("studioFeatures.soundGenerator");
  const soundModelOptions = React.useMemo(
    () => modelOptions.filter((option) => option.value === 'V5' || option.value === 'V5_5'),
    []
  );

  const [prompt, setPrompt] = React.useState('');
  const [soundType, setSoundType] = React.useState<'one-shot' | 'loop'>('one-shot');
  const [soundTempo, setSoundTempo] = React.useState('');
  const [soundKey, setSoundKey] = React.useState('');
  const [grabLyrics, setGrabLyrics] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = React.useState(false);
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);
  const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = React.useState(true);
  const [isSoundKeyPickerOpen, setIsSoundKeyPickerOpen] = React.useState(false);
  const [pendingSoundKey, setPendingSoundKey] = React.useState('');
  const [pendingSoundKeyMode, setPendingSoundKeyMode] = React.useState<SoundKeyMode>('any');

  React.useEffect(() => {
    if (!setSelectedModel) return;
    if (selectedModel === 'V5' || selectedModel === 'V5_5') return;
    setSelectedModel('V5');
  }, [selectedModel, setSelectedModel]);

  React.useEffect(() => {
    if (!isSoundKeyPickerOpen) return;
    setPendingSoundKey(soundKey);
    setPendingSoundKeyMode(getSoundKeyMode(soundKey));
  }, [isSoundKeyPickerOpen, soundKey]);

  const handleModelSelect = React.useCallback((model: MusicModel) => {
    if (isPremiumMusicModel(model) && !canUseV5Model) {
      setIsPricingOpen(true);
      return;
    }

    setSelectedModel?.(model);
  }, [canUseV5Model, setSelectedModel]);

  const handleCreate = React.useCallback(async () => {
    if (!onGenerationStart || isGenerating || isSubmitting) {
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    const parsedTempo = soundTempo.trim() ? Number(soundTempo.trim()) : undefined;

    setIsSubmitting(true);
    try {
      await onGenerationStart({
        mode: 'sound',
        soundPrompt: trimmedPrompt,
        soundLoop: soundType === 'loop',
        soundType,
        soundTempo: parsedTempo,
        soundKey: soundKey.trim() || undefined,
        grabLyrics,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [grabLyrics, isGenerating, isSubmitting, onGenerationStart, prompt, soundKey, soundTempo, soundType]);

  const clearPrompt = React.useCallback(() => {
    setPrompt('');
  }, []);

  const handleSoundKeyModeChange = React.useCallback((mode: SoundKeyMode) => {
    setPendingSoundKeyMode(mode);
    if (mode === 'any') {
      setPendingSoundKey('');
      return;
    }

    const options = mode === 'major' ? SOUND_KEY_MAJOR_OPTIONS : SOUND_KEY_MINOR_OPTIONS;
    if (!pendingSoundKey || !options.includes(pendingSoundKey as never)) {
      setPendingSoundKey(options[0]);
    }
  }, [pendingSoundKey]);

  const handleApplySoundKey = React.useCallback(() => {
    setSoundKey(pendingSoundKeyMode === 'any' ? '' : pendingSoundKey);
    setIsSoundKeyPickerOpen(false);
  }, [pendingSoundKey, pendingSoundKeyMode]);

  const displayedSoundKey = soundKey || t("featurePanel.any");
  const visibleSoundKeyOptions = pendingSoundKeyMode === 'minor' ? SOUND_KEY_MINOR_OPTIONS : SOUND_KEY_MAJOR_OPTIONS;
  const isCreateDisabled = isGenerating || isSubmitting || !prompt.trim();

  return (
    <>
      <div
        className={`studio-panel-cards transition-all duration-300 ease-in-out ${
          panelOpen ? (forceVisibleOnMobile ? 'w-full md:w-[clamp(21rem,30vw,32rem)]' : 'md:w-[clamp(21rem,30vw,32rem)]') : 'w-0'
        } ${forceVisibleOnMobile ? 'flex flex-col' : 'h-full flex flex-col overflow-hidden'} ${forceVisibleOnMobile ? 'flex md:flex' : 'hidden md:flex'}`}
        style={
          hasPlayer && !forceVisibleOnMobile
            ? { height: 'calc(100% - var(--player-height, 0px) - 0.5rem)' }
            : undefined
        }
      >
        {panelOpen && (
          <>
            <div className="flex-shrink-0 px-0 pt-2 md:pt-4 pb-4">
              {resolvedPanelTitle && (
                <div className="mb-3 px-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
                      {resolvedPanelTitle}
                    </h2>
                    <div className="h-11 min-w-[5.75rem] flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setIsModelDialogOpen(true)}
                        className="group h-11 min-w-[5.75rem] px-4 rounded-2xl border border-white/45 dark:border-white/10 text-xs md:text-sm font-semibold text-slate-950 transition-all duration-200 bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 shadow-[0_6px_14px_rgba(56,189,248,0.18)] hover:from-cyan-200 hover:via-sky-200 hover:to-indigo-200 flex items-center justify-center"
                        title={t("featurePanel.chooseModel")}
                      >
                        <span>{formatMusicModelLabel(selectedModel === 'V5' || selectedModel === 'V5_5' ? selectedModel : 'V5') || 'V5'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("featurePanel.soundGeneratorDescription")}
                  </p>
                </div>
              )}
            </div>

            <div
              className={`flex-1 ${forceVisibleOnMobile ? '' : 'overflow-y-auto scrollbar-hidden'} px-0 ${forceVisibleOnMobile ? 'pb-28' : 'pb-6'} md:pb-6`}
              style={forceVisibleOnMobile ? undefined : { scrollbarGutter: 'stable both-edges' }}
            >
              <div className="space-y-4">
                <section className="studio-panel-card rounded-2xl p-3">
                  <div className="mb-3 md:mb-4">
                    <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                      {t("featurePanel.prompt")}
                    </h3>
                  </div>

                  <div>
                    <Textarea
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                      placeholder={t("featurePanel.describeSoundIdea")}
                      className="min-h-[180px] md:min-h-[200px] resize-none pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                      maxLength={500}
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {prompt.length}/500
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearPrompt}
                        disabled={!prompt.length}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="text-xs font-medium">{t("featurePanel.clear")}</span>
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="studio-panel-card rounded-2xl p-3">
                  <button
                    type="button"
                    className="flex w-full min-h-[28px] items-center justify-between gap-3 rounded-xl text-left"
                    onClick={() => setIsAdvancedOptionsOpen((prev) => !prev)}
                    aria-expanded={isAdvancedOptionsOpen}
                    aria-label={t("featurePanel.toggleAdvancedOptions")}
                  >
                    <h3 className="text-xs md:text-sm font-semibold text-foreground">
                      {t("featurePanel.advancedOptions")}
                    </h3>
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {t("featurePanel.optional")}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                          isAdvancedOptionsOpen ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                  </button>

                  {isAdvancedOptionsOpen && (
                    <div className="mt-3 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-medium text-foreground">{t("featurePanel.bpm")}</p>
                          <p className="text-xs text-muted-foreground">{t("featurePanel.soundTempoPlaceholder")}</p>
                        </div>
                        <div className="app-card-muted w-[8.5rem] shrink-0 rounded-2xl px-3 py-2 bg-foreground/5 dark:bg-white/10">
                          <Input
                            value={soundTempo}
                            onChange={(event) => setSoundTempo(event.target.value)}
                            type="number"
                            min="1"
                            max="300"
                            step="1"
                            placeholder={t("common.auto")}
                            className="h-6 border-0 bg-transparent px-0 text-right text-sm shadow-none focus-visible:ring-0"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                          <p className="text-xs font-medium text-foreground">{t("featurePanel.key")}</p>
                          <p className="text-xs text-muted-foreground">{t("featurePanel.soundKeyPlaceholder")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSoundKeyPickerOpen((prev) => !prev)}
                            className="app-card-muted inline-flex min-h-[44px] min-w-[8.5rem] touch-manipulation items-center justify-between gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-foreground/85 transition-colors hover:bg-foreground/10"
                            aria-expanded={isSoundKeyPickerOpen}
                            aria-label={t("featurePanel.key")}
                          >
                            <span className="truncate">{displayedSoundKey}</span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isSoundKeyPickerOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>

                        {isSoundKeyPickerOpen && (
                          <div className="app-card-muted rounded-2xl border border-white/8 bg-foreground/5 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:bg-white/5">
                            <div className="space-y-3">
                              <div className="grid grid-cols-4 gap-2">
                                {(pendingSoundKeyMode === 'any' ? SOUND_KEY_MAJOR_OPTIONS : visibleSoundKeyOptions).map((option) => {
                                  const isActive = pendingSoundKeyMode !== 'any' && pendingSoundKey === option;
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => {
                                        setPendingSoundKeyMode(getSoundKeyMode(option));
                                        setPendingSoundKey(option);
                                      }}
                                      className={`min-h-[44px] rounded-2xl px-3 py-2 text-sm font-semibold transition-colors touch-manipulation cursor-pointer ${
                                        isActive
                                          ? 'bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                                          : 'bg-background/70 text-foreground/75 hover:bg-background hover:text-foreground dark:bg-background/30'
                                      }`}
                                      aria-pressed={isActive}
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="app-card-muted inline-flex min-h-[44px] items-center rounded-2xl p-1 gap-1 bg-background/60 dark:bg-background/20">
                                  {([
                                    ['any', t('featurePanel.any')],
                                    ['major', t('featurePanel.major')],
                                    ['minor', t('featurePanel.minor')],
                                  ] as const).map(([mode, label]) => (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => handleSoundKeyModeChange(mode)}
                                      className={`min-h-[36px] min-w-[64px] px-3 text-xs md:text-sm font-medium transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                        pendingSoundKeyMode === mode
                                          ? 'bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                                          : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>

                                <Button
                                  type="button"
                                  onClick={handleApplySoundKey}
                                  className="ml-auto h-11 rounded-2xl px-4"
                                >
                                  {t('common.apply')}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-foreground whitespace-nowrap">{t("featurePanel.type")}</p>
                        <div className="studio-panel-card inline-flex shrink-0 whitespace-nowrap items-center rounded-full p-1 gap-1">
                          {([
                            ['one-shot', t('featurePanel.oneShot')],
                            ['loop', t('featurePanel.loop')],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setSoundType(value)}
                              className={`px-4 py-2 text-xs md:text-sm font-medium transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                                soundType === value
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                                  : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-medium text-foreground">{t("featurePanel.grabLyrics")}</p>
                          <p className="text-xs text-muted-foreground">{t("featurePanel.grabLyricsDescription")}</p>
                        </div>
                        <Switch checked={grabLyrics} onCheckedChange={setGrabLyrics} aria-label={t("featurePanel.grabLyrics")} />
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div
              className={`flex-shrink-0 px-0 pt-3 ${
                forceVisibleOnMobile
                  ? `sticky bottom-0 ${getZIndexClass('CARD')} bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-background/80`
                  : 'pb-4'
              }`}
            >
              <div className="flex">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreateDisabled}
                  className="flex-1 h-12 px-4 text-base font-semibold bg-gradient-create text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-50"
                >
                  <div className={`relative ${getZIndexClass('MAIN_CONTENT')} flex items-center justify-center`}>
                    {isGenerating || isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <Disc3 className="h-4 w-4 animate-spin" />
                        <span>{t("featurePanel.creating")}</span>
                        <div className="flex items-center gap-1">
                          <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                          <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                        </div>
                      </div>
                    ) : isCreateDisabled ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Wand2 className="h-4 w-4" />
                        <span>{t("featurePanel.create")}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Wand2 className="h-4 w-4" />
                        <span>{t("featurePanel.create")}</span>
                        <span className="font-normal text-white/90">{"• " + t("featurePanel.costCredits", { credits: CLIENT_SOUND_CREDITS })}</span>
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ModelSelectionDialog
        open={isModelDialogOpen}
        onOpenChange={setIsModelDialogOpen}
        selectedModel={selectedModel === 'V5' || selectedModel === 'V5_5' ? selectedModel : 'V5'}
        onSelectModel={handleModelSelect}
        options={soundModelOptions}
        isModelLocked={(model) => isPremiumMusicModel(model) && !canUseV5Model}
        onLockedModelSelect={() => setIsPricingOpen(true)}
      />

      <PanelPricingModal open={isPricingOpen} onOpenChange={setIsPricingOpen} />
    </>
  );
};
