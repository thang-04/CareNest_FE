---
id: FE-BUG-261106-education-workflow-adapter
type: bug
screens: [education-plan]
be_modules: [education-plan]
rules: [EDU-03, EDU-10, EDU-12]
status: fixed
date: 2026-11-06
keywords: [workflow-policy, nested review, author lease, dossier version, printSnapshot]
similar_to: []
---

# FE-BUG-261106-education-workflow-adapter — workflow education chưa nối đúng adapter

## Symptom
Form đổi người tạo/duyệt nhưng chỉ PUT config cũ. Người duyệt mở author lease; metadata nested bị bỏ qua, queue dựa single role. Tuần lưu liên tiếp có root version cũ. Bản in nhánh có thể lặp người soạn dưới người duyệt và lấy tên giáo viên mới.

## Điều kiện tái hiện
Dữ liệu tổng hợp: policy year có nhiều reviewer, class theme có nhiều tuần; đổi policy rồi tải lại, duyệt trung gian và lưu tuần tiếp theo. Đổi phân công sau khi ban hành rồi xem bản in.

## Attempts — đã thử
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Chỉ đổi workflowPolicy trong form / mapper phẳng | Không gửi endpoint policy | Test phải gọi real Axios adapter và tải lại |
| 2 | Thêm version header nếu field có giá trị | Create thiếu -1, hook mất options, root cũ sau member write | Truy toàn bộ caller và refresh hồ sơ sau member write |
| 3 | Trả toàn bộ snapshot slots thành reviewer | CREATOR xuất hiện hai lần, author block dùng staff mới | Tách CREATOR từ snapshot, giữ reviewer theo slot |

## Root cause
API adapter, hook và mock còn mô hình status/role cũ; form hiển thị policy mới nhưng lưu qua endpoint cũ. Hook đặt actor sau options làm mất expected versions.

## Fix
Đọc workflow.policies/revision/canConfigure; lưu policy riêng; dùng permissions/creation scopes, explicit year submit/approve/return; review không lấy author lease. Class writes gửi member/root preconditions và await reload hồ sơ. Snapshot CREATOR dùng cho author block, reviewer block bỏ CREATOR. Mock phản chiếu metadata, dual-role exclusion, revision và pending reconciliation.

## Regression test
`tests/education-plan/workflow-config.test.mjs`, `workflow-actions.test.mjs`, `config-responsibility.test.mjs`, `doc-signers.test.mjs`; education suite 207 tests đạt ở lượt sửa này. Cổng full và browser được ghi riêng trong VERIFICATION.

## Ảnh hưởng
Chỉ education Web; source contract: `BE:specs/011-plan-creator-reviewer/contracts/workflow-api.md`. Không đổi dependency, auth chung hay APP.

## Lesson
Không dùng quyền phiên soạn cho review. Expected version phải lấy từ baseline người dùng đã xem và được truyền xuyên facade/hook, không suy từ status đích.
