---
id: FE-BUG-261014-searchselect-under-sticky-actions
type: bug
screens: [enrollment]
be_modules: []
rules: []
status: fixed
date: 2026-10-14
keywords: [SearchSelect, dropdown, z-index, stacking context, backdrop-filter, page-actions, sticky, bị che]
similar_to: []
---

# FE-BUG-261014-searchselect-under-sticky-actions — dropdown SearchSelect bị thanh nút dính đáy che

## Symptom
Ở bước 1 Tiếp nhận trẻ, chế độ "Đã có tài khoản", mở ô "Thêm phụ huynh" (`SearchSelect`): phần dưới danh sách bị thanh `.page-actions` (Hủy / Tiếp tục) che. Không có lỗi console.

## Điều kiện tái hiện
`/children/enroll`, Phó hiệu trưởng, chọn "Đã có tài khoản", mở dropdown khi ô nằm gần đáy màn hình. Áp dụng cho mọi `SearchSelect` đặt trong `.card` ở trang có `.page-actions`.

## Attempts — đã thử
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đọc CSS: `.search-select__panel` `z-index: 50`, `.page-actions` sticky `z-index: var(--z-sticky)` (= 50) | Tăng z-index của panel không đủ | `.card` có `backdrop-filter` ⇒ tạo stacking context; z-index trong card không vượt được phần tử anh em ngoài card |
| 2 | `.card:has(.search-select__panel)` `position: relative; z-index: calc(var(--z-sticky) + 1)`; panel dùng `--z-dropdown` | Card chỉ được nâng khi panel đang mở, vẫn dưới header (`--z-header`) | Chưa kiểm trên trình duyệt trong phiên sửa |
| 3 | User vẫn thấy danh sách nổi bị che/khuất xấu ở bước tiếp nhận | Màn tiếp nhận bỏ `SearchSelect`, dùng ô tìm + danh sách kết quả nằm trong luồng trang (`.tr-account-results`) | Ở wizard có thanh nút dính đáy, ưu tiên kết quả trong luồng thay vì lớp nổi; fix CSS chung vẫn giữ cho các màn khác |

## Root cause
FE. `src/styles/components.css` `.card { backdrop-filter: var(--glass-blur) }` tạo stacking context; thanh `.page-actions` sticky (z-index 50) nằm sau card trong DOM nên vẽ đè lên panel dropdown dù panel có z-index.

## Fix
`src/styles/components.css`: thêm rule `.card:has(.search-select__panel)` nâng card lên trên thanh dính đáy khi panel mở; `.search-select__panel` dùng `var(--z-dropdown)` thay số 50.

## Regression test
Chưa có test tự động (repo chưa có test UI). Kiểm tay: mở `SearchSelect` gần đáy trang có `.page-actions` — danh sách nằm trên thanh nút.

## Ảnh hưởng
Mọi màn dùng `SearchSelect` trong `.card` có `.page-actions`. Popup tự viết khác đặt trong `.card` cũng có thể gặp cùng lỗi.

## Lesson
Phần tử có `backdrop-filter`/`transform`/`filter` tạo stacking context; popup bên trong không vượt được phần tử sticky ngoài nó bằng z-index — phải nâng chính container khi popup mở (hoặc render popup ra ngoài).
