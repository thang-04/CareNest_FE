---
title: Luồng dinh dưỡng (A) — khung điều hướng, Quy trình, Thiết lập, Món ăn & Thực phẩm
status: done
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [nutrition]
rules: [NUT-05, NUT-06]
risk: high
created: 2026-10-15
updated: 2026-10-15
---
# Luồng dinh dưỡng (A) — khung, Quy trình, Thiết lập, Món ăn & Thực phẩm

## Context
- Plan con (A) của plan tổng `docs/plans/completed/2026-10-14-nutrition-flow-redesign.md` (user duyệt 15/10/2026). Quyết định, AC, contract BE, rủi ro: xem plan tổng; ở đây chỉ phần làm của (A).
- Phạm vi: Phase 1–3 của plan tổng — AC-1 (phần khung), AC-2, AC-3, AC-4, AC-8, AC-9.
- Bố cục chốt (wireframe scratchpad `nutrition-misa8.html`): Quy trình 1, Thiết lập 1, Món ăn 1, Sửa món 4, Thực phẩm 1.

## Quyết định đã chốt
1. Theo plan tổng, quyết định 1–19 — user, 14–15/10/2026.
2. Gỡ mục menu cũ **khi màn thay thế đã có**, không gỡ hết ở Phase 1: Giá suất ăn gỡ ở Phase 2 (Thiết lập thay); Thực đơn thay thế, Gợi ý AI, Cân đối dinh dưỡng, Kế hoạch thực đơn (HT) gỡ ở plan (B); "Khẩu phần & đi chợ" chuyển sang nhóm Thực đơn ở plan (C) — mình đề xuất để không mất chức năng giữa chừng (rủi ro "Gộp màn cũ" của plan tổng).
3. Thứ tự mục trong nhóm "Thực đơn" theo trang Quy trình: Quy trình, Thiết lập, Thực phẩm, Món ăn, Thực đơn mẫu, Thực đơn tuần (thực phẩm trước món vì món tạo từ thực phẩm) — mình đề xuất.
4. **Phase A4 — làm 5 màn đã dựng khớp chi tiết wireframe** trước khi làm tiếp plan (B) (user, 15/10/2026, sau khi đối chiếu ảnh app với wireframe: khung đúng nhưng thiếu nhiều chi tiết).
5. Thiết lập: ngày áp dụng giá + lý do chuyển vào **hộp xác nhận khi bấm Lưu**; "Căn cứ" mở bằng link "Căn cứ và hướng dẫn" — user, 15/10/2026.
6. Món ăn: làm **Thư viện tham khảo** — danh mục món chung do BE cung cấp, chỉ đọc; chép món về thì **tự thêm thực phẩm còn thiếu** (kèm dinh dưỡng, chưa có đơn giá); bộ lọc dị ứng/trạng thái gộp vào nút **"Lọc thêm"** — user, 15/10/2026.
7. Thực phẩm: làm **Chỉnh sửa hàng loạt**, **Nhập khẩu cập nhật (Excel)**, nhãn **Bảo quản: tươi / khô**; lọc "Chỉ hay dùng" bằng ô tích như wireframe — user, 15/10/2026.
8. Đọc file Excel bằng dependency **`read-excel-file`** (chỉ đọc .xlsx); file mẫu .xlsx cố định trong `public/` — user duyệt thêm dependency 15/10/2026.

## Làm rõ nghiệp vụ
Xem plan tổng mục "Làm rõ nghiệp vụ". Câu hỏi mở: không có.

## Acceptance criteria
AC-1 (phần khung), AC-2, AC-3, AC-4, AC-8, AC-9 — nguyên văn ở plan tổng.

## Phases

