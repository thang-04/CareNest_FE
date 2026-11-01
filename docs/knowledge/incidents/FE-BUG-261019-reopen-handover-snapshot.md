---
id: FE-BUG-261019-reopen-handover-snapshot
type: bug
screens: [attendance-entry, meal-count, meal-handover]
be_modules: [attendance]
rules: [ATT-07]
status: open
date: 2026-10-19
keywords: [mở lại, reconfirm, handover, snapshot]
similar_to: []
---

# Xác nhận lại sau mở điểm danh giữ số bàn giao cũ

## Symptom / điều kiện tái hiện

Dữ liệu demo: số suất đã chốt, mở lại lớp, thay số suất rồi xác nhận lại. Count đổi nhưng phiếu bàn giao chưa nhận vẫn giữ expected cũ.

## Attempts

1. Review tĩnh thấy createHandovers bỏ qua mọi phiếu đã tồn tại.
2. Test tích hợp attendance-unlock: ba test quyền/ngày/hạn đạt; test snapshot thất bại expected.normal 16, actual 13. Lần chạy đầu fixture sai tên collection năm học, đã dùng activeYearId hiện có; không phải lỗi production.

## Root cause

FE mock confirmMealCount cập nhật classes rồi createHandovers chỉ tạo mới, không đồng bộ phiếu chưa nhận.

## Fix

Đang sửa: chỉ cập nhật expected phiếu READY sau xác nhận lại, thêm history; giữ nguyên phiếu đã nhận và confirmedSnapshots.

## Regression test

tests/integration/selective-merge/attendance-unlock.test.mjs; đã tái hiện fail trước fix. Chạy lại sau sửa.

## Ảnh hưởng / lesson

FE demo, chưa xác nhận contract BE/App. Các snapshot downstream phải được phân biệt giữa dự kiến chưa thực hiện và thực nhận không ghi đè.
