import { trace } from "@opentelemetry/api";
import {
  HistogramsDocument,
  HistogramsMetrics,
} from "../types/histogram-types";

const tracer = trace.getTracer("simian-forge");

export class HistogramsFormatter {
  formatMetrics(metrics: HistogramsMetrics): HistogramsDocument[] {
    return tracer.startActiveSpan("formatMetrics", (span) => {
      try {
        const doc: HistogramsDocument = {
          "@timestamp": metrics.timestamp.toISOString(),
          "entity.id": metrics.entity.id,
          "histogram.tdigest": metrics.histograms.tdigest,
          "histogram.legacy": metrics.histograms.legacy,
          "histogram.exponential": metrics.histograms.exponential,
        };

        span.setStatus({ code: 1 });
        return [doc];
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
