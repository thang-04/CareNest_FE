# Workflow — Tích hợp API (Web)

1. **Caller & contract:** màn hình nào gọi, endpoint nào. Nguồn contract theo thứ tự: source controller/DTO BE (`BE:src/`) → Swagger UI của BE đang chạy (springdoc, `/swagger-ui/index.html`) → `BE:docs/contracts/API_CONVENTIONS.md` + `ERROR_CONTRACT.md` → module card mục "API & bảng". File OpenAPI export (`BE:docs/api/`) chưa có — không viện dẫn. Chưa có endpoint ⇒ dừng, mô tả contract cần thống nhất với BE.
2. **Envelope & lỗi:** theo `docs/integration/BACKEND_INTEGRATION.md`: đọc `{code, desc, data}`; `code` = HTTP status; 400 có danh sách field error trong `data`; xử lý 401 (phiên hết hạn), 403 (không quyền/ngoài scope), 404 (không tồn tại hoặc bị ẩn do scope), 409 (xung đột trạng thái), 503/504 (dịch vụ ngoài như AI không khả dụng).
3. **Auth:** theo `docs/integration/AUTH_FLOW.md` — hiện SKELETON (chưa chốt) ⇒ không tự chọn cách lưu token; hỏi.
4. **API client:** theo `.claude/rules/api-client.md` — một lớp client dùng chung, base URL + prefix từ config (BE prefix cấu hình được, mặc định `/api`), không hard-code host. Type request/response khớp DTO BE.
5. **Validation:** chỉ validation hỗ trợ nhập liệu (required, format, độ dài) — validation nghiệp vụ là của BE; hiển thị lỗi field từ response 400.
6. **Phân quyền:** không lọc dữ liệu theo scope ở client; ẩn hành động theo permission BE trả về chỉ là UX.
7. **Test:** mock ở tầng HTTP với dữ liệu giả cho: thành công, 400 field error, 401, 403, 404, 409, 5xx, danh sách rỗng, phân trang.
8. **Contract cần đổi:** không tự giả định. Liệt kê thay đổi cần BE (endpoint, field, status, `desc`) + tác động APP (`../CareNest_BE/docs/system/CROSS_REPO_MAP.md`); ghi rõ phần chưa kiểm thử liên repo.
9. Cập nhật `docs/integration/BACKEND_INTEGRATION.md` nếu phát hiện quy ước mới; lỗi tích hợp không hiển nhiên ⇒ `update-knowledge.md` T2. Đối chiếu DoD.
