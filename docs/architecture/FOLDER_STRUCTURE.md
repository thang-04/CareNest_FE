# Folder Structure

Nguồn duy nhất: `docs/architecture/CODING_GUIDE.md` §2 (cây `src/`, tầng, import) và §5 (đặt file khi thêm module). File này chỉ tóm quy tắc tra nhanh, không chép lại cây thư mục.

- **Layer-first + module grouping:** `src/<layer>/<module>/` cho phần riêng; gốc `src/<layer>/` cho phần dùng chung. Layer: `pages`, `components`, `hooks`, `services`, `models`, `utils`, `styles/modules`.
- **Tên module** (kebab-case) giống nhau ở mọi layer: vd. `attendance` ⇒ `pages/attendance/`, `components/attendance/`, `hooks/attendance/`, `services/attendance/{attendanceService.js,mock/,api/}`, `models/attendance/`, `utils/attendance/`, `styles/modules/attendance.css`.
- **Component chung:** `components/ui/` (kit), `components/form/`, `charts/`, `print/`, `upload/`, `signature/`, `asset/`, `brand/`. Danh mục: `DESIGN.md` §6.3.
- **Test:** `tests/<nhóm>/*.test.mjs`, đăng ký script trong `package.json` và `npm run verify`.
- **Đặt tên file:** component/page PascalCase `.jsx`; hook `useXxx.js`; service `xxxService.js`; còn lại camelCase `.js` (CODING_GUIDE §7).
- Thêm module mới ⇒ ESLint tự áp ranh giới cho thư mục mới (đọc danh sách module từ `src/`).
