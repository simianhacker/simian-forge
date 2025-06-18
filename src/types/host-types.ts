export interface HostConfig {
  name: string;
  machineType: string;
  vcpus: number;
  physicalCores: number;
  memoryGB: number;
  cloud: CloudConfig;
  networkInterfaces: NetworkInterface[];
  disks: DiskConfig[];
}

export interface CloudConfig {
  provider: 'aws' | 'gcp' | 'azure';
  region: string;
  availabilityZone: string;
  instanceId: string;
  instanceType: string;
}

export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'loopback';
  mtu: number;
}

export interface DiskConfig {
  device: string;
  filesystem: string;
  mountpoint: string;
  totalBytes: number;
}

export interface CounterState {
  [key: string]: number;
}

export interface HostMetrics {
  timestamp: Date;
  host: HostConfig;
  cpu: CpuMetrics;
  load: LoadMetrics;
  memory: MemoryMetrics;
  diskio: DiskIOMetrics[];
  filesystem: FilesystemMetrics[];
  network: NetworkMetrics[];
  process: ProcessMetrics;
  counters: CounterState;
}

export interface CpuMetrics {
  usage: {
    user: number;
    nice: number;
    system: number;
    idle: number;
    wait: number;
    interrupt: number;
    softirq: number;
    steal: number;
  };
  perCoreUsage: Array<{
    core: number;
    user: number;
    nice: number;
    system: number;
    idle: number;
    wait: number;
    interrupt: number;
    softirq: number;
    steal: number;
  }>;
  count: number;
}

export interface LoadMetrics {
  load1m: number;
  load5m: number;
  load15m: number;
}

export interface MemoryMetrics {
  total: number;
  used: number;
  available: number;
  free: number;
  cached: number;
  buffered: number;
  inactive: number;
  slab_reclaimable: number;
  slab_unreclaimable: number;
  usagePercent: number;
}

export interface DiskIOMetrics {
  device: string;
  readBytes: number;
  writeBytes: number;
  readOps: number;
  writeOps: number;
  readTime: number;
  writeTime: number;
}

export interface FilesystemMetrics {
  device: string;
  filesystem: string;
  mountpoint: string;
  total: number;
  used: number;
  available: number;
  usagePercent: number;
  inodes: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
}

export interface NetworkMetrics {
  device: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
}

export interface ProcessMetrics {
  count: number;
  running: number;
  sleeping: number;
  stopped: number;
  zombie: number;
  totalThreads: number;
}