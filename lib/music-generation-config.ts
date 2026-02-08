/**
 * 音乐生成的通用配置
 * 用于生成音乐、上传音乐、延长音乐和替换音乐分区等所有音乐生成场景
 */

/**
 * Negative Tags - 避免不符合R&B风格的元素
 * 用于所有音乐生成相关的API调用
 */
export const DEFAULT_NEGATIVE_TAGS = "edm, techno, trance, dubstep, synthpop, electronic, house, distorted noise, dance, pop, rock, metal, country, jazz, classical, folk, indie, alternative, punk, blues, reggae, hip hop, rap";

/**
 * 默认的风格权重参数
 */
export const DEFAULT_STYLE_WEIGHT = 1.0;

/**
 * 默认的怪异度约束 - 更严格遵循风格
 */
export const DEFAULT_WEIRDNESS_CONSTRAINT = 0.05;

/**
 * 默认的音频权重
 */
export const DEFAULT_AUDIO_WEIGHT = 0.0;
