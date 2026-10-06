# Workflow — Plan cho thay đổi làn L (FE)

Template: `docs/plans/_TEMPLATE.md`. Thay đổi cần BE đổi contract/nghiệp vụ ⇒ plan chính ở `BE:docs/plans/active/` (user cho phép sửa BE), plan FE chỉ phần client và link plan BE.

## Khi nào (làn L — bất kỳ điều nào)
- Chọn/đổi thư viện nền (router, state/cache, UI kit, HTTP client), cách lưu token/auth flow.
- `package.json`/lockfile, harness (`.githooks/`, `.claude/hooks/`, `.claude/settings.json`, `scripts/`).
- API client dùng chung, điều hướng/ẩn hiện theo role, ≥2 nhóm màn hình, cần BE đổi contract, >8 file.

Không cần plan file: làn S/M (mini-plan 3–5 gạch trong chat nếu >1 bước). Iron Law vẫn áp dụng.

## Bước
1. `clarify-business.md` trước. Đã có plan cùng chủ đề ⇒ cập nhật, không tạo mới.
2. Tạo `docs/plans/active/YYYY-MM-DD-<slug>.md` từ template, `status: draft`, `branch:` = branch hiện tại.
3. Rule ID BE (chỉ CONFIRMED/ACCEPTED) → AC-n → phase → test.
4. **Tự kiểm** (Validation log): claim có `file:line`; contract BE cần đổi ⇒ liệt kê cụ thể; >8 file hoặc >3 phase ⇒ đề xuất tách; ≥2 phương án ⇒ Key decisions.
5. Trình user. Chỉ khi user duyệt **và** "Câu hỏi mở" hết `- [ ]` ⇒ `status: approved`. Không tự approve.
6. Mỗi phase: làm → verify (`docs/quality/VERIFICATION.md`) → Progress log → **dừng chờ review**.
7. Lệch plan ⇒ "Khác plan" + lý do; đổi quyết định đã chốt ⇒ hỏi user.
8. Xong + DoD ⇒ `status: done`, chuyển `docs/plans/completed/` (commit khi user cho phép).
