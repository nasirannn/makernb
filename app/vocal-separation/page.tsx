'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WaveformPlayer, type WaveformLoadErrorDetail } from '@/components/ui/waveform-player';
import AuthModal from '@/components/ui/auth-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, Mic, Music, Volume2, Upload, RefreshCw, AlertCircle, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CLIENT_FEATURE_CREDITS, CLIENT_VOCAL_SEPARATION_CREDITS } from '@/lib/credits-config';
import { formatDateTime, formatDuration } from '@/lib/format-utils';
import { useI18n } from '@/lib/i18n/provider';
import { CommonSidebar } from '@/components/ui/sidebar';
import { getZIndexClass } from '@/lib/z-index';
import { toast } from 'sonner';

type SeparationResults = {
  vocals: string;
  accompaniment: string;
};

type SourceTab = 'upload' | 'my-music';

type UserMusicTrack = {
  id: string;
  title: string;
  tags: string;
  createdAt: string;
  audioUrl: string;
  coverR2Url?: string;
  duration?: number;
};

type PendingStartPayload = {
  force: boolean;
  requestKey: string;
  file: File | null;
  audioUrl: string;
  sourceType: 'replicate' | 'kie';
  trackId?: string;
  separationType?: 'separate_vocal' | 'split_stem';
};

type LibrarySeparationType = 'separate_vocal' | 'split_stem';

type SeparationResultSource = 'replicate' | 'kie';

