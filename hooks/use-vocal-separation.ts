import { useState, useEffect, useRef } from "react";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type VocalSeparationStatus = 'processing' | 'completed' | 'error';

export interface VocalSeparationData {
  id: string;
  predictionId: string;
  status: VocalSeparationStatus;
  originalFilename: string;
  vocalUrl?: string;
  instrumentalUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VocalSeparationRequest {
  file?: File;
  audioUrl?: string;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export const useVocalSeparation = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [isProcessing, setIsProcessing] = useState(false);
  const [separations, setSeparations] = useState<VocalSeparationData[]>([]);
  const [activeSeparationId, setActiveSeparationId] = useState<string | null>(null);
  const [processingTimer, setProcessingTimer] = useState(0);

  // ============================================================================
  // REFS AND TIMERS
  // ============================================================================

  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Cleans up all timers and polling intervals
   */
  const cleanupResources = () => {
    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
      processingTimerRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };

  /**
   * Validates vocal separation request
   */
  const validateRequest = (request: VocalSeparationRequest): boolean => {
    if (!request.file && !request.audioUrl) {
      toast.error("Please provide either a file or audio URL");
      return false;
    }

    return true;
  };

  /**
   * Creates a failed separation object for error display
   */
  const createFailedSeparation = (errorMessage: string, request: VocalSeparationRequest): VocalSeparationData => {
    return {
      id: `failed-${Date.now()}`,
      predictionId: `failed-${Date.now()}`,
      status: 'error',
      originalFilename: request.file?.name || (request.audioUrl?.split('/').pop() || 'audio'),
      errorMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // ============================================================================
  // POLLING LOGIC
  // ============================================================================

  /**
   * Handles API error responses during polling
   */
  const handlePollingError = (payload: any, predictionId: string) => {
    console.error('Stopping polling due to API error for predictionId:', predictionId);

    // Stop all timers
    cleanupResources();

    // Update states
    setIsProcessing(false);
    setProcessingTimer(0);

    // Update separation status to error
    setSeparations(prev => prev.map(sep => 
      sep.predictionId === predictionId 
        ? { ...sep, status: 'error' as VocalSeparationStatus, errorMessage: payload.msg || 'Separation failed' }
        : sep
    ));

    toast.error(payload.msg || 'Vocal separation failed');
  };

  /**
   * Updates separation data from API response
   */
  const updateSeparationFromResponse = (responseData: any) => {
    const updatedSeparation: VocalSeparationData = {
      id: responseData.id,
      predictionId: responseData.predictionId,
      status: responseData.status,
      originalFilename: responseData.originalFilename,
      vocalUrl: responseData.vocalUrl,
      instrumentalUrl: responseData.instrumentalUrl,
      errorMessage: responseData.errorMessage,
      createdAt: responseData.createdAt,
      updatedAt: responseData.updatedAt
    };

    setSeparations(prev => {
      const existingIndex = prev.findIndex(sep => sep.predictionId === responseData.predictionId);
      if (existingIndex >= 0) {
        // Update existing separation
        const updated = [...prev];
        updated[existingIndex] = updatedSeparation;
        return updated;
      } else {
        // Add new separation
        return [...prev, updatedSeparation];
      }
    });

    // If completed, stop processing
    if (responseData.status === 'completed') {
      setIsProcessing(false);
      setProcessingTimer(0);
      cleanupResources();
      toast.success('Vocal separation completed successfully!');
    } else if (responseData.status === 'error') {
      setIsProcessing(false);
      setProcessingTimer(0);
      cleanupResources();
      toast.error(responseData.errorMessage || 'Vocal separation failed');
    }
  };

  /**
   * Starts polling for vocal separation status
   */
  const startPollingStatus = (predictionId: string) => {
    // Clean up existing polling
    cleanupResources();

    // Set timeout for polling (5 minutes)
    pollingTimeoutRef.current = setTimeout(() => {
      console.error('Vocal separation timeout after 5 minutes');
      cleanupResources();
      setIsProcessing(false);
      setProcessingTimer(0);
      
      setSeparations(prev => prev.map(sep => 
        sep.predictionId === predictionId 
          ? { ...sep, status: 'error' as VocalSeparationStatus, errorMessage: 'Separation timeout' }
          : sep
      ));
      
      toast.error('Vocal separation timeout. Please try again.');
    }, 5 * 60 * 1000);

    const poll = async () => {
      try {
        // Check network connection
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('No internet connection, skipping poll');
          return;
        }

        // Get current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.warn('No session found, stopping poll');
          return;
        }

        const res = await fetch(`/api/vocal-separation-status?predictionId=${predictionId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) return;
        
        const payload = await res.json();

        if (payload.success && payload.data) {
          updateSeparationFromResponse(payload.data);
          
          // If completed or error, stop polling
          if (payload.data.status === 'completed' || payload.data.status === 'error') {
            cleanupResources();
            return;
          }
        } else if (payload.error) {
          handlePollingError(payload, predictionId);
          return;
        }
      } catch (e) {
        console.warn('Polling vocal separation status failed:', e);
      }
    };

    // Start polling with delay
    setTimeout(() => {
      poll();
      pollingRef.current = setInterval(poll, 3000); // Poll every 3 seconds
    }, 10000); // 10 second delay
  };

  // ============================================================================
  // MAIN FUNCTIONS
  // ============================================================================

  /**
   * Starts vocal separation process
   */
  const startVocalSeparation = async (
    request: VocalSeparationRequest,
    refreshCredits?: () => Promise<void>
  ) => {
    if (!validateRequest(request)) {
      throw new Error('Invalid vocal separation request');
    }

    setIsProcessing(true);
    setProcessingTimer(0);

    // Start processing timer
    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
    }
    processingTimerRef.current = setInterval(() => {
      setProcessingTimer(prev => prev + 1);
    }, 1000);

    try {
      // Get Supabase session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Add processing separation to state
      const processingSeparation: VocalSeparationData = {
        id: `processing-${Date.now()}`,
        predictionId: `processing-${Date.now()}`,
        status: 'processing',
        originalFilename: request.file?.name || (request.audioUrl?.split('/').pop() || 'audio'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setSeparations(prev => [processingSeparation, ...prev]);
      setActiveSeparationId(processingSeparation.id);

      // Call API
      const formData = new FormData();
      if (request.file) {
        formData.append('file', request.file);
      }
      if (request.audioUrl) {
        formData.append('audioUrl', request.audioUrl);
      }

      const response = await fetch('/api/vocal-separation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Insufficient credits') {
          throw new Error('Insufficient credits! Please check your credit balance.');
        }
        throw new Error(errorData.error || 'Vocal separation failed');
      }

      const result = await response.json();

      if (result.success) {
        // Refresh credits display
        if (refreshCredits) {
          refreshCredits().catch(console.error);
        }

        if (result.data?.predictionId) {
          // Update the processing separation with real predictionId
          setSeparations(prev => prev.map(sep => 
            sep.id === processingSeparation.id 
              ? { ...sep, predictionId: result.data.predictionId, id: result.data.separationId || sep.id }
              : sep
          ));

          // Start polling for status updates
          startPollingStatus(result.data.predictionId);
        } else {
          throw new Error('No prediction ID received from server');
        }
      } else {
        throw new Error(result.error || 'Vocal separation failed');
      }
    } catch (error) {
      console.error('Vocal separation error:', error);

      // Stop timer and reset states
      cleanupResources();
      setIsProcessing(false);
      setProcessingTimer(0);

      // Add error separation to display
      const errorSeparation = createFailedSeparation(
        error instanceof Error ? error.message : 'Vocal separation failed',
        request
      );
      setSeparations(prev => [errorSeparation, ...prev]);

      // Show error message
      toast.error(error instanceof Error ? error.message : 'Vocal separation failed');
      
      // Re-throw error for outer handling
      throw error;
    }
  };

  /**
   * Gets user's vocal separations
   */
  const getUserSeparations = async (limit: number = 20, offset: number = 0, showErrorToast: boolean = true) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // 用户未登录，这是正常情况，不显示错误
        setSeparations([]);
        return;
      }

      const response = await fetch(`/api/user-vocal-separations?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vocal separations');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setSeparations(result.data);
      }
    } catch (error) {
      console.error('Error fetching vocal separations:', error);
      if (showErrorToast) {
        toast.error('Failed to load vocal separations');
      }
    }
  };

  /**
   * Deletes a vocal separation
   */
  const deleteSeparation = async (separationId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch(`/api/vocal-separation/${separationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete vocal separation');
      }

      // Remove from local state
      setSeparations(prev => prev.filter(sep => sep.id !== separationId));
      toast.success('Vocal separation deleted successfully');
    } catch (error) {
      console.error('Error deleting vocal separation:', error);
      toast.error('Failed to delete vocal separation');
    }
  };

  // ============================================================================
  // CLEANUP
  // ============================================================================

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    isProcessing,
    separations,
    activeSeparationId,
    processingTimer,

    // Functions
    startVocalSeparation,
    getUserSeparations,
    deleteSeparation,
    setActiveSeparationId,
  };
};
