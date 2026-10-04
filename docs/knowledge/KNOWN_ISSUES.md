# Known Limitations — CareNest_FE

Giới hạn **cố ý hoặc chưa làm** của Web/contract mà agent cần biết để không coi là bug. Bug (kể cả chưa rõ root cause) **không** ghi ở đây mà ghi vào `ISSUE_INDEX.md` với status `open`. Trạng thái dự án và PENDING xem `docs/context/CURRENT_STATE.md`. Giới hạn phía BE: `BE:docs/knowledge/KNOWN_ISSUES.md`.

| ID | Màn hình/vùng | Giới hạn | Cách làm việc với nó | Ngày |
| --- | --- | --- | --- | --- |
| FE-KI-002 | API client | BE hiện phân biệt lỗi cùng HTTP status bằng `desc` (text), chưa có mã lỗi máy đọc được | Phân nhánh theo status; hiển thị `desc`; cần thì đề xuất BE thêm mã | 2026-10-03 |
