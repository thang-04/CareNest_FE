---
title: Kỳ cân đo do HT/PHT mở; đợt khám sức khỏe 1 lần/năm
status: done
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # cần xác nhận có task Jira riêng cho việc này trước khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [health]
rules: [HLT-01, HLT-08, HLT-09]
risk: high
created: 2026-10-31
updated: 2026-10-31
---

# Kỳ cân đo do HT/PHT mở; đợt khám sức khỏe 1 lần/năm

## Context

- User (2026-10-31), sau khi hỏi lại trường: đợt khám sức khỏe là 1 lần/năm; cân đo ngoài đợt là 3 tháng/lần.
- Tài liệu BE đang ghi khác:
  - HLT-01 ghi "đo định kỳ … mặc định 3 lần/năm, chu kỳ cấu hình được" (`BE:docs/business/BUSINESS_RULES.md:128`).
  - HLT-08 ghi "bác sĩ khám sức khỏe định kỳ 2 lần/năm (đợt khám)" (`BE:docs/business/BUSINESS_RULES.md:135`).
- Mock FE hiện tại:
  - Đợt khám chỉ có một loại, không có trường `kind` (`src/models/children/healthCheckConstants.js:1-23`).
  - Chỉ Hiệu trưởng tạo, sửa, đóng đợt (`src/utils/children/childrenPermissions.js:82`; route `src/routes/AppRoutes.jsx:367`, `:372`).
  - Mỗi điểm trường có tối đa 1 đợt chưa đóng (`src/services/children/mock/healthCheckRule.js:27-28`).
  - Cân đo ngoài đợt: giáo viên nhập lúc nào cũng được, kết quả có `campaignId = null` (`src/services/children/mock/childrenMockRepository.js:1395-1460`, `:1449`). Nút "Nhập số đo" ở Sổ sức khỏe luôn hiện với giáo viên lớp (`src/pages/children/ChildHealthRecordPage.jsx:81-82`, `:271-272`).
  - Code đang coi "có `campaignId`" là "lần khám có bác sĩ", ở 3 chỗ:
    - Lần khám trước: `src/services/children/mock/healthCheckMockRepository.js:85-88`.
    - `latestHealth` của danh sách trẻ: `childrenMockRepository.js:366`.
    - Khối "đợt đang diễn ra" ở Sổ sức khỏe: `childrenMockRepository.js:1352-1372`.
- Hai mẫu báo cáo trường gửi là ví dụ đầu ra về sau, chưa làm trong plan này:
  - 5.1 "Kết quả theo dõi cân nặng - chiều cao - BMI" theo lớp, theo tháng cân đo.
  - 5.3 "Theo dõi khám sức khỏe" theo lớp, theo lần khám.
- Repo BE đang merge dở; `BUSINESS_RULES.md` đang xung đột. Plan này không sửa BE. Phần BE cần đổi ở mục "Đề xuất cho BE".

## Quyết định đã chốt

1. **D1:** Thêm **kỳ cân đo**. Kỳ là một bản ghi do HT/PHT tạo, gồm tên, điểm trường, từ ngày, đến ngày, ghi chú. Đợt khám sức khỏe hằng năm cũng tính là một kỳ cân đo. — user, 2026-10-31.
2. **D2:** HT và PHT đều tạo, sửa, đóng, mở lại, hủy được cả kỳ cân đo lẫn đợt khám. PHT chỉ làm cho điểm trường của mình; HT làm cho mọi điểm trường. Giáo viên nhập kết quả cho lớp mình (HLT-09). — user, 2026-10-31.
3. **D3:** Không có chu kỳ cấu hình và không có nhắc tự động. Khi HT/PHT tạo kỳ cân đo hoặc đợt khám mà ngày bắt đầu cách ngày bắt đầu của kỳ/đợt khác cùng điểm trường **dưới 2 tháng 15 ngày**, hệ thống cảnh báo trước khi tạo. Người tạo vẫn tạo tiếp được. — user, 2026-10-31.
4. **D4:** Đợt khám mặc định 1 lần/năm học, không chặn cứng. Tạo thêm đợt (khám bù, khám đột xuất) thì có cảnh báo. — user, 2026-10-31.
5. **D5:** Giáo viên chỉ nhập số đo trong kỳ cân đo hoặc đợt khám **đang diễn ra**. Bỏ nhập lẻ ở Sổ sức khỏe. Kết quả cũ ngoài đợt (`campaignId = null`) vẫn hiện như hiện nay. — user, 2026-10-31.
6. **D6:** Hoãn báo cáo 5.1 và 5.3, phân loại WHO cho báo cáo (lệch HLT-10 và mock 17/10), và nhóm bệnh RHM/TMH/Tim/Khác. Dữ liệu từng trẻ gắn với kỳ/đợt qua `campaignId`, đủ để làm báo cáo sau. — user, 2026-10-31 ("tạm thời chưa làm").

