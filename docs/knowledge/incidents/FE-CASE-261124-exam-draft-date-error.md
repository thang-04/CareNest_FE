---
id: FE-CASE-261124-exam-draft-date-error
type: case
screens: [health-exam-form]
be_modules: [health]
rules: [HLT-08]
status: fixed
date: 2026-11-24
keywords: [phiếu khám, lưu nháp, date, toast chung, kỳ cân đo cùng ngày]
---

# FE-CASE-261124-exam-draft-date-error — Lỗi ô `date` của phiếu khám không có ô trên form

## Symptom

Lưu nháp phiếu khám ở mọi bước ra toast chung, không ô nào báo lỗi.

## Root cause

Có số đo của kỳ cân đo cùng ngày khám nên BE chặn lưu (BE:G94-180/HLT-08) và trả lỗi ở ô `date`; phiếu khám không có ô `date` nên lỗi không gắn được vào đâu.

## Fix

`HealthExamFormPage` hiện lỗi không gắn ô thành khung đỏ đầu phiếu, ghi đúng câu BE; chuyển bước không lưu lại khi lỗi còn và dữ liệu chưa đổi. BE cho phép lưu theo luật HLT-08 mới.

## Lesson

Lỗi ô BE trả mà form không có ô tương ứng phải có chỗ hiện chung, không chỉ toast.
