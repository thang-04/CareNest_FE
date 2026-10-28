---
id: FE-BUG-261028-edit-child-first-save-stale-phone
type: bug
screens: [children-edit]
be_modules: [child, identity-access]
rules: [AUTH-21]
status: open
date: 2026-10-28
keywords: [sửa hồ sơ, phụ huynh, số điện thoại, lưu, mất dữ liệu đã gõ, form nạp lại, useChildDetail]
similar_to: []
---

# FE-BUG-261028-edit-child-first-save-stale-phone — Sửa hồ sơ: lần lưu đầu gửi SĐT cũ dù ô đang hiện số mới

## Symptom
Thử trình duyệt (Vite mock, Hiệu trưởng) sau khi mở khóa ô phụ huynh: đổi SĐT phụ huynh đã có tài khoản ở `/children/:id/edit`, ô hiện số mới và cảnh báo "Số điện thoại khác tài khoản"; nhập lý do, bấm "Lưu thay đổi" ⇒ toast "Đã lưu thay đổi hồ sơ." nhưng không có toast đổi tên đăng nhập; lịch sử hồ sơ ghi phụ huynh với SĐT cũ; tài khoản không đổi. Console không lỗi.

## Điều kiện tái hiện
Chưa tái hiện được. Lần 1: mở trang, chờ chữ "Phụ huynh 1", gõ SĐT ngay, nhập lý do, lưu. Dữ liệu giả.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Kiểm code trang đang chạy (`fetch` source từ Vite) | Mock và helper là bản mới | Không phải do trình duyệt chạy code cũ |
| 2 | Mở lại trang, gõ SĐT, chờ 2 giây, nhập lý do, lưu (bắt `localStorage.setItem` để xem SĐT ghi xuống) | Ghi SĐT mới; tài khoản đổi tên đăng nhập, gửi SMS; toast đúng | Lần 2 chạy đúng |
| 3 | Mở lại trang, gõ họ tên trẻ ngay khi form hiện, đọc lại sau 3 giây | Giá trị giữ nguyên | Không thấy form bị nạp lại |

## Root cause
Chưa rõ. Giả thuyết: `EditChildPage` đặt lại form trong `useEffect(..., [detail])` (`src/pages/children/EditChildPage.jsx:37-54`); nếu `detail` đổi sau khi người dùng đã gõ (lần tải dữ liệu thứ hai về muộn) thì mọi ô trở về giá trị cũ, riêng ô lý do (state riêng) còn — khớp triệu chứng. Chưa chứng minh `detail` đổi hai lần.

## Fix
Chưa sửa.

## Regression test
Chưa có. Logic BE giả đã có test `tests/children/guardian-info-editable.test.mjs` (đổi SĐT qua `updateChild` đúng).

## Ảnh hưởng
Người sửa tưởng đã đổi SĐT nhưng hồ sơ và tài khoản giữ số cũ (không có toast đổi tên đăng nhập). Có thể gặp ở mọi ô của màn Sửa hồ sơ nếu giả thuyết đúng.

## Lesson
Form nạp từ dữ liệu tải về chỉ nên khởi tạo một lần cho mỗi hồ sơ; khi thử trên trình duyệt, kiểm dữ liệu đã ghi chứ không chỉ toast thành công.
