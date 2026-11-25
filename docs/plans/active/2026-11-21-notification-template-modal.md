---
title: Modal tạo mẫu thông báo: hai cột có xem trước, nhập từ tệp, nối với lịch gửi
status: in-progress  # user duyệt; phần triển khai thuộc G94-288
owner: thangnd
jira: G94-288 / FE-FEAT-55   # theo plan `2026-11-21-notification-settings-hub.md`
branch: feature/G94-288-FE-FEAT-55-school-notifications
modules: [notification]
rules: []            # chỉ đổi giao diện và nhập liệu phía web; không đổi contract BE
risk: medium         # thêm 1 dependency (đọc .docx) và ghi nhiều mẫu liên tiếp từ Excel
created: 2026-11-21
updated: 2026-11-21
---
# Modal tạo mẫu thông báo — phần 1 (chỉ ở web)

Làn L (`.ai/workflows/plan-change.md`): thêm dependency, >8 file. Tiếp nối `docs/plans/active/2026-11-21-notification-settings-hub.md`.
Hai phần còn lại cần repo khác nên có plan riêng (xem "Ngoài phạm vi").

## Context
User phản hồi: modal Tạo mẫu còn sơ sài, thiếu nhập từ tệp, ô nội dung chỉ là chữ thường, và cấu hình thông báo thiếu lặp theo mỗi ngày, nhiều thứ…
Hiện trạng và ràng buộc đã kiểm:
- Modal mẫu: `AnnouncementTemplatesPage.jsx` (`Modal size="lg"`, một cột, 4 ô).
- Hợp đồng BE của mẫu: `AnnouncementTemplateRequest(name, title, body, campusId)`; `body` là chuỗi chữ thường, BE không lọc HTML (`BE:src/main/java/com/carenest/dto/announcement/AnnouncementTemplateRequest.java`).
- BE **không thay biến** `{...}` trong mẫu và thông báo trường (không có đoạn render trong `service/announcement`). Chỉ **Quy tắc thông báo** có biến, do `NotificationRuleCatalog` định nghĩa (`{tenTre}`, `{ngay}`, `{gio}`, `{lop}`, `{tuNgay}`, `{denNgay}`, `{nguoiDon}`, `{tuan}`), biến lạ bị từ chối khi lưu (`NotificationRuleServiceImpl.java:97-98`).
- Lặp lại: `ScheduleFrequency` chỉ có `WEEKLY`, `MONTHLY`, mỗi lịch một `dayOfWeek` hoặc `dayOfMonth` (`BE:.../ScheduleFrequency.java`, `AnnouncementScheduleRequest.java`).
- Có sẵn `ImportDialog` và thư viện `read-excel-file` (`package.json`), nên nhập Excel không cần thêm gì.

## Quyết định đã chốt
1. Bố cục mẫu: **modal hai cột** (A), bên phải xem trước — user, 2026-11-21.
2. Trình soạn có định dạng, lặp lại (mỗi ngày, nhiều thứ, cách tuần, ngày bắt đầu/kết thúc) và sửa BE: user chọn làm, tách thành plan riêng — user, 2026-11-21.
3. Nhập từ tệp: `.txt`, Excel nhiều mẫu, và `.docx` kèm **thêm thư viện** — user, 2026-11-21.
4. Bỏ ô "chèn biến" ở mẫu thông báo vì BE không thay biến; chỉ làm chip chèn biến ở tab Quy tắc — theo kiểm tra BE, user hỏi về biến 2026-11-21.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor Hiệu trưởng và Phó hiệu trưởng; outcome tạo và nhập mẫu nhanh, thấy trước thông báo, đi từ mẫu sang lịch gửi; không đổi rule BE.
- **Ảnh hưởng:** module `notification`; `/notification-settings` (tab Mẫu, tab Quy tắc); `/announcement-schedules/new`; dữ liệu mẫu cũ không đổi.

### Câu hỏi mở
- [x] Task Jira: dùng `G94-288` — user đã chốt trong plan Cấu hình thông báo.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Task Jira | Dùng `G94-288` | User | 2026-11-21 | Plan Cấu hình thông báo |

