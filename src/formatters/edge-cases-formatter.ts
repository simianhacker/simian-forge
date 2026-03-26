import {
  EdgeCasesDocument,
  EdgeCasesMetrics,
} from "../types/edge-cases-types";
import { FormatterResult } from "../types/simulator-types";
import { getPhaseConfig } from "../simulators/edge-cases-template-builder";
import { formatValueForFieldType } from "./histogram-helpers";

export class EdgeCasesFormatter {
  formatMetrics(
    metrics: EdgeCasesMetrics,
  ): FormatterResult<EdgeCasesDocument>[] {
    const phaseConfig = getPhaseConfig(metrics.dataStream, metrics.phase);
    const metricValue = formatValueForFieldType(
      phaseConfig.metricFieldType,
      metrics.counterValue,
    );

    const doc: EdgeCasesDocument = {
      "@timestamp": metrics.timestamp.toISOString(),
      "metric.name": metrics.dataStream,
      "test.data_stream": metrics.dataStream,
      [metrics.dataStream]: metricValue,
    };
    if (metrics.dimensions) {
      for (const [key, value] of Object.entries(metrics.dimensions)) {
        doc[key] = value;
      }
    }
    return [{ documents: [doc], format: "edge-cases" }];
  }
}
