/**
 * Types for the edge-cases dataset: 6 data streams that each undergo
 * a mid-backfill rollover to change metric type, field type, histogram
 * variant, or unit.
 */

export type EdgeCasesPhase = 1 | 2;

export type EdgeCasesDimensions = Record<string, string>;

export interface EdgeCasesConfig {
  dataStream: string;
  dimensions?: EdgeCasesDimensions;
}

export interface EdgeCasesMetrics {
  timestamp: Date;
  counterValue: number;
  dataStream: string;
  phase: EdgeCasesPhase;
  dimensions?: EdgeCasesDimensions;
}

export interface EdgeCasesDocument {
  "@timestamp": string;
  "metric.name": string;
  "test.data_stream": string;
  [key: string]: unknown;
}
