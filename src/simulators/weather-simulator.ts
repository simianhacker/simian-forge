import { BaseSimulator } from './base-simulator';
import { WeatherStationConfigGenerator } from './weather-config-generator';
import { WeatherStationMetricsGenerator } from './weather-station-metrics-generator';
import { FieldSenseFormatter, FieldSenseDocument } from '../formatters/fieldsense-formatter';
import { WeatherStationConfig, WeatherStationMetrics } from '../types/weather-types';
import { BaseSimulatorOptions, ConfigGenerator, MetricsGenerator, FormatterResult } from '../types/simulator-types';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

export class WeatherSimulator extends BaseSimulator<WeatherStationConfig, WeatherStationMetrics, FieldSenseDocument> {
  private fieldsenseFormatter: FieldSenseFormatter;

  constructor(options: BaseSimulatorOptions) {
    super(options);
    this.fieldsenseFormatter = new FieldSenseFormatter();
  }

  protected createConfigGenerator(): ConfigGenerator<WeatherStationConfig> {
    return new WeatherStationConfigGenerator();
  }

  protected createMetricsGenerator(): MetricsGenerator<WeatherStationConfig, WeatherStationMetrics> {
    return new WeatherStationMetricsGenerator();
  }

  protected formatMetrics(metrics: WeatherStationMetrics): FormatterResult<FieldSenseDocument>[] {
    const fieldsenseDocs = this.fieldsenseFormatter.formatMetrics(metrics);
    return [{ documents: fieldsenseDocs, format: 'fieldsense' }];
  }

  protected getIndexName(document: FieldSenseDocument, format: string): string {
    return 'fieldsense-station-metrics';
  }

  protected getCreateOperation(document: FieldSenseDocument, format: string, indexName: string): any {
    return {
      create: {
        _index: indexName
      }
    };
  }

  protected getSimulatorName(): string {
    return 'weather station simulator';
  }

  protected getEntityIdPrefix(): string {
    return 'station';
  }

  protected getProgressLogInterval(): number {
    return 50; // Override to log every 50 documents for weather
  }

  protected getDocumentFormat(document: FieldSenseDocument): string {
    // Weather simulator only produces fieldsense format
    return 'fieldsense';
  }

