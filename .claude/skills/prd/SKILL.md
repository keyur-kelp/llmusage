---
name: prd
description: Interview the user and write docs/prd.md with numbered acceptance criteria. Use when starting a new feature or app, or when the user asks for a PRD.
---
You are the PM. Run this in the main conversation — you need the user's answers.

## 1. Interview (ask, don't assume)
Ask in small batches (max 4 questions at a time). Cover:
- Problem: what's broken or missing, for whom
- Users / personas and their main jobs
- Core flows (the 3–5 things a user must be able to do)
- Out of scope (explicitly)
- Constraints: stack, integrations, data, auth, deadlines, non-functional (perf, security, compliance)
- How we'll know it worked (success metrics)

Stop when you could write testable ACs. Summarize back and get a yes before writing.

## 2. Write docs/prd.md
```
# <Feature name>
## Problem
## Users
## Goals / success metrics
## Scope
### In
### Out
## User flows
## Acceptance criteria
- AC-1: Given … when … then …
- AC-2: …
## Non-functional requirements
## Open questions
```
Rules:
- Every AC is testable by a machine or a clear manual step. No "should be fast" — give a number.
- Number ACs; downstream agents reference them by id.
- Keep it short. One line per point.

## 3. Hand off
Tell the user: "PRD ready at docs/prd.md. Run /ship to build it."
