---
title: Sức khỏe — thêm vòng đầu, vòng cánh tay và cờ sàng lọc trung tính
status: cancelled        # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: dev
modules: [health, child]
rules: [HLT-01, HLT-02, HLT-04, HLT-05, PAR-02]
risk: high           # dữ liệu sức khỏe (ROUTER bảng 2), đề xuất contract health mới (PROPOSED), đổi nhãn hiển thị ở 3 màn hình
created: 2026-10-15
updated: 2026-10-15
---
# Sức khỏe — thêm vòng đầu, vòng cánh tay và cờ sàng lọc trung tính

> **Đã thay thế (2026-10-15):** user bỏ vòng cánh tay, thêm đợt khám, đánh giá vận động và phiếu theo dõi. Xem `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md`. Không làm theo plan này.

Plan chỉ phần client. BE chưa có API health; user quyết định FE dẫn nghiệp vụ, BE theo sau (2026-10-15). Contract đề xuất ở mục "Đề xuất cho BE". Tài liệu BE đọc ở bản local `D:/project_capstone/project/be/CareNest_BE` (không có `../CareNest_BE`).

## Context
Nhà trường muốn đo thêm vòng đầu và vòng cánh tay để theo dõi tăng trưởng và sàng lọc dinh dưỡng. Số đo có thể đến từ đợt khám y tế (bác sĩ báo lại, giáo viên nhập).

Hiện trạng:
- Form nhập chỉ có ngày đo, chiều cao, cân nặng, ghi chú (`src/pages/children/HealthMeasurementFormPage.jsx:28`, các field ở `:211-262`). Validation ở `src/utils/children/childrenValidation.js:59-74`.
- Mock rule BMI dùng ngưỡng placeholder nhưng vẫn trả nhãn "Suy dinh dưỡng/Béo phì" (`src/services/children/mock/nutritionRule.js:3-29`, nhãn `src/models/children/childrenConstants.js:54-66`, badge đỏ `src/components/children/ChildBadges.jsx:17-25`). Điều này trái Known pitfalls của `BE:docs/modules/health.md` ("chưa có chuẩn ⇒ không gắn nhãn suy dinh dưỡng/thừa cân"). Incident `FE-CASE-261014-health-role-flow-alignment` đang mở cho điểm này.
- Mock lưu/công bố ở `src/services/children/mock/childrenMockRepository.js:644-705`; AI giả ở `:708-770`; seed ở `src/mocks/childrenSeed.js:20-50`. Dữ liệu demo nằm trong localStorage (`src/mocks/mockDatabase.js:9`), bản ghi cũ đã lưu sẵn `nutritionStatus`.
- Hiển thị: Sổ sức khỏe `src/pages/children/ChildHealthRecordPage.jsx:98-115` (lần đo gần nhất), `:225-250` (bảng); Xu hướng `src/pages/children/HealthTrendPage.jsx:274-300` (biểu đồ, chú thích), `:318-326` (bảng); biểu đồ `src/components/children/GrowthChart.jsx:76-90`; trục theo nhóm tuổi `src/models/children/childrenConstants.js:108-120`.

