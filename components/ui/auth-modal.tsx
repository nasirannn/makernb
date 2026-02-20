"use client";

import React, { useState } from 'react';
import { createPortal } from "react-dom";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Loader2, X, ArrowLeft } from 'lucide-react';
import { LoadingDots } from '@/components/ui/loading-dots';
import { Z_INDEX_COMBINATIONS } from '@/lib/z-index';
import { Turnstile } from '@marsidev/react-turnstile';
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { withLocalePrefix } from "@/lib/i18n/routing";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { t, locale } = useI18n();
  const withCurrentLocale = React.useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleAuthLoading, setIsGoogleAuthLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const otpLength = 6;
  const otpRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const modalContentRef = React.useRef<HTMLDivElement>(null);
  const scrollPositionRef = React.useRef<number>(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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
      setMessageType(null);
      setLoading(false);
      setIsGoogleAuthLoading(false);
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

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = verificationCode.split('');
    next[index] = digit;
    const nextCode = next.join('').slice(0, otpLength);
    setVerificationCode(nextCode);
    if (digit && index < otpLength - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !verificationCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < otpLength - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpLength);
    if (!pasted) return;
    event.preventDefault();
    const next = verificationCode.split('');
    for (let i = 0; i < pasted.length && index + i < otpLength; i += 1) {
      next[index + i] = pasted[i];
    }
    const nextCode = next.join('').slice(0, otpLength);
    setVerificationCode(nextCode);
    const focusIndex = Math.min(index + pasted.length, otpLength - 1);
    otpRefs.current[focusIndex]?.focus();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType(null);

    // 检查 Turnstile 验证
    if (!captchaToken) {
      setMessage(t('authModal.completeVerification'));
      setMessageType('error');
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
      setMessage(t('authModal.checkEmailForCode'));
      setMessageType('success');
      setShowCodeInput(true);
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : t('authModal.unknownError'));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: verificationCode,
        type: 'email'
      });
      
      if (error) throw error;
      onClose();
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : t('authModal.invalidVerificationCode'));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsGoogleAuthLoading(true);
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
      setMessage(error instanceof Error ? error.message : t('authModal.unknownError'));
      setMessageType('error');
      setIsGoogleAuthLoading(false);
    }
  };


  const handleClose = () => {
    setMessage('');
    setMessageType(null);
    setEmail('');
    setShowCodeInput(false);
    setVerificationCode('');
    onClose();
  };

  if (!mounted || !isOpen) return null;

  // 计算移动端
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const turnstileTheme =
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";

  return createPortal(
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
        className={`fixed ${Z_INDEX_COMBINATIONS.AUTH_MODAL.content} inset-0 flex justify-center p-4 md:p-6`}
        style={{
          alignItems: 'center',
          pointerEvents: 'none'
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
        }}
      >
        <div 
          ref={modalContentRef}
          className="w-full max-w-md mx-0 md:mx-4 flex flex-col min-h-0 overflow-hidden"
          style={{
            maxHeight: isMobile ? 'calc(100dvh - 1.25rem)' : 'calc(100dvh - 2rem)',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            pointerEvents: 'auto'
          }}
        >
          <div className="relative overflow-hidden rounded-t-[28px] md:rounded-[28px] bg-gradient-to-br from-primary/35 via-foreground/10 to-primary/15 p-[1px] shadow-[0_30px_120px_rgba(0,0,0,0.55)] max-h-full">
            <div className="app-card relative flex flex-col overflow-hidden rounded-t-[27px] md:rounded-[27px] max-h-full min-h-0">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-75 bg-[radial-gradient(820px_520px_at_16%_8%,hsl(var(--primary)/0.22),transparent_62%)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-30 bg-[radial-gradient(720px_520px_at_84%_18%,rgba(0,198,255,0.16),transparent_60%)] dark:opacity-25"
              />

              {/* Mobile Drag Handle */}
              <div className="relative flex md:hidden justify-center pt-3 pb-2 flex-shrink-0">
                <div className="w-12 h-1 bg-foreground/20 rounded-full" />
              </div>

              {/* Close Button - 桌面端显示在右上角 */}
              <button
                onClick={handleClose}
                className="hidden md:inline-flex absolute top-4 right-4 z-10 h-9 w-9 items-center justify-center rounded-full app-card-muted text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
                aria-label={t("authModal.close")}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative px-5 pt-2 pb-4 md:px-7 md:pt-7 md:pb-5">
                <div className="flex items-center justify-center gap-2.5">
                  <Image src="/logo.svg" alt={t("common.brandLogo")} width={28} height={28} className="opacity-90" />
                  <div className="text-sm font-semibold tracking-tight text-foreground/85">
                    MakeRNB
                  </div>
                </div>

                <div className="mt-4 text-center">
                  <div className="text-[22px] md:text-[26px] font-black tracking-tight text-foreground">
                    {showCodeInput ? t("authModal.enterCodeTitle") : t("authModal.signInTitle")}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground/80">
                    {showCodeInput
                      ? t("authModal.sentCodeToEmail", { email })
                      : t("authModal.subtitle")}
                  </div>
                </div>
              </div>

              <div
                className="relative space-y-4 px-5 pb-5 md:px-7 md:pb-7 overflow-y-auto flex-1 min-h-0"
                style={{
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                  scrollPaddingTop: '20px'
                }}
              >
                <Button
                  onClick={handleGoogleAuth}
                  disabled={isGoogleAuthLoading || loading}
                  className={cn(
                    "w-full h-11 md:h-12 rounded-2xl text-sm md:text-base font-semibold",
                    "bg-white text-black hover:bg-white/90 disabled:opacity-50",
                    "shadow-[0_16px_45px_rgba(0,0,0,0.10)]"
                  )}
                >
                  {isGoogleAuthLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {t("authModal.continueWithGoogle")}
                </Button>

                <div className="relative py-1.5">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full h-px bg-foreground/10 dark:bg-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="app-card-muted rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">
                      {t("authModal.orEmail")}
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={showCodeInput ? handleVerifyCode : handleEmailAuth}
                  className="space-y-4"
                >
                  {!showCodeInput ? (
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">
                        {t("authModal.emailLabel")}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("authModal.emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={handleInputFocus}
                        required
                        className={cn(
                          "h-11 md:h-12 rounded-2xl text-base",
                          "bg-foreground/5 dark:bg-white/10 border-0",
                          "placeholder:text-foreground/35",
                          "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0"
                        )}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="code" className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">
                        {t("authModal.verificationCodeLabel")}
                      </Label>
                      <div className="flex w-full items-center justify-between gap-2">
                        {Array.from({ length: otpLength }).map((_, index) => (
                          <Input
                            key={`code-${index}`}
                            id={index === 0 ? 'code' : undefined}
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            value={verificationCode[index] || ''}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            onPaste={(e) => handleOtpPaste(index, e)}
                            onFocus={handleInputFocus}
                            ref={(el) => {
                              otpRefs.current[index] = el;
                            }}
                            aria-label={t("authModal.verificationCodeDigitAria", { index: index + 1 })}
                            className={cn(
                              "h-11 w-11 md:h-12 md:w-12 rounded-2xl text-center text-lg font-black tabular-nums",
                              "bg-foreground/5 dark:bg-white/10 border-0",
                              "focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0"
                            )}
                          />
                        ))}
                      </div>

                      <div className="flex items-center justify-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCodeInput(false);
                            setVerificationCode('');
                            setMessage('');
                            setMessageType(null);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/60 hover:text-foreground transition-colors"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          {t("authModal.changeEmail")}
                        </button>
                      </div>
                    </div>
                  )}

                  {!showCodeInput && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                    <div className="w-full flex justify-center">
                      <Turnstile
                        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                        onSuccess={(token) => {
                          setCaptchaToken(token);
                        }}
                        options={{
                          size: 'flexible',
                          theme: turnstileTheme,
                          language: locale === "zh-CN" ? "zh-CN" : "en"
                        }}
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={
                      (loading || isGoogleAuthLoading) ||
                      (!showCodeInput && !canSendCode) ||
                      (showCodeInput && verificationCode.length !== otpLength)
                    }
                    className={cn(
                      "w-full h-11 md:h-12 rounded-2xl text-sm md:text-base font-semibold",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      "shadow-[0_18px_55px_hsl(var(--primary)/0.22)]",
                      "disabled:opacity-50"
                    )}
                  >
                    {loading && !isGoogleAuthLoading ? (
                      <LoadingDots size="sm" color="white" className="mr-2" />
                    ) : null}
                    {showCodeInput ? t("authModal.verifyCodeAction") : t("authModal.sendCodeAction")}
                  </Button>
                </form>

                {message && messageType === "error" && (
                  <div className="app-card-muted text-sm text-center px-4 py-3 rounded-2xl text-red-200/90">
                    {message}
                  </div>
                )}

                <div className="text-center">
                  <p className="text-sm leading-relaxed text-muted-foreground/80">
                    {t("authModal.termsAgreementPrefix")}{" "}
                    <a href={withCurrentLocale("/terms")} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {t("authModal.termsLink")}
                    </a>{" "}
                    {t("authModal.termsAgreementBetween")}{" "}
                    <a href={withCurrentLocale("/privacy")} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                      {t("authModal.privacyPolicyLink")}
                    </a>
                    {t("authModal.termsAgreementSuffix")}
                  </p>
                </div>

                <div className="md:hidden pt-1.5 flex-shrink-0">
                  <Button
                    onClick={handleClose}
                    variant="ghost"
                    className="w-full h-11 rounded-2xl text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                  >
                    {t("authModal.notNow")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  , document.body);
}
