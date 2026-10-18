---
title: Bếp & kho (K2) — Quy trình bếp hôm nay + lưu mẫu
status: approved
owner: thangnd
jira: none
branch: feature/FE-FEAT-48-nutrition-management
modules: [kitchen]
rules: [NUT-02, NUT-03]
risk: medium
created: 2026-10-16
updated: 2026-10-16
---
# Bếp & kho (K2) — Quy trình bếp hôm nay + lưu mẫu

## Context
- Plan con K2 của plan tổng `docs/plans/active/2026-10-16-kitchen-warehouse-flow.md` (AC-2, AC-3, AC-9). K1 xong 16/10/2026 (`docs/plans/active/2026-10-16-kitchen-flow-k1-remove-prep-handover.md`).
- Bố cục chốt: **B · dòng thời gian theo giờ** + cột phải "Cần xử lý" (wireframe Artifact "Bếp & kho CareNest" bản 2).
- Dữ liệu dùng lại: số suất `getConfirmedMealCount` (`src/services/kitchen/mock/kitchenMockRepository.js`), phiếu đi chợ `marketOf`, phiếu xuất `issueView`, báo thiếu `missingFoodReports`, tồn `foodStock`.

## Quyết định đã chốt
1. Trang `/kitchen` "Quy trình bếp hôm nay": 3 mốc giờ dự kiến (06:30 nhận hàng tươi, 08:30 chốt số, 09:00 xuất kho) chỉ để hiển thị; khối lưu mẫu theo bữa — plan tổng, quyết định 4, 7, 8.
2. Mốc "Nhận hàng tươi" ở K2 dựa trên phiếu đi chợ (số thực phẩm tươi); K3 đổi sang tiến độ kiểm nhận — mình đề xuất (màn kiểm nhận làm ở K3).
3. Bếp mở trang chủ thấy luôn trang này (thay `KitchenDashboard`), kèm "Thực đơn hôm nay" và việc cơ sở vật chất như dashboard cũ — mình đề xuất.
4. Lưu mẫu: chỉ Bếp của cơ sở, chỉ ngày hôm nay, tick/bỏ tick được; ảnh tối đa 1, không bắt buộc — plan tổng, quyết định 4.
5. "Cần xử lý" theo vai trò: PHT — phiếu xuất chờ duyệt, báo thiếu chờ bổ sung, mặt hàng hết; Bếp — phiếu xuất chờ nhận, báo thiếu đã gửi; HT — chỉ xem dòng thời gian — mình đề xuất.

## Làm rõ nghiệp vụ
- Actor: Bếp (tick lưu mẫu), PHT/HT (xem). Rule NUT-02/03: số suất chỉ hiện khi đã chốt.
- Câu hỏi mở: không có.

## Acceptance criteria
- AC-2, AC-3, AC-9 như plan tổng.

## Phases
### Phase K2
- Files: C (mới) pages/kitchen `KitchenFlowPage.jsx`, components/kitchen `FoodSampleChecklist.jsx`; M `kitchenConstants.js`, `kitchenPermissions.js`, `kitchenValidation.js`, `breadcrumbs.js`, mock repository (`foodSamples`, `getKitchenDay`, `setFoodSample`), `kitchenApi.js`, `kitchenService.js`, `useKitchen.js`, `kitchen.css`, `AppRoutes.jsx`, `menuConfig.js`, `HomePage.jsx`, `VicePrincipalDashboard.jsx` (lối tắt ⇒ `/kitchen`); D `KitchenDashboard.jsx`.
- Tests: `tests/kitchen/kitchen-day.test.mjs`.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-2, AC-3, AC-9 | NUT-02/03 | `kitchen-day.test.mjs` (unit mock) | K2 | — |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Bếp mất trang chủ cũ | Thấp | Trang mới giữ thực đơn hôm nay + việc cơ sở vật chất | Revert commit K2 |

## Validation log
- [x] Mỗi AC có test; Exit có lệnh
- [x] Không dùng rule OPEN như đã chốt

## Progress log
### 2026-10-16 — Lập plan K2 (đang làm)
- Commit: chưa commit

### 2026-10-16 — K2 xong (chờ user review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Test: `tests/kitchen/kitchen-day.test.mjs` 3/3 (số suất chỉ hiện khi chốt; Bếp không thấy tồn; Bếp B không đọc A; HT đọc mọi cơ sở; lưu mẫu tick/đổi ảnh giữ giờ/bỏ tick; chỉ hôm nay; tối đa 1 ảnh; PHT và Bếp B không tick được).
- Trình duyệt (`VITE_AUTH_MODE=mock`, agent-browser): Bếp cơ sở 1 vào trang chủ thấy dòng thời gian 3 mốc, tick lưu mẫu bữa trưa hiện "Đã lưu mẫu 11:28 · Đỗ Văn Bình"; PHT mở `/kitchen` thấy "Cần xử lý" 3 dòng, ô lưu mẫu chỉ xem.
- Khác plan: mốc "Nhận hàng tươi" khi chưa chốt số ghi "Phiếu đi chợ có sau khi chốt số suất" (phát hiện khi xem trình duyệt).
- Tiếp: user review ⇒ plan con K3.
