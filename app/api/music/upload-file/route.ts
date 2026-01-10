import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth';
import { uploadAudioFileToKIE } from '@/lib/kie-file-upload';

export const dynamic = 'force-dynamic';

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

  if (file.size > 40 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be under 40MB' }, { status: 400 });
  }

  try {
    const originalExt = file.name?.split('.').pop();
    const safeExt = originalExt && originalExt.length <= 5 ? `.${originalExt}` : '';
    const safeTitle = file.name
      ? file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-')
      : `upload-${Date.now()}`;

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
