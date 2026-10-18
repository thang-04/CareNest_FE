---
title: Bếp & kho (K1) — Gỡ chế biến và bàn giao suất ăn
status: approved
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [kitchen, attendance]
rules: [NUT-02, NUT-03]
risk: high
created: 2026-10-16
updated: 2026-10-16
---
# Bếp & kho (K1) — Gỡ chế biến và bàn giao suất ăn

## Context
- Plan con K1 của plan tổng `docs/plans/active/2026-10-16-kitchen-warehouse-flow.md` (Phase K1, AC-1). Plan tổng đã duyệt 16/10/2026; chỉ sửa FE.
- Danh sách file và dòng: mục "Phase K1" của plan tổng (rà 16/10/2026).

## Quyết định đã chốt
1. Bỏ hẳn trạng thái chế biến và bàn giao suất ăn; xóa code + dữ liệu mock, không ẩn — user, 16/10/2026 (plan tổng, quyết định 3).
2. Route cũ `/kitchen/preparation`, `/kitchen/preparation/update` ⇒ chuyển về `/`; `/attendance/meal-handover` ⇒ chuyển về `/` — mình đề xuất (trang `/kitchen` làm ở K2).
3. `KitchenDashboard` giữ đến K2, chỉ gỡ KPI/widget chế biến và bàn giao.

## Làm rõ nghiệp vụ
- Actor: Bếp, GV, Tổ trưởng, PHT mất màn/nút; số suất chốt (NUT-02/03) giữ nguyên.
- Câu hỏi mở: không có.

## Acceptance criteria
- **AC-1**: như plan tổng.

## Phases
### Phase K1
- Steps: 1. Route + redirect, menu. 2. Trang, nút, widget, KPI. 3. Service, hook, mock, constant, quyền, CSS. 4. `rg` sạch.
- Tests: `tests/kitchen/flow-removal.test.mjs` — chốt số không sinh bàn giao, repo bếp/điểm danh không còn hàm chế biến/bàn giao.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | NUT-02/03 | `flow-removal.test.mjs` (unit mock) + `rg` | K1 | — |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Chốt số hoặc dashboard GV vỡ | Cao | Test chốt số; build; chạy dev xem dashboard | Revert commit K1 |

## Validation log
- [x] File:line ở plan tổng
- [x] Mỗi AC có test; Exit có lệnh
- [x] Không dùng rule OPEN như đã chốt

## Progress log
### 2026-10-16 — Lập plan K1 (đang làm)
- Commit: chưa commit

### 2026-10-16 — K1 xong (chờ user review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (skipped 0)
- Test: `tests/kitchen/flow-removal.test.mjs` 3/3; `npm run test:kitchen` 12/12.
- Đã làm: xóa 4 trang/component; gỡ chế biến ở kitchen (constants, badge, quyền, validation, breadcrumbs, api, service, hook, mock, CSS, nút ở Số suất đã xác nhận); gỡ bàn giao ở attendance (constants, quyền, validation, api, service, hook, badge, mock — chốt số không còn sinh bàn giao, CSS, nút ở Điểm danh và Xác nhận sĩ số); menu 5 vai trò; 2 dòng `mealPrep.*` ở `permissionCatalog.js`; dashboard Bếp (bỏ 2 KPI, 2 việc, widget chế biến ⇒ widget "Số suất từng bữa"), PHT (widget bán trú bỏ dòng Chế biến, link sang sĩ số; lối tắt "Dịch vụ bán trú" ⇒ `/kitchen/required-quantity` đến khi có `/kitchen` ở K2), GV/Tổ trưởng (bỏ KPI + việc "Nhận suất ăn").
- Route cũ: `/kitchen/preparation/*`, `/attendance/meal-handover` ⇒ `/`.
- Khác plan: không có. Lỗi trong lúc làm: xóa nhầm `import { uid }` ở mock điểm danh, test mới bắt được, đã trả lại.
- Chưa chạy trình duyệt (`npm run dev`); build qua.
- Tiếp: user review ⇒ plan con K2.
