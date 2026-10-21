---
title: Dinh dưỡng & Kho theo BA — GĐ2 danh mục (NCC, đơn vị quy đổi, nhân bản món)
status: in-progress        # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: thangnd
jira: G94-191 / FE-FEAT (chưa có mã công việc)
branch: dev
modules: [nutrition]
rules: [NUT-05, NUT-06, NUT-10]
risk: high           # >8 file, đụng mock kho dùng chung (lô, phiếu nhập, phiếu xuất), danh mục thực phẩm và trạng thái món
created: 2026-10-20
updated: 2026-10-20
---
# Dinh dưỡng & Kho theo BA — GĐ2 danh mục (NCC, đơn vị quy đổi, nhân bản món)

Tiếp nối [GĐ1](2026-10-20-nutrition-ba-alignment.md). Bảng đối chiếu BA ↔ FE: [`docs/features/nutrition-inventory.md`](../../features/nutrition-inventory.md). Plan chỉ phần client (mock); BE chưa có API nutrition/kho, không sửa `CareNest_BE`.

## Context
BA "Dinh dưỡng flow" mục V xếp 3 nhóm màn Master Data là **P0**: Supplier List/Form/Detail; Ingredient List/Form (kèm Units & Conversions); Dish List/Recipe Editor (kèm nhân bản, sao chép định lượng). Hiện trạng:

- **NCC:** chưa có danh mục. Phiếu nhập kho gõ tự do `supplierName` (`src/pages/kitchen/StockReceiptFormPage.jsx:163-170`); bắt buộc khi xác nhận (`src/utils/kitchen/kitchenValidation.js:24-25`); typedef ghi "chữ tự do, chưa có danh mục NCC – P-09" (`src/models/kitchen/kitchenConstants.js:16`). Seed phiếu nhập dùng tên mẫu (`src/mocks/kitchenSeed.js:211`). Hàng tươi cũng gõ tự do (`src/pages/kitchen/FreshReceiptPage.jsx:172`). HT không có nhóm "Danh mục thực phẩm" trên sidebar (`src/layouts/menuConfig.js:134-158`); nhóm `catalog` của PHT bị ẩn khi PHT không có mảng thực đơn (`src/layouts/menuConfig.js:227`).
- **Đơn vị:** thực phẩm có 2 đơn vị: `unit` (g/ml, định lượng công thức) và `purchaseUnit` + `purchaseUnitSize` (số g/ml trong 1 đơn vị mua) (`src/models/menu-planning/menuPlanningConstants.js:16-19`, `src/pages/menu-planning/FoodFormPage.jsx:141-180`). **Chưa có đơn vị kho**: kho ngầm dùng đơn vị mua — `normalizeFood.unit = purchaseUnit` (`src/services/kitchen/mock/kitchenMockRepository.js:104-110`), nhu cầu xuất = `buyUnits` làm tròn theo đơn vị mua (`src/services/kitchen/mock/kitchenMockRepository.js:444-445`, `src/services/kitchen/mock/marketList.js:130-131`), dòng phiếu nhập hiện đơn vị = đơn vị mua (`src/pages/kitchen/StockReceiptFormPage.jsx:83`, `:227`).
- **Món:** công thức theo nhóm tuổi đã có dạng cột mỗi nhóm tuổi (`portions` theo `ageGroupId`, `src/pages/menu-planning/DishFormPage.jsx:29-33`, `:294-311`); nhóm tuổi lấy từ thiết lập (`activeAgeGroups`, `src/pages/menu-planning/DishListPage.jsx:38-40`). Chưa có nhân bản món (menu dòng chỉ Xem/Sửa, `src/pages/menu-planning/DishListPage.jsx:186-193`), chưa có chép định lượng giữa nhóm tuổi. Tên món duy nhất, món cần ≥1 nguyên liệu lượng > 0 (`validateDish`, gọi ở `src/services/menu-planning/mock/menuPlanningMockRepository.js:720`; rule ở `src/utils/menu-planning/menuPlanningValidation.js:55-57`). Trạng thái món chỉ `ACTIVE/INACTIVE` (`src/models/menu-planning/menuPlanningConstants.js:81-82`, lưu ở `src/services/menu-planning/mock/menuPlanningMockRepository.js:718`). Ô chọn món đã lọc `ACTIVE` (`src/components/menu-planning/MealEditor.jsx:17`, `DishQuickAdd.jsx:15`, `AllergySubstitutes.jsx:47`, `src/pages/menu-planning/AllergyMenuFormPage.jsx:72`, AI `menuPlanningMockRepository.js:305`, `:378`); repo chỉ chặn `INACTIVE` khi lưu thực đơn mẫu (`menuPlanningMockRepository.js:1029`), lưu điều chỉnh ngày chỉ kiểm món tồn tại (`:1258`).

