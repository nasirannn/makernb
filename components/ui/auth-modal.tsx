"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, X } from 'lucide-react';
import Image from 'next/image';
import { LoadingDots } from './loading-dots';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportOffsetTop, setViewportOffsetTop] = useState<number>(0);
  const modalContentRef = React.useRef<HTMLDivElement>(null);
  const scrollPositionRef = React.useRef<number>(0);

  // 监听视口变化（键盘弹出/收起）
  React.useEffect(() => {
    if (!isOpen) return;

    const updateViewportHeight = () => {
      if (window.visualViewport) {
        const height = window.visualViewport.height;
        const offsetTop = window.visualViewport.offsetTop || 0;
        setViewportHeight(height);
        setViewportOffsetTop(offsetTop);
      } else {
        setViewportHeight(window.innerHeight);
        setViewportOffsetTop(0);
      }
    };

    updateViewportHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
    } else {
      window.addEventListener('resize', updateViewportHeight);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
        window.visualViewport.removeEventListener('scroll', updateViewportHeight);
      } else {
        window.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, [isOpen]);

  // 阻止背景滚动并锁定位置
  React.useEffect(() => {
    if (isOpen) {
      // 保存当前滚动位置
      scrollPositionRef.current = window.scrollY;
      
      const body = document.body;
      
      // 使用 fixed 定位彻底锁定页面
      body.style.position = 'fixed';
      body.style.top = `-${scrollPositionRef.current}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
      
      return () => {
        // 恢复样式
        body.style.position = '';
        body.style.top = '';
        body.style.left = '';
        body.style.right = '';
        body.style.width = '';
        body.style.overflow = '';
        
        // 恢复滚动位置
        window.scrollTo(0, scrollPositionRef.current);
      };
    }
  }, [isOpen]);

  // 输入框获得焦点时滚动到可见区域
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    
    // 延迟执行，确保键盘已完全弹出和视口调整完成
    setTimeout(() => {
      const inputElement = e.target;
      
      // 使用 scrollIntoView 确保输入框可见
      if (inputElement) {
        inputElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }, 300);
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('请输入有效的邮箱地址');
      setLoading(false);
      return;
    }

    // 针对QQ邮箱的特殊处理
    if (email.includes('@qq.com')) {
      // QQ邮箱可能需要特殊处理，这里只是提醒
      console.log('QQ邮箱登录尝试:', email);
    }

    try {
      if (isLogin && useMagicLink) {
        // Magic Link login
        const currentPath = window.location.pathname;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`
          }
        });
        if (error) throw error;
        setMessage('Check your email for the sign-in link!');
      } else if (isLogin) {
        // Password login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      } else {
        // Sign up
        const currentPath = window.location.pathname;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`
          }
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // 提供更具体的错误信息
      if (error.message?.includes('Invalid login credentials')) {
        setMessage('邮箱或密码错误，请检查后重试。如果忘记密码，请使用"忘记密码"功能。');
      } else if (error.message?.includes('Email not confirmed')) {
        setMessage('请先检查邮箱并点击确认链接完成注册。');
      } else if (error.message?.includes('Too many requests')) {
        setMessage('登录尝试过于频繁，请稍后再试。');
      } else if (error.message?.includes('User not found')) {
        setMessage('该邮箱未注册，请先注册账户。');
      } else {
        setMessage(error instanceof Error ? error.message : '登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const currentPath = window.location.pathname;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(currentPath)}`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage('Check your email for the password reset link!');
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setEmail('');
    setPassword('');
    setIsLogin(true);
    setIsForgotPassword(false);
    setUseMagicLink(false);
    onClose();
  };

  if (!isOpen) return null;

  // 计算移动端键盘弹出时的偏移
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      {/* Backdrop - 始终覆盖整个屏幕 */}
      <div 
        className="fixed inset-0 z-[110] animate-in fade-in duration-300"
        onClick={handleClose}
        onTouchMove={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{ 
          pointerEvents: 'auto',
          touchAction: 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          height: '100vh',
          width: '100vw'
        }}
      />
      
      {/* Modal Container - 移动端固定底部，桌面端居中 */}
      <div 
        className="fixed z-[111] left-0 right-0 md:inset-0 flex items-center justify-center animate-in slide-in-from-bottom md:zoom-in-95 md:slide-in-from-bottom-4 duration-200"
        style={{
          top: isMobile ? `${viewportOffsetTop}px` : undefined,
          height: isMobile && viewportHeight ? `${viewportHeight}px` : undefined,
          alignItems: isMobile ? 'flex-end' : undefined,
          pointerEvents: 'none',
          transition: 'top 0.2s ease-out, height 0.2s ease-out'
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <div 
          ref={modalContentRef}
          className="w-full max-w-md mx-0 md:mx-4 flex flex-col"
          style={{
            maxHeight: isMobile && viewportHeight 
              ? `${viewportHeight}px` 
              : '85vh',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            transition: 'max-height 0.2s ease-out',
            pointerEvents: 'auto'
          }}
        >
          <Card className="relative bg-card border-0 shadow-2xl rounded-t-3xl md:rounded-xl rounded-b-none md:rounded-b-xl flex flex-col overflow-hidden">
          {/* Mobile Drag Handle */}
          <div className="flex md:hidden justify-center pt-2.5 pb-1.5 flex-shrink-0">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full"></div>
          </div>
          
          {/* Close Button - 桌面端显示在右上角 */}
          <button
            onClick={handleClose}
            className="hidden md:block absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground transition-colors bg-muted/50 hover:bg-muted rounded-full p-1.5"
          >
            <X className="h-5 w-5" />
          </button>

          <CardHeader className="text-center pb-1.5 px-4 pt-1.5 md:pb-4 md:px-6 md:pt-6 flex-shrink-0">
            {/* Logo */}
            <div className="flex justify-center mb-1.5 md:mb-4">
              <Image
                src="/logo.svg"
                alt="MakeRNB Logo"
                width={48}
                height={48}
                className="h-8 w-8 md:h-12 md:w-12"
              />
            </div>
            
            <CardTitle className="text-lg md:text-2xl font-bold text-foreground mb-1 md:mb-2">
              {isForgotPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account')}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs md:text-base leading-snug">
              {isForgotPassword
                ? 'Enter your email to receive a password reset link'
                : (isLogin
                  ? 'Sign in to your account to create R&B music'
                  : 'Join us to create authentic R&B tracks with AI')
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-2.5 md:space-y-5 px-4 pb-3 md:px-6 md:pb-6 overflow-y-auto flex-1"
            style={{
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              scrollPaddingTop: '20px'
            }}
          >
            {!isForgotPassword && (
              <>
                {/* Google Sign In */}
                <Button
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full h-11 md:h-12 bg-white hover:bg-white/90 text-black font-medium rounded-xl transition-all duration-200 disabled:opacity-50 text-sm md:text-base"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continue with Google
                </Button>

                {/* Divider */}
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 py-0.5 text-muted-foreground rounded-full">Or continue with email</span>
                  </div>
                </div>
              </>
            )}

            {/* Email Form */}
            <form onSubmit={isForgotPassword ? handleForgotPassword : handleEmailAuth} className="space-y-2.5 md:space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={handleInputFocus}
                  required
                  className="bg-muted/50 border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary h-11 text-base"
                />
              </div>
              
              {/* Password field - only show for password login/signup and not in forgot password mode */}
              {!isForgotPassword && !useMagicLink && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={handleInputFocus}
                    required
                    className="bg-muted/50 border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary h-11 text-base"
                  />
                </div>
              )}
              
              {/* Magic Link toggle - only show for login and not in forgot password mode */}
              {!isForgotPassword && isLogin && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="magicLink"
                    checked={useMagicLink}
                    onChange={(e) => setUseMagicLink(e.target.checked)}
                    className="rounded border-0 bg-muted/50 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="magicLink" className="text-sm text-muted-foreground cursor-pointer">
                    Send me a sign-in link instead
                  </Label>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 md:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all duration-200 disabled:opacity-50 text-sm md:text-base"
              >
                {loading ? (
                  <LoadingDots size="sm" color="white" className="mr-2" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {isForgotPassword
                  ? 'Send Reset Link'
                  : (isLogin 
                    ? (useMagicLink ? 'Send Sign-In Link' : 'Sign In')
                    : 'Create Account')
                }
              </Button>
            </form>

            {/* Message */}
            {message && (
              <div className={`text-sm text-center p-3 rounded-lg ${
                message.includes('Check your email') || message.includes('sign-in link')
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {message}
              </div>
            )}

            {/* Toggle */}
            <div className="text-center">
              {isForgotPassword ? (
                <button
                  onClick={() => setIsForgotPassword(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to sign in
                </button>
              ) : (
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </button>
              )}
            </div>

            {/* Mobile Close Button - 移动端显示在底部 */}
            <div className="md:hidden pt-1.5 flex-shrink-0">
              <Button
                onClick={handleClose}
                variant="outline"
                className="w-full h-11 bg-muted/50 hover:bg-muted text-foreground border-0 rounded-xl font-medium text-sm"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
