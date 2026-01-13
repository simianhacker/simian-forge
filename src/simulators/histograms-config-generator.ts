import { ConfigGenerator } from '../types/simulator-types';
import { HistogramsConfig } from '../types/histogram-types';
import { createHash } from 'crypto';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

export class HistogramsConfigGenerator implements ConfigGenerator<HistogramsConfig> {
  generateConfig(id: string): HistogramsConfig {
    return tracer.startActiveSpan('generateConfig', (span) => {
      try {
        const seed = this.createSeed(id);
        const rng = this.createSeededRandom(seed);

        // Latency-like (positive, heavy-tailed) distribution parameters.
        const median = 5 + rng() * 250; // 5ms..255ms-ish
        const sigma = 0.4 + rng() * 0.8; // 0.4..1.2 (controls tail heaviness)

        const config: HistogramsConfig = {
          id,
          distribution: {
            type: 'lognormal',
            median,
            sigma,
            minValue: 0
          }
        };

        span.setStatus({ code: 1 });
        return config;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private createSeed(input: string): number {
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

