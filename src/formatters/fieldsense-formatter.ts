import { WeatherStationMetrics } from '../types/weather-types';
import { trace } from '@opentelemetry/api';
import * as fnv from 'fnv-plus';

const tracer = trace.getTracer('simian-forge');

export interface FieldSenseDocument {
  '@timestamp': string;
  '_metric_names_hash': string;
  'station.id': string;
  'station.name': string;
  'station.location.latitude': number;
  'station.location.longitude': number;
  'station.location.altitude': number;
  'station.location.region': string;
  'station.location.country': string;
  'station.location.site': string;
  'sensor.id'?: string;
  'sensor.type'?: string;
  'sensor.location'?: string;
  'panel.id'?: string;
  'panel.location'?: string;
  'network.interface'?: string;
  'network.direction'?: string;
  'cpu.state'?: string;
  [key: string]: any;
}

export class FieldSenseFormatter {
  private generateMetricNamesHash(doc: any): string {
    const metricNames = Object.keys(doc).filter(key => 
      key.startsWith('fieldsense.') && typeof doc[key] === 'number'
    );
    return fnv.hash(metricNames.join(), 32).str();
  }

  private createDocumentWithHash(docData: any): FieldSenseDocument {
    const doc = { ...docData };
    doc['_metric_names_hash'] = this.generateMetricNamesHash(doc);
    return doc as FieldSenseDocument;
  }

