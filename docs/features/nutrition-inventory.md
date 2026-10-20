# Dinh dưỡng & Kho thực phẩm — đối chiếu BA (FE)

Nguồn BA: "UI Business Flow Specification — Nutrition & Food Inventory" (file `Dinh dưỡng flow.docx`, ngoài repo; nhận 2026-10-20). Plan: [2026-10-20-nutrition-ba-alignment](../plans/active/2026-10-20-nutrition-ba-alignment.md).

## Quyết định user (2026-10-20)

- Spec BA là chuẩn cho UI FE, **ngoại lệ: giữ luồng AI** (AI soạn mẫu/tuần, gợi ý sửa, `/menu/ai-suggestion`).
- Không kiểm kê kho thực phẩm: gỡ `/kitchen/stock-counts`.
- GĐ1 chỉnh màn đang có; màn thiếu làm ở GĐ2/GĐ3.
- Thời hạn mở lại điểm danh = số phút sau giờ chốt (Principal cấu hình, VP mở lại).
- Cần chốt 21/10/2026 (đổi luật BA, cần báo team và BE): VP chọn được ngày cần mở lại (mặc định hôm nay) từ ngày bắt đầu năm học đến hôm nay. Thời hạn mở lại chỉ áp cho ngày hôm nay; ngày cũ mở được bất kỳ lúc nào. Lần mở lại còn hiệu lực tới hạn "Mở đến" do HT / PHT chọn (không quá ngày kết thúc năm học), không tự khóa lúc sang ngày; giáo viên sửa điểm danh ngày cũ được khi lớp đang mở, sổ báo ăn ngày đó chuyển chờ xác nhận lại. Mở lại ngày đánh giá cũng lùi được tới ngày bắt đầu năm học.
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
| 10 Biểu mẫu – thống kê · kiểm thực 3 bước | chưa có; lưu mẫu `/kitchen/food-samples` | GĐ3 |
| 11 Sổ báo ăn | `/attendance/meal-count`, `/kitchen/meal-count`, `/school/cutoff`, `/attendance/day-unlocks` | GĐ1 |
| Xuất kho tự động | `/kitchen/stock-issues` | GĐ1 |
| Tiếp nhận hàng tươi | `/kitchen/fresh-receipts` (không cộng tồn) | GĐ1 |
| Phiếu xử lý hỏng/hết hạn/trả NCC | chưa có | GĐ3 |

Chuẩn dinh dưỡng: BA để PENDING (OD-08). FE chỉ đánh giá theo chuẩn tạm nhập tay ở `/menu/setup`; thiếu chuẩn hoặc thiếu dữ liệu chất ⇒ "Chưa đủ dữ liệu đánh giá".

## Lệch BE — đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`

Chưa sửa BE (cần user cho phép). Nháp nội dung:

1. **Duyệt thực đơn:** NUT-08 (CONFIRMED) cần người có quyền duyệt; BA cho Hiệu phó công bố thẳng, sửa sau công bố tạo phiên bản. Đề xuất: công bố của VP = bước duyệt.
2. **Kho thực phẩm:** NUT-11 / ADR-0009 còn OPEN; BA chốt kho riêng mỗi campus, theo lô (lô, NSX, HSD, đơn giá), không chuyển liên campus, không kiểm kê, xuất tự động chặn cả phiếu khi thiếu, bếp chọn lô.
3. **Số suất:** BE MealCount theo bữa; BA = 1 suất/ngày theo nhóm tuổi ("Ăn" = mọi bữa của nhóm tuổi).
4. **Chuẩn dinh dưỡng:** P-10 PENDING — khớp BA; FE không hard-code chuẩn.
5. **Giờ chốt:** ATT-06 PENDING P-03; BA thêm "thời hạn mở lại" (phút sau giờ chốt) và chỉ VP mở lại ⇒ cần field mới ở cấu hình cutoff.
6. **AI thực đơn:** FE-10 CONFIRMED ở BE; BA để OD-08 — user giữ AI, khớp BE.
7. **Contract FE đang giả định (mock, PROPOSED):** cutoff thêm `reopenWindowMinutes`; phiếu nhập có `status` DRAFT/CONFIRMED, `mfgDate`, `confirm`, `GET/PUT /kitchen/stock-receipts/{id}`; phiếu xuất trạng thái `AWAITING_STOCK | AWAITING_LOT_ALLOCATION | PROCESSING | POSTED | FAILED`, `POST /kitchen/stock-issues/{id}/allocations` (Bếp chọn lô), lô có `id`, `expiryDate`, `qty`; sổ báo ăn FE hiển thị suất/ngày từ dữ liệu theo bữa — đề xuất BE trả sẵn số suất/ngày.
8. **NCC:** BE NUT-12 PENDING P-09 đề xuất NCC ngoài V1; BA chốt danh mục NCC cơ bản do HT quản lý. Contract FE giả định (PROPOSED): `GET/POST /kitchen/suppliers`, `GET/PUT/DELETE /kitchen/suppliers/{id}` (chi tiết kèm `receipts` liên kết), mã do BE sinh, xóa NCC đã có phiếu ⇒ 409; phiếu nhập gửi `supplierId`, BE lưu tên NCC tại lúc lưu.
9. **Món Nháp:** FE thêm trạng thái món `DRAFT | ACTIVE | INACTIVE`; món mới/Nháp chuyển `ACTIVE` cần đủ định lượng mọi nhóm tuổi đang áp dụng (422 `details.status`); món đã có trong thực đơn không về Nháp (409); lưu thực đơn mẫu / điều chỉnh ngày / thực đơn thay thế với món mới không `ACTIVE` ⇒ 422. Nhân bản không cần endpoint (form điền sẵn rồi `POST /menu/dishes`). Phiên bản công thức (BA DERIVED) để BE quyết.
10. **Đơn vị:** Food thêm `stockUnit`, `purchaseToStock` (đơn vị kho trong 1 đơn vị mua), `stockUnitSize` (g/ml trong 1 đơn vị kho); `purchaseUnitSize` = tích hai tỷ lệ. Lô, tồn, nhu cầu xuất theo đơn vị kho; dự trù/đi chợ theo đơn vị mua. Dòng phiếu nhập có `unitKind` `PURCHASE | STOCK` (thiếu = `STOCK`), BE trả `stockQty`; đã có lô/phiếu xác nhận ⇒ 409 khi đổi đơn vị kho hoặc `stockUnitSize`. Thực phẩm cũ: đơn vị kho = đơn vị mua, tỷ lệ 1.
