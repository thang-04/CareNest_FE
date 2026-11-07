---
id: FE-BUG-261103-route-click-no-feedback
type: bug
screens: [menu-foods, menu-dishes, menu-setup, sidebar]
be_modules: []
rules: []
status: workaround
date: 2026-11-03
keywords: [lag, bấm nhiều lần, lazy, chunk, transition, Suspense, VPS, băng thông, x-cache-status]
similar_to: []
---

# FE-BUG-261103-route-click-no-feedback — Bấm menu không thấy gì, phải bấm nhiều lần mới vào trang

## Symptom
Web thật (03/11/2026): mở Thực phẩm / Món / Cấu hình nhóm tuổi phải bấm nhiều lần; trang cũ đứng yên vài giây. Không có lỗi console.

## Điều kiện tái hiện
Lần đầu mở một trang lazy trên https://web.carenest.edu.vn, file `/assets` chưa có trong cache proxy (MISS). Local: Playwright làm chậm request chunk trang 3 s (`page.route('**/src/pages/menu-planning/FoodListPage.jsx*', …)`) rồi bấm menu.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | Đo local (mock) từ lúc bấm tới khi hiện bảng | 0,3–0,75 s | Code trang không phải nguyên nhân chính |
| 2 | Phân tích mock `seeded()` clone toàn DB 3,5 MB | ~12 ms/lần trên máy dev | Phụ; web thật dùng BE cho danh mục từ bản `dev` 03/11 |
| 3 | Đo tải file tĩnh web thật (`cache: 'no-store'`) | 19 KB: p50 0,9 s, max 11,2 s | `no-store` ép proxy BYPASS — đo lại không ép |
| 4 | So cùng lúc: CDN ngoài 129 KB / web thật MISS 118 KB / HIT | 112 ms / 6,5–8,9 s / ~2 ms | Nghẽn ở đường từ VPS ra proxy, không ở client |
| 5 | Playwright chunk chậm 3 s | URL đổi ngay, trang cũ đứng 3 s, không khung chờ | Xác nhận phía FE |

## Root cause
Hai lớp:
- **VPS** (ngoài repo): đường ra của server ~13–18 KB/s, dao động; proxy nhà cung cấp (`x-osh-dp: hn01-…`) cache được `/assets` nhưng file mới mỗi bản deploy đều MISS.
- **FE**: `BrowserRouter` (react-router v7) chuyển trang trong transition ⇒ khi chunk route lazy chưa về, React giữ trang cũ, fallback Suspense ở `src/layouts/MainLayout.jsx` không hiện ⇒ người dùng không có phản hồi và bấm lại; mỗi lần bấm lại đẩy thêm một mục lịch sử vì URL đã đổi nhưng React chưa nhận.

## Fix
- `src/routes/routePrefetch.js`: `lazyPage()` (React.lazy + `preload`, đếm chunk đang tải), `prefetchPath()` tìm trang theo đường dẫn từ cây `<Route>` (`registerRouteTree` trong `src/routes/AppRoutes.jsx`).
- `src/layouts/MainLayout.jsx` + `layout.css`: thanh tiến trình `.route-progress` khi chunk trang đang tải.
- `src/layouts/Sidebar.jsx`: tải trước trang của nhóm đang mở khi rảnh, khi rê chuột/focus nhóm hoặc mục; bấm lại cùng mục khi đang mở thì bỏ qua.
- `.github/workflows/deploy.yml`: bước "Warm asset cache" gọi trước mọi file `/assets` từ VPS sau deploy.
- Phần VPS (băng thông) chưa xử lý — xem `docs/plans/active/2026-11-03-e2e-feedback-staff-nutrition.md` mục "Hạ tầng".

## Regression test
`tests/hardening/route-prefetch.test.mjs` (preload một lần, thử lại khi lỗi, tìm trang theo route lồng). Playwright chunk chậm 3 s: thanh hiện sau 80 ms, 3 lần bấm ⇒ 1 lượt điều hướng (ghi trong plan).

## Ảnh hưởng
Mọi trang lazy của Web. Không cần BE/APP đổi.

## Lesson
Route lazy + router chạy trong transition thì khung chờ Suspense không hiện khi đổi trang ⇒ cần chỉ báo riêng cho lúc tải chunk. Đo hiệu năng web thật không dùng `cache: 'no-store'` khi có proxy cache ở trước (ép BYPASS, sai lệch kết quả).
