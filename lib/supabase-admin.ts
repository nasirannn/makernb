import { createClient, type User } from '@supabase/supabase-js';

interface CachedValue<T> {
  value: T;
  expiresAt: number;
}

const USER_CACHE_TTL_MS = 10 * 60 * 1000;
const EMAIL_LOOKUP_TTL_MS = 5 * 60 * 1000;
const LIST_USERS_PAGE_SIZE = 200;

const userByIdCache = new Map<string, CachedValue<User | null>>();
const userIdByEmailCache = new Map<string, CachedValue<string | null>>();
const inflightUserById = new Map<string, Promise<User | null>>();
const inflightUserIdByEmail = new Map<string, Promise<string | null>>();

let hasLoggedMissingAdminConfig = false;
let supabaseAdminClient: ReturnType<typeof createClient> | null | undefined;

function getCachedValue<T>(cache: Map<string, CachedValue<T>>, key: string): T | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(cache: Map<string, CachedValue<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getSupabaseAdminClient() {
  if (supabaseAdminClient !== undefined) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    if (!hasLoggedMissingAdminConfig) {
      console.warn('[supabase-admin] Missing Supabase admin env. Admin lookups will be skipped.');
      hasLoggedMissingAdminConfig = true;
    }
    supabaseAdminClient = null;
    return supabaseAdminClient;
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
}

export async function getAuthUserById(userId: string): Promise<User | null> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return null;
  }

  const cached = getCachedValue(userByIdCache, normalizedUserId);
  if (cached !== null) {
    return cached;
  }

  const inflight = inflightUserById.get(normalizedUserId);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return null;
    }

    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(normalizedUserId);
      if (error) {
        console.warn(`[supabase-admin] Failed to fetch user ${normalizedUserId}:`, error.message);
        setCachedValue(userByIdCache, normalizedUserId, null, EMAIL_LOOKUP_TTL_MS);
        return null;
      }

      const user = data.user ?? null;
      setCachedValue(userByIdCache, normalizedUserId, user, USER_CACHE_TTL_MS);
      if (user?.email) {
        setCachedValue(userIdByEmailCache, normalizeEmail(user.email), user.id, EMAIL_LOOKUP_TTL_MS);
      }
      return user;
    } catch (error) {
      console.warn(`[supabase-admin] Unexpected error fetching user ${normalizedUserId}:`, error);
      setCachedValue(userByIdCache, normalizedUserId, null, EMAIL_LOOKUP_TTL_MS);
      return null;
    }
  })();

  inflightUserById.set(normalizedUserId, request);

  try {
    return await request;
  } finally {
    inflightUserById.delete(normalizedUserId);
  }
}

export async function getAuthUserIdByEmail(email: string): Promise<string | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const cached = getCachedValue(userIdByEmailCache, normalizedEmail);
  if (cached !== null) {
    return cached;
  }

  const inflight = inflightUserIdByEmail.get(normalizedEmail);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      return null;
    }

    try {
      let page = 1;

      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: LIST_USERS_PAGE_SIZE,
        });

        if (error) {
          console.warn(`[supabase-admin] Failed to list users while resolving ${normalizedEmail}:`, error.message);
          setCachedValue(userIdByEmailCache, normalizedEmail, null, EMAIL_LOOKUP_TTL_MS);
          return null;
        }

        const users = data.users || [];
        const matchedUser = users.find((user) => normalizeEmail(user.email || '') === normalizedEmail);

        if (matchedUser) {
          setCachedValue(userIdByEmailCache, normalizedEmail, matchedUser.id, EMAIL_LOOKUP_TTL_MS);
          setCachedValue(userByIdCache, matchedUser.id, matchedUser, USER_CACHE_TTL_MS);
          return matchedUser.id;
        }

        const nextPage = data.nextPage;
        const reachedLastPage = !nextPage || users.length === 0 || (data.lastPage ? page >= data.lastPage : false);
        if (reachedLastPage) {
          break;
        }

        page = nextPage;
      }

      setCachedValue(userIdByEmailCache, normalizedEmail, null, EMAIL_LOOKUP_TTL_MS);
      return null;
    } catch (error) {
      console.warn(`[supabase-admin] Unexpected error resolving ${normalizedEmail}:`, error);
      setCachedValue(userIdByEmailCache, normalizedEmail, null, EMAIL_LOOKUP_TTL_MS);
      return null;
    }
  })();

  inflightUserIdByEmail.set(normalizedEmail, request);

  try {
    return await request;
  } finally {
    inflightUserIdByEmail.delete(normalizedEmail);
  }
}