## Quyết định đã chốt
1. Thêm vòng đầu và vòng cánh tay. Mục đích: theo dõi tăng trưởng và sàng lọc dinh dưỡng có cờ — user, 2026-10-15.
2. Bắt buộc đo cả 4 chỉ số ở mọi lần đo, mọi nhóm tuổi — user, 2026-10-15.
3. Người đo là nhân viên y tế hoặc giáo viên. Nhân viên y tế không có tài khoản: giáo viên phụ trách lớp nhập và ghi nguồn số đo. Không đổi vai trò, quyền giữ nguyên (`src/utils/children/childrenPermissions.js:51-55`) — user, 2026-10-15 (actor nhập/sửa/công bố đã chốt 2026-10-14).
4. Cờ do hệ thống tính theo chuẩn tham chiếu (BE giữ rule). Kết luận của bác sĩ ghi riêng — user, 2026-10-15.
5. Nhãn cờ trung tính: "Trong ngưỡng" / "Cần theo dõi – thấp" / "Cần theo dõi – cao" / "Chưa phân loại được". Bỏ "Suy dinh dưỡng/Béo phì" — user, 2026-10-15.
6. Phụ huynh xem số đo, biểu đồ và kết luận khám của bản đã công bố; không xem cờ — user, 2026-10-15.
7. FE đề xuất nghiệp vụ và contract, BE làm theo sau — user, 2026-10-15.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor: giáo viên/tổ trưởng phụ trách lớp của trẻ nhập, sửa, công bố; Phó hiệu trưởng (campus) và Hiệu trưởng xem; phụ huynh xem trên APP. Outcome: mỗi lần đo có 4 chỉ số, nguồn số đo, cờ sàng lọc tham khảo từng chỉ số, kết luận khám khi có. Rule: HLT-01 (CONFIRMED, cần mở rộng chỉ số) · HLT-02, HLT-04, HLT-05 (CONFIRMED) · HLT-03/P-13 chuẩn tham chiếu (PENDING) · PAR-02 (ACCEPTED) · PAR-03/P-13b field phụ huynh xem (PENDING, user nêu ở quyết định 6). Flow: `[B]` đợt đo hoặc đợt khám y tế → `[S]` giáo viên nhập 4 chỉ số + nguồn → `[S]` BE tính BMI và cờ từng chỉ số → `[S]` giáo viên xem lại, công bố → APP phụ huynh thấy số đo, biểu đồ, kết luận khám.
- **Đối chiếu thiết kế ban đầu:** HLT-01 chỉ ghi "chiều cao, cân nặng, tình trạng sức khỏe, ghi chú" (`BE:docs/business/BUSINESS_RULES.md:61`) — yêu cầu thêm 2 chỉ số. Flow ghi "chưa chọn chuẩn ⇒ chưa gắn cờ bất thường" (`BE:docs/business/flows/health-check.md:10`) — yêu cầu cần cờ; plan dùng ngưỡng tạm, ghi rõ trên UI, chờ P-13. Exclusions "chẩn đoán y tế" (`BE:docs/context/PROJECT_CONTEXT.md:66`) — cờ chỉ là sàng lọc theo ngưỡng với nhãn trung tính; kết luận khám là ghi nhận lời bác sĩ bên ngoài, hệ thống không tự kết luận.
- **Ảnh hưởng:** module `health` (chủ), `child` (scope lớp/campus). FE: `/children/:id/health`, `/children/:id/health/new`, `/children/:id/health/:measurementId/edit`, `/children/health-trends`. APP: màn sức khỏe phụ huynh (thêm 2 chỉ số và kết luận khám, không hiện cờ). AI: input `interpretHealthTrend` thêm 2 chỉ số. Dữ liệu cũ: lần đo trước tính năng không có 2 chỉ số ⇒ `null`, hiển thị "—".

### Câu hỏi mở
- [ ] "Mọi độ tuổi đang có trong nhà trẻ" là cả 4 nhóm tuổi hiện có, từ Nhà trẻ 24–36 tháng đến Mẫu giáo lớn 5–6 tuổi (`src/models/School.js:28-33`)? Đề xuất: đúng.
- [ ] Khi sửa một lần đo cũ (trước tính năng), 2 chỉ số mới không bắt buộc, vì không có số đo của ngày đó. Đề xuất: đồng ý.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Mục đích đo 2 chỉ số mới | Theo dõi tăng trưởng + sàng lọc dinh dưỡng có cờ; số đo có thể từ đợt khám y tế | user | 2026-10-15 | `docs/features/README.md` |
| Đo nhóm tuổi nào, bắt buộc không | Mọi độ tuổi, bắt buộc | user | 2026-10-15 | `docs/features/README.md` |
| Ai đo | Nhân viên y tế và giáo viên | user | 2026-10-15 | `docs/features/README.md` |
| Nhân viên y tế có tài khoản không | Không, giáo viên nhập, ghi nguồn số đo | user | 2026-10-15 | `docs/features/README.md` |
| Nguồn cờ | Hệ thống tính + ghi kết luận bác sĩ | user | 2026-10-15 | `docs/features/README.md` |
| Nhãn cờ | Trung tính | user | 2026-10-15 | `docs/features/README.md` |
| Phụ huynh xem gì | Số đo, biểu đồ, kết luận khám; không xem cờ | user | 2026-10-15 | `docs/features/README.md` |

