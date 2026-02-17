"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WaveformPlayer, WaveformPlayerHandle } from "@/components/ui/waveform-player";
import { Pause, Play, UploadCloud } from "lucide-react";
import { useTheme } from "next-themes";

interface MashupEditedTrack {
  file: File;
  title: string;
  duration: number;
}

interface MashupEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  minDuration: number;
  maxDuration: number;
  onSave: (tracks: MashupEditedTrack[]) => void | Promise<void>;
}

type SlotState = {
  file: File | null;
  audioUrl: string | null;
  title: string;
  duration: number;
  currentTime: number;
  selectionStart: number;
  selectionEnd: number;
  isPlaying: boolean;
};

const PRIMARY_WAVE_COLOR_DARK = "rgba(255, 255, 255, 0.35)";
const PRIMARY_PROGRESS_COLOR_DARK = "rgb(255, 255, 255)";
const PRIMARY_CURSOR_COLOR_DARK = "rgb(255, 255, 255)";
const PRIMARY_WAVE_COLOR_LIGHT = "#d1d5db";
const PRIMARY_PROGRESS_COLOR_LIGHT = "#d1d5db";
const PRIMARY_CURSOR_COLOR_LIGHT = "hsl(262, 100%, 70%)";
const PRIMARY_SELECTOR_COLOR = "hsl(262, 100%, 70%)";
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const SLOT_COUNT = 2;

const createEmptySlot = (): SlotState => ({
  file: null,
  audioUrl: null,
  title: "",
  duration: 0,
  currentTime: 0,
  selectionStart: 0,
  selectionEnd: 0,
  isPlaying: false,
});

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

