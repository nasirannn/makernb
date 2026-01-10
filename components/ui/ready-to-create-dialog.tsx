"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Expand, Play, Pause, Music2 } from "lucide-react";

type ReadyMode = "cover" | "extend";

interface ReadyToCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  duration: number;
  audioUrl?: string | null;
  onSelect: (mode: ReadyMode) => void;
}

const formatClockTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const ReadyToCreateDialog = ({
  isOpen,
  onClose,
  fileName,
  duration,
  audioUrl,
  onSelect,
}: ReadyToCreateDialogProps) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen || !audioUrl) {
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
    audio.preload = "metadata";
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.src = "";
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, [isOpen, audioUrl]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    try {
      if (audioRef.current.paused) {
        await audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsPlaying(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[85vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
        <AlertDialogHeader className="relative flex-shrink-0 px-5 pt-4 pb-3 border-b border-border/40 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
          <div className="flex items-center justify-between">
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Upload Audio
              </div>
              <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                Select Creative Path
              </AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription>
            Choose how you want to use your uploaded audio.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-border/50 to-primary/10">
            <div className="rounded-2xl bg-muted/20 p-3 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handlePlayPause}
                  disabled={!audioUrl}
                  className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary transition hover:text-primary/80 hover:bg-primary/15 disabled:opacity-50"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-foreground truncate">
                    {fileName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatClockTime(isPlaying ? currentTime : 0)} / {formatClockTime(duration)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Next Step</div>
            <div className="text-base font-semibold text-foreground mt-1">Select a creative path</div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onSelect("cover")}
              className="group rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center transition group-hover:bg-primary/25">
                  <Music2 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-base font-semibold">Cover</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Restyle your track while keeping its core melody.
              </div>
              <div className="mt-3 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                Reimagine
              </div>
            </button>

            <button
              type="button"
              onClick={() => onSelect("extend")}
              className="group rounded-2xl border border-border/60 bg-gradient-to-br from-muted/30 via-transparent to-primary/10 p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-center transition group-hover:bg-muted/50 group-hover:border-primary/30">
                  <Expand className="h-4 w-4 text-primary" />
                </div>
                <div className="text-base font-semibold">Extend</div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Continue the flow and make it longer.
              </div>
              <div className="mt-3 inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Lengthen
              </div>
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 px-5 pb-4 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
