# Audit UI/UX bán trú — 29 ảnh và source FE

Ngày 16/10/2026 · Branch `feature/FE-FEAT-48-nutrition-management` · Mức bằng chứng: ảnh trong `D:/CAPSTONE_FALL26/UI_nutrition_cnpms.zip` + đọc source tĩnh. Cột **Sau** là thiết kế đề xuất, chưa phải kết quả đã triển khai hoặc kiểm tra trên trình duyệt.

## Phạm vi và khác biệt cần giữ

- ZIP có đúng 29 JPG. Ảnh 19–22 là trạng thái có dữ liệu của 12–14/10; 23–27 là biến thể vai trò Bếp; 28–29 là tab phiếu nhập và modal chi tiết. Chúng dùng chung page/component tương ứng, không tạo thêm route.
- Source hiện tại đặt màn dinh dưỡng ở `src/pages/menu-planning/`, bếp/kho ở `src/pages/kitchen/`. Route và guard ở `src/routes/AppRoutes.jsx:335-379`. K1/K2 của plan `2026-10-16-kitchen-warehouse-flow.md` đã sửa source nhưng còn chờ review; K3/K4 chưa làm. Không dùng ảnh cũ để khôi phục nghiệp vụ đã bỏ.
- Ảnh 14/20 gợi ý duyệt chứng từ; source `StockIssueApprovalPage.jsx:174-188` chỉ có **Duyệt**, không có **Trả lại**. Ảnh 05 và đề yêu cầu sao chép mẫu nhưng `MenuListPage.jsx:100-128` chỉ mở chi tiết/sửa. Chỉ thiết kế vị trí cho hành động nếu đã có handler được xác nhận; không tạo hành động mới.
- Source `StockReceiptListPage.jsx:178-196` dùng click trên hàng bảng để mở modal, chưa có bàn phím tương ứng; có nút xem riêng. Ảnh 29 cho thấy ID kỹ thuật của thực phẩm trong dòng phiếu; cần kiểm tra nguồn nhãn, tránh thay dữ liệu trong UI bằng tên suy đoán.
- `DESIGN.md` v3.1 mang nhãn **PROPOSED** nhưng là chuẩn UI mà người dùng chỉ định. BE `docs/business/BUSINESS_RULES.md:41-56` xác nhận NUT-01/02/03/05–10; NUT-11 OPEN, P-05/06/07/10 PENDING. Thiết kế không quyết thay các điểm này. Quyết định FE K1/K2 đã được user duyệt trước đây chỉ được phản ánh trong code hiện tại.

## Bảng đánh giá từng ảnh

Ưu tiên P0 = luồng cốt lõi/khả năng hoàn thành tác vụ; P1 = mật độ và khả năng đọc; P2 = đồng nhất hoặc trạng thái phụ. **Sau** chỉ là mục tiêu để review sau triển khai.

