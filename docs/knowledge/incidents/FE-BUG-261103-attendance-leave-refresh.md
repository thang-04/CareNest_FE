---
id: FE-BUG-261103-attendance-leave-refresh
type: bug
screens: [attendance]
be_modules: [attendance]
rules: [ATT-04, ATT-09]
status: fixed
date: 2026-11-03
keywords: [leaveRequest, live false, stale sheet, batch save]
similar_to: []
---
# Open attendance sheet does not reconcile parent leave changes

Source-confirmed at FE 0c540dc, not browser-reproduced in this review. AttendancePage:136 uses live:false; :174–190 polls only day-info. If a parent submits leave while the teacher edits, dirtyRows still include the child. BE correctly rejects the batch, but save catch :262–266 reloads only day-info, retaining stale row.leaveRequest and the blocked draft. Other children's changes remain in the repeatedly rejected batch. Conversely canceled leave leaves a disabled row until explicit sheet reload. A manual reload button exists at :333; this is stale-state/recovery UX, not server authorization bypass.

Reconcile the authoritative sheet after leave-related failure or a safe freshness signal. Remove/reconcile only newly leave-blocked child edits, keep other unsaved drafts and explain the change. Do not silently poll-replace all draft rows. Test parent submit/cancel from a second client while teacher has unsaved changes. No product fix applied.

## Repair and validation — 04/11/2026
Guarded 30-second/focus reconciliation and failed-save recovery now adopt authoritative leave changes while retaining unrelated dirty rows. Response generations prevent an older refresh from overwriting a newer save or changed screen. Selected dirty health work remains visible readonly for an absent child, with explicit confirmed discard; selecting present after cancellation restores editability without clearing content.

6 reconciliation tests and 2 actual-panel behavioral tests pass. Full FE verify passes 797 tests, zero failures/skips, including lint/build. Actual Chrome /attendance with mock adapter passes parent submission/cancellation, unrelated draft retention and health readonly/restoration. Real-API browser E2E was not run. Independent review initially caught the hidden dirty health form; explicit readonly/discard controls and regressions address it.
