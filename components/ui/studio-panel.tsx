"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Play, CreditCard, X, Check, Triangle, Pause, Wand2, Trash2, Loader2, Info } from "lucide-react";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Tooltip } from '@/components/ui/tooltip';
import { Switch } from "@/components/ui/switch";
import Image from 'next/image';
import { CLIENT_MUSIC_CREDITS, CLIENT_STYLE_BOOST_CREDITS, CLIENT_UPLOAD_AUDIO_CREDITS } from '@/lib/credits-config';
import { getInstrumentIcon, getInstrumentAudio, getDrumKitIcon, getDrumKitAudio } from '@/lib/music-resources';
import { replaceTextInStyle, updateStatesFromTextarea, getRandomBpm } from '@/lib/studio-utils';
import { TEMPO_KEYWORDS, BUTTON_CLASSES, STYLES } from '@/lib/studio-constants';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { useStudioUploadWorkflow } from '@/hooks/use-studio-upload-workflow';
import type { UploadPanelMode } from '@/hooks/use-studio-upload-workflow';
import { UploadProgressDialog } from "@/components/ui/upload-progress-dialog";
import { formatDuration } from '@/lib/format-utils';
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { EditAudioDialog } from "@/features/music-upload/components/edit-audio-dialog";
import { StudioCustomModeContent, StudioSimpleModeContent } from "@/components/ui/studio-panel-mode-content";
import { StudioPanelPersonaDialogs } from "@/components/ui/studio-panel-persona-dialogs";
import { useStudioPersonaManager } from "@/hooks/use-studio-persona-manager";
import { MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PricingSection } from '@/components/layout/sections/pricing';

// Extract options from musicOptions
const { genres, vibes, grooveTypes, leadInstruments, drumKits, bassTones, vocalGenders, harmonyPalettes } = musicOptions;
const HERO_GENRE_ICONS: Record<string, string> = {
  "new-jack-swing": "New Jack Swing Icon.webp",
  "neo-soul": "Neo-Soul Icon.webp",
  "quiet-storm": "Quiet Storm Icon.webp",
  "hip-hop-soul": "Hip-Hop Soul Icon.webp",
  "crunk-rnb": "Crunk Icon.webp",
  "pb-rnb": "PB Icon.webp",
};


interface StudioPanelProps {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  hasPlayer?: boolean;
  
  // Music generation states
  mode: "simple" | "custom";
  setMode: (mode: "simple" | "custom") => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  selectedVibe: string;
  setSelectedVibe: (vibe: string) => void;
  simplePrompt: string;
  setSimplePrompt: (prompt: string) => void;
  customLyrics: string;
  setCustomLyrics: (lyrics: string) => void;
  songTitle: string;
  setSongTitle: (title: string) => void;
  instrumentalMode: boolean;
  setInstrumentalMode: (mode: boolean) => void;
  isPublished: boolean;
  styleText: string;
  setStyleText: (text: string) => void;
  enhanceStyle: boolean;
  setEnhanceStyle: (enabled: boolean) => void;
  bpm: number[];
  setBpm: (bpm: number[]) => void;
  grooveType: string;
  setGrooveType: (type: string) => void;
  leadInstrument: string[];
  setLeadInstrument: (instruments: string[]) => void;
  drumKit: string;
  setDrumKit: (kit: string) => void;
  bassTone: string;
  setBassTone: (tone: string) => void;
  vocalGender: string;
  setVocalGender: (gender: string) => void;
  harmonyPalette: string;
  setHarmonyPalette: (palette: string) => void;
  
  // BPM Mode
  bpmMode: 'slow' | 'moderate' | 'medium' | '';
  setBpmMode: (mode: 'slow' | 'moderate' | 'medium' | '') => void;
  
  // Generation
  isGenerating: boolean;
  onGenerationStart?: (options?: {
    uploadFile?: File | null;
    uploadUrl?: string | null;
    mode?: "cover" | "extend";
    continueAt?: number;
  }) => Promise<boolean> | void;
  onGenerateLyrics?: () => void;
  onWriteNextLyricLine?: () => void;
  isWritingNextLyricLine?: boolean;
  // 新增：在移动端强制可见（用于移动端Tab中的创作页）
  forceVisibleOnMobile?: boolean;
  // 新增：点击收起并显示tracks列表
  onCollapseToTracks?: () => void;
  // 新增：收起（关闭）面板
  onCollapse?: () => void;
  // 上传任务回调
  // AuthModal相关
  isAuthModalOpen?: boolean;
  setIsAuthModalOpen?: (open: boolean) => void;
  // Model selection
  selectedModel?: MusicModel;
  setSelectedModel?: (model: MusicModel) => void;
  selectedPersonaId?: string;
  setSelectedPersonaId?: (personaId: string) => void;
}

