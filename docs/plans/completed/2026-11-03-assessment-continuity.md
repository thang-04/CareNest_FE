---
title: Show assessment history across class transitions
status: done
owner: DinhCan
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [assessment]
rules: [OBS-03, OBS-07, OBS-10]
risk: high
created: 2026-11-03
updated: 2026-11-03
---
# Approved scope

User approved BE/FE history repairs and manual testing guide. Main plan: BE docs/plans/completed/2026-11-03-assessment-continuity.md. Keep current external uncommitted changes; do not implement transfer/withdrawal or change monthly quality formulas.

## Acceptance

- Show source class for historical assessment days using optional BE classId/className; retain legacy demo rendering.
- Do not link a previous-class day to the receiving class's daily sheet.
- Confirmed historical assessments are clearly read-only for the receiving teacher; no draft/edit controls become visible.
- Ticket board explains cross-class weekly evidence and prevents selecting already issued tickets.
- Add meaningful component/permission regressions, run full verification and independent review; deliver a manual flow test guide for GV/PHT/HT with expected outcomes.

## Progress log

- 03/11/2026: User approved scope before edits. Existing targeted BE/FE tests pass; remaining specific history cases need new coverage. No new dependency or endpoint.
- Source class labels, safe history links, read-only notice and history/other-class ticket states implemented. Six focused FE component/permission tests pass. Actual DailyDaysTable browser smoke passed in Chrome with source labels and safe links; temporary browser entry removed. Full verification and final BE verification in progress.
- Manual guide: docs/quality/2026-11-03-assessment-continuity-manual-test.md. BE companion psql fixture is tested against isolated PostgreSQL and preserves existing children.

- Final verification: full verify PASS, 499 tests; lint, formatting, design/API checks and production build passed. BE full PASS 750 tests without skips; real psql fixture test and Chrome component smoke passed. No new dependencies, no commit/push.
