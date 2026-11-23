---
title: Tiếp nhận chọn năm bắt buộc, ngày bắt đầu đi học, ngày xếp và chuyển lớp, nhãn trẻ tới ngày chưa có lớp (đợt 2, FE)
status: done
owner: ATPX48-69
jira: G94-180 / FE-FIX-14
branch: fix/G94-180-FE-FIX-14-school-year-scope
modules: [children]
rules: [G94-180/CHD-03, G94-180/CHD-11, G94-180/CHD-14, CFG-YR-01]
risk: high
created: 2026-11-22
updated: 2026-11-23
---
# Tiếp nhận chọn năm bắt buộc, ngày bắt đầu đi học, ngày xếp và chuyển lớp, nhãn trẻ tới ngày chưa có lớp (đợt 2, FE)

Phần client của `BE:docs/plans/completed/2026-11-22-intake-start-date.md`. Quyết định, AC BE và contract nằm ở plan BE. Làm sau đợt 1. Ngày 23/11 Cần nhờ user làm ngày bắt đầu đi học và ngày chuyển lớp.

## Context
- Năm tiếp nhận chỉ chép năm header lúc mở trang (`src/pages/children/EnrollChildPage.jsx:127-135`, `src/utils/schoolYearPrep.js:24-29`). Header ở năm đã đóng hoặc chưa tới ngày chuẩn bị thì cả trang bị khóa (`EnrollChildPage.jsx:404-409`).
- Hộp Nhập Excel có ô năm riêng, lấy và khóa theo header (`src/components/children/ImportChildrenModal.jsx:76-103`, `:233`).
- "Ngày bắt đầu học" chỉ hiện cho năm sau, mặc định là ngày bắt đầu năm (`EnrollChildPage.jsx:134`, `:519-530`).
- Hộp Xếp lớp / Chuyển lớp chỉ gửi `{ classId, reason }`. Lý do bắt buộc khi chuyển lớp (`src/pages/children/ClassPlacementPage.jsx:113`, `:120`, `:264-275`).
- Lịch sử xếp lớp chỉ hiện lớp cũ, lớp mới và thời điểm lưu (`src/pages/children/ChildProfilePage.jsx:320-345`). Thẻ "Lớp & năm học" chỉ hiện lớp hiện tại (`:262-272`).
- Mock: `placeChild`, `withdrawChild` (`src/services/children/mock/childrenMockRepository.js:1320`, `:1356`). Ô ngày dd/mm/yyyy: `DateInput` (`src/components/form/DateInput.jsx:13`).
- Dòng nhắc "N trẻ chưa được xếp lớp" chỉ PHT thấy (`src/pages/children/ChildrenListPage.jsx:202-212`).
- Lịch nghỉ đọc qua `GET /school-years/{id}/holidays`, endpoint có sẵn của Cần; FE chỉ đọc.

## Quyết định đã chốt
Theo plan BE (user 22/11 và 23/11):
- Ô năm học bắt buộc, không chọn sẵn, không có năm đã qua. Trang không phụ thuộc header.
- Năm đang học: ngày bắt đầu đi học từ hôm nay tới cuối năm, mặc định ngày học gần nhất. Năm sau: mặc định ngày bắt đầu năm HT cấu hình.
- Ngày bắt đầu đi học và ngày chuyển lớp phải là ngày học. FE báo lỗi ngay khi chọn ngày nghỉ (thay cho cảnh báo vàng ngày 22/11); BE vẫn là nơi quyết định.
- Xếp lớp lần đầu có ô ngày, mặc định max(hôm nay, ngày bắt đầu đi học).
- Chuyển lớp chọn ngày từ hôm nay tới cuối năm. Khi có lịch chuyển thì hiện "Sẽ chuyển sang X từ dd/mm"; trẻ vẫn ở lớp cũ tới ngày đó.
- Tới ngày bắt đầu mà chưa có lớp: nhãn, đưa lên đầu, dòng nhắc cho HT và PHT.

## Làm rõ nghiệp vụ
Xem plan BE. FE không tự tính `startDue` hay lịch chuyển; chỉ hiển thị `startDue`, `nextClass`, `effectiveFrom` mà BE trả. Kiểm thứ 7, chủ nhật và ngày nghỉ ở FE chỉ để báo lỗi sớm.

### Câu hỏi mở
| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Năm tiếp nhận, ngày bắt đầu, ngày A | Như quyết định 1, 2, 5, 6 ở plan BE | user | 2026-11-22 | `docs/features/enrollment-intake-ui.md` |
| Ngày nghỉ, xếp lần đầu, ngày chuyển, lịch chuyển | Như quyết định 3, 4, 7, 8 ở plan BE | user | 2026-11-23 | `docs/features/enrollment-intake-ui.md` |