| # | Màn / source hiện tại | Trước: vấn đề quan sát được | Sau: hướng sửa dự kiến | Ưu tiên |
| --- | --- | --- | --- | --- |
| 01 | Quy trình thực đơn · `NutritionFlowPage` | Sáu bước nằm trong card cao, khoảng trống lớn; bước đang cần làm không nổi bật | Hàng bước gọn theo tiến trình có thật, tình trạng và lối vào bước kế tiếp từ dữ liệu sẵn có | P1 |
| 02 | Thiết lập dinh dưỡng · `NutritionSetupPage` | Các nhóm tuổi là dòng ngang nhỏ; chi tiết mở rộng khó so sánh | Danh sách nhóm tuổi gọn, nhóm đang mở dùng bảng định mức đọc được, giữ nút lưu hiện có | P1 |
| 03 | Danh mục thực phẩm · `FoodListPage` | Cột dinh dưỡng dày, điều hướng nhóm chiếm ngang; khó scan tên/đơn giá | FilterBar + bảng ưu tiên tên, nhóm, đơn vị, giá, trạng thái; dưỡng chất chi tiết ở trang chi tiết hiện có | P1 |
| 04 | Danh mục món · `DishListPage` | Bảng nhỏ trong card rộng, nhiều khoảng trống; thao tác nằm trong dấu ba chấm | Bảng chiếm vùng chính; tên, loại, nhóm tuổi, định lượng, trạng thái; giữ RowMenu/xem/sửa theo quyền hiện có | P1 |
| 05 | Thực đơn mẫu · `MenuListPage` | Quá nhiều card lặp theo tuổi, thông tin bị dồn vào chip, cuộn dài | Nhóm tuổi thu gọn; card hàng gọn có tên, bữa, món, chi phí, kcal, trạng thái; mở chi tiết/sửa như source | P0 |
| 06 | Thực đơn tuần · `WeeklyMenuPage`, `WeekGrid` | Lịch đọc được nhưng cảnh báo và cân đối nằm rất xa, trang dài | Planner ngày × bữa là vùng chính; cảnh báo tách ngay sau lịch; bảng dưỡng chất ở phần tổng hợp; giữ nháp/phiên bản/xuất bản | P0 |
| 07 | Thêm thực phẩm · `FoodFormPage` | Các nhóm trường và dưỡng chất kéo dài, thanh lưu phân tán | Form một cột theo nhóm thông tin, dưỡng chất, dị ứng; một vùng hành động cuối, giữ tất cả field/validation | P1 |
| 08 | Tạo món · `DishFormPage` | Bảng định lượng chật; khối kết quả cạnh bảng hẹp | Thông tin chung → bảng thành phần rộng → tổng hợp dưới; không ảnh, không thêm phép tính FE | P1 |
| 09 | Tạo thực đơn mẫu · `MenuFormPage` | Nửa dưới ảnh rỗng do form mới chưa chọn nhóm/bữa | Empty state chỉ dẫn ngay tại vùng bữa, vùng dưới chỉ hiện khi có dữ liệu; giữ thao tác AI và lưu hiện có | P0 |
| 10 | Quy trình bếp hôm nay · `KitchenFlowPage` | Cột thực đơn quá dài so với tiến trình, việc cần làm bị đẩy xuống | Tiến trình và việc cần xử lý ở vùng đầu; thực đơn text gọn theo bữa, xem đầy đủ qua route sẵn có | P0 |
| 11 | Số suất đã xác nhận · `ConfirmedMealCountPage` | Bữa chờ xác nhận là card rộng nhưng thiếu điểm nhấn tác vụ tiếp theo | Ngày/điểm trường/bữa ngay đầu; trạng thái chờ rõ chữ; bảng lớp chỉ khi BE/mock trả dữ liệu | P0 |
| 12 | Khẩu phần & đi chợ, rỗng · `RequiredFoodQuantityPage` | Empty card lớn, phiếu xuất tách thành card gần như trống | Một thông điệp chặn rõ nguyên nhân và lối sang chốt số; ẩn khung dữ liệu chưa có | P0 |
| 13 | Nhận từ kho, rỗng · `IngredientReceiptPage` | Empty card lớn, chỉ có chọn ngày | Ngày + trạng thái phiếu, thông điệp khi chưa duyệt và lối xem chứng từ theo quyền | P1 |
| 14 | Duyệt xuất, chờ · `StockIssueApprovalPage` | Tiến trình, cảnh báo, kế hoạch nấu xếp dọc; vùng chứng từ chưa có | Chứng từ master-detail khi có phiếu; khi chờ chỉ giữ tiến trình + nguyên nhân chặn, không tạo action mới | P0 |
| 15 | Báo thiếu · `MissingFoodReportPage` | Bảng rất rộng cho ít dòng; trạng thái và hành động xa ngữ cảnh | Filter trạng thái sát bảng; số thiếu, người báo, trạng thái và hành động dễ quét; giữ modal hiện có | P1 |
| 16 | Nhập kho · `StockReceiptListPage` | Tab tồn kho dài hơn nhu cầu, phiếu nhập bị ẩn sau tab | Giữ hai tab, làm bảng tồn gọn và tab phiếu có tìm/lọc theo khả năng code; không tạo chỉ số mới | P0 |
| 17 | Tạo phiếu nhập · `StockReceiptFormPage` | Dòng nhập số lượng nhỏ, kiểm tra chất lượng trộn trong một hàng | Form nhóm thông tin phiếu → các dòng thực phẩm/kiểm tra → ghi chú/hành động; giữ công thức và validation hiện có | P0 |
| 18 | Thực đơn đã công bố · `PublishedMenuPage` | Card theo nhóm tuổi lặp nhiều lần, tên món và định lượng chữ rất nhỏ | Theo ngày/bữa; mỗi tuổi một khối text gọn; chi tiết định lượng chỉ ở chế độ ngày như code | P1 |
| 19 | Khẩu phần có dữ liệu · `RequiredFoodQuantityPage` | Bảng định lượng + 3 card tiền + phiếu xuất làm trang rất dài | Bảng lượng mua là vùng chính; tổng thu/chi chỉ nếu dữ liệu có sẵn; phiếu xuất thành khối chứng từ gọn | P0 |
| 20 | Duyệt xuất có dữ liệu · `StockIssueApprovalPage` | Bảng nguyên liệu và đối chiếu/lịch sử tách xa; hành động cuối trang | Bảng phiếu chiếm vùng chính, panel thông tin/duyệt, đối chiếu và lịch sử là phần bổ sung; confirm giữ nguyên | P0 |
| 21 | Nhận từ kho có dữ liệu · `IngredientReceiptPage` | Đối chiếu rõ nhưng kế hoạch nấu dài kéo tác vụ xuống | Đối chiếu số xuất/nhận/chênh lệch lên đầu; kế hoạch nấu thu gọn dưới; giữ xác nhận hiện có | P0 |
| 22 | Quy trình có dữ liệu · `KitchenFlowPage` | Việc đã xong và danh sách món vẫn chiếm nhiều vùng nhìn | Bước cần làm tiếp theo lên trước, bước hoàn thành gọn; thực đơn chỉ tên món, theo bữa | P0 |
| 23 | Bếp, quy trình rỗng · `KitchenFlowPage` | Vai Bếp vẫn nhìn nhiều khối khi chưa có số chốt | Thông điệp chờ/đường tới số suất theo quyền Bếp, lưu mẫu giữ đúng trạng thái ngày | P0 |
| 24 | Bếp, quy trình có dữ liệu · `KitchenFlowPage` | Menu và việc phụ dài, làm khu tác vụ chính kém nổi | Cùng template #22, chỉ đổi action theo quyền Bếp; không thêm dữ liệu PHT | P0 |
| 25 | Bếp, nhận kho có dữ liệu · `IngredientReceiptPage` | Cùng đối chiếu #21 nhưng hành động nhận hàng chưa đủ gần bảng | Cùng template #21; action nhận sát chứng từ, điều kiện từ source/BE | P0 |
| 26 | Bếp, báo thiếu · `MissingFoodReportPage` | Bảng ít dòng trong card lớn | Cùng template #15; nút báo thiếu chỉ hiện khi quyền Bếp cho phép | P1 |
| 27 | Bếp, thực đơn công bố · `PublishedMenuPage` | Cùng bố cục #18, lặp món nhiều nhóm tuổi | Cùng template #18; chỉ dữ liệu công bố và quyền xem của Bếp | P1 |
| 28 | Danh sách phiếu nhập · `StockReceiptListPage` tab receipts | Bảng ổn nhưng chưa có search; click hàng không hỗ trợ bàn phím | Bảng mã/ngày/số dòng/chất lượng/người; action xem rõ, dùng nút để mở chi tiết, phân trang hiện có | P0 |
| 29 | Chi tiết phiếu nhập · `ReceiptDetail` trong `StockReceiptListPage` | Modal hẹp cho bảng 6 cột; một số tên hiện ID kỹ thuật | SidePanel hoặc detail page nếu bảng quá rộng; các cột nhận/không đạt/nhập kho rõ, nhãn lấy từ data source | P0 |

