/**
 * R&B 风格 Style 生成器
 * 为Basic Mode和Custom Mode生成不同的style字符串
 */

export interface StyleInfo {
  id: string;
  name: string;
}

export const R_AND_B_STYLES: StyleInfo[] = [
  {
    id: 'new-jack-swing',
    name: 'New Jack Swing'
  },
  {
    id: 'hip-hop-soul',
    name: 'Hip-Hop Soul'
  },
  {
    id: 'quiet-storm',
    name: 'Quiet Storm'
  },
  {
    id: 'neo-soul',
    name: 'Neo-Soul'
  }
];

/**
 * 根据风格 ID 获取风格信息
 */
export function getStyleById(styleId: string): StyleInfo | undefined {
  return R_AND_B_STYLES.find(style => style.id === styleId);
}

/**
 * Basic Mode: 生成简单的R&B风格style
 * @returns 简单的R&B风格style字符串
 */
export function generateBasicRnBStyle(): string {
  return 'Traditional R&B with soulful vocals, classic chord progressions, warm bass lines. Avoid electronic elements, synthesizers, modern pop. Focus on organic instruments and authentic R&B sound.';
}

/**
 * Custom Mode: 根据用户选择的参数生成详细的style
 * 模板：A [vibe] [genre] track at [BPM] BPM with a [groove type] groove,
 * featuring [lead instruments], [drum kit] and [bass tone].
 * The harmony style is [harmony palette] (if not instrumental).
 * Vocals are [vocal gender] (if not instrumental).
 */
export function generateCustomRnBStyle(params: {
  genre: string;
  vibe?: string;
  bpm?: number;
  grooveType?: string;
  leadInstrument?: string[];
  drumKit?: string;
  bassTone?: string;
  vocalGender?: string;
  vocalStyle?: string;
  harmonyPalette?: string;
  instrumentalMode?: boolean;
  customPrompt?: string;
}): string {
  const style = getStyleById(params.genre);
  const genreName = style ? style.name : 'Contemporary R&B';

  // 映射vibe到形容词
  const vibeMap: { [key: string]: string } = {
    'slow-jam': 'romantic',
    'upbeat': 'energetic',
    'chill': 'laid-back',
    'raw': 'gritty',
    'polished': 'smooth',
    'groovy': 'funky'
  };

  const vibeAdjective = params.vibe ? vibeMap[params.vibe] || params.vibe : 'soulful';

  // 构建style字符串 - 按照新模板
  let styleString = `A ${vibeAdjective} ${genreName} track`;

  // 添加BPM
  if (params.bpm) {
    styleString += ` at ${params.bpm} BPM`;
  }

  // 添加groove type
  if (params.grooveType) {
    styleString += ` with a ${params.grooveType} groove`;
  }

  // 添加乐器信息
  const instruments = [];
  if (params.leadInstrument && params.leadInstrument.length > 0) {
    instruments.push(...params.leadInstrument);
  }
  if (params.drumKit) {
    instruments.push(params.drumKit);
  }
  if (params.bassTone) {
    instruments.push(`${params.bassTone} Bass`);
  }

  if (instruments.length > 0) {
    styleString += `, featuring ${instruments.join(', ')}`;
  }

  // 添加和声信息（仅非器乐模式）
  if (!params.instrumentalMode && params.harmonyPalette) {
    styleString += `. The harmony style is ${params.harmonyPalette}`;
  }

  // 添加人声信息（仅非器乐模式）
  if (!params.instrumentalMode && params.vocalGender) {
    styleString += `. Vocals are ${params.vocalGender}`;
  }

  return styleString;
}

/**
 * 获取所有可用的风格选项（用于 UI 下拉菜单）
 */
export function getStyleOptions() {
  return R_AND_B_STYLES.map(style => ({
    id: style.id,
    name: style.name
  }));
}
