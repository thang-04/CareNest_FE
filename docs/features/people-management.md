# Khu Nhân sự, Phụ huynh, Trẻ

Status: đang triển khai. Nguồn quyết định UX: user xác nhận trong hội thoại ngày 2026-10-18.

## Mục tiêu Web

- Một khu điều hướng bốn tab **Nhân sự / Phân quyền / Phụ huynh / Trẻ**. Tab Phân quyền chỉ hiện cho Hiệu trưởng có `PERMISSION_MANAGE`; Giáo viên giữ lối vào danh sách trẻ hiện có.
- Nhân sự mở bằng bảng để đọc nhanh tên, chức vụ, nơi làm và trạng thái. Quyền hiệu lực chỉ đọc chính xác trong hồ sơ người; không đoán ngoại lệ từ danh sách tài khoản.
- Tab Phân quyền hiển thị toàn bộ danh mục quyền thành ma trận PHT/GV. Ô BE cho cấu hình có công tắc; ô cố định/không cấu hình vẫn hiện ở trạng thái khóa. Ngoại lệ từng người vẫn nằm trong hồ sơ.
- Hồ sơ người tách **Phân công / Quyền / Tài khoản**; Hiệu trưởng chỉnh ngoại lệ từng người ở đây. Mọi thay đổi quyền giữ bước ghi lý do theo `BE:docs/modules/identity-access.md`.
- Nút **Thêm nhân sự** mở modal trên danh sách. Modal dùng lại từ roster và nhận sẵn campus/lớp khi bắt đầu ở một nơi.
- Phân công bắt đầu từ điểm trường/lớp. Ô rỗng ghi **Chưa có phân công**; không diễn giải thành thiếu định biên. Giữ nhân viên bếp trong bảng và phân công, nhưng không tạo công tắc quyền khi BE không trả quyền cấu hình được.
- Phụ huynh tiếp tục chọn lớp → trẻ → tài khoản; ưu tiên cấp lại và gỡ trong bố cục, vẫn giữ thêm liên kết và khóa/mở. Phụ huynh không có quyền cấu hình trong UI. Tab Trẻ dùng danh sách đang có.
- Phụ huynh và Nhân sự có bốn card tổng quan lớn cùng kiểu với tab Trẻ. Card Nhân sự hiện ở cả Danh sách nhân sự và Phân công theo nơi. Phụ huynh đếm bé có/chưa có liên kết và lớp có trẻ trong điểm trường đang chọn; Nhân sự dùng `totalElements` của các truy vấn theo trạng thái/vai trò trong phạm vi điểm trường đã chọn. Card chỉ hiển thị số liệu.

## Nguồn dữ liệu và giới hạn

- BE là nguồn cho quyền, phạm vi và phân công: `BE:docs/modules/identity-access.md`, `BE:docs/modules/school-structure.md`, `BE:docs/modules/child.md`; rule AUTH-08/10/11/14/16/18/19.
- Danh sách Nhân sự cần BE lọc `staffOnly=true` trước phân trang; bảng theo nơi cần `GET /staff-assignments/roster?campusId=`. Trước khi hai contract này có trên BE thật, phần liên quan chỉ kiểm được với mock FE.
- Với `VITE_USE_MOCK=false`, hai màn phụ thuộc contract mới chỉ mở khi `VITE_PEOPLE_CONTRACT_READY=true` được đặt sau khi BE triển khai và smoke test. Mặc định cờ là `false`, để không trình bày danh sách chưa được lọc là “Nhân sự”.
- Route cũ giữ link trực tiếp. Tab chỉ ẩn/hiện theo quyền cho UX; BE vẫn quyết định 403/404.

## Known pitfalls

- `GET /accounts` hiện chưa trả quyền hiệu lực/ngoại lệ từng người. Không ghi “theo vai trò” hoặc “có quyền riêng” trên từng dòng bảng nếu chưa có dữ liệu BE.
- `GET /children` chỉ trả `guardianCount` cho mỗi bé, không trả danh tính phụ huynh. Không đếm tài khoản phụ huynh riêng biệt từ trường `guardians` của mock.
- Danh sách nhân sự và Phân công theo nơi là hai route; khi đổi phần tổng quan chung cần kiểm cả hai và thao tác chuyển qua lại. Xem [FE-BUG-261018-staff-roster-summary-missing](../knowledge/incidents/FE-BUG-261018-staff-roster-summary-missing.md).
- `GET /accounts` của Hiệu trưởng có thể bao gồm tài khoản phụ huynh; phải dùng lọc phía BE trước phân trang để tách tab Nhân sự.
- Không dùng màn phân công PHT/GV mock theo năm học như bằng chứng cho contract phân công thật; đọc `BE:docs/modules/school-structure.md`.
- Modal phân công phải chịu được state dialog cũ khi Vite HMR; xem [FE-BUG-261018-roster-modal-hmr-state](../knowledge/incidents/FE-BUG-261018-roster-modal-hmr-state.md).
- Chuyển campus phải loại response roster cũ và chặn thao tác trên roster sai campus; xem [FE-BUG-261018-roster-campus-race](../knowledge/incidents/FE-BUG-261018-roster-campus-race.md).
- Tìm người trong modal phải xóa lựa chọn cũ và kiểm người được chọn vẫn thuộc kết quả hiện tại; xem [FE-BUG-261018-roster-hidden-candidate](../knowledge/incidents/FE-BUG-261018-roster-hidden-candidate.md).
