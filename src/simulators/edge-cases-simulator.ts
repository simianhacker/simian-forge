import { BaseSimulator } from "./base-simulator";
import { EdgeCasesConfigGenerator } from "./edge-cases-config-generator";
import { EdgeCasesMetricsGenerator } from "./edge-cases-metrics-generator";
import { EdgeCasesFormatter } from "../formatters/edge-cases-formatter";
import {
  EdgeCasesConfig,
  EdgeCasesDocument,
  EdgeCasesMetrics,
} from "../types/edge-cases-types";
import {
  BaseSimulatorOptions,
  ConfigGenerator,
  MetricsGenerator,
  FormatterResult,
} from "../types/simulator-types";
import {
  EDGE_CASE_STREAM_IDS,
  buildIndexTemplate,
} from "./edge-cases-template-builder";
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("simian-forge");

export class EdgeCasesSimulator extends BaseSimulator<
  EdgeCasesConfig,
  EdgeCasesMetrics,
  EdgeCasesDocument
> {
  private formatter: EdgeCasesFormatter;
  private edgeCasesMetricsGenerator: EdgeCasesMetricsGenerator;

  constructor(options: BaseSimulatorOptions) {
    super(options);
    this.formatter = new EdgeCasesFormatter();
    this.edgeCasesMetricsGenerator =
      this.metricsGenerator as unknown as EdgeCasesMetricsGenerator;
  }

  protected createConfigGenerator(): ConfigGenerator<EdgeCasesConfig> {
    return new EdgeCasesConfigGenerator();
  }

  protected createMetricsGenerator(): MetricsGenerator<
    EdgeCasesConfig,
    EdgeCasesMetrics
  > {
    return new EdgeCasesMetricsGenerator();
  }

  protected formatMetrics(
    metrics: EdgeCasesMetrics,
  ): FormatterResult<EdgeCasesDocument>[] {
    return this.formatter.formatMetrics(metrics);
  }

  protected getIndexName(
    document: EdgeCasesDocument,
    _format: string,
  ): string {
    return document["test.data_stream"];
  }

  protected getCreateOperation(
    _document: EdgeCasesDocument,
    _format: string,
    indexName: string,
  ): { create: { _index: string } } {
    return { create: { _index: indexName } };
  }

  protected getSimulatorName(): string {
    return "edge cases simulator";
  }

  protected getEntityIdPrefix(): string {
    return "edge-case";
  }

  protected generateEntityIds(): string[] {
    return [...EDGE_CASE_STREAM_IDS];
  }

  protected getDocumentFormat(_document: EdgeCasesDocument): string {
    return "edge-cases";
  }

  private static readonly PHASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes per phase

  /**
   * Two-phase start: backfill phase 1 (now-10m..now-5m), rollover,
   * backfill phase 2 (now-5m..now), then optional real-time.
   * The --backfill flag is ignored; the 10-minute window is hard-coded so the
   * two backing indices never overlap in their time_series ranges.
   */
  async start(): Promise<boolean> {
    return tracer.startActiveSpan("start", async (span) => {
      try {
        this.isRunning = true;
        const now = new Date();
        const phase1Start = new Date(
          now.getTime() - EdgeCasesSimulator.PHASE_DURATION_MS * 2,
        );
        const midpoint = new Date(
          now.getTime() - EdgeCasesSimulator.PHASE_DURATION_MS,
        );

        console.log(
          `Starting ${this.getSimulatorName()} with ${this.entityIds.length} streams`,
        );
        console.log(`Phase 1: ${phase1Start.toISOString()} -> ${midpoint.toISOString()}`);
        console.log(`Phase 2: ${midpoint.toISOString()} -> ${now.toISOString()}`);
        console.log(`Interval: ${this.options.interval} (${this.intervalMs}ms)`);
        console.log(
          `Real-time generation: ${this.noRealtime ? "disabled" : "enabled"}`,
        );

        // Phase 1: create templates (with explicit end_time) and backfill first 5 minutes
        await this.setupTemplates(1, phase1Start, midpoint);
        await this.runBackfillStream(phase1Start, midpoint);

        // Rollover: update templates to phase 2 and rollover all streams
        this.edgeCasesMetricsGenerator.setMidpoint(midpoint);
        await this.setupTemplates(2, midpoint);
        await this.rolloverAllStreams();

        // Phase 2: backfill second 5 minutes
        await this.runBackfillStream(midpoint, now);

        if (!this.noRealtime) {
          await this.runRealTimeStream();
          span.setStatus({ code: 1 });
          return false;
        } else {
          console.log(
            `${this.getSimulatorName()} backfill completed. Real-time generation disabled.`,
          );
          span.setStatus({ code: 1 });
          return true;
        }
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

  private async setupTemplates(
    phase: 1 | 2,
    rangeStart: Date,
    rangeEnd?: Date,
  ): Promise<void> {
    return tracer.startActiveSpan(
      `setupTemplates-phase${phase}`,
      async (span) => {
        try {
          console.log(
            `Setting up Elasticsearch templates (phase ${phase}) for edge cases...`,
          );

          const startTime = new Date(
            Math.floor(rangeStart.getTime() / 1000) * 1000,
          ).toISOString();
          const endTime = rangeEnd
            ? new Date(
                Math.floor(rangeEnd.getTime() / 1000) * 1000,
              ).toISOString()
            : undefined;

          for (const dataStream of EDGE_CASE_STREAM_IDS) {
            const template = buildIndexTemplate(dataStream, phase, startTime, endTime);
            try {
              await this.elasticsearchClient.indices.putIndexTemplate({
                name: dataStream,
                ...template,
              });
              console.log(
                `Created index template (phase ${phase}): ${dataStream}`,
              );
            } catch (error: any) {
              console.error(
                `Failed to create index template (phase ${phase}) ${dataStream}:`,
                error.message ?? error,
              );
              throw error;
            }
          }

          span.setStatus({ code: 1 });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({ code: 2, message: (error as Error).message });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private async rolloverAllStreams(): Promise<void> {
    return tracer.startActiveSpan("rolloverAllStreams", async (span) => {
      try {
        console.log("Rolling over all edge-case data streams...");

        for (const dataStream of EDGE_CASE_STREAM_IDS) {
          try {
            await this.elasticsearchClient.indices.rollover({
              alias: dataStream,
            });
            console.log(`Rolled over data stream: ${dataStream}`);
          } catch (error: any) {
            console.error(
              `Failed to rollover ${dataStream}:`,
              error.message ?? error,
            );
            throw error;
          }
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
}
