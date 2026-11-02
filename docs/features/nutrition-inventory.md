# Dinh dưỡng & Kho thực phẩm — đối chiếu BA (FE)

Nguồn BA: "UI Business Flow Specification — Nutrition & Food Inventory" (file `Dinh dưỡng flow.docx`, ngoài repo; nhận 2026-10-20). Plan: [2026-10-20-nutrition-ba-alignment](../plans/active/2026-10-20-nutrition-ba-alignment.md).

## Quyết định user (2026-10-20)

- Spec BA là chuẩn cho UI FE, **ngoại lệ: giữ luồng AI** (AI soạn mẫu/tuần, gợi ý sửa, `/menu/ai-suggestion`).
- Không kiểm kê kho thực phẩm: gỡ `/kitchen/stock-counts`.
- GĐ1 chỉnh màn đang có; màn thiếu làm ở GĐ2/GĐ3.
- Thời hạn mở lại điểm danh = số phút sau giờ chốt (Principal cấu hình, VP mở lại).
- Cần chốt 21/10/2026 (đổi luật BA, cần báo team và BE): VP chọn được ngày cần mở lại (mặc định hôm nay) từ ngày bắt đầu năm học đến hôm nay. Hiệu trưởng mở lại được lớp ở cả 2 điểm trường, PHT chỉ lớp điểm trường mình. Không giới hạn giờ mở lại sau giờ chốt (kể cả hôm nay); trường "thời hạn mở lại" ở Giờ chốt điểm danh không còn được dùng để chặn. Lần mở lại còn hiệu lực tới hạn "Mở đến" do HT / PHT chọn (không quá ngày kết thúc năm học), không tự khóa lúc sang ngày; giáo viên sửa điểm danh ngày cũ được khi lớp đang mở, sổ báo ăn ngày đó chuyển chờ xác nhận lại. Mở lại ngày đánh giá cũng lùi được tới ngày bắt đầu năm học.
- Sổ báo ăn hiển thị số suất/ngày; dữ liệu mock vẫn theo bữa.
- Phiếu nhập có Nháp ⇒ trang danh sách `/kitchen/stock-receipts`.

Đây là chuẩn hiển thị FE, **không phải contract BE**. BE chưa có API nutrition/kho (`BE:docs/modules/nutrition.md`); mọi màn còn chạy mock.

## Quyết định user GĐ2 (2026-10-20)

Plan: [2026-10-20-nutrition-ba-master-data](../plans/active/2026-10-20-nutrition-ba-master-data.md).

- NCC: bắt buộc mã + tên; mã **hệ thống tự sinh `NCC001…`, không sửa** (lệch BA 01 bước 3 "nhập/sửa mã" — user chọn); SĐT, mã số thuế tùy chọn, kiểm định dạng khi nhập.
- HT quản lý NCC; PHT xem danh sách/chi tiết read-only và chọn NCC khi lập phiếu nhập kho.
- Đang dùng / Ngừng dùng: NCC ngừng dùng không chọn được cho phiếu mới (nháp đã gắn trước đó vẫn giữ); chỉ xóa NCC chưa có phiếu nhập nào, kể cả nháp.
- Phiếu kiểm nhận hàng tươi giữ ô gõ tên NCC tự do (OD-05 PENDING).
- Phiếu nhập lưu `supplierId` + tên NCC tại lúc lưu (chứng từ cũ giữ tên khi NCC đổi tên). Phiếu cũ chỉ có tên: gắn NCC trùng tên, không khớp ⇒ nhãn "Chưa liên kết danh mục".
- Đơn vị: dòng phiếu nhập chọn đơn vị mua hoặc kho, lô lưu theo đơn vị kho; đã có lô/phiếu xác nhận thì khóa đơn vị kho + tỷ lệ kho→công thức.
- Món: thêm trạng thái Nháp (Lưu nháp / Lưu và dùng cho thực đơn); dùng cho thực đơn cần đủ định lượng mọi nhóm tuổi đang áp dụng; món chép từ thư viện về ở Nháp; chép định lượng giữa nhóm tuổi hỏi trước khi thay ô có số; không làm phiên bản công thức.

## Chức năng BA ↔ màn FE

