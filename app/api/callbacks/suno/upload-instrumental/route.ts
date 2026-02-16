import { NextRequest } from 'next/server';

import { handleSunoCallback } from '@/lib/callbacks/suno-callback-handler';

export async function POST(request: NextRequest) {
  return handleSunoCallback(request, 'upload-instrumental');
}
