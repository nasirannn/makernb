import { generateCustomRnBStyle } from './rnb-style-generator';

// API service configuration
export interface GenerateMusicRequest {
  mode: 'basic' | 'custom';
  // Basic mode fields
  customPrompt?: string;
  instrumentalMode?: boolean;

  // Custom mode fields
  songTitle?: string;
  styleText?: string; // 用户直接输入的style内容
  vocalGender?: string; // 人声性别偏好：'m' 或 'f'
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
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1秒

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = process.env.SUNO_API_BASE_URL || 'https://api.kie.ai';
  }

  /**
   * 重试fetch请求的辅助方法
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries: number = this.maxRetries): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // 如果是5xx错误，可以重试
        if (response.status >= 500 && attempt < retries) {
          console.warn(`API call failed with status ${response.status}, attempt ${attempt}/${retries}`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
          continue;
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        console.error(`Network error on attempt ${attempt}/${retries}:`, error);
        
        if (attempt < retries) {
          // 指数退避
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1)));
        }
      }
    }
    
    throw new Error(`API call failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
  }
  
  // Generate music
  async generateMusic(request: GenerateMusicRequest): Promise<SunoApiResponse> {

    // 根据文档设置正确的API参数
    const apiParams: any = {
      // Remove trailing slash to match trailingSlash: false configuration
      callBackUrl: `${process.env.CallBackURL}/api/suno-callback`,
    };

    // negativeTags - 避免不符合R&B风格的元素（通用设置）
    apiParams.negativeTags = "edm, techno, trance, dubstep, synthpop, electronic, house, distorted noise, pop, rock, metal, country, jazz, classical, folk, indie, alternative, punk, blues, reggae, hip hop, rap";

    if (request.mode === 'basic') {
      // Basic模式: customMode: false（style 等参数将被忽略）
      apiParams.customMode = false;
      apiParams.instrumental = request.instrumentalMode || false;
      apiParams.model = process.env.BASIC_MODE_MODEL || 'V3_5'; // Basic Mode使用配置的模型

      // 拼接一个≤100字符的R&B风格短语到prompt
      const styleHint = 'Create in R&B style.'; 

      // Basic Mode的prompt：用户输入 + 风格短语
      if (request.customPrompt && request.customPrompt.trim()) {
        const base = request.customPrompt.trim().slice(0, 400);
        // 若拼接后超过500，优先保证用户400字符，再截断整体至500以内
        const combined = `${base} | ${styleHint}`;
        apiParams.prompt = combined.slice(0, 500);
      }
    } else {
      // Custom模式: customMode: true
      apiParams.customMode = true;
      apiParams.instrumental = request.instrumentalMode || false;
      apiParams.model = process.env.CUSTOM_MODE_MODEL; // Custom Mode使用配置的模型

      // Custom Mode: 使用用户输入的styleText
      apiParams.style = request.styleText?.trim() || '';

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
        apiParams.vocalGender = genderMap[request.vocalGender as keyof typeof genderMap] || request.vocalGender;
      }

    }
    // 权重参数 - 最大styleWeight来更强制地遵循R&B风格
    apiParams.styleWeight = 1.0;
    apiParams.weirdnessConstraint = 0.05; // 降低到0.05，更严格遵循风格
    apiParams.audioWeight = 0.0;

    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/generate`, {
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
      // Remove trailing slash to match trailingSlash: false configuration
      callBackUrl: request.callBackUrl || `${process.env.CallBackURL}/api/cover-callback`,
    };
    
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/suno/cover/generate`, {
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