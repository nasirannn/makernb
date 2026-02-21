import type { ExtendSourceTrack } from "@/types/extend-track-source";
import type { ReactNode } from "react";

export type StudioPanelMode = "simple" | "custom";
export type StudioMusicModel = "V4" | "V4_5" | "V4_5PLUS" | "V5";
export type StudioPersonaModel = "style_persona" | "voice_persona";
export type StudioUploadIntent = "track" | "vocal" | "melody";
export type StudioBpmMode = "slow" | "moderate" | "medium" | "";
export type StudioGenerationMode = "cover" | "extend" | "mashup" | "vocal" | "melody";

export interface GenerationStartOptions {
  uploadFile?: File | null;
  uploadUrl?: string | null;
  trackId?: string;
  audioId?: string;
  uploadUrlList?: string[];
  mode?: StudioGenerationMode;
  continueAt?: number;
  isPublished?: boolean;
  tags?: string;
  negativeTags?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
}

export interface FeatureCreatePanelProps {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  hasPlayer?: boolean;
  panelTitle?: string;
  panelTabs?: ReactNode;

  // Music generation states
  mode: StudioPanelMode;
  setMode: (mode: StudioPanelMode) => void;
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
  setIsPublished?: (published: boolean) => void;
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
  bpmMode: StudioBpmMode;
  setBpmMode: (mode: StudioBpmMode) => void;

  // Generation
  isGenerating: boolean;
  onGenerationStart?: (options?: GenerationStartOptions) => Promise<boolean> | void;
  onGenerateLyrics?: () => void;
  onWriteNextLyricLine?: () => void;
  isWritingNextLyricLine?: boolean;
  // Mobile
  forceVisibleOnMobile?: boolean;
  onCollapseToTracks?: () => void;
  onCollapse?: () => void;
  // AuthModal
  isAuthModalOpen?: boolean;
  setIsAuthModalOpen?: (open: boolean) => void;
  // Model selection
  selectedModel?: StudioMusicModel;
  setSelectedModel?: (model: StudioMusicModel) => void;
  selectedPersonaId?: string;
  setSelectedPersonaId?: (personaId: string) => void;
  selectedPersonaModel?: StudioPersonaModel;
  setSelectedPersonaModel?: (model: StudioPersonaModel) => void;
  showModeTabs?: boolean;
  lockModeSelector?: boolean;
  showUploadAction?: boolean;
  allowedUploadIntents?: StudioUploadIntent[];
  forcedUploadIntent?: StudioUploadIntent | null;
  forcedTrackUploadMode?: "cover" | "extend" | null;
  allowMashupAction?: boolean;
  extendSourceTracks?: ExtendSourceTrack[];
  pendingExtendSourceTrack?: ExtendSourceTrack | null;
  onPendingExtendSourceTrackConsumed?: () => void;
}

export type StudioFeaturePanelStateProps = Omit<
  FeatureCreatePanelProps,
  | "panelOpen"
  | "setPanelOpen"
  | "hasPlayer"
  | "showModeTabs"
  | "lockModeSelector"
  | "showUploadAction"
  | "allowedUploadIntents"
  | "forcedUploadIntent"
  | "forcedTrackUploadMode"
  | "allowMashupAction"
>;

export type StudioFeaturePanelProps = StudioFeaturePanelStateProps &
  Pick<FeatureCreatePanelProps, "panelOpen" | "setPanelOpen" | "hasPlayer">;
