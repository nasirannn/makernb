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
  convert_to_wav: {
    name: 'Convert to WAV Format',
    credits: 1,
    enabled: true,
    description: '转换为WAV格式'
  },
  convert_to_mp4_video: {
    name: 'Convert to MP4 Video',
    credits: 2,
    enabled: true,
    description: '将音乐转换为MP4视频'
  },
  generate_persona: {
    name: 'Generate Persona',
    credits: 2,
    enabled: true,
    description: '从已生成音乐创建 Persona'
  },
  separate_vocals_from_music_local: {
    name: 'Separate Vocals from Music (Local File)',
    credits: 3,
    enabled: true,
    description: '从本地文件分离人声'
  },
  separate_vocals_from_music_studio: {
    name: 'Separate Vocals from Music (Studio Track)',
    credits: 10,
    enabled: true,
    description: '从Studio曲目分离人声'
  },
  upload_cover_music: {
    name: 'Upload Cover Music',
    credits: 12,
    enabled: true,
    description: '上传音频生成翻唱版本'
  },
  upload_extend_music: {
    name: 'Upload Extend Music',
    credits: 12,
    enabled: true,
    description: '上传音频生成延长版本'
  },
  upload_mashup_music: {
    name: 'Upload Mashup Music',
    credits: 12,
    enabled: true,
    description: '上传两首音频生成 Mashup 版本'
  },
  add_vocals_music: {
    name: 'Add Vocals Music',
    credits: 12,
    enabled: true,
    description: '为上传音频添加 AI 人声'
  },
  add_instrumental_music: {
    name: 'Add Instrumental Music',
    credits: 12,
    enabled: true,
    description: '为上传音频添加伴奏'
  },
  extend_music: {
    name: 'Extend Music',
    credits: 12, // 默认值，实际值根据模型版本而定
    enabled: true,
    description: '扩展音乐长度'
  },
  replace_section: {
    name: 'Replace Section',
    credits: 5, // 默认值，实际值根据模型版本而定
    enabled: true,
    description: '替换音乐分区'
  },
  boost_music_style: {
    name: 'Boost Music Style',
    credits: 0.4,
    enabled: true,
    description: '增强音乐风格'
  }
} as const;

/**
 * 音乐生成模式配置
 */
export const MUSIC_GENERATION_CONFIG = {
  simple: {
    model: 'V4',
    credits: 12,
    enabled: true
  } as ModelConfig,
  custom: {
    model: 'V4_5',
    credits: 12,
    enabled: true
  } as ModelConfig
} as const;

/**
 * Extend Music 模型版本配置
 * 根据不同的模型版本设置不同的积分消耗
 */
