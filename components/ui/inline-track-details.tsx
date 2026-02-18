"use client";

import React from "react";
import Image from "next/image";
import { CassetteTape } from "@/components/ui/cassette-tape";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";

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

export const InlineTrackDetailsPanel: React.FC<InlineTrackDetailsPanelProps> = ({
  track,
  isPlaying = false,
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

  const displayLyrics = React.useMemo(() => {
    const rawLyrics = track?.lyrics?.trim() || "";
    if (!rawLyrics) return "";

    const rawTags = track?.tags?.trim() || "";
    if (!rawTags) return rawLyrics;

    const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
    if (normalizeText(rawLyrics) === normalizeText(rawTags)) {
      return "";
    }

    const normalizeTokenList = (value: string) =>
      value
        .split(/[,，;；]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .sort();

    const lyricTokens = normalizeTokenList(rawLyrics);
    const tagTokens = normalizeTokenList(rawTags);

    const hasSameTokens =
      lyricTokens.length > 0 &&
      lyricTokens.length === tagTokens.length &&
      lyricTokens.every((token, index) => token === tagTokens[index]);

    if (hasSameTokens) {
      return "";
    }

    return rawLyrics;
  }, [track?.lyrics, track?.tags]);

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

  const lyricsScrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (lyricsScrollContainerRef.current) {
      lyricsScrollContainerRef.current.scrollTop = 0;
    }
  }, [track?.id]);

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
                  className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-medium text-white/75 backdrop-blur-sm"
                  title={primaryTag}
                >
                  <span>{visiblePrimaryTag}</span>
                  {allTagsText && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyAllTags();
                      }}
                      title="Copy all tags"
                      aria-label="Copy all tags"
                      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm text-white/75 transition hover:text-white"
                    >
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  )}
                </span>

                {hasMoreTags && (
                  <span
                    className="inline-flex items-center rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-white/70 backdrop-blur-sm"
                    title={allTagsText}
                  >
                    ...
                  </span>
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
            <div className="space-y-3">
              <div className="text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
                {displayLyrics ? displayLyrics : "No lyrics available."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
