/**
 * Utility functions for hashing and seeded random number generation
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

/**
 * Create a seeded pseudo-random number generator
 * @param seed The seed value - can be a string (will be hashed) or number
 * @returns A function that returns deterministic pseudo-random numbers between 0 and 1
 */
export function seededRandom(seed: string | number): () => number {
  let state = typeof seed === 'string' ? hashString(seed) : Math.abs(seed);
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}