---
title: Trình soạn thảo cho nội dung thông báo, mẫu và lịch gửi (FE)
status: in-progress   # FE Phase 1 và 2 đã dựng, chờ user review; chưa commit
owner: thangnd
jira: G94-288 / FE-FEAT-55   # chờ xác nhận Jira riêng, cùng câu hỏi mở với plan BE
branch: feature/G94-288-FE-FEAT-55-school-notifications
modules: [notification]
rules: []            # rule do BE sở hữu; xem plan BE
risk: high           # hiển thị HTML từ người dùng (XSS), thêm 2 dependency, đổi 5 màn
created: 2026-11-22
updated: 2026-11-22
---
# Trình soạn thảo nội dung (phần web)

Plan chính ở BE: `CareNest_BE: docs/plans/active/2026-11-22-announcement-rich-body.md` (hợp đồng `bodyHtml`, danh sách thẻ cho phép, AC phía BE). Plan này chỉ phần client và làm **sau khi BE Phase 2 được duyệt**.

## Context
Ô "Nội dung" của form soạn là `TextAreaField` chữ thường: `AnnouncementForm.jsx` (Soạn thông báo và Lịch gửi), `AnnouncementTemplateForm.jsx` (Mẫu). Nội dung được hiển thị bằng `.announcement-body` (`white-space: pre-wrap`) ở `AnnouncementPreview.jsx`, chi tiết thông báo, chi tiết lịch gửi; thông báo trong chuông và hộp thư dùng `notification.body` chữ thường.

## Quyết định đề xuất (chờ user duyệt)
1. **Thư viện soạn thảo: Tiptap** (`@tiptap/react` + các extension cần thiết, MIT) — user chốt 2026-11-22 sau khi xem điều kiện giấy phép kép GPL/thương mại của CKEditor 5 (không dùng). Tiptap không có giao diện dựng sẵn nên thanh công cụ ghép bằng `Button` và icon của dự án để đúng `UI_CARD.md`.
2. **Lọc khi hiển thị: DOMPurify** (`MPL-2.0 OR Apache-2.0`), dùng một component `RichBody` duy nhất để hiển thị mọi `bodyHtml`.
3. Thanh công cụ tối thiểu: Đậm, Nghiêng, Gạch chân, Danh sách chấm, Danh sách số, Liên kết, Hoàn tác/Làm lại. Extension chỉ gồm: Document, Paragraph, Text, HardBreak, Bold, Italic, Underline, BulletList, OrderedList, ListItem, Link, History (không dùng gói starter-kit để không kéo thêm định dạng ngoài bộ cho phép như tiêu đề, trích dẫn, mã). Dán từ Word/web: Tiptap tự bỏ phần ngoài các extension đã nạp.
4. Soạn thảo tải **động** (`import()`), chỉ nạp khi mở form có ô Nội dung, không làm nặng gói chính.
5. Quy tắc thông báo tự động giữ ô chữ thường (có biến).

### Dependency mới (chờ user cho phép; số liệu từ `npm view` ngày 2026-11-22)
| Gói | Dùng để | Giấy phép | Phiên bản | Dung lượng giải nén |
| --- | --- | --- | --- | --- |
| `@tiptap/react`, `@tiptap/core`, `@tiptap/pm` | Trình soạn thảo | MIT | 3.35.0 | ~0,6 MB, ~3,3 MB, ~15 KB (kéo thêm ProseMirror) |
| `@tiptap/extension-bold`, `-underline`, `-link`, `-list` (và `-italic`) | Định dạng trong bộ cho phép | MIT | 3.35.0 | ~27 KB, ~24 KB, ~188 KB, ~1,2 MB |
| `dompurify` | Lọc HTML khi hiển thị | MPL-2.0 OR Apache-2.0 | 3.4.18 | ~1,6 MB |
Dung lượng giải nén chỉ là kích thước gói cài đặt; bản dựng thật đo ở Phase 1. Cài bằng `npm install … --legacy-peer-deps` (repo đang buộc cờ này). BE cần thêm `jsoup` (MIT) cho bộ lọc, ghi ở plan BE.

