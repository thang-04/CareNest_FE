---
title: Hai chế độ thay nội dung kế hoạch năm từ file
status: in-progress
owner: CareNest team
jira: null
branch: feature/G94-178-FE-FEAT-41-lesson-assessment-parent
modules: [education-plan]
rules: [EDU-01, EDU-03, EDU-10, EDU-22, EDU-23, EDU-39, EDU-40, EDU-42, EDU-46]
risk: high
created: 2026-11-02
updated: 2026-11-02
---

# Hai chế độ thay nội dung kế hoạch năm từ file

## Context
`src/models/education-plan/importGoalFile.mjs:155` ghép bổ sung vào cây/lịch cũ; `src/components/education-plan/ImportGoalFileModal.jsx:106` mô tả giữ dữ liệu cũ. EDU-46 và bộ đặc tả `BE:specs/009-full-year-plan-file-import/` xác nhận luồng bổ sung. User ngày02/11 yêu cầu đổi sang thay nội dung, có hai lựa chọn khi file thiếu phần. Đây là bản kế hoạch client; bộ spec/plan nghiệp vụ chính ở BE cần được cập nhật sau khi user cho phép sửa tài liệu BE.

## Quyết định đã chốt
1. Nhập file thay nội dung tương ứng, không chỉ nối thêm — user02/11/2026.
2. User chọn một trong hai cách ngay trong modal: thay toàn bộ (file thiếu thì để trống), hoặc chỉ thay phần file có (phần thiếu giữ cũ) — user yêu cầu có cả hai lựa chọn sau câu hỏi làm rõ02/11/2026.
3. Giữ năm học/khoảng bắt đầu-kết thúc từ hệ thống để kiểm tra chủ đề; không lấy khoảng năm học từ file làm ràng buộc đích. Giữ nhóm tuổi đã khóa, người soạn, phạm vi, trạng thái/phiên bản/phiên sửa; không tự lưu hoặc ban hành.
4. Tick QH-DN-BH hiển thị QH/DN/BH trên các dòng riêng; đây là sửa trình bày độc lập, không đổi mã lưu.

## Làm rõ nghiệp vụ
- Actor: Phó HT/Tổ trưởng đang có quyền sửa theo EDU-03/10; scope/quyền giữ server hiện có.
- Flow: [B] có file nguồn → [S] chọn chế độ/file → preview kết quả thay thế → xác nhận → form chưa lưu → Lưu/Ctrl+S theo EDU-22.
- Xung đột đã xác định: EDU-46/spec009 hiện giữ nhập tay/id/dấu tích cũ; yêu cầu mới thay dữ liệu theo hai chế độ. Phải cập nhật Domain spec → Spec Kit → analyze trước code logic nhập, theo workflow BE đã được user cung cấp.
- Chỉ ảnh hưởng nhóm màn hình Web `/education/goals/new`, `/education/goals/:id/edit`; không sửa APP, API/DB/dependency. Payload lưu hiện có gửi toàn cây và hỗ trợ bỏ dữ liệu cũ.
- Preview hiện chỉ trả title/schoolYear/age; không có description. Với schema hiện tại: chế độ toàn bộ để trống mô tả, chế độ chỉ phần có giữ mô tả cũ; preview phải nói rõ, không giả vờ đọc được mô tả trong file.

### Câu hỏi mở
Không còn câu hỏi về hai lựa chọn; chờ user duyệt kế hoạch và cho phép cập nhật bộ spec/tri thức BE. Nếu user muốn đọc thêm mô tả từ file thì đó là mở rộng parser/contract, cần làm rõ trước.

| Câu hỏi | Trả lời | Ai | Ngày | Tài liệu |
| --- | --- | --- | --- | --- |
| File thiếu phần thì xóa hay giữ? | Cung cấp cả hai lựa chọn trong modal | User | 2026-11-02 | Plan này; spec009 chờ cập nhật được phép |

