import { WeatherStationGenerator } from './weather-generator';
import { WeatherMetricsGenerator } from './weather-metrics-generator';
import { FieldSenseFormatter, FieldSenseDocument } from '../formatters/fieldsense-formatter';
import { Client } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import moment from 'moment';
import { createElasticsearchClient } from '../utils/elasticsearch-client';

const tracer = trace.getTracer('simian-forge');

export interface WeatherSimulatorOptions {
  interval: string;
  backfill: string;
  count: number;
  elasticsearchUrl: string;
  elasticsearchAuth?: string;
  elasticsearchApiKey?: string;
}

export class WeatherSimulator {
  private stationGenerator: WeatherStationGenerator;
  private metricsGenerator: WeatherMetricsGenerator;
  private fieldsenseFormatter: FieldSenseFormatter;
  private elasticsearchClient: Client;
  private intervalMs: number;
  private backfillStart: Date;
  private stationIds: string[] = [];
  private isRunning: boolean = false;

  constructor(private options: WeatherSimulatorOptions) {
    this.stationGenerator = new WeatherStationGenerator();
    this.metricsGenerator = new WeatherMetricsGenerator();
    this.fieldsenseFormatter = new FieldSenseFormatter();

    this.intervalMs = this.parseInterval(options.interval);
    this.backfillStart = this.parseBackfill(options.backfill);
    this.stationIds = this.generateStationIds();

    this.elasticsearchClient = createElasticsearchClient({
      url: options.elasticsearchUrl,
      auth: options.elasticsearchAuth,
      apiKey: options.elasticsearchApiKey
    });
  }

  async start(): Promise<void> {
    return tracer.startActiveSpan('start', async (span) => {
      try {
        this.isRunning = true;

        console.log(`Starting weather station simulator with ${this.stationIds.length} stations`);
        console.log(`Backfilling from ${this.backfillStart.toISOString()}`);
        console.log(`Interval: ${this.options.interval} (${this.intervalMs}ms)`);

        await this.setupElasticsearchTemplates();
        await this.backfillData();
        await this.startRealTimeGeneration();

        span.setStatus({ code: 1 });
      } catch (error) {
        console.error('Error in weather station simulator:', error);
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  stop(): void {
    this.isRunning = false;
  }

  private async setupElasticsearchTemplates(): Promise<void> {
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
              'fieldsense.environmental.precipitation.accumulated': { type: 'double', time_series_metric: 'counter', meta: { description: 'Accumulated precipitation in mm' } },
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

  private async backfillData(): Promise<void> {
    return tracer.startActiveSpan('backfillData', async (span) => {
      try {
        const now = new Date();
        const current = new Date(this.backfillStart);
        let totalDocuments = 0;

        console.log('Starting weather station backfill...');

        while (current < now && this.isRunning) {
          const timestampForThisInterval = new Date(current);

          console.log(`Generating metrics for timestamp: ${timestampForThisInterval.toISOString()}`);

          // Generate metrics for all stations at this timestamp
          for (const stationId of this.stationIds) {
            await this.generateAndSendMetrics(stationId, timestampForThisInterval);
          }

          totalDocuments += this.stationIds.length;

          // Move to next interval
          current.setTime(current.getTime() + this.intervalMs);

          if (totalDocuments % 50 === 0) {
            console.log(`Backfilled ${totalDocuments} weather metric sets, current time: ${current.toISOString()}`);
          }
        }

        console.log(`Weather station backfill complete. Generated ${totalDocuments} metric sets`);
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

  private async startRealTimeGeneration(): Promise<void> {
    return tracer.startActiveSpan('startRealTimeGeneration', async (span) => {
      try {
        console.log('Starting real-time weather metric generation...');

        const generateMetrics = async () => {
          if (!this.isRunning) return;

          const timestamp = new Date();
          const promises: Promise<void>[] = [];

          for (const stationId of this.stationIds) {
            promises.push(this.generateAndSendMetrics(stationId, timestamp));
          }

          await Promise.all(promises);
          console.log(`Generated weather metrics for ${this.stationIds.length} stations at ${timestamp.toISOString()}`);

          setTimeout(generateMetrics, this.intervalMs);
        };

        await generateMetrics();
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

  private async generateAndSendMetrics(stationId: string, timestamp: Date): Promise<void> {
    return tracer.startActiveSpan('generateAndSendMetrics', async (span) => {
      try {
        const stationConfig = this.stationGenerator.generateStation(stationId);
        const stationMetrics = this.metricsGenerator.generateMetrics(stationConfig, timestamp);
        const fieldsenseDocs = this.fieldsenseFormatter.formatMetrics(stationMetrics);

        await this.sendDocuments(fieldsenseDocs);
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

  private async sendDocuments(documents: FieldSenseDocument[]): Promise<void> {
    return tracer.startActiveSpan('sendDocuments', async (span) => {
      try {
        if (documents.length === 0) return;

        // Sort documents by timestamp to ensure chronological order
        const sortedDocs = documents.sort((a, b) => 
          new Date(a['@timestamp']).getTime() - new Date(b['@timestamp']).getTime()
        );

        const operations: any[] = [];

        for (const doc of sortedDocs) {
          const indexName = `fieldsense-station-metrics`;

          operations.push({
            create: {
              _index: indexName
            }
          });
          operations.push(doc);
        }

        const response = await this.elasticsearchClient.bulk({
          operations,
          refresh: false
        });

        if (response.errors) {
          console.error('Bulk create errors:', JSON.stringify(response.items?.filter(item => item.create?.error), null, 2));
        }

        span.setStatus({ code: 1 });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        console.error('Error sending weather documents to Elasticsearch:', error);
      } finally {
        span.end();
      }
    });
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([sm])$/);
    if (!match) {
      throw new Error(`Invalid interval format: ${interval}. Expected format: {number}{s|m}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    return unit === 's' ? value * 1000 : value * 60 * 1000;
  }

  private parseBackfill(backfill: string): Date {
    if (backfill.startsWith('now-')) {
      const duration = backfill.substring(4);
      console.log(`Parsing duration: '${duration}'`);
      
      // Parse duration manually since moment.duration doesn't handle our format
      const match = duration.match(/^(\d+)([smhd])$/);
      if (!match) {
        throw new Error(`Invalid duration format: ${duration}. Expected format: {number}{s|m|h|d}`);
      }
      
      const value = parseInt(match[1]);
      const unit = match[2];
      
      let result: moment.Moment;
      switch (unit) {
        case 's':
          result = moment().subtract(value, 'seconds');
          break;
        case 'm':
          result = moment().subtract(value, 'minutes');
          break;
        case 'h':
          result = moment().subtract(value, 'hours');
          break;
        case 'd':
          result = moment().subtract(value, 'days');
          break;
        default:
          throw new Error(`Unsupported time unit: ${unit}`);
      }
      
      console.log(`Parsed backfill '${backfill}' to: ${result.toISOString()}`);
      return result.toDate();
    } else if (backfill === 'now') {
      const result = moment().toDate();
      console.log(`Parsed backfill '${backfill}' to: ${result.toISOString()}`);
      return result;
    } else {
      const parsed = moment(backfill);
      if (!parsed.isValid()) {
        throw new Error(`Invalid backfill format: ${backfill}`);
      }
      const result = parsed.toDate();
      console.log(`Parsed backfill '${backfill}' to: ${result.toISOString()}`);
      return result;
    }
  }

  private generateStationIds(): string[] {
    const ids: string[] = [];

    for (let i = 1; i <= this.options.count; i++) {
      ids.push(`station-${i.toString().padStart(2, '0')}`);
    }

    return ids;
  }
}
