# Project Memory - Simian Forge

## Project Overview
A metric and log generation tool for Elasticsearch

## Prompt
I want to create a command line tool to genreate synthetic data and insert it into
Elasticsearch.

Requirements:
- The application should be instrumented with Otel for traces and sent to an Otel Collector
- The application logs should be in OTLP format and sent to Elasticsearch and the console
- Each function should be wrapped in a `startActiveSpan` from the Otel Node SDK with the function name used for the span name
- The command line should support:
  - `--interval` controls the frequency of the data in `{value}{unit}`, units is either `s` for seconds and `m` for minutes.
  - `--backfill` controls how far back the data should backfill, uses date math like `now-1h`
  - `--count` controls the number of entities to generate (default: 10)
  - `--dataset` the name of the dataset
  - `--elasticsearch-url` the url of the Elasticsearch cluster
  - `--elasticsearch-auth` the username and password in `{username}:{password}` format
  - `--collector` the HTTP address for the Otel Collector for application traces and logs
  - `--format` `otel` or `elastic` or `both`
- The simulator should support multiple types of datasets. Start with a host simulator but plan to expand into Kubernetes.
- The first dataset should be a host simulator
  - This should have the option to output Open Telemtry Host metric reciever metrics
  - This should have the option to output Elastic Metricbeat metrics
  - This should have the option to output both. In this mode `host.name` should have a way to distinguish which format.
  - When the format is `both` the metrics should match. For example, `1m` load for Otel should be exactly the same for Metricbeat.
  - Both formats should support the following metricsets: cpu, load, memory, diskio, filesystem, network, process
  - When generating the metrics they should include details about the host and cloud environments
  - The host and cloud enviroments should be consistent for each host across all metrics. For example, if `host-01` should always be in the same availability zone and have the same machine type.
  - When generating the metrics, it should use the machine type so the metrics would look realistic. For example, if the machine type is `m5.large` then it should have 2 virtual cores, 1 physical core, and 8GB ram. The total memory should equal the same amount of ram, etc...
  - Anything in the Otel or Metricbeat format that's a counter should be a unique counter per the dimensions of the metric. For example, `system.network.io` should have 2 attributes, `direction` and `device`, and the counter should be unique per set of attributes.
  - Counters should reset when they reach `Number.MAX_SAFE_INTEGER`
  - When creating the simulated data, create an intermediay data structure that can be converted into both.
  - The name of this dataset should be `hosts`
  - The script should start with backfilling the data, then once it catches up, it should emit a new set of metrics on the interval

## Development Preferences
- Follow existing code conventions and patterns
- Use appropriate testing frameworks when available
- Run lint and typecheck commands before completing tasks
- Be concise in responses unless detail is requested

## Common Commands
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled application
- `npm run dev` - Build and run the application
- `npm run test-logger` - Test logger functionality

## Git Workflows

### Making Changes
1. Make code changes to implement features or fix issues
2. Build and test: `npm run build && npm run test-logger`
3. Add files: `git add <files>`
4. When user says "Commit changes", create commit AND push automatically:
   ```bash
   git commit -m "$(cat <<'EOF'
   Brief description of changes
   
   - Detailed bullet points of what was changed
   - Include technical details and reasoning
   - Mention any breaking changes or compatibility updates
   
   Prompt: "[Include the original user request/prompt that led to these changes]"
   
   🤖 Generated with [Claude Code](https://claude.ai/code)
   
   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```
5. Automatically push to GitHub: `git push origin main`

### Commit Message Guidelines
- Start with imperative verb (Add, Update, Fix, Remove)
- Include detailed bullet points explaining changes
- **Always include the original user prompt** that led to the changes in a "Prompt:" section
- Always include Claude Code attribution footer
- Use HEREDOC format for multi-line messages to ensure proper formatting

### Branch Management
- Main branch: `main` - production-ready code
- All development happens directly on main for this experimental project
- Each logical feature/fix gets its own commit with detailed message

## Project Structure
- `src/` - TypeScript source code
  - `index.ts` - Main CLI entry point
  - `tracing.ts` - OpenTelemetry tracing setup
  - `types/` - TypeScript type definitions
    - `host-types.ts` - Host and metrics type definitions
    - `machine-types.ts` - Cloud machine type specifications
  - `simulators/` - Data generation logic
    - `host-simulator.ts` - Main simulator orchestrator
    - `host-generator.ts` - Host configuration generator
    - `metrics-generator.ts` - Realistic metrics generation
  - `formatters/` - Output format converters
    - `base-formatter.ts` - Common formatter functionality
    - `otel-formatter.ts` - OpenTelemetry format converter
    - `elastic-formatter.ts` - Elastic Metricbeat format converter
  - `logger.ts` - Console log shipping to Elasticsearch
- `dist/` - Compiled JavaScript output

## Notes
- CPU states aligned with OpenTelemetry spec: idle, interrupt, nice, softirq, steal, system, user, wait
- Metricbeat CPU states mapped from OTel: idle, irq, nice, softirq, steal, system, user, iowait, total
- Log shipping uses dataset `simian_forge.otel` with OpenTelemetry format
- Memory metrics include all required OTel states: buffered, cached, inactive, free, slab_reclaimable, slab_unreclaimable, used
