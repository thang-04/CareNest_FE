---
paths:
  - "src/services/**/*.js"
  - "src/config/env.js"
---

# API client rules

> Contract: `../CareNest_BE` là owner. Quy ước tích hợp: `docs/integration/BACKEND_INTEGRATION.md`. HTTP client trong `src/services/http/`: `beClient.js` (màn đã nối BE thật: token gateway, đổi id số ↔ chuỗi, lỗi theo `errorCode`) và `axiosClient.js` (module còn mock/demo). Tra endpoint → controller BE: grep `docs/integration/FE_API_CALLS.md`, `docs/integration/BE_API_INDEX.md`; tầng facade/mock/api: `docs/architecture/CODING_GUIDE.md` §4, §8.

- Mỗi module: facade `services/<module>/<x>Service.js` chọn `mock/` hay `api/` theo `USE_MOCK`; hàm `api/*Api.js` cùng tên/tham số với mock. Không tạo service lẻ ở gốc `services/` cho module mới.
- Chỉ dùng `beClient` hoặc `axiosClient` (base URL + prefix từ `config/env.js`); module đã `api` trong `integrationModules.js` dùng `beClient`. Không hard-code host/prefix, không gọi `fetch` hay tạo axios instance mới.
- Lỗi luôn về một dạng `Error` có `status`, `message`, `details` (interceptor `axiosClient`). Component không đọc raw response.
- Envelope BE `{ code, desc, data }`: interceptor `axiosClient` bóc `data` và lấy thông điệp lỗi từ `desc` (lỗi field 400 ở `details`); `api/*Api.js` nhận thẳng `data`, không bóc lại.
- 401 ⇒ luồng hết phiên tập trung (`UNAUTHORIZED_EVENT`, `docs/integration/AUTH_FLOW.md`); 403/404 ⇒ trả về màn hình hiển thị trạng thái, không retry; 5xx ⇒ thông báo thử lại, không retry vô hạn.
- **Không phân nhánh logic theo nội dung text `desc`.** Phân biệt lỗi cùng status bằng `errorCode` của BE (`beClient` đã đọc); BE chưa có mã ⇒ đề xuất BE bổ sung.
- Tên/shape theo DTO BE, không đổi tên field ở tầng này trừ khi có mapper rõ ràng. Pagination theo shape BE (`items`, `page`, `size`, `totalElements`, `totalPages`; `page` từ 0).
- Không thêm query param lọc scope (campusId, classId) để "phân quyền" — BE tự áp scope; param chỉ là filter người dùng chọn.
- Mock repo (`services/<module>/mock/`) là BE giả: dùng `readDb`/`writeDb`/`delay`/`ApiError` từ `@/mocks/mockDatabase`; không import mock repo của module khác (đi qua facade của module đó).
- Không log body chứa dữ liệu trẻ, sức khỏe, token. Không gửi dữ liệu trẻ tới dịch vụ bên thứ ba từ client.
- Endpoint chưa có trong BE ⇒ không tạo client giả như thật; mô tả contract cần thống nhất. File gọi HTTP phải khai trong `src/config/integrationModules.js` (cổng `check-api-contract.mjs`).
