import type { MusicType } from "./music";

export interface ExtendSourceTrack {
  id: string;
  audioId?: string;
  title: string;
  audioUrl: string;
  duration: number;
  tags?: string;
  coverImage?: string;
  coverR2Url?: string;
  musicType?: MusicType;
  createdAt?: string;
}
