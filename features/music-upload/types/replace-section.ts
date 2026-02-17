/**
 * 替换音乐分区相关类型定义
 * 基于 KIE API Replace Section 文档
 */

// 替换分区任务状态
export type ReplaceSectionStatus =
  | 'generating'  // 生成中
  | 'completed'   // 已完成
  | 'failed'      // 失败
  | 'cancelled';  // 已取消

// 替换分区 API 请求体
export interface ReplaceSectionAPIRequest {
  trackId: string; // 要替换的曲目 ID
  infillStartS: number; // 替换开始时间（秒，保留2位小数）
  infillEndS: number; // 替换结束时间（秒，保留2位小数）
  prompt: string; // 描述替换片段的提示词
  tags: string; // 音乐风格标签
  title: string; // 音乐标题
  fullLyrics?: string; // 完整歌词（可选）
}

// 替换分区 API 响应
export interface ReplaceSectionAPIResponse {
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
    }>;
  };
  error?: string;
}

// KIE API 替换分区请求参数
export interface KIEReplaceSectionRequest {
  taskId: string; // 原始音乐的父任务ID
  audioId: string; // 要替换的音频ID (suno_track_id)
  prompt: string; // 描述替换片段的提示词
  tags: string; // 音乐风格标签
  title: string; // 音乐标题
  infillStartS: number; // 开始替换的时间点（秒，保留2位小数）
  infillEndS: number; // 结束替换的时间点（秒，保留2位小数）
  callBackUrl?: string; // 回调URL
  negativeTags?: string; // 要排除的音乐风格
  fullLyrics?: string; // 完整歌词（可选，可以是空字符串）
}

// KIE API 替换分区响应
export interface KIEReplaceSectionResponse {
  code: number;
  msg: string;
  data?: {
    taskId: string;
  };
}

// KIE API 回调响应
export interface KIEReplaceSectionCallbackResponse {
  code: number;
  msg: string;
  data: {
    callbackType: 'complete' | 'error';
    task_id: string;
    data: Array<{
      id: string;
      audio_url: string;
      stream_audio_url?: string;
      image_url?: string;
      prompt?: string;
      model_name?: string;
      title?: string;
      tags?: string;
      createTime?: string;
      duration: number;
    }> | null;
    error_message?: string;
  };
}
