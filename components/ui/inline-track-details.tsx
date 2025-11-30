"use client";

import React from "react";
import Image from "next/image";
import { CassetteTape } from "@/components/ui/cassette-tape";
import { Calendar, Clock, X } from "lucide-react";
import { formatDateTime } from "@/lib/format-utils";

interface InlineTrackDetails {
  id: string;
  title: string;
  tags?: string;
  lyrics?: string;
  coverImage?: string | null;
  createdAt?: string;
  duration?: string;
}

interface InlineTrackDetailsPanelProps {
  track?: InlineTrackDetails | null;
  isPlaying?: boolean;
  onClose?: () => void;
}

export const InlineTrackDetailsPanel: React.FC<InlineTrackDetailsPanelProps> = ({
  track,
  isPlaying = false,
  onClose
}) => {
  const [tagsExpanded, setTagsExpanded] = React.useState(false);

  const tags = React.useMemo(() => {
    if (!track?.tags) return [];
    return track.tags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [track?.tags]);

  const visibleTags = React.useMemo(() => {
    if (tagsExpanded || tags.length <= 1) {
      return tags;
    }
    if (tags.length > 1) {
      const firstTag = tags[0];
      const remainingCount = tags.length - 1;
      return [firstTag, `+${remainingCount} more`];
    }
    return tags;
  }, [tags, tagsExpanded]);

  const handleTagButtonClick = React.useCallback((tag: string) => {
    if (!tagsExpanded && tag.startsWith('+')) {
      setTagsExpanded(true);
    } else if (tagsExpanded && tags.length > 1) {
      setTagsExpanded(false);
    }
  }, [tagsExpanded, tags.length]);

  if (!track) return null;

  return (
    <div className="h-full rounded-2xl border border-white/5 border-l-0 bg-[var(--studio-panel-bg)] shadow-lg backdrop-blur-md overflow-hidden">
      <div className="h-full overflow-auto px-5 pt-6 pb-[calc(1.5rem+var(--player-height,0px))] space-y-5">
        <div className="relative flex justify-center">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lyrics panel"
              title="Close lyrics panel"
              className="absolute right-0 top-0 p-1 text-white/70 transition hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {track.coverImage ? (
            <div className="relative w-36 h-36 rounded-full overflow-hidden border border-border/60 shadow-[0_10px_30px_rgba(0,0,0,0.35)] bg-gradient-to-br from-muted/40 to-muted/80">
              <Image
                src={track.coverImage}
                alt={track.title}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 144px, 100vw"
                priority
              />
            </div>
          ) : (
            <CassetteTape className="w-36 h-36" isPlaying={isPlaying} />
          )}
        </div>

        <div className="space-y-1 text-center">
          <h3 className="text-xl font-semibold leading-tight line-clamp-3">
            {track.title}
          </h3>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {visibleTags.map((tag, idx) => (
              <button
                key={`${tag}-${idx}`}
                type="button"
                className={`rounded-full border border-border/60 px-3 py-1 bg-muted/40 text-left ${
                  (!tagsExpanded && idx === 1 && tag.startsWith('+')) ? 'text-muted-foreground/80 hover:bg-muted/50' : ''
                }`}
                onClick={() => handleTagButtonClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
          {track.createdAt && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateTime(track.createdAt)}
            </span>
          )}
          {track.duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {parseDuration(track.duration)}
            </span>
          )}
        </div>

        <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
          {track.lyrics?.trim()
            ? track.lyrics
            : "Lyrics are not available yet. Try generating lyrics or check back later."}
        </div>
      </div>
    </div>
  );
};

function parseDuration(duration: string): string {
  const numeric = parseFloat(duration);
  if (Number.isNaN(numeric)) {
    return duration;
  }
  const minutes = Math.floor(numeric / 60);
  const seconds = Math.round(numeric % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
