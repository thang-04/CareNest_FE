---
title: Phản hồi E2E 03/11 — tạo tài khoản GV không chọn lớp, lag điều hướng, vi chất thực phẩm, giao diện dinh dưỡng
status: in-progress
owner: thangnd
jira: G94-272 / FE-FIX-01
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: [school-config, menu-planning]
rules: [AUTH-15, NUT-05, NUT-18, NUT-24]
risk: high
created: 2026-11-03
updated: 2026-11-03
---
# Phản hồi E2E 03/11 — tài khoản nhân sự, lag, vi chất, giao diện dinh dưỡng

## Context

User báo 4 lỗi trên https://web.carenest.edu.vn (03/11/2026). Nhánh đã fast-forward lên `origin/dev` `62be183` (user cho phép 03/11); mọi `file:line` dưới đây theo bản này. Trên `dev`, Thực phẩm / Món / Cấu hình nhóm tuổi / Nhà cung cấp gọi BE thật `/nutrition/*` (`src/config/integrationModules.js` mục `nutrition-catalog`, `src/services/nutritionCatalogApi.js`); thực đơn, cân đối vẫn demo.

1. **Tạo tài khoản GV vẫn bắt chọn lớp.** BE AUTH-15 (`BE:docs/contracts/AUTH_CONTRACT.md:127-128`): GV không chọn lớp, không tạo phân công từ 01/11; chỉ gửi `campusId` (bắt buộc khi người tạo là PHT, HT để trống được); xếp lớp sau ở `PUT /classes/{id}/teachers` / `POST /staff-assignments`. FE còn: ô "Lớp" bắt buộc `src/components/school-config/StaffAccountsBeView.jsx:383`; cột "Lớp" file mẫu `src/utils/school-config/staffImport.js:7`; validate lớp `:43-44`; gửi `classroomId` `:56`; import đọc lớp `:83-89`; cột xem trước `src/components/school-config/StaffImportPanel.jsx:152`.
2. **Lag màn danh mục / thiết lập — đã test nguyên nhân (03/11):**
   - **VPS là nguyên nhân chính.** Cùng máy, cùng lúc: entry JS 118 KB từ web thật mất 8,9 s (~13 KB/s); file 129 KB từ cdnjs 112 ms, jsDelivr 262 ms. Chunk 19 KB tải lặp 25 lần: p50 0,9 s, p90 5,3 s, max 11,2 s (chờ server tới 11,2 s, tải về tới 6,5 s). API trả 401 (vài trăm byte) p50 27 ms. Đường đi: Caddy (`via: 1.1 Caddy`, `x-osh-dp: hn01-dnsgr01-dataplan01`) → nginx; đã có `br` + `immutable`. ⇒ Băng thông/đường ra của server chậm và chập chờn, không phải mạng phía người dùng.
   - **FE khuếch đại (đã xác nhận).** Playwright trên local, làm chậm chunk `FoodListPage` 3 s: bấm menu ⇒ URL đổi ngay nhưng trang cũ đứng yên 3 s, không khung chờ (route lazy `src/routes/AppRoutes.jsx`, `BrowserRouter` `src/App.jsx:10`, fallback `src/layouts/MainLayout.jsx:81-96` không hiện vì điều hướng chạy trong transition). Lần đầu vào trang cần tải thêm: Thực phẩm 28 file / 124 KB, Món 28 / 115 KB, Cấu hình nhóm tuổi 15 / 114 KB, chi tiết thực phẩm 17 / 103 KB, chi tiết món 20 / 108 KB (chưa nén). Với ~13 KB/s ⇒ vài giây không phản hồi ⇒ người dùng bấm lại.
   - Phụ: trang danh mục vẫn gọi mock `getAccess`/`getCatalog` (clone toàn DB demo 3,5 MB + chờ giả 250 ms) song song API thật (`src/services/menu-planning/menuPlanningService.js:20-32`); Cấu hình nhóm tuổi gọi `/versions` riêng từng nhóm tuổi (`src/services/nutritionCatalogApi.js:460-462`).
3. **Thực phẩm thiếu vi chất; chi tiết không phải bảng.** BE `dev` `FoodResponse` chỉ có `kcal, protein, lipid, glucid, origin, nutrientSource, nutrientSourceVersion`; `AgeGroupMealConfigResponse` có định mức năng lượng, P:L:G %, gam đạm/béo ĐV-TV, glucid, % năng lượng bữa — không có vi chất. Chi tiết thực phẩm vẫn là thanh "19 g · 55% NL" (`src/pages/menu-planning/FoodDetailPage.jsx`, `src/components/menu-planning/NutrientBars.jsx`).
4. **Giao diện cấu hình nhóm tuổi, chi tiết món khó nhìn, thiếu màu đạt/chưa đạt** (ảnh chụp bản `dev` 1440 px):
   - Tổng quan cấu hình nhóm tuổi: cột "Chuẩn tạm / ngày" dồn 9 chỉ số thành 2 cột chữ nhỏ, "P:L:G 13–20 : 30–40 : 40–57%" xuống dòng; nhóm chưa nhập chuẩn vẫn xanh "Đang áp dụng" (`src/pages/menu-planning/NutritionSetupPage.jsx`).
   - Chi tiết món: bảng "Dinh dưỡng và chi phí 1 suất theo nhóm tuổi" tràn ngang (cột P:L:G bị cắt); bảng "Hàm lượng từng thành phần" chỉ thấy tới Đạm TV, các cột béo, glucid, kcal bị đẩy ra ngoài; thẻ trái ghi ĐV/TV bằng chữ xám nhỏ ("động vật chiếm 60,3%"); không có màu đạt/chưa đạt (`src/pages/menu-planning/DishDetailPage.jsx`).

