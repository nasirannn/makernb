import { POST as vocalSeparationPost } from '../vocal/separation/route';

export const dynamic = 'force-dynamic';

// Backward-compatible alias for older clients calling `/api/vocal-separation`
export const POST = vocalSeparationPost;

