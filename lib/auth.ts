import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

// ============================================================================
// AUTH CACHE
// ============================================================================

interface CachedAuth {
  userId: string;
  timestamp: number;
  ttl: number;
}

class AuthCache {
  private cache = new Map<string, CachedAuth>();
  private readonly DEFAULT_TTL = 300000; // 5 minutes

  set(token: string, userId: string, ttlMs: number = this.DEFAULT_TTL): void {
    this.cache.set(token, {
      userId,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get(token: string): string | null {
    const entry = this.cache.get(token);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(token);
      return null;
    }

    return entry.userId;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
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
setInterval(() => {
  authCache.cleanup();
}, 300000);

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

    // Check cache first if enabled
    if (useCache) {
      const cachedUserId = authCache.get(token);
      if (cachedUserId) {
        return cachedUserId;
      }
    }

    // Verify token with Supabase
    const startTime = Date.now();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    const authDuration = Date.now() - startTime;

    // Log slow auth requests
    if (authDuration > 1000) {
      console.warn(`Slow Supabase auth request: ${authDuration}ms`);
    }

    if (authError || !user) {
      return null;
    }

    // Cache the result if caching is enabled
    if (useCache) {
      authCache.set(token, user.id);
    }

    return user.id;
  } catch (error) {
    console.error('Error extracting user ID from request:', error);
    return null;
  }
}

/**
 * 超快速的用户身份验证 - 仅使用缓存
 * 用于对性能要求极高的场景
 */
export function getUserIdFromRequestCacheOnly(request: NextRequest): string | null {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return null;
  }
  return authCache.get(token);
}

/**
 * 预加载用户身份验证到缓存
 * 可以在应用启动时或定期调用
 */
export async function preloadAuthCache(tokens: string[]): Promise<void> {
  const promises = tokens.map(async (token) => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        authCache.set(token, user.id);
      }
    } catch (error) {
      // Ignore errors in preload
    }
  });

  await Promise.all(promises);
}

/**
 * 检查请求是否包含有效的用户身份验证
 * @param request NextRequest对象
 * @param useCache 是否使用缓存
 * @returns 是否验证成功
 */
export async function isAuthenticated(
  request: NextRequest,
  useCache: boolean = true
): Promise<boolean> {
  const userId = await getUserIdFromRequest(request, useCache);
  return userId !== null;
}

/**
 * 批量验证多个token
 */
export async function batchVerifyTokens(tokens: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // First check cache
  const uncachedTokens: string[] = [];
  for (const token of tokens) {
    const cachedUserId = authCache.get(token);
    if (cachedUserId) {
      results.set(token, cachedUserId);
    } else {
      uncachedTokens.push(token);
    }
  }

  // Batch verify uncached tokens
  if (uncachedTokens.length > 0) {
    const promises = uncachedTokens.map(async (token) => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          authCache.set(token, user.id);
          return { token, userId: user.id };
        }
      } catch (error) {
        // Ignore individual errors
      }
      return { token, userId: null };
    });

    const batchResults = await Promise.all(promises);
    for (const { token, userId } of batchResults) {
      results.set(token, userId);
    }
  }

  return results;
}

/**
 * 检查用户是否为管理员
 * @param userId 用户ID
 * @returns 是否为管理员
 */
export function isAdmin(userId: string): boolean {
  // 在服务端使用 ADMIN_ID，在客户端使用 NEXT_PUBLIC_ADMIN_ID
  const adminId = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_ADMIN_ID
    : process.env.ADMIN_ID;

  // 如果没有设置 ADMIN_ID，返回 false
  if (!adminId) {
    return false;
  }

  return userId === adminId;
}

// ============================================================================
// CACHE STATS (for monitoring)
// ============================================================================

export function getAuthCacheStats() {
  return {
    size: authCache.size(),
    hitRate: 0, // TODO: Implement hit rate tracking
  };
}