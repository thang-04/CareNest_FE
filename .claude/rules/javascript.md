---
paths:
  - "src/**/*.js"
  - "src/**/*.jsx"
  - "tests/**/*.mjs"
---

# JavaScript rules

> Repo dùng **JavaScript/JSX**, không TypeScript (`docs/architecture/FRONTEND_ARCHITECTURE.md`). Đặt tên, Prettier, ESLint: `docs/architecture/CODING_GUIDE.md` §7. Pattern có sẵn trong source thắng rule chung.

- Shape request/response theo DTO BE (field `camelCase` như BE trả). Hằng trạng thái và nhãn ở `models/<module>/*Constants.js` (`XXX_STATUS`, `XXX_STATUS_LABELS`), giá trị khớp BE; không tự thêm trạng thái BE không có.
- Ngày `YYYY-MM-DD`, thời điểm ISO-8601 giữ dạng string ở tầng service; định dạng hiển thị bằng `utils/format.js` theo `Asia/Ho_Chi_Minh`. Hàm ngày/số chưa có (`addDays`, `toIso`, `formatNumber` — hiện bị viết lại ~8 lần) ⇒ thêm **một lần** vào `utils/format.js` rồi dùng, không viết trong module; không dùng `toISOString()` cho ngày địa phương (lệch múi giờ).
- Role chỉ qua `ROLES` (`src/models/User.js`); không so chuỗi `'TEACHER'` trong code. Quyền qua `canXxx` (`.claude/rules/architecture.md`).
- Lỗi từ service hiển thị `toast.error(err, '<tiêu đề>')` — không `toast.error(err.message)` (mất chi tiết/status). Không nuốt lỗi bằng `catch {}` trừ khi có comment lý do.
- Không để `console.log`; không JSDoc tràn lan (comment theo `AGENTS.md` "Comment trong code").
