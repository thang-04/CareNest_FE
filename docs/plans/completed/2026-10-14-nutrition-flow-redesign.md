---
title: Thiết kế lại luồng dinh dưỡng 5 bước (Thiết lập → Món ăn & thực phẩm → Thực đơn mẫu → Thực đơn tuần → Khẩu phần & đi chợ)
status: done
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [nutrition]
rules: [NUT-05, NUT-06, NUT-07, NUT-08, NUT-09, NUT-10, AI-01, AI-02, AI-03, AI-04]
risk: high
created: 2026-10-14
updated: 2026-10-15
---
# Thiết kế lại luồng dinh dưỡng 5 bước

## Context
- Nhóm menu "Thực đơn" hiện có 8 mục rời nhau (`src/layouts/menuConfig.js:83-91`, `:142`): Thực phẩm, Món ăn, Giá suất ăn, Thực đơn mẫu, Thực đơn thay thế, Thực đơn tuần, Gợi ý AI, Cân đối dinh dưỡng; HT có thêm Kế hoạch thực đơn (`:91`). Định lượng thực phẩm nằm ở nhóm Bếp (`:95`, `src/routes/AppRoutes.jsx:370`).
- Người dùng muốn một luồng theo bước như MISA EMIS, giao diện theo `DESIGN.md`, AI dùng đúng chỗ.
- BE chưa có API dinh dưỡng (`BE:docs/modules/nutrition.md` mục "API & bảng: Chưa có"); FE chạy trên mock repository (`src/services/menu-planning/menuPlanningService.js`, `mock/menuPlanningMockRepository.js`).
- Bố cục chọn qua 3 vòng wireframe: 60 bố cục (14/10), tối ưu theo ảnh MISA EMIS (`D:/CAPSTONE_FALL26/misa_ui_sources/images`, 40 ảnh SET/DISH/FOOD/TPL/BAL), rồi 8 bố cục mỗi màn (scratchpad `nutrition-misa8.html`). User chốt 15/10/2026:

| Bước | Màn | Bố cục chốt (số trong `nutrition-misa8.html`) |
| --- | --- | --- |
| 0 | Quy trình | 1 · Hàng ngang 6 bước có icon và trạng thái, bấm để mở (MISA SET-01) |
| 1 | Thiết lập dinh dưỡng | 1 · Tab "Nhóm độ tuổi" / "Bữa ăn"; mỗi nhóm tuổi một bảng xếp dọc: bữa + đơn giá từng bữa, khoảng năng lượng và đạm/béo/bột, dòng Tổng, "+ Thêm bữa ăn" (MISA SET-02, SET-05..07) |
| 2a | Món ăn (danh sách) | 1 · Loại món bên trái + bảng (MISA DISH-01) |
| 2a | Sửa món | 4 · Thông tin món ở trên; bảng thành phần có một cột định lượng cho mỗi nhóm tuổi; **cột phải "Dinh dưỡng 1 suất" theo nhóm tuổi + "Kiểm tra tự động"** (MISA DISH-04) |
| 2b | Thực phẩm | 1 · Nhóm thực phẩm bên trái + bảng; cột hệ số thải bỏ và "Hay dùng" (MISA FOOD-01) |
| 3 | Thực đơn mẫu (danh sách) | 4 · **Thẻ chia theo nhóm tuổi** (mỗi nhóm một khu thẻ; nhóm chưa có mẫu có nút "AI soạn mẫu") (MISA TPL-01) |
| 3 | Sửa thực đơn mẫu | 5 · Bữa ăn bên trái (mỗi bữa một bảng, ngân sách bữa) + **thư viện món bên phải để thêm nhanh**; khung "AI soạn thực đơn mẫu" ở đầu; "Kiểm tra tự động" dưới các bữa (MISA TPL-06) |
| 4 | Thực đơn tuần | 4 · **Cột là các thứ, dòng là loại món** (Cơm, Món mặn, Canh, Món rau, Tráng miệng, Bữa xế); đầu cột chọn thực đơn mẫu; khung "Ngày cần xử lý" và bảng cân đối chung ở cuối |
| 5 | Khẩu phần & đi chợ | 7 · **Bảng cần mua gộp theo thực phẩm** + cột phải tóm tắt Tổng thu / Tổng chi / Chênh lệch và "Kiểm tra tự động" (MISA BAL-03, BAL-08) |

