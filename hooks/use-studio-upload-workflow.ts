"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

export type UploadPanelMode = "simple" | "custom";
type UploadAudioMode = "cover" | "extend";

type UploadState = {
  coverFile: File | null;
  coverFileName: string | null;
  audioUrl: string | null;
  audioDuration: number | null;
  audioTotalDuration: number | null;
  audioCurrentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  isAnalyzing: boolean;
  audioMode: UploadAudioMode;
  audioUploadUrl: string | null;
  extendStartTime: number;
  readyFile: File | null;
  readyFileName: string | null;
  readyDuration: number | null;
  readyAudioUrl: string | null;
  progressOpen: boolean;
  progressStatus: "uploading" | "error" | "ready";
  progressError: string | null;
};

interface UseStudioUploadWorkflowParams {
  mode: UploadPanelMode;
}

const createUploadState = (): UploadState => ({
  coverFile: null,
  coverFileName: null,
  audioUrl: null,
  audioDuration: null,
  audioTotalDuration: null,
  audioCurrentTime: 0,
  isPlaying: false,
  isMuted: false,
  isAnalyzing: false,
  audioMode: "cover",
  audioUploadUrl: null,
  extendStartTime: 0,
  readyFile: null,
  readyFileName: null,
  readyDuration: null,
  readyAudioUrl: null,
  progressOpen: false,
  progressStatus: "uploading",
  progressError: null,
});

