"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Play, CreditCard, X, Pause, Wand2, Trash2, Loader2, RefreshCw } from "lucide-react";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useFeaturePermissions } from '@/contexts/FeaturePermissionsContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Tooltip } from '@/components/ui/tooltip';
import { Switch } from "@/components/ui/switch";
import Image from 'next/image';
import { CLIENT_MUSIC_CREDITS, CLIENT_STYLE_BOOST_CREDITS, CLIENT_UPLOAD_AUDIO_CREDITS } from '@/lib/credits-config';
import { getInstrumentIcon, getInstrumentAudio, getDrumKitIcon, getDrumKitAudio } from '@/lib/music-resources';
import { updateStatesFromTextarea, getRandomBpm } from '@/lib/studio-utils';
import { BUTTON_CLASSES, STYLES } from '@/lib/studio-constants';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { useStudioUploadWorkflow } from '@/hooks/use-studio-upload-workflow';
import type { UploadPanelMode } from '@/hooks/use-studio-upload-workflow';
import { formatDuration } from '@/lib/format-utils';
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { EditAudioDialog } from "@/features/music-upload/components/edit-audio-dialog";
import { MashupEditDialog, type MashupEditedTrack } from "@/features/music-upload/components/mashup-edit-dialog";
import { MashupUploadConfirmDialog } from "@/components/ui/mashup-upload-confirm-dialog";
import { StudioCustomModeContent, StudioSimpleModeContent, type AudioUploadIntent } from "@/components/ui/feature-panels/music-extender-panel-mode-content";
import { MusicPersonaDialogs } from "@/components/ui/music-persona-dialogs";
import { useStudioPersonaManager } from "@/hooks/use-studio-persona-manager";
import { ModelSelectionDialog, MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import type { ExtendSourceTrack } from "@/types/extend-track-source";
import { PricingSection } from '@/components/layout/sections/pricing';
import { useTheme } from "next-themes";

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
const UPLOAD_WAVE_COLOR_LIGHT = "#d1d5db";
const UPLOAD_PROGRESS_COLOR_LIGHT = "hsl(262, 100%, 70%)";
const UPLOAD_CURSOR_COLOR_LIGHT = "hsl(262, 100%, 70%)";

const UPLOAD_ACTION_CREDITS: Record<AudioUploadIntent, number> = {
  track: CLIENT_UPLOAD_AUDIO_CREDITS.cover,
  vocal: CLIENT_UPLOAD_AUDIO_CREDITS.vocal,
  melody: CLIENT_UPLOAD_AUDIO_CREDITS.melody,
};

const UPLOAD_INTENT_LABEL: Record<AudioUploadIntent, string> = {
  track: "Track",
  vocal: "Vocal",
  melody: "Melody",
};

type MashupPreviewTrack = {
  file: File;
  fileName: string;
  audioUrl: string;
  duration: number;
  uploadUrl: string | null;
};

type SelectedExtendSource = {
  trackId: string;
  audioId?: string;
};


export interface FeatureCreatePanelProps {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  hasPlayer?: boolean;
  panelTitle?: string;
  
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
  styleWeight?: number;
  setStyleWeight?: (value: number) => void;
  weirdnessConstraint?: number;
  setWeirdnessConstraint?: (value: number) => void;
  audioWeight?: number;
  setAudioWeight?: (value: number) => void;
  
  // BPM Mode
  bpmMode: 'slow' | 'moderate' | 'medium' | '';
  setBpmMode: (mode: 'slow' | 'moderate' | 'medium' | '') => void;
  
  // Generation
  isGenerating: boolean;
  onGenerationStart?: (options?: {
    uploadFile?: File | null;
    uploadUrl?: string | null;
    trackId?: string;
    audioId?: string;
    uploadUrlList?: string[];
    mode?: "cover" | "extend" | "mashup" | "vocal" | "melody";
    continueAt?: number;
    tags?: string;
    negativeTags?: string;
    styleWeight?: number;
    weirdnessConstraint?: number;
    audioWeight?: number;
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
  selectedPersonaModel?: 'style_persona' | 'voice_persona';
  setSelectedPersonaModel?: (model: 'style_persona' | 'voice_persona') => void;
  showUploadAction?: boolean;
  allowedUploadIntents?: AudioUploadIntent[];
  forcedUploadIntent?: AudioUploadIntent | null;
  forcedTrackUploadMode?: "cover" | "extend" | null;
  allowMashupAction?: boolean;
  extendSourceTracks?: ExtendSourceTrack[];
  pendingExtendSourceTrack?: ExtendSourceTrack | null;
  onPendingExtendSourceTrackConsumed?: () => void;
}

export const MusicExtenderPanel = (props: FeatureCreatePanelProps) => {
  const {
    panelOpen,
    forceVisibleOnMobile = false,
    hasPlayer = false,
    panelTitle = "Music Extender",
    onCollapseToTracks,
    setIsAuthModalOpen,
    mode,
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
    styleText,
    setStyleText,
    enhanceStyle,
    setEnhanceStyle,
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
    styleWeight,
    setStyleWeight,
    weirdnessConstraint,
    setWeirdnessConstraint,
    audioWeight,
    setAudioWeight,
    bpmMode,
    setBpmMode,
    isGenerating,
    onGenerationStart,
    onGenerateLyrics,
    onWriteNextLyricLine,
    isWritingNextLyricLine = false,
    selectedModel = 'V4',
    setSelectedModel,
    selectedPersonaId = '',
    setSelectedPersonaId,
    selectedPersonaModel = 'style_persona',
    setSelectedPersonaModel,
    showUploadAction = true,
    allowedUploadIntents = ["track"],
    forcedUploadIntent = "track",
    forcedTrackUploadMode = "extend",
    allowMashupAction = false,
    pendingExtendSourceTrack = null,
    onPendingExtendSourceTrackConsumed,
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();
  const { resolvedTheme } = useTheme();
  const userSelectedModelRef = React.useRef(false);
  const defaultSimplePromptMaxLength = 400;
  const maxUploadDurationSeconds = 8 * 60;
  const maxDirectUploadBytes = 100 * 1024 * 1024;
  const isCustomMode = mode === "custom";
  const effectiveModel: MusicModel = isCustomMode ? selectedModel : 'V4';
  const normalizedEffectiveModel = String(effectiveModel).toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS');
  const customPromptMaxLength = normalizedEffectiveModel === "V4" ? 3000 : 5000;
  const styleTextMaxLength = normalizedEffectiveModel === "V4" ? 200 : 1000;
  const titleMaxLength = 80;
  const canUseVoicePersonaModel = normalizedEffectiveModel === "V5";
  const supportsStyleBoost = ['V4_5', 'V4_5PLUS', 'V4_5ALL'].includes(
    String(effectiveModel).toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS')
  );
  const isDark = resolvedTheme === "dark";
  const uploadWaveColor = isDark ? "rgba(255, 255, 255, 0.7)" : UPLOAD_WAVE_COLOR_LIGHT;
  const uploadProgressColor = isDark ? "rgba(255, 255, 255, 0.95)" : UPLOAD_PROGRESS_COLOR_LIGHT;
  const uploadCursorColor = isDark ? "rgba(255, 255, 255, 0.95)" : UPLOAD_CURSOR_COLOR_LIGHT;

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

  React.useEffect(() => {
    if (selectedPersonaModel !== 'voice_persona') return;
    if (canUseVoicePersonaModel) return;
    setSelectedPersonaModel?.('style_persona');
  }, [selectedPersonaModel, canUseVoicePersonaModel, setSelectedPersonaModel]);

  const { hasPermission } = useFeaturePermissions();
  const canUseV5Model = hasPermission('model_v5');
  const canUseMashup = hasPermission('upload_mashup_music');
  const canUsePersona = hasPermission('generate_persona');
  const canUseEnhanceStyle = hasPermission('boost_music_style');

  // Pricing dialog state
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = React.useState(false);
  const [isGeneratingGenrePrompt, setIsGeneratingGenrePrompt] = React.useState(false);
  const [pendingGenreId, setPendingGenreId] = React.useState<string | null>(null);
  const [isMashupEditOpen, setIsMashupEditOpen] = React.useState(false);
  const [isMashupConfirmOpen, setIsMashupConfirmOpen] = React.useState(false);
  const [isMashupPreparing, setIsMashupPreparing] = React.useState(false);
  const [isMashupSubmitting, setIsMashupSubmitting] = React.useState(false);
  const [mashupError, setMashupError] = React.useState<string | null>(null);
  const [mashupTracks, setMashupTracks] = React.useState<MashupPreviewTrack[]>([]);
  const [mashupPreviewTracks, setMashupPreviewTracks] = React.useState<MashupPreviewTrack[]>([]);
  const [mashupPlayingIndex, setMashupPlayingIndex] = React.useState<number | null>(null);
  const [mashupCurrentTimes, setMashupCurrentTimes] = React.useState<number[]>([]);
  const [selectedExtendSource, setSelectedExtendSource] = React.useState<SelectedExtendSource | null>(null);
  const genrePromptAbortRef = React.useRef<AbortController | null>(null);
  const genrePromptRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    return () => {
      genrePromptAbortRef.current?.abort();
    };
  }, []);

  const clearMashupPreviewTracks = React.useCallback((tracks: MashupPreviewTrack[]) => {
    tracks.forEach((track) => {
      if (track.audioUrl) {
        URL.revokeObjectURL(track.audioUrl);
      }
    });
  }, []);

  React.useEffect(() => {
    return () => {
      clearMashupPreviewTracks(mashupPreviewTracks);
      clearMashupPreviewTracks(mashupTracks);
    };
  }, [clearMashupPreviewTracks, mashupPreviewTracks, mashupTracks]);

  React.useEffect(() => {
    setMashupPlayingIndex(null);
    setMashupCurrentTimes(mashupTracks.map(() => 0));
  }, [mashupTracks]);

  const clearMashupSelection = React.useCallback(() => {
    setMashupTracks((prev) => {
      clearMashupPreviewTracks(prev);
      return [];
    });
    setMashupPreviewTracks((prev) => {
      clearMashupPreviewTracks(prev);
      return [];
    });
    setMashupPlayingIndex(null);
    setMashupCurrentTimes([]);
    setMashupError(null);
  }, [clearMashupPreviewTracks]);

  React.useEffect(() => {
    if (canUseMashup) return;
    setIsMashupEditOpen(false);
    setIsMashupConfirmOpen(false);
    clearMashupSelection();
  }, [canUseMashup, clearMashupSelection]);

  React.useEffect(() => {
    if (!enhanceStyle) return;
    if (!supportsStyleBoost || !canUseEnhanceStyle) {
      setEnhanceStyle(false);
    }
  }, [enhanceStyle, supportsStyleBoost, canUseEnhanceStyle, setEnhanceStyle]);

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
  const [audioUploadIntent, setAudioUploadIntent] = React.useState<AudioUploadIntent | null>(null);
  const [melodyTags, setMelodyTags] = React.useState("");
  const [melodyNegativeTags, setMelodyNegativeTags] = React.useState("");
  const activeUploadIntent: AudioUploadIntent = audioUploadIntent ?? "track";
  const isExtendUploadMode = forcedTrackUploadMode === "extend";
  const requiresTrackUpload = activeUploadIntent === "track" && !!forcedTrackUploadMode;
  const simplePromptMaxLength = isExtendUploadMode ? customPromptMaxLength : defaultSimplePromptMaxLength;

  React.useEffect(() => {
    if (mode !== "custom") {
      setAudioUploadIntent(null);
    }
  }, [mode]);

  React.useEffect(() => {
    if (mode !== "custom") return;
    if (forcedUploadIntent === undefined) return;
    if (audioUploadIntent !== forcedUploadIntent) {
      setAudioUploadIntent(forcedUploadIntent);
    }
  }, [mode, forcedUploadIntent, audioUploadIntent]);

  React.useEffect(() => {
    if (mode !== "custom") return;
    if (audioUploadIntent !== null && audioUploadIntent !== "track" && instrumentalMode) {
      setInstrumentalMode(false);
    }
  }, [mode, audioUploadIntent, instrumentalMode, setInstrumentalMode]);

  React.useEffect(() => {
    if (audioUploadIntent === null || audioUploadIntent === "track") return;
    if (enhanceStyle) {
      setEnhanceStyle(false);
    }
  }, [audioUploadIntent, enhanceStyle, setEnhanceStyle]);
  // Audio player hook
  const { playPreviewAudio } = useAudioPlayer();

  const {
    uploadFileInputRef,
    isEditAudioOpen,
    pendingAudioFile,
    pendingAudioUrl,
    updateCurrentUploadState,
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
    clearUploadCoverFile,
    updateExtendStartTime,
    resetPendingAudio,
    uploadAudioToServer,
    handlePromptFileChange,
    handleUploadAudioPlayPause,
  } = useStudioUploadWorkflow({
    mode: mode as UploadPanelMode,
  });

  React.useEffect(() => {
    if (!forcedTrackUploadMode) return;
    if (uploadCoverFile && activeUploadIntent === "track" && uploadAudioMode !== forcedTrackUploadMode) {
      updateCurrentUploadState({ audioMode: forcedTrackUploadMode });
    }
  }, [forcedTrackUploadMode, uploadCoverFile, activeUploadIntent, uploadAudioMode, updateCurrentUploadState]);

  const applyExtendSourceTrack = React.useCallback((track: ExtendSourceTrack) => {
    const nextAudioUrl = track.audioUrl.trim();
    if (!nextAudioUrl) {
      toast.error("Selected track has no audio URL.");
      return;
    }

    clearMashupSelection();
    clearUploadCoverFile();

    const normalizedDuration = Number.isFinite(track.duration) ? Math.max(0, track.duration) : 0;
    updateCurrentUploadState({
      coverFile: null,
      coverFileName: track.title || "Selected Track",
      audioUrl: nextAudioUrl,
      audioDuration: normalizedDuration > 0 ? normalizedDuration : null,
      audioTotalDuration: normalizedDuration > 0 ? normalizedDuration : null,
      audioCurrentTime: 0,
      isPlaying: false,
      isAnalyzing: false,
      audioMode: "extend",
      audioUploadUrl: nextAudioUrl,
      extendStartTime: 0,
      readyFile: null,
      readyFileName: null,
      readyDuration: null,
      readyAudioUrl: null,
      progressOpen: false,
      progressStatus: "ready",
      progressError: null,
    });
    setAudioUploadIntent("track");
    setSelectedExtendSource({
      trackId: track.id,
      audioId: track.audioId?.trim() || undefined,
    });
  }, [clearMashupSelection, clearUploadCoverFile, updateCurrentUploadState]);

  React.useEffect(() => {
    if (!pendingExtendSourceTrack) return;
    applyExtendSourceTrack(pendingExtendSourceTrack);
    onPendingExtendSourceTrackConsumed?.();
  }, [pendingExtendSourceTrack, applyExtendSourceTrack, onPendingExtendSourceTrackConsumed]);

  const isExtendContinueAtValid = !isExtendUploadMode || !isCustomMode || (
    (uploadAudioDuration || 0) > 1 &&
    uploadExtendStartTime > 0 &&
    uploadExtendStartTime < (uploadAudioDuration || 0)
  );
  const styleBoostCredits = isCustomMode && supportsStyleBoost && canUseEnhanceStyle && enhanceStyle
    ? CLIENT_STYLE_BOOST_CREDITS
    : 0;
  const hasTrackUploadSource = activeUploadIntent === "track" && Boolean(uploadAudioUploadUrl);
  const createCredits = mashupTracks.length === 2
    ? CLIENT_UPLOAD_AUDIO_CREDITS.mashup
    : hasTrackUploadSource || uploadCoverFile
      ? (activeUploadIntent === "track" ? CLIENT_UPLOAD_AUDIO_CREDITS[uploadAudioMode] : UPLOAD_ACTION_CREDITS[activeUploadIntent])
      : mode === "custom"
        ? (activeUploadIntent === "track" ? CLIENT_MUSIC_CREDITS.custom + styleBoostCredits : UPLOAD_ACTION_CREDITS[activeUploadIntent])
        : CLIENT_MUSIC_CREDITS.simple;

  const handleModelSelect = React.useCallback((model: MusicModel) => {
    if (model === 'V5' && !canUseV5Model) {
      setIsPricingOpen(true);
      return;
    }

    updateSelectedModel(model, { userInitiated: true });
  }, [canUseV5Model, updateSelectedModel]);

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

    if (mashupTracks.length === 2) {
      if (!canUseMashup) {
        setIsPricingOpen(true);
        clearMashupSelection();
        return;
      }

      const trimmedCustomLyrics = customLyrics.trim();
      const trimmedStyle = styleText.trim();
      const trimmedTitle = songTitle.trim();

      if (!trimmedStyle) {
        toast.error('Please enter a style before creating mashup.');
        return;
      }
      if (!trimmedTitle) {
        toast.error('Please enter a title before creating mashup.');
        return;
      }
      if (!instrumentalMode && !trimmedCustomLyrics) {
        toast.error('Please enter lyrics before creating mashup.');
        return;
      }

      if (credits === null) {
        toast('Loading credits, please wait...');
        return;
      }

      const mashupCredits = CLIENT_UPLOAD_AUDIO_CREDITS.mashup;
      if (credits < mashupCredits) {
        toast('Insufficient Credits', {
          description: `Need ${mashupCredits} credits (you have ${credits}). Please wait for daily rewards or buy credits.`,
          icon: <CreditCard className="h-4 w-4" />,
        });
        return;
      }

      setIsMashupSubmitting(true);
      setMashupError(null);

      let result = false;
      try {
        const uploadedUrls = await Promise.all(
          mashupTracks.map(async (track) => uploadAudioToServer(track.file))
        );

        const uploadUrlList = uploadedUrls
          .map((url) => url.trim())
          .filter(Boolean);

        if (uploadUrlList.length !== 2) {
          throw new Error('Failed to upload mashup audio files. Please try again.');
        }

        const generationResult = await onGenerationStart?.({
          uploadUrlList,
          mode: 'mashup',
          styleWeight: canUseEnhanceStyle ? styleWeight : undefined,
          weirdnessConstraint: canUseEnhanceStyle ? weirdnessConstraint : undefined,
          audioWeight: canUseEnhanceStyle ? audioWeight : undefined,
        });
        result = Boolean(generationResult);
      } catch (error) {
        console.error('Mashup generation failed:', error);
        const message = error instanceof Error ? error.message : 'Mashup generation failed. Please try again.';
        setMashupError(message);
        toast.error(message);
      } finally {
        setIsMashupSubmitting(false);
      }

      if (result) {
        clearMashupSelection();
      }
      return;
    }

    if (requiresTrackUpload && !hasTrackUploadSource) {
      toast.error('Please upload an audio track first.');
      return;
    }

    if (isExtendUploadMode && isCustomMode && hasTrackUploadSource && !isExtendContinueAtValid) {
      toast.error('Please set Continue At to a value greater than 0 and less than the track duration.');
      return;
    }

    const shouldUseUploadGeneration = (
      (activeUploadIntent === "track" && hasTrackUploadSource) ||
      (activeUploadIntent !== "track" && !!uploadCoverFile)
    );

    const shouldUseTrackListExtendGeneration = (
      activeUploadIntent === "track" &&
      uploadAudioMode === "extend" &&
      hasTrackUploadSource &&
      !uploadCoverFile &&
      !!selectedExtendSource?.trackId
    );

    if (shouldUseTrackListExtendGeneration) {
      const result = await onGenerationStart?.({
        mode: "extend",
        trackId: selectedExtendSource.trackId,
        audioId: selectedExtendSource.audioId,
        continueAt: isCustomMode ? uploadExtendStartTime : undefined,
        styleWeight: canUseEnhanceStyle ? styleWeight : undefined,
        weirdnessConstraint: canUseEnhanceStyle ? weirdnessConstraint : undefined,
        audioWeight: canUseEnhanceStyle ? audioWeight : undefined,
      });
      if (result) {
        clearUploadAndResetIntent();
      }
      return;
    }

    if (shouldUseUploadGeneration) {
      if (!uploadAudioUploadUrl) {
        toast.error("Upload URL is missing. Please save your audio again.");
        return;
      }

      const result = await onGenerationStart?.({
        uploadFile: uploadCoverFile,
        uploadUrl: uploadAudioUploadUrl,
        mode: activeUploadIntent === "track"
          ? uploadAudioMode
          : activeUploadIntent === "vocal"
            ? "vocal"
            : "melody",
        continueAt: activeUploadIntent === "track" && uploadAudioMode === "extend" && isCustomMode
          ? uploadExtendStartTime
          : undefined,
        tags: activeUploadIntent === "melody" ? melodyTags : undefined,
        negativeTags: activeUploadIntent === "melody" ? melodyNegativeTags : undefined,
        styleWeight: canUseEnhanceStyle ? styleWeight : undefined,
        weirdnessConstraint: canUseEnhanceStyle ? weirdnessConstraint : undefined,
        audioWeight: canUseEnhanceStyle ? audioWeight : undefined,
      });
      if (result) {
        clearUploadAndResetIntent();
      }
      return;
    }

    if (mode === "custom" && audioUploadIntent !== null && activeUploadIntent !== "track") {
      toast.error(`Please upload an audio file for ${UPLOAD_INTENT_LABEL[activeUploadIntent]} mode first.`);
      return;
    }
    
    // 检查积分是否足够（点击后才检查）
    if (credits === null) {
      toast("Loading credits, please wait...");
      return;
    }

    const styleBoostRequiredCredits = mode === 'custom' && supportsStyleBoost && canUseEnhanceStyle && enhanceStyle
      ? CLIENT_STYLE_BOOST_CREDITS
      : 0;
    const requiredCredits = mode === 'custom'
      ? (activeUploadIntent === "track" ? CLIENT_MUSIC_CREDITS.custom + styleBoostRequiredCredits : UPLOAD_ACTION_CREDITS[activeUploadIntent])
      : CLIENT_MUSIC_CREDITS.simple;

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


  const clearUploadIntentSelection = React.useCallback(() => {
    setAudioUploadIntent(forcedUploadIntent ?? null);
  }, [forcedUploadIntent]);

  const clearUploadAndResetIntent = React.useCallback(() => {
    clearUploadCoverFile();
    setAudioUploadIntent(null);
    setSelectedExtendSource(null);
  }, [clearUploadCoverFile]);

  const openUploadPickerForIntent = React.useCallback((intent: AudioUploadIntent) => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    if (mashupTracks.length === 2) {
      toast.error('Please remove current mashup audio before adding a new one.');
      return;
    }

    if (intent !== "track") {
      resetPendingAudio();
      updateCurrentUploadState({
        progressOpen: false,
        progressStatus: "uploading",
        progressError: null,
        readyFile: null,
        readyFileName: null,
        readyDuration: null,
        readyAudioUrl: null,
      });
    } else {
      setSelectedExtendSource(null);
    }

    setAudioUploadIntent(intent);
    uploadFileInputRef.current?.click();
  }, [
    user,
    setIsAuthModalOpen,
    mashupTracks.length,
    resetPendingAudio,
    updateCurrentUploadState,
    uploadFileInputRef,
    setSelectedExtendSource,
  ]);

  const handlePromptAddAudioClick = React.useCallback(() => {
    if (!showUploadAction) return;
    if (!allowedUploadIntents.includes("track")) return;
    openUploadPickerForIntent("track");
  }, [openUploadPickerForIntent, showUploadAction, allowedUploadIntents]);

  const handleAddTrackAudioClick = React.useCallback(() => {
    if (!allowedUploadIntents.includes("track")) return;
    openUploadPickerForIntent("track");
  }, [openUploadPickerForIntent, allowedUploadIntents]);

  const handleChooseTrackFromList = React.useCallback(() => {
    if (typeof onCollapseToTracks === "function") {
      onCollapseToTracks();
      return;
    }
    toast("Go to Track List and click Edit -> Extend Music on a track card to select source material.");
  }, [onCollapseToTracks]);

  const handleAddVocalAudioClick = React.useCallback(() => {
    if (!allowedUploadIntents.includes("vocal")) return;
    openUploadPickerForIntent("vocal");
  }, [openUploadPickerForIntent, allowedUploadIntents]);

  const handleAddMelodyAudioClick = React.useCallback(() => {
    if (!allowedUploadIntents.includes("melody")) return;
    openUploadPickerForIntent("melody");
  }, [openUploadPickerForIntent, allowedUploadIntents]);

  const handleDirectAudioFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    if (file.size > maxDirectUploadBytes) {
      toast.error("File size must be under 100MB.");
      return;
    }

    if (!file.type.startsWith("audio/")) {
      toast.error("Unsupported file type. Please upload audio.");
      return;
    }

    clearUploadCoverFile();

    const previewUrl = URL.createObjectURL(file);
    updateCurrentUploadState({
      coverFile: file,
      coverFileName: file.name,
      audioUrl: previewUrl,
      audioDuration: null,
      audioTotalDuration: null,
      audioCurrentTime: 0,
      isPlaying: false,
      isAnalyzing: true,
      audioMode: "cover",
      audioUploadUrl: null,
      extendStartTime: 0,
      readyFile: null,
      readyFileName: null,
      readyDuration: null,
      readyAudioUrl: null,
      progressOpen: false,
      progressStatus: "uploading",
      progressError: null,
    });

    try {
      const downloadUrl = await uploadAudioToServer(file);
      updateCurrentUploadState({
        audioUploadUrl: downloadUrl,
        progressStatus: "ready",
        progressError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
      updateCurrentUploadState({
        audioUploadUrl: null,
        progressStatus: "error",
        progressError: message,
      });
      toast.error(message);
    }
  }, [
    clearUploadCoverFile,
    maxDirectUploadBytes,
    updateCurrentUploadState,
    uploadAudioToServer,
  ]);

  const handleMashupAudioClick = React.useCallback(() => {
    if (!allowMashupAction) return;
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }
    if (!canUseMashup) {
      setIsPricingOpen(true);
      return;
    }
    if (uploadCoverFile) {
      toast.error('Please remove current uploaded audio before creating mashup.');
      return;
    }
    setMashupError(null);
    setIsMashupEditOpen(true);
  }, [user, setIsAuthModalOpen, canUseMashup, uploadCoverFile, allowMashupAction]);

  const handleOpenPersonaDialog = React.useCallback(() => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    if (!canUsePersona) {
      setIsPricingOpen(true);
      return;
    }

    setIsPersonaDialogOpen(true);
  }, [user, setIsAuthModalOpen, canUsePersona, setIsPersonaDialogOpen]);

  const handleMashupEditSave = React.useCallback(async (editedTracks: MashupEditedTrack[]) => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    if (editedTracks.length !== 2) {
      setMashupError('Please select exactly 2 audio files for mashup.');
      return;
    }

    if (credits === null) {
      toast('Loading credits, please wait...');
      return;
    }

    const mashupCredits = CLIENT_UPLOAD_AUDIO_CREDITS.mashup;
    if (credits < mashupCredits) {
      toast('Insufficient Credits', {
        description: `Need ${mashupCredits} credits (you have ${credits}). Please wait for daily rewards or buy credits.`,
        icon: <CreditCard className="h-4 w-4" />,
      });
      return;
    }

    setMashupError(null);
    setIsMashupPreparing(true);

    try {
      const previewTracks: MashupPreviewTrack[] = editedTracks.map((track, index) => {
        const fileName = track.title?.trim() || track.file.name || `Mashup Audio ${index + 1}`;
        return {
          file: track.file,
          fileName,
          audioUrl: URL.createObjectURL(track.file),
          duration: track.duration,
          uploadUrl: null,
        };
      });

      clearMashupPreviewTracks(mashupPreviewTracks);
      setMashupPreviewTracks(previewTracks);
      setIsMashupEditOpen(false);
      setIsMashupConfirmOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to prepare mashup audio.';
      setMashupError(message);
      toast.error(message);
    } finally {
      setIsMashupPreparing(false);
    }
  }, [
    user,
    setIsAuthModalOpen,
    credits,
    mashupPreviewTracks,
    clearMashupPreviewTracks,
  ]);

  const handleMashupConfirmCancel = React.useCallback(() => {
    if (isMashupSubmitting) return;
    setIsMashupConfirmOpen(false);
    setMashupError(null);
  }, [isMashupSubmitting]);

  const handleMashupConfirmSubmit = React.useCallback(async () => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    if (mashupPreviewTracks.length !== 2) {
      setMashupError('Please select 2 audio files.');
      return;
    }

    setIsMashupSubmitting(true);
    setMashupError(null);

    try {
      const nextTracks: MashupPreviewTrack[] = mashupPreviewTracks.map((track) => ({
        ...track,
        uploadUrl: null,
      }));

      setMashupTracks((prev) => {
        clearMashupPreviewTracks(prev);
        return nextTracks;
      });

      setIsMashupConfirmOpen(false);
      toast.success('Mashup audio preview is ready.');
    } catch (error) {
      console.error('Mashup confirm failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to confirm mashup audio.';
      setMashupError(message);
      toast.error(message);
    } finally {
      setIsMashupSubmitting(false);
    }
  }, [
    user,
    setIsAuthModalOpen,
    mashupPreviewTracks,
    clearMashupPreviewTracks,
  ]);

  const uploadAudioPreview = uploadAudioUrl ? (
    <div className="space-y-2">
      <div className="studio-panel-card rounded-2xl p-3">
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleUploadAudioPlayPause}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary transition hover:text-primary/80 hover:bg-primary/15 p-0"
                disabled={!uploadAudioUrl || isUploadAudioAnalyzing}
              >
                {isUploadAudioPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
              <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold truncate text-foreground leading-none">
                    {uploadCoverFileName || uploadCoverFile?.name || "Selected Track"}
                  </p>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openUploadPickerForIntent("track")}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors p-0"
                      title="Replace file"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={clearUploadAndResetIntent}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors p-0"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
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
            </div>
            {uploadAudioUrl && (
              <div className="space-y-2">
                <div className="w-full h-[54px] rounded-md bg-muted/20 backdrop-blur-md px-3">
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
                    waveColor={uploadWaveColor}
                    progressColor={uploadProgressColor}
                    cursorColor={uploadCursorColor}
                    cursorWidth={2}
                    chrome={false}
                    className="w-full h-full"
                    showSelector={activeUploadIntent === "track" && uploadAudioMode === "extend" && isCustomMode}
                    selectorOverlay={true}
                    showSelectorEndHandle={false}
                    showSelectorLabels={false}
                    selectorStart={uploadExtendStartTime}
                    selectorEnd={uploadAudioDuration || 0}
                    onSelectorStartChange={(time) => updateExtendStartTime(time, { syncPlayback: false })}
                    onSelectorHandleRelease={() => updateExtendStartTime(uploadExtendStartTime, { syncPlayback: true })}
                  />
                </div>
                {activeUploadIntent === "track" && uploadAudioMode === "extend" && isCustomMode && (
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <p className="truncate">Drag the handle to set the extension start time.</p>
                    <p className="shrink-0">Continue at {formatDuration(Math.floor(uploadExtendStartTime)) || "0:00"}</p>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  ) : null;

  const mashupAudioPreview = mashupTracks.length === 2 ? (
    <div className="space-y-2">
      {mashupTracks.map((track, index) => (
        <div key={`${track.fileName}-${index}`} className="studio-panel-card rounded-2xl p-3">
          <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    if (mashupPlayingIndex === index) {
                      setMashupPlayingIndex(null);
                      return;
                    }
                    setMashupCurrentTimes((prev) => prev.map((_, currentIndex) => (currentIndex === index ? prev[currentIndex] || 0 : 0)));
                    setMashupPlayingIndex(index);
                  }}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary transition hover:text-primary/80 hover:bg-primary/15 p-0"
                >
                  {mashupPlayingIndex === index ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold truncate text-foreground leading-none">
                      {track.fileName}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary/90">
                      Mashup
                    </span>
                    <button
                      type="button"
                      onClick={clearMashupSelection}
                      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors p-0"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground leading-none">
                      {formatDuration(Math.floor(Math.max(0, track.duration - (mashupCurrentTimes[index] || 0)))) || "0:00"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="w-full h-[54px] rounded-md bg-muted/20 backdrop-blur-md px-3">
                <WaveformPlayer
                  audioUrl={track.audioUrl}
                  audioBlob={track.file}
                  isPlaying={mashupPlayingIndex === index}
                  externalCurrentTime={mashupCurrentTimes[index] || 0}
                  onPlayPause={() => {
                    setMashupPlayingIndex((prev) => {
                      if (prev === index) {
                        return null;
                      }
                      return index;
                    });
                  }}
                  onFinish={() => {
                    setMashupPlayingIndex((prev) => (prev === index ? null : prev));
                    setMashupCurrentTimes((prev) => prev.map((time, currentIndex) => (currentIndex === index ? 0 : time)));
                  }}
                  onTimeUpdate={(time) => {
                    setMashupCurrentTimes((prev) => {
                      const next = prev.length === mashupTracks.length ? [...prev] : mashupTracks.map(() => 0);
                      next[index] = time;
                      return next;
                    });
                  }}
                  onPlayStateChange={(playing) => {
                    if (playing) {
                      setMashupPlayingIndex(index);
                      return;
                    }
                    setMashupPlayingIndex((prev) => (prev === index ? null : prev));
                  }}
                  showControls={false}
                  separateControls={false}
                  isLoading={!track.audioUrl}
                  syncWithIsPlaying={true}
                  backend="MediaElement"
                  waveHeight={54}
                  waveColor={uploadWaveColor}
                  progressColor={uploadProgressColor}
                  cursorColor={uploadCursorColor}
                  cursorWidth={2}
                  chrome={false}
                  className="w-full h-full"
                />
              </div>
          </div>
        </div>
      ))}
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
            {activeUploadIntent === "track" && (
              <Tooltip
                content={`Enhance style quality · ${CLIENT_STYLE_BOOST_CREDITS} credits/use`}
                position="top"
              >
                <div className="inline-flex h-8 items-center gap-2 rounded-full bg-foreground/5 px-3 text-xs text-muted-foreground">
                  <Switch
                    checked={supportsStyleBoost && canUseEnhanceStyle ? enhanceStyle : false}
                    onCheckedChange={(checked) => {
                      if (!supportsStyleBoost) {
                        return;
                      }
                      if (!canUseEnhanceStyle) {
                        setIsPricingOpen(true);
                        return;
                      }
                      setEnhanceStyle(checked);
                    }}
                    disabled={!supportsStyleBoost || isGenerating}
                    className="scale-75"
                    aria-label="Enhance style prompt"
                  />
                  <span className="text-xs">Enhance</span>
                </div>
              </Tooltip>
            )}
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

  const melodyTagsSection = (
    <>
      <section className="studio-panel-card rounded-2xl p-3">
        <h3 className="text-xs md:text-sm font-semibold mb-3 md:mb-4 flex items-center gap-2">
          Tags
        </h3>
        <div>
          <Textarea
            placeholder="Describe the melody style tags"
            value={melodyTags}
            onChange={(event) => setMelodyTags(event.target.value)}
            maxLength={styleTextMaxLength}
            className="min-h-[120px] resize-none pl-0 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            {melodyTags.length}/{styleTextMaxLength}
          </div>
        </div>
      </section>

      <section className="studio-panel-card rounded-2xl p-3">
        <h3 className="text-xs md:text-sm font-semibold mb-3 md:mb-4 flex items-center gap-2">
          Negative Tags
        </h3>
        <div>
          <Textarea
            placeholder="Describe what to avoid in the arrangement"
            value={melodyNegativeTags}
            onChange={(event) => setMelodyNegativeTags(event.target.value)}
            maxLength={styleTextMaxLength}
            className="min-h-[120px] resize-none pl-0 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            {melodyNegativeTags.length}/{styleTextMaxLength}
          </div>
        </div>
      </section>
    </>
  );

  const customModeStyleSection = activeUploadIntent === "melody" ? melodyTagsSection : styleSection;

  return (
    <div
      className={`studio-panel-cards transition-all duration-300 ease-in-out ${
        // 桌面：左侧固定宽度；移动端：当 forceVisibleOnMobile=true 时占满宽度
        panelOpen ? (forceVisibleOnMobile ? 'w-full md:w-[32rem]' : 'w-[32rem]') : 'w-0'
      } ${forceVisibleOnMobile ? 'flex flex-col' : 'h-full flex flex-col overflow-hidden'} ${forceVisibleOnMobile ? 'flex md:flex' : 'hidden md:flex'}`}
      style={
        hasPlayer && !forceVisibleOnMobile
          ? { height: 'calc(100% - var(--player-height, 0px) - 1rem)' }
          : undefined
      }
    >
      {panelOpen && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-0 pt-4 md:pt-6 pb-4">
            {panelTitle && (
              <div className="mb-3 px-1 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground/90">
                    {panelTitle}
                  </h2>
                  {mode === "custom" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsModelDialogOpen(true)}
                        className="group h-11 min-w-[5.75rem] px-4 rounded-2xl border border-white/45 dark:border-white/10 text-xs md:text-sm font-semibold text-slate-950 transition-all duration-200 bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 shadow-[0_6px_14px_rgba(56,189,248,0.18)] hover:from-cyan-200 hover:via-sky-200 hover:to-indigo-200 flex items-center justify-center"
                        title="Choose model"
                      >
                        <span>{modelOptions.find((opt) => opt.value === selectedModel)?.label || "V4"}</span>
                      </button>
                      <ModelSelectionDialog
                        open={isModelDialogOpen}
                        onOpenChange={setIsModelDialogOpen}
                        selectedModel={selectedModel}
                        onSelectModel={handleModelSelect}
                        options={modelOptions}
                        isModelLocked={(model) => model === "V5" && !canUseV5Model}
                        onLockedModelSelect={() => setIsPricingOpen(true)}
                      />
                    </>
                  )}
                </div>
                <p className="mt-1 text-xs md:text-sm text-muted-foreground">
                  Extend uploaded tracks while keeping the original style.
                </p>
              </div>
            )}
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
              onChange={mode === "custom" && audioUploadIntent !== null && audioUploadIntent !== "track" ? handleDirectAudioFileChange : handlePromptFileChange}
            />
            {/* Mode Content */}
            {mode === "simple" ? (
              <StudioSimpleModeContent
                showQuickButtonsSection={false}
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
                showAddAudioAction={showUploadAction}
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
                uploadAudioPreview={mashupTracks.length === 2 ? mashupAudioPreview : uploadAudioPreview}
                uploadIntent={audioUploadIntent}
                preferTrackUploadCard={isExtendUploadMode}
                onAddTrack={handleAddTrackAudioClick}
                onChooseTrackFromList={handleChooseTrackFromList}
                onAddVocal={handleAddVocalAudioClick}
                onAddMelody={handleAddMelodyAudioClick}
                onClearUploadIntent={forcedUploadIntent === undefined ? clearUploadIntentSelection : undefined}
                onAddMashup={allowMashupAction ? handleMashupAudioClick : undefined}
                isMashupLoading={isMashupPreparing || isMashupSubmitting}
                onOpenPersonaDialog={handleOpenPersonaDialog}
                showAddAudioActions={showUploadAction}
                allowedUploadIntents={allowedUploadIntents}
                hasUploadPreview={!!uploadAudioUrl || mashupTracks.length === 2}
                hidePersonaAction={allowMashupAction || mashupTracks.length === 2 || (audioUploadIntent !== null && activeUploadIntent !== "track")}
                selectedPersonaName={selectedPersona?.name?.trim() || null}
                selectedPersonaId={selectedPersonaId}
                selectedPersonaModel={selectedPersonaModel}
                setSelectedPersonaModel={setSelectedPersonaModel}
                canUseVoicePersonaModel={canUseVoicePersonaModel}
                instrumentalMode={instrumentalMode}
                setInstrumentalMode={setInstrumentalMode}
                showInstrumentalToggle={activeUploadIntent === "track"}
                customLyrics={customLyrics}
                setCustomLyrics={setCustomLyrics}
                customPromptMaxLength={customPromptMaxLength}
                showLyricsSection={activeUploadIntent !== "melody"}
                onGenerateLyrics={onGenerateLyrics}
                onWriteNextLyricLine={onWriteNextLyricLine}
                isWritingNextLyricLine={isWritingNextLyricLine}
                onClearCustomLyrics={() => setCustomLyrics("")}
                vocalGender={vocalGender}
                setVocalGender={setVocalGender}
                vocalGenders={vocalGenders as Array<{ id: string; name: string }>}
                showVocalGenderSection={activeUploadIntent !== "melody"}
                styleSection={customModeStyleSection}
                songTitle={songTitle}
                setSongTitle={setSongTitle}
                titleMaxLength={titleMaxLength}
                styleWeight={styleWeight}
                setStyleWeight={(value) => { if (!canUseEnhanceStyle) { setIsPricingOpen(true); return; } setStyleWeight?.(value); }}
                weirdnessConstraint={weirdnessConstraint}
                setWeirdnessConstraint={(value) => { if (!canUseEnhanceStyle) { setIsPricingOpen(true); return; } setWeirdnessConstraint?.(value); }}
                audioWeight={audioWeight}
                setAudioWeight={(value) => { if (!canUseEnhanceStyle) { setIsPricingOpen(true); return; } setAudioWeight?.(value); }}
                showAdvancedOptions={true}
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
                if (requiresTrackUpload) {
                  isDisabled = isDisabled || !hasTrackUploadSource;
                }
              } else if (activeUploadIntent === "melody") {
                isDisabled = isDisabled || !songTitle.trim() || !melodyTags.trim() || !uploadCoverFile;
              } else if (activeUploadIntent === "vocal") {
                isDisabled = isDisabled || !songTitle.trim() || !styleText.trim() || !customLyrics.trim() || !uploadCoverFile;
              } else {
                // Track mode in custom: style and title are required; lyrics required when instrumental is false
                isDisabled = isDisabled || !styleText.trim() || !songTitle.trim();
                if (!instrumentalMode) {
                  isDisabled = isDisabled || !customLyrics.trim();
                }
                if (requiresTrackUpload) {
                  isDisabled = isDisabled || !hasTrackUploadSource;
                }
                if (isExtendUploadMode) {
                  isDisabled = isDisabled || !isExtendContinueAtValid;
                }
              }

              const createActionLabel = mode === "custom"
                ? activeUploadIntent === "vocal"
                  ? "Create Vocal"
                  : activeUploadIntent === "melody"
                    ? "Create Melody"
                    : "Create"
                : "Create";

              return (
                <div className="flex">
                  <button
                    onClick={() => {
                      handleGenerateWithAuth();
                    }}
                    disabled={isDisabled}
                    className="flex-1 h-12 px-4 text-base font-semibold bg-gradient-create text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-50"
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
                          <span>{createActionLabel}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Wand2 className="h-4 w-4" />
                          <span>{createActionLabel}</span>
                          <span className="font-normal text-white/90">{`• cost ${createCredits} credits`}</span>
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
          try {
            const downloadUrl = await uploadAudioToServer(file);
            setSelectedExtendSource(null);
            if (uploadAudioUrl) {
              URL.revokeObjectURL(uploadAudioUrl);
            }
            const nextUrl = URL.createObjectURL(file);
            updateCurrentUploadState({
              audioMode: "extend",
              coverFile: file,
              coverFileName: title || file.name || null,
              audioUrl: nextUrl,
              audioDuration: durationValue,
              audioTotalDuration: durationValue,
              audioCurrentTime: 0,
              isPlaying: false,
              isAnalyzing: false,
              audioUploadUrl: downloadUrl,
              extendStartTime: 0,
              progressOpen: false,
              progressStatus: "uploading",
              progressError: null,
              readyFile: null,
              readyFileName: null,
              readyDuration: null,
              readyAudioUrl: null,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
            throw new Error(message);
          }
        }}
      />

      <MusicPersonaDialogs
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

      <MashupEditDialog
        isOpen={isMashupEditOpen}
        onClose={() => {
          if (isMashupPreparing) return;
          setIsMashupEditOpen(false);
          setMashupError(null);
        }}
        minDuration={3}
        maxDuration={maxUploadDurationSeconds}
        onSave={handleMashupEditSave}
      />

      <MashupUploadConfirmDialog
        isOpen={isMashupConfirmOpen}
        onClose={handleMashupConfirmCancel}
        tracks={mashupPreviewTracks.map((track) => ({
          fileName: track.fileName,
          audioUrl: track.audioUrl,
          duration: track.duration,
        }))}
        onConfirm={handleMashupConfirmSubmit}
        isConfirming={isMashupSubmitting}
        errorMessage={mashupError}
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