## Acceptance criteria
- **AC-1** (`HLT-01`): Given giáo viên phụ trách lớp tạo lần đo mới, When để trống vòng đầu hoặc vòng cánh tay, Then không lưu được và field đó báo lỗi.
- **AC-2** (`HLT-01`): Given lần đo cũ chưa có 2 chỉ số mới, When giáo viên sửa chiều cao, Then lưu được khi 2 chỉ số mới để trống; bảng và biểu đồ hiện "—" hoặc bỏ qua điểm đó.
- **AC-3** (`HLT-01`): Given form nhập số đo, When chọn nguồn "Đợt khám y tế", Then hiện "Đơn vị/người khám" và "Kết luận khám"; When chọn "Giáo viên đo tại lớp", Then ẩn 2 field này.
- **AC-4** (`HLT-02`): Given trẻ có ≥2 lần đo, When mở Sổ sức khỏe và Xu hướng sức khỏe, Then thấy đủ 4 chỉ số, biểu đồ vòng đầu và vòng cánh tay bên cạnh biểu đồ chiều cao, cân nặng.
- **AC-5** (`HLT-04`; P-13 PENDING): Given một lần đo đã lưu, Then cờ chỉ dùng nhãn trung tính, nêu chỉ số nào cần theo dõi, kèm ghi chú "ngưỡng tham chiếu tạm"; trong `src/` không còn chữ "Suy dinh dưỡng", "Béo phì", `MALNOURISHED`, `OBESE`.
- **AC-6** (P-13 PENDING): Given trẻ trên 60 tháng tuổi tại ngày đo, Then cờ vòng đầu và vòng cánh tay là "Chưa phân loại được", số đo vẫn lưu.
- **AC-7** (`PAR-02`; P-13b PENDING): Given giáo viên công bố kết quả, Then hộp xác nhận ghi rõ phụ huynh xem số đo, biểu đồ, kết luận khám, không xem cờ sàng lọc.
- **AC-8** (`HLT-01`): Given lần đo đã công bố, When sửa vòng đầu, Then bắt buộc lý do sửa và lịch sử sửa có dòng "Vòng đầu (cm)" với giá trị cũ và mới.
- **AC-9** (`HLT-04`, `HLT-05`): Given phân tích xu hướng AI, Then input có 2 chỉ số mới, không có tên trẻ; bản DRAFT không dùng nhãn chẩn đoán.
- **AC-10** (`HLT-01`): Given trình duyệt còn dữ liệu demo cũ trong localStorage, When mở Sổ sức khỏe, Then trang hiển thị đúng cờ mới, không lỗi.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Mô hình chỉ số | 2 field cố định `headCircumferenceCm`, `armCircumferenceCm` | Danh sách chỉ số tổng quát `indicators[]` | Chỉ số cố định theo chuẩn tăng trưởng; form và biểu đồ đơn giản; chưa có yêu cầu chỉ số cấu hình được |
| Dạng cờ | `screening: [{ indicator, flag }]` + `screeningStatus` tổng | Giữ 1 `nutritionStatus` | Hiện rõ chỉ số nào cần theo dõi; BE thêm chỉ số (cân nặng/tuổi, chiều cao/tuổi) mà FE không phải đổi cấu trúc |
| Ngưỡng trong mock | Ngưỡng tạm, `reference.code = 'PLACEHOLDER'`, UI ghi "ngưỡng tham chiếu tạm" | Chép bảng chuẩn WHO vào mock | FE không giữ business rule; tránh chép sai số liệu chuẩn y tế; P-13 chưa chốt |
| Kết luận bác sĩ | Field riêng `examConclusion`, chỉ khi nguồn = Đợt khám y tế | Gộp vào `note` | BE áp policy hiển thị riêng cho phụ huynh (quyết định 6) mà không đụng ghi chú khám |
| Dữ liệu demo cũ | Mock tính lại cờ khi đọc (`toMeasurementView`) | Đổi `DB_KEY` để reset | Đổi khóa xóa dữ liệu demo của mọi module; tính khi đọc giống BE trả giá trị dẫn xuất |
| Phạm vi plan | Plan này: 4 chỉ số + cờ + hiển thị + công bố | Gộp cả nhập theo lớp, tiến độ đợt đo, cảnh báo số đo bất thường, báo cáo BGH | Plan này đã >8 file; phần còn lại phụ thuộc contract của plan này ⇒ plan sau |

