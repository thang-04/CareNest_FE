---
id: FE-BUG-261105-health-theme-context
type: bug
modules: [attendance, assessment]
rules: [HLT-15]
status: fixed
date: 2026-11-05
keywords: [contacts, handedOverAt, theme, stale]
similar_to: []
---
# Thiếu context sức khỏe và nhãn chủ đề chưa cập nhật

## Symptom
Liên hệ mở vùng trống; sức khỏe chưa nhận handedOverAt. Xác nhận chủ đề cập nhật bảng nhưng nhãn dropdown vẫn Đang đánh giá.

## Attempts
| # | Cách thử | Kết quả |
| --- | --- | --- |
| 1 | Đọc adapter, DTO, useThemeList và handler xác nhận | contacts=[]; chỉ reload detail, không reload list |
| 2 | Full verify sau Prettier | Harness render dùng regex chỉ bỏ import một dòng; sửa bỏ import nhiều dòng, không đổi source để né formatter |
| 3 | Full verify lint | Phát hiện import nhãn từ module account; chuyển nhãn dùng chung lên root models, account giữ re-export tương thích |

## Root cause
Adapter bỏ liên hệ; DTO thiếu giờ trả. Theme list và detail là hai useAsync độc lập; chỉ tải lại detail sau xác nhận.

## Fix
Nối field mới BE và báo hồ sơ thiếu liên hệ. Dùng response lưu/xác nhận cập nhật detail ngay, reload theme list; khóa bộ lọc/ô nhập trong lúc đang lưu.

## Regression test
`daily-health-context.test.mjs` 3/3, `health-draft-leave-change.test.mjs` 3/3 và `theme-confirm-refresh.test.mjs` 1/1 đạt; handler test giữ phản hồi/list pending để kiểm khóa ô và chỉ báo thành công sau refresh. FE full 840 tests, 0 fail/skip. BE RED/contract: BUG-261105-health-pickup-context.
