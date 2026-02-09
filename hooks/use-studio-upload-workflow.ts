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
  const maxUploadBytes = 40 * 1024 * 1024;

  const [uploadStateByMode, setUploadStateByMode] = React.useState<Record<UploadPanelMode, UploadState>>(() => ({
    simple: createUploadState(),
    custom: createUploadState(),
  }));
  const [pendingAudioMode, setPendingAudioMode] = React.useState<UploadPanelMode>("simple");
  const uploadFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isEditAudioOpen, setIsEditAudioOpen] = React.useState(false);
  const [pendingAudioFile, setPendingAudioFile] = React.useState<File | null>(null);
  const [pendingAudioUrl, setPendingAudioUrl] = React.useState<string | null>(null);

  const updateUploadState = React.useCallback((targetMode: UploadPanelMode, patch: Partial<UploadState>) => {
    setUploadStateByMode((prev) => ({
      ...prev,
      [targetMode]: {
        ...prev[targetMode],
        ...patch,
      },
    }));
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
  const pendingUploadState = uploadStateByMode[pendingAudioMode];

  const {
    coverFile,
    coverFileName,
    audioUrl,
    audioDuration,
    audioTotalDuration,
    audioCurrentTime,
    isPlaying,
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
    if (readyAudioUrl) {
      URL.revokeObjectURL(readyAudioUrl);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
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
  }, [readyAudioUrl, audioUrl, updateCurrentUploadState]);

  React.useEffect(() => {
    if (!audioUrl) {
      updateCurrentUploadState({
        isPlaying: false,
        audioCurrentTime: 0,
      });
    }
  }, [audioUrl, updateCurrentUploadState]);

  React.useEffect(() => {
    if (audioDuration && extendStartTime > audioDuration) {
      updateCurrentUploadState({ extendStartTime: audioDuration });
    }
  }, [audioDuration, extendStartTime, updateCurrentUploadState]);

  const updateExtendStartTime = React.useCallback((value: number) => {
    const maxValue = audioDuration || 0;
    const clamped = Math.max(0, Math.min(value, maxValue));
    updateCurrentUploadState({ extendStartTime: clamped });
    if (uploadAudioRef.current) {
      uploadAudioRef.current.currentTime = clamped;
      updateCurrentUploadState({ audioCurrentTime: clamped });
    }
  }, [audioDuration, updateCurrentUploadState]);

  const resetPendingAudio = React.useCallback(() => {
    if (pendingAudioUrl) {
      URL.revokeObjectURL(pendingAudioUrl);
    }
    setPendingAudioFile(null);
    setPendingAudioUrl(null);
    setIsEditAudioOpen(false);
  }, [pendingAudioUrl]);

  const uploadAudioToServer = React.useCallback(async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Authentication expired. Please sign in again.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/music/upload-file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "Upload failed. Please try again.");
    }
    return result.data?.downloadUrl as string;
  }, []);

  const handleCoverFileSelected = React.useCallback((file: File) => {
    if (pendingAudioUrl) {
      URL.revokeObjectURL(pendingAudioUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setPendingAudioFile(file);
    setPendingAudioUrl(nextUrl);
    setPendingAudioMode(mode);
    updateCurrentUploadState({
      audioTotalDuration: null,
      readyFile: null,
      readyFileName: null,
      readyDuration: null,
      coverFileName: null,
      audioUploadUrl: null,
    });
    if (readyAudioUrl) {
      URL.revokeObjectURL(readyAudioUrl);
      updateCurrentUploadState({ readyAudioUrl: null });
    }
    setIsEditAudioOpen(true);
  }, [pendingAudioUrl, mode, updateCurrentUploadState, readyAudioUrl]);

  const handlePromptFileChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (file.size > maxUploadBytes) {
      event.target.value = "";
      throw new Error("File size must be under 40MB.");
    }

    if (!file.type.startsWith("audio/")) {
      event.target.value = "";
      throw new Error("Unsupported file type. Please upload audio.");
    }

    handleCoverFileSelected(file);
    event.target.value = "";
  }, [handleCoverFileSelected, maxUploadBytes]);

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
      });
      return;
    }

    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';
    uploadAudioRef.current = audio;

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
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
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

  return {
    uploadFileInputRef,
    isEditAudioOpen,
    setIsEditAudioOpen,
    pendingAudioFile,
    pendingAudioUrl,

    uploadStateByMode,
    pendingAudioMode,
    setPendingAudioMode,
    updateUploadState,
    updateCurrentUploadState,
    currentUploadState,
    pendingUploadState,

    uploadCoverFile: coverFile,
    uploadCoverFileName: coverFileName,
    uploadAudioUrl: audioUrl,
    uploadAudioDuration: audioDuration,
    uploadAudioTotalDuration: audioTotalDuration,
    uploadAudioCurrentTime: audioCurrentTime,
    isUploadAudioPlaying: isPlaying,
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
    resetPendingAudio,
    uploadAudioToServer,
    handleCoverFileSelected,
    handlePromptFileChange,
    handleUploadAudioPlayPause,
  };
};
