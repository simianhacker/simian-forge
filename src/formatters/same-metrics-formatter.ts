import {
  SameMetricsDocument,
  SameMetricsMetrics,
} from "../types/same-metrics-types";
import { FormatterResult } from "../types/simulator-types";
import { STREAM_TEMPLATE_CONFIGS } from "../simulators/same-metrics-template-builder";
import { formatValueForFieldType } from "./histogram-helpers";

const METRIC_NAME = "request_duration";

export class SameMetricsFormatter {
  formatMetrics(
    metrics: SameMetricsMetrics,
  ): FormatterResult<SameMetricsDocument>[] {
    const streamConfig = STREAM_TEMPLATE_CONFIGS[metrics.dataStream];
    const fieldType = streamConfig?.metricFieldType ?? "double";

    const metricValue = formatValueForFieldType(fieldType, metrics.counterValue);

    const doc: SameMetricsDocument = {
      "@timestamp": metrics.timestamp.toISOString(),
      "metric.name": METRIC_NAME,
      request_duration: metricValue,
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
