'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useVocalSeparation, VocalSeparationRequest } from '@/features/vocal-tools/hooks/use-vocal-separation';
import { LoadingDots } from '@/components/ui/loading-dots';
import { toast } from 'sonner';
import { Trash2, Play, Pause, Download, Music, Mic, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
  trackId: _trackId,
  audioId: _audioId,
  taskId: _taskId,
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

  // 获取当前轨道的分离记录
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
      toast.error('Failed to start vocal separation');
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
          <h2 className="text-2xl font-bold">AI Vocal Separation</h2>
          <p className="text-muted-foreground">Split vocals and instrumentals with AI.</p>
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
            Original Track
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h3 className="font-medium">{trackTitle}</h3>
              <p className="text-sm text-muted-foreground">Duration: {formatTime(duration)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePlayAudio(audioUrl)}
              >
                {playingAudio === audioUrl ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playingAudio === audioUrl ? 'Pause' : 'Play'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(audioUrl, `${trackTitle}_original.mp3`)}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Separation Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Start Separation</CardTitle>
          <CardDescription>
            Start the AI vocal separation process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Clock className="h-4 w-4" />
              <span>Estimated time: 1 min • Credits used: 3</span>
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
                Processing... ({formatTime(processingTimer)})
              </>
            ) : (
              'Start Separation'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Separation Results */}
      {currentSeparations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Separation Results</CardTitle>
            <CardDescription>
              View and manage your separation results.
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
                        Vocal + Instrumental Split
                      </span>
                      <Badge className={getStatusColor(separation.status)}>
                        {separation.status === 'processing' ? 'Processing' : 
                         separation.status === 'completed' ? 'Completed' : 'Failed'}
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
                          <AlertDialogTitle>Delete Separation</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete this separation result? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                            deleteSeparation(separation.id);
                          }}>
                            Delete
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
                            <span className="font-medium">Vocal Track</span>
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
                            <span className="font-medium">Instrumental Track</span>
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
                        <span className="text-sm text-blue-800">Processing...</span>
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
            <p className="text-sm">Now playing: {playingAudio === audioUrl ? trackTitle : 'Separated Track'}</p>
            <Button onClick={() => setPlayingAudio(null)} className="mt-2">
              Close Player
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