type SeparationHistoryRecord = {
  id: string;
  source: SeparationResultSource;
  separationType?: string;
  status: 'processing' | 'completed' | 'error';
  originalFilename: string;
  originalAudioUrl?: string;
  vocalUrl?: string;
  instrumentalUrl?: string;
  hasPersistentAudio?: boolean;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

const getHistoryRecordKey = (record: SeparationHistoryRecord): string => `${record.source}:${record.id}`;

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeHistoryStatus = (
  rawStatus: unknown,
  context: { hasOutput: boolean; hasError: boolean }
): SeparationHistoryRecord['status'] => {
  const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (status === 'completed' || status === 'complete' || status === 'success' || status === 'succeeded' || status === 'done') {
    return 'completed';
  }
  if (status === 'error' || status === 'failed' || status === 'fail' || status === 'failure' || status === 'cancelled' || status === 'canceled') {
    return 'error';
  }
  if (context.hasError) return 'error';
  if (context.hasOutput) return 'completed';
  return 'processing';
};

export default function VocalSeparationPage() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollingCancelRef = useRef<(() => void) | null>(null);
  const outputRef = useRef<{ audioUrl: string; vocals: string; accompaniment: string }>({
    audioUrl: '',
    vocals: '',
    accompaniment: '',
  });

  const [isOriginalPlaying, setIsOriginalPlaying] = useState(false);
  const [isVocalsPlaying, setIsVocalsPlaying] = useState(false);
  const [isAccompanimentPlaying, setIsAccompanimentPlaying] = useState(false);
  const [hasOriginalError, setHasOriginalError] = useState(false);
  const [hasVocalsError, setHasVocalsError] = useState(false);
  const [hasAccompanimentError, setHasAccompanimentError] = useState(false);
  const [originalLoadIssue, setOriginalLoadIssue] = useState<WaveformLoadErrorDetail | null>(null);
  const [vocalsLoadIssue, setVocalsLoadIssue] = useState<WaveformLoadErrorDetail | null>(null);
  const [accompanimentLoadIssue, setAccompanimentLoadIssue] = useState<WaveformLoadErrorDetail | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [sourceTab, setSourceTab] = useState<SourceTab>('upload');
  const [latestResultSource, setLatestResultSource] = useState<SourceTab | null>(null);
  const [latestFileResultTitle, setLatestFileResultTitle] = useState('');
  const [myMusicTracks, setMyMusicTracks] = useState<UserMusicTrack[]>([]);
  const [isMyMusicLoading, setIsMyMusicLoading] = useState(false);
  const [myMusicError, setMyMusicError] = useState<string | null>(null);
  const [myMusicLoadedUserId, setMyMusicLoadedUserId] = useState<string | null>(null);
  const [librarySeparationType, setLibrarySeparationType] = useState<LibrarySeparationType>('separate_vocal');
  const [selectedMyMusicTrackId, setSelectedMyMusicTrackId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [separationComplete, setSeparationComplete] = useState(false);
  const [separationResults, setSeparationResults] = useState<SeparationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [separationProgress, setSeparationProgress] = useState(0);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingStart, setPendingStart] = useState<PendingStartPayload | null>(null);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [isCacheHit, setIsCacheHit] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<SeparationHistoryRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeHistoryRecordKey, setActiveHistoryRecordKey] = useState<string | null>(null);
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<SeparationHistoryRecord | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  useEffect(() => {
    const syncAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setIsLoggedIn(Boolean(session?.access_token));
        setCurrentUserId(session?.user?.id ?? null);
      } catch (syncError) {
        console.error('Error checking user session:', syncError);
        setIsLoggedIn(false);
        setCurrentUserId(null);
      }
    };

    void syncAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session?.access_token));
      setCurrentUserId(session?.user?.id ?? null);

      if (!session?.access_token) {
        setMyMusicTracks([]);
        setMyMusicError(null);
        setMyMusicLoadedUserId(null);
        setSelectedMyMusicTrackId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    outputRef.current = {
      audioUrl,
      vocals: separationResults?.vocals || '',
      accompaniment: separationResults?.accompaniment || '',
    };
  }, [audioUrl, separationResults]);

  useEffect(() => {
    return () => {
      pollingCancelRef.current?.();
      pollingCancelRef.current = null;
    };
  }, []);

  const selectedMyMusicTrack = useMemo(
    () => myMusicTracks.find((track) => track.id === selectedMyMusicTrackId) ?? null,
    [myMusicTracks, selectedMyMusicTrackId]
  );

  const formatSeparationTypeLabel = useCallback((value?: string): string => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return 'Separate Vocal';
    if (normalized === 'split_stem') return 'Split Stem';
    if (normalized === 'separate_vocal') return 'Separate Vocal';

    return normalized
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }, []);

  const fetchMyMusicTracks = useCallback(async () => {
    if (!isLoggedIn || !currentUserId) {
      setMyMusicTracks([]);
      setIsMyMusicLoading(false);
      setMyMusicError(null);
      return;
    }

    setIsMyMusicLoading(true);
    setMyMusicError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setMyMusicTracks([]);
        setMyMusicError(t('vocalSeparationPage.inputs.myMusic.signInToView'));
        return;
      }

      const response = await fetch(`/api/user-music/${currentUserId}?limit=60&offset=0`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load music list: ${response.status}`);
      }

      const payload = await response.json();
      const generations = Array.isArray(payload?.data?.music) ? payload.data.music : [];
      const flattenedTracks: UserMusicTrack[] = [];

      generations.forEach((generation: any) => {
        const tracks = Array.isArray(generation?.allTracks) ? generation.allTracks : [];
        const generationTitle = typeof generation?.title === 'string' ? generation.title.trim() : '';
        const generationTags = typeof generation?.tags === 'string' ? generation.tags.trim() : '';
        const generationCreatedAt =
          typeof generation?.createdAt === 'string'
            ? generation.createdAt
            : typeof generation?.created_at === 'string'
              ? generation.created_at
              : '';

        tracks.forEach((track: any, index: number) => {
          const audioUrlFromTrack = typeof track?.audioUrl === 'string' ? track.audioUrl.trim() : '';
          if (!audioUrlFromTrack) return;

          const trackId = typeof track?.id === 'string' ? track.id : `${generation?.id || 'gen'}-${index}`;
          const trackTitle = typeof track?.title === 'string' ? track.title.trim() : '';
          const trackCreatedAt = typeof track?.createdAt === 'string' ? track.createdAt : generationCreatedAt;

          flattenedTracks.push({
            id: trackId,
            title: trackTitle || generationTitle || '',
            tags: generationTags,
            createdAt: trackCreatedAt,
            audioUrl: audioUrlFromTrack,
            coverR2Url: typeof track?.coverR2Url === 'string' ? track.coverR2Url : undefined,
            duration:
              typeof track?.duration === 'number'
                ? track.duration
                : typeof track?.duration === 'string'
                  ? Number.parseFloat(track.duration)
                  : undefined,
          });
        });
      });

      flattenedTracks.sort((a, b) => {
        const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTs - aTs;
      });

      setMyMusicTracks(flattenedTracks);
      setMyMusicLoadedUserId(currentUserId);
      setSelectedMyMusicTrackId((prev) =>
        prev && flattenedTracks.some((track) => track.id === prev) ? prev : null
      );
    } catch (fetchError) {
      console.error('Failed to fetch my music tracks:', fetchError);
      setMyMusicTracks([]);
      setMyMusicError(t('vocalSeparationPage.inputs.myMusic.loadFailed'));
    } finally {
      setIsMyMusicLoading(false);
    }
  }, [currentUserId, isLoggedIn, t]);

  const fetchHistoryRecords = useCallback(async () => {
    if (!isLoggedIn || !currentUserId) {
      setHistoryRecords([]);
      setIsHistoryLoading(false);
      setHistoryError(null);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const accessToken = session?.access_token;
      if (!accessToken) {
        setHistoryRecords([]);
        return;
      }

      const response = await fetch('/api/vocal/separation-unified?source=kie&limit=80&offset=0', {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load vocal separation history: ${response.status}`);
      }

      const payload = await response.json();
      if (Array.isArray(payload?.warnings) && payload.warnings.length > 0) {
        console.warn('Unified separation history warnings:', payload.warnings);
      }
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      const normalizedRows: SeparationHistoryRecord[] = rows
        .map((row: any): SeparationHistoryRecord | null => {
          const id = row?.id != null ? String(row.id).trim() : '';
          if (!id) return null;

          const source: SeparationResultSource = row?.source === 'kie' ? 'kie' : 'replicate';
          const vocalUrl = toNonEmptyString(row?.vocalUrl);
          const instrumentalUrl = toNonEmptyString(
            typeof row?.instrumentalUrl === 'string' ? row.instrumentalUrl : row?.accompanimentUrl
          );
          const originalAudioUrl = toNonEmptyString(row?.originalAudioUrl);
          const separationTypeRaw =
            typeof row?.separationType === 'string'
              ? row.separationType
              : typeof row?.separation_type === 'string'
                ? row.separation_type
                : '';
          const separationType = separationTypeRaw.trim().toLowerCase();
          const errorCode =
            typeof row?.errorCode === 'string' || typeof row?.errorCode === 'number'
              ? String(row.errorCode)
              : typeof row?.error_code === 'string' || typeof row?.error_code === 'number'
                ? String(row.error_code)
                : undefined;
          const errorMessage =
            typeof row?.errorMessage === 'string'
              ? row.errorMessage
              : typeof row?.error_message === 'string'
                ? row.error_message
                : undefined;
          const status = normalizeHistoryStatus(row?.status, {
            hasOutput: Boolean(originalAudioUrl || vocalUrl || instrumentalUrl),
            hasError: Boolean(errorCode || errorMessage),
          });

          const originalFilename =
            typeof row?.originalFilename === 'string' && row.originalFilename.trim().length > 0
              ? row.originalFilename.trim()
              : t('vocalSeparationPage.results.separationResultsTitle');

          const createdAt = typeof row?.createdAt === 'string' ? row.createdAt : '';
          const updatedAt = typeof row?.updatedAt === 'string' ? row.updatedAt : createdAt;
          const hasPersistentAudio = Boolean(row?.hasPersistentAudio);

          return {
            id,
            source,
            separationType: separationType || undefined,
            status,
            originalFilename,
            originalAudioUrl: originalAudioUrl || undefined,
            vocalUrl: vocalUrl || undefined,
            instrumentalUrl: instrumentalUrl || undefined,
            hasPersistentAudio,
            errorCode,
            errorMessage,
            createdAt,
            updatedAt,
          };
        })
        .filter((row: SeparationHistoryRecord | null): row is SeparationHistoryRecord => row !== null)
        .sort((a: SeparationHistoryRecord, b: SeparationHistoryRecord) => {
          const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
          const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
          return bTs - aTs;
        });

      setHistoryRecords(normalizedRows);
    } catch (historyFetchError) {
      console.error('Failed to fetch unified vocal separation history:', historyFetchError);
      setHistoryRecords([]);
      setHistoryError(t('toasts.failedToLoadVocalSeparations'));
    } finally {
      setIsHistoryLoading(false);
    }
  }, [currentUserId, isLoggedIn, t]);

  useEffect(() => {
    if (sourceTab !== 'my-music') return;
    if (!isLoggedIn || !currentUserId) return;
    if (isMyMusicLoading) return;
    if (myMusicLoadedUserId === currentUserId) return;
    void fetchMyMusicTracks();
  }, [currentUserId, fetchMyMusicTracks, isLoggedIn, isMyMusicLoading, myMusicLoadedUserId, sourceTab]);

  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      setHistoryRecords([]);
      setActiveHistoryRecordKey(null);
      return;
    }
    void fetchHistoryRecords();
  }, [currentUserId, fetchHistoryRecords, isLoggedIn]);

  const handleWaveformPlayPause = (audioType: 'original' | 'vocals' | 'accompaniment') => {
    if (audioType === 'original') {
      if (isOriginalPlaying) {
        setIsOriginalPlaying(false);
      } else {
        setIsVocalsPlaying(false);
        setIsAccompanimentPlaying(false);
        setIsOriginalPlaying(true);
      }
      return;
    }

    if (audioType === 'vocals') {
      if (isVocalsPlaying) {
        setIsVocalsPlaying(false);
      } else {
        setIsOriginalPlaying(false);
        setIsAccompanimentPlaying(false);
        setIsVocalsPlaying(true);
      }
      return;
    }

    if (isAccompanimentPlaying) {
      setIsAccompanimentPlaying(false);
    } else {
      setIsOriginalPlaying(false);
      setIsVocalsPlaying(false);
      setIsAccompanimentPlaying(true);
    }
  };

  const handleWaveformFinish = () => {
    setIsOriginalPlaying(false);
    setIsVocalsPlaying(false);
    setIsAccompanimentPlaying(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setSourceTab('upload');
    setSelectedMyMusicTrackId(null);
  };

  const handleUploadAreaClick = () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleMyMusicTrackSelect = (track: UserMusicTrack) => {
    if (!track.audioUrl) return;
    setSourceTab('my-music');
    setSelectedMyMusicTrackId(track.id);
    setSelectedFile(null);
    setError(null);
  };

  const formatStatusError = useCallback(
    (fallbackMessage: string, errorCode?: string, errorMessage?: string): string => {
      const message = errorMessage && errorMessage.trim().length > 0 ? errorMessage.trim() : fallbackMessage;
      if (errorCode && errorCode.trim().length > 0) {
        return `${message} (Code: ${errorCode.trim()})`;
      }
      return message;
    },
    []
  );

  const handleOriginLoadError = useCallback((hasError: boolean, detail?: WaveformLoadErrorDetail) => {
    setHasOriginalError(hasError);
    setOriginalLoadIssue(hasError ? (detail || null) : null);
  }, []);

  const handleAccompanimentLoadError = useCallback((hasError: boolean, detail?: WaveformLoadErrorDetail) => {
    setHasAccompanimentError(hasError);
    setAccompanimentLoadIssue(hasError ? (detail || null) : null);
  }, []);

  const handleVocalLoadError = useCallback((hasError: boolean, detail?: WaveformLoadErrorDetail) => {
    setHasVocalsError(hasError);
    setVocalsLoadIssue(hasError ? (detail || null) : null);
  }, []);

  const handleRequestDeleteRecord = useCallback((record: SeparationHistoryRecord | null) => {
    if (!record) return;
    setPendingDeleteRecord(record);
  }, []);

  const handleConfirmDeleteRecord = useCallback(async () => {
    if (!pendingDeleteRecord) return;

    setIsDeletingRecord(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(t('toasts.noValidSessionFound'));
      }

      const response = await fetch(
        `/api/vocal/separation-unified/${encodeURIComponent(pendingDeleteRecord.id)}?source=${encodeURIComponent(pendingDeleteRecord.source)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(t('toasts.failedDeleteVocalSeparation'));
      }

      setHistoryRecords((prev) =>
        prev.filter(
          (record) =>
            !(record.id === pendingDeleteRecord.id && record.source === pendingDeleteRecord.source)
        )
      );
      setActiveHistoryRecordKey((prev) =>
        prev === `${pendingDeleteRecord.source}:${pendingDeleteRecord.id}` ? null : prev
      );

      setHasOriginalError(false);
      setHasVocalsError(false);
      setHasAccompanimentError(false);
      setOriginalLoadIssue(null);
      setVocalsLoadIssue(null);
      setAccompanimentLoadIssue(null);

      toast.success(t('toasts.vocalSeparationDeletedSuccessfully'));
      setPendingDeleteRecord(null);
      await fetchHistoryRecords();
    } catch (deleteError) {
      console.error('Failed to delete vocal separation record:', deleteError);
      toast.error(
        deleteError instanceof Error && deleteError.message
          ? deleteError.message
          : t('toasts.failedDeleteVocalSeparation')
      );
    } finally {
      setIsDeletingRecord(false);
    }
  }, [fetchHistoryRecords, pendingDeleteRecord, t]);

  const startPollingStatus = (predictionId: string, requestKey: string) => {
    const startTime = Date.now();
    const maxPollSeconds = 300;
    let cancelled = false;

    const calculateProgress = (elapsed: number, hasResults: boolean): number => {
      if (hasResults) {
        const base = 60;
        const timeBased = Math.min(30, (elapsed / maxPollSeconds) * 30);
        return Math.min(90, base + timeBased);
      }

      const base = 10;
      const timeBased = Math.min(40, (elapsed / maxPollSeconds) * 40);
      return Math.min(50, base + timeBased);
    };

    const poll = async () => {
      if (cancelled) return;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed > maxPollSeconds) {
        setError(t('vocalSeparationPage.errors.separationTimeout'));
        setIsGenerating(false);
        setSeparationProgress(0);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setIsGenerating(false);
          setSeparationProgress(0);
          return;
        }

        const response = await fetch(`/api/vocal/separation-status?predictionId=${predictionId}`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const hasResults = Boolean(
            outputRef.current.audioUrl || outputRef.current.vocals || outputRef.current.accompaniment
          );
          setSeparationProgress(calculateProgress(elapsed, hasResults));
          setTimeout(poll, 2000);
          return;
        }

        const payload = await response.json();
        if (!payload?.success || !payload.data) {
          const hasResults = Boolean(
            outputRef.current.audioUrl || outputRef.current.vocals || outputRef.current.accompaniment
          );
          setSeparationProgress(calculateProgress(elapsed, hasResults));
          setTimeout(poll, 2000);
          return;
        }

        const data = payload.data;
        const hasOriginalUrl = Boolean(data.originalAudioUrl);
        const hasSplitResults = Boolean(data.vocalUrl || data.instrumentalUrl);

        if (hasOriginalUrl && data.originalAudioUrl !== outputRef.current.audioUrl) {
          setAudioUrl(data.originalAudioUrl);
        }

        if (hasSplitResults) {
          setSeparationResults({
            vocals: data.vocalUrl || '',
            accompaniment: data.instrumentalUrl || '',
          });
        }

        setSeparationProgress(calculateProgress(elapsed, hasOriginalUrl || hasSplitResults));

        if (data.status === 'completed') {
          setSeparationProgress(100);
          setSeparationComplete(true);
          setIsGenerating(false);
          setResultKey(requestKey);
          return;
        }

        if (data.status === 'error') {
          setError(
            formatStatusError(
              t('vocalSeparationPage.errors.separationFailed'),
              typeof data.errorCode === 'string' || typeof data.errorCode === 'number' ? String(data.errorCode) : undefined,
              typeof data.errorMessage === 'string' ? data.errorMessage : undefined
            )
          );
          setIsGenerating(false);
          setSeparationProgress(0);
          return;
        }

        const nextDelay = elapsed < 30 ? 1000 : elapsed < 120 ? 2000 : 3000;
        setTimeout(poll, nextDelay);
      } catch (pollError) {
        console.error('Polling error:', pollError);
        const hasResults = Boolean(
          outputRef.current.audioUrl || outputRef.current.vocals || outputRef.current.accompaniment
        );
        setSeparationProgress(calculateProgress(elapsed, hasResults));
        setTimeout(poll, 2000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      setSeparationProgress(0);
    };
  };

  const startPollingLibraryStatus = (
    taskId: string,
    requestKey: string,
    separationType: LibrarySeparationType = 'separate_vocal'
  ) => {
    const startTime = Date.now();
    const maxPollSeconds = 300;
    let cancelled = false;

    const calculateProgress = (elapsed: number, hasResults: boolean): number => {
      if (hasResults) {
        const base = 60;
        const timeBased = Math.min(30, (elapsed / maxPollSeconds) * 30);
        return Math.min(90, base + timeBased);
      }

      const base = 10;
      const timeBased = Math.min(40, (elapsed / maxPollSeconds) * 40);
      return Math.min(50, base + timeBased);
    };

    const poll = async () => {
      if (cancelled) return;

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed > maxPollSeconds) {
        setError(t('toasts.vocalRemovalTimeoutTryAgain'));
        setIsGenerating(false);
        setSeparationProgress(0);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setIsGenerating(false);
          setSeparationProgress(0);
          return;
        }

        const response = await fetch(`/api/vocal/removal-status?taskId=${taskId}`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const hasResults = Boolean(
            outputRef.current.audioUrl || outputRef.current.vocals || outputRef.current.accompaniment
          );
          setSeparationProgress(calculateProgress(elapsed, hasResults));
          setTimeout(poll, 2000);
          return;
        }

        const payload = await response.json();
        if (!payload?.success || !payload.data) {
          const hasResults = Boolean(
            outputRef.current.audioUrl || outputRef.current.vocals || outputRef.current.accompaniment
          );
          setSeparationProgress(calculateProgress(elapsed, hasResults));
          setTimeout(poll, 2000);
          return;
        }

        const data = payload.data;
        const sourceAudioUrl = selectedMyMusicTrack?.audioUrl?.trim() || '';
        const hasSourceUrl = Boolean(sourceAudioUrl);
        const hasSplitResults = Boolean(data.vocalUrl || data.instrumentalUrl);
        const hasStemResults = Boolean(data.stemsData && Object.keys(data.stemsData).length > 0);

        if (hasSourceUrl && sourceAudioUrl !== outputRef.current.audioUrl) {
          setAudioUrl(sourceAudioUrl);
        }

        if (hasSplitResults) {
          setSeparationResults({
            vocals: data.vocalUrl || '',
            accompaniment: data.instrumentalUrl || '',
          });
        }

        setSeparationProgress(calculateProgress(elapsed, hasSourceUrl || hasSplitResults || hasStemResults));

        if (data.status === 'completed') {
          setSeparationProgress(100);
          setSeparationComplete(true);
          setIsGenerating(false);
          setResultKey(requestKey);
          void fetchHistoryRecords();
          return;
        }

        if (data.status === 'error') {
          const fallbackMessage =
            separationType === 'split_stem'
              ? t('toasts.splitStemFailedTryAgain')
              : t('toasts.vocalSeparationFailedTryAgain');
          setError(
            formatStatusError(
              fallbackMessage,
              typeof data.errorCode === 'string' || typeof data.errorCode === 'number' ? String(data.errorCode) : undefined,
              typeof data.errorMessage === 'string' ? data.errorMessage : undefined
            )
          );
          setIsGenerating(false);
          setSeparationProgress(0);
          void fetchHistoryRecords();
          return;
        }

        const nextDelay = elapsed < 30 ? 1000 : elapsed < 120 ? 2000 : 3000;
        setTimeout(poll, nextDelay);
      } catch (pollError) {
        console.error('KIE polling error:', pollError);
        const hasResults = Boolean(
          outputRef.current.audioUrl || outputRef.current.vocals || outputRef.current.accompaniment
        );
        setSeparationProgress(calculateProgress(elapsed, hasResults));
        setTimeout(poll, 2000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      setSeparationProgress(0);
    };
  };

  const startSeparation = async (options: PendingStartPayload) => {
    const nextResultSource: SourceTab = options.sourceType === 'kie' ? 'my-music' : 'upload';
    setLatestResultSource(nextResultSource);
    if (nextResultSource === 'upload') {
      setLatestFileResultTitle(options.file?.name?.trim() || t('vocalSeparationPage.inputs.uploadLocalFileLabel'));
    }

    pollingCancelRef.current?.();
    pollingCancelRef.current = null;

    setIsGenerating(true);
    setError(null);
    setSeparationComplete(false);
    setSeparationResults(null);
    setSeparationProgress(0);
    setIsCacheHit(false);
    setCacheUpdatedAt(null);
    setResultKey(null);
    setActiveHistoryRecordKey(null);

    setIsOriginalPlaying(false);
    setIsVocalsPlaying(false);
    setIsAccompanimentPlaying(false);
    setHasOriginalError(false);
    setHasVocalsError(false);
    setHasAccompanimentError(false);
    setOriginalLoadIssue(null);
    setVocalsLoadIssue(null);
    setAccompanimentLoadIssue(null);

    setAudioUrl('');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setShowAuthModal(true);
        setIsGenerating(false);
        return;
      }

      if (options.sourceType === 'kie') {
        if (!options.trackId) {
          throw new Error(t('vocalSeparationPage.errors.selectFileOrAudioUrl'));
        }

        const response = await fetch('/api/vocal/removal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            trackId: options.trackId,
            type: options.separationType || 'separate_vocal',
            force: options.force,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.message || result?.error || t('toasts.vocalRemovalFailed'));
        }

        if (result?.success && result?.cacheHit && result?.data?.status === 'completed') {
          const data = result.data;
          setAudioUrl(selectedMyMusicTrack?.audioUrl?.trim() || '');
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
          void fetchHistoryRecords();
          return;
        }

        const taskId = typeof result?.data?.taskId === 'string' ? result.data.taskId : '';
        if (!taskId) {
          throw new Error(t('toasts.noTaskIdReceivedFromServer'));
        }

        void fetchHistoryRecords();
        pollingCancelRef.current = startPollingLibraryStatus(
          taskId,
          options.requestKey,
          options.separationType || 'separate_vocal'
        );
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
        throw new Error(result?.error || t('vocalSeparationPage.errors.separationFailed'));
      }

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

      const predictionId = typeof result?.data?.predictionId === 'string' ? result.data.predictionId : '';
      if (!predictionId) {
        throw new Error(t('toasts.noPredictionIdReceivedFromServer'));
      }

      pollingCancelRef.current = startPollingStatus(predictionId, options.requestKey);
    } catch (startError) {
      console.error('Separation error:', startError);
      setError(startError instanceof Error ? startError.message : t('vocalSeparationPage.errors.separationFailed'));
      setIsGenerating(false);
      setSeparationProgress(0);
    }
  };

  const usingUploadTab = sourceTab === 'upload';
  const activeSourceFile = usingUploadTab ? selectedFile : null;
  const activeSourceAudioUrl = sourceTab === 'my-music'
    ? selectedMyMusicTrack?.audioUrl?.trim() || ''
    : '';
  const activeSourceTrackId = sourceTab === 'my-music'
    ? selectedMyMusicTrack?.id || ''
    : '';

  const canStartSeparation = Boolean(activeSourceFile || activeSourceAudioUrl) && !isGenerating;

  const handleStartSeparating = async () => {
    if (sourceTab === 'my-music') {
      if (!activeSourceTrackId) {
        setError(t('vocalSeparationPage.errors.selectFileOrAudioUrl'));
        return;
      }

      const requestKey = `track:${activeSourceTrackId}:${librarySeparationType}`;
      const hasPlayerTracks = Boolean(audioUrl || separationResults?.vocals || separationResults?.accompaniment);

      if (hasPlayerTracks && resultKey && resultKey !== requestKey) {
        setPendingStart({
          force: false,
          requestKey,
          file: null,
          audioUrl: '',
          sourceType: 'kie',
          trackId: activeSourceTrackId,
          separationType: librarySeparationType,
        });
        setShowConfirmDialog(true);
        return;
      }

      await startSeparation({
        force: false,
        requestKey,
        file: null,
        audioUrl: '',
        sourceType: 'kie',
        trackId: activeSourceTrackId,
        separationType: librarySeparationType,
      });
      return;
    }

    if (!activeSourceFile && !activeSourceAudioUrl) {
      setError(t('vocalSeparationPage.errors.selectFileOrAudioUrl'));
      return;
    }

    const requestKey = activeSourceFile
      ? `file:${activeSourceFile.name}:${activeSourceFile.size}:${activeSourceFile.lastModified}`
      : `url:${activeSourceAudioUrl}`;

    const hasPlayerTracks = Boolean(audioUrl || separationResults?.vocals || separationResults?.accompaniment);
    if (hasPlayerTracks && resultKey && resultKey !== requestKey) {
      setPendingStart({
        force: false,
        requestKey,
        file: activeSourceFile,
        audioUrl: activeSourceAudioUrl,
        sourceType: 'replicate',
      });
      setShowConfirmDialog(true);
      return;
    }

    await startSeparation({
      force: false,
      requestKey,
      file: activeSourceFile,
      audioUrl: activeSourceAudioUrl,
      sourceType: 'replicate',
    });
  };

  const handleConfirmDialog = () => {
    setShowConfirmDialog(false);
    const next = pendingStart;
    setPendingStart(null);
    if (next) {
      void startSeparation(next);
    }
  };

  const handleCancelDialog = () => {
    setShowConfirmDialog(false);
    setPendingStart(null);
  };

  const hasLiveResultTracks = Boolean(separationResults?.vocals || separationResults?.accompaniment);
  const hasLiveResultState = isGenerating || hasLiveResultTracks || Boolean(error);
  const historyPreviewRecords = useMemo(() => historyRecords, [historyRecords]);

  const activeHistoryRecord = useMemo(() => {
    if (!activeHistoryRecordKey) return null;
    const selected = historyPreviewRecords.find((record) => getHistoryRecordKey(record) === activeHistoryRecordKey);
    return selected ?? null;
  }, [activeHistoryRecordKey, historyPreviewRecords]);

  const showUploadCurrentResult = hasLiveResultState && latestResultSource === 'upload';
  const hasActiveLiveResult = showUploadCurrentResult;
  const showResultState = isHistoryLoading || Boolean(historyError) || historyPreviewRecords.length > 0 || hasActiveLiveResult;
  const isShowingHistoryPreview = Boolean(activeHistoryRecord);
  const displayOriginalUrl = isShowingHistoryPreview ? activeHistoryRecord?.originalAudioUrl || '' : audioUrl;
  const displayVocalUrl = isShowingHistoryPreview ? activeHistoryRecord?.vocalUrl || '' : separationResults?.vocals || '';
  const displayInstrumentalUrl = isShowingHistoryPreview
    ? activeHistoryRecord?.instrumentalUrl || ''
    : separationResults?.accompaniment || '';

  const hasLiveDisplayedTracks = Boolean(separationResults?.vocals || separationResults?.accompaniment);
  const hasDisplayedTracks = Boolean(displayVocalUrl || displayInstrumentalUrl);
  const shouldRenderResultPlayers = hasActiveLiveResult && !isShowingHistoryPreview && (isGenerating || hasLiveDisplayedTracks);
  const showTabError = Boolean(error);
  const resultCardTitle = isShowingHistoryPreview
    ? activeHistoryRecord?.originalFilename || t('studioTracks.untitledTrack')
    : latestFileResultTitle || t('vocalSeparationPage.inputs.uploadLocalFileLabel');

  const showOriginExpired = hasOriginalError;
  const showInstrumentalExpired = hasAccompanimentError;
  const showVocalExpired = hasVocalsError;

  useEffect(() => {
    if (historyPreviewRecords.length === 0) {
      setActiveHistoryRecordKey(null);
      return;
    }

    setActiveHistoryRecordKey((prev) => {
      if (prev && historyPreviewRecords.some((record) => getHistoryRecordKey(record) === prev)) {
        return prev;
      }
      if (latestResultSource === 'upload' && showUploadCurrentResult) {
        return null;
      }
      return getHistoryRecordKey(historyPreviewRecords[0]);
    });
  }, [historyPreviewRecords, latestResultSource, showUploadCurrentResult]);

  useEffect(() => {
    setHasOriginalError(false);
    setHasVocalsError(false);
    setHasAccompanimentError(false);
    setOriginalLoadIssue(null);
    setVocalsLoadIssue(null);
    setAccompanimentLoadIssue(null);
  }, [displayOriginalUrl, displayVocalUrl, displayInstrumentalUrl]);

  const resultPlayerBackend: 'WebAudio' | 'MediaElement' = 'MediaElement';

  const resultsHeading = t('vocalSeparationPage.results.separationResultsTitle');

  const getExpiredStatusText = useCallback(
    (issue: WaveformLoadErrorDetail | null): string | null => {
      if (!issue) return null;
      if (typeof issue.statusCode === 'number') {
        return t('vocalSeparationPage.results.audioExpiredStatusCode', { code: issue.statusCode });
      }
      if (issue.message && issue.message.trim().length > 0) {
        return issue.message.trim();
      }
      return null;
    },
    [t]
  );

  const renderExpiredState = useCallback(
    (issue: WaveformLoadErrorDetail | null) => {
      const statusText = getExpiredStatusText(issue);

      return (
        <div className="mt-1 rounded-xl bg-amber-500/10 px-3 py-3">
          <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold leading-relaxed md:text-sm">
                {t('vocalSeparationPage.results.audioExpiredTitle')}
              </p>
              <p className="text-xs leading-relaxed text-amber-700/90 dark:text-amber-200/90 md:text-sm">
                {t('vocalSeparationPage.results.audioExpiredHint')}
              </p>
              {statusText ? (
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-700/90 dark:text-amber-200/90">
                  {statusText}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      );
    },
    [getExpiredStatusText, t]
  );

  const resultPlayers = (
    <div className="space-y-2.5">
      <div className="space-y-2 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Volume2 className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-foreground">{t('vocalSeparationPage.results.instrumental')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!displayInstrumentalUrl || showInstrumentalExpired}
            onClick={() => window.open(displayInstrumentalUrl, '_blank', 'noopener,noreferrer')}
            className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('common.download')}
            title={t('common.download')}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showInstrumentalExpired ? (
          renderExpiredState(accompanimentLoadIssue)
        ) : (
          <WaveformPlayer
            key={`accompaniment-${displayInstrumentalUrl || 'empty'}`}
            audioUrl={displayInstrumentalUrl || undefined}
            backend={resultPlayerBackend}
            isPlaying={isAccompanimentPlaying}
            onPlayPause={() => handleWaveformPlayPause('accompaniment')}
            onFinish={handleWaveformFinish}
            isLoading={
              !isShowingHistoryPreview &&
              isGenerating &&
              (!displayInstrumentalUrl || displayInstrumentalUrl.trim() === '')
            }
            onLoadError={handleAccompanimentLoadError}
            className="mt-1"
          />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mic className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-foreground">{t('vocalSeparationPage.results.vocal')}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!displayVocalUrl || showVocalExpired}
            onClick={() => window.open(displayVocalUrl, '_blank', 'noopener,noreferrer')}
            className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('common.download')}
            title={t('common.download')}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
        {showVocalExpired ? (
          renderExpiredState(vocalsLoadIssue)
        ) : (
          <WaveformPlayer
            key={`vocals-${displayVocalUrl || 'empty'}`}
            audioUrl={displayVocalUrl || undefined}
            backend={resultPlayerBackend}
            isPlaying={isVocalsPlaying}
            onPlayPause={() => handleWaveformPlayPause('vocals')}
            onFinish={handleWaveformFinish}
            isLoading={!isShowingHistoryPreview && isGenerating && (!displayVocalUrl || displayVocalUrl.trim() === '')}
            onLoadError={handleVocalLoadError}
            className="mt-1"
          />
        )}
      </div>
    </div>
  );

  const sourceTabs = (
    <section>
      <div
        role="tablist"
        aria-label={t('vocalSeparationPage.inputs.tabs.tabListLabel')}
        className="app-card-muted flex w-full items-center gap-1 rounded-2xl bg-foreground/5 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-white/10"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sourceTab === 'upload'}
          onClick={() => setSourceTab('upload')}
          className={`h-10 flex-1 rounded-2xl px-4 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:text-sm ${
            sourceTab === 'upload'
              ? 'bg-primary font-semibold text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
              : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
          }`}
        >
          {t('vocalSeparationPage.inputs.tabs.upload')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sourceTab === 'my-music'}
          onClick={() => setSourceTab('my-music')}
          className={`h-10 flex-1 rounded-2xl px-4 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background md:text-sm ${
            sourceTab === 'my-music'
              ? 'bg-primary font-semibold text-primary-foreground shadow-[0_1px_1px_rgba(0,0,0,0.08)]'
              : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground'
          }`}
        >
          {t('vocalSeparationPage.inputs.tabs.myMusic')}
        </button>
      </div>
    </section>
  );

  const panelHeader = (
    <div className="mb-3 px-1 space-y-1.5">
      <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
        {t('nav.vocalSeparation')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('aiTools.vocalSeparationDescription')}
      </p>
    </div>
  );

  const panelFields = (
    <div className={sourceTab === 'my-music' ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-3'}>
      {sourceTab === 'upload' ? (
        <>
          <section className="studio-panel-card rounded-2xl p-3 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">
                {t('vocalSeparationPage.inputs.uploadLocalFileLabel')}
              </h3>
            </div>

            <button
              type="button"
              onClick={handleUploadAreaClick}
              disabled={isGenerating}
              className="h-[160px] w-full rounded-2xl border border-dashed border-slate-300/35 bg-background/20 px-4 py-8 text-center transition-colors hover:border-primary/45 hover:bg-background/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/25"
            >
              <span className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center text-muted-foreground">
                <Upload className="h-6 w-6" strokeWidth={2} />
              </span>
              {selectedFile ? (
                <>
                  <span className="mx-auto block max-w-full truncate text-sm font-semibold leading-tight text-foreground md:text-base">
                    {selectedFile.name}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </>
              ) : (
                <>
                  <span className="block text-sm font-semibold leading-tight text-foreground md:text-base">
                    {t('vocalSeparationPage.inputs.dragDropOrBrowse')}
                  </span>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {t('vocalSeparationPage.inputs.supportedFormats')}
                  </p>
                </>
              )}
            </button>
          </section>

          <section className="studio-panel-card rounded-2xl px-3.5 py-3.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground/90">
                <Info className="h-4 w-4" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('vocalSeparationPage.inputs.uploadTemporaryHint')}
              </p>
            </div>
          </section>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {!isLoggedIn ? (
            <div className="rounded-xl bg-foreground/5 px-3 py-2.5 text-sm text-muted-foreground">
              {t('vocalSeparationPage.inputs.myMusic.signInToView')}
            </div>
          ) : isMyMusicLoading ? (
            <div className="scrollbar-hidden min-h-0 flex-1 space-y-2.5 overflow-y-auto pb-0.5">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`my-music-skeleton-${index}`} className="studio-panel-card rounded-2xl border border-transparent p-1">
                  <div className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 md:gap-3">
                    <Skeleton className="h-[80px] w-[80px] shrink-0 rounded-md" />

                    <div className="min-w-0 flex-1">
                      <div className="flex h-[80px] min-h-0 w-full min-w-0 items-center gap-2.5">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start gap-0.5 py-0">
                          <div className="flex h-6 min-h-0 min-w-0 items-center gap-2">
                            <Skeleton
                              className={`h-4 ${
                                index % 3 === 0 ? 'w-[52%]' : index % 3 === 1 ? 'w-[60%]' : 'w-[46%]'
                              }`}
                            />
                          </div>

                          <div className="flex h-[22px] min-h-0 min-w-0 items-center gap-2">
                            <Skeleton className="h-3 w-10" />
                            <Skeleton className="h-1.5 w-1.5 rounded-full" />
                            <Skeleton className={`h-3 ${index % 2 === 0 ? 'w-[42%]' : 'w-[56%]'}`} />
                          </div>

                          <div className="flex h-8 min-h-0 items-center">
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : myMusicError ? (
            <div className="space-y-2 rounded-xl bg-destructive/10 px-3 py-2.5">
              <p className="text-sm text-destructive">{myMusicError}</p>
              <button
                type="button"
                onClick={() => {
                  void fetchMyMusicTracks();
                }}
                className="text-xs font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                {t('vocalSeparationPage.inputs.myMusic.retry')}
              </button>
            </div>
          ) : myMusicTracks.length === 0 ? (
            <div className="rounded-xl bg-foreground/5 px-3 py-2.5 text-sm text-muted-foreground">
              {t('vocalSeparationPage.inputs.myMusic.empty')}
            </div>
          ) : (
            <div className="scrollbar-hidden min-h-0 flex-1 space-y-2.5 overflow-y-auto pb-0.5">
              {myMusicTracks.map((track) => {
                const isSelected = selectedMyMusicTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    className={`studio-panel-card rounded-2xl p-1 border transition-all duration-150 ${
                      isSelected
                        ? 'border-primary/65 bg-primary/[0.06] shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_10px_24px_hsl(var(--primary)/0.12)]'
                        : 'border-transparent'
                    }`}
                  >
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => handleMyMusicTrackSelect(track)}
                      className={`relative flex w-full items-center gap-2.5 md:gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150 ${
                        isSelected
                          ? 'bg-primary/[0.1] dark:bg-primary/[0.16]'
                          : 'bg-transparent hover:bg-foreground/[0.04] dark:hover:bg-white/[0.06]'
                      } disabled:opacity-60`}
                    >
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary/85"
                        />
                      ) : null}

                      <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-md border border-white/10">
                        {track.coverR2Url ? (
                          <Image
                            src={track.coverR2Url}
                            alt={track.title || t('studioTracks.untitledTrack')}
                            width={80}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="relative h-full w-full overflow-hidden bg-muted/55 dark:bg-muted/25">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-primary/10" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex h-[80px] min-h-0 w-full min-w-0 items-center gap-2.5">
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start gap-0.5 py-0">
                            <div className="flex h-6 min-h-0 min-w-0 items-center gap-2">
                              <p
                                className={`min-w-0 flex-shrink truncate text-sm font-semibold leading-tight ${
                                  isSelected ? 'text-primary' : 'text-foreground'
                                }`}
                              >
                                {track.title || t('studioTracks.untitledTrack')}
                              </p>
                            </div>

                            <div className="flex h-[22px] min-w-0 min-h-0 items-center gap-2">
                              <span className="inline-flex whitespace-nowrap text-xs leading-none text-muted-foreground">
                                {track.duration && track.duration > 0 ? formatDuration(track.duration) : '--:--'}
                              </span>
                              {track.tags ? <span className="text-xs leading-none text-muted-foreground/45">|</span> : null}
                              {track.tags ? (
                                <p className="min-w-0 flex-1 truncate text-xs leading-tight text-muted-foreground">
                                  {track.tags}
                                </p>
                              ) : null}
                            </div>

                            <div className="flex h-8 min-h-0 items-center">
                              <p className="truncate text-xs leading-none text-muted-foreground/60">
                                {track.createdAt
                                  ? formatDateTime(track.createdAt)
                                  : t('vocalSeparationPage.inputs.myMusic.unknownDate')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <section className="studio-panel-card mt-2 rounded-2xl p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-foreground whitespace-nowrap">
                {t('vocalSeparationPage.inputs.separationTypeLabel')}
              </h3>
              <Select
                value={librarySeparationType}
                onValueChange={(value) => setLibrarySeparationType(value as LibrarySeparationType)}
              >
                <SelectTrigger className="h-8 w-[172px] shrink-0 rounded-full border-0 bg-foreground/5 px-3 text-xs font-medium shadow-none focus:ring-primary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="separate_vocal">Separate Vocal</SelectItem>
                  <SelectItem value="split_stem">Split Stem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>
      )}

      {error ? (
        <div className="studio-panel-card rounded-xl bg-destructive/10 p-3">
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm leading-relaxed">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );

  const estimatedCredits = sourceTab === 'my-music'
    ? (
      librarySeparationType === 'split_stem'
        ? CLIENT_FEATURE_CREDITS.split_stem_from_music_studio.credits
        : CLIENT_VOCAL_SEPARATION_CREDITS.studio
    )
    : CLIENT_VOCAL_SEPARATION_CREDITS.local;

  const panelActions = (
    <div className="space-y-2">
      <Button
        size="lg"
        onClick={handleStartSeparating}
        disabled={!canStartSeparation}
        className="h-12 w-full rounded-2xl bg-gradient-create text-white text-base font-semibold transition-opacity hover:opacity-90"
      >
        {isGenerating ? (
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t('vocalSeparationPage.action.separatingProgress', { progress: Math.round(separationProgress) })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Music className="h-4 w-4" />
            {t('vocalSeparationPage.action.startSeparation')}
          </span>
        )}
      </Button>

      {isGenerating ? (
        <div className="space-y-2 px-1 pt-1">
          <Progress value={separationProgress} className="h-2" />
          <p className="text-center text-xs text-muted-foreground">
            {t('vocalSeparationPage.action.processingProgress', { progress: Math.round(separationProgress) })}
          </p>
        </div>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        {t('vocalSeparationPage.action.estimatedTimeCost', { credits: estimatedCredits })}
      </p>
    </div>
  );

  const resultContent = (
    <div className="flex h-full flex-col px-3 pt-3 pb-4">
      <div className="flex flex-1 flex-col space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground md:text-base">{resultsHeading}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t('vocalSeparationPage.results.currentSessionDescription')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <span className="inline-flex h-7 min-w-[56px] items-center justify-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                {Math.round(separationProgress)}%
              </span>
            ) : null}
          </div>
        </div>

        {!showResultState ? (
          <div className="flex flex-1 items-center justify-center px-6 py-6">
            <div className="w-full max-w-[34rem] text-center">
              <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background/65 text-foreground/60 dark:border-white/15 dark:bg-white/[0.08]">
                <Music className="h-4 w-4" strokeWidth={1.9} />
              </div>
              <p className="text-sm font-semibold text-foreground md:text-base">
                {t('vocalSeparationPage.results.separationResultsTitle')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t('vocalSeparationPage.results.noSessionResult')}
              </p>
            </div>
          </div>
        ) : (
          <>
            {isHistoryLoading ? (
              <div className="space-y-2.5">
                <div className="rounded-xl bg-background/75 px-3 py-2.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-10 w-full rounded-lg" />
                </div>
                <div className="rounded-xl bg-background/75 px-3 py-2.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-3 h-10 w-full rounded-lg" />
                </div>
              </div>
            ) : null}

            {!isHistoryLoading && historyError ? (
              <div className="rounded-xl bg-destructive/10 px-3 py-2.5">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs leading-relaxed md:text-sm">{historyError}</p>
                </div>
              </div>
            ) : null}

            {!isHistoryLoading && !historyError && historyPreviewRecords.length > 0 ? (
              <div className="space-y-2.5">
                {historyPreviewRecords.map((record) => {
                  const recordKey = getHistoryRecordKey(record);
                  const isActive = activeHistoryRecordKey === recordKey;
                  const separationTypeLabel = formatSeparationTypeLabel(record.separationType);
                  const isSplitStem = (record.separationType || '').toLowerCase() === 'split_stem';
                  const tagClass = isSplitStem
                    ? 'bg-primary/15 text-primary dark:bg-primary/25 dark:text-primary-foreground/90'
                    : 'bg-foreground/10 text-foreground/75 dark:bg-foreground/15 dark:text-foreground/85';

                  return (
                    <div
                      key={recordKey}
                      className={`studio-panel-card rounded-2xl border p-1 transition-all duration-200 ${
                        isActive
                          ? 'border-primary/55 bg-primary/[0.06] shadow-[0_10px_24px_hsl(var(--primary)/0.14)]'
                          : 'border-transparent bg-transparent hover:border-border/60 hover:bg-foreground/[0.03]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveHistoryRecordKey(recordKey)}
                        className="w-full min-w-0 cursor-pointer rounded-[0.95rem] px-2.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <p className={`line-clamp-1 text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {record.originalFilename}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium ${tagClass}`}>
                            {separationTypeLabel}
                          </span>
                        </div>
                      </button>
                      {isActive && isShowingHistoryPreview && hasDisplayedTracks ? (
                        <div className="mx-2 mb-2 rounded-xl bg-background/55 p-2.5">
                          {resultPlayers}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {showUploadCurrentResult && separationComplete && resultKey?.startsWith('url:') ? (
              <div
                className={`rounded-xl border px-3 py-2.5 ${
                  isCacheHit ? 'border-blue-200 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10' : 'border-border bg-background/55'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className={`text-xs md:text-sm ${isCacheHit ? 'text-blue-700 dark:text-blue-200' : 'text-muted-foreground'}`}>
                    {isCacheHit
                      ? t('vocalSeparationPage.results.showingExistingResult', {
                          updatedAt: cacheUpdatedAt
                            ? ` • ${t('vocalSeparationPage.results.updatedPrefix')} ${formatDateTime(cacheUpdatedAt)}`
                            : '',
                        })
                      : t('vocalSeparationPage.results.freshResultPrompt')}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isGenerating}
                    onClick={() => {
                      if (!resultKey?.startsWith('url:')) return;
                      const cachedUrl = resultKey.slice('url:'.length);
                      void startSeparation({
                        force: true,
                        requestKey: resultKey,
                        file: null,
                        audioUrl: cachedUrl,
                        sourceType: 'replicate',
                      });
                    }}
                    className="h-8 rounded-full bg-foreground/5 px-3 text-xs font-medium text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground"
                  >
                    {t('vocalSeparationPage.results.reseparate')}
                  </Button>
                </div>
              </div>
            ) : null}

            {showTabError ? (
              <div className="rounded-xl bg-destructive/10 px-3 py-2.5">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-xs leading-relaxed md:text-sm">{error}</p>
                </div>
              </div>
            ) : null}

            {shouldRenderResultPlayers ? (
              <div className="grid flex-1 grid-cols-1 content-start">
                <div
                  className={`studio-panel-card rounded-2xl border p-1 ${
                    latestResultSource === 'upload'
                      ? 'border-primary/55 bg-primary/[0.06]'
                      : 'border-border/70 bg-background/60'
                  }`}
                >
                  <div className="rounded-[0.95rem] px-2.5 py-2.5">
                    <p
                      className={`line-clamp-1 text-sm font-semibold ${
                        latestResultSource === 'upload' ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {resultCardTitle}
                    </p>
                  </div>
                  <div className="mx-2 mb-2 rounded-xl bg-background/55 p-2.5">
                    {resultPlayers}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <section id="vocal-separation" className="relative h-screen overflow-hidden">
        <div className="relative h-full flex flex-col md:flex-row md:gap-0 md:px-4 md:py-0 md:pl-[calc(var(--studio-sidebar-width,72px)+1rem)]">
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-4 pb-[calc(var(--mobile-nav-height,64px)+0.75rem)] pt-4 md:hidden">
            <section className="studio-panel-cards rounded-[1.5rem]">
              <div className="space-y-3">
                {panelHeader}
                {sourceTabs}
                {panelFields}
                {panelActions}
              </div>
            </section>

            <section className="studio-panel-cards flex min-h-[240px] flex-col overflow-hidden rounded-[1.5rem]">
              <div className="min-h-0 flex-1 overflow-y-auto">{resultContent}</div>
            </section>
          </div>

          <div className="hidden flex-shrink-0 md:order-2 md:block md:py-2 md:pr-2">
            <section className="studio-panel-cards h-full flex-col overflow-hidden transition-all duration-300 ease-in-out md:flex md:w-[clamp(21rem,30vw,32rem)]">
              <div className="flex-shrink-0 px-0 pt-2 md:pt-4 pb-4">
                {panelHeader}
              </div>
              <div className="flex-shrink-0 px-0 pb-3">{sourceTabs}</div>

              <div
                className={`scrollbar-hidden flex-1 overflow-y-auto px-0 ${
                  sourceTab === 'my-music' ? 'pb-2 md:pb-2' : 'pb-6 md:pb-6'
                }`}
                style={{ scrollbarGutter: 'stable both-edges' }}
              >
                {panelFields}
              </div>

              <div className={`flex-shrink-0 px-0 ${sourceTab === 'my-music' ? 'pb-3 pt-1.5' : 'pb-4 pt-3'}`}>
                {panelActions}
              </div>
            </section>
          </div>

          <div
            className={`hidden md:flex flex-1 min-w-0 h-full ${getZIndexClass('MAIN_CONTENT')} md:order-3 relative md:pb-0 md:pl-2`}
          >
            <div className={`min-h-0 h-full flex flex-col relative w-full ${getZIndexClass('MAIN_CONTENT')}`}>
              <div className="flex flex-col flex-1 min-h-0 min-w-0">
                <div className="relative flex flex-col flex-1 min-h-0 min-w-0 px-0 md:px-0 md:py-2">
                  <section className="studio-panel-cards flex flex-col min-h-0 flex-1 overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto">{resultContent}</div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CommonSidebar variant="studio" />
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={!isLoggedIn}
      />

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">{t('vocalSeparationPage.confirmDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {t('vocalSeparationPage.confirmDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto" onClick={handleCancelDialog}>
              {t('vocalSeparationPage.confirmDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDialog}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              {t('vocalSeparationPage.confirmDialog.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteRecord)}
        onOpenChange={(open) => {
          if (!open && !isDeletingRecord) {
            setPendingDeleteRecord(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
          <AlertDialogHeader className="space-y-2 sm:space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">
              {t('vocalTools.panel.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {t('vocalTools.panel.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <AlertDialogCancel
              className="w-full sm:w-auto"
              disabled={isDeletingRecord}
              onClick={() => setPendingDeleteRecord(null)}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleConfirmDeleteRecord();
              }}
              disabled={isDeletingRecord}
              className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
            >
              {isDeletingRecord ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t('trackActions.delete')}
                </span>
              ) : (
                t('trackActions.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
