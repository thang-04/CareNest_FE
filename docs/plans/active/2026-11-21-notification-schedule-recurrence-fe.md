---
title: Form lịch gửi: chọn lặp mỗi ngày, nhiều thứ, cách tuần, ngày bắt đầu/kết thúc (FE)
status: draft        # chờ user duyệt plan và hoàn tất phần BE; chưa code
owner: thangnd
jira: G94-288 / FE-FEAT-55   # chờ xác nhận Jira riêng, cùng câu hỏi mở với plan BE
branch: feature/G94-288-FE-FEAT-55-school-notifications
modules: [notification]
rules: []            # rule PAR-10, SCH-05 do BE sở hữu; xem plan BE
risk: medium         # phụ thuộc hợp đồng BE chưa có; mock FE phải khớp BE
created: 2026-11-21
updated: 2026-11-21
---
# Form lịch gửi — kiểu lặp mới (phần web)

Làn L: đổi hợp đồng gọi API và nhiều màn. Plan chính ở BE: `CareNest_BE: docs/plans/active/2026-11-21-announcement-schedule-recurrence.md` (hợp đồng API, rule PAR-10, AC phía BE). Plan này chỉ phần client, làm **sau khi BE Phase 2 được duyệt**.

## Context
Hiện form lịch gửi chỉ có Tần suất (Hằng tuần/Hằng tháng), một thứ hoặc một ngày, giờ gửi, công tắc bật (`AnnouncementScheduleFields.jsx`, `AnnouncementForm.jsx:21-27,105-108`). Nhãn lặp ở `scheduleRepeatLabel` (`announcementUi.jsx:13-16`). Thẻ Tóm tắt, danh sách Lịch gửi và trang chi tiết lịch đọc các trường cũ.

## Quyết định đã chốt
1. Kiểu lặp, ngày bắt đầu/kết thúc, gửi cả ngày nghỉ — user, 2026-11-21 (xem plan BE).
2. Phần web làm sau khi BE xong, không làm FE trước backend — theo quy ước repo (AGENTS.md: BE sở hữu hợp đồng).

## Làm rõ nghiệp vụ
- **Ảnh hưởng:** `/announcement-schedules/new`, `/announcement-schedules/:id`, `/announcement-schedules/:id/edit`, tab Lịch gửi; mock `src/mocks/announcementMockRepository.js` và `src/services/announcement/mock/` phải theo đúng hợp đồng BE (mock là BE giả, chỉ chứa luật dẫn rule ID).

### Câu hỏi mở
- [ ] Nhãn hiển thị cho từng kiểu, ví dụ "Mỗi ngày", "Thứ 2, 4, 6 hằng tuần", "Mỗi 2 tuần: Thứ 2": user duyệt trên màn thật.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |

## Acceptance criteria
- **AC-1:** Given ô Tần suất, When mở form, Then có 3 lựa chọn: Mỗi ngày, Hằng tuần, Hằng tháng.
- **AC-2:** Given Hằng tuần, When chọn, Then hiện dãy nút bấm T2…CN chọn nhiều ngày (ít nhất một) và ô "Lặp mỗi" 1 đến 4 tuần; thiếu ngày thì báo lỗi dưới ô.
- **AC-3:** Given Hằng tháng, Then giữ ô "Ngày trong tháng" như cũ.
- **AC-4:** Given mọi kiểu, Then có Giờ gửi, Ngày bắt đầu và Ngày kết thúc (tùy chọn; kết thúc không trước bắt đầu) và công tắc Bật lịch gửi.
- **AC-5:** Given gửi form, Then request mang `frequency`, `daysOfWeek`, `intervalWeeks`, `dayOfMonth`, `startDate`, `endDate` đúng theo kiểu; lỗi `fieldErrors` của BE hiện dưới đúng ô.
- **AC-6:** Given thẻ Tóm tắt, danh sách và trang chi tiết, Then đọc nhịp lặp bằng một hàm nhãn chung (ví dụ "Thứ 2, 4, 6 hằng tuần, 08:00", "Mỗi 2 tuần: Thứ 2", "Mỗi ngày"), kèm khoảng ngày khi có; lịch đã hết hạn hiện "Đã hết hạn".
- **AC-7:** Given sửa lịch cũ (chỉ có `dayOfWeek`), Then form hiện đúng một thứ được chọn.
- **AC-8:** Given lịch hết hạn, When bật lại mà `endDate` đã qua, Then hiện lỗi BE trả, không đổi trạng thái.

