"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, X, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { LoadingDots } from '@/components/ui/loading-dots';
import { Z_INDEX_COMBINATIONS } from '@/lib/z-index';
import { Turnstile } from '@marsidev/react-turnstile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const modalContentRef = React.useRef<HTMLDivElement>(null);
  const scrollPositionRef = React.useRef<number>(0);

  // 邮箱格式验证
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 检查是否可以发送验证码
  const canSendCode = email.trim() !== '' && isValidEmail(email) && captchaToken !== undefined;

  // 当模态框打开时重置状态
  React.useEffect(() => {
    if (isOpen) {
      setEmail('');
      setVerificationCode('');
      setShowCodeInput(false);
      setMessage('');
      setLoading(false);
      setCaptchaToken(undefined);
    }
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

    // 检查 Turnstile 验证
    if (!captchaToken) {
      setMessage('Please complete the verification');
      setLoading(false);
      return;
    }

    try {
      // 统一的 OTP 登录（登录即注册）
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          captchaToken: captchaToken
        }
      });
      if (error) throw error;
      setMessage('Check your email for the verification code!');
      setShowCodeInput(true);
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: verificationCode,
        type: 'email'
      });
      
      if (error) throw error;
      onClose();
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Invalid verification code');
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


  const handleClose = () => {
    setMessage('');
    setEmail('');
    setShowCodeInput(false);
    setVerificationCode('');
    onClose();
  };

  if (!isOpen) return null;

  // 计算移动端
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      {/* Backdrop - 始终覆盖整个屏幕 */}
      <div 
        className={`fixed inset-0 ${Z_INDEX_COMBINATIONS.AUTH_MODAL.backdrop} animate-in fade-in duration-300`}
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
        className={`fixed ${Z_INDEX_COMBINATIONS.AUTH_MODAL.content} left-0 right-0 top-0 bottom-0 flex items-center justify-center animate-in slide-in-from-bottom md:zoom-in-95 md:slide-in-from-bottom-4 duration-200`}
        style={{
          alignItems: isMobile ? 'flex-end' : 'center',
          pointerEvents: 'none'
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <div 
          ref={modalContentRef}
          className="w-full max-w-md mx-0 md:mx-4 flex flex-col"
          style={{
            maxHeight: isMobile ? '90vh' : '85vh',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
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
              {showCodeInput ? 'Enter Verification Code' : 'Welcome to MakeRNB'}
            </CardTitle>
            
            <CardDescription className="text-sm text-muted-foreground">
              Create amazing R&B tracks with the power of AI
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-2.5 md:space-y-5 px-4 pb-3 md:px-6 md:pb-6 overflow-y-auto flex-1"
            style={{
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              scrollPaddingTop: '20px'
            }}
          >
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
                <span className="bg-card px-3 py-0.5 text-muted-foreground rounded-full">Or continue with</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={showCodeInput ? handleVerifyCode : handleEmailAuth} className="space-y-2.5 md:space-y-4">
              {!showCodeInput ? (
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
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-foreground text-sm">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onFocus={handleInputFocus}
                    required
                    maxLength={6}
                    className="bg-muted/50 border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary h-11 text-base text-center text-lg tracking-widest"
                  />
                </div>
              )}

              {/* 验证码发送提示 */}
              {showCodeInput && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Code sent to {email}
                  </p>
                </div>
              )}

              {/* Turnstile 验证组件 - 只在邮箱输入步骤显示 */}
              {!showCodeInput && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <div className="w-full flex justify-center">
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                    onSuccess={(token) => {
                      setCaptchaToken(token);
                    }}
                    options={{
                      size: 'flexible',
                      theme: 'light',
                      language: 'en'
                    }}
                  />
                </div>
              )}
              
              <Button
                type="submit"
                disabled={loading || (!showCodeInput && !canSendCode)}
                className="w-full h-11 md:h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all duration-200 disabled:opacity-50 text-sm md:text-base"
              >
                {loading ? (
                  <LoadingDots size="sm" color="white" className="mr-2" />
                ) : null}
                {showCodeInput
                  ? 'Verify Code'
                  : 'Send Verification Code'
                }
              </Button>
              
              {/* Back button for code input */}
              {showCodeInput && (
                <div className="text-center">
                  <span
                    onClick={() => {
                      setShowCodeInput(false);
                      setVerificationCode('');
                      setMessage('');
                    }}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer inline-flex items-center"
                  >
                    <ArrowLeft className="mr-1 h-3 w-3" />
                    Back to Email
                  </span>
                </div>
              )}
            </form>

            {/* Message - 只显示错误消息 */}
            {message && !message.includes('Check your email') && !message.includes('verification code') && (
              <div className="text-sm text-center p-3 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30">
                {message}
              </div>
            )}

            {/* Terms and Privacy Policy */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                By signing in, you agree to our{' '}
                <a href="/terms" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href="/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>
              </p>
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
