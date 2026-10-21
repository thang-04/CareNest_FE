---
id: FE-BUG-261015-collapsed-sidebar-blank-bottom
type: bug
screens: [layout-sidebar, year-placement]
be_modules: []
rules: []
status: fixed
date: 2026-10-15
keywords: [khoảng trắng cuối trang, thu gọn menu, sidebar, overflow visible, flyout, zoom 125%]
similar_to: [FE-BUG-261014-attendance-blank-page-bottom]
---

# Thu gọn menu trái thì cuối trang thừa khoảng trắng

## Symptom

Thu gọn sidebar còn icon, màn thấp (1366×768, zoom 125%): cuộn hết trang thấy vùng xám dưới footer. Màn Xếp lớp năm học mới thấy rõ nhất.

## Điều kiện tái hiện

Sidebar thu gọn, 1366×768. `document.scrollHeight` là 835 trong khi footer kết thúc ở 768. Sidebar cao 744 nhưng nội dung trong nó cao 822.

## Attempts

| #   | Cách thử                                                             | Kết quả                                                  |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | So `scrollHeight` từng tầng của khung app                            | Chỉ `aside.sidebar--collapsed` có nội dung cao hơn khung |
| 2   | Cho danh sách icon cuộn trong sidebar, flyout dùng `position: fixed` | Hết khoảng trắng, flyout vẫn hiện đủ                     |

## Root cause

`.sidebar--collapsed .sidebar__scroll { overflow: visible }` (để flyout menu con không bị cắt) làm danh sách icon không cuộn. Màn thấp thì icon và khối tài khoản tràn khỏi sidebar dính (sticky), kéo dài trang.

## Fix

`src/layouts/layout.css`: danh sách icon khi thu gọn `overflow-y: auto` (ẩn thanh cuộn); flyout `position: fixed`, vị trí lấy từ nút nhóm khi rê chuột / focus (`Sidebar.jsx`, biến `--fly-top`, `--fly-left`), thêm cầu nối vô hình để rê chuột sang flyout không bị tắt.

## Regression test

Trình duyệt: sidebar thu gọn và mở rộng ở 1366×768, 1093×614 (zoom 125%), 911×512 (150%), 1920×1080; lần lượt mọi mục menu Hiệu trưởng: `scrollHeight` bằng mép dưới footer. Rê chuột icon nhóm: flyout hiện cạnh sidebar, bấm được mục con.

## Ảnh hưởng và Lesson

Khung có chiều cao cố định (sticky, 100vh) không được để nội dung `overflow: visible`; menu bật ra nên dùng `position: fixed` thay vì mở tràn khung cuộn.
