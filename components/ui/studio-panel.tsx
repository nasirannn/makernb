"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Music, RotateCcw, ChevronRight, Wand2, Play, CreditCard, UploadCloud, X, Check, Triangle, Pause, Trash2 } from "lucide-react";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { CLIENT_EXTEND_MUSIC_CREDITS, CLIENT_MUSIC_CREDITS, CLIENT_UPLOAD_AUDIO_CREDITS } from '@/lib/credits-config';
import { getInstrumentIcon, getInstrumentAudio, getDrumKitIcon, getDrumKitAudio } from '@/lib/music-resources';
import { replaceTextInStyle, updateStatesFromTextarea, getRandomBpm } from '@/lib/studio-utils';
import { TEMPO_KEYWORDS, BUTTON_CLASSES, STYLES } from '@/lib/studio-constants';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { UploadProgressDialog } from "@/components/ui/upload-progress-dialog";
import { formatDuration } from '@/lib/format-utils';
import { WaveformPlayer } from "@/components/ui/waveform-player";
import { EditAudioDialog } from "@/features/music-upload/components/edit-audio-dialog";
import { MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from '@/lib/supabase';
import { PricingSection } from '@/components/layout/sections/pricing';

// Extract options from musicOptions
const { genres, vibes, grooveTypes, leadInstruments, drumKits, bassTones, vocalGenders, harmonyPalettes } = musicOptions;
const HERO_GENRE_ICONS: Record<string, string> = {
  "new-jack-swing": "New Jack Swing Icon.webp",
  "neo-soul": "Neo-Soul Icon.webp",
  "quiet-storm": "Quiet Storm Icon.webp",
  "hip-hop-soul": "Hip-Hop Soul Icon.webp",
};

const SIMPLE_PROMPT_CONFIG: Record<
  string,
  {
    blocks: {
      style_anchor: string[];
      rhythm_groove: string[];
      instrumentation: string[];
      vocals: string[];
      mood: string[];
    };
  }
> = {
  "new-jack-swing": {
    blocks: {
      style_anchor: [
        "Early 90s New Jack Swing R&B track",
        "Classic New Jack Swing style R&B song",
        "Upbeat early-90s New Jack Swing inspired track",
      ],
      rhythm_groove: [
        "bouncy swing rhythm with tight drum machine groove",
        "energetic, danceable groove with strong rhythmic bounce",
        "swinging, upbeat rhythm designed for the dance floor",
      ],
      instrumentation: [
        "bright synth stabs and punchy electronic bass",
        "classic drum machine sounds with glossy synth textures",
        "sharp keyboard hits and funky electronic instrumentation",
      ],
      vocals: [
        "confident soulful lead vocals",
        "energetic R&B vocals with attitude",
        "bright and expressive lead vocal performance",
      ],
      mood: [
        "fun, youthful, and high-energy mood",
        "playful and upbeat atmosphere",
        "feel-good, dance-driven vibe",
      ],
    },
  },
  "hip-hop-soul": {
    blocks: {
      style_anchor: [
        "Early 90s hip-hop soul R&B track",
        "Classic hip-hop soul style R&B song",
        "90s hip-hop influenced R&B track",
      ],
      rhythm_groove: [
        "heavy hip-hop inspired groove with deep pocket",
        "laid-back but hard-hitting hip-hop rhythm",
        "solid, grounded beat with street influence",
      ],
      instrumentation: [
        "deep bass, sampled-style drums, and minimal instrumentation",
        "warm keys layered over a hip-hop rhythm foundation",
        "raw, groove-focused instrumentation with strong low-end",
      ],
      vocals: [
        "powerful soulful lead vocals with emotional weight",
        "raw and expressive R&B vocal delivery",
        "heartfelt vocals with gospel-influenced phrasing",
      ],
      mood: [
        "emotional, honest, and street-rooted mood",
        "deeply personal and soulful atmosphere",
        "intense and emotionally grounded vibe",
      ],
    },
  },
  "neo-soul": {
    blocks: {
      style_anchor: [
        "Late 90s neo-soul R&B track",
        "Classic late-90s neo-soul inspired song",
        "Warm 90s neo-soul style R&B track",
      ],
      rhythm_groove: [
        "loose, human-played rhythm with relaxed pocket",
        "laid-back groove with natural timing",
        "subtle swing and organic rhythmic feel",
      ],
      instrumentation: [
        "live bass and Rhodes-driven arrangement",
        "warm analog keys with organic rhythm section",
        "soulful live instrumentation with vintage tone",
      ],
      vocals: [
        "intimate and smooth soulful lead vocals",
        "warm, close-mic neo-soul vocal delivery",
        "expressive yet restrained soulful singing",
      ],
      mood: [
        "introspective and reflective late-night mood",
        "warm, thoughtful, and personal atmosphere",
        "deeply intimate and relaxed vibe",
      ],
    },
  },
  "quiet-storm": {
    blocks: {
      style_anchor: [
        "90s quiet storm R&B ballad",
        "Classic 90s quiet storm style R&B song",
        "Smooth 90s quiet storm inspired track",
      ],
      rhythm_groove: [
        "slow, smooth rhythm with minimal movement",
        "gentle, restrained groove supporting the vocals",
        "soft and steady tempo with subtle pulse",
      ],
      instrumentation: [
        "lush pads and soft keyboard textures",
        "smooth keys and understated instrumentation",
        "polished, atmospheric arrangement with gentle tones",
      ],
      vocals: [
        "vocals front and center with warm, emotional delivery",
        "soft and expressive soulful lead vocals",
        "smooth, controlled vocal performance with intimacy",
      ],
      mood: [
        "romantic, calm, and intimate night-time mood",
        "warm, soothing, and emotionally safe atmosphere",
        "late-night, candle-lit vibe",
      ],
    },
  },
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
    selectedModel = 'V4',
    setSelectedModel,
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();
  const userSelectedModelRef = React.useRef(false);
  const simplePromptMaxLength = 400;
  const customPromptMaxLength = selectedModel === 'V4_5ALL' ? 5000 : 5000;
  const styleTextMaxLength = selectedModel === 'V4_5ALL' ? 1000 : 1000;
  const maxUploadBytes = 40 * 1024 * 1024;
  const maxUploadDurationSeconds = selectedModel === 'V4_5ALL' ? 60 : 8 * 60;
  const isCustomMode = mode === "custom";

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

  type UploadPanelMode = "simple" | "custom";
  type UploadAudioMode = "cover" | "extend";
  type UploadState = {
    coverFile: File | null;
    coverFileName: string | null;
    audioUrl: string | null;
    audioDuration: number | null;
    audioTotalDuration: number | null;
    audioCurrentTime: number;
    isPlaying: boolean;
    isAnalyzing: boolean;
    audioMode: UploadAudioMode;
    audioUploadUrl: string | null;
    extendStartTime: number;
    readyFile: File | null;
    readyFileName: string | null;
    readyDuration: number | null;
    readyAudioUrl: string | null;
    progressOpen: boolean;
    progressStatus: "uploading" | "error" | "ready";
    progressError: string | null;
  };
  const createUploadState = (): UploadState => ({
    coverFile: null,
    coverFileName: null,
    audioUrl: null,
    audioDuration: null,
    audioTotalDuration: null,
    audioCurrentTime: 0,
    isPlaying: false,
    isAnalyzing: false,
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
  const [uploadStateByMode, setUploadStateByMode] = React.useState<Record<UploadPanelMode, UploadState>>(() => ({
    simple: createUploadState(),
    custom: createUploadState(),
  }));
  const [pendingAudioMode, setPendingAudioMode] = React.useState<UploadPanelMode>("simple");
  const uploadFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isEditAudioOpen, setIsEditAudioOpen] = React.useState(false);
  const [pendingAudioFile, setPendingAudioFile] = React.useState<File | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = React.useState<string | null>(null);
  const updateUploadState = React.useCallback((targetMode: UploadPanelMode, patch: Partial<UploadState>) => {
    setUploadStateByMode((prev) => ({
      ...prev,
      [targetMode]: {
        ...prev[targetMode],
        ...patch,
      },
    }));
  }, []);
  const updateCurrentUploadState = React.useCallback((patch: Partial<UploadState>) => {
    setUploadStateByMode((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        ...patch,
      },
    }));
  }, [mode]);
  const currentUploadState = uploadStateByMode[mode];
  const pendingUploadState = uploadStateByMode[pendingAudioMode];
  const {
    coverFile: uploadCoverFile,
    coverFileName: uploadCoverFileName,
    audioUrl: uploadAudioUrl,
    audioDuration: uploadAudioDuration,
    audioTotalDuration: uploadAudioTotalDuration,
    audioCurrentTime: uploadAudioCurrentTime,
    isPlaying: isUploadAudioPlaying,
    isAnalyzing: isUploadAudioAnalyzing,
    audioMode: uploadAudioMode,
    audioUploadUrl: uploadAudioUploadUrl,
    extendStartTime: uploadExtendStartTime,
    readyFile,
    readyFileName,
    readyDuration,
    readyAudioUrl,
    progressOpen: isUploadProgressOpen,
    progressStatus: uploadProgressStatus,
    progressError: uploadProgressError,
  } = currentUploadState;
  const createCredits = uploadCoverFile
    ? CLIENT_UPLOAD_AUDIO_CREDITS[uploadAudioMode]
    : (mode === "custom" ? CLIENT_MUSIC_CREDITS.custom : CLIENT_MUSIC_CREDITS.simple);

  const clearUploadCoverFile = React.useCallback(() => {
    if (readyAudioUrl) {
      URL.revokeObjectURL(readyAudioUrl);
    }
    if (uploadAudioUrl) {
      URL.revokeObjectURL(uploadAudioUrl);
    }
    if (uploadAudioRef.current) {
      uploadAudioRef.current.pause();
      uploadAudioRef.current.src = '';
      uploadAudioRef.current = null;
    }
    updateCurrentUploadState({
      coverFile: null,
      coverFileName: null,
      audioDuration: null,
      audioTotalDuration: null,
      audioCurrentTime: 0,
      isPlaying: false,
      isAnalyzing: false,
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
      audioUrl: null,
    });
  }, [readyAudioUrl, uploadAudioUrl, updateCurrentUploadState]);


  React.useEffect(() => {
    if (!uploadAudioUrl) {
      updateCurrentUploadState({
        isPlaying: false,
        audioCurrentTime: 0,
      });
    }
  }, [uploadAudioUrl, updateCurrentUploadState]);

  React.useEffect(() => {
    if (uploadAudioDuration && uploadExtendStartTime > uploadAudioDuration) {
      updateCurrentUploadState({ extendStartTime: uploadAudioDuration });
    }
  }, [uploadAudioDuration, uploadExtendStartTime, updateCurrentUploadState]);

  const updateExtendStartTime = React.useCallback((value: number) => {
    const maxValue = uploadAudioDuration || 0;
    const clamped = Math.max(0, Math.min(value, maxValue));
    updateCurrentUploadState({ extendStartTime: clamped });
    if (uploadAudioRef.current) {
      uploadAudioRef.current.currentTime = clamped;
      updateCurrentUploadState({ audioCurrentTime: clamped });
    }
  }, [uploadAudioDuration, updateCurrentUploadState]);

  const resetPendingAudio = React.useCallback(() => {
    if (pendingAudioUrl) {
      URL.revokeObjectURL(pendingAudioUrl);
    }
    setPendingAudioFile(null);
    setPendingAudioUrl(null);
    setIsEditAudioOpen(false);
  }, [pendingAudioUrl]);

  const uploadAudioToServer = React.useCallback(async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Authentication expired. Please sign in again.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/music/upload-file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Upload failed. Please try again.");
    }
    return result.data?.downloadUrl as string;
  }, []);

  const handleModelSelect = React.useCallback((model: MusicModel) => {
    const selectedOption = modelOptions.find((option) => option.value === model);

    if (!hasSubscription && selectedOption?.requiresSubscription) {
      setIsPricingOpen(true);
      return;
    }

    updateSelectedModel(model, { userInitiated: true });
  }, [hasSubscription, updateSelectedModel]);

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

    const requiredCredits = mode === 'custom' 
      ? CLIENT_MUSIC_CREDITS.custom
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


  const handlePromptAddAudioClick = React.useCallback(() => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }
    uploadFileInputRef.current?.click();
  }, [user, setIsAuthModalOpen]);

  const handleCoverFileSelected = React.useCallback((file: File) => {
    if (pendingAudioUrl) {
      URL.revokeObjectURL(pendingAudioUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setPendingAudioFile(file);
    setPendingAudioUrl(nextUrl);
    setPendingAudioMode(mode);
    updateCurrentUploadState({
      audioTotalDuration: null,
      readyFile: null,
      readyFileName: null,
      readyDuration: null,
      coverFileName: null,
      audioUploadUrl: null,
    });
    if (readyAudioUrl) {
      URL.revokeObjectURL(readyAudioUrl);
      updateCurrentUploadState({ readyAudioUrl: null });
    }
    setIsEditAudioOpen(true);
  }, [pendingAudioUrl, readyAudioUrl, mode, updateCurrentUploadState]);

  const handlePromptFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (file.size > maxUploadBytes) {
      toast.error("File size must be under 40MB.");
      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("audio/")) {
      toast.error("Unsupported file type. Please upload audio.");
      event.target.value = "";
      return;
    }

    handleCoverFileSelected(file);
    event.target.value = "";
  }, [handleCoverFileSelected, maxUploadBytes]);

  React.useEffect(() => {
    if (!uploadAudioUrl) {
      if (uploadAudioRef.current) {
        uploadAudioRef.current.pause();
        uploadAudioRef.current.src = '';
        uploadAudioRef.current = null;
      }
      updateCurrentUploadState({
        isPlaying: false,
        audioCurrentTime: 0,
      });
      return;
    }

    const audio = new Audio(uploadAudioUrl);
    audio.preload = 'metadata';
    uploadAudioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        updateCurrentUploadState({
          audioDuration: audio.duration,
          audioTotalDuration: uploadAudioTotalDuration ?? audio.duration,
        });
      }
      updateCurrentUploadState({ isAnalyzing: false });
    };

    const handleTimeUpdate = () => {
      updateCurrentUploadState({ audioCurrentTime: audio.currentTime });
    };

    const handlePlay = () => {
      updateCurrentUploadState({ isPlaying: true });
    };

    const handlePause = () => {
      updateCurrentUploadState({ isPlaying: false });
    };

    const handleEnded = () => {
      updateCurrentUploadState({ isPlaying: false, audioCurrentTime: 0 });
      audio.currentTime = 0;
    };

    const handleError = () => {
      updateCurrentUploadState({ isAnalyzing: false, isPlaying: false });
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      if (uploadAudioRef.current === audio) {
        uploadAudioRef.current = null;
      }
    };
  }, [uploadAudioUrl, updateCurrentUploadState, uploadAudioTotalDuration]);

  const handleUploadAudioPlayPause = React.useCallback(async () => {
    const audio = uploadAudioRef.current;
    if (!audio) return;
    if (isUploadAudioAnalyzing) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.error('Failed to play uploaded audio:', error);
      updateCurrentUploadState({ isPlaying: false });
    }
  }, [isUploadAudioAnalyzing, updateCurrentUploadState]);

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

    const buildSimplePrompt = (genreId: string) => {
      const config = SIMPLE_PROMPT_CONFIG[genreId];
      if (!config) return "";
      const pick = (items: string[]) =>
        items[Math.floor(Math.random() * items.length)];
      const { blocks } = config;
      return [
        pick(blocks.style_anchor),
        pick(blocks.rhythm_groove),
        pick(blocks.instrumentation),
        pick(blocks.vocals),
        pick(blocks.mood),
      ].join(", ") + ".";
    };

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
              <div className="flex flex-wrap gap-2">
                {genres.map((genre: any) => {
                  const isSelected = options?.useSelectedGenre
                    ? selectedGenre === genre.id
                    : hasTag(text, genre.value);
                  const iconName = HERO_GENRE_ICONS[genre.id];
                  return (
                    <button
                      key={genre.id}
                      onClick={() => {
                        setSelectedGenre(genre.id);
                        if (options?.usePromptTemplateOnGenre && shouldUpdateText("genre")) {
                          setText(buildSimplePrompt(genre.id));
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
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 dark:border-transparent text-xs font-semibold transition-all duration-200 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground '
                          : 'bg-slate-50 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/15'
                      }`}
                    >
                      {iconName && (
                        <Image
                          src={`/hero/${encodeURIComponent(iconName)}`}
                          alt=""
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5 opacity-90"
                          aria-hidden="true"
                        />
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
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          Music Style
        </h3>
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
          className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-full transition-all duration-200 flex items-center gap-1"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-xs font-medium">Reset</span>
        </Button>
      </div>

      <div className="mb-4 md:mb-4">
        <div className="relative">
          <Textarea
            placeholder="Enter style of music"
            value={styleText}
            onChange={(e) => {
              const newValue = e.target.value;
              setStyleText(newValue);
              handleUpdateStatesFromTextarea(newValue);
            }}
            maxLength={styleTextMaxLength}
            className="min-h-[180px] md:min-h-[200px] resize-none pr-16 pb-6 border-0 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
            {styleText.length}/{styleTextMaxLength}
          </div>
        </div>
      </div>

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
          }
        )}

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
        panelOpen ? (forceVisibleOnMobile ? 'w-full md:w-[28rem]' : 'w-[28rem]') : 'w-0'
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
                className="studio-panel-card inline-flex items-center rounded-full p-1 gap-1 flex-shrink-0"
              >
                <button
                  onClick={() => setMode("simple")}
                  title="Create random R&B songs with polished production in 90s style. Simple and fast setup."
                  className={`px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    mode === "simple"
                      ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  Simple
                </button>
                <button
                  onClick={() => setMode("custom")}
                  title="Fine-tune every aspect of your track with detailed controls for genre, instruments, and style."
                  className={`px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    mode === "custom"
                      ? "bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                  }`}
                >
                  Custom
                </button>
              </div>

              {/* Model Selection Menu */}
              <DropdownMenu open={isModelMenuOpen} onOpenChange={setIsModelMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group studio-panel-card px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5"
                    title="Click to change model version"
                  >
                    <span>{modelOptions.find(opt => opt.value === selectedModel)?.label || 'v4'}</span>
                    <Triangle
                      className={`w-2 h-2 fill-current text-foreground/70 transition-colors transition-transform group-hover:text-accent-foreground ${isModelMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 p-1.5 rounded-2xl app-card">
                  {modelOptions.map((option, index) => {
                    const isSelected = option.value === selectedModel;
                    const creditsPerTrack = CLIENT_EXTEND_MUSIC_CREDITS[option.value];
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
                          <span className="text-[11px] text-muted-foreground">
                            {creditsPerTrack} credits per track
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </DropdownMenuItem>
                      </React.Fragment>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Main Content */}
          <div
            className={`flex-1 ${forceVisibleOnMobile ? '' : 'overflow-y-auto scrollbar-hidden'} px-0 ${forceVisibleOnMobile ? 'pb-20' : 'pb-6'} md:pb-6`}
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
        <>
          {/* Simple Mode Content - 流式布局 */}
                <div className="space-y-5 md:space-y-6 pt-2 md:pt-3">
            {/* Custom Prompt Section */}
            <section className="studio-panel-card rounded-2xl p-3">
              <div className="mb-3 md:mb-4 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  Prompt
                </h3>
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
              </div>
              <div className="space-y-3">
                <div className="relative">
                  <Textarea
                    placeholder={`Describe your song idea`}
                    value={simplePrompt}
                    onChange={(e) => setSimplePrompt(e.target.value)}
                    maxLength={simplePromptMaxLength}
                    className="min-h-[180px] md:min-h-[200px] resize-none pr-16 pb-4 border-0 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                {renderStyleQuickButtons(
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
                  }
                )}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {simplePrompt.length}/{simplePromptMaxLength}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePromptAddAudioClick}
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title="Add audio"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      <span>Add Audio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title="Clear"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>
                <div className="pt-2 pb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Classic Instruments Preview
                </div>
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                  {leadInstruments.map((instrument: any) => (
                    <div
                      key={`instrument-${instrument.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setLeadInstrument([instrument.id]);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setLeadInstrument([instrument.id]);
                        }
                      }}
                      className="group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-[#0c0c16] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15"
                    >
                      {getInstrumentIcon(instrument.id) && (
                        <Image
                          src={getInstrumentIcon(instrument.id)}
                          alt={instrument.name}
                          width={16}
                          height={16}
                          className="h-7 w-7"
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
                  ))}
                  {drumKits.map((kit: any) => (
                    <div
                      key={`drum-${kit.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setDrumKit(kit.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDrumKit(kit.id);
                        }
                      }}
                      className="group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-[#0c0c16] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15"
                    >
                      {getDrumKitIcon(kit.id) && (
                        <Image
                          src={getDrumKitIcon(kit.id)}
                          alt={kit.name}
                          width={16}
                          height={16}
                          className="h-7 w-7"
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
                  ))}
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
      ) : (
        <>
          {/* Custom Mode Content - 流式布局 */}
          <div className="space-y-5 md:space-y-6 pt-2 md:pt-3">
            <section>
              {uploadCoverFile ? (
                uploadAudioPreview
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="studio-panel-card h-12 w-full justify-center rounded-2xl text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors"
                  title="Add audio"
                  onClick={handlePromptAddAudioClick}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span className="text-sm font-semibold tracking-tight">Add Audio</span>
                </Button>
              )}
            </section>

            {/* Lyrics Section */}
            {!instrumentalMode ? (
              <section className="studio-panel-card rounded-2xl px-3 py-4">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    Lyrics
                  </h3>
                  {/* Instrumental Switch */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={instrumentalMode}
                      onCheckedChange={setInstrumentalMode}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Instrumental</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                   <Textarea
                      placeholder="Write your song lyrics here..."
                      value={customLyrics}
                      onChange={(e) => setCustomLyrics(e.target.value)}
                      maxLength={customPromptMaxLength}
                    className="min-h-[136px] md:min-h-[160px] resize-none pl-4 pt-3 pr-16 pb-6 border-0 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {/* Character count - Inside textarea, bottom right */}
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {customLyrics.length}/{customPromptMaxLength}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 rounded-full text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
                      title="Generate lyrics with AI"
                      onClick={onGenerateLyrics}
                    >
                      <Wand2 className="h-3 w-3" />
                      <span className="text-xs font-medium">Auto Generate</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/30 opacity-70 hover:opacity-100 transition-all duration-200"
                      onClick={() => setCustomLyrics("")}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="text-xs font-medium">Clear</span>
                    </Button>
                  </div>
                </div>
              </section>
            ) : (
              /* Instrumental Mode Status Display */
              <section className="studio-panel-card rounded-2xl px-3 py-4">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    Lyrics
                  </h3>
                  {/* Instrumental Switch */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={instrumentalMode}
                      onCheckedChange={setInstrumentalMode}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Instrumental</span>
                  </div>
                </div>
                {/* Instrumental Status Display */}
                <div className="flex items-center justify-center py-4 px-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-sm font-medium">Instrumental Mode Active,no need to write lyrics</span>
                  </div>
                </div>
              </section>
            )}

            {/* Vocal Gender Section - Only show when not in instrumental mode */}
            {!instrumentalMode && (
              <section className="studio-panel-card rounded-2xl p-3 flex items-center justify-between">
                <Label className="text-sm font-medium text-foreground">Vocal Gender</Label>
                <div className="studio-panel-card inline-flex items-center rounded-full p-1 gap-1">
                  <button
                    onClick={() => setVocalGender('random')}
                    className={`px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      vocalGender === 'random'
                        ? 'bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                        : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    Random
                  </button>
                  {vocalGenders.map((gender: any) => (
                    <button
                      key={gender.id}
                      onClick={() => setVocalGender(gender.id)}
                      className={`px-4 py-2 text-xs md:text-sm font-semibold transition-colors duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        vocalGender === gender.id
                          ? 'bg-primary text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
                          : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
                    }`}
                    >
                      {gender.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {styleSection}

            {/* Song Title Section */}
            <section className="studio-panel-card rounded-2xl p-3">
              <h3 className="text-lg font-semibold tracking-tight mb-3 md:mb-4 flex items-center gap-2">
                Title
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    placeholder="Enter your song title..."
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    maxLength={80}
                    className="pr-16 h-12 text-base border-0 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="absolute top-1/2 right-2 transform -translate-y-1/2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    {songTitle.length}/80
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}



          </div>

          {/* Floating Generate Button - Bottom */}
          <div className="flex-shrink-0 px-0 pt-3 pb-4">
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
                      ) : (
                        <span>Create</span>
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
        modelLabel={modelOptions.find((option) => option.value === selectedModel)?.label || selectedModel}
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
          setIsEditAudioOpen(false);
          if (pendingAudioUrl) {
            URL.revokeObjectURL(pendingAudioUrl);
          }
          setPendingAudioFile(null);
          setPendingAudioUrl(null);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setIsPricingOpen(false)}>
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
