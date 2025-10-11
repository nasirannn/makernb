"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Music, RotateCcw, ChevronRight, ChevronDown, Wand2, Play, Pause, X } from "lucide-react";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { getInstrumentIcon, getInstrumentAudio, getDrumKitIcon, getDrumKitAudio } from '@/lib/music-resources';
import { replaceTextInStyle, updateStatesFromTextarea, getRandomBpm } from '@/lib/studio-utils';
import { TEMPO_KEYWORDS, BUTTON_CLASSES, STYLES, BPM_VALUES } from '@/lib/studio-constants';
import { useAudioPlayer } from '@/hooks/use-audio-player';

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
  setIsPublished: (isPublished: boolean) => void;
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
  pendingTasksCount: number;
  onGenerationStart?: () => void;
  onGenerateLyrics?: () => void;
  // 新增：在移动端强制可见（用于移动端Tab中的创作页）
  forceVisibleOnMobile?: boolean;
  // 新增：点击收起并显示tracks列表
  onCollapseToTracks?: () => void;
  // 新增：收起（关闭）面板
  onCollapse?: () => void;
  // AuthModal相关
  isAuthModalOpen?: boolean;
  setIsAuthModalOpen?: (open: boolean) => void;
}

export const StudioPanel = (props: StudioPanelProps) => {
  const {
    panelOpen,
    forceVisibleOnMobile = false,
    onCollapseToTracks,
    onCollapse,
    // AuthModal相关
    isAuthModalOpen = false,
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
    setIsPublished,
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
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();

  // State for managing expanded categories
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);
  
  // State for style textarea
  const [styleText, setStyleText] = React.useState<string>("");
  
  // State for hovered instrument
  const [hoveredInstrument, setHoveredInstrument] = React.useState<string | null>(null);
  
  // State for hovered drum kit
  const [hoveredDrumKit, setHoveredDrumKit] = React.useState<string | null>(null);
  
  // Audio player hook
  const { currentAudio, playingAudioId, playAudio } = useAudioPlayer();

  // Function to update states based on textarea content
  const handleUpdateStatesFromTextarea = (text: string) => {
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
  };

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
      ? parseInt(process.env.NEXT_PUBLIC_CUSTOM_MODE_CREDITS || '12') 
      : parseInt(process.env.NEXT_PUBLIC_BASIC_MODE_CREDITS || '7'); // 使用环境变量配置的积分

    if (credits < requiredCredits) {
      // 使用 sonner 显示积分不足提示
      toast(`Insufficient Credits`, {
        description: `Need ${requiredCredits} credits (you have ${credits}). Please wait for daily rewards.`,
      });
      return;
    }
    
    // 通知父组件生成开始
    onGenerationStart?.();
  };

  return (
    <div className={`transition-all duration-300 ease-in-out bg-muted/30 ${
      // 桌面：左侧固定宽度；移动端：当 forceVisibleOnMobile=true 时占满宽度
      panelOpen ? (forceVisibleOnMobile ? 'w-full md:w-[28rem]' : 'w-[28rem]') : 'w-0'
    } h-full flex flex-col overflow-hidden ${forceVisibleOnMobile ? 'flex md:flex' : 'hidden md:flex'}`}>
      {panelOpen && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 backdrop-blur-sm">
            {/* Desktop: Title and Credits */}
            <div className="hidden md:flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <Music className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-semibold">Studio</h1>
              </div>
            </div>
            
            {/* Mobile: Title and Collapse button */}
            <div className="md:hidden mb-2">
              {/* Title and Collapse button row */}
              <div className="flex items-center justify-between mb-2 relative">
                <div className="w-8"></div>
                <h2 className="text-xl font-semibold text-foreground absolute left-1/2 transform -translate-x-1/2">Create Tracks</h2>
                
                {/* Close button */}
                {onCollapse && (
                  <button
                    type="button"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-all duration-300 flex items-center justify-center ml-auto"
                    onClick={onCollapse}
                    aria-label="Close panel"
                    title="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              
              {/* Credits row */}
              {user && (
                <div className="flex items-center gap-2">
                  <div className="bg-muted/50 px-2 py-1 rounded-md">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">Credits</span>
                      <span className="text-base font-medium text-foreground">
                        {credits !== null ? credits.toLocaleString() : '...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-5 md:pb-6">
            {/* Mode Tabs - Internal at top */}
            <div className="mb-4 md:mb-6 mt-1 md:mt-4">
                <div className="bg-muted/30 rounded-lg p-1">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setMode("basic")}
              title="Create random R&B songs with polished production in 90s style. Simple and fast setup."
                      className={`py-2 px-3 md:px-4 text-sm font-medium transition-all duration-200 rounded-md ${mode === "basic"
                          ? "bg-primary/20 border-transparent text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      Basic Mode
                    </button>
                    <button
                      onClick={() => setMode("custom")}
                      title="Fine-tune every aspect of your track with detailed controls for genre, instruments, and style."
                      className={`py-2 px-3 md:px-4 text-sm font-medium transition-all duration-200 rounded-md ${mode === "custom"
                          ? "bg-primary/20 border-transparent text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      Custom Mode
                    </button>
                  </div>
                </div>
              </div>
      {/* Mode Content */}
      {mode === "basic" ? (
        <>
          {/* Basic Mode Content - 流式布局 */}
                <div className="space-y-5 md:space-y-6">
            {/* Basic Settings Section */}
            <section className="pb-4 md:pb-4 border-b border-border/20">

              {/* Instrumental Mode */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-start py-3 md:py-3">
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      Instrumental
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {instrumentalMode
                        ? "Without lyrics"
                        : "Include lyrics"
                      }
                    </div>
                  </div>
                  <div className="flex items-center ml-4">
                    <Switch
                      checked={instrumentalMode}
                      onCheckedChange={setInstrumentalMode}
                    />
                  </div>
                </div>
              </div>
            </section>
            
            {/* Custom Prompt Section */}
            <section className="pb-5 md:pb-6 border-b border-border/20">
              <h3 className="text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
                Description
                <span className="text-white text-sm">*</span>
              </h3>
              <div className="space-y-1">
                <div className="relative">
                  <Textarea
                    placeholder="Describe your song idea (e.g., 'a love song about summer nights')"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    maxLength={400}
                    className="min-h-[104px] md:min-h-[120px] resize-none pr-16 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    {customPrompt.length}/400
                  </div>
                </div>
              </div>
            </section>

            {/* Keep Public Section - Basic Mode */}
            <section className="pb-3 border-b border-border/20">
              <div className="flex items-start py-2">
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    Keep Public
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {isPublished
                      ? "Your song are visible in explore"
                      : "Private in library"
                    }
                  </div>
                </div>
                <div className="flex items-center ml-4">
                  <Switch
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>
              </div>
            </section>

          </div>
        </>
      ) : (
        <>
          {/* Tune Mode Content - 流式布局 */}
          <div className="space-y-5 md:space-y-6">
            {/* Basic Settings Section */}
            <section className="pb-4 md:pb-4 border-b border-border/20">
              {/* Instrumental Mode */}
              <div className="py-3 md:py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-foreground">
                    Instrumental
                  </div>
                  <Switch
                    checked={instrumentalMode}
                    onCheckedChange={setInstrumentalMode}
                  />
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {instrumentalMode
                    ? "Without lyrics"
                    : "Include lyrics"
                  }
                </div>
              </div>

              {/* Vocal Gender - Only show when not in instrumental mode */}
              {!instrumentalMode && (
                <div className="mt-3 flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">Vocal Gender</Label>
                  <div className="bg-muted/30 rounded-lg p-1">
                    <div className="flex gap-1">
                      {vocalGenders.map((gender: any) => (
                        <button
                          key={gender.id}
                          onClick={() => setVocalGender(gender.id)}
                          className={`py-1.5 px-3 text-sm font-medium transition-all duration-200 rounded-md ${vocalGender === gender.id
                            ? "bg-primary/20 border-transparent text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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

            {/* Song Title Section */}
              <section className="pb-4 md:pb-4 border-b border-border/20">
              <h3 className="text-lg font-semibold mb-3 md:mb-3 flex items-center gap-2">
                Title
                <span className="text-white text-sm">*</span>
              </h3>
              <div className="space-y-3">
                <div className="relative">
                  <Textarea
                    placeholder="Enter your song title..."
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value)}
                    maxLength={80}
                    className="min-h-[104px] md:min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    {songTitle.length}/80
                  </div>
                </div>
              </div>
            </section>

            {/* Style & Vibe Section */}
            <section className="pb-4 border-b border-border/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Music Style
                  <span className="text-white text-sm">*</span>
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
                    className="min-h-[104px] md:min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'vibe' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
                >
                  # Vibe
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'vibe' ? 'rotate-90' : ''}`} />
                </button>

                {/* Groove Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'groove' ? null : 'groove')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'groove' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
                >
                  # Groove
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'groove' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Tempo Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'tempo' ? null : 'tempo')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'tempo' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
                >
                  # Tempo
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'tempo' ? 'rotate-90' : ''}`} />
                </button>

                {/* Lead Instrument Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'instrument' ? null : 'instrument')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'instrument' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
                >
                  # Lead Instrument
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'instrument' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Drum Kit Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'drum' ? null : 'drum')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'drum' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
                >
                  # Drum Kit
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'drum' ? 'rotate-90' : ''}`} />
                </button>

                {/* Bass Tone Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'bass' ? null : 'bass')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'bass' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
                  }`}
                >
                  # Bass Tone
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedCategory === 'bass' ? 'rotate-90' : ''}`} />
                </button>
                
                {/* Harmony Palette Category Button */}
                <button 
                  onClick={() => setExpandedCategory(expandedCategory === 'harmony' ? null : 'harmony')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 font-medium rounded-lg transition-all duration-200 text-sm ${
                    expandedCategory === 'harmony' 
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm' 
                      : 'bg-muted/30 text-foreground hover:bg-muted/50'
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
                              const otherText = styleText.split(',').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !genres.some(g => g.name.toLowerCase() === trimmed);
                              }).join(',').replace(/^,|,$/g, '').trim();
                              const newText = otherText ? `${otherText}, ${genre.name}` : genre.name;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                              const otherText = styleText.split(',').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !vibes.some(v => v.name.toLowerCase() === trimmed);
                              }).join(',').replace(/^,|,$/g, '').trim();
                              const newText = otherText ? `${otherText}, ${vibe.name}` : vibe.name;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                              const otherText = styleText.split(',').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !grooveTypes.some(g => g.name.toLowerCase() === trimmed);
                              }).join(',').replace(/^,|,$/g, '').trim();
                              const newText = otherText ? `${otherText}, ${groove.name}` : groove.name;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                                const otherText = styleText.split(',').filter(item => {
                                  const trimmed = item.trim().toLowerCase();
                                  return !leadInstruments.some(i => i.name.toLowerCase() === trimmed);
                                }).join(',').replace(/^,|,$/g, '').trim();
                                const newText = otherText ? `${otherText}, ${instrument.name}` : instrument.name;
                                setStyleText(newText);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                                    playAudio(audioUrl, `instrument-${instrument.id}`);
                                  }
                                }}
                                className="ml-1 p-1 hover:bg-white/20 rounded transition-colors"
                                title="Play sample"
                              >
                                {playingAudioId === `instrument-${instrument.id}` ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
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
                                const otherText = styleText.split(',').filter(item => {
                                  const trimmed = item.trim().toLowerCase();
                                  return !drumKits.some(d => d.name.toLowerCase() === trimmed);
                                }).join(',').replace(/^,|,$/g, '').trim();
                                const newText = otherText ? `${otherText}, ${kit.name}` : kit.name;
                                setStyleText(newText);
                              }}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                                    playAudio(audioUrl, `drum-${kit.id}`);
                                  }
                                }}
                                className="ml-1 p-1 hover:bg-white/20 rounded transition-colors"
                                title="Play sample"
                              >
                                {playingAudioId === `drum-${kit.id}` ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
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
                              const otherText = styleText.split(',').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !bassTones.some(b => b.name.toLowerCase() === trimmed);
                              }).join(',').replace(/^,|,$/g, '').trim();
                              const newText = otherText ? `${otherText}, ${tone.name}` : tone.name;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                              const otherText = styleText.split(',').filter(item => {
                                const trimmed = item.trim().toLowerCase();
                                return !harmonyPalettes.some(h => h.name.toLowerCase() === trimmed);
                              }).join(',').replace(/^,|,$/g, '').trim();
                              const newText = otherText ? `${otherText}, ${palette.name}` : palette.name;
                              setStyleText(newText);
                            }}
                            className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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
            </section>


            {/* Lyrics Section */}
            {!instrumentalMode && (
            <section className="pb-5 md:pb-6 border-b border-border/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Lyrics
                    <span className="text-white text-sm">*</span>
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                    title="Generate lyrics with AI"
                    onClick={onGenerateLyrics}
                  >
                    <Wand2 className="h-3 w-3" />
                    <span className="text-xs font-medium">Generate with AI</span>
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                   <Textarea
                      placeholder="Write your song lyrics here..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      maxLength={5000}
                    className="min-h-[104px] md:min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {/* Character count - Inside textarea, bottom right */}
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {customPrompt.length}/5000
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Keep Public Section - Custom Mode */}
            <section className="pb-3 border-b border-border/20">
              <div className="flex items-start py-2">
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    Keep Public
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {isPublished
                      ? "Your song will be visible in explore"
                      : "Your song will be private in library"
                    }
                  </div>
                </div>
                <div className="flex items-center ml-4">
                  <Switch
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>
              </div>
            </section>

          </div>
        </>
      )}



      {/* Generate Button - Bottom of Panel */}
      <div className="mt-8">
        {(() => {
          // 只根据prompt输入内容来禁用按钮，积分检查移到点击后
          let isDisabled = isGenerating;

          if (mode === 'basic') {
            // Basic Mode: 只需要prompt字段
            isDisabled = isDisabled || !customPrompt.trim();
          } else {
            // Custom Mode: 根据instrumental模式确定required字段
            if (instrumentalMode) {
              // instrumental: true - style和title是required
              isDisabled = isDisabled || !selectedGenre || !selectedVibe || !songTitle.trim();
            } else {
              // instrumental: false - style, prompt(lyrics), title是required
              isDisabled = isDisabled || !selectedGenre || !selectedVibe || !songTitle.trim() || !customPrompt.trim();
            }
          }
          return (
            <button
              onClick={() => {
                handleGenerateWithAuth();
              }}
              disabled={isDisabled}
              className="w-full h-16 px-6 text-base font-semibold bg-primary border-transparent text-white shadow-sm hover:bg-primary/80 hover:text-white disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] rounded-2xl relative overflow-hidden"
            >
              {/* 光效动画 - 只在可点击状态显示 */}
              {!isDisabled && (
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shine"></div>
              )}
                  {isGenerating ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating...</span>
                    </div>
                  ) : (
                'Generate Track'
                  )}
            </button>
          );
        })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