export const StudioPanel = (props: StudioPanelProps) => {
  const {
    panelOpen,
    forceVisibleOnMobile = false,
    hasPlayer = false,
    setIsAuthModalOpen,
    mode,
    setMode,
    selectedGenre,
    setSelectedGenre,
    selectedVibe,
    setSelectedVibe,
  simplePrompt,
  setSimplePrompt,
  customLyrics,
  setCustomLyrics,
    songTitle,
    setSongTitle,
    instrumentalMode,
    setInstrumentalMode,
    isPublished,
    styleText,
    setStyleText,
    enhanceStyle,
    setEnhanceStyle,
    bpm,
    setBpm,
    grooveType,
    setGrooveType,
    leadInstrument,
    setLeadInstrument,
    drumKit,
    setDrumKit,
    bassTone,
    setBassTone,
    vocalGender,
    setVocalGender,
    harmonyPalette,
    setHarmonyPalette,
    bpmMode,
    setBpmMode,
    isGenerating,
    onGenerationStart,
    onGenerateLyrics,
    onWriteNextLyricLine,
    isWritingNextLyricLine = false,
    selectedModel = 'V4_5',
    setSelectedModel,
    selectedPersonaId = '',
    setSelectedPersonaId,
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();
  const userSelectedModelRef = React.useRef(false);
  const simplePromptMaxLength = 400;
  const customPromptMaxLength = 5000;
  const styleTextMaxLength = 1000;
  const maxUploadDurationSeconds = 8 * 60;
  const isCustomMode = mode === "custom";
  const effectiveModel: MusicModel = isCustomMode ? selectedModel : 'V4';
  const supportsStyleBoost = ['V4_5', 'V4_5PLUS', 'V4_5ALL'].includes(
    String(effectiveModel).toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS')
  );

  const updateSelectedModel = React.useCallback((
    model: MusicModel,
    options: { userInitiated?: boolean; forceOverride?: boolean } = {}
  ) => {
    if (!setSelectedModel) return;
    const { userInitiated = false, forceOverride = false } = options;

    if (userInitiated) {
      userSelectedModelRef.current = true;
      setSelectedModel(model);
      return;
    }

    if (forceOverride) {
      userSelectedModelRef.current = false;
      setSelectedModel(model);
      return;
    }

    if (userSelectedModelRef.current) {
      return;
    }

    setSelectedModel(model);
  }, [setSelectedModel]);

  React.useEffect(() => {
    userSelectedModelRef.current = false;
  }, [user?.id]);

  const { hasSubscription } = useSubscription();

  // Pricing dialog state
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = React.useState(false);
  const [isGeneratingGenrePrompt, setIsGeneratingGenrePrompt] = React.useState(false);
  const [pendingGenreId, setPendingGenreId] = React.useState<string | null>(null);
  const genrePromptAbortRef = React.useRef<AbortController | null>(null);
  const genrePromptRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    return () => {
      genrePromptAbortRef.current?.abort();
    };
  }, []);

  const {
    isPersonaDialogOpen,
    setIsPersonaDialogOpen,
    isPersonaLoading,
    personaOptions,
    selectedPersona,
    isSelectMusicOpen,
    setIsSelectMusicOpen,
    isSelectMusicLoading,
    selectMusicOptions,
    selectedMusicTrackId,
    pendingMusicTrackId,
    setPendingMusicTrackId,
    pendingMusicTrack,
    pendingMusicTrackUnavailableReason,
    openSelectMusicDialog,
    closeSelectMusicDialog,
    confirmSelectMusicDialog,
    isCreatePersonaDialogOpen,
    setIsCreatePersonaDialogOpen,
    selectedMusicTrack,
    createPersonaName,
    setCreatePersonaName,
    createPersonaDescription,
    setCreatePersonaDescription,
    closeCreatePersonaDialog,
    handleCreatePersona,
    isCreatingPersona,
    getPersonaTrackUnavailableReason,
    formatTrackCreatedAt,
    deletingPersonaRecordId,
    handleDeletePersona,
  } = useStudioPersonaManager({
    user,
    selectedPersonaId,
    setSelectedPersonaId,
  });

  type StyleCategory =
    | "genre"
    | "vibe"
    | "groove"
    | "tempo"
    | "instrument"
    | "drum"
    | "bass"
    | "harmony";

  // State for managing expanded categories
  const [expandedCategory, setExpandedCategory] = React.useState<StyleCategory | null>(null);
  const [expandedCategorySimple, setExpandedCategorySimple] = React.useState<StyleCategory | null>(null);
  
  // State for hovered instrument
  const [hoveredInstrument, setHoveredInstrument] = React.useState<string | null>(null);
  
  // State for hovered drum kit
  const [hoveredDrumKit, setHoveredDrumKit] = React.useState<string | null>(null);
  
  // Audio player hook
  const { playPreviewAudio } = useAudioPlayer();

  const {
    uploadFileInputRef,
    isEditAudioOpen,
    setIsEditAudioOpen,
    pendingAudioFile,
    pendingAudioUrl,
    pendingAudioMode,
    updateUploadState,
    updateCurrentUploadState,
    pendingUploadState,
    uploadCoverFile,
    uploadCoverFileName,
    uploadAudioUrl,
    uploadAudioDuration,
    uploadAudioTotalDuration,
    uploadAudioCurrentTime,
    isUploadAudioPlaying,
    isUploadAudioAnalyzing,
    uploadAudioMode,
    uploadAudioUploadUrl,
    uploadExtendStartTime,
    readyFile,
    readyFileName,
    readyDuration,
    readyAudioUrl,
    isUploadProgressOpen,
    uploadProgressStatus,
    uploadProgressError,
    clearUploadCoverFile,
    updateExtendStartTime,
    resetPendingAudio,
    uploadAudioToServer,
    handlePromptFileChange,
    handleUploadAudioPlayPause,
  } = useStudioUploadWorkflow({
    mode: mode as UploadPanelMode,
  });
  const styleBoostCredits = isCustomMode && supportsStyleBoost && enhanceStyle
    ? CLIENT_STYLE_BOOST_CREDITS
    : 0;
  const createCredits = uploadCoverFile
    ? CLIENT_UPLOAD_AUDIO_CREDITS[uploadAudioMode]
    : (mode === "custom" ? CLIENT_MUSIC_CREDITS.custom + styleBoostCredits : CLIENT_MUSIC_CREDITS.simple);

  const handleModelSelect = React.useCallback((model: MusicModel) => {
    const selectedOption = modelOptions.find((option) => option.value === model);

    if (!hasSubscription && selectedOption?.requiresSubscription) {
      setIsPricingOpen(true);
      return;
    }

    updateSelectedModel(model, { userInitiated: true });
  }, [hasSubscription, updateSelectedModel]);

  const handleGenerateGenrePrompt = React.useCallback(async ({
    genreId,
    genreName,
    currentText,
    onSuccess,
  }: {
    genreId: string;
    genreName: string;
    currentText: string;
    onSuccess: (value: string) => void;
  }) => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    const requestId = genrePromptRequestIdRef.current + 1;
    genrePromptRequestIdRef.current = requestId;

    genrePromptAbortRef.current?.abort();
    const abortController = new AbortController();
    genrePromptAbortRef.current = abortController;

    setPendingGenreId(genreId);
    setIsGeneratingGenrePrompt(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error("Failed to get session. Please try logging in again.");
      }

      if (!session?.access_token) {
        throw new Error("Please log in to continue.");
      }

      const response = await fetch("/api/prompt/simple-genre", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + session.access_token,
        },
        signal: abortController.signal,
        body: JSON.stringify({
          genreId,
          genreName,
          currentPrompt: currentText,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (abortController.signal.aborted || requestId !== genrePromptRequestIdRef.current) {
        return;
      }

      if (!response.ok || !result?.success) {
        if (response.status === 401) {
          setIsAuthModalOpen?.(true);
          throw new Error("Your session has expired. Please log in again.");
        }

        throw new Error(result?.error || "Failed to generate prompt.");
      }

      const generatedPrompt = typeof result?.data?.prompt === "string"
        ? result.data.prompt.trim()
        : "";

      if (!generatedPrompt) {
        throw new Error("Model returned empty prompt. Please try again.");
      }

      onSuccess(generatedPrompt);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      console.error("Generate genre prompt failed:", error);
      const message = error instanceof Error ? error.message : "Failed to generate prompt.";
      toast.error(message);
    } finally {
      if (requestId === genrePromptRequestIdRef.current) {
        setIsGeneratingGenrePrompt(false);
        setPendingGenreId(null);
        genrePromptAbortRef.current = null;
      }
    }
  }, [user, setIsAuthModalOpen]);
  // Function to update states based on textarea content with debouncing
  const handleUpdateStatesFromTextarea = React.useCallback((text: string) => {
    const timeoutId = setTimeout(() => {
      updateStatesFromTextarea(text, {
        setSelectedGenre,
        setSelectedVibe,
        setGrooveType,
        setBpmMode,
        setBpm,
        setLeadInstrument,
        setDrumKit,
        setBassTone,
        setHarmonyPalette
      }, {
        selectedGenre,
        selectedVibe,
        grooveType,
        bpmMode,
        leadInstrument,
        drumKit,
        bassTone,
        harmonyPalette
      });
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 故意移除所有状态依赖，避免循环更新 - 函数内部已经有最新的状态引用

  // Handle generate button click with auth and credits check
  const handleGenerateWithAuth = async () => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    if (uploadCoverFile) {
      if (!uploadAudioUploadUrl) {
        toast.error("Upload URL is missing. Please save your audio again.");
        return;
      }
      const result = await onGenerationStart?.({
        uploadFile: uploadCoverFile,
        uploadUrl: uploadAudioUploadUrl,
        mode: uploadAudioMode,
        continueAt: uploadAudioMode === "extend" && isCustomMode ? uploadExtendStartTime : undefined,
      });
      if (result) {
        clearUploadCoverFile();
      }
      return;
    }
    
    // 检查积分是否足够（点击后才检查）
    if (credits === null) {
      toast("Loading credits, please wait...");
      return;
    }

    const styleBoostRequiredCredits = mode === 'custom' && supportsStyleBoost && enhanceStyle
      ? CLIENT_STYLE_BOOST_CREDITS
      : 0;
    const requiredCredits = (mode === 'custom' 
      ? CLIENT_MUSIC_CREDITS.custom
      : CLIENT_MUSIC_CREDITS.simple) + styleBoostRequiredCredits;

    if (credits < requiredCredits) {
      // 使用 sonner 显示积分不足提示
      toast(`Insufficient Credits`, {
        description: `Need ${requiredCredits} credits (you have ${credits}). Please wait for daily rewards or buy credits.`,
        icon: <CreditCard className="h-4 w-4" />,
      });
      return;
    }
    
    // 通知父组件生成开始
    await onGenerationStart?.();
  };


  const handlePromptAddAudioClick = React.useCallback(() => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }
    uploadFileInputRef.current?.click();
  }, [user, setIsAuthModalOpen, uploadFileInputRef]);

  const uploadAudioPreview = uploadCoverFile ? (
    <div className="space-y-2">
      <div className="rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-border/50 to-primary/10">
        <div className="relative overflow-hidden rounded-2xl bg-background p-3 shadow-sm">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleUploadAudioPlayPause}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 border border-primary/30 text-primary transition hover:text-primary/80 hover:bg-primary/15 p-0"
                disabled={!uploadCoverFile || isUploadAudioAnalyzing}
              >
                {isUploadAudioPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
              <div className="min-w-0 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground leading-none">
                    {uploadCoverFileName || uploadCoverFile.name}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/90">
                    {uploadAudioMode === "extend" ? "Extend" : "Cover"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground leading-none">
                    {isUploadAudioAnalyzing
                      ? "Analyzing audio..."
                      : (() => {
                          const total = uploadAudioTotalDuration || uploadAudioDuration || 0;
                          const current = uploadAudioCurrentTime || 0;
                          const remaining = Math.max(0, total - current);
                          return formatDuration(Math.floor(remaining)) || "0:00";
                        })()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearUploadCoverFile}
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-muted-foreground hover:text-foreground hover:bg-primary/20 transition-colors p-0"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {uploadAudioUrl && (
              <div className="space-y-2">
                <WaveformPlayer
                  audioUrl={uploadAudioUrl}
                  audioBlob={uploadCoverFile}
                  isPlaying={isUploadAudioPlaying}
                  externalCurrentTime={uploadAudioCurrentTime}
                  onPlayPause={handleUploadAudioPlayPause}
                  onFinish={() => updateCurrentUploadState({ isPlaying: false })}
                  showControls={false}
                  separateControls={false}
                  isLoading={!uploadAudioUrl}
                  syncWithIsPlaying={false}
                  backend="MediaElement"
                  waveHeight={54}
                  waveColor="rgba(255, 255, 255, 0.7)"
                  progressColor="rgba(255, 255, 255, 0.95)"
                  cursorColor="rgba(255, 255, 255, 0.95)"
                  cursorWidth={2}
                  className="rounded-lg bg-gradient-to-br from-primary/10 via-white/5 to-transparent"
                  showSelector={uploadAudioMode === "extend"}
                  selectorOverlay={true}
                  showSelectorEndHandle={false}
                  showSelectorLabels={false}
                  selectorStart={uploadExtendStartTime}
                  selectorEnd={uploadAudioDuration || 0}
                  onSelectorStartChange={(time) => updateExtendStartTime(time)}
                />
                {uploadAudioMode === "extend" && (
                  <div className="text-xs text-muted-foreground">
                    Continue at {formatDuration(Math.floor(uploadExtendStartTime)) || "0:00"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const renderStyleQuickButtons = (
    text: string,
    setText: (value: string) => void,
    expanded: StyleCategory | null,
    setExpanded: (value: StyleCategory | null) => void,
    categories?: Array<StyleCategory>,
    options?: {
      forceExpanded?: StyleCategory;
      hideCategoryToggles?: boolean;
      useSelectedGenre?: boolean;
      onGenreSelect?: (genre: { id: string; value: string }) => string | void;
      usePromptTemplateOnGenre?: boolean;
      disableTextUpdateForCategories?: Array<StyleCategory>;
      horizontalScroll?: boolean;
    }
  ) => {
    const allowedCategories = categories ?? ["genre", "vibe", "groove", "tempo", "instrument", "drum", "bass", "harmony"];
    const allowedSet = new Set(allowedCategories);
    const disableTextUpdateSet = new Set(options?.disableTextUpdateForCategories ?? []);
    const activeExpanded =
      options?.forceExpanded && allowedSet.has(options.forceExpanded)
        ? options.forceExpanded
        : expanded && allowedSet.has(expanded)
          ? expanded
          : null;
    const parseTags = (value: string) =>
      value
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean);
    const hasTag = (value: string, tag: string) =>
      parseTags(value).some((item) => item.toLowerCase() === tag.toLowerCase());
    const toggleTag = (value: string, tag: string) => {
      const items = parseTags(value);
      const index = items.findIndex((item) => item.toLowerCase() === tag.toLowerCase());
      if (index >= 0) {
        items.splice(index, 1);
      } else {
        items.push(tag);
      }
      return items.join('; ');
    };
    const shouldUpdateText = (category: StyleCategory) => !disableTextUpdateSet.has(category);

    return (
      <div className="space-y-3">
        {!options?.hideCategoryToggles && (
          <div className="flex flex-wrap gap-2">
        {allowedSet.has('genre') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'genre' ? null : 'genre')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'genre'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Genre
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'genre' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('vibe') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'vibe' ? null : 'vibe')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'vibe'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Vibe
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'vibe' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('groove') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'groove' ? null : 'groove')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'groove'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Groove
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'groove' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('tempo') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'tempo' ? null : 'tempo')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'tempo'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Tempo
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'tempo' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('instrument') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'instrument' ? null : 'instrument')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'instrument'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Lead Instrument
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'instrument' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('drum') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'drum' ? null : 'drum')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'drum'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Drum Kit
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'drum' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('bass') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'bass' ? null : 'bass')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'bass'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Bass Tone
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'bass' ? 'rotate-90' : ''}`} />
          </button>
        )}

        {allowedSet.has('harmony') && (
          <button
            onClick={() => setExpanded(activeExpanded === 'harmony' ? null : 'harmony')}
            className={`${BUTTON_CLASSES.category} ${
              activeExpanded === 'harmony'
                ? STYLES.expanded
                : STYLES.collapsed
            }`}
          >
            # Harmony Palette
            <ChevronRight className={`h-3 w-3 transition-transform ${activeExpanded === 'harmony' ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
        )}

        {activeExpanded && (
          <div className="mt-2 rounded-lg bg-transparent">
            {activeExpanded === 'genre' && (
              <div
                className={`flex gap-2 ${
                  options?.horizontalScroll ? 'flex-nowrap overflow-x-auto pb-1' : 'flex-wrap'
                }`}
              >
                {genres.map((genre: any) => {
                  const isSelected = options?.useSelectedGenre
                    ? selectedGenre === genre.id
                    : hasTag(text, genre.value);
                  const iconName = HERO_GENRE_ICONS[genre.id];
                  const shouldGenerateTemplate = Boolean(options?.usePromptTemplateOnGenre && shouldUpdateText("genre"));
                  const isGeneratingThisGenre = shouldGenerateTemplate && isGeneratingGenrePrompt && pendingGenreId === genre.id;

                  return (
                    <button
                      key={genre.id}
                      onClick={() => {
                        setSelectedGenre(genre.id);
                        if (shouldGenerateTemplate) {
                          void handleGenerateGenrePrompt({
                            genreId: genre.id,
                            genreName: genre.name,
                            currentText: text,
                            onSuccess: setText,
                          });
                          return;
                        }
                        const nextText = options?.onGenreSelect?.({
                          id: genre.id,
                          value: genre.value,
                        });
                        if (typeof nextText === "string" && shouldUpdateText("genre")) {
                          setText(nextText);
                          return;
                        }
                        if (shouldUpdateText("genre")) {
                          setText(toggleTag(text, genre.value));
                        }
                      }}
                      className={`inline-flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 dark:border-transparent text-xs font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-primary text-primary-foreground '
                          : 'bg-slate-50 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/15'
                      }`}
                      disabled={isGeneratingThisGenre}
                    >
                      {isGeneratingThisGenre ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        iconName && (
                          <Image
                            src={`/hero/${encodeURIComponent(iconName)}`}
                            alt=""
                            width={14}
                            height={14}
                            className="h-3.5 w-3.5 opacity-90"
                            aria-hidden="true"
                          />
                        )
                      )}
                      <span>{genre.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeExpanded === 'vibe' && (
              <div className="flex flex-wrap gap-2">
                {vibes.map((vibe: any) => {
                  const isSelected = hasTag(text, vibe.value);
                  return (
                    <button
                      key={vibe.id}
                      onClick={() => {
                        setSelectedVibe(vibe.id);
                        if (shouldUpdateText("vibe")) {
                          setText(toggleTag(text, vibe.value));
                        }
                      }}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground '
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <span>{vibe.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeExpanded === 'groove' && (
              <div className="flex flex-wrap gap-2">
                {grooveTypes.map((groove: any) => {
                  const isSelected = hasTag(text, groove.value);
                  return (
                    <button
                      key={groove.id}
                      onClick={() => {
                        setGrooveType(groove.id);
                        if (shouldUpdateText("groove")) {
                          setText(toggleTag(text, groove.value));
                        }
                      }}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground '
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <span>{groove.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeExpanded === 'tempo' && (
              <div className="flex flex-wrap gap-2">
                <Tooltip content="60-80 BPM" position="top">
                  <button
                    onClick={() => {
                      const randomBpm = getRandomBpm('slow');
                      setBpm([randomBpm]);
                      setBpmMode('slow');
                      if (shouldUpdateText("tempo")) {
                        setText(toggleTag(text, 'Slow'));
                      }
                    }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold transition-all duration-200 ${
                      hasTag(text, 'Slow')
                        ? 'bg-primary text-primary-foreground '
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>Slow</span>
                  </button>
                </Tooltip>
                <Tooltip content="80-100 BPM" position="top">
                  <button
                    onClick={() => {
                      const randomBpm = getRandomBpm('moderate');
                      setBpm([randomBpm]);
                      setBpmMode('moderate');
                      if (shouldUpdateText("tempo")) {
                        setText(toggleTag(text, 'Moderate'));
                      }
                    }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold transition-all duration-200 ${
                      hasTag(text, 'Moderate')
                        ? 'bg-primary text-primary-foreground '
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>Moderate</span>
                  </button>
                </Tooltip>
                <Tooltip content="100-120 BPM" position="top">
                  <button
                    onClick={() => {
                      const randomBpm = getRandomBpm('medium');
                      setBpm([randomBpm]);
                      setBpmMode('medium');
                      if (shouldUpdateText("tempo")) {
                        setText(toggleTag(text, 'Medium'));
                      }
                    }}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold transition-all duration-200 ${
                      hasTag(text, 'Medium')
                        ? 'bg-primary text-primary-foreground '
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>Medium</span>
                  </button>
                </Tooltip>
              </div>
            )}

            {activeExpanded === 'instrument' && (
              <div
                className={`flex gap-2 ${
                  options?.horizontalScroll ? 'flex-nowrap overflow-x-auto pb-1' : 'flex-wrap'
                }`}
              >
                {leadInstruments.map((instrument: any) => {
                  const isSelected = shouldUpdateText("instrument")
                    ? hasTag(text, instrument.value)
                    : false;
                  return (
                    <div
                      key={instrument.id}
                      className="relative"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setLeadInstrument([instrument.id]);
                          if (shouldUpdateText("instrument")) {
                            setText(toggleTag(text, instrument.value));
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setLeadInstrument([instrument.id]);
                            if (shouldUpdateText("instrument")) {
                              setText(toggleTag(text, instrument.value));
                            }
                          }
                        }}
                        className={`group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg border border-white/80 bg-white text-[#0c0c16] shadow-[0_12px_32px_rgba(5,5,15,0.18)] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15 dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${
                          isSelected
                            ? 'bg-primary text-primary-foreground '
                            : 'hover:shadow-[0_14px_36px_rgba(5,5,15,0.24)]'
                        }`}
                      >
                        {getInstrumentIcon(instrument.id) && (
                          <Image
                            src={getInstrumentIcon(instrument.id)}
                            alt={instrument.name}
                            width={16}
                            height={16}
                            className="w-7 h-7"
                          />
                        )}
                        <span className="text-[11px]">{instrument.name}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Play sample"
                          onClick={(e) => {
                            e.stopPropagation();
                            const audioUrl = getInstrumentAudio(instrument.id);
                            if (audioUrl) {
                              playPreviewAudio(audioUrl, `instrument-${instrument.id}`);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              const audioUrl = getInstrumentAudio(instrument.id);
                              if (audioUrl) {
                                playPreviewAudio(audioUrl, `instrument-${instrument.id}`);
                              }
                            }
                          }}
                          className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-black/50 text-white transition-all duration-200 hover:bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                          title="Play sample"
                        >
                          <Play className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeExpanded === 'drum' && (
              <div
                className={`flex gap-2 ${
                  options?.horizontalScroll ? 'flex-nowrap overflow-x-auto pb-1' : 'flex-wrap'
                }`}
              >
                {drumKits.map((kit: any) => {
                  const isSelected = shouldUpdateText("drum")
                    ? hasTag(text, kit.value)
                    : false;
                  return (
                    <div
                      key={kit.id}
                      className="relative"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setDrumKit(kit.id);
                          if (shouldUpdateText("drum")) {
                            setText(toggleTag(text, kit.value));
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setDrumKit(kit.id);
                            if (shouldUpdateText("drum")) {
                              setText(toggleTag(text, kit.value));
                            }
                          }
                        }}
                        className={`group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg border border-white/80 bg-white text-[#0c0c16] shadow-[0_12px_32px_rgba(5,5,15,0.18)] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15 dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${
                          isSelected
                            ? 'bg-primary text-primary-foreground '
                            : 'hover:shadow-[0_14px_36px_rgba(5,5,15,0.24)]'
                        }`}
                      >
                        {getDrumKitIcon(kit.id) && (
                          <Image
                            src={getDrumKitIcon(kit.id)}
                            alt={kit.name}
                            width={16}
                            height={16}
                            className="w-7 h-7"
                          />
                        )}
                        <span className="text-[11px]">{kit.name}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label="Play sample"
                          onClick={(e) => {
                            e.stopPropagation();
                            const audioUrl = getDrumKitAudio(kit.id);
                            if (audioUrl) {
                              playPreviewAudio(audioUrl, `drum-${kit.id}`);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              const audioUrl = getDrumKitAudio(kit.id);
                              if (audioUrl) {
                                playPreviewAudio(audioUrl, `drum-${kit.id}`);
                              }
                            }
                          }}
                          className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-black/50 text-white transition-all duration-200 hover:bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                          title="Play sample"
                        >
                          <Play className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeExpanded === 'bass' && (
              <div className="flex flex-wrap gap-2">
                {bassTones.map((tone: any) => {
                  const isSelected = shouldUpdateText("bass")
                    ? hasTag(text, tone.value)
                    : false;
                  return (
                    <button
                      key={tone.id}
                      onClick={() => {
                        setBassTone(tone.id);
                        if (shouldUpdateText("bass")) {
                          setText(toggleTag(text, tone.value));
                        }
                      }}
                      className={`group inline-flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg border border-white/80 bg-white text-[#0c0c16] shadow-[0_12px_32px_rgba(5,5,15,0.18)] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15 dark:shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${
                        isSelected
                          ? 'bg-primary text-primary-foreground '
                          : 'hover:shadow-[0_14px_36px_rgba(5,5,15,0.24)]'
                      }`}
                    >
                      <span className="text-[11px]">{tone.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeExpanded === 'harmony' && (
              <div className="flex flex-wrap gap-2">
                {harmonyPalettes.map((palette: any) => {
                  const isSelected = hasTag(text, palette.value);
                  return (
                    <button
                      key={palette.id}
                      onClick={() => {
                        setHarmonyPalette(palette.id);
                        if (shouldUpdateText("harmony")) {
                          setText(toggleTag(text, palette.value));
                        }
                      }}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-semibold transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground '
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <span>{palette.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const styleSection = (
    <section className="studio-panel-card rounded-2xl p-3">
      <div className="mb-3 md:mb-4">
        <h3 className="text-xs md:text-sm font-semibold flex items-center gap-2">
          Music Style
        </h3>
      </div>

      <div>
        <div>
          <Textarea
            placeholder="Enter style of music"
            value={styleText}
            onChange={(e) => {
              const newValue = e.target.value;
              setStyleText(newValue);
              handleUpdateStatesFromTextarea(newValue);
            }}
            maxLength={styleTextMaxLength}
            className="min-h-[180px] md:min-h-[200px] resize-none pl-0 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="mt-2 space-y-2">
          <div className="border-t border-dashed border-slate-300/35 dark:border-slate-700/25 pt-2" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
            Style Presets
          </p>
          {renderStyleQuickButtons(
            styleText,
            setStyleText,
            expandedCategory,
            setExpandedCategory,
            ["genre"],
            {
              forceExpanded: "genre",
              hideCategoryToggles: true,
              useSelectedGenre: true,
              usePromptTemplateOnGenre: true,
              horizontalScroll: true,
            }
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {styleText.length}/{styleTextMaxLength}
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex h-8 items-center gap-2 rounded-full bg-foreground/5 px-3 text-xs text-muted-foreground">
              <Switch
                checked={supportsStyleBoost ? enhanceStyle : false}
                onCheckedChange={(checked) => {
                  if (!supportsStyleBoost) {
                    return;
                  }
                  setEnhanceStyle(checked);
                }}
                disabled={!supportsStyleBoost || isGenerating}
                className="scale-75"
                aria-label="Enhance style prompt"
              />
              <span className="text-xs">Enhance Style</span>
              <Tooltip
                content={`Enhance style quality · ${CLIENT_STYLE_BOOST_CREDITS} credits/use`}
                position="top"
              >
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
                  aria-label="Enhance Style info"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedGenre("");
                setSelectedVibe("");
                setGrooveType("");
                setBpm([60]);
                setBpmMode('');
                setLeadInstrument([]);
                setDrumKit("");
                setBassTone("");
                setHarmonyPalette("");
                setStyleText("");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
              <span className="text-xs font-medium">Clear</span>
            </Button>
          </div>
        </div>
      </div>

        <div className="hidden">
          <Select value={selectedGenre} onValueChange={setSelectedGenre}>
            <SelectTrigger data-genre-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genres.map((genre: any) => (
                <SelectItem key={genre.id} value={genre.id}>
                  {genre.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedVibe} onValueChange={setSelectedVibe}>
            <SelectTrigger data-vibe-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vibes.map((vibe: any) => (
                <SelectItem key={vibe.id} value={vibe.id}>
                  {vibe.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={grooveType} onValueChange={setGrooveType}>
            <SelectTrigger data-groove-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {grooveTypes.map((groove: any) => (
                <SelectItem key={groove.id} value={groove.id}>
                  {groove.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={leadInstrument.join(',')} onValueChange={(value) => {
            const selectedIds = value.split(',').filter(Boolean);
            setLeadInstrument(selectedIds);
          }}>
            <SelectTrigger data-instrument-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leadInstruments.map((instrument: any) => (
                <SelectItem key={instrument.id} value={instrument.id}>
                  {instrument.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={drumKit} onValueChange={setDrumKit}>
            <SelectTrigger data-drum-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {drumKits.map((kit: any) => (
                <SelectItem key={kit.id} value={kit.id}>
                  {kit.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bassTone} onValueChange={setBassTone}>
            <SelectTrigger data-bass-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {bassTones.map((tone: any) => (
                <SelectItem key={tone.id} value={tone.id}>
                  {tone.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={harmonyPalette} onValueChange={setHarmonyPalette}>
            <SelectTrigger data-harmony-select>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {harmonyPalettes.map((palette: any) => (
                <SelectItem key={palette.id} value={palette.id}>
                  {palette.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
    </section>
  );

  return (
    <div
      className={`studio-panel-cards bg-transparent transition-all duration-300 ease-in-out ${
        // 桌面：左侧固定宽度；移动端：当 forceVisibleOnMobile=true 时占满宽度
        panelOpen ? (forceVisibleOnMobile ? 'w-full md:w-[30rem]' : 'w-[30rem]') : 'w-0'
      } ${forceVisibleOnMobile ? 'flex flex-col' : 'h-full flex flex-col overflow-hidden'} ${forceVisibleOnMobile ? 'flex md:flex' : 'hidden md:flex'}`}
      style={
        hasPlayer && !forceVisibleOnMobile
          ? { height: 'calc(100% - var(--player-height, 0px) - 1rem)' }
          : undefined
      }
    >
      {panelOpen && (
        <>
          {/* Header with Mode Tabs */}
          <div className="flex-shrink-0 px-0 pt-4 md:pt-6 pb-4">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              {/* Mode Selector */}
              <div
                className="studio-panel-card inline-flex items-center rounded-2xl p-1 gap-1 flex-shrink-0"
              >
                <button
                  onClick={() => setMode("simple")}
                  className={`px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    mode === "simple"
                      ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setMode("custom")}
                  className={`px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    mode === "custom"
                      ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Model Selection Menu */}
              {mode === "custom" && (
                <DropdownMenu open={isModelMenuOpen} onOpenChange={setIsModelMenuOpen}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group studio-panel-card h-11 px-4 rounded-2xl text-xs md:text-sm font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5"
                      title="Click to change model version"
                    >
                      <span>{modelOptions.find((opt) => opt.value === selectedModel)?.label || 'V4.5'}</span>
                      <Triangle
                        className={`w-2 h-2 fill-current text-foreground/70 transition-colors transition-transform group-hover:text-accent-foreground ${isModelMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="z-[170] w-80 max-h-[70vh] overflow-y-auto rounded-2xl bg-popover p-1.5 text-popover-foreground shadow-[0_20px_56px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:shadow-[0_20px_56px_rgba(0,0,0,0.5)]"
                  >
                    {modelOptions.map((option) => {
                      const isSelected = option.value === selectedModel;
                      return (
                        <React.Fragment key={option.value}>
                          <DropdownMenuItem
                            onClick={() => handleModelSelect(option.value)}
                            className="group flex flex-col items-start gap-1 rounded-xl px-3.5 py-2.5 transition-colors hover:bg-black/5 focus:bg-black/5 data-[highlighted]:bg-black/5 dark:hover:bg-white/5 dark:focus:bg-white/5 dark:data-[highlighted]:bg-white/5"
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {option.label}
                                </span>
                              </div>
                              {isSelected && (
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                                  <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={2.5} aria-hidden="true" />
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </DropdownMenuItem>
                        </React.Fragment>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div
            className={`flex-1 ${forceVisibleOnMobile ? '' : 'overflow-y-auto scrollbar-hidden'} px-0 ${forceVisibleOnMobile ? 'pb-28' : 'pb-6'} md:pb-6`}
          >
            <input
              ref={uploadFileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handlePromptFileChange}
            />
            {/* Mode Content */}
      {mode === "simple" ? (
        <StudioSimpleModeContent
          instrumentalMode={instrumentalMode}
          setInstrumentalMode={setInstrumentalMode}
          simplePrompt={simplePrompt}
          setSimplePrompt={setSimplePrompt}
          simplePromptMaxLength={simplePromptMaxLength}
          quickButtons={renderStyleQuickButtons(
            simplePrompt,
            setSimplePrompt,
            expandedCategorySimple,
            setExpandedCategorySimple,
            ["genre"],
            {
              forceExpanded: "genre",
              hideCategoryToggles: true,
              useSelectedGenre: true,
              usePromptTemplateOnGenre: true,
              horizontalScroll: true,
            }
          )}
          onAddAudio={handlePromptAddAudioClick}
          onClear={() => {
            setSimplePrompt("");
            setSelectedGenre("");
            setSelectedVibe("");
            setGrooveType("");
            setBpm([60]);
            setBpmMode('');
            setLeadInstrument([]);
            setDrumKit("");
            setBassTone("");
            setHarmonyPalette("");
          }}
          leadInstruments={leadInstruments as Array<{ id: string; name: string }>}
          drumKits={drumKits as Array<{ id: string; name: string }>}
          onSelectLeadInstrument={(instrumentId) => {
            setLeadInstrument([instrumentId]);
          }}
          onSelectDrumKit={(kitId) => {
            setDrumKit(kitId);
          }}
          onPreviewLeadInstrument={(instrumentId) => {
            const audioUrl = getInstrumentAudio(instrumentId);
            if (audioUrl) {
              playPreviewAudio(audioUrl, `instrument-${instrumentId}`);
            }
          }}
          onPreviewDrumKit={(kitId) => {
            const audioUrl = getDrumKitAudio(kitId);
            if (audioUrl) {
              playPreviewAudio(audioUrl, `drum-${kitId}`);
            }
          }}
          uploadCoverFile={uploadCoverFile}
          uploadAudioPreview={uploadAudioPreview}
        />
      ) : (
        <StudioCustomModeContent
          uploadCoverFile={uploadCoverFile}
          uploadAudioPreview={uploadAudioPreview}
          onAddAudio={handlePromptAddAudioClick}
          onOpenPersonaDialog={() => setIsPersonaDialogOpen(true)}
          selectedPersonaName={selectedPersona?.name?.trim() || null}
          selectedPersonaId={selectedPersonaId}
          instrumentalMode={instrumentalMode}
          setInstrumentalMode={setInstrumentalMode}
          customLyrics={customLyrics}
          setCustomLyrics={setCustomLyrics}
          customPromptMaxLength={customPromptMaxLength}
          onGenerateLyrics={onGenerateLyrics}
          onWriteNextLyricLine={onWriteNextLyricLine}
          isWritingNextLyricLine={isWritingNextLyricLine}
          onClearCustomLyrics={() => setCustomLyrics("")}
          vocalGender={vocalGender}
          setVocalGender={setVocalGender}
          vocalGenders={vocalGenders as Array<{ id: string; name: string }>}
          styleSection={styleSection}
          songTitle={songTitle}
          setSongTitle={setSongTitle}
        />
      )}
          </div>

          {/* Floating Generate Button - Bottom */}
          <div
            className={`flex-shrink-0 px-0 pt-3 ${
              forceVisibleOnMobile
                ? 'sticky bottom-0 z-20 bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-background/80'
                : 'pb-4'
            }`}
          >
            {(() => {
              // 只根据prompt输入内容来禁用按钮，积分检查移到点击后
              let isDisabled = isGenerating;

              if (mode === 'simple') {
                // Simple Mode: 只需要prompt字段
                isDisabled = isDisabled || !simplePrompt.trim();
              } else {
                // Custom Mode: style and title are required; prompt required when instrumental is false
                isDisabled = isDisabled || !styleText.trim() || !songTitle.trim();
                if (!instrumentalMode) {
                  isDisabled = isDisabled || !customLyrics.trim();
                }
              }
              return (
                <div className="flex">
                  <button
                    onClick={() => {
                      handleGenerateWithAuth();
                    }}
                    disabled={isDisabled}
                    className="flex-1 h-12 px-4 text-base font-semibold bg-primary disabled:bg-foreground/10 dark:disabled:bg-white/10 border-transparent text-primary-foreground disabled:text-foreground/40 dark:disabled:text-white/40 shadow-lg disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] disabled:hover:translate-y-0 disabled:hover:scale-100 rounded-2xl"
                  >
                    <div className="relative z-10 flex items-center justify-center">
                      {isGenerating ? (
                        <div className="flex items-center justify-center gap-2">
                          <span>Creating</span>
                          <div className="flex items-center gap-1">
                            <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                            <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                            <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                          </div>
                        </div>
                      ) : isDisabled ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Wand2 className="h-4 w-4" />
                          <span>Create</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Wand2 className="h-4 w-4" />
                          <span>{`Create (-${createCredits} Credits)`}</span>
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      <EditAudioDialog
        isOpen={isEditAudioOpen}
        onClose={resetPendingAudio}
        audioFile={pendingAudioFile}
        audioUrl={pendingAudioUrl}
        minDuration={3}
        maxDuration={maxUploadDurationSeconds}
        modelLabel={modelOptions.find((option) => option.value === effectiveModel)?.label || effectiveModel}
        onSave={async (file, durationValue, title) => {
          const nextReadyUrl = URL.createObjectURL(file);
          updateUploadState(pendingAudioMode, {
            readyFile: file,
            readyFileName: title,
            readyDuration: durationValue,
            readyAudioUrl: nextReadyUrl,
            progressOpen: true,
            progressStatus: "uploading",
            progressError: null,
          });
          if (pendingUploadState.readyAudioUrl) {
            URL.revokeObjectURL(pendingUploadState.readyAudioUrl);
          }
          resetPendingAudio();

          try {
            const downloadUrl = await uploadAudioToServer(file);
            updateUploadState(pendingAudioMode, {
              audioUploadUrl: downloadUrl,
              progressStatus: "ready",
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
            updateUploadState(pendingAudioMode, {
              audioUploadUrl: null,
              progressStatus: "error",
              progressError: message,
            });
          }
        }}
      />

      <StudioPanelPersonaDialogs
        isPersonaDialogOpen={isPersonaDialogOpen}
        setIsPersonaDialogOpen={setIsPersonaDialogOpen}
        isPersonaLoading={isPersonaLoading}
        personaOptions={personaOptions}
        selectedPersonaId={selectedPersonaId}
        setSelectedPersonaId={setSelectedPersonaId}
        deletingPersonaRecordId={deletingPersonaRecordId}
        onDeletePersona={handleDeletePersona}
        onOpenSelectMusicDialog={openSelectMusicDialog}
        isSelectMusicOpen={isSelectMusicOpen}
        setIsSelectMusicOpen={setIsSelectMusicOpen}
        closeSelectMusicDialog={closeSelectMusicDialog}
        isSelectMusicLoading={isSelectMusicLoading}
        selectMusicOptions={selectMusicOptions}
        pendingMusicTrackId={pendingMusicTrackId}
        setPendingMusicTrackId={setPendingMusicTrackId}
        selectedMusicTrackId={selectedMusicTrackId}
        pendingMusicTrack={pendingMusicTrack}
        pendingMusicTrackUnavailableReason={pendingMusicTrackUnavailableReason}
        getPersonaTrackUnavailableReason={getPersonaTrackUnavailableReason}
        formatTrackCreatedAt={formatTrackCreatedAt}
        confirmSelectMusicDialog={confirmSelectMusicDialog}
        isCreatePersonaDialogOpen={isCreatePersonaDialogOpen}
        setIsCreatePersonaDialogOpen={setIsCreatePersonaDialogOpen}
        selectedMusicTrack={selectedMusicTrack}
        createPersonaName={createPersonaName}
        setCreatePersonaName={setCreatePersonaName}
        createPersonaDescription={createPersonaDescription}
        setCreatePersonaDescription={setCreatePersonaDescription}
        closeCreatePersonaDialog={closeCreatePersonaDialog}
        handleCreatePersona={handleCreatePersona}
        isCreatingPersona={isCreatingPersona}
      />

      <UploadProgressDialog
        isOpen={isUploadProgressOpen}
        onClose={() => {
          updateCurrentUploadState({
            progressOpen: false,
            progressStatus: "uploading",
            progressError: null,
            readyFileName: null,
          });
          if (readyAudioUrl) {
            URL.revokeObjectURL(readyAudioUrl);
            updateCurrentUploadState({ readyAudioUrl: null });
          }
        }}
        fileName={readyFileName || readyFile?.name || "Audio"}
        status={uploadProgressStatus}
        errorMessage={uploadProgressError || undefined}
        audioUrl={readyAudioUrl}
        duration={readyDuration || 0}
        onSelect={(nextMode) => {
          if (!uploadAudioUploadUrl) {
            toast.error("Upload failed. Please save your audio again.");
            return;
          }
          if (uploadAudioUrl) {
            URL.revokeObjectURL(uploadAudioUrl);
          }
          const nextUrl = readyFile ? URL.createObjectURL(readyFile) : null;
          updateCurrentUploadState({
            audioMode: nextMode,
            coverFile: readyFile,
            coverFileName: readyFileName || readyFile?.name || null,
            audioUrl: nextUrl,
            audioDuration: readyDuration,
            audioTotalDuration: readyDuration,
            audioCurrentTime: 0,
            isPlaying: false,
            isAnalyzing: false,
            progressOpen: false,
            progressStatus: "uploading",
            readyFileName: null,
          });
          if (readyAudioUrl) {
            URL.revokeObjectURL(readyAudioUrl);
            updateCurrentUploadState({ readyAudioUrl: null });
          }
        }}
      />

      {/* Pricing Dialog */}
      {isPricingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 dark:bg-black/60 backdrop-blur-[1px] p-4" onClick={() => setIsPricingOpen(false)}>
          <div className="relative max-w-6xl w-full max-h-[90vh] overflow-y-auto bg-background rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsPricingOpen(false)}
              className="sticky top-4 right-4 float-right text-muted-foreground hover:text-foreground transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="pt-8">
              <PricingSection />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