## Phases
### Phase 1 — Mô hình nhãn, mock theo hợp đồng
- Files: M `announcementUi.jsx` (`scheduleRepeatLabel`) · C `src/utils/announcement/scheduleRecurrence.mjs` (chuẩn hóa dữ liệu, nhãn, kiểm form) · M `src/mocks/announcementMockRepository.js` · M `src/services/announcement/mock/announcementMockRepository.js` · M `tests/notifications/*` · C `tests/notifications/schedule-recurrence.test.mjs`
- Tests: AC-6, AC-7, AC-5 (dữ liệu gửi).
- Exit: eslint thư mục thông báo sạch; `npx vite build` built; `tests/menu`, `tests/hardening`, `tests/notifications` pass; `node scripts/check-design.mjs` ok.
- **Dừng chờ user review.**

### Phase 2 — Form, Tóm tắt, danh sách, trang chi tiết
- Files: M `AnnouncementScheduleFields.jsx` · M `AnnouncementForm.jsx` · M `AnnouncementSummary.jsx` · M `AnnouncementSchedulesPage.jsx` · M `AnnouncementScheduleDetailPage.jsx` · M `announcement.css`
- Tests: AC-1…AC-4, AC-8; thử trên dev server.
- Exit: như Phase 1.
- **Dừng chờ user review.**

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| FE ra trước BE | Form gửi trường BE chưa nhận | Chỉ làm sau khi BE được duyệt; hợp đồng theo plan BE | Giữ code sau cờ chưa nối |
| Mock lệch BE | Demo khác thật | Mock dẫn rule ID, kiểm bằng test theo hợp đồng | Sửa mock |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] 2 phase, ≤12 file
- [ ] Tự review lần cuối sau khi BE xong

## Progress log

### 2026-11-22 — Phase 1 + 2 (chờ review; gộp hai phase vì Phase 1 chưa có gì để xem)
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui`. Làm theo yêu cầu "tiếp tục ở web" sau khi BE Phase 1–2 xong ở worktree `../CareNest_BE-notif-repeat` (chưa chạy migration/openapi trên Docker).
- Làm: `utils/announcement/scheduleRecurrence.mjs` (mới): kiểu lặp, chuẩn hóa lịch hiện có (kể cả lịch cũ chỉ có `dayOfWeek`), dữ liệu gửi BE (chỉ trường của kiểu đã chọn, ngày trống null, không gửi `dayOfWeek` cũ), kiểm ô nhập theo tên trường BE, nhãn nhịp lặp ("Mỗi ngày", "Thứ 2, 4, 6 hằng tuần", "Mỗi 2 tuần: Thứ 2", "Ngày 5 hằng tháng") và khoảng ngày. `AnnouncementScheduleFields`: Lặp lại (Mỗi ngày/Hằng tuần/Hằng tháng), Số tuần, nhóm viên chọn T2…CN, Ngày bắt đầu/kết thúc (`DateInput`), ghi chú "Thông báo vẫn được gửi vào ngày nghỉ", công tắc bật. `AnnouncementForm`: kiểm cài đặt lặp trước khi gọi xem trước, lỗi dưới từng ô (gộp lỗi BE). Thẻ Tóm tắt, danh sách Lịch gửi (nhãn + khoảng ngày) và trang chi tiết (Khoảng ngày) dùng nhãn chung. Mock (BE giả) theo hợp đồng PAR-10 mới: chuẩn hóa kiểu lặp, lỗi `details` theo trường, từ chối bật lịch quá ngày kết thúc. Sửa theo góp ý: nhóm "Gửi cho vai trò" và các lựa chọn thứ thành viên chọn cùng cao 40px, ô tích và chữ căn giữa, nhãn ở trên, trạng thái chọn nổi bật.
- Verify: eslint (pages, components, utils, mocks thông báo) → sạch · `node scripts/check-design.mjs` → ok (lần đầu fail vì `todayIso` tự viết, đã dùng `todayInput`) · `tests/menu` + `tests/hardening` + `tests/notifications` → pass hết · `npx vite build` → built. Thử trên trình duyệt (mock): form lịch hiện đủ ô; bỏ hết thứ rồi gửi → "Kiểm tra lại cài đặt lặp bên dưới." và "Chọn ít nhất một thứ trong tuần."; tạo lịch Thứ 2, 4, 6 mỗi 2 tuần đến 31/12/2027 → danh sách "Mỗi 2 tuần: Thứ 2, 4, 6 / Từ 22/11/2026 đến 31/12/2027".
- Khác plan: không tự tính "Đã hết hạn" ở web (chỉ hiện khoảng ngày và trạng thái BE trả, theo nguyên tắc UI không tự tính nghiệp vụ); gộp Phase 1 và 2. Chưa thử với BE thật.
