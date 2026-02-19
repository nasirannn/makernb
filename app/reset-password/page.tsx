"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { LoadingDots } from '@/components/ui/loading-dots';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, Lock } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    // 检查是否有有效的重置令牌
    const checkToken = async () => {
      try {
        // 监听认证状态变化
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (session && session.user)) {
            setIsValidToken(true);
            setCheckingToken(false);
          } else if (event === 'SIGNED_OUT' || !session) {
            setMessage(t('resetPasswordPage.invalidOrExpiredLink'));
            setCheckingToken(false);
          }
        });

        // 检查当前会话
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidToken(true);
        } else {
          // 如果没有会话，等待URL中的token被处理
          setTimeout(() => {
            if (!isValidToken) {
              setMessage(t('resetPasswordPage.invalidOrExpiredLink'));
              setCheckingToken(false);
            }
          }, 2000);
        }

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error('Error checking token:', error);
        setMessage(t('resetPasswordPage.genericErrorTryAgain'));
        setCheckingToken(false);
      }
    };

    checkToken();
  }, [isValidToken, t]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setMessage(t('resetPasswordPage.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setMessage(t('resetPasswordPage.passwordMinLengthError'));
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setIsSuccess(true);
      setMessage(t('resetPasswordPage.passwordUpdatedRedirecting'));
      
      // 等待2秒后跳转到首页
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : t('resetPasswordPage.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center p-4">
        <Card className="app-card app-hairline w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <LoadingDots size="lg" color="muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center p-4">
        <Card className="app-card app-hairline w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo.svg"
                alt={t('common.brandLogo')}
                width={48}
                height={48}
                className="h-12 w-12"
              />
            </div>
            <CardTitle className="text-2xl font-bold">{t('resetPasswordPage.invalidLinkTitle')}</CardTitle>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/')}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl"
            >
              {t('resetPasswordPage.returnHome')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="app-shell min-h-screen flex items-center justify-center p-4">
        <Card className="app-card app-hairline w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{t('resetPasswordPage.successTitle')}</CardTitle>
            <CardDescription>
              {t('resetPasswordPage.passwordUpdatedDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm mb-4">
              {t('resetPasswordPage.redirectingHome')}
            </p>
            <LoadingDots size="sm" color="muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen flex items-center justify-center p-4">
      <Card className="app-card app-hairline w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.svg"
              alt={t('common.brandLogo')}
              width={48}
              height={48}
              className="h-12 w-12"
            />
          </div>
          <CardTitle className="text-2xl font-bold">
            {t('resetPasswordPage.setNewPasswordTitle')}
          </CardTitle>
          <CardDescription>
            {t('resetPasswordPage.setNewPasswordDescription')}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t('resetPasswordPage.newPasswordLabel')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t('resetPasswordPage.newPasswordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('resetPasswordPage.passwordMinLengthHint')}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('resetPasswordPage.confirmPasswordLabel')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('resetPasswordPage.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {loading ? (
                <LoadingDots size="sm" color="muted" className="mr-2" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              {t('resetPasswordPage.updatePasswordAction')}
            </Button>

            {/* Message */}
            {message && (
              <div className={`text-sm text-center p-3 rounded-lg ${
                isSuccess
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {message}
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('resetPasswordPage.backToHome')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
