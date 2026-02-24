"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Loader2, Music, Pause, Play, Share2, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { MusicPlayer } from "@/components/ui/music-player";
import { CustomAudioWaveIndicator } from "@/components/ui/audio-wave-indicator";
import { InlineTrackDetailsPanel } from "@/components/ui/inline-track-details";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SolidThumbsUpIcon } from "@/components/icons/solid-thumbs-up-icon";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";
import { getZIndexClass } from "@/lib/z-index";

interface Track {
  id: string;
  audioUrl?: string;
  duration: number;
  coverR2Url?: string;
  artist?: string;
  playCount?: number;
  isFavorited?: boolean;
}

interface MusicGeneration {
  id: string;
  title: string;
  tags: string;
  prompt?: string;
  lyrics?: string | null;
  createdAt: string;
  updatedAt: string;
  primaryTrack: Track;
  allTracks: Track[];
  totalDuration: number;
  trackCount: number;
}

interface ExploreData {
  music: MusicGeneration[];
  count: number;
  limit: number;
  offset: number;
}

export const ExploreSection = () => {
  const router = useRouter();
  const { t, locale } = useI18n();
  const withCurrentLocale = useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const sectionRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [favoriteLoadingTrackId, setFavoriteLoadingTrackId] = useState<string | null>(null);
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null);

  const audioPlayer = useAudioPlayer();
  const audioPlayerRef = useRef(audioPlayer);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }, []);

  const getJsonHeaders = useCallback((accessToken?: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }, []);

  const fetchExploreData = useCallback(async () => {
    try {
      setLoading(true);
      const accessToken = await getAccessToken();
      const response = await fetch("/api/pinned-tracks?limit=8&offset=0", {
        method: "GET",
        headers: getJsonHeaders(accessToken),
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success) {
        const musicGenerations: MusicGeneration[] = data.data.tracks.map((track: any) => ({
          id: track.id,
          title: track.title,
          tags: track.tags,
          prompt: track.prompt,
          lyrics: track.lyrics || null,
          createdAt: track.createdAt,
          updatedAt: track.updatedAt,
          primaryTrack: {
            id: track.id,
            audioUrl: track.audioUrl || "",
            duration: track.duration,
            coverR2Url: track.coverR2Url || "",
            playCount: track.playCount ?? 0,
            artist: track.artist,
            isFavorited: Boolean(track.isFavorited),
          },
          allTracks: [
            {
              id: track.id,
              audioUrl: track.audioUrl || "",
              duration: track.duration,
              coverR2Url: track.coverR2Url || "",
              playCount: track.playCount ?? 0,
              artist: track.artist,
              isFavorited: Boolean(track.isFavorited),
            },
          ],
          totalDuration: track.duration,
          trackCount: 1,
        }));

        setExploreData({
          music: musicGenerations,
          count: data.data.count,
          limit: data.data.limit,
          offset: data.data.offset,
        });
        setPlaylist(musicGenerations);
      }
    } catch (err) {
      console.error("Error fetching pinned tracks:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, getJsonHeaders]);

  useEffect(() => {
    audioPlayerRef.current = audioPlayer;
  }, [audioPlayer]);

  useEffect(() => {
    if (shouldLoad) return;
    const element = sectionRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || hasRequested) return;
    setHasRequested(true);
    void fetchExploreData();
  }, [shouldLoad, hasRequested, fetchExploreData]);

  useEffect(() => {
    return () => {
      setCurrentlyPlaying(null);
      setLyricsTrackId(null);
      audioPlayerRef.current.clearCurrentTrack();
    };
  }, []);

  useEffect(() => {
    if (!lyricsTrackId || !currentlyPlaying || lyricsTrackId === currentlyPlaying) return;
    setLyricsTrackId(currentlyPlaying);
  }, [lyricsTrackId, currentlyPlaying]);

  const formatPlayCount = (count?: number) => {
    if (!count || count < 0) return "0";
    if (count >= 1000) {
      const value = count / 1000;
      const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
      return `${formatted}k`;
    }
    return count.toString();
  };

  const formatDuration = (seconds: number | string) => {
    const numSeconds = typeof seconds === "string" ? parseFloat(seconds) : seconds;
    const mins = Math.floor(numSeconds / 60);
    const secs = Math.floor(numSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const PlayTriangleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
      <path d="M8 5.75v12.5c0 .8.88 1.28 1.55.84l9.5-6.25a1 1 0 0 0 0-1.68l-9.5-6.25A1 1 0 0 0 8 5.75z" />
    </svg>
  );

  const handleShare = async (trackId: string) => {
    try {
      if (!trackId) return;
      const shareUrl = `${window.location.origin}${withCurrentLocale(`/track/${trackId}`)}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("trackActions.linkCopied"), {
        duration: 1500,
      });
    } catch (error) {
      console.error("Error copying share link:", error);
      toast.error(t("toasts.failedCopyLink"), { duration: 2000 });
    }
  };

  const updateFavoriteState = useCallback((trackId: string, isFavorited: boolean) => {
    const applyFavoriteState = (music: MusicGeneration) => {
      if (music.primaryTrack.id !== trackId) {
        return music;
      }

      return {
        ...music,
        primaryTrack: {
          ...music.primaryTrack,
          isFavorited,
        },
        allTracks: music.allTracks.map((track) =>
          track.id === trackId ? { ...track, isFavorited } : track
        ),
      };
    };

    setExploreData((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        music: prev.music.map(applyFavoriteState),
      };
    });

    setPlaylist((prev) => prev.map(applyFavoriteState));
  }, []);

  const handleToggleFavorite = useCallback(async (trackId: string) => {
    if (!trackId || favoriteLoadingTrackId === trackId) {
      return;
    }

    setFavoriteLoadingTrackId(trackId);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast(t("toasts.pleaseLogInFavoriteTracks"));
        router.push(withCurrentLocale("/login"));
        return;
      }

      const response = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: getJsonHeaders(accessToken),
        body: JSON.stringify({ trackId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        if (response.status === 401) {
          toast(t("toasts.pleaseLogInFavoriteTracks"));
          router.push(withCurrentLocale("/login"));
          return;
        }
        throw new Error(result.error || t("toasts.failedUpdateFavoriteStatus"));
      }

      const isFavorited = Boolean(result.isFavorited);
      updateFavoriteState(trackId, isFavorited);
      toast.success(isFavorited ? t("toasts.addedToFavorites") : t("toasts.removedFromFavorites"), {
        duration: 1200,
      });
    } catch (error) {
      console.error("Error toggling favorite on home explore:", error);
      toast.error(t("toasts.failedUpdateFavoriteStatus"));
    } finally {
      setFavoriteLoadingTrackId(null);
    }
  }, [favoriteLoadingTrackId, getAccessToken, getJsonHeaders, router, t, updateFavoriteState, withCurrentLocale]);

  const playTrack = async (index: number, specificTrackId?: string, specificAudioUrl?: string) => {
    if (index < 0 || index >= playlist.length) return;

    const music = playlist[index];
    const trackId = specificTrackId || music.primaryTrack.id;
    const audioUrl = specificAudioUrl || music.primaryTrack.audioUrl || "";

    setCurrentlyPlaying(trackId);

    await audioPlayer.playTrack({
      id: trackId,
      title: music.title,
      audioUrl,
      duration: music.primaryTrack.duration,
      coverImage: music.primaryTrack.coverR2Url || "",
    });
  };

  const handlePlayPause = (trackId: string, _audioUrl: string, _music: MusicGeneration) => {
    const trackIndex = playlist.findIndex((track) => track.primaryTrack.id === trackId);
    if (trackIndex === -1) return;

    if (currentlyPlaying === trackId) {
      audioPlayer.togglePlayPause();
      return;
    }

    void playTrack(trackIndex, trackId, _audioUrl);
  };

  const handlePlayerPlayPause = () => {
    audioPlayer.togglePlayPause();
  };

  const handlePrevious = () => {
    const currentIndex = playlist.findIndex((music) => music.primaryTrack.id === currentlyPlaying);
    if (currentIndex > 0) {
      void playTrack(currentIndex - 1);
    }
  };

  const handleNext = () => {
    const currentIndex = playlist.findIndex((music) => music.primaryTrack.id === currentlyPlaying);
    if (currentIndex < playlist.length - 1) {
      void playTrack(currentIndex + 1);
    }
  };

  const handleSeek = (time: number) => {
    audioPlayer.seek(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    audioPlayer.setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    audioPlayer.toggleMute();
  };

  const handleTrackChange = (index: number) => {
    void playTrack(index);
  };

  const handleClosePlayer = () => {
    audioPlayer.clearCurrentTrack();
    setCurrentlyPlaying(null);
    setLyricsTrackId(null);
  };

  const updateRailScrollState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanScrollPrev(rail.scrollLeft > 8);
    setCanScrollNext(maxScrollLeft - rail.scrollLeft > 8);
  }, []);

  useEffect(() => {
    if (!shouldLoad || loading) return;
    const rail = railRef.current;
    if (!rail) return;

    const onRailScroll = () => updateRailScrollState();
    onRailScroll();

    rail.addEventListener("scroll", onRailScroll, { passive: true });
    window.addEventListener("resize", onRailScroll);

    return () => {
      rail.removeEventListener("scroll", onRailScroll);
      window.removeEventListener("resize", onRailScroll);
    };
  }, [shouldLoad, loading, exploreData?.music.length, updateRailScrollState]);

  const handleRailMove = (direction: "prev" | "next") => {
    const rail = railRef.current;
    if (!rail) return;

    const delta = Math.round(rail.clientWidth * 0.78);
    rail.scrollBy({
      left: direction === "next" ? delta : -delta,
      behavior: "smooth",
    });

    window.setTimeout(() => {
      updateRailScrollState();
    }, 320);
  };

  const inlineTrackDetails = React.useMemo(() => {
    if (!lyricsTrackId) return null;

    const matched = playlist.find((music) => music.primaryTrack.id === lyricsTrackId);
    if (!matched) return null;

    return {
      id: matched.primaryTrack.id,
      title: matched.title || t("studioTracks.untitledTrack"),
      tags: matched.tags || "",
      lyrics: matched.lyrics || "",
      coverImage: matched.primaryTrack.coverR2Url || null,
      createdAt: matched.createdAt,
      duration: String(
        typeof matched.totalDuration === "string"
          ? parseFloat(matched.totalDuration)
          : matched.totalDuration || matched.primaryTrack.duration || 0
      ),
      status: "completed",
      isGenerating: false,
      isCompleted: true,
      audioUrl: matched.primaryTrack.audioUrl || "",
    };
  }, [lyricsTrackId, playlist, t]);

  const isInlineTrackPlaying = Boolean(
    inlineTrackDetails &&
    currentlyPlaying === inlineTrackDetails.id &&
    audioPlayer.isPlaying
  );

  const panelCurrentTime =
    inlineTrackDetails && currentlyPlaying === inlineTrackDetails.id ? audioPlayer.currentTime : 0;
  const showInlinePanel = Boolean(inlineTrackDetails);

  const SongCardSkeleton = () => (
    <div className="studio-panel-card w-[84vw] shrink-0 overflow-hidden rounded-3xl bg-background/90 p-0 sm:w-[320px] dark:bg-[rgba(18,20,30,0.9)]">
      <div className="relative aspect-square overflow-hidden">
        <Skeleton className="h-full w-full bg-foreground/10 dark:bg-white/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <Skeleton className="h-8 w-8 rounded-full bg-white/20 dark:bg-white/15" />
          <Skeleton className="h-8 w-8 rounded-full bg-white/20 dark:bg-white/15" />
        </div>
        <Skeleton className="absolute bottom-3 left-3 h-10 w-10 rounded-full bg-white/20 dark:bg-white/15" />
      </div>
      <div className="relative bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(246,248,252,0.955)_100%)] px-3.5 pb-3.5 pt-3 shadow-[inset_0_14px_24px_-20px_rgba(15,23,42,0.45)] dark:bg-[linear-gradient(180deg,rgba(24,26,36,0.96)_0%,rgba(15,17,25,0.94)_100%)] dark:shadow-none">
        <Skeleton className="h-5 w-3/4 bg-foreground/10 dark:bg-white/10" />
        <Skeleton className="mt-2 h-4 w-2/3 bg-foreground/10 dark:bg-white/10" />
        <div className="mt-3 flex items-center gap-3">
          <Skeleton className="h-3 w-12 rounded-full bg-foreground/10 dark:bg-white/10" />
          <Skeleton className="h-3 w-14 rounded-full bg-foreground/10 dark:bg-white/10" />
        </div>
      </div>
    </div>
  );

  return (
    <section id="explore" className="py-24 sm:py-32" ref={sectionRef}>
      <div className="container">
        <div className="mx-auto max-w-7xl">
          <div className="relative">
            <div className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  {t("explorePage.sectionTitle")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {t("explorePage.sectionDescription")}
                </p>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-background/80 text-foreground shadow-[0_10px_22px_rgba(2,8,23,0.18)] transition-colors hover:bg-background disabled:opacity-35 disabled:cursor-not-allowed dark:bg-white/10 dark:hover:bg-white/15"
                  aria-label={t("musicPlayer.previous")}
                  onClick={() => handleRailMove("prev")}
                  disabled={!canScrollPrev}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-background/80 text-foreground shadow-[0_10px_22px_rgba(2,8,23,0.18)] transition-colors hover:bg-background disabled:opacity-35 disabled:cursor-not-allowed dark:bg-white/10 dark:hover:bg-white/15"
                  aria-label={t("musicPlayer.next")}
                  onClick={() => handleRailMove("next")}
                  disabled={!canScrollNext}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {shouldLoad && loading ? (
              <div className="flex gap-4 overflow-hidden pb-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SongCardSkeleton key={index} />
                ))}
              </div>
            ) : shouldLoad && exploreData && exploreData.music.length > 0 ? (
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-16 bg-gradient-to-l from-background to-transparent md:block dark:from-black/30" />
                <div
                  ref={railRef}
                  className="scrollbar-hidden -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 pr-6 sm:pr-10"
                >
                  {exploreData.music.map((music) => {
                    const hasCover = Boolean(music.primaryTrack.coverR2Url);
                    const isActiveTrack = currentlyPlaying === music.primaryTrack.id;

                    return (
                      <article
                        key={music.id}
                        role="button"
                        tabIndex={0}
                        className="studio-panel-card group relative w-[84vw] shrink-0 snap-start cursor-pointer overflow-hidden rounded-3xl bg-background/90 p-0 transition-transform duration-200 ease-out motion-reduce:transform-none sm:w-[320px] md:hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-[rgba(18,20,30,0.9)]"
                        onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music);
                          }
                        }}
                      >
                        <div className="relative aspect-square overflow-hidden">
                          {hasCover ? (
                            <SafeImage
                              src={music.primaryTrack.coverR2Url || ""}
                              alt={music.title}
                              fill
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              fallbackContent={
                                <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                                  <div className="flex h-full w-full items-center justify-center">
                                    <Music className="h-7 w-7 text-slate-700 dark:text-white/75" />
                                  </div>
                                </div>
                              }
                            />
                          ) : (
                            <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 transition-transform duration-300 group-hover:scale-[1.02] dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                              <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_42%)] dark:[background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_42%)]" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Music className="h-7 w-7 text-slate-700 dark:text-white/75" />
                              </div>
                            </div>
                          )}

                          <div
                            className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                              isActiveTrack
                                ? "bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-100"
                                : "bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80 group-hover:opacity-100"
                            }`}
                          />

                          {isActiveTrack && (
                            <div
                              className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                                hasCover ? "bg-black/20 group-hover:opacity-0" : "bg-white/15 dark:bg-black/20"
                              }`}
                            >
                              <CustomAudioWaveIndicator
                                isPlaying={audioPlayer.isPlaying}
                                size="lg"
                                className={hasCover ? "text-white" : "text-foreground/80 dark:text-white/85"}
                              />
                            </div>
                          )}

                          <div
                            className={`absolute right-3 top-3 ${getZIndexClass("MAIN_CONTENT")} flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100`}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-full bg-black/40 p-0 text-white/90 hover:bg-black/55 hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleShare(music.primaryTrack.id);
                              }}
                              aria-label={t("trackActions.shareTrack")}
                              title={t("trackActions.copyShareLink")}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 w-8 rounded-full bg-black/40 p-0 ${
                                music.primaryTrack.isFavorited ? "text-pink-200 hover:text-pink-100" : "text-white/90 hover:text-white"
                              } hover:bg-black/55`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleToggleFavorite(music.primaryTrack.id);
                              }}
                              aria-label={music.primaryTrack.isFavorited ? t("trackActions.unlikeTrack") : t("trackActions.likeTrack")}
                              title={music.primaryTrack.isFavorited ? t("trackActions.unlikeTrack") : t("trackActions.likeTrack")}
                              disabled={favoriteLoadingTrackId === music.primaryTrack.id}
                            >
                              {favoriteLoadingTrackId === music.primaryTrack.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                              ) : music.primaryTrack.isFavorited ? (
                                <SolidThumbsUpIcon className="h-3.5 w-3.5 fill-current" />
                              ) : (
                                <ThumbsUp className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute bottom-3 left-3 h-10 w-10 rounded-full bg-black/45 p-0 text-white backdrop-blur-sm transition-colors hover:bg-black/65 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music);
                            }}
                            aria-label={currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? t("trackActions.pause") : t("trackActions.play")}
                            title={currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? t("trackActions.pause") : t("trackActions.play")}
                          >
                            {currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? (
                              <Pause className="h-4 w-4 text-white" />
                            ) : (
                              <Play className="h-4 w-4 text-white" />
                            )}
                          </Button>

                        </div>

                        <div className="relative bg-[linear-gradient(180deg,rgba(255,255,255,0.985)_0%,rgba(246,248,252,0.955)_100%)] px-3.5 pb-3.5 pt-3 shadow-[inset_0_14px_24px_-20px_rgba(15,23,42,0.45)] dark:bg-[linear-gradient(180deg,rgba(24,26,36,0.96)_0%,rgba(15,17,25,0.94)_100%)] dark:shadow-none">
                          <h3 className="line-clamp-1 text-sm font-semibold text-foreground md:text-base">
                            {music.title}
                          </h3>
                          <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">
                            {music.tags || t("libraryPage.unknownArtist")}
                          </p>

                          <div className="mt-3 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <PlayTriangleIcon />
                              {formatPlayCount(music.primaryTrack.playCount)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(music.totalDuration)}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : shouldLoad ? (
              <div className="py-12 text-center">
                <Music className="mx-auto mb-4 h-16 w-16 text-muted-foreground/30" />
                <p className="text-lg text-muted-foreground">{t("explorePage.noMusicAvailableYet")}</p>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={`fixed inset-0 ${getZIndexClass('INLINE_PANEL_OVERLAY')} transition-opacity duration-200 ${
            showInlinePanel ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!showInlinePanel}
        >
          <button
            type="button"
            aria-label={t("studioPage.closeLyricsPanel")}
            onClick={() => setLyricsTrackId(null)}
            className="absolute inset-0 bg-background/20 backdrop-blur-[1px] md:bg-background/10"
          />
          <div
            className={`absolute right-0 top-0 h-full w-full max-w-[min(90vw,400px)] transform-gpu transition-transform duration-300 ease-out ${
              showInlinePanel ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {showInlinePanel && (
              <div className="h-full p-2 md:py-4 md:pl-3 md:pr-2">
                <InlineTrackDetailsPanel
                  track={inlineTrackDetails}
                  isPlaying={isInlineTrackPlaying}
                  currentTime={panelCurrentTime}
                  onClose={() => setLyricsTrackId(null)}
                  variant="studio"
                />
              </div>
            )}
          </div>
        </div>

        {playlist.length > 0 && currentlyPlaying && (
          <>
            <style
              dangerouslySetInnerHTML={{
                __html: `
                  .player-container-explore {
                    position: fixed;
                    left: 0.75rem;
                    right: 0.75rem;
                    bottom: calc(var(--mobile-nav-height, 0px) + 0.75rem);
                    z-index: 60;
                  }
                  @media (min-width: 768px) {
                    .player-container-explore {
                      bottom: 0.75rem !important;
                      left: 50% !important;
                      right: auto !important;
                      transform: translateX(-50%) !important;
                      max-width: 80rem !important;
                      width: calc(100% - 3rem) !important;
                    }
                  }
                `,
              }}
            />
            <div className="player-container-explore">
              <MusicPlayer
                tracks={playlist.map((music) => ({
                  id: music.primaryTrack.id,
                  title: music.title,
                  audioUrl: music.primaryTrack.audioUrl || "",
                  duration: music.totalDuration,
                  coverImage: music.primaryTrack.coverR2Url || "",
                  artist: music.primaryTrack.artist || t("libraryPage.unknownArtist"),
                  tags: music.tags || "",
                  lyrics: music.lyrics || "",
                  allTracks: music.allTracks.map((track) => ({
                    id: track.id,
                    audioUrl: track.audioUrl || "",
                    duration: track.duration,
                  })),
                }))}
                currentTrackIndex={playlist.findIndex((music) => music.primaryTrack.id === currentlyPlaying)}
                isPlaying={audioPlayer.isPlaying}
                currentTime={audioPlayer.currentTime}
                duration={audioPlayer.duration}
                volume={audioPlayer.volume}
                isMuted={audioPlayer.isMuted}
                hideProgress={false}
                onPlayPause={handlePlayerPlayPause}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onSeek={handleSeek}
                onVolumeChange={handleVolumeChange}
                onMuteToggle={handleMuteToggle}
                onTrackChange={handleTrackChange}
                onClose={handleClosePlayer}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};
