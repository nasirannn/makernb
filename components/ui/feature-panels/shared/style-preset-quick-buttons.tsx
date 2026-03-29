"use client";

import React from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

type PresetGenre = {
  id: string;
  name: string;
  icon: string;
};

const PRESET_STYLE_GENRES: PresetGenre[] = [
  { id: 'new-jack-swing', name: 'New Jack Swing', icon: 'New Jack Swing Icon.webp' },
  { id: 'neo-soul', name: 'Neo-Soul', icon: 'Neo-Soul Icon.webp' },
  { id: 'quiet-storm', name: 'Quiet Storm', icon: 'Quiet Storm Icon.webp' },
  { id: 'hip-hop-soul', name: 'Hip-Hop Soul', icon: 'Hip-Hop Soul Icon.webp' },
  { id: 'crunk-rnb', name: 'Crunk R&B', icon: 'Crunk Icon.webp' },
  { id: 'pb-rnb', name: 'PBR&B', icon: 'PB Icon.webp' },
];

interface StylePresetQuickButtonsProps {
  text: string;
  setText: (value: string) => void;
  isGeneratingGenrePrompt: boolean;
  pendingGenreId: string | null;
  onGenerateGenrePrompt: (params: {
    genreId: string;
    genreName: string;
    currentText: string;
    onSuccess: (value: string) => void;
  }) => Promise<void> | void;
  horizontalScroll?: boolean;
}

export const StylePresetQuickButtons: React.FC<StylePresetQuickButtonsProps> = ({
  text,
  setText,
  isGeneratingGenrePrompt,
  pendingGenreId,
  onGenerateGenrePrompt,
  horizontalScroll = true,
}) => {
  return (
    <div
      className={`flex gap-2 ${horizontalScroll ? 'flex-nowrap overflow-x-auto scrollbar-hidden pb-1' : 'flex-wrap'}`}
    >
      {PRESET_STYLE_GENRES.map((genre) => {
        const isGeneratingThisGenre = isGeneratingGenrePrompt && pendingGenreId === genre.id;
        return (
          <button
            key={genre.id}
            type="button"
            onClick={() => {
              void onGenerateGenrePrompt({
                genreId: genre.id,
                genreName: genre.name,
                currentText: text,
                onSuccess: setText,
              });
            }}
            className="inline-flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 dark:border-transparent bg-slate-50 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:bg-white/10 dark:hover:bg-white/15 text-xs font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isGeneratingThisGenre}
          >
            {isGeneratingThisGenre ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Image
                src={`/hero/${encodeURIComponent(genre.icon)}`}
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5 opacity-90"
                aria-hidden="true"
              />
            )}
            <span>{genre.name}</span>
          </button>
        );
      })}
    </div>
  );
};
