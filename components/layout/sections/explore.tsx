"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Loader2, Music, Pause, Play, Share2, ThumbsUp } from "lucide-react";
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
  genre: string;
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
  const sectionRef = useRef<HTMLElement | null>(null);
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [favoriteLoadingTrackId, setFavoriteLoadingTrackId] = useState<string | null>(null);
  const [lyricsTrackId, setLyricsTrackId] = useState<string | null>(null);

  const audioPlayer = useAudioPlayer();
  const audioPlayerRef = useRef(audioPlayer);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);

  const getAuthHeaders = useCallback(async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    return headers;
  }, []);

  const fetchExploreData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pinned-tracks?limit=8&offset=0", {
        method: "GET",
        headers: await getAuthHeaders(),
        cache: "no-store",
      });
      const data = await response.json();

      if (data.success) {
        const musicGenerations: MusicGeneration[] = data.data.tracks.map((track: any) => ({
          id: track.id,
          title: track.title,
          genre: track.genre,
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
  }, [getAuthHeaders]);

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
      const shareUrl = `${window.location.origin}/track/${trackId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied", {
        duration: 1500,
      });
    } catch (error) {
      console.error("Error copying share link:", error);
      toast("Copy failed", { duration: 2000 });
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
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        toast("Please log in to like songs");
        router.push("/login");
        return;
      }

      const response = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers,
        body: JSON.stringify({ trackId }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        if (response.status === 401) {
          toast("Please log in to like songs");
          router.push("/login");
          return;
        }
        throw new Error(result.error || "Failed to update like status");
      }

      const isFavorited = Boolean(result.isFavorited);
      updateFavoriteState(trackId, isFavorited);
      toast.success(isFavorited ? "Liked" : "Like removed", {
        duration: 1200,
      });
    } catch (error) {
      console.error("Error toggling favorite on home explore:", error);
      toast.error("Failed to update like status.");
    } finally {
      setFavoriteLoadingTrackId(null);
    }
  }, [favoriteLoadingTrackId, getAuthHeaders, router, updateFavoriteState]);

  const playTrack = async (index: number, specificTrackId?: string, specificAudioUrl?: string) => {
    if (index < 0 || index >= playlist.length) return;

    const music = playlist[index];
    const trackId = specificTrackId || music.primaryTrack.id;
    const audioUrl = specificAudioUrl || music.primaryTrack.audioUrl || "";

    await audioPlayer.playTrack({
      id: trackId,
      title: music.title,
      audioUrl,
      duration: music.primaryTrack.duration,
      coverImage: music.primaryTrack.coverR2Url || "",
      genre: music.genre,
    });

    setCurrentlyPlaying(trackId);
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

  const handlePlayerLyricsToggle = React.useCallback(() => {
    if (!currentlyPlaying) return;
    setLyricsTrackId((prev) => (prev === currentlyPlaying ? null : currentlyPlaying));
  }, [currentlyPlaying]);

  const handleClosePlayer = () => {
    audioPlayer.clearCurrentTrack();
    setCurrentlyPlaying(null);
    setLyricsTrackId(null);
  };

  const inlineTrackDetails = React.useMemo(() => {
    if (!lyricsTrackId) return null;

    const matched = playlist.find((music) => music.primaryTrack.id === lyricsTrackId);
    if (!matched) return null;

    return {
      id: matched.primaryTrack.id,
      title: matched.title || "Untitled Track",
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
  }, [lyricsTrackId, playlist]);

  const isInlineTrackPlaying = Boolean(
    inlineTrackDetails &&
    currentlyPlaying === inlineTrackDetails.id &&
    audioPlayer.isPlaying
  );

  const panelCurrentTime =
    inlineTrackDetails && currentlyPlaying === inlineTrackDetails.id ? audioPlayer.currentTime : 0;
  const showInlinePanel = Boolean(inlineTrackDetails);

  const SongCardSkeleton = () => (
    <div className="rounded-xl overflow-hidden">
      <div className="relative aspect-square overflow-hidden rounded-b-xl">
        <Skeleton className="w-full h-full bg-white/10" />
      </div>
      <div className="pt-1 pb-4 pr-4 pl-0">
        <Skeleton className="h-4 w-3/4 mb-1 bg-white/10" />
        <Skeleton className="h-3 w-1/2 mb-2 bg-white/10" />
      </div>
    </div>
  );

  return (
    <section id="explore" className="py-24 sm:py-32" ref={sectionRef}>
      <div className="container">
        <div className="text-center mb-12 sm:mb-14">
          <p className="text-primary text-lg font-medium mb-2 tracking-wider">Explore</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Listen to The AI-Generated R&B Songs
          </h2>
          <p className="mx-auto max-w-2xl text-base md:text-lg text-muted-foreground">
            Experience soulful R&B music crafted by artificial intelligence
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          {shouldLoad && loading ? (
            <div className="relative">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SongCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : shouldLoad && exploreData && exploreData.music.length > 0 ? (
            <div className="relative">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {exploreData.music.map((music) => {
                  const hasCover = Boolean(music.primaryTrack.coverR2Url);
                  const isActiveTrack = currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying;

                  return (
                    <div
                      key={music.id}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer overflow-hidden rounded-xl transition-all duration-300"
                      onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music);
                        }
                      }}
                    >
                      <div className="relative aspect-square overflow-hidden rounded-b-xl">
                        {hasCover ? (
                          <SafeImage
                            src={music.primaryTrack.coverR2Url || ""}
                            alt={music.title}
                            fill
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            fallbackContent={
                              <div className="h-full w-full bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                                <div className="flex h-full w-full items-center justify-center">
                                  <Music className="h-7 w-7 text-slate-700 drop-shadow-[0_3px_10px_rgba(15,23,42,0.2)] dark:text-white/75 dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]" />
                                </div>
                              </div>
                            }
                          />
                        ) : (
                          <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 transition-transform duration-300 group-hover:scale-[1.02] dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800">
                            <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.15),transparent_42%)] dark:[background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_42%)]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Music className="h-7 w-7 text-slate-700 drop-shadow-[0_3px_10px_rgba(15,23,42,0.2)] dark:text-white/75 dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.45)]" />
                            </div>
                          </div>
                        )}

                        {isActiveTrack && (
                          <div
                            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
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

                        {hasCover && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 p-0 text-white/90 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleShare(music.primaryTrack.id);
                                }}
                                aria-label="Share track"
                                title="Copy share link"
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-10 w-10 p-0 ${music.primaryTrack.isFavorited ? "text-pink-200 hover:text-pink-100" : "text-white/90 hover:text-white"}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleFavorite(music.primaryTrack.id);
                                }}
                                aria-label={music.primaryTrack.isFavorited ? "Unlike track" : "Like track"}
                                title={music.primaryTrack.isFavorited ? "Unlike track" : "Like track"}
                                disabled={favoriteLoadingTrackId === music.primaryTrack.id}
                              >
                                {favoriteLoadingTrackId === music.primaryTrack.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                                ) : music.primaryTrack.isFavorited ? (
                                  <SolidThumbsUpIcon className="h-4 w-4 fill-current" />
                                ) : (
                                  <ThumbsUp className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-12 w-12 bg-white/20 p-0 text-white backdrop-blur-sm hover:bg-white/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music);
                                }}
                                aria-label={currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? "Pause track" : "Play track"}
                                title={currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? "Pause" : "Play"}
                              >
                                {currentlyPlaying === music.primaryTrack.id && audioPlayer.isPlaying ? (
                                  <Pause className="h-5 w-5 text-white" />
                                ) : (
                                  <Play className="h-5 w-5 text-white" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        {!hasCover && (
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="absolute inset-0 bg-white/20 dark:bg-black/25" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              {isActiveTrack ? (
                                <Pause className="h-5 w-5 text-slate-800 drop-shadow-[0_3px_10px_rgba(15,23,42,0.28)] dark:text-white dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]" />
                              ) : (
                                <Play className="h-5 w-5 translate-x-[1px] text-slate-800 drop-shadow-[0_3px_10px_rgba(15,23,42,0.28)] dark:text-white dark:drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]" />
                              )}
                            </div>
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0">
                          <div className="bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-2">
                            <div className="flex items-center gap-3 text-xs font-semibold text-white/85">
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
                        </div>
                      </div>

                      <div className="bg-transparent pb-4 pl-0 pr-4 pt-2">
                        <h3 className="mb-1 truncate text-base font-bold text-foreground">
                          {music.title}
                        </h3>
                        <p className="mb-2 overflow-hidden truncate whitespace-nowrap text-xs capitalize text-muted-foreground">
                          {music.tags}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : shouldLoad ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No music available yet</p>
            </div>
          ) : null}

        </div>

        <div
          className={`fixed inset-0 z-[70] transition-opacity duration-200 ${
            showInlinePanel ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!showInlinePanel}
        >
          <button
            type="button"
            aria-label="Close lyrics panel"
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
                  artist: music.primaryTrack.artist || "Unknown Artist",
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
                onTrackInfoClick={handlePlayerLyricsToggle}
                onClose={handleClosePlayer}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};