## Phases
### Phase 1 — Cờ sàng lọc trung tính (thay nhãn BMI hiện tại)
- Files: M `src/models/children/childrenConstants.js` · M `src/services/children/mock/nutritionRule.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/components/children/ChildBadges.jsx` · M `src/components/children/GrowthChart.jsx` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/pages/children/HealthTrendPage.jsx` · M `src/styles/modules/children.css`
- Steps:
  1. Thay `NUTRITION_STATUS` bằng `SCREENING_FLAG` (`IN_RANGE`, `WATCH_LOW`, `WATCH_HIGH`, `UNAVAILABLE`), `SCREENING_STATUS` (`IN_RANGE`, `WATCH`, `UNAVAILABLE`), nhãn trung tính và nhãn chỉ số (`BMI_FOR_AGE`, …).
  2. Mock rule trả `screening`, `screeningStatus`, `reference`; ngưỡng BMI giữ placeholder. Mock tính lại khi đọc để dữ liệu demo cũ vẫn đúng (AC-10).
  3. `ScreeningBadge` thay `NutritionBadge`: "Cần theo dõi" dùng tông cảnh báo (không đỏ), theo `DESIGN.md` mục 3.2.
  4. 3 trang, `GrowthChart` và chú thích biểu đồ dùng nhãn mới; khung kết quả sau lưu ghi "ngưỡng tham chiếu tạm, chưa phải chẩn đoán".
  5. AI giả: thay kiểm tra `MALNOURISHED`/`OBESE` bằng `screeningStatus === 'WATCH'`.
- Tests: AC-5, AC-10 → kiểm tra thủ công trên trình duyệt (vai giáo viên + Phó hiệu trưởng) và `grep -rn -E "Suy dinh dưỡng|Béo phì|MALNOURISHED|OBESE" src` → 0 kết quả.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; lệnh tự kiểm `DESIGN.md` mục 13.1 đạt.
- **Dừng chờ user review.**

### Phase 2 — Vòng đầu, vòng cánh tay, nguồn số đo, kết luận khám
- Files: M `src/models/children/childrenConstants.js` · M `src/utils/children/childrenValidation.js` · M `src/services/children/mock/nutritionRule.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/mocks/childrenSeed.js` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/pages/children/HealthTrendPage.jsx`
- Steps:
  1. Typedef, `MEASUREMENT_FIELD_LABELS`, `MEASUREMENT_SOURCE` (`CLASS_MEASUREMENT` = "Giáo viên đo tại lớp", `MEDICAL_CHECK` = "Đợt khám y tế"), trục biểu đồ 2 chỉ số mới theo nhóm tuổi (chỉ là khung hiển thị).
  2. Validation hỗ trợ nhập liệu: bắt buộc khi tạo mới; khoảng nhập vòng đầu 35–60 cm, vòng cánh tay 8–30 cm, bước 0,1; lần đo cũ thiếu chỉ số thì không bắt buộc khi sửa; "Đơn vị/người khám" ≤100 ký tự, "Kết luận khám" ≤500 ký tự.
  3. Mock: lưu field mới, ghi lịch sử sửa cho field mới, cờ vòng đầu và vòng cánh tay theo ngưỡng tạm; trên 60 tháng ⇒ `UNAVAILABLE` (AC-6).
  4. Seed: thêm 2 chỉ số cho các lần đo trừ lần đầu (minh họa dữ liệu cũ); vài lần đo nguồn "Đợt khám y tế" với đơn vị khám và kết luận mẫu chung chung, không dữ liệu thật.
  5. Form: chọn nguồn số đo; "Đơn vị/người khám" và "Kết luận khám" chỉ hiện khi nguồn là đợt khám; thêm 2 ô số; khung kết quả sau lưu hiện 4 chỉ số và cờ từng chỉ số.
  6. Sổ sức khỏe: thẻ lần đo gần nhất và bảng thêm 2 chỉ số, nguồn số đo; hộp xác nhận công bố ghi rõ phụ huynh xem gì (AC-7). Bảng rộng cuộn ngang trong card, kiểm ở 375px.
  7. Xu hướng: thêm 2 biểu đồ (bỏ qua lần đo thiếu chỉ số), bảng thêm 2 cột.
  8. AI giả: input thêm 2 chỉ số; vòng đầu giảm ⇒ gợi ý kiểm tra lại cách đo (không kết luận sức khỏe).
- Tests: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9 → kiểm tra thủ công trên trình duyệt (dev server, vai giáo viên phụ trách lớp, Phó hiệu trưởng, Hiệu trưởng).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; lệnh tự kiểm `DESIGN.md` mục 13.1 đạt.
- **Dừng chờ user review.**

Sau Phase 2: cập nhật `FE-CASE-261014-health-role-flow-alignment` (điểm BMI placeholder), `docs/knowledge/ISSUE_INDEX.md`, `docs/features/README.md`; chạy `node scripts/check-ai-layer.mjs`.

