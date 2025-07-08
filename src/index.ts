#!/usr/bin/env node

import { Command } from 'commander';
import { initializeTracing } from './tracing';
import { HostSimulator } from './simulators/host-simulator';
import { WeatherSimulator } from './simulators/weather-simulator';
import { simianLogger } from './logger';
import { trace } from '@opentelemetry/api';
import { Client } from '@elastic/elasticsearch';
import { createElasticsearchClient } from './utils/elasticsearch-client';

const tracer = trace.getTracer('simian-forge');

async function purgeDataStreams(elasticsearchUrl: string, elasticsearchAuth: string, elasticsearchApiKey: string, dataset: string, format?: string): Promise<void> {
  return tracer.startActiveSpan('purgeDataStreams', async (span) => {
    try {
      const client = createElasticsearchClient({
        url: elasticsearchUrl,
        auth: elasticsearchAuth,
        apiKey: elasticsearchApiKey
      });

      const dataStreamsToDelete: string[] = [];

      if (dataset === 'hosts') {
        if (format === 'otel' || format === 'both') {
          dataStreamsToDelete.push('metrics-hostmetricsreceiver.otel-default');
        }
        if (format === 'elastic' || format === 'both') {
          dataStreamsToDelete.push('metrics-system.cpu-default');
          dataStreamsToDelete.push('metrics-system.load-default');
          dataStreamsToDelete.push('metrics-system.memory-default');
          dataStreamsToDelete.push('metrics-system.network-default');
          dataStreamsToDelete.push('metrics-system.diskio-default');
          dataStreamsToDelete.push('metrics-system.filesystem-default');
        }
      } else if (dataset === 'weather') {
        dataStreamsToDelete.push('fieldsense-station-metrics');
      }

      console.log(`Purging data streams for dataset '${dataset}'...`);

      for (const dataStream of dataStreamsToDelete) {
        try {
          await client.indices.deleteDataStream({
            name: dataStream
          });
          console.log(`✓ Deleted data stream: ${dataStream}`);
        } catch (error: any) {
          if (error.meta?.statusCode === 404) {
            console.log(`- Data stream not found (already deleted): ${dataStream}`);
          } else {
            console.warn(`⚠ Failed to delete data stream ${dataStream}:`, error.message);
          }
        }
      }

      console.log('Data stream purge completed.');
      span.setStatus({ code: 1 });
    } catch (error) {
      console.error('Error during data stream purge:', error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}

async function main() {
  return tracer.startActiveSpan('main', async (span) => {
    try {
      const program = new Command();
      
      program
        .name('simian-forge')
        .description('A metric and log generation tool for Elasticsearch')
        .version('1.0.0');

      program
        .option('--interval <value>', 'Frequency of data generation (e.g., 30s, 5m)', '10s')
        .option('--backfill <value>', 'How far back to backfill data (e.g., now-1h)', 'now-5m')
        .option('--count <number>', 'Number of entities to generate', '10')
        .option('--dataset <name>', 'Name of the dataset', 'hosts')
        .option('--elasticsearch-url <url>', 'Elasticsearch cluster URL', 'http://localhost:9200')
        .option('--elasticsearch-auth <auth>', 'Elasticsearch auth in username:password format', 'elastic:changeme')
        .option('--elasticsearch-api-key <key>', 'Elasticsearch API key for authentication', '')
        .option('--collector <url>', 'OpenTelemetry collector HTTP endpoint', 'http://localhost:4318')
        .option('--format <format>', 'Output format: otel, elastic, or both', 'both')
        .option('--purge', 'Delete existing data streams for the dataset before starting');

      program.parse();
      const options = program.opts();

      // Initialize tracing with collector URL
      await initializeTracing(options.collector);
      
      // Initialize logger with Elasticsearch
      simianLogger.initializeElasticsearch(options.elasticsearchUrl, options.elasticsearchAuth, options.elasticsearchApiKey);

      // Validate dataset
      if (!['hosts', 'weather'].includes(options.dataset)) {
        throw new Error(`Unsupported dataset: ${options.dataset}. Supported datasets: 'hosts', 'weather'.`);
      }

      // Validate format (only for hosts dataset)
      if (options.dataset === 'hosts' && !['otel', 'elastic', 'both'].includes(options.format)) {
        throw new Error(`Invalid format: ${options.format}. Must be 'otel', 'elastic', or 'both'.`);
      }

      // Validate count
      const count = parseInt(options.count, 10);
      if (isNaN(count) || count <= 0) {
        throw new Error(`Invalid count: ${options.count}. Must be a positive integer.`);
      }

      console.log('Starting Simian Forge with options:', {
        interval: options.interval,
        backfill: options.backfill,
        count: count,
        dataset: options.dataset,
        elasticsearchUrl: options.elasticsearchUrl,
        format: options.format,
        collector: options.collector,
        purge: options.purge
      });

      // Handle purge if requested
      if (options.purge) {
        await purgeDataStreams(options.elasticsearchUrl, options.elasticsearchAuth, options.elasticsearchApiKey, options.dataset, options.format);
      }

      // Create and start the appropriate simulator
      let simulator: HostSimulator | WeatherSimulator;
      
      if (options.dataset === 'hosts') {
        simulator = new HostSimulator({
          interval: options.interval,
          backfill: options.backfill,
          count: count,
          elasticsearchUrl: options.elasticsearchUrl,
          elasticsearchAuth: options.elasticsearchAuth,
          elasticsearchApiKey: options.elasticsearchApiKey,
          format: options.format as 'otel' | 'elastic' | 'both'
        });
      } else if (options.dataset === 'weather') {
        simulator = new WeatherSimulator({
          interval: options.interval,
          backfill: options.backfill,
          count: count,
          elasticsearchUrl: options.elasticsearchUrl,
          elasticsearchAuth: options.elasticsearchAuth,
          elasticsearchApiKey: options.elasticsearchApiKey
        });
      } else {
        throw new Error(`Unsupported dataset: ${options.dataset}`);
      }

      await simulator.start();
      
      // Cleanup on shutdown
      process.on('SIGINT', async () => {
        console.log('Shutting down...');
        await simianLogger.shutdown();
        process.exit(0);
      });
      
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      console.error('Error:', error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      process.exit(1);
    } finally {
      span.end();
    }
  });
}

if (require.main === module) {
  main().catch(console.error);
}