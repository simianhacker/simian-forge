import { MetricsFormatter } from '../types/simulator-types';
import { UniqueMetricsMetrics, UniqueMetricsDocument } from '../types/unique-metrics-types';
import * as fnv from 'fnv-plus';

export class UniqueMetricsFormatter implements MetricsFormatter<UniqueMetricsDocument> {
  formatMetrics(metrics: UniqueMetricsMetrics): UniqueMetricsDocument[] {
    // Create one document per metric
    const documents: UniqueMetricsDocument[] = [];

    metrics.metrics.forEach(metric => {
      const metricsObj = {
        [metric.name]: metric.value
      };
      
      const document: UniqueMetricsDocument = {
        '@timestamp': metrics.timestamp.toISOString(),
        _metric_names_hash: this.generateMetricNamesHash(metricsObj),
        resource: {
          attributes: {
            'service.name': 'metrics-cardinality-test',
            'service.version': '1.0.0',
            'telemetry.sdk.name': 'opentelemetry',
            'telemetry.sdk.language': 'javascript',
            'telemetry.sdk.version': '1.0.0'
          }
        },
        attributes: {
          'entity.id': metrics.id,
          ...metric.dimensions
        },
        metrics: metricsObj,
        data_stream: {
          type: 'metrics',
          dataset: 'cardinality.otel',
          namespace: 'default'
        }
      };

      documents.push(document);
    });

    return documents;
  }

  private generateMetricNamesHash(metrics: Record<string, number>): string {
    const metricNames = Object.keys(metrics);
    return fnv.hash(metricNames.join(), 32).str();
  }
}