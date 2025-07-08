# Simian Forge

A command-line tool for generating synthetic data and sending it to Elasticsearch. Supports both host metrics (OpenTelemetry and Elastic Metricbeat formats) and weather station data (FieldSense format).

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

Simian Forge simulates realistic synthetic data for Elasticsearch, supporting two main datasets:

1. **Host Metrics**: CPU, memory, network, disk I/O, filesystem, and process statistics in OpenTelemetry and/or Elastic Metricbeat formats
2. **Weather Station Data**: Environmental sensors, solar panels, energy consumption, and system metrics in FieldSense format

This makes it ideal for testing monitoring systems, dashboards, alerting rules, and time series visualizations.

### Key Features

- **Multiple Datasets**: Host metrics and weather station data generation
- **Format Support**: OpenTelemetry, Elastic Metricbeat, and FieldSense formats
- **Realistic Data Generation**: Correlated metrics, smooth transitions, and realistic patterns
- **Backfill & Real-time**: Historical data backfill with configurable real-time generation
- **Time Series Support**: Elasticsearch time series data streams with proper routing
- **Cloud Provider Simulation**: Deterministic configurations with AWS, GCP, Azure specifics
- **OpenTelemetry Instrumentation**: Full tracing support with configurable OTLP collector
- **Development Tools**: Data stream purging for schema changes and fresh starts

## Installation

### Prerequisites

- Docker (recommended)
- OR Node.js 18+ and npm for local development
- Elasticsearch cluster (optional, included in Docker Compose)
- OpenTelemetry Collector (optional, included in Docker Compose)
- **Kibana Setup**: Before indexing data, go to "Integrations" in Kibana and install the "System" integration to ensure proper index templates and mappings are configured

### Docker Setup (Recommended)

The easiest way to get started is with Docker, which provides a complete testing environment:

1. Clone the repository:
```bash
git clone <repository-url>
cd simian-forge
```

2. Build the Docker image:
```bash
docker build -t simianhacker/simian-forge:latest .
```

3. Run with Docker Compose (includes Elasticsearch, Kibana, and OpenTelemetry):
```bash
# Start the full stack
docker compose --profile full-stack up -d

# View logs
docker compose logs -f simian-forge

# Stop the stack
docker compose --profile full-stack down
```

### Local Development Setup

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

### Docker Usage (Recommended)

#### Using Docker Compose

The easiest way to get started with a complete testing environment:

```bash
# Start with default settings
docker compose --profile full-stack up -d

# Customize with environment variables
INTERVAL=30s COUNT=20 FORMAT=otel docker compose --profile full-stack up -d

# Run one-time data generation
docker compose run --rm simian-forge --purge --backfill now-2h

# Connect to external Elasticsearch
ELASTICSEARCH_URL=https://my-cluster.com:9200 \
ELASTICSEARCH_AUTH=myuser:mypass \
docker compose --profile full-stack up -d
```

#### Using Docker Directly

Run the container directly (bring your own Elasticsearch):

```bash
# Basic usage
docker run --rm simianhacker/simian-forge:latest \
  --elasticsearch-url http://your-elasticsearch:9200 \
  --elasticsearch-auth elastic:yourpassword \
  --count 5 --interval 30s

# Generate weather data
docker run --rm simianhacker/simian-forge:latest \
  --dataset weather \
  --count 3 \
  --interval 1m \
  --elasticsearch-url http://your-elasticsearch:9200

# Connect to external services
docker run --rm simianhacker/simian-forge:latest \
  --elasticsearch-url https://my-cluster.com:9200 \
  --elasticsearch-auth myuser:mypass \
  --collector http://my-collector:4318 \
  --format otel
```

### Docker Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
# Edit .env file with your preferred settings
docker compose --profile full-stack up -d
```

### Local Usage

Generate metrics for 5 minutes with default settings:
```bash
./forge
```

### Command Line Options

```bash
simian-forge [options]

Options:
  --interval <value>           Frequency of data generation (e.g., 30s, 5m) (default: "10s")
  --backfill <value>           How far back to backfill data (e.g., now-1h) (default: "now-5m")
  --count <number>             Number of entities to generate (default: "10")
  --dataset <name>             Name of the dataset: hosts, weather (default: "hosts")
  --elasticsearch-url <url>    Elasticsearch cluster URL (default: "http://localhost:9200")
  --elasticsearch-auth <auth>  Elasticsearch auth in username:password format (default: "elastic:changeme")
  --collector <url>            OpenTelemetry collector HTTP endpoint (default: "http://localhost:4318")
  --format <format>            Output format: otel, elastic, or both (hosts only) (default: "both")
  --purge                      Delete existing data streams for the dataset before starting
