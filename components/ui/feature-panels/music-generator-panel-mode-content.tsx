"use client";

import React from "react";
import { ChevronDown, ChevronRight, Disc3, Gem, Info, Mic, Music2, Sparkles, Tag, Trash2, UploadCloud, Users, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type VocalGenderOption = {
  id: string;
  name: string;
};

export type AudioUploadIntent = "track" | "vocal" | "melody";

const LYRICS_TAG_OPTIONS = [
  { label: "Intro", value: "[Intro]" },
  { label: "Verse", value: "[Verse]" },
  { label: "Pre-Chorus", value: "[Pre-Chorus]" },
  { label: "Chorus", value: "[Chorus]" },
  { label: "Bridge", value: "[Bridge]" },
  { label: "Interlude", value: "[Interlude]" },
  { label: "Outro", value: "[Outro]" },
] as const;

const SINGLE_LINE_CARD_CLASS =
  "studio-panel-card rounded-2xl px-3 py-3 min-h-[52px] flex items-center justify-between gap-3";

const SINGLE_LINE_SEGMENTED_CLASS =
  "studio-panel-card inline-flex h-8 items-center rounded-full p-0.5 gap-0.5";

const SINGLE_LINE_SEGMENTED_BUTTON_BASE_CLASS =
  "h-7 rounded-full px-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

interface StudioSimpleModeContentProps {
  instrumentalMode: boolean;
  setInstrumentalMode: (mode: boolean) => void;
  showInstrumentalToggle?: boolean;
  showQuickButtonsSection?: boolean;
  promptTitle?: string;
  simplePrompt: string;
  setSimplePrompt: (prompt: string) => void;
  simplePromptMaxLength: number;
  quickButtons: React.ReactNode;
  onAddAudio: () => void;
  showAddAudioAction?: boolean;
  onClear: () => void;
  uploadCoverFile: File | null;
  uploadAudioPreview: React.ReactNode;
  isPublished: boolean;
  onPublicVisibilityChange: (published: boolean) => void;
  canDisablePublicVisibility?: boolean;
}

export const StudioSimpleModeContent: React.FC<StudioSimpleModeContentProps> = ({
  instrumentalMode,
  setInstrumentalMode,
  showInstrumentalToggle = true,
  showQuickButtonsSection = true,
  promptTitle = "Prompt",
  simplePrompt,
  setSimplePrompt,
  simplePromptMaxLength,
  quickButtons,
  onAddAudio,
  showAddAudioAction = true,
  onClear,
  uploadCoverFile,
  uploadAudioPreview,
  isPublished,
  onPublicVisibilityChange,
  canDisablePublicVisibility = false,
}) => {
  return (
    <>
      <div className="space-y-5 md:space-y-6 pt-2 md:pt-3">
        <section className="studio-panel-card rounded-2xl p-3 min-h-[320px] md:min-h-[340px]">
          <div className="mb-3 md:mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
              {promptTitle}
            </h3>
            {showInstrumentalToggle && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={instrumentalMode}
                    onCheckedChange={setInstrumentalMode}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground">Instrumental</span>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <Textarea
                placeholder="Describe your song idea"
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
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                    title="Add audio"
                  >
                    <UploadCloud className="h-3 w-3" />
                    <span className="text-xs font-medium">Add Audio</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClear}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  title="Clear"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="text-xs font-medium">Clear</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={SINGLE_LINE_CARD_CLASS}>
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="text-xs md:text-sm font-semibold text-foreground">Public Visibility</h3>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Public Visibility info"
                title="When enabled, this track can appear publicly in Explore."
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!canDisablePublicVisibility && (
                <Gem className="h-4 w-4 text-primary" aria-hidden="true" />
              )}
              <Switch
                checked={isPublished}
                onCheckedChange={onPublicVisibilityChange}
                className="scale-75"
              />
            </div>
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
  isMashupLoading?: boolean;
  onOpenPersonaDialog: () => void;
  hasUploadPreview?: boolean;
  hidePersonaAction?: boolean;
  selectedPersonaName?: string | null;
  selectedPersonaId: string;
  selectedPersonaModel: 'style_persona' | 'voice_persona';
  setSelectedPersonaModel?: (model: 'style_persona' | 'voice_persona') => void;
  canUseVoicePersonaModel?: boolean;
  instrumentalMode: boolean;
  setInstrumentalMode: (mode: boolean) => void;
  showInstrumentalToggle?: boolean;
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
  isPublished: boolean;
  onPublicVisibilityChange: (published: boolean) => void;
  canDisablePublicVisibility?: boolean;
}

export const StudioCustomModeContent: React.FC<StudioCustomModeContentProps> = ({
  uploadCoverFile,
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
  isMashupLoading = false,
  onOpenPersonaDialog,
  hasUploadPreview = false,
  hidePersonaAction = false,
  selectedPersonaName,
  selectedPersonaId,
  selectedPersonaModel,
  setSelectedPersonaModel,
  canUseVoicePersonaModel = false,
  instrumentalMode,
  setInstrumentalMode,
  showInstrumentalToggle = true,
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
  isPublished,
  onPublicVisibilityChange,
  canDisablePublicVisibility = false,
}) => {
  const showTrackIntent = allowedUploadIntents.includes("track");
  const showVocalIntent = allowedUploadIntents.includes("vocal");
  const showMelodyIntent = allowedUploadIntents.includes("melody");
  const hasAnyUploadIntentOption = showTrackIntent || showVocalIntent || showMelodyIntent;
  const canShowUploadActionsBase = showAddAudioActions && hasAnyUploadIntentOption && !hasUploadPreview;
  const showTrackUploadCard = preferTrackUploadCard && canShowUploadActionsBase && showTrackIntent && !showVocalIntent && !showMelodyIntent;
  const canShowAddAudioActions = canShowUploadActionsBase && !showTrackUploadCard;
  const showMashupAction = !hasUploadPreview && typeof onAddMashup === "function";
  const showPersonaAction = !hidePersonaAction;
  const [isAdvancedOptionsOpen, setIsAdvancedOptionsOpen] = React.useState(false);
  const [isPersonaOpen, setIsPersonaOpen] = React.useState(false);

  React.useEffect(() => {
    if (showAdvancedOptions) {
      setIsAdvancedOptionsOpen(false);
    }
  }, [showAdvancedOptions]);

  const actionOrder: Array<"add" | "mashup"> = [];
  if (canShowAddAudioActions) {
    actionOrder.push("add");
  }
  if (showMashupAction) {
    actionOrder.push("mashup");
  }

  const actionCount = actionOrder.length;
  const showLyrics = showLyricsSection;
  const showVocalGender = showVocalGenderSection && !instrumentalMode;
  const hasExplicitUploadIntent = uploadIntent !== null;
  const uploadIntentLabel = uploadIntent === "vocal"
    ? "Vocal"
    : uploadIntent === "melody"
      ? "Melody"
      : uploadIntent === "track"
        ? "Track"
        : "Add Audio";
  const UploadIntentIcon = uploadIntent === "vocal"
    ? Mic
    : uploadIntent === "melody"
      ? Music2
      : uploadIntent === "track"
        ? Disc3
        : UploadCloud;

  const getSegmentClass = (action: "add" | "mashup") => {
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
      <div className="space-y-5 md:space-y-6 pt-2 md:pt-3">
        {(showTrackUploadCard || actionCount > 0 || hasUploadPreview) && (
          <section className="space-y-1">
          {showTrackUploadCard && (
            <button
              type="button"
              onClick={onAddTrack}
              className="studio-panel-card w-full rounded-2xl p-3 text-left transition-colors hover:bg-foreground/5"
              title="Upload track"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Disc3 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">Track</span>
                    <span className="block text-xs text-muted-foreground">Click to upload your audio track</span>
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
                    title="Add audio"
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
                      <span>Track</span>
                    </DropdownMenuItem>
                  )}
                  {showVocalIntent && (
                    <DropdownMenuItem
                      onClick={onAddVocal}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm"
                    >
                      <Mic className="mr-2 h-3.5 w-3.5" />
                      <span>Vocal</span>
                    </DropdownMenuItem>
                  )}
                  {showMelodyIntent && (
                    <DropdownMenuItem
                      onClick={onAddMelody}
                      className="cursor-pointer rounded-lg px-2.5 py-2 text-sm"
                    >
                      <Music2 className="mr-2 h-3.5 w-3.5" />
                      <span>Melody</span>
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
                        <span>Clear Selection</span>
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
                title="Create mashup"
                onClick={onAddMashup}
                disabled={isMashupLoading}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-sm font-semibold tracking-tight">
                  {isMashupLoading ? "Preparing..." : "Mashup"}
                </span>
              </Button>
            )}

            </div>
          )}

          {hasUploadPreview && uploadAudioPreview}
          </section>
        )}

        {showLyrics && (
          <section className="studio-panel-card rounded-2xl p-3">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
                Lyrics
              </h3>
              {showInstrumentalToggle && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={instrumentalMode}
                    onCheckedChange={setInstrumentalMode}
                    className="scale-75"
                  />
                  <span className="text-xs text-muted-foreground">Instrumental</span>
                </div>
              )}
            </div>
            {instrumentalMode ? (
              <div className="rounded-xl bg-foreground/5 px-3 py-2 text-xs text-muted-foreground">
                Instrumental mode is enabled. Lyrics are optional.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Textarea
                    placeholder="Write your song lyrics here..."
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
                      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title="Generate lyrics with AI"
                      onClick={onGenerateLyrics}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Auto Generate</span>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Lyrics Tags"
                          aria-label="Lyrics Tags"
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
                      title={isWritingNextLyricLine ? "Writing next line" : "Write Next Line"}
                      aria-label={isWritingNextLyricLine ? "Writing next line" : "Write Next Line"}
                      className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={onWriteNextLyricLine}
                      disabled={isWritingNextLyricLine || !customLyrics.trim()}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      title="Clear Lyrics"
                      aria-label="Clear Lyrics"
                      className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={onClearCustomLyrics}
                      disabled={!customLyrics.trim()}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {styleSection}

        <section className="studio-panel-card rounded-2xl p-3">
          <h3 className="text-xs md:text-sm font-semibold mb-3 md:mb-4 flex items-center gap-2">
            Title
          </h3>
          <div>
            <Input
              placeholder="Enter your song title..."
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
              className="flex w-full min-h-[28px] items-center justify-between gap-3 rounded-xl text-left"
              onClick={() => setIsPersonaOpen((prev) => !prev)}
              aria-expanded={isPersonaOpen}
              aria-label="Toggle persona options"
            >
              <h3 className="text-xs md:text-sm font-semibold text-foreground">Persona</h3>
              <span className="inline-flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Optional</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    isPersonaOpen ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>

            {isPersonaOpen && (
              <div className="mt-3 space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="studio-panel-card h-[62px] w-full justify-start gap-2 px-3 text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors"
                  title="Select persona"
                  onClick={onOpenPersonaDialog}
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold tracking-tight text-foreground">
                      {selectedPersonaName || (selectedPersonaId ? "Persona Selected" : "Persona")}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">Select/Create Persona</span>
                  </span>
                  <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Button>
                <div className="studio-panel-card inline-flex w-full items-center rounded-full p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPersonaModel?.('style_persona')}
                    title="Applies style-focused persona characteristics"
                    className={`flex-1 rounded-full px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      selectedPersonaModel === 'style_persona'
                        ? 'bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                        : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    Style Persona
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canUseVoicePersonaModel) return;
                      setSelectedPersonaModel?.('voice_persona');
                    }}
                    disabled={!canUseVoicePersonaModel}
                    title="Applies voice-focused persona characteristics (only available with V5 model)"
                    className={`flex-1 rounded-full px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      selectedPersonaModel === 'voice_persona' && canUseVoicePersonaModel
                        ? 'bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                        : canUseVoicePersonaModel
                          ? 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                          : 'cursor-not-allowed text-foreground/35'
                    }`}
                  >
                    Voice Persona
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {showAdvancedOptions && (
          <section className="studio-panel-card rounded-2xl p-3 min-h-[52px]">
            <button
              type="button"
              className="flex w-full min-h-[28px] items-center justify-between gap-3 rounded-xl text-left"
              onClick={() => setIsAdvancedOptionsOpen((prev) => !prev)}
              aria-expanded={isAdvancedOptionsOpen}
              aria-label="Toggle advanced options"
            >
              <h3 className="text-xs md:text-sm font-semibold text-foreground">Advanced Options</h3>
              <span className="inline-flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Optional</span>
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
                    <p className="text-xs font-semibold text-foreground whitespace-nowrap">Vocal Gender</p>
                    <div className={`${SINGLE_LINE_SEGMENTED_CLASS} shrink-0 whitespace-nowrap`}>
                      {vocalGenders.map((gender) => (
                        <button
                          key={gender.id}
                          onClick={() => setVocalGender(gender.id)}
                          className={`${SINGLE_LINE_SEGMENTED_BUTTON_BASE_CLASS} ${
                            vocalGender === gender.id
                              ? 'bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
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
                        <p className="text-xs font-semibold text-foreground">Style Weight</p>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                          aria-label="Style Weight info"
                          title="Controls how closely the result follows the chosen style. Higher values keep it more faithful to that style."
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="inline-flex h-8 min-w-[56px] items-center justify-end px-1 text-xs font-semibold text-foreground/80">
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
                      <p className="text-xs font-semibold text-foreground">Weirdness Constraint</p>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Weirdness Constraint info"
                        title="Controls the experimental range of the output. Higher values allow more creative and unexpected variations."
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="inline-flex h-8 min-w-[56px] items-center justify-end px-1 text-xs font-semibold text-foreground/80">
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
                      <p className="text-xs font-semibold text-foreground">Audio Weight</p>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Audio Weight info"
                        title="Adjusts how strongly audio elements are weighted. Higher values give audio characteristics more influence."
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="inline-flex h-8 min-w-[56px] items-center justify-end px-1 text-xs font-semibold text-foreground/80">
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

        <section className={SINGLE_LINE_CARD_CLASS}>
          <div className="w-full flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <h3 className="text-xs md:text-sm font-semibold text-foreground">Public Visibility</h3>
              <button
                type="button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Public Visibility info"
                title="When enabled, this track can appear publicly in Explore."
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {!canDisablePublicVisibility && (
                <Gem className="h-4 w-4 text-primary" aria-hidden="true" />
              )}
              <Switch
                checked={isPublished}
                onCheckedChange={onPublicVisibilityChange}
                className="scale-75"
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
};
