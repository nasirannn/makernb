declare module "*/music-options.json" {
  interface MusicOption {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
  }

  interface MusicOption {
    id: string;
    name: string;
    description?: string;
    emoji?: string;
  }

  interface LibraryTrack {
    id: number;
    title: string;
    artist: string;
    coverImage: string;
    createdAt: string;
    duration: string;
    genre: string;
    vibe: string;
    style?: string;
    lyrics?: string;
  }

  interface MusicOptions {
    genres: MusicOption[];
    moods: MusicOption[];
    vibes: MusicOption[];
    grooveTypes: MusicOption[];
    leadInstruments: MusicOption[];
    drumKits: MusicOption[];
    bassTones: MusicOption[];
    vocalGenders: MusicOption[];
    vocalStyles: MusicOption[];
    harmonyPalettes: MusicOption[];
    mockLibraryData: LibraryTrack[];
  }

  const value: MusicOptions;
  export default value;
} 