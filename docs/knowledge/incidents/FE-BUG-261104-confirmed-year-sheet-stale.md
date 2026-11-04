---
id: FE-BUG-261104-confirmed-year-sheet-stale
type: bug
screens: [year-end-evaluation, year-end-sheet]
be_modules: [learning-observation]
rules: [OBS-28]
status: fixed
date: 2026-11-04
keywords: [confirm, canEdit, confirmedAt, year sheet, stale]
similar_to: []
---
# Year-end sheet stays editable after confirming the evaluation

## Evidence
FE 9c929d6. useYearEndSheet (useAssessment.js:201–207) reloads only when evaluationId/user changes. EvaluationReviewView reloads the parent evaluation after confirm (169–174), but retains the same unkeyed YearEndSheetCard (407–414). Its separately fetched sheet retains the pre-confirm canEdit=true and confirmedAt=null. The card renders controls and print date from this stale sheet.

## Trigger / impact
Confirm the only/final child and remain on the same detail screen. The confirmed parent is read-only but the sheet still allows local edits; saving them is correctly rejected by BE. Print remains without its confirmation date until a refresh. This is verified from the current dependency/render path, not a browser reproduction.

## Proposal
Invalidate/refetch the year sheet on evaluation confirmation/status changes or remount it at that explicit transition; avoid discarding drafts on unrelated parent refreshes. Test the final child and confirm-without-navigation, including print state.

## Fix
YearEndSheetCard được gắn key theo id + trạng thái đánh giá trong EvaluationReviewView; xác nhận xong phiếu nạp lại (chỉ xem, có ngày xác nhận cho bản in). Kiểm: QA trình duyệt xác nhận trẻ cuối cùng, không rời màn.