export const MashupEditDialog = ({
  isOpen,
  onClose,
  minDuration,
  maxDuration,
  onSave,
}: MashupEditDialogProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [slots, setSlots] = React.useState<SlotState[]>(() => [createEmptySlot(), createEmptySlot()]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fileInputRefs = React.useRef<Array<HTMLInputElement | null>>(Array.from({ length: SLOT_COUNT }, () => null));
  const waveformRefs = React.useRef<Array<WaveformPlayerHandle | null>>(Array.from({ length: SLOT_COUNT }, () => null));
  const slotsRef = React.useRef<SlotState[]>([createEmptySlot(), createEmptySlot()]);
  const selectionRefs = React.useRef<Array<{ start: number; end: number }>>(
    Array.from({ length: SLOT_COUNT }, () => ({ start: 0, end: 0 }))
  );

  const waveColor = isDark ? PRIMARY_WAVE_COLOR_DARK : PRIMARY_WAVE_COLOR_LIGHT;
  const progressColor = isDark ? PRIMARY_PROGRESS_COLOR_DARK : PRIMARY_PROGRESS_COLOR_LIGHT;
  const cursorColor = isDark ? PRIMARY_CURSOR_COLOR_DARK : PRIMARY_CURSOR_COLOR_LIGHT;

  const clearSlotObjectUrls = React.useCallback((targetSlots: SlotState[]) => {
    targetSlots.forEach((slot) => {
      if (slot.audioUrl) {
        URL.revokeObjectURL(slot.audioUrl);
      }
    });
  }, []);

  React.useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  React.useEffect(() => {
    if (isOpen) return;

    waveformRefs.current.forEach((waveform) => waveform?.pause());
    setSlots((prev) => {
      clearSlotObjectUrls(prev);
      return [createEmptySlot(), createEmptySlot()];
    });
    setError(null);
    setIsSaving(false);
    selectionRefs.current = Array.from({ length: SLOT_COUNT }, () => ({ start: 0, end: 0 }));
  }, [isOpen, clearSlotObjectUrls]);

  React.useEffect(() => {
    return () => {
      waveformRefs.current.forEach((waveform) => waveform?.pause());
      clearSlotObjectUrls(slotsRef.current);
    };
  }, [clearSlotObjectUrls]);

  const updateSlot = React.useCallback((index: number, patch: Partial<SlotState>) => {
    setSlots((prev) => prev.map((slot, slotIndex) => {
      if (slotIndex !== index) return slot;
      return { ...slot, ...patch };
    }));
  }, []);

  const getDurationError = React.useCallback((slot: SlotState) => {
    if (!slot.file || !slot.duration || !Number.isFinite(slot.duration)) {
      return null;
    }
    const start = Math.max(0, Math.min(slot.selectionStart, slot.selectionEnd));
    const end = Math.min(Math.max(slot.selectionStart, slot.selectionEnd), slot.duration);
    const clipLength = end - start;
    if (clipLength < minDuration || clipLength > maxDuration) {
      return `Audio length must be between ${minDuration}s and ${Math.floor(maxDuration / 60)}m.`;
    }
    return null;
  }, [maxDuration, minDuration]);

  const setSlotFile = React.useCallback((index: number, file: File) => {
    if (!file.type.startsWith("audio/")) {
      setError("Unsupported file type. Please upload audio files only.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Each file must be under 100MB.");
      return;
    }

    setError(null);
    setSlots((prev) => prev.map((slot, slotIndex) => {
      if (slotIndex !== index) return slot;
      if (slot.audioUrl) {
        URL.revokeObjectURL(slot.audioUrl);
      }
      const nextUrl = URL.createObjectURL(file);
      return {
        file,
        audioUrl: nextUrl,
        title: file.name.replace(/\.[^/.]+$/, ""),
        duration: 0,
        currentTime: 0,
        selectionStart: 0,
        selectionEnd: 0,
        isPlaying: false,
      };
    }));
    selectionRefs.current[index] = { start: 0, end: 0 };
  }, []);

  const openFilePicker = React.useCallback((index: number) => {
    fileInputRefs.current[index]?.click();
  }, []);

  const stopOtherPlayback = React.useCallback((index: number) => {
    setSlots((prev) => prev.map((slot, slotIndex) => {
      if (slotIndex === index) return slot;
      if (slot.isPlaying) {
        waveformRefs.current[slotIndex]?.pause();
        return {
          ...slot,
          isPlaying: false,
        };
      }
      return slot;
    }));
  }, []);

  const handlePlayPause = React.useCallback((index: number) => {
    const slot = slots[index];
    if (!slot.audioUrl) return;

    if (slot.isPlaying) {
      waveformRefs.current[index]?.pause();
      updateSlot(index, { isPlaying: false });
      return;
    }

    stopOtherPlayback(index);

    const selection = selectionRefs.current[index];
    const current = waveformRefs.current[index]?.getCurrentTime() ?? 0;
    if (current < selection.start || current > selection.end) {
      waveformRefs.current[index]?.setTime(selection.start);
    }
    waveformRefs.current[index]?.play();
  }, [slots, stopOtherPlayback, updateSlot]);

  const canSave = React.useMemo(() => {
    if (slots.some((slot) => !slot.file || !slot.audioUrl)) {
      return false;
    }
    if (slots.some((slot) => Boolean(getDurationError(slot)))) {
      return false;
    }
    return true;
  }, [getDurationError, slots]);

  const handleSave = React.useCallback(async () => {
    if (!canSave) {
      setError("Please select 2 audio files and keep each clip within the allowed length.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const editedTracks = await Promise.all(slots.map(async (slot, index) => {
        const sourceFile = slot.file;
        if (!sourceFile) {
          throw new Error(`Audio ${index + 1} is missing.`);
        }

        const safeDuration = slot.duration || 0;
        const start = Math.max(0, Math.min(slot.selectionStart, slot.selectionEnd));
        const end = Math.min(Math.max(slot.selectionStart, slot.selectionEnd), safeDuration);
        const clipLength = end - start;
        const fallbackTitle = sourceFile.name.replace(/\.[^/.]+$/, "") || `Mashup Audio ${index + 1}`;
        const nextTitle = slot.title.trim() || fallbackTitle;

        if (!safeDuration || !Number.isFinite(safeDuration)) {
          throw new Error(`Audio ${index + 1} is not ready yet.`);
        }

        if (clipLength < minDuration || clipLength > maxDuration) {
          throw new Error(`Audio ${index + 1} length must be between ${minDuration}s and ${Math.floor(maxDuration / 60)}m.`);
        }

        let nextFile = sourceFile;
        if (start > 0 || end < safeDuration) {
          const trimmedBlob = await trimAudioFile(sourceFile, start, end);
          nextFile = new File([trimmedBlob], `${nextTitle}.wav`, { type: "audio/wav" });
        }

        return {
          file: nextFile,
          title: nextTitle,
          duration: clipLength,
        };
      }));

      await onSave(editedTracks);
      onClose();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to process mashup audio.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }, [canSave, maxDuration, minDuration, onClose, onSave, slots]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[720px] max-h-[85vh] flex flex-col p-0 border-0 bg-background shadow-xl">
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 text-left relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="relative">
            <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Upload Audio
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Mashup Audio
            </DialogTitle>
          </div>
          <DialogDescription>
            Select exactly 2 audio files. You can drag both handles to keep only the section you want.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {slots.map((slot, index) => {
            const slotError = getDurationError(slot);
            const hasSelectedAudio = Boolean(slot.file && slot.audioUrl);

            return (
              <div
                key={`mashup-slot-${index}`}
                className={hasSelectedAudio ? "rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-border/50 to-primary/10" : "rounded-2xl"}
              >
                <div className={hasSelectedAudio ? "relative overflow-hidden rounded-2xl bg-background p-3 shadow-sm" : "relative"}>
                  <input
                    ref={(node) => {
                      fileInputRefs.current[index] = node;
                    }}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) {
                        setSlotFile(index, file);
                      }
                    }}
                  />

                  {hasSelectedAudio ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Audio {index + 1}
                          </div>
                          <div className="text-sm font-semibold text-foreground truncate">
                            {slot.title || slot.file?.name || "Untitled Audio"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-full bg-foreground/5 px-3 text-xs"
                          onClick={() => openFilePicker(index)}
                        >
                          Replace
                        </Button>
                      </div>

                      <div className="flex w-full items-baseline justify-between gap-4">
                        <div className="text-sm font-mono tracking-widest text-foreground">
                          {formatClockTime(slot.currentTime)} / {formatClockTime(slot.duration || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Audio Length {minDuration}s ~ {Math.floor(maxDuration / 60)}m
                        </div>
                      </div>

                      <div className="w-full bg-muted/20 backdrop-blur-md rounded-md px-3 h-[68px] flex items-stretch gap-3">
                        <button
                          type="button"
                          onClick={() => handlePlayPause(index)}
                          className="flex h-full w-[68px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!slot.audioUrl}
                        >
                          {slot.isPlaying ? (
                            <Pause className="h-5 w-5 fill-current" />
                          ) : (
                            <Play className="h-5 w-5 fill-current" />
                          )}
                        </button>

                        <div className="flex-1 h-full">
                          <WaveformPlayer
                            ref={(node) => {
                              waveformRefs.current[index] = node;
                            }}
                            audioUrl={slot.audioUrl}
                            audioBlob={slot.file}
                            isPlaying={slot.isPlaying}
                            onPlayPause={() => handlePlayPause(index)}
                            onFinish={() => {
                              const start = selectionRefs.current[index].start;
                              waveformRefs.current[index]?.setTime(start);
                              updateSlot(index, {
                                isPlaying: false,
                                currentTime: start,
                              });
                            }}
                            onReadyDuration={(readyDuration) => {
                              selectionRefs.current[index] = { start: 0, end: readyDuration };
                              updateSlot(index, {
                                duration: readyDuration,
                                selectionStart: 0,
                                selectionEnd: readyDuration,
                                currentTime: 0,
                              });
                            }}
                            onTimeUpdate={(time) => {
                              const selection = selectionRefs.current[index];
                              if (slots[index]?.isPlaying && time >= selection.end - 0.02) {
                                waveformRefs.current[index]?.pause();
                                waveformRefs.current[index]?.setTime(selection.start);
                                updateSlot(index, {
                                  isPlaying: false,
                                  currentTime: selection.start,
                                });
                                return;
                              }

                              setSlots((prev) => prev.map((item, slotIndex) => {
                                if (slotIndex !== index) return item;
                                return {
                                  ...item,
                                  currentTime: time,
                                };
                              }));
                            }}
                            onPlayStateChange={(playing) => {
                              if (playing) {
                                stopOtherPlayback(index);
                              }
                              updateSlot(index, { isPlaying: playing });
                            }}
                            showControls={false}
                            separateControls={false}
                            showSelector={true}
                            selectorOverlay={true}
                            showSelectorLabels={false}
                            selectorStart={slot.selectionStart}
                            selectorEnd={slot.selectionEnd}
                            onSelectorStartChange={(time) => {
                              const maxStart = Math.max(0, slot.selectionEnd - 0.5);
                              const nextStart = Math.min(Math.max(0, time), maxStart);
                              selectionRefs.current[index].start = nextStart;
                              updateSlot(index, { selectionStart: nextStart });
                            }}
                            onSelectorEndChange={(time) => {
                              const minEnd = slot.selectionStart + 0.5;
                              const nextEnd = Math.max(minEnd, Math.min(slot.duration || 0, time));
                              selectionRefs.current[index].end = nextEnd;
                              updateSlot(index, { selectionEnd: nextEnd });
                            }}
                            onSelectorHandleRelease={() => {
                              const start = selectionRefs.current[index].start;
                              waveformRefs.current[index]?.setTime(start);
                              waveformRefs.current[index]?.pause();
                              updateSlot(index, {
                                currentTime: start,
                                isPlaying: false,
                              });
                            }}
                            waveHeight={68}
                            waveColor={waveColor}
                            progressColor={progressColor}
                            cursorColor={cursorColor}
                            selectorColor={PRIMARY_SELECTOR_COLOR}
                            cursorWidth={3}
                            backend="MediaElement"
                            chrome={false}
                            className="w-full h-full"
                          />
                        </div>
                      </div>

                      {slotError && (
                        <div className="px-1 text-xs text-destructive/90">
                          {slotError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => openFilePicker(index)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openFilePicker(index);
                        }
                      }}
                      className="rounded-2xl border border-dashed border-slate-300/35 dark:border-slate-700/25 min-h-[180px] px-4 py-7 text-center cursor-pointer transition-colors hover:border-primary/30 flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-semibold text-foreground">Click to select audio</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Required · audio only · max 100MB
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive/90">
              {error}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 pb-6 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto h-10 rounded-lg border-0 bg-foreground/5 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? "Saving..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { MashupEditedTrack };