## Acceptance criteria
- AC-1 (EDU-46, quyết định mới): modal có hai lựa chọn rõ nghĩa; mặc định thay toàn bộ theo yêu cầu ban đầu, đổi chế độ cập nhật preview trước khi áp dụng.
- AC-2: toàn bộ thay title/mô tả/chủ đề/nghỉ/cây mục tiêu và tick; phần thiếu trống. Chỉ phần có thay nguyên phần có dữ liệu, không nối thêm; phần thiếu giữ nguyên.
- AC-3 (EDU-01/03/10): không thay ID kế hoạch/năm học/phạm vi/người soạn/trạng thái/version/revision/session; tuổi cố định vẫn được giữ và file khác tuổi bị chặn. Tuổi trống khi lập mới chỉ được nhận từ file trong phạm vi quyền hiện có.
- AC-4 (EDU-23/39/40/42): giữ dời lịch nguồn theo chênh năm hiện có, preview ngày thực tế; truyền đúng yearRange từ năm học hệ thống vào preview và apply; lịch ngoài năm báo lỗi để sửa, vẫn giữ kiểm tra khi gửi/ban hành.
- AC-5: chủ đề mới có ID mới, tick từ file ghép theo mã mới; nếu giữ mục tiêu cũ nhưng thay chủ đề thì khớp lại tick theo mã, bỏ liên kết không còn đích và báo rõ. Không để tick trỏ ID đã xóa.
- AC-6 (EDU-22): hủy, đọc lỗi, mất quyền, phản hồi muộn, áp dụng lỗi không đổi form; áp dụng thành công chỉ đổi form và chờ Lưu; không xóa bản trên server trước khi Lưu.
- AC-7: mã ghép có ngắt dòng theo thành phần, mã dài tự ngắt khi cần; tick dùng chuột/bàn phím và bản chỉ xem vẫn đúng, không sửa chuỗi abbr lưu.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Chỗ chọn chế độ | Hai radio có mô tả trong modal | Hỏi lại sau khi áp dụng | Cho preview đúng kết quả trước khi thay dữ liệu |
| Phần thiếu | Theo chế độ user chọn | Luôn bổ sung | Yêu cầu mới của user |
| Bảo toàn dữ liệu | Tính patch thuần rồi set một lần | Xóa trước rồi nhập | Lỗi/hủy không làm mất form |

## Phases
### Phase 1 — Cập nhật đặc tả/tri thức (chờ quyền sửa tài liệu BE)
- M: BE spec009 domain-spec/spec/plan/data-model/tasks/quickstart và EDU-46; kiểm constitution hiện có, thực hiện clarify/analyze theo workflow. Không đổi API/DB.
- Giữ lịch sử task cũ, thêm AC/task cho hai chế độ; báo cáo analyze thật, không tự ghi PASS.
- Exit: `node scripts/check-ai-layer.mjs` ở repo bị sửa; không còn lỗi đặc tả chặn. Dừng review theo cổng làn L.

### Phase 2 — Model và modal thay nội dung
- M: `src/models/education-plan/importGoalFile.mjs`, `src/components/education-plan/ImportGoalFileModal.jsx`, `src/pages/education-plan/GoalFormPage.jsx`, test nhập file/model/modal hiện có.
- Patch thuần theo chế độ, remap tick, preview title/lịch/phần giữ-xóa đúng; thông báo thay thế rõ ràng; giữ file reader/race guard, quyền và leave guard.
- Tests: AC1–6, chạy RED/GREEN; dữ liệu tổng hợp, kiểm không mutate form/file và retry sau lỗi. Browser desktop/mobile và Lưu/Không lưu giả lập; kiểm BE thật chỉ khi môi trường sẵn.
- Exit: `node scripts/verify.mjs`; mọi lỗi liên quan phải hết. Lỗi targetName đang có trong test ghép bổ sung phải được phân loại theo quy tắc mới, không xóa test để che lỗi. Dừng review.

### Phase 3 — Converge và bàn giao
- AC7 kiểm riêng trước: source/CSS thật cho mã QH-DN-BH, không đổi dữ liệu.
- Converge so spec/code/tasks, append gap và implement tới khi hết; ghi verify/giới hạn thật. Không commit/push/branch mới.
- Exit: verify + check-ai-layer ở repo đã sửa, báo rõ mọi fail/skip; dừng review cuối.

## Test matrix
| AC | Tầng | Kiểm chứng | Phase |
| --- | --- | --- | --- |
| 1 | Modal | Chọn hai chế độ, preview/confirm đúng lựa chọn | 2 |
| 2–3 | Model | Thay/giữ từng phần, dữ liệu cố định, khác tuổi, quyền, không mutate | 2 |
| 4 | Model/modal/page | Năm đích và yearRange thật, lịch dời/out-of-year | 2 |
| 5 | Model | Tên/mã trùng, ID mới, không tick mồ côi, remap phần giữ | 2 |
| 6 | Model/modal/browser | Cancel, lỗi, race, mất quyền, save/discard | 2 |
| 7 | Browser | Text ngắt dòng, kích thước và aria-pressed | 3 |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Thay nội dung nhập tay | Mất nội dung sau Lưu nếu chọn sai | Preview nêu phần thay/xóa/giữ; xác nhận trước apply; guard hiện có | Trước Lưu: không lưu và tải lại bản server; không tự hứa khôi phục sau Lưu |
| Tick trỏ ID chủ đề cũ | Sai dấu tích | Ghép mã/remap và lọc ID không hợp lệ, test AC5 | Không áp patch khi chưa kiểm nhất quán |
| Spec/BE còn luật bổ sung | Agent sau làm sai | Cập nhật bộ spec/rule trước implementation | Giữ import logic hiện có tới khi duyệt |

