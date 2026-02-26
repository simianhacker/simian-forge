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
      doc['host.name'] = metrics.dimensions['host.name'];
      doc.region = metrics.dimensions.region;
      doc.environment = metrics.dimensions.environment;
    }
    return [{ documents: [doc], format: 'same-metrics' }];
  }
}
