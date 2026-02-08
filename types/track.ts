import { MusicType } from './music';

/**
 * 统一的Track类型定义
 * 用于解决项目中多个Track接口定义不一致的问题
 */

// 基础Track接口 - 包含所有可能的字段
export interface BaseTrack {
  id: string;
  title: string;
  audioUrl?: string;
  streamAudioUrl?: string;
  duration?: number;
  coverImage?: string;
  coverR2Url?: string; // R2存储的封面图片URL（兼容旧字段名 cover_r2_url）
  tags?: string;
  genre?: string;
  prompt?: string;
  lyrics?: string;
  generationMode?: string;
  createdAt?: string;
  isFavorited?: boolean;
  isLiked?: boolean;
  musicType?: MusicType;
  model?: string;
  
  // 扩展相关字段
  isExtension?: boolean; // 是否是扩展歌曲
  originalMusicId?: string; // 原始音乐任务 ID（兼容数据库字段 original_music_id）
  originalTrackId?: string; // 原始曲目 ID（兼容数据库字段 original_track_id）
  originalTrackTitle?: string; // 原始曲目标题（用于UI显示）
  sourceType?: 'extended' | 'replace_section'; // 来源类型：扩展音乐或替换分区
}

// 音乐生成相关的Track接口
export interface MusicGenerationTrack extends BaseTrack {
  generationId: string;
  sunoTrackId?: string | null;
  isGenerating: boolean;
  isCompleted: boolean;
  isPlaceholder: boolean;
  isError?: boolean;
  errorMessage?: string;
  originalPrompt?: string;
}

// 音频播放器相关的Track接口
export interface AudioPlayerTrack extends BaseTrack {
  artist?: string;
  audioId?: string;
  taskId?: string;
  allTracks?: Array<{
    id: string;
    audioUrl: string;
    duration: number | string;
  }>;
}

