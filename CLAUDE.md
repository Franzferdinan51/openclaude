<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **DuckHive** (72586 symbols, 142203 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

## Core principle: act, then verify

**Finding is not finishing.** Once you know where to change, make the change. Don't map the full call graph before making a targeted fix. Three investigations max, then act. A partial fix delivered beats zero fix while you finish researching.

## When to use GitNexus

GitNexus is a **power tool for architecture and risky changes**, not a gate for every edit.

**Use it for:**
- Understanding unfamiliar code: `gitnexus_query({query: "concept"})` finds execution flows faster than grep
- Risky refactors: `gitnexus_impact` on widely-used symbols before renaming/extracting
- Pre-commit: `gitnexus_detect_changes()` to verify scope before pushing

**Don't gate routine edits with it.** For a simple bug fix, read the file, make the edit, done.

## Quick reference

| Task | GitNexus tool |
|------|--------------|
| Find code related to a concept | `gitnexus_query` |
| Blast radius for a symbol | `gitnexus_impact` |
| Full symbol context | `gitnexus_context` |
| Detect changed symbols | `gitnexus_detect_changes` |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/DuckHive/context` | Codebase overview, check index freshness |
| `gitnexus://repo/DuckHive/clusters` | All functional areas |
| `gitnexus://repo/DuckHive/processes` | All execution flows |
| `gitnexus://repo/DuckHive/process/{name}` | Step-by-step execution trace |

## Skills

| Task | Skill file |
|------|-----------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
