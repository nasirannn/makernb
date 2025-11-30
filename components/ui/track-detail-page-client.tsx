"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { TrackDetailView, type TrackInfo } from "@/components/ui/track-detail-view";
import { MusicPlayer } from "@/components/ui/music-player";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import { toast } from "sonner";

interface TrackDetailPageClientProps {
  trackId: string;
}

export const TrackDetailPageClient: React.FC<TrackDetailPageClientProps> = ({ trackId }) => {
  const router = useRouter();
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
  } = useAudioPlayer();

  const handleBack = React.useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/studio");
  }, [router]);

  const handlePlayTrack = React.useCallback((trackInfo: TrackInfo) => {
    if (!trackInfo?.audioUrl) {
      return;
    }

    if (currentTrack?.id === trackInfo.id) {
      togglePlayPause();
      return;
    }

    playTrack({
      id: trackInfo.id,
      title: trackInfo.title,
      audioUrl: trackInfo.audioUrl,
      streamAudioUrl: trackInfo.audioUrl,
      duration: parseFloat(trackInfo.duration) || 0,
      coverImage: trackInfo.coverImage || undefined,
      tags: trackInfo.tags,
      genre: trackInfo.tags,
      lyrics: trackInfo.lyrics,
      isFavorited: trackInfo.isFavorited,
    });
  }, [currentTrack?.id, playTrack, togglePlayPause]);

  const playerTracks = React.useMemo(
    () => (currentTrack ? [currentTrack] : []),
    [currentTrack]
  );

  const handleDownload = React.useCallback(async (trackInfo: TrackInfo, format: "mp3" | "wav") => {
    if (!trackInfo?.id) {
      toast.error("Missing track information");
      return;
    }

    const downloadingToast = toast.loading("Preparing download...");
    try {
      const response = await fetch(`/api/download-track?trackId=${trackInfo.id}&format=${format}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || "Download failed");
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (data.fallback && data.audioUrl) {
          const fallbackResponse = await fetch(data.audioUrl);
          if (!fallbackResponse.ok) {
            throw new Error(`Failed to fetch audio: ${fallbackResponse.status}`);
          }
          const blob = await fallbackResponse.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = `${trackInfo.title || "track"}.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        } else {
          throw new Error(data.error || "Download failed");
        }
      } else {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `${trackInfo.title || "track"}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }

      toast.success("Download started", { id: downloadingToast });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to download file", { id: downloadingToast });
    }
  }, []);

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
    currentTrack,
  ]);

  return (
    <>
      <TrackDetailView
        fullPage
        trackId={trackId}
        onBack={handleBack}
        onPlayTrack={handlePlayTrack}
        onDownload={handleDownload}
      />
      {playerTracks.length > 0 && (
        <div
          className="fixed left-3 right-3 md:right-3 z-[60]"
          style={{ bottom: 'calc(var(--mobile-nav-height, 0px) + 0.75rem)' }}
        >
          <MusicPlayer {...musicPlayerProps} />
        </div>
      )}
    </>
  );
};
