# Deterministic randomness (remove `Math.random`)

## Status
ready

## Context
- **Problem**: The repo still uses `Math.random()` in a couple places, which makes runs non-reproducible and complicates debugging/comparisons (same CLI inputs can generate different output).
- **Scope**: Remove all `Math.random()` usage in `src/` by switching to deterministic selection/value generation based on existing hashing/seed utilities.
- **Constraints**:
  - No new dependencies.
  - No breaking CLI changes.
  - Preserve output schema (field names/types); only value selection should become deterministic.
- **Repo touchpoints**:
  - `src/simulators/unique-metrics-metrics-generator.ts`
  - `src/formatters/base-formatter.ts`
  - `src/utils/hash.ts` (existing `hashString`, `seededRandom`)
  - Verification commands: `npm run build`, `rg "Math\\.random" src`
- **Formats impacted**: otel
- **Definition of done**:
  - `npm run build` succeeds
  - `rg "Math\\.random" src` returns no matches
  - Running `./forge --dataset unique-metrics --count 5 --backfill now-1m --no-realtime` twice produces identical metric values for the same timestamps (spot-check via logs or by temporarily indexing into a fresh cluster)

## Tasks
- [ ] 1) Make `unique-metrics` values deterministic (owner: agent)
  - **Change**: Replace `Math.random()` in `UniqueMetricsMetricsGenerator.generateMetrics()` with a deterministic value using `seededRandom()` seeded by `(config.id, metric name, timestamp)` so values vary over time but are repeatable for the same inputs.
  - **Files**: `src/simulators/unique-metrics-metrics-generator.ts`
  - **Acceptance**:
    - `rg "Math\\.random" src/simulators/unique-metrics-metrics-generator.ts` returns no matches
    - `npm run build` succeeds
  - **Spec update**: mark done + append any gotchas to `## Additional Context`

- [ ] 2) Make host image id/name selection deterministic (owner: agent)
  - **Change**: Replace `Math.random()` in `BaseFormatter.generateImageId()` / `generateImageName()` with deterministic indexing based on `hashString(provider)` (or equivalent) so selection is stable per provider.
  - **Files**: `src/formatters/base-formatter.ts`
  - **Acceptance**:
    - `rg "Math\\.random" src/formatters/base-formatter.ts` returns no matches
    - `npm run build` succeeds
  - **Spec update**: mark done + append any gotchas to `## Additional Context`

- [ ] 3) Enforce “no `Math.random` in `src/`” (owner: agent)
  - **Change**: Ensure no remaining `Math.random()` usage anywhere under `src/` (update any newly-discovered occurrences to deterministic logic).
  - **Files**: `src/**`
  - **Acceptance**:
    - `rg "Math\\.random" src` returns no matches
    - `npm run build` succeeds
  - **Spec update**: mark done + update `## Status` if definition of done is met

- [ ] 4) Verify indexed data in local Elasticsearch/Kibana; fix issues discovered (owner: agent)
  - **Change**: Using `http://localhost:9200` + auth `elastic:changeme` and Kibana at `http://localhost:5601`, validate that:
    - documents are still successfully indexed for impacted streams, and
    - the deterministic changes actually produce repeatable values across runs for the same timestamps
  - **Files**: none (verification-only; follow-up fixes may add files/tasks)
  - **Acceptance**:
    - Purge + run **unique-metrics** twice and compare samples:
      - `./forge --dataset unique-metrics --count 5 --backfill now-2m --interval 10s --purge --no-realtime --elasticsearch-url http://localhost:9200 --elasticsearch-auth elastic:changeme`
      - Query (record a small sample of hits): `curl -s -u elastic:changeme "http://localhost:9200/metrics-uniquemetrics1.otel-default/_search?size=5&sort=@timestamp:asc" | jq '.hits.hits[]._source | {ts:."@timestamp", entity:.attributes["entity.id"], metrics:.metrics}'`
      - Purge + run again with the same args, then re-run the same query; the returned `metrics` values for the same `ts` + `entity` should match.
    - Purge + run **hosts otel** and confirm `host.image.*` is present and stable:
      - `./forge --dataset hosts --format otel --count 3 --backfill now-1m --interval 10s --purge --no-realtime --elasticsearch-url http://localhost:9200 --elasticsearch-auth elastic:changeme`
      - `curl -s -u elastic:changeme "http://localhost:9200/metrics-hostmetricsreceiver.otel-default/_search?size=5&sort=@timestamp:asc" | jq '.hits.hits[]._source.resource.attributes | {host_name:."host.name", provider:."cloud.provider", image_id:."host.image.id", image_name:."host.image.name"}'`
    - Kibana spot-check:
      - Discover `metrics-uniquemetrics1.otel-default` and `metrics-hostmetricsreceiver.otel-default` and confirm documents exist and fields are populated (no obvious mapping errors).
  - **Spec update**:
    - If verification passes: mark done and set `## Status` to `done` (definition of done met)
    - If verification fails: append a short “What broke / why” note to `## Additional Context` and add one or more new tasks (5, 6, …) that precisely fix the discovered issue(s) (mapping errors, missing fields, unexpected non-determinism, etc.)

## Additional Context
This spec intentionally does **not** introduce a global `--seed` flag; the goal is simply to eliminate non-determinism from accidental `Math.random()` usage while keeping existing deterministic patterns (hash/seeded RNG) consistent with the rest of the codebase.

