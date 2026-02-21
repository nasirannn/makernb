"use client";

import React from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { getEventBus, TRACK_EVENTS } from "@/lib/event-bus";
import type { StudioTrack } from "@/types/track";
import { useI18n } from "@/lib/i18n/provider";

interface UseStudioTrackActionsParams {
  userId?: string;
  userTracks: any[];
  selectedStudioTrack: StudioTrack | null;
  trackToDelete: any;
  normalizeDuration: (value: unknown) => number;
  updateTrack: (trackId: string, updater: (track: any) => any) => void;
  updateTracks: (
    newTracksOrUpdater: any[] | ((prevTracks: any[]) => any[])
  ) => void;
  setUserTracks: React.Dispatch<React.SetStateAction<any[]>>;
  setUserTracksSummary: React.Dispatch<
    React.SetStateAction<{ totalTracks: number; totalDuration: number }>
  >;
  setSelectedStudioTrack: React.Dispatch<React.SetStateAction<StudioTrack | null>>;
  setTrackToDelete: React.Dispatch<React.SetStateAction<any>>;
  setDeleteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAuthModalOpen: (open: boolean) => void;
}

export const useStudioTrackActions = ({
  userId,
  userTracks,
  selectedStudioTrack,
  trackToDelete,
  normalizeDuration,
  updateTrack,
  updateTracks,
  setUserTracks,
  setUserTracksSummary,
  setSelectedStudioTrack,
  setTrackToDelete,
  setDeleteDialogOpen,
  setIsAuthModalOpen,
}: UseStudioTrackActionsParams) => {
  const { t } = useI18n();

  const getAccessToken = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token;
  }, []);

  const getAuthJsonHeaders = React.useCallback(async () => {
    const accessToken = await getAccessToken();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
  }, [getAccessToken]);

  const postTrackToggle = React.useCallback(async (
    endpoint: string,
    trackId: string,
    failedToastKey: string,
  ) => {
    const headers = await getAuthJsonHeaders();
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ trackId }),
    });

    if (!response.ok) {
      throw new Error(t(failedToastKey));
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || t(failedToastKey));
    }

    return data;
  }, [getAuthJsonHeaders, t]);

  const getDeleteTargetConfig = React.useCallback((track: any) => {
    const isErrorTrack = track.isError || !track.id || track.id.startsWith("error-");
    const endpoint = isErrorTrack
      ? `/api/delete-music-generation?id=${track.generationId}`
      : `/api/delete-track/${track.id}`;

    return { isErrorTrack, endpoint };
  }, []);

  const syncTrackReactionState = React.useCallback((
    trackId: string,
    reactionState: { isLiked: boolean; isDisliked: boolean },
  ) => {
    updateTrack(trackId, (track) => ({
      ...track,
      isLiked: reactionState.isLiked,
      isDisliked: reactionState.isDisliked,
    }));

    updateTracks((prevTracks) =>
      prevTracks.map((track) =>
        track.id === trackId
          ? { ...track, isLiked: reactionState.isLiked, isDisliked: reactionState.isDisliked }
          : track
      )
    );

    setSelectedStudioTrack((prev) => {
      if (prev?.id !== trackId) {
        return prev;
      }
      return {
        ...prev,
        isLiked: reactionState.isLiked,
        isDisliked: reactionState.isDisliked,
      } as StudioTrack;
    });
  }, [updateTrack, updateTracks, setSelectedStudioTrack]);

  const syncTrackMetadata = React.useCallback((
    trackId: string,
    nextTitle: string,
    nextCoverImageUrl?: string,
  ) => {
    const shouldUpdateCover = Boolean(nextCoverImageUrl);

    updateTrack(trackId, (track) => {
      if (!shouldUpdateCover) {
        return { ...track, title: nextTitle };
      }
      return {
        ...track,
        title: nextTitle,
        coverImage: nextCoverImageUrl,
        coverR2Url: nextCoverImageUrl,
      };
    });

    setSelectedStudioTrack((prev) => {
      if (!prev || prev.id !== trackId) {
        return prev;
      }
      if (!shouldUpdateCover) {
        return {
          ...prev,
          title: nextTitle,
        };
      }
      return {
        ...prev,
        title: nextTitle,
        coverImage: nextCoverImageUrl,
        coverR2Url: nextCoverImageUrl,
      };
    });
  }, [updateTrack, setSelectedStudioTrack]);

  const removeDeletedTrackFromVisibleList = React.useCallback((
    deletedTrack: any,
    isErrorTrack: boolean,
  ) => {
    if (isErrorTrack) {
      updateTracks((prevTracks) =>
        prevTracks.filter((track) => track.generationId !== deletedTrack.generationId)
      );
      return;
    }

    updateTracks((prevTracks) =>
      prevTracks.filter((track) => track.id !== deletedTrack.id)
    );
  }, [updateTracks]);

  const applyDeletedTrackSideEffects = React.useCallback((deletedTrack: any) => {
    const updatedUserTracks = userTracks.map((generation) => ({
      ...generation,
      allTracks: generation.allTracks.map((track: any) =>
        track.id === deletedTrack.id
          ? { ...track, isDeleted: true }
          : track
      ),
    }));
    setUserTracks(updatedUserTracks);
    setUserTracksSummary((prev) => ({
      totalTracks: Math.max(0, prev.totalTracks - 1),
      totalDuration: Math.max(0, prev.totalDuration - normalizeDuration(deletedTrack.duration)),
    }));

    if (typeof window !== "undefined") {
      const eventBus = getEventBus();
      eventBus.emit(TRACK_EVENTS.DELETED, {
        trackId: deletedTrack.id,
      });
    }
  }, [userTracks, setUserTracks, setUserTracksSummary, normalizeDuration]);

  const clearSelectedTrackIfDeleted = React.useCallback((deletedTrack: any) => {
    if (
      selectedStudioTrack?.id === deletedTrack.id ||
      selectedStudioTrack?.generationId === deletedTrack.generationId
    ) {
      setSelectedStudioTrack(null);
    }
  }, [selectedStudioTrack, setSelectedStudioTrack]);

  const handleFavoriteToggle = React.useCallback(async (track: any, music: any) => {
    if (!userId) {
      toast(t("toasts.pleaseLogInFavoriteTracks"));
      return;
    }

    try {
      const data = await postTrackToggle(
        "/api/favorites/toggle",
        track.id,
        "toasts.failedToggleFavorite",
      );

      updateTrack(track.id, (t) => ({ ...t, isFavorited: data.isFavorited }));

      setSelectedStudioTrack((prev) => {
        if (prev?.id === track.id) {
          return {
            ...prev,
            isFavorited: data.isFavorited,
          } as StudioTrack;
        }
        return prev;
      });

      if (data.isFavorited) {
        toast.success(t("toasts.addedToFavorites"), {
          description: t("toasts.addedToFavoritesDesc", { title: music.title }),
        });
      } else {
        toast.success(t("toasts.removedFromFavorites"), {
          description: t("toasts.removedFromFavoritesDesc", { title: music.title }),
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast.error(t("toasts.failedUpdateFavoriteStatus"));
    }
  }, [userId, postTrackToggle, updateTrack, setSelectedStudioTrack, t]);

  const handleLikeToggle = React.useCallback(async (track: any, _music: any) => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const data = await postTrackToggle(
        "/api/likes/toggle",
        track.id,
        "toasts.failedToggleLike",
      );

      syncTrackReactionState(track.id, {
        isLiked: data.isLiked,
        isDisliked: data.isDisliked ?? false,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  }, [userId, postTrackToggle, setIsAuthModalOpen, syncTrackReactionState]);

  const handleDislikeToggle = React.useCallback(async (track: any, _music: any) => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const data = await postTrackToggle(
        "/api/dislikes/toggle",
        track.id,
        "toasts.failedToggleDislike",
      );

      syncTrackReactionState(track.id, {
        isLiked: data.isLiked ?? false,
        isDisliked: data.isDisliked,
      });
    } catch (error) {
      console.error("Error toggling dislike:", error);
    }
  }, [userId, postTrackToggle, setIsAuthModalOpen, syncTrackReactionState]);

  const handleEditTitle = React.useCallback(async (trackId: string, newTitle: string) => {
    try {
      const response = await fetch("/api/update-track-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId, title: newTitle }),
      });

      if (!response.ok) {
        throw new Error(t("toasts.failedUpdateTitle"));
      }

      syncTrackMetadata(trackId, newTitle);

      toast.success(t("toasts.titleUpdatedSuccessfully"));
    } catch (error) {
      console.error("Error updating title:", error);
      toast.error(t("toasts.failedUpdateTitle"));
    }
  }, [syncTrackMetadata, t]);

  const handleEditMusicInfo = React.useCallback(async (
    trackId: string,
    data: { title: string; coverImageUrl?: string }
  ) => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error(t("toasts.pleaseLogInUpdateMusicInfo"));
        return;
      }

      const response = await fetch("/api/update-track-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          trackId,
          title: data.title,
          coverImageUrl: data.coverImageUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("toasts.failedUpdateMusicInfo"));
      }

      const result = await response.json();
      const nextTitle = result.data?.title || data.title;
      const nextCoverImageUrl = result.data?.coverImageUrl;

      syncTrackMetadata(trackId, nextTitle, nextCoverImageUrl);

      toast.success(t("toasts.musicInfoUpdatedSuccessfully"));
    } catch (error) {
      console.error("Error updating music info:", error);
      toast.error(error instanceof Error ? error.message : t("toasts.failedUpdateMusicInfo"));
    }
  }, [getAccessToken, syncTrackMetadata, t]);

  const openDeleteDialogForTrack = React.useCallback((track: any) => {
    setTrackToDelete(track);
    setDeleteDialogOpen(true);
  }, [setTrackToDelete, setDeleteDialogOpen]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!trackToDelete) return;

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast(t("toasts.authRequiredLogInAgain"));
        return;
      }

      const { isErrorTrack, endpoint } = getDeleteTargetConfig(trackToDelete);
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        removeDeletedTrackFromVisibleList(trackToDelete, isErrorTrack);
        if (!isErrorTrack) {
          applyDeletedTrackSideEffects(trackToDelete);
        }
        clearSelectedTrackIfDeleted(trackToDelete);

        toast.success(t("toasts.trackDeletedSuccessfully"));
      } else {
        toast(data.error || t("toasts.failedDeleteTrack"));
      }
    } catch (error) {
      console.error("Error deleting track:", error);
      toast(t("toasts.failedDeleteTrackTryAgain"));
    } finally {
      setDeleteDialogOpen(false);
      setTrackToDelete(null);
    }
  }, [
    trackToDelete,
    getAccessToken,
    getDeleteTargetConfig,
    removeDeletedTrackFromVisibleList,
    applyDeletedTrackSideEffects,
    clearSelectedTrackIfDeleted,
    setDeleteDialogOpen,
    setTrackToDelete,
    t,
  ]);

  return {
    handleFavoriteToggle,
    handleLikeToggle,
    handleDislikeToggle,
    handleEditTitle,
    handleEditMusicInfo,
    openDeleteDialogForTrack,
    handleDeleteConfirm,
  };
};
