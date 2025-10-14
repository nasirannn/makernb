"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();

  // 从后端获取积分余额
  const refreshCredits = useCallback(async () => {
    
    // 防止重复调用
    if (isRefreshing) {
      console.log('Credits refresh already in progress, skipping...');
      return;
    }
    
    if (!user) {
      setCredits(null);
      return;
    }

    setIsRefreshing(true);
    setLoading(true);
    try {
      // 获取session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Failed to get session for credits fetch:', sessionError);
        setCredits(null);
        return;
      }

      if (!session?.access_token) {
        console.log('No valid session token available for credits fetch');
        setCredits(null);
        return;
      }

      // 获取用户的真实积分余额
      const response = await fetch('/api/user-credits', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCredits(data.user?.credits || 0);
      } else if (response.status === 401) {
        console.error('Authentication failed for credits fetch - token may be invalid or expired');
        // Token可能过期，尝试刷新session并重试
        const { data: { session: newSession }, error: retryError } = await supabase.auth.getSession();
        
        if (retryError) {
          console.error('Failed to get session for retry:', retryError);
          setCredits(null);
          return;
        }
        
        if (newSession?.access_token && newSession.access_token !== session.access_token) {
          console.log('Retrying credits fetch with refreshed token...');
          // 重置状态并重试
          setIsRefreshing(false);
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
      setIsRefreshing(false);
    }
  }, [user]); // isRefreshing不需要在依赖数组中

  // 只在用户登录时获取积分
  useEffect(() => {
    if (user && credits === null) {
      // 添加延迟确保session完全准备好
      const timer = setTimeout(() => {
        refreshCredits();
      }, 1000);
      return () => clearTimeout(timer);
    } else if (!user) {
      setCredits(null);
    }
  }, [user?.id, credits]); // eslint-disable-line react-hooks/exhaustive-deps

  const consumeCredit = (modelVersion: string = 'V3_5') => {
    // 这个函数现在只用于前端检查，实际扣减在后端进行
    let creditCost = parseInt(process.env.NEXT_PUBLIC_BASIC_MODE_CREDITS || '7'); // Basic Mode 默认积分
    
    if (modelVersion.startsWith('V4')) {
      creditCost = parseInt(process.env.NEXT_PUBLIC_CUSTOM_MODE_CREDITS || '12'); // Custom Mode 积分
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