| Sửa, hủy lịch chuyển | Chuyển lần nữa thay lịch cũ; nút "Hủy lịch chuyển"; cho nghỉ học xóa lịch | user | 2026-11-23 | `docs/features/enrollment-intake-ui.md` |

## Acceptance criteria
- **AC-1:** Ô "Năm học tiếp nhận" trống lúc mở trang. Chưa chọn ⇒ lỗi "Chọn năm học tiếp nhận". Chỉ có năm đang hoạt động và năm sau đã tới ngày chuẩn bị. Đổi header không đổi ô; trang không bị khóa theo header.
- **AC-2:** Chọn năm đang học ⇒ hiện "Ngày bắt đầu đi học" (`DateInput`), mặc định ngày học gần nhất từ hôm nay, chỉ cho từ hôm nay tới ngày kết thúc năm. Chọn năm sau ⇒ mặc định ngày bắt đầu năm HT cấu hình (như hiện nay).
- **AC-3:** Ngày bắt đầu là thứ 7, chủ nhật hoặc ngày nghỉ của năm ⇒ lỗi ở ô, không lưu được. Lỗi 400 ô `startDate` từ BE hiện đúng ô.
- **AC-4:** Mở lại hồ sơ và hộp Nhập Excel làm như AC-1 … AC-3 (Excel: một ngày cho cả file).
- **AC-5:** Trẻ có `startDue` ⇒ nhãn "Đã tới ngày đi học, chưa có lớp" ở danh sách trẻ và ở danh sách chờ xếp lớp, đưa lên đầu. Dòng nhắc hiện cho HT và PHT, kèm số trẻ đã tới ngày.
- **AC-6:** Hồ sơ trẻ hiện "Ngày bắt đầu đi học". Lớp chưa bắt đầu hiện kèm "từ dd/mm/yyyy".
- **AC-7:** Hộp Xếp lớp có ô "Ngày vào lớp": mặc định max(hôm nay, ngày bắt đầu đi học), lùi tới ngày học gần nhất; không cho trước mốc đó, không quá cuối năm. Hộp Chuyển lớp có ô "Ngày chuyển lớp": mặc định ngày học gần nhất từ hôm nay, tới cuối năm. Ngày nghỉ ⇒ lỗi ở ô. Lỗi 400 ô `effectiveDate` hiện đúng ô.
- **AC-8:** Có `nextClass` ⇒ Xếp lớp và hồ sơ hiện "Sẽ chuyển sang X từ dd/mm/yyyy". Trẻ vẫn nằm trong lớp hiện tại ở mọi danh sách tới ngày đó.
- **AC-9:** Lịch sử xếp lớp hiện "Từ ngày dd/mm/yyyy" theo `effectiveFrom` (dòng cũ: ngày lưu); lịch bị hủy / bị thay ghi "Đã hủy lịch". Có lịch ⇒ nút "Hủy lịch chuyển" (lớp chưa bắt đầu: "Hủy xếp lớp") gọi `DELETE /children/{id}/placement/scheduled`.
- **AC-10:** Mock làm như BE ở mọi AC trên (BE giả, dẫn G94-180/CHD-14).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Đọc lịch nghỉ | Hàm mới trong facade children, gọi `GET /school-years/{id}/holidays` | Import service school-config | ESLint chặn import chéo module |
| Bỏ khóa theo header | Bỏ ở trang Tiếp nhận và hộp Excel; màn khác giữ | Bỏ mọi nơi | Chỉ tiếp nhận chọn năm riêng |
| Ngày học gần nhất | Helper hiển thị dùng chung cho tiếp nhận và hộp xếp/chuyển lớp | Mỗi màn tự viết | Một cách tính mặc định; BE vẫn kiểm |

## Phases
### Phase 1 — Năm bắt buộc, ngày bắt đầu, lỗi ngày nghỉ (AC-1 … AC-4, AC-10; sau BE phase 1)
- Files:
  - M `EnrollChildPage.jsx`, `ImportChildrenModal.jsx`, `src/utils/schoolYearPrep.js`.
  - M `src/services/children/api/childrenApi.js`, `childrenService.js`, `childrenMockRepository.js`, `childrenValidation.js`.
  - M test `new-year-intake.test.mjs`, `school-year-prep.test.mjs`; C `tests/children/intake-start-date.test.mjs`.
- Exit (PowerShell): `npm run test:children` pass · `npm run lint` · `npm run build`.
- **Dừng chờ user review.**

