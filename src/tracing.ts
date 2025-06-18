import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

export async function initializeTracing(collectorUrl: string): Promise<void> {
  return trace.getTracer('simian-forge').startActiveSpan('initializeTracing', async (span) => {
    try {
      // Configure OTLP exporter
      const traceExporter = new OTLPTraceExporter({
        url: `${collectorUrl}/v1/traces`,
        headers: {},
      });

      // Initialize the SDK
      sdk = new NodeSDK({
        traceExporter,
        instrumentations: [getNodeAutoInstrumentations()],
      });

      // Start the SDK
      sdk.start();
      
      console.log('OpenTelemetry tracing initialized successfully');
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
      if (sdk) {
        await sdk.shutdown();
        console.log('OpenTelemetry tracing shut down successfully');
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