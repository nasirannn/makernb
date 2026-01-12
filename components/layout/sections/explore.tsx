"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Music, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SafeImage } from "@/components/ui/safe-image";
import { Skeleton } from "@/components/ui/skeleton";
import { MusicPlayer } from "@/components/ui/music-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";

interface Track {
  id: string;
  audioUrl?: string;
  duration: number;
  coverR2Url?: string;
  artist?: string;
  playCount?: number;
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
  const [exploreData, setExploreData] = useState<ExploreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  const audioPlayer = useAudioPlayer();
  const audioPlayerRef = useRef(audioPlayer);
  const [playlist, setPlaylist] = useState<MusicGeneration[]>([]);

  useEffect(() => {
    audioPlayerRef.current = audioPlayer;
  }, [audioPlayer]);

  useEffect(() => {
    fetchExploreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      setCurrentlyPlaying(null);
      audioPlayerRef.current.clearCurrentTrack();
    };
  }, []);

  const formatPlayCount = (count?: number) => {
    if (!count || count < 0) return "0";
    if (count >= 1000) {
      const value = count / 1000;
      const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
      return `${formatted}k`;
    }
    return count.toString();
  };

  const PlayTriangleIcon = () => (
    <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
      <path d="M8 5.75v12.5c0 .8.88 1.28 1.55.84l9.5-6.25a1 1 0 0 0 0-1.68l-9.5-6.25A1 1 0 0 0 8 5.75z" />
    </svg>
  );

  const SolidPlayIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 5.75v12.5c0 .8.88 1.28 1.55.84l9.5-6.25a1 1 0 0 0 0-1.68l-9.5-6.25A1 1 0 0 0 8 5.75z"
      />
    </svg>
  );

  const SolidPauseIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M7 6.5c0-.55.45-1 1-1h1c.55 0 1 .45 1 1v11c0 .55-.45 1-1 1H8c-.55 0-1-.45-1-1v-11z" />
      <path fill="currentColor" d="M14 6.5c0-.55.45-1 1-1h1c.55 0 1 .45 1 1v11c0 .55-.45 1-1 1h-1c-.55 0-1-.45-1-1v-11z" />
    </svg>
  );

  const handleShare = async (trackId: string) => {
    try {
      if (!trackId) return;
      const shareUrl = `${window.location.origin}/track/${trackId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast("Link copied", { duration: 1500 });
    } catch (error) {
      console.error("Error copying share link:", error);
      toast("Copy failed", { duration: 2000 });
    }
  };

  const fetchExploreData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pinned-tracks?limit=8&offset=0");
      const data = await response.json();

      if (data.success) {
        const musicGenerations: MusicGeneration[] = data.data.tracks.map((track: any) => ({
          id: track.id,
          title: track.title,
          genre: track.genre,
          tags: track.tags,
          prompt: track.prompt,
          lyrics: null,
          createdAt: track.createdAt,
          updatedAt: track.updatedAt,
          primaryTrack: {
            id: track.id,
            audioUrl: track.audioUrl || "",
            duration: track.duration,
            coverR2Url: track.coverR2Url || "",
            playCount: track.playCount ?? 0,
            artist: track.artist,
          },
          allTracks: [
            {
              id: track.id,
              audioUrl: track.audioUrl || "",
              duration: track.duration,
              coverR2Url: track.coverR2Url || "",
              playCount: track.playCount ?? 0,
              artist: track.artist,
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
  };

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

  const handlePlayPause = (trackId: string, audioUrl: string, music: MusicGeneration) => {
    const trackIndex = playlist.findIndex((track) => track.primaryTrack.id === trackId);
    if (trackIndex === -1) return;

    if (currentlyPlaying === trackId) {
      audioPlayer.togglePlayPause();
      return;
    }

    void playTrack(trackIndex, trackId, audioUrl);
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

  const chunk = <T,>(items: T[], size: number) => {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      result.push(items.slice(i, i + size));
    }
    return result;
  };

  const pseudoAuthors = [
    "fairy_grunge",
    "ghost.in.the.shell",
    "analog.dreams",
    "neon_noir",
    "velvet.circuits",
    "midnight_muse",
    "satin_signal",
    "lofi_iris",
    "quiet.storm",
    "violet_pulse",
    "hushwave",
    "afterhours.fm",
  ] as const;

  const hashString = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const getDisplayAuthor = (seed: string) => {
    const idx = hashString(seed) % pseudoAuthors.length;
    return pseudoAuthors[idx];
  };

  const ExploreTrackCardSkeleton = ({ index }: { index: number }) => (
    <div className="group flex items-center gap-4 rounded-2xl px-2 py-2">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
        <Skeleton className="h-full w-full rounded-md" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-8 rounded-md" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex items-center">
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    </div>
  );

  return (
    <section id="explore" className="py-20">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-lg text-primary text-center mb-2 tracking-wider">Explore</h2>
          <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
            Listen to The AI-Generated R&B Songs
          </h2>
          <h3 className="md:w-1/2 mx-auto text-base md:text-lg text-center text-muted-foreground mb-8">
            Experience soulful R&B music crafted by artificial intelligence
          </h3>
        </div>

        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="-mx-4 mb-10 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-12 snap-x snap-mandatory">
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <div
                    key={colIndex}
                    className="snap-start flex w-[min(78vw,300px)] flex-col gap-6 sm:w-[280px] md:w-[300px] md:gap-10"
                    aria-label={`Explore tracks loading column ${colIndex + 1}`}
                  >
                    <ExploreTrackCardSkeleton index={colIndex * 2} />
                    <ExploreTrackCardSkeleton index={colIndex * 2 + 1} />
                  </div>
                ))}
              </div>
            </div>
          ) : exploreData && exploreData.music.length > 0 ? (
            <div className="-mx-4 mb-10 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex w-max gap-12 snap-x snap-mandatory">
                {chunk(exploreData.music, 2).map((column, colIndex) => (
                  <div
                    key={colIndex}
                    className="snap-start flex w-[min(78vw,300px)] flex-col gap-6 sm:w-[280px] md:w-[300px] md:gap-10"
                  >
                    {column.map((music) => {
	                      const artist = getDisplayAuthor(music.primaryTrack.id || music.id);
	                      // Kept for potential future use (e.g., variants), but intentionally not shown in UI.
	                      // const trackCount = Math.max(1, music.trackCount || music.allTracks?.length || 1);
	                      // const countBadge = String(trackCount).padStart(2, "0");
	                      const isCurrent = currentlyPlaying === music.primaryTrack.id;
	                      const isPlaying = isCurrent && audioPlayer.isPlaying;

	                      return (
	                        <div
	                          key={music.id}
	                          role="button"
	                          tabIndex={0}
                          className="group -mx-2 flex items-center gap-4 rounded-2xl px-2 py-2 cursor-pointer bg-transparent hover:bg-foreground/10 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          onClick={() => handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
	                              handlePlayPause(music.primaryTrack.id, music.primaryTrack.audioUrl || "", music);
	                            }
	                          }}
	                        >
	                          <div className="group/cover relative h-12 w-12 shrink-0 overflow-hidden rounded-md">
	                            {music.primaryTrack.coverR2Url ? (
	                              <SafeImage
	                                src={music.primaryTrack.coverR2Url}
	                                alt={music.title}
	                                fill
	                                className="object-cover"
	                                fallbackContent={<Music className="h-5 w-5 text-black/40" />}
	                              />
	                            ) : (
	                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-black/10 to-black/20">
	                                <Music className="h-5 w-5 text-black/40" />
	                              </div>
                            )}

                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/cover:opacity-100">
                              {isPlaying ? (
                                <SolidPauseIcon className="h-5 w-5 text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]" />
                              ) : (
                                <SolidPlayIcon className="h-5 w-5 translate-x-[1px] text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.55)]" />
                              )}
                            </div>
	                          </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 truncate text-[18px] font-semibold tracking-tight text-foreground">
                                  {music.title}
                                </div>
                              </div>

	                            <div className="mt-1 flex min-w-0 items-center gap-3 text-sm text-muted-foreground tabular-nums">
	                              <span className="inline-flex items-center gap-1.5">
	                                <PlayTriangleIcon />
	                                <span className="font-medium">{formatPlayCount(music.primaryTrack.playCount)}</span>
	                              </span>
                              <span className="min-w-0 truncate">
                                <span className="text-foreground/55 dark:text-foreground/70">by {artist}</span>
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleShare(music.primaryTrack.id);
                            }}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/55 transition-colors hover:text-foreground hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background -mr-1"
                            aria-label="Share track"
                            title="Copy share link"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No music available yet</p>
            </div>
          )}

	          {!loading && exploreData && exploreData.music.length > 0 && (
	            <div className="flex justify-center">
	              <Link
	                href="/explore"
	                aria-label="Explore all published tracks"
	                className="group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-foreground bg-foreground/5 hover:bg-foreground/10 dark:bg-white/10 dark:hover:bg-white/15 shadow-[0_12px_34px_rgba(0,0,0,0.10)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
	              >
	                <span>Explore All Published Tracks</span>
	              </Link>
	            </div>
	          )}
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
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
};
