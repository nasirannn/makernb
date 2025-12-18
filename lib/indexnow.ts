/**
 * IndexNow Integration
 *
 * IndexNow is a protocol that allows websites to instantly notify search engines
 * (Bing, Yandex, etc.) about content updates.
 *
 * Learn more: https://www.indexnow.org/
 */

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'a6aae107e81f4596bf98f78cf0f05672';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://makernb.com';

/**
 * Submit URLs to IndexNow for immediate indexing
 *
 * @param urls - Single URL string or array of URLs to submit
 * @returns Promise<boolean> - Success status
 *
 * @example
 * // Submit single URL
 * await submitToIndexNow('https://makernb.com/track/123');
 *
 * @example
 * // Submit multiple URLs
 * await submitToIndexNow([
 *   'https://makernb.com/explore',
 *   'https://makernb.com/track/123'
 * ]);
 */
export async function submitToIndexNow(urls: string | string[]): Promise<boolean> {
  // Skip in development environment
  if (process.env.NODE_ENV === 'development') {
    console.log('[IndexNow] Skipped in development:', urls);
    return true;
  }

  // Skip if site URL is not configured
  if (!SITE_URL || SITE_URL === 'https://yourdomain.com') {
    console.warn('[IndexNow] NEXT_PUBLIC_SITE_URL not configured');
    return false;
  }

  const urlList = Array.isArray(urls) ? urls : [urls];

  // Validate URLs
  const validUrls = urlList.filter(url => {
    try {
      new URL(url);
      return true;
    } catch {
      console.error('[IndexNow] Invalid URL:', url);
      return false;
    }
  });

  if (validUrls.length === 0) {
    console.error('[IndexNow] No valid URLs to submit');
    return false;
  }

  try {
    const host = new URL(SITE_URL).host;
    const payload = {
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: validUrls,
    };

    console.log('[IndexNow] Submitting URLs:', validUrls);

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      console.log('[IndexNow] Successfully submitted:', validUrls.length, 'URLs');
      return true;
    } else {
      const status = response.status;
      let errorMessage = `HTTP ${status}`;

      try {
        const text = await response.text();
        errorMessage += `: ${text}`;
      } catch {
        // Ignore error reading response body
      }

      console.error('[IndexNow] Submission failed:', errorMessage);
      return false;
    }
  } catch (error) {
    console.error('[IndexNow] Error submitting:', error);
    return false;
  }
}

/**
 * Submit a track URL to IndexNow
 *
 * @param trackId - The track ID
 * @returns Promise<boolean> - Success status
 */
export async function submitTrackToIndexNow(trackId: string): Promise<boolean> {
  const trackUrl = `${SITE_URL}/track/${trackId}`;
  return submitToIndexNow(trackUrl);
}

/**
 * Submit multiple track URLs to IndexNow
 *
 * @param trackIds - Array of track IDs
 * @returns Promise<boolean> - Success status
 */
export async function submitTracksToIndexNow(trackIds: string[]): Promise<boolean> {
  const trackUrls = trackIds.map(id => `${SITE_URL}/track/${id}`);
  return submitToIndexNow(trackUrls);
}

/**
 * Submit explore page to IndexNow
 *
 * @returns Promise<boolean> - Success status
 */
export async function submitExplorePageToIndexNow(): Promise<boolean> {
  return submitToIndexNow(`${SITE_URL}/explore`);
}

/**
 * Submit home page to IndexNow
 *
 * @returns Promise<boolean> - Success status
 */
export async function submitHomePageToIndexNow(): Promise<boolean> {
  return submitToIndexNow(SITE_URL);
}
