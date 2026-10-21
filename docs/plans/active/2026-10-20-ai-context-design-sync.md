---
title: Đồng bộ AI context với code và design thật
status: in-progress  # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: thangnd
jira: chưa có / chưa có   # hỏi user khi commit
branch: dev
modules: []
rules: []
risk: medium         # chạm harness (scripts/, .eslintrc.cjs, package.json scripts) nhưng không đổi hành vi app
created: 2026-10-20
updated: 2026-10-20
---
# Đồng bộ AI context với code và design thật

## Context
Rà soát 2026-10-20: code FE (659 file JS/JSX) đã trôi khỏi design vì lớp AI context mô tả trạng thái "chưa có source":
- `AGENTS.md` mục Stack ghi "React + TypeScript PROPOSED, chưa có source"; `.ai/CONTEXT_MAP.yaml` có `planned: src/`; `docs/architecture/{FOLDER_STRUCTURE,FRONTEND_ARCHITECTURE,STATE_MANAGEMENT}.md` ghi "không dùng làm nguồn".
- `.claude/rules/{api-client,state,typescript}.md` dùng glob `*.ts` ⇒ không bao giờ nạp với code `.js/.jsx`.
- `CODING_GUIDE.md`, `DESIGN.md` (nguồn đúng nhất) không có trong CONTEXT_MAP, workflow, skill.
- Mâu thuẫn: `CODING_GUIDE.md` §4 (luật nghiệp vụ ở mock repo, `canXxx` dùng cho cả server) vs `AGENTS.md` invariant 2.
- Không luật promote component chung/riêng; ESLint không chặn import chéo module hay `@tabler` ngoài `icons.js`. Kết quả: ~35 import chéo module, Tabs/CampusFilter/KPI/HistoryList/AiDraftBadge/filter bar bị dựng lại ở nhiều module.

## Quyết định đã chốt
1. Hướng B: sửa docs + danh mục component + chặn tự động; refactor code để plan sau — user, 2026-10-20.
2. Mock repo = BE giả, được chứa luật (dẫn rule ID BE); tầng UI không tính nghiệp vụ; `canXxx` chỉ là UX, ưu tiên cờ `can*` của BE — user, 2026-10-20.
3. Ngoại lệ import nhiều module: **chỉ** trang ở gốc `src/pages` (không gồm `*/dashboard/`) — user, 2026-10-20.
4. Import component chung thẳng theo đường dẫn (`@/components/ui/Modal`); barrel giữ để tương thích, không ép — user, 2026-10-20.
5. Lint import chéo module mức `error` + danh sách ngoại lệ ghi rõ, chỉ được thu nhỏ — user, 2026-10-20.

## Làm rõ nghiệp vụ
Không đổi nghiệp vụ hay thứ người dùng thấy; chỉ tài liệu, rule cho AI và cổng lint.

### Câu hỏi mở
| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Mock repo chứa luật? | Được, như BE giả | user | 2026-10-20 | AGENTS invariant 2, CODING_GUIDE §4 |
| Ngoại lệ import chéo | Chỉ pages gốc | user | 2026-10-20 | `.claude/rules/architecture.md`, `.eslintrc.cjs` |
| Barrel hay import thẳng | Import thẳng | user | 2026-10-20 | CODING_GUIDE §2 |
| Mức lint | error + ngoại lệ | user | 2026-10-20 | `.eslintrc.cjs` |

## Acceptance criteria
- **AC-1**: Given AI đọc `AGENTS.md`/CONTEXT_MAP When bắt đầu task Then thấy stack thật, `CODING_GUIDE.md`, `DESIGN.md`, và đường dẫn code module (`fe_code`); không còn `planned: src/`.
- **AC-2**: Given sửa file `src/services/**/*.js` hoặc `src/hooks/**` When Claude mở file Then `api-client.md`/`state.md` được nạp (glob khớp); `check-ai-layer` báo lỗi nếu glob rule không khớp file nào.
- **AC-3**: Given file trong module A import code riêng module B (không thuộc ngoại lệ) When `npm run lint` Then lỗi `no-restricted-imports`.
- **AC-4**: Given file ngoài `components/ui/icons.js` import `@tabler/icons-react` When lint Then lỗi.
- **AC-5**: Given thêm mã màu/px radius/font ngoài token vượt baseline When `npm run verify` Then FAIL.
- **AC-6**: Given AI làm màn mới theo `implement-feature` When tới bước code Then workflow dẫn tới `CODING_GUIDE` §5, `DESIGN` §6.3/§8 và luật promote.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Danh mục component | Thêm cột "File" vào `DESIGN.md` §6.3 | File catalog riêng | Một nguồn, DRY |
| Chặn import chéo | `no-restricted-imports` sinh theo thư mục module trong `.eslintrc.cjs` | Plugin `eslint-plugin-boundaries` | Không thêm dependency |
| Doc kiến trúc skeleton | Đổi thành bảng quyết định đã chốt, chi tiết trỏ CODING_GUIDE | Xóa file | Giữ đường dẫn mà CONTEXT_MAP/BE trỏ tới |

