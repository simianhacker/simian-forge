import { Client } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import moment from 'moment';
const datemath = require('@elastic/datemath');
import { createElasticsearchClient } from '../utils/elasticsearch-client';
import {
  BaseSimulatorOptions,
  BulkHelperOptions,
  ConfigGenerator,
  MetricsGenerator,
  FormatterResult
} from '../types/simulator-types';
import { BackfillStream } from '../streams/backfill-stream';
import { RealTimeStream } from '../streams/realtime-stream';
import { MetricsTransformStream } from '../streams/metrics-transform-stream';

const tracer = trace.getTracer('simian-forge');

export abstract class BaseSimulator<TConfig, TMetrics, TDocument> {
  protected configGenerator: ConfigGenerator<TConfig>;
  protected metricsGenerator: MetricsGenerator<TConfig, TMetrics>;
  protected elasticsearchClient: Client;
  protected intervalMs: number;
  protected backfillStart: Date;
  protected entityIds: string[] = [];
  protected isRunning: boolean = false;
  protected bulkHelperOptions: BulkHelperOptions;
  protected realTimeStream: RealTimeStream | null = null;

  constructor(protected options: BaseSimulatorOptions) {
    this.configGenerator = this.createConfigGenerator();
    this.metricsGenerator = this.createMetricsGenerator();

    // Parse interval
    this.intervalMs = this.parseInterval(options.interval);

    // Parse backfill start time
    this.backfillStart = this.parseBackfill(options.backfill);

    // Generate entity IDs
    this.entityIds = this.generateEntityIds();

    // Initialize Elasticsearch client
    this.elasticsearchClient = createElasticsearchClient({
      url: options.elasticsearchUrl,
      auth: options.elasticsearchAuth,
      apiKey: options.elasticsearchApiKey
    });

    // Configure bulk helper options
    this.bulkHelperOptions = {
      flushBytes: 5 * 1024 * 1024, // 5MB default
      concurrency: 5,
      retries: 3,
      flushInterval: 30000, // 30 seconds
      ...options.bulkHelper
    };
  }

