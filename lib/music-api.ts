import { generateBasicRnBStyle, generateCustomRnBStyle } from './rnb-style-generator';

// API service configuration
export interface GenerateMusicRequest {
  mode: 'basic' | 'custom';
  // Basic mode fields
  customPrompt?: string;
  instrumentalMode?: boolean;

  // Custom mode fields
  genre?: string;
  vibe?: string;
  songTitle?: string;
  grooveType?: string;
  leadInstrument?: string[];
  drumKit?: string;
  bassTone?: string;
  vocalGender?: string;
  harmonyPalette?: string;
  bpm?: number;
}

export interface GeneratedMusic {
  id: string;
  title: string;
  audioUrl: string;
  imageUrl?: string;
  duration: number;
  genre: string;
}

export interface SunoApiResponse {
  taskId?: string;
  status?: 'generating' | 'complete' | 'error';
  data?: {
    id: string;
    title: string;
    audio_url: string;
    image_url?: string;
    duration: number;
  }[];
  // For task status response
  id?: string;
  title?: string;
  audio_url?: string;
  image_url?: string;
  duration?: number;
  // For error handling
  error?: string;
  errorMessage?: string;
}

export interface GenerateCoverRequest {
  taskId: string; // 原始音乐任务的ID
  callBackUrl?: string; // 回调URL
}

export interface CoverApiResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    images?: string[] | null;
  };
}

class MusicApiService {
  private baseUrl = 'https://api.kie.ai';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  // Generate music
  async generateMusic(request: GenerateMusicRequest): Promise<SunoApiResponse> {

    // 根据文档设置正确的API参数
    const apiParams: any = {
      model: 'V3_5',
      callBackUrl: process.env.SUNO_CALLBACK_URL,
    };

    // negativeTags - 避免不符合R&B风格的元素（通用设置）
    apiParams.negativeTags = "edm, techno, trance, dubstep, synthpop, electronic, house, distorted noise, pop, rock, metal, country, jazz, classical";

    if (request.mode === 'basic') {
      // Basic模式: customMode: false
      apiParams.customMode = false;
      apiParams.instrumental = request.instrumentalMode || false;

      // Basic Mode生成简单的R&B风格style
      const rnbStyle = generateBasicRnBStyle();
      apiParams.style = rnbStyle;

      // Basic Mode的prompt就是用户输入的内容（作为歌词或主题）
      if (request.customPrompt && request.customPrompt.trim()) {
        apiParams.prompt = request.customPrompt.trim();
      }
    } else {
      // Custom模式: customMode: true
      apiParams.customMode = true;
      apiParams.instrumental = request.instrumentalMode || false;
      apiParams.model = 'V4_5'; // Custom Mode使用V4_5模型

      // Custom Mode使用generateCustomRnBStyle函数生成详细的style
      const customStyle = generateCustomRnBStyle({
        genre: request.genre || 'quiet-storm',
        vibe: request.vibe,
        bpm: request.bpm,
        grooveType: request.grooveType,
        leadInstrument: request.leadInstrument,
        drumKit: request.drumKit,
        bassTone: request.bassTone,
        vocalGender: request.vocalGender,
        harmonyPalette: request.harmonyPalette,
        instrumentalMode: request.instrumentalMode,
        customPrompt: request.customPrompt
      });

      apiParams.style = customStyle;

      // 处理prompt - 根据API文档，在非instrumental模式下，prompt严格作为歌词使用
      if (!request.instrumentalMode && request.customPrompt) {
        // 如果有自定义prompt，直接作为歌词使用
        apiParams.prompt = request.customPrompt;
      }
      // instrumental模式下不需要prompt

      // Title
      if (request.songTitle) {
        apiParams.title = request.songTitle;
      }

      // Vocal Gender
      if (request.vocalGender && !request.instrumentalMode) {
        const genderMap = {
          'male': 'm',
          'female': 'f'
        };
        apiParams.vocalGender = genderMap[request.vocalGender as keyof typeof genderMap];
      }
    }
    // 权重参数 - 最大styleWeight来更强制地遵循R&B风格
    apiParams.styleWeight = 1.0;
    apiParams.weirdnessConstraint = 0.1;
    apiParams.audioWeight = 0.0;

    const response = await fetch(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API call failed: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();

    // Check for API success
    if (data.code === 200) {
      return {
        taskId: data.data?.taskId,
        status: 'generating',
        data: data.data
      };
    } else {
      // API返回错误，但不抛出异常，而是返回错误信息
      return {
        status: 'error',
        error: `API error (${data.code})`,
        errorMessage: data.msg || 'Unknown error'
      };
    }
  }

  // Get generation status
  async getGenerationStatus(taskId: string): Promise<SunoApiResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/generate/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Get status failed: ${response.statusText} - ${errorData}`);
    }

    return await response.json();
  }

  // Poll until generation complete
  async waitForCompletion(taskId: string, maxAttempts = 30): Promise<SunoApiResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getGenerationStatus(taskId);
      
      if (status.status === 'complete') {
        return status;
      } else if (status.status === 'error') {
        throw new Error('Music generation failed');
      }
      
      // Wait 5 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Music generation timeout');
  }

  // Generate cover for existing music task
  async generateCover(request: GenerateCoverRequest): Promise<CoverApiResponse> {

    const apiParams = {
      taskId: request.taskId,
      callBackUrl: request.callBackUrl || process.env.COVER_CALLBACK_URL,
    };
    
    const response = await fetch(`${this.baseUrl}/api/v1/suno/cover/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Cover API call failed: ${response.status} - ${errorData}`);
      throw new Error(`Cover API call failed: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    // 根据官方文档处理响应
    if (data.code === 200) {
      // 成功响应：只返回新的taskId，图片通过回调返回
      return {
        code: data.code,
        msg: data.msg || 'Cover generation started successfully',
        data: {
          taskId: data.data?.taskId,
          images: null // 图片通过回调返回，不在此响应中
        }
      };
    } else if (data.code === 400) {
      // 重复请求：该音乐任务已生成过Cover
      return {
        code: data.code,
        msg: data.msg || 'Cover already exists for this music task',
        data: {
          taskId: data.data?.taskId || request.taskId,
          images: null
        }
      };
    } else {
      // 其他错误
      console.error(`Cover API error: ${data.code} - ${data.msg}`);
      throw new Error(`Cover API error (${data.code}): ${data.msg || 'Unknown error'}`);
    }
  }