```

### Example Commands

#### Host Metrics

Generate only OpenTelemetry format metrics:
```bash
./forge --dataset hosts --format otel --interval 30s
```

Generate metrics with 1-hour backfill:
```bash
./forge --dataset hosts --backfill now-1h --interval 2m
```

Generate metrics for 25 hosts with custom interval:
```bash
./forge --dataset hosts --count 25 --interval 30s
```

Purge existing data and start fresh:
```bash
./forge --dataset hosts --purge --format both
```

#### Weather Station Data

Generate weather station data with 5 stations:
```bash
./forge --dataset weather --count 5 --interval 1m
```

Generate weather data with 24-hour backfill:
```bash
./forge --dataset weather --backfill now-24h --interval 10s
```

Purge existing weather data and start fresh:
```bash
./forge --dataset weather --purge --count 3 --backfill now-12h
```

#### General Options

Connect to remote Elasticsearch with authentication:
```bash
./forge --elasticsearch-url https://my-cluster.com:9200 --elasticsearch-auth myuser:mypass
```

Generate with custom OpenTelemetry collector:
```bash
./forge --collector http://otel-collector:4318
```

## Data Formats

### Weather Station Data (FieldSense Format)

Generates comprehensive weather station metrics in FieldSense namespace:

- **Environmental Metrics**: Temperature, humidity, wind, precipitation, pressure, solar radiation, soil conditions
- **Solar Panel Metrics**: Individual panel voltage, current, power, temperature, and efficiency
- **Energy Metrics**: Consumption, production, and battery status
- **System Metrics**: CPU usage, memory, network traffic
- **Time Series Support**: Proper geo_point coordinates and time series dimensions
- **Data Stream**: Routes to `fieldsense-station-metrics`

Example document:
```json
{
  "@timestamp": "2025-01-08T15:30:00.000Z",
  "_metric_names_hash": "def456",
  "station.id": "station-01",
  "station.name": "FieldSense Station 01",
  "station.location.coordinates": {
    "lat": 40.7128,
    "lon": -74.0060
  },
  "station.location.region": "us-east-1",
  "sensor.id": "temperature-1",
  "sensor.type": "temperature",
  "sensor.location": "ambient",
  "fieldsense.environmental.temperature.air": 22.5,
  "fieldsense.environmental.temperature.dewpoint": 18.3
}
```

Key features:
- **Realistic Correlations**: Cloudy weather reduces solar output, temperature affects soil conditions
- **Smooth Transitions**: Weather changes gradually with proper smoothing algorithms
- **Geo-spatial Support**: Coordinates stored as geo_point for mapping and spatial queries
- **Comprehensive Coverage**: 24+ different metric types per station
- **Time Series Optimized**: Proper dimensions and metric routing for long-term storage

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
├── index.ts                      # Main CLI entry point
├── tracing.ts                   # OpenTelemetry tracing setup
├── types/
│   ├── host-types.ts            # Host and metrics type definitions
│   ├── machine-types.ts         # Cloud machine type specifications
│   └── weather-types.ts         # Weather station type definitions
├── simulators/
│   ├── host-simulator.ts        # Host metrics simulator orchestrator
│   ├── host-generator.ts        # Host configuration generator
│   ├── metrics-generator.ts     # Host metrics generation
│   ├── weather-simulator.ts     # Weather station simulator orchestrator
│   ├── weather-generator.ts     # Weather station configuration generator
│   └── weather-metrics-generator.ts # Weather metrics generation
└── formatters/
    ├── base-formatter.ts        # Common formatter functionality
    ├── otel-formatter.ts        # OpenTelemetry format converter
    ├── elastic-formatter.ts     # Elastic Metricbeat format converter
    └── fieldsense-formatter.ts  # FieldSense weather format converter
```

### Available Scripts

```bash
npm run build    # Compile TypeScript to JavaScript
npm run start    # Run the compiled application (use ./forge for easier CLI)
npm run dev      # Build and run the application
./forge          # Convenient wrapper for npm run start
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
./forge --help
```

