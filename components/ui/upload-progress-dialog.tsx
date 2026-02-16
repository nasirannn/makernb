"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Expand, Loader2, Music2, Pause, Play, XCircle } from "lucide-react";

export interface UploadProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  status: "uploading" | "error" | "ready";
  errorMessage?: string;
  audioUrl?: string | null;
  duration?: number;
  onSelect?: (mode: "cover" | "extend") => void;
  variant?: "default" | "audio-preview";
  confirmMode?: "cover" | "extend";
}

export const UploadProgressDialog = ({
  isOpen,
  onClose,
  fileName = "Audio",
  status,
  errorMessage,
  audioUrl,
  duration = 0,
  onSelect,
  variant = "default",
  confirmMode,
}: UploadProgressDialogProps) => {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen || status !== "ready" || !audioUrl) {
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
  }, [isOpen, status, audioUrl]);

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

  const formatClockTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "00:00";
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isReady = status === "ready";
  const isUploading = status === "uploading";
  const disableActions = !isReady;
  const isAudioPreviewVariant = variant === "audio-preview";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[85vh] flex flex-col overflow-hidden rounded-[28px] p-0 border-0 bg-background shadow-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent" />
        <DialogHeader className="relative px-6 pt-5 pb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {isAudioPreviewVariant ? "Audio Preview" : "Processing Upload"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {status === "error" ? "Something went wrong while uploading. Please try again." : "We are preparing your track."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {status === "error" ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
                  <div className="relative bg-red-500/90 rounded-2xl p-3 shadow-lg">
                    <XCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-base font-semibold text-foreground">Upload Failed</h3>
                  <p className="text-sm text-foreground/80">{fileName}</p>
                  <p className="text-sm text-red-500">
                    {errorMessage || "Upload failed. Please try again."}
                    {errorMessage &&
                    !errorMessage.toLowerCase().includes("fetch failed") &&
                    !errorMessage.toLowerCase().includes("try again")
                      ? " Please try again."
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                className={
                  isAudioPreviewVariant
                    ? "rounded-2xl bg-muted/55 dark:bg-muted/25"
                    : "rounded-2xl p-[1px] bg-gradient-to-br from-primary/40 via-border/50 to-primary/10"
                }
              >
                <div
                  className={`relative overflow-hidden rounded-2xl p-3 shadow-sm ${
                    isAudioPreviewVariant
                      ? "bg-transparent"
                      : "bg-white/85 dark:bg-muted/20 ring-1 ring-black/5 dark:ring-white/10"
                  }`}
                >
                  {isUploading && <div className="audio-preview-sheen absolute inset-0" />}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={isReady ? handlePlayPause : undefined}
                      disabled={!isReady}
                      className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary transition hover:text-primary/80 hover:bg-primary/15 disabled:opacity-60"
                    >
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isPlaying ? (
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
                        {formatClockTime(isReady ? currentTime : 0)} / {formatClockTime(duration)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!isAudioPreviewVariant && (
                <>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Next Step</div>
                    <div className="text-base font-semibold text-foreground mt-1">Select a creative path</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => onSelect?.("cover")}
                      disabled={disableActions}
                      className={`group rounded-2xl border p-3 text-left shadow-sm transition-all ${
                        disableActions
                          ? "border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : "border-primary/30 bg-transparent hover:-translate-y-0.5 hover:bg-gradient-to-br hover:from-primary/15 hover:via-primary/5 hover:to-transparent hover:border-primary/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                          disableActions ? "bg-muted/40 border-border/60 text-muted-foreground" : "bg-transparent border-primary/20 text-primary group-hover:bg-primary/20 group-hover:border-primary/40"
                        }`}>
                          <Music2 className="h-4 w-4" />
                        </div>
                        <div className="text-base font-semibold">Cover</div>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Restyle your track while keeping its core melody.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelect?.("extend")}
                      disabled={disableActions}
                      className={`group rounded-2xl border p-3 text-left shadow-sm transition-all ${
                        disableActions
                          ? "border-border/40 bg-muted/30 text-muted-foreground cursor-not-allowed"
                          : "border-primary/30 bg-transparent hover:-translate-y-0.5 hover:bg-gradient-to-br hover:from-primary/15 hover:via-primary/5 hover:to-transparent hover:border-primary/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.22)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                          disableActions ? "bg-muted/40 border-border/60 text-muted-foreground" : "bg-transparent border-primary/20 text-primary group-hover:bg-primary/20 group-hover:border-primary/40"
                        }`}>
                          <Expand className="h-4 w-4" />
                        </div>
                        <div className="text-base font-semibold">Extend</div>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Continue the flow and make it longer.
                      </div>
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {isAudioPreviewVariant && (
          <div className="flex-shrink-0 px-6 pb-6 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-11"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!confirmMode) return;
                  onSelect?.(confirmMode);
                }}
                disabled={disableActions || !confirmMode}
                className="h-11"
              >
                Confirm
              </Button>
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};
