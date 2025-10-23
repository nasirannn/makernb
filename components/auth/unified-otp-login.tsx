"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { LoadingDots } from '@/components/ui/loading-dots';

interface UnifiedOTPLoginProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function UnifiedOTPLogin({ onSuccess, onClose }: UnifiedOTPLoginProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
      setMessage('Verification code sent!');
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });
      
      if (error) throw error;
      onSuccess?.();
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setOtp('');
    setStep('email');
    setMessage('');
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <Image
            src="/logo.svg"
            alt="MakeRNB Logo"
            width={48}
            height={48}
            className="h-12 w-12"
          />
        </div>
        
        <CardTitle className="text-2xl font-bold text-foreground mb-2">
          Welcome to MakeRNB
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Create amazing R&B tracks with the power of AI
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {step === 'email' ? (
          <form onSubmit={sendOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
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
              Continue
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-foreground">Verification code</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="h-12 text-base text-center text-lg tracking-widest"
              />
              <p className="text-sm text-muted-foreground text-center">
                Code sent to {email}
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
              Complete Login
            </Button>
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('email')}
              className="w-full h-10 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Use different email
            </Button>
          </form>
        )}

        {/* Message - 只显示错误消息 */}
        {message && !message.includes('sent') && !message.includes('Verification') && (
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
            Close
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
