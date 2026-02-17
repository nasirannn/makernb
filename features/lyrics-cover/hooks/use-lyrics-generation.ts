import React, { useState, useEffect, useRef } from "react";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const useLyricsGeneration = () => {
  const maxLyricsPromptLength = 200;
  const failureTitle = React.createElement(
    "span",
    { className: "inline-flex items-center gap-2" },
    "⚠️ ",
    "Lyrics generation failed"
  );
  // Lyrics Generation States
  const [showLyricsDialog, setShowLyricsDialog] = useState(false);
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);



  // 清理函数
  const cleanupResources = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current as unknown as number);
      pollingRef.current = null;
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const handleGenerateLyrics = async (setCustomPrompt: (value: string) => void, _userId: string) => {
    if (!lyricsPrompt.trim()) {
      toast("Please enter a prompt for lyrics generation", {
        description: "Describe what kind of lyrics you want to generate."
      });
      return;
    }
    if (lyricsPrompt.length > maxLyricsPromptLength) {
      toast("Prompt is too long", {
        description: `Please keep it within ${maxLyricsPromptLength} characters.`
      });
      return;
    }

    // 检查积分（1积分）
    const creditsResponse = await fetch('/api/user-credits');
    if (creditsResponse.ok) {
      const creditsData = await creditsResponse.json();
      const userCredits = creditsData.user?.credits || 0;
      const { CLIENT_FEATURE_CREDITS } = await import('@/lib/credits-config');
      const lyricsCreditCost = CLIENT_FEATURE_CREDITS.generate_lyrics.credits;
      if (userCredits < lyricsCreditCost) {
        toast("Insufficient credits for lyrics generation", {
          description: `You need ${lyricsCreditCost} credits to generate lyrics. Purchase more credits or wait for daily bonus.`
        });
        return;
      }
    }

    setIsGeneratingLyrics(true);

    try {
      // 获取Supabase session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get session. Please try logging in again.');
      }

      if (!session?.access_token) {
        console.error('No valid session found');
        throw new Error('Please log in to generate lyrics.');
      }

      // 调用歌词生成API - 使用统一的身份验证方式
      const response = await fetch('/api/lyrics/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: lyricsPrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // 如果是 401 错误，提示用户重新登录
        if (response.status === 401) {
          throw new Error('Your session has expired. Please log in again.');
        }

        throw new Error(errorData.error || 'Lyrics generation failed');
      }

      const result = await response.json();

      if (result.success) {
        if (result.data?.taskId) {

          // 轮询查询歌词状态，填充到 textarea
          const taskId = result.data.taskId as string;

          // 清理已有轮询避免重复
          cleanupResources();

          pollingRef.current = setInterval(async () => {
            try {
              const res = await fetch(`/api/lyrics/status/${encodeURIComponent(taskId)}`);
              if (!res.ok) return; // 忽略非200
              const statusPayload = await res.json();
              if (!statusPayload?.success) return;
              const { status, content, lyrics } = statusPayload.data || {};

              if (status === 'complete') {
                // 写入到对话框 textarea
                let nextLyrics = '';
                if (Array.isArray(lyrics) && lyrics.length > 0) {
                  const first = lyrics[0];
                  nextLyrics = typeof first?.text === 'string' ? first.text : '';
                } else if (typeof content === 'string') {
                  nextLyrics = content;
                }
                if (nextLyrics.trim().length > 0) {
                  setLyricsPrompt(nextLyrics);
                  setCustomPrompt(nextLyrics);
                }
                setIsGeneratingLyrics(false);
                cleanupResources();
                // 生成完成后关闭弹窗
                setShowLyricsDialog(false);
              } else if (status === 'error') {
                setIsGeneratingLyrics(false);
                cleanupResources();
                // 显示错误信息
                toast(failureTitle, {
                  description: 'This may be due to sensitive content in your prompt. Please try with different wording.',
                });
              }
            } catch (e) {
              // 网络错误时保持轮询，等待下一次
            }
          }, 2000);
        } else if (result.data?.generationFailed) {
          // 没有taskId，说明生成失败（可能包含敏感词等）
          setIsGeneratingLyrics(false);

          // 显示友好的错误信息
          const errorMessage = result.data?.errorMessage || 'Lyrics generation failed - may contain sensitive content';
          toast(failureTitle, {
            description: `${errorMessage}. No credits were consumed.`,
          });
        } else {
          throw new Error('Failed to start lyrics generation');
        }
      } else {
        throw new Error('Failed to start lyrics generation');
      }

    } catch (error) {
      console.error("Lyrics generation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Lyrics generation failed, please try again";
      toast(failureTitle, {
        description: errorMessage,
      });
      setIsGeneratingLyrics(false);
    }
  };

  return {
    // States
    showLyricsDialog, setShowLyricsDialog,
    lyricsPrompt, setLyricsPrompt,
    isGeneratingLyrics, setIsGeneratingLyrics,
    
    // Functions
    handleGenerateLyrics,
  };
};
