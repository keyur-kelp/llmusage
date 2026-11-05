#!/usr/bin/env bash
# PostToolUse hook on Edit|Write: runs the project linter/formatter.
# Non-blocking (exit 0) — lint output is surfaced to Claude via stderr on exit 2 only if you want it to block.

if [ -n "$LINT_CMD" ]; then
  CMD="$LINT_CMD"
elif [ -f package.json ] && grep -q '"lint"' package.json; then
  CMD="npm run lint --silent"
elif [ -f pyproject.toml ] && command -v ruff >/dev/null; then
  CMD="ruff check --fix ."
elif [ -f go.mod ]; then
  CMD="gofmt -l -w ."
else
  exit 0
fi

OUTPUT=$($CMD 2>&1)
if [ $? -ne 0 ]; then
  echo "Lint issues:" >&2
  echo "$OUTPUT" | tail -n 30 >&2
  exit 2   # feed back to Claude so it fixes them
fi
exit 0