## Phases
### Phase 1 — Nguồn sự thật (docs)
- Files: M `AGENTS.md` · M `docs/architecture/CODING_GUIDE.md` · M `docs/architecture/{FOLDER_STRUCTURE,FRONTEND_ARCHITECTURE,STATE_MANAGEMENT}.md` · M `docs/integration/AUTH_FLOW.md` · M `.ai/CONTEXT_MAP.yaml` · M `docs/context/CURRENT_STATE.md` · M `docs/INDEX.md`
- Exit: `node scripts/check-ai-layer.mjs` PASS.

### Phase 2 — Rule, workflow, skill
- Files: M `.claude/rules/{api-client,state,component,ui-style}.md` · D `.claude/rules/typescript.md` · C `.claude/rules/javascript.md` · C `.claude/rules/architecture.md` · M `.ai/workflows/{implement-feature,review-code}.md` · M `.ai/profiles/{code,feature}.md` · M `DESIGN.md` §6.3/§14.1
- Exit: `node scripts/check-ai-layer.mjs` PASS.

### Phase 3 — Chặn tự động
- Files: M `.eslintrc.cjs` · C `scripts/check-design.mjs` · C `scripts/design-baseline.json` · M `package.json` (scripts) · M `scripts/ai-layer/*` (kiểm glob rule)
- Tests: AC-3/AC-4 bằng file tạm vi phạm (xóa sau); AC-5 bằng chạy script với baseline giảm tạm.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.

### Phase 4 — Dọn nhiễu
- Files: chuyển `REFACTOR_REPORT.md`, `REVIEW_FACILITY_TRANSFER.md`, `UI_UX_REVIEW_CSVC.md` → `docs/plans/completed/reports/` · D `ui-review/before/*`, `ui-review/after/*` · D `src/models/index.js`, `src/models/facility-transfer/index.js` · M `.gitignore`
- Plan active cũ: đề xuất danh sách chuyển `completed/`, user chốt.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`.

## Ngoài phạm vi (plan sau)
Promote Tabs/CampusFilter/KPI/HistoryList/AiDraftBadge; xóa 71 export chết; tách page lớn; bỏ tính nghiệp vụ ở FE (`dayRegister`, `dashboardService` pending approvals, `GoalDetailPage` tự đặt status) — cần BE đổi contract.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Lint mới làm verify fail với code đang có | Chặn mọi người | Danh sách ngoại lệ sinh từ vi phạm hiện có | Revert `.eslintrc.cjs` |
| Baseline design sai | Fail giả | Baseline đo từ code hiện tại | Sửa `design-baseline.json` |

## Validation log
- [x] Khẳng định về code có `file:line` (báo cáo rà soát trong phiên 2026-10-20)
- [x] Không đổi contract BE
- [x] Mỗi AC có kiểm chứng; mỗi phase có Exit
- [x] >8 file: chấp nhận vì chỉ docs/harness, cùng một mục tiêu; refactor code đã tách plan sau
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder, không mâu thuẫn

## Progress log
### 2026-10-20 — Phase 1–4 (chờ review)
- Commit: chưa commit (cần mã Jira; thay đổi đang ở working tree, các lệnh `git mv`/`git rm` đã stage)
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `node scripts/check-ai-layer.mjs` → `0 lỗi, 11 cảnh báo · E7 ok`; `node --test scripts/__tests__/*.test.mjs` → 43 pass
- AC-3/AC-4: file tạm `src/pages/pickup/__LintProbe.jsx` ⇒ 3 lỗi (Tabler, import chéo menu-planning, mock); trang gốc `src/pages/__RootProbe.jsx` import chéo ⇒ không lỗi; đã xóa file tạm
- Khác plan: (1) danh mục component là bảng "File của component chung" ngay dưới §6.3 thay vì thêm cột vào bảng rộng (ít đổi định dạng); (2) E7 đã có sẵn ở mức cảnh báo ⇒ nâng thành lỗi khi mọi glob của rule trượt; (3) thêm luật E2: đường dẫn thiếu trong `docs/plans/**` chỉ cảnh báo (plan ghi file C/D) — lộ ra khi bỏ `planned: src/`; (4) làm liền 4 phase theo yêu cầu "duyệt và implement" của user thay vì dừng sau mỗi phase.
- Đề xuất chuyển plan cũ (user chốt): `2026-10-08-ui-redesign-design-system-v2` (log cuối 09/10, đã thay bằng DESIGN 3.x), `2026-10-13-giao-an-dang-bang-va-ai` (draft, giáo án ngoài V1 — invariant 8), `2026-10-20-style-sync-by-flow` (2 plan nó chờ đã ở `completed/`); hỏi lại: `2026-10-12-attendance-summary-export`, `2026-10-12-daily-reception`, `2026-10-19-css-cleanup` (chờ review từ 12–19/10).
- Harness dùng chung: `scripts/ai-layer/docs-checks.mjs`, `scripts/__tests__/check-ai-layer.test.mjs` đã đổi ở FE ⇒ cần đồng bộ BE/APP (chưa sửa repo khác).
- Tiếp: user review; plan sau: promote Tabs/CampusFilter/KPI/HistoryList/AiDraftBadge, gỡ nợ `CROSS_MODULE_DEBT`, xóa 71 export chết, ghi đề xuất `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` cho số liệu FE đang tự tính.
