"use client";

import React from "react";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n/provider";
import { supabase } from "@/lib/supabase";
import type { GenerationStartOptions } from "@/types/studio-feature-panel";

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

interface GenerationApiResult {
  success?: boolean;
  error?: string;
  data?: {
    taskId?: string;
    initialTracks?: unknown[];
  };
}

interface GenerationRequestParams {
  endpoint: string;
  body: FormData | string;
  failedToastKey: string;
  json?: boolean;
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
  const { t } = useI18n();

  const getAccessToken = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error(t("toasts.authenticationExpiredSignInAgain"));
    }

    return session.access_token;
  }, [t]);

  const runGenerationRequest = React.useCallback(async ({
    endpoint,
    body,
    failedToastKey,
    json = false,
  }: GenerationRequestParams): Promise<GenerationApiResult | null> => {
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (json) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });

    const result = await response.json().catch(() => ({} as GenerationApiResult));

    if (!response.ok || result?.success !== true) {
      if (response.status === 402) {
        toast.error(result?.error || t("toasts.insufficientCreditsTopUp"));
      } else {
        toast.error(result?.error || t(failedToastKey));
      }
      return null;
    }

    return result;
  }, [getAccessToken, t]);

  const finalizeGenerationTask = React.useCallback(async (
    result: GenerationApiResult,
    missingTaskToastKey: string,
  ) => {
    const taskId = result?.data?.taskId;
    const initialTracks = result?.data?.initialTracks;

    if (!taskId) {
      toast.error(t(missingTaskToastKey));
      return false;
    }

    trackExistingTask(taskId, initialTracks);
    openGenerationConfirm();
    await refreshCredits?.();
    return true;
  }, [openGenerationConfirm, refreshCredits, t, trackExistingTask]);

  const appendGenerationTuningToFormData = React.useCallback((
    formData: FormData,
    options?: GenerationStartOptions,
  ) => {
    if (typeof options?.styleWeight === "number") {
      formData.append("styleWeight", options.styleWeight.toString());
    }
    if (typeof options?.weirdnessConstraint === "number") {
      formData.append("weirdnessConstraint", options.weirdnessConstraint.toString());
    }
    if (typeof options?.audioWeight === "number") {
      formData.append("audioWeight", options.audioWeight.toString());
    }
  }, []);

  const appendGenerationTuningToRequestBody = React.useCallback((
    requestBody: Record<string, unknown>,
    options?: GenerationStartOptions,
  ) => {
    if (typeof options?.styleWeight === "number") {
      requestBody.styleWeight = options.styleWeight;
    }
    if (typeof options?.weirdnessConstraint === "number") {
      requestBody.weirdnessConstraint = options.weirdnessConstraint;
    }
    if (typeof options?.audioWeight === "number") {
      requestBody.audioWeight = options.audioWeight;
    }
  }, []);

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
      toast.error(t("toasts.pleaseProvideExactly2UploadedAudioUrlsForMashup"));
      return false;
    }

    const trimmedCustomLyrics = customLyrics.trim();
    const trimmedStyle = styleText.trim();
    const trimmedTitle = songTitle.trim();

    if (!trimmedStyle) {
      toast.error(t("toasts.pleaseEnterStyle"));
      return false;
    }
    if (!trimmedTitle) {
      toast.error(t("toasts.pleaseEnterTitle"));
      return false;
    }
    if (!trimmedCustomLyrics) {
      toast.error(t("toasts.pleaseEnterLyrics"));
      return false;
    }

    const modelLimits = getModelLimits(selectedModel);

    try {
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
      appendGenerationTuningToFormData(formData, options);

      const result = await runGenerationRequest({
        endpoint: "/api/music/mashup",
        body: formData,
        failedToastKey: "toasts.mashupGenerationFailedTryAgain",
      });

      if (!result) {
        return false;
      }

      return await finalizeGenerationTask(result, "toasts.mashupTaskIdMissingTryAgain");
    } catch (error) {
      console.error("Mashup generation failed:", error);
      const message = error instanceof Error ? error.message : t("toasts.mashupGenerationFailedTryAgain");
      toast.error(message);
      return false;
    }
  }, [
    customLyrics,
    appendGenerationTuningToFormData,
    finalizeGenerationTask,
    getModelLimits,
    openGenerationConfirm,
    refreshCredits,
    runGenerationRequest,
    selectedModel,
    setIsAuthModalOpen,
    songTitle,
    styleText,
    t,
    trackExistingTask,
    userId,
    vocalGender,
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
      toast.error(t("toasts.pleaseUploadAudioTrackFirst"));
      return false;
    }

    const trimmedTitle = songTitle.trim();
    if (!trimmedTitle) {
      toast.error(t("toasts.pleaseEnterTitle"));
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
        toast.error(t("toasts.pleaseEnterStyle"));
        return false;
      }
      if (!trimmedCustomLyrics) {
        toast.error(t("toasts.pleaseEnterLyrics"));
        return false;
      }
    } else {
      const trimmedTags = options.tags?.trim() || "";
      if (!trimmedTags) {
        toast.error(t("toasts.pleaseEnterTagsForMelodyMode"));
        return false;
      }
    }

    try {
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

      appendGenerationTuningToFormData(formData, options);

      const result = await runGenerationRequest({
        endpoint: "/api/music/upload",
        body: formData,
        failedToastKey: "toasts.uploadGenerationFailedTryAgain",
      });

      if (!result) {
        return false;
      }

      return await finalizeGenerationTask(result, "toasts.uploadTaskIdMissingTryAgain");
    } catch (error) {
      console.error("Upload transform generation failed:", error);
      const message = error instanceof Error ? error.message : t("toasts.uploadGenerationFailedTryAgain");
      toast.error(message);
      return false;
    }
  }, [
    customLyrics,
    appendGenerationTuningToFormData,
    finalizeGenerationTask,
    getModelLimits,
    openGenerationConfirm,
    refreshCredits,
    runGenerationRequest,
    selectedModel,
    setIsAuthModalOpen,
    songTitle,
    styleText,
    t,
    trackExistingTask,
    userId,
    vocalGender,
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
      toast.error(t("toasts.trackIdRequired"));
      return false;
    }

    const trimmedCustomLyrics = customLyrics.trim();
    const trimmedStyle = styleText.trim();
    const trimmedTitle = songTitle.trim();
    const effectiveModel = selectedModel;
    const limits = getModelLimits(effectiveModel);
    const continueAt = options.continueAt ?? 0;

    if (!trimmedStyle) {
      toast.error(t("toasts.pleaseEnterStyle"));
      return false;
    }
    if (!trimmedTitle) {
      toast.error(t("toasts.pleaseEnterTitle"));
      return false;
    }
    if (!trimmedCustomLyrics) {
      toast.error(t("toasts.pleaseEnterLyrics"));
      return false;
    }
    if (continueAt <= 0) {
      toast.error(t("toasts.startTimeMustBeGreaterThanZero"));
      return false;
    }

    try {
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
      appendGenerationTuningToRequestBody(requestBody, options);

      const result = await runGenerationRequest({
        endpoint: "/api/music/extend",
        body: JSON.stringify(requestBody),
        json: true,
        failedToastKey: "toasts.extendGenerationFailedTryAgain",
      });

      if (!result) {
        return false;
      }

      return await finalizeGenerationTask(result, "toasts.extendTaskIdMissingTryAgain");
    } catch (error) {
      console.error("Extend generation failed:", error);
      const message = error instanceof Error ? error.message : t("toasts.extendGenerationFailedTryAgain");
      toast.error(message);
      return false;
    }
  }, [
    customLyrics,
    appendGenerationTuningToRequestBody,
    finalizeGenerationTask,
    getModelLimits,
    openGenerationConfirm,
    refreshCredits,
    runGenerationRequest,
    selectedModel,
    selectedPersonaId,
    setIsAuthModalOpen,
    songTitle,
    styleText,
    t,
    trackExistingTask,
    userId,
    vocalGender,
  ]);

  return {
    handleMashupGenerationStart,
    handleUploadTransformGenerationStart,
    handleExtendGenerationStart,
  };
};
