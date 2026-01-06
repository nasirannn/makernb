"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useCredits } from "@/contexts/CreditsContext";
import { CLIENT_UPLOAD_AUDIO_CREDITS } from "@/lib/credits-config";
import { formatDuration } from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MusicModel, modelOptions } from '@/components/ui/model-selection-dialog';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  FileAudio2,
  Loader2,
  UploadCloud,
  X,
  Play,
  Pause,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

type UploadMode = "cover" | "extend";

interface UploadAudioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (taskId: string, initialTracks?: any[]) => void;
  onSuccess?: () => void | Promise<void>;
  onAuthRequired?: () => void;
  selectedModel?: MusicModel; // 接收 studio-panel 选中的模型
}

//const ACCEPTED_EXTENSIONS = ["MP3", "WAV", "M4A", "M4V", "AVI", "MP4"];
const ACCEPTED_MIME = "audio/*,video/*";
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MIN_DURATION_SECONDS = 3;
const MAX_DURATION_SECONDS = 8 * 60; // 8 minutes (API limit)

// 字符限制
const CHAR_LIMITS = {
  TITLE: 100,
  STYLE: 1000,
  PROMPT_CUSTOM: 5000,
  PROMPT_BASIC: 500,
  DESCRIPTION: 500, // 非自定义模式的描述字段限制
};

const formatFileSize = (bytes: number) => {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
};

