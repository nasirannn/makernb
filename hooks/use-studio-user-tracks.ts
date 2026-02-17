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

  const fetchUserTracks = React.useCallback(async (options?: { mode?: StudioTracksFetchMode }) => {
    const mode = options?.mode ?? "reset";
    const isAppend = mode === "append";
    const isMerge = mode === "merge";

    if (!userId) {
      setUserTracks([]);
      setUserTracksOffset(0);
      setHasMoreUserTracks(false);
      setIsFetchingUserTracks(false);
      setIsFetchingMoreUserTracks(false);
      setUserTracksSummary(EMPTY_SUMMARY);
      return;
    }

    if (isAppend && (isFetchingMoreUserTracks || isFetchingUserTracks || !hasMoreUserTracks)) {
      return;
    }

    if (isAppend) {
      setIsFetchingMoreUserTracks(true);
    } else {
      setIsFetchingUserTracks(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const timestamp = Date.now();
      const offset = isAppend ? userTracksOffset : 0;
      const response = await fetch(`/api/user-music/${userId}?limit=${pageSize}&offset=${offset}&_t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Cache-Control": "no-cache",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const tracks = (Array.isArray(data.data?.music) ? data.data.music : []) as any[];
        const totalTracks = Number(data.data?.totalTracks ?? 0);
        const totalDuration = Number(data.data?.totalDuration ?? 0);

        setUserTracks((prevTracks) => {
          if (isAppend) {
            const existingIds = new Set(prevTracks.map((track: any) => track.id));
            const merged = [...prevTracks];
            tracks.forEach((track: any) => {
              if (!existingIds.has(track.id)) {
                merged.push(track);
              }
            });
            return merged;
          }

          if (isMerge) {
            const incomingIds = new Set(tracks.map((track: any) => track.id));
            const merged = [...tracks];
            prevTracks.forEach((track: any) => {
              if (!incomingIds.has(track.id)) {
                merged.push(track);
              }
            });
            return merged;
          }

          return tracks;
        });

        if (Number.isFinite(totalTracks) && Number.isFinite(totalDuration)) {
          setUserTracksSummary({
            totalTracks,
            totalDuration,
          });
        }

        if (isAppend) {
          setUserTracksOffset((prevOffset) => prevOffset + tracks.length);
        } else if (isMerge) {
          setUserTracksOffset((prevOffset) => (prevOffset === 0 ? tracks.length : prevOffset));
        } else {
          setUserTracksOffset(tracks.length);
        }

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
      if (isAppend) {
        setIsFetchingMoreUserTracks(false);
      } else {
        setIsFetchingUserTracks(false);
      }
    }
  }, [userId, pageSize, userTracksOffset, isFetchingMoreUserTracks, isFetchingUserTracks, hasMoreUserTracks]);

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
      setUserTracks([]);
      setUserTracksOffset(0);
      setHasMoreUserTracks(true);
      void fetchUserTracksRef.current({ mode: "reset" });
    } else {
      setUserTracks([]);
      setUserTracksOffset(0);
      setHasMoreUserTracks(false);
      setIsFetchingMoreUserTracks(false);
      setIsFetchingUserTracks(false);
      setUserTracksSummary(EMPTY_SUMMARY);
    }
  }, [userId, isAuthLoading]);

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
