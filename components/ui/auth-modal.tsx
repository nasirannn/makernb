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
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [useMagicLink, setUseMagicLink] = useState(false);

  // 阻止背景滚动和交互
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin && useMagicLink) {
        // Magic Link login
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.href
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Check your email for the confirmation link!');
      }
    } catch (error: any) {
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.href
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

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center animate-in fade-in duration-300"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 z-[110]"
        onClick={handleClose}
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        style={{ pointerEvents: 'auto' }}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 z-[111]">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 text-white/70 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <CardHeader className="text-center pb-4">
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
            
            <CardTitle className="text-2xl font-bold text-white">
              {isForgotPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account')}
            </CardTitle>
            <CardDescription className="text-white/70">
              {isForgotPassword
                ? 'Enter your email to receive a password reset link'
                : (isLogin
                  ? 'Sign in to your account to create R&B music'
                  : 'Join us to create authentic R&B tracks with AI')
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {!isForgotPassword && (
              <>
                {/* Google Sign In */}
                <Button
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full h-12 bg-white hover:bg-white/90 text-black font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
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
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/20" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gradient-to-br from-slate-900/90 via-slate-800/80 to-slate-900/90 px-3 py-1 text-white/50 rounded-full">Or continue with email</span>
                  </div>
                </div>
              </>
            )}

            {/* Email Form */}
            <form onSubmit={isForgotPassword ? handleForgotPassword : handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-blue-500/50"
                />
              </div>
              
              {/* Password field - only show for password login/signup and not in forgot password mode */}
              {!isForgotPassword && !useMagicLink && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-white">Password</Label>
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
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-blue-500/50"
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
                    className="rounded border-white/20 bg-white/10 text-blue-500 focus:ring-blue-500/50"
                  />
                  <Label htmlFor="magicLink" className="text-sm text-white/70 cursor-pointer">
                    Send me a sign-in link instead
                  </Label>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
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
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  ← Back to sign in
                </button>
              ) : (
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-white/70 hover:text-white transition-colors"
                >
                  {isLogin 
                    ? "Don't have an account? Sign up" 
                    : "Already have an account? Sign in"
                  }
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