## Làm rõ nghiệp vụ
### Câu hỏi mở
(Dùng chung với plan BE: thư viện lọc ở Java, Jira. Đã chốt: Tiptap (MIT), bộ định dạng tối thiểu, phạm vi Soạn/Mẫu/Lịch gửi, ứng dụng để sau.)
- [x] Cho phép thêm dependency: user duyệt 2026-11-22 ("Duyệt, làm FE"); đã cài đúng danh sách ở bảng dưới (3.35.0 và dompurify 3.4.18, khớp `npm view`).
- [x] Nhập từ tệp `.docx` giữ các định dạng trình soạn hỗ trợ; user chốt 2026-11-22. Dùng `mammoth.convertToHtml`, lọc HTML trước khi nạp vào trình soạn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Nhập Word | Giữ đậm, nghiêng, gạch chân, danh sách, liên kết; bỏ định dạng khác | User | 2026-11-22 | Plan FE và `school-notifications.md` |

## Acceptance criteria
- **AC-1:** Given form Soạn thông báo, Mẫu hoặc Lịch gửi, When mở ô Nội dung, Then là trình soạn thảo có thanh công cụ đúng bộ định dạng, có đếm ký tự chữ thường `n / 4.000`, có `required` và lỗi dưới ô như ô thường.
- **AC-2:** Given đang soạn, When gửi, Then request mang `bodyHtml` (HTML của trình soạn) và `body` rỗng hoặc không gửi; lỗi `body` do BE trả hiện dưới ô.
- **AC-3:** Given dữ liệu cũ chỉ có `body` chữ thường, When mở sửa, Then nội dung hiện trong trình soạn (xuống dòng thành đoạn) và lưu lại không mất chữ.
- **AC-4:** Given xem trước (modal Mẫu, form) và các trang chi tiết, When hiển thị, Then dùng `RichBody` (lọc DOMPurify, liên kết mở tab mới có `rel`), thiếu `bodyHtml` thì hiển thị `body` chữ thường như cũ.
- **AC-5:** Given dán nội dung từ Word hoặc web, Then chỉ giữ định dạng nằm trong bộ cho phép (đoạn, đậm, nghiêng, gạch chân, danh sách, liên kết).
- **AC-6:** Given nhập `.txt`, Then chữ thường vào trình soạn; Given nhập `.docx`, Then chỉ định dạng được hỗ trợ còn lại sau lọc và có xem trước.
- **AC-7:** Given bàn phím, Then thanh công cụ dùng Tab/Enter, nút có `aria-label` và `aria-pressed`, trình soạn có nhãn `Nội dung`.
- **AC-8:** Given mở trang không có ô Nội dung, Then thư viện soạn thảo không nằm trong gói tải ban đầu.

## Phases (FE)
### Phase 1 — Thành phần `RichBody` và `RichTextEditor`
- Files: C `src/components/announcement/RichBody.jsx` · C `src/components/announcement/RichTextEditor.jsx` · C `src/utils/announcement/richText.mjs` (đổi chữ thường ⇄ đoạn HTML, đếm ký tự chữ thường) · M `package.json`, `package-lock.json` (Tiptap, DOMPurify, sau khi user duyệt) · M `announcement.css` · C tests
- Tests: AC-1, AC-3, AC-4, AC-7, AC-8.
- Exit: eslint sạch; `npx vite build` built và chunk của trình soạn tách riêng; `node scripts/check-design.mjs` ok; test thông báo pass.
- **Dừng chờ user review.**

### Phase 2 — Gắn vào form và các nơi hiển thị
- Files: M `AnnouncementForm.jsx` · M `AnnouncementTemplateForm.jsx` · M `AnnouncementPreview.jsx` · M `AnnouncementDetailPage.jsx` · M `AnnouncementScheduleDetailPage.jsx` · M `AnnouncementSummary.jsx` (nếu hiện nội dung) · M `src/mocks/announcementMockRepository.js` (nhận, lọc cơ bản và trả `bodyHtml` như BE giả) · M `readTemplateFile.mjs` (theo câu hỏi mở `.docx`) · M tests
- Tests: AC-2, AC-5, AC-6.
- Exit: như Phase 1 + thử trên trình duyệt: gõ, đậm, danh sách, liên kết, dán từ Word.
- **Dừng chờ user review.**

