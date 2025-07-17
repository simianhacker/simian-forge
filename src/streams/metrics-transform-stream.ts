import { Transform } from 'stream';
import { trace } from '@opentelemetry/api';
import {
  ConfigGenerator,
  MetricsGenerator,
  FormatterResult
} from '../types/simulator-types';

const tracer = trace.getTracer('simian-forge');

export interface StreamItem {
  entityId: string;
  timestamp: Date;
}


export class MetricsTransformStream<TConfig, TMetrics, TDocument> extends Transform {
  constructor(
    private configGenerator: ConfigGenerator<TConfig>,
    private metricsGenerator: MetricsGenerator<TConfig, TMetrics>,
    private formatMetrics: (metrics: TMetrics) => FormatterResult<TDocument>[]
  ) {
    super({ objectMode: true });
  }

  _transform(item: StreamItem, encoding: string, callback: (error?: Error | null, data?: any) => void) {
    tracer.startActiveSpan('metricsTransformStream', async (span) => {
      try {
        const { entityId, timestamp } = item;

        // Generate entity configuration
        const config = this.configGenerator.generateConfig(entityId);

        // Generate metrics
        const metrics = this.metricsGenerator.generateMetrics(config, timestamp);

        // Format and emit documents
        const formatterResults = this.formatMetrics(metrics);

        for (const result of formatterResults) {
          for (const document of result.documents) {
            // Push each document directly to the stream
            this.push(document);
          }
        }

        span.setStatus({ code: 1 });
        callback();
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        callback(error as Error);
      } finally {
        span.end();
      }
    });
  }
}