**Mặc định (tự chọn, user đổi được):**
- **M1:** "Cách nhau dưới 2 tháng 15 ngày" so ngày bắt đầu với ngày bắt đầu, xét cả hai chiều (kỳ/đợt ở trước hoặc sau). Các kỳ/đợt so với nhau gồm mọi kỳ/đợt cùng điểm trường, cả hai loại, trừ kỳ/đợt đã hủy và chính nó khi sửa. Ngưỡng tính theo lịch: `start + 2 tháng + 15 ngày`. Đúng bằng ngưỡng thì không cảnh báo.
- **M2:** Cảnh báo riêng cho đợt khám: năm học (theo ngày bắt đầu, như HLT-08 Y-4) đã có đợt khám khác chưa hủy. Hai cảnh báo có thể hiện cùng lúc.
- **M3:** Giữ quy tắc mỗi điểm trường tối đa 1 kỳ/đợt chưa đóng, tính chung cả hai loại. Nhờ đó giáo viên luôn biết đang nhập cho kỳ/đợt nào. Tạo khi đang có kỳ/đợt chưa đóng vẫn bị chặn (422), như hiện nay.
- **M4:** Kết quả cũ ngoài đợt vẫn sửa được (sửa số đo kèm lý do như hiện nay), không tạo mới được.
- **M5:** Cảnh báo lấy qua API xem trước, theo mẫu `duplicate-check` của tiếp nhận trẻ. BE không chặn. Không dùng cờ "xác nhận" trong POST.
- **M6:** Trạng thái trẻ trong kỳ cân đo:
  - Chưa cân đo.
  - Đã cân đo.
  - Vắng cân đo (khi đóng kỳ mà trẻ chưa có kết quả).

  Kỳ cân đo không có trạng thái nháp hay chưa kết luận.
- **M7:** Lần đo trong kỳ cân đo có nguồn `MEASUREMENT_ONLY`, giống cân đo ngoài đợt hiện nay: không kết luận bác sĩ, không mở phiếu theo dõi, công bố ngay khi lưu. Không tính là "lần khám trước", không tính vào mức theo dõi ở `latestHealth`.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:**
  - Actor: HT, PHT (mở kỳ/đợt), giáo viên (nhập lớp mình).
  - Outcome: mỗi lần đo thuộc một kỳ/đợt; biết trẻ nào chưa cân.
  - Rule: HLT-01, HLT-08, HLT-09 (CONFIRMED, cần sửa theo D1–D5).
  - Flow:
    - `[HT/PHT]` tạo kỳ hoặc đợt → `[S]` cảnh báo nếu sát → `[HT/PHT]` xác nhận.
    - `[GV]` nhập từ danh sách lớp của kỳ/đợt đang diễn ra → `[HT/PHT]` đóng → `[S]` trẻ chưa có kết quả thành "Vắng".
- **Đối chiếu thiết kế ban đầu:**
  - HLT-01 "3 lần/năm, cấu hình được" ⇒ kỳ cân đo mở tay, cảnh báo dưới 2 tháng 15 ngày.
  - HLT-08 "2 lần/năm" ⇒ 1 lần/năm, không chặn.
  - Mock: chỉ HT quản lý đợt ⇒ thêm PHT. Cân đo lẻ bất kỳ lúc nào ⇒ chỉ trong kỳ/đợt.
