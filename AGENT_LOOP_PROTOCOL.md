# Agent loop protocol

You are executing a spec in an iterative, multi-session loop.

## Required behavior
- Pick the **first unchecked** task in `## Tasks`.
- Implement **exactly one task** (including its acceptance checks).
- Update the spec:
  - Mark the task complete (`[x]`).
  - Append discoveries/gotchas to `## Additional Context`.
  - Adjust remaining tasks if reality differs (split/merge/reword as needed).
  - Update `## Status`:
    - `in-progress` when the first implementation task begins
    - `done` only when the spec’s “Definition of done” is met (and all tasks needed to satisfy it are complete)
- Exit after updating the spec so the next fresh session can continue.

