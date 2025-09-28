import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * 从请求中提取并验证用户身份
 * @param request NextRequest对象
 * @returns 用户ID，如果验证失败则返回null
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // 从请求头获取Authorization token
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header found');
      return null;
    }

    const token = authHeader.split(' ')[1];

    // 验证token并获取用户信息
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log('Invalid token or user not found:', authError);
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('Error extracting user ID from request:', error);
    return null;
  }
}

/**
 * 检查请求是否包含有效的用户身份验证
 * @param request NextRequest对象
 * @returns 是否验证成功
 */
export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const userId = await getUserIdFromRequest(request);
  return userId !== null;
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