## Ứng dụng điện thoại
Không thuộc plan này; xem mục "Ứng dụng" của plan BE.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Hiển thị HTML chưa lọc | XSS | Chỉ hiển thị qua `RichBody` (DOMPurify), cấm `dangerouslySetInnerHTML` ở nơi khác (thêm test quét mã) | Hiển thị `body` chữ thường |
| Trình soạn nặng | Tải trang chậm | Nạp động, đo kích thước chunk | Quay về ô chữ thường |
| Mất định dạng khi sửa dữ liệu cũ | Người dùng mất bố cục | Dữ liệu cũ chỉ có chữ thường, đổi xuống dòng thành đoạn | — |
| FE ra trước BE | Gửi `bodyHtml` BE chưa nhận | Chỉ làm sau khi BE duyệt | Giữ cờ chưa nối |

## Validation log
- [x] Khẳng định về code có `file:line` hoặc tên file cụ thể
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] 2 phase, ≤12 file mỗi phase
- [ ] Còn câu hỏi mở nên chưa `approved`

## Progress log
### 2026-11-22 — Phase 1 (chờ review)
- Commit: chưa commit; worktree `../CareNest_FE-notif-ui` (detached tại origin/feature/G94-288-FE-FEAT-55-school-notifications).
- Làm: cài `@tiptap/react`, `core`, `pm`, `extension-document/paragraph/text/hard-break/bold/italic/underline/link/list`, `@tiptap/extensions` (3.35.0, MIT) và `dompurify` 3.4.18 bằng `npm install --legacy-peer-deps` (cảnh báo `core-js` postinstall bị chặn là sẵn có, không ảnh hưởng). Thêm icon `Bold, Italic, Underline, Redo2, Unlink` vào `icons.js`. Mới: `src/utils/announcement/richText.mjs` (`textToHtml` thoát ký tự, tách đoạn; `normalizeEditorHtml`; `estimateTextLength`; `normalizeLinkUrl` chỉ https/mailto/tel, thiếu giao thức thì thêm `https://` hoặc `mailto:`; danh sách thẻ/thuộc tính/giao thức hiển thị), `RichBody.jsx` (DOMPurify với đúng danh sách BE cho phép, ép `target="_blank"` + `rel="noopener noreferrer"`; thiếu html thì hiển thị `text` chữ thường như cũ; nơi duy nhất dùng `dangerouslySetInnerHTML`), `RichTextEditorControl.jsx` (Tiptap, chỉ các extension cần thiết, thanh công cụ ghép bằng `Button` icon có `aria-label`/`aria-pressed`, hàng nhập liên kết nội tuyến, Enter ở ô liên kết không gửi form, nạp lại khi `value` đổi từ ngoài), `RichTextEditor.jsx` (nạp động bằng `lazy`, bọc `FormField`: nhãn, dấu bắt buộc, đếm `n / 4.000 ký tự`, lỗi, gợi ý; tham số `disabled` rõ ràng vì ô soạn không chịu `<fieldset disabled>`), CSS `.rich-editor*` và `.rich-body` cuối `announcement.css`. Chưa gắn vào form nào.
- Verify: `eslint` các thư mục đã sửa → sạch · `node scripts/check-design.mjs` → ok (không vượt baseline) · `node --import ./scripts/register-auth-test-loader.mjs --test "tests/notifications/*.mjs" "tests/menu/*.mjs" "tests/hardening/*.mjs"` → 412 pass, 0 fail (test mới `rich-text.test.mjs`: 7 test gồm quét mã chỉ `RichBody.jsx` được dùng `dangerouslySetInnerHTML`; lần chạy đầu 1 test bắt được `textToHtml` thừa khoảng trắng cuối đoạn, đã sửa) · `npx vite build` (ra thư mục tạm) → built ok. Thử trên trình duyệt qua trang demo tạm (đã xóa): gõ, Ctrl+B, nút danh sách, chèn liên kết (từ chối `javascript:`, nhận `truong.example/lich` thành `https://...` có `rel`/`target`), nạp giá trị từ ngoài, khóa `disabled`, dán HTML lạ (tiêu đề, style, bảng, ảnh, script, `javascript:`/`http:` link, trích dẫn) chỉ còn đoạn, đậm, danh sách, liên kết https.
- Chưa kiểm chứng: AC-8 (chunk trình soạn tách riêng khỏi gói đầu) vì chưa component nào trong cây trang import `RichTextEditor`; đo ở Phase 2 sau khi gắn form. Số ký tự trên màn là ước lượng (BE tính chính xác, thêm "• " cho danh sách).
- Khác plan: không có.
- Tiếp: Phase 2 (gắn vào `AnnouncementForm`, `AnnouncementTemplateForm`, `AnnouncementPreview`, hai trang chi tiết, mock repo, nhập tệp) sau khi user duyệt; câu hỏi `.docx` được chốt trong lượt tiếp theo.

