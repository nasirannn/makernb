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
  source?: 'replicate' | 'kie'; // 数据来源标识
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

        const res = await fetch(`/api/vocal/separation-status?predictionId=${predictionId}`, {
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

      const response = await fetch('/api/vocal/separation', {
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
        // Refresh credits display (only when actually starting a new job)
        if (refreshCredits && !result.cacheHit) {
          refreshCredits().catch(console.error);
        }

        const data = result.data;
        if (!data?.predictionId) {
          throw new Error('No prediction ID received from server');
        }

        // Cache hit: completed result can be rendered immediately without polling.
        if (result.cacheHit && data.status === 'completed' && data.vocalUrl && data.instrumentalUrl) {
          setSeparations(prev =>
            prev.map(sep =>
              sep.id === processingSeparation.id
                ? {
                    ...sep,
                    id: data.id || data.separationId || sep.id,
                    predictionId: data.predictionId,
                    status: 'completed',
                    originalFilename: data.originalFilename || sep.originalFilename,
                    vocalUrl: data.vocalUrl,
                    instrumentalUrl: data.instrumentalUrl,
                    createdAt: data.createdAt || sep.createdAt,
                    updatedAt: data.updatedAt || sep.updatedAt,
                  }
                : sep
            )
          );

          cleanupResources();
          setIsProcessing(false);
          setProcessingTimer(0);
          toast.success('Loaded existing separation result');
          return;
        }

        // Update the processing separation with real predictionId
        setSeparations(prev =>
          prev.map(sep =>
            sep.id === processingSeparation.id
              ? { ...sep, predictionId: data.predictionId, id: data.separationId || data.id || sep.id }
              : sep
          )
        );

        // Start polling for status updates
        startPollingStatus(data.predictionId);
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
   * Gets user's vocal separations (unified from both sources)
   */
  const getUserSeparations = async (limit: number = 20, offset: number = 0, showErrorToast: boolean = true) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        // 用户未登录，这是正常情况，不显示错误
        setSeparations([]);
        return;
      }

      const response = await fetch(`/api/vocal/separation-unified?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vocal separations');
      }

      const result = await response.json();
      if (result.success && result.data) {
        // 转换为统一格式
        const unifiedData: VocalSeparationData[] = result.data.map((item: any) => ({
          id: item.id,
          predictionId: item.predictionId || item.taskId || item.id,
          status: item.status as VocalSeparationStatus,
          originalFilename: item.originalFilename,
          vocalUrl: item.vocalUrl,
          // 优先使用 instrumentalUrl，如果没有则使用 accompanimentUrl（向后兼容）
          instrumentalUrl: item.instrumentalUrl || item.accompanimentUrl,
          errorMessage: item.errorMessage,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          // 添加来源标记（用于UI显示）
          source: item.source || 'replicate'
        }));
        setSeparations(unifiedData);
      }
    } catch (error) {
      console.error('Error fetching vocal separations:', error);
      if (showErrorToast) {
        toast.error('Failed to load vocal separations');
      }
    }
  };

  /**
   * Starts vocal separation from Studio track (using KIE API)
   */
  const startVocalSeparationFromStudio = async (
    trackId: string,
    refreshCredits?: () => Promise<void>
  ) => {
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
        id: `processing-studio-${Date.now()}`,
        predictionId: `processing-studio-${Date.now()}`,
        status: 'processing',
        originalFilename: `Studio Track ${trackId.substring(0, 8)}...`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'kie'
      } as any;

      setSeparations(prev => [processingSeparation, ...prev]);
      setActiveSeparationId(processingSeparation.id);

      // Call KIE API
      const response = await fetch('/api/vocal/removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          trackId,
          type: 'separate_vocal'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Insufficient credits') {
          throw new Error('Insufficient credits! Please check your credit balance.');
        }
        throw new Error(errorData.error || 'Vocal removal failed');
      }

      const result = await response.json();

      if (result.success) {
        // Refresh credits display (only when actually starting a new job)
        if (refreshCredits && !result.cacheHit) {
          refreshCredits().catch(console.error);
        }

        const data = result.data;
        if (!data?.taskId) {
          throw new Error('No task ID received from server');
        }

        // Cache hit: completed result can be rendered immediately without polling.
        if (result.cacheHit && data.status === 'completed' && data.vocalUrl && data.instrumentalUrl) {
          setSeparations(prev =>
            prev.map(sep =>
              sep.id === processingSeparation.id
                ? {
                    ...sep,
                    id: data.removalId || sep.id,
                    predictionId: data.taskId,
                    status: 'completed',
                    vocalUrl: data.vocalUrl,
                    instrumentalUrl: data.instrumentalUrl,
                    createdAt: data.createdAt || sep.createdAt,
                    updatedAt: data.updatedAt || sep.updatedAt,
                    source: 'kie',
                  }
                : sep
            )
          );

          cleanupResources();
          setIsProcessing(false);
          setProcessingTimer(0);
          toast.success('Loaded existing separation result');
          return;
        }

        // Update the processing separation with real taskId
        setSeparations(prev =>
          prev.map(sep =>
            sep.id === processingSeparation.id
              ? { ...sep, predictionId: data.taskId, id: data.removalId || sep.id }
              : sep
          )
        );

        // Start polling for status updates
        startPollingKieStatus(data.taskId);
      } else {
        throw new Error(result.error || 'Vocal removal failed');
      }
    } catch (error) {
      console.error('Vocal removal from Studio error:', error);

      // Stop timer and reset states
      cleanupResources();
      setIsProcessing(false);
      setProcessingTimer(0);

      // Add error separation to display
      const errorSeparation = createFailedSeparation(
        error instanceof Error ? error.message : 'Vocal removal failed',
        { audioUrl: `track:${trackId}` }
      );
      setSeparations(prev => [errorSeparation, ...prev]);

      // Show error message
      toast.error(error instanceof Error ? error.message : 'Vocal removal failed');
      
      // Re-throw error for outer handling
      throw error;
    }
  };

  /**
   * Polls KIE API status
   */
  const startPollingKieStatus = (taskId: string) => {
    // Clean up existing polling
    cleanupResources();

    // Set timeout for polling (5 minutes)
    pollingTimeoutRef.current = setTimeout(() => {
      console.error('Vocal removal timeout after 5 minutes');
      cleanupResources();
      setIsProcessing(false);
      setProcessingTimer(0);
      
      setSeparations(prev => prev.map(sep => 
        sep.predictionId === taskId 
          ? { ...sep, status: 'error' as VocalSeparationStatus, errorMessage: 'Separation timeout' }
          : sep
      ));
      
      toast.error('Vocal removal timeout. Please try again.');
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

        const res = await fetch(`/api/vocal/removal-status?taskId=${taskId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        if (!res.ok) return;
        
        const payload = await res.json();

        if (payload.success && payload.data) {
          // Update with KIE API response
          const updatedSeparation: VocalSeparationData = {
            id: payload.data.id,
            predictionId: payload.data.taskId || taskId,
            status: payload.data.status,
            originalFilename: `Studio Track ${payload.data.trackId?.substring(0, 8) || 'Unknown'}...`,
            vocalUrl: payload.data.vocalUrl,
            // 优先使用 instrumentalUrl，如果没有则使用 accompanimentUrl（向后兼容）
            instrumentalUrl: payload.data.instrumentalUrl || payload.data.accompanimentUrl,
            errorMessage: payload.data.status === 'error' ? 'Vocal removal failed' : undefined,
            createdAt: payload.data.createdAt,
            updatedAt: payload.data.updatedAt,
            source: 'kie'
          } as any;

          setSeparations(prev => {
            const existingIndex = prev.findIndex(sep => sep.predictionId === taskId);
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = updatedSeparation;
              return updated;
            } else {
              return [...prev, updatedSeparation];
            }
          });

          // If completed, stop processing
          if (payload.data.status === 'completed') {
            setIsProcessing(false);
            setProcessingTimer(0);
            cleanupResources();
            toast.success('Vocal separation completed successfully!');
          } else if (payload.data.status === 'error') {
            setIsProcessing(false);
            setProcessingTimer(0);
            cleanupResources();
            toast.error('Vocal separation failed');
          }
        } else if (payload.error) {
          handlePollingError(payload, taskId);
          return;
        }
      } catch (e) {
        console.warn('Polling KIE vocal removal status failed:', e);
      }
    };

    // Start polling with delay
    setTimeout(() => {
      poll();
      pollingRef.current = setInterval(poll, 3000); // Poll every 3 seconds
    }, 10000); // 10 second delay
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

      const response = await fetch(`/api/vocal/separation/${separationId}`, {
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
    startVocalSeparationFromStudio,
    getUserSeparations,
    deleteSeparation,
    setActiveSeparationId,
  };
};
