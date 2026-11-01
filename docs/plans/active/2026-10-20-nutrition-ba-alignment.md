---
title: Chỉnh UI Dinh dưỡng & Kho khớp BA "Dinh dưỡng flow" (GĐ1)
status: in-progress
owner: thangnd
jira: G94-191 / FE-FEAT (chưa có mã công việc)
branch: dev
modules: [nutrition, attendance]
rules: [NUT-05, NUT-06, NUT-10]
risk: high
created: 2026-10-20
updated: 2026-10-20
---
# Chỉnh UI Dinh dưỡng & Kho khớp BA "Dinh dưỡng flow" (GĐ1)

## Context
BA giao "UI Business Flow Specification — Nutrition & Food Inventory" (file `Dinh dưỡng flow.docx`, ngoài repo; 11 chức năng + 4 luồng tích hợp + OD-01..OD-11). UI hiện tại chạy mock (`src/config/env.js:3`), BE chưa có API nutrition/kho (`BE:docs/modules/nutrition.md`). Lệch chính:
- Có kiểm kê kho `src/pages/kitchen/StockCountPage.jsx` — BA: không kiểm kê.
- Hiện "Đạt"/"Đủ chất" khi chưa có chuẩn: `compareToNorm` fallback `NUTRITION_NORMS` (`src/utils/menu-planning/menuCalculations.js:150`, `src/models/menu-planning/menuPlanningConstants.js:117`).
- Xuất kho tự động xuất một phần + tự FIFO (`src/services/kitchen/mock/kitchenMockRepository.js:748`) — BA: thiếu ⇒ dừng cả phiếu, bếp chọn lô.
- Phiếu nhập không nháp/NSX/thành tiền (`src/pages/kitchen/StockReceiptFormPage.jsx`).
- Principal + VP đều mở lại điểm danh (`src/utils/attendance/attendancePermissions.js:18`); BA: Principal cấu hình, VP mở lại trong thời hạn.
- Sidebar rời rạc, nhiều trang không có mục (`src/layouts/menuConfig.js`).

## Quyết định đã chốt
1. Spec BA là bản chốt cho FE, **ngoại lệ: giữ nguyên luồng AI** (AI soạn mẫu/tuần, gợi ý sửa, `/menu/ai-suggestion`) — user, 2026-10-20.
2. Gỡ kiểm kê kho (route + link) — user, 2026-10-20.
3. GĐ1 chỉ chỉnh màn đang có; màn thiếu (NCC, đơn vị quy đổi, nhân bản món, lịch sử/sổ kho, phiếu xử lý, báo cáo, kiểm thực) ⇒ plan GĐ2/GĐ3 — user, 2026-10-20.
4. Thời hạn mở lại điểm danh = số phút sau giờ chốt — user, 2026-10-20.
5. Sổ báo ăn: view theo ngày trên data theo bữa (không đổi model) — user, 2026-10-20.
6. Phiếu nhập nháp ⇒ trang danh sách `/kitchen/stock-receipts` — user, 2026-10-20.
7. Code thẳng trên `dev`, không tạo nhánh, không commit — user, 2026-10-20.
8. Mặc định (user duyệt plan): bếp chọn lô xong hệ thống tự ghi xuất; đổi số suất sau Posted chỉ ghi chú (OD-02 PENDING); NSX bắt buộc khi xác nhận nhập; seed giữ chuẩn demo nhãn "Chuẩn tạm", 1 nhóm tuổi để trống; bàn giao suất + "Cập nhật chế biến" chỉ gỡ khỏi sidebar.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Principal / Vice Principal / Teacher / Kitchen Staff · outcome: UI khớp luồng BA · BE rule dùng: NUT-05, NUT-06, NUT-10 (CONFIRMED).
- **Đối chiếu BE:** BA lệch BE ở NUT-08 (duyệt thực đơn), NUT-11/ADR-0009 (kho OPEN, có nhắc kiểm kê), MealCount theo bữa, P-10 chuẩn PENDING ⇒ đề xuất CMR (xem `docs/features/nutrition-inventory.md`). FE không coi các điểm đó là contract BE đã chốt.
- **Ảnh hưởng:** FE `/menu/*`, `/kitchen/*`, `/attendance/meal-count`, `/attendance/day-unlocks`, `/school/cutoff`; dữ liệu mock localStorage cũ (stockCounts, lô suy diễn).

