import { BaseSimulator } from "./base-simulator";
import { SameMetricsConfigGenerator } from "./same-metrics-config-generator";
import { SameMetricsMetricsGenerator } from "./same-metrics-metrics-generator";
import { SameMetricsFormatter } from "../formatters/same-metrics-formatter";
import {
  SameMetricsConfig,
  SameMetricsDocument,
  SameMetricsMetrics,
} from "../types/same-metrics-types";
import {
  BaseSimulatorOptions,
  ConfigGenerator,
  MetricsGenerator,
  FormatterResult,
} from "../types/simulator-types";
import { DATA_STREAM_IDS } from "./same-metrics-config-generator";
import { buildIndexTemplate } from "./same-metrics-template-builder";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("simian-forge");

export class SameMetricsSimulator extends BaseSimulator<
  SameMetricsConfig,
  SameMetricsMetrics,
  SameMetricsDocument
> {
  private formatter: SameMetricsFormatter;

  constructor(options: BaseSimulatorOptions) {
    super(options);
    this.formatter = new SameMetricsFormatter();
  }

  protected createConfigGenerator(): ConfigGenerator<SameMetricsConfig> {
    return new SameMetricsConfigGenerator();
  }

  protected createMetricsGenerator(): MetricsGenerator<
    SameMetricsConfig,
    SameMetricsMetrics
  > {
    return new SameMetricsMetricsGenerator();
  }

  protected formatMetrics(
    metrics: SameMetricsMetrics,
  ): FormatterResult<SameMetricsDocument>[] {
    return this.formatter.formatMetrics(metrics);
  }

  protected getIndexName(
    document: SameMetricsDocument,
    format: string,
  ): string {
    return document["test.data_stream"];
  }

  protected getCreateOperation(
    document: SameMetricsDocument,
    format: string,
    indexName: string,
  ): { create: { _index: string } } {
    return {
      create: {
        _index: indexName,
      },
    };
  }

  protected getSimulatorName(): string {
    return "same metrics simulator";
  }

  protected getEntityIdPrefix(): string {
    return "same-metric";
  }

  protected generateEntityIds(): string[] {
    return [...DATA_STREAM_IDS];
  }

  protected getDocumentFormat(document: SameMetricsDocument): string {
    return "same-metrics";
  }

  protected async setupElasticsearchTemplates(): Promise<void> {
    return tracer.startActiveSpan(
      "setupElasticsearchTemplates",
      async (span) => {
        try {
          console.log(
            "Setting up Elasticsearch templates for same metrics test scenarios...",
          );

          const startTime = new Date(
            Math.floor(this.backfillStart.getTime() / 1000) * 1000,
          ).toISOString();

          for (const dataStream of DATA_STREAM_IDS) {
            const template = buildIndexTemplate(dataStream, startTime);
            try {
              await this.elasticsearchClient.indices.putIndexTemplate({
                name: dataStream,
                ...template,
              });
              console.log(`Created index template: ${dataStream}`);
            } catch (error) {
              console.error(
                `Failed to create index template ${dataStream}:`,
                error,
              );
              throw error;
            }
          }

          span.setStatus({ code: 1 });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: 2,
            message: (error as Error).message,
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
