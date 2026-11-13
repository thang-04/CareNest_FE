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

## Bổ sung 06/11 — Lưu cả trang báo lỗi sau khi policy đã lưu

- Tái hiện: Hiệu trưởng đổi người tạo chủ đề nhánh sang Giáo viên rồi bấm Lưu cả trang; UI báo chưa lưu được, Hủy bỏ vẫn thấy Giáo viên.
- Nguyên nhân FE: PUT workflow-policy đã thành công, sau đó PUT config thiếu signers. EduConfigRequest yêu cầu @NotNull Signers nên request thứ hai bị chặn trước service. Hủy bỏ đọc lại cấu hình đã lưu nên vẫn thấy Giáo viên. Test cũ lại kỳ vọng signers bị bỏ khỏi body, che mất lệch contract này; lỗi lộ ra khi ghép hai bước vào một nút Lưu.
- Sửa hẹp: adapter gửi signers bắt buộc theo reviewers của policy hiện tại (year/branch/theme → year/branch/week); fallback cfg.signers cho caller cấu hình cũ. Không gửi signers cũ sau khi vừa đổi chuỗi duyệt.
- Attempts: regression workflow-config trước sửa 1 pass / 1 fail tại body.signers; sau sửa workflow-config và year-plan-api 16/16 pass. Kiểm cả trường hợp signers cũ khác policy vừa lưu và giữ TEACHER/canConfigure/revision sau lưu.
- Phạm vi: chỉ education Web; không thay contract BE/APP, không hoàn tác cấu hình đã lưu trên server. Lỗi mạng giữa hai API vẫn phải hiển thị trạng thái lỗi, không coi Hủy bỏ là hoàn tác thao tác đã ghi.`n- Bổ sung dirty sau lưu: saver dùng response làm mốc sạch nhưng draft giữ signers/metadata cũ. EduConfigPage đồng bộ draft bằng cùng savedDoc khi người dùng chưa sửa thêm trong lúc lưu; giữ chỉnh sửa mới nếu có. Cổng cuối verify.log.
