import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { trace } from '@opentelemetry/api';
import { logs as logsApi } from '@opentelemetry/api-logs';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';

let sdk: NodeSDK | null = null;
let loggerProvider: LoggerProvider | null = null;

export async function initializeTracing(collectorUrl: string): Promise<void> {
  return trace.getTracer('simian-forge').startActiveSpan('initializeTracing', async (span) => {
    try {
      // Configure OTLP exporters
      const traceExporter = new OTLPTraceExporter({
        url: `${collectorUrl}/v1/traces`,
        headers: {},
      });

      const logExporter = new OTLPLogExporter({
        url: `${collectorUrl}/v1/logs`,
        headers: {},
      });

      // Initialize logs provider
      loggerProvider = new LoggerProvider();
      loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(logExporter));
      logsApi.setGlobalLoggerProvider(loggerProvider);

      // Initialize the SDK
      sdk = new NodeSDK({
        traceExporter,
        instrumentations: [getNodeAutoInstrumentations()],
      });

      // Start the SDK
      sdk.start();
      
      console.log('OpenTelemetry tracing and logging initialized successfully');
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      console.error('Failed to initialize OpenTelemetry tracing:', error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  });
}

export async function shutdownTracing(): Promise<void> {
  return trace.getTracer('simian-forge').startActiveSpan('shutdownTracing', async (span) => {
    try {
      if (loggerProvider) {
        await loggerProvider.shutdown();
      }
      if (sdk) {
        await sdk.shutdown();
        console.log('OpenTelemetry tracing and logging shut down successfully');
      }
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      console.error('Failed to shutdown OpenTelemetry tracing:', error);
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: (error as Error).message }); // ERROR
    } finally {
      span.end();
    }
  });
}