## Dependency mới (đã được user đồng ý thêm)
| Tên | Dùng để | Giấy phép | Dung lượng | Cách nạp |
| --- | --- | --- | --- | --- |
| `mammoth` 1.13.0 | Lấy chữ thô từ tệp `.docx` | BSD-2-Clause | ~1,6 MB giải nén, kéo theo `jszip` | `import()` động, chỉ tải khi người dùng chọn tệp Word |

Quyết định mới của user ngày 2026-11-22: khi đã có trình soạn định dạng, nhập `.docx` giữ đúng bộ định dạng được hỗ trợ. Mục `extractRawText` trong quyết định/Progress log bên dưới mô tả giai đoạn trước; implementation tiếp theo dùng `convertToHtml` và lọc HTML. Xem `2026-11-22-announcement-rich-body-fe.md`.

Cài bằng `npm install mammoth --legacy-peer-deps` (repo đang buộc `--legacy-peer-deps` vì `vite@8` xung đột peer với `@vitejs/plugin-react@4`); chỉ đổi `package.json` và `package-lock.json`.

## Acceptance criteria
- **AC-1:** Given Hiệu trưởng mở modal Tạo/Sửa/Xem mẫu ≥768px, When modal mở, Then rộng cỡ `xl`, hai cột: trái là form (Tên mẫu cạnh Phạm vi, Tiêu đề, Nội dung), phải là xem trước dạng thông báo; <768px xem trước nằm dưới form.
- **AC-2:** Given đang nhập Tiêu đề hoặc Nội dung, When gõ, Then xem trước đổi theo, hiện đếm `n / 150` và `n / 4.000`; chữ xuống dòng được giữ.
- **AC-3:** Given nút "Nhập từ tệp" trong modal, When chọn `.txt` (UTF-8) hoặc `.docx`, Then nội dung điền vào ô Nội dung; ô đang có chữ thì hỏi xác nhận ghi đè; tệp rỗng, quá 4.000 ký tự hoặc sai định dạng thì báo lỗi trong modal, không đổi ô nội dung.
- **AC-4:** Given danh sách mẫu, When bấm "Nhập từ Excel", Then `ImportDialog` cho tải tệp mẫu (cột Tên mẫu, Phạm vi, Tiêu đề, Nội dung), xem trước từng dòng hợp lệ/lỗi kèm lý do (thiếu ô bắt buộc, vượt giới hạn, điểm trường không có, Phó hiệu trưởng thiếu điểm trường), tối đa 50 dòng; xác nhận thì tạo các dòng hợp lệ lần lượt và báo "đã tạo x, lỗi y".
- **AC-5:** Given dòng mẫu của Hiệu trưởng, When mở menu "⋯", Then có "Tạo lịch gửi từ mẫu này" mở `/announcement-schedules/new?templateId=<id>` với mẫu đã chọn sẵn và tiêu đề, nội dung điền sẵn; Phó hiệu trưởng không thấy mục này.
- **AC-6:** Given modal sửa Quy tắc, When bấm một chip biến, Then biến `{tên}` chèn đúng chỗ con trỏ trong ô đang chọn (Tiêu đề hoặc Nội dung), và xem trước thay bằng giá trị mẫu cố định; chỉ các biến BE trả về.
- **AC-7:** Hợp đồng gọi API của mẫu không đổi (`name, title, body, campusId`).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Nhập nhiều mẫu | Tạo tuần tự từng mẫu qua API hiện có | Thêm API hàng loạt ở BE | Không đổi BE ở phần này; chấp nhận tạo dở nếu mạng lỗi, báo rõ dòng nào lỗi |
| Đọc `.docx` | `mammoth.extractRawText`, nạp động | Đọc XML tay bằng `jszip` | Tin cậy hơn, đã tính giấy phép và dung lượng |
| Nội dung vượt 4.000 ký tự | Từ chối và báo số ký tự | Tự cắt | Không âm thầm mất chữ |

