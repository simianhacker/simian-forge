import { logs as logsApi, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { Client } from '@elastic/elasticsearch';

const logger = logsApi.getLogger('simian-forge', '1.0.0');

interface LogContext {
  functionName?: string;
  spanId?: string;
  traceId?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  attributes?: Record<string, any>;
}

interface OtelLogDocument {
  '@timestamp': string;
  data_stream: {
    dataset: string;
    namespace: string;
    type: string;
  };
  resource: {
    attributes: {
      'service.name': string;
      'service.version': string;
    };
  };
  scope: {
    name: string;
    version: string;
  };
  severity_number: number;
  severity_text: string;
  body: {
    text: string;
  };
  attributes?: Record<string, any>;
  trace_id?: string;
  span_id?: string;
}

class SimianLogger {
  private elasticsearchClient: Client | null = null;
  private logBuffer: OtelLogDocument[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Override console methods to capture logs
    this.interceptConsole();
  }

  public initializeElasticsearch(url: string, auth: string): void {
    const [username, password] = auth.split(':');
    this.elasticsearchClient = new Client({
      node: url,
      auth: {
        username,
        password
      }
    });

    // Start periodic flushing
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 5000); // Flush every 5 seconds
  }

  private interceptConsole(): void {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = (...args: any[]) => {
      originalConsoleLog(...args);
      this.captureLog('info', args.join(' '));
    };

    console.error = (...args: any[]) => {
      originalConsoleError(...args);
      this.captureLog('error', args.join(' '));
    };

    console.warn = (...args: any[]) => {
      originalConsoleWarn(...args);
      this.captureLog('warn', args.join(' '));
    };
  }

  private captureLog(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    const functionName = this.extractFunctionName();

    const logContext: LogContext = {
      functionName,
      spanId: spanContext?.spanId,
      traceId: spanContext?.traceId,
      level,
      message,
      attributes: {
        'function.name': functionName,
        'log.source': 'console'
      }
    };

    // Send to OpenTelemetry logs API
    this.emitOtelLog(logContext);

    // Format for Elasticsearch
    const logDoc = this.formatForElasticsearch(logContext);
    this.logBuffer.push(logDoc);
  }

  private extractFunctionName(): string {
    const stack = new Error().stack;
    if (!stack) return 'unknown';

    const lines = stack.split('\n');
    // Skip Error, captureLog, and console method frames
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];
      if (line && !line.includes('node_modules') && !line.includes('internal/')) {
        const match = line.match(/at\s+([^\s]+)/);
        if (match) {
          return match[1].split('.').pop() || 'unknown';
        }
      }
    }
    return 'unknown';
  }

  private emitOtelLog(logContext: LogContext): void {
    const severityNumber = this.getSeverityNumber(logContext.level);
    
    const attributes = {
      ...(logContext.attributes || {}),
      ...(logContext.spanId && { 'span_id': logContext.spanId }),
      ...(logContext.traceId && { 'trace_id': logContext.traceId })
    };
    
    logger.emit({
      severityNumber,
      severityText: logContext.level.toUpperCase(),
      body: logContext.message,
      attributes,
      timestamp: Date.now()
    });
  }

  private getSeverityNumber(level: string): SeverityNumber {
    switch (level) {
      case 'debug': return SeverityNumber.DEBUG;
      case 'info': return SeverityNumber.INFO;
      case 'warn': return SeverityNumber.WARN;
      case 'error': return SeverityNumber.ERROR;
      default: return SeverityNumber.INFO;
    }
  }

  private formatForElasticsearch(logContext: LogContext): OtelLogDocument {
    const timestamp = new Date().toISOString();
    
    return {
      '@timestamp': timestamp,
      data_stream: {
        dataset: 'simian_forge.otel',
        namespace: 'default',
        type: 'logs'
      },
      resource: {
        attributes: {
          'service.name': 'simian-forge',
          'service.version': '1.0.0'
        }
      },
      scope: {
        name: 'simian-forge',
        version: '1.0.0'
      },
      severity_number: this.getSeverityNumber(logContext.level),
      severity_text: logContext.level.toUpperCase(),
      body: {
        text: logContext.message
      },
      attributes: logContext.attributes,
      trace_id: logContext.traceId,
      span_id: logContext.spanId
    };
  }

  private async flushLogs(): Promise<void> {
    if (!this.elasticsearchClient || this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const body = logs.flatMap(log => [
        { create: { _index: `logs-${log.data_stream.dataset}-${log.data_stream.namespace}` } },
        log
      ]);

      await this.elasticsearchClient.bulk({ body });
    } catch (error) {
      // Use original console.error to avoid infinite loop
      process.stderr.write(`Failed to ship logs to Elasticsearch: ${error}\n`);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logs);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flushLogs();
  }
}

export const simianLogger = new SimianLogger();