### Phase 1 — Khung điều hướng + trang Quy trình
- Files: M `src/layouts/menuConfig.js` · M `src/routes/AppRoutes.jsx` · M `src/components/ui/icons.js` · M `src/utils/menu-planning/breadcrumbs.js` · M `src/styles/modules/menu-planning.css` · M `docs/architecture/ROUTE_MAP.md` · M `package.json` (thêm script test, không đổi dependency) · C trang Quy trình, hàm tính trạng thái bước, test (đường dẫn ở Progress log khi tạo).
- Steps: 1. Mục "Quy trình" (`/menu/flow`) đầu nhóm Thực đơn của PHT; sắp lại mục theo quyết định 2–3. 2. Trang Quy trình: 6 bước hàng ngang có icon, trạng thái lấy từ dữ liệu đang có, bấm mở đúng màn; có trạng thái đang tải / lỗi. 3. ROUTE_MAP thêm dòng luồng dinh dưỡng.
- Tests: menuConfig theo role + hàm trạng thái bước (unit, `node --test`); probe 768/1024/1440.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`
- **Dừng chờ user review.**

### Phase 2 — Thiết lập dinh dưỡng (bố cục 1)
- Files: theo Phase 2 plan tổng + gỡ mục Giá suất ăn, `/menu/prices` chuyển hướng `/menu/setup`; HT thấy Thiết lập chỉ xem. Theo quyết định 20–23 plan tổng: thêm/đổi tên bữa, giá theo ngày áp dụng + lịch sử, định mức đã lưu dùng cho mọi kiểm tra.
- Tests: AC-2, AC-8. Exit như Phase 1. **Dừng chờ user review.**

### Phase 3 — Món ăn (1) + Sửa món (4) + Thực phẩm (1)
- Files: theo Phase 3 plan tổng.
- Tests: AC-3, AC-4, AC-8. Exit như Phase 1. **Dừng chờ user review.**

### Phase A4 — Khớp wireframe 5 màn (chi tiết theo quyết định 4–8)
Cách kiểm: script chụp app cạnh wireframe (`nutrition-misa8.html`, bố cục đã chọn) ở 1440/1024/768; mỗi màn ghi danh sách khác biệt còn lại = 0 hoặc có lý do trong Progress log.

- **A4.1 — Dùng chung + Quy trình + Thiết lập**
  - Dùng chung: dòng mô tả trong đầu trang; component EditHead (quay lại, tiêu đề, thông tin phụ, nút cùng một hàng); nút "Lọc thêm" (danh sách lọc phụ trong ô nổi).
  - Quy trình: tiêu đề "Quản lý dinh dưỡng", mô tả, nhãn bước như wireframe, nút "Thiết lập thông tin dinh dưỡng" cuối khối.
  - Thiết lập: tab "Nhóm độ tuổi | Bữa ăn"; link "Căn cứ và hướng dẫn tổ chức bữa ăn" mở ngăn phải (PHT sửa, HT đọc); đầu thẻ nhóm: tên, độ tuổi, số trẻ (mock trả `childCount` theo nhóm), công tắc Áp dụng, link nhỏ "Lịch sử giá"; đầu cột Đạm/Béo/Bột có màu; ô giá có "đ"; mũi tên giữa hai ô khoảng; bỏ thẻ ngày áp dụng — Lưu mở hộp xác nhận có "Giá mới áp dụng từ ngày" + lý do; tab Nhóm độ tuổi chia Nhà trẻ / Mẫu giáo, có số trẻ.
  - Files: M `src/pages/menu-planning/NutritionFlowPage.jsx`, `NutritionSetupPage.jsx`, `src/styles/modules/menu-planning.css`, `src/styles/components.css` (mô tả đầu trang) · M mock + service (`childCount`) · C EditHead, FilterMore (`src/components/menu-planning/`) · C script so sánh (thư mục `scripts/`).
- **A4.2 — Món ăn + Sửa món + Thư viện tham khảo**
  - Món ăn: mô tả; nút Thư viện tham khảo + Thêm món ăn; lọc: tìm, định lượng, Lọc thêm (dị ứng, trạng thái); bảng: chip dị ứng cạnh tên (bỏ dòng mã), nhóm tuổi viết tắt, chip Đủ/Thiếu có icon, nút "…" (Xem, Sửa).
  - Thư viện tham khảo: ngăn phải rộng; tìm + lọc loại; mỗi món: thành phần, nhóm tuổi, kcal; "Thêm vào món của trường" → báo trước thực phẩm sẽ tự thêm → chép món + thực phẩm thiếu → mở trang sửa. Mock: bộ món minh họa (ghi "Dữ liệu minh họa"), `listReferenceDishes`, `copyReferenceDish`.
  - Sửa món: EditHead; thẻ thông tin: Tên, Loại món, Nhóm trẻ áp dụng (chip chỉ xem, tính từ cột đủ định lượng), hàng 2: Trạng thái, Mô tả (giữ vì cần ngừng dùng món); dòng đã có hiện tên thực phẩm dạng chữ, dòng mới có ô chọn; ô trống tô cam "Nhập"; cột phải "Dinh dưỡng 1 suất" và "Kiểm tra tự động" dạng danh sách có dấu tích + chip "Tính bằng quy tắc".
  - Files: M `DishListPage.jsx`, `DishFormPage.jsx`, `DishPortionTable.jsx`, `AutoChecks.jsx` · C ngăn thư viện (`src/components/menu-planning/`) · M mock, service, api, seed (món tham khảo) · C test.
- **A4.3 — Thực phẩm + Bảo quản + Sửa hàng loạt + Nhập khẩu**
  - Thực phẩm: mô tả; nút Nhập khẩu cập nhật, Chỉnh sửa hàng loạt, Thêm thực phẩm; lọc: tìm, ô tích "Chỉ hay dùng", Lọc thêm (số liệu, dị ứng, trạng thái); bỏ mục "Hay dùng" ở danh mục; cột: Mã TP, Tên (nhóm · tươi/khô), Đơn giá, Đơn vị, Thải bỏ %, Kcal, Đạm, Béo, Bột, Dị ứng, Hay dùng.
  - Trường `storage: FRESH | DRY` (form, chi tiết, seed).
  - Sửa hàng loạt: ô Đơn giá, Thải bỏ, Kcal, Đạm, Béo, Bột thành ô nhập, ô đã đổi tô màu; thanh "Đang sửa hàng loạt" + Hủy / Lưu n thay đổi; lỗi tại ô; mock `saveFoodsBulk` (validate từng dòng, ghi một lần).
  - Nhập khẩu: tải file mẫu, chọn .xlsx → đọc bằng `read-excel-file` → xem trước 3 nhóm Mới / Cập nhật (khớp theo mã) / Lỗi (lý do) → xác nhận ghi các dòng hợp lệ qua `saveFoodsBulk`.
  - Files: M `FoodListPage.jsx`, `FoodFormPage.jsx`, `FoodDetailPage.jsx` · C khối sửa hàng loạt, ngăn nhập khẩu, hàm đọc/đối chiếu file (`src/utils/menu-planning/`) · C `public/templates/thuc-pham-mau.xlsx` · M `package.json` + lockfile (`read-excel-file`, bản cố định) · M mock, service, api, validation · C test.
- Tests: AC-2, AC-3, AC-4, AC-8 + unit: số trẻ theo nhóm, chép món tham khảo (thêm thực phẩm thiếu), sửa hàng loạt (lỗi từng dòng), đối chiếu file nhập (mới/cập nhật/lỗi).
- Exit mỗi bước A4.x: `node scripts/verify.mjs` → `VERIFY PASS full` + ảnh so sánh. **Dừng chờ user review sau mỗi bước.**
- Contract BE đề xuất: `GET /menu/reference-dishes`, `POST /menu/reference-dishes/{id}/copy`; `PUT /menu/foods/bulk`; thực phẩm thêm `storage`; thiết lập trả `childCount` theo nhóm (đếm trẻ đang học).

## Test matrix
| AC | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-1 (khung), AC-9 | menuConfig + trạng thái bước (unit), probe | 1 | chưa chạy |
| AC-2 | Thiết lập (unit hàm tính + probe) | 2 | chưa chạy |
| AC-3, AC-4 | Món ăn, Thực phẩm (unit hàm tính + probe) | 3 | chưa chạy |
| AC-8 | probe 768/1024/1440 | 1–3 | pass (Phase 1–3) |
| Khớp wireframe | ảnh so sánh app/wireframe | A4.1–A4.3 | chưa chạy |

## Rủi ro & rollback
Như plan tổng. Riêng (A): menu đổi thứ tự ⇒ người dùng quen vị trí cũ; rollback = trả mảng mục trong `menuConfig.js`.

## Validation log
- [x] Khẳng định về code có `file:line` (ở plan tổng)
- [x] Mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] Không dùng rule PENDING/OPEN như đã chốt

## Progress log
### 2026-10-15 — Tạo plan con (A)
- User duyệt plan tổng và việc tách plan. Bắt đầu Phase 1.
- Commit: chưa commit. Verify: chưa chạy.

### 2026-10-15 — Phase 1 xong (chờ review)
- Làm: mục "Quy trình" `/menu/flow` đầu nhóm Thực đơn (PHT), sắp lại mục theo bước; trang Quy trình 6 bước có trạng thái, bấm mở đúng màn; icon Bowl, ShoppingCart; ROUTE_MAP thêm dòng luồng dinh dưỡng.
- File mới: src/pages/menu-planning/NutritionFlowPage.jsx · src/utils/menu-planning/nutritionFlow.js · tests/menu/nutrition-flow.test.mjs. `package.json` thêm script `test:menu` vào `verify` (không đổi dependency).
- Khác plan: bước 1 tạm trỏ `/menu/prices` tới khi có Thiết lập (Phase 2). Trạng thái bước là số nhắc việc tính từ danh sách đang có (thiếu đơn giá/dinh dưỡng, món chưa có thành phần, tuần sau đã xuất bản chưa); khi BE có API nên trả sẵn.
- Test: `test:menu` 6/6 pass. Probe PHT demo 1440/1024/768: không cuộn ngang, không lỗi console, bấm bước 2 mở `/menu/foods`.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: Phase 2 Thiết lập.

### 2026-10-15 — Phase 2 xong (chờ review)
- Làm: trang Thiết lập `/menu/setup` (bố cục 1): tab Bữa ăn (mỗi nhóm một bảng: bữa + đơn giá, thêm/đổi tên bữa, "Tính suất theo" cho bữa thêm, khoảng năng lượng/đạm/béo/bột, dòng Tổng, "Giá mới áp dụng từ ngày", lý do, căn cứ, chip giá đang/sắp áp dụng, Lịch sử giá) và tab Nhóm độ tuổi (bật/tắt). HT chỉ xem. Gỡ mục Giá suất ăn; `/menu/prices/*` chuyển về `/menu/setup`; HT có mục Thiết lập. Bước 1 Quy trình trỏ `/menu/setup`, chỉ đếm nhóm đang bật.
- Dữ liệu: mock thêm `nutritionSetups` (seed theo bữa gốc + định mức mặc định), `listNutritionSetups` / `saveNutritionSetups`, catalog trả `norms`; `compareToNorm` nhận định mức đã lưu, truyền qua NutritionTable, WeekChecks, WeekDaysView, MenuList, NutritionBalance, AI gợi ý tuần. Component dùng chung mới: Switch (+ `.switch`).
- Lỗi tìm ra khi test: nhóm đã hẹn giá ngày sau bị coi là "đổi giá" khi lưu thay đổi khác ⇒ so với mức giá mới nhất. Có test.
- Chưa làm (plan B, C): màn mẫu/tuần/đi chợ dùng bữa thêm; ẩn nhóm tắt khỏi chọn nhóm tuổi. File trang Giá suất ăn cũ còn, không còn route — xóa khi user cho phép.
- Test: `test:menu` 13/13. Probe PHT 1440/1024/768 không tràn trang (bảng 768 cuộn trong khung), khoảng ngược báo lỗi, thêm bữa + lưu tạo mức giá 33.000 đ, lịch sử giá đúng; HT 0 ô nhập, chip "Chỉ xem"; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: Phase 3 Món ăn + Sửa món + Thực phẩm.

### 2026-10-15 — Phase 3 xong (chờ review)
- Món ăn (bố cục 1): loại món bên trái (đếm theo bộ lọc), bảng #, tên + mã + dị ứng, loại, nhóm tuổi đủ định lượng, chip Đủ/Thiếu; lọc "Thiếu định lượng"; bấm món mở trang sửa (PHT) hoặc chi tiết.
- Sửa món (bố cục 4): thông tin món; bảng thành phần có một cột định lượng cho mỗi nhóm tuổi đang bật (ô trống = nhóm chưa dùng, viền đứt), dòng năng lượng 1 suất; cột phải "Dinh dưỡng 1 suất" + "Kiểm tra tự động" (nhóm thiếu định lượng, thực phẩm thiếu dinh dưỡng/đơn giá); Lưu, Lưu & thêm mới. Bỏ nút AI ở màn món.
- Thực phẩm (bố cục 1): nhóm bên trái + "Hay dùng"; bảng có đơn giá, tỷ lệ thải bỏ, dinh dưỡng, dị ứng, nút tim "Hay dùng"; dòng thiếu số liệu tô vàng. Form và chi tiết thực phẩm thêm tỷ lệ thải bỏ, hay dùng.
- Dữ liệu: nguyên liệu món có `portions` theo nhóm tuổi (`ingredientQty`; món cũ chỉ có khẩu phần chuẩn thì nhân hệ số như trước); `dishTotals`/`mealsTotals` tính theo nhóm và báo thiếu định lượng; bếp nhận định lượng theo nhóm. Thực phẩm thêm `wastePct`, `favorite`, endpoint `PUT /menu/foods/{id}/favorite`. Component dùng chung mới: CategoryNav, AutoChecks.
- Lỗi tìm ra khi probe: chữ sr-only ở đầu cột Xóa làm trang sửa món tràn ngang ở 1024/768 ⇒ khung bảng `position: relative`.
- Test: `test:menu` 19/19. Probe PHT 1440/1024/768 (Món ăn, Thực phẩm, Sửa món) không tràn trang; xóa định lượng Nhà trẻ ⇒ kiểm tra tự động báo, lưu xong lọc "Thiếu định lượng" ra đúng món; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: hết plan (A). Chờ user review rồi lập plan (B).

### 2026-10-15 — Đối chiếu wireframe, thêm Phase A4 (chờ duyệt)
- User báo giao diện chưa giống bố cục đã chọn. Chụp 9 màn app cạnh wireframe: 5 màn đã làm đúng khung nhưng thiếu chi tiết; 4 màn còn lại (mẫu, sửa mẫu, tuần, đi chợ) chưa làm (plan B, C).
- Nguyên nhân: chỉ kiểm tràn ngang, không có bước so ảnh với wireframe. Từ nay mỗi phase có ảnh so sánh.
- User chốt quyết định 4–8 (brainstorming). Plan (B) tạm dừng sau B1 tới khi A4 xong.
- Commit: chưa commit. Verify: chưa chạy cho A4.

### 2026-10-15 — A4.1 xong (chờ review)
- Dùng chung: `.page__desc`, `.page__actions`, EditHead (`src/components/ui/EditHead.jsx`), FilterMore (`src/components/ui/FilterMore.jsx`), `.tabs--pill`, `.input-unit`; công tắc màu brand như wireframe.
- Quy trình: "Quản lý dinh dưỡng" + mô tả, trạng thái bước chữ xám, nút "Thiết lập thông tin dinh dưỡng", khung AI "AI ở đâu".
- Thiết lập: tab "Nhóm độ tuổi | Bữa ăn" dạng viên; link "Căn cứ và hướng dẫn" mở ngăn phải (PHT sửa căn cứ, HT đọc); đầu thẻ nhóm có độ tuổi, số trẻ, công tắc Áp dụng (nhóm tắt hiện ghi chú thay bảng); cột Đạm/Béo/Bột có màu; ô giá có "đ", định dạng nghìn; mũi tên giữa hai ô khoảng; Lưu mở hộp xác nhận có ngày áp dụng + lý do (lỗi ngày/lý do hiện trong hộp); tab Nhóm độ tuổi chia Nhà trẻ / Mẫu giáo. Mock trả `childCount`.
- So ảnh với wireframe (1440): Quy trình và Thiết lập khớp. Khác còn lại, có lý do: link "Lịch sử giá" và dòng "Giá mới … từ …" (quyết định 21); nút Hủy/Lưu mờ khi chưa sửa gì; Nhà trẻ "0 trẻ" vì dữ liệu mẫu chưa có lớp nhà trẻ.
- Khác plan: script so ảnh để ở scratchpad (cần wireframe ở scratchpad), không đặt trong `scripts/`.
- Test: `test:menu` 23/23 (thêm kiểm `childCount`). Probe 768/1024/1440 không tràn; lưu qua hộp xác nhận thành công; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: A4.2 Món ăn + Sửa món + Thư viện tham khảo.

### 2026-10-15 — Sửa Thiết lập theo góp ý user
- User: bữa ăn không tính giá, chỉ giá cho cả ngày; danh sách nhóm mặc định thu gọn, bấm mở chi tiết (plan tổng, quyết định 15 mới).
- Làm: mỗi nhóm có "Giá suất ăn / trẻ / ngày" (ô có "đ"), bảng bữa chỉ còn tên bữa, "Tính suất theo", khoảng định mức; thẻ nhóm thu gọn thành dòng tóm tắt (số bữa · giá/ngày · khoảng kcal), bấm mở; nhóm có lỗi tự mở. Dữ liệu: `price` theo nhóm, bữa bỏ `unitPrice`, mock đổi dữ liệu cũ (giá theo bữa) thành giá ngày bằng tổng.
- Test: `test:menu` 23/23 (sửa theo giá ngày). Probe: mặc định 0 thẻ mở; mở MG nhỡ, đổi giá 31.000 đ, lưu qua hộp xác nhận ⇒ tóm tắt cập nhật; 768/1024 không tràn; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.

### 2026-10-15 — A4.2 xong (chờ review)
- Món ăn: mô tả; nút Thư viện tham khảo + Thêm món ăn; lọc: tìm, định lượng, "Lọc thêm" (dị ứng, trạng thái, đặt lại); bảng: chip dị ứng cạnh tên, nhóm tuổi viết tắt (MG bé…), chip Đủ/Thiếu có icon, nút "…" (Xem chi tiết, Sửa). Component dùng chung mới: RowMenu, SidePanel `wide`.
- Thư viện tham khảo (ngăn phải rộng): dữ liệu minh họa `src/mocks/menuReferenceSeed.js` (10 món, 16 thực phẩm); mỗi món thu gọn một dòng (số thành phần, kcal theo nhóm, dị ứng), bấm mở bảng thành phần theo nhóm tuổi, đánh dấu "Trường chưa có"; "Thêm vào món của trường" → hộp xác nhận nêu thực phẩm sẽ thêm → chép món + thực phẩm thiếu (có dinh dưỡng, chưa có đơn giá) → mở trang sửa; món trùng tên hiện "Đã có trong danh mục". Mock `listReferenceDishes`, `copyReferenceDish`; API `GET /menu/reference-dishes`, `POST /menu/reference-dishes/{id}/copy`.
- Sửa món: EditHead; thẻ thông tin Tên, Loại món, Nhóm trẻ áp dụng (chip chỉ xem, tính từ cột đủ định lượng); "Mô tả, trạng thái" thu gọn; dòng đã có hiện tên thực phẩm dạng chữ, dòng mới có ô chọn; ô trống viền cam "Nhập"; cột phải "Dinh dưỡng 1 suất" và "Kiểm tra tự động" dạng danh sách có dấu, chip "Tính bằng quy tắc" dòng riêng.
- So ảnh với wireframe (1440): Món ăn, Sửa món khớp. Khác còn lại: phân trang dùng component chung của app (số trang) thay "Tổng: n"; không có cảnh báo "dầu cao hơn ngưỡng" vì BE chưa có quy tắc này.
- Test: `test:menu` 25/25 (thêm 2 test thư viện). Probe 768/1024/1440 không tràn; chép "Vịt om khoai tây" thêm 2 thực phẩm và mở trang sửa; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: A4.3 Thực phẩm (bảo quản, sửa hàng loạt, nhập khẩu Excel).

### 2026-10-15 — A4.3 xong (chờ review) — Phase A4 xong
- Thực phẩm: mô tả; nút Nhập khẩu cập nhật, Chỉnh sửa hàng loạt, Thêm thực phẩm; lọc: tìm, ô tích "Chỉ hay dùng", "Lọc thêm" (số liệu, dị ứng, trạng thái); bỏ mục Hay dùng ở danh mục; cột Mã TP, Tên (nhóm · tươi/khô), Đơn giá, Đơn vị, Thải bỏ %, Kcal, Đạm, Béo, Bột, Dị ứng, Hay dùng, "…".
- Bảo quản: `storage` FRESH/DRY (mặc định theo nhóm, đậu phụ và bún tươi là tươi); có ở form, chi tiết, thư viện tham khảo.
- Sửa hàng loạt: ô Đơn giá, Thải bỏ, Kcal, Đạm, Béo, Bột thành ô nhập, ô đổi tô xanh; thanh "Đang sửa hàng loạt" + Hủy / Lưu n thay đổi; lỗi tại ô; một dòng lỗi thì không ghi dòng nào. Mock `saveFoodsBulk`, API `PUT /menu/foods/bulk`.
- Nhập khẩu: ngăn phải; tải file mẫu `public/templates/thuc-pham-mau.xlsx` (sheet Thực phẩm + Hướng dẫn); chọn .xlsx → đọc bằng `read-excel-file` (tải lười) → `matchFoodRows` (`src/utils/menu-planning/foodImport.js`) chia Mới / Cập nhật (ô trống giữ nguyên) / Lỗi (lý do) → ghi các dòng hợp lệ.
- Dependency: `read-excel-file` 9.3.10 (bản cố định, phát hành 10/08/2026). Repo đang có xung đột peer sẵn (vite 8 với @vitejs/plugin-react 4 — `npm install` thường cũng lỗi) ⇒ cài bằng `--legacy-peer-deps`; lockfile chỉ thêm 6 gói, không đổi phiên bản gói nào khác.
- Lỗi tìm ra khi test: dòng thêm mới trùng tên thực phẩm đã có bị báo "trùng dòng khác trong file" ⇒ kiểm trùng danh mục trước, gợi ý điền Mã TP.
- So ảnh với wireframe (1440): Thực phẩm khớp; khác còn lại: phân trang dùng component chung.
- Test: `test:menu` 28/28 (thêm 3 test: file mẫu, đối chiếu file, lưu hàng loạt). Probe: sửa hàng loạt (ô sai báo lỗi, sửa rồi lưu), tải file mẫu, nhập file thử (1 mới, 1 cập nhật, 1 lỗi) ghi đúng; 768/1024/1440 không tràn; không lỗi console.
- Verify: `VERIFY PASS full`. Commit: chưa commit.
- Tiếp: plan (B) Phase B2 Thực đơn mẫu (danh sách 4, sửa 5) có ảnh so sánh.

### 2026-10-15 — User chấp nhận kết quả, đóng plan
- User trả lời "ok" sau báo cáo cuối của plan (C) ⇒ đóng plan (A), (B), (C): `status: done`, chuyển sang `docs/plans/completed/`.