  formatMetrics(metrics: WeatherStationMetrics): FieldSenseDocument[] {
    return tracer.startActiveSpan('formatMetrics', (span) => {
      try {
        const documents: FieldSenseDocument[] = [];

        const baseDoc: Partial<FieldSenseDocument> = {
          '@timestamp': metrics.timestamp.toISOString(),
          'station.id': metrics.station.id,
          'station.name': metrics.station.name,
          'station.location.latitude': metrics.station.location.latitude,
          'station.location.longitude': metrics.station.location.longitude,
          'station.location.altitude': metrics.station.location.altitude,
          'station.location.region': metrics.station.location.region,
          'station.location.country': metrics.station.location.country,
          'station.location.site': metrics.station.location.site,
        };

        documents.push(...this.formatEnvironmentalMetrics(metrics, baseDoc));
        documents.push(...this.formatSolarMetrics(metrics, baseDoc));
        documents.push(...this.formatEnergyMetrics(metrics, baseDoc));
        documents.push(...this.formatComputeMetrics(metrics, baseDoc));
        documents.push(...this.formatNetworkMetrics(metrics, baseDoc));

        span.setStatus({ code: 1 });
        return documents;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private formatEnvironmentalMetrics(metrics: WeatherStationMetrics, baseDoc: Partial<FieldSenseDocument>): FieldSenseDocument[] {
    const documents: FieldSenseDocument[] = [];

    // Temperature metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'temperature-1',
      'sensor.type': 'temperature',
      'sensor.location': 'ambient',
      'fieldsense.environmental.temperature.air': metrics.environmental.temperature.air,
      'fieldsense.environmental.temperature.dewpoint': metrics.environmental.temperature.dewPoint
    }));

    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'temperature-2',
      'sensor.type': 'soil_temperature',
      'sensor.location': 'field_a',
      'fieldsense.environmental.temperature.soil': metrics.environmental.temperature.soil,
      'fieldsense.environmental.soil.temperature': metrics.environmental.soil.temperature
    }));

    // Humidity metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'humidity-1',
      'sensor.type': 'humidity',
      'sensor.location': 'ambient',
      'fieldsense.environmental.humidity.relative': metrics.environmental.humidity.relative,
      'fieldsense.environmental.humidity.absolute': metrics.environmental.humidity.absolute
    }));

    // Wind metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'wind_speed-1',
      'sensor.type': 'wind_speed',
      'sensor.location': 'mast',
      'fieldsense.environmental.wind.speed': metrics.environmental.wind.speed,
      'fieldsense.environmental.wind.direction': metrics.environmental.wind.direction,
      'fieldsense.environmental.wind.gust': metrics.environmental.wind.gust
    }));

    // Precipitation metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'precipitation-1',
      'sensor.type': 'precipitation',
      'sensor.location': 'rain_gauge',
      'fieldsense.environmental.precipitation.rate': metrics.environmental.precipitation.rate,
      'fieldsense.environmental.precipitation.accumulated': metrics.environmental.precipitation.accumulated
    }));

    // Pressure metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'barometric_pressure-1',
      'sensor.type': 'barometric_pressure',
      'sensor.location': 'ambient',
      'fieldsense.environmental.pressure.barometric': metrics.environmental.pressure.barometric,
      'fieldsense.environmental.pressure.sea_level': metrics.environmental.pressure.seaLevel
    }));

    // Solar radiation metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'solar_radiation-1',
      'sensor.type': 'solar_radiation',
      'sensor.location': 'pyranometer',
      'fieldsense.environmental.radiation.solar': metrics.environmental.radiation.solar,
      'fieldsense.environmental.radiation.uv': metrics.environmental.radiation.uv
    }));

    // Soil moisture metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'soil_moisture-1',
      'sensor.type': 'soil_moisture',
      'sensor.location': 'field_a',
      'fieldsense.environmental.soil.moisture': metrics.environmental.soil.moisture
    }));

    // Leaf wetness metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'sensor.id': 'leaf_wetness-1',
      'sensor.type': 'leaf_wetness',
      'sensor.location': 'crop_area',
      'fieldsense.environmental.leaf.wetness': metrics.environmental.leaf.wetness
    }));

    return documents;
  }

  private formatSolarMetrics(metrics: WeatherStationMetrics, baseDoc: Partial<FieldSenseDocument>): FieldSenseDocument[] {
    const documents: FieldSenseDocument[] = [];

    // Individual panel metrics
    for (const panel of metrics.solar.panels) {
      documents.push(this.createDocumentWithHash({
        ...baseDoc,
        'panel.id': panel.panelId,
        'panel.location': metrics.station.solarPanels.find(p => p.id === panel.panelId)?.location || 'unknown',
        'fieldsense.solar.panel.voltage': panel.voltage,
        'fieldsense.solar.panel.current': panel.current,
        'fieldsense.solar.panel.power': panel.power,
        'fieldsense.solar.panel.temperature': panel.temperature,
        'fieldsense.solar.panel.efficiency': panel.efficiency
      }));
    }

    // Total solar metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'fieldsense.solar.total.power': metrics.solar.total.currentPower,
      'fieldsense.solar.total.daily_energy': metrics.solar.total.dailyEnergy,
      'fieldsense.solar.total.efficiency': metrics.solar.total.efficiency
    }));

    return documents;
  }

  private formatEnergyMetrics(metrics: WeatherStationMetrics, baseDoc: Partial<FieldSenseDocument>): FieldSenseDocument[] {
    const documents: FieldSenseDocument[] = [];

    // Energy consumption metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'fieldsense.energy.consumption.total': metrics.energy.consumption.total,
      'fieldsense.energy.consumption.sensors': metrics.energy.consumption.sensors,
      'fieldsense.energy.consumption.compute': metrics.energy.consumption.compute,
      'fieldsense.energy.consumption.communication': metrics.energy.consumption.communication
    }));

    // Energy production metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'fieldsense.energy.production.solar': metrics.energy.production.solar
    }));

    // Battery metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'fieldsense.energy.battery.voltage': metrics.energy.battery.voltage,
      'fieldsense.energy.battery.current': metrics.energy.battery.current,
      'fieldsense.energy.battery.charge_level': metrics.energy.battery.chargeLevel,
      'fieldsense.energy.battery.temperature': metrics.energy.battery.temperature
    }));

    return documents;
  }

  private formatComputeMetrics(metrics: WeatherStationMetrics, baseDoc: Partial<FieldSenseDocument>): FieldSenseDocument[] {
    const documents: FieldSenseDocument[] = [];

    // CPU usage metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'fieldsense.system.cpu.usage': metrics.compute.cpu.usage,
      'fieldsense.system.cpu.temperature': metrics.compute.cpu.temperature
    }));

    // CPU state metrics
    const cpuStates = ['user', 'system', 'idle', 'wait'] as const;
    for (const state of cpuStates) {
      documents.push(this.createDocumentWithHash({
        ...baseDoc,
        'cpu.state': state,
        'fieldsense.system.cpu.state': metrics.compute.cpu.states[state]
      }));
    }

    // Memory metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'fieldsense.system.memory.total': metrics.compute.memory.total,
      'fieldsense.system.memory.used': metrics.compute.memory.used,
      'fieldsense.system.memory.free': metrics.compute.memory.free,
      'fieldsense.system.memory.cached': metrics.compute.memory.cached,
      'fieldsense.system.memory.usage_percent': metrics.compute.memory.usagePercent
    }));

    return documents;
  }

  private formatNetworkMetrics(metrics: WeatherStationMetrics, baseDoc: Partial<FieldSenseDocument>): FieldSenseDocument[] {
    const documents: FieldSenseDocument[] = [];

    // Cellular signal metrics
    documents.push(this.createDocumentWithHash({
      ...baseDoc,
      'network.interface': 'cellular0',
      'fieldsense.network.cellular.signal': metrics.network.cellular.signal,
      'fieldsense.network.cellular.rssi': metrics.network.cellular.rssi,
      'fieldsense.network.cellular.technology': metrics.network.cellular.technology
    }));

    // Network traffic metrics by direction
    const directions = ['rx', 'tx'] as const;
    for (const direction of directions) {
      documents.push(this.createDocumentWithHash({
        ...baseDoc,
        'network.interface': 'cellular0',
        'network.direction': direction,
        'fieldsense.network.traffic.bytes': direction === 'rx' ? metrics.network.traffic.rxBytes : metrics.network.traffic.txBytes,
        'fieldsense.network.traffic.packets': direction === 'rx' ? metrics.network.traffic.rxPackets : metrics.network.traffic.txPackets,
        'fieldsense.network.traffic.errors': direction === 'rx' ? metrics.network.traffic.rxErrors : metrics.network.traffic.txErrors
      }));
    }

    return documents;
  }
}