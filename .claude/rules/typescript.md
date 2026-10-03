---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript rules

> Stack React + TypeScript là PROPOSED. Đọc source/`tsconfig` thực tế trước; pattern có sẵn trong repo thắng rule chung ở đây.

- `strict` mode; không `any` (dùng `unknown` + narrowing). `as` chỉ khi đã kiểm tra; không `!` non-null để né lỗi.
- Type cho request/response API khớp DTO BE (tên field `camelCase` như BE trả). Đặt cạnh API client của vùng nghiệp vụ; không định nghĩa lại cùng một DTO ở nhiều nơi.
- Envelope BE `{ code, desc, data }` khai báo **một lần** dùng chung (xem `docs/integration/BACKEND_INTEGRATION.md`); component không tự parse envelope.
- Enum trạng thái từ BE (vd. `DRAFT`, `APPROVED`, `CONFIRMED`) dùng union string literal khớp giá trị BE; không tự thêm trạng thái mà BE không có. Ý nghĩa/chuyển trạng thái là của BE — FE chỉ map sang nhãn hiển thị.
- Ngày (`YYYY-MM-DD`) và thời điểm (ISO-8601) giữ dạng string ở tầng API; chuyển đổi hiển thị ở tầng UI theo múi giờ `Asia/Ho_Chi_Minh`. Không so sánh ngày bằng string tùy tiện.
- Kiểu ID theo contract BE (chưa chốt; ví dụ guide BE dùng số `Long`) — dùng đúng kiểu trong DTO, không tự giả định.
- Không hard-code role/permission rải rác; nếu cần, gom vào một module hằng số khớp `../CareNest_BE/docs/business/USER_ROLES.md` (permission string) và ưu tiên dữ liệu quyền BE trả về.
- Tên file theo convention của source hiện có; chưa có ⇒ hỏi (PROPOSED: kebab-case cho file, PascalCase cho component).
- Comment: theo `CLAUDE.md` "Comment trong code" — không JSDoc tràn lan.
