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

combined_prompt_path="${session_dir}/prompt.md"
{
  cat "$protocol_path"
  printf "\n\n---\n\n"
  cat "$spec_path"
} > "$combined_prompt_path"

echo "Spec: $spec_path" >&2
echo "Protocol: $protocol_path" >&2
echo "Combined prompt: $combined_prompt_path" >&2
echo "Session dir: $session_dir" >&2

i=1
while :; do
  out_file="${session_dir}/run-$(printf '%04d' "$i").json"
  echo "==> $(date +'%Y-%m-%d %H:%M:%S') run #$i -> $out_file" >&2

  if cat "$combined_prompt_path" | cursor-agent --output-format json --model GPT-5.2 --force | tee "$out_file" >/dev/null; then
    : # ok
  else
    echo "Run #$i failed (see output above). Continuing..." >&2
  fi

  i=$((i + 1))
done

