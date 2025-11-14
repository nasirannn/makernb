"use client";

import React from 'react';
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles, LogOut, LogIn } from "lucide-react";
import { supabase } from '@/lib/supabase';

interface MobileStudioHeaderProps {
  user: any;
  credits: number | null;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  setIsAuthModalOpen: (open: boolean) => void;
  signOut: () => void;
}

/**
 * 移动端Studio页面头部组件
 * 包含：Logo、积分显示、用户头像和菜单
 */
export const MobileStudioHeader = React.memo(({
  user,
  credits,
  userMenuOpen,
  setUserMenuOpen,
  setIsAuthModalOpen,
  signOut,
}: MobileStudioHeaderProps) => {
  const [tierCode, setTierCode] = React.useState<'basic' | 'premium' | null>(null);

  // 获取用户订阅信息
  React.useEffect(() => {
    const fetchUserSubscription = async () => {
      if (!user) {
        setTierCode(null);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          setTierCode(null);
          return;
        }

        const response = await fetch('/api/user-subscription', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // 只有当 tierCode 不为 null 时才设置（有活跃订阅）
          setTierCode(data.tierCode || null);
        } else {
          setTierCode(null);
        }
      } catch (error) {
        console.error('Failed to fetch user subscription:', error);
        setTierCode(null);
      }
    };

    // 延迟获取，确保session已准备好
    const timer = setTimeout(() => {
      fetchUserSubscription();
    }, 1000);

    return () => clearTimeout(timer);
  }, [user?.id]);

  return (
    <div className="flex-shrink-0 px-6 py-4 bg-background/60 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="font-bold text-lg flex items-center">
          <Image
            src="/logo.svg"
            alt="MakeRNB Logo"
            width={36}
            height={36}
            className="mr-3"
          />
          MakeRNB
        </Link>
        <div className="flex items-center gap-3">
          {/* Credits Display - Only show when logged in */}
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground/10 backdrop-blur-sm rounded-lg">
              <Sparkles className="h-3.5 w-3.5 text-foreground" />
              <span className="text-sm font-medium text-foreground">
                {credits === null ? '...' : credits}
              </span>
            </div>
          )}
          {/* User Avatar */}
          {user ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <Button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-full"
              >
                <Avatar className="w-9 h-9">
                  <AvatarImage
                    src={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                    alt="User Avatar"
                  />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                    {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
              
              {/* User Menu Dropdown */}
              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-background border border-border/30 rounded-lg shadow-lg z-[60]">
                  <div className="flex flex-col gap-1 p-2">
                    <div className="px-3 py-2 border-b border-border/20 mb-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-sm font-medium text-foreground truncate flex-1">
                          {user.user_metadata?.full_name || user.email}
                        </div>
                        {tierCode && (
                          <Badge className="relative inline-block rounded-full border border-zinc-700 bg-zinc-900/20 px-2 py-0.5 text-xs text-zinc-50 animate-border-marquee flex-shrink-0">
                            <span className="text-foreground/90 font-medium capitalize">{tierCode}</span>
                            <span className="absolute bottom-0 left-1 right-1 h-[1px] bg-gradient-to-r from-zinc-500/0 via-zinc-300 to-zinc-500/0"></span>
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {user.email}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTimeout(() => {
                          setUserMenuOpen(false);
                          signOut();
                        }, 50);
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={() => setIsAuthModalOpen(true)}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground rounded-full flex items-center justify-center"
            >
              <LogIn className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

MobileStudioHeader.displayName = 'MobileStudioHeader';

