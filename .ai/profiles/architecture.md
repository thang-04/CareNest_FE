# Profile ARCHITECTURE — kiến trúc client, auth, chọn thư viện nền

Mức: L3–L4. Ưu tiên đủ bằng chứng hơn tiết kiệm token.

Đọc:
1. `docs/architecture/` (FRONTEND_ARCHITECTURE, FOLDER_STRUCTURE, STATE_MANAGEMENT, ROUTE_MAP) — lưu ý file SKELETON không phải nguồn.
2. `docs/integration/BACKEND_INTEGRATION.md`, `docs/integration/AUTH_FLOW.md`.
3. BE: `../CareNest_BE/docs/system/SYSTEM_ARCHITECTURE.md`, `docs/system/CROSS_REPO_MAP.md`, `docs/architecture/SECURITY.md`, `docs/contracts/` (AUTH_CONTRACT có thể là SKELETON).
4. `docs/context/REPOSITORY_CONTEXT.md` + `../CareNest_BE/docs/context/PROJECT_CONTEXT.md` (ràng buộc team, scope V1).

Kiểm tra:
- Quyết định có thuộc danh sách "Hỏi trước khi làm" trong `CLAUDE.md` (framework, router, state/cache, UI kit, lưu token, dependency)? Có ⇒ trình bày phương án + trade-off, **chờ user chốt**.
- Có khiến FE tự tính lại dữ liệu nghiệp vụ hoặc tự quyết quyền không? Có ⇒ sai hướng.
- Tác động tới APP (dùng chung endpoint/auth)? ⇒ `profiles/cross-repo.md`.

Quyết định đã chốt ⇒ cập nhật file SKELETON tương ứng thành FULL (bỏ header status), cập nhật `docs/INDEX.md` và `.ai/CONTEXT_MAP.yaml` (`skeleton_only` → `available`). Quyết định ảnh hưởng BE ⇒ đề xuất ADR ở BE, không tự sửa BE.
