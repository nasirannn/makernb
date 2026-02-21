"use client";

import React from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n/provider";

type DownloadFormat = "mp3" | "wav" | "mp4" | "cover";
type WavDownloadStatus = "preparing" | "generating" | "downloading" | "completed" | "error";

interface UseStudioTrackDownloadParams {
  user?: any;
}

interface DownloadOptions {
  skipPrompt?: boolean;
  author?: string;
  domainName?: string;
}

export const useStudioTrackDownload = ({ user }: UseStudioTrackDownloadParams) => {
  const { t } = useI18n();
  const [wavDownloadDialogOpen, setWavDownloadDialogOpen] = React.useState(false);
  const [wavDownloadProgress, setWavDownloadProgress] = React.useState(0);
  const [wavDownloadStatus, setWavDownloadStatus] = React.useState<WavDownloadStatus>("preparing");
  const [wavDownloadStatusText, setWavDownloadStatusText] = React.useState("");
  const [wavDownloadErrorMessage, setWavDownloadErrorMessage] = React.useState("");
  const [wavDownloadTrackTitle, setWavDownloadTrackTitle] = React.useState("");

  const [mp4DialogOpen, setMp4DialogOpen] = React.useState(false);
  const [pendingMp4Track, setPendingMp4Track] = React.useState<any>(null);
  const [pendingMp4Music, setPendingMp4Music] = React.useState<any>(null);
  const [mp4Author, setMp4Author] = React.useState("");
  const [mp4DomainName, setMp4DomainName] = React.useState("");

  const getAuthHeaders = React.useCallback((accessToken: string) => ({
    Authorization: `Bearer ${accessToken}`,
  }), []);

  const getTrackDownloadTitle = React.useCallback((track: any, music: any) => {
    return track.title || music.title || t("download.trackDefaultTitle");
  }, [t]);

  const downloadFile = React.useCallback((blob: Blob, filename: string, format: string) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${filename}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  }, []);

  const handleWavDownloadWithPolling = React.useCallback(async (
    track: any,
    music: any,
    accessToken: string
  ) => {
    const POLL_INTERVAL = 3000;
    const MAX_POLL_TIME = 180000;
    const startTime = Date.now();
    let lastProgress = 0;

    setWavDownloadDialogOpen(true);
    setWavDownloadProgress(0);
    setWavDownloadStatus("preparing");
    setWavDownloadStatusText(t("download.preparingDownload"));
    setWavDownloadErrorMessage("");
    const downloadTitle = getTrackDownloadTitle(track, music);
    setWavDownloadTrackTitle(downloadTitle);

    const calculateProgress = (hasWavUrl: boolean, elapsedTime: number): number => {
      if (hasWavUrl) {
        const baseProgress = 70;
        const timeBasedProgress = Math.min(20, (elapsedTime / MAX_POLL_TIME) * 20);
        return Math.min(90, baseProgress + timeBasedProgress);
      }

      const baseProgress = 10;
      const timeBasedProgress = Math.min(40, (elapsedTime / MAX_POLL_TIME) * 40);
      return Math.min(50, baseProgress + timeBasedProgress);
    };

    const pollForWav = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/download-track?trackId=${track.id}&format=wav`, {
          headers: getAuthHeaders(accessToken),
        });

        const elapsedTime = Date.now() - startTime;

        if (elapsedTime > MAX_POLL_TIME) {
          setWavDownloadStatus("error");
          setWavDownloadStatusText(t("download.downloadTimeout"));
          setWavDownloadErrorMessage(t("download.wavTakingLong"));
          return;
        }

        if (response.status === 202) {
          const data = await response.json();
          if (data.status === "generating") {
            const progress = calculateProgress(data.hasWavUrl || false, elapsedTime);
            lastProgress = Math.max(lastProgress, progress);

            const statusText = data.hasWavUrl
              ? t("download.processingWavFile")
              : t("download.waitingForConversion");

            setWavDownloadProgress(lastProgress);
            setWavDownloadStatus(data.hasWavUrl ? "generating" : "preparing");
            setWavDownloadStatusText(statusText);

            setTimeout(pollForWav, POLL_INTERVAL);
            return;
          }

          throw new Error(data.error || data.message || t("download.downloadFailed"));
        }

        if (response.status === 200) {
          setWavDownloadProgress(95);
          setWavDownloadStatus("downloading");
          setWavDownloadStatusText(t("download.preparingFileForDownload"));

          const contentType = response.headers.get("content-type");

          if (contentType?.includes("application/json")) {
            const data = await response.json();
            if (data.fallback && data.wavUrl) {
              const wavResponse = await fetch(data.wavUrl);
              if (!wavResponse.ok) {
                throw new Error(`Failed to fetch WAV: ${wavResponse.status}`);
              }
              const blob = await wavResponse.blob();
              downloadFile(blob, downloadTitle, "wav");

              setWavDownloadProgress(100);
              setWavDownloadStatus("completed");
              setWavDownloadStatusText(t("download.downloadCompleted"));
              return;
            }

            throw new Error(data.error || t("download.downloadFailed"));
          }

          const blob = await response.blob();
          downloadFile(blob, downloadTitle, "wav");

          setWavDownloadProgress(100);
          setWavDownloadStatus("completed");
          setWavDownloadStatusText(t("download.downloadCompleted"));
          return;
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      } catch (error) {
        console.error("WAV download polling error:", error);
        setWavDownloadStatus("error");
        setWavDownloadStatusText(t("download.downloadFailed"));
        setWavDownloadErrorMessage(error instanceof Error ? error.message : t("download.unableDownloadWavFile"));
      }
    };

    await pollForWav();
  }, [downloadFile, getAuthHeaders, getTrackDownloadTitle, t]);

  const handleDownload = React.useCallback(async (
    track: any,
    music: any,
    format: DownloadFormat = "mp3",
    options?: DownloadOptions
  ) => {
    if (!track.id) {
      toast.error(t("download.trackIdRequired"));
      return;
    }

    if (format === "mp4" && !options?.skipPrompt) {
      setPendingMp4Track(track);
      setPendingMp4Music(music);
      if (!mp4Author.trim()) {
        const defaultAuthor =
          user?.user_metadata?.nickname ||
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0] ||
          "";
        if (defaultAuthor) {
          setMp4Author(defaultAuthor.slice(0, 50));
        }
      }
      setMp4DialogOpen(true);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error(t("toasts.authRequired"), {
          description: t("download.pleaseLogInDownloadTracks"),
        });
        return;
      }
      const accessToken = session.access_token;
      const downloadTitle = getTrackDownloadTitle(track, music);

      if (format === "cover") {
        try {
          const apiUrl = `/api/download-cover?trackId=${encodeURIComponent(track.id)}`;
          const coverResponse = await fetch(apiUrl, {
            method: "GET",
            headers: getAuthHeaders(accessToken),
            cache: "no-store",
          });
          if (!coverResponse.ok) {
            const text = await coverResponse.text().catch(() => "");
            throw new Error(text || `Failed to download cover: ${coverResponse.status}`);
          }
          const blob = await coverResponse.blob();
          const contentType = coverResponse.headers.get("content-type") || "";
          const lowerType = contentType.toLowerCase();
          let ext = "png";
          if (lowerType.includes("jpeg") || lowerType.includes("jpg")) {
            ext = "jpg";
          } else if (lowerType.includes("png")) {
            ext = "png";
          } else if (lowerType.includes("webp")) {
            ext = "webp";
          } else if (lowerType.includes("gif")) {
            ext = "gif";
          } else if (lowerType.includes("bmp")) {
            ext = "bmp";
          } else if (lowerType.includes("tiff")) {
            ext = "tiff";
          }
          downloadFile(blob, track.title || music.title || "cover", ext);
        } catch (error) {
          console.error("Cover download error:", error);
          toast.error(t("download.downloadFailed"), {
            description: error instanceof Error ? error.message : t("download.unableDownloadCoverImage"),
          });
        }
        return;
      }

      if (format === "wav") {
        await handleWavDownloadWithPolling(track, music, accessToken);
        return;
      }

      if (format === "mp4") {
        const POLL_INTERVAL = 3000;
        const MAX_POLL_TIME = 180000;
        const startTime = Date.now();
        const mp4ToastId = toast.loading(t("download.generatingMp4Video"), {
          description: t("download.generatingMp4Description"),
        });

        const mp4Params = new URLSearchParams({
          trackId: track.id,
          format: "mp4",
        });

        if (options?.author?.trim()) {
          mp4Params.set("author", options.author.trim().slice(0, 50));
        }

        if (options?.domainName?.trim()) {
          mp4Params.set("domainName", options.domainName.trim().slice(0, 50));
        }

        const mp4RequestUrl = `/api/download-track?${mp4Params.toString()}`;

        const pollForMp4 = async (): Promise<void> => {
          const response = await fetch(mp4RequestUrl, {
            headers: getAuthHeaders(accessToken),
          });

          const elapsedTime = Date.now() - startTime;
          if (elapsedTime > MAX_POLL_TIME) {
            throw new Error(t("download.mp4GenerationTimeout"));
          }

          if (response.status === 202) {
            const data = await response.json();
            if (data.status === "generating") {
              await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
              return pollForMp4();
            }
            throw new Error(data.error || data.message || t("download.mp4GenerationFailed"));
          }

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
          }

          const contentType = response.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const data = await response.json();
            if (data.fallback && data.videoUrl) {
              const videoResponse = await fetch(data.videoUrl);
              if (!videoResponse.ok) {
                throw new Error(`Failed to fetch MP4: ${videoResponse.status}`);
              }
              const blob = await videoResponse.blob();
              downloadFile(blob, downloadTitle, "mp4");
              return;
            }
            throw new Error(data.error || t("download.downloadFailed"));
          }

          const blob = await response.blob();
          downloadFile(blob, downloadTitle, "mp4");
        };

        try {
          await pollForMp4();
          toast.success(t("download.mp4DownloadStarted"), {
            id: mp4ToastId,
            description: `${downloadTitle}.mp4`,
          });
        } catch (error) {
          console.error("MP4 download error:", error);
          toast.error(t("download.mp4DownloadFailed"), {
            id: mp4ToastId,
            description: error instanceof Error ? error.message : t("download.unableDownloadMp4File"),
          });
        }
        return;
      }

      const audioUrl = track.audioUrl;
      const hasAudioUrl = audioUrl && typeof audioUrl === "string" && audioUrl.trim() !== "";

      if (hasAudioUrl) {
        try {
          const audioResponse = await fetch(audioUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; MakernbBot/1.0)",
            },
          });

          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch MP3: ${audioResponse.status}`);
          }

          const blob = await audioResponse.blob();
          downloadFile(blob, downloadTitle, "mp3");
          return;
        } catch (error) {
          console.error("[DOWNLOAD] Error downloading MP3 from audio URL:", error);
        }
      }

      const response = await fetch(`/api/download-track?trackId=${track.id}&format=mp3`, {
        headers: getAuthHeaders(accessToken),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (data.fallback && data.audioUrl) {
          const audioResponse = await fetch(data.audioUrl);
          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
          }
          const blob = await audioResponse.blob();
          downloadFile(blob, downloadTitle, "mp3");
        } else {
          throw new Error(data.error || t("download.downloadFailed"));
        }
      } else {
        const blob = await response.blob();
        downloadFile(blob, downloadTitle, "mp3");
      }
    } catch (error) {
      console.error("Download error:", error);
    }
  }, [downloadFile, getAuthHeaders, getTrackDownloadTitle, handleWavDownloadWithPolling, mp4Author, user, t]);

  const closeWavDownloadDialog = React.useCallback(() => {
    setWavDownloadDialogOpen(false);
    setWavDownloadProgress(0);
    setWavDownloadStatus("preparing");
    setWavDownloadStatusText("");
    setWavDownloadErrorMessage("");
    setWavDownloadTrackTitle("");
  }, []);

  const handleMp4DialogOpenChange = React.useCallback((open: boolean) => {
    setMp4DialogOpen(open);
    if (!open) {
      setPendingMp4Track(null);
      setPendingMp4Music(null);
    }
  }, []);

  const handleMp4Generate = React.useCallback(() => {
    if (!pendingMp4Track) {
      setMp4DialogOpen(false);
      return;
    }

    const selectedTrack = pendingMp4Track;
    const selectedMusic = pendingMp4Music;
    const authorValue = mp4Author.trim();
    const domainValue = mp4DomainName.trim();

    setMp4DialogOpen(false);
    setPendingMp4Track(null);
    setPendingMp4Music(null);

    void handleDownload(selectedTrack, selectedMusic, "mp4", {
      skipPrompt: true,
      author: authorValue || undefined,
      domainName: domainValue || undefined,
    });
  }, [pendingMp4Track, pendingMp4Music, mp4Author, mp4DomainName, handleDownload]);

  return {
    handleDownload,
    wavDownloadDialogOpen,
    wavDownloadProgress,
    wavDownloadStatus,
    wavDownloadStatusText,
    wavDownloadErrorMessage,
    wavDownloadTrackTitle,
    closeWavDownloadDialog,
    mp4DialogOpen,
    handleMp4DialogOpenChange,
    mp4Author,
    mp4DomainName,
    setMp4Author,
    setMp4DomainName,
    handleMp4Generate,
  };
};