## Quyết định đã chốt
1. Kiến trúc thông tin: một luồng 5 bước nằm dưới nhóm "Thực đơn"; mỗi bước giữ route riêng — user, 14/10/2026.
2. Giao diện theo `DESIGN.md` (token, card kính bo 32, nút viên thuốc, bảng sọc); không ảnh món; icon Tabler qua `src/components/ui/icons.js` — user, 14/10/2026.
3. ~~Định mức một giá trị + ngưỡng lệch~~ → **thay bằng quyết định 14** — user, 14/10/2026.
4. Thiết lập: PHT sửa, HT chỉ xem — user, 14/10/2026 (đề xuất cập nhật P-07, chưa ghi BE).
5. Dữ liệu chuẩn theo văn bản nhà nước; hiện là mock, màn hiển thị "Căn cứ" — user, 14/10/2026.
6. Thực đơn mẫu = thực đơn một ngày theo từng bữa, dùng lại khi xếp thực đơn tuần — user, 14/10/2026.
7. ~~AI ở bước 2/3/4~~ → **thay bằng quyết định 19** — user, 15/10/2026.
8. Thực đơn tuần: bảng chung "Cân đối dinh dưỡng cả tuần" (mỗi dòng một ngày: đạm/béo/bột g và %, năng lượng, tiền ăn, đánh giá; dòng cuối là chuẩn) ở cuối trang, không đặt dòng kiểm tra dưới từng ngày — user, 14/10/2026.
9. Bước 5 chỉ tính và in phiếu; không kho, không nhà cung cấp (NUT-11 OPEN, ADR-0009) — user, 14/10/2026.
10. Thực đơn tuần giữ luồng hiện tại: PHT tự xuất bản (Bản nháp → Đã xuất bản, thay thế bằng phiên bản mới); HT chỉ xem, không có Duyệt/Trả lại — user, 14/10/2026.
11. Thiết lập theo 4 nhóm tuổi đang có `ag-2..ag-5` (Nhà trẻ, MG bé, MG nhỡ, MG lớn) — user, 14/10/2026.
12. Gộp các màn cũ vào 5 bước và bỏ khỏi menu: Giá suất ăn → bước 1; Thực đơn thay thế → suất thay thế ở bước 4 và 5; Gợi ý thực đơn AI và Cân đối dinh dưỡng → bước 4; Kế hoạch thực đơn (HT) → HT xem thực đơn tuần đã xuất bản — user, 14/10/2026.
13. Bước 5 làm lại trang `/kitchen/required-quantity` đang có (PHT và bếp dùng chung); mục 5 trong luồng trỏ tới trang này — user, 14/10/2026.
14. Định mức theo **khoảng min → max** như MISA: năng lượng/ngày và tỷ lệ đạm, béo, bột; khớp `NUTRITION_NORMS` min–max đang có (`src/models/menu-planning/menuPlanningConstants.js:131`) — user, 14/10/2026.
15. ~~Đơn giá theo từng bữa~~ → **giá suất ăn một ngày cho mỗi nhóm tuổi, bữa ăn không có giá**; thực đơn mẫu và tuần so chi phí với giá ngày — user, 15/10/2026 (thay quyết định 14/10).
16. Sửa công thức món và soạn thực đơn mẫu trên **trang sửa riêng** như MISA (danh sách → bấm → trang toàn màn hình) — user, 14/10/2026.
17. Bước 5 thêm theo MISA: **hệ số thải bỏ → lượng mua**, **Tổng thu / Tổng chi / Chênh lệch** (chỉ để xem). Bảng: ban đầu chọn bữa → món → thành phần; **15/10 user chọn bố cục 7 gộp theo thực phẩm** (thay phần bảng) — user, 14–15/10/2026.
18. Thêm trang **Quy trình** làm điểm vào luồng; giữ điều hướng bằng sidebar theo DESIGN.md, không thêm thanh tab ngang như MISA — mình đề xuất, user duyệt cùng plan.
19. AI chỉ ở **hai điểm**, đúng luồng `BE:docs/business/flows/meal-management.md` (AI gợi ý thực đơn): **AI soạn thực đơn mẫu** (một ngày) và **AI soạn thực đơn tuần** (chọn mẫu cho từng ngày, kèm lý do; ngày lỗi có "AI đề xuất cách sửa"). Có form điều kiện (nhóm tuổi, định mức, dị ứng số tổng hợp, không lặp món, mùa, mong muốn). Bỏ AI ở Món ăn. Mọi cảnh báo tính được bằng quy tắc (thiếu năng lượng, vượt đơn giá, lệch tỷ lệ, dị ứng, thiếu định lượng, thiếu số liệu) mang nhãn **"Kiểm tra tự động"**, tách khỏi AI — user, 15/10/2026.
20. Thiết lập cho **thêm và đổi tên bữa**, nhưng chỉ trong phần thực đơn (Thiết lập, mẫu, tuần, cân đối, đi chợ); điểm danh/báo ăn và bếp giữ bữa gốc. Bữa thêm chọn "Tính suất theo" một bữa gốc; bữa gốc không xóa được — user, 15/10/2026.
21. Giữ giá theo ngày hiệu lực và lịch sử (GBR-GEN-06): Thiết lập có "Giá mới áp dụng từ ngày" (từ hôm nay trở đi), sửa lại giá đã áp dụng từ chính ngày đó phải có lý do, có "Lịch sử giá" — user, 15/10/2026.
22. Định mức lưu ở Thiết lập **áp dụng ngay** cho mọi kiểm tra (thực đơn mẫu, tuần, cân đối, AI gợi ý) — user, 15/10/2026.
23. Giữ bật/tắt nhóm tuổi: nhóm tắt ẩn khỏi tab Bữa ăn, Quy trình không đếm; ẩn khỏi chọn nhóm tuổi ở thực đơn mẫu/tuần làm ở plan (B) — user, 15/10/2026.
24. Suất thay thế dị ứng nằm trong trang sửa thực đơn mẫu; bảng tuần: bữa trưa tách hàng theo loại món, bữa khác mỗi bữa một hàng; thực đơn tuần là một trang chọn nhóm tuổi + tuần — user, 15/10/2026 (chi tiết plan B).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor PHT (soạn, xuất bản), HT (xem), Bếp (xem phiếu bước 5). Outcome: thực đơn tuần được xuất bản và phiếu đi chợ in được.
  Rule: NUT-05/06/08/09/10 (CONFIRMED) · NUT-07 (CONFIRMED luồng, công thức P-10 PENDING) · NUT-13 (PENDING P-07) · AI-01/04 (ACCEPTED) · AI-02/03 (CONFIRMED).
  Flow: [S] thiết lập định mức → [S] món/thực phẩm → [S] thực đơn mẫu → [S] AI nháp tuần → [B] PHT xem từng ngày, sửa → [B] PHT xuất bản (NUT-08: PHT là người có quyền theo luồng hiện tại) → [S] số suất CONFIRMED × định lượng (NUT-07) → [B] in phiếu.