## Quyết định đã chốt
1. Spec BA là chuẩn UI FE, giữ luồng AI — user, 2026-10-20 (từ GĐ1).
2. GĐ2 = 3 màn P0 còn thiếu: NCC; bảng đơn vị mua/kho/công thức + quy đổi ở `/menu/foods`; nhân bản món + chép công thức giữa nhóm tuổi ở `/menu/dishes` — user, 2026-10-20.
3. Mọi dữ liệu là mock; không sửa `CareNest_BE`; không commit; code thẳng trên `dev`; Jira `G94-191` — user, 2026-10-20.
4. GĐ3 (lịch sử/sổ kho, phiếu xử lý, báo cáo, kiểm thực) không thuộc plan này — user, 2026-10-20.
5. NCC: bắt buộc mã + tên; mã **tự sinh, khóa**; PHT **xem read-only**; có Ngừng dùng, chỉ xóa NCC chưa có phiếu nhập; hàng tươi giữ ô gõ tự do — user, 2026-10-20 (Q1–Q5).
6. Đơn vị: dòng phiếu nhập chọn đơn vị mua hoặc kho, lô lưu theo đơn vị kho; thực phẩm đã có lô/phiếu xác nhận thì khóa đơn vị kho + tỷ lệ kho→công thức — user, 2026-10-20 (Q6–Q7).
7. Món: **thêm trạng thái Nháp**; PHT chọn khi lưu (Lưu nháp / Lưu và dùng cho thực đơn); chuyển sang Đang dùng cần đủ định lượng mọi nhóm tuổi đang áp dụng; chép định lượng hỏi trước khi thay ô có số; không làm phiên bản công thức — user, 2026-10-20 (Q8, Q8a, Q8b, Q9).
8. Món chép từ thư viện tham khảo tạo ở trạng thái Nháp — user, 2026-10-20 (khi duyệt plan).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor: Principal quản lý NCC (BA 01 CONFIRMED) · Vice Principal quản lý thực phẩm, món, công thức (BA 02/03 CONFIRMED), chọn NCC trong phiếu nhập (BA 01 bước 5), xem danh mục NCC read-only (user Q3).
  - Outcome: HT có danh mục NCC + chi tiết kèm lịch sử phiếu nhập read-only; PHT chọn NCC từ danh mục khi lập phiếu nhập; thực phẩm khai báo đủ 3 đơn vị và tỷ lệ > 0; PHT nhân bản món, chép định lượng sang nhóm tuổi khác, món mới có thể để Nháp.
  - Rule BE: NUT-05, NUT-06, NUT-10 (CONFIRMED) — không đổi. NUT-11 (OPEN, ADR-0009), NUT-12 (PENDING P-09, BE đề xuất NCC ngoài V1) ⇒ **FE không coi là contract**.
  - Flow: [S] HT tạo/sửa/ngừng NCC → [S] PHT chọn NCC đang dùng trong phiếu nhập → [S] chi tiết NCC liệt kê phiếu nhập. [S] PHT khai đơn vị → hệ thống quy đổi khi xác nhận nhập (mua → kho) và khi tính nhu cầu xuất (công thức → kho). [S] PHT tạo/nhân bản món (Nháp hoặc Đang dùng) → chỉ món Đang dùng vào được thực đơn.
- **Đối chiếu thiết kế ban đầu:**
  - BE `NUT-12` (`BE:docs/business/BUSINESS_RULES.md`, dòng 62): "Quy trình NCC… PENDING P-09 — đề xuất ngoài V1". BA: NCC cơ bản, HT quản lý, CONFIRMED ⇒ lệch, đề xuất CMR; FE làm theo BA ở mock.
  - BA 01 bước 3 "Nhập/sửa tên, mã"; user chọn mã tự sinh khóa (Q2) ⇒ FE không cho sửa mã, ghi lệch vào `docs/features/nutrition-inventory.md`.
  - BA 01 "Chỉ Hiệu trưởng quản lý"; user cho PHT xem read-only (Q3) — không mâu thuẫn (xem ≠ quản lý), OD-11 vẫn PENDING ở BA.
  - BA 02 "Units & Conversions": đơn vị mua/kho/công thức; FE hiện chỉ mua + công thức ⇒ thêm đơn vị kho.
  - BA 03 "Tạo món → mở món Draft"; user chọn "PHT chọn khi lưu" (Q8a) ⇒ món mới có thể Đang dùng ngay nếu đủ định lượng. DERIVED "công thức đã dùng phải giữ phiên bản" ⇒ không làm ở GĐ2, ghi CMR.
- **Ảnh hưởng:**
  - FE route: mới `/kitchen/suppliers`, `/kitchen/suppliers/:id` (HT + PHT xem), `/kitchen/suppliers/new`, `/kitchen/suppliers/:id/edit` (HT); sửa `/kitchen/stock-receipts/*`, `/menu/foods/*`, `/menu/dishes/*`; gián tiếp `/kitchen/dry-stock`, `/kitchen/stock-issues`, `/kitchen/forecast` (đơn vị kho), `/menu/menus`, `/menu/weekly`, `/menu/allergy-menus` (chặn món Nháp ở repo).
  - Quyền/scope: NCC dùng chung hai điểm trường; ẩn UI theo role chỉ là UX, mock repo re-check 403.
  - Dữ liệu cũ localStorage: phiếu nhập có `supplierName` chữ tự do; thực phẩm không có `stockUnit`; món hiện có giữ `ACTIVE`. Migrate khi đọc (Key decisions).
  - APP: không dùng màn này.

### Câu hỏi mở
| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Q1 Trường bắt buộc NCC | Mã + tên; còn lại tùy chọn, SĐT kiểm định dạng nếu nhập | user | 2026-10-20 | plan; `docs/features/nutrition-inventory.md` ở Phase 1 |
| Q2 Mã NCC | Tự sinh `NCC001…`, khóa (không sửa) | user | 2026-10-20 | như trên |
| Q3 PHT xem NCC | Xem danh sách/chi tiết read-only | user | 2026-10-20 | như trên |
| Q4 Ngừng/xóa NCC | Đang dùng/Ngừng dùng; chỉ xóa NCC chưa có phiếu nhập | user | 2026-10-20 | như trên |
| Q5 Hàng tươi | Giữ ô gõ tự do, chỉ đổi phiếu nhập kho | user | 2026-10-20 | như trên |
| Q6 Đơn vị dòng phiếu nhập | Chọn đơn vị mua hoặc kho; lô lưu theo đơn vị kho | user | 2026-10-20 | plan; feature doc ở Phase 3 |
| Q7 Sửa đơn vị đã dùng | Khóa đơn vị kho + tỷ lệ kho→công thức; mua + tỷ lệ mua→kho sửa được | user | 2026-10-20 | như trên |
| Q8 Nháp/phiên bản món | Thêm Nháp; không làm phiên bản | user | 2026-10-20 | plan; feature doc ở Phase 2 |
| Q8a Trạng thái món mới | PHT chọn khi lưu (Lưu nháp / Lưu và dùng cho thực đơn) | user | 2026-10-20 | như trên |
| Q8b Điều kiện rời Nháp | Đủ định lượng mọi nhóm tuổi đang áp dụng; món đã vào thực đơn không về Nháp | user | 2026-10-20 | như trên |
| Q9 Chép định lượng | Hỏi trước khi thay ô có số; đánh dấu "Vừa chép — kiểm tra lại"; ghi khi Lưu | user | 2026-10-20 | như trên |
| Q10 Jira | `G94-191` | user | 2026-10-20 | frontmatter |