## Pattern dùng lại và thứ tự bố cục

| Nhóm | Khung đề xuất | Thành phần sẵn có |
| --- | --- | --- |
| Danh mục (#03–04) | Tiêu đề → search/filter → bảng → pagination → trang chi tiết | `Breadcrumb`, `.filter-bar`, `.table-wrap`, `Pagination`, `RowMenu`, `EmptyState`, `ErrorState` |
| Mẫu/tuần (#05–06, #09) | Ngữ cảnh nhóm tuổi/tuần → hành động chính → card mẫu hoặc planner → cảnh báo → tổng hợp | `WeekGrid`, `WeekBalanceTable`, `StatusBadge`, `ConfirmationModal`, `MealEditor` |
| Quy trình/suất/đi chợ (#10–13, #19, #22–24) | Ngày/điểm trường → việc tiếp theo → dữ liệu tác vụ → thực đơn text phụ | `KbDateFilter`, `KbCampusFilter`, `Widget`, `ProgressSteps`, `FoodSampleChecklist` |
| Xuất/nhận/báo thiếu (#14–15, #20–21, #25–26) | Chứng từ/bảng chính → trạng thái & hành động → đối chiếu/lịch sử | `ProgressSteps`, `IssueStatusBadge`, `ConfirmationModal`, `ReceiptReconciliation`, `IssueHistory` |
| Kho/phiếu nhập (#16–17, #28–29) | Tab tồn/phiếu → bảng → chi tiết; form chia nhóm | `Pagination`, `Modal`/`SidePanel`, `FormField`, `ConfirmationModal` |

Không thay `Sidebar`/`Header`. Không dùng ảnh món ăn; tranh sáp màu đầu trang của CareNest được giữ nhẹ theo `DESIGN.md:337-354`. Cần kiểm visual 1440/1280/1024/768, focus/keyboard, empty/error/loading, confirm/submit và từng vai trước khi chuyển cột **Sau** thành kết quả thực tế.
