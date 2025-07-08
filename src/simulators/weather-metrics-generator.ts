import { WeatherStationConfig, WeatherStationMetrics, EnvironmentalMetrics, SolarMetrics, SolarPanelMetrics, EnergyMetrics, ComputeMetrics, NetworkMetrics, WeatherCounterState, WeatherCondition } from '../types/weather-types';
import { createHash } from 'crypto';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

export class WeatherMetricsGenerator {
  private counters: Map<string, WeatherCounterState> = new Map();
  private previousMetrics: Map<string, WeatherStationMetrics> = new Map();

  generateMetrics(station: WeatherStationConfig, timestamp: Date): WeatherStationMetrics {
    return tracer.startActiveSpan('generateMetrics', (span) => {
      try {
        const seed = this.createTimeSeed(station.id, timestamp);
        const rng = this.createSeededRandom(seed);

        const stationCounters = this.getOrCreateCounters(station.id);
        const prevMetrics = this.previousMetrics.get(station.id);

        const weatherCondition = this.generateWeatherCondition(rng, timestamp);
        const environmental = this.generateEnvironmentalMetrics(station, rng, weatherCondition, timestamp);
        const solar = this.generateSolarMetrics(station, rng, weatherCondition, environmental);
        const energy = this.generateEnergyMetrics(station, rng, solar, environmental);
        const compute = this.generateComputeMetrics(station, rng, energy);
        const network = this.generateNetworkMetrics(station, rng, stationCounters);

        const metrics: WeatherStationMetrics = {
          timestamp,
          station,
          environmental,
          solar,
          energy,
          compute,
          network,
          counters: stationCounters
        };

        this.previousMetrics.set(station.id, metrics);
        
        span.setStatus({ code: 1 });
        return metrics;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private generateWeatherCondition(rng: () => number, timestamp: Date): WeatherCondition {
    const hour = timestamp.getHours();
    const season = this.getSeason(timestamp);
    
    let conditionWeights: { [key: string]: number } = {
      'sunny': 0.3,
      'cloudy': 0.3,
      'overcast': 0.2,
      'rain': 0.1,
      'storm': 0.05,
      'snow': 0.03,
      'fog': 0.02
    };

    if (season === 'winter') {
      conditionWeights.snow = 0.15;
      conditionWeights.sunny = 0.2;
    } else if (season === 'summer') {
      conditionWeights.sunny = 0.5;
      conditionWeights.storm = 0.1;
    }

    if (hour >= 19 || hour <= 6) {
      conditionWeights.fog = 0.1;
    }

    const conditions = Object.keys(conditionWeights) as (keyof typeof conditionWeights)[];
    const rand = rng();
    let cumulative = 0;
    
    for (const condition of conditions) {
      cumulative += conditionWeights[condition];
      if (rand <= cumulative) {
        return {
          condition: condition as WeatherCondition['condition'],
          cloudCover: this.getCloudCover(condition as string, rng),
          visibility: this.getVisibility(condition as string, rng)
        };
      }
    }

    return { condition: 'sunny', cloudCover: 0, visibility: 20 };
  }

  private generateEnvironmentalMetrics(
    station: WeatherStationConfig, 
    rng: () => number, 
    weather: WeatherCondition,
    timestamp: Date
  ): EnvironmentalMetrics {
    const hour = timestamp.getHours();
    const season = this.getSeason(timestamp);
    
    const baseTemp = this.getSeasonalTemperature(season, station.location.latitude);
    const dailyTempVariation = this.getDailyTemperatureVariation(hour);
    const weatherTempAdjustment = this.getWeatherTemperatureAdjustment(weather.condition);
    
    const airTemp = baseTemp + dailyTempVariation + weatherTempAdjustment + (rng() - 0.5) * 4;
    const soilTemp = airTemp - 2 + (rng() - 0.5) * 2;
    
    const baseHumidity = this.getWeatherHumidity(weather.condition, rng);
    const relativeHumidity = Math.max(10, Math.min(100, baseHumidity + (rng() - 0.5) * 10));
    
    const windSpeed = this.getWeatherWindSpeed(weather.condition, rng);
    const windDirection = rng() * 360;
    
    const precipitationRate = this.getPrecipitationRate(weather.condition, rng);
    const precipitationAccumulated = this.getAccumulatedPrecipitation(station.id, precipitationRate);
    
    const barometricPressure = 1013.25 - (station.location.altitude * 0.12) + (rng() - 0.5) * 20;
    const solarRadiation = this.getSolarRadiation(hour, weather.cloudCover, season, rng);
    
    const soilMoisture = this.getSoilMoisture(precipitationRate, solarRadiation, rng);
    const leafWetness = this.getLeafWetness(relativeHumidity, precipitationRate, rng);

    return {
      temperature: {
        air: airTemp,
        soil: soilTemp,
        dewPoint: this.calculateDewPoint(airTemp, relativeHumidity)
      },
      humidity: {
        relative: relativeHumidity,
        absolute: this.calculateAbsoluteHumidity(airTemp, relativeHumidity)
      },
      wind: {
        speed: windSpeed,
        direction: windDirection,
        gust: windSpeed * (1 + rng() * 0.5)
      },
      precipitation: {
        rate: precipitationRate,
        accumulated: precipitationAccumulated
      },
      pressure: {
        barometric: barometricPressure,
        seaLevel: barometricPressure + (station.location.altitude * 0.12)
      },
      radiation: {
        solar: solarRadiation,
        uv: solarRadiation * 0.05
      },
      soil: {
        moisture: soilMoisture,
        temperature: soilTemp
      },
      leaf: {
        wetness: leafWetness
      }
    };
  }

  private generateSolarMetrics(
    station: WeatherStationConfig,
    rng: () => number,
    weather: WeatherCondition,
    environmental: EnvironmentalMetrics
  ): SolarMetrics {
    const panels: SolarPanelMetrics[] = [];
    let totalPower = 0;
    let totalDailyEnergy = 0;

    for (const panelConfig of station.solarPanels) {
      const irradiance = environmental.radiation.solar;
      const efficiency = panelConfig.efficiency * (1 - (rng() - 0.5) * 0.02);
      const temperatureDerating = 1 - (Math.max(0, environmental.temperature.air - 25) * 0.004);
      
      const maxPower = panelConfig.wattage * efficiency * temperatureDerating;
      const actualPower = Math.max(0, maxPower * (irradiance / 1000) * (1 - weather.cloudCover));
      
      const voltage = 12 + (actualPower / panelConfig.wattage) * 24;
      const current = actualPower / voltage;
      
      const panelMetrics: SolarPanelMetrics = {
        panelId: panelConfig.id,
        voltage,
        current,
        power: actualPower,
        temperature: environmental.temperature.air + (actualPower / panelConfig.wattage) * 10,
        efficiency: efficiency * 100
      };

      panels.push(panelMetrics);
      totalPower += actualPower;
      totalDailyEnergy += actualPower * 0.0167;
    }

    return {
      panels,
      total: {
        currentPower: totalPower,
        dailyEnergy: totalDailyEnergy,
        efficiency: panels.length > 0 ? panels.reduce((sum, p) => sum + p.efficiency, 0) / panels.length : 0
      }
    };
  }

  private generateEnergyMetrics(
    station: WeatherStationConfig,
    rng: () => number,
    solar: SolarMetrics,
    environmental: EnvironmentalMetrics
  ): EnergyMetrics {
    const baseSensorConsumption = station.sensors.length * 0.1;
    const computeConsumption = station.computeHost.vcpus * 5 + station.computeHost.memoryMB * 0.002;
    const communicationConsumption = 2 + rng() * 3;
    
    const totalConsumption = baseSensorConsumption + computeConsumption + communicationConsumption;
    
    const batteryVoltage = 12 + (rng() - 0.5) * 1;
    const batteryChargeLevel = Math.max(20, Math.min(100, 60 + (solar.total.currentPower - totalConsumption) * 2));
    
    return {
      consumption: {
        total: totalConsumption,
        sensors: baseSensorConsumption,
        compute: computeConsumption,
        communication: communicationConsumption
      },
      production: {
        solar: solar.total.currentPower
      },
      battery: {
        voltage: batteryVoltage,
        current: (solar.total.currentPower - totalConsumption) / batteryVoltage,
        chargeLevel: batteryChargeLevel,
        temperature: environmental.temperature.air + 2
      }
    };
  }

  private generateComputeMetrics(
    station: WeatherStationConfig,
    rng: () => number,
    energy: EnergyMetrics
  ): ComputeMetrics {
    const baseUsage = 10 + (rng() * 30);
    const loadAdjustment = energy.consumption.total > 10 ? 20 : 0;
    const cpuUsage = Math.min(100, baseUsage + loadAdjustment);
    
    const cpuTemp = 35 + (cpuUsage / 100) * 25 + (rng() - 0.5) * 5;
    
    const memoryUsedPercent = 30 + (cpuUsage / 100) * 40 + (rng() - 0.5) * 10;
    const memoryUsedMB = (station.computeHost.memoryMB * memoryUsedPercent) / 100;
    
    return {
      cpu: {
        usage: cpuUsage,
        temperature: cpuTemp,
        states: {
          user: cpuUsage * 0.6,
          system: cpuUsage * 0.3,
          idle: 100 - cpuUsage,
          wait: cpuUsage * 0.1
        }
      },
      memory: {
        total: station.computeHost.memoryMB * 1024 * 1024,
        used: memoryUsedMB * 1024 * 1024,
        free: (station.computeHost.memoryMB - memoryUsedMB) * 1024 * 1024,
        cached: memoryUsedMB * 0.2 * 1024 * 1024,
        usagePercent: memoryUsedPercent
      }
    };
  }

  private generateNetworkMetrics(
    station: WeatherStationConfig,
    rng: () => number,
    counters: WeatherCounterState
  ): NetworkMetrics {
    const signal = -60 + (rng() - 0.5) * 30;
    const rssi = signal - 10;
    
    const technologies = ['LTE', '5G', '4G', '3G'];
    const technology = technologies[Math.floor(rng() * technologies.length)];
    
    const baseTraffic = 100 + rng() * 200;
    const rxBytesInc = baseTraffic * (0.8 + rng() * 0.4);
    const txBytesInc = baseTraffic * (0.2 + rng() * 0.6);
    
    this.incrementCounter(counters, 'network.rx_bytes', rxBytesInc);
    this.incrementCounter(counters, 'network.tx_bytes', txBytesInc);
    this.incrementCounter(counters, 'network.rx_packets', Math.floor(rxBytesInc / 1000));
    this.incrementCounter(counters, 'network.tx_packets', Math.floor(txBytesInc / 1000));
    this.incrementCounter(counters, 'network.rx_errors', rng() < 0.01 ? 1 : 0);
    this.incrementCounter(counters, 'network.tx_errors', rng() < 0.01 ? 1 : 0);
    
    return {
      cellular: {
        signal,
        rssi,
        technology
      },
      traffic: {
        rxBytes: counters['network.rx_bytes'],
        txBytes: counters['network.tx_bytes'],
        rxPackets: counters['network.rx_packets'],
        txPackets: counters['network.tx_packets'],
        rxErrors: counters['network.rx_errors'],
        txErrors: counters['network.tx_errors']
      }
    };
  }

  private getOrCreateCounters(stationId: string): WeatherCounterState {
    if (!this.counters.has(stationId)) {
      this.counters.set(stationId, {});
    }
    return this.counters.get(stationId)!;
  }

  private incrementCounter(counters: WeatherCounterState, key: string, increment: number): void {
    if (!counters[key]) {
      counters[key] = 0;
    }
    counters[key] += increment;
    
    if (counters[key] > Number.MAX_SAFE_INTEGER) {
      counters[key] = 0;
    }
  }

  private getSeason(date: Date): 'spring' | 'summer' | 'autumn' | 'winter' {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  private getSeasonalTemperature(season: string, latitude: number): number {
    const baseTemps: { [key: string]: number } = {
      'spring': 15,
      'summer': 25,
      'autumn': 10,
      'winter': 0
    };
    
    const latitudeAdjustment = Math.abs(latitude) * 0.5;
    return baseTemps[season] - latitudeAdjustment;
  }

  private getDailyTemperatureVariation(hour: number): number {
    return 5 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
  }

  private getWeatherTemperatureAdjustment(condition: string): number {
    const adjustments: { [key: string]: number } = {
      'sunny': 5,
      'cloudy': 0,
      'overcast': -2,
      'rain': -5,
      'storm': -8,
      'snow': -15,
      'fog': -3
    };
    return adjustments[condition] || 0;
  }

  private getCloudCover(condition: string, rng: () => number): number {
    const cloudCover: { [key: string]: number } = {
      'sunny': 0.1,
      'cloudy': 0.5,
      'overcast': 0.9,
      'rain': 0.8,
      'storm': 0.95,
      'snow': 0.85,
      'fog': 0.7
    };
    return Math.min(1, (cloudCover[condition] || 0.5) + (rng() - 0.5) * 0.2);
  }

  private getVisibility(condition: string, rng: () => number): number {
    const visibility: { [key: string]: number } = {
      'sunny': 20,
      'cloudy': 15,
      'overcast': 10,
      'rain': 5,
      'storm': 2,
      'snow': 1,
      'fog': 0.5
    };
    return Math.max(0.1, (visibility[condition] || 10) + (rng() - 0.5) * 5);
  }

  private getWeatherHumidity(condition: string, rng: () => number): number {
    const humidity: { [key: string]: number } = {
      'sunny': 40,
      'cloudy': 60,
      'overcast': 70,
      'rain': 90,
      'storm': 95,
      'snow': 85,
      'fog': 95
    };
    return Math.min(100, Math.max(10, humidity[condition] + (rng() - 0.5) * 20));
  }

  private getWeatherWindSpeed(condition: string, rng: () => number): number {
    const windSpeed: { [key: string]: number } = {
      'sunny': 2,
      'cloudy': 5,
      'overcast': 8,
      'rain': 12,
      'storm': 25,
      'snow': 15,
      'fog': 1
    };
    return Math.max(0, windSpeed[condition] + (rng() - 0.5) * 5);
  }

  private getPrecipitationRate(condition: string, rng: () => number): number {
    const precipitation: { [key: string]: number } = {
      'sunny': 0,
      'cloudy': 0,
      'overcast': 0.1,
      'rain': 2 + rng() * 8,
      'storm': 10 + rng() * 20,
      'snow': 1 + rng() * 4,
      'fog': 0.05
    };
    return Math.max(0, precipitation[condition]);
  }

  private getSolarRadiation(hour: number, cloudCover: number, season: string, rng: () => number): number {
    if (hour < 6 || hour > 18) return 0;
    
    const maxRadiation = season === 'summer' ? 1000 : season === 'winter' ? 600 : 800;
    const hourlyFactor = Math.sin(((hour - 6) / 12) * Math.PI);
    const baseRadiation = maxRadiation * hourlyFactor;
    
    return Math.max(0, baseRadiation * (1 - cloudCover) + (rng() - 0.5) * 50);
  }

  private getSoilMoisture(precipitationRate: number, solarRadiation: number, rng: () => number): number {
    const baseOil = 30 + (rng() - 0.5) * 10;
    const precipitationEffect = precipitationRate * 5;
    const evaporationEffect = solarRadiation * 0.01;
    
    return Math.max(5, Math.min(100, baseOil + precipitationEffect - evaporationEffect));
  }

  private getLeafWetness(humidity: number, precipitationRate: number, rng: () => number): number {
    const baseWetness = (humidity - 50) * 0.5;
    const precipitationEffect = precipitationRate * 10;
    
    return Math.max(0, Math.min(100, baseWetness + precipitationEffect + (rng() - 0.5) * 10));
  }

  private getAccumulatedPrecipitation(stationId: string, currentRate: number): number {
    const counters = this.getOrCreateCounters(stationId);
    this.incrementCounter(counters, 'precipitation.accumulated', currentRate * 0.0167);
    return counters['precipitation.accumulated'];
  }

  private calculateDewPoint(temperature: number, humidity: number): number {
    const a = 17.27;
    const b = 237.7;
    const alpha = (a * temperature) / (b + temperature) + Math.log(humidity / 100);
    return (b * alpha) / (a - alpha);
  }

  private calculateAbsoluteHumidity(temperature: number, relativeHumidity: number): number {
    const saturationVaporPressure = 6.112 * Math.exp((17.67 * temperature) / (temperature + 243.5));
    const actualVaporPressure = (relativeHumidity / 100) * saturationVaporPressure;
    return 2.16679 * actualVaporPressure / (273.15 + temperature);
  }

  private createTimeSeed(stationId: string, timestamp: Date): number {
    const timeStr = Math.floor(timestamp.getTime() / 60000).toString();
    const input = `${stationId}-${timeStr}`;
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