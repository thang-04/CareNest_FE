# Known Limitations — CareNest_FE

Giới hạn **cố ý hoặc chưa làm** của Web/contract mà agent cần biết để không coi là bug. Bug (kể cả chưa rõ root cause) **không** ghi ở đây mà ghi vào `ISSUE_INDEX.md` với status `open`. Trạng thái dự án và PENDING xem `docs/context/CURRENT_STATE.md`. Giới hạn phía BE: `BE:docs/knowledge/KNOWN_ISSUES.md`.

| ID | Màn hình/vùng | Giới hạn | Cách làm việc với nó | Ngày |
| --- | --- | --- | --- | --- |
| FE-KI-002 | API client | BE hiện phân biệt lỗi cùng HTTP status bằng `desc` (text), chưa có mã lỗi máy đọc được | Phân nhánh theo status; hiển thị `desc`; cần thì đề xuất BE thêm mã | 2026-10-03 |
| FE-KI-003 | BE giả, form | BE giả (13 file) trả lỗi ô `422` + `details` dạng map `{ "guardians.0.phone": "…" }`; BE thật trả `400` + `data` danh sách `{ field, message }`, không có 422 (`BE:docs/contracts/ERROR_CONTRACT.md`). Trang tiếp nhận chỉ đọc lỗi ô khi 422/409 | Chốt 28/10 (C-5 A): BE giữ 400 + danh sách. Chưa đổi BE giả. Khi nối API thật: đổi danh sách thành map ở `axiosClient`, coi 400 như 422, `field` theo đường dẫn ô FE (`docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` mục 4, 7.2) | 2026-10-28 |
