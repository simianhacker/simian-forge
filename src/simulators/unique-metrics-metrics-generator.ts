import { MetricsGenerator } from '../types/simulator-types';
import { UniqueMetricsConfig, UniqueMetricsMetrics } from '../types/unique-metrics-types';
import { seededRandom } from '../utils/hash';

export class UniqueMetricsMetricsGenerator implements MetricsGenerator<UniqueMetricsConfig, UniqueMetricsMetrics> {
  generateMetrics(config: UniqueMetricsConfig, timestamp: Date): UniqueMetricsMetrics {
    const metrics = config.metricNames.map(name => ({
      name,
      value: seededRandom(`${config.id}:${name}:${timestamp.toISOString()}`)(), // Deterministic 0..1 for same inputs
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
      { key: 'datacenter', values: ['dc1', 'dc2', 'dc3', 'dc4', 'dc5', 'dc6', 'dc7', 'dc8'] },
      { key: 'availability_zone', values: ['us-east-1a', 'us-east-1b', 'us-east-1c', 'us-west-2a', 'us-west-2b', 'eu-west-1a', 'eu-west-1b', 'ap-southeast-1a'] },
      { key: 'instance_type', values: ['m5.large', 'm5.xlarge', 'c5.large', 'c5.xlarge', 't3.medium', 't3.large', 'r5.large', 'r5.xlarge'] },
      { key: 'team', values: ['platform', 'frontend', 'backend', 'data', 'devops', 'security', 'mobile', 'analytics'] },
      { key: 'component', values: ['api', 'worker', 'scheduler', 'cache', 'database', 'queue', 'proxy', 'gateway'] },
      { key: 'version', values: ['1.0.0', '1.1.0', '1.2.0', '2.0.0', '2.1.0', '2.2.0', '3.0.0', '3.1.0'] },
      { key: 'cluster', values: ['prod-east', 'prod-west', 'staging', 'dev', 'test', 'canary', 'blue', 'green'] },
      { key: 'namespace', values: ['default', 'monitoring', 'logging', 'metrics', 'kube-system', 'ingress', 'storage', 'security'] },
      { key: 'env', values: ['production', 'staging', 'development', 'test', 'qa', 'canary', 'preview', 'sandbox'] },
      { key: 'tier', values: ['web', 'api', 'database', 'cache', 'queue', 'storage', 'compute', 'network'] }
    ];

    // Select consistent dimensions for this metric based on hash
    for (let i = 0; i < numDimensions; i++) {
      const dimIndex = (hash + i) % possibleDimensions.length;
      const dimension = possibleDimensions[dimIndex];
      // Use a different multiplier to get more variation in values
      const valueIndex = (hash + i * 13 + Math.floor(hash / 100)) % dimension.values.length;
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