// Studio状态管理相关的Track接口
export interface StudioTrack extends BaseTrack {
  generationId?: string;
  isCompleted?: boolean;
  isGenerating?: boolean;
  isPlaceholder?: boolean; // 标记是否为占位数据
  isStreaming?: boolean;
  isUsingStreamAudio?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

// 库面板相关的Track接口
export interface LibraryTrack extends BaseTrack {
  status: string;
  createdAt: string; // 创建时间（兼容旧字段名 created_at）
  favoritedAt?: string; // 收藏时间（兼容旧字段名 favorited_at）
  isPublished?: boolean; // 是否发布（兼容旧字段名 is_published）
  isDeleted?: boolean; // 是否删除（兼容旧字段名 is_deleted）
  isPinned?: boolean; // 是否置顶，从admin_pinned表获取（兼容旧字段名 is_pinned）
  audioUrl?: string; // 主音频文件URL，从allTracks[0]获取
  streamAudioUrl?: string; // 流媒体音频URL
  allTracks: Array<{
    id: string;
    title?: string; // 每个track可以有自己的标题
    audioUrl: string;
    duration: number;
    coverR2Url?: string; // R2存储的封面图片URL（兼容旧字段名 cover_r2_url）
    lyrics?: string;
    isDeleted: boolean; // 是否删除（兼容旧字段名 is_deleted）
    isFavorited?: boolean; // 是否收藏（兼容旧字段名 is_favorited）
    isLiked?: boolean; // 是否点赞（兼容旧字段名 is_liked）
  }>;
}

// 探索页面相关的Track接口
export interface ExploreTrack extends BaseTrack {
  // 探索页面特有的字段可以在这里添加
}

// Track详情API响应接口
export interface TrackInfoResponse {
  id: string;
  sunoTrackId: string | null; // Suno track ID（兼容旧字段名 suno_track_id）
  audioUrl: string | null;
  streamAudioUrl: string | null;
  duration: number | null;
  isPublished: boolean;
  isPinned: boolean;
  createdAt: string;
  coverImage: string | null;
  generationId: string;
  title: string;
  genre: string | null;
  tags: string | null;
  prompt: string | null;
  isInstrumental: boolean;
  status: string;
  model?: string;
  userId: string;
  generationCreatedAt: string;
  lyrics: string;
  isFavorited: boolean;
  isLiked: boolean;
}

// 通用Track类型 - 用于大多数场景
export type Track = BaseTrack;

// 类型守卫函数
export function isMusicGenerationTrack(track: any): track is MusicGenerationTrack {
  return track && typeof track.generationId === 'string' && typeof track.isGenerating === 'boolean';
}

export function isAudioPlayerTrack(track: any): track is AudioPlayerTrack {
  return track && typeof track.id === 'string' && typeof track.title === 'string';
}

export function isStudioTrack(track: any): track is StudioTrack {
  return track && typeof track.id === 'string' && typeof track.title === 'string';
}

export function isLibraryTrack(track: any): track is LibraryTrack {
  return track && typeof track.status === 'string' && Array.isArray(track.allTracks);
}

// 工具函数：转换Track类型
export function convertToBaseTrack(track: any): BaseTrack {
  return {
    id: track.id || '',
    title: track.title || 'Untitled Track',
    audioUrl: track.audioUrl || track.audio_url || '', // 兼容旧数据，但优先使用 audioUrl
    streamAudioUrl: track.streamAudioUrl || track.stream_audio_url,
    duration: track.duration,
    coverImage: track.coverImage || track.cover_image_url || track.cover_r2_url || track.coverR2Url,
    coverR2Url: track.coverR2Url || track.cover_r2_url || track.cover_image_url, // 兼容旧字段名
    tags: track.tags,
    genre: track.genre,
    lyrics: track.lyrics,
    createdAt: track.createdAt || track.created_at,
    isFavorited: track.isFavorited ?? track.is_favorited ?? false, // 兼容旧字段名
    isLiked: track.isLiked ?? track.is_liked ?? false, // 兼容旧字段名
    model: track.model || track.musicModel || track.musicGeneration?.model
  };
}

// 默认Track对象
export const createDefaultTrack = (id: string, title: string = 'Untitled Track'): BaseTrack => ({
  id,
  title,
  audioUrl: '',
  streamAudioUrl: '',
  duration: 0,
  coverImage: '',
  coverR2Url: '',
  tags: '',
  genre: '',
  lyrics: '',
  createdAt: new Date().toISOString(),
  isFavorited: false,
  isLiked: false,
});

// ============================================================================
// WAV转换相关类型定义
// ============================================================================

/**
 * WAV转换记录接口
 * 用于存储MP3到WAV格式转换的任务记录
 */
export interface TrackWavConversion {
  id: string;
  trackId: string; // 关联的track ID（兼容旧字段名 track_id）
  taskId: string; // WAV转换任务的taskId（兼容旧字段名 task_id）
  wavUrl: string | null; // 接口返回的临时 WAV 文件 URL（可立即下载）（兼容旧字段名 wav_url）
  wavR2Url: string | null; // 持久化到 R2 的 WAV 文件 URL（永久链接）（兼容旧字段名 wav_r2_url）
  status: 'generating' | 'completed' | 'error' | 'expired'; // 转换状态
  createdAt: string; // 创建时间（兼容旧字段名 created_at）
  updatedAt: string; // 更新时间（兼容旧字段名 updated_at）
}

/**
 * 创建WAV转换记录的数据接口
 */
export interface CreateTrackWavConversionData {
  trackId: string; // 关联的track ID（兼容旧字段名 track_id）
  taskId: string; // WAV转换任务的taskId（兼容旧字段名 task_id）
  status?: 'generating' | 'completed' | 'error' | 'expired';
  wavUrl?: string | null; // 接口返回的临时 URL（兼容旧字段名 wav_url）
  wavR2Url?: string | null; // R2 持久化 URL（兼容旧字段名 wav_r2_url）
}

/**
 * 更新WAV转换记录的数据接口
 */
export interface UpdateTrackWavConversionData {
  wavUrl?: string | null; // 接口返回的临时 URL（兼容旧字段名 wav_url）
  wavR2Url?: string | null; // R2 持久化 URL（兼容旧字段名 wav_r2_url）
  status?: 'generating' | 'completed' | 'error' | 'expired';
}

// ============================================================================
// MP4 生成相关类型定义
// ============================================================================

/**
 * MP4 生成记录接口
 * 用于存储音乐视频生成任务记录
 */
export interface TrackMp4Generation {
  id: string;
  trackId: string; // 关联的track ID（兼容旧字段名 track_id）
  taskId: string; // MP4生成任务的taskId（兼容旧字段名 task_id）
  videoUrl: string | null; // 接口返回的临时 MP4 文件 URL（14天有效）（兼容旧字段名 video_url）
  status: 'generating' | 'completed' | 'error' | 'expired';
  createdAt: string; // 创建时间（兼容旧字段名 created_at）
  updatedAt: string; // 更新时间（兼容旧字段名 updated_at）
}

/**
 * 创建 MP4 生成记录的数据接口
 */
export interface CreateTrackMp4GenerationData {
  trackId: string; // 关联的track ID（兼容旧字段名 track_id）
  taskId: string; // MP4生成任务的taskId（兼容旧字段名 task_id）
  status?: 'generating' | 'completed' | 'error' | 'expired';
  videoUrl?: string | null; // 接口返回的临时 URL（兼容旧字段名 video_url）
}

/**
 * 更新 MP4 生成记录的数据接口
 */
export interface UpdateTrackMp4GenerationData {
  videoUrl?: string | null; // 接口返回的临时 URL（兼容旧字段名 video_url）
  status?: 'generating' | 'completed' | 'error' | 'expired';
}

// ============================================================================
// Persona 相关类型定义
// ============================================================================

/**
 * Persona 记录接口
 * 用于存储从已生成音频创建的 Persona 结果
 */
export interface TrackPersona {
  id: string;
  trackId: string; // 关联的 track ID（兼容旧字段名 track_id）
  taskId: string; // 原始音乐任务 taskId（兼容旧字段名 task_id）
  audioId: string; // 音频ID（兼容旧字段名 audio_id）
  personaId: string; // Persona ID（兼容旧字段名 persona_id）
  status: 'active' | 'deleted';
  name: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 创建 Persona 记录的数据接口
 */
export interface CreateTrackPersonaData {
  trackId: string;
  taskId: string;
  audioId: string;
  personaId: string;
  name?: string | null;
  description?: string | null;
}

/**
 * 更新 Persona 记录的数据接口
 */
export interface UpdateTrackPersonaData {
  name?: string | null;
  description?: string | null;
  status?: 'active' | 'deleted';
}
