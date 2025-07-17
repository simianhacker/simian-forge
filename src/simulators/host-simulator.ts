import { BaseSimulator } from './base-simulator';
import { HostConfigGenerator } from './host-config-generator';
import { HostMetricsGenerator } from './host-metrics-generator';
import { OtelFormatter, OtelDocument } from '../formatters/otel-formatter';
import { ElasticFormatter, ElasticDocument } from '../formatters/elastic-formatter';
import { createDynamicTemplateMapping } from '../utils/otel-template-mapper';
import { HostConfig, HostMetrics } from '../types/host-types';
import { BaseSimulatorOptions, ConfigGenerator, MetricsGenerator, FormatterResult } from '../types/simulator-types';

export interface HostSimulatorOptions extends BaseSimulatorOptions {
  format: 'otel' | 'elastic' | 'both';
}

export class HostSimulator extends BaseSimulator<HostConfig, HostMetrics, OtelDocument | ElasticDocument> {
  private otelFormatter: OtelFormatter;
  private elasticFormatter: ElasticFormatter;
  private format: 'otel' | 'elastic' | 'both';

  constructor(options: HostSimulatorOptions) {
    super(options);
    this.format = options.format;
    this.otelFormatter = new OtelFormatter();
    this.elasticFormatter = new ElasticFormatter();
  }

  protected createConfigGenerator(): ConfigGenerator<HostConfig> {
    return new HostConfigGenerator();
  }

  protected createMetricsGenerator(): MetricsGenerator<HostConfig, HostMetrics> {
    return new HostMetricsGenerator();
  }

  protected formatMetrics(metrics: HostMetrics): FormatterResult<OtelDocument | ElasticDocument>[] {
    const results: FormatterResult<OtelDocument | ElasticDocument>[] = [];

    if (this.format === 'otel' || this.format === 'both') {
      const otelDocs = this.otelFormatter.formatMetrics(metrics);
      results.push({ documents: otelDocs, format: 'otel' });
    }

    if (this.format === 'elastic' || this.format === 'both') {
      const elasticDocs = this.elasticFormatter.formatMetrics(metrics);
      results.push({ documents: elasticDocs, format: 'elastic' });
    }

    return results;
  }

  protected getIndexName(document: OtelDocument | ElasticDocument, format: string): string {
    if (format === 'otel') {
      const otelDoc = document as OtelDocument;
      return `metrics-${otelDoc.data_stream.dataset}-${otelDoc.data_stream.namespace}`;
    } else {
      const elasticDoc = document as ElasticDocument;
      return `metrics-${elasticDoc.data_stream.dataset}-${elasticDoc.data_stream.namespace}`;
    }
  }

  protected getCreateOperation(document: OtelDocument | ElasticDocument, format: string, indexName: string): any {
    if (format === 'otel') {
      const otelDoc = document as OtelDocument;
      const dynamicTemplateMapping = createDynamicTemplateMapping(otelDoc.metrics);
      return {
        create: {
          _index: indexName,
          dynamic_templates: dynamicTemplateMapping
        }
      };
    } else {
      return {
        create: {
          _index: indexName
        }
      };
    }
  }

  protected getSimulatorName(): string {
    return 'host simulator';
  }

  protected getEntityIdPrefix(): string {
    return 'host';
  }

  protected getDocumentFormat(document: OtelDocument | ElasticDocument): string {
    // Check if it's an OTel document by looking for resource attributes
    if ('resource' in document && 'attributes' in document.resource) {
      return 'otel';
    }
    // Check if it's an Elastic document by looking for metricset
    if ('metricset' in document) {
      return 'elastic';
    }
    // Default fallback
    return 'unknown';
  }
}