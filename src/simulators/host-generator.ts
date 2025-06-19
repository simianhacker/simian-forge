import { HostConfig, CloudConfig, NetworkInterface, DiskConfig } from '../types/host-types';
import { getMachineSpec } from '../types/machine-types';
import { hashString, seededRandom } from '../utils/hash';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'ap-southeast-1'
];

const GCP_REGIONS = [
  'us-central1', 'us-east1', 'us-west1', 'us-west2',
  'europe-west1', 'europe-west2', 'europe-west3', 'asia-southeast1'
];

const AZURE_REGIONS = [
  'eastus', 'eastus2', 'westus', 'westus2',
  'westeurope', 'northeurope', 'centralus', 'southeastasia'
];

const AWS_INSTANCE_TYPES = [
  't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge',
  'm5.large', 'm5.xlarge', 'm5.2xlarge', 'm5.4xlarge',
  'c5.large', 'c5.xlarge', 'c5.2xlarge', 'c5.4xlarge',
  'r5.large', 'r5.xlarge', 'r5.2xlarge', 'r5.4xlarge'
];

const GCP_INSTANCE_TYPES = [
  'e2-micro', 'e2-small', 'e2-medium', 'e2-standard-2', 'e2-standard-4',
  'n1-standard-1', 'n1-standard-2', 'n1-standard-4', 'n1-standard-8'
];

const AZURE_INSTANCE_TYPES = [
  'Standard_B1s', 'Standard_B1ms', 'Standard_B2s', 'Standard_B2ms',
  'Standard_D2s_v3', 'Standard_D4s_v3', 'Standard_D8s_v3'
];

export class HostGenerator {
  private hostConfigs: Map<string, HostConfig> = new Map();

  generateHost(hostName: string): HostConfig {
    return tracer.startActiveSpan('generateHost', (span) => {
      try {
        // Check if we already have this host configured
        if (this.hostConfigs.has(hostName)) {
          const config = this.hostConfigs.get(hostName)!;
          span.setStatus({ code: 1 });
          return config;
        }

        // Generate a deterministic but pseudo-random configuration based on host name
        const random = seededRandom(hostName);

        // Choose cloud provider
        const providers: Array<'aws' | 'gcp' | 'azure'> = ['aws', 'gcp', 'azure'];
        const provider = providers[Math.floor(random() * providers.length)];

        // Choose region and instance type based on provider
        let region: string;
        let instanceType: string;
        let regions: string[];
        let instanceTypes: string[];

        switch (provider) {
          case 'aws':
            regions = AWS_REGIONS;
            instanceTypes = AWS_INSTANCE_TYPES;
            break;
          case 'gcp':
            regions = GCP_REGIONS;
            instanceTypes = GCP_INSTANCE_TYPES;
            break;
          case 'azure':
            regions = AZURE_REGIONS;
            instanceTypes = AZURE_INSTANCE_TYPES;
            break;
        }

        region = regions[Math.floor(random() * regions.length)];
        instanceType = instanceTypes[Math.floor(random() * instanceTypes.length)];

        // Get machine specifications
        const machineSpec = getMachineSpec(provider, instanceType);

        // Generate availability zone
        const azSuffix = ['a', 'b', 'c'][Math.floor(random() * 3)];
        const availabilityZone = `${region}${azSuffix}`;

        // Generate instance ID
        const instanceId = this.generateInstanceId(provider, random);

        const cloud: CloudConfig = {
          provider,
          region,
          availabilityZone,
          instanceId,
          instanceType
        };

        // Generate network interfaces
        const networkInterfaces: NetworkInterface[] = [
          {
            name: 'eth0',
            type: 'ethernet',
            mtu: 1500
          },
          {
            name: 'lo',
            type: 'loopback',
            mtu: 65536
          }
        ];

        // Generate disk configuration
        const disks: DiskConfig[] = [
          {
            device: '/dev/xvda1',
            filesystem: 'ext4',
            mountpoint: '/',
            totalBytes: this.generateDiskSize(machineSpec.memoryGB, random)
          },
          {
            device: 'tmpfs',
            filesystem: 'tmpfs',
            mountpoint: '/tmp',
            totalBytes: Math.floor(machineSpec.memoryGB * 1024 * 1024 * 1024 * 0.1) // 10% of memory
          }
        ];

        const hostConfig: HostConfig = {
          name: hostName,
          machineType: instanceType,
          vcpus: machineSpec.vcpus,
          physicalCores: machineSpec.physicalCores,
          memoryGB: machineSpec.memoryGB,
          cloud,
          networkInterfaces,
          disks
        };

        // Cache the configuration
        this.hostConfigs.set(hostName, hostConfig);
        
        span.setStatus({ code: 1 });
        return hostConfig;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }


  private generateInstanceId(provider: string, random: () => number): string {
    switch (provider) {
      case 'aws':
        return `i-${this.randomHex(17, random)}`;
      case 'gcp':
        return `${Math.floor(random() * 9000000000000000000) + 1000000000000000000}`;
      case 'azure':
        return `${this.randomHex(8, random)}-${this.randomHex(4, random)}-${this.randomHex(4, random)}-${this.randomHex(4, random)}-${this.randomHex(12, random)}`;
      default:
        return `i-${this.randomHex(17, random)}`;
    }
  }

  private randomHex(length: number, random: () => number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(random() * chars.length)];
    }
    return result;
  }

  private generateDiskSize(memoryGB: number, random: () => number): number {
    // Generate disk size between 8GB and 100GB, with bias towards larger sizes for larger instances
    const minSizeGB = 8;
    const baseSizeGB = Math.max(20, memoryGB * 2);
    const maxSizeGB = Math.min(100, baseSizeGB * 2);
    
    const sizeGB = minSizeGB + Math.floor(random() * (maxSizeGB - minSizeGB));
    return sizeGB * 1024 * 1024 * 1024; // Convert to bytes
  }
}