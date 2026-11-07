---
title: Tổng hợp cân đo theo mẫu 5.1 (cân nặng, chiều cao, BMI) cho Hiệu trưởng, Phó hiệu trưởng
status: in-progress
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43 # cần xác nhận task Jira riêng trước khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [health]
rules: [HLT-03, HLT-18]
risk: high
created: 2026-11-04
updated: 2026-11-04
---

# Tổng hợp cân đo theo mẫu 5.1 (cân nặng, chiều cao, BMI) cho Hiệu trưởng, Phó hiệu trưởng

Plan phần client (Web). BE (`../CareNest_BE`) do agent BE làm song song; contract dưới đây là contract coordinator giao, BE là nguồn đúng. Rule BE: HLT-03 (chuẩn WHO), HLT-18 (BMI theo tuổi); đầu tệp CSV cân nặng/chiều cao theo tuổi của BE ghi HLT-20 (chưa có trong `BE:docs/business/BUSINESS_RULES.md` lúc viết plan).

## Context

- User yêu cầu 2026-11-04 (qua coordinator): Hiệu trưởng (mọi điểm trường) và Phó hiệu trưởng (điểm trường được giao) xem bảng tổng hợp theo mẫu báo cáo trường "5.1. Kết quả theo dõi cân nặng - chiều cao - cân nặng/chiều cao (BMI)", mỗi tháng một khối; "Hãy thiết kế sao cho phù hợp".
- Hiện trạng FE: số đo, mức BMI theo tuổi có ở từng kỳ cân đo (`src/pages/children/HealthCheckDetailPage.jsx`), chưa có bảng tổng hợp theo tháng, chưa có z-score cân nặng/tuổi, chiều cao/tuổi (`src/services/children/mock/bmiForAgeRule.js` chỉ BMI). "Xuất Excel" hiện có đều là CSV (`src/utils/exportCsv.js`); `package.json` chỉ có `read-excel-file` (đọc, không ghi xlsx).

## Quyết định đã chốt

1. Đối tượng, phạm vi, mẫu bảng như yêu cầu user (2026-11-04, qua coordinator).
2. Contract BE (coordinator 2026-11-04): `GET /health-checks/growth-report?month=yyyy-MM[&campusId=]`.
   - Phạm vi: Hiệu trưởng mọi điểm trường, `campusId` để lọc; Phó hiệu trưởng điểm trường được giao, `campusId` khác ⇒ 403; vai trò khác ⇒ 403.
   - Đợt/kỳ của tháng theo điểm trường: chưa hủy, cả hai loại, `startDate` trong tháng. Trẻ của lớp = danh sách trẻ của đợt/kỳ, gộp theo trẻ khi trong tháng có nhiều đợt/kỳ.
   - Được cân đo: số đo của kỳ cân đo, hoặc phiếu khám đã kết luận có chiều cao, cân nặng; phiếu nháp, trẻ vắng không tính; một trẻ nhiều lần thì lấy lần gần nhất.
   - Phân loại theo z-score WHO làm tròn 2 chữ số, tuổi tháng tròn 0–84 tại ngày đo: cân nặng/tuổi (giới hạn đuôi như BMI) < −2 ⇒ `underweight`, còn lại `weightNormal`; chiều cao/tuổi (L = 1) < −2 ⇒ `stunted`, còn lại `heightNormal`; BMI theo luật BMI theo tuổi hiện có (áp cả số đo của phiếu khám trong báo cáo này): `bmiNormal` = NORMAL + OVERWEIGHT_RISK, `wasted` = THINNESS + SEVERE_THINNESS, `overweight`, `obese`; `unclassified` = trẻ được cân đo có chỉ số null.
   - Cấp lớp theo nhóm tuổi: `ag-2` ⇒ NURSERY; `ag-3`, `ag-4`, `ag-5` ⇒ PRESCHOOL; không có nhóm tuổi ⇒ null (chỉ vào tổng điểm trường, toàn trường). Thứ tự: mẫu giáo theo `sortOrder` nhóm tuổi giảm dần (5 tuổi trước) rồi tên; rồi nhà trẻ; rồi null.
   - Response `{ month, campuses:[{ campusId, campusName, campaigns:[{id,name,kind,status,startDate,endDate}], classes:[{classId,className,ageGroupName,level,counts}], preschool, nursery, total }], preschool, nursery, total }`, `counts = { enrolled, measured, weightNormal, underweight, heightNormal, stunted, bmiNormal, wasted, overweight, obese, unclassified }`. Điểm trường không có đợt/kỳ trong tháng vẫn trả, mảng rỗng, số 0. Sổ sức khỏe không đổi.
