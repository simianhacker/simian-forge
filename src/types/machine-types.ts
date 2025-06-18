export interface MachineSpec {
  vcpus: number;
  physicalCores: number;
  memoryGB: number;
  networkPerformance: string;
  ebsOptimized: boolean;
}

export const AWS_MACHINE_TYPES: Record<string, MachineSpec> = {
  't3.nano': { vcpus: 2, physicalCores: 1, memoryGB: 0.5, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  't3.micro': { vcpus: 2, physicalCores: 1, memoryGB: 1, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  't3.small': { vcpus: 2, physicalCores: 1, memoryGB: 2, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  't3.medium': { vcpus: 2, physicalCores: 1, memoryGB: 4, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  't3.large': { vcpus: 2, physicalCores: 1, memoryGB: 8, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  't3.xlarge': { vcpus: 4, physicalCores: 2, memoryGB: 16, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  't3.2xlarge': { vcpus: 8, physicalCores: 4, memoryGB: 32, networkPerformance: 'Up to 5 Gbps', ebsOptimized: true },
  'm5.large': { vcpus: 2, physicalCores: 1, memoryGB: 8, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'm5.xlarge': { vcpus: 4, physicalCores: 2, memoryGB: 16, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'm5.2xlarge': { vcpus: 8, physicalCores: 4, memoryGB: 32, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'm5.4xlarge': { vcpus: 16, physicalCores: 8, memoryGB: 64, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'm5.8xlarge': { vcpus: 32, physicalCores: 16, memoryGB: 128, networkPerformance: '10 Gbps', ebsOptimized: true },
  'm5.12xlarge': { vcpus: 48, physicalCores: 24, memoryGB: 192, networkPerformance: '12 Gbps', ebsOptimized: true },
  'm5.16xlarge': { vcpus: 64, physicalCores: 32, memoryGB: 256, networkPerformance: '20 Gbps', ebsOptimized: true },
  'm5.24xlarge': { vcpus: 96, physicalCores: 48, memoryGB: 384, networkPerformance: '25 Gbps', ebsOptimized: true },
  'c5.large': { vcpus: 2, physicalCores: 1, memoryGB: 4, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'c5.xlarge': { vcpus: 4, physicalCores: 2, memoryGB: 8, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'c5.2xlarge': { vcpus: 8, physicalCores: 4, memoryGB: 16, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'c5.4xlarge': { vcpus: 16, physicalCores: 8, memoryGB: 32, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'c5.9xlarge': { vcpus: 36, physicalCores: 18, memoryGB: 72, networkPerformance: '10 Gbps', ebsOptimized: true },
  'c5.12xlarge': { vcpus: 48, physicalCores: 24, memoryGB: 96, networkPerformance: '12 Gbps', ebsOptimized: true },
  'c5.18xlarge': { vcpus: 72, physicalCores: 36, memoryGB: 144, networkPerformance: '25 Gbps', ebsOptimized: true },
  'c5.24xlarge': { vcpus: 96, physicalCores: 48, memoryGB: 192, networkPerformance: '25 Gbps', ebsOptimized: true },
  'r5.large': { vcpus: 2, physicalCores: 1, memoryGB: 16, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'r5.xlarge': { vcpus: 4, physicalCores: 2, memoryGB: 32, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'r5.2xlarge': { vcpus: 8, physicalCores: 4, memoryGB: 64, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'r5.4xlarge': { vcpus: 16, physicalCores: 8, memoryGB: 128, networkPerformance: 'Up to 10 Gbps', ebsOptimized: true },
  'r5.8xlarge': { vcpus: 32, physicalCores: 16, memoryGB: 256, networkPerformance: '10 Gbps', ebsOptimized: true },
  'r5.12xlarge': { vcpus: 48, physicalCores: 24, memoryGB: 384, networkPerformance: '12 Gbps', ebsOptimized: true },
  'r5.16xlarge': { vcpus: 64, physicalCores: 32, memoryGB: 512, networkPerformance: '20 Gbps', ebsOptimized: true },
  'r5.24xlarge': { vcpus: 96, physicalCores: 48, memoryGB: 768, networkPerformance: '25 Gbps', ebsOptimized: true }
};

export const GCP_MACHINE_TYPES: Record<string, MachineSpec> = {
  'e2-micro': { vcpus: 1, physicalCores: 1, memoryGB: 1, networkPerformance: '1 Gbps', ebsOptimized: false },
  'e2-small': { vcpus: 1, physicalCores: 1, memoryGB: 2, networkPerformance: '1 Gbps', ebsOptimized: false },
  'e2-medium': { vcpus: 1, physicalCores: 1, memoryGB: 4, networkPerformance: '2 Gbps', ebsOptimized: false },
  'e2-standard-2': { vcpus: 2, physicalCores: 1, memoryGB: 8, networkPerformance: '4 Gbps', ebsOptimized: false },
  'e2-standard-4': { vcpus: 4, physicalCores: 2, memoryGB: 16, networkPerformance: '8 Gbps', ebsOptimized: false },
  'e2-standard-8': { vcpus: 8, physicalCores: 4, memoryGB: 32, networkPerformance: '16 Gbps', ebsOptimized: false },
  'e2-standard-16': { vcpus: 16, physicalCores: 8, memoryGB: 64, networkPerformance: '32 Gbps', ebsOptimized: false },
  'n1-standard-1': { vcpus: 1, physicalCores: 1, memoryGB: 3.75, networkPerformance: '2 Gbps', ebsOptimized: false },
  'n1-standard-2': { vcpus: 2, physicalCores: 1, memoryGB: 7.5, networkPerformance: '4 Gbps', ebsOptimized: false },
  'n1-standard-4': { vcpus: 4, physicalCores: 2, memoryGB: 15, networkPerformance: '8 Gbps', ebsOptimized: false },
  'n1-standard-8': { vcpus: 8, physicalCores: 4, memoryGB: 30, networkPerformance: '16 Gbps', ebsOptimized: false },
  'n1-standard-16': { vcpus: 16, physicalCores: 8, memoryGB: 60, networkPerformance: '32 Gbps', ebsOptimized: false },
  'n1-standard-32': { vcpus: 32, physicalCores: 16, memoryGB: 120, networkPerformance: '32 Gbps', ebsOptimized: false },
  'n1-standard-64': { vcpus: 64, physicalCores: 32, memoryGB: 240, networkPerformance: '32 Gbps', ebsOptimized: false },
  'n1-standard-96': { vcpus: 96, physicalCores: 48, memoryGB: 360, networkPerformance: '32 Gbps', ebsOptimized: false }
};

export const AZURE_MACHINE_TYPES: Record<string, MachineSpec> = {
  'Standard_B1s': { vcpus: 1, physicalCores: 1, memoryGB: 1, networkPerformance: '1 Gbps', ebsOptimized: false },
  'Standard_B1ms': { vcpus: 1, physicalCores: 1, memoryGB: 2, networkPerformance: '1 Gbps', ebsOptimized: false },
  'Standard_B2s': { vcpus: 2, physicalCores: 1, memoryGB: 4, networkPerformance: '2 Gbps', ebsOptimized: false },
  'Standard_B2ms': { vcpus: 2, physicalCores: 1, memoryGB: 8, networkPerformance: '3 Gbps', ebsOptimized: false },
  'Standard_B4ms': { vcpus: 4, physicalCores: 2, memoryGB: 16, networkPerformance: '4 Gbps', ebsOptimized: false },
  'Standard_B8ms': { vcpus: 8, physicalCores: 4, memoryGB: 32, networkPerformance: '6 Gbps', ebsOptimized: false },
  'Standard_D2s_v3': { vcpus: 2, physicalCores: 1, memoryGB: 8, networkPerformance: '4 Gbps', ebsOptimized: true },
  'Standard_D4s_v3': { vcpus: 4, physicalCores: 2, memoryGB: 16, networkPerformance: '8 Gbps', ebsOptimized: true },
  'Standard_D8s_v3': { vcpus: 8, physicalCores: 4, memoryGB: 32, networkPerformance: '16 Gbps', ebsOptimized: true },
  'Standard_D16s_v3': { vcpus: 16, physicalCores: 8, memoryGB: 64, networkPerformance: '32 Gbps', ebsOptimized: true },
  'Standard_D32s_v3': { vcpus: 32, physicalCores: 16, memoryGB: 128, networkPerformance: '32 Gbps', ebsOptimized: true },
  'Standard_D64s_v3': { vcpus: 64, physicalCores: 32, memoryGB: 256, networkPerformance: '32 Gbps', ebsOptimized: true }
};

export function getMachineSpec(provider: string, instanceType: string): MachineSpec {
  switch (provider) {
    case 'aws':
      return AWS_MACHINE_TYPES[instanceType] || AWS_MACHINE_TYPES['m5.large'];
    case 'gcp':
      return GCP_MACHINE_TYPES[instanceType] || GCP_MACHINE_TYPES['e2-standard-2'];
    case 'azure':
      return AZURE_MACHINE_TYPES[instanceType] || AZURE_MACHINE_TYPES['Standard_D2s_v3'];
    default:
      return AWS_MACHINE_TYPES['m5.large'];
  }
}