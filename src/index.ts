#!/usr/bin/env node

import { Command } from 'commander';
import { initializeTracing } from './tracing';
import { HostSimulator } from './simulators/host-simulator';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('simian-forge');

async function main() {
  return tracer.startActiveSpan('main', async (span) => {
    try {
      const program = new Command();
      
      program
        .name('simian-forge')
        .description('A metric and log generation tool for Elasticsearch')
        .version('1.0.0');

      program
        .option('--interval <value>', 'Frequency of data generation (e.g., 30s, 5m)', '1m')
        .option('--backfill <value>', 'How far back to backfill data (e.g., now-1h)', 'now-5m')
        .option('--dataset <name>', 'Name of the dataset', 'hosts')
        .option('--elasticsearch-url <url>', 'Elasticsearch cluster URL', 'http://localhost:9200')
        .option('--elasticsearch-auth <auth>', 'Elasticsearch auth in username:password format', 'elastic:changeme')
        .option('--collector <url>', 'OpenTelemetry collector HTTP endpoint', 'http://localhost:4318')
        .option('--format <format>', 'Output format: otel, elastic, or both', 'both');

      program.parse();
      const options = program.opts();

      // Initialize tracing with collector URL
      await initializeTracing(options.collector);

      // Validate dataset
      if (options.dataset !== 'hosts') {
        throw new Error(`Unsupported dataset: ${options.dataset}. Currently only 'hosts' is supported.`);
      }

      // Validate format
      if (!['otel', 'elastic', 'both'].includes(options.format)) {
        throw new Error(`Invalid format: ${options.format}. Must be 'otel', 'elastic', or 'both'.`);
      }

      console.log('Starting Simian Forge with options:', {
        interval: options.interval,
        backfill: options.backfill,
        dataset: options.dataset,
        elasticsearchUrl: options.elasticsearchUrl,
        format: options.format,
        collector: options.collector
      });

      // Create and start the host simulator
      const simulator = new HostSimulator({
        interval: options.interval,
        backfill: options.backfill,
        elasticsearchUrl: options.elasticsearchUrl,
        elasticsearchAuth: options.elasticsearchAuth,
        format: options.format as 'otel' | 'elastic' | 'both'
      });

      await simulator.start();
      
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