---
id: FE-BUG-261122-new-admission-placement-reset
type: bug
screens: [school-config]
rules: [CFG-YR-03]
status: fixed
date: 2026-11-22
keywords: [xếp lớp, trẻ mới, reset, dirty]
---

# Trẻ mới chọn lớp xong bị reset về Chờ xếp lớp

- Ngày: 22/11/2026. Màn Xếp lớp năm học mới, tab Trẻ mới tiếp nhận; dữ liệu local hư cấu.
- Tái hiện: chọn một lớp, lựa chọn quay về Chờ xếp lớp và nút Lưu bị khóa. Tái hiện trong UI thật khi thử thay đổi xếp tay khác nhóm tuổi.
- Nguyên nhân: YearPlacementPage lọc admissions thành mảng mới mỗi render. Child báo dirty lên parent, parent render lại, saved của NewAdmissionPlacementPanel thay tham chiếu, effect setRows(saved) xóa bản nhập vừa chọn.
- Sửa: memo danh sách theo plan.newAdmissions/campus/group. Dữ liệu mới thật sự hoặc bộ lọc thay đổi vẫn cập nhật như cũ, parent render vì dirty không reset lựa chọn.
- UI sau sửa: chọn Lê Bảo Ngọc từ nhóm gợi ý3–4 vào Chồi1 nhóm4–5, nút lưu bật, lưu và reload vẫn Chồi1; sĩ số dự kiến23/30. Có nhãn xếp khác nhóm gợi ý. Không đổi campus hay schema/API.
- Kiểm: 282 Node tests, ESLint nguồn sửa, Vite build API đạt. Lưu trên DB carenest_ui_20261122; ảnh logs/ui-proof/manual-other-age-group-saved.jpg không commit.
