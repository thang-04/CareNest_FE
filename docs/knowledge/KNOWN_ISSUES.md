# Known Issues & Limitations — CareNest_FE

Lỗi/giới hạn **đang tồn tại** ở Web hoặc chưa xử lý triệt để, kể cả chưa rõ root cause. Khi fix xong ⇒ chuyển thành incident + dòng `ISSUE_INDEX.md`, xóa khỏi đây. Giới hạn nghiệp vụ chung: `../CareNest_BE/docs/knowledge/KNOWN_ISSUES.md`.

| ID | Màn hình / vùng | Mô tả | Workaround | Trạng thái | Ngày |
| --- | --- | --- | --- | --- | --- |
| FE-KI-001 | toàn repo | Chưa có source; framework, router, state, auth chưa chốt | Hỏi trước khi chọn; docs SKELETON không dùng làm nguồn | Mở | 2026-10-03 |
| FE-KI-002 | API client | BE hiện phân biệt lỗi cùng HTTP status bằng `desc` (text), chưa có mã lỗi máy đọc được | Phân nhánh theo status; hiển thị `desc`; cần thì đề xuất BE thêm mã | Mở | 2026-10-03 |
| FE-KI-003 | nhiều màn hình | Actor PENDING (xác nhận suất P-05, đơn nghỉ P-15, nhập đo sức khỏe) | Ẩn/hiện theo permission BE, không hard-code role | Mở | 2026-10-03 |