### Phase 2 — Nhãn tới ngày, ngày vào lớp lần đầu, hồ sơ (AC-5, AC-6, AC-7 phần xếp lần đầu; sau BE phase 2)
- Files:
  - M `ChildrenListPage.jsx`, `ClassPlacementPage.jsx`, `ChildProfilePage.jsx`, `childrenMockRepository.js`.
  - C `tests/children/start-due-badge.test.mjs`.
  - M `docs/features/enrollment-intake-ui.md`, `docs/integration/FE_API_CALLS.md`.
- Exit: `npm run verify` pass. **Dừng chờ user review.**

### Phase 3 — Ngày chuyển lớp, lịch chuyển, lịch sử (AC-7 phần chuyển lớp, AC-8, AC-9; sau BE phase 3)
- Files:
  - M `ClassPlacementPage.jsx`, `ChildProfilePage.jsx`, `childrenApi.js`, `childrenMockRepository.js`.
  - C `tests/children/transfer-effective-date.test.mjs`.
  - M `docs/features/enrollment-intake-ui.md`.
- Exit: `npm run verify` pass. **Dừng chờ user review.**

## Test matrix
| AC | Test | Phase | Kết quả |
| --- | --- | --- | --- |
| AC-1 … AC-4, AC-10 | `intake-start-date.test.mjs`, `new-year-intake.test.mjs` | 1 | |
| AC-5, AC-6, AC-7 (xếp lần đầu) | `start-due-badge.test.mjs` | 2 | |
| AC-7 (chuyển lớp), AC-8, AC-9 | `transfer-effective-date.test.mjs` | 3 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| FE chạy trước BE | 400 thiếu `startDate`; ô ngày chuyển bị bỏ qua | Chạy FE cùng BE của đợt 2 | Revert cả hai |
| Lịch nghỉ không tải được | FE không báo lỗi sớm | BE vẫn chặn và trả lỗi ở đúng ô | — |

## Validation log
- [x] Khẳng định có `file:line` (đối chiếu HEAD dbdeb714)
- [x] Contract theo plan BE (consumer `childrenApi.js`)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] Không còn câu hỏi mở (user 23/11)

## Progress log
### 2026-11-22 — draft, chờ user duyệt
- Commit: chưa commit. Đợt 2 sửa cả dòng Cần viết trong `EnrollChildPage.jsx` (ô năm tiếp nhận, tiếp nhận năm sau) và `ChildrenListPage.jsx` (dòng nhắc); khi đó chờ user quyết.

### 2026-11-23 — cập nhật theo yêu cầu của Cần
- Thêm ô ngày ở hộp Xếp lớp và Chuyển lớp, nhãn lịch chuyển, ngày hiệu lực trong lịch sử (phase 3).
- Cảnh báo ngày nghỉ đổi thành lỗi.
- Tiếp: user trả lời câu hỏi mở và duyệt plan. Commit: chưa commit.

### 2026-11-23 — approved, cả 3 phase xong
- User: "như bạn đề xuất và hãy hoàn thành tất cả các phase không phải hỏi lại".
- Đã làm: `IntakeStartFields` (năm bắt buộc, ngày bắt đầu đi học) ở Tiếp nhận, mở lại hồ sơ, hộp Excel; `utils/children/startDate.js`, `addDays` trong `utils/format.js`; `useYearHolidays`; API `cancelScheduledPlacement`, `getSchoolHolidays`; mock theo BE; Xếp lớp có ô ngày, nhãn lịch, nút hủy; Danh sách trẻ nhãn `startDue`, dòng nhắc HT/PHT; Hồ sơ ngày bắt đầu đi học, "từ dd/mm", lịch sử có ngày hiệu lực.
- Khác plan:
  - Bỏ cả khóa theo header ở `ImportChildrenPage` (bước 2 của nhập Excel) cho cùng luồng với hộp Excel; test `year-locked-pages` cập nhật theo.
  - Mock: lời gọi không gửi ngày (test cũ) giữ hành vi cũ, không kiểm ngày học, để test không phụ thuộc thứ trong tuần; có gửi ngày thì kiểm như BE.
  - Fixture năm sau của `new-year-intake`, `planned-admission-view` đổi 05/09/2027 (chủ nhật) thành 06/09/2027.
  - `docs/integration/BE_API_INDEX.md`, `be-api-routes.json`, `FE_API_CALLS.md` sinh lại từ `../be-school-year-scope` (lần đầu chạy nhầm `../CareNest_BE` nhánh khác ra 380 endpoint, đã chạy lại với `--from`).
- Verify: `npm run verify` (PowerShell) sau sửa cuối — xem dòng commit bên dưới.
