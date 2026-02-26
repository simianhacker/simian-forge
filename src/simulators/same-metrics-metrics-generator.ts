import { MetricsGenerator } from '../types/simulator-types';
import {
  SameMetricsConfig,
  SameMetricsMetrics
} from '../types/same-metrics-types';

/**
 * Deterministic counter value per stream and time so we can tell streams apart in the UI.
 * Each data stream gets a different base so values don't overlap.
 */
function counterValueForStream(dataStream: string, timestamp: Date): number {
  const bases: Record<string, number> = {
    'timeseries-same-metric-different-unit-eur': 85,
    'timeseries-same-metric-different-unit-usd': 200,
    'timeseries-same-metric-different-unit-null': 150,
    'timeseries-same-metric-different-datastream-1': 100,
    'timeseries-same-metric-different-datastream-2': 10,
    'timeseries-same-metric-different-dimensions-has-4': 50,
    'timeseries-same-metric-different-dimensions-has-1': 300
  };
  const base = bases[dataStream] ?? 100;
  const minutes = Math.floor(timestamp.getTime() / (60 * 1000));
  return base + minutes * 5;
}

export class SameMetricsMetricsGenerator
  implements MetricsGenerator<SameMetricsConfig, SameMetricsMetrics>
{
  generateMetrics(
    config: SameMetricsConfig,
    timestamp: Date
  ): SameMetricsMetrics {
    const metrics: SameMetricsMetrics = {
      timestamp,
      counterValue: counterValueForStream(config.dataStream, timestamp),
      dataStream: config.dataStream,
      scenario: config.scenario
    };
    if (config.dimensions) {
      metrics.dimensions = config.dimensions;
    }
    return metrics;
  }
}
