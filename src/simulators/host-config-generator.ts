import { HostGenerator } from './host-generator';
import { HostConfig } from '../types/host-types';
import { ConfigGenerator } from '../types/simulator-types';

export class HostConfigGenerator implements ConfigGenerator<HostConfig> {
  private hostGenerator: HostGenerator;

  constructor() {
    this.hostGenerator = new HostGenerator();
  }

  generateConfig(id: string): HostConfig {
    return this.hostGenerator.generateHost(id);
  }
}