| BA | Màn FE | GĐ |
| --- | --- | --- |
| 01 Nhà cung cấp | `/kitchen/suppliers` (+ `/new`, `/:id`, `/:id/edit`); phiếu nhập chọn NCC từ danh mục | GĐ2 |
| 02 Thực phẩm trường | `/menu/foods` (đơn vị công thức g/ml, đơn vị kho, đơn vị mua + tỷ lệ quy đổi; cột Đơn vị kho) | GĐ1 / GĐ2 |
| 03 Món ăn | `/menu/dishes` (công thức theo nhóm tuổi; Nháp, nhân bản `?from=`, chép định lượng giữa nhóm tuổi) | GĐ1 / GĐ2 |
| 04 Thực đơn | `/menu/menus` (mẫu ngày), `/menu/weekly` (tuần, VP xuất bản thẳng) | GĐ1 |
| 05 Nhập kho | `/kitchen/stock-receipts` (+ `/new`) | GĐ1 |
| 06 Tồn kho | `/kitchen/dry-stock` | GĐ1 |
| 07 Lịch sử kho · 08 Sổ kho | chưa có màn riêng | GĐ3 |
| 09 Cân đối khẩu phần | `/menu/nutrition`, tab cân đối ở `/menu/weekly`, `/kitchen/forecast` | GĐ1 |
| 10 Biểu mẫu – thống kê · kiểm thực 3 bước | chưa có; lưu mẫu `/kitchen/food-samples` (BE: bếp ghi trên App — NUT-21; mẫu sổ P-26, kiểm thực 3 bước P-27) | GĐ3 |
| 11 Sổ báo ăn | `/attendance/meal-count`, `/kitchen/meal-count`, `/school/cutoff`, `/attendance/day-unlocks` | GĐ1 |
| Xuất kho tự động | `/kitchen/stock-issues` | GĐ1 |
| Tiếp nhận hàng tươi | `/kitchen/fresh-receipts` (không cộng tồn) | GĐ1 |
| Phiếu xử lý hỏng/hết hạn/trả NCC | chưa có | GĐ3 |

Chuẩn dinh dưỡng: BA để PENDING (OD-08); BE đã chốt NUT-18 (xem mục 4 dưới). FE chỉ đánh giá theo chuẩn tạm nhập tay ở `/menu/setup`; thiếu chuẩn hoặc thiếu dữ liệu chất ⇒ "Chưa đủ dữ liệu đánh giá".

## Lệch BE — đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`

Chưa sửa BE (cần user cho phép). Nháp nội dung. Đồng bộ lại theo BE 2026-10-28 (`BE:docs/business/BUSINESS_RULES.md`, ADR-0009 bản 28/10); "Lệch BE (28/10)" = UI mock đang khác rule đã chốt, cần sửa UI khi tích hợp.

