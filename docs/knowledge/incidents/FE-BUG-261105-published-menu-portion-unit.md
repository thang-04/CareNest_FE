---
id: FE-BUG-261105-published-menu-portion-unit
type: bug
screens: [kitchen-published-menu]
be_modules: []
rules: []
status: fixed
date: 2026-11-05
keywords: [định lượng một suất, qtyPerPortion, đơn vị, kg, gam, portions, nhóm tuổi, mock bếp]
similar_to: []
---

# FE-BUG-261105 — Thực đơn bếp nhận hiện "gạo 30 kg / suất" (sai đơn vị, bỏ qua nhóm tuổi)

- **Vùng:** `src/services/kitchen/mock/kitchenMockRepository.js` › `getPublishedMenu` (chỉ chế độ mock; khi nối BE `/kitchen/published-menu` mở màn Bếp hôm nay).
- **Triệu chứng:** cột "Lượng / suất" ở `/kitchen/published-menu` ghi gạo tẻ 30 kg, sữa tươi 150 hộp cho một suất.
- **Nguyên nhân:** món lấy từ danh mục Thực đơn (`db.dishes`) có định lượng **g / ml một trẻ** — `quantity` (khẩu phần chuẩn) và `portions[ageGroupId]` theo nhóm tuổi. Repo bếp gắn đơn vị **kho** của thực phẩm (`normalizeFood` › `unit = stockUnit`: kg, lít, hộp) và lấy `quantity` chuẩn, bỏ qua nhóm tuổi của thực đơn.
- **Sửa:** `normalizeFood` giữ thêm `baseUnit` (g / ml); `getPublishedMenu` lấy `ingredientQty({ portions }, menu.ageGroupId)` khi món có `portions`, đơn vị `baseUnit`. Nhóm tuổi chưa nhập định lượng ⇒ `null`, màn hiện "Chưa nhập cho nhóm tuổi này". Món mẫu của bếp (`seedDishes`, không có `portions`) giữ khẩu phần chuẩn theo đơn vị kho.
- **Bài học:** trong module bếp có hai hệ đơn vị — định lượng món (g / ml một trẻ) và đơn vị kho / mua (kg, lít, hộp). Hiển thị định lượng thì dùng `baseUnit`; chỉ phiếu đi chợ / kho mới quy đổi sang đơn vị kho (`toStockQty`).
- **Trạng thái:** fixed (2026-11-05).
