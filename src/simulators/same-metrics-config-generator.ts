import { ConfigGenerator } from "../types/simulator-types";
import {
  SameMetricsConfig,
  SameMetricsDimensions,
} from "../types/same-metrics-types";
import {
  STREAM_TEMPLATE_CONFIGS,
  DATA_STREAM_IDS,
} from "./same-metrics-template-builder";

const DEFAULT_DIMENSION_VALUES: Record<string, string> = {
  "host.name": "gateway-01",
  region: "eu-west-1",
  environment: "production",
};

function buildDimensionsFromNames(dimNames: string[]): SameMetricsDimensions {
  const result: Record<string, string> = {};
  for (const name of dimNames) {
    result[name] = DEFAULT_DIMENSION_VALUES[name] ?? "";
  }
  return result;
}

export class SameMetricsConfigGenerator
  implements ConfigGenerator<SameMetricsConfig>
{
  generateConfig(entityId: string): SameMetricsConfig {
    const dataStream = entityId;
    const streamCfg = STREAM_TEMPLATE_CONFIGS[dataStream];
    const config: SameMetricsConfig = {
      dataStream,
      scenario: streamCfg.scenario,
    };
    if (streamCfg.dimensions?.length) {
      config.dimensions = buildDimensionsFromNames(streamCfg.dimensions);
    }
    return config;
  }
}

export { DATA_STREAM_IDS };