- [x] Hết câu hỏi nghiệp vụ. Món chép từ thư viện tham khảo tạo ở **Nháp** — user xác nhận khi duyệt plan, 2026-10-20.

### Lệch BE — đề xuất bổ sung `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` (chưa sửa BE)
Thêm vào mục "Lệch BE" của `docs/features/nutrition-inventory.md` theo từng phase:
1. **NCC:** BE NUT-12 PENDING P-09 "đề xuất ngoài V1"; BA chốt danh mục NCC cơ bản do HT quản lý. Contract FE giả định (PROPOSED): `GET/POST /kitchen/suppliers`, `GET/PUT/DELETE /kitchen/suppliers/{id}`, `GET /kitchen/suppliers/{id}/receipts`; mã do BE sinh; phiếu nhập gửi `supplierId` (BE lưu snapshot tên).
2. **Đơn vị:** Food thêm `stockUnit`, `purchaseToStock` (số đơn vị kho trong 1 đơn vị mua), `stockUnitSize` (số g/ml trong 1 đơn vị kho); lô/tồn/phiếu xuất theo đơn vị kho; dòng phiếu nhập có `unitKind` ∈ {`PURCHASE`, `STOCK`}; BE từ chối đổi đơn vị kho khi đã có lô.
3. **Món:** trạng thái `DRAFT | ACTIVE | INACTIVE`; BE từ chối món không `ACTIVE` trong thực đơn; phiên bản công thức (BA DERIVED) để BE quyết.

