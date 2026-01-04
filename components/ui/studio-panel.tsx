"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Music, RotateCcw, ChevronRight, Wand2, Play, CreditCard, UploadCloud, X, Check } from "lucide-react";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { CLIENT_MUSIC_CREDITS } from '@/lib/credits-config';
import { getInstrumentIcon, getInstrumentAudio, getDrumKitIcon, getDrumKitAudio } from '@/lib/music-resources';
import { replaceTextInStyle, updateStatesFromTextarea, getRandomBpm } from '@/lib/studio-utils';
import { TEMPO_KEYWORDS, BUTTON_CLASSES, STYLES } from '@/lib/studio-constants';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { UploadAudioDialog } from '@/components/ui/upload-audio-dialog';
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

interface StudioPanelProps {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  
  // Music generation states
  mode: "basic" | "custom";
  setMode: (mode: "basic" | "custom") => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  selectedVibe: string;
  setSelectedVibe: (vibe: string) => void;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
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
  onGenerationStart?: () => void;
  onGenerateLyrics?: () => void;
  // 新增：在移动端强制可见（用于移动端Tab中的创作页）
  forceVisibleOnMobile?: boolean;
  // 新增：点击收起并显示tracks列表
  onCollapseToTracks?: () => void;
  // 新增：收起（关闭）面板
  onCollapse?: () => void;
  // 上传任务回调
  onUploadTaskCreated?: (taskId: string, initialTracks?: any[]) => void;
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
    setIsAuthModalOpen,
    mode,
    setMode,
    selectedGenre,
    setSelectedGenre,
    selectedVibe,
    setSelectedVibe,
    customPrompt,
    setCustomPrompt,
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
    onUploadTaskCreated,
    selectedModel = 'V4_5',
    setSelectedModel,
  } = props;

  const { user } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const userSelectedModelRef = React.useRef(false);

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

  // Check if user has subscription (Basic or Premium tier)
  const [hasSubscription, setHasSubscription] = React.useState(false);
  const [isCheckingSubscription, setIsCheckingSubscription] = React.useState(false);

  // Pricing dialog state
  const [isPricingOpen, setIsPricingOpen] = React.useState(false);

  // Check subscription status
  React.useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id) {
        setHasSubscription(false);
        // 无订阅用户默认使用 V3.5
        if (selectedModel !== 'V3_5') {
          updateSelectedModel('V3_5', { forceOverride: true });
        }
        return;
      }

      setIsCheckingSubscription(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setHasSubscription(false);
          if (selectedModel !== 'V3_5') {
            updateSelectedModel('V3_5', { forceOverride: true });
          }
          return;
        }

        const response = await fetch('/api/user-subscription', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // API 返回 tierCode: 'basic' | 'premium' | null
          const hasActive = data.tierCode !== null;
          setHasSubscription(hasActive);

          console.log('[STUDIO-PANEL] Subscription check:', {
            userId: user.id,
            tierCode: data.tierCode,
            hasActive,
            currentModel: selectedModel
          });

          // 有订阅用户默认使用 V4_5PLUS
          if (hasActive && selectedModel === 'V3_5' && !userSelectedModelRef.current) {
            updateSelectedModel('V4_5PLUS');
          }
          // 无订阅用户默认使用 V3.5
          else if (!hasActive && selectedModel !== 'V3_5') {
            updateSelectedModel('V3_5', { forceOverride: true });
          }
        } else {
          setHasSubscription(false);
          if (selectedModel !== 'V3_5') {
            updateSelectedModel('V3_5', { forceOverride: true });
          }
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setHasSubscription(false);
        if (selectedModel !== 'V3_5') {
          updateSelectedModel('V3_5', { forceOverride: true });
        }
      } finally {
        setIsCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user?.id, selectedModel, updateSelectedModel]);

  // State for managing expanded categories
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);
  
  // State for hovered instrument
  const [hoveredInstrument, setHoveredInstrument] = React.useState<string | null>(null);
  
  // State for hovered drum kit
  const [hoveredDrumKit, setHoveredDrumKit] = React.useState<string | null>(null);
  
  // Audio player hook
  const { playPreviewAudio } = useAudioPlayer();

  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);

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
  const handleGenerateWithAuth = () => {
    if (!user) {
      setIsAuthModalOpen?.(true);
      return;
    }
    
    // 检查积分是否足够（点击后才检查）
    if (credits === null) {
      toast("Loading credits, please wait...");
      return;
    }

    const requiredCredits = mode === 'custom' 
      ? CLIENT_MUSIC_CREDITS.custom
      : CLIENT_MUSIC_CREDITS.basic;

    if (credits < requiredCredits) {
      // 使用 sonner 显示积分不足提示
      toast(`Insufficient Credits`, {
        description: `Need ${requiredCredits} credits (you have ${credits}). Please wait for daily rewards or buy credits.`,
        icon: <CreditCard className="h-4 w-4" />,
      });
      return;
    }
    
    // 通知父组件生成开始
    onGenerationStart?.();
  };

  return (
    <div className={`transition-all duration-300 ease-in-out bg-[var(--studio-panel-bg)] border border-white/5 rounded-[32px] shadow-[0_20px_60px_rgba(4,6,15,0.45)] ${
      // 桌面：左侧固定宽度；移动端：当 forceVisibleOnMobile=true 时占满宽度
      panelOpen ? (forceVisibleOnMobile ? 'w-full md:w-[28rem]' : 'w-[28rem]') : 'w-0'
    } ${forceVisibleOnMobile ? 'flex flex-col' : 'h-full flex flex-col overflow-hidden'} ${forceVisibleOnMobile ? 'flex md:flex' : 'hidden md:flex'}`}>
      {panelOpen && (
        <>
          {/* Header with Mode Tabs */}
          <div className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              {/* Mode Selector */}
              <div className="bg-muted/30 rounded-xl p-1 flex-shrink-0">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setMode("basic")}
                      title="Create random R&B songs with polished production in 90s style. Simple and fast setup."
                      className={`py-2 px-4 md:px-6 text-xs md:text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${mode === "basic"
                          ? "bg-primary/20 border-transparent text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      Basic
                    </button>
                    <button
                      onClick={() => setMode("custom")}
                      title="Fine-tune every aspect of your track with detailed controls for genre, instruments, and style."
                      className={`py-2 px-4 md:px-6 text-xs md:text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${mode === "custom"
                          ? "bg-primary/20 border-transparent text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

              {/* Model Selection Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs md:text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 flex items-center gap-1.5"
                    title="Click to change model version"
                  >
                    <span>{modelOptions.find(opt => opt.value === selectedModel)?.label || 'v4.5'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5">
                  {modelOptions.map((option, index) => {
                    const isSelected = option.value === selectedModel;
                    return (
                      <React.Fragment key={option.value}>
                        <DropdownMenuItem
                          onClick={() => handleModelSelect(option.value)}
                          className="flex flex-col items-start gap-1 rounded-lg px-3 py-2"
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{option.label}</span>
                              {!hasSubscription && option.requiresSubscription && (
                                <span className="rounded-full border-0 bg-gradient-create px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  Pro
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                                <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
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
            </div>
          </div>

          {/* Main Content */}
          <div className={`flex-1 ${forceVisibleOnMobile ? '' : 'overflow-y-auto'} px-4 md:px-6 ${forceVisibleOnMobile ? 'pb-20' : 'pb-6'} md:pb-6`}>
            {/* Mode Content */}
      {mode === "basic" ? (
        <>
          {/* Basic Mode Content - 流式布局 */}
                <div className="space-y-5 md:space-y-6">
            {/* Custom Prompt Section */}
            <section>
              <div className="bg-muted/20 rounded-lg p-3">
                <h3 className="text-lg font-semibold tracking-tight mb-3 md:mb-4 flex items-center gap-2">
                  Description
                </h3>
                <div className="space-y-1">
                  <div className="relative">
                    <Textarea
                      placeholder="Describe your song idea (e.g., 'a love song about summer nights')"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      maxLength={400}
                      className="min-h-[180px] md:min-h-[200px] resize-none pr-16 pb-12 border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {customPrompt.length}/400
                    </div>
                    {/* Instrumental Switch - Bottom Left */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-2">
                      <Switch
                        checked={instrumentalMode}
                        onCheckedChange={setInstrumentalMode}
                        className="scale-75"
                      />
                      <span className="text-xs text-muted-foreground">Instrumental</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>


          </div>
        </>
      ) : (
        <>
          {/* Custom Mode Content - 流式布局 */}
          <div className="space-y-4 md:space-y-5">

            {/* Lyrics Section */}
            {!instrumentalMode ? (
            <section>
                <div className="bg-muted/20 rounded-lg p-3">
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
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        maxLength={5000}
                      className="min-h-[104px] md:min-h-[120px] resize-none pr-16 pb-6 border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      {/* Character count - Inside textarea, bottom right */}
                      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                        {customPrompt.length}/5000
                      </div>
                      {/* Generate Lyrics Button - Bottom Left */}
                      <div className="absolute bottom-2 left-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/80"
                          title="Generate lyrics with AI"
                          onClick={onGenerateLyrics}
                        >
                          <Wand2 className="h-3 w-3" />
                          <span className="text-xs font-medium">Generate Lyrics</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Vocal Gender Section - Only show when not in instrumental mode */}
                {!instrumentalMode && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between bg-muted/20 rounded-lg p-3">
                      <Label className="text-sm font-medium text-foreground">Vocal Gender</Label>
                      <div className="flex gap-2">
                        {vocalGenders.map((gender: any) => (
                          <button
                            key={gender.id}
                            onClick={() => setVocalGender(gender.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              vocalGender === gender.id
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                            }`}
                          >
                            {gender.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            ) : (
              /* Instrumental Mode Status Display */
              <section>
                <div className="bg-muted/20 rounded-lg p-3">
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
                  <div className="flex items-center justify-center py-4 px-4 bg-muted/30 rounded-lg border border-border/20">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-sm font-medium">Instrumental Mode Active,no need to write lyrics</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Style & Vibe Section */}
            <section>
              <div className="bg-muted/20 rounded-lg p-3">
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
                      setBpmMode(''); // Reset BPM mode to no selection
                      setLeadInstrument([]);
                      setDrumKit("");
                      setBassTone("");
                      setHarmonyPalette("");
                      setStyleText("");
                    }}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-xl transition-all duration-200"
                    title="Reset"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

              {/* Style Input Field */}
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
                    maxLength={1000}
                    className="min-h-[180px] md:min-h-[200px] resize-none pr-16 pb-12 border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                    {styleText.length}/1000
                  </div>
                            </div>
                  </div>

              {/* Interactive Style Buttons */}
              <div className="space-y-3">
                {/* Category Buttons */}
                <div className="flex flex-wrap gap-2">
                {/* Genre Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'genre' ? null : 'genre')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'genre' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Genre
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'genre' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Vibe Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'vibe' ? null : 'vibe')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'vibe' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Vibe
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'vibe' ? 'rotate-90' : ''}`} />
                </button>

                {/* Groove Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'groove' ? null : 'groove')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'groove' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Groove
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'groove' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Tempo Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'tempo' ? null : 'tempo')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'tempo' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Tempo
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'tempo' ? 'rotate-90' : ''}`} />
                </button>

                {/* Lead Instrument Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'instrument' ? null : 'instrument')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'instrument' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Lead Instrument
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'instrument' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Drum Kit Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'drum' ? null : 'drum')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'drum' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Drum Kit
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'drum' ? 'rotate-90' : ''}`} />
                </button>

                {/* Bass Tone Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'bass' ? null : 'bass')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'bass' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Bass Tone
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'bass' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Harmony Palette Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'harmony' ? null : 'harmony')}
                  className={`${BUTTON_CLASSES.category} ${
                    expandedCategory === 'harmony' 
                      ? STYLES.expanded 
                      : STYLES.collapsed
                  }`}
                >
                  # Harmony Palette
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'harmony' ? 'rotate-90' : ''}`} />
                </button>
                              </div>

                {/* Expanded Options */}
                {expandedCategory && (
                  <div className="mt-3 p-3 bg-muted/20 rounded-lg border border-border/20">
                    {expandedCategory === 'genre' && (
                      <div className="flex flex-wrap gap-2">
                        {genres.map((genre: any) => (
                          <button
                            key={genre.id}
                            onClick={() => {
                              setSelectedGenre(genre.id);
                              // Replace genre in textarea (only one genre allowed)
                              const otherText = styleText.split(';').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !genres.some(g => g.value.toLowerCase() === trimmed);
                              }).join(';').replace(/^;|;$/g, '').trim();
                              const newText = otherText ? `${otherText}; ${genre.value}` : genre.value;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              selectedGenre === genre.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span>{genre.name}</span>
                          </button>
                        ))}
                  </div>
                    )}

                    {expandedCategory === 'vibe' && (
                      <div className="flex flex-wrap gap-2">
                        {vibes.map((vibe: any) => (
                          <button
                            key={vibe.id}
                            onClick={() => {
                              setSelectedVibe(vibe.id);
                              // Replace vibe in textarea (only one vibe allowed)
                              const otherText = styleText.split(';').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !vibes.some(v => v.value.toLowerCase() === trimmed);
                              }).join(';').replace(/^;|;$/g, '').trim();
                              const newText = otherText ? `${otherText}; ${vibe.value}` : vibe.value;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              selectedVibe === vibe.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span>{vibe.name}</span>
                          </button>
                        ))}
                              </div>
                    )}

                    {expandedCategory === 'groove' && (
                      <div className="flex flex-wrap gap-2">
                        {grooveTypes.map((groove: any) => (
                          <button
                            key={groove.id}
                            onClick={() => {
                              setGrooveType(groove.id);
                              // Replace groove in textarea (only one groove allowed)
                              const otherText = styleText.split(';').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !grooveTypes.some(g => g.value.toLowerCase() === trimmed);
                              }).join(';').replace(/^;|;$/g, '').trim();
                              const newText = otherText ? `${otherText}; ${groove.value}` : groove.value;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              grooveType === groove.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span>{groove.name}</span>
                          </button>
                        ))}
                  </div>
                    )}

                    {expandedCategory === 'tempo' && (
                      <div className="flex flex-wrap gap-2">
                        <Tooltip content="60-80 BPM" position="top">
                    <button
                      onClick={() => {
                              const randomBpm = getRandomBpm('slow');
                              setBpm([randomBpm]);
                        setBpmMode('slow');
                              // Replace tempo in textarea (only one tempo allowed)
                              const newText = replaceTextInStyle(styleText, [...TEMPO_KEYWORDS], 'Slow');
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              bpmMode === 'slow'
                                ? 'bg-primary text-primary-foreground'
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
                              // Replace tempo in textarea (only one tempo allowed)
                              const newText = replaceTextInStyle(styleText, [...TEMPO_KEYWORDS], 'Moderate');
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              bpmMode === 'moderate'
                                ? 'bg-primary text-primary-foreground'
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
                              // Replace tempo in textarea (only one tempo allowed)
                              const newText = replaceTextInStyle(styleText, [...TEMPO_KEYWORDS], 'Medium');
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              bpmMode === 'medium'
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span>Medium</span>
                    </button>
                        </Tooltip>
                          </div>
                    )}

                    {expandedCategory === 'instrument' && (
                      <div className="flex flex-wrap gap-2">
                        {leadInstruments.map((instrument: any) => (
                          <div
                            key={instrument.id}
                            className="relative"
                            onMouseEnter={() => setHoveredInstrument(instrument.id)}
                            onMouseLeave={() => setHoveredInstrument(null)}
                          >
                    <button
                      onClick={() => {
                                setLeadInstrument([instrument.id]);
                                // Replace instrument in textarea (only one instrument allowed)
                                const otherText = styleText.split(';').filter(item => {
                                  const trimmed = item.trim().toLowerCase();
                                  return !leadInstruments.some(i => i.value.toLowerCase() === trimmed);
                                }).join(';').replace(/^;|;$/g, '').trim();
                                const newText = otherText ? `${otherText}; ${instrument.value}` : instrument.value;
                                setStyleText(newText);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                                leadInstrument.includes(instrument.id)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              }`}
                            >
                              {getInstrumentIcon(instrument.id) && (
                                <Image 
                                  src={getInstrumentIcon(instrument.id)} 
                                  alt={instrument.name}
                                  width={16}
                                  height={16}
                                  className="w-4 h-4"
                                />
                              )}
                              <span>{instrument.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const audioUrl = getInstrumentAudio(instrument.id);
                                  if (audioUrl) {
                                    playPreviewAudio(audioUrl, `instrument-${instrument.id}`);
                                  }
                                }}
                                className="ml-1 p-1 hover:bg-primary/20 rounded-lg transition-all duration-200 hover:scale-105"
                                title="Play sample"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            </button>
                            
                            {/* Custom Tooltip */}
                            {hoveredInstrument === instrument.id && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                <div className="bg-popover border border-border rounded-lg shadow-lg p-3 flex flex-col items-center gap-2 min-w-[120px]">
                                  <Image 
                                    src={getInstrumentIcon(instrument.id)} 
                                    alt={instrument.name}
                                    width={64}
                                    height={64}
                                    className="w-16 h-16"
                                  />
                                  <span className="text-xs font-medium">{instrument.name}</span>
                  </div>
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-popover"></div>
                              </div>
                            )}
                          </div>
                        ))}
                  </div>
                  )}

                    {expandedCategory === 'drum' && (
                      <div className="flex flex-wrap gap-2">
                        {drumKits.map((kit: any) => (
                          <div
                            key={kit.id}
                            className="relative"
                            onMouseEnter={() => setHoveredDrumKit(kit.id)}
                            onMouseLeave={() => setHoveredDrumKit(null)}
                          >
                            <button
                              onClick={() => {
                                setDrumKit(kit.id);
                                // Replace drum kit in textarea (only one drum kit allowed)
                                const otherText = styleText.split(';').filter(item => {
                                  const trimmed = item.trim().toLowerCase();
                                  return !drumKits.some(d => d.value.toLowerCase() === trimmed);
                                }).join(';').replace(/^;|;$/g, '').trim();
                                const newText = otherText ? `${otherText}; ${kit.value}` : kit.value;
                                setStyleText(newText);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                                drumKit === kit.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              }`}
                            >
                              {getDrumKitIcon(kit.id) && (
                                <Image 
                                  src={getDrumKitIcon(kit.id)} 
                                  alt={kit.name}
                                  width={16}
                                  height={16}
                                  className="w-4 h-4"
                                />
                              )}
                              <span>{kit.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const audioUrl = getDrumKitAudio(kit.id);
                                  if (audioUrl) {
                                    playPreviewAudio(audioUrl, `drum-${kit.id}`);
                                  }
                                }}
                                className="ml-1 p-1 hover:bg-primary/20 rounded-lg transition-all duration-200 hover:scale-105"
                                title="Play sample"
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            </button>
                            
                            {/* Custom Tooltip */}
                            {hoveredDrumKit === kit.id && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                                <div className="bg-popover border border-border rounded-lg shadow-lg p-3 flex flex-col items-center gap-2 min-w-[120px]">
                                  <Image 
                                    src={getDrumKitIcon(kit.id)} 
                                    alt={kit.name}
                                    width={64}
                                    height={64}
                                    className="w-16 h-16"
                                  />
                                  <span className="text-xs font-medium">{kit.name}</span>
                          </div>
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-popover"></div>
                    </div>
                  )}
                </div>
                        ))}
              </div>
                  )}

                    {expandedCategory === 'bass' && (
                      <div className="flex flex-wrap gap-2">
                        {bassTones.map((tone: any) => (
                          <button
                            key={tone.id}
                  onClick={() => {
                              setBassTone(tone.id);
                              // Replace bass tone in textarea (only one bass tone allowed)
                              const otherText = styleText.split(';').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !bassTones.some(b => b.value.toLowerCase() === trimmed);
                              }).join(';').replace(/^;|;$/g, '').trim();
                              const newText = otherText ? `${otherText}; ${tone.value}` : tone.value;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              bassTone === tone.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span>{tone.name}</span>
                          </button>
                            ))}
                          </div>
                    )}

                    {expandedCategory === 'harmony' && (
                      <div className="flex flex-wrap gap-2">
                        {harmonyPalettes.map((palette: any) => (
                          <button
                            key={palette.id}
                              onClick={() => {
                              setHarmonyPalette(palette.id);
                              // Replace harmony palette in textarea (only one harmony palette allowed)
                              const otherText = styleText.split(';').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !harmonyPalettes.some(h => h.value.toLowerCase() === trimmed);
                              }).join(';').replace(/^;|;$/g, '').trim();
                              const newText = otherText ? `${otherText}; ${palette.value}` : palette.value;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold tracking-tight transition-all duration-200 ${
                              harmonyPalette === palette.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                            }`}
                          >
                            <span>{palette.name}</span>
                          </button>
                        ))}
                        </div>
                      )}
                  </div>
                )}
              </div>

              {/* Hidden Select Components for Functionality */}
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
              </div>
            </section>

            {/* Song Title Section */}
            <section>
              <div className="bg-muted/20 rounded-lg p-3">
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
                      className="pr-16 h-12 text-base border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <div className="absolute top-1/2 right-2 transform -translate-y-1/2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {songTitle.length}/80
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}



            {/* Generation Tips - Only show when generating */}
            {isGenerating && (
              <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/20 animate-in fade-in duration-300">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                  </div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <p>Music starts streaming in 30 seconds and completes in 3-5 minutes. The lyrics panel will automatically open when the first track is ready.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Generate Button - Bottom */}
          <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-6">
            {(() => {
              // 只根据prompt输入内容来禁用按钮，积分检查移到点击后
              let isDisabled = isGenerating;

              if (mode === 'basic') {
                // Basic Mode: 只需要prompt字段
                isDisabled = isDisabled || !customPrompt.trim();
              } else {
                // Custom Mode: style和title现在是可选的，只需要根据instrumental模式确定required字段
                if (instrumentalMode) {
                  // instrumental: true - 没有required字段
                  // isDisabled保持原值（只检查isGenerating）
                } else {
                  // instrumental: false - 只需要prompt(lyrics)字段
                  isDisabled = isDisabled || !customPrompt.trim();
                }
              }
              return (
                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="button"
                    onClick={() => setIsUploadDialogOpen(true)}
                    className="h-14 w-14 rounded-2xl border border-white/10 bg-white/[0.04] text-white flex items-center justify-center hover:bg-white/10 transition-all"
                    title="Upload Audio"
                  >
                    <UploadCloud className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      handleGenerateWithAuth();
                    }}
                    disabled={isDisabled}
                    className="flex-1 h-14 px-4 text-base font-semibold bg-gradient-create disabled:bg-muted disabled:bg-none border-transparent text-white disabled:text-muted-foreground shadow-lg disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] disabled:hover:translate-y-0 disabled:hover:scale-100 rounded-2xl relative overflow-hidden"
                  >
                    {!isDisabled && (
                      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine"></div>
                    )}
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
                        <div className="flex items-center justify-center gap-2">
                          <Image
                            src="/icons/create-button.svg"
                            alt="Create"
                            width={20}
                            height={20}
                            className="w-5 h-5"
                          />
                          <span>Create</span>
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      <UploadAudioDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onTaskCreated={(taskId, initialTracks) => {
          onUploadTaskCreated?.(taskId, initialTracks);
        }}
        onSuccess={async () => {
          try {
            await refreshCredits?.();
          } catch (error) {
            console.error('Failed to refresh credits after upload:', error);
          }
        }}
        selectedModel={selectedModel}
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
