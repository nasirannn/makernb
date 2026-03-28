"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Play, CreditCard, X, Pause, Disc3, Wand2, Trash2, Loader2, RefreshCw } from "lucide-react";
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
import { useStudioPresetStyleGenerator } from "@/hooks/use-studio-preset-style-generator";
import { UploadProgressDialog } from "@/components/ui/upload-progress-dialog";
import { formatDuration } from '@/lib/format-utils';
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { MashupEditDialog, type MashupEditedTrack } from "@/features/music-upload/components/mashup-edit-dialog";
import { MashupUploadConfirmDialog } from "@/components/ui/mashup-upload-confirm-dialog";
import { StudioCustomModeContent, StudioSimpleModeContent, type AudioUploadIntent } from "@/components/ui/feature-panels/add-melody-panel-mode-content";
import { UploadAudioPlayerCard } from "@/components/ui/feature-panels/shared/upload-audio-player-card";
import { MusicPersonaDialogs } from "@/components/ui/music-persona-dialogs";
import { useStudioPersonaManager } from "@/hooks/use-studio-persona-manager";
import { ModelSelectionDialog, MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import { PanelPricingModal } from "@/components/ui/feature-panels/shared/panel-pricing-modal";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n/provider";
import { formatMusicModelLabel, isPremiumMusicModel } from '@/lib/music-model-utils';
import type { FeatureCreatePanelProps } from "@/types/studio-feature-panel";
import { getZIndexClass } from "@/lib/z-index";

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
const UPLOAD_PROGRESS_COLOR_LIGHT = "hsl(var(--primary))";
const UPLOAD_CURSOR_COLOR_LIGHT = "hsl(var(--primary))";

const UPLOAD_ACTION_CREDITS: Record<AudioUploadIntent, number> = {
  track: CLIENT_UPLOAD_AUDIO_CREDITS.cover,
  vocal: CLIENT_UPLOAD_AUDIO_CREDITS.vocal,
  melody: CLIENT_UPLOAD_AUDIO_CREDITS.melody,
};
const ADD_MELODY_ALLOWED_MODELS: MusicModel[] = ["V5_5", "V5", "V4_5PLUS"];

type MashupPreviewTrack = {
  file: File;
  fileName: string;
  audioUrl: string;
  duration: number;
  uploadUrl: string | null;
};


export type { FeatureCreatePanelProps } from "@/types/studio-feature-panel";

export const AddMelodyPanel = (props: FeatureCreatePanelProps) => {
  const {
    panelOpen,
    forceVisibleOnMobile = false,
    hasPlayer = false,
    panelTitle,
    panelTabs = null,
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
    selectedModel = 'V4_5PLUS',
    setSelectedModel,
    selectedPersonaId = '',
    setSelectedPersonaId,
    showModeTabs = false,
    lockModeSelector = true,
    showUploadAction = true,
    allowedUploadIntents = ["melody"],
    forcedUploadIntent = "melody",
    forcedTrackUploadMode = null,
    allowMashupAction = false,
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();
  const { resolvedTheme } = useTheme();
  const { t, locale } = useI18n();
  const resolvedPanelTitle = panelTitle ?? t("studioFeatures.addMelody");
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
  const supportsStyleBoost = ['V4_5', 'V4_5PLUS', 'V4_5ALL'].includes(
    String(effectiveModel).toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS')
  );
  const isDark = resolvedTheme === "dark";
  const uploadWaveColor = isDark ? "rgba(255, 255, 255, 0.7)" : UPLOAD_WAVE_COLOR_LIGHT;
  const uploadProgressColor = isDark ? "hsl(var(--primary))" : UPLOAD_PROGRESS_COLOR_LIGHT;
  const uploadCursorColor = isDark ? "hsl(var(--primary))" : UPLOAD_CURSOR_COLOR_LIGHT;
  const addMelodyModelOptions = React.useMemo(
    () => modelOptions.filter((option) => ADD_MELODY_ALLOWED_MODELS.includes(option.value)),
    []
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

  React.useEffect(() => {
    if (!isCustomMode) return;
    if (selectedModel === "V5_5" || selectedModel === "V5" || selectedModel === "V4_5PLUS") return;
    updateSelectedModel("V4_5PLUS", { forceOverride: true });
  }, [isCustomMode, selectedModel, updateSelectedModel]);

  const { hasPermission } = useFeaturePermissions();
  const canUseV5Model = hasPermission('model_v5');
  const canUseMashup = hasPermission('upload_mashup_music');
  const canUsePersona = hasPermission('generate_persona');
  const canUseEnhanceStyle = hasPermission('boost_music_style');

  // Pricing dialog state
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = React.useState(false);
  const [isMashupEditOpen, setIsMashupEditOpen] = React.useState(false);
  const [isMashupConfirmOpen, setIsMashupConfirmOpen] = React.useState(false);
  const [isMashupPreparing, setIsMashupPreparing] = React.useState(false);
  const [isMashupSubmitting, setIsMashupSubmitting] = React.useState(false);
  const [mashupError, setMashupError] = React.useState<string | null>(null);
  const [mashupTracks, setMashupTracks] = React.useState<MashupPreviewTrack[]>([]);
  const [mashupPreviewTracks, setMashupPreviewTracks] = React.useState<MashupPreviewTrack[]>([]);
  const [mashupPlayingIndex, setMashupPlayingIndex] = React.useState<number | null>(null);
  const [mashupCurrentTimes, setMashupCurrentTimes] = React.useState<number[]>([]);
  const {
    isGeneratingGenrePrompt,
    pendingGenreId,
    generateGenrePrompt: handleGenerateGenrePrompt,
  } = useStudioPresetStyleGenerator({
    locale,
    isAuthenticated: Boolean(user),
    onRequireAuth: () => setIsAuthModalOpen?.(true),
    t,
  });

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
    readyFile,
    readyFileName,
    readyDuration,
    readyAudioUrl,
    isUploadProgressOpen,
    uploadProgressStatus,
    uploadProgressError,
    clearUploadCoverFile,
    uploadAudioToServer,
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
  const isExtendContinueAtValid = !isExtendUploadMode || !isCustomMode || (
    (uploadAudioDuration || 0) > 1 &&
    uploadExtendStartTime > 0 &&
    uploadExtendStartTime < (uploadAudioDuration || 0)
  );
  const styleBoostCredits = isCustomMode && supportsStyleBoost && canUseEnhanceStyle && enhanceStyle
    ? CLIENT_STYLE_BOOST_CREDITS
    : 0;
  const createCredits = mashupTracks.length === 2
    ? CLIENT_UPLOAD_AUDIO_CREDITS.mashup
    : uploadCoverFile
      ? (activeUploadIntent === "track" ? CLIENT_UPLOAD_AUDIO_CREDITS[uploadAudioMode] : UPLOAD_ACTION_CREDITS[activeUploadIntent])
      : mode === "custom"
        ? (activeUploadIntent === "track" ? CLIENT_MUSIC_CREDITS.custom + styleBoostCredits : UPLOAD_ACTION_CREDITS[activeUploadIntent])
        : CLIENT_MUSIC_CREDITS.simple;

  const handleModelSelect = React.useCallback((model: MusicModel) => {
    const selectedOption = addMelodyModelOptions.find((option) => option.value === model);
    if (!selectedOption) return;

    if (isPremiumMusicModel(model) && !canUseV5Model) {
      setIsPricingOpen(true);
      return;
    }

    updateSelectedModel(model, { userInitiated: true });
  }, [addMelodyModelOptions, canUseV5Model, updateSelectedModel]);
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
        toast.error(t("toasts.pleaseEnterStyleBeforeMashup"));
        return;
      }
      if (!trimmedTitle) {
        toast.error(t("toasts.pleaseEnterTitleBeforeMashup"));
        return;
      }
      if (!instrumentalMode && !trimmedCustomLyrics) {
        toast.error(t("toasts.pleaseEnterLyricsBeforeMashup"));
        return;
      }

      if (credits === null) {
        toast(t("toasts.loadingCreditsPleaseWait"));
        return;
      }

      const mashupCredits = CLIENT_UPLOAD_AUDIO_CREDITS.mashup;
      if (credits < mashupCredits) {
        toast(t("toasts.insufficientCredits"), {
          description: t("toasts.needCreditsDescription", { required: mashupCredits, credits: credits ?? 0 }),
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
          throw new Error(t("toasts.failedUploadMashupAudioFiles"));
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
        const message = error instanceof Error ? error.message : t("toasts.mashupGenerationFailedTryAgain");
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

    if (requiresTrackUpload && !uploadCoverFile) {
      toast.error(t("toasts.pleaseUploadAudioTrackFirst"));
      return;
    }

    if (isExtendUploadMode && isCustomMode && uploadCoverFile && !isExtendContinueAtValid) {
      toast.error(t("toasts.pleaseSetContinueAtRange"));
      return;
    }

    if (uploadCoverFile) {
      if (!uploadAudioUploadUrl) {
        toast.error(t("toasts.uploadUrlMissingSaveAudioAgain"));
        return;
      }

      const result = await onGenerationStart?.({
        uploadFile: uploadCoverFile,
        uploadUrl: uploadAudioUploadUrl,
        audioDuration: activeUploadIntent === "track"
          ? (Math.max(uploadAudioTotalDuration || uploadAudioDuration || 0, 0) || undefined)
          : undefined,
        mode: activeUploadIntent === "track"
          ? uploadAudioMode
          : activeUploadIntent === "vocal"
            ? "vocal"
            : "melody",
        continueAt: activeUploadIntent === "track" && uploadAudioMode === "extend" && isCustomMode
          ? uploadExtendStartTime
          : undefined,
        tags: activeUploadIntent === "melody" ? melodyTags : undefined,
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
      toast.error(t("toasts.pleaseUploadAudioFileForModeFirst", { mode: t("featurePanel." + activeUploadIntent) }));
      return;
    }
    
    // 检查积分是否足够（点击后才检查）
    if (credits === null) {
      toast(t("toasts.loadingCreditsPleaseWait"));
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
      toast(t("toasts.insufficientCredits"), {
        description: t("toasts.needCreditsDescription", { required: requiredCredits, credits: credits ?? 0 }),
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
  }, [clearUploadCoverFile]);

  const openUploadPickerForIntent = React.useCallback((intent: AudioUploadIntent) => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }

    if (mashupTracks.length === 2) {
      toast.error(t("toasts.pleaseRemoveCurrentMashupAudioBeforeAdding"));
      return;
    }

    if (intent !== "track") {
      updateCurrentUploadState({
        progressOpen: false,
        progressStatus: "uploading",
        progressError: null,
        readyFile: null,
        readyFileName: null,
        readyDuration: null,
        readyAudioUrl: null,
      });
    }

    setAudioUploadIntent(intent);
    uploadFileInputRef.current?.click();
  }, [
    user,
    setIsAuthModalOpen,
    mashupTracks.length,
    updateCurrentUploadState,
    uploadFileInputRef,
    t,
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
      toast.error(t("toasts.fileSizeUnder100Mb"));
      return;
    }

    if (!file.type.startsWith("audio/")) {
      toast.error(t("toasts.unsupportedFileTypeUploadAudio"));
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
      const message = error instanceof Error ? error.message : t("toasts.uploadFailedTryAgain");
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
    t,
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
      toast.error(t("toasts.pleaseRemoveCurrentUploadedAudioBeforeMashup"));
      return;
    }
    setMashupError(null);
    setIsMashupEditOpen(true);
  }, [user, setIsAuthModalOpen, canUseMashup, uploadCoverFile, allowMashupAction, t]);

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
      setMashupError(t("toasts.pleaseSelectExactly2AudioFilesForMashup"));
      return;
    }

    if (credits === null) {
      toast(t("toasts.loadingCreditsPleaseWait"));
      return;
    }

    const mashupCredits = CLIENT_UPLOAD_AUDIO_CREDITS.mashup;
    if (credits < mashupCredits) {
      toast(t("toasts.insufficientCredits"), {
        description: t("toasts.needCreditsDescription", { required: mashupCredits, credits: credits ?? 0 }),
        icon: <CreditCard className="h-4 w-4" />,
      });
      return;
    }

    setMashupError(null);
    setIsMashupPreparing(true);

    try {
      const previewTracks: MashupPreviewTrack[] = editedTracks.map((track, index) => {
        const fileName = track.title?.trim() || track.file.name || t("featurePanel.mashupAudioWithIndex", { index: index + 1 });
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
      const message = error instanceof Error ? error.message : t("toasts.failedPrepareMashupAudio");
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
    t,
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
      setMashupError(t("toasts.pleaseSelect2AudioFiles"));
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
      toast.success(t("toasts.mashupAudioPreviewReady"));
    } catch (error) {
      console.error('Mashup confirm failed:', error);
      const message = error instanceof Error ? error.message : t("toasts.failedConfirmMashupAudio");
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
    t,
  ]);

  const uploadTotalSeconds = Math.max(uploadAudioTotalDuration || uploadAudioDuration || 0, 0);
  const uploadCurrentSecondsRaw = Math.max(uploadAudioCurrentTime || 0, 0);
  const uploadCurrentSeconds =
    uploadTotalSeconds > 0 ? Math.min(uploadCurrentSecondsRaw, uploadTotalSeconds) : uploadCurrentSecondsRaw;
  const uploadProgressPercent = uploadTotalSeconds > 0 ? (uploadCurrentSeconds / uploadTotalSeconds) * 100 : 0;
  const uploadCurrentLabel = formatDuration(Math.floor(uploadCurrentSeconds)) || "0:00";
  const uploadTotalLabel = formatDuration(Math.floor(uploadTotalSeconds)) || "0:00";
  const uploadSubtitle = isUploadAudioAnalyzing
    ? t("featurePanel.analyzingAudio")
    : "";

  const uploadAudioPreview = uploadCoverFile ? (
    <div className="space-y-2">
      <UploadAudioPlayerCard
        title={uploadCoverFileName || uploadCoverFile.name}
        subtitle={uploadSubtitle}
        durationLabel={
          uploadTotalSeconds > 0
            ? t("featurePanel.durationWithValue", { duration: uploadTotalLabel })
            : undefined
        }
        isPlaying={isUploadAudioPlaying}
        isDisabled={!uploadCoverFile || isUploadAudioAnalyzing}
        progressPercent={uploadProgressPercent}
        currentTimeLabel={uploadCurrentLabel}
        totalTimeLabel={uploadTotalLabel}
        playLabel={t("trackActions.play")}
        pauseLabel={t("trackActions.pause")}
        replaceLabel={t("featurePanel.replaceFile")}
        removeLabel={t("featurePanel.remove")}
        onPlayPause={handleUploadAudioPlayPause}
        onReplace={() => openUploadPickerForIntent("track")}
        onRemove={clearUploadAndResetIntent}
        waveform={uploadAudioUrl ? (
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
            waveHeight={56}
            waveColor={uploadWaveColor}
            progressColor={uploadProgressColor}
            cursorColor={uploadCursorColor}
            cursorWidth={2}
            chrome={false}
            className="h-[56px] w-full"
          />
        ) : (
          <div className="flex h-[56px] items-center justify-center text-sm text-muted-foreground">
            {t("featurePanel.analyzingAudio")}
          </div>
        )}
      />
    </div>
  ) : null;

  const mashupAudioPreview = mashupTracks.length === 2 ? (
    <div className="space-y-2">
      {mashupTracks.map((track, index) => (
        <div key={`${track.fileName}-${index}`} className="rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-border/50 to-primary/10">
          <div className="relative overflow-hidden rounded-2xl bg-background p-3 shadow-sm">
            <div className="relative flex flex-col gap-3">
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
                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary/90">
                      Mashup
                    </span>
                    <button
                      type="button"
                      onClick={clearMashupSelection}
                      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors p-0"
                      title={t("featurePanel.remove")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground leading-none">
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
                  options?.horizontalScroll ? 'flex-nowrap overflow-x-auto scrollbar-hidden pb-1' : 'flex-wrap'
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
                      className={`inline-flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 dark:border-transparent text-xs font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${
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
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium transition-all duration-200 ${
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
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium transition-all duration-200 ${
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
                    className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium transition-all duration-200 ${
                      hasTag(text, 'Slow')
                        ? 'bg-primary text-primary-foreground '
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{t("featurePanel.tempoSlow")}</span>
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
                    className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium transition-all duration-200 ${
                      hasTag(text, 'Moderate')
                        ? 'bg-primary text-primary-foreground '
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{t("featurePanel.tempoModerate")}</span>
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
                    className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium transition-all duration-200 ${
                      hasTag(text, 'Medium')
                        ? 'bg-primary text-primary-foreground '
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{t("featurePanel.tempoMedium")}</span>
                  </button>
                </Tooltip>
              </div>
            )}

            {activeExpanded === 'instrument' && (
              <div
                className={`flex gap-2 ${
                  options?.horizontalScroll ? 'flex-nowrap overflow-x-auto scrollbar-hidden pb-1' : 'flex-wrap'
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
                        <span className="text-xs">{instrument.name}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={t("featurePanel.playSample")}
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
                          title={t("featurePanel.playSample")}
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
                  options?.horizontalScroll ? 'flex-nowrap overflow-x-auto scrollbar-hidden pb-1' : 'flex-wrap'
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
                        <span className="text-xs">{kit.name}</span>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={t("featurePanel.playSample")}
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
                          title={t("featurePanel.playSample")}
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
                      <span className="text-xs">{tone.name}</span>
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
                      className={`inline-flex items-center px-3 py-1.5 rounded-full border border-white/10 text-xs font-medium transition-all duration-200 ${
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
          {t("featurePanel.musicStyle")}
        </h3>
      </div>

      <div>
        <div>
          <Textarea
            placeholder={t("featurePanel.enterStyleOfMusic")}
            value={styleText}
            onChange={(e) => {
              const newValue = e.target.value;
              setStyleText(newValue);
              handleUpdateStatesFromTextarea(newValue);
            }}
            maxLength={styleTextMaxLength}
            className="min-h-[180px] md:min-h-[200px] resize-none pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
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
                content={t("featurePanel.enhanceStyleQualityCost", { credits: CLIENT_STYLE_BOOST_CREDITS })}
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
                    aria-label={t("featurePanel.enhanceStylePrompt")}
                  />
                  <span className="text-xs">{t("featurePanel.enhance")}</span>
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
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground/5 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
              <span className="text-xs font-medium">{t("featurePanel.clear")}</span>
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
            placeholder={t("featurePanel.describeMelodyStyleTags")}
            value={melodyTags}
            onChange={(event) => setMelodyTags(event.target.value)}
            maxLength={styleTextMaxLength}
            className="min-h-[120px] resize-none pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            {melodyTags.length}/{styleTextMaxLength}
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
          {/* Header */}
          <div className="flex-shrink-0 px-0 pt-2 md:pt-4 pb-4">
            {resolvedPanelTitle && (
              <div className="mb-3 px-1 space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
                    {resolvedPanelTitle}
                  </h2>
                  <div className="h-11 min-w-[5.75rem] flex items-center justify-end">
                    {mode === "custom" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsModelDialogOpen(true)}
                          className="group h-11 min-w-[5.75rem] px-4 rounded-2xl border border-white/45 dark:border-white/10 text-xs md:text-sm font-semibold text-slate-950 transition-all duration-200 bg-gradient-to-r from-cyan-300 via-sky-300 to-indigo-300 shadow-[0_6px_14px_rgba(56,189,248,0.18)] hover:from-cyan-200 hover:via-sky-200 hover:to-indigo-200 flex items-center justify-center"
                          title={t("featurePanel.chooseModel")}
                        >
                          <span>{formatMusicModelLabel(selectedModel) || "V4.5+"}</span>
                        </button>
                        <ModelSelectionDialog
                          open={isModelDialogOpen}
                          onOpenChange={setIsModelDialogOpen}
                          selectedModel={selectedModel}
                          onSelectModel={handleModelSelect}
                          options={addMelodyModelOptions}
                          isModelLocked={(model) => isPremiumMusicModel(model) && !canUseV5Model}
                          onLockedModelSelect={() => setIsPricingOpen(true)}
                        />
                      </>
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-11 min-w-[5.75rem] rounded-2xl opacity-0 pointer-events-none"
                      />
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("featurePanel.generateBackingMusicFromVocalOrMelody")}
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
              onChange={handleDirectAudioFileChange}
            />
            {panelTabs ? (
              <div className="pb-3 md:pb-3">{panelTabs}</div>
            ) : null}
            {showModeTabs && (
              <div className="pb-3 md:pb-3">
                <div className="app-card-muted flex w-full items-center rounded-2xl p-1 gap-1 bg-foreground/5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10">
                  <button
                    onClick={() => {
                      if (!lockModeSelector) {
                        setMode("simple");
                      }
                    }}
                    className={`flex-1 h-10 px-4 text-xs md:text-sm font-medium transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      mode === "simple"
                        ? "bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                        : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                    } ${lockModeSelector ? 'cursor-not-allowed opacity-70' : ''}`}
                    disabled={lockModeSelector}
                  >
                    {t("featurePanel.descriptionTab")}
                  </button>
                  <button
                    onClick={() => {
                      if (!lockModeSelector) {
                        setMode("custom");
                      }
                    }}
                    className={`flex-1 h-10 px-4 text-xs md:text-sm font-medium transition-colors duration-200 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      mode === "custom"
                        ? "bg-primary text-primary-foreground font-semibold shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                        : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                    } ${lockModeSelector ? 'cursor-not-allowed opacity-70' : ''}`}
                    disabled={lockModeSelector}
                  >
                    {t("featurePanel.lyricsTab")}
                  </button>
                </div>
              </div>
            )}
            {/* Mode Content */}
      {mode === "simple" ? (
        <StudioSimpleModeContent
          instrumentalMode={instrumentalMode}
          setInstrumentalMode={setInstrumentalMode}
          showInstrumentalToggle={!isExtendUploadMode}
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
          onAddVocal={handleAddVocalAudioClick}
          onAddMelody={handleAddMelodyAudioClick}
          onClearUploadIntent={forcedUploadIntent === undefined ? clearUploadIntentSelection : undefined}
          onAddMashup={allowMashupAction ? handleMashupAudioClick : undefined}
          isMashupLoading={isMashupPreparing || isMashupSubmitting}
          onOpenPersonaDialog={handleOpenPersonaDialog}
          showAddAudioActions={showUploadAction}
          allowedUploadIntents={allowedUploadIntents}
          hasUploadPreview={!!uploadCoverFile || mashupTracks.length === 2}
          hidePersonaAction={allowMashupAction || mashupTracks.length === 2 || (audioUploadIntent !== null && activeUploadIntent !== "track")}
          selectedPersonaName={selectedPersona?.name?.trim() || null}
          selectedPersonaDescription={selectedPersona?.description?.trim() || null}
          selectedPersonaId={selectedPersonaId}
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
                ? `sticky bottom-0 ${getZIndexClass('CARD')} bg-background/95 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur supports-[backdrop-filter]:bg-background/80`
                : 'pb-4'
            }`}
          >
            {(() => {
              // 只根据prompt输入内容来禁用按钮，积分检查移到点击后
              let isDisabled = isGenerating;

              if (mode === 'simple') {
                // 描述模式：仅需 prompt 字段
                isDisabled = isDisabled || !simplePrompt.trim();
                if (requiresTrackUpload) {
                  isDisabled = isDisabled || !uploadCoverFile;
                }
              } else if (activeUploadIntent === "melody") {
                isDisabled = isDisabled || !songTitle.trim() || !melodyTags.trim() || !uploadCoverFile;
              } else if (activeUploadIntent === "vocal") {
                isDisabled = isDisabled || !songTitle.trim() || !styleText.trim() || !customLyrics.trim() || !uploadCoverFile;
              } else {
                // Track mode in custom: style and title are required; prompt required when instrumental is false
                isDisabled = isDisabled || !styleText.trim() || !songTitle.trim();
                if (!instrumentalMode) {
                  isDisabled = isDisabled || !customLyrics.trim();
                }
                if (requiresTrackUpload) {
                  isDisabled = isDisabled || !uploadCoverFile;
                }
                if (isExtendUploadMode) {
                  isDisabled = isDisabled || !isExtendContinueAtValid;
                }
              }

              const createActionLabel = mode === "custom"
                ? activeUploadIntent === "vocal"
                  ? t("featurePanel.createVocal")
                  : activeUploadIntent === "melody"
                    ? t("featurePanel.createMelody")
                    : t("featurePanel.create")
                : t("featurePanel.create");

              return (
                <div className="flex">
                  <button
                    onClick={() => {
                      handleGenerateWithAuth();
                    }}
                    disabled={isDisabled}
                    className="flex-1 h-12 px-4 text-base font-semibold bg-gradient-create text-white hover:opacity-90 transition-opacity rounded-2xl disabled:opacity-50"
                  >
                    <div className={`relative ${getZIndexClass('MAIN_CONTENT')} flex items-center justify-center`}>
                      {isGenerating ? (
                        <div className="flex items-center justify-center gap-2">
                          <Disc3 className="h-4 w-4 animate-spin" />
                          <span>{t("featurePanel.creating")}</span>
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
                          <span className="font-normal text-white/90">{"• " + t("featurePanel.costCredits", { credits: createCredits })}</span>
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
        fileName={readyFileName || readyFile?.name || t("featurePanel.audio")}
        status={uploadProgressStatus}
        errorMessage={uploadProgressError || undefined}
        audioUrl={readyAudioUrl}
        duration={readyDuration || 0}
        onSelect={(nextMode) => {
          if (!uploadAudioUploadUrl) {
            toast.error(t("toasts.uploadFailedSaveAudioAgain"));
            return;
          }
          if (uploadAudioUrl) {
            URL.revokeObjectURL(uploadAudioUrl);
          }
          const nextUrl = readyAudioUrl || (readyFile ? URL.createObjectURL(readyFile) : null);
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

      <PanelPricingModal open={isPricingOpen} onOpenChange={setIsPricingOpen} />
    </div>
  );
};