## Phases
### Phase 1 — Modal hai cột, xem trước, đếm ký tự, chip biến Quy tắc
- Files: C `src/components/announcement/AnnouncementTemplateForm.jsx` · C `src/components/announcement/AnnouncementPreview.jsx` · M `AnnouncementTemplatesPage.jsx` · M `NotificationRulesPage.jsx` · M `src/styles/modules/announcement.css` · C `tests/notifications/template-modal.test.mjs`
- Steps: 1. Tách form mẫu khỏi trang thành component. 2. Lưới hai cột trong `Modal size="xl"`. 3. Xem trước chỉ hiển thị chữ đã nhập. 4. Chip biến bấm được ở modal Quy tắc (AC-6).
- Tests: AC-1, AC-2, AC-6, AC-7 → `template-modal.test.mjs`.
- Exit: `npx eslint` thư mục thông báo sạch; `npx vite build` built; `tests/menu`, `tests/hardening`, `tests/notifications` đều pass; `node scripts/check-design.mjs` ok.
- **Dừng chờ user review.**

### Phase 2 — Nhập nội dung từ `.txt` và `.docx`
- Files: C `src/utils/announcement/readTemplateFile.mjs` · M `AnnouncementTemplateForm.jsx` · M `package.json` · M `package-lock.json` · C `tests/notifications/template-file.test.mjs`
- Steps: 1. Cài `mammoth` (đã được đồng ý). 2. Hàm đọc tệp: kiểm đuôi và dung lượng, giải mã UTF-8, `.docx` nạp động. 3. Nút "Nhập từ tệp" và hộp xác nhận ghi đè.
- Tests: AC-3 → `template-file.test.mjs` (tệp rỗng, quá dài, sai đuôi, `.txt` hợp lệ).
- Exit: như Phase 1; `git diff package.json` chỉ thêm `mammoth`.
- **Dừng chờ user review.**

### Phase 3 — Nhập Excel nhiều mẫu và "Tạo lịch gửi từ mẫu này"
- Files: C `src/components/announcement/TemplateImportDialog.jsx` · C `src/utils/announcement/templateImport.mjs` · M `AnnouncementTemplatesPage.jsx` · M `AnnouncementScheduleEditPage.jsx` · M `AnnouncementForm.jsx` · C `tests/notifications/template-import.test.mjs`
- Steps: 1. Tệp mẫu và đọc `read-excel-file`. 2. Kiểm hợp lệ từng dòng. 3. Tạo tuần tự, gom kết quả. 4. Đọc `?templateId=` ở form lịch gửi.
- Tests: AC-4, AC-5 → `template-import.test.mjs`.
- Exit: như Phase 1.
- **Dừng chờ user review.**

## Ngoài phạm vi (cần plan riêng, nhiều repo)
- **Lặp lại đúng nghĩa** (mỗi ngày, nhiều thứ, cách tuần, ngày bắt đầu/kết thúc): sửa BE (`ScheduleFrequency`, migration, `AnnouncementScheduleCalculator`, DTO, rule PAR-10, test) rồi form web. Plan chính đặt ở `BE:docs/plans/active/`. Cần user cho phép sửa `CareNest_BE` rõ trong tin nhắn lúc bắt đầu.
- **Biến theo người nhận** cho mẫu và thông báo trường: để sau, ngoài phạm vi G94-288; user chốt 2026-11-22. Cần quyết định riêng về tên biến, bao gồm có cho dùng `{phone}` hay không, trước khi lập plan BE.
- **Trình soạn có định dạng:** thư viện (CKEditor 5 hoặc khác, kèm giấy phép), BE lọc HTML an toàn, ứng dụng điện thoại hiển thị định dạng, dữ liệu cũ. Làm sau cùng.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1, AC-2, AC-6, AC-7 | — | `template-modal.test.mjs` | 1 | chưa chạy |
| AC-3 | — | `template-file.test.mjs` | 2 | chưa chạy |
| AC-4, AC-5 | — | `template-import.test.mjs` | 3 | chưa chạy |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Tạo dở khi nhập Excel (mạng lỗi giữa chừng) | Một số mẫu có, một số không | Báo từng dòng thành công/lỗi, cho tải lại danh sách lỗi | Xóa mẫu thủ công trong danh sách |
| `mammoth` làm nặng gói chính | Tải trang chậm | Nạp động, chỉ khi chọn `.docx` | Gỡ dependency, ẩn lựa chọn `.docx` |
| Tệp Word có bảng, ảnh | Chữ lấy ra thiếu | Chỉ lấy chữ thô, báo trước ở hộp nhập | — |

