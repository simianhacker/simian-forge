import { BaseSimulator } from './base-simulator';
import { UniqueMetricsConfigGenerator } from './unique-metrics-config-generator';
import { UniqueMetricsMetricsGenerator } from './unique-metrics-metrics-generator';
import { UniqueMetricsFormatter } from '../formatters/unique-metrics-formatter';
import { UniqueMetricsConfig, UniqueMetricsMetrics, UniqueMetricsDocument } from '../types/unique-metrics-types';
import { BaseSimulatorOptions, ConfigGenerator, MetricsGenerator, FormatterResult } from '../types/simulator-types';

export class UniqueMetricsSimulator extends BaseSimulator<UniqueMetricsConfig, UniqueMetricsMetrics, UniqueMetricsDocument> {
  private uniqueMetricsFormatter: UniqueMetricsFormatter;

  constructor(options: BaseSimulatorOptions) {
    super(options);
    this.uniqueMetricsFormatter = new UniqueMetricsFormatter();
  }

  protected createConfigGenerator(): ConfigGenerator<UniqueMetricsConfig> {
    return new UniqueMetricsConfigGenerator(this.options.count);
  }

  protected createMetricsGenerator(): MetricsGenerator<UniqueMetricsConfig, UniqueMetricsMetrics> {
    return new UniqueMetricsMetricsGenerator();
  }

  protected formatMetrics(metrics: UniqueMetricsMetrics): FormatterResult<UniqueMetricsDocument>[] {
    const documents = this.uniqueMetricsFormatter.formatMetrics(metrics);
    return [{ documents, format: 'otel' }];
  }

  protected getIndexName(document: UniqueMetricsDocument, format: string): string {
    // Extract the metric count from the metric name (e.g., system.usage.total.1 -> 1)
    const metricName = Object.keys(document.metrics)[0];
    const parts = metricName.split('.');
    const metricCount = parseInt(parts[parts.length - 1]);
    
    // Calculate which index this metric should go into (500 metrics per index)
    const indexNumber = Math.ceil(metricCount / 500);
    
    return `metrics-uniquemetrics${indexNumber}.otel-default`;
  }

  protected getCreateOperation(document: UniqueMetricsDocument, format: string, indexName: string): any {
    // Create dynamic templates mapping full metric paths to gauge_double
    const dynamicTemplates: { [key: string]: string } = {};
    
    Object.keys(document.metrics).forEach(metricName => {
      dynamicTemplates[`metrics.${metricName}`] = 'gauge_double';
    });

    return {
      create: {
        _index: indexName,
        dynamic_templates: dynamicTemplates
      }
    };
  }

  protected getDocumentFormat(document: UniqueMetricsDocument): string {
    return 'otel';
  }

  protected getSimulatorName(): string {
    return 'unique metrics simulator';
  }

  protected getEntityIdPrefix(): string {
    return 'metric';
  }
}