### 2026-11-22 — Tiếp tục Phase 2
- User yêu cầu tiếp tục phiên và chốt nhập `.docx` giữ các định dạng được hỗ trợ. Đang nối form, màn chi tiết, mock và nhập Word theo quyết định này; chưa commit.
- Khi rà luồng đọc, phát hiện `src/pages/account/NotificationDetailPage.jsx` và hai adapter account chỉ chuyển `body` từ `/me/announcements/{id}`; thêm trang chi tiết người nhận vào Phase 2 để định dạng hiển thị đúng nơi nhận. Trang danh sách/chuông tiếp tục dùng chữ thường.
- Đã nối `RichTextEditor` vào Soạn/Mẫu/Lịch gửi; form gửi `bodyHtml`, báo lỗi nội dung dưới ô, mở dữ liệu cũ chỉ có `body`; xem trước và chi tiết dùng `RichBody`. Mock nhận HTML và suy ra `body` chữ thường. Đọc Word bằng `mammoth.convertToHtml`, bỏ ảnh và style map nhúng, giữ đúng định dạng được hỗ trợ sau khi lọc; test tệp Word thật có đậm/nghiêng/gạch chân, danh sách và liên kết.
- Phát hiện và sửa lỗi `RichBody` gọi DOMPurify hook khi Vite SSR import; ghi incident `FE-BUG-261122-richbody-ssr-import`.
- Verify bản đang chờ duyệt shared component: `node --import ./scripts/register-auth-test-loader.mjs --test --test-reporter=dot "tests/notifications/*.mjs" "tests/menu/*.mjs" "tests/hardening/*.mjs" tests/auth/notification-error.test.mjs` → exit 0; `npx prettier --check` file tác động → exit 0; `npx vite build --outDir <TEMP>/carenest-richbody-build-review` → built (editor chunk riêng 394,25 kB, Mammoth chunk riêng 308,07 kB). `npx eslint` file tác động → 1 lỗi `no-restricted-imports`: account import component riêng của announcement. Chờ duyệt chuyển `RichBody`/style sang phần dùng chung rồi chạy lại. Chưa thử Phase 2 trên trình duyệt hoặc BE thật; không chạy script wrapper theo chỉ đạo user.
- User duyệt chuyển phần dùng chung trong lượt kế tiếp. Đã đưa `RichBody` và allowlist vào `src/components/ui/`, style hiển thị sang `src/styles/components.css`, cập nhật export, `UI_CARD.md` và mẫu `/ui-kit`; các màn người gửi/người nhận dùng cùng component. Chờ kiểm chứng sau lần sửa cuối.
- Verify sau lần sửa cuối: `npx eslint` trên source tác động → exit 0; `npx prettier --check` trên source/CSS/test tác động → exit 0; `node --import ./scripts/register-auth-test-loader.mjs --test --test-reporter=dot "tests/notifications/*.mjs" "tests/menu/*.mjs" "tests/hardening/*.mjs" tests/auth/notification-error.test.mjs` → exit 0; `npx vite build --outDir <TEMP>/carenest-richbody-build-shared` → built (editor chunk riêng 394,25 kB, Mammoth chunk riêng 308,07 kB). Trình duyệt Chromium headless, mock: modal Mẫu gõ chữ rồi bôi đậm → editor 1 `strong`, xem trước 1 `strong`, không có page error; nhập `.docx` tự tạo → editor và xem trước cùng giữ 1 `strong` + 1 `li`, không có page error; `/ui-kit` ở 360px hiển thị `RichBody` với 1 `strong`, 1 `li`, computed `white-space: normal`. Chưa thử BE thật/APP, chưa commit/push. Không chạy script wrapper theo chỉ đạo user.
- Theo góp ý upload modal: nhãn `File upload` nằm trên nút gọn `Nhập từ tệp`. Lỗi nút không mở hộp chọn do `FileInput` không forward ref; nút gọi input theo id. Kiểm bằng Chromium trước lượt đổi cuối: hộp chọn chưa xác nhận; lint/format sau sửa exit 0.
