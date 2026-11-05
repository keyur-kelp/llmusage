#!/usr/bin/env bash
# Stop hook for the engineer subagent: blocks finishing while unit tests fail.
# Exit 2 = block and feed stderr back to the agent. Exit 0 = allow.

INPUT=$(cat)

# Avoid infinite loops: if we already blocked once in this stop cycle, let it go.
if echo "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

# Edit TEST_CMD to match your project (or set it in CLAUDE.md and mirror here).
if [ -n "$TEST_CMD" ]; then
  CMD="$TEST_CMD"
elif [ -f package.json ]; then
  CMD="npm test --silent"
elif [ -f pyproject.toml ] || [ -f pytest.ini ]; then
  CMD="pytest -q"
elif [ -f go.mod ]; then
  CMD="go test ./..."
else
  exit 0   # no known test runner, don't block
fi

OUTPUT=$($CMD 2>&1)
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "Unit tests are failing. Fix them before finishing." >&2
  echo "$OUTPUT" | tail -n 40 >&2
  exit 2
fi

exit 0
