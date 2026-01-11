'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { VocalSeparationPanel } from '@/features/vocal-tools/components/vocal-separation-panel';
import { useVocalSeparation, VocalSeparationData } from '@/features/vocal-tools/hooks/use-vocal-separation';
import { MusicPlayer } from '@/components/ui/music-player';
import { WaveformPlayer } from '@/components/ui/waveform-player';
import { Download, Mic, Music, Volume2, Clock, CheckCircle, XCircle, AlertCircle, Upload, Library, Play, Pause, Search, X } from 'lucide-react';
import Image from 'next/image';
import { FooterSection } from '@/components/layout/sections/footer';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/ui/auth-modal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CLIENT_VOCAL_SEPARATION_CREDITS } from '@/lib/credits-config';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { formatDateTime } from "@/lib/format-utils";

function VocalSeparationCreditsDisplay({ source }: { source: 'local' | 'studio' }) {
  return <span className="text-primary font-medium">{CLIENT_VOCAL_SEPARATION_CREDITS[source]}</span>;
}

// 格式化时长
const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds <= 0) {
    return '';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function VocalSeparationDemo() {
  const { separations, startVocalSeparation, startVocalSeparationFromStudio } = useVocalSeparation();
  const [selectedSeparation, setSelectedSeparation] = useState<VocalSeparationData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentAudioElement, setCurrentAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playingAudioType, setPlayingAudioType] = useState<'original' | 'vocals' | 'accompaniment' | null>(null);
  const [isOriginalPlaying, setIsOriginalPlaying] = useState(false);
  const [isVocalsPlaying, setIsVocalsPlaying] = useState(false);
  const [isAccompanimentPlaying, setIsAccompanimentPlaying] = useState(false);
  const [hasOriginalError, setHasOriginalError] = useState(false);
  const [hasVocalsError, setHasVocalsError] = useState(false);
  const [hasAccompanimentError, setHasAccompanimentError] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [userInputUrl, setUserInputUrl] = useState<string>('');
  const [urlValidationError, setUrlValidationError] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [separationComplete, setSeparationComplete] = useState(false);
  const [separationResults, setSeparationResults] = useState<{
    vocals: string;
    accompaniment: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStart, setPendingStart] = useState<{
    force: boolean;
    requestKey: string;
    file: File | null;
    audioUrl: string;
  } | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [isCacheHit, setIsCacheHit] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  
  // Tab 状态
  const [activeTab, setActiveTab] = useState<'upload' | 'studio'>('upload');
  
  // Studio tracks 状态
  const [studioTracks, setStudioTracks] = useState<any[]>([]);
  const [selectedStudioTrack, setSelectedStudioTrack] = useState<any | null>(null);
  const [isLoadingStudioTracks, setIsLoadingStudioTracks] = useState(false);
  const [studioTracksSearchQuery, setStudioTracksSearchQuery] = useState('');
  const hasLoadedStudioTracks = useRef(false); // 跟踪是否已加载过数据
  const lastRequestKeyRef = useRef<string | null>(null);

  // 获取 Studio tracks
  const fetchStudioTracks = useCallback(async () => {
    setIsLoadingStudioTracks(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log('No session token available');
        setIsLoadingStudioTracks(false);
        return;
      }

      const response = await fetch('/api/studio-tracks-for-separation?limit=50', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch studio tracks:', response.status, errorText);
        setStudioTracks([]);
        setIsLoadingStudioTracks(false);
        return;
      }

      const result = await response.json();
      console.log('Studio tracks API response:', result);
      
      if (result.success && result.data) {
        setStudioTracks(result.data || []);
        hasLoadedStudioTracks.current = true; // 标记已加载
      } else {
        console.warn('API returned unsuccessful or missing data:', result);
        setStudioTracks([]);
        hasLoadedStudioTracks.current = true; // 即使失败也标记为已加载，避免重复请求
      }
    } catch (error) {
      console.error('Error fetching studio tracks:', error);
      setStudioTracks([]);
    } finally {
      setIsLoadingStudioTracks(false);
    }
  }, []);

  useEffect(() => {
    // Only sync login status for upload permission control; no historical data requests
    const syncAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const loggedIn = !!session?.access_token;
        setIsLoggedIn(loggedIn);
        
        // 如果已登录且未加载过数据，则加载
        if (loggedIn && !hasLoadedStudioTracks.current) {
          fetchStudioTracks();
        }
      } catch (error) {
        console.error('Error checking user session:', error);
        setIsLoggedIn(false);
      }
    };

    syncAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      // 登录后自动获取 Studio tracks（只在首次加载时加载，避免重复）
      if (session?.access_token && !hasLoadedStudioTracks.current) {
        fetchStudioTracks();
      } else if (!session?.access_token) {
        // 登出后重置状态
        hasLoadedStudioTracks.current = false;
        setStudioTracks([]);
        setSelectedStudioTrack(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchStudioTracks]);

  // 不再监听 tab 切换，只在首次加载或登录时加载数据
  // 移除这个 useEffect，避免每次切换 tab 都重新加载

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleWaveformPlayPause = (audioType: 'original' | 'vocals' | 'accompaniment') => {
    if (audioType === 'original') {
      if (isOriginalPlaying) {
        // Pause original
        setIsOriginalPlaying(false);
        setPlayingAudioType(null);
      } else {
        // Stop others and play original
        setIsVocalsPlaying(false);
        setIsAccompanimentPlaying(false);
        setIsOriginalPlaying(true);
        setPlayingAudioType('original');
      }
    } else if (audioType === 'vocals') {
      if (isVocalsPlaying) {
        // Pause vocals
        setIsVocalsPlaying(false);
        setPlayingAudioType(null);
      } else {
        // Stop others and play vocals
        setIsOriginalPlaying(false);
        setIsAccompanimentPlaying(false);
        setIsVocalsPlaying(true);
        setPlayingAudioType('vocals');
      }
    } else if (audioType === 'accompaniment') {
      if (isAccompanimentPlaying) {
        // Pause accompaniment
        setIsAccompanimentPlaying(false);
        setPlayingAudioType(null);
      } else {
        // Stop others and play accompaniment
        setIsOriginalPlaying(false);
        setIsVocalsPlaying(false);
        setIsAccompanimentPlaying(true);
        setPlayingAudioType('accompaniment');
      }
    }
  };

  const handleWaveformFinish = () => {
    // When audio finishes, stop all players
    setPlayingAudioType(null);
    setIsOriginalPlaying(false);
    setIsVocalsPlaying(false);
    setIsAccompanimentPlaying(false);
  };

  const handlePlayAudio = (url: string) => {
    // Stop current audio if playing
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    }

    if (playingAudio === url) {
      // If clicking the same audio, stop playing
      setPlayingAudio(null);
      setIsPlaying(false);
      setCurrentAudioElement(null);
      setAudioProgress(0);
      setAudioDuration(0);
    } else {
      // Play new audio directly in browser
      setPlayingAudio(url);
      setIsPlaying(true);
      
      // Create and play audio element
      const audio = new Audio(url);
      
      // Set up event listeners
      audio.addEventListener('loadedmetadata', () => {
        setAudioDuration(audio.duration);
      });
      
      audio.addEventListener('timeupdate', () => {
        setAudioProgress(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setPlayingAudio(null);
        setIsPlaying(false);
        setCurrentAudioElement(null);
        setAudioProgress(0);
        setAudioDuration(0);
      });
      
      audio.addEventListener('error', (error) => {
        console.error('Audio play failed:', error);
        setPlayingAudio(null);
        setIsPlaying(false);
        setCurrentAudioElement(null);
      });
      
      setCurrentAudioElement(audio);
      audio.play().catch(error => {
        console.error('Audio play failed:', error);
      });
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Origin轨道只显示数据库中的URL，不显示本地预览
    }
  };

  const handleUploadAreaClick = () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    fileInput?.click();
  };

  // URL输入处理函数
  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setUserInputUrl(url);
    
    // 实时验证
    if (url.trim()) {
      const validation = validateAudioUrl(url);
      if (!validation.isValid) {
        setUrlValidationError(validation.error || 'Invalid URL');
      } else {
        setUrlValidationError('');
      }
    } else {
      setUrlValidationError('');
    }
  };

  // URL验证函数
  const validateAudioUrl = (url: string): { isValid: boolean; error?: string } => {
    if (!url.trim()) {
      return { isValid: false, error: 'Please enter an audio URL' };
    }

    // 基本URL格式验证
    try {
      new URL(url);
    } catch {
      return { isValid: false, error: 'Please enter a valid URL' };
    }

    // 检查协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { isValid: false, error: 'URL must start with http:// or https://' };
    }

    // 检查音频文件扩展名
    const audioExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.opus', '.m4a', '.aac', '.wma'];
    const urlLower = url.toLowerCase();
    const hasAudioExtension = audioExtensions.some(ext => urlLower.includes(ext));
    
    if (!hasAudioExtension) {
      return { isValid: false, error: 'Please enter a URL to an audio file (MP3, WAV, FLAC, OGG, etc.)' };
    }

    return { isValid: true };
  };

  const handleStartSeparating = async () => {
    // 检查是否选择了 Studio track
    if (activeTab === 'studio') {
      if (!selectedStudioTrack) {
        setError('Please select a track from Studio');
        return;
      }
      
      // 检查 track 是否可以用于分离
      if (selectedStudioTrack.canSeparate === false) {
        setError('This track cannot be used for vocal separation. It requires a valid audio ID.');
        return;
      }
      
      try {
        setIsGenerating(true);
        setError(null);
        await startVocalSeparationFromStudio(selectedStudioTrack.id);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to start vocal separation');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // 原有的上传文件/URL 逻辑
    if (!selectedFile && !userInputUrl) {
      setError('Please select a file or enter an audio URL');
      return;
    }

    // 如果用户输入了URL，进行验证
    if (userInputUrl && !selectedFile) {
      const validation = validateAudioUrl(userInputUrl);
      if (!validation.isValid) {
        setError(validation.error || 'Invalid audio URL');
        return;
      }
    }

    const requestKey = selectedFile
      ? `file:${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`
      : `url:${userInputUrl.trim()}`;

    const hasPlayerTracks = !!(audioUrl || separationResults?.vocals || separationResults?.accompaniment);
    if (hasPlayerTracks && resultKey && resultKey !== requestKey) {
      setPendingStart({ force: false, requestKey, file: selectedFile, audioUrl: userInputUrl });
      setShowConfirmDialog(true);
      return;
    }

    await startSeparation({ force: false, requestKey, file: selectedFile, audioUrl: userInputUrl });
  };

  const handleConfirmDialog = () => {
    setShowConfirmDialog(false);
    const next = pendingStart;
    setPendingStart(null);
    if (next) {
      startSeparation(next);
    }
  };

  const handleCancelDialog = () => {
    setShowConfirmDialog(false);
    setPendingStart(null);
  };

  const startSeparation = async (options: { force: boolean; requestKey: string; file: File | null; audioUrl: string }) => {
    setIsGenerating(true);
    setError(null);
    setSeparationComplete(false);
    setSeparationResults(null);
    setSeparationProgress(0);
    setIsCacheHit(false);
    setCacheUpdatedAt(null);
    lastRequestKeyRef.current = options.requestKey;

    // 重置播放状态
    setIsOriginalPlaying(false);
    setIsVocalsPlaying(false);
    setIsAccompanimentPlaying(false);
    setPlayingAudioType(null);

    // 清空audioUrl，无论是URL还是文件上传，都等待从数据库轮询获取
    // Origin播放器会显示loading状态
    setAudioUrl('');

    try {
      // Get login session to attach auth header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setShowAuthModal(true);
        return;
      }

      const formData = new FormData();
      if (options.file) {
        formData.append('file', options.file);
      }
      if (options.audioUrl) {
        formData.append('audioUrl', options.audioUrl);
      }
      if (options.force) {
        formData.append('force', 'true');
      }

      const response = await fetch('/api/vocal/separation', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Separation failed');
      }

      // Cache hit: completed result can be rendered immediately without polling.
      if (result?.success && result?.cacheHit && result?.data?.status === 'completed') {
        const data = result.data;
        setAudioUrl(data.originalAudioUrl || '');
        setSeparationResults({
          vocals: data.vocalUrl || '',
          accompaniment: data.instrumentalUrl || '',
        });
        setSeparationProgress(100);
        setSeparationComplete(true);
        setIsGenerating(false);
        setIsCacheHit(true);
        setCacheUpdatedAt(data.updatedAt || data.createdAt || null);
        setResultKey(options.requestKey);
        return;
      }

      // Poll status until completion
      if (result.data?.predictionId) {
        startPollingStatus(result.data.predictionId, options.requestKey);
      }
    } catch (error) {
      console.error('Separation error:', error);
      setError(error instanceof Error ? error.message : 'Separation failed');
      setIsGenerating(false);
    }
  };

  const startPollingStatus = (predictionId: string, requestKey: string) => {
    const startTime = Date.now();
    const MAX_POLL_TIME = 300; // 最大轮询时间：5分钟（300秒）
    let cancelled = false;

    // 计算进度百分比
    const calculateProgress = (elapsed: number, hasResults: boolean): number => {
      // 基于时间和结果状态计算进度
      if (hasResults) {
        // 已有部分结果，进度在 60-90% 之间
        const baseProgress = 60;
        const timeBasedProgress = Math.min(30, (elapsed / MAX_POLL_TIME) * 30);
        return Math.min(90, baseProgress + timeBasedProgress);
      } else {
        // 还在等待结果，进度在 10-50% 之间
        const baseProgress = 10;
        const timeBasedProgress = Math.min(40, (elapsed / MAX_POLL_TIME) * 40);
        return Math.min(50, baseProgress + timeBasedProgress);
      }
    };

    const poll = async () => {
      if (cancelled) return;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setIsGenerating(false);
          setSeparationProgress(0);
          return;
        }

        const res = await fetch(`/api/vocal/separation-status?predictionId=${predictionId}`, { 
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          // 更新进度（即使请求失败也显示进度）
          const hasResults = !!(audioUrl || separationResults?.vocals || separationResults?.accompaniment);
          const progress = calculateProgress(elapsed, hasResults);
          setSeparationProgress(progress);
          setTimeout(poll, 2000);
          return;
        }

        const payload = await res.json();

        if (!payload?.success || !payload.data) {
          // 更新进度
          const hasResults = !!(audioUrl || separationResults?.vocals || separationResults?.accompaniment);
          const progress = calculateProgress(elapsed, hasResults);
          setSeparationProgress(progress);
          setTimeout(poll, 2000);
          return;
        }

        const data = payload.data;

        // 立即设置所有可用的URL
        const hasOriginalUrl = !!(data.originalAudioUrl && data.originalAudioUrl !== audioUrl);
        const hasResults = !!(data.vocalUrl || data.instrumentalUrl);

        if (hasOriginalUrl) {
          setAudioUrl(data.originalAudioUrl);
        }

        if (hasResults) {
          setSeparationResults({ 
            vocals: data.vocalUrl || '', 
            accompaniment: data.instrumentalUrl || '' 
          });
        }

        // 更新进度
        const progress = calculateProgress(elapsed, hasOriginalUrl || hasResults);
        setSeparationProgress(progress);

        // 检查状态
        if (data.status === 'completed') {
          setSeparationProgress(100);
          setSeparationComplete(true);
          setIsGenerating(false);
          setResultKey(requestKey);
          return;
        }

        if (data.status === 'error') {
          setError(data.errorMessage || 'Separation failed');
          setIsGenerating(false);
          setSeparationProgress(0);
          return;
        }

        // 继续轮询
        if (elapsed > MAX_POLL_TIME) {
          setError('Separation timeout');
          setIsGenerating(false);
          setSeparationProgress(0);
          return;
        }

        // 根据时间调整轮询间隔
        const nextDelay = elapsed < 30 ? 1000 : elapsed < 120 ? 2000 : 3000;
        setTimeout(poll, nextDelay);

      } catch (error) {
        console.error('Polling error:', error);
        // 更新进度（即使出错也显示进度）
        const hasResults = !!(audioUrl || separationResults?.vocals || separationResults?.accompaniment);
        const progress = calculateProgress(elapsed, hasResults);
        setSeparationProgress(progress);
        setTimeout(poll, 2000);
      }
    };

    // 立即开始第一次轮询
    poll();

    // 返回取消函数
    return () => {
      cancelled = true;
      setSeparationProgress(0);
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <AlertCircle className="h-4 w-4 text-blue-500 animate-pulse" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pt-32 pb-6 sm:pb-12">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
            AI VOCAL SEPARATION TOOL
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight">
            AI Vocal Separation Free Online
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-8">
            Enjoy fast and seamless audio separation with our AI-powered vocal separation.
          </p>
        </div>


          {/* Main Content */}
          <div className="space-y-8">
            {/* Tab Switcher */}
            <div className="bg-muted/30 rounded-xl p-1 flex-shrink-0">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`py-2 px-4 md:px-6 text-xs md:text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                    activeTab === 'upload'
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Upload className="h-4 w-4 inline mr-2" />
                  Upload File / URL
                </button>
                <button
                  onClick={() => {
                    if (!isLoggedIn) {
                      setShowAuthModal(true);
                      return;
                    }
                    setActiveTab('studio');
                  }}
                  className={`py-2 px-4 md:px-6 text-xs md:text-sm font-semibold tracking-tight transition-all duration-200 rounded-xl ${
                    activeTab === 'studio'
                      ? 'bg-primary/20 border-transparent text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Library className="h-4 w-4 inline mr-2" />
                  From Studio
                </button>
              </div>
            </div>

            {/* Upload Tab Content */}
            {activeTab === 'upload' && (
              <div className="bg-muted/20 rounded-lg p-3">
                {/* Track URL Input with Button */}
                <div className="w-full space-y-2">
                  <label className="text-sm font-medium text-foreground text-left block">Audio URL</label>
                  <div className="relative">
                    <input
                      type="url"
                        placeholder="Paste your audio file URL here..."
                        className="w-full px-4 py-3 pr-14 bg-muted rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                        value={userInputUrl}
                        onChange={handleUrlInputChange}
                    />
                    {urlValidationError && (
                      <p className="text-red-500 text-xs mt-1">{urlValidationError}</p>
                    )}
                  </div>
                </div>

              {/* Upload Area */}
                <div className="w-full space-y-2 mt-4">
                  <label className="text-sm font-medium text-foreground text-left block">Upload Local File</label>
                  <Card 
                    className={`border-2 border-dashed transition-colors cursor-pointer ${
                      isLoggedIn 
                        ? 'border-primary/50 hover:border-primary/70' 
                        : 'border-muted-foreground/50 hover:border-muted-foreground/70'
                    }`}
                    onClick={handleUploadAreaClick}
                  >
                    <CardContent className="p-8">
                      <div className="text-center space-y-4">
                        <div className={`w-16 h-16 rounded-lg flex items-center justify-center mx-auto ${
                          isLoggedIn ? 'bg-primary/20' : 'bg-muted-foreground/20'
                        }`}>
                          <Upload className={`h-8 w-8 ${isLoggedIn ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="space-y-2">
                          {selectedFile ? (
                            <div className="space-y-2">
                              <p className="text-sm text-foreground font-medium">
                                {selectedFile.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-muted-foreground">
                                Drag and drop your file or click to browse
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Supports WAV, MP3, FLAC, OGG, OPUS, SPHERE, MP4, M4V, AVI, MOV, AAC, M4A, BIN
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <input
                    id="file-upload"
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={!isLoggedIn}
                  />
                </div>
              </div>
            )}

            {/* Studio Tab Content */}
            {activeTab === 'studio' && (
              <div className="bg-muted/20 rounded-lg p-3">
                <div className="w-full space-y-4">
                  {!isLoggedIn ? (
                    <Card className="p-8 text-center">
                      <CardContent>
                        <p className="text-muted-foreground mb-4">Please log in to select tracks from Studio</p>
                        <Button onClick={() => setShowAuthModal(true)}>Log In</Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {/* Search Studio Tracks */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search your tracks..."
                          className="w-full pl-10 pr-10 py-2 bg-muted rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          value={studioTracksSearchQuery}
                          onChange={(e) => setStudioTracksSearchQuery(e.target.value)}
                        />
                        {studioTracksSearchQuery && (
                          <button
                            onClick={() => setStudioTracksSearchQuery('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>

                      {/* Studio Tracks List */}
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {isLoadingStudioTracks ? (
                          <div className="text-center py-8 text-muted-foreground">Loading tracks...</div>
                        ) : studioTracks.filter(track => 
                            studioTracksSearchQuery === '' || 
                            track.title.toLowerCase().includes(studioTracksSearchQuery.toLowerCase()) ||
                            track.tags.toLowerCase().includes(studioTracksSearchQuery.toLowerCase())
                          ).length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">No tracks found</div>
                        ) : (
                          studioTracks
                            .filter(track => 
                              studioTracksSearchQuery === '' || 
                              track.title.toLowerCase().includes(studioTracksSearchQuery.toLowerCase()) ||
                              track.tags?.toLowerCase().includes(studioTracksSearchQuery.toLowerCase())
                            )
                            .map((track) => {
                              const canSeparate = track.canSeparate !== false; // 默认为 true（向后兼容）
                              return (
                                <div
                                  key={track.id}
                                  className={`flex items-center gap-4 px-2 py-2 mx-3 transition-all duration-300 group rounded-lg border ${
                                    track.isError || !canSeparate
                                      ? 'opacity-60 cursor-not-allowed'
                                      : `cursor-pointer ${
                                          selectedStudioTrack?.id === track.id
                                            ? 'bg-muted/60 border-border/60'
                                            : 'hover:bg-muted/20 border-transparent'
                                        }`
                                  }`}
                                  onClick={() => {
                                    if (canSeparate) {
                                      setSelectedStudioTrack(track);
                                    } else {
                                      setError('This track cannot be used for vocal separation. It requires a valid audio ID.');
                                    }
                                  }}
                                >
                                  {/* 封面 */}
                                  <div className="relative w-16 h-16 rounded-md overflow-hidden flex-shrink-0">
                                    {track.coverImage ? (
                                      <Image
                                        src={track.coverImage}
                                        alt={track.title}
                                        width={64}
                                        height={64}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                                        <Music className="h-6 w-6 text-primary" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Track Info */}
                                  <div className="flex-1 min-w-0 flex items-center gap-4">
                                    <div className="flex-1 min-w-0 flex items-center h-16">
                                      <div className="flex items-center justify-between gap-2 w-full">
                                        {/* 歌曲信息列 */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center h-16">
                                          <div className="flex items-center gap-2">
                                            <h3 className={`font-semibold text-sm truncate ${
                                              selectedStudioTrack?.id === track.id
                                                ? 'text-primary'
                                                : 'text-foreground'
                                            }`}>
                                              {track.title}
                                            </h3>
                                            {!canSeparate && (
                                              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                                                Unavailable
                                              </span>
                                            )}
                                          </div>
                                          {/* 标签信息 */}
                                          {track.tags && (
                                            <div className="flex items-center gap-2 mt-0.5">
                                              {/* 时长显示在 tags 前面，用竖线分隔 */}
                                              {track.duration > 0 && (
                                                <>
                                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDuration(track.duration)}
                                                  </span>
                                                  <span className="text-xs text-muted-foreground/60">|</span>
                                                </>
                                              )}
                                              <p 
                                                className="text-xs text-muted-foreground truncate flex-1"
                                                title={track.tags}
                                              >
                                                {track.tags.split(/[,;.]/).filter((tag: string) => tag.trim()).map((tag: string, index: number, array: string[]) => (
                                                  <span key={index}>
                                                    <span>{tag.trim()}</span>
                                                    {index < array.length - 1 && <span className="mx-1">•</span>}
                                                  </span>
                                                ))}
                                                {track.tags.length > 100 && '...'}
                                              </p>
                                            </div>
                                          )}
                                          {/* 只有时长没有标签时 */}
                                          {!track.tags && track.duration > 0 && (
                                            <span className="text-xs text-muted-foreground mt-0.5">
                                              {formatDuration(track.duration)}
                                            </span>
                                          )}
                                          {/* 创建时间 - 参考 studio-tracks-list 的格式 */}
                                          {track.createdAt && (
                                            <p className="text-xs text-muted-foreground/60 truncate mt-1">
                                              {formatDateTime(track.createdAt)}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* 操作按钮列 - 只显示选中对勾 */}
                                        <div className="flex items-center justify-end gap-1 flex-shrink-0">
                                          {selectedStudioTrack?.id === track.id && (
                                            <CheckCircle className="h-5 w-5 text-primary" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>

                      {selectedStudioTrack && (
                        <div className="p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">Selected Track:</p>
                          <p className="text-sm font-medium text-foreground">{selectedStudioTrack.title}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

          {/* Action Button */}
          <div className="w-full space-y-3">
            <Button 
              size="lg" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
              onClick={handleStartSeparating}
              disabled={
                (activeTab === 'upload' && (!selectedFile && !userInputUrl)) ||
                (activeTab === 'studio' && !selectedStudioTrack) ||
                isGenerating || 
                !!urlValidationError
              }
            >
              {isGenerating ? (
                <div className="flex items-center gap-2">
                  Separating ({Math.round(separationProgress)}%)
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : (
                "Start Separating"
              )}
            </Button>
            {isGenerating && (
              <div className="w-full space-y-2 mt-2">
                <Progress value={separationProgress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">
                  Processing: {Math.round(separationProgress)}%
                </p>
              </div>
            )}
            <div className="text-center text-sm text-muted-foreground">
              <p>Estimated time: 1~3 minutes • This action will cost <VocalSeparationCreditsDisplay source={activeTab === 'upload' ? 'local' : 'studio'} /> <span className="text-primary font-medium">credits</span></p>
            </div>
          </div>

          {/* Separation Results */}
          {(isGenerating || separationComplete) && (
            <div className="w-full max-w-6xl mt-8">
              <Separator className="mb-8" />
              <h3 className="text-xl font-semibold text-foreground mb-6 text-left">
                {selectedFile ? selectedFile.name : audioUrl ? 'Audio URL' : 'Separation Results'}
              </h3>

              {separationComplete && resultKey?.startsWith('url:') && (
                <div className={`mb-6 p-4 rounded-lg border ${isCacheHit ? 'bg-blue-50 border-blue-200' : 'bg-muted/30 border-border'}`}>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <p className={`text-sm ${isCacheHit ? 'text-blue-700' : 'text-muted-foreground'}`}>
                      {isCacheHit
                        ? `Showing existing separation result${cacheUpdatedAt ? ` • Updated ${formatDateTime(cacheUpdatedAt)}` : ''}`
                        : 'Want a fresh result with the latest model?'}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isGenerating}
                      onClick={() => {
                        const url = resultKey.slice('url:'.length);
                        startSeparation({ force: true, requestKey: resultKey, file: null, audioUrl: url });
                      }}
                    >
                      Re-separate
                    </Button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* Original Track */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Origin</p>
                    </div>
                    {audioUrl && (
                      <button 
                        disabled={hasOriginalError}
                        className="p-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => !hasOriginalError && window.open(audioUrl, '_blank')}
                      >
                        <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  <WaveformPlayer
                    key={`origin-${audioUrl}`}
                    audioUrl={audioUrl}
                    isPlaying={isOriginalPlaying}
                    onPlayPause={() => handleWaveformPlayPause('original')}
                    onFinish={handleWaveformFinish}
                    isLoading={!audioUrl || audioUrl.trim() === ''}
                    onLoadError={setHasOriginalError}
                    className="mt-2"
                  />
                </div>

                {/* Vocal Track */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Vocal</p>
                    </div>
                    {separationComplete && separationResults?.vocals && (
                      <button
                        disabled={hasVocalsError}
                        className="p-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => !hasVocalsError && window.open(separationResults.vocals, '_blank')}
                      >
                        <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  <WaveformPlayer
                    key={`vocals-${separationResults?.vocals || 'empty'}`}
                    audioUrl={separationResults?.vocals}
                    isPlaying={isVocalsPlaying}
                    onPlayPause={() => handleWaveformPlayPause('vocals')}
                    onFinish={handleWaveformFinish}
                    isLoading={!separationResults?.vocals || separationResults.vocals.trim() === ''}
                    onLoadError={setHasVocalsError}
                    className="mt-2"
                  />
                </div>

                {/* Instrumental Track */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Instrumental</p>
                    </div>
                    {separationComplete && separationResults?.accompaniment && (
                      <button
                        disabled={hasAccompanimentError}
                        className="p-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => !hasAccompanimentError && window.open(separationResults.accompaniment, '_blank')}
                      >
                        <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>
                  <WaveformPlayer
                    key={`accompaniment-${separationResults?.accompaniment || 'empty'}`}
                    audioUrl={separationResults?.accompaniment}
                    isPlaying={isAccompanimentPlaying}
                    onPlayPause={() => handleWaveformPlayPause('accompaniment')}
                    onFinish={handleWaveformFinish}
                    isLoading={!separationResults?.accompaniment || separationResults.accompaniment.trim() === ''}
                    onLoadError={setHasAccompanimentError}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* What is MakeRNB's Vocal Separation Section */}
      <section className="py-16 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Left Side - Text Content */}
            <div className="flex-1 lg:w-3/5 space-y-6 text-center lg:text-left">
              <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                About MakeRNB&apos;s Vocal Separation
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Our AI-powered vocal separation technology analyzes audio tracks to extract vocals and instrumentals separately. Whether you&apos;re creating karaoke versions, producing remixes, or isolating vocal tracks for sampling, our tool delivers quality results in minutes. Perfect for musicians, content creators, and music enthusiasts who want to unlock creative possibilities from their favorite songs.
              </p>
            </div>
            
            {/* Right Side - Visual Content */}
            <div className="flex-1 lg:w-2/5 flex justify-center">
              <div className="flex items-center justify-center">
                <Image 
                  src="/icons/Vocal-Remover.svg" 
                  alt="Vocal Separation" 
                  width={256}
                  height={256}
                  className="h-64 w-64 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 px-4 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          {/* Section Title */}
          <div className="text-center mb-12">
            <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
              Features
            </h2>

            <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
              Key Features of MakeRNB Vocal Separation
            </h2>

            <h3 className="md:w-1/2 mx-auto text-lg text-center text-muted-foreground mb-8">
              Discover the capabilities that make our vocal separation tool stand out
            </h3>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1: AI-Powered Online Processing */}
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-foreground font-bold text-lg">AI</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                AI-Powered Online Processing
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                AI technology separates vocals and instrumentals through your browser. No software installation required - upload and get results in seconds.
              </p>
            </div>

            {/* Feature 2: Studio-Quality Output */}
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-foreground font-bold text-sm">HQ</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Studio-Quality Output
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Audio separation with lossless quality preservation. Create karaoke tracks, acapella versions, and remixes with clarity and precision.
              </p>
            </div>

            {/* Feature 3: Universal Format Support */}
            <div className="text-center">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Universal Format Support
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Works with all major audio formats including MP3, WAV, FLAC, OGG, and more. Upload any audio file and get instant processing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How To Use Section */}
      <section className="py-20 bg-muted/20">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-foreground mb-4">
                How To Separate Vocals With AI
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Separate vocals from music in just three simple steps
              </p>
            </div>

            {/* Steps */}
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-left">
                {/* Step Number and Title in same row */}
                <div className="mb-4 flex items-center justify-start gap-3">
                  {/* Step Number */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">1</span>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-30 blur-md"></div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground">
                    Upload Your Audio
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  Drag and drop your audio file or paste a URL. Our AI supports various formats including MP3, WAV, FLAC, and more.
                </p>
              </div>

              <div className="text-left">
                {/* Step Number and Title in same row */}
                <div className="mb-4 flex items-center justify-start gap-3">
                  {/* Step Number */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">2</span>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-30 blur-md"></div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground">
                    Start Separation
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  Click &quot;Start Separating&quot; and let our advanced AI technology isolate vocals and instrumental tracks automatically.
                </p>
              </div>

              <div className="text-left">
                {/* Step Number and Title in same row */}
                <div className="mb-4 flex items-center justify-start gap-3">
                  {/* Step Number */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">3</span>
                    </div>
                    {/* Glow effect */}
                    <div className="absolute inset-0 w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/70 opacity-30 blur-md"></div>
                  </div>
                  
                  {/* Title */}
                  <h3 className="text-xl font-semibold text-foreground">
                    Download Results
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-muted-foreground leading-relaxed">
                  Preview your separated tracks and download high-quality vocal and instrumental files for your projects.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="container max-w-4xl py-12 sm:py-16">
        <div className="text-center mb-8">
          <h2 className="text-lg text-primary text-center mb-2 tracking-wider">
            Frequently Asked Questions
          </h2>

          <h2 className="text-3xl md:text-4xl text-center font-bold mb-4">
            Everything You Need to Know
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get answers to common questions about our AI-powered vocal separation tool
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="item-1" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              What is a vocal remover?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              A vocal remover is an AI-powered tool that separates vocals from instrumental tracks in audio files. It uses advanced machine learning algorithms to isolate different audio components, allowing you to create karaoke tracks, acapella versions, or clean instrumentals for remixing and music production.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              How does our AI vocal remover work?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Our AI analyzes the frequency spectrum and spatial characteristics of audio to distinguish between vocals and instruments. Using deep learning models trained on thousands of songs, it can identify vocal patterns and separate them from the instrumental backing with high accuracy, even in complex musical arrangements.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              Is MakeRNB&apos;s vocal remover free to use?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Yes! Our vocal remover is completely free to use. Simply upload your audio file and get instant results without any hidden costs or subscription requirements. We believe in making professional-quality audio tools accessible to everyone.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              Do I need to download or install any software?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              No installation required! Our vocal remover works entirely in your web browser. Simply visit our website, upload your audio file, and get your separated tracks instantly. It&apos;s designed to work on any device with an internet connection.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              What audio file formats are supported?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              We support all major audio formats including MP3, WAV, FLAC, OGG, OPUS, and more. You can also upload video files (MP4, AVI, MOV) and we&apos;ll extract the audio track for processing. The tool automatically detects the format and processes accordingly.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              How long does processing take?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Processing time depends on the length and complexity of your audio file. Most songs (3-5 minutes) are processed within 30-60 seconds. Our AI is optimized for speed while maintaining high quality results, so you won&apos;t have to wait long for your separated tracks.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-7" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              Can I preview results before downloading?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Absolutely! You can preview both the isolated vocals and instrumental tracks directly in your browser before downloading. This allows you to verify the quality and ensure you&apos;re happy with the separation before saving the files to your device.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-8" className="border-b border-border px-4 py-1">
            <AccordionTrigger className="text-left text-lg font-semibold py-4 hover:no-underline [&[data-state=open]]:text-primary">
              Can I save tracks directly from the platform?
            </AccordionTrigger>
            <AccordionContent className="text-base text-muted-foreground pb-4 leading-relaxed">
              Yes! Once processing is complete, you can download both the vocal and instrumental tracks directly to your device. Files are saved in high quality and ready to use for your projects, whether it&apos;s karaoke, remixing, or music practice.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

        {/* Footer */}
        <FooterSection />


        {/* Auth Modal */}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[425px]">
            <AlertDialogHeader className="space-y-2 sm:space-y-3">
              <AlertDialogTitle className="text-lg sm:text-xl">Clear Current Tracks</AlertDialogTitle>
              <AlertDialogDescription className="text-sm sm:text-base">
                There are existing audio tracks in the player. Starting a new separation will clear all current tracks. Please download them to your local device if needed. Do you want to continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel className="w-full sm:w-auto" onClick={handleCancelDialog}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleConfirmDialog}
                className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
}