  // Get cover generation status (fallback method)
  async getCoverStatus(taskId: string): Promise<CoverApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/suno/cover/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        // 如果API Key没有权限，返回默认状态
        if (response.status === 401) {
          console.warn('Cover status query not available: API key lacks permissions');
          return {
            code: 202,
            msg: 'Cover generation in progress (status query unavailable)',
            data: {
              taskId: taskId,
              images: null
            }
          };
        }
        
        const errorData = await response.text();
        throw new Error(`Get cover status failed: ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();
      
      return {
        code: data.code,
        msg: data.msg,
        data: {
          taskId: data.data?.taskId,
          images: data.data?.response?.images || null
        }
      };
    } catch (error) {
      console.warn('Cover status query failed, falling back to callback-only mode:', error);
      // 返回进行中状态，依赖回调机制
      return {
        code: 202,
        msg: 'Cover generation in progress (callback-only mode)',
        data: {
          taskId: taskId,
          images: null
        }
      };
    }
  }

  // Poll until cover generation complete
  async waitForCoverCompletion(taskId: string, maxAttempts = 30): Promise<CoverApiResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getCoverStatus(taskId);
      
      if (status.code === 200 && status.data.images) {
        return status;
      } else if (status.code === 501) {
        throw new Error('Cover generation failed');
      }
      
      // Wait 5 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Cover generation timeout');
  }

}

export default MusicApiService;