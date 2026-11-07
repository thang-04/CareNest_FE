---
title: Làm lại UI màn bán trú (đợt 1) + thực đơn mẫu 1 ngày
status: in-progress
owner: thangnd
jira: chưa có / chưa có   # user chưa cho mã Jira, nhánh — xem Câu hỏi mở
branch: fix/G94-272-FE-FIX-01-e2e-flow-fixes
modules: [nutrition, menu-planning]
rules: [NUT-07, NUT-08, NUT-10, NUT-13, NUT-18, NUT-20, NUT-23, NUT-24, NUT-25]
risk: high
created: 2026-11-04
updated: 2026-11-04
---
# Làm lại UI màn bán trú (đợt 1) + thực đơn mẫu 1 ngày

Plan BE: `BE:docs/plans/active/2026-11-04-day-template-per-meal-nutrition.md` (worktree `../CareNest_BE-day-boarding`).

## Context
User chê dropdown, thẻ, nhãn của các màn bán trú "rất xấu và khó dùng" (ảnh `ui-review/boarding-focus-2026-11-04/user-evidence/`). Đánh giá trước: `ui-review/boarding-focus-2026-11-04/UI_AUDIT.md`. Wireframe đã duyệt: `ui-review/boarding-wireframe-2026-11-04/ban-tru-wireframe.html` (user chọn A cho Tuần, Mẫu ngày, Thiết lập; thêm Thực phẩm A).

## Quyết định đã chốt
1. Thực đơn mẫu là mẫu cho **1 ngày**; ở thực đơn tuần chọn mẫu cho từng ngày, ngày được điền món theo mẫu — user, 2026-11-04 (đổi NUT-13).
2. Ảnh sản phẩm khác chỉ tham khảo bố cục; cải tiến từ màn CareNest đang có, không chép trường — user, 2026-11-04.
3. User cho sửa BE trong phiên này — user, 2026-11-04.
4. Phương án A cho Tuần, Mẫu ngày, Thiết lập; bảng dinh dưỡng 1 trẻ/ngày là thẻ thường dưới các bữa, không dính đáy, không tab Thực phẩm — user, 2026-11-04.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** PHT dinh dưỡng · lập mẫu ngày, lập kế hoạch tuần, sửa thực phẩm · NUT-13 (đổi), NUT-08, NUT-24 · `[B]` mẫu, kế hoạch, đánh giá; `[S]` điền món từ mẫu vào bản nháp.
- **Đối chiếu:** `BE:docs/business/BUSINESS_RULES.md` NUT-13 ghi bộ 4 tuần; yêu cầu mới 1 ngày ⇒ BE đổi contract `/nutrition/menu-templates`.
- **Ảnh hưởng:** FE `/menu/templates*`, `/menu/weekly`, `/menu/setup`, `/menu/foods`; BE template, evaluator (`SessionRow`), menu-statistics (`dishIngredients`). APP không dùng mẫu.

### Câu hỏi mở
Không còn câu hỏi nghiệp vụ. Việc chờ user trước khi commit: mã Jira + nhánh cho luồng này (đang sửa trên nhánh hiện tại, chưa commit).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Mẫu 1 ngày hay bộ 4 tuần | 1 ngày | user | 2026-11-04 | NUT-13 (BE) |
| Món điền từ mẫu sửa từng món được không | Được (agent chọn, chế độ tự chạy) | agent | 2026-11-04 | — |
| Đổi mẫu khi ngày đã có món | Hỏi trước rồi thay (agent chọn) | agent | 2026-11-04 | — |
| Lưu ngày theo mẫu nào | Không lưu (agent chọn) | agent | 2026-11-04 | — |
| Thành phần món trong mẫu | Chỉ xem, sửa ở trang món (NUT-18) (agent chọn) | agent | 2026-11-04 | — |

## Acceptance criteria
- **AC-1** (NUT-13): Given mẫu ngày cùng khối, When chọn mẫu cho một ngày trống, Then ngày được điền món của mẫu theo bữa; ngày đã có món ⇒ hộp xác nhận trước.
- **AC-2**: Dropdown trên các màn đợt 1 không dùng `<select>` gốc trên desktop; danh sách dài có ô tìm không dấu; phím ↑↓ Enter Esc dùng được.
- **AC-3** (NUT-24): Màn sửa mẫu hiện bảng dinh dưỡng 1 trẻ/ngày theo bữa (đạm, béo, bột đường g + % kcal, kcal, % cả ngày, tiền) do BE trả, hàng Cả ngày tô thấp/cao theo trạng thái BE.
- **AC-4**: Sửa thực phẩm trong modal ngay trên danh sách, cùng các trường của form hiện có; có trang sửa nhiều thực phẩm.
- **AC-5**: Cấu hình nhóm tuổi: bảng tổng quan còn thông tin để chọn nhóm; chỉ số ở trang chi tiết; bản đang áp dụng hiện dạng chữ.
- **AC-6**: Probe 375px không cuộn ngang; `node scripts/verify.mjs` pass sau lần sửa cuối.

