import { getMusicModel } from '@/lib/credits-config';
import { DEFAULT_NEGATIVE_TAGS, DEFAULT_STYLE_WEIGHT, DEFAULT_WEIRDNESS_CONSTRAINT, DEFAULT_AUDIO_WEIGHT } from '@/lib/music-generation-config';

// API service configuration
export interface GenerateMusicRequest {
  mode: 'simple' | 'custom';
  model?: string;
  // Simple mode fields
  customPrompt?: string;
  instrumentalMode?: boolean;

  // Custom mode fields
  songTitle?: string;
  styleText?: string; // 用户直接输入的style内容
  vocalGender?: string; // 人声性别偏好：'m' 或 'f'
  personaId?: string;
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
    audioUrl: string;
    image_url?: string;
    duration: number;
  }[];
  // For task status response
  id?: string;
  title?: string;
  audioUrl?: string; // 统一使用 audioUrl
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

export interface VocalSeparationRequest {
  taskId: string; // 原始音乐任务的ID
  audioId: string; // 要进行人声分离处理的特定音频轨道ID
  type: 'separate_vocal' | 'split_stem'; // 分离类型（当前项目只使用 separate_vocal）
  callBackUrl?: string; // 回调URL
}

export interface VocalSeparationApiResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

export interface VocalSeparationStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: 'processing' | 'completed' | 'error';
    vocalUrl?: string;
    instrumentalUrl?: string;
    stems?: Record<string, { url: string; name: string }>;
    errorMessage?: string;
  };
}

// ============================================================================
// WAV CONVERSION INTERFACES
// ============================================================================

export interface WavConversionRequest {
  taskId: string; // 原始音乐生成任务的taskId
  audioId: string; // 要转换的音频曲目的audioId
  callBackUrl?: string; // 回调URL
}

export interface WavConversionApiResponse {
  code: number;
  msg: string;
  data: {
    taskId: string; // WAV转换任务的taskId（与原始taskId相同）
  };
}

export interface WavConversionStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status?: 'processing' | 'completed' | 'error';
    audio_wav_url?: string;
    errorMessage?: string;
  };
}

// ============================================================================
// MP4 GENERATION INTERFACES
// ============================================================================

export interface Mp4GenerationRequest {
  taskId: string; // 原始音乐生成任务的taskId
  audioId: string; // 要可视化的音频曲目audioId
  author?: string; // 视频作者署名（可选）
  domainName?: string; // 视频底部品牌水印（可选）
  callBackUrl?: string; // 回调URL
}

export interface Mp4GenerationApiResponse {
  code: number;
  msg: string;
  data: {
    taskId: string; // MP4生成任务taskId
  };
}

// ============================================================================
// TIMESTAMPED LYRICS INTERFACES
// ============================================================================

export interface TimestampedLyricsRequest {
  taskId: string;
  audioId: string;
}

export interface TimestampedLyricWord {
  word: string;
  success: boolean;
  startS: number;
  endS: number;
  palign: number;
}

export interface TimestampedLyricsApiResponse {
  code: number;
  msg: string;
  data: {
    alignedWords: TimestampedLyricWord[];
    waveformData: number[];
    hootCer?: number;
    isStreamed?: boolean;
  };
}

// ============================================================================
// PERSONA GENERATION INTERFACES
// ============================================================================

export interface GeneratePersonaRequest {
  taskId: string;
  audioId: string;
  name: string;
  description: string;
}

export interface GeneratePersonaApiResponse {
  code: number;
  msg: string;
  data: {
    personaId: string;
    name: string;
    description: string;
  };
}

