---
title: Reconcile attendance leave changes while preserving drafts
status: done
owner: DinhCan
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [attendance]
rules: [ATT-04, ATT-09]
risk: high
created: 2026-11-04
updated: 2026-11-04
---
# Approved scope

User approved the deep-review fixes. Main plan at BE docs/plans/completed/2026-11-04-flow-consistency-repairs.md. Preserve unrelated staged/dirty draft-history changes.

## Acceptance

- A parent leave submission/cancellation is reflected on open teacher sheet by safe background refresh or error recovery.
- Newly blocked/canceled rows reconcile against server state; other unsaved attendance and health work is not wholesale replaced.
- Background responses cannot overwrite a newer save/reception operation; retain two-request partial-save error reporting.
- Behavioral regression tests, full verification and read-only peer review; no endpoint/dependency/formula changes and no commit/push.

## Progress log

- 04/11: User approved implementation. Existing sheet polls day-info only and keeps live:false. Add guarded explicit sheet reconciliation rather than enabling indiscriminate live replacement.

- 04/11: Product repairs complete; targeted regression 5/5 BE, 8/8 FE, full BE 1001 tests, zero failures/errors/skips; archunit, API snapshot and spotless PASS, full FE 797 tests (zero skips/failures) including lint/build. Independent read-only review performed; health draft visibility finding repaired and verified in Chrome with mock adapter. No endpoint/DTO/dependency/migration/formula changes. Manual integrated acceptance steps: CareNest_FE/docs/quality/2026-11-04-flow-consistency-test.md. No commit/push performed.
