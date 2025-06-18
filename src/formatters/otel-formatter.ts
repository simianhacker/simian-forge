import { HostMetrics } from '../types/host-types';
import { trace } from '@opentelemetry/api';
import { BaseFormatter } from './base-formatter';
import * as fnv from 'fnv-plus';

const tracer = trace.getTracer('simian-forge');

export interface OtelDocument {
  '@timestamp': string;
  _metric_names_hash: string;
  data_stream: {
    dataset: string;
    namespace: string;
    type: string;
  };
  resource: {
    attributes: {
      'host.name': string;
      'host.type': string;
      'host.arch': string;
      'host.id': string;
      'host.ip': string[];
      'host.mac': string[];
      'host.image.id': string;
      'host.image.name': string;
      'host.image.version': string;
      'cloud.provider': string;
      'cloud.region': string;
      'cloud.availability_zone': string;
      'cloud.instance.id': string;
      'cloud.instance.type': string;
    };
  };
  attributes?: Record<string, string | number>;
  scope: {
    name: string;
    version: string;
  };
  metrics: Record<string, number>;
  unit: string;
  start_timestamp: string;
}

export class OtelFormatter extends BaseFormatter {
  formatMetrics(hostMetrics: HostMetrics): OtelDocument[] {
    return tracer.startActiveSpan('formatMetrics', (span) => {
      try {
        const timestamp = hostMetrics.timestamp.toISOString();
        const documents: OtelDocument[] = [];

        const baseResource = {
          attributes: {
            'host.name': hostMetrics.host.name,
            'host.type': hostMetrics.host.machineType,
            'host.arch': 'amd64',
            'host.id': this.generateHostId(hostMetrics.host.name),
            'host.ip': this.generateHostIPs(hostMetrics.host.name),
            'host.mac': this.generateHostMACs(hostMetrics.host.name),
            'host.image.id': this.generateImageId(hostMetrics.host.cloud.provider),
            'host.image.name': this.generateImageName(hostMetrics.host.cloud.provider),
            'host.image.version': '20.04.6',
            'cloud.provider': hostMetrics.host.cloud.provider,
            'cloud.region': hostMetrics.host.cloud.region,
            'cloud.availability_zone': hostMetrics.host.cloud.availabilityZone,
            'cloud.instance.id': hostMetrics.host.cloud.instanceId,
            'cloud.instance.type': hostMetrics.host.cloud.instanceType
          }
        };

        const baseScope = {
          name: 'simian-forge',
          version: '0.0.1'
        };

        const baseDataStream = {
          dataset: 'hostmetricsreceiver.otel',
          namespace: 'default',
          type: 'metrics'
        };

        // CPU utilization metrics - per core
        hostMetrics.cpu.perCoreUsage.forEach(coreUsage => {
          Object.entries(coreUsage).forEach(([state, value]) => {
            if (state !== 'core') {
              const metrics = { 'system.cpu.utilization': value / 100 };
              documents.push({
                '@timestamp': timestamp,
                _metric_names_hash: this.generateMetricNamesHash(metrics),
                data_stream: baseDataStream,
                resource: baseResource,
                attributes: { 
                  cpu: coreUsage.core.toString(),
                  state 
                },
                scope: baseScope,
                metrics,
                unit: '1',
                start_timestamp: timestamp
              });
            }
          });
        });

        // CPU time metrics - per logical CPU (cumulative counters)
        hostMetrics.cpu.perCoreUsage.forEach(coreUsage => {
          Object.entries(coreUsage).forEach(([state, _]) => {
            if (state !== 'core') {
              // Get the actual cumulative counter value
              const counterKey = `cpu_time_${coreUsage.core}_${state}`;
              const cumulativeSeconds = hostMetrics.counters[counterKey] || 0;
              
              const metrics = { 'system.cpu.time': cumulativeSeconds };
              documents.push({
                '@timestamp': timestamp,
                _metric_names_hash: this.generateMetricNamesHash(metrics),
                data_stream: baseDataStream,
                resource: baseResource,
                attributes: { 
                  cpu: coreUsage.core.toString(),
                  state: state === 'iowait' ? 'wait' : state // Map iowait to wait as per OTel spec
                },
                scope: baseScope,
                metrics,
                unit: 's',
                start_timestamp: timestamp
              });
            }
          });
        });

        // CPU count
        const cpuCountMetrics = { 'system.cpu.logical.count': hostMetrics.cpu.count };
        documents.push({
          '@timestamp': timestamp,
          _metric_names_hash: this.generateMetricNamesHash(cpuCountMetrics),
          data_stream: baseDataStream,
          resource: baseResource,
          scope: baseScope,
          metrics: cpuCountMetrics,
          unit: '1',
          start_timestamp: timestamp
        });

        // Load averages
        const load1mMetrics = { 'system.cpu.load_average.1m': hostMetrics.load.load1m };
        const load5mMetrics = { 'system.cpu.load_average.5m': hostMetrics.load.load5m };
        const load15mMetrics = { 'system.cpu.load_average.15m': hostMetrics.load.load15m };
        
        documents.push(
          {
            '@timestamp': timestamp,
            _metric_names_hash: this.generateMetricNamesHash(load1mMetrics),
            data_stream: baseDataStream,
            resource: baseResource,
            scope: baseScope,
            metrics: load1mMetrics,
            unit: '1',
            start_timestamp: timestamp
          },
          {
            '@timestamp': timestamp,
            _metric_names_hash: this.generateMetricNamesHash(load5mMetrics),
            data_stream: baseDataStream,
            resource: baseResource,
            scope: baseScope,
            metrics: load5mMetrics,
            unit: '1',
            start_timestamp: timestamp
          },
          {
            '@timestamp': timestamp,
            _metric_names_hash: this.generateMetricNamesHash(load15mMetrics),
            data_stream: baseDataStream,
            resource: baseResource,
            scope: baseScope,
            metrics: load15mMetrics,
            unit: '1',
            start_timestamp: timestamp
          }
        );

        // Memory usage by state
        const memoryStates = {
          used: hostMetrics.memory.used,
          free: hostMetrics.memory.free,
          cached: hostMetrics.memory.cached,
          buffered: hostMetrics.memory.buffered
        };

        Object.entries(memoryStates).forEach(([state, value]) => {
          const metrics = { 'system.memory.usage': value };
          documents.push({
            '@timestamp': timestamp,
            _metric_names_hash: this.generateMetricNamesHash(metrics),
            data_stream: baseDataStream,
            resource: baseResource,
            attributes: { state },
            scope: baseScope,
            metrics,
            unit: 'By',
            start_timestamp: timestamp
          });
        });

        // Memory utilization
        const memoryUtilMetrics = { 'system.memory.utilization': hostMetrics.memory.usagePercent / 100 };
        documents.push({
          '@timestamp': timestamp,
          _metric_names_hash: this.generateMetricNamesHash(memoryUtilMetrics),
          data_stream: baseDataStream,
          resource: baseResource,
          scope: baseScope,
          metrics: memoryUtilMetrics,
          unit: '1',
          start_timestamp: timestamp
        });

        // Network metrics
        hostMetrics.network.forEach(net => {
          // Network IO bytes
          const netRxMetrics = { 'system.network.io': net.rxBytes };
          const netTxMetrics = { 'system.network.io': net.txBytes };
          
          documents.push(
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(netRxMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: { device: net.device, direction: 'receive' },
              scope: baseScope,
              metrics: netRxMetrics,
              unit: 'By',
              start_timestamp: timestamp
            },
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(netTxMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: { device: net.device, direction: 'transmit' },
              scope: baseScope,
              metrics: netTxMetrics,
              unit: 'By',
              start_timestamp: timestamp
            }
          );

          // Network packets
          const netRxPktsMetrics = { 'system.network.packets': net.rxPackets };
          const netTxPktsMetrics = { 'system.network.packets': net.txPackets };
          
          documents.push(
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(netRxPktsMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: { device: net.device, direction: 'receive' },
              scope: baseScope,
              metrics: netRxPktsMetrics,
              unit: '{packet}',
              start_timestamp: timestamp
            },
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(netTxPktsMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: { device: net.device, direction: 'transmit' },
              scope: baseScope,
              metrics: netTxPktsMetrics,
              unit: '{packet}',
              start_timestamp: timestamp
            }
          );
        });

        // Disk IO metrics
        hostMetrics.diskio.forEach(disk => {
          const diskReadMetrics = { 'system.disk.io': disk.readBytes };
          const diskWriteMetrics = { 'system.disk.io': disk.writeBytes };
          
          documents.push(
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(diskReadMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: { device: disk.device, direction: 'read' },
              scope: baseScope,
              metrics: diskReadMetrics,
              unit: 'By',
              start_timestamp: timestamp
            },
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(diskWriteMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: { device: disk.device, direction: 'write' },
              scope: baseScope,
              metrics: diskWriteMetrics,
              unit: 'By',
              start_timestamp: timestamp
            }
          );
        });

        // Filesystem metrics
        hostMetrics.filesystem.forEach(fs => {
          // Filesystem usage by state
          const fsUsedMetrics = { 'system.filesystem.usage': fs.used };
          const fsFreeMetrics = { 'system.filesystem.usage': fs.available };
          
          documents.push(
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(fsUsedMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: {
                device: fs.device,
                mountpoint: fs.mountpoint,
                type: fs.filesystem,
                state: 'used'
              },
              scope: baseScope,
              metrics: fsUsedMetrics,
              unit: 'By',
              start_timestamp: timestamp
            },
            {
              '@timestamp': timestamp,
              _metric_names_hash: this.generateMetricNamesHash(fsFreeMetrics),
              data_stream: baseDataStream,
              resource: baseResource,
              attributes: {
                device: fs.device,
                mountpoint: fs.mountpoint,
                type: fs.filesystem,
                state: 'free'
              },
              scope: baseScope,
              metrics: fsFreeMetrics,
              unit: 'By',
              start_timestamp: timestamp
            }
          );

          // Filesystem utilization
          const fsUtilMetrics = { 'system.filesystem.utilization': fs.usagePercent / 100 };
          documents.push({
            '@timestamp': timestamp,
            _metric_names_hash: this.generateMetricNamesHash(fsUtilMetrics),
            data_stream: baseDataStream,
            resource: baseResource,
            attributes: {
              device: fs.device,
              mountpoint: fs.mountpoint,
              type: fs.filesystem
            },
            scope: baseScope,
            metrics: fsUtilMetrics,
            unit: '1',
            start_timestamp: timestamp
          });
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

  private generateMetricNamesHash(metrics: Record<string, number>): string {
    const metricNames = Object.keys(metrics);
    return fnv.hash(metricNames.join(), 32).str();
  }

}