3. Bảng WHO cân nặng/tuổi, chiều cao/tuổi: BE đưa CSV (`BE:src/main/resources/health/who-weight-for-age.csv`, `who-height-for-age.csv`), FE sinh module JS theo mẫu `whoBmiForAge.js`, chỉ đọc BE.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor Hiệu trưởng, Phó hiệu trưởng (xem, xuất Excel) · outcome: bảng 5.1 theo tháng, theo điểm trường, giống mẫu giấy của trường · rule HLT-03, HLT-18 (+ HLT-20 BE đang thêm) · flow `[S]` BE tính khi đọc từ dữ liệu đã lưu.
- **Đối chiếu thiết kế ban đầu:** báo cáo theo lớp "5.1 cân nặng, chiều cao, BMI" ghi "hoãn" ở `docs/features/README.md` (mục Kỳ cân đo, dòng "Báo cáo theo lớp … hoãn") — nay làm theo yêu cầu user.
- **Ảnh hưởng:** module health · quyền: HT, PHT (menu, route ẩn với vai trò khác; BE vẫn chặn) · dữ liệu dẫn xuất tính khi đọc · `FE: /children/growth-report` (mới) · `APP:` không có · dữ liệu cũ: kết quả mẫu cũ (chỉ ở demo) tính như được cân đo trong BE giả.

### Câu hỏi mở

Không còn câu hỏi chặn (chế độ tự chạy). Điểm cần BE xác nhận ghi ở Key decisions và báo cáo bàn giao.

## Acceptance criteria

- **AC-1** (phạm vi): Given Hiệu trưởng When mở báo cáo Then thấy mọi điểm trường, lọc được từng điểm trường; Phó hiệu trưởng chỉ thấy điểm trường mình, `campusId` khác ⇒ 403; giáo viên ⇒ 403, không có menu, route chặn.
- **AC-2** (đếm): trẻ của lớp gộp theo trẻ trong các đợt/kỳ của tháng; được cân đo theo luật contract (phiếu nháp, vắng không tính; lấy lần gần nhất); tổng MG, NT, điểm trường, toàn trường đúng.
- **AC-3** (HLT-03, HLT-18): phân loại W/A, H/A, BMI theo z-score làm tròn 2 chữ số; trung vị ⇒ z = 0; mốc −2SD xếp như BE; trẻ thiếu ngày sinh/giới tính hoặc ngoài 0–84 tháng ⇒ `unclassified`.
- **AC-4** (giao diện): bảng theo mẫu (đầu bảng gộp ô, dải điểm trường, tổng in đậm), thẻ số liệu, ghi chú; điện thoại 375px không tràn trang.
- **AC-5** (Excel): "Xuất Excel" ra xlsx cùng bố cục (dòng tiêu đề, tháng, phạm vi, đầu bảng gộp ô).

## Key decisions

