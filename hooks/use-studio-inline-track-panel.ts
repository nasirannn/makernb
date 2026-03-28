"use client";

import React from "react";

import type { StudioTrack } from "@/types/track";

interface UseStudioInlineTrackPanelParams {
  selectedStudioTrack: StudioTrack | null;
  generatedTracks: any[];
  findTrackAndMusic: (trackId: string) => { track: any; music: any };
  playerCurrentTrackId?: string;
  playerIsPlaying: boolean;
  lyricsPanelOpen: boolean;
  setLyricsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useStudioInlineTrackPanel = ({
  selectedStudioTrack,
  generatedTracks,
  findTrackAndMusic,
  playerCurrentTrackId,
  playerIsPlaying,
  lyricsPanelOpen,
  setLyricsPanelOpen,
}: UseStudioInlineTrackPanelParams) => {
  const inlineTrackDetails = React.useMemo(() => {
    if (!selectedStudioTrack) return null;

    const base = {
      id: selectedStudioTrack.id,
      title: selectedStudioTrack.title || "Untitled Track",
      tags: selectedStudioTrack.tags || "",
      lyrics: selectedStudioTrack.musicType === 'generated_sound' ? "" : (selectedStudioTrack.lyrics || ""),
      coverImage: selectedStudioTrack.coverImage || null,
      createdAt: selectedStudioTrack.createdAt || new Date().toISOString(),
      duration: selectedStudioTrack.duration ? selectedStudioTrack.duration.toString() : undefined,
      musicType: selectedStudioTrack.musicType,
      isLiked: selectedStudioTrack.isLiked ?? false,
      isDisliked: selectedStudioTrack.isDisliked ?? false,
      status: (selectedStudioTrack as any).status || (selectedStudioTrack as any).musicStatus || "",
      isGenerating: Boolean((selectedStudioTrack as any).isGenerating),
      isCompleted: Boolean((selectedStudioTrack as any).isCompleted),
      audioUrl: selectedStudioTrack.audioUrl || "",
    };

    const { track: userTrack, music } = findTrackAndMusic(selectedStudioTrack.id);
    if (userTrack && music) {
      return {
        ...base,
        title: userTrack.title || music.title || base.title,
        tags: music.tags || base.tags,
        lyrics: music.type === 'generated_sound' ? '' : (userTrack.lyrics || music.lyrics || base.lyrics),
        musicType: music.type || base.musicType,
        coverImage: userTrack.coverR2Url || base.coverImage,
        createdAt: music.createdAt || base.createdAt,
        duration: userTrack.duration
          ? userTrack.duration.toString()
          : base.duration,
        isLiked: userTrack.isLiked ?? base.isLiked,
        isDisliked: userTrack.isDisliked ?? base.isDisliked,
        status: music.status || base.status,
        isGenerating: (music.status || "").toLowerCase() === "generating",
        isCompleted: (music.status || "").toLowerCase() === "complete" || (music.status || "").toLowerCase() === "completed",
        audioUrl: userTrack.audioUrl || base.audioUrl,
      };
    }

    const generated = generatedTracks.find((t) => t.id === selectedStudioTrack.id);
    if (generated) {
      return {
        ...base,
        title: generated.title || base.title,
        tags: generated.tags || base.tags,
        lyrics: generated.musicType === 'generated_sound' ? '' : (generated.lyrics || base.lyrics),
        musicType: generated.musicType || base.musicType,
        coverImage: generated.coverImage || base.coverImage,
        createdAt: generated.createdAt || base.createdAt,
        duration: generated.duration ? generated.duration.toString() : base.duration,
        isLiked: generated.isLiked ?? base.isLiked,
        isDisliked: generated.isDisliked ?? base.isDisliked,
        status: (generated as any).status || (generated as any).musicStatus || base.status,
        isGenerating: Boolean((generated as any).isGenerating),
        isCompleted: Boolean((generated as any).isCompleted),
        audioUrl: generated.audioUrl || base.audioUrl,
      };
    }

    return base;
  }, [selectedStudioTrack, findTrackAndMusic, generatedTracks]);

  const isInlineTrackPlaying = Boolean(
    selectedStudioTrack &&
    playerCurrentTrackId === selectedStudioTrack.id &&
    playerIsPlaying
  );

  const showInlinePanel = Boolean(selectedStudioTrack) && lyricsPanelOpen;

  React.useEffect(() => {
    if (!showInlinePanel) return;

    const handleEscapeClose = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLyricsPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscapeClose);
    return () => window.removeEventListener("keydown", handleEscapeClose);
  }, [showInlinePanel, setLyricsPanelOpen]);

  return {
    inlineTrackDetails,
    isInlineTrackPlaying,
    showInlinePanel,
  };
};
