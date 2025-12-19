/**
 * Image Utilities
 *
 * Provides simple image file handling without processing.
 * Images are stored as-is and optimized via Cloudflare Image Resizing.
 */

/**
 * Get image file extension from buffer
 * Simple detection based on file signature (magic numbers)
 */
export function detectImageFormat(buffer: Buffer): string {
  // Check PNG signature
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }

  // Check JPEG signature
  if (buffer.length >= 3 &&
      buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }

  // Check WebP signature
  if (buffer.length >= 12 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 &&
      buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'webp';
  }

  // Check GIF signature
  if (buffer.length >= 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }

  // Default to PNG
  return 'png';
}
