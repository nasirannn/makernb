"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface FeaturePermissionsContextType {
  permissions: Set<string>;
  hasPermission: (featureCode: string) => boolean;
  refreshPermissions: () => Promise<void>;
  loading: boolean;
}

const FeaturePermissionsContext = createContext<FeaturePermissionsContextType | undefined>(undefined);

export function FeaturePermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, onPermissionsUpdated } = useAuth();

  // 从后端获取权限列表
  const refreshPermissions = useCallback(async () => {
    
    // 防止重复调用
    if (isRefreshing) {
      return;
    }
    
    if (!user) {
      setPermissions(new Set());
      return;
    }

    setIsRefreshing(true);
    setLoading(true);
    try {
      // 获取session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Failed to get session for permissions fetch:', sessionError);
        setPermissions(new Set());
        return;
      }

      if (!session?.access_token) {
        setPermissions(new Set());
        return;
      }

      // 获取用户的权限列表
      const response = await fetch('/api/user-permissions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const features = data.features || [];
        // 将数组转换为 Set，便于快速查找
        setPermissions(new Set(features));
      } else if (response.status === 401) {
        console.error('Authentication failed for permissions fetch - token may be invalid or expired');
        // Token可能过期，尝试刷新session并重试
        const { data: { session: newSession }, error: retryError } = await supabase.auth.getSession();
        
        if (retryError) {
          console.error('Failed to get session for retry:', retryError);
          setPermissions(new Set());
          return;
        }
        
        if (newSession?.access_token && newSession.access_token !== session.access_token) {
          // 重置状态并重试
          setIsRefreshing(false);
          setLoading(false);
          // 短暂延迟后重试
          setTimeout(() => {
            refreshPermissions();
          }, 500);
          return; // 提前返回，避免执行finally块
        } else {
          console.error('No new valid token available for retry');
          setPermissions(new Set());
        }
      } else {
        console.error('Failed to fetch permissions:', response.status, response.statusText);
        try {
          const errorData = await response.json();
          console.error('Error details:', errorData);
        } catch (e) {
          // 无法解析错误响应
        }
        setPermissions(new Set());
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      setPermissions(new Set());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user]); // isRefreshing不需要在依赖数组中

  // 检查是否有某个功能的权限
  const hasPermission = useCallback((featureCode: string): boolean => {
    return permissions.has(featureCode);
  }, [permissions]);

  // 注册权限更新回调
  useEffect(() => {
    if (onPermissionsUpdated) {
      onPermissionsUpdated(() => {
        console.log('[FeaturePermissionsContext] Permissions updated, refreshing...');
        refreshPermissions();
      });
    }
  }, [onPermissionsUpdated, refreshPermissions]);

  // 只在用户登录时获取权限
  useEffect(() => {
    if (user && permissions.size === 0) {
      refreshPermissions();
      return;
    }

    if (!user) {
      setPermissions(new Set());
    }
  }, [user?.id, permissions.size, refreshPermissions]);

  const value = {
    permissions,
    hasPermission,
    refreshPermissions,
    loading,
  };

  return (
    <FeaturePermissionsContext.Provider value={value}>
      {children}
    </FeaturePermissionsContext.Provider>
  );
}

export function useFeaturePermissions() {
  const context = useContext(FeaturePermissionsContext);
  if (context === undefined) {
    throw new Error('useFeaturePermissions must be used within a FeaturePermissionsProvider');
  }
  return context;
}