## Đề xuất cho BE (chưa sửa repo BE — cần user cho phép)
- `BE:docs/business/BUSINESS_RULES.md` HLT-01: chỉ số gồm chiều cao, cân nặng, vòng đầu, vòng cánh tay; bắt buộc mọi lần đo, mọi nhóm tuổi; nguồn số đo (giáo viên đo tại lớp / đợt khám y tế); giáo viên phụ trách lớp nhập.
- P-13: đề xuất chuẩn WHO (BMI theo tuổi; vòng đầu theo tuổi 0–60 tháng; vòng cánh tay theo tuổi 3–60 tháng). Trẻ trên 60 tháng không có chuẩn cho 2 chỉ số này ⇒ "Chưa phân loại được". Nhãn trung tính theo quyết định 5.
- P-13b: phụ huynh xem số đo, biểu đồ, kết luận khám của bản đã công bố; không xem cờ.
- Contract PROPOSED:
  - `POST /children/{childId}/health/measurements`, `PUT …/{measurementId}` body: `{ date, source: 'CLASS_MEASUREMENT'|'MEDICAL_CHECK', examinerName?, heightCm, weightKg, headCircumferenceCm, armCircumferenceCm, note?, examConclusion?, reason? }`.
  - Measurement trả về thêm: `headCircumferenceCm|null`, `armCircumferenceCm|null`, `source`, `examinerName`, `examConclusion`, `screening: [{ indicator: 'BMI_FOR_AGE'|'HEAD_CIRCUMFERENCE_FOR_AGE'|'ARM_CIRCUMFERENCE_FOR_AGE', flag: 'IN_RANGE'|'WATCH_LOW'|'WATCH_HIGH'|'UNAVAILABLE' }]`, `screeningStatus: 'IN_RANGE'|'WATCH'|'UNAVAILABLE'`, `reference: { code, label }`; bỏ `nutritionStatus`.
  - API phụ huynh (APP): không trả `screening`, `screeningStatus`.
- `BE:docs/modules/ai-assistance.md`: input `interpretHealthTrend` thêm 2 chỉ số.
- Exclusions: ghi rõ "kết luận khám" là ghi nhận lời bác sĩ, hệ thống không tự chẩn đoán.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | HLT-01 | Thủ công trình duyệt: form tạo mới | 2 | chưa chạy |
| AC-2 | HLT-01 | Thủ công: sửa lần đo cũ trong seed | 2 | chưa chạy |
| AC-3 | HLT-01 | Thủ công: đổi nguồn số đo | 2 | chưa chạy |
| AC-4 | HLT-02 | Thủ công: Sổ sức khỏe, Xu hướng | 2 | chưa chạy |
| AC-5 | HLT-04 | Thủ công + `grep` nhãn cũ trong `src` | 1 | chưa chạy |
| AC-6 | P-13 | Thủ công: trẻ Mẫu giáo lớn trên 60 tháng | 2 | chưa chạy |
| AC-7 | PAR-02 | Thủ công: hộp xác nhận công bố | 2 | chưa chạy |
| AC-8 | HLT-01 | Thủ công: sửa bản đã công bố, xem lịch sử | 2 | chưa chạy |
| AC-9 | HLT-04, HLT-05 | Đọc input AI giả trong mock + thủ công panel AI | 2 | chưa chạy |
| AC-10 | HLT-01 | Thủ công: giữ localStorage cũ, mở Sổ sức khỏe | 1 | chưa chạy |

Repo chưa có framework unit test (`package.json` chỉ có `dev`, `build`, `preview`, `lint`); thêm framework là thêm dependency ⇒ phải hỏi user, không nằm trong plan này.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| BE chọn chuẩn, nhãn hoặc field khác đề xuất | Sửa lại FE | Contract gom ở constants + mock; UI chỉ đọc giá trị trả về | Revert commit của phase |
| Ngưỡng tạm bị hiểu là chuẩn thật | Giáo viên báo sai cho phụ huynh | UI ghi "ngưỡng tham chiếu tạm"; phụ huynh không xem cờ | — |
| Kết luận khám chứa chẩn đoán của bác sĩ | Hiển thị cho phụ huynh | Hint "ghi đúng lời bác sĩ đã báo"; nhãn "Theo kết luận khám"; BE xác nhận ở Exclusions | Ẩn field nếu BE không đồng ý |
| Bảng Sổ sức khỏe quá rộng | Tràn ngang ở màn hẹp | Cuộn ngang trong card; kiểm 375px | — |
| Dữ liệu demo cũ trong localStorage | Trang lỗi khi thiếu field mới | Mock tính lại cờ khi đọc; field mới thiếu ⇒ `null` | "Khôi phục dữ liệu demo" ở menu người dùng |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `HealthMeasurementFormPage`, `ChildHealthRecordPage`, `HealthTrendPage`, `GrowthChart`, `ChildBadges`, mock AI; APP màn sức khỏe phụ huynh
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách plan (nhập theo lớp, tiến độ đợt đo, cảnh báo số đo bất thường, báo cáo BGH để plan sau)
- [x] Không dùng rule PENDING/OPEN như đã chốt (P-13, P-13b ghi PENDING; ngưỡng là tạm)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-15 — Plan draft (chờ review)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Khác plan: —
- Tiếp: user trả lời 2 câu hỏi mở và duyệt plan ⇒ Phase 1.
