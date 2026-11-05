---
id: FE-BUG-261104-assessment-save-refresh-draft-loss
type: bug
screens: [daily-goal-assessment, year-end-sheet]
be_modules: [learning-observation]
rules: [OBS-28, EDU-19]
status: fixed
date: 2026-11-04
keywords: [save, reload, input loss, in flight, drafts]
similar_to: []
---
# Editing during save/refetch can lose assessment input

## Evidence
FE 9c929d6. YearEndSheetCard sets busy while saving (52), but goal buttons and note textareas remain enabled (174, 209). Its sheet-change effect unconditionally clears edits and replaces notes (38–40). A controlled execution of the actual component reproduced a later note being replaced by the earlier submitted note when save/refetch completed. Synthetic data only; helper .git/year-sheet-race-audit.mjs. Not a browser/API end-to-end run.

DailyGoalAssessmentPage has the related refresh gap: after saving it sets phase saved (166), starts reload without awaiting it (168), and releases inFlight. Controls become editable while that GET remains pending; the sheet effect (106–109) replaces drafts and clears dirty state when it resolves. This second path is source-confirmed, not separately executed.

## Proposal
Keep the relevant controls locked until mutation and baseline reload finish, or reconcile edits made after the request snapshot. A success toast must not expose a period in which new input can be silently overwritten. Cover slow PUT, slow GET and save-error cases without clearing unrelated unsaved content.

## Fix
YearEndSheetCard khóa ô MT và ô lưu ý khi đang lưu (busy kéo tới lúc tải lại xong). DailyGoalAssessmentPage chờ reload sau khi lưu, giữ phase saving (ô bị khóa) tới khi bảng mới về; trạng thái "Đã lưu" chuyển qua effect bằng ref savedAt.
