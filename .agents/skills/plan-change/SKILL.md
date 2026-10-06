---
name: plan-change
description: Use before high-risk or multi-step CareNest Web (FE) changes (lane L) — foundation library, auth/token storage, shared API client, role-based navigation, dependency/build, ≥2 screen groups, BE contract change, >8 files ("lập plan", "kế hoạch", "plan", "nhiều phase", "thay đổi lớn", "chọn thư viện"). Clarifies business first, writes a plan from the template, self-validates, stops for user approval.
---

# Plan change — CareNest_FE

1. Read `../../../AGENTS.md` (invariants) if not already in context.
2. Run `../../../.ai/workflows/clarify-business.md`, then follow `../../../.ai/workflows/plan-change.md` with template `../../../docs/plans/_TEMPLATE.md`. They are the source of truth; this skill does not redefine them.
3. Never set `status: approved` yourself; after each phase log evidence per `../../../docs/quality/VERIFICATION.md` and stop.
