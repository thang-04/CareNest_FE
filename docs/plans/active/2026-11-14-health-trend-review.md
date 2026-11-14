---
title: Nhận định xu hướng sức khỏe — hiển thị theo khối và duyệt
status: in-progress        # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [health]
rules: [HLT-05, HLT-09, HLT-21, AI-02, AI-03, GBR-AI-06]
risk: medium         # đổi hành vi panel AI đã chốt 20/10; thêm luồng duyệt; không đổi route, không đổi thư viện
created: 2026-11-14
updated: 2026-11-14
---
# Nhận định xu hướng sức khỏe — hiển thị theo khối và duyệt

Phần client của plan BE `BE:docs/plans/completed/2026-11-14-health-trend-structured-ai.md` (HLT-21, commit BE `19a10820`, `a52edb60`, `42e70969`). Plan này là "Nút duyệt giải thích xu hướng AI: plan riêng" đã hẹn ở `docs/plans/active/2026-11-11-children-module-be-wiring.md:68`.

## Context
- BE đã đổi contract `/children/{id}/health/trend-analysis`:
  - Response có thêm `content` (5 mục: `overview`, `attentionPoints[{warningCode,text}]`, `positives`, `followUps[{type,text}]`, `limitations`), `stale`, và `warnings[].code`.
  - GET trả bản mới nhất. POST `/{interpretationId}/approve` nhận body `{ content }`. Bản sửa sai ⇒ 400, lỗi theo field `content.*`.
- FE hiện tại:
  - `AiTrendPanel.jsx:13` gọi POST analyze mỗi lần mở trang (user chốt 20/10 — `docs/plans/active/2026-10-20-ai-working-overlay.md:37`). Mỗi lần mở là một lần gọi AI và thêm một bản nháp ở BE.
  - Panel chỉ hiện `summary` và `warnings` (`AiTrendPanel.jsx:46-52`). Nhãn ghi "chỉ để tham khảo", không có bước duyệt (`:22-23`). Câu cuối ghi "chỉ nhân viên nhà trường xem được" (`:57-60`) — sai với HLT-05: phụ huynh thấy bản đã duyệt.
  - `childrenApi.js:251` chỉ có `analyzeHealthTrend`. Bản giả lập `childrenMockRepository.js:1472` trả dạng cũ.
  - Lỗi field của BE đã được chuẩn hóa thành `error.details[field]` (`src/services/http/apiError.js:20-23`).
- Web không có màn phụ huynh (`AppRoutes.jsx:368` chỉ HT, PHT, nhân sự lớp). Màn phụ huynh thuộc APP — ngoài plan này.

## Quyết định đã chốt
1. Theo HLT-05, HLT-21 (BE, user 14/11/2026): bản AI là nháp, nhân sự duyệt, phụ huynh chỉ thấy bản đã duyệt và không thấy `followUps`.
2. Lỗi AI không chặn trang: số đo, biểu đồ, cảnh báo vẫn dùng được (GBR-AI-06, giữ như hiện tại).
3. Mở trang chỉ đọc bản mới nhất; AI chạy khi bấm "Phân tích" / "Phân tích lại" — thay quyết định "tự chạy" 20/10 (user 14/11, Q1).
4. Sửa ngay trong card (user 14/11, Q2).
5. Chỉ GV đang được phân công dạy lớp hiện tại của trẻ được sửa và duyệt; HT, PHT vẫn xem và bấm "Phân tích"; chặn ở cả BE và FE (user 14/11, Q3, Q3a–c). BE cần sửa trước Phase 3 (xem "Phụ thuộc BE").
6. Bản đã duyệt chỉ xem; muốn đổi thì "Phân tích lại" rồi duyệt bản mới (user 14/11, Q4).
7. Màn phụ huynh làm ở plan APP riêng (user 14/11, Q5).

