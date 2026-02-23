import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { uploadAudioFileToKIE } from '@/lib/kie-file-upload';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const sanitizeBaseName = (name: string | undefined): string => {
  const fallback = `upload-${Date.now()}`;
  if (!name) return fallback;
  const normalized = name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
};

const getSafeExtension = (fileName: string | undefined): string => {
  const rawExt = fileName?.split('.').pop()?.toLowerCase() || '';
  if (!rawExt || rawExt.length > 8 || !/^[a-z0-9]+$/.test(rawExt)) {
    return '.bin';
  }
  return `.${rawExt}`;
};

export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
  }

  if (!file.type.startsWith('audio/')) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File size must be under 100MB' }, { status: 400 });
  }

  try {
    const safeTitle = sanitizeBaseName(file.name);
    const safeExt = getSafeExtension(file.name);

    const uploadInfo = await uploadAudioFileToKIE(file, {
      fileName: `${safeTitle}${safeExt}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        downloadUrl: uploadInfo.downloadUrl,
        fileName: uploadInfo.fileName,
      },
    });
  } catch (error) {
    console.error('Upload audio file failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
