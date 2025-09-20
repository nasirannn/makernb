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
    console.log('refreshCredits called, user:', user?.id, 'isRefreshing:', isRefreshing);
    
    // 防止重复调用
    if (isRefreshing) {
      console.log('refreshCredits already in progress, skipping');
      return;
    }
    
    if (!user) {
      console.log('CreditsContext - No user, not fetching credits');
      setCredits(null);
      return;
    }

    setIsRefreshing(true);
    setLoading(true);
    try {
      // 获取session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
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
        console.log('Fetched user credits:', data.user?.credits);
      } else {
        console.error('Failed to fetch credits:', response.statusText);
        setCredits(null);
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      setCredits(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user, isRefreshing]);

  // 只在用户登录时获取积分
  useEffect(() => {
    if (user && credits === null) {
      refreshCredits();
    } else if (!user) {
      setCredits(null);
    }
  }, [user?.id, credits]);

  const consumeCredit = (modelVersion: string = 'V3_5') => {
    // 这个函数现在只用于前端检查，实际扣减在后端进行
    let creditCost = 7; // V3_5 默认扣除7积分
    
    if (modelVersion.startsWith('V4')) {
      creditCost = 10; // V4、V4_5、V4_5PLUS 扣除10积分
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