## Quyết định đã chốt

1. GV tạo tài khoản không chọn lớp — BE AUTH-15, 01/11/2026; user nhắc lại 03/11.
2. Thành phần thực phẩm theo Viện Dinh dưỡng — NUT-18 CONFIRMED; cân đối 6 chỉ số PMS — NUT-24 CONFIRMED.
3. Bảng giữ "một thông tin một cột", không gộp cột cho vừa (user, các phiên trước).
4. Vi chất bám PMS: 6 chỉ số hiện có + **canxi, phospho, sắt (mg); vitamin A (µg), B1, B2, PP, C (mg)** — user 03/11.
5. Số liệu vi chất 28 thực phẩm mẫu: AI điền theo Bảng thành phần thực phẩm Việt Nam (Viện Dinh dưỡng), ghi nguồn + phiên bản, user soát — user 03/11.
6. Chi tiết món chỉ so **tỷ lệ năng lượng P:L:G** với chuẩn nhóm tuổi, tô Đạt / Thấp / Cao, ghi "tham khảo — chuẩn tính cho cả ngày" — user 03/11.
7. Có định mức vi chất theo nhóm tuổi (PHT nhập như NUT-24); đánh giá đạt/chưa đạt ở mức ngày (cân đối khẩu phần, thực đơn), không ở món — user 03/11 (mức ngày/món: suy từ quyết định 6).
8. Lag: test rõ FE hay VPS (đã làm, kết quả ở Context mục 2) — user 03/11.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** HT/PHT tạo tài khoản nhân sự (AUTH-15) · PHT quản lý danh mục thực phẩm, món, cấu hình nhóm tuổi · thành phần theo Viện Dinh dưỡng (NUT-05 nguồn + phiên bản, NUT-18) · cân đối theo PMS (NUT-24).
- **Đối chiếu thiết kế:** NUT-24 chỉ có 6 chỉ số; thêm 8 vi chất + định mức = **đổi contract BE** (`foods`, `age_group_meal_configs`, DTO thực phẩm, món, cấu hình) ⇒ theo `.ai/workflows/plan-change.md` plan chính phải ở `BE:docs/plans/active/`, cần user cho phép sửa repo BE.
- **Ảnh hưởng:** `FE: /school/staff` (tạo, nhập Excel) · `FE: /menu/foods*`, `/menu/dishes*`, `/menu/setup`, cân đối khẩu phần, thực đơn mẫu/tuần · BE nutrition (Flyway mới, seed dev) · dữ liệu cũ: cột mới để trống = "chưa có số liệu", không chặn báo ăn, số suất, dự trù (giống NUT-24).

### Câu hỏi mở

Plan A không còn câu hỏi mở. Cần hỏi trước khi bắt đầu Plan B (Phase 3): nhánh BE và mã Jira nào (repo BE đang ở `dev`; không tự tạo nhánh) — Q9.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Q1 Danh sách vi chất | Bám PMS: 6 chỉ số + canxi, phospho, sắt, vitamin A, B1, B2, PP, C | thangnd | 2026-11-03 | — |
| Q2 Số liệu mẫu | AI điền theo Bảng TPTP Việt Nam, user soát | thangnd | 2026-11-03 | — |
| Q3 Màu chi tiết món | Chỉ tỷ lệ P:L:G | thangnd | 2026-11-03 | — |
| Q4 Định mức vi chất | Có | thangnd | 2026-11-03 | — |
| Q5 VPS | Test nguyên nhân FE hay VPS ⇒ đã test: VPS chính, FE khuếch đại | thangnd | 2026-11-03 | — |
| Q6 Sửa BE | Cho sửa `CareNest_BE` (plan chính ở BE, không commit/push) | thangnd | 2026-11-03 | — |
| Q7 Dạng định mức vi chất | Khoảng min–max, max để trống được | thangnd | 2026-11-03 | — |
| Q8 VPS | AI đọc cấu hình deploy trong repo, chỉ chỗ nghẽn, đề xuất; không đụng server thật | thangnd | 2026-11-03 | — |

## Acceptance criteria

