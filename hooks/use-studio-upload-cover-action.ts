"use client";

import React from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { StudioFeatureKey } from "@/lib/studio-features";
import type { MusicType } from "@/types/music";
import type { MusicGenerationTrack } from "@/types/track";

export interface UploadCoverOptions {
  uploadFile?: File | null;
  uploadUrl?: string | null;
  mode?: "cover" | "extend";
  continueAt?: number;
  isPublished?: boolean;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
}

interface ModelLimits {
  prompt: number;
  style: number;
  title: number;
}

interface UseStudioUploadCoverActionParams {
  userId?: string;
  simplePrompt: string;
  customLyrics: string;
  styleText: string;
  songTitle: string;
  instrumentalMode: boolean;
  feature: StudioFeatureKey;
  activeFeatureMode: "simple" | "custom";
  selectedModel: string;
  selectedPersonaId: string;
  selectedPersonaModel: "style_persona" | "voice_persona";
  isPublished: boolean;
  getModelLimits: (model: string) => ModelLimits;
  refreshCredits?: () => Promise<unknown> | void;
  updateTracks: (
    newTracksOrUpdater:
      | MusicGenerationTrack[]
      | ((prevTracks: MusicGenerationTrack[]) => MusicGenerationTrack[])
  ) => void;
  trackExistingTask: (taskId: string, initialTracks?: any[]) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  clearSelectedStudioTrack: () => void;
  openGenerationConfirm: () => void;
}

