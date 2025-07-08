import { WeatherStationConfig, LocationConfig, SensorConfig, SolarPanelConfig, ComputeConfig, CalibrationConfig } from '../types/weather-types';
import { createHash } from 'crypto';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

export class WeatherStationGenerator {
  private stationConfigs: Map<string, WeatherStationConfig> = new Map();

  generateStation(stationId: string): WeatherStationConfig {
    return tracer.startActiveSpan('generateStation', (span) => {
      try {
        if (this.stationConfigs.has(stationId)) {
          return this.stationConfigs.get(stationId)!;
        }

        const config = this.createStationConfig(stationId);
        this.stationConfigs.set(stationId, config);
        
        span.setStatus({ code: 1 });
        return config;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private createStationConfig(stationId: string): WeatherStationConfig {
    const seed = this.createSeed(stationId);
    const rng = this.createSeededRandom(seed);

    const location = this.generateLocation(rng);
    const sensors = this.generateSensors(rng);
    const solarPanels = this.generateSolarPanels(rng);
    const computeHost = this.generateComputeHost(stationId, rng);

    return {
      id: stationId,
      name: `FieldSense-${stationId}`,
      location,
      sensors,
      solarPanels,
      computeHost
    };
  }

  private generateLocation(rng: () => number): LocationConfig {
    const regions = [
      { name: 'us-west', lat: 37.7749, lng: -122.4194, country: 'US' },
      { name: 'us-east', lat: 40.7128, lng: -74.0060, country: 'US' },
      { name: 'eu-west', lat: 51.5074, lng: -0.1278, country: 'GB' },
      { name: 'ap-southeast', lat: -33.8688, lng: 151.2093, country: 'AU' },
      { name: 'ca-central', lat: 43.6532, lng: -79.3832, country: 'CA' }
    ];

    const region = regions[Math.floor(rng() * regions.length)];
    
    return {
      latitude: region.lat + (rng() - 0.5) * 10,
      longitude: region.lng + (rng() - 0.5) * 10,
      altitude: Math.floor(rng() * 2000) + 100,
      timezone: this.getTimezone(region.country),
      region: region.name,
      country: region.country,
      site: this.generateSiteName(rng)
    };
  }

  private generateSensors(rng: () => number): SensorConfig[] {
    const sensorTypes = [
      'temperature',
      'humidity', 
      'wind_speed',
      'wind_direction',
      'precipitation',
      'barometric_pressure',
      'solar_radiation',
      'soil_moisture',
      'leaf_wetness',
      'soil_temperature'
    ] as const;

    const sensors: SensorConfig[] = [];
    
    sensorTypes.forEach((type, index) => {
      const locations = this.getSensorLocations(type, rng);
      
      locations.forEach((location, locationIndex) => {
        sensors.push({
          id: `${type}-${locationIndex + 1}`,
          type,
          location,
          calibration: this.generateCalibration(type, rng)
        });
      });
    });

    return sensors;
  }

  private getSensorLocations(type: string, rng: () => number): string[] {
    const locationMap: { [key: string]: string[] } = {
      'temperature': ['ambient', 'soil'],
      'humidity': ['ambient'],
      'wind_speed': ['mast'],
      'wind_direction': ['mast'],
      'precipitation': ['rain_gauge'],
      'barometric_pressure': ['ambient'],
      'solar_radiation': ['pyranometer'],
      'soil_moisture': ['field_a', 'field_b'],
      'leaf_wetness': ['crop_area'],
      'soil_temperature': ['field_a', 'field_b']
    };

    return locationMap[type] || ['default'];
  }

  private generateCalibration(type: string, rng: () => number): CalibrationConfig {
    const calibrationMap: { [key: string]: { offset: number; multiplier: number; accuracy: number } } = {
      'temperature': { offset: (rng() - 0.5) * 2, multiplier: 1 + (rng() - 0.5) * 0.02, accuracy: 0.1 },
      'humidity': { offset: (rng() - 0.5) * 5, multiplier: 1 + (rng() - 0.5) * 0.02, accuracy: 2 },
      'wind_speed': { offset: (rng() - 0.5) * 0.5, multiplier: 1 + (rng() - 0.5) * 0.05, accuracy: 0.1 },
      'wind_direction': { offset: (rng() - 0.5) * 10, multiplier: 1, accuracy: 1 },
      'precipitation': { offset: 0, multiplier: 1 + (rng() - 0.5) * 0.02, accuracy: 0.1 },
      'barometric_pressure': { offset: (rng() - 0.5) * 2, multiplier: 1 + (rng() - 0.5) * 0.01, accuracy: 0.1 },
      'solar_radiation': { offset: (rng() - 0.5) * 10, multiplier: 1 + (rng() - 0.5) * 0.03, accuracy: 1 },
      'soil_moisture': { offset: (rng() - 0.5) * 2, multiplier: 1 + (rng() - 0.5) * 0.02, accuracy: 0.5 },
      'leaf_wetness': { offset: (rng() - 0.5) * 5, multiplier: 1 + (rng() - 0.5) * 0.02, accuracy: 1 },
      'soil_temperature': { offset: (rng() - 0.5) * 1, multiplier: 1 + (rng() - 0.5) * 0.02, accuracy: 0.1 }
    };

    return calibrationMap[type] || { offset: 0, multiplier: 1, accuracy: 1 };
  }

  private generateSolarPanels(rng: () => number): SolarPanelConfig[] {
    const panelCount = Math.floor(rng() * 3) + 1;
    const panels: SolarPanelConfig[] = [];

    for (let i = 0; i < panelCount; i++) {
      const wattages = [100, 200, 300, 400, 500];
      const wattage = wattages[Math.floor(rng() * wattages.length)];
      
      panels.push({
        id: `panel-${i + 1}`,
        wattage,
        efficiency: 0.18 + (rng() * 0.04),
        tilt: 15 + (rng() * 30),
        azimuth: 180 + (rng() - 0.5) * 60,
        location: `array-${Math.floor(i / 2) + 1}`
      });
    }

    return panels;
  }

  private generateComputeHost(stationId: string, rng: () => number): ComputeConfig {
    const configurations = [
      { vcpus: 1, memoryMB: 512 },
      { vcpus: 2, memoryMB: 1024 },
      { vcpus: 1, memoryMB: 256 }
    ];

    const config = configurations[Math.floor(rng() * configurations.length)];
    
    return {
      hostname: `${stationId}-compute`,
      vcpus: config.vcpus,
      memoryMB: config.memoryMB,
      networkInterface: 'cellular0'
    };
  }

  private getTimezone(country: string): string {
    const timezones: { [key: string]: string } = {
      'US': 'America/New_York',
      'GB': 'Europe/London',
      'AU': 'Australia/Sydney',
      'CA': 'America/Toronto'
    };

    return timezones[country] || 'UTC';
  }

  private generateSiteName(rng: () => number): string {
    const prefixes = ['Field', 'Farm', 'Ranch', 'Station', 'Site'];
    const suffixes = ['Alpha', 'Beta', 'Delta', 'One', 'Two', 'North', 'South', 'East', 'West'];
    
    const prefix = prefixes[Math.floor(rng() * prefixes.length)];
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];
    
    return `${prefix} ${suffix}`;
  }

  private createSeed(input: string): number {
    const hash = createHash('md5').update(input).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  private createSeededRandom(seed: number): () => number {
    let currentSeed = seed;
    
    return () => {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }
}