## Acceptance criteria
- **AC-1** (BA 01, Q3): Given HT hoặc PHT, When mở `/kitchen/suppliers`, Then thấy bảng mã, tên, người liên hệ, SĐT, trạng thái; tìm theo tên/mã; danh sách rỗng ⇒ empty state (HT có nút Thêm mới, PHT chỉ thông báo). PHT không thấy Thêm/Sửa/Ngừng dùng/Xóa.
- **AC-2** (BA 01, Q1–Q2): Given form NCC, When lưu thiếu tên hoặc SĐT sai định dạng, Then lỗi cạnh trường, không lưu (mock 422 kể cả gọi thẳng repo); mã do hệ thống sinh `NCC` + 3 số tăng dần, hiển thị chỉ đọc; payload có mã khác ⇒ bị bỏ qua.
- **AC-3** (BA 01, Q3): Given vai không phải HT, When gọi tạo/sửa/ngừng/xóa NCC ở repo, Then 403; Bếp/GV gọi xem ⇒ 403. Route form chỉ HT; route list/detail HT + PHT.
- **AC-4** (BA 01, Q4–Q5): Given PHT lập phiếu nhập kho, When mở ô Nhà cung cấp, Then chỉ chọn được NCC đang dùng; phiếu cũ gắn NCC đã ngừng vẫn hiện tên; xác nhận nhập thiếu NCC ⇒ lỗi "Chọn nhà cung cấp". Phiếu hàng tươi không đổi.
- **AC-5** (BA 01, Q4): Given NCC có phiếu nhập, When mở chi tiết, Then thấy phiếu nhập liên kết (mã/ngày/điểm trường/trạng thái/tổng tiền) read-only; xóa NCC đã có phiếu ⇒ 409 + gợi ý Ngừng dùng; NCC chưa có phiếu xóa được sau hộp xác nhận nêu tên.
- **AC-6** (dữ liệu cũ): Given localStorage có phiếu nhập chỉ có `supplierName`, When tải danh sách/chi tiết, Then phiếu khớp tên NCC trong danh mục được gắn `supplierId`; không khớp ⇒ hiện tên cũ kèm nhãn "Chưa liên kết danh mục", không lỗi.
- **AC-7** (BA 02): Given form thực phẩm, When khai báo đơn vị, Then có nhóm "Đơn vị & quy đổi": đơn vị công thức (g/ml, nhãn Khối lượng/Thể tích), đơn vị kho, đơn vị mua, "1 đơn vị mua = N đơn vị kho", "1 đơn vị kho = M g/ml"; N, M ≤ 0 hoặc trống ⇒ lỗi; có dòng xem trước ví dụ quy đổi; không tự đổi lít ↔ gram.
- **AC-8** (BA 02, tương thích): Given thực phẩm cũ chưa có đơn vị kho, When đọc, Then đơn vị kho = đơn vị mua, N = 1, M = `purchaseUnitSize`; số tồn/xuất hiện tại không đổi.
- **AC-9** (BA 02/05, Q6): Given thực phẩm đơn vị mua ≠ đơn vị kho, When PHT xác nhận phiếu nhập với dòng theo đơn vị mua, Then lô và tồn tăng `lượng × N` đơn vị kho; dòng theo đơn vị kho tăng đúng `lượng`; thành tiền = lượng × đơn giá cùng đơn vị dòng.
- **AC-10** (BA 02/xuất kho): Given phiếu xuất tự động, When tính nhu cầu, Then lượng cần theo đơn vị kho (g/ml ÷ M, làm tròn lên theo bước đơn vị kho); dự trù/đi chợ vẫn ra đơn vị mua.
- **AC-11** (BA 02, Q7): Given thực phẩm đã có lô hoặc phiếu nhập đã xác nhận, When sửa, Then đơn vị kho và M khóa kèm lý do; đơn vị mua và N sửa được; mock 409 nếu cố đổi phần đã khóa.
- **AC-12** (BA 02): Given `/menu/foods`, Then có cột "Đơn vị kho" riêng (không gộp cột); chi tiết thực phẩm hiện 3 đơn vị và tỷ lệ.
- **AC-13** (BA 03): Given PHT ở danh sách/chi tiết món, When chọn "Nhân bản", Then mở form món mới điền sẵn loại, mô tả, toàn bộ định lượng, tên "<tên gốc> (bản sao)"; chỉ tạo khi bấm lưu; món gốc không đổi; tên trùng ⇒ lỗi như tạo mới.
- **AC-14** (BA 03, Q9): Given form món, When "Chép định lượng" từ nhóm X sang nhóm Y, Then cột Y nhận số của X; Y có ô đã nhập ⇒ hộp xác nhận "Thay N ô đã nhập của nhóm Y?" trước khi thay; cột Y đánh dấu "Vừa chép — kiểm tra lại" tới khi lưu; chưa lưu thì chưa ghi.
- **AC-15** (BA 03): Given món không có nguyên liệu nào lượng > 0, When lưu (cả Nháp), Then chặn (rule hiện có của `validateDish`).
- **AC-16** (BA 03, Q8a): Given form món mới hoặc món Nháp, Then có 2 nút "Lưu nháp" và "Lưu và dùng cho thực đơn"; món Đang dùng/Ngừng dùng giữ nút "Lưu" như hiện tại.
- **AC-17** (BA 03, Q8b): Given món còn nhóm tuổi đang áp dụng chưa có định lượng, When "Lưu và dùng cho thực đơn", Then chặn, nêu nhóm thiếu; Lưu nháp vẫn được. Món đã nằm trong thực đơn mẫu/tuần/dị ứng ⇒ không chuyển về Nháp (409).
- **AC-18** (BA 03, Q8): Given món Nháp, Then không xuất hiện trong ô chọn món (thực đơn mẫu, điều chỉnh ngày, món thay dị ứng, AI); repo 422 khi lưu thực đơn mẫu/điều chỉnh ngày/thực đơn dị ứng có món mới không `ACTIVE`; danh sách món có nhãn "Nháp" và lọc theo trạng thái Nháp.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Route NCC | `/kitchen/suppliers` (module kitchen, breadcrumb "Bếp & kho thực phẩm") | `/menu/suppliers` | NCC chỉ dùng cho chứng từ kho; cùng module/permission với phiếu nhập |
| Sidebar NCC | HT: nhóm mới "Danh mục thực phẩm" chỉ có "Nhà cung cấp". PHT: mục "Nhà cung cấp" trong nhóm "Kho thực phẩm", sau "Nhập kho" | PHT trong nhóm `catalog` | Nhóm `catalog` của PHT bị ẩn khi không có mảng thực đơn (`menuConfig.js:227`) nhưng PHT vẫn lập phiếu nhập |
| Lưu NCC | `db.suppliers` trong mock kitchen; phiếu nhập lưu `supplierId` + `supplierName` snapshot | Chỉ lưu id | Giữ tên trên chứng từ cũ khi NCC đổi tên |
| Migrate phiếu cũ | Seed tạo NCC từ các tên mẫu đang dùng; phiếu cũ khớp tên chuẩn hóa ⇒ gắn id, không khớp ⇒ nhãn "Chưa liên kết" | Xóa tên cũ / tự tạo NCC cho mọi tên lạ | Không mất dữ liệu, không sinh rác danh mục |
| Mô hình đơn vị | Thêm `stockUnit`, `purchaseToStock`, `stockUnitSize`; giữ `purchaseUnitSize` (= N × M, dẫn xuất khi lưu) cho chỗ đang đọc | Bảng quy đổi nhiều dòng tùy ý | BA chỉ cần 3 đơn vị + tỷ lệ; giữ field cũ tránh sửa dự trù/chi phí/import |
| Đơn vị kho ở mock bếp | `normalizeFood.unit = stockUnit`; nhu cầu xuất đổi từ g/ml sang đơn vị kho | Giữ đơn vị mua | BA: tồn theo đơn vị kho; mặc định stockUnit = purchaseUnit nên dữ liệu cũ không đổi |
| Trạng thái món | Thêm `DRAFT` vào trạng thái món (nhãn "Nháp"), dùng chung `RecordStatusBadge`; món hiện có giữ `ACTIVE` | Field `isDraft` riêng | Ô chọn món đã lọc `ACTIVE` ⇒ Nháp tự bị loại, ít sửa |
| Món chép từ thư viện | Tạo ở Nháp | Đang dùng như hiện tại | Không có bước lưu form để PHT chọn (Q8a); user xác nhận 2026-10-20 |
| Nhân bản món | Mở `/menu/dishes/new?from=<id>` điền sẵn, lưu qua `saveDish` | Endpoint `POST /menu/dishes/{id}/duplicate` | Không thêm contract; PHT sửa tên trước khi lưu |
| Chép định lượng | Thao tác trên form (client), ghi khi lưu | API riêng | Không đổi contract; đúng BA "yêu cầu review lại" |
| Giao diện màn mới | Theo mẫu list/form/detail đang có (`StockReceiptListPage`, `FoodListPage`, `FoodDetailPage`) | Wireframe mới | BA đủ trường; giữ đồng bộ UI kit |

