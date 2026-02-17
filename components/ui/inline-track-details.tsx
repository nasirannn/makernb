"use client";

import React from "react";
import Image from "next/image";
import { CassetteTape } from "@/components/ui/cassette-tape";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface InlineTrackDetails {
  id: string;
  title: string;
  tags?: string;
  lyrics?: string;
  coverImage?: string | null;
  createdAt?: string;
  duration?: string;
  isLiked?: boolean;
  status?: string;
  isGenerating?: boolean;
  isCompleted?: boolean;
  audioUrl?: string;
}

interface InlineTrackDetailsPanelProps {
  track?: InlineTrackDetails | null;
  isPlaying?: boolean;
  currentTime?: number;
  onClose?: () => void;
  variant?: "default" | "studio";
}

interface TimestampedLyricWord {
  word: string;
  success: boolean;
  startS: number;
  endS: number;
  palign: number;
}

interface TimestampedLyricLine {
  text: string;
  startS: number;
}

export const InlineTrackDetailsPanel: React.FC<InlineTrackDetailsPanelProps> = ({
  track,
  isPlaying = false,
  currentTime = 0,
  onClose,
  variant = "default",
}) => {
  const tags = React.useMemo(() => {
    if (!track?.tags) return [];
    return track.tags
      .split(/[,，;；]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [track?.tags]);

  const primaryTag = tags[0] ?? "";
  const hasMoreTags = tags.length > 1;
  const isPrimaryTagTruncated = primaryTag.length > 20;
  const visiblePrimaryTag = isPrimaryTagTruncated ? `${primaryTag.slice(0, 20)}...` : primaryTag;
  const allTagsText = React.useMemo(() => {
    if (track?.tags?.trim()) {
      return track.tags.trim();
    }
    return tags.join(", ");
  }, [track?.tags, tags]);

  const handleCopyAllTags = React.useCallback(async () => {
    if (!allTagsText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(allTagsText);
      toast.success("All tags copied");
    } catch (error) {
      console.error("Failed to copy tags:", error);
      toast.error("Failed to copy tags");
    }
  }, [allTagsText]);

  const [timestampedWords, setTimestampedWords] = React.useState<TimestampedLyricWord[]>([]);
  const [isTimestampedLoading, setIsTimestampedLoading] = React.useState(false);
  const [isInstrumentalTrack, setIsInstrumentalTrack] = React.useState(false);

  const lyricsScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const lyricLineRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

  const isTrackGenerationComplete = React.useMemo(() => {
    if (!track?.id) return false;

    const normalizedStatus = typeof track.status === 'string'
      ? track.status.trim().toLowerCase()
      : '';

    if (normalizedStatus === 'complete' || normalizedStatus === 'completed') {
      return true;
    }

    if (track.isCompleted === true) {
      return true;
    }

    if (track.isGenerating === true) {
      return false;
    }

    return Boolean(track.audioUrl);
  }, [track?.id, track?.status, track?.isCompleted, track?.isGenerating, track?.audioUrl]);

  const setLyricLineRef = React.useCallback(
    (index: number) => (node: HTMLDivElement | null) => {
      if (node) {
        lyricLineRefs.current.set(index, node);
      } else {
        lyricLineRefs.current.delete(index);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!track?.id) {
      setTimestampedWords([]);
      setIsTimestampedLoading(false);
      setIsInstrumentalTrack(false);
      return;
    }

    if (!isTrackGenerationComplete) {
      setTimestampedWords([]);
      setIsTimestampedLoading(false);
      setIsInstrumentalTrack(false);
      return;
    }

    let isCancelled = false;

    const fetchTimestampedLyrics = async () => {
      setIsTimestampedLoading(true);
      setIsInstrumentalTrack(false);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error("Failed to get session");
        }

        const accessToken = session?.access_token;
        if (!accessToken) {
          setTimestampedWords([]);
          return;
        }

        const response = await fetch("/api/lyrics/timestamped", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ trackId: track.id }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "Failed to fetch timestamped lyrics");
        }

        if (isCancelled) return;

        if (payload?.data?.isPending) {
          setTimestampedWords([]);
          setIsInstrumentalTrack(Boolean(payload?.data?.isInstrumental));
          return;
        }

        const alignedWords = Array.isArray(payload?.data?.alignedWords)
          ? payload.data.alignedWords
          : [];

        setTimestampedWords(alignedWords);
        setIsInstrumentalTrack(Boolean(payload?.data?.isInstrumental));
      } catch (error) {
        if (isCancelled) return;

        console.warn("Failed to fetch timestamped lyrics:", error);
        setTimestampedWords([]);
      } finally {
        if (!isCancelled) {
          setIsTimestampedLoading(false);
        }
      }
    };

    fetchTimestampedLyrics();

    return () => {
      isCancelled = true;
    };
  }, [track?.id, isTrackGenerationComplete]);

  const timestampedLines = React.useMemo<TimestampedLyricLine[]>(() => {
    if (!timestampedWords.length) return [];

    const lines: TimestampedLyricLine[] = [];
    let currentWords: string[] = [];
    let lineStart: number | null = null;

    const flushLine = () => {
      if (!currentWords.length) return;

      lines.push({
        text: currentWords.join(" "),
        startS: lineStart ?? 0,
      });

      currentWords = [];
      lineStart = null;
    };

    for (const item of timestampedWords) {
      if (!item || typeof item.word !== "string") continue;

      const normalizedWord = item.word.replace(/\r/g, "");
      const chunks = normalizedWord.split("\n");

      chunks.forEach((chunk, index) => {
        const text = chunk.trim();
        if (text) {
          if (lineStart === null) {
            lineStart = Number.isFinite(item.startS) ? item.startS : 0;
          }
          currentWords.push(text);
        }

        if (index < chunks.length - 1) {
          flushLine();
        }
      });

      const shouldFlushByPunctuation = /[.!?。！？]$/.test(normalizedWord.trim());
      const shouldFlushByLength = currentWords.length >= 10;

      if (shouldFlushByPunctuation || shouldFlushByLength) {
        flushLine();
      }
    }

    flushLine();
    return lines;
  }, [timestampedWords]);

  const activeTimestampLineIndex = React.useMemo(() => {
    if (!timestampedLines.length || !Number.isFinite(currentTime)) return -1;

    const playbackTime = Math.max(0, currentTime);

    for (let index = 0; index < timestampedLines.length; index += 1) {
      const line = timestampedLines[index];
      const nextLine = timestampedLines[index + 1];
      const nextStart = nextLine ? nextLine.startS : Number.POSITIVE_INFINITY;

      if (playbackTime >= line.startS && playbackTime < nextStart) {
        return index;
      }
    }

    return playbackTime >= timestampedLines[timestampedLines.length - 1].startS
      ? timestampedLines.length - 1
      : -1;
  }, [timestampedLines, currentTime]);

  const hasSyncedLyrics = timestampedLines.length > 0;

  React.useEffect(() => {
    lyricLineRefs.current.clear();
    if (lyricsScrollContainerRef.current) {
      lyricsScrollContainerRef.current.scrollTop = 0;
    }
  }, [track?.id]);

  React.useEffect(() => {
    if (!hasSyncedLyrics || activeTimestampLineIndex < 0) return;

    const activeLineElement = lyricLineRefs.current.get(activeTimestampLineIndex);
    if (!activeLineElement) return;

    activeLineElement.scrollIntoView({
      behavior: isPlaying ? "smooth" : "auto",
      block: "center",
      inline: "nearest",
    });
  }, [activeTimestampLineIndex, hasSyncedLyrics, isPlaying]);

  if (!track) return null;

  return (
    <div className="app-card app-hairline h-full rounded-2xl overflow-hidden">
      <div className="h-full flex flex-col">
        <div className="relative flex-shrink-0">
          {track.coverImage ? (
            <div className="relative aspect-square w-full overflow-hidden">
              <Image
                src={track.coverImage}
                alt={track.title}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 320px, 100vw"
                priority
              />
            </div>
          ) : (
            <div className="relative aspect-square w-full overflow-hidden bg-muted/20">
              <CassetteTape className="w-full h-full" isPlaying={isPlaying} />
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lyrics panel"
              title="Close lyrics panel"
              className="absolute right-2 top-1.5 h-7 w-7 rounded-full bg-black/50 text-white/90 flex items-center justify-center transition hover:bg-black/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="absolute bottom-0 left-0 right-0 px-5 pb-3.5 space-y-1.5">
            <h3 className="pr-9 text-base sm:text-[1.02rem] font-semibold leading-tight tracking-tight text-white/95 line-clamp-2">
              {track.title}
            </h3>

            {primaryTag && (
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white/75 backdrop-blur-sm"
                  title={primaryTag}
                >
                  {visiblePrimaryTag}
                </span>

                {hasMoreTags && (
                  <span
                    className="inline-flex items-center rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-sm"
                    title={allTagsText}
                  >
                    ...
                  </span>
                )}

                {allTagsText && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyAllTags();
                    }}
                    title="Copy all tags"
                    aria-label="Copy all tags"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-sm transition hover:bg-black/45 hover:text-white/95"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={lyricsScrollContainerRef}
            className={`h-full overflow-auto px-5 py-6 ${variant === "studio" ? "md:pb-5" : ""}`}
            style={
              variant === "studio"
                ? {
                    paddingBottom: "calc(var(--player-height, 48px) + 0.75rem)",
                    maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                  }
                : undefined
            }
          >
            {isTimestampedLoading && !hasSyncedLyrics && (
              <p className="mb-3 text-xs text-muted-foreground">Loading synced lyrics...</p>
            )}

            {hasSyncedLyrics ? (
              <div className="pt-[10vh] pb-[18vh]">
                {timestampedLines.map((line, index) => {
                  const distance =
                    activeTimestampLineIndex >= 0 ? Math.abs(index - activeTimestampLineIndex) : Number.POSITIVE_INFINITY;
                  const isActive = index === activeTimestampLineIndex;

                  let opacityClass = "text-foreground/35";
                  if (distance <= 1) {
                    opacityClass = "text-foreground/70";
                  }
                  if (isActive) {
                    opacityClass = "text-foreground";
                  }

                  return (
                    <div
                      key={`${line.startS}-${line.text}-${index}`}
                      ref={setLyricLineRef(index)}
                      className={`py-2 text-center transition-all duration-300 ease-out ${opacityClass}`}
                    >
                      <p
                        className={`mx-auto max-w-[95%] whitespace-pre-wrap leading-relaxed ${
                          isActive
                            ? "text-[1.1rem] font-semibold tracking-tight"
                            : "text-[0.98rem] font-medium"
                        }`}
                      >
                        {line.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
                {!isTrackGenerationComplete
                  ? "Synced lyrics will be available after generation completes."
                  : isInstrumentalTrack
                    ? "This is an instrumental track. Synced lyrics are not available."
                    : track.lyrics?.trim()
                      ? track.lyrics
                      : "Lyrics are not available yet. Try generating lyrics or check back later."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
