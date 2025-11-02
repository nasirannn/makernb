"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface CreditsContextType {
  credits: number | null;
  setCredits: (credits: number | null) => void;
  consumeCredit: (modelVersion?: string) => boolean;
  refreshCredits: () => Promise<void>;
  loading: boolean;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const isRefreshingRef = useRef(false);
  const { user, onCreditsUpdated } = useAuth();

  // 从后端获取积分余额
  const refreshCredits = useCallback(async () => {
    console.log('[CreditsContext] refreshCredits called:', { 
      isRefreshing: isRefreshingRef.current, 
      hasUser: !!user,
      userId: user?.id 
    });
    
    // 防止重复调用
    if (isRefreshingRef.current) {
      console.log('[CreditsContext] Already refreshing, skipping');
      return;
    }
    
    if (!user) {
      console.log('[CreditsContext] No user, cannot fetch credits');
      setCredits(null);
      return;
    }

    console.log('[CreditsContext] Starting credits fetch, setting loading=true');
    isRefreshingRef.current = true;
    setLoading(true);
    try {
      // 获取session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Failed to get session for credits fetch:', sessionError);
        setCredits(null);
        setLoading(false);
        isRefreshingRef.current = false;
        return;
      }

      if (!session?.access_token) {
        setCredits(null);
        setLoading(false);
        isRefreshingRef.current = false;
        return;
      }

      // 获取用户的真实积分余额
      console.log('[CreditsContext] Fetching from /api/user-credits...');
      const response = await fetch('/api/user-credits', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        cache: 'no-store', // Don't cache the request
        redirect: 'follow', // Follow redirects but limit to prevent loops
      });
      
      console.log('[CreditsContext] API response:', {
        status: response.status,
        url: response.url,
        redirected: response.redirected,
        ok: response.ok
      });
      
      if (response.ok) {
        const data = await response.json();
        const creditsValue = data.user?.credits ?? 0;
        setCredits(creditsValue);
        console.log('[CreditsContext] Credits fetched successfully:', creditsValue);
      } else if (response.status === 401) {
        console.error('Authentication failed for credits fetch - token may be invalid or expired');
        // Token可能过期，尝试刷新session并重试
        const { data: { session: newSession }, error: retryError } = await supabase.auth.getSession();
        
        if (retryError) {
          console.error('Failed to get session for retry:', retryError);
          setCredits(null);
          setLoading(false);
          isRefreshingRef.current = false;
          return;
        }
        
        if (newSession?.access_token && newSession.access_token !== session.access_token) {
          // 重置状态并重试
          isRefreshingRef.current = false;
          setLoading(false);
          // 短暂延迟后重试
          setTimeout(() => {
            refreshCredits();
          }, 500);
          return; // 提前返回，避免执行finally块
        } else {
          console.error('No new valid token available for retry');
          setCredits(null);
        }
      } else {
        console.error('Failed to fetch credits:', response.status, response.statusText);
        try {
          const errorData = await response.json();
          console.error('Error details:', errorData);
        } catch (e) {
          // 无法解析错误响应
        }
        setCredits(null);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      setCredits(null);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  }, [user]);

  // 注册积分更新回调
  useEffect(() => {
    if (onCreditsUpdated) {
      onCreditsUpdated(() => {
        console.log('[CreditsContext] Credits updated, refreshing...');
        refreshCredits();
      });
    }
  }, [onCreditsUpdated, refreshCredits]);

  // 只在用户登录时获取积分
  useEffect(() => {
    console.log('[CreditsContext] useEffect triggered:', { 
      hasUser: !!user, 
      userId: user?.id,
      credits, 
      loading, 
      isRefreshing: isRefreshingRef.current 
    });
    
    if (user) {
      // 如果积分未加载，延迟获取以确保session和每日积分都已准备好
      if (credits === null && !loading && !isRefreshingRef.current) {
        console.log('[CreditsContext] Conditions met, scheduling credits fetch for user:', user.id);
        // 添加延迟确保session完全准备好，并且等待每日积分发放
        const timer = setTimeout(() => {
          console.log('[CreditsContext] Timer fired, calling refreshCredits for user:', user.id);
          refreshCredits();
        }, 3000); // 延迟3秒，确保在checkDailyCredits(2.5秒)之后执行
        return () => {
          console.log('[CreditsContext] Cleaning up timer');
          clearTimeout(timer);
        };
      } else {
        console.log('[CreditsContext] Conditions NOT met, not fetching credits:', {
          creditsIsNull: credits === null,
          notLoading: !loading,
          notRefreshing: !isRefreshingRef.current
        });
      }
    } else {
      // 用户登出，清空积分
      console.log('[CreditsContext] No user, clearing credits');
      setCredits(null);
    }
  }, [user?.id, credits, loading, refreshCredits]);

  const consumeCredit = (modelVersion: string = 'V3_5') => {
    // 这个函数现在只用于前端检查，实际扣减在后端进行
    const { CLIENT_MUSIC_CREDITS } = require('@/lib/credits-config');
    let creditCost = CLIENT_MUSIC_CREDITS.basic; // Basic Mode 默认积分
    
    if (modelVersion.startsWith('V4')) {
      creditCost = CLIENT_MUSIC_CREDITS.custom; // Custom Mode 积分
    }
    
    // 如果积分还未加载，返回false（不允许生成）
    if (credits === null) {
      return false;
    }
    
    return credits >= creditCost;
  };

  const value = {
    credits,
    setCredits,
    consumeCredit,
    refreshCredits,
    loading,
  };

  return (
    <CreditsContext.Provider value={value}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}