export const EXTEND_MUSIC_MODEL_CONFIG: Record<string, ModelConfig> = {
  V5: {
    model: 'V5',
    credits: 12,
    enabled: true
  } as ModelConfig,
  V4_5PLUS: {
    model: 'V4_5PLUS',
    credits: 12,
    enabled: true
  } as ModelConfig,
  V4_5: {
    model: 'V4.5',
    credits: 12,
    enabled: true
  } as ModelConfig,
  V4: {
    model: 'V4',
    credits: 12,
    enabled: true
  } as ModelConfig,
  V4_5ALL: {
    model: 'V4_5ALL',
    credits: 12,
    enabled: true
  } as ModelConfig,
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
 * 获取人声分离功能的积分消耗（根据来源类型）
 * @param source 来源类型：'local' 或 'studio'
 * @returns 积分消耗数量
 */
export function getVocalSeparationCredits(source: 'local' | 'studio'): number {
  const feature = source === 'local' 
    ? 'separate_vocals_from_music_local' 
    : 'separate_vocals_from_music_studio';
  return getFeatureCredits(feature as FeatureKey);
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
 * @param mode 模式：'simple' 或 'custom'
 * @returns 模型版本
 */
export function getMusicModel(mode: MusicMode): string {
  const config = MUSIC_GENERATION_CONFIG[mode];
  if (!config || !config.enabled) {
    console.warn(`Music mode ${mode} is not configured or disabled`);
    return mode === 'custom' ? 'V4_5' : 'V4'; // 默认值
  }
  return config.model;
}

/**
 * 获取音乐生成模式的积分消耗
 * @param mode 模式：'simple' 或 'custom'
 * @returns 积分消耗数量
 */
export function getMusicCredits(mode: MusicMode): number {
  const config = MUSIC_GENERATION_CONFIG[mode];
  if (!config || !config.enabled) {
    console.warn(`Music mode ${mode} is not configured or disabled`);
    return 12; // 默认值
  }
  return config.credits;
}

/**
 * 获取音乐生成模式配置
 * @param mode 模式：'simple' 或 'custom'
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
 * Extend Music 模型版本类型
 */
export type ExtendMusicModel = keyof typeof EXTEND_MUSIC_MODEL_CONFIG;

/**
 * 获取 Extend Music 模型版本的积分消耗
 * @param model 模型版本：'V5' | 'V4_5PLUS' | 'V4_5' | 'V4' | 'V4_5ALL'
 * @returns 积分消耗数量
 */
export function getExtendMusicCredits(model: ExtendMusicModel): number {
  const config = EXTEND_MUSIC_MODEL_CONFIG[model];
  if (!config || !config.enabled) {
    console.warn(`Extend Music model ${model} is not configured or disabled`);
    return 12; // 默认值
  }
  return config.credits;
}

/**
 * 获取 Extend Music 模型版本配置
 * @param model 模型版本
 * @returns 模型配置
 */
export function getExtendMusicModelConfig(model: ExtendMusicModel): ModelConfig | null {
  const config = EXTEND_MUSIC_MODEL_CONFIG[model];
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

/**
 * 客户端可用的人声分离积分配置（根据来源）
 */
export const CLIENT_VOCAL_SEPARATION_CREDITS = {
  local: FEATURE_CREDITS_CONFIG.separate_vocals_from_music_local.credits,
  studio: FEATURE_CREDITS_CONFIG.separate_vocals_from_music_studio.credits,
} as const;

export const CLIENT_MUSIC_CREDITS = {
  simple: MUSIC_GENERATION_CONFIG.simple.credits,
  custom: MUSIC_GENERATION_CONFIG.custom.credits
} as const;

export const STYLE_BOOST_CREDITS = FEATURE_CREDITS_CONFIG.boost_music_style.credits;

export const CLIENT_STYLE_BOOST_CREDITS = STYLE_BOOST_CREDITS;

export const CLIENT_UPLOAD_AUDIO_CREDITS = {
  cover: FEATURE_CREDITS_CONFIG.upload_cover_music.credits,
  extend: FEATURE_CREDITS_CONFIG.upload_extend_music.credits,
  mashup: FEATURE_CREDITS_CONFIG.upload_mashup_music.credits,
  vocal: FEATURE_CREDITS_CONFIG.add_vocals_music.credits,
  melody: FEATURE_CREDITS_CONFIG.add_instrumental_music.credits,
} as const;

/**
 * 客户端可用的 Extend Music 积分配置（根据模型版本）
 */
export const CLIENT_EXTEND_MUSIC_CREDITS = {
  V5: EXTEND_MUSIC_MODEL_CONFIG.V5.credits,
  V4_5PLUS: EXTEND_MUSIC_MODEL_CONFIG.V4_5PLUS.credits,
  V4_5: EXTEND_MUSIC_MODEL_CONFIG.V4_5.credits,
  V4: EXTEND_MUSIC_MODEL_CONFIG.V4.credits,
  V4_5ALL: EXTEND_MUSIC_MODEL_CONFIG.V4_5ALL.credits,
} as const;

/**
 * 客户端可用的积分配置常量（替代 NEXT_PUBLIC_ 环境变量）
 * 这些值可以在客户端组件中直接使用
 */
export const CLIENT_CREDITS = {
  /** Simple Mode 积分消耗 */
  SIMPLE_MODE_CREDITS: MUSIC_GENERATION_CONFIG.simple.credits,
  /** Custom Mode 积分消耗 */
  CUSTOM_MODE_CREDITS: MUSIC_GENERATION_CONFIG.custom.credits,
  /** 歌词生成积分消耗 */
  LYRICS_GENERATION_CREDITS: FEATURE_CREDITS_CONFIG.generate_lyrics.credits,
  /** 人声分离积分消耗（本地文件，已废弃，使用 CLIENT_VOCAL_SEPARATION_CREDITS 替代） */
  VOCAL_SEPARATION_CREDITS: FEATURE_CREDITS_CONFIG.separate_vocals_from_music_local.credits,
  /** Extend Music 积分消耗（根据模型版本，使用 CLIENT_EXTEND_MUSIC_CREDITS 替代） */
  EXTEND_MUSIC_CREDITS: FEATURE_CREDITS_CONFIG.extend_music.credits,
  /** Enhance Style 积分消耗 */
  STYLE_BOOST_CREDITS: STYLE_BOOST_CREDITS,
} as const;