export const UploadAudioDialog = ({
  isOpen,
  onClose,
  onTaskCreated,
  onSuccess,
  onAuthRequired,
  selectedModel = 'V4', // 默认使用 V4
}: UploadAudioDialogProps) => {
  const { user } = useAuth();
  const { credits } = useCredits();

  const [mode, setMode] = React.useState<UploadMode>("cover");
  const [customMode, setCustomMode] = React.useState(false); // 默认为 false
  const [title, setTitle] = React.useState("");
  const [style, setStyle] = React.useState("");
  const [lyrics, setLyrics] = React.useState("");

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileDuration, setFileDuration] = React.useState<number | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // 音频播放器状态
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const currentCost =
    mode === "cover"
      ? CLIENT_UPLOAD_AUDIO_CREDITS.cover
      : CLIENT_UPLOAD_AUDIO_CREDITS.extend;
  const insufficientCredits =
    credits !== null && credits < currentCost && !!user;

  const requiresAuth = React.useCallback(() => {
    if (!user) {
      toast.error("Please log in to upload audio.");
      onAuthRequired?.();
      return true;
    }
    return false;
  }, [user, onAuthRequired]);

  const resetForm = React.useCallback(() => {
    setMode("cover");
    setCustomMode(false);
    setTitle("");
    setStyle("");
    setLyrics("");
    setSelectedFile(null);
    setFileDuration(null);
    setFileError(null);
    setIsAnalyzing(false);
    setIsDragging(false);
    setIsSubmitting(false);
    setApiError(null);

    // 清理音频播放器
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  React.useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const analyzeFileDuration = React.useCallback((file: File) => {
    setIsAnalyzing(true);
    setFileDuration(null);

    const objectUrl = URL.createObjectURL(file);
    const mediaEl =
      file.type.startsWith("video/") || file.name?.toLowerCase().endsWith(".mp4")
        ? document.createElement("video")
        : document.createElement("audio");

    mediaEl.preload = "metadata";
    mediaEl.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    mediaEl.onloadedmetadata = () => {
      const duration = mediaEl.duration;
      setFileDuration(duration);
      setIsAnalyzing(false);

      if (
        Number.isFinite(duration) &&
        (duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS)
      ) {
        setFileError(
          `Audio duration must be between ${MIN_DURATION_SECONDS} seconds and ${Math.floor(
            MAX_DURATION_SECONDS / 60
          )} minutes.`
        );
      } else {
        setFileError(null);
      }
      cleanup();
    };

    mediaEl.onerror = () => {
      setIsAnalyzing(false);
      setFileDuration(null);
      setFileError("Unable to read audio duration. Please try a different file.");
      cleanup();
    };
  }, []);

  const handleFileSelection = React.useCallback(
    (file: File | null) => {
      if (!file) return;
      if (requiresAuth()) return;

      setApiError(null);

      if (file.size > MAX_FILE_BYTES) {
        setFileError("File size must be under 40MB.");
        setSelectedFile(null);
        setFileDuration(null);
        return;
      }

      if (!file.type.startsWith("audio/")) {
        setFileError("Unsupported file type. Please upload audio.");
        setSelectedFile(null);
        setFileDuration(null);
        return;
      }

      // 清理旧的audioUrl
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }

      // 创建新的audioUrl用于播放
      const newAudioUrl = URL.createObjectURL(file);
      setAudioUrl(newAudioUrl);

      setSelectedFile(file);
      if (!title.trim()) {
        const fallbackTitle = file.name.replace(/\.[^/.]+$/, "");
        setTitle(fallbackTitle.slice(0, 200));
      }
      analyzeFileDuration(file);
    },
    [analyzeFileDuration, requiresAuth, title, audioUrl]
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (requiresAuth()) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  // 音频播放器逻辑
  React.useEffect(() => {
    if (!audioUrl || !isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    setIsPlaying(false);
    setCurrentTime(0);

    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, isOpen]);

  const handlePlayPause = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (time: number) => {
    if (!audioRef.current || !fileDuration) return;
    const seekTime = Math.max(0, Math.min(time, fileDuration));
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const canSubmit =
    !!selectedFile &&
    !fileError &&
    !isAnalyzing &&
    !isSubmitting &&
    !insufficientCredits &&
    !!user;

  const handleSubmit = async () => {
    if (requiresAuth()) {
      return;
    }
    if (!selectedFile) {
      setFileError("Please choose an audio file before processing.");
      return;
    }
    if (fileError) {
      toast.error(fileError);
      return;
    }

    // 验证必填字段
    const missingFields: string[] = [];
    if (customMode) {
      // 自定义模式：所有字段必填
      if (!title.trim()) missingFields.push("Title");
      if (!style.trim()) missingFields.push("Style of Music");
      if (!lyrics.trim()) missingFields.push("Lyrics");
    } else {
      // 非自定义模式：只有 Description 必填
      if (!lyrics.trim()) missingFields.push("Description");
    }

    if (missingFields.length > 0) {
      toast.error(`Please fill in the following required fields: ${missingFields.join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Authentication expired. Please sign in again.");
      }

      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("file", selectedFile);
      formData.append("customMode", customMode.toString());

      if (customMode) {
        // 自定义模式：提交所有字段
        formData.append("title", (title || selectedFile.name).slice(0, CHAR_LIMITS.TITLE));
        if (style.trim()) {
          formData.append("style", style.trim().slice(0, CHAR_LIMITS.STYLE));
        }
        if (lyrics.trim()) {
          formData.append("lyrics", lyrics.trim().slice(0, CHAR_LIMITS.PROMPT_CUSTOM));
        }
      } else {
        // 非自定义模式：只提交 description
        if (lyrics.trim()) {
          formData.append("lyrics", lyrics.trim().slice(0, CHAR_LIMITS.DESCRIPTION));
        }
      }

      formData.append("instrumental", "false");
      formData.append("model", selectedModel); // 添加模型参数

      const response = await fetch("/api/upload-audio", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        if (response.status === 402) {
          toast.error(
            result?.error || "Insufficient credits. Please top up credits."
          );
        } else {
          toast.error(result?.error || "Upload failed. Please try again.");
        }
        setApiError(result?.error || "Failed to create upload task.");
        return;
      }

      const taskId = result?.data?.taskId;
      const initialTracks = result?.data?.initialTracks;
      if (taskId) {
        onTaskCreated?.(taskId, initialTracks);
      }

      toast.success("Upload started!", {
        description:
          mode === "cover"
            ? "We're generating your cover track. Track progress in Studio."
            : "We're extending your track. Results will appear in Studio.",
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
      });

      await onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Upload audio error:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.";
      setApiError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 border border-border/60 bg-background shadow-xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* 固定头部 */}
        <AlertDialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3 pr-8">
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">
              Upload Audio
            </AlertDialogTitle>
            <span className="px-2.5 py-1 rounded-full border border-border/60 text-xs font-medium text-muted-foreground">
              {modelOptions.find(m => m.value === selectedModel)?.label || selectedModel}
            </span>
          </div>
          <AlertDialogDescription>
            Upload an audio file to extend or cover your song. Maximum file size: 40MB.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 可滚动的主要内容区域 */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-5 py-4">
          {/* File Upload Area */}
          <div
            className={cn(
              "relative border border-dashed rounded-lg p-6 transition-all cursor-pointer",
              isDragging
                ? "border-primary/60 bg-primary/5"
                : "border-border/50 hover:border-border/80 hover:bg-muted/30",
              fileError && "border-destructive"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_MIME}
              className="hidden"
              onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
            />

            <div className="text-center space-y-3">
              {selectedFile ? (
                <>
                  <FileAudio2 className="w-10 h-10 mx-auto text-primary" />
                  <div>
                    <p className="font-semibold">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                      {fileDuration && ` • ${formatDuration(fileDuration)}`}
                    </p>
                  </div>
                  {isAnalyzing && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing audio...
                    </div>
                  )}
                </>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-semibold">
                      Drop your audio file here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Duration less than 8 mins
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {fileError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{fileError}</p>
            </div>
          )}

          {/* 音频播放器 */}
          {selectedFile && audioUrl && fileDuration && (
            <div className="space-y-2">
              <div className="p-4 border rounded-lg bg-muted/20">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current" />
                    )}
                  </button>

                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground min-w-[50px]">
                      {formatDuration(Math.floor(currentTime))}
                    </span>

                    <div className="flex-1 relative">
                      <Slider
                        value={[currentTime]}
                        min={0}
                        max={fileDuration}
                        step={0.1}
                        onValueChange={([value]) => handleSeek(value)}
                        className="w-full"
                      />
                    </div>

                    <span className="text-sm font-mono text-muted-foreground min-w-[50px]">
                      {formatDuration(Math.floor(fileDuration))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Mode Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
            <div className="flex-1">
              <Label htmlFor="custom-mode" className="text-base font-semibold cursor-pointer">
                Custom Mode
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {customMode ? "Full control over title, style, and lyrics" : "Quick setup with description only"}
              </p>
            </div>
            <Switch
              id="custom-mode"
              checked={customMode}
              onCheckedChange={setCustomMode}
            />
          </div>

          {/* Conditional Fields Based on Custom Mode */}
          {customMode ? (
            <>
              {/* Track Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    id="title"
                    placeholder="My Awesome Track"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, CHAR_LIMITS.TITLE))}
                    maxLength={CHAR_LIMITS.TITLE}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {title.length}/100
                  </span>
                </div>
              </div>

              {/* Style of Music */}
              <div className="space-y-2">
                <Label htmlFor="style">
                  Style of Music <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="style"
                    placeholder="Enter music style here..."
                    value={style}
                    onChange={(e) => setStyle(e.target.value.slice(0, CHAR_LIMITS.STYLE))}
                    maxLength={CHAR_LIMITS.STYLE}
                    rows={3}
                    className="pr-16"
                  />
                  <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                    {style.length}/1000
                  </span>
                </div>
              </div>

              {/* Lyrics */}
              <div className="space-y-2">
                <Label htmlFor="lyrics">
                  Lyrics <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="lyrics"
                    placeholder="Enter your lyrics here..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value.slice(0, CHAR_LIMITS.PROMPT_CUSTOM))}
                    maxLength={CHAR_LIMITS.PROMPT_CUSTOM}
                    rows={4}
                    className="pr-16"
                  />
                  <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                    {lyrics.length}/5000
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Description (Simple Mode) */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="description"
                    placeholder="Describe your track..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value.slice(0, CHAR_LIMITS.DESCRIPTION))}
                    maxLength={CHAR_LIMITS.DESCRIPTION}
                    rows={4}
                    className="pr-16"
                  />
                  <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                    {lyrics.length}/500
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Mode Selection */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("cover")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  mode === "cover"
                    ? "bg-primary text-primary-foreground border-primary/60 hover:bg-primary/90"
                    : "bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40 hover:text-foreground"
                )}
              >
                Cover Music
              </button>
              <button
                type="button"
                onClick={() => setMode("extend")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                  mode === "extend"
                    ? "bg-primary text-primary-foreground border-primary/60 hover:bg-primary/90"
                    : "bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/40 hover:text-foreground"
                )}
              >
                Extend Music
              </button>
            </div>
          </div>
          {/* Credits Info */}
          <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cost:</span>
              </div>
              <span className="font-semibold text-primary">{currentCost} credits</span>
            </div>

            {credits !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your balance:</span>
                <span className={`font-medium ${insufficientCredits ? 'text-destructive' : 'text-foreground'}`}>
                  {credits} credits
                </span>
              </div>
            )}
          </div>

          {insufficientCredits && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Insufficient credits. You need {currentCost - (credits || 0)} more credits to upload this track.
            </div>
          )}

          {apiError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{apiError}</p>
            </div>
          )}
          </div>
        </div>

        {/* 固定底部按钮 */}
        <AlertDialogFooter className="flex-shrink-0 px-6 pt-4 pb-6 border-t border-border/40">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            disabled={!canSubmit}
            className="w-full px-8 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <span>Uploading</span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>Upload & Generate</span>
              </div>
            )}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