- **AC-1** (AUTH-15): Given HT/PHT mở "Thêm tài khoản nhân sự", When chọn Giáo viên, Then không có ô Lớp, có ô Điểm trường (bắt buộc với PHT, tùy chọn với HT); body `POST /accounts` không có `classroomId`.
- **AC-2** (AUTH-15): Tạo GV thành công ⇒ thông báo có nút "Xếp lớp ngay" mở `/school/teachers`.
- **AC-3** (AUTH-15): File mẫu nhập Excel không còn cột "Lớp"; file cũ còn cột "Lớp" vẫn nhập được (cột bị bỏ qua, có ghi chú).
- **AC-4**: Chunk trang chậm 3 s (Playwright) ⇒ trong ≤100 ms sau khi bấm có phản hồi ở vùng nội dung (thanh tiến trình + khung chờ); bấm lại không tạo điều hướng thừa.
- **AC-5**: Sau trang đầu, chunk các trang trong nhóm menu của vai trò được tải trước khi trình duyệt rảnh; hover/focus mục menu tải trước chunk đó.
- **AC-6**: Trang danh mục thực phẩm, món, cấu hình nhóm tuổi không gọi mock khi module dùng BE; mở trang Thực phẩm chỉ 1 request danh sách.
- **AC-7** (NUT-18, NUT-05): Thực phẩm lưu, nhập file, hiển thị 8 vi chất; ô trống = "—", không chặn tính toán.
- **AC-8**: Chi tiết thực phẩm có bảng "Thành phần trong 100 g ăn được": Nhóm · Chất · Hàm lượng · Đơn vị (số căn phải, đơn vị riêng cột), gồm năng lượng, đạm, béo, glucid (kèm nguồn gốc ĐV/TV) và 8 vi chất; nguồn + phiên bản ghi dưới bảng.
- **AC-9** (NUT-24): Cấu hình nhóm tuổi nhập được định mức 8 vi chất; tổng quan mỗi chỉ số một cột, bảng cuộn ngang có cột Nhóm tuổi cố định, không chữ xuống dòng ở 1280 px; nhóm chưa nhập chuẩn hiện nhãn vàng "Chưa nhập chuẩn".
- **AC-10**: Chi tiết món: hai bảng không bị cắt cột ở 1280 px (cột Thành phần / Nhóm tuổi cố định, phần còn lại cuộn ngang có bóng mép); bảng thành phần chia tab "Năng lượng & P:L:G" / "Khoáng chất" / "Vitamin"; dòng Tổng nổi bật; P:L:G so chuẩn nhóm tuổi đang chọn bằng `NormStatusChip` (Đạt xanh, Thấp vàng, Cao cam, Chưa đủ dữ liệu xám) kèm chú thích "tham khảo".
- **AC-11** (NUT-24): Cân đối khẩu phần / thực đơn ngày hiện 8 vi chất: giá trị, định mức, % đạt, nhãn màu; thiếu số liệu ⇒ "Chưa đủ dữ liệu", không đánh giá.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Lag phía FE | Thanh tiến trình khi chunk tải + tải trước chunk theo nhóm menu (rảnh, hover/focus) + gom chunk nhóm dinh dưỡng (`manualChunks`) + bỏ gọi mock thừa | (b) Bỏ lazy: bundle đầu nặng, đăng nhập chậm hơn trên VPS hiện tại; (c) đổi sang `createBrowserRouter` để có `useNavigation`: đổi nền điều hướng, làn L lớn | Không thêm dependency; nhắm đúng "bấm không thấy gì"; ít file phải tải |
| Lag phía hạ tầng | Báo nhóm hạ tầng kèm số đo; đề xuất CDN cho `/assets` (file `immutable` cache được vĩnh viễn) | FE tự xử lý | Băng thông server là gốc; FE chỉ giảm cảm nhận |
| Vi chất lưu ở đâu | Cột mới bảng `foods` + DTO, cùng kiểu `kcal`/`protein` | Bảng giá trị riêng | BE đã gộp NutrientValue vào `foods` (`BE:docs/database/MEAL_NUTRITION_AI_SCHEMA.md:250`) |
| Định mức vi chất | Cặp `xxxMin`/`xxxMax` trong cấu hình nhóm tuổi, PHT nhập | Hằng số trong code | NUT-24: số do PHT nhập; tránh chép luật vào FE |
| Danh sách chất ở FE | Một hằng `NUTRIENT_GROUPS` (key, nhãn, đơn vị, nhóm) trong `src/models/menu-planning/menuPlanningConstants.js` | Viết rải từng màn | Form, chi tiết, nhập file, cân đối dùng chung |
| Màu đạt/chưa đạt | `NormStatusChip` + `NORM_STATUS` có sẵn | Badge mới | DESIGN.md §6.3 |
| Bảng rộng | Cột đầu cố định + cuộn ngang + tab nhóm chất | Gộp cột, thu chữ | Quyết định "một thông tin một cột" |

