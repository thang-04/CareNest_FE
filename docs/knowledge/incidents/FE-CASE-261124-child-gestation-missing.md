---
id: FE-CASE-261124-child-gestation-missing
type: case
screens: [children-edit]
be_modules: [child]
rules: [CHD-01]
status: fixed
date: 2026-11-24
keywords: [tuần thai khi sinh, sửa hồ sơ, seed]
---

# FE-CASE-261124-child-gestation-missing — Form sửa hồ sơ thiếu "Tuần thai khi sinh"

## Symptom

Mở sửa hồ sơ trẻ ở dev, ô "Tuần thai khi sinh" luôn trống.

## Root cause

Dữ liệu seed dev thiếu tuần thai (bắt buộc khi tiếp nhận). Không phải lỗi FE.

## Fix

BE bổ sung tuần thai vào seed. FE không đổi.
