import { WeatherMetricsGenerator } from './weather-metrics-generator';
import { WeatherStationConfig, WeatherStationMetrics } from '../types/weather-types';
import { MetricsGenerator } from '../types/simulator-types';

export class WeatherStationMetricsGenerator implements MetricsGenerator<WeatherStationConfig, WeatherStationMetrics> {
  private metricsGenerator: WeatherMetricsGenerator;

  constructor() {
    this.metricsGenerator = new WeatherMetricsGenerator();
  }

  generateMetrics(config: WeatherStationConfig, timestamp: Date): WeatherStationMetrics {
    return this.metricsGenerator.generateMetrics(config, timestamp);
  }
}