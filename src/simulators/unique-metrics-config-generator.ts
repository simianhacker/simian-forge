import { ConfigGenerator } from '../types/simulator-types';
import { UniqueMetricsConfig } from '../types/unique-metrics-types';

export class UniqueMetricsConfigGenerator implements ConfigGenerator<UniqueMetricsConfig> {
  constructor(private count: number) {}

  generateConfig(id: string): UniqueMetricsConfig {
    const metricNames = this.generateMetricNames(this.count);
    const baseDimensions = this.generateBaseDimensions();

    return {
      id,
      metricNames,
      baseDimensions
    };
  }

  private generateMetricNames(count: number): string[] {
    const metricNames: string[] = [];
    
    const prefixes = ['system', 'application', 'network', 'database', 'cache', 'queue', 'storage', 'cpu', 'memory', 'disk'];
    const types = ['usage', 'throughput', 'latency', 'errors', 'connections', 'requests', 'responses', 'size', 'count', 'rate'];
    const suffixes = ['total', 'average', 'peak', 'current', 'max', 'min', 'p95', 'p99'];

    for (let i = 0; i < count; i++) {
      const prefix = prefixes[i % prefixes.length];
      const type = types[Math.floor(i / prefixes.length) % types.length];
      const suffix = suffixes[i % suffixes.length];
      
      metricNames.push(`${prefix}.${type}.${suffix}.${i + 1}`);
    }

    return metricNames;
  }

  private generateBaseDimensions(): { [key: string]: string } {
    return {
      'environment': 'production',
      'region': 'us-east-1',
      'service': 'metrics-cardinality-test'
    };
  }
}