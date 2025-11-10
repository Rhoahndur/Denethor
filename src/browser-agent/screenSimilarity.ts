/**
 * Screen Similarity Detector
 *
 * Efficiently detects whether two screenshots are significantly different
 * to determine if AI vision analysis is needed. Uses downsampled perceptual
 * hashing for speed.
 *
 * @module screenSimilarity
 */

import sharp from "sharp";
import { logger } from "@/utils/logger";

const log = logger.child({ component: "ScreenSimilarity" });

/**
 * Calculate perceptual hash of an image for similarity comparison.
 * Uses average hash algorithm (fast, good for layout changes).
 *
 * @param imageBuffer - Screenshot buffer
 * @returns 64-bit hash as bigint
 */
async function calculatePerceptualHash(imageBuffer: Buffer): Promise<bigint> {
  // Resize to 8x8 grayscale for speed
  const { data, info } = await sharp(imageBuffer)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate average pixel value
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] || 0;
  }
  const avg = sum / data.length;

  // Build hash: bit = 1 if pixel > avg, else 0
  let hash = BigInt(0);
  for (let i = 0; i < data.length; i++) {
    if ((data[i] || 0) > avg) {
      hash |= BigInt(1) << BigInt(i);
    }
  }

  return hash;
}

/**
 * Calculate Hamming distance between two hashes.
 *
 * @param hash1 - First perceptual hash
 * @param hash2 - Second perceptual hash
 * @returns Number of differing bits (0-64)
 */
function hammingDistance(hash1: bigint, hash2: bigint): number {
  let xor = hash1 ^ hash2;
  let distance = 0;

  while (xor > 0) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }

  return distance;
}

/**
 * Compare two screenshots for similarity.
 *
 * @param screenshot1 - First screenshot buffer
 * @param screenshot2 - Second screenshot buffer
 * @returns Similarity score 0-100 (100 = identical, 0 = completely different)
 */
export async function calculateSimilarity(
  screenshot1: Buffer,
  screenshot2: Buffer,
): Promise<number> {
  const [hash1, hash2] = await Promise.all([
    calculatePerceptualHash(screenshot1),
    calculatePerceptualHash(screenshot2),
  ]);

  const distance = hammingDistance(hash1, hash2);

  // Convert hamming distance to similarity percentage
  // 0 distance = 100% similar, 64 distance = 0% similar
  const similarity = Math.round(((64 - distance) / 64) * 100);

  return similarity;
}

/**
 * Determine if screen has changed significantly.
 *
 * @param before - Screenshot before action
 * @param after - Screenshot after action
 * @param threshold - Similarity threshold (default 90%). Below this = significant change.
 * @returns True if screen changed significantly
 */
export async function hasSignificantChange(
  before: Buffer,
  after: Buffer,
  threshold: number = 90,
): Promise<boolean> {
  const similarity = await calculateSimilarity(before, after);
  const changed = similarity < threshold;

  log.debug(
    { similarity, threshold, changed },
    "Screen similarity check",
  );

  return changed;
}

/**
 * Cache for tracking screen history for similarity detection.
 */
export class ScreenHistoryTracker {
  private previousHash: bigint | null = null;
  private consecutiveSimilarScreens = 0;

  /**
   * Update with new screenshot and check if it's similar to previous.
   *
   * @param screenshot - Current screenshot
   * @param threshold - Similarity threshold (default 95%)
   * @returns True if screen is similar to previous
   */
  async isSimilarToPrevious(
    screenshot: Buffer,
    threshold: number = 95,
  ): Promise<boolean> {
    const currentHash = await calculatePerceptualHash(screenshot);

    if (this.previousHash === null) {
      this.previousHash = currentHash;
      this.consecutiveSimilarScreens = 0;
      return false;
    }

    const distance = hammingDistance(this.previousHash, currentHash);
    const similarity = Math.round(((64 - distance) / 64) * 100);
    const isSimilar = similarity >= threshold;

    if (isSimilar) {
      this.consecutiveSimilarScreens++;
    } else {
      this.consecutiveSimilarScreens = 0;
    }

    this.previousHash = currentHash;

    log.debug(
      {
        similarity,
        threshold,
        isSimilar,
        consecutiveSimilar: this.consecutiveSimilarScreens
      },
      "Screen history check",
    );

    return isSimilar;
  }

  /**
   * Get count of consecutive similar screens (useful for detecting stuck state).
   */
  getConsecutiveSimilarCount(): number {
    return this.consecutiveSimilarScreens;
  }

  /**
   * Reset the tracker.
   */
  reset(): void {
    this.previousHash = null;
    this.consecutiveSimilarScreens = 0;
  }
}
