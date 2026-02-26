import { ConfigGenerator } from '../types/simulator-types';
import {
  SameMetricsConfig,
  SameMetricsScenarioKind,
  SameMetricsDimensions
} from '../types/same-metrics-types';
import { STREAM_TEMPLATE_CONFIGS } from './same-metrics-template-builder';

const DATA_STREAM_IDS = [
  'timeseries-same-metric-different-unit-eur',
  'timeseries-same-metric-different-unit-usd',
  'timeseries-same-metric-different-unit-null',
  'timeseries-same-metric-different-datastream-1',
  'timeseries-same-metric-different-datastream-2',
  'timeseries-same-metric-different-dimensions-has-4',
  'timeseries-same-metric-different-dimensions-has-1'
] as const;

const DEFAULT_DIMENSION_VALUES: Record<string, string> = {
  'host.name': 'gateway-01',
  region: 'eu-west-1',
  environment: 'production'
};

function buildDimensionsFromNames(dimNames: string[]): SameMetricsDimensions {
  const result = {} as Record<string, string>;
  for (const name of dimNames) {
    result[name] = DEFAULT_DIMENSION_VALUES[name] ?? '';
  }
  return result as unknown as SameMetricsDimensions;
}

function scenarioFromDataStream(dataStream: string): SameMetricsScenarioKind {
  if (dataStream.includes('different-unit-')) {
    return 'different_units';
  }
  if (dataStream.includes('different-datastream-')) {
    return 'same_metric_two_datastreams';
  }
  if (dataStream.includes('different-dimensions-')) {
    return 'different_dimensions';
  }
  return 'same_metric_two_datastreams';
}

export class SameMetricsConfigGenerator implements ConfigGenerator<SameMetricsConfig> {
  generateConfig(entityId: string): SameMetricsConfig {
    const dataStream = entityId;
    const scenario = scenarioFromDataStream(dataStream);
    const config: SameMetricsConfig = {
      dataStream,
      scenario
    };
    const dimNames = STREAM_TEMPLATE_CONFIGS[dataStream]?.dimensions;
    if (dimNames?.length) {
      config.dimensions = buildDimensionsFromNames(dimNames);
    }
    return config;
  }
}

export { DATA_STREAM_IDS };
