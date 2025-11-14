"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { X, Music2, CreditCard, ChevronDown, ChevronUp, Play, Pause, HelpCircle } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { ExtendMusicModel, getExtendMusicCredits } from '@/lib/credits-config';
import { formatDuration } from '@/lib/format-utils';

// Extend Music API 参数接口
export interface ExtendMusicParams {
  model: ExtendMusicModel;
  defaultParamFlag: boolean;
  // 自定义模式必填参数
  prompt?: string;
  style?: string;
  title?: string;
  continueAt?: number;
  // 可选高级参数
  negativeTags?: string;
  vocalGender?: 'm' | 'f';
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  personaId?: string;
}

export interface ExtendMusicDialogProps {
  /** 是否打开对话框 */
  isOpen: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 确认扩展音乐回调，传入完整参数，返回 taskId 时表示成功并应关闭弹窗 */
  onConfirm: (params: ExtendMusicParams) => Promise<{ taskId: string } | void> | void;
  /** 曲目标题 */
  trackTitle?: string;
  /** 曲目时长（秒） */
  trackDuration?: number;
  /** 原始曲目的风格 */
  originalStyle?: string;
  /** 音频文件 URL */
  audioUrl?: string;
  /** 用户当前积分 */
  userCredits?: number;
  /** 获取延长歌曲状态（用于监听完成状态） */
  getExtendMusicState?: (taskId: string) => any;
}

/**
 * Extend Music 对话框组件
 * 支持两种模式：使用原始参数或自定义参数
 */
