import type { MusicType } from '@/types/music';

import { normalizeMusicModel } from '@/lib/music-model-utils';

const PERSONA_SUPPORTED_MUSIC_TYPES = new Set<MusicType>([
  'generated',
  'extended',
  'upload_cover',
  'upload_extend',
]);

export type PersonaSupportIssue = 'unsupported_source' | 'unsupported_model' | null;

export function isPersonaSupportedMusicType(musicType?: string | null): boolean {
  if (!musicType) {
    return false;
  }

  return PERSONA_SUPPORTED_MUSIC_TYPES.has(musicType as MusicType);
}

export function isPersonaSupportedModel(model?: string | null): boolean {
  if (!model) {
    return true;
  }

  const normalizedModel = normalizeMusicModel(model);
  if (!normalizedModel) {
    return true;
  }

  if (normalizedModel === 'V3_5' || normalizedModel === 'CHIRP_V3_5') {
    return false;
  }

  const versionMatch = normalizedModel.match(/^V(\d+)(?:_(\d+))?/);
  if (!versionMatch) {
    return true;
  }

  const majorVersion = Number(versionMatch[1] || 0);
  const minorVersion = Number(versionMatch[2] || 0);

  if (majorVersion > 3) {
    return true;
  }

  if (majorVersion < 3) {
    return false;
  }

  return minorVersion > 5;
}

export function getPersonaSupportIssue(options: {
  musicType?: string | null;
  model?: string | null;
}): PersonaSupportIssue {
  if (!isPersonaSupportedMusicType(options.musicType)) {
    return 'unsupported_source';
  }

  if (!isPersonaSupportedModel(options.model)) {
    return 'unsupported_model';
  }

  return null;
}