## Phases
Phase 1 và Phase 2 không chung file ⇒ chạy song song được sau khi duyệt. Phase 3 chung `kitchenMockRepository.js`, `StockReceiptFormPage.jsx` với Phase 1 và `menuPlanningMockRepository.js`, `menuPlanningConstants.js`, `menuPlanningValidation.js` với Phase 2 ⇒ làm sau cả hai.

### Phase 1 — Nhà cung cấp (AC-1..AC-6)
- Files:
  - C `src/pages/kitchen/SupplierListPage.jsx` · C `src/pages/kitchen/SupplierFormPage.jsx` · C `src/pages/kitchen/SupplierDetailPage.jsx` · C `tests/kitchen/supplier.test.mjs`
  - M `src/services/kitchen/mock/kitchenMockRepository.js` (CRUD NCC, mã tự sinh, `listSupplierReceipts`, `saveStockReceipt` nhận `supplierId`, migrate `supplierName`) · M `src/services/kitchen/api/kitchenApi.js` · M `src/services/kitchen/kitchenService.js` · M `src/hooks/kitchen/useKitchen.js`
  - M `src/utils/kitchen/kitchenValidation.js` (`validateSupplier`; phiếu nhập: `supplierId` bắt buộc khi xác nhận) · M `src/utils/kitchen/kitchenPermissions.js` (`canManageSuppliers` HT, `canViewSuppliers` HT + PHT, `KITCHEN_ROUTE_ROLES`) · M `src/models/kitchen/kitchenConstants.js` (typedef Supplier, nhãn trạng thái) · M `src/mocks/kitchenSeed.js` (NCC mẫu, phiếu seed gắn id)
  - M `src/pages/kitchen/StockReceiptFormPage.jsx` (ô chọn NCC bằng `SearchSelect`) · M `src/pages/kitchen/StockReceiptListPage.jsx` (tên NCC + nhãn chưa liên kết)
  - M `src/routes/AppRoutes.jsx` · M `src/layouts/menuConfig.js` · M `src/utils/kitchen/breadcrumbs.js`
  - M `docs/features/nutrition-inventory.md`, `docs/architecture/ROUTE_MAP.md`
- Steps: 1. Repo + validation + permission + seed/migrate. 2. Test repo. 3. Ba màn NCC (PHT read-only). 4. Ô chọn ở phiếu nhập. 5. Route/sidebar/breadcrumb. 6. Docs + CMR nháp.
- Tests: `tests/kitchen/supplier.test.mjs` — thiếu tên 422; mã tự sinh tăng dần, không nhận mã từ payload; PHT xem được, PHT/Bếp ghi 403; Bếp xem 403; NCC ngừng dùng không gắn được phiếu mới; xóa NCC có phiếu 409, chưa có phiếu xóa được; migrate `supplierName` cũ; `listSupplierReceipts` đúng phiếu. Sửa test kitchen đang dùng `supplierName` nếu có.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; browser vai HT (list/form/detail), PHT (xem read-only, chọn NCC, xác nhận nhập).
- **Dừng chờ user review.**

### Phase 2 — Món: Nháp, nhân bản, chép định lượng (AC-13..AC-18)
- Files:
  - M `src/models/menu-planning/menuPlanningConstants.js` (`DRAFT` + nhãn) · M `src/components/menu-planning/MenuBadges.jsx` (màu Nháp)
  - M `src/services/menu-planning/mock/menuPlanningMockRepository.js` (`saveDish` nhận `DRAFT/ACTIVE/INACTIVE`, chặn rời Nháp khi thiếu nhóm, chặn về Nháp khi đã dùng; `saveMenu`, `saveDayAdjustment`, `saveAllergyMenu` chặn món mới không `ACTIVE`; `copyReferenceDish` tạo Nháp) · M `src/utils/menu-planning/menuPlanningValidation.js` (kiểm đủ nhóm khi kích hoạt)
  - M `src/pages/menu-planning/DishFormPage.jsx` (`?from=`, 2 nút lưu, "Chép định lượng", đánh dấu cột) · M `src/pages/menu-planning/DishListPage.jsx` (RowMenu "Nhân bản", nhãn + lọc Nháp) · M `src/pages/menu-planning/DishDetailPage.jsx` (nút Nhân bản, nhãn Nháp)
  - C `src/utils/menu-planning/recipeCopy.js` (hàm thuần: form nhân bản, chép cột, đếm ô bị thay) · C `tests/menu/dish-duplicate.test.mjs`
  - M `docs/features/nutrition-inventory.md`
- Steps: 1. Hàm thuần + test. 2. Trạng thái Nháp ở model/repo/validation + test. 3. Form nhận `from`, 2 nút lưu, chép định lượng + `ConfirmationModal`. 4. Nút ở list/detail (chỉ khi `canManage`). 5. Docs.
- Tests: `tests/menu/dish-duplicate.test.mjs` — bản sao không trỏ chung object món gốc; tên "(bản sao)"; chép cột thay đúng ô, đếm ô có số; `saveDish` bản sao trùng tên 422; kích hoạt thiếu nhóm 422; về Nháp khi đã trong thực đơn 409; `saveMenu`/`saveDayAdjustment`/`saveAllergyMenu` với món Nháp 422; `copyReferenceDish` ra Nháp. Test AI hiện có (`tests/menu/ai-week.test.mjs`) vẫn pass.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; browser vai PHT: tạo Nháp, kích hoạt, nhân bản, chép nhóm, thấy món Nháp không có trong ô chọn thực đơn.
- **Dừng chờ user review.**

