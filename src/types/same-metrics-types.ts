/**
 * Types for the same-metrics dataset: three time series test scenarios
 * (same metric in two streams, different units, different dimensions).
 */

export type SameMetricsScenarioKind =
  | 'same_metric_two_datastreams'
  | 'different_units'
  | 'different_dimensions';

export interface SameMetricsDimensions {
  'host.name': string;
  region: string;
  environment: string;
}

export interface SameMetricsConfig {
  dataStream: string;
  scenario: SameMetricsScenarioKind;
  dimensions?: SameMetricsDimensions;
}

export interface SameMetricsMetrics {
  timestamp: Date;
  counterValue: number;
  dataStream: string;
  scenario: SameMetricsScenarioKind;
  dimensions?: SameMetricsDimensions;
}

export interface SameMetricsDocument {
  '@timestamp': string;
  'metric.name': string;
  total_cost: number;
  'test.scenario': string;
  'test.data_stream': string;
  'host.name'?: string;
  region?: string;
  environment?: string;
}
