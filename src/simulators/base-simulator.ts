import { Client } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import moment from 'moment';
const datemath = require('@elastic/datemath');
import { createElasticsearchClient } from '../utils/elasticsearch-client';
import { 
  BaseSimulatorOptions, 
  ConfigGenerator, 
  MetricsGenerator, 
  FormatterResult 
} from '../types/simulator-types';

const tracer = trace.getTracer('simian-forge');

export abstract class BaseSimulator<TConfig, TMetrics, TDocument> {
  protected configGenerator: ConfigGenerator<TConfig>;
  protected metricsGenerator: MetricsGenerator<TConfig, TMetrics>;
  protected elasticsearchClient: Client;
  protected intervalMs: number;
  protected backfillStart: Date;
  protected entityIds: string[] = [];
  protected isRunning: boolean = false;

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
  }

  async start(): Promise<void> {
    return tracer.startActiveSpan('start', async (span) => {
      try {
        this.isRunning = true;

        console.log(`Starting ${this.getSimulatorName()} with ${this.entityIds.length} entities`);
        console.log(`Backfilling from ${this.backfillStart.toISOString()}`);
        console.log(`Interval: ${this.options.interval} (${this.intervalMs}ms)`);

        // Optional setup
        if (this.setupElasticsearchTemplates) {
          await this.setupElasticsearchTemplates();
        }

        // Backfill historical data
        await this.backfillData();

        // Start real-time generation
        await this.startRealTimeGeneration();

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
  }

  private async backfillData(): Promise<void> {
    return tracer.startActiveSpan('backfillData', async (span) => {
      try {
        const now = new Date();
        const current = new Date(this.backfillStart);
        let totalDocuments = 0;

        console.log(`Starting ${this.getSimulatorName()} backfill...`);

        while (current < now && this.isRunning) {
          const batchPromises: Promise<void>[] = [];

          // Generate metrics for all entities at this timestamp
          for (const entityId of this.entityIds) {
            batchPromises.push(this.generateAndSendMetrics(entityId, new Date(current)));
          }

          // Wait for all entities to complete
          await Promise.all(batchPromises);
          totalDocuments += this.entityIds.length;

          // Move to next interval
          current.setTime(current.getTime() + this.intervalMs);

          // Log progress occasionally
          if (totalDocuments % this.getProgressLogInterval() === 0) {
            console.log(`Backfilled ${totalDocuments} metric sets, current time: ${current.toISOString()}`);
          }
        }

        console.log(`${this.getSimulatorName()} backfill complete. Generated ${totalDocuments} metric sets`);
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

  private async startRealTimeGeneration(): Promise<void> {
    return tracer.startActiveSpan('startRealTimeGeneration', async (span) => {
      try {
        console.log(`Starting real-time ${this.getSimulatorName()} generation...`);

        const generateMetrics = async () => {
          if (!this.isRunning) return;

          const timestamp = new Date();
          const promises: Promise<void>[] = [];

          // Generate metrics for all entities
          for (const entityId of this.entityIds) {
            promises.push(this.generateAndSendMetrics(entityId, timestamp));
          }

          await Promise.all(promises);
          console.log(`Generated ${this.getSimulatorName()} metrics for ${this.entityIds.length} entities at ${timestamp.toISOString()}`);

          // Schedule next generation
          setTimeout(generateMetrics, this.intervalMs);
        };

        // Start the generation cycle
        await generateMetrics();

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

  private async generateAndSendMetrics(entityId: string, timestamp: Date): Promise<void> {
    return tracer.startActiveSpan('generateAndSendMetrics', async (span) => {
      try {
        // Generate entity configuration
        const config = this.configGenerator.generateConfig(entityId);

        // Generate metrics
        const metrics = this.metricsGenerator.generateMetrics(config, timestamp);

        // Format and send documents
        const formatterResults = this.formatMetrics(metrics);
        const promises: Promise<void>[] = [];

        for (const result of formatterResults) {
          promises.push(this.sendDocuments(result.documents, result.format));
        }

        await Promise.all(promises);
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

  private async sendDocuments(documents: TDocument[], format: string): Promise<void> {
    return tracer.startActiveSpan('sendDocuments', async (span) => {
      try {
        if (documents.length === 0) return;

        // Sort documents by timestamp if they have one
        const sortedDocs = this.sortDocumentsByTimestamp(documents);

        // Prepare bulk operations
        const operations: any[] = [];

        for (const doc of sortedDocs) {
          const indexName = this.getIndexName(doc, format);
          const createOperation = this.getCreateOperation(doc, format, indexName);

          operations.push(createOperation);
          operations.push(doc);
        }

        // Send to Elasticsearch
        const response = await this.elasticsearchClient.bulk({
          operations,
          refresh: false
        });

        if (response.errors) {
          console.error('Bulk create errors:', JSON.stringify(response.items?.filter(item => item.create?.error), null, 2));
        }

        span.setStatus({ code: 1 });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        console.error(`Error sending ${format} documents to Elasticsearch:`, error);
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

  protected sortDocumentsByTimestamp(documents: TDocument[]): TDocument[] {
    return documents.sort((a, b) => {
      const aTimestamp = this.getDocumentTimestamp(a);
      const bTimestamp = this.getDocumentTimestamp(b);
      return aTimestamp.getTime() - bTimestamp.getTime();
    });
  }

  protected getDocumentTimestamp(document: TDocument): Date {
    // Default implementation assumes '@timestamp' field
    const timestamp = (document as any)['@timestamp'];
    return timestamp ? new Date(timestamp) : new Date();
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
  protected abstract getSimulatorName(): string;
  protected abstract getEntityIdPrefix(): string;

  // Optional method that can be overridden
  protected setupElasticsearchTemplates?(): Promise<void>;
}