### Phase 3 — Đơn vị mua / kho / công thức (AC-7..AC-12)
- Files:
  - M `src/models/menu-planning/menuPlanningConstants.js` (typedef, nhãn Khối lượng/Thể tích) · M `src/mocks/menuPlanningSeed.js` (đơn vị kho cho thực phẩm mẫu; ≥1 thực phẩm mua ≠ kho, vd. sữa thùng/hộp) · M `src/services/menu-planning/mock/menuPlanningMockRepository.js` (`sanitizeFood` mặc định + khóa theo Q7) · M `src/utils/menu-planning/menuPlanningValidation.js` (`validateFood`) · M `src/utils/menu-planning/foodImport.js` (thiếu cột đơn vị kho ⇒ mặc định, không đổi file mẫu xlsx)
  - M `src/pages/menu-planning/FoodFormPage.jsx` (card "Đơn vị & quy đổi") · M `src/pages/menu-planning/FoodDetailPage.jsx` · M `src/pages/menu-planning/FoodListPage.jsx` (cột Đơn vị kho)
  - M `src/services/kitchen/mock/kitchenMockRepository.js` (`normalizeFood`, nhu cầu xuất theo đơn vị kho, xác nhận nhập quy đổi) · M `src/services/kitchen/mock/marketList.js` (thêm `stockUnits` cạnh `buyUnits`) · M `src/pages/kitchen/StockReceiptFormPage.jsx` (cột Đơn vị chọn mua/kho)
  - C `src/utils/menu-planning/foodUnits.js` (helper quy đổi dùng chung menu + kitchen) · C `tests/menu/food-units.test.mjs` · M `tests/kitchen/stock-issue.test.mjs`, `tests/kitchen/market-list.test.mjs` nếu đổi kỳ vọng
  - M `docs/features/nutrition-inventory.md`
- Steps: 1. Helper quy đổi + test. 2. Model/validation/repo menu + mặc định dữ liệu cũ. 3. Form/detail/list thực phẩm. 4. Kho: nhập theo đơn vị dòng, xuất theo đơn vị kho. 5. Docs.
- Tests: `tests/menu/food-units.test.mjs` — tỷ lệ ≤ 0 lỗi; mặc định dữ liệu cũ (AC-8); khóa đơn vị khi có lô (AC-11). Kitchen: xác nhận nhập theo đơn vị mua tăng tồn `× N` (AC-9); nhu cầu xuất theo đơn vị kho (AC-10); test kho cũ vẫn pass khi stockUnit = purchaseUnit.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; browser: sửa thực phẩm, nhập kho theo đơn vị mua, xem tồn `/kitchen/dry-stock`, phiếu xuất.
- **Dừng chờ user review.** (~15 file; user muốn thì tách 3a menu / 3b kho.)

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | BA 01 | browser HT + PHT | 1 | |
| AC-2, AC-3, AC-5, AC-6 | BA 01 | `tests/kitchen/supplier.test.mjs` (mock repo) | 1 | |
| AC-4 | BA 01 | `supplier.test.mjs` + browser PHT | 1 | |
| AC-13, AC-14 | BA 03 | `tests/menu/dish-duplicate.test.mjs` + browser | 2 | |
| AC-15 | BA 03 | `tests/menu/dish-food.test.mjs` (đang có) | 2 | |
| AC-16, AC-17, AC-18 | BA 03 | `dish-duplicate.test.mjs` + browser | 2 | |
| AC-7, AC-8, AC-11 | BA 02 | `tests/menu/food-units.test.mjs` | 3 | |
| AC-9, AC-10 | BA 02/05 | `tests/kitchen/stock-issue.test.mjs`, test nhập kho | 3 | |
| AC-12 | BA 02 | browser + `tests/menu/ui-table-standard.test.mjs` | 3 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Working tree `dev` có nhiều file sửa dở của GĐ1 và phiên khác (cả `StockReceiptFormPage.jsx`, `kitchenMockRepository.js`, `menuConfig.js`, `DishFormPage.jsx`) | Lẫn thay đổi khi commit | Ghi đúng file đã sửa ở Progress log; chỉ sửa đoạn của GĐ2 | User tách khi commit |
| Đổi đơn vị kho làm lệch tồn/xuất | Sai số kho trên demo | Mặc định stockUnit = purchaseUnit (N=1); test hồi quy kho cũ phải pass | Bỏ field mới ⇒ code đọc mặc định cũ |
| Món Nháp lọt vào thực đơn qua đường chưa chặn | Bếp tính định lượng từ món chưa hoàn chỉnh | Chặn ở repo (không chỉ ô chọn); test từng đường lưu | Bỏ `DRAFT` ⇒ món Nháp về `ACTIVE` |
| localStorage cũ (phiếu chỉ có `supplierName`, food không có stockUnit) | Hiển thị lỗi | Migrate khi đọc, không ghi đè dữ liệu | Xóa localStorage demo |
| BE chưa có contract NCC/đơn vị/trạng thái món (NUT-12 PENDING, NUT-11 OPEN) | FE đoán payload | Chỉ mock; ghi CMR đề xuất | — |
| `verify` fail do phiên khác (như GĐ1) | Không đạt Iron Law | Báo đúng file fail và nguồn | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `src/services/kitchen/api/kitchenApi.js` (suppliers, receipt `supplierId`, `unitKind` dòng), `src/services/menu-planning/api/menuPlanningApi.js` (food: `stockUnit`, `purchaseToStock`, `stockUnitSize`; dish `status` có `DRAFT`) — PROPOSED, ghi CMR
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file ⇒ 3 phase, mỗi phase dừng review; Phase 3 ~15 file, đã đề xuất tách 3a/3b nếu user muốn
- [x] Không dùng rule PENDING/OPEN như đã chốt (BA DERIVED/PENDING đã hỏi user Q1–Q9)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-20 — Duyệt
- User duyệt plan (Q1–Q10 + món chép từ thư viện ở Nháp); bắt đầu Phase 1.

