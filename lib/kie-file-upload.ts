import { randomUUID } from 'crypto';

interface KIEUploadResponse {
  code: number;
  msg: string;
  data?: {
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

export interface UploadToKIEOptions {
  uploadPath?: string;
  fileName?: string;
}

export interface UploadedKIEFileInfo {
  fileId: string;
  fileName: string;
  downloadUrl: string;
  fileUrl: string;
  mimeType: string;
  size: number;
}

const DEFAULT_UPLOAD_PATH = 'studio-uploads';

export async function uploadAudioFileToKIE(file: File, options: UploadToKIEOptions = {}): Promise<UploadedKIEFileInfo> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new Error('KIE_API_KEY is not configured');
  }

  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('Invalid file input');
  }

  const uploadPath = options.uploadPath || DEFAULT_UPLOAD_PATH;
  const resolvedName = options.fileName || file.name || `audio-${randomUUID()}`;

  const formData = new FormData();
  formData.append('file', file, resolvedName);
  formData.append('uploadPath', uploadPath);
  formData.append('fileName', resolvedName);

  const response = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload file to KIE: ${response.status} ${text}`);
  }

  const json = (await response.json()) as KIEUploadResponse;
  if (json.code !== 200 || !json.data?.downloadUrl) {
    throw new Error(`KIE upload error (${json.code}): ${json.msg || 'Unknown error'}`);
  }

  return {
    fileId: json.data.fileId,
    fileName: json.data.fileName,
    downloadUrl: json.data.downloadUrl,
    fileUrl: json.data.fileUrl,
    mimeType: json.data.mimeType,
    size: json.data.fileSize,
  };
}
