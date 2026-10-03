# Workflow — Implement feature (Web)

1. **Requirement:** actor, outcome, điều kiện hoàn thành. Map sang **BE module card + rule ID** (`.ai/CONTEXT_MAP.yaml` → `keywords`). Dẫn chiếu rule ID, không chép nội dung rule vào FE. Rule/actor PENDING hoặc OPEN ⇒ nêu khoảng trống, hỏi hoặc làm theo permission BE trả về — không tự quyết.
2. **Business flow:** đọc flow trong card (`../CareNest_BE/docs/business/flows/`). Chỉ bước `[S]` là hành động trên hệ thống; bước `[B]` không thành màn hình.
3. **Screen / route / state:**
   - Đặt màn hình vào screen group trong `docs/architecture/ROUTE_MAP.md` (actor nào, ẩn/hiện theo permission).
   - Xác định server state (từ BE) vs UI state (form, filter, tab) theo `docs/architecture/STATE_MANAGEMENT.md`. Không tính lại số liệu nghiệp vụ ở client (vd. số suất, trend sức khỏe) — hiển thị số BE trả về.
   - Đủ trạng thái: loading, empty, error, 403/404, submitting, DRAFT/APPROVED nếu có duyệt.
   - Thư viện nền chưa chốt ⇒ hỏi trước (xem `CLAUDE.md` "Hỏi trước khi làm").
4. **API integration:** theo `.ai/workflows/integrate-api.md`. Endpoint chưa có ⇒ mô tả contract cần thống nhất, không mock như thể đã có.
5. **Code:** theo `.claude/rules/` (typescript, component, state, api-client). Pattern có sẵn trong source được ưu tiên hơn đề xuất mới.
6. **Test:** component test cho hành vi chính + lỗi API + ẩn/hiện theo permission; dữ liệu giả. Nêu rõ phần chưa chạy trên trình duyệt/BE thật. Kiểm tra accessibility cơ bản (label, focus, keyboard) và responsive cho màn hình có form/bảng.
7. **Docs & memory:** cập nhật `docs/architecture/ROUTE_MAP.md` (screen thực tế), `docs/context/CURRENT_STATE.md`, tạo/cập nhật `docs/features/<feature>.md` theo template nếu màn hình phức tạp. Edge case đáng nhớ ⇒ incident `CASE-xxx`. Cần BE đổi contract ⇒ liệt kê trong báo cáo.
8. Báo: đã chạy gì, chưa kiểm chứng gì, phần chờ BE/APP. Đối chiếu `docs/quality/DEFINITION_OF_DONE.md`.
