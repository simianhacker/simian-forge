import { MetricsGenerator } from "../types/simulator-types";
import { HistogramsConfig, HistogramsMetrics } from "../types/histogram-types";
import { HistogramsGenerator } from "./histograms-generator";

export class HistogramsMetricsGenerator implements MetricsGenerator<
  HistogramsConfig,
  HistogramsMetrics
> {
  private generator: HistogramsGenerator;

  constructor() {
    this.generator = new HistogramsGenerator();
  }

  generateMetrics(
    config: HistogramsConfig,
    timestamp: Date,
  ): HistogramsMetrics {
    return {
      timestamp,
      entity: config,
      histograms: {
        tdigest: this.generator.generateTdigestHistogram(config, timestamp),
        legacy: this.generator.generateLegacyHistogram(config, timestamp),
        exponential: this.generator.generateExponentialHistogram(
          config,
          timestamp,
        ),
      },
    };
  }
}
