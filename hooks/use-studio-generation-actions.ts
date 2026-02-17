"use client";

import React from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { FeatureCreatePanelProps } from "@/components/ui/feature-panels/music-generator-panel";

export type GenerationStartOptions = Parameters<NonNullable<FeatureCreatePanelProps["onGenerationStart"]>>[0];

interface ModelLimits {
  prompt: number;
  style: number;
  title: number;
}

interface UseStudioGenerationActionsParams {
  userId?: string;
  customLyrics: string;
  styleText: string;
  songTitle: string;
  selectedModel: string;
  selectedPersonaId: string;
  vocalGender: string;
  getModelLimits: (model: string) => ModelLimits;
  refreshCredits?: () => Promise<unknown> | void;
  trackExistingTask: (taskId: string, initialTracks?: any[]) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  openGenerationConfirm: () => void;
}

export const useStudioGenerationActions = ({
  userId,
  customLyrics,
  styleText,
  songTitle,
  selectedModel,
  selectedPersonaId,
  vocalGender,
  getModelLimits,
  refreshCredits,
  trackExistingTask,
  setIsAuthModalOpen,
  openGenerationConfirm,
}: UseStudioGenerationActionsParams) => {
  const handleMashupGenerationStart = React.useCallback(async (options?: GenerationStartOptions) => {
    if (options?.mode !== "mashup") {
      return false;
    }

    if (!userId) {
      setIsAuthModalOpen(true);
      return false;
    }

    const uploadUrlList = (options.uploadUrlList || []).map((url) => url.trim()).filter(Boolean);
    if (uploadUrlList.length !== 2) {
      toast.error("Please provide exactly 2 uploaded audio URLs for mashup.");
      return false;
    }

    const trimmedCustomLyrics = customLyrics.trim();
    const trimmedStyle = styleText.trim();
    const trimmedTitle = songTitle.trim();

    if (!trimmedStyle) {
      toast.error("Please enter a style.");
      return false;
    }
    if (!trimmedTitle) {
      toast.error("Please enter a title.");
      return false;
    }
    if (!trimmedCustomLyrics) {
      toast.error("Please enter lyrics.");
      return false;
    }

    const modelLimits = getModelLimits(selectedModel);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("uploadUrlList", uploadUrlList.join(","));
      formData.append("customMode", "true");
      formData.append("model", selectedModel);
      formData.append("title", trimmedTitle.slice(0, modelLimits.title));
      formData.append("style", trimmedStyle.slice(0, modelLimits.style));
      formData.append("prompt", trimmedCustomLyrics.slice(0, modelLimits.prompt));
      if (vocalGender) {
        formData.append("vocalGender", vocalGender);
      }
      if (typeof options.styleWeight === "number") {
        formData.append("styleWeight", options.styleWeight.toString());
      }
      if (typeof options.weirdnessConstraint === "number") {
        formData.append("weirdnessConstraint", options.weirdnessConstraint.toString());
      }
      if (typeof options.audioWeight === "number") {
        formData.append("audioWeight", options.audioWeight.toString());
      }

      const response = await fetch("/api/music/mashup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        if (response.status === 402) {
          toast.error(result?.error || "Insufficient credits. Please top up credits.");
        } else {
          toast.error(result?.error || "Mashup generation failed. Please try again.");
        }
        return false;
      }

      const taskId = result?.data?.taskId;
      const initialTracks = result?.data?.initialTracks;

      if (!taskId) {
        toast.error("Mashup task ID is missing. Please try again.");
        return false;
      }

      trackExistingTask(taskId, initialTracks);
      openGenerationConfirm();
      await refreshCredits?.();
      return true;
    } catch (error) {
      console.error("Mashup generation failed:", error);
      const message = error instanceof Error ? error.message : "Mashup generation failed. Please try again.";
      toast.error(message);
      return false;
    }
  }, [
    userId,
    customLyrics,
    styleText,
    songTitle,
    selectedModel,
    vocalGender,
    getModelLimits,
    refreshCredits,
    trackExistingTask,
    openGenerationConfirm,
    setIsAuthModalOpen,
  ]);

  const handleUploadTransformGenerationStart = React.useCallback(async (options?: GenerationStartOptions) => {
    if (options?.mode !== "vocal" && options?.mode !== "melody") {
      return false;
    }

    if (!userId) {
      setIsAuthModalOpen(true);
      return false;
    }

    const uploadUrl = options.uploadUrl?.trim() || "";
    if (!uploadUrl) {
      toast.error("Please upload audio first.");
      return false;
    }

    const trimmedTitle = songTitle.trim();
    if (!trimmedTitle) {
      toast.error("Please enter a title.");
      return false;
    }

    const uploadModel = selectedModel === "V5" || selectedModel === "V4_5PLUS"
      ? selectedModel
      : "V4_5PLUS";
    const modelLimits = getModelLimits(uploadModel);

    if (options.mode === "vocal") {
      const trimmedStyle = styleText.trim();
      const trimmedCustomLyrics = customLyrics.trim();

      if (!trimmedStyle) {
        toast.error("Please enter a style.");
        return false;
      }
      if (!trimmedCustomLyrics) {
        toast.error("Please enter lyrics.");
        return false;
      }
    } else {
      const trimmedTags = options.tags?.trim() || "";
      if (!trimmedTags) {
        toast.error("Please enter tags for melody mode.");
        return false;
      }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("mode", options.mode);
      formData.append("uploadUrl", uploadUrl);
      formData.append("model", uploadModel);
      formData.append("title", trimmedTitle.slice(0, modelLimits.title));

      if (options.mode === "vocal") {
        const trimmedStyle = styleText.trim();
        const trimmedCustomLyrics = customLyrics.trim();
        formData.append("style", trimmedStyle.slice(0, modelLimits.style));
        formData.append("prompt", trimmedCustomLyrics.slice(0, modelLimits.prompt));

        if (vocalGender) {
          formData.append("vocalGender", vocalGender);
        }
      } else {
        const trimmedTags = options.tags?.trim() || "";
        const trimmedNegativeTags = options.negativeTags?.trim() || "";
        formData.append("tags", trimmedTags.slice(0, modelLimits.style));
        if (trimmedNegativeTags) {
          formData.append("negativeTags", trimmedNegativeTags.slice(0, modelLimits.style));
        }
      }

      if (typeof options.styleWeight === "number") {
        formData.append("styleWeight", options.styleWeight.toString());
      }
      if (typeof options.weirdnessConstraint === "number") {
        formData.append("weirdnessConstraint", options.weirdnessConstraint.toString());
      }
      if (typeof options.audioWeight === "number") {
        formData.append("audioWeight", options.audioWeight.toString());
      }

      const response = await fetch("/api/music/upload", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + session.access_token,
        },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        if (response.status === 402) {
          toast.error(result?.error || "Insufficient credits. Please top up credits.");
        } else {
          toast.error(result?.error || "Upload generation failed. Please try again.");
        }
        return false;
      }

      const taskId = result?.data?.taskId;
      const initialTracks = result?.data?.initialTracks;

      if (!taskId) {
        toast.error("Task ID is missing. Please try again.");
        return false;
      }

      trackExistingTask(taskId, initialTracks);
      openGenerationConfirm();
      await refreshCredits?.();
      return true;
    } catch (error) {
      console.error("Upload transform generation failed:", error);
      const message = error instanceof Error ? error.message : "Upload generation failed. Please try again.";
      toast.error(message);
      return false;
    }
  }, [
    userId,
    songTitle,
    selectedModel,
    getModelLimits,
    styleText,
    customLyrics,
    vocalGender,
    refreshCredits,
    trackExistingTask,
    openGenerationConfirm,
    setIsAuthModalOpen,
  ]);

  const handleExtendGenerationStart = React.useCallback(async (options?: GenerationStartOptions) => {
    if (options?.mode !== "extend" || !options.trackId) {
      return false;
    }

    if (!userId) {
      setIsAuthModalOpen(true);
      return false;
    }

    const trackId = options.trackId.trim();
    const audioId = options.audioId?.trim() || "";
    if (!trackId) {
      toast.error("Track ID is required.");
      return false;
    }

    const trimmedCustomLyrics = customLyrics.trim();
    const trimmedStyle = styleText.trim();
    const trimmedTitle = songTitle.trim();
    const effectiveModel = selectedModel;
    const limits = getModelLimits(effectiveModel);
    const continueAt = options.continueAt ?? 0;

    if (!trimmedStyle) {
      toast.error("Please enter a style.");
      return false;
    }
    if (!trimmedTitle) {
      toast.error("Please enter a title.");
      return false;
    }
    if (!trimmedCustomLyrics) {
      toast.error("Please enter lyrics.");
      return false;
    }
    if (continueAt <= 0) {
      toast.error("Start time must be greater than 0s.");
      return false;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      const requestBody: Record<string, unknown> = {
        trackId,
        model: effectiveModel,
      };

      if (audioId) {
        requestBody.audioId = audioId;
      }

      requestBody.prompt = trimmedCustomLyrics.slice(0, limits.prompt);
      requestBody.style = trimmedStyle.slice(0, limits.style);
      requestBody.title = trimmedTitle.slice(0, limits.title);
      requestBody.continueAt = continueAt;
      if (vocalGender) {
        requestBody.vocalGender = vocalGender;
      }
      if (selectedPersonaId) {
        requestBody.personaId = selectedPersonaId;
      }

      if (typeof options.styleWeight === "number") {
        requestBody.styleWeight = options.styleWeight;
      }
      if (typeof options.weirdnessConstraint === "number") {
        requestBody.weirdnessConstraint = options.weirdnessConstraint;
      }
      if (typeof options.audioWeight === "number") {
        requestBody.audioWeight = options.audioWeight;
      }

      const response = await fetch("/api/music/extend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        if (response.status === 402) {
          toast.error(result?.error || "Insufficient credits. Please top up credits.");
        } else {
          toast.error(result?.error || "Extend generation failed. Please try again.");
        }
        return false;
      }

      const taskId = result?.data?.taskId;
      const initialTracks = result?.data?.initialTracks;

      if (!taskId) {
        toast.error("Extend task ID is missing. Please try again.");
        return false;
      }

      trackExistingTask(taskId, initialTracks);
      openGenerationConfirm();
      await refreshCredits?.();
      return true;
    } catch (error) {
      console.error("Extend generation failed:", error);
      const message = error instanceof Error ? error.message : "Extend generation failed. Please try again.";
      toast.error(message);
      return false;
    }
  }, [
    userId,
    customLyrics,
    styleText,
    songTitle,
    selectedModel,
    vocalGender,
    selectedPersonaId,
    getModelLimits,
    refreshCredits,
    trackExistingTask,
    openGenerationConfirm,
    setIsAuthModalOpen,
  ]);

  return {
    handleMashupGenerationStart,
    handleUploadTransformGenerationStart,
    handleExtendGenerationStart,
  };
};
