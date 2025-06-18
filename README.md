# Simian Forge

A command-line tool for generating synthetic host metrics and sending them to Elasticsearch in both OpenTelemetry and Elastic Metricbeat formats.

## AI Coding Experiment

**Note**: This project was developed as an experiment to evaluate AI coding tools, specifically [Claude Code](https://claude.ai/code). The goal was to create a complete, production-ready tool without writing a single line of code manually - instead relying entirely on AI guidance and code generation.

The experiment successfully demonstrates that AI coding assistants can:
- Understand complex technical requirements and specifications
- Generate comprehensive TypeScript applications with proper architecture
- Implement industry-standard protocols (OpenTelemetry, Elasticsearch APIs)
- Create realistic data simulation with proper statistical distributions
- Handle error cases, logging, and production concerns
- Produce well-documented, maintainable code

This serves as a proof-of-concept for AI-assisted software development workflows and the potential for natural language programming.

## Overview

Simian Forge simulates realistic host metrics including CPU, memory, network, disk I/O, filesystem, and process statistics. It supports generating data in OpenTelemetry format and/or Elastic Metricbeat format, making it ideal for testing monitoring systems, dashboards, and alerting rules.

### Key Features

- **Dual Format Support**: Generate metrics in OpenTelemetry and/or Elastic Metricbeat formats
- **Realistic Data Generation**: Per-core CPU metrics, realistic network/disk patterns, and cloud provider specifics
- **Backfill & Real-time**: Historical data backfill with configurable real-time generation
- **Host Simulation**: Deterministic host configurations with cloud provider details (AWS, GCP, Azure)
- **OpenTelemetry Instrumentation**: Full tracing support with configurable OTLP collector
- **Elasticsearch Integration**: Direct indexing to Elasticsearch with proper data stream routing

## Installation

### Prerequisites

- Node.js 18+ 
- npm
- Elasticsearch cluster (optional, for data storage)
- OpenTelemetry Collector (optional, for trace collection)

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd simian-forge
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Basic Usage

Generate metrics for 5 minutes with default settings:
```bash
npm run start
```

### Command Line Options

```bash
simian-forge [options]

Options:
  --interval <value>           Frequency of data generation (e.g., 30s, 5m) (default: "1m")
  --backfill <value>           How far back to backfill data (e.g., now-1h) (default: "now-5m")
  --dataset <name>             Name of the dataset (default: "hosts")
  --elasticsearch-url <url>    Elasticsearch cluster URL (default: "http://localhost:9200")
  --elasticsearch-auth <auth>  Elasticsearch auth in username:password format (default: "elastic:changeme")
  --collector <url>            OpenTelemetry collector HTTP endpoint (default: "http://localhost:4318")
  --format <format>            Output format: otel, elastic, or both (default: "both")
```

### Example Commands

Generate only OpenTelemetry format metrics:
```bash
npm run start -- --format otel --interval 30s
```

Generate metrics with 1-hour backfill:
```bash
npm run start -- --backfill now-1h --interval 2m
```

Connect to remote Elasticsearch with authentication:
```bash
npm run start -- --elasticsearch-url https://my-cluster.com:9200 --elasticsearch-auth myuser:mypass
```

Generate only Elastic format with custom collector:
```bash
npm run start -- --format elastic --collector http://otel-collector:4318
```

## Data Formats

### OpenTelemetry Format

Generates metrics following OpenTelemetry semantic conventions:

- **Resource Attributes**: Comprehensive host attributes (name, type, arch, IPs, MACs, etc.)
- **Per-Core Metrics**: Individual documents per CPU core with `cpu` and `state` attributes
- **Metric Types**: `system.cpu.utilization`, `system.cpu.time`, `system.memory.usage`, etc.
- **Data Stream**: Routes to `metrics-hostmetricsreceiver.otel-default`

Example document:
```json
{
  "@timestamp": "2025-06-17T15:30:00.000Z",
  "_metric_names_hash": "abc123",
  "data_stream": {
    "dataset": "hostmetricsreceiver.otel",
    "namespace": "default",
    "type": "metrics"
  },
  "resource": {
    "attributes": {
      "host.name": "host-01",
      "host.type": "m5.large",
      "host.arch": "amd64",
      "cloud.provider": "aws"
    }
  },
  "attributes": { "cpu": "0", "state": "user" },
  "metrics": { "system.cpu.utilization": 0.45 },
  "unit": "1"
}
```

### Elastic Metricbeat Format

Generates metrics following Elastic Metricbeat patterns:

- **Metricsets**: `cpu`, `memory`, `load`, `network`, `diskio`, `filesystem`, `process`
- **Normalized Metrics**: Includes `*.norm.pct` fields for CPU metrics
- **Event Classification**: `event.dataset` and `event.module` fields
- **Data Streams**: Routes to `metrics-system.{metricset}-default`

Example document:
```json
{
  "@timestamp": "2025-06-17T15:30:00.000Z",
  "data_stream": {
    "dataset": "system.cpu",
    "namespace": "default",
    "type": "metrics"
  },
  "event": {
    "dataset": "system.cpu",
    "module": "system"
  },
  "system": {
    "cpu": {
      "user": {
        "pct": 0.45,
        "norm": { "pct": 0.225 }
      },
      "cores": 2
    }
  }
}
```

## Development

### Project Structure

```
src/
├── index.ts                 # Main CLI entry point
├── tracing.ts              # OpenTelemetry tracing setup
├── types/
│   ├── host-types.ts       # Host and metrics type definitions
│   └── machine-types.ts    # Cloud machine type specifications
├── simulators/
│   ├── host-simulator.ts   # Main simulator orchestrator
│   ├── host-generator.ts   # Host configuration generator
│   └── metrics-generator.ts # Realistic metrics generation
└── formatters/
    ├── base-formatter.ts   # Common formatter functionality
    ├── otel-formatter.ts   # OpenTelemetry format converter
    └── elastic-formatter.ts # Elastic Metricbeat format converter
```

### Available Scripts

```bash
npm run build    # Compile TypeScript to JavaScript
npm run start    # Run the compiled application
npm run dev      # Build and run the application
```

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Make changes to TypeScript files in `src/`

3. Build and test:
```bash
npm run build
npm run start -- --help
```

### Adding New Metrics

1. Update `HostMetrics` interface in `src/types/host-types.ts`
2. Implement generation logic in `src/simulators/metrics-generator.ts`
3. Add formatting logic to both `src/formatters/otel-formatter.ts` and `src/formatters/elastic-formatter.ts`
4. Test with both formats: `--format both`

### Host Configuration

The tool generates deterministic host configurations including:

- **Machine Types**: Realistic CPU/memory specs for AWS, GCP, Azure instances
- **Network Configuration**: Multiple network interfaces with realistic IPs/MACs
- **Cloud Metadata**: Provider-specific instance IDs, regions, availability zones
- **Disk Configuration**: Multiple filesystems with realistic sizes

All configurations are deterministic based on hostname, ensuring consistent data across runs.

## Testing

### Local Elasticsearch

Start a local Elasticsearch instance:
```bash
docker run -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

Run simian-forge:
```bash
npm run start -- --elasticsearch-url http://localhost:9200
```

### With OpenTelemetry Collector

Example collector configuration:
```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

exporters:
  elasticsearch:
    endpoint: http://elasticsearch:9200

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [elasticsearch]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Submit a pull request

## Author

**Chris Cowan** ([@simianhacker](https://github.com/simianhacker))

*Built with AI assistance from [Claude Code](https://claude.ai/code)*

## License

MIT License