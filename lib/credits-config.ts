/**
 * 功能积分消耗配置
 * 
 * 统一管理所有功能的积分消耗和模型版本配置
 * 替代环境变量的分散管理方式
 */

export interface FeatureConfig {
  /** 功能名称（显示名称） */
  name: string;
  /** 消耗积分 */
  credits: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 功能描述 */
  description?: string;
}

export interface ModelConfig {
  /** 模型版本 */
  model: string;
  /** 消耗积分 */
  credits: number;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 功能积分配置
 */
export const FEATURE_CREDITS_CONFIG: Record<string, FeatureConfig> = {
  generate_lyrics: {
    name: 'Generate Lyrics',
    credits: 1,
    enabled: true,
    description: '生成歌词'
  },
  vocal_separation: {
    name: 'Vocal Separation',
    credits: 3,
    enabled: true,
    description: '人声分离'
  },
  convert_to_wav: {
    name: 'Convert to WAV Format',
    credits: 1,
    enabled: true,
    description: '转换为WAV格式'
  }
} as const;

/**
 * 音乐生成模式配置
 */
export const MUSIC_GENERATION_CONFIG = {
  basic: {
    model: 'V3_5',
    credits: 7,
    enabled: true
  } as ModelConfig,
  custom: {
    model: 'V4_5',
    credits: 12,
    enabled: true
  } as ModelConfig
} as const;

/**
 * 功能键类型
 */
export type FeatureKey = keyof typeof FEATURE_CREDITS_CONFIG;

/**
 * 音乐生成模式类型
 */
export type MusicMode = keyof typeof MUSIC_GENERATION_CONFIG;

/**
 * 获取功能消耗积分
 * @param feature 功能键
 * @returns 积分消耗数量
 */
export function getFeatureCredits(feature: FeatureKey): number {
  const config = FEATURE_CREDITS_CONFIG[feature];
  if (!config || !config.enabled) {
    console.warn(`Feature ${feature} is not configured or disabled`);
    return 0;
  }
  return config.credits;
}

/**
 * 获取功能配置
 * @param feature 功能键
 * @returns 功能配置
 */
export function getFeatureConfig(feature: FeatureKey): FeatureConfig | null {
  const config = FEATURE_CREDITS_CONFIG[feature];
  if (!config || !config.enabled) {
    return null;
  }
  return config;
}

/**
 * 获取音乐生成模式的模型版本
 * @param mode 模式：'basic' 或 'custom'
 * @returns 模型版本
 */
export function getMusicModel(mode: MusicMode): string {
  const config = MUSIC_GENERATION_CONFIG[mode];
  if (!config || !config.enabled) {
    console.warn(`Music mode ${mode} is not configured or disabled`);
    return mode === 'custom' ? 'V4_5' : 'V3_5'; // 默认值
  }
  return config.model;
}

/**
 * 获取音乐生成模式的积分消耗
 * @param mode 模式：'basic' 或 'custom'
 * @returns 积分消耗数量
 */
export function getMusicCredits(mode: MusicMode): number {
  const config = MUSIC_GENERATION_CONFIG[mode];
  if (!config || !config.enabled) {
    console.warn(`Music mode ${mode} is not configured or disabled`);
    return mode === 'custom' ? 12 : 7; // 默认值
  }
  return config.credits;
}

/**
 * 获取音乐生成模式配置
 * @param mode 模式：'basic' 或 'custom'
 * @returns 模式配置
 */
export function getMusicModeConfig(mode: MusicMode): ModelConfig | null {
  const config = MUSIC_GENERATION_CONFIG[mode];
  if (!config || !config.enabled) {
    return null;
  }
  return config;
}

/**
 * 导出客户端可用的配置（仅积分，不包含模型版本）
 * 用于前端显示积分消耗提示
 */
export const CLIENT_FEATURE_CREDITS = Object.fromEntries(
  Object.entries(FEATURE_CREDITS_CONFIG).map(([key, config]) => [
    key,
    { credits: config.credits, name: config.name }
  ])
) as Record<FeatureKey, { credits: number; name: string }>;

export const CLIENT_MUSIC_CREDITS = {
  basic: MUSIC_GENERATION_CONFIG.basic.credits,
  custom: MUSIC_GENERATION_CONFIG.custom.credits
} as const;

/**
 * 客户端可用的积分配置常量（替代 NEXT_PUBLIC_ 环境变量）
 * 这些值可以在客户端组件中直接使用
 */
export const CLIENT_CREDITS = {
  /** Basic Mode 积分消耗 */
  BASIC_MODE_CREDITS: MUSIC_GENERATION_CONFIG.basic.credits,
  /** Custom Mode 积分消耗 */
  CUSTOM_MODE_CREDITS: MUSIC_GENERATION_CONFIG.custom.credits,
  /** 歌词生成积分消耗 */
  LYRICS_GENERATION_CREDITS: FEATURE_CREDITS_CONFIG.generate_lyrics.credits,
  /** 人声分离积分消耗 */
  VOCAL_SEPARATION_CREDITS: FEATURE_CREDITS_CONFIG.vocal_separation.credits,
} as const;