export const useStudioUploadCoverAction = ({
  userId,
  simplePrompt,
  customLyrics,
  styleText,
  songTitle,
  instrumentalMode,
  feature,
  activeFeatureMode,
  selectedModel,
  selectedPersonaId,
  selectedPersonaModel,
  isPublished,
  getModelLimits,
  refreshCredits,
  updateTracks,
  trackExistingTask,
  setIsAuthModalOpen,
  clearSelectedStudioTrack,
  openGenerationConfirm,
}: UseStudioUploadCoverActionParams) => {
  return React.useCallback(async (options?: UploadCoverOptions) => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return false;
    }

    const trimmedSimplePrompt = simplePrompt.trim();
    const trimmedCustomLyrics = customLyrics.trim();
    const trimmedStyle = styleText.trim();
    const trimmedTitle = songTitle.trim();
    const uploadMode = options?.mode === "extend" ? "extend" : "cover";
    const isExtendUploadRequest = uploadMode === "extend";
    const isSimpleMode = activeFeatureMode === "simple";
    const isCustomMode = activeFeatureMode === "custom";
    const useCustomUploadParams = isCustomMode || isExtendUploadRequest;
    const effectiveModel = useCustomUploadParams ? selectedModel : "V4";
    const forceInstrumentalFalseForUpload = feature === "music-extender" || feature === "music-cover";
    const effectiveUploadInstrumental = forceInstrumentalFalseForUpload
      ? false
      : useCustomUploadParams
        ? instrumentalMode
        : false;

    if (!useCustomUploadParams && isSimpleMode && !trimmedSimplePrompt) {
      toast.error("Please enter a prompt.");
      return false;
    }

    if (useCustomUploadParams) {
      if (!trimmedStyle) {
        toast.error("Please enter a style.");
        return false;
      }
      if (!trimmedTitle) {
        toast.error("Please enter a title.");
        return false;
      }
      if (!effectiveUploadInstrumental && !trimmedCustomLyrics) {
        toast.error("Please enter lyrics.");
        return false;
      }
    }

    const uploadFile = options?.uploadFile ?? null;
    const uploadUrl = options?.uploadUrl ?? null;
    const continueAt = options?.continueAt ?? 0;
    if (!uploadUrl) {
      toast.error("Upload URL is required. Please upload your audio first.");
      return false;
    }

    if (isExtendUploadRequest && continueAt <= 0) {
      toast.error("Start time must be greater than 0s.");
      return false;
    }

    clearSelectedStudioTrack();

    const placeholderGenerationId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const placeholderTags = useCustomUploadParams ? trimmedStyle : trimmedSimplePrompt;
    const placeholderPrompt = useCustomUploadParams ? trimmedStyle : trimmedSimplePrompt;
    const placeholderTitle = trimmedTitle || (uploadFile?.name ? uploadFile.name.replace(/\.[^/.]+$/, "") : "Untitled Track");
    const generationMode = useCustomUploadParams ? "custom" : "simple";
    const placeholderMusicType: MusicType = isExtendUploadRequest ? "upload_extend" : "upload_cover";

    flushSync(() => {
      updateTracks((prevTracks) => ([
        {
          id: `${placeholderGenerationId}_placeholder_0`,
          generationId: placeholderGenerationId,
          sunoTrackId: null,
          title: placeholderTitle,
          audioUrl: "",
          streamAudioUrl: "",
          duration: undefined,
          coverImage: undefined,
          tags: placeholderTags,
          genre: "",
          prompt: placeholderPrompt,
          lyrics: "",
          model: effectiveModel,
          createdAt: new Date().toISOString(),
          isGenerating: true,
          isCompleted: false,
          isPlaceholder: true,
          generationMode,
          musicType: placeholderMusicType,
        },
        {
          id: `${placeholderGenerationId}_placeholder_1`,
          generationId: placeholderGenerationId,
          sunoTrackId: null,
          title: placeholderTitle,
          audioUrl: "",
          streamAudioUrl: "",
          duration: undefined,
          coverImage: undefined,
          tags: placeholderTags,
          genre: "",
          prompt: placeholderPrompt,
          lyrics: "",
          model: effectiveModel,
          createdAt: new Date().toISOString(),
          isGenerating: true,
          isCompleted: false,
          isPlaceholder: true,
          generationMode,
          musicType: placeholderMusicType,
        },
        ...prevTracks,
      ]));
    });

    const removePlaceholderTracks = () => {
      updateTracks((prevTracks) =>
        prevTracks.filter((track) => !(track.isPlaceholder && track.generationId === placeholderGenerationId))
      );
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        removePlaceholderTracks();
        throw new Error("Authentication expired. Please sign in again.");
      }

      const formData = new FormData();
      const limits = getModelLimits(effectiveModel);
      const requestedIsPublished = options?.isPublished ?? isPublished;
      formData.append("mode", uploadMode);
      formData.append("uploadUrl", uploadUrl);
      if (isExtendUploadRequest) {
        formData.append("continueAt", continueAt.toString());
      } else {
        formData.append("customMode", isCustomMode ? "true" : "false");
        formData.append("isPublished", requestedIsPublished ? "true" : "false");
      }
      formData.append("instrumental", effectiveUploadInstrumental ? "true" : "false");
      formData.append("model", effectiveModel);

      if (useCustomUploadParams) {
        if (trimmedStyle) {
          formData.append("style", trimmedStyle.slice(0, limits.style));
        }
        if (trimmedTitle) {
          formData.append("title", trimmedTitle.slice(0, limits.title));
        }
        if (!effectiveUploadInstrumental && trimmedCustomLyrics) {
          formData.append("prompt", trimmedCustomLyrics.slice(0, limits.prompt));
        }

        if (selectedPersonaId) {
          formData.append("personaId", selectedPersonaId);
          formData.append("personaModel", selectedPersonaModel);
        }
        if (typeof options?.styleWeight === "number") {
          formData.append("styleWeight", options.styleWeight.toString());
        }
        if (typeof options?.weirdnessConstraint === "number") {
          formData.append("weirdnessConstraint", options.weirdnessConstraint.toString());
        }
        if (typeof options?.audioWeight === "number") {
          formData.append("audioWeight", options.audioWeight.toString());
        }
      } else if (trimmedSimplePrompt) {
        formData.append("prompt", trimmedSimplePrompt.slice(0, 500));
      }

      const response = await fetch("/api/music/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        removePlaceholderTracks();
        if (response.status === 402) {
          toast.error(result?.error || "Insufficient credits. Please top up credits.");
        } else {
          toast.error(result?.error || "Upload failed. Please try again.");
        }
        return false;
      }

      const taskId = result?.data?.taskId;
      const initialTracks = result?.data?.initialTracks;

      if (taskId) {
        removePlaceholderTracks();
        trackExistingTask(taskId, initialTracks);
        openGenerationConfirm();
      }

      await refreshCredits?.();
      return true;
    } catch (error) {
      console.error("Upload audio error:", error);
      removePlaceholderTracks();
      const message = error instanceof Error ? error.message : "Upload failed. Please try again.";
      toast.error(message);
      return false;
    }
  }, [
    userId,
    simplePrompt,
    customLyrics,
    styleText,
    songTitle,
    instrumentalMode,
    feature,
    activeFeatureMode,
    selectedModel,
    selectedPersonaId,
    selectedPersonaModel,
    isPublished,
    getModelLimits,
    refreshCredits,
    updateTracks,
    trackExistingTask,
    setIsAuthModalOpen,
    clearSelectedStudioTrack,
    openGenerationConfirm,
  ]);
};
