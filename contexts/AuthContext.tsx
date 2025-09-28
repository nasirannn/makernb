"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth-utils';
import DailyCreditsNotification from '@/components/ui/daily-credits-notification';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  checkDailyCredits: (sessionToken?: string) => Promise<void>;
  manualCheckCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRewardNotification, setShowRewardNotification] = useState(false);
  const [rewardCredits, setRewardCredits] = useState(0);
  const [hasCheckedInitialCredits, setHasCheckedInitialCredits] = useState(false);
  const creditsCheckInProgress = useRef(false);
  const lastCreditsCheckTime = useRef(0);
  const [isUserAdmin, setIsUserAdmin] = useState<boolean | null>(null);
  const adminCheckCache = useRef<Map<string, boolean>>(new Map());

  // 定义checkDailyCredits函数
  const checkDailyCredits = async (sessionToken?: string) => {
    const token = sessionToken || session?.access_token;
    if (!token) {
      return;
    }

    // 检查是否是管理员用户，如果是则直接跳过
    if (user?.id) {
      // 检查缓存
      const cachedAdminStatus = adminCheckCache.current.get(user.id);
      if (cachedAdminStatus === true) {
        return;
      }

      // 如果没有缓存，进行检查
      if (cachedAdminStatus === undefined) {
        // 直接检查环境变量，避免依赖外部函数
        const adminId = process.env.NEXT_PUBLIC_ADMIN_ID || process.env.ADMIN_ID;
        const adminStatus = Boolean(adminId && user.id === adminId);

        // 缓存结果
        adminCheckCache.current.set(user.id, adminStatus);

        if (adminStatus) {
          return;
        }
      }
    }

    // 防止重复调用 - 检查进行中状态
    if (creditsCheckInProgress.current) {
      return;
    }

    // 防止短时间内重复调用 - 使用sessionStorage持久化
    const now = Date.now();
    const lastCheckKey = `lastCreditsCheck_${user?.id || 'unknown'}`;
    const lastCheckTime = typeof window !== 'undefined'
      ? parseInt(sessionStorage.getItem(lastCheckKey) || '0')
      : lastCreditsCheckTime.current;

    if (now - lastCheckTime < 300000) { // 5分钟 = 300000ms
      return;
    }

    creditsCheckInProgress.current = true;
    lastCreditsCheckTime.current = now;
    // 持久化时间戳
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(lastCheckKey, now.toString());
    }

    try {
      const response = await fetch('/api/daily-login-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });


      if (response.ok) {
        const data = await response.json();
        if (data.success && data.reward) {
          // 显示每日登录积分通知
          setRewardCredits(data.reward.credits_awarded);
          setShowRewardNotification(true);
        } else if (data.alreadyReceived) {
          // User already received today's credits
        } else if (data.message?.includes('Not eligible')) {
          // User not eligible for daily credits (likely admin user)
        }
      } else if (response.status === 401) {
        console.error('Authentication failed for daily credits check - token may be invalid');
        // Token可能过期，尝试刷新session
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (newSession?.access_token && newSession.access_token !== token) {
          // 用新token重试
          setTimeout(() => {
            checkDailyCredits(newSession.access_token);
          }, 500);
        }
      } else {
        console.error('Daily credits check failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error checking daily credits:', error);
    } finally {
      creditsCheckInProgress.current = false;
    }
  };

  // 手动检查积分（用于调试或重试）
  const manualCheckCredits = async () => {
    if (session?.access_token) {
      await checkDailyCredits(session.access_token);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (mounted) {
        if (error) {
          console.error('Error getting session:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // 如果用户已经登录，检查每日登录积分（使用持久化状态避免重复检查）
        if (session?.access_token && session.user?.id) {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          const checkKey = `dailyCreditsChecked_${session.user.id}_${today}`;
          const hasCheckedToday = typeof window !== 'undefined'
            ? sessionStorage.getItem(checkKey) === 'true'
            : false;

          if (!hasCheckedToday && !creditsCheckInProgress.current) {
            // 标记今天已经检查过
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(checkKey, 'true');
            }
            setHasCheckedInitialCredits(true);
            setTimeout(() => {
              checkDailyCredits(session.access_token);
            }, 1500); // 增加延迟确保token有效
          }
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_OUT') {
          // Clear any cached data
          setUser(null);
          setSession(null);
          setIsUserAdmin(null); // 重置管理员状态

          // 只在非studio页面时重定向到首页
          const currentPath = window.location.pathname;
          if (!currentPath.startsWith('/studio')) {
            router.push('/');
          }
        } else if (event === 'SIGNED_IN' && session?.access_token && session.user?.id) {
          // 重置管理员状态，让新用户重新检查
          setIsUserAdmin(null);
          // 当用户登录时，检查每日登录积分（使用持久化状态避免重复检查）
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          const checkKey = `dailyCreditsChecked_${session.user.id}_${today}`;
          const hasCheckedToday = typeof window !== 'undefined'
            ? sessionStorage.getItem(checkKey) === 'true'
            : false;

          if (!hasCheckedToday && !creditsCheckInProgress.current) {
            // 标记今天已经检查过
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(checkKey, 'true');
            }
            setHasCheckedInitialCredits(true); // 标记已检查，避免重复
            setTimeout(() => {
              checkDailyCredits(session.access_token);
            }, 2000); // 增加延迟确保登录流程完成
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          // Token刷新时不再自动检查积分，避免窗口焦点变化时的重复调用
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
    }
  };



  const value = {
    user,
    session,
    loading,
    signOut,
    checkDailyCredits,
    manualCheckCredits,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <DailyCreditsNotification
        show={showRewardNotification}
        credits={rewardCredits}
        onClose={() => setShowRewardNotification(false)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