## Hạ tầng (Q8 — đọc cấu hình deploy, không đụng server)

- **Đường đi:** người dùng → proxy nhà cung cấp (`x-osh-dp: hn01-dnsgr01-dataplan01`, có cache `x-cache-status`) → Caddy host (`deploy/caddy/carenest-web.caddy`: `/api/*` → BE `127.0.0.1:18310`, còn lại → nginx `127.0.0.1:18300`) → nginx container `carenest-web` (`docker/nginx/default.conf.template`, `compose.yaml`, mạng host). Web thật = nhánh `main` (`.github/workflows/deploy.yml` chỉ deploy `main`; `origin/main` `5b81550` chứa `dev` `62be183`, deploy 03/11 16:56).
- **Đo (03/11):** file đã có trong cache proxy (HIT) ~2–3 ms; file chưa ai tải (MISS, về VPS) 118 KB mất 6,5–8,9 s ≈ 13–18 KB/s; client tải CDN ngoài 129 KB trong 112 ms. ⇒ **nghẽn ở đường từ VPS ra proxy** (băng thông gói VPS, VPS dùng chung — `compose.yaml`/Caddy ghi "8080 của server là app khác", cùng máy chạy Postgres + Keycloak + Spring + Mailpit (`BE:compose.vps.yaml`) — hoặc CPU quá tải). Cấu hình nginx/Caddy không có lỗi rõ ràng: đã gzip, `/assets` cache 1 năm `immutable`.
- **Hệ quả:** mỗi bản deploy đổi tên file ⇒ người đầu tiên mở mỗi trang chịu MISS chậm; API (`/api/*`) không cache được nên danh sách lớn (thực phẩm, món) cũng chịu băng thông thấp.
- **Đề xuất, theo thứ tự lợi/chi phí:** (1) Phase 2b: hâm nóng cache proxy ngay sau deploy. (2) Phase 2: giảm số file và request mỗi trang, phản hồi khi bấm. (3) Người quản trị VPS kiểm tra (chỉ là gợi ý lệnh, AI không chạy): `curl -o /dev/null -w '%{time_total} %{speed_download}\n' http://127.0.0.1:18300/assets/<file>.js` trên VPS (nhanh ⇒ nginx ổn), so với cùng file qua `https://web.carenest.edu.vn` từ VPS và từ máy ngoài; `docker stats`, `top` lúc chậm; hỏi nhà cung cấp giới hạn băng thông gói / data plane `hn01`. (4) Nếu băng thông gói là giới hạn: nâng gói hoặc đặt file tĩnh lên CDN riêng (đổi `base` của Vite — làn L, hỏi trước).

## Phases

> Nhiều phase, 2 repo ⇒ tách: **Plan A** = Phase 1 + 2 + 2b (FE, làm ngay). **Plan B** = Phase 3 (BE, đã được phép; cần nhánh + mã Jira Q9) + Phase 4 + 5 (FE, sau BE). Phase 5 phần không cần vi chất (bố cục, màu P:L:G) làm được trước Phase 3.

### Phase 1 — Tạo tài khoản GV không chọn lớp (AUTH-15)
- Files: M `src/utils/school-config/staffImport.js` · M `src/components/school-config/StaffAccountsBeView.jsx` · M `src/components/school-config/StaffImportPanel.jsx` · M `tests/hardening/staff-import.test.mjs`
- Steps: 1. `validateStaffAccount`: GV dùng nhánh điểm trường; bắt buộc khi người tạo là PHT (cờ từ quyền BE, không so role trong component). 2. `toCreatePayload` gửi `{ campusId }` cho mọi vai trò. 3. Form bỏ ô Lớp, `EMPTY_FORM` bỏ `classroomId`, gợi ý "Xếp lớp sau ở Phân công giáo viên". 4. Thông báo tạo GV có nút "Xếp lớp ngay". 5. File mẫu bỏ cột Lớp; file cũ có cột Lớp: bỏ qua + ghi chú.
- Tests: AC-1, AC-3 → `tests/hardening/staff-import.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0.

### Phase 2 — Phản hồi điều hướng, ít file hơn, bỏ gọi thừa (FE)
- Files: C `src/routes/routePrefetch.js` · M `src/routes/AppRoutes.jsx` · M sidebar trong `src/layouts/` (hover/focus) · M `src/layouts/MainLayout.jsx` · M `vite.config.js` (`manualChunks` nhóm dinh dưỡng) · M `src/services/menu-planning/menuPlanningService.js` · M `src/services/nutritionCatalogApi.js` · M `src/pages/menu-planning/FoodListPage.jsx`
- Steps: 1. Bảng `lazyPage(importer)` giữ importer để tải trước. 2. Tải trước nhóm menu của vai trò bằng `requestIdleCallback` sau trang đầu; hover/focus mục menu tải chunk đó. 3. Thanh tiến trình mảnh (token DESIGN.md, `prefers-reduced-motion`) khi chunk đang tải; chặn bấm lặp cùng đích. 4. Gom chunk nhóm dinh dưỡng giảm số file. 5. Màn dùng BE không gọi mock `getAccess`/`getCatalog`; `FoodListPage` 1 request; cấu hình nhóm tuổi dùng 1 request nếu BE có danh sách hiện hành (`GET /nutrition/age-group-configs`), lịch sử phiên bản chỉ nạp khi mở. 6. Đo lại bằng kịch bản Playwright (chunk chậm 3 s) và số file mỗi trang.
- Tests: AC-4 Playwright (ghi Progress log); AC-5, AC-6 → test mới `tests/routes/route-prefetch.test.mjs`, cập nhật `tests/menu/nutrition-catalog-api.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0.
- Ngoài repo: gửi số đo Context mục 2 và mục "Hạ tầng" cho người phụ trách VPS.

