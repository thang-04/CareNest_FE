---
title: Nhãn mục tiêu tùy chỉnh và kéo điền tăng số trên kế hoạch năm học
status: done
owner: CareNest team
jira: Chưa được user cung cấp cho thay đổi nhãn; không commit hoặc tạo nhánh
branch: feature/G94-278-FE-FEAT-41-lesson-assessment-parent-backup
modules: [education-plan]
rules: [EDU-09]
risk: high
created: 2026-11-07
updated: 2026-11-07
---

# Nhãn mục tiêu và kéo điền như Excel — đã triển khai

## Context
- User 07/11 yêu cầu đổi nhãn MT1, MT2 thành tên tùy chỉnh ở kế hoạch năm học; đã trả lời chọn kéo tự tăng số theo mẫu, không sao chép cùng tên.
- `src/components/education-plan/GoalTables.jsx:387` dựng nhãn `MT${no}`; `src/models/education-plan/goalTable.js:42` đánh số liên tục; `src/services/education-plan/api/yearPlanMapper.js:161` không gửi nhãn tùy chỉnh trong rows.
- BE `src/main/java/com/carenest/dto/eduplan/YearPlanRequest.java:67` chưa có trường nhãn; `EduYearPlanServiceImpl.java:1315` tự gán số; `YearPlanDetailResponse.java:139` trả Short goalNo.
- Chỉ sửa FE sẽ mất nhãn khi tải lại từ API. Đây là đề xuất FE đã được user cho phép sửa BE ngày07/11/2026. Sau khi được phép, cập nhật plan chính đang có tại `BE:docs/plans/active/2026-11-07-school-year-team-plans.md` và spec/domain tương ứng, theo feature-spec-loop; không tự phê duyệt.

## Quyết định đã chốt
1. User 07/11: sửa nhãn tại kế hoạch năm học và kéo để tăng số theo mẫu Excel.
2. User 07/11: kế hoạch tổ cố định cây mục tiêu; lĩnh vực con giữ vàng; màu cố định giống STT.
3. EDU-09 CONFIRMED: giữ số nguyên 1..n nội bộ theo thứ tự, liên kết theo ID. Nhãn hiển thị là bổ sung, không thay số/ID nghiệp vụ.

## Làm rõ nghiệp vụ
- Actor: người có quyền sửa kế hoạch năm học hiện tại. Không mở thêm quyền, không cho sửa khi REVIEW/APPROVED.
- Flow: nhập nhãn → kéo từ góc ô qua các hàng đích → xem trước chuỗi → thả để áp dụng → Lưu bằng luồng hiện có → tải lại giữ nhãn.
- UI đề xuất: `displayLabel` nullable, tối đa 100 ký tự ở mỗi mục tiêu. Trống/null dùng MT + goalNo, không sửa dữ liệu legacy hàng loạt.
- Kéo tăng cụm số cuối (Mục tiêu 01 → Mục tiêu 02); giữ phần chữ và số 0 đầu. Chuỗi không có số sao chép nguyên chữ theo Excel. Không kéo làm đổi thứ tự/cấu trúc/ID.
- Hỗ trợ bàn phím cho cùng thao tác điền; không chỉ hỗ trợ chuột. Không thêm thư viện.
- Năm học → tổ và phiên bản mới sao chép nhãn theo mục tiêu; tổ chỉ đọc. Bản đã ban hành/snapshot giữ nguyên.
- Web consumer: form/chi tiết năm học và tổ, adapter lưu/tải, mock, bản xuất/in. Mobile hiện đọc goalNo; giữ field cũ, field nhãn là additive. Chỉ đọc APP để kiểm tác động sau khi user cho phép; không sửa APP.

### Câu hỏi mở
- Không còn câu hỏi về kiểu kéo: user chọn tự tăng số. Phần schema/API dưới đây là đề xuất kỹ thuật chờ duyệt; chưa được triển khai.

## Acceptance criteria
- AC-1 (user 07/11, bổ sung EDU-09): sửa một nhãn trong bản năm học sửa được → Lưu/tải lại giữ nhãn; goalNo/ID/liên kết không đổi.
- AC-2: kéo từ Mục tiêu 01 qua 3 mục tiêu kế tiếp → 02, 03, 04 đúng thứ tự; chỉ các ô đích đổi. Enter áp dụng/Escape hủy cho bàn phím; kéo hủy không ghi.
- AC-3: legacy không nhãn hiển thị MTn; bản tổ kế thừa nhãn, không có ô nhập hoặc tay kéo; bản in dùng nhãn đã lưu.
- AC-4: server từ chối nhãn quá giới hạn và mutation cây tổ; client cũ không gửi nhãn không được vô tình xóa nhãn đã có. Bản ban hành không đổi.

## Key decisions
| Quyết định | Đề xuất | Phương án khác | Lý do |
| --- | --- | --- | --- |
| Lưu nhãn | Thêm displayLabel nullable trên mục tiêu | Chỉ lưu localStorage | API/tải lại/thiết bị khác giữ đồng bộ |
| Liên kết | Giữ goalNo và ID; nhãn chỉ hiển thị | Thay goalNo bằng chuỗi | Tránh phá đánh giá, snapshot và consumer hiện có |
| Migration | Thêm migration mới, không sửa V85 hoặc migration đã áp | Sửa migration cũ | Tránh lặp lỗi checksum vừa gặp |

