"use client";

import React from "react";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/format-utils";
import { useI18n } from "@/lib/i18n/provider";
import { supabase } from "@/lib/supabase";

export type PersonaOption = {
  id: string;
  personaId: string;
  name: string | null;
  description: string | null;
  trackTitle: string | null;
};

export type PersonaTrackOption = {
  id: string;
  title: string | null;
  duration: number;
  createdAt: string;
  audioId: string | null;
  coverR2Url: string | null;
  hasPersona: boolean;
  personaId: string | null;
};

interface UseStudioPersonaManagerParams {
  user: { id?: string } | null;
  selectedPersonaId: string;
  setSelectedPersonaId?: (personaId: string) => void;
}

export const useStudioPersonaManager = ({
  user,
  selectedPersonaId,
  setSelectedPersonaId,
}: UseStudioPersonaManagerParams) => {
  const { t } = useI18n();
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = React.useState(false);
  const [isPersonaLoading, setIsPersonaLoading] = React.useState(false);
  const [personaOptions, setPersonaOptions] = React.useState<PersonaOption[]>([]);
  const hasLoadedPersonaOptionsInCurrentOpenRef = React.useRef(false);

  const [isSelectMusicOpen, setIsSelectMusicOpen] = React.useState(false);
  const [isSelectMusicLoading, setIsSelectMusicLoading] = React.useState(false);
  const [selectMusicOptions, setSelectMusicOptions] = React.useState<PersonaTrackOption[]>([]);
  const [selectedMusicTrackId, setSelectedMusicTrackId] = React.useState('');
  const [pendingMusicTrackId, setPendingMusicTrackId] = React.useState('');

  const [isCreatePersonaDialogOpen, setIsCreatePersonaDialogOpen] = React.useState(false);
  const [createPersonaName, setCreatePersonaName] = React.useState('');
  const [createPersonaDescription, setCreatePersonaDescription] = React.useState('');
  const [isCreatingPersona, setIsCreatingPersona] = React.useState(false);
  const [deletingPersonaRecordId, setDeletingPersonaRecordId] = React.useState<string | null>(null);

  const selectedPersona = React.useMemo(
    () => personaOptions.find((item) => item.personaId === selectedPersonaId) || null,
    [personaOptions, selectedPersonaId]
  );

  const selectedMusicTrack = React.useMemo(
    () => selectMusicOptions.find((item) => item.id === selectedMusicTrackId) || null,
    [selectMusicOptions, selectedMusicTrackId]
  );

  const pendingMusicTrack = React.useMemo(
    () => selectMusicOptions.find((item) => item.id === pendingMusicTrackId) || null,
    [selectMusicOptions, pendingMusicTrackId]
  );

  const getPersonaTrackUnavailableReason = React.useCallback((track: PersonaTrackOption | null | undefined) => {
    if (!track) {
      return null;
    }

    if (track.hasPersona) {
      return t("personaDialog.personaAlreadyCreatedForAudio");
    }

    return null;
  }, [t]);

  const pendingMusicTrackUnavailableReason = React.useMemo(
    () => getPersonaTrackUnavailableReason(pendingMusicTrack),
    [pendingMusicTrack, getPersonaTrackUnavailableReason]
  );

  const formatTrackCreatedAt = React.useCallback((value: string) => {
    if (!value) {
      return t("personaDialog.unknownDate");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return t("personaDialog.unknownDate");
    }

    return formatDateTime(value);
  }, [t]);

  const getAccessToken = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  }, []);

  const getAuthHeaders = React.useCallback((accessToken: string) => {
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }, []);

  const getJsonAuthHeaders = React.useCallback((accessToken: string) => {
    return {
      "Content-Type": "application/json",
      ...getAuthHeaders(accessToken),
    };
  }, [getAuthHeaders]);

  const requireAccessToken = React.useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      toast.error(t("personaDialog.authenticationExpiredSignInAgain"));
      return null;
    }
    return accessToken;
  }, [getAccessToken, t]);

  const parseMutationResult = React.useCallback(async (
    response: Response,
    fallbackErrorKey: string,
    options?: { preferMessage?: boolean },
  ) => {
    const result = await response.json();
    if (!response.ok || !result?.success) {
      const message = options?.preferMessage
        ? result?.message || result?.error || t(fallbackErrorKey)
        : result?.error || t(fallbackErrorKey);
      throw new Error(message);
    }
    return result;
  }, [t]);

  const loadPersonaOptions = React.useCallback(async () => {
    if (!user) {
      setPersonaOptions([]);
      return;
    }

    setIsPersonaLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setPersonaOptions([]);
        return;
      }

      const response = await fetch('/api/personas', {
        method: 'GET',
        headers: getAuthHeaders(accessToken),
      });

      if (!response.ok) {
        throw new Error(t("personaDialog.failedLoadPersonas"));
      }

      const result = await response.json();
      const list = Array.isArray(result?.data) ? result.data : [];
      setPersonaOptions(list);

      if (selectedPersonaId && !list.some((item: PersonaOption) => item.personaId === selectedPersonaId)) {
        setSelectedPersonaId?.('');
      }
    } catch (error) {
      console.error('[StudioPanel] Failed to load personas:', error);
      toast.error(t("personaDialog.failedLoadPersonas"));
      setPersonaOptions([]);
    } finally {
      setIsPersonaLoading(false);
    }
  }, [user, selectedPersonaId, setSelectedPersonaId, getAccessToken, getAuthHeaders, t]);

  const loadSelectMusicOptions = React.useCallback(async () => {
    if (!user) {
      setSelectMusicOptions([]);
      return;
    }

    setIsSelectMusicLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setSelectMusicOptions([]);
        return;
      }

      const response = await fetch(`/api/studio-tracks-for-separation?limit=50&t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: getAuthHeaders(accessToken),
      });

      if (!response.ok) {
        throw new Error(t("personaDialog.failedLoadCurrentSongs"));
      }

      const result = await response.json();
      const list = Array.isArray(result?.data) ? result.data : [];
      setSelectMusicOptions(
        list.map((item: any) => {
          const normalizedPersonaId = item.personaId || item.persona_id || null;
          const normalizedHasPersona = Boolean(item.hasPersona ?? item.has_persona ?? normalizedPersonaId);

          return {
            id: item.id,
            title: item.title || t("studioTracks.untitledTrack"),
            duration: typeof item.duration === 'number' ? item.duration : Number(item.duration || 0),
            createdAt: item.createdAt || item.created_at || '',
            audioId: item.audioId || item.audio_id || null,
            coverR2Url: item.coverR2Url || item.cover_r2_url || null,
            hasPersona: normalizedHasPersona,
            personaId: normalizedPersonaId,
          } as PersonaTrackOption;
        })
      );
    } catch (error) {
      console.error('[StudioPanel] Failed to load current songs:', error);
      toast.error(t("personaDialog.failedLoadCurrentSongs"));
      setSelectMusicOptions([]);
    } finally {
      setIsSelectMusicLoading(false);
    }
  }, [user, getAccessToken, getAuthHeaders, t]);

  const handleDeletePersona = React.useCallback(async (persona: PersonaOption) => {
    if (!user) {
      toast.error(t("personaDialog.pleaseSignInDeletePersonas"));
      return;
    }

    if (deletingPersonaRecordId) {
      return;
    }

    setDeletingPersonaRecordId(persona.id);
    try {
      const accessToken = await requireAccessToken();
      if (!accessToken) {
        return;
      }

      const response = await fetch('/api/personas', {
        method: 'DELETE',
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify({
          personaRecordId: persona.id,
        }),
      });

      await parseMutationResult(response, "personaDialog.failedDeletePersona");

      if (selectedPersonaId === persona.personaId) {
        setSelectedPersonaId?.('');
      }

      await loadPersonaOptions();
      toast.success(t("personaDialog.personaDeleted"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("personaDialog.failedDeletePersona");
      toast.error(message);
    } finally {
      setDeletingPersonaRecordId(null);
    }
  }, [user, deletingPersonaRecordId, selectedPersonaId, setSelectedPersonaId, loadPersonaOptions, requireAccessToken, getJsonAuthHeaders, parseMutationResult, t]);

  const openSelectMusicDialog = React.useCallback(() => {
    setPendingMusicTrackId(selectedMusicTrackId);
    setSelectMusicOptions([]);
    setIsSelectMusicOpen(true);
    void loadSelectMusicOptions();
  }, [selectedMusicTrackId, loadSelectMusicOptions]);

  const closeSelectMusicDialog = React.useCallback(() => {
    setPendingMusicTrackId(selectedMusicTrackId);
    setIsSelectMusicOpen(false);
  }, [selectedMusicTrackId]);

  const openCreatePersonaDialog = React.useCallback((trackId: string) => {
    const track = selectMusicOptions.find((item) => item.id === trackId);

    const unavailableReason = getPersonaTrackUnavailableReason(track);
    if (unavailableReason) {
      toast.error(unavailableReason);
      return;
    }

    setSelectedMusicTrackId(trackId);
    setCreatePersonaName(track?.title?.trim() || '');
    setCreatePersonaDescription('');
    setIsCreatePersonaDialogOpen(true);
  }, [selectMusicOptions, getPersonaTrackUnavailableReason]);

  const openCreatePersonaDialogWithFallback = React.useCallback((
    trackId: string,
    fallbackTrack?: Partial<PersonaTrackOption>
  ) => {
    const existingTrack = selectMusicOptions.find((item) => item.id === trackId);
    const normalizedFallbackTrack: PersonaTrackOption | null = fallbackTrack
      ? {
          id: trackId,
          title: fallbackTrack.title ?? t("studioTracks.untitledTrack"),
          duration: typeof fallbackTrack.duration === 'number' ? fallbackTrack.duration : Number(fallbackTrack.duration || 0),
          createdAt: fallbackTrack.createdAt || '',
          audioId: fallbackTrack.audioId ?? null,
          coverR2Url: fallbackTrack.coverR2Url ?? null,
          hasPersona: Boolean(fallbackTrack.hasPersona),
          personaId: fallbackTrack.personaId ?? null,
        }
      : null;

    const resolvedTrack = existingTrack || normalizedFallbackTrack;
    const unavailableReason = getPersonaTrackUnavailableReason(resolvedTrack);
    if (unavailableReason) {
      toast.error(unavailableReason);
      return;
    }

    if (!existingTrack && normalizedFallbackTrack) {
      setSelectMusicOptions((prev) => [normalizedFallbackTrack, ...prev]);
    }

    setSelectedMusicTrackId(trackId);
    setCreatePersonaName(resolvedTrack?.title?.trim() || '');
    setCreatePersonaDescription('');
    setIsCreatePersonaDialogOpen(true);
  }, [selectMusicOptions, getPersonaTrackUnavailableReason, t]);

  const closeCreatePersonaDialog = React.useCallback(() => {
    if (isCreatingPersona) {
      return;
    }
    setIsCreatePersonaDialogOpen(false);
  }, [isCreatingPersona]);

  const confirmSelectMusicDialog = React.useCallback(() => {
    if (!pendingMusicTrackId) {
      return;
    }

    if (pendingMusicTrackUnavailableReason) {
      toast.error(pendingMusicTrackUnavailableReason);
      return;
    }

    setIsSelectMusicOpen(false);
    openCreatePersonaDialog(pendingMusicTrackId);
  }, [pendingMusicTrackId, pendingMusicTrackUnavailableReason, openCreatePersonaDialog]);

  const handleCreatePersona = React.useCallback(async () => {
    const trackId = selectedMusicTrackId;
    if (!trackId) {
      toast.error(t("personaDialog.pleaseSelectTrackFirst"));
      return;
    }

    const selectedTrackOption = selectMusicOptions.find((item) => item.id === trackId) || null;
    const unavailableReason = getPersonaTrackUnavailableReason(selectedTrackOption);
    if (unavailableReason) {
      toast.error(unavailableReason);
      return;
    }

    const name = createPersonaName.trim();
    const description = createPersonaDescription.trim();

    if (!name || !description) {
      toast.error(t("personaDialog.pleaseEnterNameAndDescription"));
      return;
    }

    if (!user) {
      toast.error(t("personaDialog.pleaseSignInCreatePersona"));
      return;
    }

    setIsCreatingPersona(true);
    try {
      const accessToken = await requireAccessToken();
      if (!accessToken) {
        return;
      }

      const response = await fetch('/api/generate-persona', {
        method: 'POST',
        headers: getJsonAuthHeaders(accessToken),
        body: JSON.stringify({
          trackId,
          name,
          description,
        }),
      });

      const result = await parseMutationResult(
        response,
        "personaDialog.failedCreatePersona",
        { preferMessage: true },
      );

      const personaId = result?.data?.personaId as string | undefined;
      if (personaId) {
        setSelectedPersonaId?.(personaId);
      }

      await loadPersonaOptions();
      setIsCreatePersonaDialogOpen(false);
      toast.success(result?.data?.isExisting ? t("personaDialog.personaExistsSelected") : t("personaDialog.personaCreatedSuccessfully"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("personaDialog.failedCreatePersona");
      toast.error(message);
    } finally {
      setIsCreatingPersona(false);
    }
  }, [selectedMusicTrackId, selectMusicOptions, getPersonaTrackUnavailableReason, createPersonaName, createPersonaDescription, user, setSelectedPersonaId, loadPersonaOptions, requireAccessToken, getJsonAuthHeaders, parseMutationResult, t]);

  React.useEffect(() => {
    if (!pendingMusicTrackId || !pendingMusicTrackUnavailableReason) {
      return;
    }

    setPendingMusicTrackId('');
  }, [pendingMusicTrackId, pendingMusicTrackUnavailableReason]);

  React.useEffect(() => {
    if (isPersonaDialogOpen) {
      if (hasLoadedPersonaOptionsInCurrentOpenRef.current) {
        return;
      }

      hasLoadedPersonaOptionsInCurrentOpenRef.current = true;
      void loadPersonaOptions();
      return;
    }

    hasLoadedPersonaOptionsInCurrentOpenRef.current = false;
    setIsSelectMusicOpen(false);
    setIsCreatePersonaDialogOpen(false);
    setSelectedMusicTrackId('');
    setPendingMusicTrackId('');
    setCreatePersonaName('');
    setCreatePersonaDescription('');
  }, [isPersonaDialogOpen, loadPersonaOptions]);

  return {
    isPersonaDialogOpen,
    setIsPersonaDialogOpen,
    isPersonaLoading,
    personaOptions,
    selectedPersona,

    isSelectMusicOpen,
    setIsSelectMusicOpen,
    isSelectMusicLoading,
    selectMusicOptions,
    selectedMusicTrackId,
    pendingMusicTrackId,
    setPendingMusicTrackId,
    pendingMusicTrack,
    pendingMusicTrackUnavailableReason,
    openSelectMusicDialog,
    closeSelectMusicDialog,
    confirmSelectMusicDialog,

    isCreatePersonaDialogOpen,
    setIsCreatePersonaDialogOpen,
    selectedMusicTrack,
    createPersonaName,
    setCreatePersonaName,
    createPersonaDescription,
    setCreatePersonaDescription,
    closeCreatePersonaDialog,
    handleCreatePersona,
    isCreatingPersona,
    openCreatePersonaDialog: openCreatePersonaDialogWithFallback,

    getPersonaTrackUnavailableReason,
    formatTrackCreatedAt,
    deletingPersonaRecordId,
    handleDeletePersona,
  };
};
