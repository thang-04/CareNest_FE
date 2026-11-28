---
id: FE-BUG-261124-pickup-no-reload
type: bug
screens: [pickup]
be_modules: [attendance]
rules: []
status: fixed
date: 2026-11-24
keywords: [đón trẻ, trả trẻ, không cập nhật, phải F5, refreshOnDataChange]
similar_to: [FE-BUG-261120-no-refresh-after-be-write]
---

# FE-BUG-261124-pickup-no-reload — Trả trẻ xong bảng đón trẻ không tải lại

## Symptom

Nối BE: giáo viên trả trẻ (ảnh hoặc gọi phụ huynh) xong, trẻ vẫn ở danh sách chờ đón tới khi tải lại trang.

## Root cause

FE. `useAsync` `refreshOnDataChange` chỉ nghe sự kiện đổi dữ liệu của mock; ghi qua BE thật không phát sự kiện, `PickupListPage` không `reload()` sau khi ghi.

## Fix

`PickupListPage` gọi `reload({ silent: true })` sau khi trả trẻ thành công. Không đổi BE.

## Lesson

Cùng họ với FE-BUG-261120-no-refresh-after-be-write: màn ghi dữ liệu phải tự tải lại sau khi ghi.
