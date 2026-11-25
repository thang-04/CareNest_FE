# Danh sách phiên bản kế hoạch giáo dục chủ đề và ngày

Nguồn nghiệp vụ: BE EDU-112 (Tiền 25/11/2026), EDU-76, EDU-109.

## Hành vi

- Menu "Kế hoạch giáo dục chủ đề" (`/education/theme-plans`) và "Kế hoạch giáo dục ngày" (`/education/day-plans`) mở
  trang danh sách trước (`ClassDocListPage`, kind `semester` / `dossier`), bấm dòng mới vào trang chi tiết của lớp.
- Mỗi dòng là một hồ sơ: Lớp · Nội dung (học kỳ / chủ đề, theo kế hoạch tổ phiên bản mấy) · Phiên bản ("Đang hiệu lực"
  hoặc "Bản cũ") · Các lần ban hành · Trạng thái · Hạn. Lọc nhóm tuổi, lớp; 10 hồ sơ/trang (phân trang ở BE).
- Mặc định chỉ bản đang hiệu lực (`currentOnly=true`); tích "Xem cả bản cũ" thì hiện cả hồ sơ theo kế hoạch tổ đã bị
  thay thế.
- "Lần n" trong cột Các lần ban hành mở trang kế hoạch chủ đề kèm `?release=<id>`, trang tự mở bản xem chỉ đọc của lần
  ban hành đó.
- Ai thấy hồ sơ nào do BE quyết định; HT, PHT xem mọi bản đã ban hành cũ và mới (EDU-112 (5)).
- Nút "Tạo phiên bản điều chỉnh": kế hoạch năm học và kế hoạch tổ ở trang chi tiết theo cờ `canCreateVersion`; gói
  học kỳ, hồ sơ chủ đề theo cờ `canRevise` (trước hạn EDU-76).

## API

- `GET /education-plans/class-docs/summary?kind=semester|dossier&classIds=&currentOnly=&page=&size=` — mỗi dòng có
  `releases` (id, version, releasedAt, approvedBy), `superseded`, `everReleased`.
- `GET /education-plans/class-docs/releases/{id}` — bản chụp lúc ban hành.
