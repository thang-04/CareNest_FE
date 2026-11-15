# Bàn phím bảng góc và bộ lọc lịch nhánh

Nguồn: Tiền yêu cầu ngày 13/11/2026. Tham chiếu nghiệp vụ: bản chuẩn `../../../nghiep_vu_chuan/ke_hoach_giao_duc.md`, EDU-16, EDU-22, EDU-74/75.

- Bảng Hoạt động góc: Enter ở các ô của dòng có nội dung thêm dòng ngay bên dưới, đưa con trỏ vào tên góc mới. Dòng ngay dưới đang trống thì chuyển tới dòng đó. Shift+Enter xuống dòng trong ô; Enter đang ghép chữ IME không thêm dòng.
- Nhập tên tại dòng trống cuối giữ định danh dòng. Dữ liệu góc tiếp tục cập nhật dòng Góc trong bảng tuần, giữ các thẻ/MT liên kết.
- Trang Dự kiến chủ đề – chủ đề nhánh: Cả năm (mặc định) và các học kỳ BE trả cho lớp/kế hoạch tổ đang chọn. Lọc bằng `themeIds` của gói học kỳ cho cả Danh sách, Bảng và chế độ sửa. Chưa có gói học kỳ thì xem cả năm.
- Đổi học kỳ chỉ thay phần đang xem, giữ toàn bộ bản soạn và Lưu/Ctrl+S. Các thao tác ghi rõ “cả năm”, nhập và xuất file vẫn áp dụng cả năm.

## Đồng bộ select trên card lọc — Tiền 13/11/2026

- Thay các tab lọc học kỳ và kiểu xem bằng `FilterSelect` trong `ClassFilterBar`, cùng hàng Nhóm tuổi/Lớp/Chủ đề. Nhãn hiện “Học kỳ:”, “Kiểu hiển thị:” theo CSS chung.
- Lịch nhánh: kiểu Danh sách/Bảng; khi sửa vẫn dùng bảng nhập liệu hiện có. Học kỳ tiếp tục có lựa chọn Cả năm.
- Kế hoạch giáo dục chủ đề và kế hoạch giáo dục ngày: chọn học kỳ bằng select, giữ số chủ đề trong nhãn lựa chọn và tham số URL `hk`.
- Chi tiết kế hoạch chủ đề: select Kiểu hiển thị chọn Bảng/Dạng cây. Trang cha giữ lựa chọn và truyền xuống `ThemePlanBody`.
- Bảng phủ MT: select “Lọc mục tiêu:” gồm Tất cả/MT chưa dạy/Nội dung chưa có hoạt động trên cùng card đầu trang; truyền lựa chọn xuống `CoverageTab`.
- Các tab chuyển tài liệu (kế hoạch chủ đề, bảng phủ MT, tuần/ngày) vẫn điều hướng theo route. Không đổi điều kiện duyệt, quyền, API hoặc dữ liệu lưu.

Known pitfall: không lấy bản nháp đã lọc làm payload lưu; nối Enter vào mọi cột bảng góc. Xem [incident](../knowledge/incidents/FE-BUG-261113-corner-enter.md).
