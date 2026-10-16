---
title: Luồng dinh dưỡng (B) — Thực đơn mẫu và Thực đơn tuần
status: done
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [nutrition, ai-assistance]
rules: [NUT-06, NUT-08, NUT-09, AI-01, AI-02, AI-03, AI-04]
risk: high
created: 2026-10-15
updated: 2026-10-15
---
# Luồng dinh dưỡng (B) — Thực đơn mẫu và Thực đơn tuần

## Context
- Plan con (B) của plan tổng `docs/plans/completed/2026-10-14-nutrition-flow-redesign.md` (Phase 4–5). Plan (A) xong: `docs/plans/completed/2026-10-15-nutrition-flow-a-frame-setup-dish-food.md`.
- Bố cục chốt: Thực đơn mẫu danh sách 4 (thẻ chia theo nhóm tuổi), sửa 5 (bữa trái, thư viện món phải); Thực đơn tuần 4 (cột là thứ, dòng là loại món). Wireframe: scratchpad `nutrition-misa8.html`.
- Hiện trạng code (rà 15/10/2026):
  - Bữa ăn cố định 3 mã MORNING/LUNCH/AFTERNOON qua `sessionsOf` (`src/models/menu-planning/menuPlanningConstants.js:110-116`). `normalizeMeals` bỏ mọi mã khác mà không báo (`src/utils/menu-planning/menuCalculations.js:198-204`). Các chỗ dùng: `validateMenu` (`src/utils/menu-planning/menuPlanningValidation.js:130-135`), mock `suggestDay` (`src/services/menu-planning/mock/menuPlanningMockRepository.js:227-233`), `buildDays` (`:271`), `saveMenu` (`:690`), `saveDayAdjustment` (`:925`), MealEditor, MealsView, AllergenWarnings (chỉ nhãn).
  - Thực đơn mẫu: `db.menus` `{ ageGroupId, meals: [{ session, items: [{ dishId, portion }] }] }`. Thực đơn thay thế: `db.allergyMenus` `{ baseMenuId, restrictions, replacements: [{ session, originalDishId, replacementDishId, portion }] }`.
  - Thực đơn tuần: `db.weeklyMenus` `{ ageGroupId, weekStart, days: [{ date, holiday, menuId, meals }], status DRAFT|PUBLISHED|REPLACED, version, replacesId, aiDraftId }`. Xuất bản `:937-962`, phiên bản thay thế `:964-992`, sửa ngày `:917-935`. HT chỉ thấy bản đã xuất bản (`:291`).
  - AI: `generateAiSuggestion({ kind: WEEKLY|DAILY, ageGroupId, weekStart, avoidAllergens })` (`:1006-1054`), mock sinh theo quy tắc (`generator: 'RULE_BASED_FALLBACK'`), bản nháp `PENDING_REVIEW → APPLIED|DISMISSED`, nhãn `AI_LABEL` (`src/models/menu-planning/menuPlanningConstants.js:170`).
  - Màn sẽ gộp: AiMenuSuggestionPage (249 dòng), NutritionBalancePage (315), AllergyMenu List/Form/Detail (186/341/228), MenuPlanList/Detail (HT, 136/121), WeeklyMenuList/Form/Detail (186/282/296).
  - Chưa có test cho thực đơn mẫu, thực đơn tuần, AI, thực đơn thay thế.