1. **Duyệt thực đơn:** ĐÃ KHỚP 28/10 — NUT-08: PHT mảng dinh dưỡng lập và công bố, công bố là duyệt, không cần HT duyệt. **Lệch BE (28/10):** BE chặn công bố khi chưa cân đối dinh dưỡng và không sửa sau công bố; FE cho "Tạo phiên bản thay thế" sau công bố và chỉ chặn ngày trống. BE: một thực đơn chung hai cơ sở, nhà trẻ khác mẫu giáo, bộ 4 tuần xoay vòng theo mùa (NUT-13, đóng P-07); cảnh báo món lặp trong tuần (NUT-20); giá suất theo nhóm tuổi, vượt thì cảnh báo (NUT-19) — FE lập thực đơn tuần theo từng nhóm tuổi, cần đối chiếu khi tích hợp.
2. **Kho thực phẩm:** ĐÃ GHI BE 21/10, THU GỌN 23/10, SỬA 28/10 — ADR-0009 ACCEPTED, NUT-11/12 CONFIRMED (đóng P-08, P-09): kho khô mỗi cơ sở để riêng, quản lý chung, theo lô; công bố thực đơn ⇒ trừ dự kiến, mỗi ngày chốt suất ⇒ điều chỉnh; xem tồn; không kiểm kê, không chuyển liên cơ sở; hàng tươi đặt theo sĩ số dự kiến, PHT ghi kiểm nhận 2 lần (so thực đơn dự kiến, rồi đã công bố), không cộng kho; **có lại** danh mục NCC; vẫn không có dự báo tuần. Bảng đề xuất ở file MEAL_NUTRITION_AI_SCHEMA.md §5 trong docs/database của BE (chưa merge vào nhánh chính BE; merge xong đổi thành link `BE:`). BA chốt kho riêng mỗi campus, theo lô (lô, NSX, HSD, đơn giá), không chuyển liên campus, không kiểm kê, xuất tự động chặn cả phiếu khi thiếu, bếp chọn lô. **Lệch BE (28/10):** phiếu xuất theo ngày + bếp chọn lô (`/kitchen/stock-issues`), bếp ghi kiểm nhận hàng tươi/PHT duyệt (`/kitchen/fresh-receipts`), `/kitchen/forecast`, bếp dùng các màn này trên Web (AUTH-21: bếp chỉ App) — cần sửa UI khi tích hợp. Còn chờ BE: sĩ số dự kiến lấy trước bao lâu (P-24), chọn lô khi trừ/kho thiếu lúc công bố (P-25).
3. **Số suất:** BE: có mặt là ăn đủ các bữa của nhóm tuổi, số suất = số trẻ có mặt cho từng bữa (ATT-02, NUT-01); HT cấu hình số bữa/ngày theo nhóm tuổi, bếp xem số suất đã xác nhận theo lớp từng bữa (NUT-17); PHT tại cơ sở xác nhận, HT thay khi vắng (NUT-02, đóng P-05). BA = 1 suất/ngày theo nhóm tuổi ("Ăn" = mọi bữa của nhóm tuổi) — khớp về nghĩa. Đến muộn sau giờ chốt không nhận, không bổ sung suất; đổi sau xác nhận chỉ qua mở lại điểm danh + xác nhận lại (ATT-03, NUT-03, NUT-04, đóng P-04); thiếu/thừa suất thực tế báo qua Zalo/điện thoại (NUT-22). **Lệch BE (28/10):** công tắc Tham gia ăn, GV hủy suất sau khóa, sửa sau xác nhận không cần xác nhận lại, chỉ VP xác nhận — cần sửa UI khi tích hợp.
4. **Chuẩn dinh dưỡng:** ĐÃ ĐÓNG P-10 ⇒ NUT-18: nhu cầu theo chương trình GDMN của Bộ GD&ĐT, thành phần theo Viện Dinh dưỡng; món = công thức + gam/trẻ theo nhóm tuổi; lượng mua cộng hệ số thải bỏ. FE vẫn không hard-code chuẩn; chuẩn tạm nhập tay ở `/menu/setup` cần đổi sang dữ liệu BE khi tích hợp.
5. **Giờ chốt:** ĐÃ ĐÓNG P-03 ⇒ ATT-06: một giờ chốt chung toàn trường, HT cấu hình, đổi theo mùa, có ngày áp dụng và lưu vết; không hard-code. Mở lại: PHT, bắt buộc lý do, lưu nhật ký (ATT-08). BA thêm "thời hạn mở lại" (phút sau giờ chốt) — BE không có ⇒ `reopenWindowMinutes` vẫn là đề xuất cần BE thống nhất. **Lệch BE (28/10):** mock rơi về giờ chốt mặc định cứng khi chưa cấu hình (`DEFAULT_CUTOFF_TIME`) — cần sửa khi tích hợp. Ngày nghỉ tự khóa điểm danh: P-19.
6. **AI thực đơn:** FE-10 CONFIRMED ở BE; BA để OD-08 — user giữ AI, khớp BE.
7. **Contract FE đang giả định (mock, PROPOSED):** cutoff thêm `reopenWindowMinutes`; phiếu nhập có `status` DRAFT/CONFIRMED, `mfgDate`, `confirm`, `GET/PUT /kitchen/stock-receipts/{id}`; phiếu xuất trạng thái `AWAITING_STOCK | AWAITING_LOT_ALLOCATION | PROCESSING | POSTED | FAILED`, `POST /kitchen/stock-issues/{id}/allocations` (Bếp chọn lô), lô có `id`, `expiryDate`, `qty`; sổ báo ăn FE hiển thị suất/ngày từ dữ liệu theo bữa — đề xuất BE trả sẵn số suất/ngày.
8. **NCC:** BE NUT-12 CONFIRMED (đóng P-09): danh mục NCC dùng chung hai cơ sở gồm tên, SĐT, địa chỉ, CCCD (dữ liệu cá nhân), người giao hàng; PHT mảng dinh dưỡng phụ trách (`BE:docs/business/USER_ROLES.md`). BA chốt danh mục NCC cơ bản do HT quản lý. **Lệch BE (28/10):** FE cho HT quản lý, PHT chỉ xem, có mã/MST, chưa có CCCD/người giao hàng — cần sửa UI khi tích hợp. Contract FE giả định (PROPOSED): `GET/POST /kitchen/suppliers`, `GET/PUT/DELETE /kitchen/suppliers/{id}` (chi tiết kèm `receipts` liên kết), mã do BE sinh, xóa NCC đã có phiếu ⇒ 409; phiếu nhập gửi `supplierId`, BE lưu tên NCC tại lúc lưu.
9. **Món Nháp:** FE thêm trạng thái món `DRAFT | ACTIVE | INACTIVE`; món mới/Nháp chuyển `ACTIVE` cần đủ định lượng mọi nhóm tuổi đang áp dụng (422 `details.status`); món đã có trong thực đơn không về Nháp (409); lưu thực đơn mẫu / điều chỉnh ngày / thực đơn thay thế với món mới không `ACTIVE` ⇒ 422. Nhân bản không cần endpoint (form điền sẵn rồi `POST /menu/dishes`). Phiên bản công thức (BA DERIVED) để BE quyết.
10. **Đơn vị:** Food thêm `stockUnit`, `purchaseToStock` (đơn vị kho trong 1 đơn vị mua), `stockUnitSize` (g/ml trong 1 đơn vị kho); `purchaseUnitSize` = tích hai tỷ lệ. Lô, tồn, nhu cầu xuất theo đơn vị kho; dự trù/đi chợ theo đơn vị mua. Dòng phiếu nhập có `unitKind` `PURCHASE | STOCK` (thiếu = `STOCK`), BE trả `stockQty`; đã có lô/phiếu xác nhận ⇒ 409 khi đổi đơn vị kho hoặc `stockUnitSize`. Thực phẩm cũ: đơn vị kho = đơn vị mua, tỷ lệ 1.
