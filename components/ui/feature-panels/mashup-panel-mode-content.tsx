"use client";

import React from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Disc3, Info, Mic, Music2, Pause, Play, SlidersHorizontal, Trash2, UploadCloud, Users, Wand2, Tag, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LYRICS_TAG_OPTIONS } from "@/lib/lyrics-tags";
import { useI18n } from "@/lib/i18n/provider";
import { getDrumKitIcon, getInstrumentIcon } from "@/lib/music-resources";
import { formatDuration } from "@/lib/format-utils";

type NamedOption = {
  id: string;
  name: string;
};

type VocalGenderOption = {
  id: string;
  name: string;
};

export type AudioUploadIntent = "track" | "vocal" | "melody";

const formatAudioTypeLabel = (mimeType?: string | null) => {
  if (!mimeType) return null;

  const normalized = mimeType.toLowerCase();
  const mimeToLabel: Record<string, string> = {
    "audio/mpeg": "MP3",
    "audio/mp3": "MP3",
    "audio/wav": "WAV",
    "audio/x-wav": "WAV",
    "audio/wave": "WAV",
    "audio/x-pn-wav": "WAV",
    "audio/flac": "FLAC",
    "audio/x-flac": "FLAC",
    "audio/aac": "AAC",
    "audio/mp4": "M4A",
    "audio/x-m4a": "M4A",
    "audio/ogg": "OGG",
    "audio/webm": "WEBM",
  };

  if (mimeToLabel[normalized]) {
    return mimeToLabel[normalized];
  }

  const slashIndex = normalized.indexOf("/");
  if (slashIndex < 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return normalized.slice(slashIndex + 1).toUpperCase();
};

const formatFileSizeInMb = (bytes?: number | null) => {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

interface StudioSimpleModeContentProps {
  showQuickButtonsSection?: boolean;
  promptTitle?: string;
  simplePrompt: string;
  setSimplePrompt: (prompt: string) => void;
  simplePromptMaxLength: number;
  quickButtons: React.ReactNode;
  onAddAudio: () => void;
  showAddAudioAction?: boolean;
  onClear: () => void;
  leadInstruments: NamedOption[];
  drumKits: NamedOption[];
  onSelectLeadInstrument: (instrumentId: string) => void;
  onSelectDrumKit: (kitId: string) => void;
  onPreviewLeadInstrument: (instrumentId: string) => void;
  onPreviewDrumKit: (kitId: string) => void;
  uploadCoverFile: File | null;
  uploadAudioPreview: React.ReactNode;
}

export const StudioSimpleModeContent: React.FC<StudioSimpleModeContentProps> = ({
  showQuickButtonsSection = true,
  promptTitle = "Prompt",
  simplePrompt,
  setSimplePrompt,
  simplePromptMaxLength,
  quickButtons,
  onAddAudio,
  showAddAudioAction = true,
  onClear,
  leadInstruments,
  drumKits,
  onSelectLeadInstrument,
  onSelectDrumKit,
  onPreviewLeadInstrument,
  onPreviewDrumKit,
  uploadCoverFile,
  uploadAudioPreview,
}) => {
  const { t } = useI18n();
  const resolvedPromptTitle = promptTitle === "Prompt" ? t("featurePanel.prompt") : promptTitle;
  return (
    <>
      <div className="space-y-5 md:space-y-6">
        <section className="studio-panel-card rounded-2xl p-3">
          <div className="mb-3 md:mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
              {resolvedPromptTitle}
            </h3>
          </div>
          <div className="space-y-3">
            <div>
              <Textarea
                placeholder={t("featurePanel.describeSongIdea")}
                value={simplePrompt}
                onChange={(e) => setSimplePrompt(e.target.value)}
                maxLength={simplePromptMaxLength}
                className="min-h-[180px] md:min-h-[200px] resize-none pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {showQuickButtonsSection && (
              <div className="space-y-2">
                {quickButtons}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {simplePrompt.length}/{simplePromptMaxLength}
              </div>
              <div className="flex items-center gap-2">
                {showAddAudioAction && (
                  <button
                    type="button"
                    onClick={onAddAudio}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    title={t("featurePanel.addAudio")}
                  >
                    <UploadCloud className="h-3 w-3" />
                    <span className="text-xs font-medium">{t("featurePanel.addAudio")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  title={t("featurePanel.clear")}
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="text-xs font-medium">{t("featurePanel.clear")}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="studio-panel-card rounded-2xl p-3">
          <div className="pb-2 text-xs md:text-sm font-semibold text-foreground/80">
            {t("featurePanel.classicInstrumentsPreview")}
          </div>

          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {leadInstruments.map((instrument) => {
              const iconUrl = getInstrumentIcon(instrument.id);

              return (
                <div
                  key={`instrument-${instrument.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectLeadInstrument(instrument.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectLeadInstrument(instrument.id);
                    }
                  }}
                  className="group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-[#0c0c16] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15"
                >
                  {iconUrl && (
                    <Image
                      src={iconUrl}
                      alt={instrument.name}
                      width={16}
                      height={16}
                      className="h-7 w-7"
                    />
                  )}
                  <span className="text-xs">{instrument.name}</span>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={t("featurePanel.playSample")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewLeadInstrument(instrument.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onPreviewLeadInstrument(instrument.id);
                      }
                    }}
                    className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-black/50 text-white transition-all duration-200 hover:bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                    title={t("featurePanel.playSample")}
                  >
                    <Play className="h-4 w-4" />
                  </div>
                </div>
              );
            })}

            {drumKits.map((kit) => {
              const iconUrl = getDrumKitIcon(kit.id);

              return (
                <div
                  key={`drum-${kit.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectDrumKit(kit.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectDrumKit(kit.id);
                    }
                  }}
                  className="group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-[#0c0c16] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15"
                >
                  {iconUrl && (
                    <Image
                      src={iconUrl}
                      alt={kit.name}
                      width={16}
                      height={16}
                      className="h-7 w-7"
                    />
                  )}
                  <span className="text-xs">{kit.name}</span>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={t("featurePanel.playSample")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreviewDrumKit(kit.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onPreviewDrumKit(kit.id);
                      }
                    }}
                    className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-black/50 text-white transition-all duration-200 hover:bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                    title={t("featurePanel.playSample")}
                  >
                    <Play className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {uploadCoverFile && (
          <section>
            {uploadAudioPreview}
          </section>
        )}
      </div>
    </>
  );
};

interface StudioCustomModeContentProps {
  uploadCoverFile: File | null;
  uploadAudioPreview: React.ReactNode;
  uploadIntent: AudioUploadIntent | null;
  preferTrackUploadCard?: boolean;
  showAddAudioActions?: boolean;
  allowedUploadIntents?: AudioUploadIntent[];
  onAddTrack: () => void;
  onAddVocal: () => void;
  onAddMelody: () => void;
  onClearUploadIntent?: () => void;
  onAddMashup?: () => void;
  showMashupAudioPickers?: boolean;
  onSelectMashupAudioOne?: () => void;
  onSelectMashupAudioTwo?: () => void;
  mashupAudioOneName?: string | null;
  mashupAudioTwoName?: string | null;
  mashupAudioOneType?: string | null;
  mashupAudioTwoType?: string | null;
  mashupAudioOneSizeBytes?: number | null;
  mashupAudioTwoSizeBytes?: number | null;
  mashupAudioOneDuration?: number | null;
  mashupAudioTwoDuration?: number | null;
  mashupPlayingIndex?: number | null;
  onPlayMashupAudioOne?: () => void;
  onPlayMashupAudioTwo?: () => void;
  isMashupLoading?: boolean;
  onOpenPersonaDialog: () => void;
  hasUploadPreview?: boolean;
  hidePersonaAction?: boolean;
  selectedPersonaName?: string | null;
  selectedPersonaDescription?: string | null;
  selectedPersonaId: string;
  customLyrics: string;
  setCustomLyrics: (lyrics: string) => void;
  customPromptMaxLength: number;
  showLyricsSection?: boolean;
  onGenerateLyrics?: () => void;
  onWriteNextLyricLine?: () => void;
  isWritingNextLyricLine?: boolean;
  onClearCustomLyrics: () => void;
  vocalGender: string;
  setVocalGender: (gender: string) => void;
  vocalGenders: VocalGenderOption[];
  showVocalGenderSection?: boolean;
  styleSection: React.ReactNode;
  songTitle: string;
  setSongTitle: (title: string) => void;
  titleMaxLength: number;
  styleWeight?: number;
  setStyleWeight: (value: number) => void;
  weirdnessConstraint?: number;
  setWeirdnessConstraint: (value: number) => void;
  audioWeight?: number;
  setAudioWeight: (value: number) => void;
  showAdvancedOptions?: boolean;
}

export const StudioCustomModeContent: React.FC<StudioCustomModeContentProps> = ({
  uploadCoverFile: _uploadCoverFile,
  uploadAudioPreview,
  uploadIntent,
  preferTrackUploadCard = false,
  showAddAudioActions = true,
  allowedUploadIntents = ["track", "vocal", "melody"],
  onAddTrack,
  onAddVocal,
  onAddMelody,
  onClearUploadIntent,
  onAddMashup,
  showMashupAudioPickers = false,
  onSelectMashupAudioOne,
  onSelectMashupAudioTwo,
  mashupAudioOneName = null,
  mashupAudioTwoName = null,
  mashupAudioOneType = null,
  mashupAudioTwoType = null,
  mashupAudioOneSizeBytes = null,
  mashupAudioTwoSizeBytes = null,
  mashupAudioOneDuration = null,
  mashupAudioTwoDuration = null,
  mashupPlayingIndex = null,
  onPlayMashupAudioOne,
  onPlayMashupAudioTwo,
  isMashupLoading = false,
  onOpenPersonaDialog,
  hasUploadPreview = false,
  hidePersonaAction = false,
  selectedPersonaName,
  selectedPersonaDescription,
  selectedPersonaId,
  customLyrics,
  setCustomLyrics,
  customPromptMaxLength,
  showLyricsSection = true,
  onGenerateLyrics,
  onWriteNextLyricLine,
  isWritingNextLyricLine = false,
  onClearCustomLyrics,
  vocalGender,
  setVocalGender,
  vocalGenders,
  showVocalGenderSection = true,
  styleSection,
  songTitle,
  setSongTitle,
  titleMaxLength,
  styleWeight,
  setStyleWeight,
  weirdnessConstraint,
  setWeirdnessConstraint,
  audioWeight,
  setAudioWeight,
  showAdvancedOptions = true,
}) => {
  const { t } = useI18n();
  const showTrackIntent = allowedUploadIntents.includes("track");
  const showVocalIntent = allowedUploadIntents.includes("vocal");
  const showMelodyIntent = allowedUploadIntents.includes("melody");
  const showMashupPickers = showMashupAudioPickers
    && typeof onSelectMashupAudioOne === "function"
    && typeof onSelectMashupAudioTwo === "function";
  const hasMashupAudioOne = Boolean(mashupAudioOneName);
  const hasMashupAudioTwo = Boolean(mashupAudioTwoName);
  const mashupAudioOneTypeLabel = formatAudioTypeLabel(mashupAudioOneType);
  const mashupAudioTwoTypeLabel = formatAudioTypeLabel(mashupAudioTwoType);
  const mashupAudioOneSizeLabel = formatFileSizeInMb(mashupAudioOneSizeBytes);
  const mashupAudioTwoSizeLabel = formatFileSizeInMb(mashupAudioTwoSizeBytes);
  const mashupAudioOneDurationLabel = typeof mashupAudioOneDuration === "number" && mashupAudioOneDuration > 0
    ? formatDuration(Math.floor(mashupAudioOneDuration))
    : null;
  const mashupAudioTwoDurationLabel = typeof mashupAudioTwoDuration === "number" && mashupAudioTwoDuration > 0
    ? formatDuration(Math.floor(mashupAudioTwoDuration))
    : null;
  const mashupAudioOneMetaText = [mashupAudioOneDurationLabel, mashupAudioOneSizeLabel].filter(Boolean).join(" · ");
  const mashupAudioTwoMetaText = [mashupAudioTwoDurationLabel, mashupAudioTwoSizeLabel].filter(Boolean).join(" · ");
  const hasAnyUploadIntentOption = showTrackIntent || showVocalIntent || showMelodyIntent;
  const canShowUploadActionsBase = showAddAudioActions && hasAnyUploadIntentOption && !hasUploadPreview;
  const showTrackUploadCard = preferTrackUploadCard && canShowUploadActionsBase && showTrackIntent && !showVocalIntent && !showMelodyIntent;
  const canShowAddAudioActions = canShowUploadActionsBase && !showTrackUploadCard;
  const showMashupAction = !showMashupPickers && !hasUploadPreview && typeof onAddMashup === "function";
  const showPersonaAction = !hidePersonaAction;
  const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = React.useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = React.useState(false);

  React.useEffect(() => {
    if (showAdvancedOptions) {
      setIsAdvancedOptionsOpen(false);
    }
  }, [showAdvancedOptions]);

  const actionOrder: Array<"add" | "mashup" | "persona"> = [];
  if (canShowAddAudioActions) {
    actionOrder.push("add");
  }
  if (showMashupAction) {
    actionOrder.push("mashup");
  }
  const actionCount = actionOrder.length;
  const showLyrics = showLyricsSection;
  const showVocalGender = showVocalGenderSection;
  const hasExplicitUploadIntent = uploadIntent !== null;
  const uploadIntentLabel = uploadIntent === "vocal"
    ? t("featurePanel.vocal")
    : uploadIntent === "melody"
      ? t("featurePanel.melody")
      : uploadIntent === "track"
        ? t("featurePanel.track")
        : t("featurePanel.addAudio");
  const UploadIntentIcon = uploadIntent === "vocal"
    ? Mic
    : uploadIntent === "melody"
      ? Music2
      : uploadIntent === "track"
        ? Disc3
        : UploadCloud;

  const getSegmentClass = (action: "add" | "mashup" | "persona") => {
    const index = actionOrder.indexOf(action);
    if (index < 0 || actionCount <= 1) {
      return "rounded-2xl";
    }
    if (index === 0) {
      return "rounded-l-2xl rounded-r-none";
    }
    if (index === actionCount - 1) {
      return "rounded-r-2xl rounded-l-none";
    }
    return "rounded-none";
  };

  const handleInsertLyricsTag = (tag: string) => {
    const trimmedLyrics = customLyrics.trimEnd();
    const nextLyrics = trimmedLyrics
      ? `${trimmedLyrics}

${tag}
`
      : `${tag}
`;
    setCustomLyrics(nextLyrics);
  };

  const clampWeight = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    return Math.round(clamped * 100) / 100;
  };

  const toPercent = (value: number | undefined) => Math.round(clampWeight(value ?? 0.5) * 100);

  const updateWeightFromPercent = (setter: (value: number) => void, rawPercentValue: string) => {
    const nextPercent = Number.parseFloat(rawPercentValue);
    if (!Number.isFinite(nextPercent)) {
      return;
    }
    setter(clampWeight(nextPercent / 100));
  };

  return (
    <>
      <div className="space-y-5 md:space-y-6">
        {showMashupPickers && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="studio-panel-card w-full rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={hasMashupAudioOne ? onPlayMashupAudioOne : onSelectMashupAudioOne}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/15 hover:text-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={hasMashupAudioOne ? t("featurePanel.playAudioWithIndex", { index: 1 }) : t("featurePanel.selectFirstAudio")}
                  disabled={hasMashupAudioOne && typeof onPlayMashupAudioOne !== "function"}
                >
                  {hasMashupAudioOne ? (
                    mashupPlayingIndex === 0 ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onSelectMashupAudioOne}
                  className="min-w-0 flex-1 text-left transition-colors hover:text-foreground/80"
                  title={hasMashupAudioOne ? t("featurePanel.replaceFirstAudio") : t("featurePanel.selectFirstAudio")}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {mashupAudioOneName || t("featurePanel.mashupAudioWithIndex", { index: 1 })}
                    </span>
                    {mashupAudioOneTypeLabel && (
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-foreground/65">
                        {mashupAudioOneTypeLabel}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground truncate">
                    {hasMashupAudioOne
                      ? (
                        <span>{mashupAudioOneMetaText || "--:--"}</span>
                      )
                      : t("featurePanel.selectAudioFile")}
                  </span>
                </button>
              </div>
            </div>

            <div className="studio-panel-card w-full rounded-2xl p-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={hasMashupAudioTwo ? onPlayMashupAudioTwo : onSelectMashupAudioTwo}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary/15 hover:text-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={hasMashupAudioTwo ? t("featurePanel.playAudioWithIndex", { index: 2 }) : t("featurePanel.selectSecondAudio")}
                  disabled={hasMashupAudioTwo && typeof onPlayMashupAudioTwo !== "function"}
                >
                  {hasMashupAudioTwo ? (
                    mashupPlayingIndex === 1 ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />
                  ) : (
                    <UploadCloud className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onSelectMashupAudioTwo}
                  className="min-w-0 flex-1 text-left transition-colors hover:text-foreground/80"
                  title={hasMashupAudioTwo ? t("featurePanel.replaceSecondAudio") : t("featurePanel.selectSecondAudio")}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="block min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {mashupAudioTwoName || t("featurePanel.mashupAudioWithIndex", { index: 2 })}
                    </span>
                    {mashupAudioTwoTypeLabel && (
                      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-foreground/65">
                        {mashupAudioTwoTypeLabel}
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground truncate">
                    {hasMashupAudioTwo
                      ? (
                        <span>{mashupAudioTwoMetaText || "--:--"}</span>
                      )
                      : t("featurePanel.selectAudioFile")}
                  </span>
                </button>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-1">
          {showTrackUploadCard && (
            <button
              type="button"
              onClick={onAddTrack}
              className="studio-panel-card w-full rounded-2xl p-3 text-left transition-colors hover:bg-foreground/5"
              title={t("featurePanel.uploadTrack")}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Disc3 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{t("featurePanel.track")}</span>
                    <span className="block text-sm text-muted-foreground">{t("featurePanel.clickToUploadAudioTrack")}</span>
                  </span>
                </div>
                <UploadCloud className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          )}

          {actionCount > 0 && (
            <div className={`grid ${actionCount === 1 ? 'grid-cols-1' : actionCount === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}>
            {canShowAddAudioActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`studio-panel-card h-12 w-full justify-center text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors ${getSegmentClass("add")}`}
                    title={t("featurePanel.addAudio")}
                  >
                    <UploadIntentIcon className="h-3.5 w-3.5" />
                    <span className="text-sm font-semibold tracking-tight">{uploadIntentLabel}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[190px] p-1.5">
                  {showTrackIntent && (
                    <DropdownMenuItem
                      onClick={onAddTrack}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm"
                    >
                      <Disc3 className="mr-2 h-3.5 w-3.5" />
                      <span>{t("featurePanel.track")}</span>
                    </DropdownMenuItem>
                  )}
                  {showVocalIntent && (
                    <DropdownMenuItem
                      onClick={onAddVocal}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm"
                    >
                      <Mic className="mr-2 h-3.5 w-3.5" />
                      <span>{t("featurePanel.vocal")}</span>
                    </DropdownMenuItem>
                  )}
                  {showMelodyIntent && (
                    <DropdownMenuItem
                      onClick={onAddMelody}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm"
                    >
                      <Music2 className="mr-2 h-3.5 w-3.5" />
                      <span>{t("featurePanel.melody")}</span>
                    </DropdownMenuItem>
                  )}
                  {hasExplicitUploadIntent && onClearUploadIntent && (
                    <>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem
                        onClick={onClearUploadIntent}
                        className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-muted-foreground"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        <span>{t("featurePanel.clearSelection")}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {showMashupAction && (
              <Button
                variant="ghost"
                size="sm"
                className={`studio-panel-card h-12 w-full justify-center text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors ${getSegmentClass("mashup")}`}
                title={t("featurePanel.createMashup")}
                onClick={onAddMashup}
                disabled={isMashupLoading}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold tracking-tight">
                  {isMashupLoading ? t("featurePanel.preparing") : t("featurePanel.mashup")}
                </span>
              </Button>
            )}

            </div>
          )}

          {hasUploadPreview && !showMashupPickers && uploadAudioPreview}
        </section>

        {showLyrics && (
          <section className="studio-panel-card rounded-2xl p-3">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                {t("featurePanel.lyrics")}
              </h3>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  placeholder={t("featurePanel.writeSongLyricsPlaceholder")}
                  value={customLyrics}
                  onChange={(e) => setCustomLyrics(e.target.value)}
                  maxLength={customPromptMaxLength}
                  className="min-h-[136px] md:min-h-[160px] resize-y pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {customLyrics.length}/{customPromptMaxLength}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    title={t("featurePanel.generateLyricsWithAI")}
                    onClick={onGenerateLyrics}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{t("featurePanel.autoGenerate")}</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={t("featurePanel.lyricsTags")}
                        aria-label={t("featurePanel.lyricsTags")}
                        className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      >
                        <Tag className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[156px] p-1.5">
                      {LYRICS_TAG_OPTIONS.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onClick={() => handleInsertLyricsTag(option.value)}
                          className="cursor-pointer px-2.5 py-1.5 text-xs"
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="ghost"
                    size="sm"
                    title={isWritingNextLyricLine ? t("featurePanel.writingNextLine") : t("featurePanel.writeNextLine")}
                    aria-label={isWritingNextLyricLine ? t("featurePanel.writingNextLine") : t("featurePanel.writeNextLine")}
                    className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onWriteNextLyricLine}
                    disabled={isWritingNextLyricLine || !customLyrics.trim()}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    title={t("featurePanel.clearLyrics")}
                    aria-label={t("featurePanel.clearLyrics")}
                    className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={onClearCustomLyrics}
                    disabled={!customLyrics.trim()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {styleSection}

        <section className="studio-panel-card rounded-2xl p-3">
          <h3 className="text-xs md:text-sm font-semibold mb-3 md:mb-4 flex items-center gap-2">
            {t("featurePanel.title")}
          </h3>
          <div>
            <Input
              placeholder={t("featurePanel.enterSongTitle")}
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              maxLength={titleMaxLength}
              className="h-12 pl-0 pr-0 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              {songTitle.length}/{titleMaxLength}
            </div>
          </div>
        </section>

        {showPersonaAction && (
          <section className="studio-panel-card rounded-2xl p-3 min-h-[52px]">
            <button
              type="button"
              className="flex w-full min-h-[28px] items-center justify-between gap-3 rounded-xl p-1 text-left"
              onClick={() => setIsPersonaOpen((prev) => !prev)}
              aria-expanded={isPersonaOpen}
              aria-label={t("featurePanel.togglePersonaOptions")}
            >
              <h3 className="text-xs md:text-sm font-semibold text-foreground">{t("featurePanel.persona")}</h3>
              <span className="inline-flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t("featurePanel.optional")}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    isPersonaOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            {isPersonaOpen && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="studio-panel-card h-[62px] w-full justify-start gap-2 px-3 text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors"
                  title={t("featurePanel.selectPersona")}
                  onClick={onOpenPersonaDialog}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold tracking-tight text-foreground">
                      {selectedPersonaName || (selectedPersonaId ? t("featurePanel.personaSelected") : t("featurePanel.persona"))}
                    </span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      {selectedPersonaId && selectedPersonaDescription
                        ? selectedPersonaDescription
                        : t("featurePanel.selectCreatePersona")}
                    </span>
                  </span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Button>
              </div>
            )}
          </section>
        )}

        {showAdvancedOptions && (
          <section className="studio-panel-card rounded-2xl p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-xl p-1 text-left"
              onClick={() => setIsAdvancedOptionsOpen((prev) => !prev)}
              aria-expanded={isAdvancedOptionsOpen}
              aria-label={t("featurePanel.toggleAdvancedOptions")}
            >
              <h3 className="text-xs md:text-sm font-semibold text-foreground inline-flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t("featurePanel.advancedOptions")}
              </h3>
              <span className="inline-flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{t("featurePanel.optional")}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    isAdvancedOptionsOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            {isAdvancedOptionsOpen && (
              <div className="mt-3 space-y-4">
                {showVocalGender && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-foreground whitespace-nowrap">{t("featurePanel.vocalGender")}</p>
                    <div className="studio-panel-card inline-flex shrink-0 whitespace-nowrap items-center rounded-full p-1 gap-1">
                      {vocalGenders.map((gender) => (
                        <button
                          key={gender.id}
                          onClick={() => setVocalGender(gender.id)}
                          className={`px-4 py-2 text-xs md:text-sm font-medium transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            vocalGender === gender.id
                              ? 'bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                              : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                          }`}
                        >
                          {gender.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5">
                        <p className="text-xs font-medium text-foreground">{t("featurePanel.styleWeight")}</p>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={t("featurePanel.styleWeightInfoLabel")}
                          title={t("featurePanel.styleWeightInfoText")}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="inline-flex h-8 min-w-[56px] items-center justify-end px-1 text-xs font-medium text-foreground/80">
                      {toPercent(styleWeight)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={toPercent(styleWeight)}
                    onChange={(event) => updateWeightFromPercent(setStyleWeight, event.target.value)}
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5">
                        <p className="text-xs font-medium text-foreground">{t("featurePanel.weirdnessConstraint")}</p>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={t("featurePanel.weirdnessConstraintInfoLabel")}
                          title={t("featurePanel.weirdnessConstraintInfoText")}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="inline-flex h-8 min-w-[56px] items-center justify-end px-1 text-xs font-medium text-foreground/80">
                      {toPercent(weirdnessConstraint)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={toPercent(weirdnessConstraint)}
                    onChange={(event) => updateWeightFromPercent(setWeirdnessConstraint, event.target.value)}
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5">
                        <p className="text-xs font-medium text-foreground">{t("featurePanel.audioWeight")}</p>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={t("featurePanel.audioWeightInfoLabel")}
                          title={t("featurePanel.audioWeightInfoText")}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="inline-flex h-8 min-w-[56px] items-center justify-end px-1 text-xs font-medium text-foreground/80">
                      {toPercent(audioWeight)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={toPercent(audioWeight)}
                    onChange={(event) => updateWeightFromPercent(setAudioWeight, event.target.value)}
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
};