## Quyết định đã chốt
1. Theo plan tổng, quyết định 1–23 — user, 14–15/10/2026.
2. Suất thay thế dị ứng nằm **trong trang sửa thực đơn mẫu** (giữ dữ liệu `allergyMenus`: mỗi mẫu có các bản thay thế theo dị ứng, món → món thay); ô món ở thực đơn tuần hiện "⚠ n trẻ → món thay". Bỏ màn Thực đơn thay thế, route cũ chuyển hướng — user, 15/10/2026.
3. Bảng thực đơn tuần: **cột là các thứ; bữa trưa tách hàng theo loại món** (Cơm, Món mặn, Canh, Món rau, Tráng miệng), **mỗi bữa khác một hàng** (Bữa phụ sáng, Bữa chiều, bữa thêm) — user, 15/10/2026.
4. **Một trang thực đơn tuần** `/menu/weekly`: chọn nhóm tuổi + tuần ở đầu trang, hiện bản nháp hoặc bản đã xuất bản của tuần đó (trạng thái, phiên bản); tuần chưa có thì "Soạn tay / AI soạn tuần / Sao chép tuần trước". Bỏ trang danh sách và form riêng — user, 15/10/2026.
5. Bữa thêm lưu bằng **mã riêng** của bữa (mã ở Thiết lập); `countAs` chỉ dùng khi tính số suất (bếp, đi chợ — plan C) — mình đề xuất theo quyết định 20.
6. Thử sửa thực đơn đã xuất bản mà không lưu (tính năng của trang Cân đối cũ) **bỏ**; muốn đổi bản đã xuất bản thì tạo phiên bản thay thế như hiện tại — mình đề xuất.
7. AI ở mock vẫn là bộ sinh theo quy tắc; giao diện ghi nhãn "Bản nháp AI – cần người duyệt" và lý do theo dữ liệu bản nháp. Các điều kiện mùa, mong muốn thêm được gửi kèm nhưng mock không dùng — ghi rõ ở Contract — mình đề xuất.

## Làm rõ nghiệp vụ
- Actor: PHT soạn, xuất bản; HT xem bản đã xuất bản (quyết định 10). Rule: NUT-06 (định lượng/dinh dưỡng), NUT-08/NUT-09 (xuất bản, phiên bản thay thế — CONFIRMED), AI-01..04 (bản nháp, người duyệt, AI tắt vẫn soạn tay, chỉ gửi số trẻ dị ứng tổng hợp).
- Câu hỏi mở: không có (đã trả lời 3/3 ngày 15/10/2026).

## Acceptance criteria
- **AC-B1** (bữa theo Thiết lập): Given nhóm tuổi có bữa thêm ở Thiết lập, When soạn thực đơn mẫu / tuần, Then bữa thêm hiện đúng tên và thứ tự, lưu không bị mất; nhóm tuổi tắt không có trong ô chọn nhóm tuổi.
- **AC-5** (plan tổng, bố cục chốt): danh sách mẫu là thẻ chia theo nhóm tuổi (nhóm chưa có mẫu có nút "AI soạn mẫu"); trang sửa: bữa bên trái (mỗi bữa một bảng; chi phí cả ngày so với giá suất ăn ngày ở Thiết lập), thư viện món bên phải thêm nhanh vào bữa đang chọn; "Kiểm tra tự động" (năng lượng, đạm/béo/bột, chi phí so với định mức); "AI soạn mẫu" có form điều kiện, tạo bản nháp có nhãn và lý do, Dùng / Bỏ; khối "Suất thay thế dị ứng".
- **AC-6** (plan tổng, bố cục chốt): bảng tuần theo quyết định 3; đầu cột chọn thực đơn mẫu và đánh dấu ngày nghỉ; trong ô bỏ món (×) và "+ Thêm món"; suất thay thế hiện trong ô; "Cần xem lại (n ngày)" (lỗi do kiểm tra tự động viết bằng lời thường + một nút "AI gợi ý cách sửa" cho cả tuần, mỗi ngày Đổi món / Để sau); bảng cân đối chung cuối trang (mỗi ngày đạm/béo/bột g và %, năng lượng, tiền ăn, đánh giá; dòng định mức; tô ô thấp/cao); "AI soạn tuần" mở modal: một câu tóm tắt điều kiện + Mùa, Mong muốn → xem trước cả tuần như bảng thật, lý do từng ngày dưới đầu cột, ô khác bản đang soạn tô nền → Dùng bản này / Soạn lại / Bỏ; PHT Xuất bản (xác nhận), Tạo phiên bản thay thế; HT chỉ xem; AI lỗi vẫn soạn tay được.
- **AC-1** (phần còn lại): menu PHT không còn Thực đơn thay thế, Gợi ý thực đơn AI, Cân đối dinh dưỡng; HT có Thực đơn tuần (chỉ xem) thay Kế hoạch thực đơn; route cũ chuyển hướng.
- **AC-8**: đủ trạng thái đang tải / rỗng / lỗi; không tràn trang ở 768–1440.

## Phases

