# Workflow — Implement feature (Web)

Làn S (`AGENTS.md`): bước 0, 5, 6, 8 — rule 1 dòng. Làn L: bước 0 rồi `plan-change.md`, làm theo phase.

0. **Làn + nghiệp vụ:** xác định làn S/M/L (`AGENTS.md`); đổi nghiệp vụ/thứ người dùng thấy ⇒ `clarify-business.md` (hỏi tới khi rõ, đối chiếu tài liệu, ảnh hưởng) trước khi code; làn L ⇒ `plan-change.md`.
1. **Requirement:** actor, outcome, điều kiện hoàn thành. Map sang **BE module card + rule ID** (`.ai/CONTEXT_MAP.yaml` → `keywords`). Dẫn chiếu rule ID, không chép nội dung rule vào FE. Rule/actor PENDING hoặc OPEN ⇒ nêu khoảng trống, hỏi hoặc làm theo permission BE trả về — không tự quyết.
2. **Business flow:** đọc flow trong card (`../CareNest_BE/docs/business/flows/`). Chỉ bước `[S]` là hành động trên hệ thống; bước `[B]` không thành màn hình.
3. **Screen / route / state:**
   - Đặt màn hình vào screen group trong `docs/architecture/ROUTE_MAP.md` (actor nào, ẩn/hiện theo permission).
   - Xác định server state (từ BE) vs UI state (form, filter, tab) theo `docs/architecture/STATE_MANAGEMENT.md`. Không tính lại số liệu nghiệp vụ ở client (vd. số suất, trend sức khỏe) — hiển thị số BE trả về.
   - Đủ trạng thái: loading, empty, error, 403/404, submitting, DRAFT/APPROVED nếu có duyệt.
   - Thư viện nền chưa chốt ⇒ hỏi trước (xem `AGENTS.md` "Hỏi trước khi làm").
4. **API integration:** theo `.ai/workflows/integrate-api.md`. Endpoint chưa có ⇒ mô tả contract cần thống nhất, không mock như thể đã có.
5. **Code:** module mới ⇒ 12 bước `docs/architecture/CODING_GUIDE.md` §5. Màn hình ⇒ công thức `DESIGN.md` §8; **tra §6.3 trước khi tạo component/class** (dùng ở module thứ 2 ⇒ promote lên phần chung trong cùng PR). Code của module khác cần dùng ⇒ promote, không import chéo (ESLint chặn). Rule tự nạp: `.claude/rules/` (architecture, javascript, component, ui-style, state, api-client). Pattern có sẵn trong source thắng đề xuất mới.
6. **Test:** component test cho hành vi chính + lỗi API + ẩn/hiện theo permission; dữ liệu giả. Nêu rõ phần chưa chạy trên trình duyệt/BE thật. Kiểm tra accessibility cơ bản (label, focus, keyboard) và responsive cho màn hình có form/bảng.
7. **Docs & memory:** cập nhật `docs/architecture/ROUTE_MAP.md` (screen thực tế), `docs/context/CURRENT_STATE.md`, tạo/cập nhật `docs/features/<feature>.md` theo template nếu màn hình phức tạp. Edge case đáng nhớ ⇒ `.ai/workflows/update-knowledge.md` T3. Cần BE đổi contract ⇒ liệt kê trong báo cáo.
8. **Verify + báo cáo** theo `docs/quality/VERIFICATION.md` (mẫu theo làn); `node scripts/verify.mjs` đã gồm lint ranh giới module và `check-design`. Checklist `DESIGN.md` §13.3 + `CODING_GUIDE.md` §9. Báo: đã chạy gì, chưa kiểm chứng gì, phần chờ BE/APP. Đối chiếu `docs/quality/DEFINITION_OF_DONE.md`.