### Câu hỏi mở
| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| BA hay BE là chuẩn? | BA, giữ AI | user | 2026-10-20 | `docs/features/nutrition-inventory.md` |
| Kiểm kê? | Gỡ | user | 2026-10-20 | như trên |
| Thời hạn mở lại? | Phút sau giờ chốt | user | 2026-10-20 | như trên |
| Sổ báo ăn? | View ngày | user | 2026-10-20 | như trên |
| Nháp phiếu nhập? | Trang list | user | 2026-10-20 | như trên |

## Acceptance criteria
- **AC-1:** Không còn route/link `/kitchen/stock-counts`.
- **AC-2:** Sidebar Principal/VP/Kitchen theo nhóm Danh mục / Dinh dưỡng / Kho / Báo cáo; không còn nhãn "Duyệt xuất kho".
- **AC-3:** Chưa nhập chuẩn hoặc thiếu dữ liệu chất ⇒ "Chưa đủ dữ liệu đánh giá", không bao giờ "Đạt"/"Đủ chất"; không còn chuẩn hard-code trong constants.
- **AC-4:** Số bữa theo thiết lập; chưa thiết lập ⇒ "Chưa thiết lập bữa".
- **AC-5:** Phiếu nhập: nháp không cộng tồn; xác nhận cần lô/NSX/HSD/đơn giá, cộng tồn đúng 1 lần; có cột thành tiền + tổng; có trang danh sách.
- **AC-6:** Chỉ VP mở lại điểm danh, trong số phút sau giờ chốt do Principal cấu hình.
- **AC-7:** Thiếu 1 nguyên liệu ⇒ cả phiếu xuất AwaitingStock, không trừ tồn; bếp chọn lô (lô hết hạn/thiếu không chọn được) ⇒ Posted đúng 1 lần.
- **AC-8:** Sổ báo ăn hiển thị số suất/ngày theo lớp + nhóm tuổi, 1 nút xác nhận cho cả ngày.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Thứ tự | Chỉnh khớp trước (GĐ1) rồi lấp màn thiếu | Viết lại theo 11 module / chỉ thêm màn | Ít rủi ro, giữ màn đang dùng |
| Chọn lô | Trong SidePanel StockIssuePage | Màn mới | Không thêm route, bếp không cần quyền tồn kho |
| Báo ăn | View ngày trên data theo bữa | Đổi model | Không đụng bàn giao/dự trù; model thật để BE quyết |

## Phases
### Phase 1a — Tri thức, gỡ kiểm kê, sidebar
- Files: C `docs/features/nutrition-inventory.md` · M `docs/context/CURRENT_STATE.md`, `.ai/CONTEXT_MAP.yaml`, `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md` · D `src/pages/kitchen/StockCountPage.jsx` · M `src/routes/AppRoutes.jsx`, `src/pages/kitchen/DryStockPage.jsx`, kitchen service/api/mock/hook/validation/constants/permissions, `src/layouts/menuConfig.js`, `src/layouts/quickActions.js`, tests liên quan.
- Tests: AC-1, AC-2 → `tests/kitchen/dry-stock.test.mjs`, `tests/menu/nutrition-flow.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` pass.
- **Dừng chờ user review.**

### Phase 1b — Chuẩn, số bữa, phiếu nhập, mở lại điểm danh
- Steps: AC-3..AC-6 theo plan chat (norm config-only, `mealsOf` không fallback, `saveStockReceipt` draft/confirm + list page, `canUnlockAttendanceDay` VP-only + reopen window).
- Exit: `VERIFY PASS full` + test mới cho AC-3..AC-6.
- **Dừng chờ user review.**

