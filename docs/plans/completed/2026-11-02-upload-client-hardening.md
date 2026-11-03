---
title: Validate plan files and repair dev UI kit
status: done
owner: DinhCan
jira: G94-179 / FE-FEAT-42
branch: feature/G94-179-FE-FEAT-42-school-config-api
modules: [education-plan]
rules: [EDU-46]
risk: medium
created: 2026-11-02
updated: 2026-11-02
---
# Upload client repairs

User approved five technical repairs and PR creation. Main plan at sibling BE `docs/plans/active/2026-11-02-upload-lock-hardening.md`. No reward or chuyên cần formula changes.

## Acceptance

- Both goal/branch file dialogs reject unsupported extensions, empty/unreadable and over-2-MB files before preview API; case-insensitive accepted suffixes remain .doc/.docx/.xlsx/.csv. Backend remains authoritative.
- Existing preview race/cancel/import-mode checks still pass. In-memory test file doubles now model real file names/sizes.
- Dev /ui-kit loads without missing exports; retire old condition controls, use shared StatusBadge examples.
- Run full verify, actual browser dev-route smoke and AI-layer checks. No new dependency, endpoint or design primitive.

## Progress log

- User approved implementation and PR. Existing task branch fast-forwarded to dev, preserving teammate changes and unrelated local audit documents. Shared validation helper and both dialog wiring added; targeted tests in progress. Backend parser/lock work is reviewed separately; technical fixes only.

- Validation: full verify PASS, 490 tests, lint and build passed. Targeted modal/helper tests: 12 passed. Actual Chrome /ui-kit rendered both status examples with no page errors. Read-only peer review found no introduced blocker.
