"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Check,
  ChevronLeft,
  Clock,
  Download,
  Pause,
  Play,
  Share2
} from "lucide-react";
import Image from "next/image";
import { LoadingDots } from "./loading-dots";
import { CassetteTape } from "./cassette-tape";
import { toast } from "sonner";
import { useAudioPlayingState } from "@/hooks/use-audio-playing-state";
import { getEventBus, COVER_EVENTS, TRACK_EVENTS } from "@/lib/event-bus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format-utils";
import { FooterSection } from "@/components/layout/sections/footer";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/ui/auth-modal";
import { usePricingModal } from "@/contexts/PricingModalContext";
import { useFeaturePermissions } from "@/contexts/FeaturePermissionsContext";

interface TrackDetailViewProps {
  trackData?: TrackInfo;
  trackId?: string;
  onBack: () => void;
  onPlayTrack?: (trackInfo: TrackInfo) => void;
  onDownload?: (trackInfo: TrackInfo, format: "mp3" | "wav") => void;
  fullPage?: boolean;
}

export interface TrackInfo {
  id: string;
  title: string;
  tags: string;
  lyrics: string;
  coverImage: string | null;
  audioUrl: string;
  createdAt: string;
  duration: string;
  isPublished: boolean;
  isFavorited: boolean;
  userId?: string;
  status?: string;
  model?: string;
}