- **Đối chiếu thiết kế ban đầu:**
  - Thực đơn tuần hiện do PHT **xuất bản** trực tiếp (`src/pages/menu-planning/WeeklyMenuDetailPage.jsx:31`, `:61-63`, UC 6.8) — wireframe từng có bước gửi duyệt cho HT; **đã chốt giữ luồng xuất bản của PHT** (quyết định 10), wireframe sửa nút "Gửi duyệt" thành "Xuất bản".
  - Nhóm tuổi hệ thống có 4 nhóm `ag-2..ag-5` (`src/models/School.js:28-33`), định mức hiện là khoảng min–max (`src/models/menu-planning/menuPlanningConstants.js:131`) — wireframe dùng 2 nhóm; **đã chốt 4 nhóm** (quyết định 11). Định mức giữ khoảng min–max (quyết định 14).
  - Bữa ăn hiện 3 phiên `MORNING/LUNCH/AFTERNOON` (`menuPlanningConstants.js:110-116`) — thiết kế cho bật/tắt 5 bữa ⇒ cần BE lưu cấu hình bữa theo nhóm tuổi.
- **Ảnh hưởng:** module nutrition; route `/menu/*`, `/kitchen/required-quantity`; điều hướng theo role (menuConfig) ⇒ làn L; cần BE contract mới cho định mức theo nhóm tuổi; trạng thái thực đơn tuần giữ nguyên; APP không đổi.