- **Ảnh hưởng:**
  - Module health (FE: `src/services/children/`, `tests/health/`).
  - Quyền: PHT có thêm quyền ghi.
  - Màn hình FE:
    - `/children/health-checks` (danh sách, tạo, sửa, chi tiết, danh sách lớp).
    - `/children/:id/health/new`.
    - Sổ sức khỏe `/children/:id/health`.
  - APP: phụ huynh vẫn xem kết quả cân đo như cũ.
  - Dữ liệu cũ: đợt không có `kind` ⇒ coi là `EXAM`. Kết quả `campaignId = null` giữ nguyên.

### Câu hỏi mở

Đã trả lời hết (2 vòng, 2026-10-31).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Kỳ cân đo định nghĩa thế nào | Bản ghi do PHT/HT tạo; đợt khám cũng là 1 kỳ cân đo (D1) | user | 2026-10-31 | Đề xuất HLT-01 |
| Chu kỳ 3 tháng áp dụng thế nào | HT/PHT mở tay; mở sát nhau thì cảnh báo trước khi tạo (D3) | user | 2026-10-31 | Đề xuất HLT-01 |
| "Sát nhau" là bao nhiêu | Dưới 2 tháng 15 ngày (D3, M1) | user | 2026-10-31 | Đề xuất HLT-01 |
| Đợt khám 1 lần/năm có chặn không | Mặc định, không chặn (D4, M2) | user | 2026-10-31 | Đề xuất HLT-08 |
| Ai tạo kỳ cân đo, đợt khám | HT và PHT, cả hai loại (D2) | user | 2026-10-31 | Đề xuất HLT-08 |
| Còn cân đo lẻ ngoài kỳ không | Không; chỉ trong kỳ/đợt đang mở (D5) | user | 2026-10-31 | Đề xuất HLT-01 |
| Phân loại WHO cho 5.1 theo HLT-10 hay mock | Tạm chưa làm (D6) | user | 2026-10-31 | — |
| Nhóm bệnh RHM/TMH/Tim/Khác cho 5.3 | Tạm chưa làm (D6) | user | 2026-10-31 | — |
| Làm báo cáo 5.1, 5.3 trong plan này không | Hoãn cả hai (D6) | user | 2026-10-31 | — |

## Acceptance criteria

