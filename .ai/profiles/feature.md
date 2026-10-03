# Profile FEATURE — màn hình / chức năng Web mới, tích hợp API

Mức: L2. Bắt đầu từ actor và outcome của người dùng, không từ component hay endpoint.

Đọc:
1. BE module card của vùng nghiệp vụ (`.ai/CONTEXT_MAP.yaml` → `keywords`): Rules, Flows, PENDING, Known pitfalls.
2. Flow trong card (`../CareNest_BE/docs/business/flows/`) — chỉ bước `[S]` mới là màn hình/hành động; bước `[B]` diễn ra ngoài hệ thống.
3. `../CareNest_BE/docs/business/USER_ROLES.md` — actor, scope, permission của hành động.
4. FE: `docs/architecture/ROUTE_MAP.md` (screen group) · `docs/features/README.md` (cách map feature → màn hình) · `docs/integration/BACKEND_INTEGRATION.md`.
5. Contract: `../CareNest_BE/docs/contracts/API_CONVENTIONS.md`, `ERROR_CONTRACT.md` và source controller/DTO BE nếu đã có.
6. `.claude/rules/` theo loại file.

Kiểm tra trước khi code:
- Actor của màn hình đã CONFIRMED? Nếu PENDING (vd. người xác nhận suất ăn, người nhập đo sức khỏe) ⇒ hiển thị theo permission BE trả về, không hard-code role; hỏi nếu cần quyết định.
- Endpoint đã tồn tại? Chưa ⇒ mô tả contract cần thống nhất, không tự bịa response.
- Màn hình có output AI ⇒ phải có trạng thái DRAFT, bước duyệt, và luồng dùng được khi AI tắt.
- Trạng thái UI đủ: loading, empty, error (theo HTTP status/`desc`), 403/404, dữ liệu không đủ quyền.
