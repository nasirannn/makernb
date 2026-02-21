'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
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
import { RefreshCw, AlertCircle, Music, Wand2, Trash2, Search, X, ArrowDownUp, MoreHorizontal } from 'lucide-react';
import AuthModal from '@/components/ui/auth-modal';
import { CommonSidebar } from '@/components/ui/sidebar';
import { CLIENT_FEATURE_CREDITS } from '@/lib/credits-config';
import { useAuth } from '@/contexts/AuthContext';
import presetsData from '@/data/lyrics-presets.json';
import { supabase } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n/provider';
import { withLocalePrefix } from '@/lib/i18n/routing';
import { getZIndexClass } from '@/lib/z-index';

type GeneratedLyricsItem = {
  title: string;
  text: string;
};

type LyricsGenerationRecord = {
  taskId: string;
  createdAt: string;
  status?: string;
  errorMessage?: string | null;
  lyrics: GeneratedLyricsItem[];
};

type PendingDeleteTarget = {
  taskId: string;
  lyricsIndex?: number;
  deleteKey: string;
};

const LyricsResultsSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-2.5 px-3 pb-3">
    {[...Array(count)].map((_, index) => (
      <div key={index} className="studio-panel-card rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between rounded-xl bg-background/55 px-3 py-2">
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>

        <div className="rounded-2xl bg-background/65 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-44 max-w-[70%]" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>

          <div className="rounded-xl bg-background/75 px-3 py-2.5 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-[92%]" />
            <Skeleton className="h-3.5 w-[88%]" />
            <Skeleton className="h-3.5 w-[76%]" />
          </div>

          <div className="flex items-center justify-end gap-1.5">
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const STRUCTURE_OPTIONS = [
  { value: 'Verse-Chorus', labelKey: 'lyricsGeneratorPage.form.structureOptions.verseChorus' },
  { value: 'Verse-Chorus-Bridge', labelKey: 'lyricsGeneratorPage.form.structureOptions.verseChorusBridge' },
  { value: 'AABA', labelKey: 'lyricsGeneratorPage.form.structureOptions.aaba' },
  { value: 'ABABCB', labelKey: 'lyricsGeneratorPage.form.structureOptions.ababcb' },
  { value: 'Free Form', labelKey: 'lyricsGeneratorPage.form.structureOptions.freeForm' },
] as const;
const DESCRIBE_SONG_MAX_LENGTH = 200;

export default function LyricsGeneratorPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const withCurrentLocale = useCallback((path: string) => withLocalePrefix(path, locale), [locale]);
  const { user } = useAuth();
  const isLoggedIn = !!user;

  const [songTitle, setSongTitle] = useState('');
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [lyricsRecords, setLyricsRecords] = useState<LyricsGenerationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGeneratingNoticeDialog, setShowGeneratingNoticeDialog] = useState(false);
  const [pendingGeneratingTaskId, setPendingGeneratingTaskId] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<PendingDeleteTarget | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingResultKeys, setDeletingResultKeys] = useState<string[]>([]);
  const [resultsSearchQuery, setResultsSearchQuery] = useState('');
  const [createdAtSortOrder, setCreatedAtSortOrder] = useState<'desc' | 'asc'>('desc');

  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedStructure, setSelectedStructure] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');

  const currentLocaleLanguageLabel = useMemo(() => {
    const normalizedLocale = locale.toLowerCase();
    if (normalizedLocale.startsWith('zh')) return '简体中文';
    if (normalizedLocale.startsWith('ja')) return '日本語';
    return 'English';
  }, [locale]);

  const buildRequestPrompt = useCallback(() => {
    const promptParts: string[] = [];

    if (songTitle.trim()) promptParts.push(`Title: ${songTitle.trim()}`);
    if (selectedTheme.trim()) promptParts.push(`Theme: ${selectedTheme.trim()}`);
    if (selectedMood.trim()) promptParts.push(`Mood: ${selectedMood.trim()}`);
    if (selectedStructure.trim()) promptParts.push(`Structure: ${selectedStructure.trim()}`);
    if (selectedStyle.trim()) promptParts.push(`Style: ${selectedStyle.trim()}`);
    if (currentLocaleLanguageLabel.trim()) promptParts.push(`Language: ${currentLocaleLanguageLabel.trim()}`);
    if (prompt.trim()) promptParts.push(prompt.trim());

    return promptParts.join('\n');
  }, [currentLocaleLanguageLabel, prompt, selectedMood, selectedStructure, selectedStyle, selectedTheme, songTitle]);

  const normalizeLyricsForDisplay = useCallback((lyrics: any[]): GeneratedLyricsItem[] => {
    return lyrics
      .map((item: any, index: number) => {
        const text = typeof item?.text === 'string' ? item.text.trim() : '';
        if (!text) return null;
        const title =
          typeof item?.title === 'string' && item.title.trim()
            ? item.title.trim()
            : `${t('lyricsGeneratorPage.results.heading')} ${index + 1}`;
        return { title, text };
      })
      .filter((item: GeneratedLyricsItem | null): item is GeneratedLyricsItem => item !== null);
  }, [t]);

  const loadLyricsHistoryFromServer = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
    if (showLoading) {
      setIsHistoryLoading(true);
    }

    if (!isLoggedIn) {
      setLyricsRecords([]);
      setIsHistoryLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let accessToken = session?.access_token;
      if (!accessToken) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        accessToken = refreshedSession?.access_token;
      }

      if (!accessToken) {
        return;
      }

      const pageSize = 100;
      const allItems: any[] = [];
      let offset = 0;

      while (true) {
        const response = await fetch(`/api/lyrics/generations?limit=${pageSize}&offset=${offset}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const result = await response.json();

        if (!response.ok || !result?.success) {
          throw new Error(t('lyricsGeneratorPage.errors.failedLoadResults'));
        }

        const pageItems = Array.isArray(result?.data?.items) ? result.data.items : [];
        allItems.push(...pageItems);

        if (pageItems.length < pageSize) {
          break;
        }

        offset += pageSize;
      }

      const serverItems = allItems;
      const normalizedRecords = serverItems
        .map((item: any) => {
          const taskId = typeof item?.taskId === 'string' ? item.taskId : '';
          const createdAt = typeof item?.createdAt === 'string' ? item.createdAt : '';
          const status = typeof item?.status === 'string' ? item.status : '';
          const errorMessage = typeof item?.errorMessage === 'string' ? item.errorMessage : null;
          const lyrics = normalizeLyricsForDisplay(Array.isArray(item?.lyrics) ? item.lyrics : []);
          if (!taskId || lyrics.length === 0) {
            return null;
          }
          return {
            taskId,
            createdAt,
            status,
            errorMessage,
            lyrics,
          } as LyricsGenerationRecord;
        })
        .filter((item: LyricsGenerationRecord | null): item is LyricsGenerationRecord => item !== null);

      if (normalizedRecords.length === 0) {
        setError(null);
        setLyricsRecords([]);
        return;
      }

      setError(null);
      setLyricsRecords(normalizedRecords);
    } catch (err) {
      console.error('Failed to load lyrics results:', err);
      setError(t('lyricsGeneratorPage.errors.failedLoadResults'));
    } finally {
      setIsHistoryLoading(false);
    }
  }, [isLoggedIn, normalizeLyricsForDisplay, t]);

  useEffect(() => {
    void loadLyricsHistoryFromServer({ showLoading: true });
  }, [loadLyricsHistoryFromServer]);

  const handleGenerateLyrics = async () => {
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    if (!prompt.trim()) {
      setError(t('lyricsGeneratorPage.errors.enterThemeOrPrompt'));
      return;
    }

    const requestPrompt = buildRequestPrompt();
    if (!requestPrompt.trim()) {
      setError(t('lyricsGeneratorPage.errors.enterThemeOrPrompt'));
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession?.access_token) {
          return await makeApiCall(refreshedSession.access_token, requestPrompt);
        }
        throw new Error(t('lyricsGeneratorPage.errors.failedGetSessionLoginAgain'));
      }

      if (!session?.access_token) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession?.access_token) {
          return await makeApiCall(refreshedSession.access_token, requestPrompt);
        }
        throw new Error(t('lyricsGeneratorPage.errors.pleaseLoginGenerateLyrics'));
      }

      await makeApiCall(session.access_token, requestPrompt);
    } catch (err) {
      console.error('Error generating lyrics:', err);
      setError(err instanceof Error ? err.message : t('lyricsGeneratorPage.errors.failedGenerateLyrics'));
      setIsGenerating(false);
    }
  };

  const makeApiCall = async (token: string, requestPrompt: string) => {
    try {
      const response = await fetch('/api/lyrics/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: requestPrompt,
          title: songTitle.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        throw new Error(t('lyricsGeneratorPage.errors.sessionExpiredLoginAgain'));
      }

      if (!result.success) {
        throw new Error(result.error || t('lyricsGeneratorPage.errors.failedGenerateLyrics'));
      }

      if (result.data?.taskId) {
        setPendingGeneratingTaskId(result.data.taskId);
        setShowGeneratingNoticeDialog(true);
        return;
      } else if (result.data?.generationFailed) {
        setError(result.data.errorMessage || t('lyricsGeneratorPage.errors.lyricsGenerationFailed'));
        await loadLyricsHistoryFromServer();
      } else {
        throw new Error(t('lyricsGeneratorPage.errors.noTaskIdReceived'));
      }
    } catch (err) {
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const pollLyricsStatus = async (taskId: string) => {
    const maxAttempts = 30;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/lyrics/status/${taskId}`);
        const result = await response.json();

        if (result.success) {
          if (result.data?.status === 'complete' && Array.isArray(result.data?.lyrics)) {
            await loadLyricsHistoryFromServer();
            return;
          } else if (result.data?.status === 'error') {
            setError(result.data.error || t('lyricsGeneratorPage.errors.lyricsGenerationFailed'));
            await loadLyricsHistoryFromServer();
            return;
          }
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setError(t('lyricsGeneratorPage.errors.lyricsGenerationTimedOut'));
        }
      } catch (err) {
        console.error('Error polling lyrics status:', err);
        setError(t('lyricsGeneratorPage.errors.failedCheckStatus'));
      }
    };

    poll();
  };

  const handleConfirmGeneratingNotice = async () => {
    const taskId = pendingGeneratingTaskId;
    setPendingGeneratingTaskId(null);
    setShowGeneratingNoticeDialog(false);

    if (!taskId) {
      return;
    }

    await loadLyricsHistoryFromServer();
    await pollLyricsStatus(taskId);
  };

  const handleDeleteResults = async (target: PendingDeleteTarget) => {
    const { taskId, lyricsIndex, deleteKey } = target;

    if (!taskId || deletingResultKeys.includes(deleteKey)) {
      return;
    }

    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }

    setDeletingResultKeys((prev) => [...prev, deleteKey]);
    setError(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw new Error(t('lyricsGeneratorPage.errors.failedDeleteResults'));
      }

      let accessToken = session?.access_token;
      if (!accessToken) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        accessToken = refreshedSession?.access_token;
      }

      if (!accessToken) {
        throw new Error(t('lyricsGeneratorPage.errors.sessionExpiredLoginAgain'));
      }

      const deleteQuery =
        typeof lyricsIndex === 'number'
          ? `?lyricsIndex=${encodeURIComponent(String(lyricsIndex))}`
          : '';

      const response = await fetch(`/api/lyrics/generation/${encodeURIComponent(taskId)}${deleteQuery}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(t('lyricsGeneratorPage.errors.failedDeleteResults'));
      }
      await loadLyricsHistoryFromServer();
      toast.success(t('lyricsGeneratorPage.results.deleteSuccess'));
    } catch (err) {
      console.error('Failed to delete lyrics results:', err);
      setError(err instanceof Error ? err.message : t('lyricsGeneratorPage.errors.failedDeleteResults'));
    } finally {
      setDeletingResultKeys((prev) => prev.filter((key) => key !== deleteKey));
    }
  };

  const handleRequestDeleteResults = (target: PendingDeleteTarget) => {
    if (!target.taskId || deletingResultKeys.includes(target.deleteKey)) {
      return;
    }

    setPendingDeleteTarget(target);
    setShowDeleteConfirmDialog(true);
  };

  const handleConfirmDeleteResults = async () => {
    if (!pendingDeleteTarget) {
      setShowDeleteConfirmDialog(false);
      return;
    }

    await handleDeleteResults(pendingDeleteTarget);
    setShowDeleteConfirmDialog(false);
    setPendingDeleteTarget(null);
  };

  const handleCopyLyrics = async (lyrics: GeneratedLyricsItem, copyKey: string) => {
    try {
      const textToCopy = `${lyrics.title}\n\n${lyrics.text}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopiedKey(copyKey);
      setTimeout(() => setCopiedKey((current) => (current === copyKey ? null : current)), 2000);
    } catch (err) {
      console.error('Failed to copy lyrics:', err);
    }
  };

  const handleDownloadLyrics = (lyrics: GeneratedLyricsItem) => {
    const content = `${lyrics.title}\n\n${lyrics.text}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lyrics.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUseLyricsForMusic = (lyrics: GeneratedLyricsItem) => {
    const trimmedLyrics = lyrics.text.trim();
    if (!trimmedLyrics) return;

    const payload = {
      title: lyrics.title.trim().slice(0, 80),
      lyrics: trimmedLyrics,
    };

    try {
      const transferKey = `lyrics_prefill_${Date.now()}`;
      window.sessionStorage.setItem(transferKey, JSON.stringify(payload));
      const params = new URLSearchParams();
      params.set('lyricsPrefillKey', transferKey);
      params.set('mode', 'custom');
      params.set('tab', 'lyrics');
      router.push(withCurrentLocale(`/music-generator?${params.toString()}`));
      return;
    } catch {
      const params = new URLSearchParams();
      params.set('lyrics', payload.lyrics.slice(0, 3500));
      if (payload.title) {
        params.set('title', payload.title);
      }
      params.set('mode', 'custom');
      params.set('tab', 'lyrics');
      router.push(withCurrentLocale(`/music-generator?${params.toString()}`));
    }
  };

  const panelFields = (
    <div className="space-y-3">
      <section className="studio-panel-card rounded-2xl p-3 space-y-2">
        <label className="text-sm font-semibold text-foreground">
          {t('featurePanel.title')} ({t('featurePanel.optional')})
        </label>
        <Input
          value={songTitle}
          onChange={(event) => setSongTitle(event.target.value.slice(0, 80))}
          placeholder={t('featurePanel.enterSongTitle')}
          className="h-11 rounded-xl border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isGenerating}
        />
        <p className="text-xs text-muted-foreground">{songTitle.length}/80</p>
      </section>

      <section className="studio-panel-card rounded-2xl p-3 space-y-2">
        <label className="text-sm font-semibold text-foreground">
          {t('lyricsGeneratorPage.form.describeSong')}
        </label>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value.slice(0, DESCRIBE_SONG_MAX_LENGTH))}
          maxLength={DESCRIBE_SONG_MAX_LENGTH}
          placeholder={t('lyricsGeneratorPage.promptPlaceholder')}
          className="min-h-[180px] md:min-h-[200px] resize-none pl-0 pt-2 pr-0 pb-2 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={isGenerating}
        />
        <p className="text-xs text-muted-foreground">{prompt.length}/{DESCRIBE_SONG_MAX_LENGTH}</p>
      </section>

      <section className="studio-panel-card rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('lyricsGeneratorPage.form.popularThemes')}
            </label>
            <Select value={selectedTheme} onValueChange={setSelectedTheme} disabled={isGenerating}>
              <SelectTrigger className="h-10 rounded-xl border-0 bg-transparent focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder={t('lyricsGeneratorPage.form.popularThemes')} />
              </SelectTrigger>
              <SelectContent>
                {presetsData.themes.map((theme) => (
                  <SelectItem key={theme} value={theme}>
                    {theme}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('lyricsGeneratorPage.form.moods')}
            </label>
            <Select value={selectedMood} onValueChange={setSelectedMood} disabled={isGenerating}>
              <SelectTrigger className="h-10 rounded-xl border-0 bg-transparent focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder={t('lyricsGeneratorPage.form.moods')} />
              </SelectTrigger>
              <SelectContent>
                {presetsData.moods.map((mood) => (
                  <SelectItem key={mood} value={mood}>
                    {mood}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('lyricsGeneratorPage.form.structure')}
            </label>
            <Select value={selectedStructure} onValueChange={setSelectedStructure} disabled={isGenerating}>
              <SelectTrigger className="h-10 rounded-xl border-0 bg-transparent focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder={t('lyricsGeneratorPage.form.structure')} />
              </SelectTrigger>
              <SelectContent>
                {STRUCTURE_OPTIONS.map((structure) => (
                  <SelectItem key={structure.value} value={structure.value}>
                    {t(structure.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t('lyricsGeneratorPage.form.musicalStyles')}
            </label>
            <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isGenerating}>
              <SelectTrigger className="h-10 rounded-xl border-0 bg-transparent focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder={t('lyricsGeneratorPage.form.musicalStyles')} />
              </SelectTrigger>
              <SelectContent>
                {presetsData.styles.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {error && (
        <div className="studio-panel-card rounded-xl bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
    </div>
  );

  const panelActions = (
    <div className="space-y-2">
      <Button
        onClick={handleGenerateLyrics}
        disabled={isGenerating || !prompt.trim()}
        className="h-12 w-full rounded-2xl bg-gradient-create text-white text-base font-semibold hover:opacity-90 transition-opacity"
      >
        {isGenerating ? (
          <span className="inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t('lyricsGeneratorPage.form.generatingLyrics')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            {t('lyricsGeneratorPage.form.generateLyrics')}
          </span>
        )}
      </Button>
      <div className="flex items-center justify-center">
        <p className="text-xs text-center text-muted-foreground">
          {t('lyricsGeneratorPage.form.estimatedTimeCost', {
            credits: CLIENT_FEATURE_CREDITS.generate_lyrics.credits,
          })}
        </p>
      </div>
    </div>
  );

  const filteredAndSortedLyricsRecords = useMemo(() => {
    const query = resultsSearchQuery.trim().toLowerCase();
    const filtered = lyricsRecords.filter((record) => {
      if (!query) return true;
      return record.lyrics.some((lyrics) => {
        return lyrics.title.toLowerCase().includes(query) || lyrics.text.toLowerCase().includes(query);
      });
    });

    filtered.sort((a, b) => {
      const createdAtA = new Date(a.createdAt).getTime() || 0;
      const createdAtB = new Date(b.createdAt).getTime() || 0;
      return createdAtSortOrder === 'desc' ? createdAtB - createdAtA : createdAtA - createdAtB;
    });

    return filtered;
  }, [createdAtSortOrder, lyricsRecords, resultsSearchQuery]);

  const hasAnyLyricsResults = lyricsRecords.length > 0;
  const hasSearchQuery = Boolean(resultsSearchQuery.trim());
  const isGeneratingWithoutResults = isGenerating && !hasAnyLyricsResults;
  const showNoSearchMatches =
    !isHistoryLoading && hasSearchQuery && hasAnyLyricsResults && filteredAndSortedLyricsRecords.length === 0;

  const resultToolbar = (
    <div className="flex-shrink-0 px-3 pt-3 pb-2">
      <div className="studio-panel-card rounded-2xl p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative h-11 flex-1 rounded-xl bg-background/70 text-foreground/90 transition-colors">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" />
            <input
              type="text"
              value={resultsSearchQuery}
              onChange={(event) => setResultsSearchQuery(event.target.value)}
              placeholder={t('lyricsGeneratorPage.results.searchPlaceholder')}
              className="h-full w-full rounded-xl bg-transparent pl-10 pr-9 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none"
            />
            {resultsSearchQuery && (
              <button
                type="button"
                onClick={() => setResultsSearchQuery('')}
                className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                aria-label={t('common.clear')}
                title={t('common.clear')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCreatedAtSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
            className={`inline-flex h-10 min-w-[112px] items-center justify-center gap-1.5 rounded-xl bg-background/70 px-3 text-xs md:text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground ${
              createdAtSortOrder === 'desc' ? 'text-foreground' : 'text-foreground/80'
            }`}
            aria-label={
              createdAtSortOrder === 'desc'
                ? t('lyricsGeneratorPage.results.sortByNewestFirst')
                : t('lyricsGeneratorPage.results.sortByOldestFirst')
            }
            title={
              createdAtSortOrder === 'desc'
                ? t('lyricsGeneratorPage.results.sortByNewestFirst')
                : t('lyricsGeneratorPage.results.sortByOldestFirst')
            }
            aria-pressed={createdAtSortOrder === 'asc'}
          >
            <ArrowDownUp
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                createdAtSortOrder === 'asc' ? 'rotate-180' : ''
              }`}
            />
            <span>
              {createdAtSortOrder === 'desc'
                ? t('lyricsGeneratorPage.results.sortNewest')
                : t('lyricsGeneratorPage.results.sortOldest')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  const resultContent = isHistoryLoading ? (
    <LyricsResultsSkeleton />
  ) : filteredAndSortedLyricsRecords.length === 0 ? (
    <div className="relative min-h-full">
      <div className="absolute inset-0 flex items-center justify-center px-3">
        <div className="w-full max-w-[560px] px-6 py-9 text-center">
          <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-background/65 text-foreground/60 dark:border-white/15 dark:bg-white/[0.08]">
            {isGeneratingWithoutResults ? (
              <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.9} />
            ) : (
              <Music className="h-4 w-4" strokeWidth={1.9} />
            )}
          </div>

          <h3 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
            {showNoSearchMatches
              ? t('lyricsGeneratorPage.results.noMatchesTitle')
              : isGeneratingWithoutResults
                ? t('lyricsGeneratorPage.form.generatingLyrics')
                : t('lyricsGeneratorPage.results.emptyTitle')}
          </h3>

          <p className="mx-auto mt-2 max-w-[44ch] text-sm md:text-base text-muted-foreground leading-relaxed">
            {showNoSearchMatches
              ? t('lyricsGeneratorPage.results.noMatchesDescription', { query: resultsSearchQuery.trim() })
              : isGeneratingWithoutResults
                ? t('lyricsGeneratorPage.results.craftingLyrics')
                : t('lyricsGeneratorPage.results.emptyDescription')}
          </p>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-2.5 px-3 pb-3 min-h-full">
      {filteredAndSortedLyricsRecords.map((record) => {
        const recordDeleteKey = record.taskId;
        const isDeletingRecord = deletingResultKeys.includes(recordDeleteKey);
        const createdAtLabel = record.createdAt ? new Date(record.createdAt).toLocaleString(locale) : '';
        const normalizedStatus = (record.status || '').toLowerCase();
        const hasErrorMessage = Boolean(record.errorMessage?.trim());
        const isErrorRecord =
          hasErrorMessage ||
          normalizedStatus === 'error' ||
          normalizedStatus === 'failed' ||
          normalizedStatus === 'failure';
        const isGeneratingRecord =
          normalizedStatus === 'generating' || normalizedStatus === 'processing' || normalizedStatus === 'pending';

        return (
          <article key={record.taskId} className="studio-panel-card rounded-2xl p-3 space-y-3">
            <div className="flex w-full items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs text-muted-foreground/80">
                {createdAtLabel}
              </p>

              {(isErrorRecord || isGeneratingRecord) && (
                <Button
                  onClick={() => handleRequestDeleteResults({ taskId: record.taskId, deleteKey: recordDeleteKey })}
                  variant="ghost"
                  size="sm"
                  disabled={isDeletingRecord}
                  aria-label={
                    isDeletingRecord
                      ? t('lyricsGeneratorPage.results.deletingResults')
                      : t('lyricsGeneratorPage.results.deleteResults')
                  }
                  title={
                    isDeletingRecord
                      ? t('lyricsGeneratorPage.results.deletingResults')
                      : t('lyricsGeneratorPage.results.deleteResults')
                  }
                  className="h-8 rounded-full bg-foreground/5 px-3 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <Trash2 className={`mr-1.5 h-3.5 w-3.5 ${isDeletingRecord ? 'opacity-60' : ''}`} />
                  {isDeletingRecord
                    ? t('lyricsGeneratorPage.results.deletingResults')
                    : t('lyricsGeneratorPage.results.deleteResults')}
                </Button>
              )}
            </div>

            {isErrorRecord ? (
              <div className="rounded-xl bg-destructive/10 px-3 py-3">
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      {t('lyricsGeneratorPage.results.failedTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-destructive/85">
                      {record.errorMessage?.trim()
                        ? record.errorMessage
                        : t('lyricsGeneratorPage.results.failedDescription')}
                    </p>
                  </div>
                </div>
              </div>
            ) : isGeneratingRecord ? (
              <div className="rounded-xl bg-background/75 px-3 py-3">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-foreground/85">
                      {t('lyricsGeneratorPage.results.generatingTitle')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {t('lyricsGeneratorPage.results.generatingDescription')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`grid grid-cols-1 gap-2.5 ${record.lyrics.length > 1 ? 'md:grid-cols-2' : ''}`}>
                {record.lyrics.map((lyrics, index) => {
                  const copyKey = `${record.taskId}-${index}`;
                  const deleteKey = `${record.taskId}-${index}`;
                  const isDeletingLyrics = deletingResultKeys.includes(deleteKey);
                  return (
                    <section key={copyKey} className="rounded-xl bg-background/75 px-3 py-2.5 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <h3 className="min-w-0 flex-1 text-sm md:text-base font-semibold leading-tight tracking-tight text-foreground">
                          <span className="block truncate">{lyrics.title}</span>
                        </h3>
                      </div>

                      <div className="max-h-56 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                          {lyrics.text}
                        </pre>
                      </div>

                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleUseLyricsForMusic({ title: lyrics.title, text: lyrics.text })}
                          variant="ghost"
                          size="sm"
                          aria-label={t('lyricsGeneratorPage.results.useForMusic')}
                          title={t('lyricsGeneratorPage.results.useForMusic')}
                          className="h-8 rounded-full bg-gradient-create px-3 text-white transition-colors hover:opacity-90"
                        >
                          <Music className="mr-1.5 h-3.5 w-3.5" />
                          <span className="whitespace-nowrap text-xs font-medium">
                            {t('lyricsGeneratorPage.results.useForMusic')}
                          </span>
                        </Button>

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDeletingLyrics}
                              aria-label={t('trackActions.moreActions')}
                              title={t('trackActions.moreActions')}
                              className="h-8 w-8 rounded-full bg-foreground/5 p-0 text-foreground/75 transition-colors hover:bg-foreground/10 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[156px] p-1.5">
                            <DropdownMenuItem
                              onClick={() => handleCopyLyrics({ title: lyrics.title, text: lyrics.text }, copyKey)}
                              className="cursor-pointer px-2.5 py-1.5 text-xs"
                            >
                              {copiedKey === copyKey ? t('lyricsGeneratorPage.results.copied') : t('lyricsGeneratorPage.results.copy')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDownloadLyrics({ title: lyrics.title, text: lyrics.text })}
                              className="cursor-pointer px-2.5 py-1.5 text-xs"
                            >
                              {t('lyricsGeneratorPage.results.download')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleRequestDeleteResults({
                                  taskId: record.taskId,
                                  lyricsIndex: index,
                                  deleteKey,
                                })
                              }
                              disabled={isDeletingLyrics}
                              className="cursor-pointer px-2.5 py-1.5 text-xs text-destructive focus:text-destructive"
                            >
                              {isDeletingLyrics
                                ? t('lyricsGeneratorPage.results.deletingResults')
                                : t('lyricsGeneratorPage.results.deleteResults')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <>
      <section id="lyrics-generator" className="relative h-screen overflow-hidden">
        <div className="relative h-full flex flex-col md:flex-row md:gap-0 md:px-4 md:py-0 md:pl-[calc(var(--studio-sidebar-width,72px)+1rem)]">
          <div className="md:hidden flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-[calc(var(--mobile-nav-height,64px)+0.75rem)] space-y-3">
            <section className="studio-panel-cards rounded-[1.5rem]">
              <div className="flex-shrink-0 px-0 pt-2 pb-4">
                <div className="mb-3 px-1 space-y-1.5">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
                    {t('lyricsGeneratorPage.hero.title')}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('lyricsGeneratorPage.hero.subtitle')}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {panelFields}
                {panelActions}
              </div>
            </section>

            <section className="studio-panel-cards rounded-[1.5rem] min-h-[220px] flex flex-col overflow-hidden">
              {resultToolbar}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {resultContent}
              </div>
            </section>
          </div>

          <div className="hidden md:block md:order-2 flex-shrink-0 md:pr-2 md:py-2">
            <section className="studio-panel-cards transition-all duration-300 ease-in-out md:w-[clamp(21rem,30vw,32rem)] h-full flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-0 pt-2 md:pt-4 pb-4">
                <div className="mb-3 px-1 space-y-1.5">
                  <h2 className="text-lg md:text-xl font-semibold tracking-tight text-foreground">
                    {t('lyricsGeneratorPage.hero.title')}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('lyricsGeneratorPage.hero.subtitle')}
                  </p>
                </div>
              </div>
              <div
                className="flex-1 overflow-y-auto scrollbar-hidden px-0 pb-6 md:pb-6"
                style={{ scrollbarGutter: 'stable both-edges' }}
              >
                {panelFields}
              </div>
              <div className="flex-shrink-0 px-0 pt-3 pb-4">
                {panelActions}
              </div>
            </section>
          </div>

          <div className={`hidden md:flex flex-1 min-w-0 h-full ${getZIndexClass('MAIN_CONTENT')} md:order-3 relative md:pb-0 md:pl-2`}>
            <div className={`min-h-0 h-full flex flex-col relative w-full ${getZIndexClass('MAIN_CONTENT')}`}>
              <div className="flex flex-col flex-1 min-h-0 min-w-0">
                <div className="relative flex flex-col flex-1 min-h-0 min-w-0 px-0 md:px-0 md:py-2">
                  <section className="studio-panel-cards flex flex-col min-h-0 flex-1 overflow-hidden">
                    {resultToolbar}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {resultContent}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>

      <CommonSidebar variant="studio" />
      </section>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      <AlertDialog
        open={showGeneratingNoticeDialog}
        onOpenChange={(open) => {
          if (!open && pendingGeneratingTaskId) {
            return;
          }
          setShowGeneratingNoticeDialog(open);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">
              {t('lyricsGeneratorPage.results.generatingNoticeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {t('lyricsGeneratorPage.results.generatingNoticeDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <AlertDialogAction
              onClick={handleConfirmGeneratingNotice}
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('lyricsGeneratorPage.results.generatingNoticeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showDeleteConfirmDialog}
        onOpenChange={(open) => {
          setShowDeleteConfirmDialog(open);
          if (!open) {
            setPendingDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">
              {t('lyricsGeneratorPage.results.deleteConfirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base">
              {t('lyricsGeneratorPage.results.deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <AlertDialogCancel className="w-full sm:w-auto">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteResults}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!pendingDeleteTarget || deletingResultKeys.includes(pendingDeleteTarget.deleteKey)}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
