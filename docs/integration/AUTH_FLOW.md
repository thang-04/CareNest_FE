> **Status: CHƯA CÓ NỘI DUNG — không dùng làm nguồn.** Cơ chế auth chưa quyết định (`BE:docs/contracts/AUTH_CONTRACT.md` cũng là SKELETON). Không tự chọn cách lưu token — hỏi trước.

# Auth Flow (Web)

Điền khi BE chốt auth contract:

- Cơ chế (session cookie / JWT access + refresh / khác) và nơi lưu token phía Web.
- Đăng nhập, đăng xuất, hết phiên (401), refresh.
- Cách FE lấy thông tin user hiện tại: role, permission, scope (campus/lớp) để ẩn/hiện menu.
- Xóa cache/state khi logout hoặc đổi user.
- Bảo vệ CSRF/XSS tương ứng với cơ chế đã chọn.

Ràng buộc đã biết: BE kiểm tra quyền thật; FE không tự quyết quyền (`docs/integration/BACKEND_INTEGRATION.md`).
