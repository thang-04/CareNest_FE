---
title: Lớp phủ mờ khi AI đang chạy
status: in-progress
owner: thangnd
jira: chưa có — hỏi user trước khi commit
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-20
updated: 2026-10-20
---

# Lớp phủ mờ khi AI đang chạy

## Context

User (2026-10-20): "khi dùng các chức năng như AI nên blur mờ màn và ở giữa có hiệu ứng kiểu như generate hoặc cooking gì đó cho sinh động".

Hiện trạng: 10 chỗ gọi AI (mock) ở 4 nhóm màn. Tất cả chỉ hiện `<Spinner small />` trong nút hoặc đổi chữ nút, không chỗ nào dùng `SubmitOverlay`. Repo chưa có lớp phủ toàn màn có blur (`.modal-backdrop` không blur, `src/styles/components.css:1020`; `.submit-veil` blur 2px nhưng chỉ phủ khối cha, `src/styles/components.css:1303-1339`).

| # | Chỗ gọi | Service | Loading hiện tại | Kết quả hiện ở | Mock trễ |
| --- | --- | --- | --- | --- | --- |
| 1 | `src/components/menu-planning/AiWeekComposer.jsx:57` `run()` | `generateAiSuggestion` WEEKLY | Spinner trong nút | Bước 2 trong modal | 700 ms |
| 2 | `src/components/menu-planning/AiTemplateComposer.jsx:44` `run()` | `generateAiSuggestion` DAILY | Spinner trong nút | Bước 2 trong modal | 700 ms |
| 3 | `src/pages/menu-planning/AiMenuSuggestionPage.jsx:48` `generate()` | `generateAiSuggestion` | Spinner + "Đang tạo gợi ý..." (`:180`) | Khối dưới form | 700 ms |
| 4 | `src/pages/menu-planning/WeeklyMenuPage.jsx:175` `askFixes()` | `generateAiSuggestion` DAY_FIX, tuần tự từng ngày (`:196`) | Spinner trong nút (`:434`) | Khối "Gợi ý của AI" (`:459`) | 700 ms × số ngày |
| 5 | `src/pages/education-plan/BranchPlanPage.jsx:129` `askAi()` | `suggestBranchNames` | Đổi chữ "Đang gợi ý…" (`:393`) | Điền ô tên tuần | 700 ms |
| 6 | `src/pages/education-plan/BranchPlanPage.jsx:159` `rewrite()` | `rewriteBranchName` | Chỉ disabled | Ô tên tuần | 500 ms |
| 7 | `src/pages/education-plan/BranchPlanPage.jsx:177` `rewriteAll()` | `rewriteBranchName` song song (`:182-191`) | Chỉ disabled | Các ô tên tuần | 500 ms |
| 8 | `src/pages/assessment/AiEvaluationDraftPage.jsx:37` `redraft()` | `regenerateEvaluationDraft` | Spinner trong nút | Khung nháp `.dg-ai-box` | 900 ms |
| 9 | `src/components/assessment/EvaluationReviewView.jsx:176` `redraft()` | `regenerateEvaluationDraft` | Spinner trong nút | Khung nháp | 900 ms |
| 10 | `src/pages/children/HealthTrendPage.jsx:45` `AiTrendPanel` — **tự chạy khi mở trang** + nút "Phân tích lại" (`:56`) | `analyzeHealthTrend` | Spinner + câu chờ (`:61-63`) | Card `.tr-ai` | 900 ms |

## Quyết định đã chốt

