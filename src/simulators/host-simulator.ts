import { HostGenerator } from './host-generator';
import { MetricsGenerator } from './metrics-generator';
import { OtelFormatter, OtelDocument } from '../formatters/otel-formatter';
import { ElasticFormatter, ElasticDocument } from '../formatters/elastic-formatter';
import { Client } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import moment from 'moment';

const tracer = trace.getTracer('simian-forge');

export interface HostSimulatorOptions {
  interval: string;
  backfill: string;
  elasticsearchUrl: string;
  elasticsearchAuth?: string;
  format: 'otel' | 'elastic' | 'both';
}

export class HostSimulator {
  private hostGenerator: HostGenerator;
  private metricsGenerator: MetricsGenerator;
  private otelFormatter: OtelFormatter;
  private elasticFormatter: ElasticFormatter;
  private elasticsearchClient: Client;
  private intervalMs: number;
  private backfillStart: Date;
  private hostNames: string[] = [];
  private isRunning: boolean = false;

  constructor(private options: HostSimulatorOptions) {
    this.hostGenerator = new HostGenerator();
    this.metricsGenerator = new MetricsGenerator();
    this.otelFormatter = new OtelFormatter();
    this.elasticFormatter = new ElasticFormatter();

    // Parse interval
    this.intervalMs = this.parseInterval(options.interval);

    // Parse backfill start time
    this.backfillStart = this.parseBackfill(options.backfill);

    // Generate some host names
    this.hostNames = this.generateHostNames();

    // Initialize Elasticsearch client
    const clientConfig: any = {
      node: options.elasticsearchUrl
    };

    if (options.elasticsearchAuth) {
      const [username, password] = options.elasticsearchAuth.split(':');
      clientConfig.auth = { username, password };
    }

    this.elasticsearchClient = new Client(clientConfig);
  }

  async start(): Promise<void> {
    return tracer.startActiveSpan('start', async (span) => {
      try {
        this.isRunning = true;

        console.log(`Starting host simulator with ${this.hostNames.length} hosts`);
        console.log(`Backfilling from ${this.backfillStart.toISOString()}`);
        console.log(`Interval: ${this.options.interval} (${this.intervalMs}ms)`);
        console.log(`Format: ${this.options.format}`);

        // Backfill historical data
        await this.backfillData();

        // Start real-time generation
        await this.startRealTimeGeneration();

        span.setStatus({ code: 1 });
      } catch (error) {
        console.error('Error in host simulator:', error);
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

        console.log('Starting backfill...');

        while (current < now && this.isRunning) {
          const batchPromises: Promise<void>[] = [];

          // Generate metrics for all hosts at this timestamp
          for (const hostName of this.hostNames) {
            batchPromises.push(this.generateAndSendMetrics(hostName, new Date(current)));
          }

          // Wait for all hosts to complete
          await Promise.all(batchPromises);
          totalDocuments += this.hostNames.length;

          // Move to next interval
          current.setTime(current.getTime() + this.intervalMs);

          // Log progress occasionally
          if (totalDocuments % 100 === 0) {
            console.log(`Backfilled ${totalDocuments} metric sets, current time: ${current.toISOString()}`);
          }
        }

        console.log(`Backfill complete. Generated ${totalDocuments} metric sets`);
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
        console.log('Starting real-time metric generation...');

        const generateMetrics = async () => {
          if (!this.isRunning) return;

          const timestamp = new Date();
          const promises: Promise<void>[] = [];

          // Generate metrics for all hosts
          for (const hostName of this.hostNames) {
            promises.push(this.generateAndSendMetrics(hostName, timestamp));
          }

          await Promise.all(promises);
          console.log(`Generated metrics for ${this.hostNames.length} hosts at ${timestamp.toISOString()}`);

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

  private async generateAndSendMetrics(hostName: string, timestamp: Date): Promise<void> {
    return tracer.startActiveSpan('generateAndSendMetrics', async (span) => {
      try {
        // Generate host configuration
        const hostConfig = this.hostGenerator.generateHost(hostName);

        // Generate metrics
        const hostMetrics = this.metricsGenerator.generateMetrics(hostConfig, timestamp);

        // Format and send based on configuration
        const promises: Promise<void>[] = [];

        if (this.options.format === 'otel' || this.options.format === 'both') {
          const otelDocs = this.otelFormatter.formatMetrics(hostMetrics);
          promises.push(this.sendDocuments(otelDocs, 'otel'));
        }

        if (this.options.format === 'elastic' || this.options.format === 'both') {
          const elasticDocs = this.elasticFormatter.formatMetrics(hostMetrics);
          promises.push(this.sendDocuments(elasticDocs, 'elastic'));
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

  private async sendDocuments(documents: (OtelDocument | ElasticDocument)[], format: string): Promise<void> {
    return tracer.startActiveSpan('sendDocuments', async (span) => {
      try {
        if (documents.length === 0) return;

        // Prepare bulk operations
        const operations: any[] = [];

        for (const doc of documents) {
          let indexName: string;

          if (format === 'otel') {
            // For OTel format, use data stream dataset from document
            const otelDoc = doc as OtelDocument;
            indexName = `metrics-${otelDoc.data_stream.dataset}-${otelDoc.data_stream.namespace}`;
          } else {
            // For Elastic format, use data stream dataset from document
            const elasticDoc = doc as ElasticDocument;
            indexName = `metrics-${elasticDoc.data_stream.dataset}-${elasticDoc.data_stream.namespace}`;
          }

          operations.push({
            create: {
              _index: indexName
            }
          });
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
        console.error('Error sending documents to Elasticsearch:', error);
      } finally {
        span.end();
      }
    });
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([sm])$/);
    if (!match) {
      throw new Error(`Invalid interval format: ${interval}. Expected format: {number}{s|m}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    return unit === 's' ? value * 1000 : value * 60 * 1000;
  }

  private parseBackfill(backfill: string): Date {
    // Use moment to parse date math expressions like "now-1h"
    if (backfill.startsWith('now-')) {
      const duration = backfill.substring(4);
      return moment().subtract(moment.duration(duration)).toDate();
    } else if (backfill === 'now') {
      return moment().toDate();
    } else {
      const parsed = moment(backfill);
      if (!parsed.isValid()) {
        throw new Error(`Invalid backfill format: ${backfill}`);
      }
      return parsed.toDate();
    }
  }

  private generateHostNames(): string[] {
    const names: string[] = [];
    const count = 5 + Math.floor(Math.random() * 10); // 5-15 hosts

    for (let i = 1; i <= count; i++) {
      names.push(`host-${i.toString().padStart(2, '0')}`);
    }

    return names;
  }
}
