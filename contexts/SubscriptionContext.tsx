"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeTierCode, type SubscriptionTier } from "@/lib/subscription-tier";
import { useAuth } from "./AuthContext";

interface SubscriptionContextType {
  tierCode: SubscriptionTier | null;
  hasSubscription: boolean;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tierCode, setTierCode] = useState<SubscriptionTier | null>(null);
  const [loading, setLoading] = useState(false);
  const isRefreshingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const refreshSubscription = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    if (!user) {
      setTierCode(null);
      return;
    }

    isRefreshingRef.current = true;
    setLoading(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Failed to get session for subscription fetch:", sessionError);
        return;
      }

      if (!session?.access_token) {
        return;
      }

      const response = await fetch("/api/user-subscription", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTierCode(normalizeTierCode(data.tierCode));
        hasFetchedRef.current = true;
      } else {
        setTierCode(null);
        hasFetchedRef.current = true;
      }
    } catch (error) {
      console.error("Failed to fetch user subscription:", error);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTierCode(null);
      hasFetchedRef.current = false;
      return;
    }

    if (!hasFetchedRef.current && !isRefreshingRef.current) {
      const timer = setTimeout(() => {
        refreshSubscription();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user?.id, refreshSubscription]);

  const value = {
    tierCode,
    hasSubscription: tierCode !== null,
    loading,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