## Phụ thuộc BE
- Approve chỉ cho GV đang phân công lớp hiện tại của trẻ (`HealthCheckRules.teaches`, cùng điều kiện nhập số đo HLT-09); người khác ⇒ 403 mã mới `HEALTH_INTERPRETATION_APPROVE_DENIED` (5041). Bổ sung câu vào HLT-21, test BE. Làm trên nhánh BE G94-180 trước Phase 3 của plan này.
- Đã làm trên nhánh BE (chưa commit): `ApiCode.HEALTH_INTERPRETATION_APPROVE_DENIED` 5041, `HealthTrendServiceImpl.approve` kiểm `HealthCheckRules.teaches`, HLT-21 bổ sung câu người duyệt. Lỗi field BE dạng `content.attentionPoints.0.text` (theo `BE:docs/contracts/ERROR_CONTRACT.md`).
- FE hiện nút "Sửa", "Duyệt" theo cùng điều kiện với `canRecordMeasurement` (`src/utils/children/childrenPermissions.js:93`).

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor: HT, PHT, GV xem được trẻ (BE `checkCanView`). Flow: [B] mở trang ⇒ [S] đọc bản mới nhất ⇒ [B] bấm "Phân tích" ⇒ [S] AI viết nháp ⇒ [B] sửa từng mục (tùy chọn) ⇒ [B] duyệt ⇒ [S] phụ huynh thấy (APP).
- **Đối chiếu:** user chốt 20/10 "AI tự chạy khi mở trang"; FE ghi "không có bước duyệt" — lệch BE từ 11/11 (`2026-11-11-children-module-be-wiring.md:100-102`). Plan này theo BE.
- **Ảnh hưởng:** `FE: /children/health-trends` (HT, PHT, nhân sự lớp). Dữ liệu cũ: bản trước V129 có `content = null` ⇒ hiện `summary`.

### Câu hỏi mở
- [x] Q1: Bỏ "AI tự chạy khi mở trang".
- [x] Q2: Chỗ sửa trước khi duyệt.
- [x] Q3: Ai được sửa, duyệt.
- [x] Q4: Bản đã duyệt có sửa tiếp không.
- [x] Q5: Màn phụ huynh.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Q1 | A: mở trang chỉ GET; AI chạy khi bấm | user | 2026-11-14 | Plan này; thay chốt 20/10 ở `2026-10-20-ai-working-overlay.md` |
| Q2 | A: sửa ngay trong card | user | 2026-11-14 | Plan này |
| Q3 | Chỉ GV đang phân công lớp hiện tại của trẻ sửa, duyệt; HT, PHT xem và phân tích; chặn cả BE và FE | user | 2026-11-14 | BE HLT-21 (khi sửa BE) |
| Q4 | A: bản đã duyệt chỉ xem | user | 2026-11-14 | Plan này |
| Q5 | A: plan APP riêng | user | 2026-11-14 | — |

