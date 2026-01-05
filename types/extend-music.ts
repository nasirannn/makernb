import { MusicType } from './music';

/**
 * 音乐扩展相关类型定义
 */

// 扩展音乐模型（与 credits-config.ts 中定义保持一致）
export type ExtendMusicModel = 'V5' | 'V4_5PLUS' | 'V4_5' | 'V4' | 'V4_5ALL';

// 扩展音乐请求参数
export interface ExtendMusicParams {
  model: ExtendMusicModel;
  defaultParamFlag: boolean;
  // 自定义模式必填参数
  prompt?: string;
  style?: string;
  title?: string;
  continueAt?: number;
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
}

// 扩展音乐任务状态
export type ExtendMusicStatus = 
  | 'generating'  // 生成中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled';  // 已取消

// 扩展音乐任务记录（对应数据库 music 表）
export interface ExtendMusicTask {
  id: string; // music.id
  userId: string;
  taskId: string; // 扩展任务ID（KIE API返回）
  title: string;
  genre: string;
  tags: string;
  prompt: string;
  isInstrumental: boolean;
  status: ExtendMusicStatus;
  createdAt: string;
  updatedAt: string;
  type: MusicType;
  
  // 扩展相关字段
  isExtension: boolean; // 标记为扩展任务
  originalMusicId: string; // 原始音乐任务 ID
  originalTrackId: string; // 原始曲目 ID
}

// 扩展音乐 API 请求体
export interface ExtendMusicAPIRequest {
  trackId: string; // 要扩展的曲目 ID
  model: ExtendMusicModel;
  defaultParamFlag: boolean;

  // 自定义模式参数（可选）
  prompt?: string;
  style?: string;
  title?: string;
  continueAt?: number;

  // 高级参数（可选）
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
}

// 扩展音乐 API 响应
export interface ExtendMusicAPIResponse {
  success: boolean;
  message?: string;
  data?: {
    taskId: string; // KIE API 返回的任务 ID
    musicId: string; // 数据库中创建的 music 记录 ID
    estimatedCredits: number;
    initialTracks?: Array<{
      id: string;
      generationId: string;
      suno_track_id: string | null;
      title: string;
      audioUrl: string;
      duration?: number;
      coverImage: string | null;
      tags: string;
      genre: string;
      lyrics: string;
      isGenerating: boolean;
      isCompleted: boolean;
      streamAudioUrl: string;
      createdAt: string;
    }>; // 初始占位 tracks（与普通生成音乐保持一致）
  };
  error?: string;
}

// 扩展关系信息（用于UI显示）
export interface ExtensionInfo {
  isExtension: boolean;
  originalMusicId?: string;
  originalTrackId?: string;
  originalTrackTitle?: string;
  extensionChain?: Array<{
    musicId: string;
    title: string;
    createdAt: string;
  }>;
}

// 扩展历史记录（用于UI显示）
export interface ExtensionHistory {
  extensions: Array<{
    id: string; // music.id
    title: string;
    createdAt: string;
    trackCount: number;
  }>;
}

// KIE API 扩展音乐请求参数
export interface KIEExtendMusicRequest {
  audio_id: string; // suno_track_id
  model?: ExtendMusicModel;
  default_param_flag?: boolean;
  callBackUrl?: string; // 回调URL
  
  // 自定义模式参数
  prompt?: string;
  style?: string;
  title?: string;
  continue_at?: number; // 单位：秒
  
  // 高级参数
  negative_tags?: string;
  vocal_gender?: 'm' | 'f';
  style_weight?: number;
  weirdness_constraint?: number;
  audio_weight?: number;
  persona_id?: string;
}

// KIE API 扩展音乐响应
// 注意：API 返回的是 taskId (驼峰，没有下划线)
export interface KIEExtendMusicResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string; // API 返回的是驼峰格式
  };
}

// KIE API 回调响应（完整格式）
// 参考文档: https://docs.kie.ai/cn/suno-api/extend-music-callbacks
export interface KIEExtendMusicCallbackResponse {
  code: number; // 状态码：200=成功, 400=验证错误, 408=超时, 413=冲突, 500=服务器错误, 501=生成失败, 531=服务器错误已退还积分
  msg: string; // 状态消息
  data: {
    callbackType: 'text' | 'first' | 'complete' | 'error'; // 回调类型（必需）
    task_id: string; // 任务ID（下划线格式，必需）
    data: Array<{
      id: string; // suno_track_id - 音乐唯一标识
      audio_url: string; // 音频文件URL
      stream_audio_url?: string; // 流式音频URL
      image_url?: string; // 封面图片URL（注意：文档中是 image_url，不是 cover_image_url）
      prompt?: string; // 使用的生成提示词/歌词
      model_name?: string; // 使用的模型名称（如 "chirp-v3-5"）
      title?: string; // 音乐标题
      tags?: string; // 音乐标签/风格
      createTime?: string; // 创建时间戳
      duration: number; // 音频时长（秒）
      lyrics?: string; // 歌词（兼容字段，可能不在文档中但实际存在）
    }>; // 音乐数组（必需，但可能为空数组）
    error_message?: string; // 错误信息（失败时）
  };
}
