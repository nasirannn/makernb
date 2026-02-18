"use client";

import React from "react";

import { supabase } from "@/lib/supabase";
import type { StudioTrack } from "@/types/track";

interface StudioPlayerLike {
  currentTrack?: any;
  isPlaying: boolean;
  duration: number;
  playTrack: (track: any) => Promise<void> | void;
  togglePlayPause: () => void;
}

interface UseStudioTrackPlaybackParams {
  allTracks: any[];
  generatedTracks: any[];
  findTrackAndMusic: (trackId: string) => { track: any; music: any };
  createTrackObject: (...args: any[]) => any;
  player: StudioPlayerLike;
  selectedStudioTrack: StudioTrack | null;
  lyricsPanelOpen: boolean;
  setSelectedStudioTrack: React.Dispatch<React.SetStateAction<StudioTrack | null>>;
  setLyricsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useStudioTrackPlayback = ({
  allTracks,
  generatedTracks,
  findTrackAndMusic,
  createTrackObject,
  player,
  selectedStudioTrack,
  lyricsPanelOpen,
  setSelectedStudioTrack,
  setLyricsPanelOpen,
}: UseStudioTrackPlaybackParams) => {
  const playTrackById = React.useCallback(async (trackId: string) => {
    try {
      let localTrack = allTracks.find((track) => track.id === trackId);

      if (!localTrack || !localTrack.audioUrl) {
        console.log("Track not found in local cache, fetching from server:", trackId);

        try {
          const { data: { session } } = await supabase.auth.getSession();

          const response = await fetch(`/api/track-info/${trackId}`, {
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });

          if (response.ok) {
            const trackData = await response.json();
            if (trackData.success && trackData.track) {
              const track = trackData.track;
              localTrack = createTrackObject(
                track.id,
                track.musicId,
                track.title,
                track.audioUrl,
                track.duration,
                track.coverR2Url,
                track.tags,
                track.lyrics,
                track.isFavorited || false,
                track.isLiked || false,
                track.isDisliked || false,
                track.streamAudioUrl,
                track.createdAt,
                track.generationMode,
                track.sunoTrackId ?? track.suno_track_id ?? null
              );
              console.log("Successfully fetched track from server:", localTrack);
            }
          }
        } catch (fetchError) {
          console.error("Failed to fetch track from server:", fetchError);
        }
      }

      if (!localTrack || !localTrack.audioUrl) {
        console.warn("Track not found or no audio URL:", trackId);
        return;
      }

      await player.playTrack({
        id: localTrack.id,
        title: localTrack.title,
        audioUrl: localTrack.audioUrl,
        streamAudioUrl: localTrack.streamAudioUrl,
        duration: localTrack.duration,
        lyrics: localTrack.lyrics,
        tags: localTrack.tags,
        generationId: localTrack.generationId,
        isFavorited: localTrack.isFavorited,
        isLiked: localTrack.isLiked,
        isDisliked: localTrack.isDisliked,
        coverImage: localTrack.coverImage,
        coverR2Url: localTrack.coverR2Url,
      });
    } catch (error) {
      console.error("Error playing track:", error);
    }
  }, [allTracks, createTrackObject, player]);

  const handlePrevious = React.useCallback(() => {
    if (!player.currentTrack || allTracks.length === 0) return;

    const currentIndex = allTracks.findIndex((track) => track.id === player.currentTrack?.id);
    if (currentIndex === -1) return;

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : allTracks.length - 1;
    const prevTrack = allTracks[prevIndex];

    if (prevTrack) {
      void playTrackById(prevTrack.id);
      setSelectedStudioTrack(prevTrack);
      setLyricsPanelOpen(true);
    }
  }, [allTracks, playTrackById, player, setSelectedStudioTrack, setLyricsPanelOpen]);

  const handleNext = React.useCallback(() => {
    if (!player.currentTrack || allTracks.length === 0) return;

    const currentIndex = allTracks.findIndex((track) => track.id === player.currentTrack?.id);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex < allTracks.length - 1 ? currentIndex + 1 : 0;
    const nextTrack = allTracks[nextIndex];

    if (nextTrack) {
      void playTrackById(nextTrack.id);
      setSelectedStudioTrack(nextTrack);
      setLyricsPanelOpen(true);
    }
  }, [allTracks, playTrackById, player, setSelectedStudioTrack, setLyricsPanelOpen]);

  const handleTrackSelect = React.useCallback((
    track: any,
    music: any,
    options: { autoPlay?: boolean } = {}
  ) => {
    const { autoPlay = true } = options;

    if (player.currentTrack?.id === track.id) {
      const selectedTrack = createTrackObject(
        track.id,
        music.id,
        track.title || music.title || "Untitled Track",
        track.audioUrl || "",
        track.duration,
        track.coverR2Url || track.coverImage,
        music.tags,
        track.lyrics || music.lyrics,
        track.isFavorited || false,
        track.isLiked || false,
        track.isDisliked || false,
        track.streamAudioUrl || "",
        track.createdAt || music.createdAt || new Date().toISOString(),
        music.generationMode
      );
      setSelectedStudioTrack(selectedTrack);
      setLyricsPanelOpen(true);

      if (autoPlay) {
        player.togglePlayPause();
      }
      return;
    }

    const selectedTrack = createTrackObject(
      track.id,
      music.id,
      track.title || music.title || "Untitled Track",
      track.audioUrl || track.audio_url || "",
      track.duration,
      track.coverR2Url || track.cover_r2_url || track.coverImage,
      music.tags,
      track.lyrics || music.lyrics,
      track.isFavorited ?? track.is_favorited ?? false,
      track.isLiked ?? track.is_liked ?? false,
      track.isDisliked ?? track.is_disliked ?? false,
      track.streamAudioUrl || track.stream_audio_url,
      track.createdAt || music.createdAt || new Date().toISOString(),
      music.generationMode
    );
    setSelectedStudioTrack(selectedTrack);
    setLyricsPanelOpen(true);

    if (autoPlay) {
      void playTrackById(track.id);
    }
  }, [player, createTrackObject, setSelectedStudioTrack, setLyricsPanelOpen, playTrackById]);

  const handleInlineTrackPreview = React.useCallback((track: any) => {
    if (!track) return;
    const normalized = createTrackObject(
      track.id,
      track.generationId || track.musicGeneration?.id || track.musicId || "",
      track.title || track.musicTitle || "Untitled Track",
      track.audioUrl || track.audio_url || "",
      typeof track.duration === "string" ? parseFloat(track.duration) : (track.duration || 0),
      track.coverR2Url || track.coverImage,
      track.tags || track.musicTags || "",
      track.lyrics || track.musicGeneration?.lyricsContent || "",
      track.isFavorited ?? false,
      track.isLiked ?? false,
      track.isDisliked ?? false,
      track.streamAudioUrl || "",
      track.createdAt || track.musicGeneration?.createdAt || new Date().toISOString(),
      track.musicGeneration?.generationMode
    );
    setSelectedStudioTrack(normalized);
    setLyricsPanelOpen(true);
  }, [createTrackObject, setSelectedStudioTrack, setLyricsPanelOpen]);

  const handleUserTrackSelect = React.useCallback((trackId: string) => {
    const shouldAutoPlay = !(player.currentTrack?.id === trackId && player.isPlaying);
    const { track: found, music } = findTrackAndMusic(trackId);
    if (found && music) {
      handleTrackSelect(found, music, { autoPlay: shouldAutoPlay });
      return;
    }

    const fallbackTrack = allTracks.find((track) => track.id === trackId);
    if (fallbackTrack) {
      handleTrackSelect(fallbackTrack, fallbackTrack, { autoPlay: shouldAutoPlay });
    }
  }, [player, findTrackAndMusic, handleTrackSelect, allTracks]);

  const handleUserTrackPlay = React.useCallback((track: any, _music: any) => {
    if (!track) return;
    if (player.currentTrack?.id === track.id) {
      player.togglePlayPause();
      return;
    }
    void playTrackById(track.id);
  }, [player, playTrackById]);

  const handleGeneratedTrackSelect = React.useCallback((trackId: string) => {
    const track = generatedTracks.find((t) => t.id === trackId);
    if (track) {
      const shouldAutoPlay = !(player.currentTrack?.id === trackId && player.isPlaying);
      handleTrackSelect(track, track, { autoPlay: shouldAutoPlay });
    }
  }, [generatedTracks, player, handleTrackSelect]);

  const handlePlayerLyricsToggle = React.useCallback(() => {
    const playerTrack = player.currentTrack as any;
    if (!playerTrack?.id) return;

    if (!lyricsPanelOpen || selectedStudioTrack?.id !== playerTrack.id) {
      const matchedTrack = allTracks.find((track) => track.id === playerTrack.id);

      if (matchedTrack) {
        setSelectedStudioTrack(matchedTrack);
      } else {
        setSelectedStudioTrack(
          createTrackObject(
            playerTrack.id,
            playerTrack.generationId || "",
            playerTrack.title || "Untitled Track",
            playerTrack.audioUrl || "",
            Number(playerTrack.duration || player.duration || 0),
            playerTrack.coverR2Url || playerTrack.coverImage,
            playerTrack.tags || "",
            playerTrack.lyrics || "",
            playerTrack.isFavorited ?? false,
            playerTrack.isLiked ?? false,
            playerTrack.isDisliked ?? false,
            playerTrack.streamAudioUrl || "",
            new Date().toISOString(),
            ""
          )
        );
      }
    }

    setLyricsPanelOpen((prev) => !prev);
  }, [
    player,
    lyricsPanelOpen,
    selectedStudioTrack,
    allTracks,
    createTrackObject,
    setSelectedStudioTrack,
    setLyricsPanelOpen,
  ]);

  return {
    playTrackById,
    handlePrevious,
    handleNext,
    handleTrackSelect,
    handleInlineTrackPreview,
    handleUserTrackSelect,
    handleUserTrackPlay,
    handleGeneratedTrackSelect,
    handlePlayerLyricsToggle,
  };
};
