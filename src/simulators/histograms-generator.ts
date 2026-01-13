import { createHash } from 'crypto';
import { trace } from '@opentelemetry/api';
import { ExponentialHistogramField, HistogramField, HistogramsConfig } from '../types/histogram-types';

const tracer = trace.getTracer('simian-forge');

export class HistogramsGenerator {
  generateTdigestHistogram(config: HistogramsConfig, timestamp: Date, sampleCount: number = 200, centroids: number = 20): HistogramField {
    return tracer.startActiveSpan('generateTdigestHistogram', (span) => {
      try {
        const samples = this.generateSamples(config, timestamp, sampleCount);
        const sorted = [...samples].sort((a, b) => a - b);

        const k = Math.max(1, Math.min(centroids, sorted.length));
        const groupSize = Math.ceil(sorted.length / k);

        const values: number[] = [];
        const counts: number[] = [];

        for (let i = 0; i < sorted.length; i += groupSize) {
          const group = sorted.slice(i, i + groupSize);
          const count = group.length;
          const mean = group.reduce((s, v) => s + v, 0) / count;

          const prev = values.length ? values[values.length - 1] : -Infinity;
          const v = mean > prev ? mean : prev + 1e-12;

          values.push(v);
          counts.push(count);
        }

        span.setStatus({ code: 1 });
        return { values, counts };
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  generateHdrHistogram(config: HistogramsConfig, timestamp: Date, sampleCount: number = 200, buckets: number = 60): HistogramField {
    return tracer.startActiveSpan('generateHdrHistogram', (span) => {
      try {
        const samples = this.generateSamples(config, timestamp, sampleCount);

        const positive = samples.filter(v => v > 0);
        const min = Math.max(config.distribution.minValue || 0, Math.min(...positive, 1e-9));
        const max = Math.max(...positive, min * 10);

        const bucketCount = Math.max(5, buckets);
        const factor = Math.pow(max / min, 1 / bucketCount);

        const boundaries: number[] = [min];
        for (let i = 0; i < bucketCount; i++) {
          boundaries.push(boundaries[boundaries.length - 1] * factor);
        }

        const bucketCounts = new Array(bucketCount).fill(0);

        for (const v of positive) {
          // Find bucket by log scaling
          const idx = Math.min(
            bucketCount - 1,
            Math.max(0, Math.floor(Math.log(v / min) / Math.log(factor)))
          );
          bucketCounts[idx] += 1;
        }

        const values: number[] = [];
        const counts: number[] = [];
        for (let i = 0; i < bucketCount; i++) {
          const c = bucketCounts[i];
          if (c <= 0) continue;
          const low = boundaries[i];
          const high = boundaries[i + 1];
          // Geometric midpoint is a good representative for log buckets
          const mid = Math.sqrt(low * high);
          values.push(mid);
          counts.push(c);
        }

        span.setStatus({ code: 1 });
        return { values, counts };
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  generateExponentialHistogram(config: HistogramsConfig, timestamp: Date, sampleCount: number = 200, scale: number = 8): ExponentialHistogramField {
    return tracer.startActiveSpan('generateExponentialHistogram', (span) => {
      try {
        const samples = this.generateSamples(config, timestamp, sampleCount);
        const threshold = 0;

        const base = Math.pow(2, Math.pow(2, -scale));
        const logBase = Math.log(base);

        const buckets = new Map<number, number>();
        let zeroCount = 0;

        let sum = 0;
        let min: number | null = null;
        let max: number | null = null;

        for (const v of samples) {
          sum += v;
          min = min === null ? v : Math.min(min, v);
          max = max === null ? v : Math.max(max, v);

          if (Math.abs(v) <= threshold) {
            zeroCount += 1;
            continue;
          }

          if (v > 0) {
            const idx = Math.floor(Math.log(v) / logBase);
            buckets.set(idx, (buckets.get(idx) || 0) + 1);
          } else {
            // This dataset is intended to be positive-valued; if negative values occur, ignore them.
          }
        }

        const indices = Array.from(buckets.keys()).sort((a, b) => a - b);
        const counts = indices.map(i => buckets.get(i) || 0);

        const exponential: ExponentialHistogramField = {
          scale,
          sum,
          min,
          max,
          zero: { threshold, count: zeroCount },
          positive: { indices, counts }
        };

        span.setStatus({ code: 1 });
        return exponential;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private generateSamples(config: HistogramsConfig, timestamp: Date, sampleCount: number): number[] {
    const seed = this.createTimeSeed(config.id, timestamp);
    const rng = this.createSeededRandom(seed);

    const { median, sigma, minValue } = config.distribution;
    const mu = Math.log(Math.max(1e-12, median));

    const samples: number[] = [];
    for (let i = 0; i < sampleCount; i++) {
      const z = this.normal01(rng);
      const value = Math.exp(mu + sigma * z);
      samples.push(Math.max(minValue, value));
    }
    return samples;
  }

  private normal01(rng: () => number): number {
    // Box-Muller transform
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private createTimeSeed(entityId: string, timestamp: Date): number {
    // Use seconds resolution to avoid repeating histograms at typical 10s intervals
    const timeStr = Math.floor(timestamp.getTime() / 1000).toString();
    const input = `${entityId}-${timeStr}`;
    const hash = createHash('md5').update(input).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  private createSeededRandom(seed: number): () => number {
    let currentSeed = seed;
    return () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }
}