### Phase 1c — Xuất kho chặn + chọn lô, sổ báo ăn ngày
- Steps: `db.stockLots` + migrate; `issueDry` block toàn phiếu; `allocateIssueLots`; trạng thái AwaitingStock/AwaitingLotAllocation/Processing/Posted/Failed; MealCountPage view ngày.
- Exit: `VERIFY PASS full` + `tests/kitchen/stock-issue.test.mjs` viết lại; browser theo 3 role.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | — | dry-stock.test (unit mock) | 1a | |
| AC-2 | — | nutrition-flow.test + browser | 1a | |
| AC-3 | NUT-06 | menu calc test | 1b | |
| AC-5 | NUT-10 | stock receipt test | 1b | |
| AC-7 | — | stock-issue.test | 1c | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Working tree `dev` đang có ~40 file sửa dở | Lẫn thay đổi | Ghi file đã sửa ở Progress log | User tách khi commit |
| localStorage mock cũ (stockCounts, lô suy diễn) | Lỗi hiển thị | Migration seed; bỏ qua key cũ | Xóa localStorage demo |
| Contract BE chưa có (cutoff window, lô, trạng thái phiếu xuất) | FE đoán payload | Chỉ mock; ghi CMR đề xuất | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `src/services/school-config/api/schoolConfigApi.js` (cutoff), `src/services/kitchen/api/kitchenApi.js` (receipt/issue)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file ⇒ đã chia 3 phase dừng review
- [x] Không dùng rule PENDING/OPEN như đã chốt (BA chỉ là chuẩn FE)
- [x] Tự review

## Progress log
### 2026-10-20 — Phase 1a (chờ review)
- Commit: chưa commit (user: làm thẳng trên dev)
- Verify baseline trước khi sửa: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Đã làm: docs/tri thức (`docs/features/nutrition-inventory.md`, CONTEXT_MAP, ROUTE_MAP, README, CURRENT_STATE, REPOSITORY_CONTEXT); gỡ kiểm kê (page, route, link, hook/service/api/mock/validation/constants/permission/breadcrumb, test); sidebar 4 nhóm Danh mục thực phẩm / Dinh dưỡng / Kho thực phẩm / Báo cáo bếp + cờ `exact` ở `src/layouts/Sidebar.jsx`; quick action thực đơn tuần ⇒ `/menu/weekly`.
- Verify: `node scripts/check-ai-layer.mjs` → `0 lỗi, 19 cảnh báo`; `npm run test:kitchen` → pass 41 fail 0; `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` — fail duy nhất `tests/menu/table-alignment.test.mjs` ở file school-config / facility-transfer / inventory-inspection do phiên khác đang sửa song song (10:57), không thuộc file của plan này.
- Khác plan: "Sổ báo ăn" của HT/PHT giữ trong nhóm Điểm danh (đổi nhãn `mealCount`), không lặp ở nhóm Dinh dưỡng — tránh mất link khi PHT không có mảng thực đơn; PHT bỏ mục "Thực đơn đã công bố" (đã có Thực đơn tuần). Mục Bàn giao suất cũng gỡ khỏi sidebar Tổ trưởng.
- Tiếp: Phase 1b sau khi user review.

### 2026-10-20 — Phase 1b (chờ review)
- Commit: chưa commit
- Đã làm:
  - Chuẩn dinh dưỡng: bỏ `NUTRITION_NORMS`, `PORTION_FACTORS`, `PORTION_FACTOR_BY_AGE_GROUP` khỏi constants (số demo chuyển vào `src/mocks/menuPlanningSeed.js`, nhóm 5–6 tuổi để trống); `isNormConfigured` + `compareToNorm` không fallback; `checkDayMenu` ra "Chưa đủ dữ liệu đánh giá" khi thiếu chuẩn; nhãn "Chuẩn tạm (nhập tay)" ở Thiết lập và bảng cân đối; lưu khoảng trống không thành 0; định lượng chỉ lấy số đã nhập theo nhóm tuổi (bếp cũng vậy).
  - Số bữa: `sessionsOf` theo cấp học (`isNurseryAgeGroup`, field `level` ở `AGE_GROUPS`) thay vì mã `'ag-2'`.
  - Phiếu nhập: `saveStockReceipt` nháp/xác nhận (409 khi xác nhận lại), NSX bắt buộc + NSX ≤ HSD, thành tiền + tổng, trang `/kitchen/stock-receipts` (list) + `/:id/edit`; lô chỉ tính từ phiếu đã xác nhận.
  - Mở lại điểm danh: chỉ PHT campus mình (route `VP_ONLY`, bỏ khỏi sidebar HT); HT cấu hình "thời hạn mở lại (phút sau giờ chốt)" ở `/school/cutoff`; quá hạn/chưa cấu hình ⇒ 409 + thông báo trên màn mở lại.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 77, kitchen 42, merge 39, hardening 16, dashboard 11 pass). Browser: `/kitchen/stock-receipts` liệt kê phiếu seed "Đã xác nhận nhập"; form mới có NSX, Thành tiền, Tổng, Lưu nháp/Xác nhận. Chưa kiểm browser màn giờ chốt (vai HT) và trạng thái NA trên trình duyệt (localStorage cũ còn chuẩn nhóm 5–6 tuổi).