1. Phủ **cả màn** (mờ cả sidebar, topbar, modal đang mở); riêng phân tích xu hướng sức khỏe (#10, tự chạy khi mở trang) chỉ phủ card — user, 2026-10-20.
2. Hiệu ứng **theo ngữ cảnh**: thực đơn (#1–4) = nồi bốc hơi "Đang nấu thực đơn…"; màn khác (#5–10) = lấp lánh AI — user, 2026-10-20.
3. Giữ lớp phủ **tối thiểu ~1,2 giây** để hiệu ứng chạy trọn; BE chậm hơn thì hiện đúng thời gian thật — user, 2026-10-20.
4. Giảm chuyển động (máy user đang bật): không dịch chuyển, chỉ mờ–rõ tại chỗ; lớp blur giữ nguyên (theo `FE-BUG-261020-spinner-reduced-motion-loop`).
5. Không đổi service, contract, nghiệp vụ AI; không thêm dependency.
6. AI chạy xong ⇒ **kết quả hiện trong modal** ở mọi chỗ mà kết quả nằm trong trang (#3, #4, #5–7, #8–9); #1–2 đã là modal — user, 2026-10-20 (lý do: "nếu hiển thị bên dưới, người dùng sẽ không biết").
7. **Đóng modal = giữ chờ xử lý**: gợi ý chưa chọn vẫn nằm trên trang như hiện nay (ô tên tuần có ✓/✗, khối "Gợi ý của AI", khối kết quả gợi ý thực đơn, khung bản nháp đánh giá) — user, 2026-10-20.
8. Phân tích sức khỏe (#10) giữ kết quả trong card, không mở modal — user, 2026-10-20.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** Actor: GV, Bếp/Phó HT dinh dưỡng, PHT, HT (theo quyền sẵn có của từng nút). Outcome: biết AI đang làm, không bấm thao tác khác trong lúc chờ. Rule: không đổi; kết quả AI vẫn là bản nháp, cần người duyệt như hiện tại (AGENTS.md nguyên tắc 6). Flow: [B] bấm nút AI → [S] gọi service → hiện kết quả nháp — chỉ thêm lớp phủ giữa hai bước.
- **Đối chiếu thiết kế ban đầu:** `DESIGN.md:387` "Lớp nổi chung… nền sau xanh đậm 32% **không blur**"; `DESIGN.md:390` gửi form = lớp phủ trắng ba chấm. Yêu cầu khác: AI dùng lớp phủ **có blur**, phủ cả màn, hiệu ứng riêng ⇒ **lệch design system**, ghi ngoại lệ vào `DESIGN.md` (bảng component mục 6 + mục 9 trạng thái).
- **Ảnh hưởng:** FE `/menu-planning/*` (thực đơn tuần, mẫu ngày, gợi ý thực đơn), `/education/*` (kế hoạch chủ đề nhánh), `/assessment/*` (bản nháp đánh giá), hồ sơ trẻ › xu hướng sức khỏe. Quyền/scope: không đổi. APP: không đụng (lớp phủ AI chỉ ở web đợt này; ghi "App: chưa" trong `DESIGN.md`). Dữ liệu cũ: không.

### Câu hỏi mở

Không còn.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Phạm vi phủ | Cả màn; sức khỏe tự chạy chỉ phủ card | user | 2026-10-20 | Plan này; `DESIGN.md` ở Phase 1 |
| Kiểu hiệu ứng | Theo ngữ cảnh: thực đơn = nồi, còn lại = lấp lánh | user | 2026-10-20 | như trên |
| Giữ tối thiểu | ~1,2 s | user | 2026-10-20 | như trên |

## Acceptance criteria

- **AC-1:** Given bấm một nút AI #1–9 When service đang chạy Then lớp phủ cố định toàn màn (trên cả modal, dưới toast) làm mờ nền, chặn chuột, giữa màn có hiệu ứng + câu trạng thái; `role="status"`, `aria-live="polite"`.
- **AC-2:** Given service trả sau < 1,2 s When xong (thành công hoặc lỗi) Then lớp phủ tắt ở mốc ~1,2 s tính từ lúc bấm; service trả sau ≥ 1,2 s ⇒ tắt ngay khi xong. Lỗi vẫn báo bằng toast/alert như hiện tại.
- **AC-3:** Thực đơn (#1–4) hiện nồi bốc hơi, câu "Đang nấu thực đơn…"; #5–10 hiện lấp lánh, câu theo việc ("Đang gợi ý tên chủ đề…", "Đang soạn bản nháp đánh giá…", "Đang phân tích xu hướng…"). Câu phụ đổi dần theo thời gian chờ.
- **AC-4:** #10 (sức khỏe) chỉ phủ card `.tr-ai`, không phủ cả màn, cả khi tự chạy lúc mở trang và khi bấm "Phân tích lại".
- **AC-5:** #4 (nhiều ngày tuần tự) và #7 (song song) hiện **một** lớp phủ liên tục cho cả lượt, không chớp giữa các lần gọi.
- **AC-6:** `prefers-reduced-motion: reduce` ⇒ hơi nồi và lấp lánh không dịch chuyển, chỉ đổi độ mờ, nhịp thật (không 0.01 ms vô hạn); blur giữ.
- **AC-7:** `DESIGN.md` ghi ngoại lệ blur cho lớp phủ AI; `/ui-kit` có mẫu cả hai kiểu.
- **AC-9:** Given AI #3–9 chạy xong có kết quả When lớp phủ tắt Then modal kết quả mở ngay, có hành động như khối trên trang; #10 không mở modal.
- **AC-10:** Given modal kết quả đang mở When đóng modal không chọn Then trang giữ nguyên các gợi ý chờ xử lý; khi đã xử lý hết trong modal thì modal tự đóng.
- **AC-8:** `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` 0 lỗi.

## Key decisions

| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Phạm vi phủ | Cả màn (#10 chỉ card) | Chỉ khung đang làm | User chọn |
| Hiệu ứng | Theo ngữ cảnh (nồi / lấp lánh) | Lấp lánh mọi màn; nồi mọi màn | User chọn |
| Thời gian | Giữ tối thiểu 1,2 s | Không giữ | User chọn; mock 0,5–0,9 s làm hiệu ứng lóe |
| Cách nối | Hook `useAiRun()` trả `run(fn)` + `running`; component `<AiWorkingOverlay kind text>` portal vào `body` | Mỗi màn tự `setTimeout` | Một chỗ giữ thời gian tối thiểu, tránh lệch giữa 9 chỗ gọi |
| Hình nồi | Icon `Soup` sẵn có (`src/components/ui/icons.js:168`) + 3 vệt hơi CSS | Ảnh/Lottie | Không thêm dependency |
| Tầng z | Token mới `--z-ai-veil` giữa `--z-modal` (1000) và `--z-toast` (1100) (`src/styles/tokens.css:229-230`) | Dùng `--z-modal` | Phủ được modal composer, toast lỗi vẫn thấy |
| Khóa thao tác | Lớp phủ chặn chuột; nút AI vẫn disabled như hiện tại; không thêm focus trap | `inert` toàn app | Modal portal ra `body` nên `inert` trên `#root` không đủ; thao tác ngắn 1–3 s |

## Phases

> Tổng 13–14 file (> 8). Đề xuất **giữ 1 plan, 2 phase**: cùng component, cùng nguồn yêu cầu; Phase 1 dừng review trước khi nối 9 chỗ.

### Phase 1 — Component, hook, CSS, tài liệu thiết kế

- Files: C `src/components/ui/AiWorkingOverlay.jsx` · C `src/hooks/useAiRun.js` · M `src/hooks/loadingTiming.js` (hằng `AI_MIN_VISIBLE_MS` + hàm tính thời gian giữ) · M `src/styles/components.css` · M `src/styles/tokens.css` · M `src/pages/UiKitPage.jsx` · M `DESIGN.md` · C `tests/menu/ai-run-timing.test.mjs`.
- Steps: 1. Test RED cho hàm tính thời gian giữ (xong 300 ms ⇒ giữ 900 ms; xong 1,5 s ⇒ 0; lỗi cũng giữ). 2. Hook `useAiRun`: `run(fn)` đặt `running`, chờ fn + thời gian giữ, trả kết quả/ném lỗi; an toàn khi unmount. 3. `AiWorkingOverlay` (`kind: 'cooking' | 'sparkle'`, `text`, `scoped`): toàn màn qua portal, `scoped` thì `position: absolute` trong khối cha. 4. CSS: nền `color-mix` surface + `backdrop-filter: blur(...)` qua token, fade vào `--duration-overlay`; keyframes hơi nồi / lấp lánh; rule giảm chuyển động chỉ opacity. 5. `/ui-kit` mẫu 2 kiểu + scoped. 6. `DESIGN.md`: dòng component "Lớp phủ AI" + ngoại lệ blur + "App: chưa".
- Tests: AC-2 (node), AC-6/AC-7 (trình duyệt `/ui-kit`, computed style hai chế độ chuyển động).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` 0 lỗi.
- **Dừng chờ user review.**

### Phase 2 — Nối 10 chỗ gọi AI

- Files: M `src/components/menu-planning/AiWeekComposer.jsx` · M `src/components/menu-planning/AiTemplateComposer.jsx` · M `src/pages/menu-planning/AiMenuSuggestionPage.jsx` · M `src/pages/menu-planning/WeeklyMenuPage.jsx` · M `src/pages/education-plan/BranchPlanPage.jsx` · M `src/pages/assessment/AiEvaluationDraftPage.jsx` · M `src/components/assessment/EvaluationReviewView.jsx` · M `src/pages/children/HealthTrendPage.jsx` (+ CSS `.tr-ai` cần `position: relative` nếu chưa có).
- Steps: 1. Thay state chờ riêng bằng `useAiRun` ở 9 handler (giữ nguyên xử lý lỗi/toast). 2. #4, #7 bọc cả vòng lặp/`Promise.all` trong một `run` (AC-5). 3. #10: `useAsync` loader bọc thời gian giữ, `AiWorkingOverlay scoped`. 4. Bỏ Spinner trong nút AI khi đã có lớp phủ (một dấu hiệu, như `ConfirmationModal.jsx:46`). 5. Đo trình duyệt từng chỗ (mock).
- Tests: AC-1, AC-3, AC-4, AC-5 (trình duyệt: có `.ai-veil`, tầng z trên modal, thời gian hiện ≥ 1,2 s, 1 lần gắn/gỡ cho #4/#7).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
- **Dừng chờ user review.**

### Phase 3 — Modal kết quả sau khi AI chạy xong

- Files: M `src/pages/menu-planning/AiMenuSuggestionPage.jsx` · M `src/pages/menu-planning/WeeklyMenuPage.jsx` · M `src/pages/education-plan/BranchPlanPage.jsx` · M `src/pages/assessment/AiEvaluationDraftPage.jsx` · M `src/components/assessment/EvaluationReviewView.jsx` · M `DESIGN.md` (dòng "AI đang chạy": thêm "kết quả mở modal").
- Steps: 1. Mỗi chỗ tách phần hiển thị kết quả thành biến JSX dùng chung cho khối trên trang và modal (không chép hai bản). 2. Mở modal khi AI xong và có kết quả; lỗi vẫn toast/alert như cũ. 3. Hành động trong modal gọi đúng hàm sẵn có (Bỏ qua/Dùng; Đổi món/Để sau; ✓/✗/Giữ tất cả/Bỏ tất cả; Dùng bản nháp này). 4. Hết việc chờ (áp dụng/bỏ hết) ⇒ modal tự đóng. 5. Đóng modal ⇒ không đổi dữ liệu.
- Tests: AC-9, AC-10 (trình duyệt từng chỗ).
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.
- **Dừng chờ user review.**

## Test matrix

| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | DESIGN §6/§9 | Trình duyệt: lớp phủ, z-index, role | 2 | pass |
| AC-2 | — | Node: `tests/menu/ai-run-timing.test.mjs` | 1 | pass |
| AC-3 | — | Trình duyệt: kind + câu theo màn | 2 | pass |
| AC-4 | — | Trình duyệt: #10 scoped | 2 | pass |
| AC-5 | — | Trình duyệt: MutationObserver đếm gắn/gỡ | 2 | pass |
| AC-6 | — | Trình duyệt: computed style reduce/no-preference | 1 | pass |
| AC-7 | DESIGN | Đọc `DESIGN.md`, `/ui-kit` | 1 | pass |
| AC-8 | VERIFICATION | Hai cổng | 1–3 | pass |
| AC-9 | — | Trình duyệt: modal mở sau lớp phủ, đúng hành động | 3 | pass |
| AC-10 | — | Trình duyệt: đóng modal giữ gợi ý chờ; xử lý hết thì tự đóng | 3 | pass |

## Rủi ro & rollback

| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| `backdrop-filter` toàn màn trên nền kính (`--glass-blur`) nặng GPU | Giật khi lớp phủ hiện | Blur nhỏ qua token; chỉ hiện trong lúc AI chạy; đo long task | Đặt token blur = 0 |
| Giữ 1,2 s làm thao tác AI thấy chậm hơn | Người dùng chờ thêm ≤ 0,7 s | Chỉ giữ khi xong sớm; BE chậm không cộng thêm | Đặt hằng giữ = 0 |
| Phủ cả màn khi #4 sửa nhiều ngày (700 ms × N) | Chặn màn vài giây | Câu phụ đổi dần, cho biết tiến độ | Phủ khối gợi ý thay vì cả màn |
| `prettier --check` đang đỏ do `RankBars.jsx`, `TodayWidgets.jsx` (ngoài phạm vi) | Exit không PASS | Hỏi user format trước Phase 1 | — |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] > 8 file ⇒ đã đề xuất giữ 1 plan 2 phase, có lý do
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder, không mâu thuẫn

## Progress log

### 2026-10-20 — Phase 1 (chờ review)

- Commit: chưa commit (chưa có mã Jira).
- TDD: `tests/menu/ai-run-timing.test.mjs` RED (thiếu export `AI_MIN_VISIBLE_MS`) → GREEN; cùng `loading-timing` 11/11.
- Code: `runWithAiHold`/`aiHoldMs` trong `src/hooks/loadingTiming.js`; hook `src/hooks/useAiRun.js`; `src/components/ui/AiWorkingOverlay.jsx` (export qua `src/components/index.js`); token `--z-ai-veil: 1050`, `--ai-veil-bg`, `--ai-veil-blur: blur(6px)`; CSS `.ai-veil*` trong `components.css`; mẫu `/ui-kit` (2 scoped + 2 nút phủ cả màn); `DESIGN.md` thêm dòng "AI đang chạy" ở bảng component và bảng trạng thái (prettier format lại cả file).
- **Khác plan:** lớp phủ cả màn chiếm đỉnh `modalStack` để Esc không đóng modal composer giữa lúc AI chạy.
- Đo trình duyệt `/ui-kit` (mock): lớp phủ gắn vào `body`, `z-index 1050`, `position: fixed`, blur 6px; nhịp khung hình khi phủ cả màn 191 khung/2 s, p50 12 ms, p95 18 ms, max 36 ms. Giảm chuyển động: nền icon `none`, hơi/sao `ai-fade-pulse 1.8s`, fade lớp phủ/câu phụ 0.18 s. Thường: `ai-art-breathe 2.4s`, `ai-steam 1.8s`, `ai-twinkle 1.6s`.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `check-ai-layer` 0 lỗi.
- Tiếp: Phase 2 nối 10 chỗ gọi AI sau khi user review.

### 2026-10-20 — Phase 2 (chờ review)

- Nguồn duyệt: user "ok" (Phase 1), "tiếp" (Phase 2).
- Commit: chưa commit (chưa có mã Jira).
- Nối `useAiRun` + `AiWorkingOverlay` vào 10 chỗ; bỏ Spinner trong nút AI (một dấu hiệu). #4 gói cả vòng tuần tự, #7 gói cả `Promise.all` trong một `runAi`. #10 dùng `runWithAiHold` trong loader `useAsync` + `scoped`; `.tr-ai` thêm `position: relative`, khối chờ `.tr-ai__wait` cao 140px.
- **Khác plan:** `BranchPlanPage` đóng hộp xác nhận rồi mới chạy AI (trước đây hộp chờ `await` nên hiện "Đang gửi…" của `ConfirmationModal` chồng dưới lớp phủ AI). Cả 3 hộp xác nhận ở trang này đều là hỏi trước khi dùng AI.
- Đo trình duyệt (mock, MutationObserver, mốc tính từ lúc bấm):
  - Thực đơn (Phó HT): gợi ý thực đơn +7/−1228 ms; AI soạn tuần (trong modal, z 1050 > modal 1000) +5/−1218 ms, Esc giữa lúc chạy không đóng modal; AI soạn mẫu +4/−1210 ms; AI gợi ý cách sửa (nhiều ngày) +5/−3742 ms, một lần gắn/gỡ. Cả 4 kiểu `cooking`.
  - Kế hoạch giáo dục (GV Chồi 2): gợi ý cả năm +11/−1225 ms, hộp xác nhận đã đóng, không còn `.submit-veil`; viết lại cả năm +11/−1227 ms; viết lại 1 tuần +11/−1214 ms. Kiểu `sparkle`.
  - Đánh giá (GV): "Tạo lại bản nháp" ở chi tiết phiếu +3/−1459 ms; trang bản nháp AI +2/−1204 ms; toast thành công sau khi tắt.
  - Sức khỏe: mở trang tự chạy ⇒ lớp phủ `scoped` trong card `.tr-ai`, `position: absolute`, +363/−1598 ms; "Phân tích lại" +2/−1204 ms. Ảnh chụp: chỉ card mờ, phần còn lại rõ.
- Ghi chú: trình duyệt đo có bấm nhầm "Soạn tay" (tạo tuần nháp trống trong DB mock của profile đo, không phải trình duyệt của user).
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Tiếp: user review; commit cần mã Jira.

### 2026-10-20 — Phase 3 (chờ review)

- Nguồn duyệt: user chọn "Kết quả trong modal", "Đóng = giữ chờ xử lý", "Sức khỏe giữ trong card" (2026-10-20) — dùng làm phạm vi Phase 3.
- Commit: chưa commit (chưa có mã Jira).
- Code: mỗi chỗ tách phần kết quả thành biến JSX dùng chung cho khối trên trang và modal (`resultBody`/`resultActions` ở gợi ý thực đơn, `fixList` ở thực đơn tuần); tên chủ đề nhánh có modal danh sách tuần (tên cũ gạch → tên AI, ✓/✗, Giữ tất cả/Bỏ tất cả/Đóng, xử lý sau) + CSS `.ga-ai-review*`; đánh giá có modal "Bản nháp AI mới". Toast "Bản nháp AI đã sẵn sàng" bỏ ở 3 chỗ vì modal thay. `DESIGN.md` thêm "Xong: kết quả mở modal…".
- **Khác plan:** `EvaluationReviewView` mở modal sau khi trang tải lại xong (lần đo đầu: modal mở 1218 ms nhưng lớp phủ còn tới 1479 ms ⇒ lớp phủ đè modal ~260 ms).
- Đo trình duyệt (mock, `veilOff` = lớp phủ tắt, `modalAt` = modal mở):
  - Gợi ý thực đơn: 1325/1325 ms; đóng modal ⇒ khối "Kết quả gợi ý" trên trang vẫn còn.
  - AI gợi ý cách sửa (tuần nháp trống tạo bằng "Soạn tay" trong profile đo): 4256/4256 ms; "Thêm món" 1 ngày ⇒ modal còn 4/5; "Đóng, xử lý sau" ⇒ khối "Gợi ý của AI" còn; "Để sau" hết ⇒ modal tự đóng.
  - Tên chủ đề nhánh: gợi ý cả năm 1353/1353 ms, 19 tuần; ✓ tuần 15 ⇒ tiêu đề (18); đóng ⇒ nút trang "Giữ tất cả (18)"; viết lại cả năm 1391/1391 ms (33 tuần); "Giữ tất cả" trong modal ⇒ modal đóng, hết chờ.
  - Đánh giá: chi tiết phiếu 1469/1469 ms (sau sửa), "Dùng bản nháp này" điền ô nội dung (621 ký tự); trang bản nháp AI 1208/1208 ms.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`.
- Tiếp: user review; commit cần mã Jira.
