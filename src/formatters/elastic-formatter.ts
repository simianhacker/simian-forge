import { HostMetrics } from '../types/host-types';
import { trace } from '@opentelemetry/api';
import { BaseFormatter } from './base-formatter';

const tracer = trace.getTracer('simian-forge');

export interface ElasticDocument {
  '@timestamp': string;
  data_stream: {
    dataset: string;
    namespace: string;
    type: string;
  };
  event: {
    dataset: string;
    module: string;
  };
  agent: {
    name: string;
    type: string;
    version: string;
    hostname: string;
  };
  host: {
    name: string;
    hostname: string;
    id: string;
    architecture: string;
    mac: string[];
    os: {
      platform: string;
      name: string;
      family: string;
      version: string;
      kernel: string;
    };
    containerized: boolean;
    ip: string[];
  };
  cloud: {
    provider: string;
    region: string;
    availability_zone: string;
    instance: {
      id: string;
      name: string;
    };
    machine: {
      type: string;
    };
  };
  metricset: {
    name: string;
  };
  [key: string]: any; // For metric-specific fields
}

export class ElasticFormatter extends BaseFormatter {
  formatMetrics(hostMetrics: HostMetrics): ElasticDocument[] {
    return tracer.startActiveSpan('formatMetrics', (span) => {
      try {
        const timestamp = hostMetrics.timestamp.toISOString();
        const documents: ElasticDocument[] = [];
        
        const baseDoc = {
          '@timestamp': timestamp,
          agent: {
            name: 'simian-forge',
            type: 'metricbeat',
            version: '0.0.1',
            hostname: hostMetrics.host.name
          },
          host: {
            name: `${hostMetrics.host.name}-metricbeat`,
            hostname: hostMetrics.host.name,
            id: this.generateHostId(hostMetrics.host.name),
            architecture: 'x86_64',
            mac: this.generateHostMACs(hostMetrics.host.name),
            os: {
              platform: 'linux',
              name: 'Ubuntu',
              family: 'debian',
              version: '20.04.4 LTS (Focal Fossa)',
              kernel: '5.4.0-122-generic'
            },
            containerized: false,
            ip: this.generateHostIPs(hostMetrics.host.name)
          },
          cloud: {
            provider: hostMetrics.host.cloud.provider,
            region: hostMetrics.host.cloud.region,
            availability_zone: hostMetrics.host.cloud.availabilityZone,
            instance: {
              id: hostMetrics.host.cloud.instanceId,
              name: hostMetrics.host.name
            },
            machine: {
              type: hostMetrics.host.cloud.instanceType
            }
          }
        };

        // CPU metricset
        const cpuDataset = 'system.cpu';
        documents.push({
          ...baseDoc,
          data_stream: {
            dataset: cpuDataset,
            namespace: 'default',
            type: 'metrics'
          },
          event: {
            dataset: cpuDataset,
            module: this.getModuleFromDataset(cpuDataset)
          },
          metricset: { name: 'cpu' },
          system: {
            cpu: {
              user: {
                pct: hostMetrics.cpu.usage.user / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.user / 100) / hostMetrics.cpu.count
                }
              },
              system: {
                pct: hostMetrics.cpu.usage.system / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.system / 100) / hostMetrics.cpu.count
                }
              },
              idle: {
                pct: hostMetrics.cpu.usage.idle / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.idle / 100) / hostMetrics.cpu.count
                }
              },
              iowait: {
                pct: hostMetrics.cpu.usage.iowait / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.iowait / 100) / hostMetrics.cpu.count
                }
              },
              irq: {
                pct: hostMetrics.cpu.usage.irq / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.irq / 100) / hostMetrics.cpu.count
                }
              },
              softirq: {
                pct: hostMetrics.cpu.usage.softirq / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.softirq / 100) / hostMetrics.cpu.count
                }
              },
              steal: {
                pct: hostMetrics.cpu.usage.steal / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.steal / 100) / hostMetrics.cpu.count
                }
              },
              guest: {
                pct: hostMetrics.cpu.usage.guest / 100,
                norm: {
                  pct: (hostMetrics.cpu.usage.guest / 100) / hostMetrics.cpu.count
                }
              },
              total: {
                pct: (100 - hostMetrics.cpu.usage.idle) / 100,
                norm: {
                  pct: ((100 - hostMetrics.cpu.usage.idle) / 100) / hostMetrics.cpu.count
                }
              },
              cores: hostMetrics.cpu.count
            }
          }
        });

        // Load metricset
        const loadDataset = 'system.load';
        documents.push({
          ...baseDoc,
          data_stream: {
            dataset: loadDataset,
            namespace: 'default',
            type: 'metrics'
          },
          event: {
            dataset: loadDataset,
            module: this.getModuleFromDataset(loadDataset)
          },
          metricset: { name: 'load' },
          system: {
            load: {
              '1': hostMetrics.load.load1m,
              '5': hostMetrics.load.load5m,
              '15': hostMetrics.load.load15m,
              norm: {
                '1': hostMetrics.load.load1m / hostMetrics.cpu.count,
                '5': hostMetrics.load.load5m / hostMetrics.cpu.count,
                '15': hostMetrics.load.load15m / hostMetrics.cpu.count
              },
              cores: hostMetrics.cpu.count
            }
          }
        });

        // Memory metricset
        const memoryDataset = 'system.memory';
        documents.push({
          ...baseDoc,
          data_stream: {
            dataset: memoryDataset,
            namespace: 'default',
            type: 'metrics'
          },
          event: {
            dataset: memoryDataset,
            module: this.getModuleFromDataset(memoryDataset)
          },
          metricset: { name: 'memory' },
          system: {
            memory: {
              total: hostMetrics.memory.total,
              used: {
                bytes: hostMetrics.memory.used,
                pct: hostMetrics.memory.usagePercent / 100
              },
              free: hostMetrics.memory.free,
              available: {
                bytes: hostMetrics.memory.available,
                pct: (hostMetrics.memory.available / hostMetrics.memory.total)
              },
              cached: hostMetrics.memory.cached,
              buffered: hostMetrics.memory.buffered,
              actual: {
                used: {
                  bytes: hostMetrics.memory.used - hostMetrics.memory.cached - hostMetrics.memory.buffered,
                  pct: ((hostMetrics.memory.used - hostMetrics.memory.cached - hostMetrics.memory.buffered) / hostMetrics.memory.total)
                },
                free: hostMetrics.memory.available
              }
            }
          }
        });

        // Network metricsets
        const networkDataset = 'system.network';
        hostMetrics.network.forEach(net => {
          documents.push({
            ...baseDoc,
            data_stream: {
              dataset: networkDataset,
              namespace: 'default',
              type: 'metrics'
            },
            event: {
              dataset: networkDataset,
              module: this.getModuleFromDataset(networkDataset)
            },
            metricset: { name: 'network' },
            system: {
              network: {
                name: net.device,
                in: {
                  bytes: net.rxBytes,
                  packets: net.rxPackets,
                  errors: net.rxErrors,
                  dropped: net.rxDropped
                },
                out: {
                  bytes: net.txBytes,
                  packets: net.txPackets,
                  errors: net.txErrors,
                  dropped: net.txDropped
                }
              }
            }
          });
        });

        // Disk IO metricsets
        const diskioDataset = 'system.diskio';
        hostMetrics.diskio.forEach(disk => {
          documents.push({
            ...baseDoc,
            data_stream: {
              dataset: diskioDataset,
              namespace: 'default',
              type: 'metrics'
            },
            event: {
              dataset: diskioDataset,
              module: this.getModuleFromDataset(diskioDataset)
            },
            metricset: { name: 'diskio' },
            system: {
              diskio: {
                name: disk.device,
                read: {
                  bytes: disk.readBytes,
                  count: disk.readOps,
                  time: disk.readTime
                },
                write: {
                  bytes: disk.writeBytes,
                  count: disk.writeOps,
                  time: disk.writeTime
                },
                io: {
                  time: disk.readTime + disk.writeTime
                }
              }
            }
          });
        });

        // Filesystem metricsets
        const filesystemDataset = 'system.filesystem';
        hostMetrics.filesystem.forEach(fs => {
          documents.push({
            ...baseDoc,
            data_stream: {
              dataset: filesystemDataset,
              namespace: 'default',
              type: 'metrics'
            },
            event: {
              dataset: filesystemDataset,
              module: this.getModuleFromDataset(filesystemDataset)
            },
            metricset: { name: 'filesystem' },
            system: {
              filesystem: {
                device_name: fs.device,
                type: fs.filesystem,
                mount_point: fs.mountpoint,
                total: fs.total,
                used: {
                  bytes: fs.used,
                  pct: fs.usagePercent / 100
                },
                available: fs.available,
                free: fs.available,
                files: fs.inodes.total,
                free_files: fs.inodes.free
              }
            }
          });
        });

        // Process metricset
        const processDataset = 'system.process.summary';
        documents.push({
          ...baseDoc,
          data_stream: {
            dataset: processDataset,
            namespace: 'default',
            type: 'metrics'
          },
          event: {
            dataset: processDataset,
            module: this.getModuleFromDataset(processDataset)
          },
          metricset: { name: 'process' },
          system: {
            process: {
              summary: {
                total: hostMetrics.process.count,
                running: hostMetrics.process.running,
                sleeping: hostMetrics.process.sleeping,
                stopped: hostMetrics.process.stopped,
                zombie: hostMetrics.process.zombie,
                idle: 0,
                dead: 0,
                unknown: 0
              }
            }
          }
        });

        span.setStatus({ code: 1 });
        return documents;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private getModuleFromDataset(dataset: string): string {
    return dataset.split('.')[0];
  }

}