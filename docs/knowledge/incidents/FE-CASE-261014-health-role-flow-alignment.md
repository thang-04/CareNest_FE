---
id: FE-CASE-261014-health-role-flow-alignment
type: edge-case
screens: [health-declaration, health-record, health-measurement, health-trends]
be_modules: [child, health, nutrition]
rules: [HLT-01, HLT-02, HLT-05]
status: open
date: 2026-10-14
keywords: [health, role, measurement, publish, AI draft, BMI, PROPOSED]
similar_to: [FE-CASE-261010-report3-child-screen-alignment]
---

# FE-CASE-261014-health-role-flow-alignment — phân tích quyền sức khỏe từ mock

## Symptom
Phân tích source FE theo yêu cầu user cho thấy luồng nhập/công bố số đo và nhãn dinh dưỡng đã được dựng trong mock, trong khi tài liệu BE vẫn còn mục chưa chốt. Không dùng hành vi demo để xác nhận nghiệp vụ hoặc tích hợp thật.

## Điều kiện tái hiện
Đọc tĩnh source hiện tại, không thao tác dữ liệu trẻ thật. Mock mặc định tại `src/config/env.js:3`; adapter `src/services/children/api/childrenApi.js:4` ghi contract PROPOSED.

## Attempts — đã thử
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Đối chiếu AppRoutes, childrenPermissions, bốn trang sức khỏe và childrenMockRepository | Teacher/Team Leader được phân công lớp nhập, sửa và tự công bố số đo; Principal/VP xem theo scope; VP sửa khai báo, Principal xác nhận dị ứng | Phải tách quyền mở route, hành động và phạm vi dữ liệu |
| 2 | Tìm BE sibling và mở health card/flow trên raw GitHub main | Sibling không tồn tại, remote không tải được; đọc bản local thực có tại `D:/project_capstone/project/be/CareNest_BE/docs/modules/health.md` và `D:/project_capstone/project/be/CareNest_BE/docs/business/flows/health-check.md` | Ghi đúng nguồn đối chiếu, không khẳng định đã đọc remote |
| 3 | Đối chiếu card/flow BE với mock và HealthTrendPage | BE còn PENDING người nhập/P-13; FE dùng ngưỡng BMI placeholder; AI panel chỉ có bản nháp và phân tích lại, chưa có hành động duyệt | Đây là chênh lệch source/tài liệu, chưa phải quyết định mới của user |
| 4 | Truy vết confirmAllergies, allergyContext, attendance và kitchen | Dị ứng chính thức dùng cho cảnh báo thực đơn và suất thay thế; publishMeasurement chỉ đổi trạng thái trong mock, không gửi thông báo phụ huynh thật | Không mô tả luồng liên repo như đã tích hợp |

## Root cause
FE đang mô phỏng hành vi theo SRS trước khi health contract và các mục PENDING trong tài liệu BE được thống nhất.

- `src/utils/children/childrenPermissions.js:49`: hard-code actor nhập/sửa/công bố số đo theo lớp.
- `src/services/children/mock/nutritionRule.js:3`: tự ghi ngưỡng phân loại là placeholder, nhưng trả nhãn để UI hiển thị.
- `src/pages/children/HealthTrendPage.jsx:35`: AI panel hiển thị DRAFT, chưa có review/sửa/duyệt interpretation.
- `src/services/children/mock/childrenMockRepository.js:641`: công bố số đo chỉ cập nhật mock; thông báo mobile được để lại cho BE.

## Fix
Chưa sửa implementation, quyền hoặc contract. Báo cáo cho user phân biệt hiện trạng FE và giới hạn chưa kiểm chứng.

## Regression test
Chưa chạy trình duyệt/BE thật; chưa có test tái hiện runtime. Khi được giao triển khai cần xác minh contract, actor nhập/công bố, scope lớp/campus, chuẩn tham chiếu, vòng đời duyệt AI và thông báo phụ huynh.

## Ảnh hưởng
Teacher, Team Leader, Vice Principal, Principal, bếp và phụ huynh trên APP. Đề xuất chủ sở hữu BE ghi vào `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`: đối chiếu HLT-01/02/05 về actor nhập/công bố, P-13 và vòng đời interpretation với FE mock. Không sửa repo BE/APP.

