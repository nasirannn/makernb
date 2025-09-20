"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
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

  // 定义checkDailyCredits函数
  const checkDailyCredits = async (sessionToken?: string) => {
    const token = sessionToken || session?.access_token;
    if (!token) {
      console.log('No token available for daily credits check');
      return;
    }

    try {
      console.log('Checking daily credits with token...');
      const response = await fetch('/api/daily-login-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Daily credits API response:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Daily credits response data:', data);
        if (data.success && data.reward) {
          console.log('Daily login credits granted:', data.reward);
          // 显示每日登录积分通知
          setRewardCredits(data.reward.credits_awarded);
          setShowRewardNotification(true);
        } else if (data.alreadyReceived) {
          console.log('User already received today\'s credits');
        } else if (data.message?.includes('Not eligible')) {
          console.log('User not eligible for daily credits (likely admin user)');
        }
      } else if (response.status === 401) {
        console.error('Authentication failed for daily credits check - token may be invalid');
        // Token可能过期，尝试刷新session
        const { data: { session: newSession } } = await supabase.auth.getSession();
        if (newSession?.access_token && newSession.access_token !== token) {
          console.log('Retrying with refreshed token...');
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
    }
  };

  // 手动检查积分（用于调试或重试）
  const manualCheckCredits = async () => {
    console.log('Manual daily credits check triggered');
    if (session?.access_token) {
      await checkDailyCredits(session.access_token);
    } else {
      console.log('No session available for manual check');
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

        // 如果用户已经登录，检查每日登录积分（只在初始加载时检查一次）
        if (session?.access_token && !hasCheckedInitialCredits) {
          console.log('Initial session found, checking daily credits...');
          setHasCheckedInitialCredits(true);
          setTimeout(() => {
            checkDailyCredits(session.access_token);
          }, 1500); // 增加延迟确保token有效
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email);

      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_OUT') {
          // Clear any cached data
          setUser(null);
          setSession(null);
          router.push('/');
        } else if (event === 'SIGNED_IN' && session?.access_token) {
          // 当用户登录时，检查每日登录积分（只在真正的登录事件时检查）
          console.log('User signed in, checking daily credits...');
          setHasCheckedInitialCredits(true); // 标记已检查，避免重复
          setTimeout(() => {
            checkDailyCredits(session.access_token);
          }, 2000); // 增加延迟确保登录流程完成
        } else if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          // Token刷新后，如果还没检查过积分，则检查一次
          if (!hasCheckedInitialCredits) {
            console.log('Token refreshed, checking daily credits...');
            setHasCheckedInitialCredits(true);
            setTimeout(() => {
              checkDailyCredits(session.access_token);
            }, 1000);
          }
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
