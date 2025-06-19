import { HostConfig, HostMetrics, CounterState, CpuMetrics, LoadMetrics, MemoryMetrics, DiskIOMetrics, FilesystemMetrics, NetworkMetrics, ProcessMetrics } from '../types/host-types';
import { seededRandom } from '../utils/hash';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

export class MetricsGenerator {
  private counters: Map<string, CounterState> = new Map();
  private previousMetrics: Map<string, HostMetrics> = new Map();

  generateMetrics(hostConfig: HostConfig, timestamp: Date): HostMetrics {
    return tracer.startActiveSpan('generateMetrics', (span) => {
      try {
        const hostKey = hostConfig.name;
        
        // Get or initialize counters for this host
        if (!this.counters.has(hostKey)) {
          this.counters.set(hostKey, {});
        }
        const hostCounters = this.counters.get(hostKey)!;

        // Generate realistic metrics based on machine type and time patterns
        const cpu = this.generateCpuMetrics(hostConfig, timestamp);
        const load = this.generateLoadMetrics(hostConfig, cpu, timestamp);
        const memory = this.generateMemoryMetrics(hostConfig, timestamp);
        const diskio = this.generateDiskIOMetrics(hostConfig, hostCounters, timestamp);
        const filesystem = this.generateFilesystemMetrics(hostConfig, timestamp);
        const network = this.generateNetworkMetrics(hostConfig, hostCounters, timestamp);
        const process = this.generateProcessMetrics(hostConfig, timestamp);

        const metrics: HostMetrics = {
          timestamp,
          host: hostConfig,
          cpu,
          load,
          memory,
          diskio,
          filesystem,
          network,
          process,
          counters: hostCounters
        };

        this.previousMetrics.set(hostKey, metrics);
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

  private generateCpuMetrics(hostConfig: HostConfig, timestamp: Date): CpuMetrics {
    // Generate CPU usage with realistic patterns
    const hour = timestamp.getHours();
    const minute = timestamp.getMinutes();
    
    // Base load varies by time of day (simulating business hours)
    const baseLoad = this.getTimeBasedLoad(hour);
    
    // Add some randomness and variation
    const random = seededRandom(hostConfig.name + timestamp.getTime());
    
    // Generate per-core CPU usage with variations
    const perCoreUsage = [];
    let totalAggregateUsage = {
      user: 0,
      nice: 0,
      system: 0,
      idle: 0,
      wait: 0,
      interrupt: 0,
      softirq: 0,
      steal: 0
    };
    
    for (let core = 0; core < hostConfig.vcpus; core++) {
      // Each core gets slightly different load with some randomness
      const coreRandom = seededRandom(hostConfig.name + timestamp.getTime() + core);
      const coreVariation = (coreRandom() - 0.5) * 30; // ±15% variation per core
      const coreLoad = Math.max(5, Math.min(95, baseLoad + coreVariation));
      
      const totalUsed = coreLoad;
      const idle = 100 - totalUsed;
      
      // Distribute the used CPU across different states for this core
      const user = totalUsed * (0.5 + (coreRandom() - 0.5) * 0.2); // 40-60% of used
      const nice = totalUsed * (0.05 + coreRandom() * 0.05); // 0-10% of used
      const system = totalUsed * (0.2 + (coreRandom() - 0.5) * 0.1); // 15-25% of used
      const wait = totalUsed * (0.05 + coreRandom() * 0.05); // 0-10% of used (iowait -> wait)
      const remaining = totalUsed - user - nice - system - wait;
      
      const coreUsage = {
        core,
        user: Math.max(0, user),
        nice: Math.max(0, nice),
        system: Math.max(0, system),
        idle: Math.max(0, idle),
        wait: Math.max(0, wait),
        interrupt: Math.max(0, remaining * 0.4), // irq -> interrupt
        softirq: Math.max(0, remaining * 0.4),
        steal: Math.max(0, remaining * 0.2)
      };
      
      perCoreUsage.push(coreUsage);
      
      // Aggregate for overall system metrics
      totalAggregateUsage.user += coreUsage.user;
      totalAggregateUsage.nice += coreUsage.nice;
      totalAggregateUsage.system += coreUsage.system;
      totalAggregateUsage.idle += coreUsage.idle;
      totalAggregateUsage.wait += coreUsage.wait;
      totalAggregateUsage.interrupt += coreUsage.interrupt;
      totalAggregateUsage.softirq += coreUsage.softirq;
      totalAggregateUsage.steal += coreUsage.steal;
    }
    
    // Average the aggregated usage across all cores
    const avgUsage = {
      user: totalAggregateUsage.user / hostConfig.vcpus,
      nice: totalAggregateUsage.nice / hostConfig.vcpus,
      system: totalAggregateUsage.system / hostConfig.vcpus,
      idle: totalAggregateUsage.idle / hostConfig.vcpus,
      wait: totalAggregateUsage.wait / hostConfig.vcpus,
      interrupt: totalAggregateUsage.interrupt / hostConfig.vcpus,
      softirq: totalAggregateUsage.softirq / hostConfig.vcpus,
      steal: totalAggregateUsage.steal / hostConfig.vcpus
    };

    // Update cumulative CPU time counters per core
    const hostKey = hostConfig.name;
    const hostCounters = this.counters.get(hostKey) || {};
    
    // Calculate time increments based on utilization
    const previousMetrics = this.previousMetrics.get(hostKey);
    const intervalSeconds = previousMetrics 
      ? (timestamp.getTime() - previousMetrics.timestamp.getTime()) / 1000
      : 60; // Default interval for first measurement
    
    perCoreUsage.forEach(coreUsage => {
      Object.entries(coreUsage).forEach(([state, percent]) => {
        if (state !== 'core') {
          const counterKey = `cpu_time_${coreUsage.core}_${state}`;
          const incrementSeconds = (percent / 100) * intervalSeconds;
          hostCounters[counterKey] = this.incrementCounter(hostCounters[counterKey] || 0, incrementSeconds);
        }
      });
    });
    
    this.counters.set(hostKey, hostCounters);
    
    return {
      usage: avgUsage,
      perCoreUsage,
      count: hostConfig.vcpus
    };
  }

  private generateLoadMetrics(hostConfig: HostConfig, cpu: CpuMetrics, timestamp: Date): LoadMetrics {
    const cpuUsagePercent = 100 - cpu.usage.idle;
    const loadFactor = cpuUsagePercent / 100;
    
    // Load average should correlate with CPU usage but be smoothed
    const baseLoad = loadFactor * hostConfig.vcpus;
    const random = seededRandom(hostConfig.name + timestamp.getTime() + 'load');
    
    return {
      load1m: Math.max(0, baseLoad + (random() - 0.5) * 0.5),
      load5m: Math.max(0, baseLoad + (random() - 0.5) * 0.3),
      load15m: Math.max(0, baseLoad + (random() - 0.5) * 0.2)
    };
  }

  private generateMemoryMetrics(hostConfig: HostConfig, timestamp: Date): MemoryMetrics {
    const totalBytes = hostConfig.memoryGB * 1024 * 1024 * 1024;
    const random = seededRandom(hostConfig.name + timestamp.getTime() + 'memory');
    
    // Memory usage typically 40-80% depending on workload
    const usagePercent = 40 + random() * 40;
    const used = Math.floor(totalBytes * (usagePercent / 100));
    
    // Distribute memory across different states
    const available = totalBytes - used;
    const cached = Math.floor(available * (0.25 + random() * 0.25)); // 25-50% of available
    const buffered = Math.floor(available * (0.05 + random() * 0.1)); // 5-15% of available
    const inactive = Math.floor(available * (0.1 + random() * 0.15)); // 10-25% of available
    const slab_reclaimable = Math.floor(available * (0.02 + random() * 0.03)); // 2-5% of available
    const slab_unreclaimable = Math.floor(available * (0.01 + random() * 0.02)); // 1-3% of available
    const free = available - cached - buffered - inactive - slab_reclaimable - slab_unreclaimable;
    
    return {
      total: totalBytes,
      used,
      available,
      free: Math.max(0, free),
      cached,
      buffered,
      inactive,
      slab_reclaimable,
      slab_unreclaimable,
      usagePercent
    };
  }

  private generateDiskIOMetrics(hostConfig: HostConfig, counters: CounterState, timestamp: Date): DiskIOMetrics[] {
    return hostConfig.disks.map(disk => {
      const deviceKey = `diskio_${disk.device}`;
      const random = seededRandom(hostConfig.name + timestamp.getTime() + deviceKey);
      
      // Generate IO rates (bytes/sec and ops/sec)
      const readBytesPerSec = random() * 50 * 1024 * 1024; // 0-50 MB/s
      const writeBytesPerSec = random() * 20 * 1024 * 1024; // 0-20 MB/s
      const readOpsPerSec = random() * 1000; // 0-1000 IOPS
      const writeOpsPerSec = random() * 500; // 0-500 IOPS
      
      // Convert to cumulative counters
      const readBytesKey = `${deviceKey}_read_bytes`;
      const writeBytesKey = `${deviceKey}_write_bytes`;
      const readOpsKey = `${deviceKey}_read_ops`;
      const writeOpsKey = `${deviceKey}_write_ops`;
      
      counters[readBytesKey] = this.incrementCounter(counters[readBytesKey] || 0, readBytesPerSec);
      counters[writeBytesKey] = this.incrementCounter(counters[writeBytesKey] || 0, writeBytesPerSec);
      counters[readOpsKey] = this.incrementCounter(counters[readOpsKey] || 0, readOpsPerSec);
      counters[writeOpsKey] = this.incrementCounter(counters[writeOpsKey] || 0, writeOpsPerSec);
      
      return {
        device: disk.device,
        readBytes: counters[readBytesKey],
        writeBytes: counters[writeBytesKey],
        readOps: counters[readOpsKey],
        writeOps: counters[writeOpsKey],
        readTime: Math.floor(random() * 100), // milliseconds
        writeTime: Math.floor(random() * 100)
      };
    });
  }

  private generateFilesystemMetrics(hostConfig: HostConfig, timestamp: Date): FilesystemMetrics[] {
    const random = seededRandom(hostConfig.name + timestamp.getTime() + 'filesystem');
    
    return hostConfig.disks.map(disk => {
      // Filesystem usage typically grows slowly over time
      const usagePercent = 20 + random() * 60; // 20-80% usage
      const used = Math.floor(disk.totalBytes * (usagePercent / 100));
      const available = disk.totalBytes - used;
      
      // Inode usage
      const totalInodes = Math.floor(disk.totalBytes / (4 * 1024)); // Assume 4KB per inode
      const usedInodes = Math.floor(totalInodes * (usagePercent / 100) * 0.1); // Much lower inode usage
      
      return {
        device: disk.device,
        filesystem: disk.filesystem,
        mountpoint: disk.mountpoint,
        total: disk.totalBytes,
        used,
        available,
        usagePercent,
        inodes: {
          total: totalInodes,
          used: usedInodes,
          free: totalInodes - usedInodes,
          usagePercent: (usedInodes / totalInodes) * 100
        }
      };
    });
  }

  private generateNetworkMetrics(hostConfig: HostConfig, counters: CounterState, timestamp: Date): NetworkMetrics[] {
    return hostConfig.networkInterfaces.map(iface => {
      const random = seededRandom(hostConfig.name + timestamp.getTime() + iface.name);
      
      // Skip loopback for realistic network traffic
      if (iface.type === 'loopback') {
        return {
          device: iface.name,
          rxBytes: 0,
          txBytes: 0,
          rxPackets: 0,
          txPackets: 0,
          rxErrors: 0,
          txErrors: 0,
          rxDropped: 0,
          txDropped: 0
        };
      }
      
      // Generate network rates
      const rxBytesPerSec = random() * 10 * 1024 * 1024; // 0-10 MB/s
      const txBytesPerSec = random() * 5 * 1024 * 1024; // 0-5 MB/s
      const avgPacketSize = 1000 + random() * 500; // 1000-1500 bytes
      
      const rxPacketsPerSec = rxBytesPerSec / avgPacketSize;
      const txPacketsPerSec = txBytesPerSec / avgPacketSize;
      
      // Generate cumulative counters
      const deviceKey = `network_${iface.name}`;
      const rxBytesKey = `${deviceKey}_rx_bytes`;
      const txBytesKey = `${deviceKey}_tx_bytes`;
      const rxPacketsKey = `${deviceKey}_rx_packets`;
      const txPacketsKey = `${deviceKey}_tx_packets`;
      
      counters[rxBytesKey] = this.incrementCounter(counters[rxBytesKey] || 0, rxBytesPerSec);
      counters[txBytesKey] = this.incrementCounter(counters[txBytesKey] || 0, txBytesPerSec);
      counters[rxPacketsKey] = this.incrementCounter(counters[rxPacketsKey] || 0, rxPacketsPerSec);
      counters[txPacketsKey] = this.incrementCounter(counters[txPacketsKey] || 0, txPacketsPerSec);
      
      return {
        device: iface.name,
        rxBytes: counters[rxBytesKey],
        txBytes: counters[txBytesKey],
        rxPackets: counters[rxPacketsKey],
        txPackets: counters[txPacketsKey],
        rxErrors: Math.floor(random() * 5), // Very low error rates
        txErrors: Math.floor(random() * 5),
        rxDropped: Math.floor(random() * 2),
        txDropped: Math.floor(random() * 2)
      };
    });
  }

  private generateProcessMetrics(hostConfig: HostConfig, timestamp: Date): ProcessMetrics {
    const random = seededRandom(hostConfig.name + timestamp.getTime() + 'process');
    
    // Process count scales with machine size
    const baseProcesses = 50 + hostConfig.vcpus * 20;
    const variation = Math.floor((random() - 0.5) * 20);
    const total = Math.max(30, baseProcesses + variation);
    
    // Distribute process states
    const running = Math.floor(random() * hostConfig.vcpus * 2); // 0-2 per CPU
    const zombie = Math.floor(random() * 3); // 0-2 zombies
    const stopped = Math.floor(random() * 2); // 0-1 stopped
    const sleeping = total - running - zombie - stopped;
    
    return {
      count: total,
      running: Math.max(0, running),
      sleeping: Math.max(0, sleeping),
      stopped: Math.max(0, stopped),
      zombie: Math.max(0, zombie),
      totalThreads: total + Math.floor(random() * total * 0.5) // Threads > processes
    };
  }

  private getTimeBasedLoad(hour: number): number {
    // Simulate business hours load pattern
    if (hour >= 9 && hour <= 17) {
      return 60 + Math.sin((hour - 9) / 8 * Math.PI) * 20; // 40-80% during business hours
    } else if (hour >= 18 && hour <= 22) {
      return 40 + Math.sin((hour - 18) / 4 * Math.PI) * 15; // 25-55% evening
    } else {
      return 15 + Math.sin(hour / 24 * Math.PI * 2) * 10; // 5-25% overnight
    }
  }

  private incrementCounter(current: number, increment: number): number {
    const newValue = current + increment;
    // Reset counter if it exceeds MAX_SAFE_INTEGER
    return newValue > Number.MAX_SAFE_INTEGER ? increment : Math.floor(newValue);
  }

}