## Lesson
Quyền và trạng thái trong FE mock là bằng chứng về giao diện hiện tại; chỉ contract/rule BE đã được xác nhận mới là căn cứ triển khai thật.

## Cập nhật 2026-10-14 — quyết định của user

Nguồn: user, 2026-10-14 (chưa ghi vào BE).

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 5 | Hỏi user actor sửa số đo, sửa bản đã công bố | Chỉ giáo viên phụ trách lớp của trẻ được sửa; code `canEditMeasurement` đã đúng, không sửa. Sửa bản đã công bố (phụ huynh có thấy bản cũ) và đơn nghỉ cho ngày đã khóa: tạm chưa sửa | Xung đột HLT-03 (cho BGH sửa) với Permission Matrix nghiêng về Permission Matrix |

- Dị ứng: Phó hiệu trưởng chốt ngay, không còn bước Hiệu trưởng xác nhận (xem FE-CASE-261010).
- Còn mở: BMI placeholder/P-13, vòng đời duyệt AI, lưu số đo hai lần, lệch múi giờ ngày đo (Đợt 1/2, task riêng).

## Cập nhật 2026-10-15 — quyết định của user về chỉ số và cờ

Nguồn: user, 2026-10-15 (PROPOSED, chưa ghi vào BE).

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 6 | Hỏi user về chỉ số mới, nguồn cờ, nhãn cờ, phụ huynh xem gì | Thêm vòng đầu, vòng cánh tay, bắt buộc; cờ do hệ thống tính + ghi riêng kết luận bác sĩ; nhãn trung tính thay "Suy dinh dưỡng/Béo phì"; phụ huynh không xem cờ | Điểm "BMI placeholder trả nhãn chẩn đoán" có hướng xử lý: plan `docs/plans/completed/2026-10-15-health-head-arm-circumference.md` |

- Vẫn mở: chuẩn tham chiếu thật (P-13) — mock giữ ngưỡng tạm, UI ghi rõ.

## Cập nhật 2026-10-15 (lần 2) — đợt khám, vận động, phiếu theo dõi

Nguồn: user, 2026-10-15 (PROPOSED, chưa ghi vào BE). Thay một phần cập nhật lần 1 ở trên.

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 7 | Hỏi user 3 vòng về luồng đánh giá sức khỏe chuyên sâu | Bỏ vòng cánh tay; thêm đợt khám theo điểm trường (Hiệu trưởng tạo/đóng), vận động thô/tinh, phân loại BMI, mức theo dõi theo 3 tiêu chí, phiếu theo dõi; phụ huynh xem tất cả bản đã công bố (đảo quyết định "không xem cờ") | Nhãn "Nguy cơ có vấn đề sức khỏe" đổi thành "Cần theo dõi sát – đề nghị khám chuyên khoa" để không thành chẩn đoán (Exclusions BE). Plan `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md` thay plan nháp vòng cánh tay |

- Vẫn mở: ngưỡng SD của chuẩn WHO (P-13, BE chốt) — mock giữ ngưỡng tạm, UI ghi rõ.

## Cập nhật 2026-10-15 (lần 3) — đã triển khai FE

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 8 | Triển khai plan 3 phase (chỉ số + phân loại, đợt khám, phiếu theo dõi) trên mock | `VERIFY PASS full`; kịch bản backend giả 44/44 đạt; nâng cấp dữ liệu demo cũ trong localStorage đạt | Nhãn "Suy dinh dưỡng/Béo phì" đã bỏ khỏi `src`; phân loại tính lại khi đọc nên dữ liệu demo cũ không lỗi. Chưa kiểm thủ công trên trình duyệt |

- Điểm BMI placeholder trả nhãn chẩn đoán: đã xử lý ở FE (nhãn trung tính + "ngưỡng tham chiếu tạm"). Incident vẫn mở cho: vòng đời duyệt AI, thông báo phụ huynh thật, chuẩn WHO thật (P-13) và contract BE.
