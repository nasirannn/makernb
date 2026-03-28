export function normalizeMusicModel(model?: string | null): string {
  if (!model) return '';
  return model.toUpperCase().replace(/\./g, '_').replace(/\+/g, 'PLUS');
}

export function isPremiumMusicModel(model?: string | null): boolean {
  const normalizedModel = normalizeMusicModel(model);
  return normalizedModel === 'V5' || normalizedModel === 'V5_5';
}

export function formatMusicModelLabel(model?: string | null): string | null {
  if (!model) return null;

  switch (normalizeMusicModel(model)) {
    case 'V5_5':
      return 'V5.5';
    case 'V5':
      return 'V5';
    case 'V4_5PLUS':
      return 'V4.5+';
    case 'V4_5ALL':
      return 'V4.5ALL';
    case 'V4_5':
      return 'V4.5';
    case 'V4':
      return 'V4';
    default:
      return model.replace(/_/g, '.');
  }
}
