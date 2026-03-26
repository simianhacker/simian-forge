import { SameMetricsScenarioKind } from "../types/same-metrics-types";

export interface StreamTemplateConfig {
  metricFieldName: string;
  metricFieldType: string;
  timeSeriesMetric: string;
  metricUnit?: string;
  dimensions: string[];
  scenario: SameMetricsScenarioKind;
  baseValue: number;
}

const DEFAULTS: StreamTemplateConfig = {
  metricFieldName: "request_duration",
  metricFieldType: "double",
  timeSeriesMetric: "gauge",
  dimensions: ["host.name"],
  scenario: "identical",
  baseValue: 100,
};

/**
 * Creates a stream config by merging overrides into the defaults.
 * Defaults: metricFieldName="request_duration", metricFieldType="double",
 * timeSeriesMetric="gauge", dimensions=["host.name"], scenario="identical",
 * baseValue=100, no unit.
 */
function streamConfig(
  overrides: Partial<StreamTemplateConfig> = {},
): StreamTemplateConfig {
  return { ...DEFAULTS, ...overrides };
}

export const STREAM_TEMPLATE_CONFIGS: Record<string, StreamTemplateConfig> = {
  // Scenario 1: Identical (baseline)
  "same-metric-identical-a": streamConfig({
    metricUnit: "ms",
    baseValue: 100,
  }),
  "same-metric-identical-b": streamConfig({
    metricUnit: "ms",
    baseValue: 110,
  }),

  // Scenario 2: Different dimension keys (2 dims vs 3 dims, share host.name + region)
  "same-metric-different-dims-host-region": streamConfig({
    scenario: "diff_dims",
    metricUnit: "ms",
    dimensions: ["host.name", "region"],
    baseValue: 200,
  }),
  "same-metric-different-dims-host-env": streamConfig({
    scenario: "diff_dims",
    metricUnit: "ms",
    dimensions: ["host.name", "region", "environment"],
    baseValue: 220,
  }),

  // Scenario 3: Different ES metric type (gauge vs counter)
  "same-metric-different-estype-gauge": streamConfig({
    scenario: "diff_estype",
    metricUnit: "ms",
    baseValue: 300,
  }),
  "same-metric-different-estype-counter": streamConfig({
    scenario: "diff_estype",
    metricFieldType: "long",
    timeSeriesMetric: "counter",
    metricUnit: "ms",
    baseValue: 320,
  }),

  // Scenario 4: Different ES metric type (histogram vs gauge) -- gauge stream shared with scenario 3
  "same-metric-different-estype-histogram": streamConfig({
    scenario: "diff_estype_histogram",
    metricFieldType: "histogram",
    timeSeriesMetric: "histogram",
    metricUnit: "ms",
    baseValue: 340,
  }),

  // Scenario 5: Different field type (long vs double)
  "same-metric-different-fieldtype-long": streamConfig({
    scenario: "diff_fieldtype",
    metricFieldType: "long",
    metricUnit: "ms",
    baseValue: 400,
  }),
  "same-metric-different-fieldtype-double": streamConfig({
    scenario: "diff_fieldtype",
    metricUnit: "ms",
    baseValue: 420,
  }),

  // Scenario 6: Different histogram type (tdigest vs exponential)
  "same-metric-different-histogram-tdigest": streamConfig({
    scenario: "diff_histogram_tdigest_exp",
    metricFieldType: "tdigest",
    timeSeriesMetric: "histogram",
    metricUnit: "ms",
    baseValue: 500,
  }),
  "same-metric-different-histogram-exponential": streamConfig({
    scenario: "diff_histogram_tdigest_exp",
    metricFieldType: "exponential_histogram",
    timeSeriesMetric: "histogram",
    metricUnit: "ms",
    baseValue: 520,
  }),

  // Scenario 7: Different histogram type (tdigest vs legacy) -- tdigest stream shared with scenario 6
  "same-metric-different-histogram-legacy": streamConfig({
    scenario: "diff_histogram_tdigest_legacy",
    metricFieldType: "histogram",
    timeSeriesMetric: "histogram",
    metricUnit: "ms",
    baseValue: 540,
  }),

  // Scenario 8: Different unit (null vs ms)
  "same-metric-different-unit-null": streamConfig({
    scenario: "diff_unit_null_ms",
    baseValue: 600,
  }),
  "same-metric-different-unit-ms": streamConfig({
    scenario: "diff_unit_null_ms",
    metricUnit: "ms",
    baseValue: 620,
  }),

  // Scenario 9: Different unit (ms vs seconds) -- ms stream shared with scenario 8
  "same-metric-different-unit-seconds": streamConfig({
    scenario: "diff_unit_ms_s",
    metricUnit: "s",
    baseValue: 640,
  }),
};

export const DATA_STREAM_IDS = Object.keys(STREAM_TEMPLATE_CONFIGS);

export function buildIndexTemplate(
  dataStream: string,
  startTime: string,
): Record<string, unknown> {
  const config = STREAM_TEMPLATE_CONFIGS[dataStream];
  if (!config) {
    throw new Error(`Unknown same-metrics data stream: ${dataStream}`);
  }

  const metricMapping: Record<string, unknown> = {
    type: config.metricFieldType,
    time_series_metric: config.timeSeriesMetric,
  };
  if (config.metricUnit) {
    metricMapping.meta = { unit: config.metricUnit };
  }

  const properties: Record<string, unknown> = {
    "@timestamp": { type: "date" },
    "metric.name": {
      type: "keyword",
      time_series_dimension: true,
    },
    [config.metricFieldName]: metricMapping,
    "test.scenario": { type: "keyword" },
    "test.data_stream": { type: "keyword" },
  };

  for (const dim of config.dimensions) {
    properties[dim] = {
      type: "keyword",
      time_series_dimension: true,
    };
  }

  const routingPath = ["metric.name", ...config.dimensions];

  return {
    index_patterns: [dataStream],
    data_stream: {},
    priority: 300,
    template: {
      settings: {
        index: {
          mode: "time_series",
          "time_series.start_time": startTime,
          routing_path: routingPath,
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