| Quyết định                                             | Chọn                                                                                                                                                                                             | Phương án khác                    | Vì sao                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------- |
| Ghi xlsx                                               | Tự viết bộ ghi xlsx tối giản (`src/utils/exportXlsx.js`: ZIP lưu không nén + CRC32, XML SpreadsheetML, gộp ô, cố định cột/dòng), hàm dựng bảng thuần (`src/utils/children/growthReportSheet.js`) | Thêm thư viện ghi Excel; CSV      | `read-excel-file` chỉ đọc; brief không cho thêm thư viện khi không cần; CSV không gộp ô được |
| Kết quả mẫu cũ (chỉ demo)                              | Tính là được cân đo nếu có chiều cao, cân nặng                                                                                                                                                   | Bỏ qua                            | BE không có mẫu cũ; đợt tháng 9 của demo toàn kết quả mẫu cũ, bỏ thì tháng 9 trống           |
| Lớp trong báo cáo                                      | Mọi lớp của điểm trường khi tháng có đợt/kỳ, lớp không có trẻ trong danh sách ⇒ dòng 0 (đổi 2026-11-04 sau khi đọc BE `HealthGrowthReportServiceImpl`: lớp lấy từ `HealthCheckRules.classesOf`)  | Chỉ lớp có trẻ                    | Khớp BE; BE giả không lọc lớp theo năm học (lớp demo không có lịch sử năm)                   |
| Trẻ `unclassified`                                     | Không vào cột chỉ số nào (chỉ ở trẻ được cân đo và ghi chú)                                                                                                                                      | Tính các chỉ số không null        | Ba bảng WHO cùng khoảng 0–84 tháng nên chỉ số null cùng lúc                                  |
| Tháng ở bộ lọc                                         | Tháng của các đợt/kỳ chưa hủy trong năm học ở header (mọi điểm trường trong phạm vi), mặc định tháng gần nhất; lưu trên URL                                                                      | Tháng theo điểm trường đang chọn  | Theo brief; điểm trường không có đợt/kỳ trong tháng hiện dòng "Chưa có…"                     |
| Điểm trường ở bộ lọc                                   | HT: "Tất cả điểm trường" + từng điểm trường; PHT: điểm trường quản lý được (`canManageHealthCheck`), một điểm trường ⇒ chữ                                                                       | Lấy từ response                   | Chỉ ẩn/hiện; BE vẫn chặn                                                                     |
| Chip "Số liệu chưa chốt"                               | Badge module (`GrowthReportDataBadge`, tông xanh "đang diễn ra") khi điểm trường có đợt/kỳ đang hoặc sắp diễn ra                                                                                 | Chip viết tay                     | DESIGN §6.3: trạng thái chỉ qua badge                                                        |
| Cột cố định                                            | TT, Tên lớp dính trái khi cuộn ngang; tên điểm trường ở dải cũng dính trái                                                                                                                       | Không dính                        | Brief; bảng 21 cột luôn cuộn ngang                                                           |
| Viền bảng                                              | `border-collapse: separate`, vạch vẽ theo từng ô (cạnh trái ở ô đầu dòng)                                                                                                                        | Giữ `collapse` của `.table--grid` | Với `collapse`, vạch của cột dính trái trôi theo bảng khi cuộn                               |
| Bố cục dùng chung                                      | `src/utils/children/growthReport.js` (nhóm chỉ số, dòng bảng, tỉ lệ, ghi chú) cho cả trang và Excel                                                                                              | Viết hai lần                      | Trang và file luôn cùng bố cục                                                               |
| Dòng tổng                                              | Điểm trường có đợt/kỳ luôn có Tổng MG, Tổng NT, Tổng <điểm trường> (kể cả 0); Tổng toàn trường khi > 1 điểm trường                                                                               | Ẩn dòng 0                         | Mẫu giấy của trường có đủ các dòng                                                           |
| Tỉ lệ                                                  | Tính ở client khi hiển thị, 1 chữ số thập phân (`Math.round`); Excel ghi số với định dạng `0.0` (không ghi chữ)                                                                                  | Ghi chữ "85,7"                    | Excel đổi dấu thập phân theo máy, người dùng vẫn cộng/tính được                              |
| Tháng trên URL không còn trong danh sách (đổi năm học) | Dùng tháng gần nhất của danh sách                                                                                                                                                                | Báo lỗi                           | Đổi năm học ở header không làm trang trống                                                   |
| HT gửi `campusId` lạ; tháng thiếu/sai dạng             | 404 (`CAMPUS_NOT_FOUND`); 400                                                                                                                                                                    | 403; 422                          | Khớp BE `HealthGrowthReportServiceImpl` (đọc 2026-11-04); trang chỉ gửi tháng từ danh sách   |
| `ageGroupName`                                         | Tên nhóm tuổi của lớp (`AGE_GROUPS`), null khi lớp chưa có nhóm tuổi                                                                                                                             | Tên ngắn                          | Contract không nói; trang chỉ hiện tên lớp                                                   |

## Phases

### Phase 1 — BE giả, phân loại, API

- Files: C `src/services/children/mock/whoWeightForAge.js`, `whoHeightForAge.js` (sinh từ CSV BE), `growthForAgeRule.js`, `growthReportMockRepository.js` · M `healthCheckMockRepository.js` (xuất `rosterOf`), `src/services/children/api/healthCheckApi.js`, `src/services/children/healthCheckService.js`, `src/hooks/children/useHealthChecks.js`.
- Tests: AC-1..AC-3 → `tests/health/growth-report.test.mjs`, `tests/health/growth-for-age.test.mjs`.

### Phase 2 — Màn hình, Excel

- Files: C `src/pages/children/GrowthReportPage.jsx`, `src/utils/exportXlsx.js`, `src/utils/children/growthReport.js`, `src/utils/children/growthReportSheet.js` · M `src/routes/AppRoutes.jsx`, `src/layouts/menuConfig.js`, `src/components/children/ChildBadges.jsx`, `src/styles/modules/children.css`.
- Tests: AC-5 → `tests/health/growth-report-sheet.test.mjs` (đọc lại xlsx bằng `read-excel-file/node`).

### Phase 3 — Tri thức, kiểm trên trình duyệt

- `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`, `.ai/CONTEXT_MAP.yaml`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → 0 lỗi; Playwright 1440/375.

## Test matrix