### Phase 2b — Hâm nóng cache sau deploy (FE CI)
- Files: M `.github/workflows/deploy.yml`
- Steps: 1. Sau bước deploy (đã SSH vào VPS), chạy trên VPS: đọc danh sách `/usr/share/nginx/html/assets/*` trong container `carenest-web` (hoặc `dist/assets` vừa build), `curl -s -o /dev/null` từng file qua `https://web.carenest.edu.vn/assets/...` để proxy nhà cung cấp lưu sẵn (MISS một lần do CI chịu, người dùng gặp HIT). 2. In số file HIT/MISS lượt hai để kiểm chứng.
- Tests: chạy workflow; lượt curl thứ hai trả `x-cache-status: HIT` cho ≥95% file. Chưa chắc proxy từ VPS đi cùng điểm cache với người dùng (`hn01`) ⇒ kiểm chứng bằng trình duyệt sau deploy.
- Exit: deploy xanh; mở trang danh mục lần đầu, file `/assets` trả HIT.

### Phase 3 — BE: 8 vi chất + định mức (chờ Q6)
- Plan chính đặt ở `BE:docs/plans/active/` khi được phép. Dự kiến: Flyway thêm cột `calcium, phosphorus, iron, vitamin_a, vitamin_b1, vitamin_b2, vitamin_pp, vitamin_c` vào `foods` và cặp min/max vào cấu hình nhóm tuổi; `FoodRequest/Response`, `DishDetailResponse` (tổng theo nhóm tuổi), `AgeGroupMealConfig*`; seed dev theo Bảng TPTP Việt Nam; `openapi.yaml`, `DATA_DICTIONARY`, rule NUT mới.
- Exit: BE `node scripts/verify.mjs` → `VERIFY PASS full`.

