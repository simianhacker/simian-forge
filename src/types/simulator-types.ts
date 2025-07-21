export interface BulkHelperOptions {
  flushBytes?: number;
  flushInterval?: number;
  concurrency?: number;
  retries?: number;
}

export interface BaseSimulatorOptions {
  interval: string;
  backfill: string;
  count: number;
  elasticsearchUrl: string;
  elasticsearchAuth?: string;
  elasticsearchApiKey?: string;
  bulkHelper?: BulkHelperOptions;
  noRealtime?: boolean;
}

export interface ConfigGenerator<T> {
  generateConfig(id: string): T;
}

export interface MetricsGenerator<TConfig, TMetrics> {
  generateMetrics(config: TConfig, timestamp: Date): TMetrics;
}

export interface MetricsFormatter<TDocument> {
  formatMetrics(metrics: any): TDocument[];
}

export interface FormatterResult<TDocument> {
  documents: TDocument[];
  format: string;
}