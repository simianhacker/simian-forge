/**
 * Utility functions for hashing strings
 */

/**
 * Generate a deterministic hash from a string using a simple hash algorithm
 * @param str The string to hash
 * @returns A positive integer hash value
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}