"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WaveformPlayer, WaveformPlayerHandle } from "@/components/ui/waveform-player";
import { Play, Pause, X } from "lucide-react";

interface EditAudioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  audioFile: File | null;
  audioUrl: string | null;
  minDuration: number;
  maxDuration: number;
  modelLabel?: string;
  onSave: (file: File, duration: number, title: string) => void | Promise<void>;
}

const PRIMARY_WAVE_COLOR = "rgba(255, 255, 255, 0.35)";
const PRIMARY_PROGRESS_COLOR = "rgb(255, 255, 255)";
const PRIMARY_CURSOR_COLOR = "rgb(255, 255, 255)";

const formatClockTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const encodeWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const totalSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  let offset = 0;
  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset, value.charCodeAt(i));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, numChannels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let frame = 0; frame < numFrames; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = buffer.getChannelData(channel)[frame] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
};

const trimAudioFile = async (file: File, start: number, end: number) => {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    const sampleRate = decoded.sampleRate;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.max(startSample + 1, Math.floor(end * sampleRate));
    const length = endSample - startSample;
    const trimmed = audioCtx.createBuffer(decoded.numberOfChannels, length, sampleRate);

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const channelData = decoded.getChannelData(channel).slice(startSample, endSample);
      trimmed.copyToChannel(channelData, channel);
    }

    const wavBuffer = encodeWav(trimmed);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    await audioCtx.close();
  }
};