### 2026-10-20 — Phase 1 NCC (chờ review)
- Commit: chưa commit
- Verify baseline trước khi sửa: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Đã làm:
  - Mock: `db.suppliers` (4 NCC hư cấu, 1 ngừng dùng), `getSuppliers` / `getSupplier` (kèm phiếu nhập liên kết) / `saveSupplier` (mã `NCC###` tự sinh, bỏ qua mã gửi lên) / `deleteSupplier` (409 khi đã có phiếu, kể cả nháp); quyền `canManageSuppliers` (HT), `canViewSuppliers` (HT + PHT).
  - Phiếu nhập: gửi `supplierId`, lưu kèm tên NCC tại lúc lưu; NCC ngừng dùng 422 với phiếu mới, nháp đã gắn trước vẫn giữ; xác nhận thiếu NCC ⇒ "Chọn nhà cung cấp."; DB cũ: tạo danh mục rồi gắn phiếu theo tên trùng (không phân biệt hoa thường/dấu), tên lạ ⇒ nhãn "Chưa liên kết danh mục".
  - UI: `/kitchen/suppliers` (danh sách, tìm, lọc trạng thái), `/new`, `/:id`, `/:id/edit`; PHT chỉ xem; ô chọn NCC (`SearchSelect`) ở phiếu nhập; sidebar HT nhóm Danh mục, PHT nhóm Kho.
  - Docs: `docs/features/nutrition-inventory.md` (quyết định GĐ2, CMR mục 8), `docs/architecture/ROUTE_MAP.md`.
- Tests: `tests/kitchen/supplier.test.mjs` (6 test: AC-2, AC-3, AC-4, AC-5, AC-6 + validate); sửa `tests/kitchen/dry-stock.test.mjs`, `tests/kitchen/stock-issue.test.mjs` sang `supplierId`; `tests/menu/nutrition-flow.test.mjs` cập nhật sidebar HT/PHT.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 77, kitchen 49, merge 43, hardening 20, dashboard 11 pass); `node scripts/check-ai-layer.mjs` → `0 lỗi, 23 cảnh báo`.
- Browser (localhost:5178, DB mock mới): HT xem danh sách 4 NCC, chi tiết NCC001 có 2 phiếu, form báo lỗi tên trống + SĐT sai, tạo NCC005; PHT xem danh sách không có nút Thêm/Sửa, `/kitchen/suppliers/new` ⇒ "Không có quyền truy cập", ô chọn NCC ở phiếu nhập không có NCC004 (ngừng dùng), xác nhận thiếu NCC báo lỗi, lưu nháp với NCC005 hiện ở danh sách phiếu và chi tiết NCC. Console không lỗi. Chưa thử trên browser phiếu cũ chưa liên kết (đã có test).
- Khác plan:
  - Chi tiết NCC trả luôn `receipts` (một API `GET /kitchen/suppliers/{id}`) thay vì `GET /kitchen/suppliers/{id}/receipts` riêng — ít gọi hơn; CMR đã ghi theo cách này.
  - Thêm file ngoài danh sách: `src/components/kitchen/KitchenBadges.jsx` (`SupplierStatusBadge`), `src/styles/modules/kitchen.css` (`.kb-span-all`), `tests/menu/nutrition-flow.test.mjs` (khóa sidebar GĐ1).
  - Sửa lỗi phát hiện khi kiểm browser: form NCC ghi `serverErrors[field] = undefined` làm mất lỗi kiểm tra khi sửa ô ⇒ xóa hẳn khóa. `src/pages/menu-planning/FoodFormPage.jsx:70` có cùng lỗi (gõ lại ô sau khi chạm thì lỗi ẩn, server vẫn chặn 422) — sửa ở Phase 3 vì Phase 3 sửa file này.
- Tiếp: user review Phase 1 ⇒ user: "Phase 1 ổn" (2026-10-20), bắt đầu Phase 2.

### 2026-10-20 — Phase 2 Món: Nháp, nhân bản, chép định lượng (chờ review)
- Commit: chưa commit
- Đã làm:
  - Model: `DISH_STATUS` (`DRAFT | ACTIVE | INACTIVE`), `DISH_STATUS_LABELS`; `DishStatusBadge`.
  - Validation: `validateDish(form, others, { requireGroups })` — chuyển sang dùng cho thực đơn (món mới hoặc từ Nháp) cần đủ định lượng mọi nhóm tuổi đang áp dụng.
  - Mock: `saveDish` nhận Nháp, kiểm khi rời Nháp, 409 khi đưa món đã dùng về Nháp; `dishInUse` dùng chung với `deleteDish`; `requireUsableDish` chặn món mới không `ACTIVE` ở `saveMenu`, `saveDayAdjustment`, `saveAllergyMenu` (món đã có từ trước giữ nguyên); `copyReferenceDish` tạo Nháp.
  - Hàm thuần `src/utils/menu-planning/recipeCopy.js`: `recipeRow`, `duplicateDishForm`, `countReplacedCells`, `copyPortions`.
  - UI: form món mới/Nháp có "Lưu nháp" + "Lưu và dùng cho thực đơn" (báo nhóm thiếu định lượng ở đầu form); món Đang dùng/Ngừng dùng giữ "Lưu & thêm mới" + "Lưu"; `/menu/dishes/new?from=<id>` điền sẵn bản sao "(bản sao)" ở Nháp; thanh "Chép định lượng từ … sang …" trong thẻ công thức, hỏi "Thay N ô đã nhập…" trước khi thay, cột vừa chép có nhãn "Vừa chép" + cảnh báo kiểm tra lại; danh sách món có mục "Nhân bản", nhãn và lọc "Nháp"; chi tiết món có nút "Nhân bản".
  - Docs: `docs/features/nutrition-inventory.md` (bảng BA ↔ FE, CMR mục 9).