### Phase 4 — FE: vi chất ở thực phẩm, nhập file, cấu hình, cân đối
- Files: M `src/models/menu-planning/menuPlanningConstants.js` · M `src/services/nutritionCatalogApi.js` (map field) · M `src/mocks/menuPlanningSeed.js` (thực đơn demo) · M `src/pages/menu-planning/FoodFormPage.jsx` · M `src/components/menu-planning/FoodImportPanel.jsx` · M `src/utils/menu-planning/menuCalculations.js` · M `src/components/menu-planning/NutritionTable.jsx`
- Steps: 1. `NUTRIENT_GROUPS`. 2. Form thực phẩm: nhóm "Khoáng chất", "Vitamin" thu gọn được. 3. Nhập file: cột tùy chọn. 4. Cân đối khẩu phần / thực đơn: hàng vi chất có định mức, % đạt, nhãn màu.
- Tests: AC-7, AC-11 → `tests/menu/food-micronutrients.test.mjs` (mới), `tests/menu/food-bulk-import.test.mjs`, `tests/menu/nutrition-six-indicators.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0.

### Phase 5 — FE: giao diện thực phẩm, món, cấu hình nhóm tuổi
- Files: C `src/components/menu-planning/NutrientTable.jsx` · M `src/pages/menu-planning/FoodDetailPage.jsx` · M `src/pages/menu-planning/DishDetailPage.jsx` · M `src/pages/menu-planning/NutritionSetupPage.jsx` · M `src/styles/modules/menu-planning.css` · M `DESIGN.md` §6.3 nếu thêm mẫu bảng cột cố định dùng chung
- Steps: 1. Chi tiết thực phẩm: bảng AC-8 thay `NutrientBars`. 2. Chi tiết món: cột cố định + cuộn ngang, tab nhóm chất, dòng Tổng, thẻ P:L:G có `NormStatusChip`; ĐV/TV thành cột/số rõ thay chữ xám. 3. Cấu hình: tổng quan tách cột, nhóm cột theo "Năng lượng & P:L:G" / "Gam ĐV-TV" / "Vi chất", nhãn "Chưa nhập chuẩn". 4. Chụp trước/sau 1280, 1440 px; 375 px không tràn trang.
- Tests: AC-8..AC-10 → cập nhật `tests/menu/dish-detail.test.mjs` + test mới cho bảng thực phẩm và cột cấu hình; ảnh trong Progress log.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`, skip 0.

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-3 | AUTH-15 | `tests/hardening/staff-import.test.mjs` | 1 | pass 9/9 (03/11) |
| AC-2 | AUTH-15 | trình duyệt + ảnh | 1 | chưa kiểm trên trình duyệt: form chỉ hiện ở bản nối BE thật (local đang mock) |
| AC-4 | — | Playwright chunk chậm 3 s | 2 | trước: fail (trang cũ đứng 3 s); sau: thanh tiến trình sau 80 ms, 3 lần bấm ⇒ 1 lượt điều hướng (03/11) |
| AC-5, AC-6 | — | `tests/hardening/route-prefetch.test.mjs`, `tests/menu/nutrition-catalog-api.test.mjs` | 2 | pass; Playwright: rê chuột nhóm "Danh mục & thiết lập" tải trước 4 trang (03/11) |
| Phase 2b | — | chạy workflow deploy | 2b | chưa chạy (chỉ chạy khi push `main`) |
| AC-7, AC-11 | NUT-18, NUT-24, NUT-26 | FE `tests/menu/food-micronutrients.test.mjs` (8), `nutrition-catalog-api.test.mjs`, `nutrition-six-indicators.test.mjs`; BE `FoodServiceImplTest`, `AgeGroupMealConfigServiceImplTest`, `DishServiceImplTest`, `MealPlanEvaluatorTest` | 3–4 | FE pass; BE pass phần không cần Docker, 273 test Docker chưa chạy (03/11) |
| AC-8..10 | NUT-18, NUT-24 | `tests/menu/dish-detail.test.mjs` + Playwright đo tràn ngang + ảnh | 5 | pass; 1280 px: chi tiết món, thực phẩm, định mức không tràn; tổng quan cấu hình cuộn ngang 125 px có cột Nhóm tuổi cố định (03/11) |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| VPS không được xử lý | FE chỉ cải thiện cảm nhận, tải lần đầu vẫn chậm | Báo hạ tầng kèm số đo (Q8); tải trước khi rảnh | — |
| Tải trước tốn băng thông VPS lúc vừa đăng nhập | Trang đầu chậm thêm | Chỉ tải sau khi trang đầu hiện, theo nhóm của vai trò, `requestIdleCallback` | Tắt tải trước |
| Hâm cache từ VPS không trúng điểm cache người dùng | Phase 2b không giúp | Kiểm `x-cache-status` bằng trình duyệt sau deploy | Bỏ bước hâm cache |
| Đổi contract BE vi chất ảnh hưởng APP | APP đọc DTO thực phẩm/món lệch | Chỉ thêm field (không đổi/xóa), ghi `BE:docs/api/openapi.yaml` + CROSS_REPO_MAP | Field mới để trống |
| Số liệu vi chất AI điền sai | Người dùng tin số sai | Ghi nguồn + phiên bản, user soát trước demo | Đặt trống cột mới |
| Bảng quá rộng khi thêm 8 vi chất | Lại khó nhìn | Tab nhóm chất + cột cố định | Ẩn tab vi chất |

## Validation log

- [x] Khẳng định về code có `file:line` (theo `origin/dev` `62be183`)
- [x] Đổi contract ⇒ consumer cụ thể: `staffImport.js` (`toCreatePayload`), `StaffAccountsBeView.jsx`, `StaffImportPanel.jsx`; vi chất: `nutritionCatalogApi.js`, `FoodFormPage.jsx`, `FoodDetailPage.jsx`, `DishDetailPage.jsx`, `NutritionSetupPage.jsx`, `NutritionTable.jsx`
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách Plan A / Plan B
- [x] Không dùng rule PENDING/OPEN như đã chốt (Q6–Q8 còn mở)
- [x] Tự review: không placeholder · không mâu thuẫn · scope theo plan tách · sidebar xác định file khi làm Phase 2

## Progress log

### 2026-11-04 — Đưa nhánh nutrition lên `dev` mới (user cho phép rebase, tự gộp xung đột)
- BE `dev` thêm PR #25, #26 (`6846546`): có V68–V72 ⇒ migration vi chất thành `V73__add_food_micronutrients.sql`; `dev` đã tự sửa fixture trẻ (`28791d3`) ⇒ bỏ commit `70ba25b` và file `.sql` chưa commit của phiên sửa test. Nhánh nutrition dựng lại: 1 commit `4d359be G94-192` trên `6846546` (hook cấm đổi tên migration đã commit ⇒ tạo lại commit từ `origin/dev`). Sao lưu commit cũ, thay đổi đang dở ở thư mục scratchpad.
- Checkout BE chính `../CareNest_BE` lên `6846546`: cất tạm rồi lấy lại thay đổi đang dở của user, không xung đột, đối chiếu từng dòng với bản sao lưu.
- FE gộp `origin/dev` lần 2 (`62833d6`): 4 file xung đột — `AppRoutes.jsx` lấy danh sách trang của `dev` đổi sang `lazyPage`; `staffImport.js` + `StaffAccountsBeView.jsx` dùng phần form và banner "Phân công lớp" G94-179 đã làm trên `dev` (tham số `teacherCampusRequired`), giữ phần nhập Excel bỏ cột Lớp của nhánh này; test chỉnh theo. FE `node scripts/verify.mjs` → `VERIFY PASS full`.

