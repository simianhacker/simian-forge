import { ConfigGenerator } from "../types/simulator-types";
import { EdgeCasesConfig, EdgeCasesDimensions } from "../types/edge-cases-types";
import { getStreamConfig, EDGE_CASE_STREAM_IDS } from "./edge-cases-template-builder";

const DEFAULT_DIMENSION_VALUES: Record<string, string> = {
  "host.name": "gateway-01",
};

function buildDimensionsFromNames(dimNames: string[]): EdgeCasesDimensions {
  const result: Record<string, string> = {};
  for (const name of dimNames) {
    result[name] = DEFAULT_DIMENSION_VALUES[name] ?? "";
  }
  return result;
}

export class EdgeCasesConfigGenerator
  implements ConfigGenerator<EdgeCasesConfig>
{
  generateConfig(entityId: string): EdgeCasesConfig {
    const dataStream = entityId;
    const streamCfg = getStreamConfig(dataStream);
    const config: EdgeCasesConfig = { dataStream };
    if (streamCfg.phase1.dimensions?.length) {
      config.dimensions = buildDimensionsFromNames(streamCfg.phase1.dimensions);
    }
    return config;
  }
}

export { EDGE_CASE_STREAM_IDS };
