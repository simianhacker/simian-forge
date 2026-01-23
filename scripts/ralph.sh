#!/usr/bin/env bash
set -euo pipefail

spec_path="${1:-}"
if [[ -z "$spec_path" ]]; then
  echo "Usage: scripts/ralph.sh <path-to-spec>" >&2
  exit 2
fi

if [[ ! -f "$spec_path" ]]; then
  echo "Error: spec file not found: $spec_path" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
protocol_path="${AGENT_LOOP_PROTOCOL_PATH:-"${repo_root}/AGENT_LOOP_PROTOCOL.md"}"

if [[ ! -f "$protocol_path" ]]; then
  echo "Error: agent loop protocol not found: $protocol_path" >&2
  exit 2
fi

mkdir -p "sessions"

prompt_base="$(basename "$spec_path")"
prompt_name="${prompt_base%.*}"
session_ts="$(date +'%Y%m%d-%H%M%S')"
session_dir="sessions/${prompt_name}-${session_ts}"
mkdir -p "$session_dir"

echo "Spec: $spec_path" >&2
echo "Protocol: $protocol_path" >&2
echo "Session dir: $session_dir" >&2

get_spec_status() {
  # Extract the first non-empty line after "## Status"
  awk '
    BEGIN { in_status = 0 }
    /^##[[:space:]]+Status[[:space:]]*$/ { in_status = 1; next }
    in_status {
      if ($0 ~ /^[[:space:]]*$/) next
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0)
      print tolower($0)
      exit
    }
  ' "$spec_path"
}

i=1
while :; do
  out_file="${session_dir}/run-$(printf '%04d' "$i").json"
  prompt_file="${session_dir}/prompt-$(printf '%04d' "$i").md"
  echo "==> $(date +'%Y-%m-%d %H:%M:%S') run #$i -> $out_file" >&2

  # Rebuild the prompt every run so the agent sees the latest spec state.
  {
    cat "$protocol_path"
    printf "\n\n---\n\n"
    cat "$spec_path"
  } > "$prompt_file"

  if cat "$prompt_file" | cursor-agent --output-format json --model GPT-5.2 --force | tee "$out_file"; then
    : # ok
  else
    echo "Run #$i failed (see output above). Continuing..." >&2
  fi

  status="$(get_spec_status || true)"
  if [[ "$status" == "done" ]]; then
    echo "Spec status is 'done' — exiting." >&2
    exit 0
  fi

  i=$((i + 1))
done