### Câu hỏi mở
Đã trả lời hết (bảng dưới).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Ai duyệt thực đơn tuần? | PHT tự xuất bản như hiện tại; HT chỉ xem | user | 14/10/2026 | Chưa; đề xuất ghi rõ actor của NUT-08 ở BE (cần user cho phép sửa BE) |
| Mấy nhóm tuổi ở bước 1? | 4 nhóm `ag-2..ag-5` | user | 14/10/2026 | — |
| Màn cũ ngoài luồng? | Gộp vào 5 bước, bỏ khỏi menu (quyết định 12) | user | 14/10/2026 | `docs/architecture/ROUTE_MAP.md` (Phase 1) |
| Bước 5 ở đâu? | Làm lại `/kitchen/required-quantity` | user | 14/10/2026 | `docs/architecture/ROUTE_MAP.md` (Phase 1) |

## Acceptance criteria
- **AC-1** (điều hướng): Given PHT đăng nhập, When mở nhóm "Thực đơn", Then thấy đúng 5 mục theo thứ tự bước và mỗi mục mở đúng route; không còn mục Giá suất ăn, Thực đơn thay thế, Gợi ý AI, Cân đối dinh dưỡng; route cũ chuyển hướng về bước tương ứng. HT thấy các bước ở chế độ chỉ xem.
- **AC-2** (bước 1, P-07 đề xuất): Given PHT mở tab Bữa ăn, When sửa tên bữa, thêm bữa (chọn bữa tính suất), đơn giá từng bữa, khoảng năng lượng và khoảng đạm/béo/bột của một nhóm tuổi, chọn ngày áp dụng giá rồi Lưu, Then dòng Tổng cộng đơn giá ngay, ô min > max bị báo trước khi gửi, giá mới thành một mức trong Lịch sử giá, định mức áp dụng ngay cho các kiểm tra; tab Nhóm độ tuổi bật/tắt áp dụng 4 nhóm; HT thấy chỉ đọc, không có nút Lưu.
- **AC-3** (NUT-05, NUT-06): Given danh sách món lọc theo loại món ở bên trái, When mở một món, Then trang sửa riêng hiện bảng thành phần có một cột định lượng cho mỗi nhóm tuổi áp dụng, dòng năng lượng do hệ thống tính, cột phải "Dinh dưỡng 1 suất" theo nhóm tuổi; cột còn thiếu được đánh dấu và có cảnh báo; khối "Kiểm tra tự động" nêu thiếu định lượng và vượt ngưỡng; không có AI ở màn này.
- **AC-4** (NUT-05): Given trang Thực phẩm, When chọn nhóm bên trái, Then bảng phải lọc theo nhóm, có cột hệ số thải bỏ và "Hay dùng"; dòng thiếu số liệu đánh dấu cần bổ sung; không có điểm nhập AI.
- **AC-5** (NUT-06, AI-01): Given trang sửa thực đơn mẫu, When thêm/bỏ món, Then ngân sách từng bữa và khối "Kiểm tra tự động" (năng lượng, tỷ lệ, chi phí so với khoảng định mức) cập nhật ngay; thư viện món bên phải thêm nhanh món vào bữa; danh sách mẫu chia theo nhóm tuổi; "AI soạn mẫu" (có form điều kiện) tạo bản nháp có nhãn và lý do; cảnh báo nằm trong khối "Kiểm tra tự động"; với lỗi, "AI đề xuất cách sửa" có Áp dụng / Bỏ qua.
- **AC-6** (NUT-08, NUT-09, AI-02, AI-03, AI-04): Given tuần đang soạn, When mở trang, Then bảng có cột là các thứ, dòng là loại món (Cơm, Món mặn, Canh, Món rau, Tráng miệng, Bữa xế), đầu cột chọn thực đơn mẫu, thêm/bỏ món trong ô; bảng cân đối chung ở cuối tô màu ô thấp/cao hơn chuẩn; gợi ý AI có Áp dụng / Bỏ qua; AI lỗi vẫn soạn tay được; dữ liệu gửi AI chỉ là số trẻ dị ứng tổng hợp; suất thay thế dị ứng hiện ngay trong ô món. PHT có nút Xuất bản (xác nhận trước khi xuất bản) và Tạo phiên bản thay thế sau khi đã xuất bản; HT không có nút sửa hay xuất bản.
- **AC-7** (NUT-07, NUT-10, NUT-11): Given số suất CONFIRMED và thực đơn đã xuất bản, When PHT hoặc bếp mở `/kitchen/required-quantity`, Then có thẻ Tổng thu / Tổng chi / Chênh lệch; bảng gộp theo thực phẩm với lượng ăn cả trường, hệ số thải bỏ, lượng mua = lượng ăn ÷ (1 − thải bỏ), làm tròn theo ĐVT, đơn giá, thành tiền; cột phải tóm tắt thu/chi và "Kiểm tra tự động" (suất thay thế dị ứng, điều kiện trước khi in); không có chức năng kho/NCC.
- **AC-9** (điều hướng): Given PHT mở "Thực đơn", When vào mục Quy trình, Then thấy 6 bước có trạng thái và bấm mở đúng màn.
- **AC-8** (DESIGN.md mục 9): Mỗi màn có đủ trạng thái đang tải, rỗng, lỗi; không cuộn ngang ở 768–1440px.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Bố cục từng màn | Bảng "Context" ở trên | 9 bố cục khác mỗi màn; bố cục chọn lần đầu (danh sách trái, sửa phải) | User chọn sau khi xem 60 bố cục, rồi tối ưu theo ảnh MISA |
| Định mức | Khoảng min → max | Một giá trị + ngưỡng lệch | User chốt theo MISA; khớp model min–max đang có |
| Nơi sửa món / mẫu | Trang sửa riêng | Panel / cột phải | Bảng 4 nhóm tuổi nhiều cột cần chiều rộng |
| Thực đơn tuần | Cột là thứ, dòng là loại món + bảng cân đối chung | Dòng là bữa; dòng là thứ; tab ngày | User chọn 15/10; giống sổ thực đơn MISA |
| Vị trí AI | Soạn thực đơn mẫu + soạn thực đơn tuần | Thêm AI ở Món ăn; thêm trợ lý hỏi đáp | User chốt; khớp luồng AI duy nhất ở BE; cảnh báo quy tắc không gắn nhãn AI |
| Luồng thực đơn tuần | PHT xuất bản (giữ code hiện tại) | Thêm bước HT duyệt | User chốt; không cần đổi trạng thái ở BE |
| Màn cũ | Gộp vào 5 bước, route cũ chuyển hướng | Giữ song song | User chốt; menu gọn, không trùng chức năng |
| Nơi giữ dữ liệu khi chưa có BE | Mock repository hiện có, bổ sung hàm | Gọi API tạm | BE chưa có API; giữ đúng lớp service hiện tại |

