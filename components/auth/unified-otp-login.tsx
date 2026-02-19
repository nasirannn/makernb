"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { LoadingDots } from '@/components/ui/loading-dots';
import { useI18n } from '@/lib/i18n/provider';

interface UnifiedOTPLoginProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function UnifiedOTPLogin({ onSuccess, onClose }: UnifiedOTPLoginProps) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const otpLength = 6;
  const otpRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  // 邮箱格式验证
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 检查是否可以发送验证码
  const canSendCode = email.trim() !== '' && isValidEmail(email);

  const sendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      // 统一的 OTP 登录（登录即注册）
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (error) throw error;
      setStep('otp');
      setMessage(t('otpLogin.verificationCodeSent'));
      setMessageType('success');
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : t('otpLogin.failedToSendCode'));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMessageType(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });
      
      if (error) throw error;
      onSuccess?.();
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : t('otpLogin.invalidVerificationCode'));
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = otp.split('');
    next[index] = digit;
    const nextOtp = next.join('').slice(0, otpLength);
    setOtp(nextOtp);
    if (digit && index < otpLength - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
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
    const next = otp.split('');
    for (let i = 0; i < pasted.length && index + i < otpLength; i += 1) {
      next[index + i] = pasted[i];
    }
    const nextOtp = next.join('').slice(0, otpLength);
    setOtp(nextOtp);
    const focusIndex = Math.min(index + pasted.length, otpLength - 1);
    otpRefs.current[focusIndex]?.focus();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.svg"
            alt={t('common.brandLogo')}
            width={48}
            height={48}
            className="h-12 w-12"
          />
        </div>
        
        <CardTitle className="text-2xl font-bold text-foreground mb-2">
          {t('otpLogin.welcomeTitle')}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t('otpLogin.welcomeDescription')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {step === 'email' ? (
          <form onSubmit={sendOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">{t('otpLogin.emailAddressLabel')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('otpLogin.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 text-base"
              />
            </div>
            
            <Button
              type="submit"
              disabled={loading || !canSendCode}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {loading ? (
                <LoadingDots size="sm" color="white" className="mr-2" />
              ) : null}
              {t('otpLogin.continueAction')}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-foreground">{t('otpLogin.verificationCodeLabel')}</Label>
              <div className="flex w-full items-center justify-between gap-2">
                {Array.from({ length: otpLength }).map((_, index) => (
                  <Input
                    key={`otp-${index}`}
                    id={index === 0 ? 'otp' : undefined}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    value={otp[index] || ''}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={(e) => handleOtpPaste(index, e)}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    aria-label={t('otpLogin.verificationCodeDigitAria', { index: index + 1 })}
                    className="h-12 w-12 text-center text-lg font-semibold tracking-widest"
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {t('otpLogin.codeSentTo', { email })}
              </p>
            </div>
            
            <Button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-medium"
            >
              {loading ? (
                <LoadingDots size="sm" color="white" className="mr-2" />
              ) : null}
              {t('otpLogin.completeLogin')}
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('email')}
              className="w-full h-10 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('otpLogin.useDifferentEmail')}
            </Button>
          </form>
        )}

        {/* Message - 只显示错误消息 */}
        {message && messageType === 'error' && (
          <div className="text-sm text-center p-3 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30">
            {message}
          </div>
        )}

        {/* Close button */}
        {onClose && (
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full h-10 text-muted-foreground hover:text-foreground"
          >
            {t('otpLogin.close')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
