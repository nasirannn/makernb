import type { User } from '@supabase/supabase-js';
import { getAuthUserById } from '@/lib/supabase-admin';

interface CreatorProfile {
  name: string | null;
}

interface CachedCreatorProfile {
  value: CreatorProfile;
  expiresAt: number;
}

const creatorProfileCache = new Map<string, CachedCreatorProfile>();
const inflightProfileRequests = new Map<string, Promise<CreatorProfile>>();
const PROFILE_TTL_MS = 10 * 60 * 1000;

function getDisplayNameFromUser(user: User | null): string | null {
  if (!user) {
    return null;
  }

  const meta = user.user_metadata || {};
  const candidates = [
    meta.author_name,
    meta.nickname,
    meta.full_name,
    meta.name,
    meta.username,
    meta.user_name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

async function fetchCreatorProfile(userId: string): Promise<CreatorProfile> {
  const cached = creatorProfileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightProfileRequests.get(userId);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    try {
      const user = await getAuthUserById(userId);
      if (!user) {
        return { name: null };
      }

      const profile = {
        name: getDisplayNameFromUser(user),
      };

      creatorProfileCache.set(userId, {
        value: profile,
        expiresAt: Date.now() + PROFILE_TTL_MS,
      });

      return profile;
    } catch (error) {
      console.warn(`[creator-profiles] Unexpected error fetching user ${userId}:`, error);
      return { name: null };
    }
  })();

  inflightProfileRequests.set(userId, request);

  try {
    return await request;
  } finally {
    inflightProfileRequests.delete(userId);
  }
}

export async function getCreatorProfiles(
  userIds: Array<string | null | undefined>
): Promise<Map<string, CreatorProfile>> {
  const uniqueUserIds = Array.from(
    new Set(
      userIds
        .filter((userId): userId is string => typeof userId === 'string' && userId.trim().length > 0)
        .map((userId) => userId.trim())
    )
  );

  if (uniqueUserIds.length === 0) {
    return new Map();
  }

  const profiles = await Promise.all(
    uniqueUserIds.map(async (userId) => [userId, await fetchCreatorProfile(userId)] as const)
  );

  return new Map(profiles);
}