## Phases
Plan vượt 8 file và 3 phase ⇒ **tách thành 3 plan con** (user duyệt 15/10/2026): (A) `docs/plans/completed/2026-10-15-nutrition-flow-a-frame-setup-dish-food.md`; (B) `docs/plans/completed/2026-10-15-nutrition-flow-b-templates-weekly.md`; (A) khung + bước 1–2 (Phase 1–3), (B) bước 3–4 (Phase 4–5), (C) bước 5 (Phase 6). Mỗi plan con chép phần liên quan của plan này; plan này giữ vai trò plan tổng.

### Phase 1 — Khung luồng và điều hướng
- Files: M `src/layouts/menuConfig.js` · M `src/routes/AppRoutes.jsx` · M `docs/architecture/ROUTE_MAP.md` · M `src/styles/modules/menu-planning.css` (nếu có, hoặc C)
- Steps: 1. Nhóm "Thực đơn" gồm Quy trình + các bước (Thiết lập, Món ăn, Thực phẩm, Thực đơn mẫu, Thực đơn tuần, Khẩu phần & đi chợ); mục cuối trỏ `/kitchen/required-quantity`; thêm trang Quy trình. 2. Route mới cho bước 1; route `/menu/prices`, `/menu/allergy-menus`, `/menu/ai-suggestion`, `/menu/nutrition`, `/menu/plans` chuyển hướng về bước tương ứng (không xóa file trang trong phase này). 3. Cập nhật ROUTE_MAP.
- Tests: AC-1 → kiểm tra cấu hình menu theo role (unit) + probe route.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0
- **Dừng chờ user review.**

