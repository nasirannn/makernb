import { useState, useEffect, useRef } from "react";
import { supabase } from '@/lib/supabase';
import { DEV_MOCK_ENABLED, createDevMockGeneration, getDevMockGeneration } from '@/lib/dev-mock';

export const useMusicGeneration = () => {
  // Music Configuration States
  const [mode, setMode] = useState<"basic" | "custom">("basic");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [instrumentalMode, setInstrumentalMode] = useState(false);
  const [keepPrivate, setKeepPrivate] = useState(false);

  // Advanced Music Options
  const [bpm, setBpm] = useState([60]);
  const [grooveType, setGrooveType] = useState("");
  const [leadInstrument, setLeadInstrument] = useState<string[]>([]);
  const [drumKit, setDrumKit] = useState("");
  const [bassTone, setBassTone] = useState("");
  const [vocalStyle, setVocalStyle] = useState("");
  const [vocalGender, setVocalGender] = useState("male");
  const [harmonyPalette, setHarmonyPalette] = useState("");

  // Generation States
  const [isGenerating, setIsGenerating] = useState(false);
  const [allGeneratedTracks, setAllGeneratedTracks] = useState<any[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  // 生成计时器相关状态
  const [generationTimer, setGenerationTimer] = useState(0);
  // 生成计时器的ref
  const generationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 轮询相关
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingDelayRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoplayedRef = useRef(false);

  const currentPollingMsRef = useRef<number>(1000);

  // 当前播放器源控制
  const currentAudioSrcRef = useRef<string>('');
  // 标记是否已经自动播放过，避免重复设置
  const hasAutoPlayedRef = useRef<boolean>(false);
  
  // 将hasAutoPlayedRef暴露到全局，供其他组件使用
  if (typeof window !== 'undefined') {
    (window as any).hasAutoPlayedRef = hasAutoPlayedRef;
  }


  // 实时更新生成中tracks的时长显示
  useEffect(() => {
    if (isGenerating && generationTimer > 0) {
      setAllGeneratedTracks((prevTracks: any[]) => {
        return prevTracks.map(track => {
          if (track.isGenerating) {
            return {
              ...track,
              duration: generationTimer
            };
          }
          return track;
        });
      });
    }
  }, [generationTimer, isGenerating]);

  // 清理函数（仅清理计时器与轮询，已移除所有 SSE 相关逻辑）
  const cleanupResources = () => {
    // 清理生成计时器
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
      generationTimerRef.current = null;
    }
    // 清理轮询
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    // 清理轮询延迟
    if (pollingDelayRef.current) {
      clearTimeout(pollingDelayRef.current);
      pollingDelayRef.current = null;
    }
  };
  // 启动轮询：根据taskId每秒拉取一次状态快照
  const startPollingStatus = (taskId: string, setIsPlaying?: (playing: boolean) => void) => {
    // 清理旧的轮询和延迟
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingDelayRef.current) {
      clearTimeout(pollingDelayRef.current);
      pollingDelayRef.current = null;
    }
    hasAutoplayedRef.current = false;
    hasAutoPlayedRef.current = false;
    const poll = async () => {
      try {
        let payload;

        if (DEV_MOCK_ENABLED) {
          // 开发模式：使用 mock 数据
          const mockGeneration = getDevMockGeneration(taskId);
          if (mockGeneration) {
            payload = mockGeneration.getStatus();
          } else {
            return; // mock 实例不存在
          }
        } else {
          // 生产模式：调用真实 API
          const res = await fetch(`/api/music-status?taskId=${taskId}`);
          if (!res.ok) return;
          payload = await res.json();
        }

        // 处理API返回码 - 正常情况下taskId对应的记录应该存在
        if (payload.code !== 200) {
          // 非200状态码，可能是数据库写入失败等异常情况
          console.warn('Music status API returned non-200 code:', payload.code, payload.msg);

          // 对于202（任务未找到），继续轮询一段时间，可能是数据库写入延迟
          if (payload.code === 202) {
            return; // 继续轮询
          }

          // 其他错误码，停止轮询
          console.error('Stopping polling due to API error');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          setIsGenerating(false);
          setPendingTasksCount(0);

          // 显示错误track
          const failedTrack = {
            id: `failed-${Date.now()}`,
            title: customPrompt || 'Unknown', // 使用用户输入的prompt作为title
            audioUrl: null,
            coverImage: null,
            duration: 0,
            isLoading: false,
            isError: true,
            errorMessage: payload.msg || 'System error occurred',
            originalPrompt: customPrompt,
            genre: mode === 'basic' ? 'R&B' : selectedGenre,
            style: mode === 'basic' ? 'R&B' : selectedGenre,
            mood: selectedMood || '',
            tags: mode === 'basic' ? 'R&B' : `${selectedGenre}, ${selectedVibe}`,
            lyrics: ''
          };

          setAllGeneratedTracks(prev => [failedTrack, ...prev]);
          return;
        }

        const data = payload.data;
        const status = data.status as 'generating' | 'text' | 'first' | 'complete' | 'error';
        const tracks = (data.tracks || []) as any[];
        const errorInfo = data.errorInfo;

        if (tracks.length > 0) {
          // 检查text回调是否完成（通过status字段）
          const isTextCallbackComplete = status === 'text' || status === 'first' || status === 'complete';
          
          if (isTextCallbackComplete) {
            // text回调完成，替换skeleton并显示文本内容
            const tracksInfo = tracks.map((t: any, index: number) => {
              const audioUrl = t.audioUrl || '';
              const streamAudioUrl = t.streamAudioUrl || '';
              const hasFinalForThisTrack = !!audioUrl && !!t.duration && t.duration > 0; // first回调落库后，该曲目可视为就绪
              const hasStreamAudio = !!streamAudioUrl; // text回调完成后有流式音频
              
              // 根据每首歌的完成状态确定loading状态
              let isLoading = true; // 默认loading
              let isGenerating = true; // 默认生成中

              if (hasFinalForThisTrack) {
                // 如果这首歌有final audio（first回调完成），就不loading
                isLoading = false;
                isGenerating = false;
              } else if (status === 'complete') {
                // 如果全部完成，也不loading
                isLoading = false;
                isGenerating = false;
              } else if (hasStreamAudio) {
                // 如果有stream audio（text回调完成），仍然loading，但可以显示文本内容
                isLoading = true; // 保持loading状态，显示三个圆点遮罩
                isGenerating = true; // 仍在生成final audio
              }
              
              return {
                finalAudioUrl: audioUrl, // 最终音频URL（first/complete回调后才有）
                streamAudioUrl: streamAudioUrl, // 流式音频URL（text回调后就有）
                audioUrl: hasFinalForThisTrack ? audioUrl : streamAudioUrl, // 当前应该播放的URL（保持向后兼容）
                isUsingStreamAudio: !hasFinalForThisTrack && hasStreamAudio, // 是否在使用流式音频
                title: t.title,
                duration: hasFinalForThisTrack ? t.duration : null,
                genre: t.genre,
                vibe: mode === 'basic' ? 'polished' : selectedVibe,
                coverImage: t.coverImage || null,
                sideLetter: t.sideLetter, // 添加sideLetter字段
                style: t.tags, // 添加style字段，使用tags作为style
                lyrics: t.lyrics || '',
                isStreaming: hasStreamAudio && !hasFinalForThisTrack, // 有stream audio但没有final audio时标记为streaming
                isGenerating: isGenerating,
                isLoading: isLoading,
              };
            });

            // 替换 skeleton
            setAllGeneratedTracks(tracksInfo);
            setPendingTasksCount(0);
            
            // 检查是否需要自动播放（当skeleton被替换后，即text回调完成后）
            const sideATrack = tracksInfo[0];
            const hasStreamUrl = sideATrack && (sideATrack.audioUrl || sideATrack.streamAudioUrl);
            
            // 检查播放器是否正在播放歌曲
            const audioElement = document.querySelector('audio') as HTMLAudioElement;
            const isCurrentlyPlaying = audioElement && !audioElement.paused && !audioElement.ended;
            
            // 当skeleton被替换后（text回调完成）且有音频URL时自动播放
            // 如果播放器正在播放歌曲，则不自动播放新生成的歌曲
            if (!hasAutoplayedRef.current && hasStreamUrl && !isCurrentlyPlaying) {
              hasAutoplayedRef.current = true;
              hasAutoPlayedRef.current = true; // 标记已经自动播放过
              setActiveTrackIndex(0); // 播放 side A
              // 同时设置selectedLibraryTrack以便歌词正确显示
              if (typeof window !== 'undefined') {
                // 通过事件通知父组件设置selectedLibraryTrack
                window.dispatchEvent(new CustomEvent('setSelectedLibraryTrack', { 
                  detail: 'generated-0' 
                }));
              }
              setTimeout(() => {
                if (audioElement && hasStreamUrl) {
                  // 优先使用audioUrl，没有的话再使用streamAudioUrl
                  const playUrl = sideATrack.audioUrl || sideATrack.streamAudioUrl;
                  
                  // 为流式音频优化设置
                  audioElement.preload = 'none';
                  audioElement.src = playUrl;
                  currentAudioSrcRef.current = playUrl;
                  audioElement.load();
                  
                  // 添加错误处理
                  const handleError = (error: any) => {
                    console.error('Stream audio play error:', error);
                    if (setIsPlaying) setIsPlaying(false);
                  };
                  
                  audioElement.addEventListener('error', handleError, { once: true });
                  
                  audioElement.play().then(() => {
                    if (setIsPlaying) setIsPlaying(true);
                  }).catch(handleError);
                }
              }, 500);
            }
          } else {
            // text回调未完成，保持skeleton状态，不替换
            console.log('Text callback not complete yet, keeping skeleton state');
          }

          // 移除平滑切换逻辑，避免在播放过程中被其他歌曲的final audio打断

          // 如果已开始播放或进入 text/first 阶段，降频到 ~3s
          if ((status === 'text' || status === 'first' || hasAutoplayedRef.current) && currentPollingMsRef.current !== 3000) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
            }
            currentPollingMsRef.current = 3000;
            pollingRef.current = setInterval(poll, currentPollingMsRef.current);
          }

        }

        // 处理first回调 - 第一首歌完成时更新状态
        if (status === 'first') {
          // first回调：第一首歌有最终音频，更新对应track的loading状态
          setAllGeneratedTracks(prev => prev.map((t, idx) => {
            const correspondingTrack = tracks[idx];
            if (correspondingTrack && correspondingTrack.audioUrl && correspondingTrack.duration) {
              return {
                ...t,
                isLoading: false,
                isGenerating: false,
                finalAudioUrl: correspondingTrack.audioUrl,
                audioUrl: correspondingTrack.audioUrl, // 更新为final audio
                duration: correspondingTrack.duration,
                isUsingStreamAudio: false // 不再使用stream audio
              };
            }
            return t;
          }));
        }

        if (status === 'complete') {
          // 停止轮询与计时
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          setIsGenerating(false);

          // 兜底逻辑：确保所有歌曲都移除loading状态，并更新最终的音频信息
          // 在complete状态下，所有歌曲都应该有final audio
          setAllGeneratedTracks(prev => prev.map((t, idx) => {
            const correspondingTrack = tracks[idx];
            if (correspondingTrack && correspondingTrack.audioUrl && correspondingTrack.duration) {
              // complete状态下，更新为final audio和真实duration
              return {
                ...t,
                isLoading: false,
                isStreaming: false,
                isGenerating: false,
                finalAudioUrl: correspondingTrack.audioUrl,
                audioUrl: correspondingTrack.audioUrl, // 更新为final audio
                duration: correspondingTrack.duration,
                isUsingStreamAudio: false // 不再使用stream audio
              };
            }
            // 兜底：即使没有对应数据，也移除loading状态
            return {...t, isLoading: false, isStreaming: false, isGenerating: false, isUsingStreamAudio: false};
          }));
        } else if (status === 'error') {
          // 处理生成失败的情况
          console.log('Music generation failed - stopping polling');

          // 停止轮询与计时
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          setIsGenerating(false);
          setPendingTasksCount(0);

          // 使用函数式更新来检查是否已经添加过这个prompt的失败记录
          setAllGeneratedTracks(prev => {
            console.log('Checking for existing failed track with prompt:', customPrompt);
            console.log('Current allGeneratedTracks:', prev.map(t => ({ id: t.id, prompt: t.originalPrompt, isError: t.isError })));
            
            const existingFailedTrack = prev.find(track => 
              track.originalPrompt === customPrompt && track.isError
            );
            
            console.log('Existing failed track found:', existingFailedTrack ? existingFailedTrack.id : 'none');
            
            if (!existingFailedTrack) {
              // 创建失败的track显示
              const failedTrack = {
                id: `failed-${Date.now()}`,
                title: customPrompt, // 使用用户输入的prompt作为title
                audioUrl: null,
                coverImage: null,
                duration: 0,
                isLoading: false,
                isError: true,
                errorMessage: errorInfo?.errorMessage || 'Generation failed', // 使用实际的错误信息
                originalPrompt: customPrompt,
                genre: mode === 'basic' ? 'R&B' : selectedGenre,
                style: mode === 'basic' ? 'R&B' : selectedGenre,
                mood: selectedMood || '',
                tags: mode === 'basic' ? 'R&B' : `${selectedGenre}, ${selectedVibe}`,
                lyrics: ''
              };

              console.log('Adding new failed track:', failedTrack.id);
              return [failedTrack, ...prev];
            } else {
              console.log('Failed track already exists for this prompt, skipping');
              return prev;
            }
          });
        }
      } catch (e) {
        console.warn('Polling music status failed:', e);
      }
    };

    // 30秒延迟后开始轮询，避免过早轮询
    pollingDelayRef.current = setTimeout(() => {
      // 立即拉一次，然后按阶段设定轮询间隔（开始1s，播放后2.5s）
      poll();
      currentPollingMsRef.current = 1000;
      pollingRef.current = setInterval(poll, currentPollingMsRef.current);
    }, 30000); // 30秒延迟
  };


  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const handleGenerate = async (
    refreshCredits?: () => Promise<void>,
    setIsPlaying?: (playing: boolean) => void
  ) => {
    if (mode === "basic") {
      // Basic Mode不再需要检查mood，只需要检查customPrompt
      if (!customPrompt?.trim()) {
        alert("Please enter a prompt");
        return;
      }
    } else {
      if (!selectedGenre || !selectedVibe) {
        alert("Please select genre and vibe");
        return;
      }
    }

    setIsGenerating(true);
    setActiveTrackIndex(0);
    // 立即显示2个skeleton，因为会生成2首歌
    setPendingTasksCount(2);

    // 开始计时
    setGenerationTimer(0);

    // 启动计时器，每秒递增
    if (generationTimerRef.current) {
      clearInterval(generationTimerRef.current);
    }
    generationTimerRef.current = setInterval(() => {
      setGenerationTimer(prev => prev + 1);
    }, 1000);

    try {
      // 构造完整的请求数据
      const requestData = {
        mode,
        // Basic Mode不再发送mood参数
        ...(mode === 'custom' && { mood: selectedMood }),
        customPrompt,
        instrumentalMode,
        // 在basic模式下不传递genre，让后端固定设置为R&B
        ...(mode === 'custom' && { genre: selectedGenre }),
        ...(mode === 'custom' && { vibe: selectedVibe }),
        songTitle,
        grooveType,
        leadInstrument,
        drumKit,
        bassTone,
        vocalStyle,
        vocalGender,
        harmonyPalette,
        bpm: bpm[0]
      };
      // 获取Supabase session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No valid session found');
      }



      // 调用音乐生成API（支持开发模式 mock）
      console.log('=== Calling Music Generation API ===');

      let result;
      if (DEV_MOCK_ENABLED) {
        // 开发模式：模拟 API 响应
        const mockTaskId = `dev_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        createDevMockGeneration(mockTaskId);
        result = {
          success: true,
          data: {
            taskId: mockTaskId,
            message: 'Music generation started (dev mock)'
          }
        };
        console.log('🎵 Dev Mock: Music generation started, taskId:', mockTaskId);
      } else {
        // 生产模式：调用真实 API
        const response = await fetch('/api/generate-music', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.error === 'Insufficient credits') {
            throw new Error('Insufficient credits! Please check your credit balance.');
          }
          throw new Error(errorData.error || 'Music generation failed');
        }

        result = await response.json();
      }

      if (result.success) {
        // 刷新积分显示（开发模式跳过）
        if (refreshCredits && !DEV_MOCK_ENABLED) {
          refreshCredits().catch(console.error);
        }

        if (result.data?.taskId) {
          console.log('Music generation started, taskId:', result.data.taskId);

          // 获取taskId
          const taskId = result.data.taskId;

          // 启动轮询：用 taskId 拉取状态并在前端更新
          startPollingStatus(taskId, setIsPlaying);
        } else {
          // 没有taskId，说明生成失败（可能包含敏感词等）
          console.log('Music generation failed - no taskId received');

          // 创建失败的track显示
          const failedTrack = {
            id: `failed-${Date.now()}`,
            title: customPrompt, // 使用用户输入的prompt作为title
            audioUrl: null,
            coverImage: null,
            duration: 0,
            isLoading: false,
            isError: true,
            errorMessage: result.data?.errorMessage || result.data?.error,
            originalPrompt: customPrompt, // 添加用户输入的prompt
            genre: mode === 'basic' ? 'R&B' : selectedGenre,
            style: mode === 'basic' ? 'R&B' : selectedGenre,
            mood: selectedMood || '',
            tags: mode === 'basic' ? 'R&B' : `${selectedGenre}, ${selectedVibe}`,
            lyrics: ''
          };

          // 添加到生成的tracks列表
          setAllGeneratedTracks(prev => [failedTrack, ...prev]);

          // 停止生成状态
          setIsGenerating(false);
          setPendingTasksCount(0);

          // 清理计时器
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          setGenerationTimer(0);

          // 提示用户生成失败且没有扣除积分
          console.log('Generation failed - no credits were consumed');
          // 可以选择显示一个友好的提示
          // alert('Generation failed (may contain sensitive content). No credits were consumed.');
        }
      } else {
        throw new Error('Failed to start music generation');
      }

    } catch (error) {
      console.error("Music generation failed:", error);
      alert(error instanceof Error ? error instanceof Error ? error.message : 'Unknown error' : "Music generation failed, please try again");
      setIsGenerating(false);
      setPendingTasksCount(0); // 重置skeleton数量

      // 清理计时器
      if (generationTimerRef.current) {
        clearInterval(generationTimerRef.current);
        generationTimerRef.current = null;
      }
      setGenerationTimer(0);
    }
  };
  return {
    // States
    mode, setMode,
    selectedGenre, setSelectedGenre,
    selectedMood, setSelectedMood,
    selectedVibe, setSelectedVibe,
    customPrompt, setCustomPrompt,
    songTitle, setSongTitle,
    instrumentalMode, setInstrumentalMode,
    keepPrivate, setKeepPrivate,
    bpm, setBpm,
    grooveType, setGrooveType,
    leadInstrument, setLeadInstrument,
    drumKit, setDrumKit,
    bassTone, setBassTone,
    vocalStyle, setVocalStyle,
    vocalGender, setVocalGender,
    harmonyPalette, setHarmonyPalette,
    isGenerating, setIsGenerating,
    allGeneratedTracks, setAllGeneratedTracks,
    activeTrackIndex, setActiveTrackIndex,
    pendingTasksCount, setPendingTasksCount,
    generationTimer,
    // Functions
    handleGenerate,
  };
};
