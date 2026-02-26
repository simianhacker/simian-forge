import {
  SameMetricsDocument,
  SameMetricsMetrics
} from '../types/same-metrics-types';
import { FormatterResult } from '../types/simulator-types';

const METRIC_NAME = 'cost_total';

export class SameMetricsFormatter {
  formatMetrics(metrics: SameMetricsMetrics): FormatterResult<SameMetricsDocument>[] {
    const doc: SameMetricsDocument = {
      '@timestamp': metrics.timestamp.toISOString(),
      'metric.name': METRIC_NAME,
      total_cost: metrics.counterValue,
      'test.scenario': metrics.scenario,
      'test.data_stream': metrics.dataStream
    };
    if (metrics.dimensions) {
      for (const [key, value] of Object.entries(metrics.dimensions)) {
        (doc as unknown as Record<string, unknown>)[key] = value;
      }
    }
    return [{ documents: [doc], format: 'same-metrics' }];
  }
}