### Phase 2 — Bước 1 Thiết lập (bố cục 1)
- Files: C NutritionSetupPage.jsx (file mới, thư mục `src/pages/menu-planning/`) · M `src/models/menu-planning/menuPlanningConstants.js` · M `src/services/menu-planning/menuPlanningService.js` · M `src/services/menu-planning/mock/menuPlanningMockRepository.js` · M `src/services/menu-planning/api/menuPlanningApi.js`
- Steps: tab Nhóm độ tuổi (bật/tắt 4 nhóm) và tab Bữa ăn (mỗi nhóm một bảng: bữa + đơn giá từng bữa — chuyển từ Giá suất ăn, khoảng năng lượng, khoảng đạm/béo/bột, dòng Tổng); căn cứ; chỉ đọc cho HT.
- Tests: AC-2, AC-8.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0
- **Dừng chờ user review.**

### Phase 3 — Bước 2 Món ăn (bố cục 1, sửa món 4) & Thực phẩm (bố cục 1)
- Files: M `src/pages/menu-planning/DishListPage.jsx` · M `src/pages/menu-planning/DishFormPage.jsx` · M `src/pages/menu-planning/FoodListPage.jsx` · M `src/components/menu-planning/DishPortionTable.jsx`
- Steps: Món ăn: danh sách loại món trái + bảng; trang sửa riêng có cột định lượng theo nhóm tuổi, cột phải dinh dưỡng 1 suất và "Kiểm tra tự động", không có AI (dùng `DishFormPage.jsx`). Thực phẩm: nhóm trái + bảng, thêm hệ số thải bỏ, hay dùng.
- Tests: AC-3, AC-4, AC-8.
- **Dừng chờ user review.**

### Phase 4 — Bước 3 Thực đơn mẫu (danh sách 4, sửa 5)
- Files: M `src/pages/menu-planning/MenuListPage.jsx` (thẻ chia theo nhóm tuổi) · M `src/pages/menu-planning/MenuFormPage.jsx` (bữa trái, thư viện món phải) · M `src/components/menu-planning/MealEditor.jsx` · M `src/components/menu-planning/NutritionTable.jsx`
- Tests: AC-5, AC-8.
- **Dừng chờ user review.**

