---
id: FE-BUG-261102-import-validation-ui-kit
type: bug
modules: [education-plan]
rules: [EDU-46]
status: fixed
date: 2026-11-02
keywords: [upload, 2MB, ConditionBadge, ConditionSelect, ui-kit]
similar_to: []
---

# Import preflight validation and dev UI kit

## Symptom
Goal and branch dialogs sent unsupported/empty/oversized files to preview APIs. The development UI kit still imported removed condition controls.

## Attempts
| # | Approach | Result | Lesson |
| --- | --- | --- | --- |
| 1 | Shared validation with realistic file test doubles | 12 targeted tests passed | Input accept alone does not validate files |

## Root cause
Dialogs relied on browser accept and server validation; UI kit retained stale exports after facility removal.

## Fix
Both dialogs check case-insensitive .doc/.docx/.xlsx/.csv suffix, nonempty finite size and 2 MiB maximum before preview requests. Keep backend authoritative. Replace retired condition examples with shared StatusBadge.

## Regression test
plan-import-file-validation.test.mjs, import-goal-file-modal.test.mjs and branch-import-modal.test.mjs assert invalid files never call preview APIs and valid upper-case files exactly at the limit do. Existing goal preview replacement/cancel guards remain tested.

## Impact
No dependency, API or business formula change. Branch dialog late completion after close is a preexisting separate risk; not claimed fixed here.
