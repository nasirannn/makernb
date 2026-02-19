export interface LyricsTagOption {
  label: string;
  value: string;
}

export const LYRICS_TAG_OPTIONS: readonly LyricsTagOption[] = [
  { label: "Intro", value: "[Intro]" },
  { label: "Verse", value: "[Verse]" },
  { label: "Pre-Chorus", value: "[Pre-Chorus]" },
  { label: "Chorus", value: "[Chorus]" },
  { label: "Bridge", value: "[Bridge]" },
  { label: "Interlude", value: "[Interlude]" },
  { label: "Outro", value: "[Outro]" },
] as const;