### Phase 5 — Bước 4 Thực đơn tuần (bố cục 4)
- Files: M `src/pages/menu-planning/WeeklyMenuFormPage.jsx` · M `src/pages/menu-planning/WeeklyMenuDetailPage.jsx` · M `src/components/menu-planning/WeekDaysView.jsx` · M `src/components/menu-planning/WeekChecks.jsx`
- Tests: AC-6, AC-8.
- **Dừng chờ user review.**

### Phase 6 — Bước 5 Khẩu phần & đi chợ (bố cục 7)
- Files: M `src/pages/kitchen/RequiredFoodQuantityPage.jsx`
- Tests: AC-7, AC-8.
- **Dừng chờ user review.**

## Contract BE cần thống nhất (chưa sửa repo BE)
- Thiết lập theo nhóm tuổi (đang dùng ở mock, `src/services/menu-planning/api/menuPlanningApi.js`): `GET/PUT /menu/nutrition-setups`; mỗi nhóm `{ ageGroupId, enabled, basis, price, childCount, meals: [{ code, name, countAs }], norms: { kcal: [min, max], protein, lipid, glucid } }`; PUT nhận thêm `effectiveFrom`, `reason`; `price` (giá ngày) lưu thành bản ghi meal-price theo ngày áp dụng. Bữa thêm có `countAs` = mã bữa gốc để lấy số suất đã chốt — cần BE xác nhận (đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`).
- Thực phẩm thêm `wastePct` (hệ số thải bỏ) và `favorite` (hay dùng); công thức lượng mua phụ thuộc P-10 (PENDING).
- Công thức món: định lượng theo từng nhóm tuổi (`portions: { [ageGroupId]: number | null }`).
- Trạng thái thực đơn tuần: giữ như hiện tại (Bản nháp → Đã xuất bản → Đã thay thế).
- Gợi ý AI: lưu ở module nutrition với `source=AI`, model, thời điểm (AI-01); FE chỉ gửi tham số tuần, nhóm tuổi, số trẻ dị ứng tổng hợp (AI-04).
- Đề xuất cập nhật tri thức BE (cần user cho phép sửa BE): P-07 (PHT sửa thiết lập, HT xem), định mức theo khoảng min–max và đơn giá từng bữa, hệ số thải bỏ (P-10), trường "căn cứ".

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | menuConfig theo role (unit) | 1 | chưa chạy |
| AC-2 | P-07 | NutritionSetupPage (component) | 2 | chưa chạy |
| AC-3, AC-4 | NUT-05, NUT-06 | DishListPage, FoodListPage (component) | 3 | chưa chạy |
| AC-5 | NUT-06, AI-01 | MenuListPage (component) | 4 | chưa chạy |
| AC-6 | NUT-08, NUT-09, AI-02..04 | WeeklyMenu (component) | 5 | chưa chạy |
| AC-7 | NUT-07, NUT-10, NUT-11 | Bước 5 (component) | 6 | chưa chạy |
| AC-8 | DESIGN.md mục 9 | probe 768/1024/1440 | 1–6 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE chưa có API, contract còn đổi | Làm lại lớp service | Giữ shape trong mock, ghi contract đề xuất ở trên | Mock giữ nguyên hàm cũ |
| Gộp màn cũ làm mất chức năng đang dùng | Người dùng mất lối vào | Mỗi chức năng cũ có chỗ mới (quyết định 12), kiểm ở Phase 1 | Khôi phục mục menu cũ |
| Route cũ còn được bookmark | Người dùng vào trang không còn trong menu | Chuyển hướng về bước tương ứng | Bật lại mục menu cũ |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể (mục "Contract BE cần thống nhất")
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi (Phase 3–6 dùng cùng Exit Phase 1–2)
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách plan
- [x] Không dùng rule PENDING/OPEN như đã chốt (P-07, P-10, NUT-11 ghi rõ PENDING/OPEN)
- [x] Tự review: không placeholder · không mâu thuẫn · câu hỏi mở đã trả lời hết

## Progress log
### 2026-10-14 — Lập plan (chờ duyệt)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Câu hỏi mở: đã trả lời 4/4.
- Tiếp: user duyệt plan và đồng ý tách 3 plan con; sau đó bắt đầu plan con (A) Phase 1.

### 2026-10-14 — Tối ưu bố cục theo ảnh MISA (chờ duyệt)
- Đối chiếu 40 ảnh MISA; user chốt quyết định 14–17; mình đề xuất 18 (trang Quy trình).
- Wireframe: scratchpad `nutrition-misa.html` (9 màn, PHT/HT, rỗng/lỗi), probe 1440/1024/768 sạch.
- Commit: chưa commit. Verify: chưa chạy (chưa sửa code).

### 2026-10-15 — 8 bố cục mỗi màn + sửa AI (chờ chọn)
- Wireframe: scratchpad `nutrition-misa8.html` (9 màn × 8 bố cục, có tích chọn và sao chép), probe 1440/1024/768 sạch.
- Quyết định 19 thay quyết định 7.
- Commit: chưa commit. Verify: chưa chạy (chưa sửa code).

### 2026-10-15 — Chốt bố cục 9 màn
- User chọn: Quy trình 1 · Thiết lập 1 · Món ăn 1 · Sửa món 4 · Thực phẩm 1 · Thực đơn mẫu 4 · Sửa mẫu 5 · Thực đơn tuần 4 · Đi chợ 7.
- Lưu ý khi code: bố cục tuần 4 trong wireframe chỉ có ô chữ; khi dựng sẽ thêm thao tác sửa trong ô (bỏ món ×, "+ Thêm món") như bố cục 1 vì user từng yêu cầu thấy rõ chỗ thêm/sửa món.
- Commit: chưa commit. Verify: chưa chạy (chưa sửa code).

### 2026-10-15 — User duyệt plan
- `status: approved`; tách plan con (A) khung + bước 1–2. Sửa các dòng còn theo bố cục cũ (AC-3, AC-5, AC-6, AC-7, tiêu đề phase) cho khớp bố cục chốt.
- Commit: chưa commit. Verify: chưa chạy (chưa sửa code).
- Tiếp: plan con (A) Phase 1.

### 2026-10-15 — Plan (A) Phase 2 xong
- Quyết định 20–23 (user). Chi tiết ở plan (A).

### 2026-10-15 — Plan (A) xong, lập plan (B)
- Plan (A) Phase 1–3 xong, verify PASS. Plan (B) draft chờ duyệt; quyết định 24.

### 2026-10-15 — User đổi quyết định 15
- Bữa ăn không có giá, chỉ giá suất ăn một ngày cho mỗi nhóm tuổi; thẻ nhóm ở Thiết lập mặc định thu gọn, bấm mở chi tiết.

### 2026-10-15 — Plan (A), (B), (C) xong, chuyển sang completed
- Cả 6 phase đã làm qua 3 plan con; user chấp nhận ("ok") ⇒ plan con `done`, ở `docs/plans/completed/`.
- Plan tổng giữ `in-progress` vì còn việc chờ user quyết: xóa 12 trang cũ không còn route; ghi tri thức sang BE (`countAs`, thải bỏ/làm tròn P-10, contract Thiết lập, AI, `GET /kitchen/required-quantities`); lỗi peer vite 8 / @vitejs/plugin-react 4; trang Thực đơn đã công bố của bếp gộp Bữa phụ sáng vào Bữa trưa.

### 2026-10-15 — Đóng plan (user: "chưa ghép be, chỉ done ui là dc")
- Phạm vi chốt: xong giao diện + mock. Chưa ghép BE; mục "Contract BE cần thống nhất" và đề xuất ghi tri thức BE để lại cho đợt ghép API.
- Chưa làm (cần user cho phép riêng nếu muốn): xóa 12 trang cũ không còn route; lỗi peer vite 8 / @vitejs/plugin-react 4; trang Thực đơn đã công bố của bếp gộp Bữa phụ sáng vào Bữa trưa.
