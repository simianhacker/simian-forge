/**
 * Maps OpenTelemetry metric names to their appropriate dynamic template types
 * for Elasticsearch bulk operations.
 *
 * Based on OpenTelemetry metric conventions and Elasticsearch mapping requirements.
 */

export type OtelDynamicTemplateType =
  | 'histogram'
  | 'counter_long'
  | 'gauge_long'
  | 'counter_double'
  | 'gauge_double'
  | 'summary'
  | 'summary_minmax';

/**
 * Gets the appropriate dynamic template type for an OpenTelemetry metric name
 */
export function getOtelDynamicTemplate(metricName: string): OtelDynamicTemplateType {
  // Counter metrics (cumulative, monotonically increasing)
  if (metricName === 'system.cpu.time') {
    return 'counter_double'; // CPU time in seconds (can be fractional)
  }

  if (metricName === 'system.network.io') {
    return 'counter_long'; // Network bytes (integer counter)
  }

  if (metricName === 'system.network.packets') {
    return 'counter_long'; // Network packets (integer counter)
  }

  if (metricName === 'system.disk.io') {
    return 'counter_long'; // Disk I/O bytes (integer counter)
  }

  // Gauge metrics (can go up and down)
  if (metricName === 'system.cpu.utilization') {
    return 'gauge_double'; // CPU utilization percentage (0.0-1.0)
  }

  if (metricName === 'system.cpu.logical.count') {
    return 'gauge_long'; // CPU count (integer)
  }

  if (metricName === 'system.cpu.load_average.1m' ||
      metricName === 'system.cpu.load_average.5m' ||
      metricName === 'system.cpu.load_average.15m') {
    return 'gauge_double'; // Load averages (floating point)
  }

  if (metricName === 'system.memory.usage') {
    return 'gauge_long'; // Memory usage in bytes (integer)
  }

  if (metricName === 'system.memory.utilization') {
    return 'gauge_double'; // Memory utilization percentage (0.0-1.0)
  }

  if (metricName === 'system.filesystem.usage') {
    return 'gauge_long'; // Filesystem usage in bytes (integer)
  }

  if (metricName === 'system.filesystem.utilization') {
    return 'gauge_double'; // Filesystem utilization percentage (0.0-1.0)
  }

  // Default fallback - assume gauge_double for unknown metrics
  return 'gauge_double';
}

/**
 * Creates the dynamic template mapping for a set of metrics
 * Used in Elasticsearch bulk operation headers
 */
export function createDynamicTemplateMapping(metrics: Record<string, number>): Record<string, OtelDynamicTemplateType> {
  const mapping: Record<string, OtelDynamicTemplateType> = {};

  for (const metricName of Object.keys(metrics)) {
    // Prefix with 'metrics.' to match the full field name in Elasticsearch
    const fullMetricFieldName = `metrics.${metricName}`;
    mapping[fullMetricFieldName] = getOtelDynamicTemplate(metricName);
  }

  return mapping;
}
