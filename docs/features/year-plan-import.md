# Lấy mục tiêu từ kế hoạch có sẵn

Nguồn nghiệp vụ và quyền: [EDU-24 và EDU-06](../../../CareNest_BE/docs/business/BUSINESS_RULES.md); [đặc tả](../../../CareNest_BE/specs/003-import-year-plan-goals/spec.md), [plan](../../../CareNest_BE/specs/003-import-year-plan-goals/plan.md). Quy trình lập/sửa dùng [bố cục một trang chốt 02/11/2026](year-plan-preview-edit.md); quyền và cách ghép dữ liệu giữ nguyên.

## Giao diện

Ở đầu trang soạn, mở Lấy từ kế hoạch có sẵn; chọn năm học và nhóm tuổi trong phạm vi được phép mà không đổi header. Xem tên nguồn, trạng thái, ngữ cảnh cha và nội dung giáo dục rồi tích từng mục tiêu, theo lĩnh vực hoặc tất cả. Đổi bộ lọc/nguồn bỏ lựa chọn cũ. Hủy không đổi bản đang soạn.

Xác nhận đọc lại nguồn. Nguồn đã đổi hoặc mất quyền thì báo lỗi để xem/chọn lại; phản hồi sau khi đóng/đổi nguồn không được thêm dữ liệu. Kết quả thêm và bỏ qua được thông báo; mục không thể biểu diễn đúng phân cấp được liệt kê rõ. Lưu/Ctrl+S và cảnh báo rời màn tiếp tục qua hook hiện có.

## Các điểm tích hợp

- Facade listGoalSources/getGoalSource dùng API list/detail sẵn có, hoặc fake backend có scope cho mock; không dùng getAll của provider làm danh sách nguồn.
- ImportGoalsModal/useGoalImportSources quản lý trạng thái đọc/selection và fresh-confirm; GoalFormPage kiểm quyền/lease hiện tại rồi gọi helper thuần importGoals.mjs.
- Mapper/save/session hiện tại giữ nguyên. GET nguồn không lấy khóa hoặc ghi cache baseline của writer. Không thêm endpoint/dependency/migration.
- Phạm vi import UI khác với toàn bộ quyền đọc của một người có nhiều vai trò. Không coi filter UI là authorization server; không có provenance nguồn trong PUT hiện hành.

## Bẫy phân cấp

Nguồn và đích dùng flat rows với heading. Helper kiểm round-trip qua normalizer, tránh thêm sub đầu tiên làm đổi cha row đích cũ. Trường hợp không biểu diễn được báo chưa thêm, không tạo tên cha giả. Xem [case](../../../CareNest_BE/docs/knowledge/incidents/CASE-261028-year-plan-import-first-sub-reparent.md).

## Kiểm chứng

Node tests tại import-goals.test.mjs, import-goal-sources.test.mjs và year-plan-api.test.mjs; browser E2E ở tests/e2e/system/year-plan-import.spec.mjs. Kết quả cuối và giới hạn nằm trong [quickstart](../../../CareNest_BE/specs/003-import-year-plan-goals/quickstart.md). Chưa coi các lệnh dự kiến trong quickstart là bằng chứng đã chạy.

Node test:edu 59/59 và Web verify đầy đủ đã đạt; browser mock happy/edge QA đạt. Real-BE E2E 13 ca chưa chạy vì chưa có E2E_DEV_PASSWORD; không coi vòng converge đã sạch khi T019/T021 còn mở.

Cập nhật cuối 28/10/2026: 13/13 real-BE E2E đã đạt sau khi cấu hình đúng credential và database fixture; T019/T021 hoàn tất. Những ghi chú đang chờ trước đó là lịch sử. Xem quickstart để đối chiếu kết quả sau cùng.
