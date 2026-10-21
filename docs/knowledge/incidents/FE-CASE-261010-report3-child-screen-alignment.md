---
id: FE-CASE-261010-report3-child-screen-alignment
type: edge-case
screens: [children-list, enrollment, class-placement, health-declaration, parent-activation, child-profile]
be_modules: [child, health]
rules: []
status: open
date: 2026-10-10
keywords: [Report 3, screens 27-32, CSV, Excel, mock, development link, parent activation]
similar_to: [FE-CASE-261009-profile-api-not-in-be]
---

# FE-CASE-261010-report3-child-screen-alignment — giới hạn khi viết đặc tả từ code

## Symptom

Ngày 2026-10-10, user yêu cầu viết file Word bổ sung III. Functional Requirements cho màn 27–32 từ code, đối chiếu Report 3 II.3 và V.1. Đọc tĩnh cho thấy UI có đủ trang nhưng không đủ bằng chứng khẳng định đã tích hợp BE hoặc khớp toàn bộ SRS.

Nguồn SRS: `G94-Report-3_Software Requirement Specification.docx` do user chỉ định; không chép dữ liệu cá nhân hoặc rule vào incident.

## Điều kiện tái hiện

Đọc source hiện tại; không chạy thao tác với dữ liệu trẻ thật. Mock mặc định được chọn tại `src/config/env.js:3`.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đối chiếu Screen List 27–32, II.3.2/3.3/3.8/3.9/3.10, II.5.2, V.1 và component/service | Phân biệt được hành vi có trong source, yêu cầu SRS và điểm chưa thống nhất | UI có trang không đồng nghĩa hoàn tất tích hợp |
| 2 | Kiểm adapter/mock và BE module card local tại `D:/project_capstone/project/be/CareNest_BE/docs/modules/child.md` | API child trong card còn ở mức thiết kế; chưa kiểm chứng contract/tích hợp runtime | Không dùng endpoint FE tự khai báo làm bằng chứng contract BE |

## Root cause

Các chênh lệch đã xác nhận bằng đọc tĩnh:

- `src/services/children/mock/childrenMockRepository.js:356`: mock trả `supported: false` với Excel; chỉ đọc CSV. UI chọn được Excel tại `src/pages/children/ImportChildrenPage.jsx:30`.
- `src/services/children/mock/childrenMockRepository.js:390`: nhập hàng loạt lưu hồ sơ chưa có lớp. Đây là trạng thái trung gian cần phân biệt với hoàn tất nhập học tại II.3.8; chưa tự kết luận mô hình lưu là sai.
- `src/pages/children/ChildProfilePage.jsx:246`: các quick link là sức khỏe, xu hướng và khai báo; thiếu liên kết hồ sơ phát triển được nêu ở Screen List 32. Tương tự, Children List chưa có hành động phát triển của II.3.2.
- `src/pages/children/ChildProfilePage.jsx:152`: danh sách dị ứng chính thức rỗng hiển thị "Không có", trong khi khai báo có thể chưa được cung cấp/chưa xác nhận. Cần phân biệt trạng thái trước khi kết luận không có dị ứng.
- Report 3 I.3.3 ghi actor liên kết phụ huynh khác II.3.9 và Permission Matrix; V.2 MSG30 là thông báo AI nhưng được các UC dùng cho lỗi tải/SMS. Đây là câu hỏi tài liệu, chưa phải quyết định nghiệp vụ mới.

## Fix

Chưa sửa source hoặc contract. Tài liệu Word ghi rõ DRAFT, nguồn căn cứ và điểm cần xác nhận; không tự hợp thức hóa chênh lệch. Nội dung cần thống nhất giữa SRS và BE được đề xuất để ghi vào `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`; chưa sửa repo BE/APP.

## Regression test

Chưa có test runtime. Khi được giao sửa: kiểm Excel thật; vòng đời nhập/chờ xếp lớp/hoàn tất; liên kết phát triển; trạng thái chưa khai báo/chưa xác nhận/đã xác nhận không dị ứng; actor liên kết theo quyết định được duyệt.

## Ảnh hưởng

Chỉ bổ sung tri thức và tài liệu theo yêu cầu; không đổi quyền, màn hình, dependency hoặc dữ liệu. Các vấn đề nghiệp vụ và contract cần chủ sở hữu BE/SRS xác nhận trước khi sửa implementation.

## Lesson

Đặc tả viết từ mock phải phân biệt hiện trạng source và yêu cầu nghiệp vụ; mọi hành vi chỉ có trong code cần ghi rõ nguồn, không nâng thành rule đã xác nhận.

## Cập nhật 2026-10-14 — quyết định của user

Nguồn: user, 2026-10-14 (chưa ghi vào BE; P-17 vẫn PENDING ở `BE:docs/business/BUSINESS_RULES.md`). Thực hiện theo plan `docs/plans/completed/2026-10-14-children-enrollment-allergy-decisions.md`.

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 3 | Hỏi user các điểm lệch SRS (chờ xếp lớp, actor dị ứng) | Tiếp nhận không bắt buộc lớp (nhập tay và import đều có thể "Chờ xếp lớp"); dị ứng Phó hiệu trưởng khai báo là dữ liệu chính thức ngay, sửa sau bắt buộc lý do | Lệch SRS GBR-CP-02 và UC 3.8 phải cập nhật tài liệu nộp |

- Đã sửa (Phase 1–2): wizard tiếp nhận cho bỏ trống lớp; bỏ luồng Hiệu trưởng xác nhận dị ứng (`confirmAllergies`, widget/KPI dashboard); `child.allergies` đồng bộ khi lưu khai báo nên bếp không còn dùng danh sách cũ.
- Còn mở: Excel chỉ đọc CSV; thiếu link hồ sơ phát triển; nhãn "Không có" khi dị ứng chưa cung cấp (Đợt 1, task riêng).

## Cập nhật 2026-10-14 — Phó hiệu trưởng có thể phụ trách 2 điểm trường

Nguồn: user, 2026-10-14 ("Hiệu trưởng phân quyền cho Phó hiệu trưởng 2 cơ sở được"). Chưa ghi ở BE.

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 4 | Danh sách trẻ: bộ lọc điểm trường + lớp hiện cho cả Hiệu trưởng và Phó hiệu trưởng; lựa chọn điểm trường lấy từ danh sách BE trả về | Không tự suy scope ở client | FE mock và quyền vẫn giả định Phó hiệu trưởng một `user.campusId` (vd. `src/utils/children/childrenPermissions.js`, `src/services/children/mock/childrenMockRepository.js`) — cần BE chốt mô hình phân công nhiều điểm trường trước khi sửa |
