import { MetricsGenerator } from "../types/simulator-types";
import {
  EdgeCasesConfig,
  EdgeCasesMetrics,
  EdgeCasesPhase,
} from "../types/edge-cases-types";
import { getPhaseConfig } from "./edge-cases-template-builder";

function counterValueForStream(dataStream: string, phase: EdgeCasesPhase, timestamp: Date): number {
  const base = getPhaseConfig(dataStream, phase).baseValue;
  const minutes = Math.floor(timestamp.getTime() / (60 * 1000));
  return base + minutes * 5;
}

export class EdgeCasesMetricsGenerator
  implements MetricsGenerator<EdgeCasesConfig, EdgeCasesMetrics>
{
  private midpoint: Date | null = null;

  setMidpoint(midpoint: Date): void {
    this.midpoint = midpoint;
  }

  generateMetrics(
    config: EdgeCasesConfig,
    timestamp: Date,
  ): EdgeCasesMetrics {
    const phase: EdgeCasesPhase =
      this.midpoint && timestamp >= this.midpoint ? 2 : 1;

    const metrics: EdgeCasesMetrics = {
      timestamp,
      counterValue: counterValueForStream(config.dataStream, phase, timestamp),
      dataStream: config.dataStream,
      phase,
    };
    if (config.dimensions) {
      metrics.dimensions = config.dimensions;
    }
    return metrics;
  }
}
