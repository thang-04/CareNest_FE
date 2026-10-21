---
title: Dọn CSS thừa, giữ nguyên giao diện CareNest
status: in-progress
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: high
created: 2026-10-19
updated: 2026-10-19
---

# Dọn CSS thừa, giữ nguyên giao diện CareNest

## Context

- User chọn "Chỉ dọn kỹ thuật" và "Chỉ dọn ứng dụng", sau đó duyệt kế hoạch bằng "Implement the plan."
- `src/styles/index.css:1` xác định thứ tự token → base → components → utilities → print. Tất cả 27 file CSS đều có nơi import; không có căn cứ xóa nguyên file.
- Quét ban đầu bằng PostCSS: 2.484 rule, 172 rule không có tên class đầy đủ trong JS/JSX. Đối chiếu class động và giao diện dùng chung giữ lại 87 rule; xác nhận 85 rule không dùng. Rà tiếp selector ghép xác nhận thêm 10 rule có class con bắt buộc không còn consumer: tổng 95 rule.
- Checkout `dev` đang có nhiều thay đổi ngoài task. Đã lưu bản CSS hiện tại và SHA-256 các file tracked trong thư mục tạm riêng; không dùng HEAD làm bản khôi phục cho file dirty.
- Các mốc trước task `src/styles/modules/dashboard.css:111`, `src/styles/modules/attendance.css:115`, `src/styles/modules/school-config.css:596` có khai báo bị ghi đè; thuộc đợt sau.

## Quyết định đã chốt

1. Giữ nguyên giao diện; chỉ dọn kỹ thuật — user, 2026-10-19.
2. Giữ `mockups`, `ui-review` và tài sản thiết kế — user, 2026-10-19.
3. Giữ class động, token/alias và component dùng chung; không chuyển hàng loạt inline style.
4. Không đổi API, props, nghiệp vụ, quyền hoặc dependency; không sửa BE/APP. Không tạo branch, commit hoặc push.
5. Hai đợt sửa: xóa selector cũ trước, hợp nhất khai báo ghi đè sau; kiểm chứng và dừng review sau mỗi đợt theo workflow làn L.

## Làm rõ nghiệp vụ

- Actor: các vai trò hiện có; outcome: cùng giao diện, ít CSS không còn sử dụng hơn.
- Rule: không thay rule nghiệp vụ; quyền và contract tiếp tục do BE sở hữu (`../CareNest_BE/docs/system/CROSS_REPO_MAP.md`).
- Flow: giữ route, trạng thái và dữ liệu; chỉ thay stylesheet của màn đang có.
- Đối chiếu: theo `DESIGN.md` mục 2 và `docs/architecture/CODING_GUIDE.md` mục 3; không áp dụng thiết kế mới.
- BE/APP: không thay đổi; dữ liệu mock của user không reset. Kiểm thử giao diện trên origin/profile riêng.

### Câu hỏi mở

Không còn câu hỏi để triển khai đợt xóa selector. Jira chưa được cung cấp; không commit/PR trong task này.

## Acceptance criteria

- **AC-1:** Chỉ xóa rule không còn consumer tĩnh hoặc động; giữ biến thể dùng chung và các rule khác nguyên thứ tự/giá trị.
- **AC-2:** Ảnh và thuộc tính hiển thị trước–sau giữ nguyên tại 1440px/768px với cùng dữ liệu mock, thời gian và tranh nền.
- **AC-3:** Không làm thay đổi file tracked ngoài danh sách CSS của task và log kiểm chứng; bảo toàn dirty work hiện có.
- **AC-4:** `node scripts/verify.mjs` đạt sau lần sửa cuối; `node scripts/check-ai-layer.mjs` đạt cho tài liệu.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Phạm vi | Dọn kỹ thuật | Đồng bộ thị giác hoặc thiết kế lại | Theo lựa chọn của user |
| Xóa CSS | Danh sách rule đối chiếu source + runtime | Purge tự động theo grep | Giữ class tạo động và API giao diện chung |
| Git | Sửa hẹp trên checkout hiện tại, có snapshot | Worktree mới từ HEAD | Bản hiện tại chứa UI dirty cần giữ; user chưa cho phép tạo branch |
| Test | So ảnh, CSS AST và suite hiện có | Test mới kiểm tra tên selector đã xóa | Chứng minh bảo toàn giao diện và nội dung còn lại |

