"use client";

import React from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { AppLocale } from "@/lib/i18n/config";

interface GeneratePresetStyleParams {
  genreId: string;
  genreName: string;
  currentText: string;
  onSuccess: (value: string) => void;
}

interface UseStudioPresetStyleGeneratorParams {
  locale: AppLocale;
  isAuthenticated: boolean;
  onRequireAuth?: () => void;
  t: (key: string) => string;
}

export const useStudioPresetStyleGenerator = ({
  locale,
  isAuthenticated,
  onRequireAuth,
  t,
}: UseStudioPresetStyleGeneratorParams) => {
  const [isGeneratingGenrePrompt, setIsGeneratingGenrePrompt] = React.useState(false);
  const [pendingGenreId, setPendingGenreId] = React.useState<string | null>(null);
  const requestAbortRef = React.useRef<AbortController | null>(null);
  const requestIdRef = React.useRef(0);

  const getAccessTokenOrThrow = React.useCallback(async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(t("toasts.failedGetSessionTryLogInAgain"));
    }

    if (!session?.access_token) {
      throw new Error(t("toasts.pleaseLogInToContinue"));
    }

    return session.access_token;
  }, [t]);

  const getJsonAuthHeaders = React.useCallback((accessToken: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  }), []);

  React.useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
    };
  }, []);

  const generateGenrePrompt = React.useCallback(
    async ({ genreId, genreName, currentText, onSuccess }: GeneratePresetStyleParams) => {
      if (!isAuthenticated) {
        onRequireAuth?.();
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      requestAbortRef.current?.abort();
      const abortController = new AbortController();
      requestAbortRef.current = abortController;

      setPendingGenreId(genreId);
      setIsGeneratingGenrePrompt(true);

      try {
        const accessToken = await getAccessTokenOrThrow();

        const response = await fetch("/api/prompt/preset-style", {
          method: "POST",
          headers: getJsonAuthHeaders(accessToken),
          signal: abortController.signal,
          body: JSON.stringify({
            genreId,
            genreName,
            currentPrompt: currentText,
            locale,
          }),
        });

        const result = await response.json().catch(() => ({} as Record<string, unknown>));

        if (abortController.signal.aborted || requestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok || result?.success !== true) {
          if (response.status === 401) {
            onRequireAuth?.();
            throw new Error(t("toasts.sessionExpiredLogInAgain"));
          }

          throw new Error(
            typeof result?.error === "string" ? result.error : t("toasts.failedGeneratePrompt")
          );
        }

        const generatedPrompt =
          typeof result?.data === "object" &&
          result.data !== null &&
          typeof (result.data as { prompt?: unknown }).prompt === "string"
            ? ((result.data as { prompt: string }).prompt || "").trim()
            : "";

        if (!generatedPrompt) {
          throw new Error(t("toasts.modelReturnedEmptyPromptTryAgain"));
        }

        onSuccess(generatedPrompt);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error("Generate genre prompt failed:", error);
        const message = error instanceof Error ? error.message : t("toasts.failedGeneratePrompt");
        toast.error(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsGeneratingGenrePrompt(false);
          setPendingGenreId(null);
          requestAbortRef.current = null;
        }
      }
    },
    [getAccessTokenOrThrow, getJsonAuthHeaders, isAuthenticated, locale, onRequireAuth, t]
  );

  return {
    isGeneratingGenrePrompt,
    pendingGenreId,
    generateGenrePrompt,
  };
};
