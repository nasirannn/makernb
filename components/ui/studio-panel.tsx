"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Minus, Plus, Music } from "lucide-react";
import musicOptions from '@/data/music-options.json';
import { useAuth } from '@/contexts/AuthContext';
import { useCredits } from '@/contexts/CreditsContext';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/tooltip';

// 统一的选项按钮样式
const getOptionButtonClasses = (isSelected: boolean, layout: 'horizontal' | 'vertical' = 'vertical') => {
  const baseClasses = "px-3 py-2 rounded-lg border transition-all duration-200";
  const layoutClasses = layout === 'vertical' 
    ? "flex flex-col items-center gap-1" 
    : "flex items-center gap-2";
  const selectedClasses = "bg-primary/20 border-transparent text-primary shadow-sm";
  const unselectedClasses = "bg-background/50 border-input/30 text-muted-foreground hover:bg-muted/20 hover:border-input/50 hover:text-foreground";
  
  return `${baseClasses} ${layoutClasses} ${isSelected ? selectedClasses : unselectedClasses}`;
};

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
  keepPrivate: boolean;
  setKeepPrivate: (isPrivate: boolean) => void;
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
  
  // Generation
  isGenerating: boolean;
  pendingTasksCount: number;
  onGenerationStart?: () => void;
}

export const StudioPanel = (props: StudioPanelProps) => {
  const {
    panelOpen,
    setPanelOpen,
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
    keepPrivate,
    setKeepPrivate,
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
    isGenerating,
    onGenerationStart,
  } = props;

  const { user } = useAuth();
  const { credits } = useCredits();

  const [bpmMode, setBpmMode] = React.useState<'slow' | 'moderate' | 'medium' | 'custom'>('slow');

  // Handle generate button click with auth and credits check
  const handleGenerateWithAuth = () => {
    if (!user) {
      toast("Please sign in to generate music");
      return;
    }
    
    // 检查积分是否足够（点击后才检查）
    if (credits === null) {
      toast("Loading credits, please wait...");
      return;
    }

    const requiredCredits = mode === 'custom' ? 10 : 7; // Custom Mode需要10积分，Basic Mode需要7积分

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
    <div className={`transition-all duration-300 ease-in-out bg-muted/30 ${panelOpen ? 'w-[28rem]' : 'w-0'} h-full flex flex-col overflow-hidden`}>
      {panelOpen && (
        <>
          {/* Header */}
          <div className="flex-shrink-0 px-6 pt-6 pb-4 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <Music className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-semibold">Studio</h1>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {/* Mode Tabs - Internal at top */}
            <div className="mb-6 mt-4">
                <div className="bg-muted/30 rounded-xl p-1">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setMode("basic")}
              title="Create random R&B songs with polished production in 90s style. Simple and fast setup."
                      className={`py-2 px-4 text-sm font-medium transition-all duration-200 rounded-lg ${mode === "basic"
                          ? "bg-primary/20 border-transparent text-primary shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                    >
                      Basic Mode
                    </button>
                    <button
                      onClick={() => setMode("custom")}
                      title="Fine-tune every aspect of your track with detailed controls for genre, instruments, and style."
                      className={`py-2 px-4 text-sm font-medium transition-all duration-200 rounded-lg ${mode === "custom"
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
                <div className="space-y-6">
            {/* Basic Settings Section */}
            <section className="pb-4 border-b border-border/20">

              {/* Instrumental Mode */}
              <div className="space-y-4">
                <div className="flex items-start py-3">
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      Instrumental Mode
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
            <section className="pb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Prompt
                <span className="text-white text-sm">*</span>
                <div className="group relative">
                  <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg cursor-help">
                    💡
                  </div>
                  <div className="absolute left-0 top-full mt-1 p-3 bg-gradient-to-r from-card/95 via-card/90 to-card/95 backdrop-blur-md text-foreground text-xs rounded-lg border border-border/30 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64">
                    describe your desired themes of the song
                  </div>
                </div>
              </h3>
              <div className="space-y-1">
                <div className="relative">
                  <Textarea
                    placeholder="describe your desired themes of the song"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    maxLength={400}
                    className="min-h-[120px] resize-none pr-16 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                    {customPrompt.length}/400
                  </div>
                </div>
              </div>
            </section>

            {/* Keep Private Section - Basic Mode */}
            <section className="pb-3 border-b border-border/20">
              <div className="flex items-start py-2">
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    Private
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {keepPrivate
                      ? "Your song will be private"
                      : "Your song will be visible to other users"
                    }
                  </div>
                </div>
                <div className="flex items-center ml-4">
                  <Switch
                    checked={keepPrivate}
                    onCheckedChange={setKeepPrivate}
                  />
                </div>
              </div>
            </section>

          </div>
        </>
      ) : (
        <>
          {/* Tune Mode Content - 流式布局 */}
          <div className="space-y-6">
            {/* Basic Settings Section */}
            <section className="pb-4 border-b border-border/20">
              {/* Instrumental Mode */}
              <div className="py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-foreground">
                    Instrumental Mode
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
                  <div className="bg-muted/30 rounded-xl p-1">
                    <div className="flex gap-1">
                      {vocalGenders.map((gender: any) => (
                        <button
                          key={gender.id}
                          onClick={() => setVocalGender(gender.id)}
                          className={`py-1.5 px-3 text-xs font-medium transition-all duration-200 rounded-lg ${vocalGender === gender.id
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
            <section className="pb-4 border-b border-border/20">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
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
                    className="min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
                  Style & Vibe
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
                  }}
                  className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-all duration-200"
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-4">
                {/* Style Options - 圆角标签样式 */}
                <div className="grid grid-cols-3 gap-3">


                  {/* Genre Selection */}
                  <div className="relative">
                    <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                      <SelectTrigger className={`w-full px-4 py-2 h-auto font-medium rounded-xl transition-all duration-200 border-0 focus:ring-0 focus:ring-offset-0 ${selectedGenre
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}>
                        <SelectValue placeholder="Genre">
                          {selectedGenre && (
                            <span className="font-medium">
                              {genres.find((g: any) => g.id === selectedGenre)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {genres.map((genre: any) => (
                          <SelectItem key={genre.id} value={genre.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="text-left">
                                <div className="font-medium text-left">{genre.name}</div>
                                <div className="text-sm text-muted-foreground text-left">{genre.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Vibe Selection */}
                  <div className="relative">
                    <Select value={selectedVibe} onValueChange={setSelectedVibe}>
                      <SelectTrigger className={`w-full px-4 py-2 h-auto font-medium rounded-xl transition-all duration-200 border-0 focus:ring-0 focus:ring-offset-0 ${selectedVibe
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}>
                        <SelectValue placeholder="Vibe">
                          {selectedVibe && (
                            <span className="font-medium">
                              {vibes.find((v: any) => v.id === selectedVibe)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {vibes.map((vibe: any) => (
                          <SelectItem key={vibe.id} value={vibe.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="text-left">
                                <div className="font-medium text-left">{vibe.name}</div>
                                <div className="text-sm text-muted-foreground text-left">{vibe.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Groove Type */}
                  <div className="relative">
                    <Select value={grooveType} onValueChange={setGrooveType}>
                      <SelectTrigger className={`w-full px-4 py-2 h-auto font-medium rounded-xl transition-all duration-200 border-0 focus:ring-0 focus:ring-offset-0 ${grooveType
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                        }`}>
                        <SelectValue placeholder="Groove">
                          {grooveType && (
                            <span className="font-medium">
                              {grooveTypes.find((t: any) => t.id === grooveType)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {grooveTypes.map((type: any) => (
                          <SelectItem key={type.id} value={type.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="text-left">
                                <div className="font-medium text-left">{type.name}</div>
                                <div className="text-sm text-muted-foreground text-left">{type.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* BPM Selection */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setBpm([60]); // 60-80 的起始值
                        setBpmMode('slow');
                      }}
                      className={getOptionButtonClasses(bpmMode === 'slow', 'vertical')}
                    >
                      <div className="font-medium">Slow</div>
                      <div className="text-xs text-muted-foreground">60-80 BPM</div>
                    </button>

                    <button
                      onClick={() => {
                        setBpm([90]); // 80-100 的中间值
                        setBpmMode('moderate');
                      }}
                      className={getOptionButtonClasses(bpmMode === 'moderate', 'vertical')}
                    >
                      <div className="font-medium">Moderate</div>
                      <div className="text-xs text-muted-foreground">80-100 BPM</div>
                    </button>

                    <button
                      onClick={() => {
                        setBpm([110]); // 100-120 的中间值
                        setBpmMode('medium');
                      }}
                      className={getOptionButtonClasses(bpmMode === 'medium', 'vertical')}
                    >
                      <div className="font-medium">Medium</div>
                      <div className="text-xs text-muted-foreground">100-120 BPM</div>
                    </button>

                    <button
                      onClick={() => {
                        setBpmMode('custom');
                      }}
                      className={getOptionButtonClasses(bpmMode === 'custom', 'vertical')}
                    >
                      <div className="font-medium">Custom</div>
                      <div className="text-xs text-muted-foreground">Manual input</div>
                    </button>
                  </div>

                  {/* Custom BPM Input - Only show when custom is selected */}
                  {bpmMode === 'custom' && (
                    <div className="space-y-3 pt-2 border-t border-border/20">
                      <div className="flex items-center gap-3">
                        <Tooltip content={bpm[0] <= 60 ? "⚠️ Minimum BPM is 60" : "⬇️ Decrease BPM"} position="top">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBpm([Math.max(60, bpm[0] - 0.5)])}
                            disabled={bpm[0] <= 60}
                            className="h-10 w-10 p-0 rounded-lg border-input/50 hover:border-input hover:bg-muted/20 transition-all duration-200"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </Tooltip>

                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={bpm[0]}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '') {
                                setBpm([60]);
                              } else {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue)) {
                                  setBpm([numValue]);
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const value = parseFloat(e.target.value);
                              if (isNaN(value) || value < 60) {
                                setBpm([60]);
                              } else if (value > 120) {
                                setBpm([120]);
                              }
                            }}
                            min="60"
                            max="120"
                            step="0.5"
                            className="w-full h-10 pr-12 text-center text-sm border border-input/50 bg-background/50 text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground font-medium pointer-events-none">
                            BPM
                          </div>
                        </div>

                        <Tooltip content={bpm[0] >= 120 ? "⚠️ Maximum BPM is 120" : "⬆️ Increase BPM"} position="top">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBpm([Math.min(120, bpm[0] + 0.5)])}
                            disabled={bpm[0] >= 120}
                            className="h-10 w-10 p-0 rounded-lg border-input/50 hover:border-input hover:bg-muted/20 transition-all duration-200"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Arrangement Section */}
            <section className="pb-4 border-b border-border/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Arrangement & Performance
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLeadInstrument([]);
                    setDrumKit("");
                    setBassTone("");
                    setHarmonyPalette("");
                  }}
                  className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition-all duration-200"
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-4">
                {/* Lead Instrument */}
                <div className="space-y-3">
                  <Select value={leadInstrument.join(',')} onValueChange={(value) => {
                    const selectedIds = value.split(',').filter(Boolean);
                    setLeadInstrument(selectedIds);
                  }}>
                    <SelectTrigger className={`cursor-pointer border-0 focus:ring-0 focus:ring-offset-0 ${leadInstrument.length > 0 ? "" : "text-muted-foreground"}`}>
                      <SelectValue placeholder="Lead Instrument">
                        {leadInstrument.length > 0 ? (
                          <div className="flex items-center gap-1 max-w-full">
                            {leadInstrument.map((id, index) => (
                              <span key={id} className="font-medium">
                                {leadInstruments.find((i: any) => i.id === id)?.name}
                                {index < leadInstrument.length - 1 && ", "}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Select up to 2 instruments</span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-full">
                      <div className="p-2 space-y-2">
                        {leadInstruments.map((instrument: any) => {
                          const isSelected = leadInstrument.includes(instrument.id);
                          const isDisabled = !isSelected && leadInstrument.length >= 2;

                          return (
                            <div
                              key={instrument.id}
                              className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${isSelected
                                ? 'bg-primary/10 border border-primary/20'
                                : isDisabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-muted'
                                }`}
                              onClick={() => {
                                if (isDisabled) return;
                                if (isSelected) {
                                  setLeadInstrument(leadInstrument.filter((id: string) => id !== instrument.id));
                                } else {
                                  setLeadInstrument([...leadInstrument, instrument.id]);
                                }
                              }}
                            >
                              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${isSelected
                                ? 'bg-primary border-primary'
                                : 'border-muted-foreground'
                                }`}>
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-sm" />
                                )}
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-medium">{instrument.name}</div>
                                <div className="text-sm text-muted-foreground">{instrument.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {leadInstrument.length > 0 && (
                        <div className="p-2 border-t">
                          <button
                            onClick={() => setLeadInstrument([])}
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Drum Kit & Bass Tone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex-1">
                    <Select value={drumKit} onValueChange={setDrumKit}>
                      <SelectTrigger className={`border-0 focus:ring-0 focus:ring-offset-0 ${drumKit ? "" : "text-muted-foreground"}`}>
                        <SelectValue placeholder="Drum Kit">
                          {drumKit && (
                            <span className="font-medium">
                              {drumKits.find((k: any) => k.id === drumKit)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {drumKits.map((kit: any) => (
                          <SelectItem key={kit.id} value={kit.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="text-left">
                                <div className="font-medium text-left">{kit.name}</div>
                                <div className="text-sm text-muted-foreground text-left">{kit.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1">
                    <Select value={bassTone} onValueChange={setBassTone}>
                      <SelectTrigger className={`border-0 focus:ring-0 focus:ring-offset-0 ${bassTone ? "" : "text-muted-foreground"}`}>
                        <SelectValue placeholder="Bass Tone">
                          {bassTone && (
                            <span className="font-medium">
                              {bassTones.find((t: any) => t.id === bassTone)?.name}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {bassTones.map((tone: any) => (
                          <SelectItem key={tone.id} value={tone.id} className="py-3">
                            <div className="text-left">
                              <div className="font-medium text-left">{tone.name}</div>
                              <div className="text-sm text-muted-foreground text-left">{tone.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Harmony Palette */}
                <div className="space-y-3">
                  <Select value={harmonyPalette} onValueChange={setHarmonyPalette}>
                    <SelectTrigger className={`border-0 focus:ring-0 focus:ring-offset-0 ${harmonyPalette ? "" : "text-muted-foreground"}`}>
                      <SelectValue placeholder="Harmony Palette">
                        {harmonyPalette && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {harmonyPalettes.find((p: any) => p.id === harmonyPalette)?.emoji}
                            </span>
                            <span className="text-sm font-medium">
                              {harmonyPalettes.find((p: any) => p.id === harmonyPalette)?.name}
                            </span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {harmonyPalettes.map((palette: any) => (
                        <SelectItem key={palette.id} value={palette.id} className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">
                              {palette.emoji}
                            </span>
                            <div className="text-left">
                              <div className="font-medium text-left">{palette.name}</div>
                              <div className="text-sm text-muted-foreground text-left">{palette.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Lyrics Section */}
            {!instrumentalMode && (
              <section className="pb-6">
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
                  >
                    <Sparkles className="h-3 w-3" />
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
                      className="min-h-[120px] resize-none pr-16 pb-6 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    {/* Character count - Inside textarea, bottom right */}
                    <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                      {customPrompt.length}/5000
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Keep Private Section - Custom Mode */}
            <section className="pb-3 border-b border-border/20">
              <div className="flex items-start py-2">
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    Private
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {keepPrivate
                      ? "Your song will be private"
                      : "Your song will be visible to other users"
                    }
                  </div>
                </div>
                <div className="flex items-center ml-4">
                  <Switch
                    checked={keepPrivate}
                    onCheckedChange={setKeepPrivate}
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
              className="w-full h-16 px-6 text-base font-semibold bg-primary border-transparent text-white shadow-sm hover:bg-primary/80 hover:text-white disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] rounded-3xl relative overflow-hidden"
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
