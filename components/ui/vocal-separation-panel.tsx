'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useVocalSeparation, VocalSeparationData, VocalSeparationRequest } from '@/hooks/use-vocal-separation';
import { MusicPlayer } from '@/components/ui/music-player';
import { LoadingDots } from '@/components/ui/loading-dots';
import { toast } from 'sonner';
import { Trash2, Play, Pause, Download, Music, Mic, Volume2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface VocalSeparationPanelProps {
  trackId: string;
  audioId: string;
  taskId: string;
  trackTitle: string;
  audioUrl: string;
  duration: number;
  onClose?: () => void;
}

export const VocalSeparationPanel: React.FC<VocalSeparationPanelProps> = ({
  trackId,
  audioId,
  taskId,
  trackTitle,
  audioUrl,
  duration,
  onClose
}) => {
  const { 
    isProcessing, 
    separations, 
    processingTimer, 
    startVocalSeparation, 
    deleteSeparation 
  } = useVocalSeparation();

  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // 获取当前轨道的分离记录 - 简化版本，显示所有分离记录
  const currentSeparations = separations;

  const handleStartSeparation = async () => {
    try {
      const request: VocalSeparationRequest = {
        audioUrl: audioUrl
      };

      await startVocalSeparation(request);
      toast.success('Vocal separation started! Processing time: ~1 minute');
    } catch (error) {
      console.error('Failed to start vocal separation:', error);
    }
  };

  const handlePlayAudio = (url: string) => {
    if (playingAudio === url) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(url);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <LoadingDots />;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI 人声分离</h2>
          <p className="text-muted-foreground">使用AI技术分离人声和伴奏</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        )}
      </div>

      {/* Original Track Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            原始轨道
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">{trackTitle}</h3>
              <p className="text-sm text-muted-foreground">时长: {formatTime(duration)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePlayAudio(audioUrl)}
              >
                {playingAudio === audioUrl ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playingAudio === audioUrl ? '暂停' : '播放'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(audioUrl, `${trackTitle}_original.mp3`)}
              >
                <Download className="h-4 w-4" />
                下载
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Separation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>开始分离</CardTitle>
          <CardDescription>
            开始AI人声分离处理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Clock className="h-4 w-4" />
              <span>预计处理时间: 1分钟 • 消耗积分: 3</span>
            </div>
          </div>

          <Button
            onClick={handleStartSeparation}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <LoadingDots />
                处理中... ({formatTime(processingTimer)})
              </>
            ) : (
              '开始分离'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Separation Results */}
      {currentSeparations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>分离结果</CardTitle>
            <CardDescription>
              查看和管理您的人声分离结果
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentSeparations.map((separation) => (
                <div key={separation.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(separation.status)}
                      <span className="font-medium">
                        人声+伴奏分离
                      </span>
                      <Badge className={getStatusColor(separation.status)}>
                        {separation.status === 'processing' ? '处理中' : 
                         separation.status === 'completed' ? '完成' : '失败'}
                      </Badge>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除分离结果</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定要删除这个人声分离结果吗？此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteSeparation(separation.id)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {separation.status === 'completed' && (
                    <div className="space-y-3">
                      {/* Vocal Track */}
                      {separation.vocalUrl && (
                        <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-pink-600" />
                            <span className="font-medium">人声轨道</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePlayAudio(separation.vocalUrl!)}
                            >
                              {playingAudio === separation.vocalUrl ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(separation.vocalUrl!, `${trackTitle}_vocal.mp3`)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Instrumental Track */}
                      {separation.instrumentalUrl && (
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Music className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">伴奏轨道</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePlayAudio(separation.instrumentalUrl!)}
                            >
                              {playingAudio === separation.instrumentalUrl ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(separation.instrumentalUrl!, `${trackTitle}_instrumental.mp3`)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {separation.status === 'error' && separation.errorMessage && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-800">{separation.errorMessage}</p>
                    </div>
                  )}

                  {separation.status === 'processing' && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <LoadingDots />
                        <span className="text-sm text-blue-800">正在处理中...</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audio Player - 简化版本，暂时移除 */}
      {playingAudio && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-sm">正在播放: {playingAudio === audioUrl ? trackTitle : '分离轨道'}</p>
            <Button onClick={() => setPlayingAudio(null)} className="mt-2">
              关闭播放器
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
