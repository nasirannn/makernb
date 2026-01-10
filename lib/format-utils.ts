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
 * Format: "Nov 11, 2025, 10:03 AM"
 * @param dateString - Date string to format
 * @returns Formatted date time string
 */
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