export const useStudioUploadWorkflow = ({ mode }: UseStudioUploadWorkflowParams) => {
  const [uploadStateByMode, setUploadStateByMode] = React.useState<Record<UploadPanelMode, UploadState>>(() => ({
    simple: createUploadState(),
    custom: createUploadState(),
  }));
  const uploadFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const revokeObjectUrl = React.useCallback((url?: string | null) => {
    if (!url) {
      return;
    }
    URL.revokeObjectURL(url);
  }, []);

  const updateCurrentUploadState = React.useCallback((patch: Partial<UploadState>) => {
    setUploadStateByMode((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        ...patch,
      },
    }));
  }, [mode]);

  const currentUploadState = uploadStateByMode[mode];

  const {
    coverFile,
    coverFileName,
    audioUrl,
    audioDuration,
    audioTotalDuration,
    audioCurrentTime,
    isPlaying,
    isMuted,
    isAnalyzing,
    audioMode,
    audioUploadUrl,
    extendStartTime,
    readyFile,
    readyFileName,
    readyDuration,
    readyAudioUrl,
    progressOpen,
    progressStatus,
    progressError,
  } = currentUploadState;

  const clearUploadCoverFile = React.useCallback(() => {
    revokeObjectUrl(readyAudioUrl);
    revokeObjectUrl(audioUrl);
    if (uploadAudioRef.current) {
      uploadAudioRef.current.pause();
      uploadAudioRef.current.src = '';
      uploadAudioRef.current = null;
    }

    updateCurrentUploadState({
      coverFile: null,
      coverFileName: null,
      audioDuration: null,
      audioTotalDuration: null,
      audioCurrentTime: 0,
      isPlaying: false,
      isMuted: false,
      isAnalyzing: false,
      audioMode: "cover",
      audioUploadUrl: null,
      extendStartTime: 0,
      readyFile: null,
      readyFileName: null,
      readyDuration: null,
      readyAudioUrl: null,
      progressOpen: false,
      progressStatus: "uploading",
      progressError: null,
      audioUrl: null,
    });
  }, [readyAudioUrl, audioUrl, revokeObjectUrl, updateCurrentUploadState]);

  React.useEffect(() => {
    if (audioDuration && extendStartTime > audioDuration) {
      updateCurrentUploadState({ extendStartTime: audioDuration });
    }
  }, [audioDuration, extendStartTime, updateCurrentUploadState]);

  const updateExtendStartTime = React.useCallback((
    value: number,
    options: { syncPlayback?: boolean } = {}
  ) => {
    const { syncPlayback = true } = options;
    const maxValue = audioDuration || 0;
    const clamped = Math.max(0, Math.min(value, maxValue));
    updateCurrentUploadState({ extendStartTime: clamped });
    if (syncPlayback && uploadAudioRef.current) {
      uploadAudioRef.current.currentTime = clamped;
      updateCurrentUploadState({ audioCurrentTime: clamped });
    }
  }, [audioDuration, updateCurrentUploadState]);

  const getAccessToken = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Authentication expired. Please sign in again.");
    }
    return session.access_token;
  }, []);

  const uploadAudioToServer = React.useCallback(async (file: File) => {
    const accessToken = await getAccessToken();
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/music/upload-file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    let result: { success?: boolean; error?: string; data?: { downloadUrl?: string } } | null = null;
    let responseText = "";

    try {
      responseText = await response.text();
      result = responseText
        ? (JSON.parse(responseText) as { success?: boolean; error?: string; data?: { downloadUrl?: string } })
        : null;
    } catch {
      result = null;
    }

    if (!response.ok || !result?.success) {
      const serverMessage = typeof result?.error === "string" ? result.error : null;
      const fallbackMessage = response.ok
        ? "Upload failed. Please try again."
        : `Upload failed (HTTP ${response.status}). Please try again.`;

      if (serverMessage) {
        throw new Error(serverMessage);
      }

      // Preserve textual error bodies from non-JSON upstream responses when available.
      if (responseText && !result) {
        throw new Error(responseText);
      }

      throw new Error(fallbackMessage);
    }

    const downloadUrl = result.data?.downloadUrl;
    if (!downloadUrl) {
      throw new Error("Upload succeeded but no download URL was returned.");
    }

    return downloadUrl;
  }, [getAccessToken]);

  React.useEffect(() => {
    if (!audioUrl) {
      if (uploadAudioRef.current) {
        uploadAudioRef.current.pause();
        uploadAudioRef.current.src = '';
        uploadAudioRef.current = null;
      }
      updateCurrentUploadState({
        isPlaying: false,
        audioCurrentTime: 0,
        isMuted: false,
      });
      return;
    }

    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';
    audio.muted = false;
    uploadAudioRef.current = audio;
    updateCurrentUploadState({ isMuted: false });

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        updateCurrentUploadState({
          audioDuration: audio.duration,
          audioTotalDuration: audioTotalDuration ?? audio.duration,
        });
      }
      updateCurrentUploadState({ isAnalyzing: false });
    };

    const handleTimeUpdate = () => {
      updateCurrentUploadState({ audioCurrentTime: audio.currentTime });
    };

    const handlePlay = () => {
      updateCurrentUploadState({ isPlaying: true });
    };

    const handlePause = () => {
      updateCurrentUploadState({ isPlaying: false });
    };

    const handleVolumeChange = () => {
      updateCurrentUploadState({ isMuted: audio.muted });
    };

    const handleEnded = () => {
      updateCurrentUploadState({ isPlaying: false, audioCurrentTime: 0 });
      audio.currentTime = 0;
    };

    const handleError = () => {
      updateCurrentUploadState({ isAnalyzing: false, isPlaying: false });
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('volumechange', handleVolumeChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('volumechange', handleVolumeChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
      if (uploadAudioRef.current === audio) {
        uploadAudioRef.current = null;
      }
    };
  }, [audioUrl, updateCurrentUploadState, audioTotalDuration]);

  const handleUploadAudioPlayPause = React.useCallback(async () => {
    const audio = uploadAudioRef.current;
    if (!audio) return;
    if (isAnalyzing) return;
    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      updateCurrentUploadState({ isPlaying: false });
    }
  }, [isAnalyzing, updateCurrentUploadState]);

  const handleUploadAudioMuteToggle = React.useCallback(() => {
    const audio = uploadAudioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    updateCurrentUploadState({ isMuted: audio.muted });
  }, [updateCurrentUploadState]);

  return {
    uploadFileInputRef,
    updateCurrentUploadState,

    uploadCoverFile: coverFile,
    uploadCoverFileName: coverFileName,
    uploadAudioUrl: audioUrl,
    uploadAudioDuration: audioDuration,
    uploadAudioTotalDuration: audioTotalDuration,
    uploadAudioCurrentTime: audioCurrentTime,
    isUploadAudioPlaying: isPlaying,
    isUploadAudioMuted: isMuted,
    isUploadAudioAnalyzing: isAnalyzing,
    uploadAudioMode: audioMode,
    uploadAudioUploadUrl: audioUploadUrl,
    uploadExtendStartTime: extendStartTime,
    readyFile,
    readyFileName,
    readyDuration,
    readyAudioUrl,
    isUploadProgressOpen: progressOpen,
    uploadProgressStatus: progressStatus,
    uploadProgressError: progressError,

    clearUploadCoverFile,
    updateExtendStartTime,
    uploadAudioToServer,
    handleUploadAudioPlayPause,
    handleUploadAudioMuteToggle,
  };
};
