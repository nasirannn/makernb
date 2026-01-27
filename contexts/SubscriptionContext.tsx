"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeTierCode, type SubscriptionTier } from "@/lib/subscription-tier";
import { useAuth } from "./AuthContext";

interface SubscriptionContextType {
  tierCode: SubscriptionTier | null;
  tierName: string;
  hasSubscription: boolean;
  planId: string | null;
  productId: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  currentPeriodEnd: string | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tierCode, setTierCode] = useState<SubscriptionTier | null>(null);
  const [tierName, setTierName] = useState("Free");
  const [hasSubscription, setHasSubscription] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [cancelAt, setCancelAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRefreshingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const refreshSubscription = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    if (!user) {
      setTierCode(null);
      setTierName("Free");
      setHasSubscription(false);
      setPlanId(null);
      setProductId(null);
      setCancelAtPeriodEnd(false);
      setCancelAt(null);
      setCurrentPeriodEnd(null);
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
        setTierName(data.tierName || "Free");
        setHasSubscription(Boolean(data.hasSubscription));
        setPlanId(data.planId || null);
        setProductId(data.productId || null);
        setCancelAtPeriodEnd(Boolean(data.cancelAtPeriodEnd));
        setCancelAt(data.cancelAt || null);
        setCurrentPeriodEnd(data.currentPeriodEnd || null);
        hasFetchedRef.current = true;
      } else {
        setTierCode(null);
        setTierName("Free");
        setHasSubscription(false);
        setPlanId(null);
        setProductId(null);
        setCancelAtPeriodEnd(false);
        setCancelAt(null);
        setCurrentPeriodEnd(null);
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
      setTierName("Free");
      setHasSubscription(false);
      setPlanId(null);
      setProductId(null);
      setCancelAtPeriodEnd(false);
      setCancelAt(null);
      setCurrentPeriodEnd(null);
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
    tierName,
    hasSubscription,
    planId,
    productId,
    cancelAtPeriodEnd,
    cancelAt,
    currentPeriodEnd,
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
