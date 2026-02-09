"use client";

import React from "react";
import Image from "next/image";
import { Play, Trash2, UploadCloud, Users, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getDrumKitIcon, getInstrumentIcon } from "@/lib/music-resources";

type NamedOption = {
  id: string;
  name: string;
};

type VocalGenderOption = {
  id: string;
  name: string;
};

interface StudioSimpleModeContentProps {
  instrumentalMode: boolean;
  setInstrumentalMode: (mode: boolean) => void;
  simplePrompt: string;
  setSimplePrompt: (prompt: string) => void;
  simplePromptMaxLength: number;
  quickButtons: React.ReactNode;
  onAddAudio: () => void;
  onClear: () => void;
  leadInstruments: NamedOption[];
  drumKits: NamedOption[];
  onSelectLeadInstrument: (instrumentId: string) => void;
  onSelectDrumKit: (kitId: string) => void;
  onPreviewLeadInstrument: (instrumentId: string) => void;
  onPreviewDrumKit: (kitId: string) => void;
  uploadCoverFile: File | null;
  uploadAudioPreview: React.ReactNode;
}

export const StudioSimpleModeContent: React.FC<StudioSimpleModeContentProps> = ({
  instrumentalMode,
  setInstrumentalMode,
  simplePrompt,
  setSimplePrompt,
  simplePromptMaxLength,
  quickButtons,
  onAddAudio,
  onClear,
  leadInstruments,
  drumKits,
  onSelectLeadInstrument,
  onSelectDrumKit,
  onPreviewLeadInstrument,
  onPreviewDrumKit,
  uploadCoverFile,
  uploadAudioPreview,
}) => {
  return (
    <>
      <div className="space-y-5 md:space-y-6 pt-2 md:pt-3">
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
                placeholder="Describe your song idea"
                value={simplePrompt}
                onChange={(e) => setSimplePrompt(e.target.value)}
                maxLength={simplePromptMaxLength}
                className="min-h-[180px] md:min-h-[200px] resize-none pr-16 pb-4 border-0 bg-background focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {quickButtons}

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {simplePrompt.length}/{simplePromptMaxLength}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onAddAudio}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  title="Add audio"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Add Audio</span>
                </button>
                <button
                  type="button"
                  onClick={onClear}
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
              {leadInstruments.map((instrument) => {
                const iconUrl = getInstrumentIcon(instrument.id);

                return (
                  <div
                    key={`instrument-${instrument.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectLeadInstrument(instrument.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectLeadInstrument(instrument.id);
                      }
                    }}
                    className="group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-[#0c0c16] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15"
                  >
                    {iconUrl && (
                      <Image
                        src={iconUrl}
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
                        onPreviewLeadInstrument(instrument.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onPreviewLeadInstrument(instrument.id);
                        }
                      }}
                      className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-black/50 text-white transition-all duration-200 hover:bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      title="Play sample"
                    >
                      <Play className="h-4 w-4" />
                    </div>
                  </div>
                );
              })}

              {drumKits.map((kit) => {
                const iconUrl = getDrumKitIcon(kit.id);

                return (
                  <div
                    key={`drum-${kit.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectDrumKit(kit.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectDrumKit(kit.id);
                      }
                    }}
                    className="group relative inline-flex shrink-0 cursor-pointer flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 text-[#0c0c16] transition-all duration-200 dark:bg-white/10 dark:text-foreground dark:border-white/15"
                  >
                    {iconUrl && (
                      <Image
                        src={iconUrl}
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
                        onPreviewDrumKit(kit.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onPreviewDrumKit(kit.id);
                        }
                      }}
                      className="absolute inset-0 m-auto h-8 w-8 rounded-full bg-black/50 text-white transition-all duration-200 hover:bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      title="Play sample"
                    >
                      <Play className="h-4 w-4" />
                    </div>
                  </div>
                );
              })}
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
  onAddAudio: () => void;
  onOpenPersonaDialog: () => void;
  selectedPersonaName?: string | null;
  selectedPersonaId: string;
  instrumentalMode: boolean;
  setInstrumentalMode: (mode: boolean) => void;
  customLyrics: string;
  setCustomLyrics: (lyrics: string) => void;
  customPromptMaxLength: number;
  onGenerateLyrics?: () => void;
  onClearCustomLyrics: () => void;
  vocalGender: string;
  setVocalGender: (gender: string) => void;
  vocalGenders: VocalGenderOption[];
  styleSection: React.ReactNode;
  songTitle: string;
  setSongTitle: (title: string) => void;
}

export const StudioCustomModeContent: React.FC<StudioCustomModeContentProps> = ({
  uploadCoverFile,
  uploadAudioPreview,
  onAddAudio,
  onOpenPersonaDialog,
  selectedPersonaName,
  selectedPersonaId,
  instrumentalMode,
  setInstrumentalMode,
  customLyrics,
  setCustomLyrics,
  customPromptMaxLength,
  onGenerateLyrics,
  onClearCustomLyrics,
  vocalGender,
  setVocalGender,
  vocalGenders,
  styleSection,
  songTitle,
  setSongTitle,
}) => {
  return (
    <>
      <div className="space-y-5 md:space-y-6 pt-2 md:pt-3">
        <section>
          {uploadCoverFile ? (
            uploadAudioPreview
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="studio-panel-card h-12 w-full justify-center rounded-2xl text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors"
                title="Add audio"
                onClick={onAddAudio}
              >
                <UploadCloud className="h-4 w-4" />
                <span className="text-sm font-semibold tracking-tight">Add Audio</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="studio-panel-card h-12 w-full justify-center rounded-2xl text-foreground/75 hover:text-foreground hover:bg-foreground/10 transition-colors"
                title="Select persona"
                onClick={onOpenPersonaDialog}
              >
                <Users className="h-4 w-4" />
                <span className="text-sm font-semibold tracking-tight">
                  {selectedPersonaName || (selectedPersonaId ? "Persona Selected" : "Select Persona")}
                </span>
              </Button>
            </div>
          )}
        </section>

        {!instrumentalMode ? (
          <section className="studio-panel-card rounded-2xl px-3 py-4">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                Lyrics
              </h3>
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
                  onClick={onClearCustomLyrics}
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="text-xs font-medium">Clear</span>
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="studio-panel-card rounded-2xl px-3 py-4">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                Lyrics
              </h3>
              <div className="flex items-center gap-2">
                <Switch
                  checked={instrumentalMode}
                  onCheckedChange={setInstrumentalMode}
                  className="scale-75"
                />
                <span className="text-xs text-muted-foreground">Instrumental</span>
              </div>
            </div>
            <div className="flex items-center justify-center py-4 px-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="text-sm font-medium">Instrumental Mode Active,no need to write lyrics</span>
              </div>
            </div>
          </section>
        )}

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
              {vocalGenders.map((gender) => (
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
  );
};

