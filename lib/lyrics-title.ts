const MAX_LYRICS_TITLE_LENGTH = 255;

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function getFirstLyricLine(content: string | null | undefined): string | null {
  const normalizedContent = normalizeText(content);
  if (!normalizedContent) {
    return null;
  }

  const firstLine = normalizedContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return null;
  }

  return firstLine.slice(0, MAX_LYRICS_TITLE_LENGTH);
}

export function resolveLyricsTitle(
  title: string | null | undefined,
  content: string | null | undefined
): string | null {
  const normalizedTitle = normalizeText(title);
  if (normalizedTitle) {
    return normalizedTitle.slice(0, MAX_LYRICS_TITLE_LENGTH);
  }

  return getFirstLyricLine(content);
}
