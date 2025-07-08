export interface WeatherStationConfig {
  id: string;
  name: string;
  location: LocationConfig;
  sensors: SensorConfig[];
  solarPanels: SolarPanelConfig[];
  computeHost: ComputeConfig;
}

export interface LocationConfig {
  latitude: number;
  longitude: number;
  altitude: number;
  timezone: string;
  region: string;
  country: string;
  site: string;
}

export interface SensorConfig {
  id: string;
  type: 'temperature' | 'humidity' | 'wind_speed' | 'wind_direction' | 'precipitation' | 'barometric_pressure' | 'solar_radiation' | 'soil_moisture' | 'leaf_wetness' | 'soil_temperature';
  location: string;
  calibration: CalibrationConfig;
}

export interface CalibrationConfig {
  offset: number;
  multiplier: number;
  accuracy: number;
}

export interface SolarPanelConfig {
  id: string;
  wattage: number;
  efficiency: number;
  tilt: number;
  azimuth: number;
  location: string;
}

export interface ComputeConfig {
  hostname: string;
  vcpus: number;
  memoryMB: number;
  networkInterface: string;
}

export interface WeatherCounterState {
  [key: string]: number;
}

export interface WeatherStationMetrics {
  timestamp: Date;
  station: WeatherStationConfig;
  environmental: EnvironmentalMetrics;
  solar: SolarMetrics;
  energy: EnergyMetrics;
  compute: ComputeMetrics;
  network: NetworkMetrics;
  counters: WeatherCounterState;
}

export interface EnvironmentalMetrics {
  temperature: {
    air: number;
    soil: number;
    dewPoint: number;
  };
  humidity: {
    relative: number;
    absolute: number;
  };
  wind: {
    speed: number;
    direction: number;
    gust: number;
  };
  precipitation: {
    rate: number;
    accumulated: number;
  };
  pressure: {
    barometric: number;
    seaLevel: number;
  };
  radiation: {
    solar: number;
    uv: number;
  };
  soil: {
    moisture: number;
    temperature: number;
  };
  leaf: {
    wetness: number;
  };
}

export interface SolarMetrics {
  panels: SolarPanelMetrics[];
  total: {
    currentPower: number;
    dailyEnergy: number;
    efficiency: number;
  };
}

export interface SolarPanelMetrics {
  panelId: string;
  voltage: number;
  current: number;
  power: number;
  temperature: number;
  efficiency: number;
}

export interface EnergyMetrics {
  consumption: {
    total: number;
    sensors: number;
    compute: number;
    communication: number;
  };
  production: {
    solar: number;
  };
  battery: {
    voltage: number;
    current: number;
    chargeLevel: number;
    temperature: number;
  };
}

export interface ComputeMetrics {
  cpu: {
    usage: number;
    temperature: number;
    states: {
      user: number;
      system: number;
      idle: number;
      wait: number;
    };
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    usagePercent: number;
  };
}

export interface NetworkMetrics {
  cellular: {
    signal: number;
    rssi: number;
    technology: string;
  };
  traffic: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
    rxErrors: number;
    txErrors: number;
  };
}

export interface WeatherCondition {
  condition: 'sunny' | 'cloudy' | 'overcast' | 'rain' | 'storm' | 'snow' | 'fog';
  cloudCover: number;
  visibility: number;
}