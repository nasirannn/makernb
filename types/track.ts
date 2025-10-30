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
  cover_r2_url?: string;
  tags?: string;
  genre?: string;
  lyrics?: string;
  createdAt?: string;
  is_favorited?: boolean;
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
    audio_url: string;
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
  created_at: string;
  favorited_at?: string; // 收藏时间
  is_published?: boolean;
  is_deleted?: boolean;
  is_pinned?: boolean; // 从admin_pinned表获取
  audioUrl?: string; // 主音频文件URL，从allTracks[0]获取
  streamAudioUrl?: string; // 流媒体音频URL
  allTracks: Array<{
    id: string;
    title?: string; // 每个track可以有自己的标题
    audio_url: string;
    duration: number;
    cover_r2_url?: string;
    lyrics?: string;
    is_deleted: boolean;
    is_favorited?: boolean;
  }>;
}

// 探索页面相关的Track接口
export interface ExploreTrack extends BaseTrack {
  // 探索页面特有的字段可以在这里添加
}

// Track详情API响应接口
export interface TrackInfoResponse {
  id: string;
  suno_track_id: string | null;
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
  userId: string;
  generationCreatedAt: string;
  lyrics: string;
  isFavorited: boolean;
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
    audioUrl: track.audioUrl || track.audio_url,
    streamAudioUrl: track.streamAudioUrl || track.stream_audio_url,
    duration: track.duration,
    coverImage: track.coverImage || track.cover_image_url || track.cover_r2_url,
    cover_r2_url: track.cover_r2_url || track.cover_image_url,
    tags: track.tags,
    genre: track.genre,
    lyrics: track.lyrics,
    createdAt: track.createdAt || track.created_at,
    is_favorited: track.is_favorited || track.isFavorited,
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
  cover_r2_url: '',
  tags: '',
  genre: '',
  lyrics: '',
  createdAt: new Date().toISOString(),
  is_favorited: false,
});