class MusicApiService {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1秒

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = process.env.KIE_API_BASE_URL || 'https://api.kie.ai';
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
      callBackUrl: `${process.env.CallBackURL}/api/callbacks/suno/generate`,
    };

    // negativeTags - 避免不符合R&B风格的元素
    apiParams.negativeTags = DEFAULT_NEGATIVE_TAGS;

    const getModelLimits = (modelValue: string) => {
      switch (modelValue) {
        case 'V4':
          return { prompt: 3000, style: 200, title: 80 };
        case 'V4_5ALL':
          return { prompt: 5000, style: 1000, title: 80 };
        case 'V4_5':
        case 'V4_5PLUS':
        case 'V5':
        default:
          return { prompt: 5000, style: 1000, title: 80 };
      }
    };

    const modelValue = request.model || (request.mode === 'simple' ? getMusicModel('simple') : getMusicModel('custom'));
    const limits = getModelLimits(modelValue);
    
    if (request.mode === 'simple') {
      // Simple模式: customMode: false（style 等参数将被忽略）
      apiParams.customMode = false;
      apiParams.instrumental = request.instrumentalMode || false;
      apiParams.model = modelValue; // 优先使用请求指定模型

      // 拼接一个≤100字符的R&B风格短语到prompt
      const styleHint = 'Create in R&B style.'; 

      // Simple Mode的prompt：用户输入 + 风格短语
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
      apiParams.model = modelValue; // 优先使用请求指定模型

      // Custom Mode: 直接使用用户输入的styleText
      if (request.styleText && request.styleText.trim()) {
        apiParams.style = request.styleText.trim().slice(0, limits.style);
      }

      // 处理prompt - 根据API文档，在非instrumental模式下，prompt严格作为歌词使用
      if (!request.instrumentalMode && request.customPrompt) {
        // 如果有自定义prompt，直接作为歌词使用
        apiParams.prompt = request.customPrompt.slice(0, limits.prompt);
      }
      // instrumental模式下不需要prompt

      // Title
      if (request.songTitle) {
        apiParams.title = request.songTitle.slice(0, limits.title);
      }

      // Vocal Gender
      if (request.vocalGender && !request.instrumentalMode) {
        apiParams.vocalGender = request.vocalGender;
      }

    }

    if (request.personaId) {
      apiParams.persona_id = request.personaId;
    }
    // 权重参数 - 最大styleWeight来更强制地遵循R&B风格
    apiParams.styleWeight = DEFAULT_STYLE_WEIGHT;
    apiParams.weirdnessConstraint = DEFAULT_WEIRDNESS_CONSTRAINT;
    apiParams.audioWeight = DEFAULT_AUDIO_WEIGHT;

    // ⚠️ 生成任务创建接口不做自动重试，避免上游已创建成功但本地因5xx重试导致重复task
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    }, 1);

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
      callBackUrl: request.callBackUrl || `${process.env.CallBackURL}/api/callbacks/cover`,
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

  // ============================================================================
  // VOCAL SEPARATION METHODS
  // ============================================================================

  /**
   * Starts vocal separation process
   */
  async generateVocalSeparation(request: VocalSeparationRequest): Promise<VocalSeparationApiResponse> {
    const apiParams = {
      taskId: request.taskId,
      audioId: request.audioId,
      type: request.type,
      callBackUrl: request.callBackUrl || `${process.env.CallBackURL}/api/callbacks/vocal-separation`,
    };
    
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/vocal-removal/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Vocal separation API call failed: ${response.status} - ${errorData}`);
      throw new Error(`Vocal separation API call failed: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    // 根据官方文档处理响应
    if (data.code === 200) {
      return {
        code: data.code,
        msg: data.msg || 'Vocal separation started successfully',
        data: {
          taskId: data.data?.taskId,
        }
      };
    } else {
      console.error(`Vocal separation API error: ${data.code} - ${data.msg}`);
      throw new Error(`Vocal separation API error (${data.code}): ${data.msg || 'Unknown error'}`);
    }
  }

  /**
   * Gets vocal separation status
   */
  async getVocalSeparationStatus(taskId: string): Promise<VocalSeparationStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/vocal-removal/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        // 如果API Key没有权限，返回默认状态
        if (response.status === 401) {
          console.warn('Vocal separation status query not available: API key lacks permissions');
          return {
            code: 202,
            msg: 'Vocal separation in progress (status query unavailable)',
            data: {
              taskId: taskId,
              status: 'processing'
            }
          };
        }
        
        const errorData = await response.text();
        throw new Error(`Get vocal separation status failed: ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();
      
      return {
        code: data.code,
        msg: data.msg,
        data: {
          taskId: data.data?.taskId,
          status: data.data?.status || 'processing',
          vocalUrl: data.data?.vocalUrl,
          instrumentalUrl: data.data?.instrumentalUrl,
          stems: data.data?.stems,
          errorMessage: data.data?.errorMessage
        }
      };
    } catch (error) {
      console.warn('Vocal separation status query failed, falling back to callback-only mode:', error);
      // 返回进行中状态，依赖回调机制
      return {
        code: 202,
        msg: 'Vocal separation in progress (callback-only mode)',
        data: {
          taskId: taskId,
          status: 'processing'
        }
      };
    }
  }

  /**
   * Poll until vocal separation complete
   */
  async waitForVocalSeparationCompletion(taskId: string, maxAttempts = 30): Promise<VocalSeparationStatusResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getVocalSeparationStatus(taskId);
      
      if (status.code === 200 && status.data.status === 'completed') {
        return status;
      } else if (status.code === 501 || status.data.status === 'error') {
        throw new Error('Vocal separation failed');
      }
      
      // Wait 5 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('Vocal separation timeout');
  }

  // ============================================================================
  // WAV CONVERSION METHODS
  // ============================================================================

  /**
   * Starts WAV conversion process
   * Converts MP3 audio to WAV format
   */
  async generateWavConversion(request: WavConversionRequest): Promise<WavConversionApiResponse> {
    const callBackUrl = request.callBackUrl || `${process.env.CallBackURL}/api/callbacks/wav`;
    
    const apiParams = {
      taskId: request.taskId,
      audioId: request.audioId,
      callBackUrl: callBackUrl,
    };
    
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/wav/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`WAV conversion API call failed: ${response.status} - ${errorData}`);
      throw new Error(`WAV conversion API call failed: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    // 根据官方文档处理响应
    if (data.code === 200) {
      return {
        code: data.code,
        msg: data.msg || 'WAV conversion started successfully',
        data: {
          taskId: data.data?.taskId,
        }
      };
    } else {
      console.error(`WAV conversion API error: ${data.code} - ${data.msg}`);
      throw new Error(`WAV conversion API error (${data.code}): ${data.msg || 'Unknown error'}`);
    }
  }

  /**
   * Gets WAV conversion status
   */
  async getWavConversionStatus(taskId: string): Promise<WavConversionStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/wav/record-info?taskId=${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        // 如果API Key没有权限，返回默认状态
        if (response.status === 401) {
          console.warn('WAV conversion status query not available: API key lacks permissions');
          return {
            code: 202,
            msg: 'WAV conversion in progress (status query unavailable)',
            data: {
              taskId: taskId,
              status: 'processing'
            }
          };
        }
        
        const errorData = await response.text();
        throw new Error(`Get WAV conversion status failed: ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();
      
      return {
        code: data.code,
        msg: data.msg,
        data: {
          taskId: data.data?.taskId,
          status: data.data?.status || 'processing',
          audio_wav_url: data.data?.audio_wav_url,
          errorMessage: data.data?.errorMessage
        }
      };
    } catch (error) {
      console.warn('WAV conversion status query failed, falling back to callback-only mode:', error);
      // 返回进行中状态，依赖回调机制
      return {
        code: 202,
        msg: 'WAV conversion in progress (callback-only mode)',
        data: {
          taskId: taskId,
          status: 'processing'
        }
      };
    }
  }

  /**
   * Poll until WAV conversion complete
   */
  async waitForWavConversionCompletion(taskId: string, maxAttempts = 30): Promise<WavConversionStatusResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getWavConversionStatus(taskId);
      
      if (status.code === 200 && status.data.audio_wav_url) {
        return status;
      } else if (status.code === 501 || status.data.status === 'error') {
        throw new Error('WAV conversion failed');
      }
      
      // Wait 5 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('WAV conversion timeout');
  }

  // ============================================================================
  // MP4 GENERATION METHODS
  // ============================================================================

  /**
   * Starts MP4 music video generation process
   * Converts an existing audio track into a visualized MP4 video
   */
  async generateMp4Video(request: Mp4GenerationRequest): Promise<Mp4GenerationApiResponse> {
    const apiParams: Record<string, string> = {
      taskId: request.taskId,
      audioId: request.audioId,
      callBackUrl: request.callBackUrl || `${process.env.CallBackURL}/api/callbacks/mp4`,
    };

    if (request.author && request.author.trim()) {
      apiParams.author = request.author.trim().slice(0, 50);
    }

    if (request.domainName && request.domainName.trim()) {
      apiParams.domainName = request.domainName.trim().slice(0, 50);
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/mp4/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`MP4 generation API call failed: ${response.status} - ${errorData}`);
      throw new Error(`MP4 generation API call failed: ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();

    if (data.code === 200) {
      return {
        code: data.code,
        msg: data.msg || 'MP4 generation started successfully',
        data: {
          taskId: data.data?.taskId || data.data?.task_id,
        }
      };
    }

    console.error(`MP4 generation API error: ${data.code} - ${data.msg}`);
    throw new Error(`MP4 generation API error (${data.code}): ${data.msg || 'Unknown error'}`);
  }

  /**
   * Gets timestamped lyrics for a generated track
   */
  async getTimestampedLyrics(request: TimestampedLyricsRequest): Promise<TimestampedLyricsApiResponse> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/generate/get-timestamped-lyrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        taskId: request.taskId,
        audioId: request.audioId,
      }),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Ignore JSON parse errors; handled below
    }

    if (!response.ok) {
      const error = new Error(
        `Timestamped lyrics API call failed: ${response.statusText} - ${data?.msg || 'Unknown error'}`
      ) as Error & { code?: number };
      error.code = data?.code || response.status;
      throw error;
    }

    if (data?.code === 200) {
      return {
        code: data.code,
        msg: data.msg || 'Timestamped lyrics fetched successfully',
        data: {
          alignedWords: Array.isArray(data.data?.alignedWords) ? data.data.alignedWords : [],
          waveformData: Array.isArray(data.data?.waveformData) ? data.data.waveformData : [],
          hootCer: typeof data.data?.hootCer === 'number' ? data.data.hootCer : undefined,
          isStreamed: typeof data.data?.isStreamed === 'boolean' ? data.data.isStreamed : undefined,
        },
      };
    }

    const apiError = new Error(
      `Timestamped lyrics API error (${data?.code ?? 'unknown'}): ${data?.msg || 'Unknown error'}`
    ) as Error & { code?: number };
    apiError.code = data?.code;
    throw apiError;
  }

  /**
   * Creates a music persona from an existing generated track
   */
  async generatePersona(request: GeneratePersonaRequest): Promise<GeneratePersonaApiResponse> {
    const apiParams = {
      taskId: request.taskId,
      audioId: request.audioId,
      name: request.name.trim(),
      description: request.description.trim(),
    };

    const response = await this.fetchWithRetry(`${this.baseUrl}/api/v1/generate/generate-persona`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(apiParams),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // Ignore JSON parse errors; handled below
    }

    if (!response.ok) {
      const error = new Error(
        `Persona generation API call failed: ${response.statusText} - ${data?.msg || 'Unknown error'}`
      ) as Error & { code?: number };
      error.code = data?.code || response.status;
      throw error;
    }

    if (data?.code === 200) {
      return {
        code: data.code,
        msg: data.msg || 'Persona generated successfully',
        data: {
          personaId: data.data?.personaId || data.data?.persona_id,
          name: data.data?.name || apiParams.name,
          description: data.data?.description || apiParams.description,
        },
      };
    }

    const apiError = new Error(
      `Persona generation API error (${data?.code ?? 'unknown'}): ${data?.msg || 'Unknown error'}`
    ) as Error & { code?: number };
    apiError.code = data?.code;
    throw apiError;
  }

}

export default MusicApiService;
