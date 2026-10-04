# Backend Integration

**CareNest_BE là owner của API contract.** File này mô tả cách Web tiêu thụ contract; khi khác với BE ⇒ BE thắng, cập nhật file này. Nguồn theo thứ tự: source BE (`../CareNest_BE/src/main/java/com/carenest/` — `utils/ResponseJson.java`, `utils/ApiCode.java`, `dto/common/PageResponse.java`, `exception/GlobalExceptionHandler.java`) → Swagger UI của BE đang chạy (springdoc, `/swagger-ui/index.html`) → `BE:docs/contracts/API_CONVENTIONS.md`, `ERROR_CONTRACT.md` → `BE:docs/backend-coding-guide.md`. File OpenAPI export (`BE:docs/api/`) chưa có.

## Base URL & prefix

- API prefix cấu hình được ở BE (`API_PREFIX`, mặc định `/api`). FE lấy base URL + prefix từ config/env, không hard-code.
- Version trong URL (vd. `/v1`): theo BE thực tế; không tự thêm.

## Envelope (mọi response)

```json
{ "code": 200, "desc": "Success", "data": { } }
```

| Field | Ý nghĩa | FE xử lý |
| --- | --- | --- |
| `code` | **Luôn bằng HTTP status** của response | Phân nhánh theo HTTP status (= `code`) |
| `desc` | Mô tả ngắn; với lỗi là thông điệp từ BE | Hiển thị/ghi chú; **không** phân nhánh logic theo text |
| `data` | Payload; luôn có mặt (có thể `null`) | Trả cho màn hình |

- 400 validation: `data` là danh sách `{ field, message }` ⇒ map vào lỗi từng field của form.
- Phân trang: `data` = `{ items, page, size, totalElements, totalPages }`; `page` bắt đầu từ 0.
- JSON `camelCase`; ngày `YYYY-MM-DD`. Kiểu ID: theo DTO BE (`BE:src/`), không tự giả định.

## HTTP status → hành vi FE

Ý nghĩa từng status và khi nào BE trả: `BE:docs/contracts/ERROR_CONTRACT.md`. Bảng dưới chỉ là hành vi client.

| Status | FE |
| --- | --- |
| 200 / 201 | Hiển thị `data`; sau mutation refetch dữ liệu liên quan |
| 400 | Lỗi field (nếu có) hoặc thông báo chung |
| 401 | Luồng auth (`AUTH_FLOW.md`, chưa chốt) |
| 403 | Màn hình "không có quyền"; không retry; không tự đổi sang dữ liệu khác |
| 404 | "Không tìm thấy"; không suy luận là dữ liệu không tồn tại thật (có thể bị ẩn do scope) |
| 409 | Hiển thị `desc`, refetch trạng thái mới |
| 413 / 415 | Thông báo tại ô upload |
| 500 | Thông báo chung, không lộ chi tiết |
| 503 / 504 | Thông báo; cho phép tiếp tục luồng không AI |

Lỗi cùng status phân biệt bằng `desc` ở BE hiện tại (FE-KI-002). FE cần phân biệt bằng máy ⇒ **đề xuất BE thêm mã lỗi ổn định** (cross-repo), không parse text.

## Phân quyền & scope

- BE kiểm tra permission + access scope (School/Campus/Class/Child) cho mọi request. **Không lọc authorization chỉ ở client.**
- Ẩn/disable menu, nút theo dữ liệu quyền BE trả là UX; vẫn phải xử lý 403/404.
- Không gửi param scope để "xin quyền"; campus/lớp trong filter chỉ là lựa chọn của người dùng trong phạm vi BE cho phép.

## Dữ liệu nhạy cảm

Không log/console/persist body chứa dữ liệu trẻ, sức khỏe, token. Không gửi dữ liệu trẻ tới dịch vụ bên thứ ba từ client.

## Khi contract thiếu/sai

Không tự bịa response. Mô tả thay đổi cần thống nhất (endpoint, request, response, status, `desc`) → profile `cross-repo`; bug contract ⇒ đề xuất ghi `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md`.