## Phases
### Phase 1 — Control dùng chung
- `SearchSelect` thêm phím, nhóm, ẩn ô tìm khi ≤8 mục, panel không bị cắt; `chip` một kiểu có chấm; card khu bán trú nền đặc, không bóng.
### Phase 2 — Thực phẩm: modal sửa + sửa nhiều
### Phase 3 — Mẫu ngày (chờ BE contract)
### Phase 4 — Thực đơn tuần A, Cấu hình nhóm tuổi A
### Phase 5 — Verify, probe 375, báo cáo
Đợt sau: phiếu nhập kho, khung giờ ảnh, Bán trú hôm nay, Suất ăn.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Đổi `SearchSelect`, `chip` dùng chung | Màn khác đổi dáng | Giữ API cũ, chỉ thêm prop | Revert file |
| BE migration tách bộ 4 tuần | Dữ liệu mẫu cũ thành nhiều mẫu ngày | Migration giữ đủ món, đặt tên theo tuần/thứ | Restore DB dev |

## Progress log
### 2026-11-04 — bắt đầu code (chế độ tự chạy)
- Giao BE cho subagent ở worktree `CareNest_BE-day-boarding`; FE làm Phase 1–2 song song.

### 2026-11-04 — Phase 1–4 done, chờ user soát
- Commit: chưa commit (chưa có mã Jira + nhánh).
- Verify FE: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (sau lần sửa cuối); `node scripts/check-ai-layer.mjs` → 0 lỗi.
- Verify BE (`../CareNest_BE-day-boarding`): `node scripts/verify.mjs` → `VERIFY PASS full | tests 1020 fail 0 err 0 skip 0 | archunit ok | snapshot ok | spotless ok | 811s` — chạy nền vì quá 10 phút.
- Soát UI: `/menu/weekly`, `/menu/templates`, `/menu/templates/:id`, `/menu/templates/new` chụp với dữ liệu giả chặn ở `/be-api` (máy không chạy BE); `/menu/foods`, `/menu/setup` ở chế độ mock. 1280 và 375: không cuộn ngang.
- Phase 1: `SearchSelect` viết lại (portal, phím ↑↓ Enter Esc, nhóm, dòng phụ, biến thể "Thêm"); `.chip` một kiểu có chấm; thẻ khu bán trú nền đặc (`data-area="boarding"` ở MainLayout, tranh nền giữ nguyên).
- Phase 2: `useFoodForm` + `FoodEditor` dùng chung trang và modal `FoodEditModal`; danh sách thực phẩm 14 → 9 cột (đạm, béo, tinh bột chỉ hiện khi sửa hàng loạt); bộ lọc phụ dùng SearchSelect.
- Phase 3: mẫu một ngày — `menuTemplateGrid` mới; danh sách trái + sửa phải; mỗi bữa một khối; modal chọn nhiều món theo loại món; thành phần món chỉ xem; bảng dinh dưỡng theo bữa + động vật–thực vật (BE `SessionRow`, `dishIngredients`). Bỏ `CopyTemplateDialog`.
- Phase 4: kế hoạch tuần — dải 5 ngày, chọn mẫu ngày ở đầu cột (hỏi trước khi thay món), bộ chọn món có tìm; lưu ý và bảng kiểm thu gọn. Cấu hình nhóm tuổi: tổng quan 11 → 8 cột; bảng định mức chi tiết rộng tối đa 760px.
- Khác plan: không làm trang sửa nhiều thực phẩm riêng — màn đã có chế độ sửa hàng loạt tại chỗ, giữ. Bảng định mức chi tiết giữ ô nhập khi có quyền (sửa = tạo bản mới), chỉ giới hạn rộng.
- Tri thức: `docs/knowledge/incidents/FE-BUG-261104-css-class-collision-td-nut.md` + 1 dòng ISSUE_INDEX.
- Đợt sau: phiếu nhập kho, khung giờ ảnh (HH:mm 24h), Bán trú hôm nay, Suất ăn.
