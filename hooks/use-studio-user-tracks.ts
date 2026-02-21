"use client";

import React from "react";

import { supabase } from "@/lib/supabase";

export type StudioTracksFetchMode = "reset" | "append" | "merge";

export interface StudioTracksSummary {
  totalTracks: number;
  totalDuration: number;
}

interface UseStudioUserTracksParams {
  userId?: string;
  isAuthLoading: boolean;
  pageSize?: number;
}

const EMPTY_SUMMARY: StudioTracksSummary = {
  totalTracks: 0,
  totalDuration: 0,
};

export const useStudioUserTracks = ({
  userId,
  isAuthLoading,
  pageSize = 10,
}: UseStudioUserTracksParams) => {
  const [userTracks, setUserTracks] = React.useState<any[]>([]);
  const [userTracksOffset, setUserTracksOffset] = React.useState(0);
  const [hasMoreUserTracks, setHasMoreUserTracks] = React.useState(true);
  const [isFetchingMoreUserTracks, setIsFetchingMoreUserTracks] = React.useState(false);
  const [isFetchingUserTracks, setIsFetchingUserTracks] = React.useState(true);
  const [userTracksSummary, setUserTracksSummary] = React.useState<StudioTracksSummary>(EMPTY_SUMMARY);

  const resetUserTracksState = React.useCallback(() => {
    setUserTracks([]);
    setUserTracksOffset(0);
    setHasMoreUserTracks(false);
    setIsFetchingUserTracks(false);
    setIsFetchingMoreUserTracks(false);
    setUserTracksSummary(EMPTY_SUMMARY);
  }, []);

  const setFetchStateByMode = React.useCallback((mode: StudioTracksFetchMode, isFetching: boolean) => {
    if (mode === "append") {
      setIsFetchingMoreUserTracks(isFetching);
      return;
    }
    setIsFetchingUserTracks(isFetching);
  }, []);

  const prepareInitialUserTracksLoad = React.useCallback(() => {
    setUserTracks([]);
    setUserTracksOffset(0);
    setHasMoreUserTracks(true);
  }, []);

  const buildUserTracksUrl = React.useCallback((offset: number) => {
    return `/api/user-music/${userId}?limit=${pageSize}&offset=${offset}&_t=${Date.now()}`;
  }, [userId, pageSize]);

  const getUserTracksRequestHeaders = React.useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      Authorization: `Bearer ${session?.access_token}`,
      "Cache-Control": "no-cache",
    };
  }, []);

  const normalizeUserTracksPayload = React.useCallback((payload: any) => {
    const tracks = (Array.isArray(payload?.data?.music) ? payload.data.music : []) as any[];
    const totalTracks = Number(payload?.data?.totalTracks ?? 0);
    const totalDuration = Number(payload?.data?.totalDuration ?? 0);
    return { tracks, totalTracks, totalDuration };
  }, []);

  const mergeTracksByMode = React.useCallback((
    prevTracks: any[],
    incomingTracks: any[],
    mode: StudioTracksFetchMode,
  ) => {
    if (mode === "append") {
      const existingIds = new Set(prevTracks.map((track: any) => track.id));
      const merged = [...prevTracks];
      incomingTracks.forEach((track: any) => {
        if (!existingIds.has(track.id)) {
          merged.push(track);
        }
      });
      return merged;
    }

    if (mode === "merge") {
      const incomingIds = new Set(incomingTracks.map((track: any) => track.id));
      const merged = [...incomingTracks];
      prevTracks.forEach((track: any) => {
        if (!incomingIds.has(track.id)) {
          merged.push(track);
        }
      });
      return merged;
    }

    return incomingTracks;
  }, []);

  const updateOffsetByMode = React.useCallback((mode: StudioTracksFetchMode, tracksLength: number) => {
    if (mode === "append") {
      setUserTracksOffset((prevOffset) => prevOffset + tracksLength);
      return;
    }

    if (mode === "merge") {
      setUserTracksOffset((prevOffset) => (prevOffset === 0 ? tracksLength : prevOffset));
      return;
    }

    setUserTracksOffset(tracksLength);
  }, []);

  const fetchUserTracks = React.useCallback(async (options?: { mode?: StudioTracksFetchMode }) => {
    const mode = options?.mode ?? "reset";
    const isAppend = mode === "append";
    const isMerge = mode === "merge";

    if (!userId) {
      resetUserTracksState();
      return;
    }

    if (isAppend && (isFetchingMoreUserTracks || isFetchingUserTracks || !hasMoreUserTracks)) {
      return;
    }

    setFetchStateByMode(mode, true);

    try {
      const offset = isAppend ? userTracksOffset : 0;
      const headers = await getUserTracksRequestHeaders();
      const response = await fetch(buildUserTracksUrl(offset), { headers });

      if (response.ok) {
        const payload = await response.json();
        const { tracks, totalTracks, totalDuration } = normalizeUserTracksPayload(payload);

        setUserTracks((prevTracks) => mergeTracksByMode(prevTracks, tracks, mode));

        if (Number.isFinite(totalTracks) && Number.isFinite(totalDuration)) {
          setUserTracksSummary({
            totalTracks,
            totalDuration,
          });
        }

        updateOffsetByMode(mode, tracks.length);

        if (!isMerge) {
          setHasMoreUserTracks(tracks.length === pageSize);
        }
      } else {
        console.error("Failed to fetch user tracks:", response.status, response.statusText);
        if (!isAppend) {
          setUserTracks([]);
        }
      }
    } catch (error) {
      console.error("Error fetching user tracks:", error);
    } finally {
      setFetchStateByMode(mode, false);
    }
  }, [
    userId,
    pageSize,
    userTracksOffset,
    isFetchingMoreUserTracks,
    isFetchingUserTracks,
    hasMoreUserTracks,
    buildUserTracksUrl,
    getUserTracksRequestHeaders,
    normalizeUserTracksPayload,
    mergeTracksByMode,
    updateOffsetByMode,
    resetUserTracksState,
    setFetchStateByMode,
  ]);

  const fetchUserTracksRef = React.useRef(fetchUserTracks);
  React.useEffect(() => {
    fetchUserTracksRef.current = fetchUserTracks;
  }, [fetchUserTracks]);

  const fetchUserTracksByMode = React.useCallback((mode: StudioTracksFetchMode) => {
    return fetchUserTracksRef.current({ mode });
  }, []);

  const handleLoadMoreUserTracks = React.useCallback(() => {
    void fetchUserTracksRef.current({ mode: "append" });
  }, []);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (userId) {
      prepareInitialUserTracksLoad();
      void fetchUserTracksRef.current({ mode: "reset" });
    } else {
      resetUserTracksState();
    }
  }, [userId, isAuthLoading, prepareInitialUserTracksLoad, resetUserTracksState]);

  return {
    userTracks,
    setUserTracks,
    userTracksSummary,
    setUserTracksSummary,
    hasMoreUserTracks,
    isFetchingMoreUserTracks,
    isFetchingUserTracks,
    handleLoadMoreUserTracks,
    fetchUserTracksByMode,
  };
};