## Acceptance criteria
- **AC-1** (HLT-21): Mở trang ⇒ chỉ gọi GET; không có bản ⇒ nút "Phân tích"; bấm ⇒ POST, hiện lớp phủ AI trên card như hiện tại (theo Q1).
- **AC-2** (HLT-21): Có `content` ⇒ hiện 5 khối theo thứ tự Tổng quan, Cần chú ý, Điểm tích cực, Gợi ý theo dõi, Lưu ý về dữ liệu; khối rỗng ẩn. `content = null` ⇒ hiện `summary`.
- **AC-3** (HLT-05): Nhãn "Bản nháp AI – cần duyệt" khi `draft`; "Đã duyệt" kèm người duyệt, thời điểm khi đã duyệt; "Đã chỉnh sửa" khi `source = HUMAN`. Câu chân card đổi: phụ huynh thấy bản sau khi duyệt, không thấy gợi ý theo dõi.
- **AC-4** (HLT-21): `stale = true` ⇒ banner "Đã có số đo mới sau lần phân tích này — phân tích lại để cập nhật".
- **AC-5** (AI-02, HLT-21): Chỉ GV đang phân công lớp hiện tại của trẻ thấy "Sửa", "Duyệt"; HT, PHT chỉ thấy nội dung và nút "Phân tích". Bản đã duyệt không có "Sửa". Nháp ⇒ "Duyệt" (gửi không `content`) và "Sửa" (theo Q2). Sửa được: tổng quan; text từng điểm chú ý (xóa được, không đổi mã); điểm tích cực (thêm, xóa, tối đa 3); text và xóa gợi ý theo dõi (không thêm loại mới); lưu ý dữ liệu.
- **AC-6** (AI-02, HLT-21): Kiểm trước khi gửi giống BE: tổng quan bắt buộc, ≤ 500 ký tự; mỗi mục bắt buộc, ≤ 300 ký tự; điểm tích cực ≤ 3. BE trả 400 ⇒ hiện `error.details['content.…']` dưới đúng ô.
- **AC-9** (HLT-21): BE trả 403 `HEALTH_INTERPRETATION_APPROVE_DENIED` ⇒ hiện câu lỗi trong card, không mất nội dung đang sửa.
- **AC-7** (AI-03): Phân tích lỗi 503/504 ⇒ cảnh báo trong card như hiện tại; bản trước đó (nếu có) vẫn hiển thị.
- **AC-8**: Bản giả lập (`sourceOf('children', mock, api)`) trả cùng dạng BE: GET latest, POST analyze, POST approve, `stale`, `code`, kiểm 400 như BE.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Hàm kiểm và chuyển đổi nội dung | `src/utils/children/healthTrend.js` (giới hạn, `toEditable`, `toPayload`, `validateTrendContent`) | Viết trong component | Test được bằng node như `childrenValidation.js` |
| Nhãn loại gợi ý, mã cảnh báo | `childrenConstants.js` cạnh `AI_TREND_STATUS` | File mới | Cùng chỗ hằng sức khỏe hiện có |
| Form sửa | Component mới `AiTrendEditor.jsx` | Gộp vào `AiTrendPanel.jsx` | Panel đã 70 dòng; tách để đọc và test riêng |

## Phases
### Phase 1 — API, bản giả lập, hàm nội dung
- Files:
  - M `src/services/children/api/childrenApi.js`: thêm `getLatestHealthTrend(childId)` (GET), `approveHealthTrend(childId, interpretationId, content)` (POST, body `{ content }` hoặc rỗng).
  - M `src/services/children/childrenService.js`: export hai hàm trên.
  - M `src/services/children/mock/childrenMockRepository.js`: lưu nháp dạng mới (`content`, `code`, `source`, `measurementIds`); `getLatestHealthTrend`; `approveHealthTrend` (kiểm như BE, ném `ApiError(400, …, details)`); tính `stale`; giữ trẻ mã đuôi 5 lỗi 503.
  - M `src/models/children/childrenConstants.js`: `TREND_FOLLOW_UP_LABELS`, `TREND_CONTENT_LIMITS`.
  - C `src/utils/children/healthTrend.js`.
- Tests: C `tests/health/health-trend.test.mjs` — AC-6 (`validateTrendContent`), AC-8 (adapter gọi đúng URL/body; mock latest, approve, 400, `stale`).
- Exit: `npm run test:health` → pass.
- **Dừng chờ user review.**

### Phase 2 — Panel đọc bản mới nhất, hiển thị theo khối
- Files: M `src/components/children/AiTrendPanel.jsx`; M `src/styles/modules/children.css` (khối `.tr-ai__block`, banner `stale`).
- Tests: AC-1..AC-4, AC-7 — kiểm bằng hàm thuần trong `healthTrend.js` (`trendBlocks(data)`) + kiểm tay trên trình duyệt (mock và BE nhánh G94-180), chụp màn hình vào `docs/test-reports/`.
- Exit: `npm run test:health` → pass; `npm run check` → pass.
- **Dừng chờ user review.**

