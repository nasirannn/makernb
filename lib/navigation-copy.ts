export const NAV_LABELS = {
  studio: "Studio",
  library: "Library",
  aiMusicTool: "AI Music Tool",
  explore: "Explore",
  blog: "Blog",
  pricing: "Pricing",
  vocalSeparation: "Vocal Separation",
  lyricsGenerator: "Lyrics Generator",
} as const;

export const AI_TOOL_ITEMS = [
  {
    href: "/vocal-separation",
    label: NAV_LABELS.vocalSeparation,
    description: "Separate vocals from music",
  },
  {
    href: "/lyrics-generator",
    label: NAV_LABELS.lyricsGenerator,
    description: "Generate creative lyrics with AI",
  },
] as const;
