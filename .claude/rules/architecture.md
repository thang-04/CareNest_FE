---
paths:
  - "src/**/*.js"
  - "src/**/*.jsx"
  - "src/**/*.css"
---

# Architecture rules — tầng, ranh giới module, chung/riêng

> Nguồn: `docs/architecture/CODING_GUIDE.md` §2, §4, §5. ESLint (`npm run lint`) chặn import chéo module và icon ngoài `icons.js`.

- **Tầng:** page/component → hook (`useAsync`) → facade `services/<module>/<x>Service.js` → `mock/` hoặc `api/`. UI không import `@/mocks/*`, không đụng localStorage. Đọc dữ liệu qua hook; ghi qua hàm facade rồi `reload({ silent: true })`.
- **Nghiệp vụ:** mock repo = BE giả (luật kèm rule ID BE). Page/component/hook/utils hiển thị **không** tính số suất, tổng hợp, chuyển trạng thái — gọi action facade, hiển thị số service trả (`AGENTS.md` invariant 2).
- **Ranh giới:** file trong `src/<layer>/<module>/` chỉ import module của chính nó hoặc phần chung (gốc layer, `components/{ui,form,charts,print,upload,signature,asset,brand}`, `services/http`). Ngoại lệ duy nhất: trang ở gốc `src/pages/`. `*/dashboard/` không phải ngoại lệ. Danh sách nợ `CROSS_MODULE_DEBT` trong `.eslintrc.cjs` chỉ được **xóa bớt**; không thêm dòng mới để lách lint.
- **Chung hay riêng:** trước khi viết component/class: tra `DESIGN.md` §6.3. Dùng ở 1 module ⇒ `components/<module>/`. Module thứ 2 cần ⇒ promote lên phần chung trong cùng PR + cập nhật §6.3 và `/ui-kit`. Không bọc component chung chỉ để đổi tên prop. Thiếu thì thêm vào phần chung, không dựng bản riêng (Tabs, ô chọn điểm trường, KPI, lịch sử, nhãn AI — xem §14.1 nợ trùng lặp).
- **Import:** alias `@/`, import thẳng file (`@/components/ui/Modal`); barrel không bắt buộc.
- **Thêm module:** theo 12 bước CODING_GUIDE §5 (model → utils → mock → api → facade → hook → badge → page → route → menu → CSS → kiểm tra).
- **Quyền:** `canXxx(entity, user)` trong `utils/<module>/*Permissions.js` chỉ ẩn/hiện; entity có cờ `can*` từ BE thì dùng cờ; không so `user.role` trực tiếp trong page/component.