- Khác plan: `mealsOf` vẫn fallback bữa mặc định khi chưa lưu Thiết lập (mặc định theo cấp học BA, không theo mã nhóm) — bỏ fallback rủi ro nhiều màn trống; thời hạn mở lại là cửa sổ được phép thao tác mở lại (không đổi cách chọn "mở đến"); mock điểm danh đọc seed cấu hình trường khi module đó chưa khởi tạo (như giờ chốt).
- Dữ liệu cũ: localStorage đã có `cutoffSettings` không có `reopenWindowMinutes` ⇒ PHT không mở lại được tới khi HT lưu lại giờ chốt (đúng BA: không tự áp số).
- Contract BE cần thống nhất (ghi ở `docs/features/nutrition-inventory.md`): `reopenWindowMinutes` ở `PUT /school-years/{id}/cutoff`; phiếu nhập `status`, `mfgDate`, `confirm`, `GET/PUT /kitchen/stock-receipts/{id}`.
- Tiếp: Phase 1c sau khi user review.

### 2026-10-20 — Phase 1c (chờ review)
- Commit: chưa commit
- Đã làm:
  - Lô lưu riêng `db.stockLots` (DB cũ dựng một lần từ phiếu nhập đã xác nhận, phần dư = tồn đầu kỳ); xác nhận phiếu nhập tạo lô.
  - Xuất kho: `planIssue` theo tồn khả dụng (lô chưa hết hạn); thiếu một dòng ⇒ `AWAITING_STOCK`, không trừ tồn; đủ ⇒ `AWAITING_LOT_ALLOCATION`; `allocateIssueLots` (chỉ Bếp campus) kiểm tra lô ⇒ `POSTED` một lần (409 khi ghi lại); phiếu đã ghi xuất mà số chốt đổi ⇒ chỉ ghi chú `NEED_CHANGED`. Bỏ xuất một phần, hoàn kho tự động và FIFO tự chọn. Dữ liệu cũ `ISSUED` hiển thị "Đã xuất kho (dữ liệu cũ)".
  - UI: `src/components/kitchen/IssueLotAllocation.jsx` (bếp nhập lượng theo lô, lô hết hạn khóa, nút gợi ý hạn gần trước); panel phiếu xuất hiện bảng thiếu + link "Nhập kho bổ sung" điền sẵn dòng thiếu (PHT); Quy trình bếp hôm nay theo trạng thái mới.
  - Sổ báo ăn: `/attendance/meal-count` một thẻ/ngày/điểm trường, suất/ngày theo lớp, lớp chưa hoàn thành điểm danh, một nút xác nhận cả ngày (gọi xác nhận từng bữa); `/kitchen/meal-count` thêm tổng suất/ngày; helper `src/utils/attendance/mealRegister.js`.
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` — menu 77, kitchen 43 pass; merge 38 pass / 1 fail ở `tests/integration/selective-merge/permission-center.test.mjs` (phiên khác đang sửa `src/models/account/permissionConstants.js`, `src/utils/account/permissionMatrix.js`, không thuộc plan này). Chạy tay phần verify bị dừng: hardening 20, dashboard 11 pass; `npm run lint` sạch; `npm run build` ✓; `format:check` chỉ báo `src/pages/school-config/RoleDefaultsPage.jsx` (phiên khác).
- Browser (DB mock sao lưu → dựng sạch → khôi phục): phiếu hôm nay "Thiếu hàng, chờ nhập bổ sung" (gạo tẻ cần 10,2 có 5), link nhập bổ sung `items=f01:5.2`; nhập bổ sung ⇒ "Chờ bếp chọn lô"; sổ báo ăn đủ 12 lớp, cột Suất/ngày, lớp chưa hoàn thành. Chưa thao tác chọn lô bằng tài khoản Bếp trên browser (đã có test).
- Khác plan: sửa lỗi phát hiện khi kiểm browser — "bữa đầu" là bữa phụ sáng chỉ có lớp nhà trẻ ⇒ sổ ngày gộp lớp từ mọi bữa.
- Lưu ý demo: tồn seed gạo tẻ thấp nên phiếu các ngày đều thiếu hàng tới khi nhập bổ sung.
- Tiếp: user review; GĐ2 (NCC, bảng quy đổi, nhân bản món) cần plan riêng.
