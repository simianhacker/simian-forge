import { BaseSimulator } from './base-simulator';
import { HistogramsConfigGenerator } from './histograms-config-generator';
import { HistogramsMetricsGenerator } from './histograms-metrics-generator';
import { HistogramsFormatter } from '../formatters/histograms-formatter';
import { HistogramsConfig, HistogramsDocument, HistogramsMetrics } from '../types/histogram-types';
import { BaseSimulatorOptions, ConfigGenerator, MetricsGenerator, FormatterResult } from '../types/simulator-types';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

export class HistogramsSimulator extends BaseSimulator<HistogramsConfig, HistogramsMetrics, HistogramsDocument> {
  private formatter: HistogramsFormatter;

  constructor(options: BaseSimulatorOptions) {
    super(options);
    this.formatter = new HistogramsFormatter();
  }

  protected createConfigGenerator(): ConfigGenerator<HistogramsConfig> {
    return new HistogramsConfigGenerator();
  }

  protected createMetricsGenerator(): MetricsGenerator<HistogramsConfig, HistogramsMetrics> {
    return new HistogramsMetricsGenerator();
  }

  protected formatMetrics(metrics: HistogramsMetrics): FormatterResult<HistogramsDocument>[] {
    const docs = this.formatter.formatMetrics(metrics);
    return [{ documents: docs, format: 'histograms' }];
  }

  protected getIndexName(document: HistogramsDocument, format: string): string {
    return 'histograms-samples';
  }

  protected getCreateOperation(document: HistogramsDocument, format: string, indexName: string): any {
    return {
      create: {
        _index: indexName
      }
    };
  }

  protected getSimulatorName(): string {
    return 'histograms simulator';
  }

  protected getEntityIdPrefix(): string {
    return 'entity';
  }

  protected getDocumentFormat(document: HistogramsDocument): string {
    return 'histograms';
  }

  protected async setupElasticsearchTemplates(): Promise<void> {
    return tracer.startActiveSpan('setupElasticsearchTemplates', async (span) => {
      try {
        console.log('Setting up Elasticsearch templates for histograms...');

        const componentTemplates = this.getComponentTemplates();
        const indexTemplate = this.getIndexTemplate();

        for (const [name, template] of Object.entries(componentTemplates)) {
          try {
            await this.elasticsearchClient.cluster.putComponentTemplate({
              name,
              ...template
            });
            console.log(`Created component template: ${name}`);
          } catch (error) {
            console.warn(`Failed to create component template ${name}:`, error);
          }
        }

        try {
          await this.elasticsearchClient.indices.putIndexTemplate({
            name: 'histograms-samples',
            body: indexTemplate
          });
          console.log('Created index template: histograms-samples');
        } catch (error) {
          console.warn('Failed to create index template:', error);
        }

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

  private getComponentTemplates(): { [key: string]: any } {
    return {
      'histograms-mappings': {
        template: {
          mappings: {
            properties: {
              '@timestamp': { type: 'date', meta: { description: 'Sample timestamp' } },
              'entity.id': { type: 'keyword', time_series_dimension: true, meta: { description: 'Entity id' } },
              'histogram.tdigest': { type: 'histogram', meta: { description: 'Tdigest-like histogram' } },
              'histogram.hdr': { type: 'histogram', meta: { description: 'HDR-like histogram' } },
              'histogram.exponential': { type: 'exponential_histogram', meta: { description: 'Exponential histogram' } }
            }
          }
        }
      },
      'histograms-settings': {
        template: {
          settings: {
            index: {
              mode: 'time_series',
              'time_series.start_time': new Date(Math.floor(this.backfillStart.getTime() / 1000) * 1000).toISOString(),
              routing_path: ['entity.id'],
              number_of_shards: 1,
              number_of_replicas: 0,
              codec: 'best_compression'
            }
          }
        }
      }
    };
  }

  private getIndexTemplate(): any {
    return {
      index_patterns: ['histograms-samples'],
      data_stream: {},
      composed_of: ['histograms-mappings', 'histograms-settings'],
      priority: 200
    };
  }
}