## Phases
### Phase 1 — BE contract và lưu trữ (đã được phép bắt đầu)
- Cập nhật domain/spec/plan hiện có cho delta sau khi user cho phép; công bố diff contract.
- Thêm cột nullable qua Flyway mới (chọn version trống lúc thực hiện); request/response rows bổ sung displayLabel, giới hạn 100 ký tự chỉ ở goal. Định nghĩa rõ semantics field vắng/null cho client cũ trước code.
- Service lưu, mapper trả, clone/version/annual→team bảo toàn nhãn; giữ guard cây tổ và bản ban hành. Cập nhật data dictionary/OpenAPI/cross-repo map.
- Test Maven native có PostgreSQL: lưu/tải, legacy, clone, quyền sửa/immutability, client cũ; test migration mới giữ dữ liệu cũ. Exit: test đích fail0/error0/skip0. Dừng user review theo workflow.

### Phase 2 — Web nhập nhãn và kéo điền
- Files dự kiến: GoalTables.jsx; helper điền chuỗi mới ở models/education-plan; yearPlanMapper.js; mock repository; planLevel.mjs/clone nếu cần; yearPlanDoc.js; test helpers/mapper/render.
- Thêm ô nhãn sửa được chỉ ở annual; tay kéo có preview range, commit một lần khi thả, hỗ trợ bàn phím/hủy. Tách theo goal ID, không sửa numberGoals.
- Mapper/mock/in dùng nhãn và fallback MTn; tổ nhận nhãn chỉ đọc. Không dựng UI giả có thể lưu mất dữ liệu khi BE chưa hỗ trợ.
- Exit: native Node tests tương ứng, ESLint/Prettier trên file sửa, Vite build exit0. Không mở browser nếu chưa được phép. Dừng user review.

## Test matrix
| AC | Tầng | Phase | Trạng thái |
| --- | --- | --- | --- |
| 1 | BE integration + FE adapter | 1–2 | Chưa chạy, chưa triển khai |
| 2 | Pure helper + pointer/keyboard behavior | 2 | Chưa chạy, chưa triển khai |
| 3 | Clone integration + render/export | 1–2 | Chưa chạy, chưa triển khai |
| 4 | BE request/guard + compatibility | 1 | Chưa chạy, chưa triển khai |

## Rủi ro & rollback
- Nếu dùng nhãn làm key sẽ làm sai liên kết: chỉ dùng ID hiện tại. Nhãn không thay goalNo.
- Client cũ có thể gửi toàn bộ cây mà không có field mới: bắt buộc test không làm mất nhãn.
- Rollback client về hiển thị MTn; giữ cột nullable, không xóa dữ liệu đã lưu hay sửa checksum migration. Nếu migration lỗi, rollback transaction theo Flyway; không repair mù.

## Validation log
- Bằng chứng source và consumer cụ thể đã liệt kê. EDU-09 giữ nguyên; chức năng nhãn là yêu cầu user, chưa ghi thành rule CONFIRMED của trường.
- Tách UI không đổi contract (mục 1, 3–7 của user) khỏi nhãn/schema/API này. Delta nhãn >8 file nên tách hai phase, chờ duyệt và quyền sửa BE.
- Không chạy harness/orchestrator; dùng lệnh gốc theo chỉ đạo user 07/11. Không có dependency, Git/deploy hoặc xóa dữ liệu trong phạm vi phê duyệt này.

## Progress log
### 07/11/2026 — draft chờ duyệt
- Đã xác minh contract hiện tại không lưu nhãn tùy chỉnh; ghi câu trả lời user về chuỗi tăng số. Chưa sửa BE, schema hoặc API; chưa triển khai ô sửa/kéo nhãn.
- Tiếp: user duyệt đề xuất bổ sung displayLabel và cho phép sửa BE; sau đó đồng bộ plan/domain/spec chính trước triển khai.

### 07/11/2026 — user approved toàn bộ
- User trả lời “Duyệt plan và cho phép sửa BE liên quan”, sau đó “duyệt hết k cần hỏi nữa”. Thay yêu cầu dừng xin duyệt từng phase; tiếp tục toàn bộ delta, không Git/deploy.
- Plan chính/spec/domain/data-model/contracts/tasks ở BE đã bổ sung FR019/020, AC13, T093–96. Null/omitted=giữ nhãn, blank=clear đã quyết định để tương thích client cũ.
- OpenAPI cũ có collision nested record Row/Domain/Content; dùng tên schema riêng cho request/response kế hoạch, giữ JSON contract. APP sibling không có trong workspace nên chưa kiểm chứng trực tiếp.

### 07/11/2026 — hoàn thành delta đã duyệt
- BE native64/64, FE248/248; fail/error/skip0. Lint/format/build đạt, PostgreSQL migration86 + runtime healthUP, snapshot OpenAPI đã đồng bộ.
- Callback pointer/capture/keyboard/cancel, mock old-client/TEAM guard, API null/clear, export escaping có test. Review độc lập2P2 đã sửa và kiểm lại4/4 mock, không còn finding trong phạm vi.
- Giới hạn: chưa browser/E2E/fullBE/touch thật, không sửa APP vì sibling vắng. Process BE8080 giữ nguyên; cần restart để dùng API mới. Converge delta FR019/020 không còn gap phát hiện, các gap feature012 cũ giữ nguyên. Không commit/push/deploy.
