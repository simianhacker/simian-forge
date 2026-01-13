export interface HistogramsConfig {
  id: string;
  /**
   * Parameters that influence the generated distribution for this entity.
   * Kept stable across runs (deterministic per entity).
   */
  distribution: {
    type: 'lognormal';
    /** Typical value (roughly median) */
    median: number;
    /** Spread (higher means heavier tail) */
    sigma: number;
    /** Hard floor for values (e.g. latency cannot be negative) */
    minValue: number;
  };
}

export interface HistogramField {
  values: number[];
  counts: number[];
}

export interface ExponentialHistogramField {
  scale: number;
  sum?: number;
  min?: number | null;
  max?: number | null;
  zero?: {
    threshold?: number;
    count?: number;
  };
  positive?: {
    indices: number[];
    counts: number[];
  };
  negative?: {
    indices: number[];
    counts: number[];
  };
}

export interface HistogramsMetrics {
  timestamp: Date;
  entity: HistogramsConfig;
  histograms: {
    tdigest: HistogramField;
    hdr: HistogramField;
    exponential: ExponentialHistogramField;
  };
}

export interface HistogramsDocument {
  '@timestamp': string;
  'entity.id': string;
  'histogram.tdigest': HistogramField;
  'histogram.hdr': HistogramField;
  'histogram.exponential': ExponentialHistogramField;
}

