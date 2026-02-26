import { ConfigGenerator } from '../types/simulator-types';
import {
  SameMetricsConfig,
  SameMetricsScenarioKind,
  SameMetricsDimensions
} from '../types/same-metrics-types';

const DATA_STREAM_IDS = [
  'timeseries-same-metric-different-unit-eur',
  'timeseries-same-metric-different-unit-usd',
  'timeseries-same-metric-different-unit-null',
  'timeseries-same-metric-different-datastream-1',
  'timeseries-same-metric-different-datastream-2',
  'timeseries-same-metric-different-dimensions-has-4',
  'timeseries-same-metric-different-dimensions-has-1'
] as const;

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

function dimensionsForHas4(): SameMetricsDimensions {
  return {
    'host.name': 'gateway-01',
    region: 'eu-west-1',
    environment: 'production'
  };
}

export class SameMetricsConfigGenerator implements ConfigGenerator<SameMetricsConfig> {
  generateConfig(entityId: string): SameMetricsConfig {
    const dataStream = entityId;
    const scenario = scenarioFromDataStream(dataStream);
    const config: SameMetricsConfig = {
      dataStream,
      scenario
    };
    if (dataStream === 'timeseries-same-metric-different-dimensions-has-4') {
      config.dimensions = dimensionsForHas4();
    }
    return config;
  }
}

export { DATA_STREAM_IDS };
