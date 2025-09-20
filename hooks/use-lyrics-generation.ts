import { useState, useEffect, useRef } from "react";
import { supabase } from '@/lib/supabase';

export const useLyricsGeneration = () => {
  // Lyrics Generation States
  const [showLyricsDialog, setShowLyricsDialog] = useState(false);
  const [lyricsPrompt, setLyricsPrompt] = useState("");
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);



  // 清理函数（SSE移除后暂无需要清理的资源）
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

  const handleGenerateLyrics = async (setCustomPrompt: (value: string) => void, userId: string) => {
    if (!lyricsPrompt.trim()) {
      alert("Please enter a prompt for lyrics generation");
      return;
    }

    // 检查积分（1积分）
    const creditsResponse = await fetch('/api/user-credits');
    if (creditsResponse.ok) {
      const creditsData = await creditsResponse.json();
      const userCredits = creditsData.user?.credits || 0;
      if (userCredits < 1) {
        alert("Insufficient credits! Lyrics generation requires 1 credit.");
        return;
      }
    }

    setIsGeneratingLyrics(true);

    try {
      console.log('Starting AI lyrics generation with prompt:', lyricsPrompt);

      // 获取Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // 调用歌词生成API - 使用统一的身份验证方式
      const response = await fetch('/api/generate-lyrics', {
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
        throw new Error(errorData.error || 'Lyrics generation failed');
      }

      const result = await response.json();
      console.log('Lyrics API result:', result);

      if (result.success) {
        if (result.data?.taskId) {
          console.log('Lyrics generation started, taskId:', result.data.taskId);

          // 轮询查询歌词状态，填充到 textarea
          const taskId = result.data.taskId as string;
          console.log('Lyrics generation started (taskId):', taskId);

          // 清理已有轮询避免重复
          cleanupResources();

          pollingRef.current = setInterval(async () => {
            try {
              const res = await fetch(`/api/lyrics-status/${encodeURIComponent(taskId)}`);
              if (!res.ok) return; // 忽略非200
              const statusPayload = await res.json();
              if (!statusPayload?.success) return;
              const { status, content } = statusPayload.data || {};

              if (status === 'complete') {
                // 写入到对话框 textarea
                if (typeof content === 'string' && content.trim().length > 0) {
                  setLyricsPrompt(content);
                  setCustomPrompt(content);
                }
                setIsGeneratingLyrics(false);
                cleanupResources();
                // 生成完成后关闭弹窗
                setShowLyricsDialog(false);
              } else if (status === 'error') {
                setIsGeneratingLyrics(false);
                cleanupResources();
                // 显示错误信息
                alert('Lyrics generation failed. This may be due to sensitive content in your prompt.');
              }
            } catch (e) {
              // 网络错误时保持轮询，等待下一次
            }
          }, 2000);
        } else if (result.data?.generationFailed) {
          // 没有taskId，说明生成失败（可能包含敏感词等）
          console.log('Lyrics generation failed - no taskId received');
          setIsGeneratingLyrics(false);

          // 显示友好的错误信息
          const errorMessage = result.data?.errorMessage || 'Lyrics generation failed - may contain sensitive content';
          alert(`Lyrics generation failed: ${errorMessage}\n\nNo credits were consumed.`);
        } else {
          throw new Error('Failed to start lyrics generation');
        }
      } else {
        throw new Error('Failed to start lyrics generation');
      }

    } catch (error) {
      console.error("Lyrics generation failed:", error);
      alert(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : "Lyrics generation failed, please try again");
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