### Development Workflow

When making schema changes or testing new features, use the `--purge` option to delete existing data streams and start fresh:

```bash
# Purge and restart with hosts data
./forge --dataset hosts --purge --format both

# Purge and restart with weather data
./forge --dataset weather --purge --count 3 --backfill now-6h

# Purge specific format for hosts
./forge --dataset hosts --format otel --purge
```

This ensures clean data streams with updated mappings and templates.

### Adding New Metrics

#### For Host Metrics:
1. Update `HostMetrics` interface in `src/types/host-types.ts`
2. Implement generation logic in `src/simulators/metrics-generator.ts`
3. Add formatting logic to both `src/formatters/otel-formatter.ts` and `src/formatters/elastic-formatter.ts`
4. Test with both formats: `--format both`

#### For Weather Station Metrics:
1. Update `WeatherStationMetrics` interface in `src/types/weather-types.ts`
2. Implement generation logic in `src/simulators/weather-metrics-generator.ts`
3. Add formatting logic to `src/formatters/fieldsense-formatter.ts`
4. Update Elasticsearch mappings in `src/simulators/weather-simulator.ts`
5. Test with: `--dataset weather --purge`

### Host Configuration

The tool generates deterministic host configurations including:

- **Machine Types**: Realistic CPU/memory specs for AWS, GCP, Azure instances
- **Network Configuration**: Multiple network interfaces with realistic IPs/MACs
- **Cloud Metadata**: Provider-specific instance IDs, regions, availability zones
- **Disk Configuration**: Multiple filesystems with realistic sizes

All configurations are deterministic based on hostname, ensuring consistent data across runs.

## Testing

### Docker Compose Testing Environment

The included Docker Compose setup provides a complete testing environment:

```bash
# Start full stack (Elasticsearch, Kibana, OpenTelemetry Collector, Simian Forge)
docker compose --profile full-stack up -d

# Access services
# Elasticsearch: http://localhost:9200
# Kibana: http://localhost:5601
# OpenTelemetry Collector: http://localhost:4318

# View generated data in Kibana
# Go to http://localhost:5601 and explore the data streams

# Stop the stack
docker compose --profile full-stack down
```

### Docker Environment Variables

Configure the Docker Compose setup with environment variables:

```bash
# Create environment file
cp .env.example .env

# Example configurations in .env:
INTERVAL=15s
COUNT=25
DATASET=hosts
FORMAT=both
BACKFILL=now-1h
ELASTICSEARCH_PORT=9200
KIBANA_PORT=5601
```

### Integration with Existing Docker Compose

Add Simian Forge to your existing Docker Compose setup:

```yaml
version: '3.8'
services:
  # Your existing services...
  
  data-generator:
    image: simianhacker/simian-forge:latest
    environment:
      - ELASTICSEARCH_URL=http://elasticsearch:9200
      - COLLECTOR=http://otel-collector:4318
      - INTERVAL=10s
      - COUNT=15
      - DATASET=hosts
      - FORMAT=both
    command: [
      "--elasticsearch-url", "${ELASTICSEARCH_URL}",
      "--collector", "${COLLECTOR}",
      "--interval", "${INTERVAL}",
      "--count", "${COUNT}",
      "--dataset", "${DATASET}",
      "--format", "${FORMAT}"
    ]
    depends_on:
      - elasticsearch
    networks:
      - your-network
```

### Local Testing

#### Local Elasticsearch

Start a local Elasticsearch instance:
```bash
docker run -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.13.0
```

Run simian-forge:
```bash
./forge --elasticsearch-url http://localhost:9200
```

#### With OpenTelemetry Collector

The included `otel-collector-config.yaml` provides a complete OpenTelemetry Collector configuration that exports to Elasticsearch:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  elasticsearch/traces:
    endpoints: ["http://elasticsearch:9200"]
    traces_index: traces-simian-forge
  elasticsearch/logs:
    endpoints: ["http://elasticsearch:9200"]
    logs_index: logs-simian-forge
  elasticsearch/metrics:
    endpoints: ["http://elasticsearch:9200"]
    metrics_index: metrics-simian-forge

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [elasticsearch/traces]
    logs:
      receivers: [otlp]
      exporters: [elasticsearch/logs]
    metrics:
      receivers: [otlp]
      exporters: [elasticsearch/metrics]
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