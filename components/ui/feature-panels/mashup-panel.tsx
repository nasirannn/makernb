"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, Play, CreditCard, X, Pause, Disc3, Wand2, Trash2, Loader2 } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useFeaturePermissions } from '@/contexts/FeaturePermissionsContext';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Tooltip } from '@/components/ui/tooltip';
import { Switch } from "@/components/ui/switch";
import Image from 'next/image';
import { CLIENT_MUSIC_CREDITS, CLIENT_STYLE_BOOST_CREDITS, CLIENT_UPLOAD_AUDIO_CREDITS } from '@/lib/credits-config';
import { BUTTON_CLASSES, STYLES } from '@/lib/studio-constants';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { useStudioUploadWorkflow } from '@/hooks/use-studio-upload-workflow';
import type { UploadPanelMode } from '@/hooks/use-studio-upload-workflow';
import { useStudioPresetStyleGenerator } from "@/hooks/use-studio-preset-style-generator";
import { UploadProgressDialog } from "@/components/ui/upload-progress-dialog";
import { StylePresetQuickButtons } from "@/components/ui/feature-panels/shared/style-preset-quick-buttons";
import { formatDuration } from '@/lib/format-utils';
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { StudioCustomModeContent, StudioSimpleModeContent, type AudioUploadIntent } from "@/components/ui/feature-panels/mashup-panel-mode-content";
import { MusicPersonaDialogs } from "@/components/ui/music-persona-dialogs";
import { useStudioPersonaManager } from "@/hooks/use-studio-persona-manager";
import { ModelSelectionDialog, MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import { PanelPricingModal } from "@/components/ui/feature-panels/shared/panel-pricing-modal";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n/provider";
import { formatMusicModelLabel, isPremiumMusicModel } from '@/lib/music-model-utils';
import type { FeatureCreatePanelProps } from "@/types/studio-feature-panel";
import { getZIndexClass } from "@/lib/z-index";
import { getVocalGenderOptions } from '@/lib/vocal-gender-options';

const UPLOAD_WAVE_COLOR_LIGHT = "#d1d5db";
const UPLOAD_PROGRESS_COLOR_LIGHT = "hsl(262, 100%, 70%)";
const UPLOAD_CURSOR_COLOR_LIGHT = "hsl(262, 100%, 70%)";

const UPLOAD_ACTION_CREDITS: Record<AudioUploadIntent, number> = {
  track: CLIENT_UPLOAD_AUDIO_CREDITS.cover,
  vocal: CLIENT_UPLOAD_AUDIO_CREDITS.vocal,
  melody: CLIENT_UPLOAD_AUDIO_CREDITS.melody,
};

type MashupPreviewTrack = {
  file: File;
  fileName: string;
  audioUrl: string;
  duration: number;
  uploadUrl: string | null;
};

type MashupSelectionSlot = {
  file: File | null;
  fileName: string | null;
  duration: number;
};

type MashupPlaybackSlotCache = {
  file: File | null;
  audioUrl: string | null;
};

const createEmptyMashupSelectionSlot = (): MashupSelectionSlot => ({
  file: null,
  fileName: null,
  duration: 0,
});

const createEmptyMashupPlaybackSlotCache = (): MashupPlaybackSlotCache => ({
  file: null,
  audioUrl: null,
});


export type { FeatureCreatePanelProps } from "@/types/studio-feature-panel";

export const MashupPanel = (props: FeatureCreatePanelProps) => {
  const {
    panelOpen,
    forceVisibleOnMobile = false,
    hasPlayer = false,
    panelTitle,
    setIsAuthModalOpen,
    mode,
    setMode,
  simplePrompt,
  setSimplePrompt,
  customLyrics,
  setCustomLyrics,
    songTitle,
    setSongTitle,
    styleText,
    setStyleText,
    enhanceStyle,
    setEnhanceStyle,
    setBpm,
    vocalGender,
    setVocalGender,
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
    showModeTabs = false,
    lockModeSelector = true,
    showUploadAction = false,
    allowedUploadIntents = [],
    forcedUploadIntent = null,
    forcedTrackUploadMode = null,
    allowMashupAction = true,
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();
  const { resolvedTheme } = useTheme();
  const { t, locale } = useI18n();
  const resolvedPanelTitle = panelTitle ?? t("studioFeatures.mashup");
  const vocalGenderOptions = React.useMemo(() => getVocalGenderOptions(t), [t]);
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

  const { hasPermission } = useFeaturePermissions();
  const canUseV5Model = hasPermission('model_v5');
  const canUseMashup = hasPermission('upload_mashup_music');
  const canUsePersona = hasPermission('generate_persona');
  const canUseEnhanceStyle = hasPermission('boost_music_style');

  // Pricing dialog state
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = React.useState(false);
  const [mashupTracks, setMashupTracks] = React.useState<MashupPreviewTrack[]>([]);
  const [mashupSlots, setMashupSlots] = React.useState<[MashupSelectionSlot, MashupSelectionSlot]>([
    createEmptyMashupSelectionSlot(),
    createEmptyMashupSelectionSlot(),
  ]);
  const [mashupPlayingIndex, setMashupPlayingIndex] = React.useState<number | null>(null);
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
  const mashupSlotInputRefs = React.useRef<Array<HTMLInputElement | null>>([null, null]);
  const mashupAudioRefs = React.useRef<Array<HTMLAudioElement | null>>([null, null]);
  const mashupPlaybackSlotCacheRef = React.useRef<[MashupPlaybackSlotCache, MashupPlaybackSlotCache]>([
    createEmptyMashupPlaybackSlotCache(),
    createEmptyMashupPlaybackSlotCache(),
  ]);

  const clearMashupPreviewTracks = React.useCallback((tracks: MashupPreviewTrack[]) => {
    tracks.forEach((track) => {
      if (track.audioUrl) {
        URL.revokeObjectURL(track.audioUrl);
      }
    });
  }, []);

  const stopMashupPlayback = React.useCallback((resetTime = true) => {
    mashupAudioRefs.current.forEach((audio) => {
      if (!audio) return;
      audio.pause();
      if (resetTime) {
        try {
          audio.currentTime = 0;
        } catch {
          // ignore currentTime reset errors from detached media elements
        }
      }
    });
    setMashupPlayingIndex(null);
  }, []);

  const getOrCreateMashupAudio = React.useCallback((slotIndex: 0 | 1, audioUrl: string) => {
    const existing = mashupAudioRefs.current[slotIndex];
    if (existing && existing.src === audioUrl) {
      return existing;
    }

    if (existing) {
      const previousSrc = existing.src;
      existing.pause();
      try {
        existing.currentTime = 0;
      } catch {
        // ignore currentTime reset errors from detached media elements
      }
      existing.src = "";
      if (previousSrc.startsWith("blob:")) {
        URL.revokeObjectURL(previousSrc);
      }
    }

    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audio.onended = () => {
      setMashupPlayingIndex((prev) => (prev === slotIndex ? null : prev));
      try {
        audio.currentTime = 0;
      } catch {
        // ignore currentTime reset errors from detached media elements
      }
    };

    mashupAudioRefs.current[slotIndex] = audio;
    return audio;
  }, []);

  const clearMashupPlaybackSlotCache = React.useCallback(() => {
    mashupPlaybackSlotCacheRef.current.forEach((slotCache, index) => {
      if (slotCache.audioUrl) {
        URL.revokeObjectURL(slotCache.audioUrl);
      }
      mashupPlaybackSlotCacheRef.current[index] = createEmptyMashupPlaybackSlotCache();
    });
  }, []);

  const getMashupSlotPlaybackAudioUrl = React.useCallback((slotIndex: 0 | 1) => {
    const slot = mashupSlots[slotIndex];
    const slotFile = slot.file;
    if (!slotFile) {
      return null;
    }

    const currentSlotCache = mashupPlaybackSlotCacheRef.current[slotIndex];
    if (currentSlotCache.file === slotFile && currentSlotCache.audioUrl) {
      return currentSlotCache.audioUrl;
    }

    if (currentSlotCache.audioUrl) {
      URL.revokeObjectURL(currentSlotCache.audioUrl);
    }

    const slotAudioUrl = URL.createObjectURL(slotFile);
    mashupPlaybackSlotCacheRef.current[slotIndex] = {
      file: slotFile,
      audioUrl: slotAudioUrl,
    };
    return slotAudioUrl;
  }, [mashupSlots]);

  React.useEffect(() => {
    return () => {
      clearMashupPreviewTracks(mashupTracks);
    };
  }, [clearMashupPreviewTracks, mashupTracks]);

  React.useEffect(() => {
    stopMashupPlayback(true);
  }, [mashupTracks, stopMashupPlayback]);

  React.useEffect(() => {
    mashupPlaybackSlotCacheRef.current.forEach((slotCache, index) => {
      const nextFile = mashupSlots[index].file;
      if (!nextFile && slotCache.audioUrl) {
        URL.revokeObjectURL(slotCache.audioUrl);
        mashupPlaybackSlotCacheRef.current[index] = createEmptyMashupPlaybackSlotCache();
        return;
      }

      if (slotCache.file && slotCache.file !== nextFile && slotCache.audioUrl) {
        URL.revokeObjectURL(slotCache.audioUrl);
        mashupPlaybackSlotCacheRef.current[index] = createEmptyMashupPlaybackSlotCache();
      }
    });
  }, [mashupSlots]);

  React.useEffect(() => {
    const audioRefs = mashupAudioRefs.current;
    return () => {
      audioRefs.forEach((audio, index) => {
        if (!audio) return;
        audio.pause();
        audio.src = "";
        audioRefs[index] = null;
      });
      clearMashupPlaybackSlotCache();
    };
  }, [clearMashupPlaybackSlotCache]);

  const clearMashupSelection = React.useCallback(() => {
    stopMashupPlayback(true);
    clearMashupPlaybackSlotCache();
    setMashupTracks((prev) => {
      clearMashupPreviewTracks(prev);
      return [];
    });
    setMashupSlots([
      createEmptyMashupSelectionSlot(),
      createEmptyMashupSelectionSlot(),
    ]);
    mashupSlotInputRefs.current.forEach((input) => {
      if (input) {
        input.value = "";
      }
    });
  }, [clearMashupPlaybackSlotCache, clearMashupPreviewTracks, stopMashupPlayback]);

  const readAudioDuration = React.useCallback((file: File) => (
    new Promise<number>((resolve) => {
      const tempUrl = URL.createObjectURL(file);
      const audio = new Audio();

      const cleanup = () => {
        audio.src = "";
        URL.revokeObjectURL(tempUrl);
      };

      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
        cleanup();
        resolve(duration);
      };
      audio.onerror = () => {
        cleanup();
        resolve(0);
      };
      audio.src = tempUrl;
    })
  ), []);

  const syncMashupTracksFromSlots = React.useCallback((slots: [MashupSelectionSlot, MashupSelectionSlot]) => {
    const hasBothSlots = slots.every((slot) => slot.file);

    if (!hasBothSlots) {
      setMashupTracks((prev) => {
      if (prev.length === 0) return prev;
      clearMashupPreviewTracks(prev);
      return [];
    });
      stopMashupPlayback(true);
      return;
    }

    const nextTracks: MashupPreviewTrack[] = slots.map((slot, index) => {
      const file = slot.file!;
      const fallbackName = file.name.replace(/\.[^/.]+$/, "") || t("featurePanel.mashupAudioWithIndex", { index: index + 1 });
      return {
        file,
        fileName: slot.fileName || fallbackName,
        audioUrl: URL.createObjectURL(file),
        duration: slot.duration,
        uploadUrl: null,
      };
    });

    setMashupTracks((prev) => {
      clearMashupPreviewTracks(prev);
      return nextTracks;
    });
    stopMashupPlayback(true);
  }, [clearMashupPreviewTracks, stopMashupPlayback, t]);

  React.useEffect(() => {
    syncMashupTracksFromSlots(mashupSlots);
  }, [mashupSlots, syncMashupTracksFromSlots]);

  React.useEffect(() => {
    if (canUseMashup) return;
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
    if (isPremiumMusicModel(model) && !canUseV5Model) {
      setIsPricingOpen(true);
      return;
    }

    updateSelectedModel(model, { userInitiated: true });
  }, [canUseV5Model, updateSelectedModel]); // 故意移除所有状态依赖，避免循环更新 - 函数内部已经有最新的状态引用

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
      if (!trimmedCustomLyrics) {
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
        toast.error(message);
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

  const openMashupSlotPicker = React.useCallback((slotIndex: 0 | 1) => {
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
    mashupSlotInputRefs.current[slotIndex]?.click();
  }, [allowMashupAction, user, setIsAuthModalOpen, canUseMashup, uploadCoverFile, t]);

  const handleMashupSlotPlayPause = React.useCallback(async (slotIndex: 0 | 1) => {
    const slotAudio = mashupAudioRefs.current[slotIndex];
    if (mashupPlayingIndex === slotIndex && slotAudio && !slotAudio.paused) {
      slotAudio.pause();
      setMashupPlayingIndex(null);
      return;
    }

    const slotAudioUrl = getMashupSlotPlaybackAudioUrl(slotIndex);
    if (!slotAudioUrl) return;

    const targetAudio = getOrCreateMashupAudio(slotIndex, slotAudioUrl);

    mashupAudioRefs.current.forEach((audio, index) => {
      if (!audio || index === slotIndex) return;
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore currentTime reset errors from detached media elements
      }
    });

    if (mashupPlayingIndex === slotIndex && !targetAudio.paused) {
      targetAudio.pause();
      setMashupPlayingIndex(null);
      return;
    }

    try {
      await targetAudio.play();
      setMashupPlayingIndex(slotIndex);
    } catch (error) {
      console.error("Failed to play mashup preview audio:", error);
      setMashupPlayingIndex(null);
      toast.error(t("toasts.unableToPlaySelectedAudio"));
    }
  }, [getMashupSlotPlaybackAudioUrl, getOrCreateMashupAudio, mashupPlayingIndex, t]);

  const handleMashupSlotFileChange = React.useCallback(async (
    slotIndex: 0 | 1,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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

    const duration = await readAudioDuration(file);
    const fileName = file.name.replace(/\.[^/.]+$/, "") || t("featurePanel.mashupAudioWithIndex", { index: slotIndex + 1 });

    setMashupSlots((prev) => {
      const next: [MashupSelectionSlot, MashupSelectionSlot] = [...prev] as [MashupSelectionSlot, MashupSelectionSlot];
      next[slotIndex] = {
        file,
        fileName,
        duration,
      };
      return next;
    });
  }, [maxDirectUploadBytes, readAudioDuration, t]);

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
                className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary transition hover:text-primary/80 hover:bg-primary/15 p-0"
                disabled={!uploadCoverFile || isUploadAudioAnalyzing}
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
                    {uploadCoverFileName || uploadCoverFile.name}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-primary/90">
                    {activeUploadIntent === "track"
                      ? (uploadAudioMode === "extend" ? t("featurePanel.extend") : t("featurePanel.cover"))
                      : t("featurePanel." + activeUploadIntent)}
                  </span>
                  <button
                    type="button"
                    onClick={clearUploadAndResetIntent}
                    className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors p-0"
                    title={t("featurePanel.remove")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground leading-none">
                    {isUploadAudioAnalyzing
                      ? t("featurePanel.analyzingAudio")
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
                  />
                </div>
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
    _expanded: StyleCategory | null,
    _setExpanded: (value: StyleCategory | null) => void,
    _categories?: Array<StyleCategory>,
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
    if (!options?.usePromptTemplateOnGenre) {
      return null;
    }

    return (
      <StylePresetQuickButtons
        text={text}
        setText={setText}
        isGeneratingGenrePrompt={isGeneratingGenrePrompt}
        pendingGenreId={pendingGenreId}
        onGenerateGenrePrompt={handleGenerateGenrePrompt}
        horizontalScroll={options.horizontalScroll}
      />
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
                setBpm([60]);
                setBpmMode('');
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

      <section className="studio-panel-card rounded-2xl p-3">
        <h3 className="text-xs md:text-sm font-semibold mb-3 md:mb-4 flex items-center gap-2">
          Negative Tags
        </h3>
        <div>
          <Textarea
            placeholder={t("featurePanel.describeWhatToAvoidInArrangement")}
            value={melodyNegativeTags}
            onChange={(event) => setMelodyNegativeTags(event.target.value)}
            maxLength={styleTextMaxLength}
            className="min-h-[120px] resize-none pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
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
                          <span>{formatMusicModelLabel(selectedModel) || "V4"}</span>
                        </button>
                        <ModelSelectionDialog
                          open={isModelDialogOpen}
                          onOpenChange={setIsModelDialogOpen}
                          selectedModel={selectedModel}
                          onSelectModel={handleModelSelect}
                          options={modelOptions}
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
                  {t("featurePanel.mashupDescription")}
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
            <input
              ref={(node) => {
                mashupSlotInputRefs.current[0] = node;
              }}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                void handleMashupSlotFileChange(0, event);
              }}
            />
            <input
              ref={(node) => {
                mashupSlotInputRefs.current[1] = node;
              }}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                void handleMashupSlotFileChange(1, event);
              }}
            />
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
            setBpm([60]);
            setBpmMode('');
          }}
          uploadCoverFile={uploadCoverFile}
          uploadAudioPreview={uploadAudioPreview}
        />
      ) : (
        <StudioCustomModeContent
          uploadCoverFile={uploadCoverFile}
          uploadAudioPreview={uploadAudioPreview}
          uploadIntent={audioUploadIntent}
          preferTrackUploadCard={isExtendUploadMode}
          onAddTrack={handleAddTrackAudioClick}
          onAddVocal={handleAddVocalAudioClick}
          onAddMelody={handleAddMelodyAudioClick}
          onClearUploadIntent={forcedUploadIntent === undefined ? clearUploadIntentSelection : undefined}
          showMashupAudioPickers={allowMashupAction}
          onSelectMashupAudioOne={() => openMashupSlotPicker(0)}
          onSelectMashupAudioTwo={() => openMashupSlotPicker(1)}
          mashupAudioOneName={mashupSlots[0].fileName}
          mashupAudioTwoName={mashupSlots[1].fileName}
          mashupAudioOneType={mashupSlots[0].file?.type || null}
          mashupAudioTwoType={mashupSlots[1].file?.type || null}
          mashupAudioOneSizeBytes={mashupSlots[0].file?.size ?? null}
          mashupAudioTwoSizeBytes={mashupSlots[1].file?.size ?? null}
          mashupAudioOneDuration={mashupSlots[0].duration}
          mashupAudioTwoDuration={mashupSlots[1].duration}
          mashupPlayingIndex={mashupPlayingIndex}
          onPlayMashupAudioOne={() => void handleMashupSlotPlayPause(0)}
          onPlayMashupAudioTwo={() => void handleMashupSlotPlayPause(1)}
          onOpenPersonaDialog={handleOpenPersonaDialog}
          showAddAudioActions={showUploadAction}
          allowedUploadIntents={allowedUploadIntents}
          hasUploadPreview={!!uploadCoverFile || mashupTracks.length === 2}
          hidePersonaAction={allowMashupAction || mashupTracks.length === 2 || (audioUploadIntent !== null && activeUploadIntent !== "track")}
          selectedPersonaName={selectedPersona?.name?.trim() || null}
          selectedPersonaDescription={selectedPersona?.description?.trim() || null}
          selectedPersonaId={selectedPersonaId}
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
          vocalGenders={vocalGenderOptions}
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
                // Track mode in custom: style, title, and lyrics are required
                isDisabled = isDisabled || !styleText.trim() || !songTitle.trim() || !customLyrics.trim();
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

      <PanelPricingModal open={isPricingOpen} onOpenChange={setIsPricingOpen} />
    </div>
  );
};
