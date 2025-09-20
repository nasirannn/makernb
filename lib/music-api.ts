import { generate90sRnBPrompt, R_AND_B_STYLES } from './90s-rnb-style-prompts';

// API service configuration
export interface GenerateMusicRequest {
  mode: 'basic' | 'custom';
  // Basic mode fields
  mood?: string;
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
  mood: string;
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



  // Generate style for custom mode
  private generateCustomStyle(request: GenerateMusicRequest): string {
    const genreMap = {
      'new-jack-swing': 'New Jack Swing',
      'hip-hop-soul': 'Hip-Hop Soul',
      'contemporary-rnb': 'Contemporary R&B',
      'quiet-storm': 'Quiet Storm',
      'neo-soul': 'Neo-Soul',
    };

    const vibeMap = {
      'slow-jam': 'smooth, romantic slow tempo',
      'upbeat': 'energetic and danceable',
      'chill': 'relaxed and laid-back',
      'raw': 'authentic, unpolished sound',
      'polished': 'refined professional production quality',
      'groovy': 'funky rhythmic dance vibes',
    };

    let style = genreMap[request.genre as keyof typeof genreMap] || 'Contemporary R&B';
    
    if (request.vibe) {
      style += `, ${vibeMap[request.vibe as keyof typeof vibeMap]}`;
    }
    
    if (request.grooveType || request.leadInstrument?.length || request.drumKit || request.bassTone) {
      style += ', 1990s authentic production';
    }
    
    return style;
  }

  // Generate detailed prompt for custom mode
  private generateCustomPrompt(request: GenerateMusicRequest): string {
    let prompt = '';
    
    if (request.customPrompt) {
      prompt = request.customPrompt;
    } else {
      prompt = `A ${this.generateCustomStyle(request)} song with authentic 90s Black R&B sound. `;
      
      if (request.bpm) {
        prompt += `Tempo around ${request.bpm} BPM. `;
      }
      
      if (request.harmonyPalette) {
        prompt += `Rich harmonic progressions. `;
      }
      
      prompt += 'High quality production, period-appropriate instrumentation and mixing.';
    }
    
    return prompt;
  }

  // Generate default lyrics for R&B style based on vibe
  private generateDefaultLyrics(request: GenerateMusicRequest): string {
    // 根据vibe选择合适的歌词模板
    const lyricsTemplates = {
      'slow-jam': `[Verse 1]
Baby, when you're near me
I can feel the love so deep
Every single moment
Makes my heart skip a beat

[Chorus]
You're my everything, my all
You make me feel so complete
In your arms I find my peace
This love will never retreat

[Verse 2]
Through the ups and downs
We'll always find a way
Together we're stronger
Every single day

[Chorus]
You're my everything, my all
You make me feel so complete
In your arms I find my peace
This love will never retreat`,

      'upbeat': `[Verse 1]
Get up, get down, let's move around
Feel the rhythm, hear the sound
R&B vibes are back in town
Turn it up, don't turn it down

[Chorus]
We're dancing all night long
To this R&B song
Feel the beat, feel the groove
This is what we came to prove

[Verse 2]
Hands up in the air
Show the world you care
Move your body, feel the flow
Let the music take control

[Chorus]
We're dancing all night long
To this R&B song
Feel the beat, feel the groove
This is what we came to prove`,

      'chill': `[Verse 1]
Sitting here, just you and me
Underneath the starry sky
Nothing else can bring me peace
Like the look in your eyes

[Chorus]
Let's just chill, take it slow
Let the world fade away
In this moment, we both know
Everything will be okay

[Verse 2]
No need to rush, no need to run
We got all the time we need
Two hearts beating as one
This is where we want to be

[Chorus]
Let's just chill, take it slow
Let the world fade away
In this moment, we both know
Everything will be okay`,

      'groovy': `[Verse 1]
Feel the funk, feel the soul
Let the rhythm take control
Groovy beats and bassline deep
This is music that we keep

[Chorus]
Get down, get funky tonight
Everything's gonna be alright
Groove with me, move with me
This is how it's meant to be

[Verse 2]
Smooth vocals, tight harmonies
Dancing to these melodies
Funky rhythm, soulful sound
Best groove that can be found

[Chorus]
Get down, get funky tonight
Everything's gonna be alright
Groove with me, move with me
This is how it's meant to be`,

      // 默认歌词（用于raw和polished vibe）
      'default': `[Verse 1]
Music flows through my soul
Making me feel whole
Every note, every beat
Makes my heart complete

[Chorus]
This is the sound of love
Sent from heaven above
R&B in my veins
Breaking all the chains

[Verse 2]
Rhythm and blues combined
Peace of heart and mind
Soulful melodies
Set my spirit free

[Chorus]
This is the sound of love
Sent from heaven above
R&B in my veins
Breaking all the chains`
    };

    // 根据vibe选择歌词，如果没有对应的模板则使用默认
    const vibe = request.vibe || 'slow-jam';
    return lyricsTemplates[vibe as keyof typeof lyricsTemplates] || lyricsTemplates['default'];
  }


