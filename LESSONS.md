# DuckHive LESSONS — Failure Moat

> Append-only. Never delete. Every failure is a tuition payment.

This is DuckHive's **permanent failure memory** — a running log of what broke, why, and how we fixed it. It's the third layer of the 3-layer memory system (BM25 → Embed Recall → LESSONS).

**Tag categories:**
- `provider-failure` — API errors, rate limits, provider outages
- `tool-error` — Tool execution failures, missing deps, permission issues
- `api-limit` — Rate limit hits, quota exhaustion, token overruns
- `infra` — Server issues, network problems, disk/memory pressure
- `code-pattern` — Bugs, logic errors, unexpected behavior
- `permission` — Permission denied, sandbox blocks, auth failures
- `security` — Vulnerability discoveries, injection attempts, credential exposure
- `test-flake` — Test failures that need investigation

---

## Failure Log

_(Append failures below as they occur. Format: `## [YYYY-MM-DD] <tag>: <one-line summary>`)_

## Getting Started

When something breaks:
1. Document it here with date + tag
2. Root cause analysis
3. What we did to fix it
4. What to do if it happens again

This file survives across sessions. It's the moat that keeps us from falling into the same ditch twice.
