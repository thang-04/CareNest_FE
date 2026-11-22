---
title: Tiếp nhận chọn năm bắt buộc, ngày bắt đầu đi học, nhãn trẻ tới ngày chưa có lớp (đợt 2, FE)
status: draft
owner: ATPX48-69
jira: G94-180 / FE-FIX-14
branch: fix/G94-180-FE-FIX-14-school-year-scope
modules: [children]
rules: [G94-180/CHD-11, G94-180/CHD-14, CFG-YR-01]
risk: high
created: 2026-11-22
updated: 2026-11-22
---
# Tiếp nhận chọn năm bắt buộc, ngày bắt đầu đi học, nhãn trẻ tới ngày chưa có lớp (đợt 2, FE)

Phần client của `BE:docs/plans/active/2026-11-22-intake-start-date.md` (6 quyết định, AC BE, contract ở đó). Làm sau đợt 1.

## Context
- Năm tiếp nhận chỉ chép năm header lúc mở trang (`src/pages/children/EnrollChildPage.jsx:127-135`, `src/utils/schoolYearPrep.js:24-29`). Đổi header khi đang ở trang thì ô không đổi; đổi ô thì header không đổi. Header ở năm đã đóng hoặc chưa tới ngày chuẩn bị ⇒ cả trang bị khóa (`EnrollChildPage.jsx:398-403`).
- Hộp Nhập Excel cũng có ô năm riêng, lấy theo header (`src/components/children/ImportChildrenModal.jsx:76-103`) và khóa theo header (`:233`).
- "Ngày bắt đầu học" chỉ hiện cho năm sau (`EnrollChildPage.jsx:519-530`).
- Dòng nhắc "N trẻ chưa được xếp lớp" chỉ PHT thấy (`src/pages/children/ChildrenListPage.jsx:202-212`).
- Lịch nghỉ đọc qua `GET /school-years/{id}/holidays`, endpoint có sẵn của Cần, FE chỉ đọc.

## Quyết định đã chốt
Theo plan BE (user 22/11):
- Ô năm bắt buộc, không chọn sẵn, không có năm đã qua.
- Năm đang học thì có ngày bắt đầu đi học, từ hôm nay tới cuối năm, mặc định hôm nay.
- Ngày bắt đầu rơi vào ngày nghỉ thì cảnh báo, không chặn.
- Trang không phụ thuộc header.
- Tới ngày bắt đầu mà chưa có lớp thì gắn nhãn, đưa lên đầu, hiện dòng nhắc cho HT và PHT.

## Làm rõ nghiệp vụ
Xem plan BE. FE không tự tính `startDue`; chỉ hiển thị cờ BE trả. Kiểm thứ 7, chủ nhật, ngày nghỉ chỉ để hiện cảnh báo.

### Câu hỏi mở
| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Năm tiếp nhận, ngày bắt đầu, ngày A | Như 6 quyết định ở plan BE | user | 2026-11-22 | `docs/features/enrollment-intake-ui.md` |

## Acceptance criteria
- **AC-1:** Ô "Năm học tiếp nhận" trống lúc mở trang. Chưa chọn ⇒ lỗi "Chọn năm học tiếp nhận". Chỉ có năm đang hoạt động và năm sau đã tới ngày chuẩn bị. Đổi header không đổi ô; trang không bị khóa theo header.
- **AC-2:** Chọn năm đang học ⇒ hiện "Ngày bắt đầu đi học" (`DateInput`), mặc định hôm nay, chỉ cho từ hôm nay tới ngày kết thúc năm. Chọn năm sau ⇒ như hiện nay.
- **AC-3:** Ngày bắt đầu là thứ 7, chủ nhật hoặc ngày nghỉ của năm ⇒ cảnh báo vàng, vẫn lưu được.
- **AC-4:** Mở lại hồ sơ và hộp Nhập Excel làm như AC-1 … AC-3 (Excel: một ngày cho cả file).
- **AC-5:** Trẻ có `startDue` ⇒ nhãn "Đã tới ngày đi học, chưa có lớp" ở danh sách trẻ và ở danh sách chờ xếp lớp, đưa lên đầu. Dòng nhắc hiện cho HT và PHT, kèm số trẻ đã tới ngày.
- **AC-6:** Hồ sơ trẻ hiện "Ngày bắt đầu đi học". Lớp chưa bắt đầu hiện kèm "từ dd/mm/yyyy".
- **AC-7:** mock làm như BE ở mọi AC trên (BE giả, dẫn G94-180/CHD-14).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Đọc lịch nghỉ | Hàm mới trong facade children, gọi `GET /school-years/{id}/holidays` | Import service school-config | ESLint chặn import chéo module |
| Bỏ khóa theo header | Bỏ ở trang Tiếp nhận và hộp Excel; màn khác giữ | Bỏ mọi nơi | Chỉ tiếp nhận chọn năm riêng |

## Phases
### Phase 1 — Năm bắt buộc, ngày bắt đầu, cảnh báo ngày nghỉ (AC-1 … AC-4, AC-7; sau BE phase 1)
- Files: M `EnrollChildPage.jsx`, `ImportChildrenModal.jsx`, `src/utils/schoolYearPrep.js`, `src/services/children/api/childrenApi.js`, `childrenService.js`, `childrenMockRepository.js`, `childrenValidation.js` · M test `new-year-intake.test.mjs`, `school-year-prep.test.mjs` · C `tests/children/intake-start-date.test.mjs`
- Exit (PowerShell): `npm run test:children` pass · `npm run lint` · `npm run build`
- **Dừng chờ user review.**

### Phase 2 — Nhãn tới ngày, dòng nhắc, hồ sơ (AC-5, AC-6; sau BE phase 2)
- Files: M `ChildrenListPage.jsx`, `ClassPlacementPage.jsx`, `ChildProfilePage.jsx`, `childrenMockRepository.js` · C `tests/children/start-due-badge.test.mjs` · M `docs/features/enrollment-intake-ui.md`, `docs/integration/FE_API_CALLS.md`
- Exit: `npm run verify` pass.
- **Dừng chờ user review.**

## Test matrix
| AC | Test | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-1 … AC-4, AC-7 | `intake-start-date.test.mjs`, `new-year-intake.test.mjs` | 1 | |
| AC-5, AC-6 | `start-due-badge.test.mjs` | 2 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| FE chạy trước BE | 400 thiếu `startDate` | Chạy FE cùng BE đợt 2 | Revert cả hai |
| Lịch nghỉ không tải được | Không có cảnh báo | Cảnh báo chỉ là phụ, vẫn lưu được | — |

## Validation log
- [x] Khẳng định có `file:line`
- [x] Contract theo plan BE (consumer `childrenApi.js`)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] Tự review: không placeholder

## Progress log
### 2026-11-22 — draft, chờ user duyệt
- Commit: chưa commit

### 2026-11-22 — chưa làm
- Đợt 2 sửa cả dòng Cần viết trong `EnrollChildPage.jsx` (ô năm tiếp nhận, tiếp nhận năm sau) và `ChildrenListPage.jsx` (dòng nhắc). Chờ user quyết làm hay chờ Cần.
