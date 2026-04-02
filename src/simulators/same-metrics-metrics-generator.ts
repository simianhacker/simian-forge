import { MetricsGenerator } from "../types/simulator-types";
import {
  SameMetricsConfig,
  SameMetricsMetrics,
} from "../types/same-metrics-types";
import { STREAM_TEMPLATE_CONFIGS } from "./same-metrics-template-builder";

/**
 * Deterministic counter value per stream and time so we can tell streams apart in the UI.
 * Each data stream gets a different base (from STREAM_TEMPLATE_CONFIGS) so values don't overlap.
 */
function counterValueForStream(dataStream: string, timestamp: Date): number {
  const base = STREAM_TEMPLATE_CONFIGS[dataStream]?.baseValue ?? 100;
  const minutes = Math.floor(timestamp.getTime() / (60 * 1000));
  return base + minutes * 5;
}

export class SameMetricsMetricsGenerator
  implements MetricsGenerator<SameMetricsConfig, SameMetricsMetrics>
{
  generateMetrics(
    config: SameMetricsConfig,
    timestamp: Date,
  ): SameMetricsMetrics {
    const metrics: SameMetricsMetrics = {
      timestamp,
      counterValue: counterValueForStream(config.dataStream, timestamp),
      dataStream: config.dataStream,
      scenario: config.scenario,
    };
    if (config.dimensions) {
      metrics.dimensions = config.dimensions;
    }
    return metrics;
  }
}
