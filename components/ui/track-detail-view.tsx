"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Check,
  Clock,
  Download,
  Pause,
  Play,
  Share2
} from "lucide-react";
import Image from "next/image";
import { LoadingDots } from "./loading-dots";
import { toast } from "sonner";
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
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { MusicPlayer } from "@/components/ui/music-player";
import { supabase } from "@/lib/supabase";
import { Mp4BrandingDialog } from "@/components/ui/mp4-branding-dialog";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";
import { getZIndexClass } from "@/lib/z-index";

interface TrackDetailViewProps {
  trackData?: TrackInfo;
  trackId?: string;
  onBack?: () => void;
  onPlayTrack?: (trackInfo: TrackInfo) => void;
  onDownload?: (trackInfo: TrackInfo, format: "mp3" | "wav" | "mp4") => void;
  fullPage?: boolean;
}

export interface TrackInfo {
  id: string;
  title: string;
  tags: string;
  lyrics: string;
  coverImage: string | null;
  audioUrl: string | null;
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
  const [mp4DialogOpen, setMp4DialogOpen] = useState(false);
  const [mp4Author, setMp4Author] = useState("");
  const [mp4DomainName, setMp4DomainName] = useState("");

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playTrack,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    clearCurrentTrack,
  } = useAudioPlayer();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const { openModal: openPricingModal } = usePricingModal();
  const { hasPermission } = useFeaturePermissions();

  // Removed handleBack function entirely
  useEffect(() => {
    return () => {
      clearCurrentTrack();
    };
  }, [clearCurrentTrack]);

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
            throw new Error(t("trackDetail.failedFetchTrackInfo"));
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
              audioUrl: apiTrack.audioUrl ?? null,
              createdAt: apiTrack.createdAt,
              duration: apiTrack.duration?.toString() || "0",
              isPublished: apiTrack.isPublished || false,
              isFavorited: apiTrack.isFavorited || false,
              userId: apiTrack.userId,
              status: apiTrack.status,
              model: apiTrack.model
            });
          } else {
            throw new Error(t("trackDetail.invalidResponseFormat"));
          }
        } catch (err) {
          console.error("Error fetching track info:", err);
          setError(t("trackDetail.failedLoadTrackInformation"));
          toast.error(t("trackDetail.failedLoadTrack"));
        } finally {
          setIsLoading(false);
        }
      };

      fetchTrackInfo();
    }
  }, [trackData, trackId, t]);

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
    return trackInfo?.tags
      ? trackInfo.tags.split(/[,，;；]/).map((tag: string) => tag.trim()).filter(Boolean)
      : [];
  }, [trackInfo?.tags]);

  const canDownloadMP3 = hasPermission("download_mp3_track");
  const canDownloadWAV = hasPermission("download_wav_track");
  const canDownloadMP4 = hasPermission("download_mp4_track");
  const canDownloadTrack = canDownloadMP3 || canDownloadWAV || canDownloadMP4;

  const canDownloadByFormat = React.useCallback((format: "mp3" | "wav" | "mp4") => {
    if (format === "mp3") return canDownloadMP3;
    if (format === "wav") return canDownloadWAV;
    return canDownloadMP4;
  }, [canDownloadMP3, canDownloadWAV, canDownloadMP4]);

  const getAccessTokenOrThrow = React.useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error(t("trackDetail.authenticationRequired"));
    }

    return session.access_token;
  }, [t]);

  const getAuthHeaders = React.useCallback((accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
  }), []);

  const ensureDownloadAccess = React.useCallback((format?: "mp3" | "wav" | "mp4") => {
    if (!trackInfo?.audioUrl) {
      return false;
    }
    if (!user) {
      setAuthModalOpen(true);
      return false;
    }

    if (format) {
      if (!canDownloadByFormat(format)) {
        openPricingModal();
        return false;
      }
      return true;
    }

    if (!canDownloadTrack) {
      openPricingModal();
      return false;
    }

    return true;
  }, [trackInfo?.audioUrl, user, canDownloadByFormat, canDownloadTrack, openPricingModal]);

  const internalPlayTrack = React.useCallback((nextTrack: TrackInfo) => {
    if (!nextTrack?.audioUrl) {
      return;
    }

    if (currentTrack?.id === nextTrack.id) {
      togglePlayPause();
      return;
    }

    playTrack({
      id: nextTrack.id,
      title: nextTrack.title,
      audioUrl: nextTrack.audioUrl,
      streamAudioUrl: nextTrack.audioUrl,
      duration: parseFloat(nextTrack.duration) || 0,
      coverImage: nextTrack.coverImage || undefined,
      tags: nextTrack.tags,
      lyrics: nextTrack.lyrics,
      isFavorited: nextTrack.isFavorited,
    });
  }, [currentTrack?.id, playTrack, togglePlayPause]);

  const effectiveOnPlayTrack = onPlayTrack ?? internalPlayTrack;
  const isPlayableResolved = Boolean(trackInfo?.audioUrl && effectiveOnPlayTrack);
  const isCurrentTrack = Boolean(trackInfo?.id && currentTrack?.id === trackInfo.id);
  const isPlayingCurrent = isPlaying && isCurrentTrack;

  const internalDownload = React.useCallback(async (track: TrackInfo, format: "mp3" | "wav" | "mp4") => {
    if (!track?.id) {
      toast.error(t("trackDetail.missingTrackInformation"));
      return;
    }

    if (!ensureDownloadAccess(format)) {
      return;
    }

    const downloadingToast = toast.loading(t("download.preparingDownload"));
    try {
      const accessToken = await getAccessTokenOrThrow();

      const triggerBlobDownload = (blob: Blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${track.title || t("download.trackDefaultTitle")}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      };

      const processDownloadResponse = async (response: Response) => {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          const fallbackUrl = data.audioUrl || data.wavUrl || data.videoUrl;
          if (data.fallback && fallbackUrl) {
            const fallbackResponse = await fetch(fallbackUrl);
            if (!fallbackResponse.ok) {
              throw new Error(`Failed to fetch file: ${fallbackResponse.status}`);
            }
            const blob = await fallbackResponse.blob();
            triggerBlobDownload(blob);
            return;
          }
          throw new Error(data.error || data.message || t("download.downloadFailed"));
        }

        const blob = await response.blob();
        triggerBlobDownload(blob);
      };

      if (format === "wav" || format === "mp4") {
        const POLL_INTERVAL = 3000;
        const MAX_POLL_TIME = 180000;
        const startTime = Date.now();

        const queryParams = new URLSearchParams({
          trackId: track.id,
          format,
        });

        if (format === "mp4") {
          if (mp4Author.trim()) {
            queryParams.set("author", mp4Author.trim().slice(0, 50));
          }
          if (mp4DomainName.trim()) {
            queryParams.set("domainName", mp4DomainName.trim().slice(0, 50));
          }
        }

        const requestUrl = `/api/download-track?${queryParams.toString()}`;

        while (true) {
          const response = await fetch(requestUrl, {
            headers: getAuthHeaders(accessToken),
          });

          if (response.status === 202) {
            const elapsed = Date.now() - startTime;
            if (elapsed > MAX_POLL_TIME) {
                  throw new Error(format === "mp4" ? t("download.mp4GenerationTimeout") : t("download.downloadTimeout"));
                }
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
            continue;
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || errorData.message || t("download.downloadFailed"));
          }

          await processDownloadResponse(response);
          break;
        }

        toast.success(t("download.downloadStarted"), { id: downloadingToast });
        return;
      }

      const response = await fetch(`/api/download-track?trackId=${track.id}&format=${format}`, {
        headers: getAuthHeaders(accessToken),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || t("download.downloadFailed"));
      }

      await processDownloadResponse(response);

      toast.success(t("download.downloadStarted"), { id: downloadingToast });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("download.unableDownloadFile"), { id: downloadingToast });
    }
  }, [mp4Author, mp4DomainName, ensureDownloadAccess, getAccessTokenOrThrow, getAuthHeaders, t]);

  const effectiveOnDownload = onDownload ?? internalDownload;
  const isDownloadableResolved = Boolean(trackInfo?.audioUrl && effectiveOnDownload);

  const playerTracks = React.useMemo(
    () => (currentTrack ? [currentTrack] : []),
    [currentTrack]
  );

  const musicPlayerProps = React.useMemo(() => ({
    tracks: playerTracks,
    currentTrackIndex: 0,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    onPlayPause: togglePlayPause,
    onPrevious: () => {},
    onNext: () => {},
    onSeek: (time: number) => seek(time),
    onVolumeChange: (vol: number) => setVolume(vol),
    onMuteToggle: () => toggleMute(),
    onClose: () => clearCurrentTrack(),
    hideProgress: false,
    onTrackChange: () => {},
    currentPlayingTrack: currentTrack || undefined,
  }), [
    playerTracks,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    clearCurrentTrack,
    currentTrack,
  ]);

  const formatDuration = (duration: string | number) => {
    const seconds = typeof duration === "string" ? parseFloat(duration) : duration;
    if (isNaN(seconds) || seconds <= 0) {
      return "0:00";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleShare = () => {
    if (!trackInfo) return;
    const url = `${window.location.origin}${withLocalePrefix(`/track/${trackInfo.id}`, locale)}`;
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
        <p className="text-muted-foreground">{error || t("trackDetail.trackNotFound")}</p>
        {/* Removed the back button here */}
      </div>
    );
  }

  const detailContent = (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 md:gap-7 text-foreground">
      <section className="app-card relative overflow-hidden rounded-[28px]">
        <div className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(70%_70%_at_18%_12%,black,transparent)]">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[rgba(166,84,255,0.22)] blur-3xl" />
          <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[rgba(96,204,241,0.16)] blur-3xl" />
        </div>

        <div className="relative grid gap-5 p-5 sm:p-6 md:grid-cols-[320px_1fr] md:gap-6 md:p-7">
          <button
            type="button"
            onClick={() => trackInfo && effectiveOnPlayTrack?.(trackInfo)}
            disabled={!isPlayableResolved}
            className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-foreground/5 dark:bg-white/10 disabled:cursor-not-allowed"
            aria-label={isPlayingCurrent ? t("trackDetail.pause") : t("trackDetail.play")}
          >
            {trackInfo.coverImage ? (
              <Image
                src={trackInfo.coverImage}
                alt={trackInfo.title}
                fill
                sizes="(min-width: 1024px) 320px, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex h-full w-full items-center justify-center">
                  <div className="app-card-muted app-hairline flex h-16 w-16 items-center justify-center rounded-2xl text-foreground/80">
                    <Play className="h-7 w-7" />
                  </div>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-90" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 disabled:group-hover:opacity-0">
              <div className="app-card-muted app-hairline flex h-12 w-12 items-center justify-center rounded-full text-foreground/80">
                {isPlayingCurrent ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </div>
            </div>
          </button>

          <div className="min-w-0 space-y-4 md:space-y-5">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
                {trackInfo.title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {trackInfo.createdAt && (
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDateTime(trackInfo.createdAt)}
                  </span>
                )}
                {trackInfo.createdAt && (
                  <span className="text-muted-foreground/50">•</span>
                )}
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDuration(trackInfo.duration)}
                </span>
              </div>
            </div>

            {tagsArray.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tagsArray.slice(0, 10).map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="rounded-full px-3 py-1 text-sm font-medium tracking-tight text-foreground/80 bg-foreground/10 dark:bg-white/10"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                disabled={!isPlayableResolved}
                onClick={() => trackInfo && effectiveOnPlayTrack?.(trackInfo)}
                className="h-11 rounded-full px-5"
              >
                {isPlayingCurrent ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>{isPlayingCurrent ? t("trackDetail.pause") : t("trackDetail.play")}</span>
              </Button>

              {effectiveOnDownload && (
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
                      disabled={!isDownloadableResolved}
                      variant="ghost"
                      className="h-11 rounded-full px-5 app-card-muted app-hairline text-foreground/75 hover:text-accent-foreground"
                      onClick={(event) => {
                        if (!ensureDownloadAccess()) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                    >
                    <Download className="h-4 w-4" />
                      {t("trackDetail.download")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40 p-1.5 rounded-2xl app-card">
                    <div className="px-2 py-1 text-xs text-muted-foreground uppercase">
                      {t("trackDetail.advancedFeatures")}
                    </div>
                    <DropdownMenuItem
                      className="cursor-pointer text-sm"
                      onClick={() => {
                        if (!ensureDownloadAccess("mp3")) {
                          setDownloadMenuOpen(false);
                          return;
                        }
                        if (trackInfo) {
                          effectiveOnDownload(trackInfo, "mp3");
                        }
                        setDownloadMenuOpen(false);
                      }}
                    >
                      {t("trackDetail.mp3")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-sm"
                      onClick={() => {
                        if (!ensureDownloadAccess("wav")) {
                          setDownloadMenuOpen(false);
                          return;
                        }
                        if (trackInfo) {
                          effectiveOnDownload(trackInfo, "wav");
                        }
                        setDownloadMenuOpen(false);
                      }}
                    >
                      {t("trackDetail.wav")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-sm"
                      onClick={() => {
                        if (!ensureDownloadAccess("mp4")) {
                          setDownloadMenuOpen(false);
                          return;
                        }
                        if (trackInfo) {
                          const defaultAuthor =
                            user?.user_metadata?.nickname ||
                            user?.user_metadata?.full_name ||
                            user?.user_metadata?.name ||
                            user?.email?.split('@')[0] ||
                            "";
                          setMp4Author(defaultAuthor.slice(0, 50));
                          setMp4DomainName("");
                          setMp4DialogOpen(true);
                        }
                        setDownloadMenuOpen(false);
                      }}
                    >
                      {t("trackDetail.mp4")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                onClick={handleShare}
                variant="ghost"
                className="app-card-muted app-hairline rounded-full px-4 text-foreground/75 hover:text-accent-foreground"
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>{copied ? t("trackDetail.copied") : t("trackDetail.share")}</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Mp4BrandingDialog
        open={mp4DialogOpen}
        onOpenChange={setMp4DialogOpen}
        author={mp4Author}
        domainName={mp4DomainName}
        onAuthorChange={setMp4Author}
        onDomainNameChange={setMp4DomainName}
        onGenerate={() => {
          if (trackInfo) {
            effectiveOnDownload(trackInfo, "mp4");
          }
          setMp4DialogOpen(false);
        }}
      />

      <section className="app-card rounded-[28px] p-5 sm:p-6 md:p-7">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("trackDetail.lyrics")}
          </div>
        </div>

        <div className="space-y-3 text-sm leading-7 text-foreground/80">
          {trackInfo.lyrics?.trim()
            ? trackInfo.lyrics.split(/\n{2,}/).map((block, idx) => (
                <p key={`${block}-${idx}`} className="whitespace-pre-line">
                  {block}
                </p>
              ))
            : (
              <p className="text-muted-foreground">
                {t("trackDetail.noLyricsYet")}
              </p>
            )}
        </div>
      </section>
    </div>
  );

  if (!fullPage) {
    return (
      <div className="relative h-full w-full overflow-y-auto">
        <div className={`relative ${getZIndexClass('MAIN_CONTENT')} mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 sm:px-6`}>
          {detailContent}
        </div>
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-foreground">
      <div className={`relative ${getZIndexClass('MAIN_CONTENT')} flex min-h-screen flex-col`}>
        <main className="flex-1">
          <div className="w-full px-4 pb-24 pt-24 sm:px-8 lg:px-14">
            {detailContent}
          </div>
        </main>
        <footer className="bg-transparent">
          <FooterSection />
        </footer>
      </div>
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {playerTracks.length > 0 && (
        <div
          className={`fixed left-3 right-3 md:right-3 ${getZIndexClass('FLOATING_PLAYER')}`}
          style={{ bottom: 'calc(var(--mobile-nav-height, 0px) + 0.75rem)' }}
        >
          <MusicPlayer {...musicPlayerProps} />
        </div>
      )}
    </div>
  );
};