## Validation log
- [x] Khẳng định về code có `file:line` hoặc đường dẫn BE cụ thể (mục Context)
- [x] Không đổi contract BE; không có consumer mới ngoài `announcements.createTemplate`
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] 3 phase, 14 file vượt 8 file; giữ một plan vì ba phase cùng một luồng và dừng review riêng
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [ ] Tự review lần cuối sau khi trả lời câu hỏi mở

## Progress log
### 2026-11-21 — Phase 1 (chờ review)
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui`
- Làm: modal Mẫu dùng `AnnouncementTemplateForm` (mới) trong `Modal size="xl"`: trái Tên mẫu cạnh Phạm vi, Tiêu đề, Nội dung; phải `AnnouncementPreview` (mới); đếm ký tự `n / 150`, `n / 4.000`; <768px xem trước xuống dưới. Modal sửa Quy tắc (loại sửa được) cũng hai cột: chip biến là nút, bấm chèn đúng chỗ con trỏ của ô đang chọn gần nhất (mặc định Nội dung), vượt giới hạn thì báo lỗi và không chèn; xem trước thay biến bằng giá trị mẫu cố định (`utils/announcement/templateText.mjs`). Mẫu thông báo không có chip biến vì BE không thay biến.
- Verify: `npx eslint` (components, pages, utils thông báo) → sạch · `npx prettier` các file mới/đã sửa → sạch · `npx vite build` → built · `node scripts/check-design.mjs` → `check-design: ok` · `tests/menu` + `tests/hardening` + `tests/notifications` → tests 385, pass 385, fail 0 (có `template-modal.test.mjs` mới, 5 test). Đã chạy dev server mock và thử trên trình duyệt: modal Tạo mẫu hai cột, xem trước đổi theo chữ gõ; modal Quy tắc "Trẻ đã được đón": bấm `{gio}` chèn tại con trỏ, caret nhảy sau biến, focus về ô nội dung, xem trước đổi thành `16:30`. Chưa chạy `npm run verify` đầy đủ; chưa xem ở 768px và 360px.
- Khác plan: không có. Biến theo người nhận được để ngoài phạm vi và sẽ cần xác nhận riêng trước plan BE.
- Tiếp: Phase 2 (nhập `.txt` và `.docx`, cài `mammoth`) sau khi user duyệt Phase 1.

### 2026-11-21 — Phase 2 (chờ review)
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui`
- Làm: cài `mammoth@1.13.0` bằng `npm install mammoth@1.13.0 --legacy-peer-deps` (`package.json` thêm đúng một dòng `"mammoth": "^1.13.0"`; `package-lock.json` thêm 23 gói đi kèm, giấy phép MIT/BSD, `jszip` hai giấy phép MIT OR GPL-3.0-or-later; một gói chuyển từ dev sang dependency thường). `readTemplateFile.mjs` (mới): nhận `.txt` UTF-8 (giải mã nghiêm, BOM, CRLF) và `.docx` (chỉ chữ thô), tối đa 5 MB, từ chối sai đuôi, rỗng, không phải UTF-8, vượt 4.000 ký tự; `mammoth` nạp bằng `import()` động. Form mẫu: nút "Nhập từ tệp" (ẩn ở chế độ xem), nội dung đang có thì hỏi `ConfirmationModal` trước khi thay, tệp lỗi chỉ hiện lỗi và không đổi ô nội dung.
- Verify: `npx eslint` (components, utils thông báo) → sạch · prettier → sạch · `npx vite build` → built; `mammoth` nằm chunk riêng ~308 KB, không có trong gói chính · `node scripts/check-design.mjs` → ok · `tests/menu` + `tests/hardening` + `tests/notifications` → tests 391, pass 391, fail 0 (`template-file.test.mjs` mới, 6 test, gồm đọc `.docx` thật bằng mammoth). Thử trên trình duyệt (dev server mock): nạp `.docx` tự tạo → ô nội dung điền đúng, có dấu; nạp `.txt` khi ô đã có chữ → hộp xác nhận, ô giữ nguyên tới khi bấm "Thay thế"; nạp `.pdf` → "Chỉ nhận tệp .txt hoặc .docx.". Tệp được nạp bằng script (`DataTransfer`), chưa chọn qua hộp chọn tệp của hệ điều hành. Sửa một lỗi phát hiện khi thử: lỗi cũ còn lại sau khi nhập thành công.
- Khác plan: không có. Chưa chạy `npm run verify` đầy đủ.
- Tiếp: Phase 3 (nhập Excel nhiều mẫu, "Tạo lịch gửi từ mẫu này") sau khi user duyệt Phase 2.

