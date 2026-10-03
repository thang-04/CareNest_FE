---
name: integrate-api
description: Use when the CareNest Web client calls a backend endpoint, changes the API client, handles API errors, pagination, auth or tokens ("gọi API", "tích hợp API", "nối API", "endpoint", "lỗi 401/403", "đăng nhập", "token"). Treats CareNest_BE as the contract owner.
---

# Integrate API — CareNest_FE

1. Read `../../../AGENTS.md` (invariants) if not already in context.
2. Follow `../../../.ai/workflows/integrate-api.md`. It is the source of truth; this skill does not redefine it.
3. Context level starts at L2 (`../../../.ai/profiles/feature.md`); contract change needed ⇒ L3 (`../../../.ai/profiles/cross-repo.md`). Escalate via `../../../.ai/ESCALATION.md`.
4. Never invent a response shape; never edit CareNest_BE — describe the contract change to agree on instead.
