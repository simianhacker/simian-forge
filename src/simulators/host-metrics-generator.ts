import { MetricsGenerator as HostMetricsGen } from './metrics-generator';
import { HostConfig, HostMetrics } from '../types/host-types';
import { MetricsGenerator } from '../types/simulator-types';

export class HostMetricsGenerator implements MetricsGenerator<HostConfig, HostMetrics> {
  private metricsGenerator: HostMetricsGen;

  constructor() {
    this.metricsGenerator = new HostMetricsGen();
  }

  generateMetrics(config: HostConfig, timestamp: Date): HostMetrics {
    return this.metricsGenerator.generateMetrics(config, timestamp);
  }
}