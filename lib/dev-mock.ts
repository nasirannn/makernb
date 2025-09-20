// 开发环境 Mock 数据 - 最小改动方案
export const DEV_MOCK_ENABLED = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_MOCK === 'true';

// Mock 用户数据
export const mockUser = {
  id: 'dev-user-123',
  email: 'dev@test.com',
  name: 'Dev User'
};

// Mock 积分数据
export const mockCredits = 25;

// Mock 库音乐数据
export const mockLibraryTracks = [
  {
    id: 'mock-1',
    title: 'Midnight Groove',
    genre: 'Contemporary R&B',
    style: 'smooth, romantic, 90s vibes',
    created_at: new Date().toISOString(),
    lyrics: 'Mock lyrics for Midnight Groove...',
    lyrics_title: 'Midnight Groove',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    duration: 195,
    sideLetter: 'A',
    allTracks: [
      {
        id: 'mock-1-a',
        side_letter: 'A',
        audio_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: 195,
        cover_r2_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
      },
      {
        id: 'mock-1-b',
        side_letter: 'B',
        audio_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
        duration: 210,
        cover_r2_url: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
      }
    ]
  },
  {
    id: 'mock-2',
    title: 'Soulful Nights',
    genre: 'New Jack Swing',
    style: 'upbeat, danceable, new jack swing',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    lyrics: 'Mock lyrics for Soulful Nights...',
    lyrics_title: 'Soulful Nights',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
    coverUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
    duration: 180,
    sideLetter: 'A',
    allTracks: [
      {
        id: 'mock-2-a',
        side_letter: 'A',
        audio_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
        duration: 180,
        cover_r2_url: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
      },
      {
        id: 'mock-2-b',
        side_letter: 'B',
        audio_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-03.wav',
        duration: 205,
        cover_r2_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
      }
    ]
  },
  {
    id: 'mock-3',
    title: 'Urban Romance',
    genre: 'Hip-Hop Soul',
    style: 'chill, laid-back, neo-soul',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lyrics: 'Mock lyrics for Urban Romance...',
    lyrics_title: 'Urban Romance',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-03.wav',
    coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
    duration: 220,
    sideLetter: 'B',
    allTracks: [
      {
        id: 'mock-3-a',
        side_letter: 'A',
        audio_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-03.wav',
        duration: 220,
        cover_r2_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop',
      },
      {
        id: 'mock-3-b',
        side_letter: 'B',
        audio_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: 185,
        cover_r2_url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
      }
    ]
  }
];

// Mock 音乐生成状态模拟器
export class DevMockMusicGeneration {
  private taskId: string;
  private startTime: number;
  private phase: 'generating' | 'text' | 'first' | 'complete' = 'generating';

  constructor(taskId: string) {
    this.taskId = taskId;
    this.startTime = Date.now();
  }

  getStatus() {
    const elapsed = Date.now() - this.startTime;
    
    // 0-8秒: 生成中
    if (elapsed < 8000) {
      return {
        code: 200,
        data: {
          status: 'generating',
          tracks: []
        }
      };
    }
    
    // 8-15秒: text 回调 - 开始流式播放，显示文本内容
    if (elapsed < 15000) {
      this.phase = 'text';
      return {
        code: 200,
        data: {
          status: 'streaming',
          tracks: [
            {
              id: `${this.taskId}-1`,
              title: 'Generated Track A',
              audioUrl: '', // text回调阶段还没有final audio
              streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // 流式音频
              coverImage: null, // text回调阶段还没有封面
              duration: 0, // 还没有真实时长
              tags: 'smooth, romantic, generated',
              genre: 'Contemporary R&B',
              mood: 'romantic',
              sideLetter: 'A',
              lyrics: 'Mock lyrics for Track A...'
            },
            {
              id: `${this.taskId}-2`,
              title: 'Generated Track B',
              audioUrl: '', // text回调阶段还没有final audio
              streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav', // 流式音频
              coverImage: null, // text回调阶段还没有封面
              duration: 0, // 还没有真实时长
              tags: 'upbeat, danceable, generated',
              genre: 'New Jack Swing',
              mood: 'upbeat',
              sideLetter: 'B',
              lyrics: 'Mock lyrics for Track B...'
            }
          ]
        }
      };
    }
    
    // 15-20秒: 封面回调 - 显示封面图片
    if (elapsed < 20000) {
      this.phase = 'text';
      return {
        code: 200,
        data: {
          status: 'streaming',
          tracks: [
            {
              id: `${this.taskId}-1`,
              title: 'Generated Track A',
              audioUrl: '', // 还没有final audio
              streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
              coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop', // 封面回调完成
              duration: 0, // 还没有真实时长
              tags: 'smooth, romantic, generated',
              genre: 'Contemporary R&B',
              mood: 'romantic',
              sideLetter: 'A',
              lyrics: 'Mock lyrics for Track A...'
            },
            {
              id: `${this.taskId}-2`,
              title: 'Generated Track B',
              audioUrl: '', // 还没有final audio
              streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
              coverImage: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop', // 封面回调完成
              duration: 0, // 还没有真实时长
              tags: 'upbeat, danceable, generated',
              genre: 'New Jack Swing',
              mood: 'upbeat',
              sideLetter: 'B',
              lyrics: 'Mock lyrics for Track B...'
            }
          ]
        }
      };
    }
    
    // 20-25秒: first 回调 - 第一首歌就绪
    if (elapsed < 25000) {
      this.phase = 'first';
      return {
        code: 200,
        data: {
          status: 'streaming',
          tracks: [
            {
              id: `${this.taskId}-1`,
              title: 'Generated Track A',
              audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav', // first回调完成
              streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
              coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
              duration: 195, // 第一首有了真实时长
              tags: 'smooth, romantic, generated',
              genre: 'Contemporary R&B',
              mood: 'romantic',
              sideLetter: 'A',
              lyrics: 'Mock lyrics for Track A...'
            },
            {
              id: `${this.taskId}-2`,
              title: 'Generated Track B',
              audioUrl: '', // 第二首还没有final audio
              streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
              coverImage: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
              duration: 0, // 第二首还在生成
              tags: 'upbeat, danceable, generated',
              genre: 'New Jack Swing',
              mood: 'upbeat',
              sideLetter: 'B',
              lyrics: 'Mock lyrics for Track B...'
            }
          ]
        }
      };
    }
    
    // 25秒后: complete - 全部完成
    this.phase = 'complete';
    return {
      code: 200,
      data: {
        status: 'complete',
        tracks: [
          {
            id: `${this.taskId}-1`,
            title: 'Generated Track A',
            audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
            streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
            coverImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
            duration: 195,
            tags: 'smooth, romantic, generated',
            genre: 'Contemporary R&B',
            mood: 'romantic',
            sideLetter: 'A',
            lyrics: 'Mock lyrics for Track A...'
          },
          {
            id: `${this.taskId}-2`,
            title: 'Generated Track B',
            audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
            streamAudioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
            coverImage: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop',
            duration: 210, // 第二首也有了真实时长
            tags: 'upbeat, danceable, generated',
            genre: 'New Jack Swing',
            mood: 'upbeat',
            sideLetter: 'B',
            lyrics: 'Mock lyrics for Track B...'
          }
        ]
      }
    };
  }
}

// 全局 mock 实例管理
const mockGenerations = new Map<string, DevMockMusicGeneration>();

export const createDevMockGeneration = (taskId: string) => {
  const generation = new DevMockMusicGeneration(taskId);
  mockGenerations.set(taskId, generation);
  return generation;
};

export const getDevMockGeneration = (taskId: string) => {
  return mockGenerations.get(taskId);
};