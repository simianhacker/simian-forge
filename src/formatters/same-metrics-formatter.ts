import {
  SameMetricsDocument,
  SameMetricsMetrics,
} from "../types/same-metrics-types";
import { FormatterResult } from "../types/simulator-types";
import { STREAM_TEMPLATE_CONFIGS } from "../simulators/same-metrics-template-builder";

const METRIC_NAME = "request_duration";

/**
 * Builds a legacy histogram object (values + counts).
 */
function buildHistogramValue(value: number): {
  values: number[];
  counts: number[];
} {
  const base = Math.abs(value % 1000) || 1;
  return {
    values: [base * 0.5, base * 0.75, base, base * 1.25, base * 1.5],
    counts: [1, 2, 4, 2, 1],
  };
}

/**
 * Builds a tdigest object (centroids + counts).
 */
function buildTdigestValue(value: number): {
  centroids: number[];
  counts: number[];
} {
  const base = Math.abs(value % 1000) || 1;
  return {
    centroids: [base * 0.5, base * 0.75, base, base * 1.25, base * 1.5],
    counts: [1, 2, 4, 2, 1],
  };
}

/**
 * Builds an exponential_histogram object from a numeric value.
 */
function buildExponentialHistogramValue(
  value: number,
): Record<string, unknown> {
  const base = Math.abs(value % 1000);
  return {
    scale: 3,
    sum: base * 10,
    min: base * 0.5,
    max: base * 1.5,
    zero: { threshold: 0, count: 0 },
    positive: {
      indices: [0, 1, 2, 3, 4],
      counts: [1, 2, 4, 2, 1],
    },
    negative: {
      indices: [],
      counts: [],
    },
  };
}

export class SameMetricsFormatter {
  formatMetrics(
    metrics: SameMetricsMetrics,
  ): FormatterResult<SameMetricsDocument>[] {
    const streamConfig = STREAM_TEMPLATE_CONFIGS[metrics.dataStream];
    const fieldType = streamConfig?.metricFieldType ?? "double";

    let metricValue: unknown;
    if (fieldType === "exponential_histogram") {
      metricValue = buildExponentialHistogramValue(metrics.counterValue);
    } else if (fieldType === "tdigest") {
      metricValue = buildTdigestValue(metrics.counterValue);
    } else if (fieldType === "histogram") {
      metricValue = buildHistogramValue(metrics.counterValue);
    } else {
      metricValue = metrics.counterValue;
    }

    const doc: SameMetricsDocument = {
      "@timestamp": metrics.timestamp.toISOString(),
      "metric.name": METRIC_NAME,
      request_duration: metricValue as number,
      "test.scenario": metrics.scenario,
      "test.data_stream": metrics.dataStream,
    };
    if (metrics.dimensions) {
      for (const [key, value] of Object.entries(metrics.dimensions)) {
        doc[key] = value;
      }
    }
    return [{ documents: [doc], format: "same-metrics" }];
  }
}