export const TrackDetailView: React.FC<TrackDetailViewProps> = ({
  trackData,
  trackId,
  onBack: _onBack,
  onPlayTrack,
  onDownload,
  fullPage = false
}) => {
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(trackData || null);
  const [isLoading, setIsLoading] = useState(!trackData);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const audioState = useAudioPlayingState({ trackId: trackInfo?.id });
  const { user } = useAuth();
  const { openModal: openPricingModal } = usePricingModal();
  const { hasPermission } = useFeaturePermissions();

  useEffect(() => {
    if (trackData) {
      setTrackInfo(trackData);
      setIsLoading(false);
      return;
    }

    if (!trackData && trackId) {
      const fetchTrackInfo = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const response = await fetch(`/api/track-info/${trackId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch track info");
          }
          const data = await response.json();
          if (data.success && data.track) {
            const apiTrack = data.track;
            setTrackInfo({
              id: apiTrack.id,
              title: apiTrack.title,
              tags: apiTrack.tags || "",
              lyrics: apiTrack.lyrics || "",
              coverImage: apiTrack.coverImage,
              audioUrl: apiTrack.audioUrl || "",
              createdAt: apiTrack.createdAt,
              duration: apiTrack.duration?.toString() || "0",
              isPublished: apiTrack.isPublished || false,
              isFavorited: apiTrack.isFavorited || false,
              userId: apiTrack.userId,
              status: apiTrack.status,
              model: apiTrack.model
            });
          } else {
            throw new Error("Invalid response format");
          }
        } catch (err) {
          console.error("Error fetching track info:", err);
          setError("Failed to load track information");
          toast.error("Failed to load track");
        } finally {
          setIsLoading(false);
        }
      };

      fetchTrackInfo();
    }
  }, [trackData, trackId]);

  useEffect(() => {
    if (typeof window === "undefined" || !trackInfo?.id) return;
    const eventBus = getEventBus();

    const handleCoverUpdated = (data: { trackId: string; coverUrl: string }) => {
      if (trackInfo?.id === data.trackId) {
        setTrackInfo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            coverImage: data.coverUrl
          };
        });
      }
    };

    eventBus.on(COVER_EVENTS.UPDATED, handleCoverUpdated);
    return () => {
      eventBus.off(COVER_EVENTS.UPDATED, handleCoverUpdated);
    };
  }, [trackInfo?.id]);

  useEffect(() => {
    if (typeof window === "undefined" || !trackInfo?.id) return;
    const eventBus = getEventBus();

    const handleTrackCompleted = (data: { trackId: string; duration: number; audioUrl: string }) => {
      if (trackInfo?.id === data.trackId) {
        setTrackInfo((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            duration: data.duration.toString(),
            audioUrl: data.audioUrl,
            status: "complete"
          };
        });
      }
    };

    eventBus.on(TRACK_EVENTS.COMPLETED, handleTrackCompleted);
    return () => {
      eventBus.off(TRACK_EVENTS.COMPLETED, handleTrackCompleted);
    };
  }, [trackInfo?.id]);

  const tagsArray = useMemo(() => {
    return trackInfo?.tags ? trackInfo.tags.split(/[,，]/).map((tag: string) => tag.trim()).filter(Boolean) : [];
  }, [trackInfo?.tags]);

  const isPlayable = Boolean(trackInfo?.audioUrl && onPlayTrack);
  const isDownloadable = Boolean(trackInfo?.audioUrl && onDownload);
  const canDownloadTrack = hasPermission("download_mp3_track") || hasPermission("download_wav_track");

  const ensureDownloadAccess = React.useCallback(() => {
    if (!isDownloadable) return false;
    if (!user) {
      setAuthModalOpen(true);
      return false;
    }
    if (!canDownloadTrack) {
      openPricingModal();
      return false;
    }
    return true;
  }, [isDownloadable, user, canDownloadTrack, openPricingModal]);

  const formatDuration = (duration: string | number) => {
    const seconds = typeof duration === "string" ? parseFloat(duration) : duration;
    if (isNaN(seconds) || seconds <= 0) {
      return "0:00";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatModelLabel = (value?: string) => {
    if (!value) return null;
    if (value === "V4_5PLUS") return "V4.5+";
    if (value === "V4_5ALL") return "V4.5ALL";
    if (value === "V4_5") return "V4.5";
    if (value === "V4") return "V4";
    if (value === "V5") return "V5";
    return value.replace("_", ".");
  };

  const modelLabel = useMemo(
    () => formatModelLabel(trackInfo?.model),
    [trackInfo?.model]
  );

  const handleShare = () => {
    if (!trackInfo) return;
    const url = `${window.location.origin}/track/${trackInfo.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (isLoading) {
    const loadingContainerClasses = fullPage
      ? "flex min-h-screen w-full items-center justify-center bg-background"
      : "flex h-full w-full items-center justify-center bg-background";

    return (
      <div className={loadingContainerClasses}>
        <LoadingDots size="lg" />
      </div>
    );
  }

  if (error || !trackInfo) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-background p-6 text-center space-y-4">
        <p className="text-muted-foreground">{error || "Track not found"}</p>
        <Button onClick={_onBack} variant="outline" className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to List
        </Button>
      </div>
    );
  }

  const detailContent = (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-10 text-white">
      <div className="w-full rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(156,56,255,0.18),transparent_60%)] bg-gradient-to-br from-[rgba(33,18,55,0.95)] via-[rgba(12,16,34,0.95)] to-[rgba(5,7,18,0.93)] text-white shadow-[0_25px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-col items-center gap-10 p-6 sm:p-10 lg:flex-row lg:items-stretch">
          <div className="relative flex w-full justify-center lg:w-auto">
            <div className="absolute inset-y-8 h-72 w-72 -translate-y-6 rounded-full bg-[#a855f7]/30 blur-3xl" />
            <div className="relative flex h-64 w-64 items-center justify-center rounded-full border border-white/15 bg-black/40 shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden">
              {trackInfo.coverImage ? (
                <Image
                  src={trackInfo.coverImage}
                  alt={trackInfo.title}
                  fill
                  sizes="(min-width: 1024px) 16rem, 80vw"
                  className="rounded-full object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black/60">
                  <CassetteTape
                    className="h-[210px] w-[210px]"
                    isPlaying={audioState.isPlaying && audioState.isCurrentTrack}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-6 text-left text-white/90 lg:w-[640px]">
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight drop-shadow-[0_6px_25px_rgba(0,0,0,0.55)] sm:text-5xl">
                {trackInfo.title}
              </h1>
            </div>

            {tagsArray.length > 0 && (
              <div className="flex flex-wrap gap-2 text-sm">
                {tagsArray.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-medium text-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-sm text-white/85">
              {trackInfo.createdAt && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 backdrop-blur">
                  <Calendar className="h-4 w-4 text-white" />
                  <span>{formatDateTime(trackInfo.createdAt)}</span>
                </div>
              )}
              {trackInfo.duration && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 backdrop-blur">
                  <Clock className="h-4 w-4 text-white" />
                  <span>{formatDuration(trackInfo.duration)}</span>
                </div>
              )}
              {modelLabel && (
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                  {modelLabel}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                disabled={!isPlayable}
                onClick={() => trackInfo && onPlayTrack?.(trackInfo)}
                className="flex h-12 items-center gap-2 rounded-full border-0 bg-gradient-to-r from-[#ff4d77] via-[#f04ad8] to-[#705ae8] px-6 text-base font-semibold text-white shadow-[0_12px_35px_rgba(122,0,255,0.45)] transition hover:scale-[1.01] disabled:opacity-50"
              >
                {audioState.isPlaying && audioState.isCurrentTrack ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
                <span>{audioState.isPlaying && audioState.isCurrentTrack ? "Pause" : "Play"}</span>
              </Button>

            {onDownload && (
              <DropdownMenu
                open={downloadMenuOpen}
                onOpenChange={(nextOpen) => {
                  if (!nextOpen) {
                    setDownloadMenuOpen(false);
                    return;
                  }
                  if (ensureDownloadAccess()) {
                    setDownloadMenuOpen(true);
                  }
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    disabled={!isDownloadable}
                    className="flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-base font-semibold text-white hover:bg-white/20 disabled:opacity-50"
                    onClick={(event) => {
                      if (!ensureDownloadAccess()) {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                  >
                    <Download className="h-5 w-5" />
                    Download
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-36 border border-white/10 bg-[#070b1c]/95 text-white backdrop-blur"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-white/10"
                      onClick={() => {
                        if (trackInfo) {
                          onDownload(trackInfo, "mp3");
                        }
                        setDownloadMenuOpen(false);
                      }}
                    >
                      MP3
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer focus:bg-white/10"
                      onClick={() => {
                        if (trackInfo) {
                          onDownload(trackInfo, "wav");
                        }
                        setDownloadMenuOpen(false);
                      }}
                    >
                      WAV
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

              <Button
                onClick={handleShare}
                className="flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 text-base font-semibold text-white hover:bg-white/20"
              >
                {copied ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
                <span>{copied ? "Copied" : "Share"}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full rounded-[32px] border border-white/10 bg-gradient-to-br from-[rgba(19,19,36,0.95)] to-[rgba(7,8,18,0.95)] p-6 sm:p-10 text-white shadow-[0_25px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex items-center justify-between pb-4">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/70">
            Lyrics
          </p>
        </div>
        <div className="space-y-4 text-base leading-relaxed text-white/80">
          {trackInfo.lyrics?.trim()
            ? trackInfo.lyrics.split(/\n{2,}/).map((block, idx) => (
              <p key={`${block}-${idx}`} className="whitespace-pre-line">
                {block}
              </p>
            ))
            : (
              <p className="text-white/60">
                No lyrics yet. Try generating lyrics or check back later.
              </p>
            )}
        </div>
      </div>
    </div>
  );

  if (!fullPage) {
    return (
      <div className="relative h-full w-full overflow-y-auto">
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6">
          {detailContent}
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="relative z-10 flex min-h-screen flex-col">
        <main className="flex-1">
          <div className="w-full px-4 pb-20 pt-28 sm:px-8 lg:px-14">
            {detailContent}
          </div>
        </main>
        <footer className="bg-transparent">
          <FooterSection />
        </footer>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};
