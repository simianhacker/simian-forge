import { EdgeCasesPhase } from "../types/edge-cases-types";

export interface StreamPhaseConfig {
  metricFieldType: string;
  timeSeriesMetric: string;
  metricUnit?: string;
  dimensions: string[];
  baseValue: number;
}

export interface EdgeCaseStreamConfig {
  phase1: StreamPhaseConfig;
  phase2: StreamPhaseConfig;
}

const SHARED_DIMENSIONS = ["host.name"];

const EDGE_CASE_STREAMS: Record<string, EdgeCaseStreamConfig> = {
  "edge-case-gauge-to-counter": {
    phase1: {
      metricFieldType: "long",
      timeSeriesMetric: "gauge",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 100,
    },
    phase2: {
      metricFieldType: "double",
      timeSeriesMetric: "counter",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 100,
    },
  },

  "edge-case-histogram-to-gauge": {
    phase1: {
      metricFieldType: "histogram",
      timeSeriesMetric: "histogram",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 200,
    },
    phase2: {
      metricFieldType: "double",
      timeSeriesMetric: "gauge",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 200,
    },
  },

  "edge-case-histogram-to-tdigest": {
    phase1: {
      metricFieldType: "histogram",
      timeSeriesMetric: "histogram",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 300,
    },
    phase2: {
      metricFieldType: "tdigest",
      timeSeriesMetric: "histogram",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 300,
    },
  },

  "edge-case-tdigest-to-exponential": {
    phase1: {
      metricFieldType: "tdigest",
      timeSeriesMetric: "histogram",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 400,
    },
    phase2: {
      metricFieldType: "exponential_histogram",
      timeSeriesMetric: "histogram",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 400,
    },
  },

  "edge-case-unit-null-to-ms": {
    phase1: {
      metricFieldType: "double",
      timeSeriesMetric: "gauge",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 500,
    },
    phase2: {
      metricFieldType: "double",
      timeSeriesMetric: "gauge",
      metricUnit: "ms",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 500,
    },
  },

  "edge-case-unit-ms-to-s": {
    phase1: {
      metricFieldType: "double",
      timeSeriesMetric: "gauge",
      metricUnit: "ms",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 600,
    },
    phase2: {
      metricFieldType: "double",
      timeSeriesMetric: "gauge",
      metricUnit: "s",
      dimensions: SHARED_DIMENSIONS,
      baseValue: 600,
    },
  },
};

export const EDGE_CASE_STREAM_IDS = Object.keys(EDGE_CASE_STREAMS);

export function getStreamConfig(dataStream: string): EdgeCaseStreamConfig {
  const config = EDGE_CASE_STREAMS[dataStream];
  if (!config) {
    throw new Error(`Unknown edge-cases data stream: ${dataStream}`);
  }
  return config;
}

export function getPhaseConfig(
  dataStream: string,
  phase: EdgeCasesPhase,
): StreamPhaseConfig {
  const config = getStreamConfig(dataStream);
  return phase === 1 ? config.phase1 : config.phase2;
}

export function buildIndexTemplate(
  dataStream: string,
  phase: EdgeCasesPhase,
  startTime: string,
  endTime?: string,
): Record<string, unknown> {
  const phaseConfig = getPhaseConfig(dataStream, phase);

  const metricMapping: Record<string, unknown> = {
    type: phaseConfig.metricFieldType,
    time_series_metric: phaseConfig.timeSeriesMetric,
  };
  if (phaseConfig.metricUnit) {
    metricMapping.meta = { unit: phaseConfig.metricUnit };
  }

  const properties: Record<string, unknown> = {
    "@timestamp": { type: "date" },
    "metric.name": {
      type: "keyword",
      time_series_dimension: true,
    },
    [dataStream]: metricMapping,
    "test.data_stream": { type: "keyword" },
  };

  for (const dim of phaseConfig.dimensions) {
    properties[dim] = {
      type: "keyword",
      time_series_dimension: true,
    };
  }

  const routingPath = ["metric.name", ...phaseConfig.dimensions];

  const indexSettings: Record<string, unknown> = {
    mode: "time_series",
    "time_series.start_time": startTime,
    routing_path: routingPath,
    number_of_shards: 1,
    number_of_replicas: 0,
  };
  if (endTime) {
    indexSettings["time_series.end_time"] = endTime;
  }

  return {
    index_patterns: [dataStream],
    data_stream: {},
    priority: 300,
    template: {
      settings: { index: indexSettings },
      mappings: { properties },
    },
  };
}
