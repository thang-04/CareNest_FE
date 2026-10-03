---
name: review-code
description: Use to review CareNest Web code, diffs or pull requests ("review", "xem code", "kiểm tra PR", "review giúp"). Checks for business rules copied into FE, UI-only authorization, child-data leaks, contract mismatch and missing engineering memory.
---

# Review code — CareNest_FE

1. Read `../../../AGENTS.md` (invariants) if not already in context.
2. Follow `../../../.ai/workflows/review-code.md`. It is the source of truth; this skill does not redefine it.
3. Context level L1→L2 (`../../../.ai/profiles/code.md`); escalate via `../../../.ai/ESCALATION.md`.
4. Report findings with location, failure scenario and fix; separate proven defects from questions; do not claim runtime verification from static reading.