## Phases

### Phase 1 — Rà soát và xóa selector không dùng

- C plan này; M hai stylesheet layout và stylesheet module account, attendance, children, dashboard, education-plan, facility-transfer, facility, inventory-inspection, menu-planning, school-config; M log `docs/quality/VERIFICATION.md`.
- 1. Lưu snapshot dirty và manifest rule. 2. Chụp baseline bằng Chrome mock riêng. 3. Xóa danh sách đã đối chiếu. 4. Format chỉ CSS bị sửa. 5. So ảnh/AST và chạy hai cổng.
- Không xóa file hoặc thay JSX. Giữ các selector có biến thể động và CSS dùng chung dù chưa có consumer trực tiếp.
- Exit: AC-1–4 đạt; **dừng chờ user review trước Phase 2**.

### Phase 2 — Hợp nhất khai báo ghi đè

- M stylesheet dashboard, attendance, school-config; chỉ mở rộng sang file khác khi có cùng bằng chứng cascade và thuộc phạm vi đã duyệt.
- Gộp khai báo cùng selector và cùng điều kiện media/supports; giữ giá trị đang có hiệu lực, độ ưu tiên và thứ tự ảnh hưởng tới selector khác.
- Exit: so ảnh/thuộc tính hiển thị, `node scripts/verify.mjs`, `node scripts/check-ai-layer.mjs` đạt; dừng review.

## Test matrix

| AC | Cách kiểm chứng | Phase |
| --- | --- | --- |
| AC-1 | Manifest class tĩnh/động; query selector trên DOM; AST các rule giữ lại không đổi | 1 |
| AC-2 | Chrome mock riêng, 1440/768, ảnh và computed styles; màn danh sách/form, auth, UI kit | 1–2 |
| AC-3 | SHA-256 file tracked trước–sau; đối chiếu patch với snapshot dirty | 1–2 |
| AC-4 | Hai cổng kiểm chứng, kết quả thật trong Progress log | 1–2 |

## Danh sách thay đổi Phase 1

| File CSS | Rule đã xóa | Dòng giảm so với working tree trước task |
| --- | ---: | ---: |
| `src/layouts/auth.css` | 3 | 15 |
| `src/layouts/layout.css` | 2 | 8 |
| `src/styles/modules/account.css` | 2 | 11 |
| `src/styles/modules/attendance.css` | 2 | 7 |
| `src/styles/modules/children.css` | 7 | 30 |
| `src/styles/modules/dashboard.css` | 1 | 5 |
| `src/styles/modules/education-plan.css` | 50 | 282 |
| `src/styles/modules/facility-transfer.css` | 9 | 47 |
| `src/styles/modules/facility.css` | 1 | 4 |
| `src/styles/modules/inventory-inspection.css` | 5 | 27 |
| `src/styles/modules/menu-planning.css` | 3 | 17 |
| `src/styles/modules/school-config.css` | 10 | 46 |
| **Tổng** | **95** | **499** |

Phần bỏ: tài khoản demo/menu người dùng cũ; bố cục hồ sơ cũ; chọn mức quyền cũ; các khối giáo án dạng card/lưới cũ; selector con không còn ở DOM; nhánh responsive rỗng và comment chỉ mô tả khối đã bỏ. Không xóa stylesheet, asset, JSX, token hay biến thể giao diện chung.

## Rủi ro & rollback

| Rủi ro | Giảm thiểu | Rollback |
| --- | --- | --- |
| Class tạo động bị coi là không dùng | Giữ family động; rà template class và DOM trước khi xóa | Áp lại đúng rule từ snapshot trước task |
| Mất dirty work | Hash toàn bộ tracked file; CSS snapshot lấy working tree | Chỉ hoàn tác patch của task; không restore/reset cả file |
| Bỏ sót trạng thái chưa mở | Giữ class chung/động và trường hợp nghi ngờ | Giữ lại selector chưa đủ bằng chứng |

## Validation log

