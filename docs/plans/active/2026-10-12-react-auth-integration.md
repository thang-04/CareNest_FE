---
title: React auth gateway integration
status: in-progress
owner: CareNest team
jira: unassigned
branch: dev
modules: [identity-access]
rules: [AUTH-07, AUTH-09]
risk: high
created: 2026-10-12
updated: 2026-10-12
---
# React auth gateway integration

Approval: user “duyệt” after backend Phase2 handoff and explicit proposal to integrate React UI. Parent plan: BE:docs/plans/active/2026-10-11-react-auth-keycloak.md Phase3. Existing branch/dirty work preserved; no commit, new branch or dependency authorized/needed.

## Scope and decisions
- Keep React forms/layout, Keycloak identity and BE contract as source of truth.
- AUTH_MODE gateway by default, mock explicit; independent USE_MOCK business data. Never silently fallback auth.
- Real access token memory-only; cookie bootstrap/CSRF; refresh single-flight and retry once;403/503 do not expire a valid session.
- Typed428 -> existing first-login form. Proof/OTP request only memory, not history/storage/URL.
- Map actual roles/assignments; never grant TEAM_LEADER or invent campus/class. Unsupported roles have clear landing/logout.
- Preserve Mobile PKCE and BE contract. No dependency/version/lockfile changes.

## Acceptance and validation
AUTH-07/09 remain server rules. Test token persistence, cookie+CSRF, envelope/428/field errors,401 retry,403/503, stale-response fencing, role/scope mapping, proof memory, logout across tabs. Node built-in test runner uses existing Axios adapter; full FE verify retains lint/format/build. Real isolated Keycloak/Postgres/Mailpit + BE/React flow and visual responsive/keyboard verification required; clearly mark anything not observed.

## Progress log
- Started after user approval. FE .claude/settings.json, ui-review/ and mockups/ existing artifacts preserved.
- Source React18/JSX+Vite+Axios+ReactRouter already implemented despite older docs saying proposed; no framework change.
- Phase 3 source implementation and tests started; final evidence is in the dated entry below.

### 2026-10-12 — Source verified, browser gate pending
- Userapproval “duyệt” permitsPhase3 implementation inexistingdevcheckout; no dependency/branch/commit/push.
-40 actualmodule Node tests pass; full FE verify lint/format/build pass; realbackend/Keycloak/Mailpit9/9 HTTPsmokes pass. Isolated runtime cleaned.
- Independentreview P1cookie/P2sessionexpiry fixed viaRED/GREEN; sharedversion andrestoreBlockedfollowup also regressed and staticrechecked no blocker.
- UIproof in memory, normalizer/rolescope fromBE; APIprofile readonly; no user .env ordirtyartifact overwritten.
- AUTH_FLOW, BACKEND_INTEGRATION, CURRENT_STATE and engineeringincidents updated; report docs/quality/reports/2026-10-12-react-auth-integration.md.
- BrowserCUA inventoryempty; iab/chrome unavailable. Visual/keyboard/responsive/realmultitab notobserved; retainin-progress untilbrowserconnected oruserchangesscope. No impliedapproval toskipthisgate.
