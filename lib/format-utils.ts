/**
 * Format utilities for displaying data in consistent formats
 */

/**
 * Format duration from seconds to MM:SS format
 * @param totalSeconds - Total duration in seconds
 * @returns Formatted string "M:SS" or empty string if invalid
 */
export const formatDuration = (totalSeconds: number): string => {
  // Handle NaN or invalid values
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '';
  }
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Format duration from seconds to human-readable minutes format
 * @param totalSeconds - Total duration in seconds
 * @returns Formatted string "X minute(s)" or empty string if invalid
 */
export const formatDurationInMinutes = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds <= 0) {
    return '';
  }
  
  const totalMinutes = Math.floor(totalSeconds / 60);
  return `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
};

/**
 * Format date to ISO date string (YYYY-MM-DD)
 * @param dateString - Date string to format
 * @returns Formatted date string
 */
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toISOString().split('T')[0];
};

/**
 * Format date to localized date time string
 * @param dateString - Date string to format
 * @returns Formatted date time string
 */
export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

