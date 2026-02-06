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
  variant?: 'default' | 'studio';
}

export const InlineTrackDetailsPanel: React.FC<InlineTrackDetailsPanelProps> = ({
  track,
  isPlaying = false,
  onClose,
  variant = 'default',
}) => {
  const tags = React.useMemo(() => {
    if (!track?.tags) return [];
    return track.tags
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }, [track?.tags]);
  const tagText = tags.join(", ");

  if (!track) return null;

  return (
    <div
      className={
        variant === 'studio'
          ? 'app-card app-hairline h-full rounded-2xl overflow-hidden'
          : 'app-card app-hairline h-full rounded-2xl overflow-hidden'
      }
    >
      <div className="h-full flex flex-col">
        <div className="relative flex-shrink-0">
          {track.coverImage ? (
            <div className="relative h-64 w-full overflow-hidden">
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
            <div className="relative h-64 w-full overflow-hidden bg-muted/20">
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

          <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
            <h3 className="text-xl font-semibold leading-tight text-white line-clamp-2">
              {track.title}
            </h3>
            {tagText && (
              <p className="mt-1 text-sm text-white/70 truncate">
                {tagText}
              </p>
            )}
            {track.duration && (
              <div className="mt-2 flex flex-wrap justify-start gap-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {parseDuration(track.duration)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className={`flex-1 overflow-auto px-5 py-5 ${variant === 'studio' ? 'md:pb-5' : ''}`}
          style={
            variant === 'studio'
              ? { paddingBottom: 'calc(var(--player-height, 48px) + 0.75rem)' }
              : undefined
          }
        >
          <div className="text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
            {track.lyrics?.trim()
              ? track.lyrics
              : "Lyrics are not available yet. Try generating lyrics or check back later."}
          </div>
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
