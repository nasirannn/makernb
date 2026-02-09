"use client";

import React from "react";
import { toast } from "sonner";

import { formatDateTime } from "@/lib/format-utils";
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
      return 'Persona already created for this audio. Each audio ID can only generate one persona.';
    }

    return null;
  }, []);

  const pendingMusicTrackUnavailableReason = React.useMemo(
    () => getPersonaTrackUnavailableReason(pendingMusicTrack),
    [pendingMusicTrack, getPersonaTrackUnavailableReason]
  );

  const formatTrackCreatedAt = React.useCallback((value: string) => {
    if (!value) {
      return 'Unknown date';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    return formatDateTime(value);
  }, []);

  const loadPersonaOptions = React.useCallback(async () => {
    if (!user) {
      setPersonaOptions([]);
      return;
    }

    setIsPersonaLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setPersonaOptions([]);
        return;
      }

      const response = await fetch('/api/personas', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load personas');
      }

      const result = await response.json();
      const list = Array.isArray(result?.data) ? result.data : [];
      setPersonaOptions(list);

      if (selectedPersonaId && !list.some((item: PersonaOption) => item.personaId === selectedPersonaId)) {
        setSelectedPersonaId?.('');
      }
    } catch (error) {
      console.error('[StudioPanel] Failed to load personas:', error);
      toast.error('Failed to load personas');
      setPersonaOptions([]);
    } finally {
      setIsPersonaLoading(false);
    }
  }, [user, selectedPersonaId, setSelectedPersonaId]);

  const loadSelectMusicOptions = React.useCallback(async () => {
    if (!user) {
      setSelectMusicOptions([]);
      return;
    }

    setIsSelectMusicLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSelectMusicOptions([]);
        return;
      }

      const response = await fetch(`/api/studio-tracks-for-separation?limit=50&t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load current songs');
      }

      const result = await response.json();
      const list = Array.isArray(result?.data) ? result.data : [];
      setSelectMusicOptions(
        list.map((item: any) => {
          const normalizedPersonaId = item.personaId || item.persona_id || null;
          const normalizedHasPersona = Boolean(item.hasPersona ?? item.has_persona ?? normalizedPersonaId);

          return {
            id: item.id,
            title: item.title || 'Untitled Track',
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
      toast.error('Failed to load current songs');
      setSelectMusicOptions([]);
    } finally {
      setIsSelectMusicLoading(false);
    }
  }, [user]);

  const handleDeletePersona = React.useCallback(async (persona: PersonaOption) => {
    if (!user) {
      toast.error('Please sign in to delete personas.');
      return;
    }

    if (deletingPersonaRecordId) {
      return;
    }

    setDeletingPersonaRecordId(persona.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication expired. Please sign in again.');
        return;
      }

      const response = await fetch('/api/personas', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          personaRecordId: persona.id,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to delete persona');
      }

      if (selectedPersonaId === persona.personaId) {
        setSelectedPersonaId?.('');
      }

      await loadPersonaOptions();
      toast.success('Persona deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete persona';
      toast.error(message);
    } finally {
      setDeletingPersonaRecordId(null);
    }
  }, [user, deletingPersonaRecordId, selectedPersonaId, setSelectedPersonaId, loadPersonaOptions]);

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
      toast.error('Please select a track first.');
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
      toast.error('Please enter both name and description.');
      return;
    }

    if (!user) {
      toast.error('Please sign in to create a persona.');
      return;
    }

    setIsCreatingPersona(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Authentication expired. Please sign in again.');
        return;
      }

      const response = await fetch('/api/generate-persona', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trackId,
          name,
          description,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        const message = result?.message || result?.error || 'Failed to create persona';
        throw new Error(message);
      }

      const personaId = result?.data?.personaId as string | undefined;
      if (personaId) {
        setSelectedPersonaId?.(personaId);
      }

      await loadPersonaOptions();
      setIsCreatePersonaDialogOpen(false);
      toast.success(result?.data?.isExisting ? 'Persona already exists and has been selected.' : 'Persona created successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create persona';
      toast.error(message);
    } finally {
      setIsCreatingPersona(false);
    }
  }, [selectedMusicTrackId, selectMusicOptions, getPersonaTrackUnavailableReason, createPersonaName, createPersonaDescription, user, setSelectedPersonaId, loadPersonaOptions]);

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

    getPersonaTrackUnavailableReason,
    formatTrackCreatedAt,
    deletingPersonaRecordId,
    handleDeletePersona,
  };
};

