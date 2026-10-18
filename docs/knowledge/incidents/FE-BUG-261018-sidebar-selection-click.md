---
id: FE-BUG-261018-sidebar-selection-click
type: bug
screens: [sidebar]
be_modules: []
rules: []
status: fixed
date: 2026-10-18
keywords: [sidebar, active, click, loading, nav, useEffect]
similar_to: []
---

# FE-BUG-261018-sidebar-selection-click — Sidebar sáng hai mục và nhóm không đóng được

## Symptom
Người dùng báo sidebar có vấn đề về loading/click: không nhấn được nhóm đang mở và hai chuyên mục sáng cùng lúc. Trường hợp có thể tái hiện từ source: `/kitchen/meal-count` khớp cả `/kitchen` và `/kitchen/meal-count`; `/children/new` khớp cả `/children` và `/children/new`.

## Điều kiện tái hiện
Trong mock, dùng role Phó hiệu trưởng, điều hướng tới route con rồi click nút nhóm đang active. Không cần dữ liệu trẻ thật. Đã quan sát trên Chrome local tại `127.0.0.1:5173`.

## Attempts — đã thử
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đọc `Sidebar.jsx`, `menuConfig.js`, `MainLayout.jsx`, `layout.css` và diff đang có | `startsWith` chọn nhiều mục; hiệu ứng phụ thuộc mảng `menu` được tạo mới mỗi render | Xác định active theo route cụ thể nhất; hiệu ứng chỉ phụ thuộc giá trị ổn định |
| 2 | Chạy test chọn route trước sửa | 2 test fail với kết quả `null`, sau sửa 2/2 pass | Có regression cho route cha/con |
| 3 | Mở local Vite qua in-app browser | `Browser is not available: iab` | Chuyển sang Chrome local |
| 4 | Chrome local: click `/kitchen/meal-count`, đóng nhóm Bếp, mở nhóm Trẻ rồi click `/children/new` | Mỗi route chỉ có một `.nav-sub__item--active` và một `aria-current=page`; nhóm Bếp giữ `aria-expanded=false` sau click; loading của trang con biến mất sau khi tải | Tương tác click và trạng thái loading đã được quan sát với mock |

## Root cause
FE `src/layouts/Sidebar.jsx` dùng `pathname.startsWith(child.to)` nên route cha và route con cùng được gắn class active. `getMenuForRole()` trả mảng mới mỗi render, trong khi hiệu ứng tự mở nhóm phụ thuộc `menu`; click đóng nhóm active khiến render tiếp theo chạy hiệu ứng mở lại. `MainLayout.jsx` chỉ hiển thị loading của lazy page trong vùng nội dung, không có overlay che sidebar trong source.

## Fix
`src/layouts/sidebarSelection.js` chọn đúng một mục có prefix theo ranh giới đoạn route và độ dài lớn nhất. `Sidebar.jsx` dùng mục đó cho class/`aria-current`, đồng thời hiệu ứng mở nhóm phụ thuộc `pathname` và nhãn nhóm active ổn định.

## Regression test
`tests/menu/sidebar-selection.test.mjs`: `/kitchen/meal-count`, `/kitchen`, `/children/new`, `/children/123`, `/childrenish`. Test fail trước và pass sau thay đổi. Chrome local xác nhận click nhóm, điều hướng và một mục active tại hai route.

## Ảnh hưởng
Các role dùng chung sidebar. Không đổi danh sách mục, quyền BE, API hoặc APP.

## Lesson
Menu cha có route là prefix của menu con cần chọn mục cụ thể nhất; hiệu ứng đồng bộ theo route không nên phụ thuộc object tạo mới mỗi render.
