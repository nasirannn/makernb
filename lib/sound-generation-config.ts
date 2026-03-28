export const SOUND_KEY_MAJOR_OPTIONS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export const SOUND_KEY_MINOR_OPTIONS = [
  'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm',
] as const;

export const SOUND_KEY_OPTIONS = [
  ...SOUND_KEY_MAJOR_OPTIONS,
  ...SOUND_KEY_MINOR_OPTIONS,
] as const;

export type SoundKeyOption = typeof SOUND_KEY_OPTIONS[number];
