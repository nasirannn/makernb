"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

export interface MashupConfirmTrack {
  fileName: string;
  audioUrl: string;
  duration: number;
}

interface MashupUploadConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tracks: MashupConfirmTrack[];
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
  errorMessage?: string | null;
}

const formatClockTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const MashupUploadConfirmDialog = ({
  isOpen,
  onClose,
  tracks,
  onConfirm,
  isConfirming = false,
  errorMessage,
}: MashupUploadConfirmDialogProps) => {
  const audioRefs = React.useRef<Array<HTMLAudioElement | null>>([]);
  const [playingIndex, setPlayingIndex] = React.useState<number | null>(null);
  const [currentTimes, setCurrentTimes] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!isOpen) {
      audioRefs.current.forEach((audio) => audio?.pause());
      setPlayingIndex(null);
      setCurrentTimes([]);
      return;
    }

    setCurrentTimes(tracks.map(() => 0));
  }, [isOpen, tracks]);

  React.useEffect(() => {
    const currentAudioRefs = audioRefs.current;
    return () => {
      currentAudioRefs.forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  const handlePlayPause = React.useCallback(async (index: number) => {
    const targetAudio = audioRefs.current[index];
    if (!targetAudio) return;

    try {
      if (playingIndex === index && !targetAudio.paused) {
        targetAudio.pause();
        setPlayingIndex(null);
        return;
      }

      audioRefs.current.forEach((audio, audioIndex) => {
        if (!audio || audioIndex === index) return;
        audio.pause();
      });

      await targetAudio.play();
      setPlayingIndex(index);
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingIndex(null);
    }
  }, [playingIndex]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[85vh] flex flex-col p-0 border-0 bg-background shadow-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />
        <DialogHeader className="relative px-6 pt-5 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Processing Upload
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Confirm your 2 selected audio clips for mashup generation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {tracks.map((track, index) => {
            const currentTime = currentTimes[index] || 0;
            const isPlaying = playingIndex === index;

            return (
              <div key={`${track.fileName}-${index}`} className="rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-border/50 to-primary/10">
                <div className="relative overflow-hidden rounded-2xl bg-white/85 dark:bg-muted/20 p-3 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                  <audio
                    ref={(node) => {
                      audioRefs.current[index] = node;
                    }}
                    src={track.audioUrl}
                    preload="metadata"
                    onPlay={() => {
                      setPlayingIndex(index);
                    }}
                    onPause={() => {
                      setPlayingIndex((prev) => (prev === index ? null : prev));
                    }}
                    onEnded={() => {
                      setPlayingIndex((prev) => (prev === index ? null : prev));
                      setCurrentTimes((prev) => prev.map((time, timeIndex) => (timeIndex === index ? 0 : time)));
                    }}
                    onTimeUpdate={(event) => {
                      const audio = event.currentTarget;
                      setCurrentTimes((prev) => prev.map((time, timeIndex) => (timeIndex === index ? audio.currentTime : time)));
                    }}
                  />

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handlePlayPause(index)}
                      className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition hover:text-primary/80 hover:bg-primary/15"
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 fill-current" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-foreground truncate">
                        {track.fileName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatClockTime(currentTime)} / {formatClockTime(track.duration)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive/90">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 pb-6 flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full sm:w-auto h-10 rounded-lg border-0 bg-foreground/5 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isConfirming || tracks.length !== 2}>
            {isConfirming ? "Confirming..." : "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