| AC         | Rule           | Test (tầng)                                     | Phase | Kết quả                                                                                                                                               |
| ---------- | -------------- | ----------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1, AC-2 | HLT-18         | `tests/health/growth-report.test.mjs` (BE giả)  | 1     | PASS 7/7                                                                                                                                              |
| AC-3       | HLT-03, HLT-18 | `tests/health/growth-for-age.test.mjs` (BE giả) | 1     | PASS 7/7 (gồm so khớp 170 dòng mỗi CSV của BE khi có repo BE cạnh bên)                                                                                |
| AC-4       | —              | thử tay trên trình duyệt                        | 2     | PASS: HT 1440 (2 điểm trường, cuộn ngang, cột dính), PHT 1 điểm trường (tháng 11 và 9/2026), 375px không tràn trang, năm học trống, giáo viên bị chặn |
| AC-5       | —              | `tests/health/growth-report-sheet.test.mjs`     | 2     | PASS 6/6; tải file thật từ nút "Xuất Excel" và đọc lại (28 vùng gộp, cố định 8 dòng, 2 cột)                                                           |

## Rủi ro & rollback

| Rủi ro                                                         | Tác động                 | Giảm thiểu                                                                    | Rollback           |
| -------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- | ------------------ |
| Lệch contract BE đang làm song song (lớp rỗng, mẫu cũ, thứ tự) | Số khác khi nối BE       | Bám contract; module `children` vẫn `demo`; ghi điểm cần BE xác nhận          | Sửa BE giả theo BE |
| Bộ ghi xlsx tự viết                                            | File Excel không mở được | Test đọc lại bằng `read-excel-file/node`; chỉ ZIP lưu không nén, XML tối giản | Quay về CSV        |

## Validation log

- [x] Khẳng định về code có `file:line` (hiện trạng ở Context)
- [x] Đổi contract ⇒ consumer cụ thể: màn mới `/children/growth-report`; không đổi màn khác
- [x] Mỗi AC có test hoặc thử tay; mỗi phase có Exit
- [x] > 8 file: một tính năng mới liền khối (BE giả + màn + Excel) — giữ 1 plan, 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (contract coordinator; HLT-20 chỉ ghi chú)
- [x] Tự review: không placeholder · không mâu thuẫn

## Progress log

### 2026-11-04 — Plan (chế độ tự chạy, không chờ duyệt)

- Commit: chưa commit
- Tiếp: Phase 1–3.

### 2026-11-04 — Phase 1–3 xong (FE, chờ BE)

- Phase 1: bảng WHO cân nặng/tuổi, chiều cao/tuổi sinh từ CSV BE (170 dòng mỗi file, khớp từng dòng); `classifyGrowth` (z làm tròn 2 chữ số HALF_UP như BMI rồi so −2); BE giả `getGrowthReport` dùng `rosterOf` (xuất từ `healthCheckMockRepository`) nên "trẻ của lớp", vắng, phiếu nháp khớp danh sách lớp của đợt/kỳ.
- Phase 2: trang `/children/growth-report`, menu "Tổng hợp cân đo" (HT, PHT), route `only(LEADERS)`, badge `GrowthReportDataBadge`, writer .xlsx, sheet builder.
- Phase 3: `docs/features/README.md` (mục mới, dòng "Báo cáo theo lớp … hoãn" gạch phần 5.1), `ROUTE_MAP.md`, `.ai/CONTEXT_MAP.yaml`.
- Verify: `npm run test:health` 94/94 · `npm run test:menu` 162/162 · `npm run test:children` 85/85 · `node scripts/verify.mjs` → `VERIFY PASS full` · `node scripts/check-ai-layer.mjs` → 0 lỗi.
- Ảnh: `d:project_capstoneprojectweb.playwright-mcpgrowth-report-ht-1440.png`, `growth-report-pht.png`, `growth-report-375.png`, `growth-report-375-table-scrolled.png`, `growth-report-empty-year.png`, `growth-report-teacher-blocked.png`, `growth-report-excel.png` (dựng lại từ file tải về).
- Đối chiếu BE `HealthGrowthReportServiceImpl` (đọc, không sửa): BE giả đổi theo BE — mọi lớp của điểm trường có dòng (kể cả 0), tháng thiếu/sai dạng ⇒ 400; HT `campusId` lạ ⇒ 404 vốn đã khớp. Khác còn lại (không đổi số trong thực tế): BE vẫn đếm chỉ số không null khi một chỉ số null; BE giả coi cả lần đo là chưa xếp được (ba bảng WHO cùng khoảng 0–84 tháng nên như nhau).
- Coordinator: đồng bộ `docs/integration/be-api-routes.json` (`check-api-contract --sync`, thêm `GET /health-checks/growth-report`); BE `VERIFY PASS full | tests 1055`, FE `VERIFY PASS full`.
- Commit: commit, push lên nhánh feature, mã G94-180 (user cho phép 2026-11-04).
