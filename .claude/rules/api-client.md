---
paths:
  - "src/**/api/**/*.ts"
  - "src/**/*api*.ts"
  - "src/**/*client*.ts"
  - "src/**/services/**/*.ts"
---

# API client rules

> Contract: `../CareNest_BE` là owner. Quy ước tích hợp: `docs/integration/BACKEND_INTEGRATION.md`. Thư viện HTTP: chưa chốt (hỏi trước khi thêm dependency).

- Một HTTP client dùng chung: base URL + API prefix lấy từ config/env (BE prefix cấu hình được, mặc định `/api`); không hard-code host/prefix trong từng call.
- Client chuẩn hóa envelope `{ code, desc, data }`: thành công trả `data`; lỗi ném một error type thống nhất chứa `status` (= `code`), `desc`, và field errors (khi 400). Component không đọc raw response.
- Xử lý tập trung: 401 ⇒ luồng phiên hết hạn (theo `AUTH_FLOW.md`, chưa chốt); 403/404 ⇒ trả về cho màn hình hiển thị trạng thái phù hợp, không retry; 5xx/503/504 ⇒ thông báo thử lại, không retry vô hạn.
- **Không phân nhánh logic theo nội dung text `desc`** (dùng để hiển thị). Cần phân biệt nhiều lỗi cùng status ⇒ đề xuất BE bổ sung mã máy đọc được, không parse chuỗi.
- Hàm API theo vùng nghiệp vụ (attendance, nutrition, health, ...) khớp module BE; tên/shape theo DTO BE, không đổi tên field ở tầng này trừ khi có mapper rõ ràng.
- Pagination: dùng shape BE trả trong `data` (`items`, `page`, `size`, `totalElements`, `totalPages`); `page` bắt đầu từ 0.
- Không thêm query param lọc scope (campusId, classId) để "phân quyền" — BE tự áp scope theo người gọi; param chỉ là filter người dùng chọn.
- Không log body request/response chứa dữ liệu trẻ, sức khỏe, token. Không gửi dữ liệu trẻ tới dịch vụ bên thứ ba (analytics, AI) từ client.
- Endpoint chưa có trong BE ⇒ không tạo client giả như thật; mô tả contract cần thống nhất.
