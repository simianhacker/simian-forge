export interface StreamTemplateConfig {
  routingPath: string[];
  metricUnit?: "usd" | "eur";
  dimensions?: string[];
}

const BASE_ROUTING_PATH = ["metric.name"];
const HAS_4_DIMENSIONS = ["host.name", "region", "environment"];

export const STREAM_TEMPLATE_CONFIGS: Record<string, StreamTemplateConfig> = {
  "timeseries-same-metric-different-unit-eur": {
    routingPath: BASE_ROUTING_PATH,
    metricUnit: "eur",
  },
  "timeseries-same-metric-different-unit-usd": {
    routingPath: BASE_ROUTING_PATH,
    metricUnit: "usd",
  },
  "timeseries-same-metric-different-unit-null": {
    routingPath: BASE_ROUTING_PATH,
  },
  "timeseries-same-metric-different-datastream-1": {
    routingPath: BASE_ROUTING_PATH,
  },
  "timeseries-same-metric-different-datastream-2": {
    routingPath: BASE_ROUTING_PATH,
  },
  "timeseries-same-metric-different-dimensions-has-1": {
    routingPath: BASE_ROUTING_PATH,
    dimensions: ["host.name"],
  },
  "timeseries-same-metric-different-dimensions-has-4": {
    routingPath: ["metric.name"],
    dimensions: ["host.name", "region", "environment"],
  },
};

/**
 * Build the Elasticsearch index template body for a same-metrics data stream.
 * Stream-specific behavior is driven by STREAM_TEMPLATE_CONFIGS; no branching on stream name in the build.
 */
export function buildIndexTemplate(
  dataStream: string,
  startTime: string,
): Record<string, unknown> {
  const config = STREAM_TEMPLATE_CONFIGS[dataStream];
  if (!config) {
    throw new Error(`Unknown same-metrics data stream: ${dataStream}`);
  }

  const totalCostMapping: Record<string, unknown> = {
    type: "double",
    time_series_metric: "counter",
  };
  if (config.metricUnit) {
    totalCostMapping.meta = { unit: config.metricUnit };
  }

  const properties: Record<string, unknown> = {
    "@timestamp": { type: "date" },
    "metric.name": {
      type: "keyword",
      time_series_dimension: true,
    },
    total_cost: totalCostMapping,
    "test.scenario": { type: "keyword" },
    "test.data_stream": { type: "keyword" },
  };

  if (config.dimensions) {
    for (const dim of config.dimensions) {
      properties[dim] = {
        type: "keyword",
        time_series_dimension: true,
      };
    }
  }

  return {
    index_patterns: [dataStream],
    data_stream: {},
    priority: 300,
    template: {
      settings: {
        index: {
          mode: "time_series",
          "time_series.start_time": startTime,
          routing_path: config.routingPath,
          number_of_shards: 1,
          number_of_replicas: 0,
        },
      },
      mappings: {
        properties,
      },
    },
  };
}
