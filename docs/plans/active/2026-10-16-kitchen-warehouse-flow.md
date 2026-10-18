---
title: Luồng Bếp & kho theo cơ sở (dự trù tuần, kiểm nhận hàng tươi, xuất kho tự động, sổ lưu mẫu, kho khô, kiểm kê)
status: in-progress
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [nutrition, kitchen, attendance]
rules: [NUT-02, NUT-03, NUT-04, NUT-07, NUT-10, NUT-11, NUT-12]
risk: high
created: 2026-10-16
updated: 2026-10-18
---
# Luồng Bếp & kho theo cơ sở

## Context
- Nối tiếp luồng dinh dưỡng 5 bước (`docs/plans/completed/2026-10-14-nutrition-flow-redesign.md`, commit `9e790ef`). Bước 5 "Khẩu phần & đi chợ" (`/kitchen/required-quantity`) là điểm vào của bếp/kho.
- Wireframe sau khảo sát 18/10 (bản 2, user đã chọn): https://claude.ai/artifact/8Lar6xujFFjqyW5u7zdq23, file gốc scratchpad `kitchen-wf/`.
- Wireframe 16/10 (K1, K2): Artifact "Bếp & kho CareNest" (https://claude.ai/artifact/SwNn81C8BX9e9x9G7CTb6W, bản 2), file gốc ở scratchpad `kitchen-warehouse-wireframes.html`.
- Hiện trạng code (rà 16/10/2026):
  - Màn bếp/kho rời rạc, không theo luồng: menu nhóm `kitchen` `src/layouts/menuConfig.js:40`, mục `:90-98`; PHT `:141-150`, Bếp `:178-179`, HT `:126`. Route `src/routes/AppRoutes.jsx:366-377`, `:400`.
  - Chế biến: `MealPreparationUpdatePage.jsx` (đã xóa ở K1), `MealPreparationStatusPage.jsx`, `PreparationCard.jsx` (đã xóa ở K1); trạng thái `PREP_STATUS*` `src/models/kitchen/kitchenConstants.js:46-54`; mock `getMealPreparations`/`updateMealPreparation` `src/services/kitchen/mock/kitchenMockRepository.js:984-1069`.
  - Bàn giao suất nằm ở attendance: `MealHandoverPage.jsx` (đã xóa ở K1); `createHandovers` gọi khi chốt số `src/services/attendance/mock/attendanceMockRepository.js:148-175`, hàm `:461-558`; `HANDOVER_STATUS*` `src/models/attendance/attendanceConstants.js:72-86`; quyền `src/utils/attendance/attendancePermissions.js:45-57`.
  - `IngredientReceiptPage.jsx` là **bếp nhận đồ theo phiếu xuất kho** (`useStockIssue` `:30`, mock `confirmIngredientReceipt` `:750-806`), không phải kiểm nhận hàng tươi NCC giao. Hàng tươi chưa có bước kiểm nhận nào.
  - Phiếu xuất kho tính **mọi** thực phẩm, cả tươi (`computeDay` mock `:351-353`); `normalizeFood` (`:102-107`) bỏ mất `storage` dù menu-planning có `FOOD_STORAGE` (`src/models/menu-planning/menuPlanningConstants.js:96-98`).
  - Đã có: chặn duyệt xuất khi thiếu tồn (UI `StockIssueApprovalPage.jsx:101-115`, `:174`; mock 409 `:702-707`); SL không đạt không vào kho (`:645-673`). Chưa có: danh sách phiếu xuất, nguồn hàng, đọc `stockTransactions`, mức dùng/ngày, kiểm kê thực phẩm.
  - Báo thiếu `markMissingFoodSupplied` (`:957-982`) chỉ ghi chú, không phân tươi/khô, không trừ kho.
  - BE chưa có code nutrition (BE docs/modules/nutrition.md, mục "API & bảng: Chưa có"); FE chạy mock, endpoint `src/services/kitchen/api/kitchenApi.js` chỉ PROPOSED.

## Quyết định đã chốt
Bản 18/10/2026 thay bản 16/10 (đánh dấu "giữ" là không đổi). Nguồn: khảo sát S1–S10 (mục dưới) + user chọn phương án cùng ngày.

1. **Kho đồ khô riêng từng cơ sở, xem chung một màn** (mỗi cơ sở một cột); không chuyển hàng giữa cơ sở — user 16/10, sửa 18/10 (S4).
2. **Hàng tươi kiểm nhận theo phiếu giao hàng**, đối chiếu phiếu đặt hàng tuần của ngày đó: mỗi dòng Đặt / Giao / Thực nhận / Đủ · Thiếu · Trả lại; Thiếu hoặc Trả lại bắt buộc lý do và ô "Đã báo NCC". Bếp kiểm rồi gửi; **PHT xác nhận cuối** hoặc trả bếp kiểm lại. Không cộng tồn — user 18/10 (S5–S6).
3. **Bỏ hẳn trạng thái chế biến và bàn giao suất** — giữ (đã làm ở K1).
4. **Sổ lưu mẫu** theo QĐ 1246/QĐ-BYT: mỗi bữa có giờ lấy, người lưu, từng món (khối lượng, dụng cụ, nhiệt độ, ghi chú); đủ 24 giờ thì ghi hủy (giờ, người hủy). In Mẫu 4 (nhãn theo bữa) và Mẫu 5 (sổ cả ngày), ô ký để trống ký tay. Không chặn bước nào. Ô tick lưu mẫu của K2 bị thay — user 18/10 (S10); in và ký tay là mặc định mình chọn, user không phản đối.
5. **Kiểm kê kho đơn giản theo tháng** — giữ.
6. **Báo thiếu gộp vào kiểm nhận**, bỏ trang Báo thiếu. Thiếu xử lý với NCC (giao bù), không đi qua kho — user 18/10 (S6).
7. Bố cục — user 18/10, wireframe https://claude.ai/artifact/8Lar6xujFFjqyW5u7zdq23 (bản 2):
   - Dự trù & đi chợ: **A · hai tab** "Dự trù tuần" (lưới suất lớp × ngày + phiếu đặt hàng tuần, tab con Hàng tươi / Đồ khô cần mua) và "Báo NCC thay đổi" (hôm nay sau chốt + ngày mai đã đổi; số việc chưa báo trên tab).
   - Kiểm nhận hàng tươi: **A · một bảng đủ cột** (Thực phẩm, ĐVT, Đặt, Giao, Thực nhận, Kết quả, Lý do, NCC) + chân bảng dính (đếm Đủ/Thiếu/Trả lại, nút theo vai); dải trên có số phiếu giao hàng, NCC, giờ giao, hai bước "Bếp kiểm nhận → Chờ PHT xác nhận".
   - Sổ lưu mẫu: **B · mỗi bữa một thẻ** (trạng thái, giờ lấy, người lưu, bảng món) + cột phải "Chờ ghi hủy" và "In biểu mẫu".
   - Kho khô: **B · một bảng, mỗi cơ sở một cột** (tồn · đủ dùng), 4 ô số (hết hàng, đủ dưới 3 ngày, hết hạn trong 14 ngày, xuất tự động gần nhất), chip lọc, panel phải theo lô (lô, hạn, giá, NCC, nút nhập theo cơ sở), giao dịch gần đây cả hai cơ sở. Bếp mở ⇒ màn không có quyền.
   - Không vẽ lại, giữ bố cục cũ: Quy trình hôm nay (B 16/10, đổi mốc), Phiếu xuất kho (danh sách + `SidePanel`, chỉ xem/in), Kiểm kê, phiếu nhập (form hiện có + trường mới).
8. Mốc giờ chỉ để hiển thị, không chặn — giữ; mốc mới: 06:30 kiểm nhận hàng tươi · 08:30 chốt suất cả ngày (tự xuất kho khô, báo NCC chênh lệch) · lưu mẫu theo bữa · chiều sửa dự trù ngày mai.
9. "Đủ … ngày" = tồn ÷ lượng xuất trung bình 7 ngày — giữ.
10. **Phiếu nhập kho khô ghi lô, hạn dùng, giá, NCC** (NCC là chữ tự do, chưa có danh mục — P-09) — user 18/10 (S7). Ai ghi sổ, ai sửa phiếu nhập sai: **còn mở** (Q1).
11. **Dự trù theo tuần** — user 18/10 (S1): lập từ thực đơn tuần đã công bố; gợi ý suất = đăng ký ăn − nghỉ đã báo, PHT sửa theo lớp và ngày; một **phiếu đặt hàng tuần** (tươi chia theo ngày giao; khô = cần cho tuần − tồn cơ sở), PHT gửi NCC ngoài app rồi đánh dấu "Đã gửi". Sửa sau khi gửi ⇒ dòng đổi vào "Báo NCC thay đổi". Sáng sau chốt ⇒ chênh lệch (đã đặt − cần theo chốt) vào cùng tab. Ngày đã chốt không sửa dự trù. Không giới hạn giờ lập.
12. **Chốt suất cả ngày** (S2): một lần xác nhận chốt mọi bữa trong ngày; trẻ đến sau chốt không thêm suất. Người xác nhận (S3): FE hiện nút theo quyền BE trả về; mock cho PHT của cơ sở và HT.
13. **Tự xuất kho đồ khô lúc chốt** (S8): xác nhận suất ⇒ sinh phiếu xuất = suất chốt × định lượng, chỉ đồ khô, trừ tồn ngay; bỏ duyệt xuất và "Đã nhận". Thiếu tồn ⇒ không trừ âm, dòng ghi "thiếu x", hiện ở "Cần xử lý" và Kho khô — mình đề xuất. Xác nhận lại sau thay đổi (NUT-03) ⇒ xuất thêm hoặc hoàn phần chênh — mình đề xuất.
14. Phạm vi: Bếp chỉ thấy cơ sở mình; PHT và HT xem cả hai cơ sở ở Kho khô; quyền ghi (nhập, kiểm kê) theo cờ từng cơ sở BE trả về; mock cho PHT ghi cả hai cơ sở, HT chỉ xem — mình đề xuất theo "quản lý chung" (S4), khớp wireframe.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor PHT cơ sở (chốt số đã có, duyệt xuất, nhập kho, kiểm kê, xử lý báo thiếu), Bếp cơ sở (kiểm nhận tươi, nhận đồ khô, báo thiếu, tick lưu mẫu), HT (xem). Outcome: mỗi ngày đồ tươi đối chiếu được, đồ khô ra kho có chứng từ, tồn khớp thực tế hằng tháng.
  Rule: NUT-02/03 (CONFIRMED — bếp chỉ thấy số đã chốt), NUT-07 (CONFIRMED luồng), NUT-10 (CONFIRMED — tươi/khô), NUT-11 (OPEN — kho; FE làm theo quyết định 1, cần chốt ADR-0009 ở BE), NUT-14..16 (PROPOSED — bỏ theo quyết định 3).
  Flow (sau 18/10): [B] PHT lập dự trù tuần từ thực đơn tuần ⇒ [S] phiếu đặt hàng tuần ⇒ [B] PHT gửi NCC, đánh dấu · hằng ngày: [B] Bếp kiểm nhận tươi theo phiếu giao hàng ⇒ [B] PHT xác nhận · [B] PHT/HT xác nhận suất cả ngày ⇒ [S] tự xuất kho khô ⇒ [B] PHT báo NCC chênh lệch · [B] Bếp ghi sổ lưu mẫu từng bữa, ghi hủy sau 24 giờ · chiều: [B] PHT sửa dự trù ngày mai ⇒ báo NCC phần đổi. Tháng: [B] PHT kiểm kê ⇒ [S] điều chỉnh tồn.
- **Đối chiếu thiết kế ban đầu:** SRS UC 6.23–6.25, BF-09 có kho theo cơ sở (khớp quyết định 1). BP-BT-03 / NUT-14 có CHỜ NẤU → ĐANG NẤU → SẴN SÀNG BÀN GIAO và GV nhận suất (trái quyết định 3). ADR-0009 ghi "không tự tạo entity kho… dừng lại và hỏi" — user đã quyết ở FE; BE chưa sửa.
- **Ảnh hưởng:** module nutrition/kitchen + attendance (gỡ bàn giao); điều hướng theo role (menuConfig) ⇒ làn L; dashboard HT/PHT/Bếp/GV; contract BE mới (mục Contract); APP `cooking_status` lệch quyết định 3 (ngoài plan này, ghi lại cho APP).

### Câu hỏi mở
- **Q1 (S7):** Ai ghi sổ nhập kho khô, ai được sửa phiếu nhập đã lưu khi nhập sai (PHT sửa trực tiếp, hay khóa phiếu và chỉnh qua kiểm kê)? Chặn bước phiếu nhập ở K7.

Đã trả lời (bảng dưới).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Phạm vi kho V1? | Kho riêng từng cơ sở, chỉ đồ khô | user | 16/10/2026 | Chưa; cần sửa BE ADR-0009 (xin phép) |
| Hàng tươi xử lý sao? | Kiểm nhận tại bếp, không cộng tồn | user | 16/10/2026 | — |
| Trạng thái bếp / bàn giao? | Bỏ hẳn | user | 16/10/2026 | Chưa; đề xuất BE ghi NUT-14..16 = không làm |
| Lưu mẫu? | Ô tick + giờ ở màn Quy trình | user | 16/10/2026 | — |
| GV còn màn bếp? | Không (hệ quả quyết định 3) | user | 16/10/2026 | — |
| Kiểm kê V1? | Có, đơn giản theo tháng | user | 16/10/2026 | — |
| Báo thiếu xử lý? | Hai nhánh tươi/khô (thay bằng S6) | user | 16/10/2026 | — |
| Dự trù theo ngày hay tuần? | Theo tuần theo thực đơn tuần; sửa ngày mai hôm trước; một phiếu NCC/tuần; gồm đồ khô cần mua | user | 18/10/2026 | Chưa; đề xuất BE tách NUT-07 |
| Bố cục 4 màn? | Dự trù A, Kiểm nhận A, Lưu mẫu B, Kho khô B | user | 18/10/2026 | — |

## Khảo sát bổ sung 18/10/2026
Nguồn: trường trả lời 10 câu (file `Note_G94_bepvakho.docx`, user gửi 18/10/2026) + chọn phương án cùng ngày. Mức: user xác nhận; BE chưa ghi rule.

| # | Khảo sát | Thay quyết định |
| --- | --- | --- |
| S1 | Dự trù **theo tuần** theo thực đơn tuần đã công bố: suất dự kiến mỗi ngày = đăng ký ăn − nghỉ đã báo (hệ thống gợi ý, PHT sửa theo lớp/ngày) ⇒ **một phiếu đặt hàng tuần** gửi NCC trước tuần (tươi chia theo ngày giao; khô = cần cho tuần − tồn cơ sở). Chiều hôm trước PHT sửa số ngày mai nếu cần ⇒ báo NCC phần đổi. Sáng sau chốt PHT báo NCC chênh lệch. (User sửa 18/10: không phải tính theo từng ngày) | Mới; lệch NUT-07 phần đi chợ |
| S2 | Chốt điểm danh = **chốt suất cả ngày**; đến muộn sau giờ chốt không nhận | Chốt theo bữa ⇒ theo ngày; trả lời P-04 |
| S3 | PHT phụ trách xác nhận; vắng ⇒ PHT còn lại ⇒ HT. Thay đổi sau xác nhận báo bếp qua Zalo (ngoài app) | Trả lời P-05 |
| S4 | Mỗi cơ sở có bếp + kho khô thật, **quản lý chung**, không chuyển hàng giữa cơ sở ⇒ **tồn tách theo cơ sở, một màn xem chung** | Sửa quyết định 1 |
| S5–S6 | Kiểm nhận hàng tươi theo **phiếu giao hàng**; PHT + bếp kiểm; thiếu ⇒ báo NCC, hỏng/sai ⇒ trả; **PHT xác nhận cuối**. **Báo thiếu gộp vào kiểm nhận**, bỏ trang Báo thiếu | Sửa quyết định 2, 6 |
| S7 | Kho khô nhập khi hết (thường buổi sáng), PHT kiểm nhận; ghi **lô, hạn dùng, giá, NCC**. Ai ghi sổ / ai sửa phiếu nhập sai: **chưa trả lời** | Sửa quyết định 10 |
| S8 | Xuất đồ khô theo thực đơn đã cân đối; bếp không nhận thừa/thiếu ⇒ **tự trừ tồn lúc chốt số, theo suất chốt × định lượng**; bỏ duyệt xuất, bỏ "Đã nhận" | Sửa AC-5, AC-6 |
| S9 | Không làm thực đơn riêng cho trẻ dị ứng, chỉ tăng khẩu phần món không dị ứng | Lệch NUT-09, `MENU_TYPE.ALLERGY`; để việc riêng của luồng thực đơn |
| S10 | Bếp lưu mẫu, ghi theo **Mẫu 4** (nhãn theo bữa: món, giờ lấy, ký người lấy mẫu / NV y tế / BGH) và **Mẫu 5** (sổ lưu và hủy mẫu theo món: số suất, khối lượng, dụng cụ, nhiệt độ, giờ lấy, giờ hủy, ghi chú, người lưu, người hủy) — QĐ 1246/QĐ-BYT | Sửa quyết định 4, AC-3 |

Đề xuất cho BE (chưa sửa, cần user cho phép): đóng P-04, P-05; P-08 ⇒ kho theo cơ sở; P-09 một phần (S5–S6); NUT-07 tách "đi chợ theo dự trù" / "xuất kho theo chốt"; NUT-09 ghi bỏ thực đơn dị ứng riêng; thêm rule lưu mẫu (S10).

## Acceptance criteria
AC-1, AC-2 bản 16/10 đã làm ở K1, K2; AC-2 và AC-3 dưới đây là bản sửa 18/10.

- **AC-1** (gỡ chế biến/bàn giao) — giữ, đã đạt ở K1.
- **AC-2** (hub): Given PHT hoặc Bếp cơ sở A, When mở `/kitchen`, Then dòng thời gian có các mốc của quyết định 8 với trạng thái thật (kiểm nhận: chờ bếp / chờ PHT / đã xác nhận; chốt suất cả ngày; phiếu xuất tự động; lưu mẫu từng bữa; dự trù ngày mai khớp phiếu hay đã đổi); cột "Cần xử lý" gồm chênh lệch chưa báo NCC, kiểm nhận chờ PHT, mẫu chờ ghi hủy, dòng xuất thiếu tồn, tồn thấp (PHT); bấm mở đúng màn. HT xem được, không có nút.
- **AC-3** (sổ lưu mẫu, S10): Given Bếp, When ghi lưu mẫu bữa trưa (giờ lấy + từng món: khối lượng, dụng cụ, nhiệt độ), Then thẻ bữa ra "Đã lưu hh:mm", ghi người lưu; thiếu giờ lấy hoặc khối lượng món ⇒ không lưu được. Given mẫu đã đủ 24 giờ, Then hiện ở "Chờ ghi hủy"; Bếp ghi hủy ⇒ lưu giờ + người hủy; chưa đủ 24 giờ ⇒ không ghi hủy được. In Mẫu 4 theo bữa, Mẫu 5 theo ngày, ô ký trống. PHT/HT chỉ xem và in. Không bước nào bị chặn vì chưa lưu mẫu.
- **AC-4** (kiểm nhận tươi, S5–S6, NUT-10): Given phiếu đặt hàng tuần có dòng tươi ngày D, When Bếp mở kiểm nhận ngày D, Then mỗi dòng có Đặt (phiếu tuần, số đã đổi nếu có), Giao, Thực nhận; Kết quả Đủ/Thiếu/Trả lại; Thiếu/Trả lại thiếu lý do ⇒ không gửi được. Bếp gửi ⇒ "Chờ PHT xác nhận"; PHT "Xác nhận kết quả" ⇒ khóa, hoặc "Trả bếp kiểm lại" ⇒ bếp sửa được. Ô "Đã báo NCC" tick được tới khi xác nhận. Tồn kho không đổi. Không còn trang Báo thiếu; route cũ chuyển về kiểm nhận.
- **AC-5** (tự xuất kho khô, S8, NUT-02/03/07): Given suất ngày D chưa chốt, When người có quyền xác nhận suất cả ngày, Then sinh đúng một phiếu xuất ngày D chỉ gồm thực phẩm khô = suất chốt × định lượng, trừ tồn ngay, giao dịch `OUT`; dòng thiếu tồn ⇒ trừ về 0, ghi "thiếu x". Xác nhận lại sau thay đổi ⇒ xuất thêm hoặc hoàn phần chênh, không sinh phiếu thứ hai. Màn Phiếu xuất kho chỉ xem và in; không còn nút Duyệt, "Đã nhận", trang Nhận từ kho.
- **AC-6** (dự trù tuần, S1): Given thực đơn tuần W đã công bố, When PHT mở tab "Dự trù tuần", Then lưới lớp × ngày có gợi ý = đăng ký ăn − nghỉ đã báo; PHT sửa được ô của ngày chưa chốt (ô đã sửa có dấu); ngày đã chốt hiện số chốt, khóa. Lưu ⇒ phiếu đặt hàng tuần tính lại: tươi theo ngày giao = suất × định lượng (làm tròn theo đơn vị mua), khô = cần cho tuần − tồn cơ sở (≤ 0 ⇒ "Đủ"). "Đánh dấu đã gửi NCC" ghi giờ + người. Chưa có thực đơn tuần ⇒ trạng thái rỗng có nút mở Thực đơn tuần. Bếp, HT chỉ xem.
- **AC-7** (báo NCC thay đổi, S1): Given phiếu tuần đã gửi, When PHT sửa suất ngày D, Then dòng tươi đổi của ngày D hiện ở tab "Báo NCC thay đổi" (đã đặt → cần, chênh lệch) và phiếu tuần gạch số cũ. Given suất ngày D đã chốt, Then tab có thêm nhóm "Hôm nay · sau chốt" với chênh lệch giữa số đã đặt và số cần theo chốt. Tick "Đã báo" từng dòng; số dòng chưa báo hiện trên tab và ở hub.
- **AC-8** (chốt cả ngày, S2–S3): Given điểm danh cơ sở A ngày D đủ lớp, When PHT của A (hoặc HT) xác nhận, Then mọi bữa ngày D chuyển CONFIRMED trong một lần, bếp nhận một thông báo; GV không thêm suất sau chốt (giữ hủy suất theo GBR-ATT-08). Người không có quyền không thấy nút; BE trả 403 ⇒ hiện lỗi.
- **AC-9** (kho khô xem chung, S4, S7): Given PHT hoặc HT, When mở Kho khô, Then bảng mỗi thực phẩm một dòng, mỗi cơ sở một cột (tồn · đủ dùng), sắp theo mức gấp; 4 ô số; chip lọc (tất cả, hết hàng, dưới 3 ngày, sắp hết hạn); bấm dòng mở panel lô theo cơ sở (lô, hạn, giá, NCC, ngày nhập) và giao dịch của thực phẩm. Phiếu nhập bắt buộc lô, hạn dùng, giá, NCC. Nút nhập theo cờ ghi từng cơ sở.
- **AC-10** (kiểm kê): như AC-8 bản 16/10 — số đếm ⇒ Lệch tự tính; lệch ≠ 0 thiếu lý do ⇒ không chốt; chốt ⇒ tồn = số đếm, giao dịch `ADJUST`, phiếu khóa; mỗi cơ sở một phiếu nháp.
- **AC-11** (phạm vi): Given Bếp cơ sở B, When mở mọi màn bếp, Then chỉ thấy dữ liệu cơ sở B; Bếp không vào Kho khô, Kiểm kê; Bếp không sửa dự trù, không xác nhận kiểm nhận.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Màn dự trù | Trang mới `/kitchen/forecast` thay `RequiredFoodQuantityPage`; route cũ chuyển hướng | Sửa trang cũ theo ngày | Đổi đơn vị từ ngày sang tuần, khác hẳn bố cục |
| Nguồn "Đặt" khi kiểm nhận | Dòng tươi của phiếu đặt hàng tuần ngày D (số sau khi đổi) | Phiếu đi chợ ngày cũ | Phiếu tuần là chứng từ đã gửi NCC (S1) |
| Kiểm nhận tươi | Trang mới `/kitchen/fresh-receipts` | Sửa `IngredientReceiptPage` | Trang cũ là nhận theo phiếu xuất, bị bỏ (S8) |
| Xuất kho | Sinh trong `confirmMealCount` (một chỗ), phiếu khóa theo `campusId+date` | Bếp hoặc PHT bấm tạo | S8: tự trừ lúc chốt, không bước tay |
| Chốt cả ngày | Giữ dữ liệu `mealCounts` theo bữa; thêm thao tác xác nhận theo ngày | Gộp thành một bản ghi/ngày | Ít đổi dữ liệu; số theo bữa vẫn cần cho định lượng |
| Lưu mẫu | Bỏ `FoodSampleChecklist`, thay sổ theo bữa + món | Giữ ô tick, thêm trường | Mẫu 5 cần dữ liệu theo món và bước hủy |
| Kiểm kê | Trạng thái riêng `DRAFT/FINALIZED`, tách `Diff`/`SummaryStats` từ kiểm kê tài sản — giữ | Dùng chung trạng thái tài sản | Trạng thái tài sản có nhiều cấp không hợp |

## Phases
K1, K2 xong (chờ user review). K3–K7 thay K3/K4 bản 16/10, mỗi phase một plan con `2026-10-18-kitchen-flow-k<n>-…` viết khi bắt đầu (khuôn plan C). Thứ tự: K3 → K4 → K5; K6 độc lập; K7 sau K4. Mỗi phase tự cập nhật `getKitchenDay` (`kitchenMockRepository.js:594`) và mốc của mình ở `KitchenFlowPage.jsx:53-110`. Mỗi phase: Exit `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; **dừng chờ user review**.

### Phase K3 — Dự trù tuần và báo NCC thay đổi (AC-6, AC-7)
- Files: C pages/kitchen `WeeklyForecastPage.jsx`, components/kitchen `WeekForecastGrid.jsx`, `WeeklyOrderTable.jsx`, `SupplierChangeTable.jsx`; D `RequiredFoodQuantityPage.jsx` (route `/kitchen/required-quantity` ⇒ redirect `/kitchen/forecast`); M `MarketSheetPrint.jsx` (in phiếu tuần), mock (`weekDates` `:88`, `computeSession` `:254`, `computeDay` `:340`, `getRequiredQuantity` `:952` ⇒ thêm `weeklyForecasts {campusId, weekStart, cells[classId][date], sentAt, sentBy, sentSnapshot}`, `getWeeklyForecast`, `saveWeeklyForecast`, `markWeeklyOrderSent`, `getSupplierChanges`, `markSupplierNotified`), `kitchenConstants.js`, `kitchenValidation.js` (ô suất số nguyên 0 … đăng ký ăn), `kitchenPermissions.js` (`canEditForecast` = PHT cơ sở), `kitchenService.js`, `kitchenApi.js`, `useKitchen.js`, `AppRoutes.jsx:414`, `menuConfig.js:96,146-153,183` (mục "Dự trù & đi chợ"), `kitchen.css`.
- Steps: 1. Test mock trước (gợi ý, khóa ngày đã chốt, phiếu tuần tươi/khô, đổi sau gửi ⇒ thay đổi, chênh lệch sau chốt). 2. Mock + service. 3. Trang hai tab theo wireframe A. 4. Route, menu, hub.
- Tests: `tests/kitchen/weekly-forecast.test.mjs`; sửa `tests/kitchen/market-list.test.mjs:174-222` theo shape mới.

### Phase K4 — Chốt suất cả ngày, tự xuất kho khô, phiếu xuất chỉ xem (AC-5, AC-8)
- Files: M attendance `attendanceMockRepository.js:377-397` (xác nhận theo ngày, gọi xuất kho), `attendancePermissions.js:38-39` (PHT cơ sở hoặc HT), `MealCountPage.jsx:23-121` (một nút "Xác nhận suất cả ngày"), `attendanceService.js`, `attendanceApi.js`; kitchen mock (`approveStockIssue` `:762`, `confirmIngredientReceipt` `:821` ⇒ thay bằng `autoIssueDryStock(db, campusId, date)` dùng `changeStock` `:375`, chỉ `storage === 'DRY'`; `issueView` `:525`; `listStockIssues`), `StockIssueApprovalPage.jsx` ⇒ đổi tên `StockIssuePage.jsx` (danh sách + `SidePanel`, chỉ xem/in), D `IngredientReceiptPage.jsx` (route ⇒ redirect `/kitchen/stock-issues`), `IssueBlocks.jsx` (bỏ phần duyệt/nhận nếu không còn dùng), `kitchenConstants.js:50-63` (bỏ `PENDING_APPROVAL`, `RECEIVED`), `KitchenBadges.jsx`, `kitchenPermissions.js`, `kitchenService.js`, `kitchenApi.js`, `useKitchen.js`, `AppRoutes.jsx:409,415`, `menuConfig.js:97,100,150-151,183`.
- Steps: 1. Test trước (một phiếu/ngày, chỉ đồ khô, thiếu tồn không âm, xác nhận lại ⇒ chênh). 2. Xác nhận theo ngày ở attendance. 3. Xuất tự động. 4. Màn phiếu xuất chỉ xem; gỡ trang nhận.
- Tests: `tests/kitchen/stock-issue.test.mjs` (mới), `tests/kitchen/meal-count-day.test.mjs` (mới, xác nhận theo ngày); sửa `tests/kitchen/flow-removal.test.mjs` (đang gọi `confirmMealCount` theo bữa), `tests/kitchen/kitchen-day.test.mjs:26`.

### Phase K5 — Kiểm nhận hàng tươi theo phiếu giao hàng (AC-4)
- Files: C pages/kitchen `FreshReceiptPage.jsx`; D `MissingFoodReportPage.jsx`, `MissingFoodForm.jsx` (route `/kitchen/missing-food` ⇒ redirect `/kitchen/fresh-receipts`); M mock (`getMissingFoodReports` `:974`, `submitMissingFoodReport` `:988`, `markMissingFoodSupplied` `:1028` ⇒ bỏ; thêm `freshReceipts {campusId, date, deliveryNote, supplierName, deliveredAt, status DRAFT|SUBMITTED|CONFIRMED, lines[{foodId, ordered, delivered, received, result OK|SHORT|RETURNED, reason, supplierNotifiedAt}], submittedBy/At, confirmedBy/At}`, `getFreshReceipt`, `saveFreshReceipt`, `submitFreshReceipt`, `confirmFreshReceipt`, `returnFreshReceipt`), `kitchenConstants.js:65-66` (bỏ `MISSING_STATUS`; thêm `FRESH_RECEIPT_STATUS`, `FRESH_RESULT`), `kitchenValidation.js`, `kitchenPermissions.js` (Bếp sửa/gửi; PHT xác nhận/trả), `KitchenBadges.jsx`, `kitchenService.js`, `kitchenApi.js`, `useKitchen.js`, `AppRoutes.jsx:416`, `menuConfig.js:98,152,183`, `kitchen.css` (chân bảng dính).
- Tests: `tests/kitchen/fresh-receipt.test.mjs` (lý do bắt buộc, luồng gửi ⇒ xác nhận / trả, tồn không đổi, Bếp B không đọc A).

### Phase K6 — Sổ lưu mẫu (AC-3)
- Files: C pages/kitchen `FoodSampleLogPage.jsx` (`/kitchen/food-samples`), components/kitchen `FoodSampleMealCard.jsx`, `FoodSamplePrint.jsx` (Mẫu 4, Mẫu 5); D `FoodSampleChecklist.jsx`; M mock (`sampleView` `:578`, `emptySample` `:586`, `setFoodSample` `:641` ⇒ `foodSamples {campusId, date, session, takenAt, takenBy, dishes[{dishId, weight, container, temperature, note}], destroyedAt, destroyedBy}`, `saveFoodSample`, `destroyFoodSample` chặn trước 24 giờ, `getPendingDestroy`), `kitchenConstants.js:48`, `kitchenValidation.js`, `kitchenPermissions.js` (`canEditFoodSample` = Bếp cơ sở), `kitchenService.js`, `kitchenApi.js` (`setFoodSample` ⇒ endpoint mới), `useKitchen.js`, `KitchenFlowPage.jsx:22,241` (thay khối tick bằng tóm tắt + link), `AppRoutes.jsx`, `menuConfig.js`, `kitchen.css`.
- Tests: `tests/kitchen/food-sample.test.mjs`; sửa `tests/kitchen/kitchen-day.test.mjs` phần tick.

### Phase K7 — Kho khô xem chung, phiếu nhập theo lô, kiểm kê (AC-9, AC-10)
- Chặn: Q1 phải có câu trả lời trước bước phiếu nhập.
- Files: C pages/kitchen `DryStockPage.jsx` (thay `StockReceiptListPage.jsx`), `StockCountPage.jsx`, components/kitchen `StockLotPanel.jsx`, `StockDiff.jsx` (tách từ `InspectionSheetPage.jsx:52-57,109-133`); M `StockReceiptFormPage.jsx` (lô, hạn, giá, NCC bắt buộc), mock (`getStock` `:667`, `getStockReceipts` `:676`, `createStockReceipt` `:697` ⇒ dòng có `lotNo, expiryDate, unitPrice, supplierName`; `getDryStockOverview` cả hai cơ sở + `canWrite` từng cơ sở; `listStockTransactions`; `stockCounts`, `createStockCount`, `finalizeStockCount` ⇒ `ADJUST`), `kitchenConstants.js`, `kitchenValidation.js`, `kitchenPermissions.js`, `kitchenService.js`, `kitchenApi.js`, `useKitchen.js`, `AppRoutes.jsx:407-408`, `menuConfig.js:99,153`, `kitchen.css`.
- Tests: `tests/kitchen/dry-stock.test.mjs` (đủ ngày; hết hạn 14 ngày; xem hai cơ sở; Bếp 403; phiếu nhập thiếu lô ⇒ lỗi; kiểm kê chốt khóa, một nháp/cơ sở).

### Sau K7
- Menu "Bếp & kho" theo thứ tự wireframe: Quy trình hôm nay, Số suất đã xác nhận, Dự trù & đi chợ, Kiểm nhận hàng tươi, Phiếu xuất kho, Sổ lưu mẫu, Kho khô, Kiểm kê, Thực đơn đã công bố.
- Cập nhật `docs/architecture/ROUTE_MAP.md` (chỉ dòng bếp), `docs/context/CURRENT_STATE.md`.
- `status: done`, chuyển `docs/plans/completed/` khi user cho phép.

## Contract BE cần thống nhất (chưa sửa repo BE — cần user cho phép)
- Rule: P-04, P-05 đóng theo S2, S3; ADR-0009 / NUT-11 ⇒ kho đồ khô theo cơ sở, xem chung (S4); NUT-07 tách "đặt hàng theo dự trù tuần" và "xuất kho theo suất chốt" (S1, S8); NUT-09 ghi không làm thực đơn dị ứng riêng (S9, ngoài plan này); thêm rule lưu mẫu (S10); NUT-12 / P-09 một phần (S5–S7); NUT-14..16 không làm.
- Endpoint đề xuất (thêm vào `kitchenApi.js`, ghi PROPOSED; thay các endpoint bỏ): `GET|PUT /kitchen/weekly-forecasts?campusId&weekStart`, `POST /kitchen/weekly-forecasts/{id}/sent`, `GET /kitchen/supplier-changes?campusId&date`, `POST /kitchen/supplier-changes/{id}/notified`; `POST /attendance/meal-counts/confirm-day` (`{campusId, date}`); `GET /kitchen/stock-issues?campusId&from&to` (chỉ đọc); `GET|PUT /kitchen/fresh-receipts?campusId&date`, `POST …/{id}/submit|confirm|return`; `GET|PUT /kitchen/food-samples/{campusId}/{date}/{session}`, `POST …/destroy`; `GET /kitchen/dry-stock` (hai cơ sở, `canWrite`), `GET /kitchen/stock-transactions`, `GET|POST /kitchen/stock-counts`, `POST /kitchen/stock-counts/{id}/finalize`.
- Bỏ: `approveStockIssue`, `confirmIngredientReceipt`, `getMissingFoodReports`, `submitMissingFoodReport`, `markMissingFoodSupplied`, `getRequiredQuantity` (`kitchenApi.js:15-22`).
- Cần BE trả: gợi ý suất (đăng ký ăn − nghỉ đã báo; FE chưa có nguồn "nghỉ báo trước", mock lấy bản ghi vắng có phép đã nhập cho ngày đó), cờ quyền xác nhận suất, cờ ghi kho từng cơ sở.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | NUT-14..16 (bỏ) | `flow-removal.test.mjs` + `rg` | K1 | PASS (K1) |
| AC-2, AC-11 | NUT-02/03 | `kitchen-day.test.mjs` (mở rộng từng phase) | K2–K7 | PASS |
| AC-6, AC-7 | NUT-07 (đề xuất tách), S1 | `weekly-forecast.test.mjs`, `market-list.test.mjs` | K3 | PASS |
| AC-5, AC-8 | NUT-02/03/07, S2, S3, S8 | `stock-issue.test.mjs` (gộp test chốt cả ngày), `flow-removal.test.mjs` | K4 | PASS (nhánh xuất bù/hoàn khi chốt lại chưa có test) |
| AC-4 | NUT-10, S5–S6 | `fresh-receipt.test.mjs` | K5 | PASS |
| AC-3 | S10 | `food-sample.test.mjs` | K6 | PASS |
| AC-9, AC-10 | NUT-11, S4, S7 | `dry-stock.test.mjs` | K7 | PASS |
| Tất cả | — | `npm run dev`, đi luồng PHT A → Bếp A → HT → Bếp B (tay), so ảnh với wireframe đã chọn | K3–K7 | Chụp màn 1280 (mock) so wireframe: khớp bố cục đã chọn; chưa đi tay đủ luồng |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Xác nhận theo ngày làm vỡ màn điểm danh / dashboard | Cao | K4 riêng; giữ dữ liệu theo bữa; test attendance | Revert K4 |
| Phiếu xuất tự động trừ sai hoặc trừ hai lần | Cao | Khóa theo `campusId+date`; test xác nhận lại | Revert K4 |
| Đổi đơn vị dự trù sang tuần làm lệch test đi chợ | Trung bình | Sửa `market-list.test.mjs` cùng K3 | Revert K3 |
| BE chốt khác (xuất kho có duyệt, kho không xem chung) | Cao | Endpoint PROPOSED; quyền theo cờ BE | Ẩn mục qua `menuConfig` |
| Q1 chưa trả lời | Trung bình | K7 chặn bước phiếu nhập; K3–K6 không phụ thuộc | — |
| `ROUTE_MAP.md` đang có thay đổi auth chưa commit | Thấp | Chỉ sửa dòng bếp | `git checkout -p` |

## Validation log
- [x] Khẳng định về code có `file:line` (rà lại 18/10/2026)
- [x] Đổi contract ⇒ consumer cụ thể: `kitchenApi.js:15-22`, `attendanceApi.js`, test `market-list.test.mjs`, `kitchen-day.test.mjs`
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file mỗi phase ⇒ plan con K3–K7
- [x] Không dùng câu chưa trả lời như đã chốt: S7 (Q1) để mở, K7 chặn; NUT-11 OPEN ở BE, FE làm theo quyết định user
- [x] Bố cục khớp phương án user chọn 18/10 (quyết định 7)
- [x] Tự review: không placeholder, không mâu thuẫn với S1–S10

## Progress log
### 2026-10-16 — Lập plan tổng (chờ duyệt)
- Commit: chưa commit
- Wireframe: Artifact bản 2; bố cục chốt ở quyết định 7
- Tiếp: user duyệt ⇒ viết plan con K1, làm K1

### 2026-10-16 — User duyệt plan
- User: "ok và chỉ fix ở fe đã" ⇒ `status: approved`; **không sửa repo BE** (ADR-0009, NUT-14..16 chỉ ghi ở mục Contract).
- Tiếp: plan con K1, làm K1.

### 2026-10-16 — K1 xong (chờ user review)
- Plan con: `docs/plans/active/2026-10-16-kitchen-flow-k1-remove-prep-handover.md`
- Verify: `VERIFY PASS full`, skipped 0. Chưa commit.

### 2026-10-16 — K2 xong (chờ user review)
- Plan con: `docs/plans/active/2026-10-16-kitchen-flow-k2-kitchen-day.md`
- Verify: `VERIFY PASS full`. Chưa commit.

### 2026-10-18 — Khảo sát bổ sung, thiết kế lại K3/K4 (đang làm)
- Ghi mục "Khảo sát bổ sung 18/10/2026"; `status: draft` tới khi user duyệt lại.
- Tiếp: brief + việc chính từng màn ⇒ wireframe ⇒ viết lại phase K3/K4, AC.
- Brief duyệt; wireframe 4 màn × 3 phương án: https://claude.ai/artifact/8Lar6xujFFjqyW5u7zdq23 (riêng tư).
- User sửa S1: dự trù theo tuần. Chốt thêm: suất dự kiến từ đăng ký ăn (PHT sửa); có bước sửa ngày mai vào hôm trước; một phiếu NCC cả tuần; dự trù tuần gồm cả đồ khô cần mua. Màn Dự trù vẽ lại (bản 2). Chờ user chọn phương án 4 màn.
- User chọn: Dự trù A, Kiểm nhận A, Lưu mẫu B, Kho khô B. Viết lại quyết định, AC-2..AC-11, phase K3–K7 (thay K3/K4 cũ), Contract, Test matrix. Q1 (S7) còn mở. Chờ user duyệt plan.

### 2026-10-18 — User duyệt plan bản 18/10, bắt đầu K3
- User: "duyệt và thực hiện ở code đi" ⇒ làm liền K3–K7, không dừng giữa phase.
- Q1 chưa trả lời ⇒ K7 giữ hành vi hiện có: phiếu nhập lưu xong không sửa, sai thì chỉnh qua kiểm kê.
- Branch đang đứng: `feature/G94-209-FE-FEAT-53-permission-management` (khác frontmatter); không thao tác git.

### 2026-10-18 — K3–K7 xong (chờ user review)
- Làm liền theo yêu cầu user, **không viết plan con riêng** từng phase; lệch và chi tiết ghi tại đây.
- K3: `/kitchen/forecast` (`WeeklyForecastPage`, `ForecastBlocks`, `WeeklyOrderPrint`, mock `weeklyForecast.js`); bỏ `RequiredFoodQuantityPage`, `MarketSheetPrint`. Thêm `schoolWeekStart` (thứ Bảy, CN tính tuần sắp tới) dùng cho dữ liệu mẫu thực đơn tuần.
- K4: `confirmMealCountDay` thay `confirmMealCount`; quyền chốt = PHT cơ sở hoặc HT; phiếu xuất đồ khô sinh khi đọc lần đầu sau chốt (mô phỏng job, BE làm trong giao dịch chốt); `StockIssuePage` chỉ xem/in; bỏ `StockIssueApprovalPage`, `IngredientReceiptPage`, `IssueBlocks`, việc duyệt xuất trên dashboard.
- K5: `/kitchen/fresh-receipts`; bỏ trang/API báo thiếu; dashboard PHT có nhóm "Kiểm nhận hàng tươi chờ xác nhận", KPI "Hàng tươi thiếu hoặc trả lại hôm nay".
- K6: `/kitchen/food-samples` + in Mẫu 4/5 (`FoodSamplePrint`); bỏ `FoodSampleChecklist`, `setFoodSample`. Hub `/kitchen` viết lại theo 5 mốc.
- K7: `/kitchen/dry-stock`, `/kitchen/stock-counts`; phiếu nhập thêm NCC, lô, hạn, giá, chọn cơ sở; bỏ `StockReceiptListPage` (route chuyển về Kho khô). Lô hiển thị theo nhập trước xuất trước (suy từ phiếu nhập). `StockDiff` không tách — bảng kiểm kê viết thẳng trong trang.
- Q1 vẫn mở: giữ phiếu nhập khóa sau khi lưu, chỉnh sai qua kiểm kê.
- Docs: `ROUTE_MAP.md` (dòng bếp), `CURRENT_STATE.md`.
- Verify: `VERIFY PASS full` (30 test bếp). Chưa commit.