  // Generate music
  async generateMusic(request: GenerateMusicRequest): Promise<SunoApiResponse> {

    // 根据文档设置正确的API参数
    const apiParams: any = {
      model: 'V3_5',
      callBackUrl: process.env.SUNO_CALLBACK_URL,
    };

    if (request.mode === 'basic') {
      // Basic模式: customMode: false
      apiParams.customMode = false;
      apiParams.instrumental = request.instrumentalMode || false;

      // Basic Mode直接使用用户输入的prompt，不再依赖mood
      apiParams.prompt = request.customPrompt || 'Create a contemporary R&B song with smooth vocals and modern production';

      // 权重参数
      apiParams.styleWeight = 0.85;
      apiParams.weirdnessConstraint = 0.25;
      apiParams.audioWeight = 0.35;

      // negativeTags - 避免不符合R&B风格的元素
      apiParams.negativeTags = "edm, techno, trap, lo-fi hip-hop, distorted noise";
      
    } else {
      // Custom模式: customMode: true
      apiParams.customMode = true;
      apiParams.instrumental = request.instrumentalMode || false;
      apiParams.model = 'V4_5'; // Custom Mode使用V4_5模型
      
      // 生成style - 包含核心音乐风格（genre）+ Style & Vibe + Arrangement & Performance参数
      const genreMap = {
        'new-jack-swing': 'New Jack Swing',
        'hip-hop-soul': 'Hip-Hop Soul',
        'quiet-storm': 'Quiet Storm',
        'neo-soul': 'Neo-Soul',
      };

      let style = genreMap[request.genre as keyof typeof genreMap];

      // 拼接Style & Vibe参数
      const styleParts = [];

      // Vibe - 根据实际的vibe选项
      if (request.vibe) {
        const vibeMap = {
          'slow-jam': 'smooth, romantic slow tempo',
          'upbeat': 'energetic and danceable',
          'chill': 'relaxed and laid-back',
          'raw': 'authentic, unpolished sound',
          'polished': 'refined professional production quality',
          'groovy': 'funky rhythmic dance vibes',
        };
        styleParts.push(vibeMap[request.vibe as keyof typeof vibeMap] || request.vibe);
      }
      
      // 拼接Style & Vibe到基础风格
      if (styleParts.length > 0) {
        style += ` with ${styleParts.join(', ')} style`;
      }
      
      // 拼接Arrangement & Performance参数
      const arrangementParts = [];
      
      // Groove Type
      if (request.grooveType) {
        const grooveDescriptions = {
          'swing': 'swing groove',
          'shuffle': 'shuffle groove',
          'straight': 'straight groove',
          'laid-back': 'laid-back groove',
          'pocket': 'pocket groove'
        };
        arrangementParts.push(grooveDescriptions[request.grooveType as keyof typeof grooveDescriptions] || request.grooveType);
      }
      
      // Lead Instrument
      if (request.leadInstrument && request.leadInstrument.length > 0) {
        arrangementParts.push(`lead ${request.leadInstrument.join(', ')}`);
      }
      
      // Drum Kit
      if (request.drumKit) {
        arrangementParts.push(`${request.drumKit} drums`);
      }
      
      // Bass Tone
      if (request.bassTone) {
        arrangementParts.push(`${request.bassTone} bass`);
      }
      

      
      // Harmony Palette
      if (request.harmonyPalette) {
        arrangementParts.push(`${request.harmonyPalette} harmonies`);
      }
      
      // 拼接所有参数
      if (arrangementParts.length > 0) {
        style += ` with ${arrangementParts.join(', ')}`;
      }

      // 添加BPM信息到style中（因为API不直接支持bpm参数）
      if (request.bpm) {
        style += `, ${request.bpm} BPM`;
      }

      apiParams.style = style;
      
      // 处理prompt - 根据API文档，在非instrumental模式下，prompt严格作为歌词使用
      if (!request.instrumentalMode) {
        // 如果有自定义prompt，直接作为歌词使用
        if (request.customPrompt) {
          apiParams.prompt = request.customPrompt;
        } else {
          // 如果没有自定义prompt，生成默认的90s R&B风格歌词
          const defaultLyrics = this.generateDefaultLyrics(request);
          apiParams.prompt = defaultLyrics;
        }
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

      // 权重参数
      apiParams.styleWeight = 0.95;
      apiParams.weirdnessConstraint = 0.25;
      apiParams.audioWeight = 0.35;
      
      // negativeTags - 避免不符合90s R&B风格的元素
      apiParams.negativeTags = "edm, techno, trap, lo-fi hip-hop, distorted noise";
    }
    
    console.log('=== 发送到KIE AI API的最终参数 ===');
    console.log('API URL:', `${this.baseUrl}/api/v1/generate`);
    console.log('API参数:', JSON.stringify(apiParams, null, 2));
    console.log('参数类型验证:', {
      'prompt类型': typeof apiParams.prompt,
      'prompt长度': apiParams.prompt ? apiParams.prompt.length : 0,
      'style类型': typeof apiParams.style,
      'style值': apiParams.style,
      'bpm类型': typeof apiParams.bpm,
      'bpm值': apiParams.bpm,
      'vocalGender类型': typeof apiParams.vocalGender,
      'vocalGender值': apiParams.vocalGender,
      'title类型': typeof apiParams.title,
      'title值': apiParams.title
    });
    
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
    
    console.log('Raw API response:', JSON.stringify(data, null, 2));
    
    // Check for API success
    if (data.code === 200) {
      return {
        taskId: data.data?.taskId,
        status: 'generating',
        data: data.data
      };
    } else {
      // API返回错误，但不抛出异常，而是返回错误信息
      console.log(`API returned error (${data.code}): ${data.msg}`);
      return {
        status: 'error',
        error: `API error (${data.code})`,
        errorMessage: data.msg || 'Unknown error'
      };
    }
    
    return data;
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
    console.log(`Generating cover for taskId: ${request.taskId}`);

    const apiParams = {
      taskId: request.taskId,
      callBackUrl: request.callBackUrl || process.env.COVER_CALLBACK_URL,
    };
    
    console.log('Cover API request params:', JSON.stringify(apiParams, null, 2));
    
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
    console.log('Cover API response:', JSON.stringify(data, null, 2));
    
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
      console.log(`Cover already exists for taskId: ${request.taskId}`);
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