  async start(): Promise<void> {
    return tracer.startActiveSpan('start', async (span) => {
      try {
        this.isRunning = true;

        console.log(`Starting ${this.getSimulatorName()} with ${this.entityIds.length} entities`);
        console.log(`Backfilling from ${this.backfillStart.toISOString()}`);
        console.log(`Interval: ${this.options.interval} (${this.intervalMs}ms)`);
        console.log(`Bulk helper config: ${JSON.stringify(this.bulkHelperOptions)}`);

        // Optional setup
        if (this.setupElasticsearchTemplates) {
          await this.setupElasticsearchTemplates();
        }

        // Backfill historical data using streams
        await this.runBackfillStream();

        // Start real-time generation using streams
        await this.runRealTimeStream();

        span.setStatus({ code: 1 });
      } catch (error) {
        console.error(`Error in ${this.getSimulatorName()}:`, error);
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.realTimeStream) {
      this.realTimeStream.stop();
      this.realTimeStream = null;
    }
  }

  private async runBackfillStream(): Promise<void> {
    return tracer.startActiveSpan('runBackfillStream', async (span) => {
      try {
        console.log(`Starting ${this.getSimulatorName()} backfill stream...`);

        const backfillStream = new BackfillStream(
          this.backfillStart,
          new Date(),
          this.entityIds,
          this.intervalMs
        );

        const transformStream = new MetricsTransformStream(
          this.configGenerator,
          this.metricsGenerator,
          this.formatMetrics.bind(this)
        );

        const result = await this.elasticsearchClient.helpers.bulk({
          datasource: backfillStream.pipe(transformStream),
          onDocument: (doc: TDocument) => {
            // We need to determine the format from the document itself
            const format = this.getDocumentFormat(doc);
            const indexName = this.getIndexName(doc, format);
            return this.getCreateOperation(doc, format, indexName);
          },
          flushBytes: this.bulkHelperOptions.flushBytes,
          concurrency: this.bulkHelperOptions.concurrency,
          retries: this.bulkHelperOptions.retries,
          flushInterval: this.bulkHelperOptions.flushInterval,
          onDrop: (doc) => {
            console.warn('Document dropped during backfill:', doc);
          }
        });

        console.log(`${this.getSimulatorName()} backfill complete:`, {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          retry: result.retry,
          time: result.time,
          bytes: result.bytes
        });

        span.setStatus({ code: 1 });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private async runRealTimeStream(): Promise<void> {
    return tracer.startActiveSpan('runRealTimeStream', async (span) => {
      try {
        console.log(`Starting real-time ${this.getSimulatorName()} stream...`);

        this.realTimeStream = new RealTimeStream(this.entityIds, this.intervalMs);

        const transformStream = new MetricsTransformStream(
          this.configGenerator,
          this.metricsGenerator,
          this.formatMetrics.bind(this)
        );

        // Use smaller flush settings for real-time to reduce latency
        const realTimeBulkOptions = {
          ...this.bulkHelperOptions,
          flushBytes: Math.min(this.bulkHelperOptions.flushBytes!, 1 * 1024 * 1024), // Max 1MB for real-time
          concurrency: Math.min(this.bulkHelperOptions.concurrency!, 3) // Lower concurrency for real-time
        };

        // This runs indefinitely until stopped
        const result = await this.elasticsearchClient.helpers.bulk({
          datasource: this.realTimeStream.pipe(transformStream),
          onDocument: (doc: TDocument) => {
            // We need to determine the format from the document itself
            const format = this.getDocumentFormat(doc);
            const indexName = this.getIndexName(doc, format);
            return this.getCreateOperation(doc, format, indexName);
          },
          flushBytes: realTimeBulkOptions.flushBytes,
          concurrency: realTimeBulkOptions.concurrency,
          retries: realTimeBulkOptions.retries,
          flushInterval: realTimeBulkOptions.flushInterval,
          onDrop: (doc) => {
            console.warn('Document dropped during real-time:', doc);
          }
        });

        console.log(`${this.getSimulatorName()} real-time stream ended:`, {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
          retry: result.retry,
          time: result.time,
          bytes: result.bytes
        });

        span.setStatus({ code: 1 });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }


  protected parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([sm])$/);
    if (!match) {
      throw new Error(`Invalid interval format: ${interval}. Expected format: {number}{s|m}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    return unit === 's' ? value * 1000 : value * 60 * 1000;
  }

  protected parseBackfill(backfill: string): Date {
    console.log(`Parsing backfill: '${backfill}'`);

    const parsed = datemath.parse(backfill);
    if (!parsed || !parsed.isValid()) {
      throw new Error(`Invalid backfill format: ${backfill}. Expected Elasticsearch date math format (e.g., 'now-1h', 'now-30m', 'now-1d')`);
    }

    const result = parsed.toDate();
    console.log(`Parsed backfill '${backfill}' to: ${result.toISOString()}`);
    return result;
  }

  protected generateEntityIds(): string[] {
    const ids: string[] = [];
    const prefix = this.getEntityIdPrefix();

    for (let i = 1; i <= this.options.count; i++) {
      ids.push(`${prefix}-${i.toString().padStart(2, '0')}`);
    }

    return ids;
  }


  protected getProgressLogInterval(): number {
    return 100; // Default to log every 100 documents
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract createConfigGenerator(): ConfigGenerator<TConfig>;
  protected abstract createMetricsGenerator(): MetricsGenerator<TConfig, TMetrics>;
  protected abstract formatMetrics(metrics: TMetrics): FormatterResult<TDocument>[];
  protected abstract getIndexName(document: TDocument, format: string): string;
  protected abstract getCreateOperation(document: TDocument, format: string, indexName: string): any;
  protected abstract getDocumentFormat(document: TDocument): string;
  protected abstract getSimulatorName(): string;
  protected abstract getEntityIdPrefix(): string;

  // Optional method that can be overridden
  protected setupElasticsearchTemplates?(): Promise<void>;
}