- [x] Phạm vi và hai lựa chọn của user đã rõ; nguồn duyệt triển khai ghi trong Context.
- [x] Không thay contract hoặc dùng rule PENDING/OPEN.
- [x] Hơn 8 file được chia hai đợt độc lập, có cổng kiểm chứng và điểm dừng review.
- [x] Mỗi AC có cách kiểm chứng; snapshot giữ nguyên dirty work.
- [x] Không thêm test chỉ kiểm tra sự vắng mặt của selector; dùng so sánh cấu trúc CSS và giao diện.

## Progress log

### 2026-10-19 — Phase 1 đang triển khai

- Nguồn duyệt: user "Implement the plan." sau kế hoạch trong chat.
- Snapshot: thư mục tạm riêng `carenest-css-cleanup-9c9b06d931ea4fecb3080c1e89578396`; giữ CSS trước task, manifest và hash tracked.
- Môi trường: Vite mock tại `127.0.0.1:5197`; browser profile riêng. Không sửa env/dependency, không reset dữ liệu demo của user.
- Verify: chưa chạy sau thay đổi; chưa có claim hoàn thành.
- Tiếp: lấy baseline trước khi xóa selector. Phase 2 chưa thực hiện.

### 2026-10-19 — Phase 1: đã kiểm chứng, chờ review

- Đã xóa 95 rule và comment/nhánh rỗng liên quan, giảm 499 dòng trong 12 stylesheet. Chỉ format các stylesheet này; không nhận thay đổi từ HEAD thay cho dirty work.
- AST trước–sau: mọi selector, declaration, giá trị, điều kiện và thứ tự còn lại giống snapshot sau khi trừ đúng 95 rule. SHA-256 các file tracked ngoài CSS task và log kiểm chứng giữ nguyên.
- Reviewer độc lập rà 78 tên class, template literal toàn `src`, selector ghép và media query: không có finding actionable; chỉ xác nhận kiểm tra tĩnh.
- Browser: Chrome headless, profile riêng, mock `127.0.0.1:5197`, thời gian cố định 19/10/2026. 23 màn × 1440/768 + modal, toast, keyboard focus = 49 ca. Bao gồm guest, Principal, Vice Principal và Teacher; có danh sách/form/chi tiết. 49/49 ca giống computed style và hình học DOM, không selector nào bị xóa khớp DOM, không runtime exception.
- So ảnh PNG đã giải mã: 5/49 ca trùng pixel tuyệt đối; cả 49 ca không có điểm ảnh lệch quá 2/255 mỗi kênh RGB. Lớn nhất 145 pixel (0,0112% ảnh) khác nhẹ do raster hóa chữ trên header. Không coi hash PNG khác là lỗi bố cục; không ghi là 49 ảnh trùng tuyệt đối.
- Tương tác: mở modal/đóng bằng Escape; đủ bốn loại toast; Tab chuyển focus và có `:focus-visible` cùng outline solid.
- Điều chỉnh harness: Python thiếu Playwright/Pillow nên dùng CDP và bộ giải mã PNG bằng thư viện chuẩn Node. Lượt chụp toàn trang làm thay đổi thanh cuộn của Chrome headless; dùng viewport 900px cao, kiểm lại trên cùng DOM với CSS gốc đã qua Vite. Các ca bắt gặp spinner, notification cập nhật hoặc Vite reload được chạy lại sau khi màn ổn định; không sửa source để xử lý nhiễu kiểm thử.
- Bằng chứng tạm: `manifest.json`, `old-styles.json`, `ab-report.json`, `pixel-report.json`, ảnh `ab-before-*`/`ab-after-*` trong thư mục snapshot nêu trên. Giữ cho review; không đưa ảnh/mock vào commit.
- Suite trên working tree sau sửa: menu 46/46, kitchen 37/37, merge 38/38, 0 fail/skip; lint/format/build đạt trong `verify.log`. `check-ai-layer`: exit 0, 0 lỗi, 18 cảnh báo hiện hữu. Chạy cổng đầy đủ lần cuối sau bản ghi này; output handoff là bằng chứng xác nhận cuối.
- Commit: chưa commit/push/PR. Khác plan: phương pháp so ảnh được ổn định theo bằng chứng trên; phạm vi và giao diện giữ nguyên.
- Tiếp: **dừng review Phase 1 theo kế hoạch đã duyệt**. Phase 2 gộp khai báo bị ghi đè chưa thực hiện.
