import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';

// ============================================================================
// AUTH CACHE
// ============================================================================

interface CachedAuth {
  userId: string;
  authorName: string | null;
  email: string | null;
  timestamp: number;
  ttl: number;
}

class AuthCache {
  private cache = new Map<string, CachedAuth>();
  private readonly DEFAULT_TTL = 300000; // 5 minutes

  set(
    token: string,
    data: { userId: string; authorName?: string | null; email?: string | null },
    ttlMs: number = this.DEFAULT_TTL
  ): void {
    this.cache.set(token, {
      userId: data.userId,
      authorName: data.authorName ?? null,
      email: data.email ?? null,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(token: string): CachedAuth | null {
    const entry = this.cache.get(token);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(token);
      return null;
    }

    return entry;
  }

  getUserId(token: string): string | null {
    return this.get(token)?.userId ?? null;
  }

  getUserInfo(token: string): { userId: string; authorName: string | null; email: string | null } | null {
    const entry = this.get(token);
    if (!entry) {
      return null;
    }
    return {
      userId: entry.userId,
      authorName: entry.authorName,
      email: entry.email,
    };
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(token);
      }
    }
  }
}

// Global auth cache instance
const authCache = new AuthCache();

// Cleanup expired entries every 5 minutes
const cleanupInterval = setInterval(() => {
  authCache.cleanup();
}, 300000);
cleanupInterval.unref?.();

// ============================================================================
// OPTIMIZED AUTH FUNCTIONS
// ============================================================================

/**
 * 快速提取token从请求头
 */
function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

const inflightUserLookups = new Map<string, Promise<User | null>>();

/**
 * 使用 token 获取 Supabase User（并发去重）
 */
async function getUserFromToken(token: string): Promise<User | null> {
  const inflight = inflightUserLookups.get(token);
  if (inflight) {
    return inflight;
  }

  const lookupPromise = (async () => {
    const startTime = Date.now();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    const authDuration = Date.now() - startTime;

    if (authDuration > 1000) {
      console.warn(`Slow Supabase auth request: ${authDuration}ms`);
    }

    if (authError || !user) {
      return null;
    }

    return user;
  })();

  inflightUserLookups.set(token, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inflightUserLookups.delete(token);
  }
}

/**
 * 优化的用户身份验证函数 - 带缓存
 * @param request NextRequest对象
 * @param useCache 是否使用缓存 (默认true)
 * @returns 用户ID，如果验证失败则返回null
 */
export async function getUserIdFromRequest(
  request: NextRequest,
  useCache: boolean = true
): Promise<string | null> {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return null;
    }

    if (useCache) {
      const cachedUserId = authCache.getUserId(token);
      if (cachedUserId) {
        return cachedUserId;
      }
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return null;
    }

    if (useCache) {
      authCache.set(token, {
        userId: user.id,
        authorName: getDisplayNameFromUser(user),
        email: user.email ?? null,
      });
    }

    return user.id;
  } catch (error) {
    console.error('[Auth] Error extracting user ID from request:', error);
    return null;
  }
}

const getDisplayNameFromUser = (user: User): string => {
  const meta = user.user_metadata || {};
  const candidates = [
    meta.author_name,
    meta.nickname,
    meta.full_name,
    meta.name,
    meta.username,
    meta.user_name,
    user.email ? user.email.split('@')[0] : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return 'Anonymous';
};

export async function getUserInfoFromRequest(
  request: NextRequest,
  useCache: boolean = true
): Promise<{ userId: string; authorName: string; email: string | null } | null> {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return null;
    }

    if (useCache) {
      const cachedUserInfo = authCache.getUserInfo(token);
      if (cachedUserInfo) {
        return {
          userId: cachedUserInfo.userId,
          authorName: cachedUserInfo.authorName ?? 'Anonymous',
          email: cachedUserInfo.email,
        };
      }
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return null;
    }

    const authorName = getDisplayNameFromUser(user);
    const email = user.email ?? null;

    if (useCache) {
      authCache.set(token, {
        userId: user.id,
        authorName,
        email,
      });
    }

    return {
      userId: user.id,
      authorName,
      email,
    };
  } catch (error) {
    console.error('[Auth] Error extracting user info from request:', error);
    return null;
  }
}
