/**
 * Timestamped Lyrics API
 * 获取带时间戳的歌词数据
 * 参考: https://docs.kie.ai/suno-api/get-timestamped-lyrics
 */

export interface AlignedWord {
  word: string;
  success: boolean;
  startS: number;
  endS: number;
  palign: number;
}

export interface TimestampedLyricsResponse {
  code: number;
  msg: string;
  data: {
    alignedWords: AlignedWord[];
    waveformData: number[];
    hootCer: number;
    isStreamed: boolean;
  };
}

export interface GetTimestampedLyricsRequest {
  taskId: string;
  audioId: string;
}

/**
 * 获取带时间戳的歌词
 * @param request 包含 taskId 和 audioId 的请求参数
 * @returns Promise<TimestampedLyricsResponse>
 */
export async function getTimestampedLyrics(
  request: GetTimestampedLyricsRequest
): Promise<TimestampedLyricsResponse> {
  const apiKey = process.env.KIE_API_KEY;
  
  if (!apiKey) {
    throw new Error('KIE_API_KEY is not configured');
  }

  const response = await fetch('https://api.kie.ai/api/v1/generate/get-timestamped-lyrics', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to get timestamped lyrics: ${response.status} ${response.statusText}`, {
      cause: errorData
    });
  }

  return response.json();
}

/**
 * 格式化歌词数据为卡拉OK显示格式
 * @param alignedWords 对齐的歌词数据
 * @returns 格式化后的歌词数组
 */
export function formatLyricsForKaraoke(alignedWords: AlignedWord[]) {
  return alignedWords.map((word, index) => ({
    id: index,
    text: word.word,
    startTime: word.startS,
    endTime: word.endS,
    duration: word.endS - word.startS,
    isActive: false, // 用于UI状态管理
  }));
}

/**
 * 根据当前播放时间获取应该高亮的歌词
 * @param lyrics 格式化后的歌词数组
 * @param currentTime 当前播放时间（秒）
 * @returns 当前应该高亮的歌词索引
 */
export function getCurrentLyricIndex(lyrics: ReturnType<typeof formatLyricsForKaraoke>, currentTime: number): number {
  for (let i = 0; i < lyrics.length; i++) {
    const lyric = lyrics[i];
    if (currentTime >= lyric.startTime && currentTime <= lyric.endTime) {
      return i;
    }
  }
  return -1; // 没有找到匹配的歌词
}

/**
 * 生成波形数据用于音频可视化
 * @param waveformData 原始波形数据
 * @param width 目标宽度
 * @returns 缩放后的波形数据
 */
export function generateWaveformBars(waveformData: number[], width: number = 200): number[] {
  if (waveformData.length === 0) return [];
  
  const step = Math.max(1, Math.floor(waveformData.length / width));
  const bars: number[] = [];
  
  for (let i = 0; i < width; i++) {
    const startIndex = i * step;
    const endIndex = Math.min(startIndex + step, waveformData.length);
    const slice = waveformData.slice(startIndex, endIndex);
    const average = slice.reduce((sum, val) => sum + val, 0) / slice.length;
    bars.push(average);
  }
  
  return bars;
}
