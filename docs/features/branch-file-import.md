# Nhập file chủ đề nhánh

Nguồn nghiệp vụ: [BE EDU-47/14/18/39/40/41](../../../CareNest_BE/docs/business/BUSINESS_RULES.md), [spec008](../../../CareNest_BE/specs/008-branch-plan-file-import/spec.md), [contract](../../../CareNest_BE/specs/008-branch-plan-file-import/contracts/file-import.md). Không định nghĩa business rule riêng tại Web.

Trang `/education/branches/:classId`: BranchPlanPage mở ImportBranchFileModal, gọi facade previewBranchFile và nhận matches/warnings từ server; helper importBranchFile chỉ áp đúng key tên trong response vào nháp. Hủy không đổi nháp; thay tên khác đang có yêu cầu xác nhận; các trường/ghi chú/key không ghép giữ nguyên. Xóa pending AI tại key được thay để lần Lưu không phục hồi tên cũ.

User bổ sung 02/11/2026: modal theo cùng kích thước/bố cục nhập mục tiêu, hàng Chọn file/Tải file mẫu và cảnh báo tối đa8 dòng. `branchTemplateFile` tái dùng khung Word hiện có, xuất chủ đề từ danh sách tuần đang hiển thị và để trống tên nhánh; không xuất dữ liệu nháp hoặc ngày. Không phát sinh API/lịch mới.

Save và Send luôn hiện ở vùng đầu trang khi tải được tài liệu, disabled có title/aria-description theo quyền/trạng thái/dirty; nhãn người nhận duyệt theo docReview và cấu hình hiện tại. ReviewActions dùng showSend mặc định false, chỉ trang nhánh bật để không đổi các màn khác.

Word/Excel/CSV do BE thật đọc; chế độ demo hỗ trợ CSV, có thông báo rõ trong modal. API/mã lỗi do BE sở hữu; mock dùng cùng errorCode. Bước 2 mục tiêu nhận thêm .doc nhị phân, merge mục tiêu giữ nguyên.

Parser CSV được tách nguyên trạng từ mock tuyển sinh sang `src/utils/csv.js` để tránh import chéo module; export cũ giữ tương thích. Test so cùng hàm và BOM/delimiter/quoted multiline.

Unit tests: tests/education-plan/import-branch-*.test.mjs, branch-review-ui.test.mjs. Real-BE E2E: tests/e2e/system/branch-file-import.spec.mjs và year-plan-import.spec.mjs. Bằng chứng cuối tại [quickstart BE](../../../CareNest_BE/specs/008-branch-plan-file-import/quickstart.md).
