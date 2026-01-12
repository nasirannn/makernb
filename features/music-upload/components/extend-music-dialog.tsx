"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronUp, Play, Pause, HelpCircle, Pencil } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { ExtendMusicModel, getExtendMusicCredits } from "@/lib/credits-config";
import { formatDuration } from "@/lib/format-utils";
import { WaveformPlayer } from "@/components/ui/waveform-player";

export interface ExtendMusicParams {
  model: ExtendMusicModel;
  defaultParamFlag: boolean;
  prompt?: string;
  style?: string;
  title?: string;
  continueAt?: number;
  vocalGender?: "m" | "f";
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
}

export interface ExtendMusicDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: ExtendMusicParams) => Promise<{ taskId: string } | void> | void;
  trackTitle?: string;
  trackDuration?: number;
  originalStyle?: string;
  audioUrl?: string;
  userCredits?: number;
  getExtendMusicState?: (taskId: string) => any;
  selectedModel?: ExtendMusicModel;
}

export const ExtendMusicDialog: React.FC<ExtendMusicDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  trackTitle = "Track",
  trackDuration = 120,
  originalStyle = "",
  audioUrl,
  userCredits,
  getExtendMusicState,
  selectedModel = "V4",
}) => {
  const [isExtending, setIsExtending] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const formatContinueAt = useCallback((seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [title, setTitle] = useState("");
  const [continueAt, setContinueAt] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(trackDuration);

  const getEffectiveDurationSeconds = useCallback(() => {
    const duration = Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : trackDuration;
    return Math.max(0, Math.floor(duration));
  }, [audioDuration, trackDuration]);

  const clampContinueAt = useCallback(
    (seconds: number) => {
      const durationSeconds = getEffectiveDurationSeconds();
      if (durationSeconds <= 1) return 0;
      return Math.max(0, Math.min(Math.floor(seconds), durationSeconds - 1));
    },
    [getEffectiveDurationSeconds]
  );

  const clampContinueAtStrict = useCallback(
    (seconds: number) => {
      const durationSeconds = getEffectiveDurationSeconds();
      if (durationSeconds <= 1) return 0;
      return Math.max(1, Math.min(Math.floor(seconds), durationSeconds - 1));
    },
    [getEffectiveDurationSeconds]
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vocalGender, setVocalGender] = useState<"m" | "f" | "auto">("auto");
  const [styleWeight, setStyleWeight] = useState(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.65);
  const [audioWeight, setAudioWeight] = useState(0.65);
  const [personaId, setPersonaId] = useState("");
  const [isEditingContinueAt, setIsEditingContinueAt] = useState(false);
  const [continueAtInput, setContinueAtInput] = useState("");
  const continueAtInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!audioUrl || typeof window === "undefined" || !isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setIsPlaying(false);
    setCurrentTime(0);

    const handleTimeUpdate = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    };
    const handleLoadedMetadata = () => {
      if (audioRef.current) setAudioDuration(audioRef.current.duration || trackDuration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handlePause = () => {
      if (audioRef.current) {
        const paused = Math.floor(audioRef.current.currentTime);
        setContinueAt(paused);
        setIsPlaying(false);
      }
    };
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.pause();
      audio.src = "";
    };
  }, [audioUrl, trackDuration, isOpen]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error("Failed to play audio:", error);
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    const clamped = clampContinueAt(time);
    audioRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    setContinueAt(clamped);
  };

  const commitContinueAtInput = useCallback(() => {
    const raw = continueAtInput.trim();
    if (!raw) {
      setIsEditingContinueAt(false);
      return;
    }

    let seconds: number | null = null;
    if (raw.includes(":")) {
      const [m, s] = raw.split(":");
      const minutes = Number(m);
      const secs = Number(s);
      if (Number.isFinite(minutes) && Number.isFinite(secs)) {
        seconds = Math.floor(minutes * 60 + secs);
      }
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) seconds = Math.floor(parsed);
    }

    if (seconds === null || Number.isNaN(seconds)) {
      setIsEditingContinueAt(false);
      return;
    }

    handleSeek(clampContinueAtStrict(seconds));
    setIsEditingContinueAt(false);
  }, [clampContinueAtStrict, continueAtInput, handleSeek]);

  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  const requiredCredits = getExtendMusicCredits(selectedModel);
  const hasEnoughCredits = userCredits === undefined || userCredits >= requiredCredits;

  const durationSeconds = getEffectiveDurationSeconds();
  const isFormValid =
    prompt.trim().length > 0 &&
    style.trim().length > 0 &&
    title.trim().length > 0 &&
    continueAt > 0 &&
    continueAt < durationSeconds;

  const handleCloseAfterComplete = useCallback(() => {
    setIsExtending(false);
    setCurrentTaskId(null);
    setPrompt("");
    setStyle("");
    setTitle("");
    setContinueAt(0);
    setIsEditingContinueAt(false);
    setContinueAtInput("");
    setShowAdvanced(false);
    setVocalGender("auto");
    setStyleWeight(0.65);
    setWeirdnessConstraint(0.65);
    setAudioWeight(0.65);
    setPersonaId("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isExtending || !currentTaskId || !getExtendMusicState) return;
    const interval = setInterval(() => {
      const state = getExtendMusicState(currentTaskId);
      if (state && (state.status === "completed" || state.status === "error")) {
        handleCloseAfterComplete();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isExtending, currentTaskId, getExtendMusicState, handleCloseAfterComplete]);

  const handleConfirm = async () => {
    if (!hasEnoughCredits || !isFormValid || isExtending) return;
    try {
      const params: ExtendMusicParams = {
        model: selectedModel,
        defaultParamFlag: true,
        prompt,
        style,
        title,
        continueAt,
      };
      if (vocalGender && vocalGender !== "auto") params.vocalGender = vocalGender;
      if (styleWeight !== 0.65) params.styleWeight = styleWeight;
      if (weirdnessConstraint !== 0.65) params.weirdnessConstraint = weirdnessConstraint;
      if (audioWeight !== 0.65) params.audioWeight = audioWeight;
      if (personaId.trim()) params.personaId = personaId;

      setIsExtending(true);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);

      const result = await onConfirm(params);
      if (result && typeof result === "object" && "taskId" in result) {
        setCurrentTaskId(result.taskId);
      } else {
        handleCloseAfterComplete();
      }
    } catch (error) {
      console.error("Failed to extend music:", error);
      setIsExtending(false);
      setCurrentTaskId(null);
      handleCloseAfterComplete();
    }
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setPrompt("");
    setStyle("");
    setTitle("");
    setContinueAt(0);
    setIsEditingContinueAt(false);
    setContinueAtInput("");
    setShowAdvanced(false);
    setVocalGender("auto");
    setStyleWeight(0.65);
    setWeirdnessConstraint(0.65);
    setAudioWeight(0.65);
    setPersonaId("");
    setIsExtending(false);
    setCurrentTaskId(null);
    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-border/40 text-left relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="flex items-center justify-between pr-8">
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Extend Track</div>
              <DialogTitle className="text-xl font-semibold tracking-tight">Extend Music</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Extend &quot;{trackTitle}&quot; to create a longer version.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-5 py-4">
            <div className="space-y-4">
              <div className="space-y-3">
                {audioUrl ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-2xl bg-background p-3 shadow-sm">
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
                      <div className="relative flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handlePlayPause}
                            className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 border border-primary/30 text-primary transition hover:text-primary/80 hover:bg-primary/15 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                          </button>
                          <div className="min-w-0 flex flex-col justify-center gap-1">
                            <p className="text-sm font-semibold truncate text-foreground leading-none">{trackTitle}</p>
                            <p className="text-xs text-muted-foreground leading-none">
                              {formatContinueAt(currentTime)} / {formatContinueAt(audioDuration)}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <WaveformPlayer
                            audioUrl={audioUrl}
                            mediaElement={audioRef.current || undefined}
                            isPlaying={isPlaying}
                            onPlayPause={handlePlayPause}
                            onTimeUpdate={(time) => setCurrentTime(time)}
                            onPlayStateChange={(playing) => setIsPlaying(playing)}
                            onReadyDuration={(dur) => setAudioDuration(dur)}
                            showControls={false}
                            separateControls={false}
                            isLoading={!audioUrl}
                            syncWithIsPlaying={false}
                            backend="MediaElement"
                            waveHeight={54}
                            waveColor="rgba(255, 255, 255, 0.7)"
                            progressColor="rgba(255, 255, 255, 0.95)"
                            cursorColor="rgba(255, 255, 255, 0.95)"
                            cursorWidth={2}
                            className="rounded-lg bg-gradient-to-br from-primary/10 via-white/5 to-transparent"
                            showSelector
                            selectorOverlay
                            showSelectorEndHandle={false}
                            showSelectorLabels={false}
                            selectorStart={continueAt}
                            selectorEnd={audioDuration || 0}
                            externalCurrentTime={currentTime}
                            onSelectorStartChange={(time) => {
                              const clamped = Math.max(0, Math.min(time, audioDuration || time));
                              handleSeek(clamped);
                            }}
                          />
                          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate">Continue at</span>
                              {isEditingContinueAt ? (
                                <Input
                                  ref={continueAtInputRef}
                                  type="text"
                                  inputMode="numeric"
                                  value={continueAtInput}
                                  onChange={(e) => setContinueAtInput(e.target.value)}
                                  onBlur={commitContinueAtInput}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitContinueAtInput();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      setIsEditingContinueAt(false);
                                    }
                                  }}
                                  className="h-6 w-[88px] px-2 py-0 text-right text-xs font-mono tabular-nums bg-muted/20 border-border/50 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-border/50"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1 tabular-nums leading-none">
                                  <span className="leading-none">{formatContinueAt(continueAt)}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setContinueAtInput(formatContinueAt(continueAt));
                                      setIsEditingContinueAt(true);
                                      requestAnimationFrame(() => {
                                        continueAtInputRef.current?.focus();
                                        continueAtInputRef.current?.select();
                                      });
                                    }}
                                    className="inline-flex items-center justify-center rounded-md border border-border/50 bg-muted/20 p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
                                    aria-label="Edit continue at"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={0}
                      max={trackDuration}
                      value={continueAt}
                      onChange={(e) => setContinueAt(Number(e.target.value))}
                      placeholder="60"
                      className="w-full"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {audioUrl
                    ? "Play or drag on the waveform to choose where the extension starts."
                    : "Audio URL not available. Please enter the start time manually (0 - " + trackDuration + "s)."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="title"
                    type="text"
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Extended version title"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    {title.length}/80
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">
                  Style <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="style"
                    type="text"
                    maxLength={200}
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    placeholder="e.g., R&B, Soul"
                    className="pr-24"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    {style.length}/200
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Keep style consistent with original audio for best results</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">
                  Extension Description <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="prompt"
                    maxLength={3000}
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe how the music should continue or evolve..."
                    className="pr-20 pb-6"
                  />
                  <p className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none">
                    {prompt.length}/3000
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Vocal Gender (Optional)</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setVocalGender("auto")}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vocalGender === "auto"
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setVocalGender("m")}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vocalGender === "m"
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Male
                        </button>
                        <button
                          type="button"
                          onClick={() => setVocalGender("f")}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vocalGender === "f"
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Female
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="styleWeight">Style Weight</Label>
                          <Tooltip content="How closely to follow the style (0 = loose, 1 = strict)" position="right">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">{styleWeight.toFixed(2)}</span>
                      </div>
                      <Slider
                        id="styleWeight"
                        value={[styleWeight]}
                        onValueChange={(values) => setStyleWeight(values[0])}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="weirdnessConstraint">Creativity</Label>
                          <Tooltip content="Level of experimental/creative deviation (0 = safe, 1 = experimental)" position="right">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">{weirdnessConstraint.toFixed(2)}</span>
                      </div>
                      <Slider
                        id="weirdnessConstraint"
                        value={[weirdnessConstraint]}
                        onValueChange={(values) => setWeirdnessConstraint(values[0])}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="audioWeight">Audio Weight</Label>
                          <Tooltip content="Similarity to original (0 = creative, 1 = original)" position="right">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">{audioWeight.toFixed(2)}</span>
                      </div>
                      <Slider
                        id="audioWeight"
                        value={[audioWeight]}
                        onValueChange={(values) => setAudioWeight(values[0])}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!hasEnoughCredits && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                Insufficient credits. You need {requiredCredits - (userCredits || 0)} more credits to extend this track.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 pt-4 pb-6 border-t border-border/40">
          <Button
            onClick={handleConfirm}
            disabled={!hasEnoughCredits || !isFormValid || isExtending}
            className="w-full px-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExtending ? (
              <div className="flex items-center justify-center gap-2">
                <span>Extending</span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: "0.3s" }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: "0.6s" }}></div>
                </div>
              </div>
            ) : (
              `Extend (-${requiredCredits} credits)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