### 2026-11-21 — Phase 3 (chờ review)
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui`
- Làm: `templateImport.mjs` (mới, thuần): đọc dòng Excel, kiểm tiêu đề cột (không phân biệt dấu, hoa thường), tối đa 50 dòng, mỗi dòng kiểm Tên mẫu ≤100, Tiêu đề ≤150, Nội dung ≤4.000, Phạm vi (trống hoặc "Toàn trường" = toàn trường, Phó hiệu trưởng bắt buộc điểm trường, tên điểm trường khớp không phân biệt dấu), dòng lỗi ghi số dòng và lý do; `createTemplatesSequentially` tạo lần lượt, một dòng lỗi không dừng các dòng sau. `TemplateImportDialog.jsx` (mới) dùng `ImportDialog`: tải tệp mẫu qua `exportWithPreview` (có xem trước), xem trước dòng hợp lệ/lỗi, nút "Tạo n mẫu", báo kết quả "đã tạo x, chưa tạo y" kèm lý do từng dòng; `read-excel-file` nạp động. Trang Mẫu: nút "Nhập từ Excel" cạnh "Tạo mẫu thông báo"; menu "⋯" có "Tạo lịch gửi từ mẫu này" (chỉ Hiệu trưởng) mở `/announcement-schedules/new?templateId=<id>`; `AnnouncementForm` nhận `initialTemplateId`, chọn sẵn mẫu và điền tiêu đề, nội dung (chỉ khi tạo mới; mẫu không có thì báo lỗi).
- Verify: `npx eslint` thư mục thông báo → sạch · prettier → sạch · `npx vite build` → built · `node scripts/check-design.mjs` → ok (lần đầu fail vì `downloadXlsx` thẳng, đã đổi sang `exportWithPreview`) · `tests/menu` + `tests/hardening` + `tests/notifications` → tests 399, pass 399, fail 0 (`template-import.test.mjs` mới, 8 test, gồm vòng đọc lại tệp mẫu tải về bằng `read-excel-file`). Thử trên trình duyệt (dev server mock, Hiệu trưởng): nạp `.xlsx` tự tạo 3 dòng → "2 dòng hợp lệ, 1 dòng lỗi", dòng 4 báo "thiếu Tiêu đề thông báo; không có điểm trường …"; bấm "Tạo 2 mẫu" → toast "Đã tạo 2 mẫu.", hộp đóng, danh sách có 2 mẫu; menu "⋯" → "Tạo lịch gửi từ mẫu này" → form lịch gửi mở với mẫu đã chọn, tiêu đề, nội dung và thẻ Tóm tắt điền sẵn. Tệp nạp bằng script, chưa chọn qua hộp chọn tệp của hệ điều hành; chưa thử vai trò Phó hiệu trưởng và trường hợp BE từ chối một dòng. Hai mẫu thử nằm trong dữ liệu mock của trình duyệt. Chưa chạy `npm run verify` đầy đủ.
- Khác plan: không có.
- Tiếp: user xem và quyết định commit; phần lặp lại (BE) và trình soạn có định dạng cần plan riêng.
