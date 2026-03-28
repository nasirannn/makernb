export interface SoundGenerationMetadata {
  id: string;
  musicId: string;
  soundLoop: boolean;
  soundType?: 'one-shot' | 'loop';
  soundTempo: number | null;
  soundKey: string | null;
  grabLyrics: boolean;
  providerRequestJson: unknown | null;
  providerCreateResponseJson: unknown | null;
  providerRecordInfoJson: unknown | null;
  resultAudioIdsJson: unknown | null;
  r2AudioUrlsJson: unknown | null;
  resultTrackCount: number;
  errorCode: number | null;
  errorMessage: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSoundGenerationMetadataData {
  musicId: string;
  soundLoop?: boolean;
  soundType?: 'one-shot' | 'loop';
  soundTempo?: number | null;
  soundKey?: string | null;
  grabLyrics?: boolean;
  providerRequestJson?: unknown;
  providerCreateResponseJson?: unknown;
  providerRecordInfoJson?: unknown;
  resultAudioIdsJson?: unknown;
  r2AudioUrlsJson?: unknown;
  resultTrackCount?: number;
  errorCode?: number | null;
  errorMessage?: string | null;
  lastSyncedAt?: string | null;
}

export interface UpdateSoundGenerationMetadataData {
  providerRecordInfoJson?: unknown;
  providerCreateResponseJson?: unknown;
  resultAudioIdsJson?: unknown;
  r2AudioUrlsJson?: unknown;
  resultTrackCount?: number;
  errorCode?: number | null;
  errorMessage?: string | null;
  lastSyncedAt?: string | null;
}
