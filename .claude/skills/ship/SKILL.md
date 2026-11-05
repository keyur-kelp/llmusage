---
name: ship
description: Run the full delivery pipeline (tech-lead design → engineer → tech-lead review → qa → pm-acceptance) for the feature in docs/prd.md.
disable-model-invocation: true
---
You are the orchestrator. You don't write app code yourself — you delegate to subagents, pass file paths between them, and enforce the loop limits. Run subagents one at a time and wait for each result before the next step.

Set up the task list with one item per step below and tick them off.

## Step 0 — Preconditions
- docs/prd.md exists and has numbered ACs (AC-1…). If not, stop and tell the user to run /prd.
- Working tree is clean or on a feature branch. If on main/master with changes, ask the user.

## Step 1 — Design
Delegate to `tech-lead`: "DESIGN mode. Read docs/prd.md, write docs/tech-spec.md."
Show the user a 5-line summary of the spec (stack, modules, tasks, risks, open questions).
**Wait for the user's OK.** Apply their changes via tech-lead if needed.

## Step 2 — Build
Delegate to `engineer`: "Implement all tasks in docs/tech-spec.md."

## Step 3 — Review loop (max 3 rounds)
Delegate to `tech-lead`: "REVIEW mode."
- `VERDICT: APPROVE` → Step 4.
- `VERDICT: CHANGES` → delegate to `engineer`: "Fix all blocker/major issues in docs/reviews/review-<n>.md." → review again.
- After round 3 still CHANGES → stop, show the user the open issues, ask how to proceed.

## Step 4 — QA loop (max 3 rounds)
Delegate to `qa`: "Write and run acceptance tests for every AC in docs/prd.md."
- `RESULT: PASS` → Step 5.
- `RESULT: FAIL` → delegate to `engineer`: "Fix failed ACs in docs/qa/report.md." → `tech-lead` REVIEW once → `qa` again.
- After round 3 still FAIL → stop, report to the user.

## Step 5 — Acceptance
Delegate to `pm-acceptance`.
- `DECISION: ACCEPT` → Step 6.
- `DECISION: REJECT` → show the gaps to the user and stop. Don't loop automatically — a reject usually means the PRD or spec needs a human call.

## Step 6 — Close
- Commit on the feature branch with a message referencing the PRD title.
- Report to the user: what shipped, AC status, review rounds used, follow-ups from pm-acceptance.

## Rules
- Subagents start with no memory of this conversation. Every delegation must name the files to read.
- Never mark a step done on a subagent's say-so alone — check the verdict line in the file it wrote.