  protected async setupElasticsearchTemplates(): Promise<void> {
    return tracer.startActiveSpan('setupElasticsearchTemplates', async (span) => {
      try {
        console.log('Setting up Elasticsearch templates for weather stations...');

        const componentTemplates = this.getComponentTemplates();
        const indexTemplate = this.getIndexTemplate();

        for (const [name, template] of Object.entries(componentTemplates)) {
          try {
            await this.elasticsearchClient.cluster.putComponentTemplate({
              name,
              ...template
            });
            console.log(`Created component template: ${name}`);
          } catch (error) {
            console.warn(`Failed to create component template ${name}:`, error);
          }
        }

        try {
          await this.elasticsearchClient.indices.putIndexTemplate({
            name: 'fieldsense-weather-stations',
            body: indexTemplate
          });
          console.log('Created index template: fieldsense-weather-stations');
        } catch (error) {
          console.warn('Failed to create index template:', error);
        }

        span.setStatus({ code: 1 });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private getComponentTemplates(): { [key: string]: any } {
    return {
      'fieldsense-weather-mappings': {
        template: {
          mappings: {
            properties: {
              '@timestamp': { type: 'date', meta: { description: 'Timestamp of the measurement' } },
              '_metric_names_hash': { type: 'keyword', time_series_dimension: true, meta: { description: 'Hash of metric names in document' } },
              'station.id': { type: 'keyword', time_series_dimension: true, meta: { description: 'Station identifier' } },
              'station.name': { type: 'keyword', time_series_dimension: true, meta: { description: 'Station name' } },
              'station.location.coordinates': { type: 'geo_point', meta: { description: 'Station coordinates (lat, lon)' } },
              'station.location.altitude': { type: 'double', meta: { description: 'Station altitude' } },
              'station.location.region': { type: 'keyword', time_series_dimension: true, meta: { description: 'Station region' } },
              'station.location.country': { type: 'keyword', time_series_dimension: true, meta: { description: 'Station country' } },
              'station.location.site': { type: 'keyword', time_series_dimension: true, meta: { description: 'Station site name' } },
              'sensor.id': { type: 'keyword', time_series_dimension: true, meta: { description: 'Sensor identifier' } },
              'sensor.type': { type: 'keyword', time_series_dimension: true, meta: { description: 'Sensor type' } },
              'sensor.location': { type: 'keyword', time_series_dimension: true, meta: { description: 'Sensor location' } },
              'panel.id': { type: 'keyword', time_series_dimension: true, meta: { description: 'Solar panel identifier' } },
              'panel.location': { type: 'keyword', time_series_dimension: true, meta: { description: 'Solar panel location' } },
              'network.interface': { type: 'keyword', time_series_dimension: true, meta: { description: 'Network interface' } },
              'network.direction': { type: 'keyword', time_series_dimension: true, meta: { description: 'Network direction' } },
              'cpu.state': { type: 'keyword', time_series_dimension: true, meta: { description: 'CPU state' } },
              'fieldsense.environmental.temperature.air': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Air temperature in Celsius' } },
              'fieldsense.environmental.temperature.soil': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Soil temperature in Celsius' } },
              'fieldsense.environmental.temperature.dewpoint': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Dew point temperature in Celsius' } },
              'fieldsense.environmental.humidity.relative': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Relative humidity percentage' } },
              'fieldsense.environmental.humidity.absolute': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Absolute humidity in g/m³' } },
              'fieldsense.environmental.wind.speed': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Wind speed in m/s' } },
              'fieldsense.environmental.wind.direction': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Wind direction in degrees' } },
              'fieldsense.environmental.wind.gust': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Wind gust speed in m/s' } },
              'fieldsense.environmental.precipitation.rate': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Precipitation rate in mm/h' } },
              'fieldsense.environmental.precipitation.accumulated': { type: 'double', time_series_metric: 'counter', meta: { description: 'Accumulated precipitation in mm', display: 'bar' } },
              'fieldsense.environmental.pressure.barometric': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Barometric pressure in hPa' } },
              'fieldsense.environmental.pressure.sea_level': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Sea level pressure in hPa' } },
              'fieldsense.environmental.radiation.solar': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Solar radiation in W/m²' } },
              'fieldsense.environmental.radiation.uv': { type: 'double', time_series_metric: 'gauge', meta: { description: 'UV radiation in W/m²' } },
              'fieldsense.environmental.soil.moisture': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Soil moisture percentage' } },
              'fieldsense.environmental.soil.temperature': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Soil temperature in Celsius' } },
              'fieldsense.environmental.leaf.wetness': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Leaf wetness percentage' } },
              'fieldsense.solar.panel.voltage': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Solar panel voltage in V' } },
              'fieldsense.solar.panel.current': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Solar panel current in A' } },
              'fieldsense.solar.panel.power': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Solar panel power in W' } },
              'fieldsense.solar.panel.temperature': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Solar panel temperature in Celsius' } },
              'fieldsense.solar.panel.efficiency': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Solar panel efficiency percentage' } },
              'fieldsense.solar.total.power': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Total solar power in W' } },
              'fieldsense.solar.total.daily_energy': { type: 'double', time_series_metric: 'counter', meta: { description: 'Daily solar energy in Wh' } },
              'fieldsense.solar.total.efficiency': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Total solar efficiency percentage' } },
              'fieldsense.energy.consumption.total': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Total energy consumption in W' } },
              'fieldsense.energy.consumption.sensors': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Sensor energy consumption in W' } },
              'fieldsense.energy.consumption.compute': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Compute energy consumption in W' } },
              'fieldsense.energy.consumption.communication': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Communication energy consumption in W' } },
              'fieldsense.energy.production.solar': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Solar energy production in W' } },
              'fieldsense.energy.battery.voltage': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Battery voltage in V' } },
              'fieldsense.energy.battery.current': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Battery current in A' } },
              'fieldsense.energy.battery.charge_level': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Battery charge percentage' } },
              'fieldsense.energy.battery.temperature': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Battery temperature in Celsius' } },
              'fieldsense.system.cpu.usage': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'CPU usage percentage' } },
              'fieldsense.system.cpu.temperature': { type: 'double', time_series_metric: 'gauge', meta: { description: 'CPU temperature in Celsius' } },
              'fieldsense.system.cpu.state': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'CPU state percentage' } },
              'fieldsense.system.memory.total': { type: 'long', time_series_metric: 'gauge', meta: { unit: 'byte', description: 'Total memory in bytes' } },
              'fieldsense.system.memory.used': { type: 'long', time_series_metric: 'gauge', meta: { unit: 'byte', description: 'Used memory in bytes' } },
              'fieldsense.system.memory.free': { type: 'long', time_series_metric: 'gauge', meta: { unit: 'byte', description: 'Free memory in bytes' } },
              'fieldsense.system.memory.cached': { type: 'long', time_series_metric: 'gauge', meta: { unit: 'byte', description: 'Cached memory in bytes' } },
              'fieldsense.system.memory.usage_percent': { type: 'double', time_series_metric: 'gauge', meta: { unit: 'percent', description: 'Memory usage percentage' } },
              'fieldsense.network.cellular.signal': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Cellular signal strength in dBm' } },
              'fieldsense.network.cellular.rssi': { type: 'double', time_series_metric: 'gauge', meta: { description: 'Cellular RSSI in dBm' } },
              'fieldsense.network.cellular.technology': { type: 'keyword', time_series_dimension: true, meta: { description: 'Cellular technology' } },
              'fieldsense.network.traffic.bytes': { type: 'long', time_series_metric: 'counter', meta: { unit: 'byte', description: 'Network traffic in bytes' } },
              'fieldsense.network.traffic.packets': { type: 'long', time_series_metric: 'counter', meta: { description: 'Network packets count' } },
              'fieldsense.network.traffic.errors': { type: 'long', time_series_metric: 'counter', meta: { description: 'Network errors count' } }
            }
          }
        }
      },
      'fieldsense-weather-settings': {
        template: {
          settings: {
            index: {
              mode: 'time_series',
              'time_series.start_time': new Date(Math.floor(this.backfillStart.getTime() / 1000) * 1000).toISOString(),
              routing_path: [
                '_metric_names_hash',
                'station.id',
                'station.name',
                'station.location.region',
                'station.location.country',
                'station.location.site',
                'sensor.id',
                'sensor.type',
                'sensor.location',
                'panel.id',
                'panel.location',
                'network.interface',
                'network.direction',
                'cpu.state',
                'fieldsense.network.cellular.technology'
              ],
              number_of_shards: 1,
              number_of_replicas: 0,
              codec: 'best_compression'
            }
          }
        }
      }
    };
  }

  private getIndexTemplate(): any {
    return {
      index_patterns: ['fieldsense-station-metrics'],
      data_stream: {},
      composed_of: ['fieldsense-weather-mappings', 'fieldsense-weather-settings'],
      priority: 200
    };
  }
}