export const ExtendMusicDialog: React.FC<ExtendMusicDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  trackTitle = 'Track',
  trackDuration = 120,
  originalStyle = '',
  audioUrl,
  userCredits,
  getExtendMusicState,
}) => {
  // ==================== 基础状态 ====================
  const [selectedModel, setSelectedModel] = useState<ExtendMusicModel>('V4');
  const [useDefaultParams, setUseDefaultParams] = useState(true); // true = 原始参数模式
  const [isExtending, setIsExtending] = useState(false); // 延长音乐进行中
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null); // 当前任务ID
  
  // ==================== 自定义模式参数 ====================
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [title, setTitle] = useState('');
  const [continueAt, setContinueAt] = useState(0);
  
  // ==================== 音频播放器状态 ====================
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(trackDuration);
  
  // ==================== 高级选项 ====================
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativeTags, setNegativeTags] = useState('');
  const [vocalGender, setVocalGender] = useState<'m' | 'f' | 'auto'>('auto');
  const [styleWeight, setStyleWeight] = useState(0.65);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.65);
  const [audioWeight, setAudioWeight] = useState(0.65);
  const [personaId, setPersonaId] = useState('');

  // ==================== 音频播放器逻辑 ====================
  // 初始化音频元素
  useEffect(() => {
    if (!audioUrl || typeof window === 'undefined' || !isOpen) {
      // 如果对话框关闭或没有音频 URL，清理音频
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    // 重置播放状态
    setIsPlaying(false);
    setCurrentTime(0);

    // 监听时间更新
    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };

    // 监听时长更新
    const handleLoadedMetadata = () => {
      if (audioRef.current) {
        const duration = audioRef.current.duration || trackDuration;
        setAudioDuration(duration);
      }
    };

    // 监听播放结束
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    // 监听暂停事件 - 更新 continueAt
    const handlePause = () => {
      if (audioRef.current) {
        const pausedTime = Math.floor(audioRef.current.currentTime);
        setContinueAt(pausedTime);
        setIsPlaying(false);
      }
    };
    
    // 监听播放事件
    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, trackDuration, isOpen]);

  // 播放/暂停控制
  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      // pause 事件会自动触发 handlePause，更新 continueAt 和 isPlaying
    } else {
      try {
        await audioRef.current.play();
        // play 事件会自动触发 handlePlay，更新 isPlaying
      } catch (error) {
        console.error('Failed to play audio:', error);
        setIsPlaying(false);
      }
    }
  };

  // 跳转到指定时间
  const handleSeek = (time: number) => {
    if (!audioRef.current) return;
    const seekTime = Math.max(0, Math.min(time, audioDuration));
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    setContinueAt(Math.floor(seekTime));
  };

  // 清理：对话框关闭时停止播放
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  // ==================== 计算和验证 ====================
  const requiredCredits = getExtendMusicCredits(selectedModel);
  const hasEnoughCredits = userCredits === undefined || userCredits >= requiredCredits;
  
  // 自定义模式下的表单验证
  const isFormValid = useDefaultParams || (
    prompt.trim().length > 0 &&
    style.trim().length > 0 &&
    title.trim().length > 0 &&
    continueAt > 0 &&
    continueAt < trackDuration
  );

  // 延长完成后关闭弹窗并重置状态
  const handleCloseAfterComplete = useCallback(() => {
    setIsExtending(false);
    setCurrentTaskId(null);
    
    // 重置所有状态
    setSelectedModel('V4');
    setUseDefaultParams(true);
    setPrompt('');
    setStyle('');
    setTitle('');
    setContinueAt(0);
    setShowAdvanced(false);
    setNegativeTags('');
    setVocalGender('auto');
    setStyleWeight(0.65);
    setWeirdnessConstraint(0.65);
    setAudioWeight(0.65);
    setPersonaId('');
    
    // 调用外部关闭回调
    onClose();
  }, [onClose]);

  // ==================== 监听延长歌曲状态 ====================
  useEffect(() => {
    if (!isExtending || !currentTaskId || !getExtendMusicState) return;

    const checkStatus = () => {
      const state = getExtendMusicState(currentTaskId);
      // 检查状态是否为 'completed'（注意是 completed 而不是 complete）
      if (state && state.status === 'completed') {
        // 延长歌曲已完成，关闭弹窗
        handleCloseAfterComplete();
      } else if (state && state.status === 'error') {
        // 如果出错，也关闭弹窗
        handleCloseAfterComplete();
      }
    };

    // 每2秒检查一次状态
    const interval = setInterval(checkStatus, 2000);
    
    return () => clearInterval(interval);
  }, [isExtending, currentTaskId, getExtendMusicState, handleCloseAfterComplete]);

  // ==================== 事件处理 ====================
  const handleConfirm = async () => {
    if (!hasEnoughCredits || !isFormValid || isExtending) return;

    try {
      const params: ExtendMusicParams = {
        model: selectedModel,
        defaultParamFlag: useDefaultParams,
      };

      // 如果是自定义模式，添加必填参数
      if (!useDefaultParams) {
        params.prompt = prompt;
        params.style = style;
        params.title = title;
        params.continueAt = continueAt;

        // 添加高级选项（如果有值）
        if (negativeTags.trim()) params.negativeTags = negativeTags;
        if (vocalGender && vocalGender !== 'auto') params.vocalGender = vocalGender;
        if (styleWeight !== 0.65) params.styleWeight = styleWeight;
        if (weirdnessConstraint !== 0.65) params.weirdnessConstraint = weirdnessConstraint;
        if (audioWeight !== 0.65) params.audioWeight = audioWeight;
        if (personaId.trim()) params.personaId = personaId;
      }

      // 设置 loading 状态
      setIsExtending(true);

      // 停止音频播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setCurrentTime(0);

      // 调用 onConfirm，等待返回 taskId
      const result = await onConfirm(params);
      
      if (result && typeof result === 'object' && 'taskId' in result) {
        // 保存 taskId，开始监听状态
        setCurrentTaskId(result.taskId);
        // 不立即关闭弹窗，等待回调完成
      } else {
        // 如果没有返回 taskId，说明可能出错了，关闭弹窗
        handleCloseAfterComplete();
      }
    } catch (error) {
      console.error('Failed to extend music:', error);
      // 出错时重置状态并关闭弹窗
      setIsExtending(false);
      setCurrentTaskId(null);
      handleCloseAfterComplete();
    }
  };


  const handleClose = () => {
    // 停止音频播放
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    
    // 重置所有状态
    setSelectedModel('V4');
    setUseDefaultParams(true);
    setPrompt('');
    setStyle('');
    setTitle('');
    setContinueAt(0);
    setShowAdvanced(false);
    setNegativeTags('');
    setVocalGender('auto');
    setStyleWeight(0.65);
    setWeirdnessConstraint(0.65);
    setAudioWeight(0.65);
    setPersonaId('');
    setIsExtending(false);
    setCurrentTaskId(null);
    onClose();
  };

  // 模型版本选项配置
  const modelOptions: Array<{ value: ExtendMusicModel; label: string; description: string }> = [
    { value: 'V5', label: 'V5', description: 'Superior musical expression, faster generation.' },
    { value: 'V4.5+', label: 'V4.5+', description: 'Richer sound, new ways to create, max 8 min.' },
    { value: 'V4_5', label: 'V4.5', description: 'Smarter prompts, faster generations, max 8 min.' },
    { value: 'V4', label: 'V4', description: 'Improved vocal quality, max 4 min.' },
    { value: 'V3_5', label: 'V3.5', description: 'Better song structure, max 4 min.' },
  ];

  return (
    <AlertDialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
        {/* 关闭按钮 */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* 固定头部 */}
        <AlertDialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
          <AlertDialogTitle className="flex items-center gap-2 pr-8">
            <Music2 className="h-5 w-5 text-primary" />
            <span>Extend Music</span>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Extend &quot;{trackTitle}&quot; to create a longer version.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* 可滚动的主要内容区域 */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 py-4">
          {/* 模式选择 */}
          <div className="space-y-2">
            <Label htmlFor="param-mode">Extension Mode</Label>
            <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/20">
              <Switch
                id="param-mode"
                checked={!useDefaultParams}
                onCheckedChange={(checked) => setUseDefaultParams(!checked)}
              />
              <Label htmlFor="param-mode" className="cursor-pointer flex-1">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">
                    {useDefaultParams ? 'Use Original Parameters' : 'Custom Parameters'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {useDefaultParams 
                      ? 'Continue with the same style and settings from the original track'
                      : 'Customize the extension with new parameters'
                    }
                  </span>
                </div>
              </Label>
            </div>
          </div>

          {/* 模型版本选择 */}
          <div className="space-y-3 my-6">
            <Label htmlFor="model">Model Version</Label>
            <Select
              value={selectedModel}
              onValueChange={(value) => setSelectedModel(value as ExtendMusicModel)}
            >
              <SelectTrigger id="model" className="w-full !items-center py-4 min-h-[60px]">
                <div className="flex flex-col items-start justify-center flex-1 min-w-0 mr-2 gap-1">
                  <SelectValue placeholder="Select model version" />
                  <p className="text-xs text-muted-foreground w-full text-left">
                    {modelOptions.find(opt => opt.value === selectedModel)?.description || 'Select a model version'}
                  </p>
                </div>
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 自定义参数表单 */}
          {!useDefaultParams && (
            <div className="space-y-4 mt-6">
              {/* Continue At - 音频播放器 */}
              <div className="space-y-2">
                <Label>
                  Continue From <span className="text-destructive">*</span>
                </Label>
                {audioUrl ? (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                    {/* 播放控制 */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current" />
                        )}
                      </button>
                      
                      {/* 时间显示 */}
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground min-w-[50px]">
                          {formatDuration(Math.floor(currentTime))}
                        </span>
                        
                        {/* 进度条 */}
                        <div className="flex-1 relative">
                          <Slider
                            value={[currentTime]}
                            min={0}
                            max={audioDuration}
                            step={0.1}
                            onValueChange={([value]) => handleSeek(value)}
                            className="w-full"
                          />
                        </div>
                        
                        <span className="text-sm font-mono text-muted-foreground min-w-[50px]">
                          {formatDuration(Math.floor(audioDuration))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={0}
                      max={trackDuration}
                      value={continueAt}
                      onChange={(e) => setContinueAt(Number(e.target.value))}
                      placeholder="60"
                      className="w-full"
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {audioUrl 
                    ? 'Play the audio and pause at the desired point to set the start time for extension'
                    : 'Audio URL not available. Please enter the start time manually (0 - ' + trackDuration + 's)'
                  }
                </p>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="title"
                    type="text"
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Extended version title"
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    {title.length}/80
                  </span>
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <Label htmlFor="style">
                  Style <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="style"
                    type="text"
                    maxLength={200}
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    placeholder="e.g., R&B, Soul"
                    className="pr-24"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    {style.length}/200
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep style consistent with original audio for best results
                </p>
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">
                  Extension Description <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Textarea
                    id="prompt"
                    maxLength={3000}
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe how the music should continue or evolve..."
                    className="pr-20 pb-6"
                  />
                  <p className="absolute bottom-2 right-2 text-xs text-muted-foreground pointer-events-none">
                    {prompt.length}/3000
                  </p>
                </div>
              </div>

              {/* 高级选项 */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                    {/* Negative Tags */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="negativeTags">Negative Tags (Optional)</Label>
                        <Tooltip content="Styles or features to avoid" position="right">
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </Tooltip>
                      </div>
                      <Input
                        id="negativeTags"
                        type="text"
                        value={negativeTags}
                        onChange={(e) => setNegativeTags(e.target.value)}
                        placeholder="e.g., heavy metal, fast drums"
                      />
                    </div>

                    {/* Vocal Gender */}
                    <div className="space-y-2">
                      <Label>Vocal Gender (Optional)</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setVocalGender('auto')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vocalGender === 'auto'
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setVocalGender('m')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vocalGender === 'm'
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Male
                        </button>
                        <button
                          type="button"
                          onClick={() => setVocalGender('f')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            vocalGender === 'f'
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          Female
                        </button>
                      </div>
                    </div>

                    {/* Style Weight */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="styleWeight">
                            Style Weight
                          </Label>
                          <Tooltip content="How closely to follow the style (0 = loose, 1 = strict)" position="right">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">
                          {styleWeight.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        id="styleWeight"
                        value={[styleWeight]}
                        onValueChange={(values) => setStyleWeight(values[0])}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    {/* Weirdness Constraint */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="weirdnessConstraint">
                            Creativity
                          </Label>
                          <Tooltip content="Level of experimental/creative deviation (0 = safe, 1 = experimental)" position="right">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">
                          {weirdnessConstraint.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        id="weirdnessConstraint"
                        value={[weirdnessConstraint]}
                        onValueChange={(values) => setWeirdnessConstraint(values[0])}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    {/* Audio Weight */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="audioWeight">
                            Audio Weight
                          </Label>
                          <Tooltip content="Similarity to original (0 = creative, 1 = original)" position="right">
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </Tooltip>
                        </div>
                        <span className="text-sm text-muted-foreground font-mono">
                          {audioWeight.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        id="audioWeight"
                        value={[audioWeight]}
                        onValueChange={(values) => setAudioWeight(values[0])}
                        min={0}
                        max={1}
                        step={0.01}
                        className="w-full"
                      />
                    </div>

                    {/* Persona ID - Hidden */}
                    {/* <div className="space-y-2">
                      <Label htmlFor="personaId">Persona ID (Optional)</Label>
                      <Input
                        id="personaId"
                        type="text"
                        value={personaId}
                        onChange={(e) => setPersonaId(e.target.value)}
                        placeholder="persona_123"
                      />
                      <p className="text-xs text-muted-foreground">
                        Apply a specific persona style to the generation
                      </p>
                    </div> */}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 积分信息显示 */}
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Cost:</span>
              </div>
              <span className="font-semibold text-primary">{requiredCredits} credits</span>
            </div>
            
            {userCredits !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your balance:</span>
                <span className={`font-medium ${hasEnoughCredits ? 'text-foreground' : 'text-destructive'}`}>
                  {userCredits} credits
                </span>
              </div>
            )}
          </div>

          {/* 积分不足警告 */}
          {!hasEnoughCredits && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Insufficient credits. You need {requiredCredits - (userCredits || 0)} more credits to extend this track.
            </div>
          )}

          {/* 表单验证提示 */}
          {!useDefaultParams && !isFormValid && (
            <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              Please fill in all required fields marked with *
            </div>
          )}
          </div>
        </div>

        {/* 固定底部按钮 */}
        <AlertDialogFooter className="flex-shrink-0 px-6 pt-4 pb-6">
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!hasEnoughCredits || !isFormValid || isExtending}
            className="w-full px-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExtending ? (
              <div className="flex items-center justify-center gap-2">
                <span>Extending</span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                  <div className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                </div>
              </div>
            ) : (
              'Extend'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