## Validation log
- [x] Đã đọc source mergeFilePlan/prepareFileImport, modal và DTO GoalFilePreviewResponse; preview chưa có description.
- [x] Không thêm endpoint/DTO/dependency/migration hoặc sửa APP.
- [x] Mọi AC có tầng/ca kiểm chứng; không dùng EDU-46 cũ để tự nhận hai chế độ đã được code.
- [x] >8 artifact khi tính cả bộ Spec Kit: chia phase tài liệu và implementation; plan chính nghiệp vụ nằm trong bộ spec009 BE sau khi có quyền.
- [x] Tự review bản thiết kế: status draft khi gửi, đã có user approval trước implementation; không có commit/Jira bịa.

## Progress log
### 2026-11-02 — Draft và user approval
- Chưa commit. Hai lựa chọn đã được user yêu cầu; logic nhập thay thế chưa sửa.
- Sửa trình bày độc lập AC7: browser source/CSS thật đã thấy text QH\nDN\nBH, pre-line, hàng tự cao; verify mã còn chạy riêng trước bàn giao.
- Tiếp: user duyệt plan và cho phép cập nhật spec/tri thức BE; thực hiện vòng Domain spec/Spec Kit rồi code theo phase.

### 2026-11-02 — Phase1 sẵn sàng review
- User chọn “Duyệt kế hoạch và cập nhật tài liệu BE” trong chat; đây là nguồn chuyển status approved. Không phải quyền sửa production BE/API/DB.
- Đã cập nhật spec009 Domain14/spec/clarify/plan/research/data-model/contract/checklist, EDU-46/module/cross-repo và plan quản trị BE; giữ constitution1.0.0, feature pointer hiện có và toàn bộ task history. T012 hoàn tất tài liệu; T013..20 còn mở. Analyze manual không thấy critical/high blockers,13/13 FR có task; script kiểm14mục/20task IDs unique/9task delta/16quality items.
- Kiểm thiếu wiring yearRange trong import hiện có được đưa vào T016: dùng config thật cho preview/apply, thiếu config khóa apply. Không thêm description vào DTO; full clear/present keep như kế hoạch được duyệt.
- BE check-ai-layer0lỗi/12cảnh báo; chưa đổi source BE, không chạy app BE tests cho delta chỉ tài liệu. Chưa viết logic hai chế độ nhập file ở FE, chưa có converge hoặc test GREEN của mode mới.
- Theo cổng phase1 đã duyệt, dừng review trước phase2. Tick wrap có sửa source riêng; kiểm FE/source/CSS và giới hạn ghi tại VERIFICATION.md.

### 2026-11-02 — Phase2 sẵn sàng review
- User “duyệt” sau báo cáo phase1: cho triển khai hai mode FE. T013..T017 hoàn thành, không đổi BE production/API/DB/dependency.
- Model RED10fail→GREEN11; modal RED3fail→GREEN7, targeted28/28, suite giáo dục133/133; full FE369test fail0/skip0 và VERIFY PASS full sau source cuối. Syntax E2E đạt; expectation đổi đúng quy tắc mới, không bỏ fixture trùng mã để che lỗi targetName.
- Browser source/CSS thật với service/lease/save giả: cả hai mode ở1440/375, preview/cancel không mutate, full clear/present giữ đúng phần thiếu, ticks/cấu hình range, thiếu range chặn,0lỗi JS. Chưa E2E BE thật: backend có chạy nhưng thiếu credential E2E_DEV_PASSWORD.
- Theo cổng phase2 đã duyệt, dừng review trước phase3/T018..20 và converge; không tự gọi feature sạch hoặc source BE đã kiểm thử. Không commit/push.

- Review độc lập read-only: không có Critical/Important/Minor mới, model/modal18/18, đã truy save mapper; reviewer không chạy BE E2E hoặc full verify độc lập. Bổ sung E2E full clear/save/reopen ngoài hai ca present, syntax đạt, cả ba chưa chạy thiếu credential. Không dùng test source chưa chạy làm evidence pass persistence.
