// Vocal Separation API Service
// 整合KIE文件上传和Replicate人声分离API

interface KIEUploadResponse {
  success: boolean;
  code: number;
  msg: string;
  data: {
    fileId: string;
    fileName: string;
    originalName: string;
    fileSize: number;
    mimeType: string;
    uploadPath: string;
    fileUrl: string;
    downloadUrl: string;
    uploadTime: string;
    expiresAt: string;
  };
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: {
    vocals: string;
    accompaniment: string;
  };
  error?: string;
}

class VocalSeparationService {
  private kieApiKey: string;
  private replicateApiKey: string;
  private kieBaseUrl = 'https://kieai.redpandaai.co';
  private replicateBaseUrl = 'https://api.replicate.com/v1';

  constructor() {
    this.kieApiKey = process.env.KIE_API_KEY || '';
    this.replicateApiKey = process.env.REPLICATE_API_TOKEN || '';
  }

  // 上传文件到KIE
  async uploadFileToKIE(file: File): Promise<KIEUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadPath', 'vocal-separation');
    formData.append('fileName', file.name);

    const response = await fetch(`${this.kieBaseUrl}/api/file-stream-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.kieApiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error(`KIE upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  // 上传URL到KIE
  async uploadUrlToKIE(fileUrl: string, fileName?: string): Promise<KIEUploadResponse> {
    const response = await fetch(`${this.kieBaseUrl}/api/file-url-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.kieApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileUrl,
        uploadPath: 'vocal-separation',
        fileName: fileName || `audio-${Date.now()}`
      })
    });

    if (!response.ok) {
      throw new Error(`KIE URL upload failed: ${response.statusText}`);
    }

    return response.json();
  }

  // 创建Replicate预测任务（支持webhook）
  async createReplicatePrediction(audioUrl: string, webhookUrl?: string): Promise<ReplicatePrediction> {
    // 使用稳定版本哈希（来自官方页面示例）
    const SPLEETER_VERSION = process.env.REPLICATE_SPLEETER_VERSION ||
      'cd128044253523c86abfd743dea680c88559ad975ccd72378c8433f067ab5d0a';

    const requestBody: any = {
      version: SPLEETER_VERSION,
      input: {
        audio: audioUrl
      }
    };

    if (webhookUrl) {
      requestBody.webhook = webhookUrl;
      requestBody.webhook_events_filter = ['start', 'output', 'logs', 'completed'];
    }

    const response = await fetch(`${this.replicateBaseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.replicateApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errJson = await response.json();
        detail = errJson?.error || JSON.stringify(errJson);
      } catch {}
      throw new Error(`Replicate prediction failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
    }

    return response.json();
  }

  // 获取Replicate预测结果
  async getReplicatePrediction(predictionId: string): Promise<ReplicatePrediction> {
    const response = await fetch(`${this.replicateBaseUrl}/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${this.replicateApiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get prediction: ${response.statusText}`);
    }

    return response.json();
  }

  // 轮询获取分离结果
  async pollSeparationResult(predictionId: string, maxAttempts = 30): Promise<ReplicatePrediction> {
    for (let i = 0; i < maxAttempts; i++) {
      const prediction = await this.getReplicatePrediction(predictionId);
      
      if (prediction.status === 'succeeded') {
        return prediction;
      }
      
      if (prediction.status === 'failed') {
        throw new Error(`Separation failed: ${prediction.error}`);
      }

      // 等待2秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Separation timeout');
  }

  // 完整的人声分离流程
  async separateVocals(file: File): Promise<{ vocals: string; accompaniment: string }> {
    try {
      // 1. 上传文件到KIE
      const uploadResult = await this.uploadFileToKIE(file);
      
      // 2. 创建Replicate预测
      const prediction = await this.createReplicatePrediction(uploadResult.data.fileUrl);
      
      // 3. 轮询获取结果
      const result = await this.pollSeparationResult(prediction.id);
      
      if (!result.output) {
        throw new Error('No output received from Replicate');
      }

      return {
        vocals: result.output.vocals,
        accompaniment: result.output.accompaniment
      };
    } catch (error) {
      console.error('Vocal separation failed:', error);
      throw error;
    }
  }

  // 处理URL输入的人声分离
  async separateVocalsFromUrl(audioUrl: string): Promise<{ vocals: string; accompaniment: string }> {
    try {
      // 直接使用Replicate处理URL
      const prediction = await this.createReplicatePrediction(audioUrl);
      
      // 轮询获取结果
      const result = await this.pollSeparationResult(prediction.id);
      
      if (!result.output) {
        throw new Error('No output received from Replicate');
      }

      return {
        vocals: result.output.vocals,
        accompaniment: result.output.accompaniment
      };
    } catch (error) {
      console.error('Vocal separation from URL failed:', error);
      throw error;
    }
  }
}

export const vocalSeparationService = new VocalSeparationService();
export type { KIEUploadResponse, ReplicatePrediction };