- **AC-1** (`HLT-08`, D2): Given PHT điểm trường A, When tạo đợt khám hoặc kỳ cân đo cho điểm trường A, Then lưu được. When tạo cho điểm trường B, Then 422 `campusId`. Given HT, Then tạo được cho mọi điểm trường. Given giáo viên, Then không có nút tạo; API trả 403.
- **AC-2** (`HLT-01`, D1): Given form tạo, When chọn loại "Kỳ cân đo", Then form không có ô "Đơn vị khám / bác sĩ". Sau khi lưu, danh sách ghi loại "Kỳ cân đo"; danh sách lọc được theo loại và theo năm học như hiện nay.
- **AC-3** (`HLT-01`, D3, M1): Given điểm trường A có kỳ/đợt chưa hủy bắt đầu ngày 01/09, When tạo kỳ bắt đầu trước ngày 16/11, Then hộp xác nhận nêu tên, loại và ngày bắt đầu của kỳ/đợt đó. Bấm "Vẫn tạo" thì lưu; bấm "Quay lại" thì không lưu. When bắt đầu từ ngày 16/11 trở đi, Then không có cảnh báo. Kỳ/đợt đã hủy không gây cảnh báo.
- **AC-4** (`HLT-08`, D4, M2): Given năm học 2026–2027 của điểm trường A đã có đợt khám chưa hủy, When tạo đợt khám thứ hai cùng năm học, Then hộp xác nhận nêu đợt đã có. Vẫn tạo được.
- **AC-5** (M3): Given điểm trường A đang có kỳ cân đo chưa đóng, When tạo đợt khám cho A, Then 422 nêu tên kỳ đang mở (như quy tắc hiện nay).
- **AC-6** (`HLT-09`, D5, M6): Given kỳ cân đo đang diễn ra, When giáo viên lớp mở danh sách lớp của kỳ và bấm "Nhập số đo", Then form chỉ có chiều cao, cân nặng, vòng đầu (trẻ ≤60 tháng), ghi chú. Ngày đo giới hạn trong khoảng của kỳ; có nút "Lưu và nhập trẻ tiếp theo". Danh sách lớp hiện "Chưa cân đo" / "Đã cân đo". Khi HT/PHT đóng kỳ, Then trẻ chưa có kết quả thành "Vắng cân đo" và kết quả bị khóa tới khi mở lại.
- **AC-7** (D5, M4): Given điểm trường không có kỳ/đợt đang diễn ra, When giáo viên mở Sổ sức khỏe, Then không có nút "Nhập số đo". POST số đo không có `campaignId` của kỳ cân đo đang diễn ra ⇒ 422. Kết quả cũ ngoài đợt vẫn hiện và vẫn sửa được kèm lý do.
- **AC-8** (M7): Given trẻ có lần đo trong kỳ cân đo sau lần khám gần nhất, Then "lần khám trước" ở phiếu khám và mức theo dõi ở danh sách trẻ vẫn lấy từ lần khám có bác sĩ, không lấy lần đo của kỳ.
- **AC-9**: Given localStorage còn đợt khám demo cũ (không có `kind`), When mở danh sách, chi tiết, Sổ sức khỏe, Then đợt cũ hiện là "Đợt khám", không lỗi.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Mô hình kỳ cân đo | Mở rộng đợt khám hiện có thêm `kind: EXAM \| MEASUREMENT`, dùng chung `campaignId`, danh sách, chi tiết, đóng/mở lại/hủy, phạm vi năm học | (b) Thực thể riêng `measurementRounds` + `roundId`; (c) "đợt sức khỏe" chung có cờ "có khám" | (a) dùng lại gần hết luồng và quy tắc đã có (một kỳ/đợt chưa đóng, năm học Y-4, khóa khi đóng). Đợt khám "cũng là một kỳ cân đo" thành tự nhiên. (b) phải lặp lại toàn bộ vòng đời. (c) đổi tên và contract nhiều hơn mà không thêm lợi ích |
| Cảnh báo sát nhau | API xem trước `GET /health-checks/schedule-warnings` | Cờ `acknowledgeWarnings` trong POST, 409 kèm danh sách | Giống `duplicate-check` của tiếp nhận trẻ. POST giữ đơn giản; BE không cần trạng thái "đã xác nhận" |
| Nhận biết "lần khám" | Theo `kind` của đợt (hoặc `m.exam`) thay cho `!!m.campaignId` | Giữ `campaignId` chỉ cho đợt khám, thêm `roundId` | Một khóa nối cho mọi kỳ/đợt; sửa đúng 3 chỗ đang suy luận từ `campaignId` |

## Phases

### Phase 1 — BE giả và quy tắc

- Files:
  - M `src/models/children/healthCheckConstants.js`: `CAMPAIGN_KIND`, nhãn theo loại, nhãn trạng thái trẻ theo loại.
  - M `src/services/children/mock/healthCheckRule.js`: `kindOf` (mặc định `EXAM`), hàm tính cảnh báo theo M1, M2, ngưỡng 2 tháng 15 ngày.
  - M `src/services/children/mock/healthCheckMockRepository.js`:
    - `assertManage(user, campusId)` cho HT/PHT.
    - `createHealthCheck`, `updateHealthCheck` nhận `kind`; `kind` không đổi được sau khi tạo.
    - `scheduleWarnings`.
    - Roster theo loại.
    - `previousExamOf` chỉ lấy đợt `EXAM`.
  - M `src/services/children/mock/childrenMockRepository.js`:
    - `saveMeasurement` tạo mới phải có `campaignId` của kỳ `MEASUREMENT` đang diễn ra cùng điểm trường.
    - `latestHealth` bỏ lần đo của kỳ.
    - `getHealthRecord` trả `openCampaign.kind`.
  - M `src/utils/children/childrenPermissions.js`: `canManageHealthCheck(user, campusId)`.
  - M `src/services/children/api/healthCheckApi.js`, `childrenApi.js`: chú thích contract và `scheduleWarnings`.
  - M `src/services/children/healthCheckService.js`.
  - M `src/mocks/healthCheckSeed.js`: đợt cũ `kind: EXAM`; thêm 1 kỳ cân đo đã đóng và 1 kỳ đang diễn ra ở điểm trường không có đợt khám mở.