### Phase 3 — Sửa và duyệt
- Files: C `src/components/children/AiTrendEditor.jsx`; M `AiTrendPanel.jsx` (nút "Sửa", "Duyệt"); M `children.css`.
- Docs: `docs/integration/FE_API_CALLS.md` (thêm GET, approve), cập nhật `docs/plans/active/2026-11-11-children-module-be-wiring.md` mục 6 trỏ sang plan này.
- Tests: AC-5, AC-6 — `tests/health/health-trend.test.mjs` (`toPayload` bỏ mục trống, giữ mã cảnh báo) + kiểm tay luồng sửa, duyệt, lỗi 400 trên BE thật.
- Exit: `npm run verify` → pass.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-6, AC-8 | AI-02, HLT-21 | `tests/health/health-trend.test.mjs` (node) | 1 | PASS 6/6 |
| AC-1..AC-4, AC-7 | HLT-05, HLT-21, AI-03 | hàm thuần (node) + kiểm tay trình duyệt | 2 | |
| AC-5, AC-6 | AI-02 | node + kiểm tay trên BE thật | 3 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi hành vi "tự chạy" đã chốt 20/10 | Người dùng quen thấy nhận định ngay khi mở | Chờ Q1; nếu giữ tự chạy thì chỉ tự chạy khi chưa có bản nào | Trả lại `useAsync` gọi POST |
| Bản giả lập lệch BE | Màn chạy mock khác BE thật | AC-8 + kiểm tay trên BE nhánh G94-180 ở Phase 3 | — |
| BE chưa gọi AI thật lần nào (`response_format`) | Phân tích có thể 503 trên môi trường thật | Smoke test BE trước khi kiểm tay Phase 3 | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE; dùng đúng contract đã push (`openapi.yaml` commit `a52edb60`)
- [x] Mỗi AC có test hoặc bước kiểm tay; mỗi phase có Exit
- [x] Câu hỏi mở Q1–Q5 đã trả lời; còn chờ user duyệt plan

## Progress log
### 2026-11-14 — Plan draft v2 (chờ duyệt)
- Commit: chưa (bản nháp chưa ghi vào repo FE — chỉ được phép đọc).
- Tiếp: user cho phép ghi plan vào `CareNest_FE/docs/plans/active/`, cho phép sửa BE (phụ thuộc BE), duyệt plan.

### 2026-11-14 — Duyệt plan
- User duyệt plan và cho phép ghi plan vào repo FE, sửa BE (phụ thuộc BE) — 14/11/2026.
- BE: 403 5041 cho người không phải GV lớp; test `HealthTrendServiceImplTest` 16/16, `HealthRecordIntegrationTest` 4/4, `OpenApiSnapshotTest` 4/4, `ApiCodeTest` 3/3 (chưa commit).
- Tiếp: Phase 1 (API, bản giả lập, hàm nội dung).

### 2026-11-14 — Phase 1 (chờ review)
- BE phụ thuộc đã commit, push: `29eccd17` (`G94-180: Restrict health trend approval to class teacher`).
- FE: chưa commit.
- Verify: `npm run test:health` → 117/117 pass (mới: `tests/health/health-trend.test.mjs` 6/6); `npm run check` → exit 0 (lint, format, design, api, build).
- Khác plan:
  - `healthTrend.js` có `normalizeTrendContent` (đóng vai `toPayload`), `validateTrendContent`, `renderTrendSummary`, `isTrendStale`; `toEditable` để Phase 3 khi có form.
  - Adapter thêm `readTrend`: `approvedBy` không khớp mẫu tên id của `stringifyIds` nên đổi riêng sang chuỗi.
  - Bản giả lập: luật cảnh báo đổi sang mã của BE (`WEIGHT_DROP`, `HEIGHT_STALL`, `NORMAL`); bỏ cảnh báo vòng đầu, BMI cũ của bản giả lập vì BE không có mã tương ứng.
- Tiếp: Phase 2 (panel đọc bản mới nhất, hiển thị theo khối).
