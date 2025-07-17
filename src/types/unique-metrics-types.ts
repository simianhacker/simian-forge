export interface UniqueMetricsConfig {
  id: string;
  metricNames: string[];
  baseDimensions: { [key: string]: string };
}

export interface UniqueMetricsMetrics {
  id: string;
  timestamp: Date;
  metrics: {
    name: string;
    value: number;
    dimensions: { [key: string]: string };
  }[];
}

export interface UniqueMetricsDocument {
  '@timestamp': string;
  _metric_names_hash: string;
  resource: {
    attributes: {
      'service.name': string;
      'service.version': string;
      'telemetry.sdk.name': string;
      'telemetry.sdk.language': string;
      'telemetry.sdk.version': string;
    };
  };
  attributes: {
    [key: string]: string;
  };
  metrics: {
    [key: string]: number;
  };
  data_stream: {
    type: 'metrics';
    dataset: 'cardinality.otel';
    namespace: 'default';
  };
}