export const EditAudioDialog = ({
  isOpen,
  onClose,
  audioFile,
  audioUrl,
  minDuration,
  maxDuration,
  modelLabel,
  onSave,
}: EditAudioDialogProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [selectionStart, setSelectionStart] = React.useState(0);
  const [selectionEnd, setSelectionEnd] = React.useState(0);
  const [title, setTitle] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [durationError, setDurationError] = React.useState<string | null>(null);
  const waveformRef = React.useRef<WaveformPlayerHandle | null>(null);
  const selectionStartRef = React.useRef(0);
  const selectionEndRef = React.useRef(0);
  const flashTimersRef = React.useRef<number[]>([]);
  const durationEpsilon = 0.05;
  const activeError = error || durationError;
  const hasError = Boolean(activeError);
  const waveColor = hasError ? "rgba(239, 68, 68, 0.4)" : PRIMARY_WAVE_COLOR;
  const progressColor = hasError ? "rgb(239, 68, 68)" : PRIMARY_PROGRESS_COLOR;
  const cursorColor = hasError ? "rgb(239, 68, 68)" : PRIMARY_CURSOR_COLOR;
  const [flashSelector, setFlashSelector] = React.useState(false);
  const selectorColor = flashSelector ? "rgb(239, 68, 68)" : undefined;

  const triggerSelectorFlash = React.useCallback(() => {
    flashTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    flashTimersRef.current = [];

    const schedule = (fn: () => void, delay: number) => {
      const timer = window.setTimeout(fn, delay);
      flashTimersRef.current.push(timer);
    };

    schedule(() => setFlashSelector(true), 0);
    schedule(() => setFlashSelector(false), 180);
    schedule(() => setFlashSelector(true), 360);
    schedule(() => setFlashSelector(false), 540);
  }, []);
  const startPlayback = React.useCallback(() => {
    const current = waveformRef.current?.getCurrentTime() ?? 0;
    if (current < selectionStartRef.current || current > selectionEndRef.current) {
      waveformRef.current?.setTime(selectionStartRef.current);
    }
    waveformRef.current?.play();
  }, []);

  React.useEffect(() => {
    selectionStartRef.current = selectionStart;
  }, [selectionStart]);

  React.useEffect(() => {
    selectionEndRef.current = selectionEnd;
  }, [selectionEnd]);

  React.useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const current = waveformRef.current?.getCurrentTime() ?? 0;
      if (current >= selectionEndRef.current - 0.02) {
        waveformRef.current?.pause();
        waveformRef.current?.setTime(selectionStartRef.current);
        setIsPlaying(false);
        setCurrentTime(selectionStartRef.current);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  React.useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setSelectionStart(0);
      setSelectionEnd(0);
      setTitle("");
      setError(null);
      setDurationError(null);
      return;
    }
    if (audioFile && !title) {
      setTitle(audioFile.name.replace(/\.[^/.]+$/, ""));
    }
  }, [isOpen, audioFile, title]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (!duration || !Number.isFinite(duration)) {
      setDurationError(null);
      return;
    }
    const start = Math.max(0, Math.min(selectionStart, selectionEnd));
    const end = Math.min(Math.max(selectionStart, selectionEnd), duration);
    const clipLength = end - start;
    if (clipLength < minDuration || clipLength - maxDuration > durationEpsilon) {
      setDurationError(`Audio length must be between ${minDuration}s and ${Math.floor(maxDuration / 60)}m.`);
    } else {
      setDurationError(null);
    }
  }, [isOpen, duration, selectionStart, selectionEnd, minDuration, maxDuration]);

  React.useEffect(() => {
    return () => {
      flashTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      flashTimersRef.current = [];
    };
  }, []);

  const handleSave = async () => {
    if (!audioFile) return;
    setError(null);

    const safeDuration = duration || 0;
    const start = Math.max(0, Math.min(selectionStart, selectionEnd));
    const end = Math.min(Math.max(selectionStart, selectionEnd), safeDuration);
    const clipLength = end - start;
    const fallbackTitle = audioFile.name.replace(/\.[^/.]+$/, "");
    const nextTitle = title.trim() || fallbackTitle || "Untitled";

    if (!safeDuration || !Number.isFinite(safeDuration)) {
      setError("Audio is not ready yet. Please try again.");
      return;
    }

    if (clipLength < minDuration || clipLength - maxDuration > durationEpsilon) {
      setDurationError(`Audio length must be between ${minDuration}s and ${Math.floor(maxDuration / 60)}m.`);
      triggerSelectorFlash();
      return;
    }

    setIsSaving(true);
    try {
      let nextFile = audioFile;
      if (start > 0 || end < safeDuration) {
        const trimmedBlob = await trimAudioFile(audioFile, start, end);
        const baseName = nextTitle;
        nextFile = new File([trimmedBlob], `${baseName}.wav`, { type: "audio/wav" });
      }
      await onSave(nextFile, clipLength, nextTitle);
      onClose();
    } catch (err) {
      console.error("Failed to trim audio:", err);
      setError("Failed to process audio. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[620px] max-h-[82vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-border/40 text-left relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="flex items-center justify-between pr-8">
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Upload Audio
              </div>
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Edit Audio
              </DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Select the section you want to keep before uploading.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 px-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-full text-left text-sm font-medium text-muted-foreground">
              {title || "Untitled"}
            </div>

            <div className="flex w-full items-baseline justify-between gap-4">
              <div className="text-left text-lg font-mono tracking-widest text-foreground">
                {formatClockTime(currentTime)} / {formatClockTime(duration || 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                {modelLabel ? `Model ${modelLabel} · ` : ""}Audio Length {minDuration}s ~ {Math.floor(maxDuration / 60)}m
              </div>
            </div>

            <div className="w-full flex items-center gap-6 items-stretch">
              <button
                type="button"
                onClick={() => {
                  if (isPlaying) {
                    waveformRef.current?.pause();
                    setIsPlaying(false);
                    return;
                  }
                  startPlayback();
                }}
                className="flex h-[68px] w-[68px] items-center justify-center rounded-full border border-primary/40 bg-transparent text-primary shadow-sm transition-colors hover:bg-white/5"
                disabled={!audioUrl}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6 fill-current" />
                ) : (
                  <Play className="h-6 w-6 fill-current" />
                )}
              </button>

              <div className="flex-1 h-[68px]">
                <WaveformPlayer
                  ref={waveformRef}
                  audioUrl={audioUrl}
                  isPlaying={isPlaying}
                  onPlayPause={() => {
                    if (isPlaying) {
                      waveformRef.current?.pause();
                      setIsPlaying(false);
                      return;
                    }
                    startPlayback();
                  }}
                  onFinish={() => {
                    setIsPlaying(false);
                    waveformRef.current?.setTime(selectionStartRef.current);
                    setCurrentTime(selectionStartRef.current);
                  }}
                  onReadyDuration={(readyDuration) => {
                    setDuration(readyDuration);
                    setSelectionStart(0);
                    setSelectionEnd(readyDuration);
                  }}
                  onTimeUpdate={(time) => {
                    setCurrentTime(time);
                    if (isPlaying && time >= selectionEndRef.current - 0.02) {
                      waveformRef.current?.pause();
                      waveformRef.current?.setTime(selectionStartRef.current);
                      setIsPlaying(false);
                      setCurrentTime(selectionStartRef.current);
                    }
                  }}
                  onPlayStateChange={(playing) => setIsPlaying(playing)}
                  showControls={false}
                  separateControls={false}
                  showSelector={true}
                  selectorOverlay={true}
                  showSelectorLabels={true}
                  selectorStart={selectionStart}
                  selectorEnd={selectionEnd}
                  onSelectorStartChange={setSelectionStart}
                  onSelectorEndChange={setSelectionEnd}
                  onSelectorHandleRelease={(handle) => {
                    if (handle !== "end") return;
                    waveformRef.current?.setTime(selectionStartRef.current);
                    waveformRef.current?.pause();
                    setIsPlaying(false);
                    setCurrentTime(selectionStartRef.current);
                  }}
                  waveHeight={60}
                  waveColor={waveColor}
                  progressColor={progressColor}
                  cursorColor={cursorColor}
                  selectorColor={selectorColor}
                  cursorWidth={3}
                  backend="MediaElement"
                />
              </div>
            </div>

            {activeError && (
              <div className="w-full px-3 mt-2 text-xs text-destructive/90 text-center">
                {activeError}
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 px-6 pb-6 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto h-10 rounded-lg bg-muted/70 text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !audioFile}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
