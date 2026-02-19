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
  const handleFavoriteToggle = React.useCallback(async (track: any, music: any) => {
    if (!userId) {
      toast(t("toasts.pleaseLogInFavoriteTracks"));
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          trackId: track.id,
        }),
      });

      if (!response.ok) {
        throw new Error(t("toasts.failedToggleFavorite"));
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || t("toasts.failedToggleFavorite"));
      }

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
  }, [userId, updateTrack, setSelectedStudioTrack, t]);

  const handleLikeToggle = React.useCallback(async (track: any, _music: any) => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/likes/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          trackId: track.id,
        }),
      });

      if (!response.ok) {
        throw new Error(t("toasts.failedToggleLike"));
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || t("toasts.failedToggleLike"));
      }

      updateTrack(track.id, (t) => ({
        ...t,
        isLiked: data.isLiked,
        isDisliked: data.isDisliked ?? false,
      }));
      updateTracks((prevTracks) =>
        prevTracks.map((t) =>
          t.id === track.id
            ? { ...t, isLiked: data.isLiked, isDisliked: data.isDisliked ?? false }
            : t
        )
      );

      setSelectedStudioTrack((prev) => {
        if (prev?.id === track.id) {
          return {
            ...prev,
            isLiked: data.isLiked,
            isDisliked: data.isDisliked ?? false,
          } as StudioTrack;
        }
        return prev;
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  }, [userId, setIsAuthModalOpen, updateTrack, updateTracks, setSelectedStudioTrack, t]);

  const handleDislikeToggle = React.useCallback(async (track: any, _music: any) => {
    if (!userId) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/dislikes/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          trackId: track.id,
        }),
      });

      if (!response.ok) {
        throw new Error(t("toasts.failedToggleDislike"));
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || t("toasts.failedToggleDislike"));
      }

      updateTrack(track.id, (t) => ({
        ...t,
        isDisliked: data.isDisliked,
        isLiked: data.isLiked ?? false,
      }));
      updateTracks((prevTracks) =>
        prevTracks.map((t) =>
          t.id === track.id
            ? { ...t, isDisliked: data.isDisliked, isLiked: data.isLiked ?? false }
            : t
        )
      );

      setSelectedStudioTrack((prev) => {
        if (prev?.id === track.id) {
          return {
            ...prev,
            isDisliked: data.isDisliked,
            isLiked: data.isLiked ?? false,
          } as StudioTrack;
        }
        return prev;
      });
    } catch (error) {
      console.error("Error toggling dislike:", error);
    }
  }, [userId, setIsAuthModalOpen, updateTrack, updateTracks, setSelectedStudioTrack, t]);

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

      updateTrack(trackId, (t) => ({ ...t, title: newTitle }));

      setSelectedStudioTrack((prev) => {
        if (!prev || prev.id !== trackId) return prev;
        return {
          ...prev,
          title: newTitle,
        };
      });

      toast.success(t("toasts.titleUpdatedSuccessfully"));
    } catch (error) {
      console.error("Error updating title:", error);
      toast.error(t("toasts.failedUpdateTitle"));
    }
  }, [updateTrack, setSelectedStudioTrack, t]);

  const handleEditMusicInfo = React.useCallback(async (
    trackId: string,
    data: { title: string; coverImageUrl?: string }
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t("toasts.pleaseLogInUpdateMusicInfo"));
        return;
      }

      const response = await fetch("/api/update-track-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
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

      updateTrack(trackId, (t) => ({
        ...t,
        title: nextTitle,
        coverImage: nextCoverImageUrl || t.coverImage,
        coverR2Url: nextCoverImageUrl || t.coverR2Url,
      }));

      setSelectedStudioTrack((prev) => {
        if (!prev || prev.id !== trackId) return prev;
        return {
          ...prev,
          title: nextTitle,
          coverImage: nextCoverImageUrl || prev.coverImage,
          coverR2Url: nextCoverImageUrl || prev.coverR2Url,
        };
      });

      toast.success(t("toasts.musicInfoUpdatedSuccessfully"));
    } catch (error) {
      console.error("Error updating music info:", error);
      toast.error(error instanceof Error ? error.message : t("toasts.failedUpdateMusicInfo"));
    }
  }, [updateTrack, setSelectedStudioTrack, t]);

  const openDeleteDialogForTrack = React.useCallback((track: any) => {
    setTrackToDelete(track);
    setDeleteDialogOpen(true);
  }, [setTrackToDelete, setDeleteDialogOpen]);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!trackToDelete) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast(t("toasts.authRequiredLogInAgain"));
        return;
      }

      let response: Response;

      if (trackToDelete.isError || !trackToDelete.id || trackToDelete.id.startsWith("error-")) {
        response = await fetch(`/api/delete-music-generation?id=${trackToDelete.generationId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      } else {
        response = await fetch(`/api/delete-track/${trackToDelete.id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      }

      const data = await response.json();

      if (data.success) {
        if (trackToDelete.isError || !trackToDelete.id || trackToDelete.id.startsWith("error-")) {
          updateTracks((prevTracks) =>
            prevTracks.filter((track) => track.generationId !== trackToDelete.generationId)
          );
        } else {
          updateTracks((prevTracks) =>
            prevTracks.filter((track) => track.id !== trackToDelete.id)
          );

          const updatedUserTracks = userTracks.map((generation) => ({
            ...generation,
            allTracks: generation.allTracks.map((t: any) =>
              t.id === trackToDelete.id
                ? { ...t, isDeleted: true }
                : t
            ),
          }));
          setUserTracks(updatedUserTracks);
          setUserTracksSummary((prev) => ({
            totalTracks: Math.max(0, prev.totalTracks - 1),
            totalDuration: Math.max(0, prev.totalDuration - normalizeDuration(trackToDelete.duration)),
          }));

          if (typeof window !== "undefined") {
            const eventBus = getEventBus();
            eventBus.emit(TRACK_EVENTS.DELETED, {
              trackId: trackToDelete.id,
            });
          }
        }

        if (
          selectedStudioTrack?.id === trackToDelete.id ||
          selectedStudioTrack?.generationId === trackToDelete.generationId
        ) {
          setSelectedStudioTrack(null);
        }

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
    updateTracks,
    userTracks,
    setUserTracks,
    setUserTracksSummary,
    normalizeDuration,
    selectedStudioTrack,
    setSelectedStudioTrack,
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
