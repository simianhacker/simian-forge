import { MetricsGenerator } from '../types/simulator-types';
import { UniqueMetricsConfig, UniqueMetricsMetrics } from '../types/unique-metrics-types';

export class UniqueMetricsMetricsGenerator implements MetricsGenerator<UniqueMetricsConfig, UniqueMetricsMetrics> {
  generateMetrics(config: UniqueMetricsConfig, timestamp: Date): UniqueMetricsMetrics {
    const metrics = config.metricNames.map(name => ({
      name,
      value: Math.random(), // Random value between 0 and 1
      dimensions: this.generateDimensions(name, config.baseDimensions)
    }));

    return {
      id: config.id,
      timestamp,
      metrics
    };
  }

  private generateDimensions(metricName: string, baseDimensions: { [key: string]: string }): { [key: string]: string } {
    const dimensions = { ...baseDimensions };
    
    // Add 3-5 consistent dimensions per metric based on metric name
    const hash = this.hashString(metricName);
    const numDimensions = 3 + (hash % 3); // 3-5 dimensions
    
    const possibleDimensions = [
      { key: 'datacenter', values: ['dc1', 'dc2', 'dc3', 'dc4'] },
      { key: 'availability_zone', values: ['us-east-1a', 'us-east-1b', 'us-east-1c'] },
      { key: 'instance_type', values: ['m5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge'] },
      { key: 'team', values: ['platform', 'frontend', 'backend', 'data'] },
      { key: 'component', values: ['api', 'worker', 'scheduler', 'cache'] },
      { key: 'version', values: ['1.0.0', '1.1.0', '1.2.0', '2.0.0'] },
      { key: 'cluster', values: ['prod-east', 'prod-west', 'staging'] },
      { key: 'namespace', values: ['default', 'monitoring', 'logging', 'metrics'] }
    ];

    // Select consistent dimensions for this metric
    for (let i = 0; i < numDimensions; i++) {
      const dimIndex = (hash + i) % possibleDimensions.length;
      const dimension = possibleDimensions[dimIndex];
      const valueIndex = (hash + i * 7) % dimension.values.length;
      dimensions[dimension.key] = dimension.values[valueIndex];
    }

    return dimensions;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}