### Phase B1 — Bữa ăn lấy từ Thiết lập (dữ liệu, chưa đổi giao diện)
- Files: M `src/utils/menu-planning/menuCalculations.js` (`normalizeMeals` theo danh sách mã) · M `src/utils/menu-planning/nutritionSetup.js` (`mealsOf`, `mealLabel`) · M `src/utils/menu-planning/menuPlanningValidation.js` · M `src/services/menu-planning/mock/menuPlanningMockRepository.js` (suggestDay, buildDays, saveMenu, saveDayAdjustment) · M `src/components/menu-planning/MealEditor.jsx`, `MealsView.jsx`, `AllergenWarnings.jsx` (nhãn) · M `src/pages/menu-planning/MenuFormPage.jsx` (danh sách bữa) · C test.
- Steps: 1. Hàm `mealsOf(setups, ageGroupId)` trả `[{ code, name }]` theo Thiết lập, chưa có thiết lập thì về bữa gốc. 2. Thay `sessionsOf` ở các chỗ trên. 3. Ô chọn nhóm tuổi ở màn mẫu/tuần chỉ còn nhóm đang bật.
- Tests: AC-B1 (unit: lưu mẫu có bữa thêm không mất; validate theo bữa của nhóm).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`. **Dừng chờ user review.**

### Phase B2 — Thực đơn mẫu (danh sách 4, sửa 5) + suất thay thế + AI soạn mẫu
- Files: M `src/pages/menu-planning/MenuListPage.jsx` · M `src/pages/menu-planning/MenuFormPage.jsx` · M `src/pages/menu-planning/MenuDetailPage.jsx` (chuyển sang trang sửa hoặc chỉ xem) · C thư viện món, khối AI soạn mẫu, khối suất thay thế (thư mục `src/components/menu-planning/`) · M mock + service + api (tham số điều kiện AI) · M `src/layouts/menuConfig.js`, `src/routes/AppRoutes.jsx` (bỏ Thực đơn thay thế, `/menu/allergy-menus/*` → `/menu/menus`) · C test.
- Tests: AC-5, AC-8; unit cho điều kiện AI (chỉ gửi số dị ứng tổng hợp) và lưu suất thay thế.
- Exit: như B1. **Dừng chờ user review.**

### Phase B3 — Trang thực đơn tuần (bố cục 4): bảng, sửa ô, cân đối, xuất bản, HT xem
- Files: C trang thực đơn tuần một trang + các khối bảng tuần, bảng cân đối, ngày cần xử lý (`src/pages/menu-planning/`, `src/components/menu-planning/`) · M mock (lấy tuần theo nhóm + tuần, sao chép tuần trước) · M `src/utils/menu-planning/menuPlanningPermissions.js` (HT đọc tuần đã xuất bản) · M routes, menuConfig (HT: Thực đơn tuần thay Kế hoạch thực đơn; `/menu/weekly/:id*`, `/menu/plans/*`, `/menu/nutrition` chuyển hướng) · C test.
- Tests: AC-6 (phần không AI), AC-1, AC-8.
- Exit: như B1. **Dừng chờ user review.**

### Phase B4 — AI soạn tuần + AI đề xuất sửa ngày + dọn màn cũ
- Files: C khối AI soạn tuần (form điều kiện, bản nháp có lý do từng ngày) · M "Ngày cần xử lý" thêm "AI đề xuất" (Áp dụng / Bỏ qua) · M mock (đề xuất sửa một ngày theo quy tắc) · M routes, menuConfig (bỏ Gợi ý thực đơn AI; `/menu/ai-suggestion` chuyển hướng) · xóa route trang cũ không còn dùng (xóa file khi user cho phép) · C test.
- Tests: AC-6 (phần AI: bản nháp có nhãn, Dùng / Bỏ, AI lỗi vẫn soạn tay), AI-04.
- Exit: như B1. **Dừng chờ user review.**

## Contract BE cần thống nhất (chưa sửa repo BE)
- Bữa trong thực đơn mẫu/tuần dùng mã bữa của Thiết lập (`meals[].session` = `code`, có thể là mã bữa thêm).
- Lấy tuần theo nhóm tuổi + tuần: `GET /menu/weekly-menus/current?ageGroupId&weekStart` (bản nháp mới nhất hoặc bản đã xuất bản); sao chép tuần trước: `POST /menu/weekly-menus/{id}/copy?weekStart`.
- AI soạn: `POST /menu/ai-suggestions` thêm `noRepeatDays`, `season`, `wishes` (mock không dùng mùa và mong muốn); đề xuất sửa một ngày: `kind: DAY_FIX` với `date`, `issue`. Bản nháp trả `reasons` theo ngày/món. Vẫn chỉ gửi số trẻ dị ứng tổng hợp (AI-04).
- Suất thay thế giữ shape `allergyMenus` hiện tại.

## Test matrix
| AC | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-B1 | bữa theo Thiết lập (unit) | B1 | chưa chạy |
| AC-5 | mẫu + suất thay thế + AI mẫu (unit, probe) | B2 | chưa chạy |
| AC-6, AC-1 | tuần, xuất bản, HT xem (unit, probe) | B3 | chưa chạy |
| AC-6 (AI), AI-04 | AI soạn tuần, đề xuất sửa (unit, probe) | B4 | chưa chạy |
| AC-8 | probe 768/1024/1440, PHT + HT | B2–B4 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi `normalizeMeals` làm mất bữa ở dữ liệu cũ | Thực đơn cũ thiếu bữa | Bữa gốc luôn có trong danh sách; test với dữ liệu mẫu | Trả về `sessionsOf` |
| Bếp có thể không đọc được thực đơn đã xuất bản (bếp tìm `dishIds`/`dishes`, dữ liệu là `items[].dishId`; bỏ qua MORNING và mã lạ — `src/services/kitchen/mock/kitchenMockRepository.js:133-176`) | Bếp không thấy thực đơn / bữa thêm | Chưa chạy thử; kiểm và sửa ở plan C (trang bếp) | — |
| Bỏ trang danh sách tuần | Mất chỗ xem các tuần cũ | Ô chọn tuần + danh sách phiên bản trong trang | Bật lại route cũ |
| Gộp nhiều màn trong một trang tuần | Trang nặng | Chia component, phase B3/B4 | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Contract BE cần đổi liệt kê cụ thể
- [x] >3 phase ⇒ đã chia 4 phase, mỗi phase dừng review
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Câu hỏi mở đã trả lời hết

## Progress log
### 2026-10-15 — Lập plan (B) (chờ duyệt)
- Rà code bằng agent; user chốt quyết định 2–4.
- Commit: chưa commit. Verify: chưa chạy (chưa sửa code).

### 2026-10-15 — Phase B1 xong (chờ review)
- User duyệt plan (B). Làm: `mealsOf` / `mealCodesOf` / `mealLabel` (`src/utils/menu-planning/nutritionSetup.js`) lấy bữa từ Thiết lập; `normalizeMeals` giữ thứ tự và mã bữa của nhóm (không còn lọc theo 3 bữa gốc); `validateMenu` đòi món cho mọi bữa của nhóm, báo bằng tên bữa; mock (AI soạn ngày điền cả bữa thêm, buildDays, saveMenu, saveDayAdjustment) dùng bữa của Thiết lập; nhãn bữa ở MealEditor, MealsView, AllergenWarnings, các trang mẫu/thay thế/cân đối theo tên ở Thiết lập; ô chọn nhóm tuổi ở form mẫu, form tuần, AI gợi ý chỉ còn nhóm đang bật.
- Test: `test:menu` 23/23 (thêm 4 test bữa theo Thiết lập). Probe: thêm "Bữa phụ chiều" cho MG nhỡ ở Thiết lập ⇒ form thực đơn mẫu hiện Bữa trưa | Bữa chiều | Bữa phụ chiều; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: Phase B2 Thực đơn mẫu.

### 2026-10-15 — Tạm dừng sau B1
- User chọn làm plan (A) Phase A4 (khớp wireframe 5 màn) trước; B2 làm sau, mỗi phase có ảnh so sánh với wireframe.

### 2026-10-15 — Phase B2 xong (chờ review)
- Danh sách (bố cục 4): mô tả; nút Thiết lập bữa ăn, AI soạn mẫu mới, Thêm thực đơn mẫu; ô tìm; mỗi nhóm tuổi đang bật là một khối **thu gọn mặc định** (theo góp ý "danh sách mặc định thu lại"), đầu khối "n mẫu · n đạt chuẩn · n cần xem"; mở ra là thẻ: tên, chip kết quả kiểm tra, số bữa, chi phí, kcal, 4 món đầu; nhóm chưa có mẫu có nút "AI soạn mẫu".
- Sửa (bố cục 5): EditHead (Hủy, Sao chép, Lưu); thẻ thông tin Tên, Nhóm tuổi, Trạng thái, Ghi chú thu gọn; khung "AI soạn thực đơn mẫu" + "Điều kiện cho AI" (nhóm tuổi, định mức và giá từ Thiết lập, số trẻ dị ứng tổng hợp, mùa, mong muốn) → bản nháp điền vào các bữa, nhãn "Bản nháp AI – cần người duyệt" + lý do, "Bỏ bản nháp"; mỗi bữa một bảng (Món, Loại, Kcal, Thành tiền, bỏ món; dòng món có trẻ dị ứng ghi số trẻ và món thay), "Chi phí bữa" (không còn ngân sách bữa — quyết định 15 mới); "Kiểm tra tự động" (thiếu bữa, năng lượng, tỷ lệ, chi phí / giá ngày, dị ứng đã/chưa có suất thay thế — `src/utils/menu-planning/menuChecks.js`); khối "Suất thay thế dị ứng" (thêm/sửa trong ngăn phải: chất cần tránh kèm số trẻ, món cần đổi → món cùng loại không chứa chất đó hoặc bỏ món); cột phải "Thêm nhanh từ danh mục" (chọn bữa, tìm, lọc loại, thêm).
- Gỡ màn Thực đơn thay thế khỏi menu, `/menu/allergy-menus/*` chuyển về `/menu/menus`; link cũ ở trang chi tiết mẫu và cảnh báo dị ứng trỏ về trang sửa mẫu. Mock AI soạn ngày trả `reasons`, lưu `conditions` (mùa, mong muốn — mock chưa dùng).
- Khác wireframe, có lý do: thêm thẻ thông tin (tên/nhóm tuổi cần cho mẫu mới); thư viện món có ô chọn bữa và lọc loại; chưa có dòng "AI đề xuất cách sửa" (Phase B4); danh sách nhóm tuổi thu gọn theo góp ý user.
- Lỗi tìm ra khi probe: lưu được suất thay thế không có món nào cần đổi ⇒ khóa nút Lưu khi không có món chứa chất đã chọn.
- Test: `test:menu` 31/31 (thêm 3: kiểm tra tự động, dị ứng/suất thay thế, bản nháp AI). Probe 768/1024/1440 không tràn; thêm món nhanh, thêm suất thay thế, AI soạn mẫu mới rồi lưu; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: Phase B3 trang thực đơn tuần (bố cục 4).

### 2026-10-15 — Phase B3 xong (chờ review)
- Trang một màn `/menu/weekly` (`src/pages/menu-planning/WeeklyMenuPage.jsx`): chọn nhóm tuổi + tuần ở đầu trang; trạng thái, mã, phiên bản, giờ xuất bản, danh sách phiên bản; tuần chưa có: Soạn tay / Sao chép tuần trước / (Dùng bản nháp AI nếu mở từ ?aiDraftId).
- Bảng tuần (`WeekGrid`, bố cục 4): cột là các thứ; đầu cột chọn thực đơn mẫu và ô "Nghỉ" (hỏi lý do); bữa trưa tách hàng Cơm, Món mặn, Canh, Món rau, Tráng miệng (thêm "Món khác (trưa)" nếu có), bữa khác mỗi bữa một hàng; trong ô bỏ món (×) và "+ Thêm" (chọn món đúng loại), mỗi thao tác lưu ngay bằng sửa ngày; dưới món có trẻ dị ứng ghi số trẻ và món thay hoặc "chưa có suất thay thế".
- "Ngày cần xử lý": gom theo ngày, mỗi dòng nhãn "Kiểm tra tự động" (thiếu thực đơn, năng lượng, tỷ lệ, chi phí, dị ứng chưa có suất thay thế, món mặn lặp 7 ngày tính cả tuần trước) — `weekIssues` trong `menuChecks.js`.
- Bảng "Cân đối dinh dưỡng cả tuần" (`WeekBalanceTable`): mỗi ngày đạm/béo/bột g và %, năng lượng, tiền ăn, đánh giá; dòng định mức; ô thấp tô xanh, cao tô cam.
- PHT: Sao chép tuần trước, Xuất bản (xác nhận, nêu số mục còn cần xử lý), Tạo phiên bản thay thế (lý do). HT: menu "Thực đơn tuần" (thay Kế hoạch thực đơn), chip "Chỉ xem", không có ô chọn/nút sửa, chỉ thấy bản đã xuất bản.
- Gỡ route trang cũ: danh sách/form/chi tiết tuần, Cân đối dinh dưỡng, Kế hoạch thực đơn ⇒ `/menu/weekly/:id`, `/menu/plans/:id` chuyển về `/menu/weekly?id=`, `/menu/nutrition`, `/menu/plans` về `/menu/weekly`; mục menu Cân đối dinh dưỡng bỏ; link thông báo cho HT, lối tắt "Tạo nhanh", dashboard HT trỏ trang mới.
- Khác wireframe: có "+ Thêm"/× trong ô (user từng yêu cầu thấy chỗ sửa món); khung AI soạn tuần và "AI đề xuất" cách sửa ngày ở Phase B4.
- Test: `test:menu` 34/34 (thêm 3: menu theo vai, ngày cần xử lý, HT chỉ đọc). Probe: tuần mới soạn tay → chọn mẫu 5 ngày → thêm/bỏ món → xuất bản; HT xem tuần đã xuất bản chỉ đọc, tuần chỉ có nháp thì báo chưa có; 768/1024/1440 không tràn; không lỗi console.
- File trang cũ không còn route (chờ user cho phép xóa): WeeklyMenuListPage, WeeklyMenuFormPage, WeeklyMenuDetailPage, NutritionBalancePage, MenuPlanListPage, MenuPlanDetailPage, AllergyMenuListPage/FormPage/DetailPage, MealPriceListPage/FormPage.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: Phase B4 AI soạn tuần + AI đề xuất sửa ngày + gỡ Gợi ý thực đơn AI.

### 2026-10-15 — Phase B4 xong (chờ review) — plan (B) xong
- AI soạn tuần (`AiWeekComposer`): khung "AI soạn thực đơn tuần" + "Điều kiện cho AI soạn tuần" (nhóm tuổi, định mức, số trẻ dị ứng tổng hợp, không lặp món mặn 7 ngày, mùa, mong muốn) → bảng "Bản nháp AI – cần người duyệt" (ngày, đang soạn, bản nháp, lý do của AI, kết quả kiểm tra tự động) → "Dùng bản nháp và sửa tiếp" (tạo tuần mới hoặc thay các ngày của bản nháp đang soạn, ghi `aiDraftId`) / "Bỏ bản nháp". Có ở tuần chưa có thực đơn và tuần đang là bản nháp ("AI soạn lại tuần").
- AI đề xuất sửa ngày: mỗi ngày ở "Ngày cần xử lý" có nút "AI đề xuất cách sửa" → dòng "AI đề xuất: A → B (+kcal · +đ)" + lý do + Áp dụng / Bỏ qua. Mock `DAY_FIX`: bữa trống ⇒ thêm món; còn lại thử đổi từng món sang món cùng loại, chọn phương án giảm lệch định mức (năng lượng, đạm/béo/bột), vượt giá và món mặn lặp nhiều nhất; không tìm được thì báo để sửa tay. Áp dụng qua `applyDayFix` (ghi vết bản nháp đã dùng). AI chỉ nhận món của ngày và mã món mặn gần đây, không có dữ liệu trẻ.
- Gỡ màn Gợi ý thực đơn AI: mục menu bỏ; `/menu/ai-suggestion?kind=DAILY` → `/menu/menus/new?ai=1`, còn lại → `/menu/weekly`.
- Lỗi tìm ra khi probe: bộ đề xuất ban đầu chỉ xử lý bữa trống/năng lượng/giá nên 3/3 ngày lỗi tỷ lệ báo "không tìm được" ⇒ viết lại theo điểm lệch tổng.
- Test: `test:menu` 37/37 (thêm 3: bản nháp tuần có lý do + chỉ số tổng hợp, đề xuất sửa ngày + áp dụng + chặn áp dụng lại, thiếu tham số). Probe: AI soạn tuần → dùng bản nháp → AI đề xuất sửa Thứ Hai (đổi canh để béo, bột về định mức) → áp dụng; 768/1024 không tràn; không lỗi console.
- File trang cũ không còn route (chờ user cho phép xóa): thêm AiMenuSuggestionPage.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: plan (C) Khẩu phần & đi chợ (bố cục 7) + kiểm tra bếp đọc thực đơn đã xuất bản.

### 2026-10-15 — AI dễ hiểu cho giáo viên (user: "các màn AI gợi ý khó nhìn quá ... giáo viên cũng khó hiểu")
- User chọn: xem trước bản AI tuần trong modal; một nút gợi ý cho cả tuần.
- Kiểm tra tự động viết bằng lời thường (`menuChecks.js`): "Hơi ít năng lượng (thiếu khoảng 60 kcal)", "Ít chất béo, nhiều tinh bột", "Vượt tiền ăn 1.300 đ", "Món X lặp lại (đã ăn Thứ Hai 16/11)", "Có món chứa sữa bò (1 trẻ dị ứng), chưa có suất thay thế". Nhãn trạng thái: Đủ chất / Thiếu bữa / Ít năng lượng / Nhiều năng lượng / Vượt tiền ăn / Chưa cân đối / Thiếu số liệu. Con số để riêng (`numbers`) trong "Xem số liệu" của khối Kiểm tra tự động; bỏ chip "Tính bằng quy tắc" lặp lại, thay bằng một dòng ghi chú.
- Thực đơn tuần: nút "AI soạn tuần" ở đầu trang và trạng thái rỗng mở modal (`AiWeekComposer`): câu tóm tắt ("AI sẽ chọn thực đơn mẫu của trường ... tránh tôm (1 trẻ) ..."), chỉ Mùa + Mong muốn sửa được → bảng tuần chỉ xem (`WeekGrid` thêm `dayNotes`, `isNew`) + cảnh báo khi thiếu thực đơn mẫu → Dùng bản này / Soạn lại / Bỏ. "Ngày cần xử lý" → "Cần xem lại (n ngày)" với một nút "AI gợi ý cách sửa" (gợi ý tuần tự, món vừa gợi ý tính là đã dùng); mỗi ngày "Gợi ý: đổi A → B" + Đổi món / Để sau + một dòng kết quả sau khi đổi.
- Thực đơn mẫu: nút "AI soạn mẫu" ở đầu trang mở modal (`AiTemplateComposer`): tóm tắt + Mùa/Mong muốn → món từng bữa, "Vì sao AI chọn", kết quả kiểm tra → Dùng bản này điền vào form; banner "Bản nháp AI – cần người duyệt" có Hoàn tác.
- Mock AI: `suggestWeek` ưu tiên mẫu đạt kiểm tra (tính cả dị ứng, suất thay thế), lý do ngắn; thiếu mẫu đạt thì trả `shortage` + `note`. `suggestDay` thử nhiều tổ hợp, giữ tổ hợp đạt. `suggestDayFix` không đưa món có chất nhóm dị ứng.
- Lỗi tìm ra khi probe: FE-BUG-261015-ai-fix-ignores-allergy (đã sửa); đầu cột bảng trong modal chồng chữ (thêm xuống dòng cho `.td-week__day`).
- Test: `test:menu` 40/40 (sửa câu chữ; thêm: AI mẫu giữ tổ hợp đạt, AI tuần ưu tiên ngày đạt, gợi ý sửa không đưa món dị ứng). Probe: modal AI tuần → dùng → gợi ý cả tuần → đổi món; modal AI mẫu → dùng → Xem số liệu → Hoàn tác; HT không thấy nút AI; 768/1024 không tràn; không lỗi console.
- Verify: xem báo cáo. Commit: chưa commit.

### 2026-10-15 — User chấp nhận kết quả, đóng plan
- User trả lời "ok" sau báo cáo cuối của plan (C) ⇒ đóng plan (A), (B), (C): `status: done`, chuyển sang `docs/plans/completed/`.
