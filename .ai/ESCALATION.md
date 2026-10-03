# Mở rộng context có điều kiện

- **L1 — cục bộ:** đọc source, test, route/component và thay đổi gần khu vực cần xử lý nếu đã có.
- **L2 — feature Web:** thêm `REPO_CONTEXT.md`, màn hình/luồng liên quan và API client thực tế; tra BE khi cần business rule hoặc hợp đồng.
- **L3 — liên repo:** kiểm tra contract/behavior ở BE và tác động APP khi cùng dùng endpoint hoặc auth. Liệt kê phần đã xem và phần chưa có checkout.
- **L4 — hệ thống:** đọc đầy đủ các nhóm nguồn liên quan khi thay đổi kiến trúc, security, quyền truy cập, dữ liệu trẻ hoặc vận hành lớn.

Không đọc toàn bộ repo cho task nhỏ. Nếu source/docs chưa có, ghi rõ khoảng trống thay vì tạo rule giả. Nếu code và tài liệu mâu thuẫn, xác minh intended behavior trước khi sửa.

