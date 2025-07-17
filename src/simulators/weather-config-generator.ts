import { WeatherStationGenerator } from './weather-generator';
import { WeatherStationConfig } from '../types/weather-types';
import { ConfigGenerator } from '../types/simulator-types';

export class WeatherStationConfigGenerator implements ConfigGenerator<WeatherStationConfig> {
  private stationGenerator: WeatherStationGenerator;

  constructor() {
    this.stationGenerator = new WeatherStationGenerator();
  }

  generateConfig(id: string): WeatherStationConfig {
    return this.stationGenerator.generateStation(id);
  }
}