- Steps:
  1. Thêm hằng số, `kindOf`.
  2. Thêm hàm cảnh báo, viết test trước.
  3. Đổi quyền.
  4. Đổi `saveMeasurement` và 3 chỗ suy luận từ `campaignId`.
  5. Sửa seed.
- Tests: tạo `tests/health/measurement-rounds.test.mjs` cho AC-1, AC-3, AC-4, AC-5, AC-7, AC-8, AC-9. Chạy lại `tests/health/previous-exam.test.mjs` và `tests/children/school-year-scope.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 2 — Giao diện

- Files:
  - M `src/routes/AppRoutes.jsx`: `health-checks/new`, `:campaignId/edit` cho HT và PHT.
  - M `src/pages/children/HealthCheckFormPage.jsx`:
    - Chọn loại khi tạo.
    - Ẩn ô đơn vị khám với kỳ cân đo.
    - Gọi `scheduleWarnings` trước khi lưu, hiện ConfirmDialog.
  - M `src/pages/children/HealthCheckListPage.jsx`: cột và bộ lọc loại, tiêu đề "Đợt khám và kỳ cân đo".
  - M `src/pages/children/HealthCheckDetailPage.jsx`: nhãn theo loại; nút quản lý cho PHT.
  - M `src/components/children/HealthCheckClassRoster.jsx`: kỳ cân đo dẫn tới form số đo thay cho phiếu khám; nhãn trạng thái M6.
  - M `src/pages/children/HealthMeasurementFormPage.jsx`: nhận `campaignId`, giới hạn ngày trong kỳ, "Lưu và nhập trẻ tiếp theo".
  - M `src/pages/children/ChildHealthRecordPage.jsx`: nút "Nhập số đo" chỉ khi có kỳ cân đo đang diễn ra; khối "đợt đang diễn ra" theo loại.
- Steps:
  1. Route và quyền.
  2. Form tạo/sửa và cảnh báo.
  3. Danh sách, chi tiết.
  4. Danh sách lớp và form số đo.
  5. Sổ sức khỏe.
  6. Tự kiểm `DESIGN.md` §13.
- Tests:
  - AC-2, AC-6 thủ công trên trình duyệt (mock): HT, PHT điểm trường A, giáo viên lớp.
  - Ghi vào `docs/quality/manual-tests/health-exam-flow.md` mục mới "Kỳ cân đo".
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

### Phase 3 — Tài liệu và đề xuất BE

- Files:
  - M `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`, `docs/context/CURRENT_STATE.md`.
  - Đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` (chỉ sửa BE khi user cho phép, sau khi BE merge xong).
- Exit: `node scripts/check-ai-layer.mjs` pass; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE

Áp dụng sau khi BE merge xong và user cho phép sửa BE.

- **HLT-01 (sửa):** Cân đo theo kỳ cân đo do HT/PHT mở cho điểm trường (thường 3 tháng/lần). Đợt khám cũng là một kỳ cân đo. Tạo kỳ có ngày bắt đầu cách kỳ/đợt khác chưa hủy của điểm trường dưới 2 tháng 15 ngày ⇒ cảnh báo, vẫn tạo được. Giáo viên chỉ nhập số đo trong kỳ hoặc đợt khám đang diễn ra. Bỏ "mặc định 3 lần/năm, chu kỳ cấu hình được".
- **HLT-08 (sửa):** Bác sĩ khám sức khỏe định kỳ 1 lần/năm học (đợt khám), không chặn cứng. Năm học đã có đợt khám khác chưa hủy ⇒ cảnh báo khi tạo. HT tạo cho mọi điểm trường, PHT cho điểm trường của mình.
- **Contract:**
  - `HealthCheckCampaign.kind: EXAM | MEASUREMENT`. POST nhận `kind`; PUT không đổi `kind`. GET list nhận lọc `kind`.
  - `GET /health-checks/schedule-warnings?campusId&kind&startDate&excludeId` trả `{ warnings: [{ code: TOO_CLOSE | EXAM_IN_SCHOOL_YEAR, campaignId, name, kind, startDate }] }`.
  - `POST /children/{id}/health/measurements` bắt buộc `campaignId` của kỳ `MEASUREMENT` đang diễn ra cùng điểm trường của trẻ; thiếu hoặc sai ⇒ 422 `campaignId`. Ngày đo ngoài khoảng của kỳ ⇒ 422 `date`.
  - `GET /health-checks/{id}/classes/{classId}/children` với kỳ `MEASUREMENT` trả trạng thái `NOT_RECORDED | RECORDED | ABSENT`; mỗi dòng thêm `heightCm`, `weightKg`.
  - Lần đo (`measurement`) trả thêm `campaignKind: EXAM | MEASUREMENT | null`; `GET /children/{id}/health` trả `openCampaign.kind`, kỳ cân đo có `resultStatus: RECORDED` khi trẻ đã có số đo.
  - Trẻ đã có số đo trong kỳ ⇒ 422 `campaignId`. Kỳ chưa bắt đầu, đã đóng hoặc hủy ⇒ 409.
