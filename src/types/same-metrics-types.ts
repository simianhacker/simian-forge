/**
 * Types for the same-metrics dataset: 9 scenario pairs testing
 * identical streams, different dimensions, ES metric types, field types,
 * histogram variants, and unit differences.
 */

export type SameMetricsScenarioKind =
  | "identical"
  | "diff_dims"
  | "diff_estype"
  | "diff_estype_histogram"
  | "diff_fieldtype"
  | "diff_histogram_tdigest_exp"
  | "diff_histogram_tdigest_legacy"
  | "diff_unit_null_ms"
  | "diff_unit_ms_s";

export type SameMetricsDimensions = Record<string, string>;

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
  "@timestamp": string;
  "metric.name": string;
  request_duration: number;
  "test.scenario": string;
  "test.data_stream": string;
  [key: string]: unknown;
}