- Tests: `tests/menu/dish-duplicate.test.mjs` (6 test: AC-13..AC-18, lý do 422 kiểm cả message/details); `tests/menu/dish-food.test.mjs` món thiếu nhóm nhà trẻ lưu ở Nháp (rule mới).
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Browser: **chưa kiểm** — sau khi phiên resume, công cụ browser pane không còn và máy không có Playwright; cần kiểm tay hoặc mở lại browser pane: tạo món Nháp, "Lưu và dùng cho thực đơn" khi thiếu nhóm (báo lỗi), nhân bản, chép nhóm có hỏi xác nhận, món Nháp không có trong ô chọn món của thực đơn mẫu.
- Khác plan:
  - Form món mới bỏ nút "Lưu & thêm mới" (thay bằng 2 nút theo Q8a); món Đang dùng vẫn có.
  - Món Đang dùng/Ngừng dùng không có lựa chọn "Nháp" trong ô trạng thái (về Nháp chỉ chặn ở mock khi đã dùng) — tránh thêm luồng chưa ai yêu cầu.
  - Món Đang dùng cũ thiếu nhóm vẫn lưu được (quy tắc đủ nhóm chỉ áp khi rời Nháp/tạo mới) — không bắt sửa món đang dùng.
  - Thêm CSS `src/styles/modules/menu-planning.css` (`.td-recipe-copy`, `.td-recipe-copied`, `.td-copied-chip`), `src/components/menu-planning/MenuBadges.jsx`.
- Tiếp: user duyệt Phase 2 (2026-10-20, chưa kiểm browser). Phase 3 (đơn vị) — sửa luôn lỗi `serverErrors` ở `FoodFormPage.jsx:70`.

### 2026-10-20 — Phase 3 Đơn vị mua / kho / công thức (chờ review)
- Commit: chưa commit
- Đã làm:
  - Helper `src/utils/menu-planning/foodUnits.js` (`foodUnits`, `toStockQty`, `lineUnitName`, `hasPurchaseConversion`, `purchaseUnitSizeOf`); thực phẩm cũ: đơn vị kho = đơn vị mua, tỷ lệ 1.
  - Menu mock: `stockUnit`, `purchaseToStock`, `stockUnitSize`; `purchaseUnitSize` = tích hai tỷ lệ; `validateFood` chặn tỷ lệ ≤ 0/trống, thiếu đơn vị kho; `getFood.unitsLocked`; đã có lô/phiếu xác nhận ⇒ 409 khi đổi đơn vị kho hoặc g/ml/đơn vị kho (cả sửa hàng loạt/nhập khẩu); nhập khẩu chỉ có cột "Quy đổi" ⇒ giữ đơn vị kho, đổi tỷ lệ mua → kho. Seed: Đường kính mua "bao 10 kg", tồn theo kg.
  - Kho mock: `unit` của bếp = đơn vị kho; nhu cầu xuất (`stockUnits`) theo đơn vị kho; dòng phiếu nhập `unitKind` `PURCHASE | STOCK` (thiếu = STOCK), lưu `stockQty`, lô/tồn theo đơn vị kho, giá lô theo đơn vị kho; dự trù đồ khô đổi tồn sang đơn vị mua; seed phiếu nhập giá theo đơn vị kho.
  - UI: form thực phẩm có thẻ "Đơn vị & quy đổi" (đơn vị kho, g/ml trong 1 đơn vị kho, đơn vị mua, số đơn vị kho trong 1 đơn vị mua, dòng xem trước; khóa khi đã có tồn); chi tiết thực phẩm hiện hai tỷ lệ; danh sách thêm cột "Đơn vị kho" (cột cũ đổi tên "Đơn vị mua"); phiếu nhập thêm cột "Đơn vị" (chọn mua/kho khi khác nhau, mặc định đơn vị mua; dòng từ "Nhập kho bổ sung" theo đơn vị kho), cột "Nhập kho" hiện lượng theo đơn vị kho.
  - Sửa lỗi `serverErrors` ở `src/pages/menu-planning/FoodFormPage.jsx` (ghi đè mất lỗi kiểm tra).
  - Docs: `docs/features/nutrition-inventory.md` (bảng BA ↔ FE, CMR mục 10).
- Tests: `tests/menu/food-units.test.mjs` (5 test: AC-7, AC-8, AC-9, AC-11); `tests/kitchen/market-list.test.mjs` thêm AC-10 (đi chợ theo bao, xuất kho theo kg; thực phẩm cũ trùng nhau).
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` — menu 88 pass, kitchen 50 pass; merge 44 pass / 1 fail ở `tests/integration/selective-merge/permission-center.test.mjs` ("ba màn phân quyền dùng header, bảng và CSS chung", đòi `<FeatureLevelCard` trong `src/components/permissions/OverrideWizardModal.jsx`) — test do phiên khác sửa lúc 14:22, không thuộc file GĐ2. Chạy tay phần verify bị dừng: hardening 20, dashboard 11 pass; `npm run check` (lint, format:check, build) ✓.
- Verify chạy lại sau khi ghi log (test phân quyền phiên khác đã sửa xong): `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Browser: **chưa kiểm** (không có công cụ browser trong phiên). Cần kiểm tay: sửa Đường kính (thấy khóa đơn vị kho), nhập kho 2 bao ⇒ tồn +20 kg ở `/kitchen/dry-stock`, cột Đơn vị kho ở `/menu/foods`.
- Khác plan: không thêm `stockUnits` vào UI đi chợ (chỉ dùng cho phiếu xuất); dự trù đồ khô hiện tồn quy ra đơn vị mua (có thể lẻ, vd. 0,5 bao) để cùng đơn vị với lượng cần mua.
- Chưa kiểm bằng test: đổi tồn sang đơn vị mua ở dự trù đồ khô (`weeklyForecast.js`).
- Tiếp: user duyệt Phase 3 (2026-10-20). Còn kiểm browser Phase 2–3; đạt DoD ⇒ `status: done`.