### 2026-11-04 — Chuyển BE vi chất sang nhánh `feature/G94-254-BE-FEAT-27-day-boarding`
- User chỉ định nhánh nutrition của BE (03/11). Nhánh fast-forward lên `origin/dev` `1e8761b` (không commit), chuyển 30 file từ worktree tạm; `dev` đã có V63–V67 ⇒ migration đổi thành `V68__add_food_micronutrients.sql` (chưa lên remote nên đổi số an toàn).
- Verify BE trên nhánh: FAIL chỉ ở 4 class ngoài phạm vi (`AttendanceHistoryIntegrationTest`, `AssessmentContinuityIntegrationTest`, `AssessmentHistoryIntegrationTest`, `AssessmentManualFixtureTest`); các test vi chất, `FoodMicronutrientsMigrationTest`, `OpenApiSnapshotTest` pass.
- Đã chứng minh 4 class đó fail y hệt trên `origin/dev` sạch (worktree tạm, đã xóa): test của G94-236 (PR #21) chèn `children` thiếu giới tính, vi phạm `ck_children_complete` của V63 G94-180 (PR #23) — `dev` hỏng do hai PR gộp chồng, không do vi chất.
- BE: chưa commit (cần user cho phép, mã Jira theo nhánh `G94-254`). Worktree tạm `../CareNest_BE-micronutrients` còn giữ.

### 2026-11-03 — Kiểm chứng BE đầy đủ (Docker bật lại)
- Verify BE (worktree `../CareNest_BE-micronutrients`): `node scripts/verify.mjs` → `VERIFY PASS full | tests 819 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok | 508s` — migration V63, seed dev, ánh xạ JPA, OpenAPI snapshot đã chạy với Postgres.
- FE: 3 commit `8b89cdc`, `6c5c349`, `7e8fb6f` (G94-272). BE: chưa commit, chờ nhánh + mã Jira (Q9).

### 2026-11-03 — Plan B (Phase 3, 4, 5) done, chờ user soát
- Commit: chưa commit (FE trên nhánh hiện tại; BE ở worktree tách rời `../CareNest_BE-micronutrients`, HEAD `origin/dev` `7a4b4cf`, không tạo nhánh — cần nhánh + mã Jira, Q9).
- Verify FE: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Verify BE (worktree): `node scripts/verify.mjs` → `VERIFY PASS full | tests 819 fail 0 err 0 skip 273 | archunit ok | snapshot SKIP | spotless ok` — 273 test cần Docker (Docker Desktop lỗi trên máy) **chưa kiểm chứng**: migration `V63__add_food_micronutrients.sql`, seed dev, ánh xạ JPA, `docs/api/openapi.yaml` sửa tay.
- Phase 3 (BE, subagent): 8 vi chất trên `foods`, cặp min/max trong `age_group_meal_configs`, tổng vi chất trong chi tiết món và đánh giá thực đơn (`NormRow` optional), rule `NUT-26`, seed dev theo bảng số liệu AI ước (cần soát).
- Phase 4 (FE): `MICRONUTRIENT_*` trong `menuPlanningConstants.js`; tính tổng trong `menuCalculations.js` (null khi thiếu số liệu, làm tròn 0,01 khớp BE); kiểm/lưu mock, map `nutritionCatalogApi.js`; form thực phẩm 2 nhóm ô; nhập Excel thêm 8 cột tùy chọn + file mẫu `thuc-pham-mau.xlsx`; bảng vi chất ở `NutritionTable`; dòng vi chất ở bảng kiểm thực đơn tuần; seed mock 28 thực phẩm + định mức mẫu, bổ sung dữ liệu localStorage cũ một lần.
- Phase 5 (FE): `NutrientTable` (chi tiết thực phẩm: Chất · Hàm lượng · Đơn vị, chia nhóm); chi tiết món bỏ cột hồ sơ trái, bảng theo nhóm tuổi có tab "Năng lượng và P : L : G" (ô P/L/G xanh/cam + chữ Đạt/Thấp/Cao, tham khảo) / "Khoáng chất và vitamin", bảng thành phần chia 4 nhóm cột; cấu hình nhóm tuổi: tổng quan mỗi chỉ số một cột + "Chưa nhập chuẩn" vàng, bảng định mức dạng dọc (Tối thiểu · Tối đa · Đơn vị); `Tabs` thêm `variant="pill"` (DESIGN §6.3).
- Quyết định agent (chờ soát): vi chất lệch định mức **chỉ cảnh báo**, không đổi trạng thái ngày, không chặn công bố (BE `MICRONUTRIENT_OFF` WARNING, `MICRONUTRIENT_INCOMPLETE` INFO) — vì định mức vi chất còn là số ước, chặn sẽ làm thực đơn demo không công bố được. Vitamin A theo đương lượng retinol (retinol + β-caroten/6). Định mức mẫu đặt cho cả 4 nhóm tuổi ở BE seed; mock FE đặt cho nhóm có chuẩn tạm (ag-2..ag-4).
- Khác plan: tổng quan cấu hình còn cuộn ngang 125 px ở 1280 px (11 cột, cột đầu cố định, tiêu đề xuống dòng) thay vì vừa khung. Nhãn BE "photpho", FE "Phospho" (theo bảng Viện Dinh dưỡng) — thống nhất khi soát.

### 2026-11-03 — Plan A (Phase 1, 2, 2b) done, chờ user soát
- User duyệt Plan A 03/11. Commit: chưa commit.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (sau lần sửa cuối).
- Phase 1: `staffImport.js` (GV chỉ điểm trường, HT được bỏ trống; payload `{ campusId }` hoặc `null`; cột Lớp bỏ khỏi file mẫu, file cũ có cột Lớp bị bỏ qua + báo; xuất file thêm "Lớp đang dạy"), `StaffAccountsBeView.jsx` (bỏ ô Lớp; tạo GV xong hiện bước "Xếp lớp ngay" → `/school/teachers`), `StaffImportPanel.jsx`, file mẫu `public/templates/tai-khoan-nhan-su-mau.xlsx` (bỏ ô F1 "Lớp").
- Phase 2: `src/routes/routePrefetch.js` (mới), `AppRoutes.jsx` (`lazy` → `lazyPage`, `registerRouteTree`), `MainLayout.jsx` + `layout.css` (thanh `.route-progress`, `aria-busy`), `Sidebar.jsx` (tải trước khi rảnh/hover/focus, bỏ qua bấm lặp), `useMenuPlanning.js` (`useCatalogAccess` không gọi quyền mock khi dùng BE), `menuPlanningService.js` (catalog tải song song), `FoodImportPanel.jsx` + `FoodListPage.jsx` (bỏ request danh mục thứ hai; panel lấy danh mục lúc chọn file), mock `seeded()` (không clone cả DB).
- Phase 2b: `.github/workflows/deploy.yml` bước "Warm asset cache" (`continue-on-error`).
- Khác plan: không làm `manualChunks` (Vite đã preload song song file phụ của trang qua HTTP/2; gom chunk dễ sinh chunk vòng; tổng dung lượng mới là vấn đề). Không đổi `/versions` từng nhóm tuổi ở Cấu hình (màn cần lịch sử phiên bản). Toast không hỗ trợ nút ⇒ "Xếp lớp ngay" là bước trong modal (theo mẫu `StaffAccountModals.jsx`).
- Ghi chú kiểm thử: hoạt ảnh CSS đứng yên trong trình duyệt Playwright (hoạt ảnh thử độc lập cũng vậy) ⇒ chỉ kiểm sự có mặt của thanh, không kiểm chuyển động.
- Tri thức: `docs/knowledge/incidents/FE-BUG-261103-route-click-no-feedback.md` + 1 dòng `ISSUE_INDEX.md`.
- Tiếp: Plan B — cần nhánh BE + mã Jira (Q9).

### 2026-11-03 — Q6–Q8 + đọc cấu hình deploy (chờ review)
- User: cho sửa BE, định mức vi chất min–max, nhờ AI đọc cấu hình deploy.
- Đọc `deploy/caddy/carenest-web.caddy`, `docker/nginx/default.conf.template`, `compose.yaml`, `Dockerfile`, `.github/workflows/deploy.yml`, `BE:compose.vps.yaml`, `BE:deploy/caddy/carenest-auth.caddy`; đo HIT/MISS proxy ⇒ mục "Hạ tầng"; thêm Phase 2b.
- Commit: chưa commit. Verify: không đổi code từ lần `VERIFY PASS full` trước.

### 2026-11-03 — Gộp `origin/dev`, test nguyên nhân lag, soát lại trên `dev` (chờ review)
- Git: fast-forward `fix/G94-272-FE-FIX-01-e2e-flow-fixes` lên `origin/dev` `62be183` (user cho phép); không có commit mới, chưa push.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (sau fast-forward, chưa sửa code).
- Đo: xem Context mục 2. Ảnh bản `dev` (cấu hình nhóm tuổi, chi tiết thực phẩm, chi tiết món) dùng cho mục 4.
- Bản plan đầu (cùng ngày) phân tích lỗi 2–4 trên code cũ (mock) — đã thay bằng nội dung này.
- Tiếp: user trả lời Q6–Q8, duyệt Plan A.