- **Ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`:** "FE mock có kỳ cân đo, đợt khám 1 lần/năm, PHT quản lý đợt (2026-10-31); BE HLT-01, HLT-08 còn ghi 3 lần/năm cấu hình được, 2 lần/năm" — chưa ghi vì BE đang merge và chưa được phép sửa BE.
- **Báo cáo 5.1, 5.3:** hoãn (D6). Khi làm, phải chốt trước phân loại WHO (HLT-10 so với lựa chọn bác sĩ ở `src/models/children/healthExamForm.js:131-139`) và nhóm bệnh. Phiếu Phụ lục II không có mục khám tim (`healthExamForm.js:153-242`).

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | HLT-08 | `tests/health/measurement-rounds.test.mjs` (mock repo) | 1 | Đạt |
| AC-2 | HLT-01 | `tests/health/measurement-rounds.test.mjs` + trình duyệt (mock, PHT Campus 2) | 1, 2 | Đạt: danh sách có cột, bộ lọc loại; form kỳ không có ô đơn vị khám |
| AC-3 | HLT-01 | `tests/health/measurement-rounds.test.mjs` + trình duyệt | 1, 2 | Đạt: hộp cảnh báo nêu 2 đợt khám tháng 9, 10; kỳ đã hủy không có; "Vẫn tạo" lưu được |
| AC-4 | HLT-08 | `tests/health/measurement-rounds.test.mjs` | 1 | Đạt |
| AC-5 | HLT-01 | `tests/health/measurement-rounds.test.mjs` | 1 | Đạt |
| AC-6 | HLT-09 | `tests/health/measurement-rounds.test.mjs` + trình duyệt (giáo viên Lớp Mầm 1 Campus 2) | 1, 2 | Đạt: danh sách lớp Chưa cân đo; form giới hạn ngày; "Lưu và nhập trẻ tiếp theo" sang trẻ kế; Sổ sức khỏe ghi tên kỳ, hết nút nhập |
| AC-7 | HLT-01 | `tests/health/measurement-rounds.test.mjs` + trình duyệt | 1, 2 | Đạt: Sổ sức khỏe trẻ chưa cân có banner và nút "Nhập số đo" của kỳ |
| AC-8 | HLT-09 | `tests/health/measurement-rounds.test.mjs` + `tests/health/previous-exam.test.mjs` | 1 | Đạt |
| AC-9 | — | `tests/health/measurement-rounds.test.mjs` | 1 | Đạt |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Còn chỗ khác suy luận "có `campaignId` = lần khám" | Lần đo của kỳ bị tính là lần khám, sai mức theo dõi | Grep `campaignId` (đã liệt kê ở Context); test AC-8 | Revert Phase 1 |
| Bỏ cân đo lẻ làm hỏng luồng demo cũ | Giáo viên không nhập được nếu seed không có kỳ đang diễn ra | Seed 1 kỳ cân đo đang diễn ra | Revert seed + `saveMeasurement` |
| BE chưa nhận đề xuất | FE mock lệch BE thật khi tích hợp | Ghi "Đề xuất cho BE", CROSS_MODULE_ISSUES | Giữ mock tới khi BE chốt |
| Working tree FE đang có thay đổi khác chưa commit | Lẫn thay đổi giữa các task | Chỉ sửa file trong plan; báo user trước khi commit | — |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `healthCheckApi.js` (list, create, update, class roster), `childrenApi.js` (`saveMeasurement`), APP không gọi các API quản lý đợt
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách plan: ~17 file, chia 3 phase dừng review từng phase; không tách thêm vì Phase 2 phụ thuộc contract Phase 1
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log

### 2026-10-31 — Thiết kế (done)

- User duyệt plan và yêu cầu làm liền 3 phase ("làm luôn 3 phase cho đến khi xong") ⇒ không dừng review giữa các phase.

### 2026-10-31 — Phase 1 (done)

- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Test mới `tests/health/measurement-rounds.test.mjs` (10 test) chạy đỏ trước khi sửa code, sau đó xanh; `tests/health` + `tests/children` 110/110.
- Khác plan:
  - POST số đo với `campaignId` của đợt khám trả 422 `campaignId` (plan cũ ghi 409 cho trường hợp này ở mock cũ); trẻ đã có số đo trong kỳ ⇒ 422 `campaignId`.
  - Seed: đợt sắp diễn ra `hc_c2_next` ở c2 đổi thành kỳ cân đo đang diễn ra (cùng id để test cũ hủy được); `HEALTH_SEED_VERSION` 13, DB cũ được nâng cấp nếu đợt đó chưa có thao tác và chưa có kết quả.
  - Sửa 2 test cũ tạo cân đo lẻ (`tests/health/auto-publish.test.mjs`, `tests/health/follow-up-exam.test.mjs`): thêm kỳ cân đo giả rồi nhập trong kỳ; test phiên bản seed 12 → 13.
- Tiếp: Phase 2.

### 2026-10-31 — Phase 2 (done)

- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Thêm vào contract (test đỏ trước): dòng danh sách lớp có `heightCm`, `weightKg`; lần đo có `campaignKind`.
- Trình duyệt (Vite mock, 1036 px): PHT Campus 2 xem danh sách, hủy kỳ, tạo kỳ có cảnh báo; giáo viên nhập số đo, "Lưu và nhập trẻ tiếp theo"; Sổ sức khỏe trẻ đã cân và chưa cân; Hiệu trưởng xem đợt khám Campus 1 (giữ nguyên tab, cột, thẻ). Console 0 lỗi, 0 cảnh báo.
- Ghi chú công cụ: click chuột của Playwright MCP không đổi state ở trang chi tiết (cả tab đợt khám cũ, code không đổi); phát đủ chuỗi pointer/mouse/click bằng DOM thì đổi được ⇒ thao tác bằng DOM. Chưa tìm nguyên nhân; chưa thấy dấu hiệu là lỗi của app.
- Khác plan:
  - Thêm `src/components/children/MeasurementRoundRoster.jsx` (danh sách lớp của kỳ) thay vì rẽ nhánh trong `HealthCheckClassRoster.jsx`; badge `MeasurementResultBadge`, `CampaignKindBadge` trong `ChildBadges.jsx`.
  - Danh sách: nút phụ "Tạo đợt khám", nút chính "Tạo kỳ cân đo" (`?kind=`); form có ô Loại (mặc định kỳ cân đo), sửa thì khóa loại.
  - Đổi nhãn menu, breadcrumb thành "Đợt khám, kỳ cân đo"; nút ở hồ sơ trẻ "Nhập cân đo ngoài đợt" ⇒ "Nhập số đo" (form tự dùng kỳ đang diễn ra hoặc báo chưa có kỳ); câu giải thích mức theo dõi ở danh sách trẻ.
- Tiếp: Phase 3.

### 2026-10-31 — Phase 3 (done)

- Tài liệu: `docs/features/README.md` (mục kỳ cân đo), `docs/architecture/ROUTE_MAP.md`, `docs/context/CURRENT_STATE.md`, `docs/quality/manual-tests/health-exam-flow.md` (mục A theo seed mới, PHT quản lý, mục F thành kỳ cân đo).
- Không sửa repo BE (đang merge, chưa được phép): đề xuất HLT-01, HLT-08, contract và dòng CROSS_MODULE_ISSUES ở mục "Đề xuất cho BE".
- Plan chuyển sang `docs/plans/completed/`, `status: done`; đường dẫn tới plan trong docs, chú thích API, test đã đổi theo.
- Verify: `node scripts/check-ai-layer.mjs` → `check-ai-layer (FE): 0 lỗi, 14 cảnh báo` (cảnh báo của plan khác); `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
