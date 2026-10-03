# Profile CODE — bug UI, sửa cục bộ, review nhỏ

Mức: L1. Mục tiêu: tốn ít context nhất mà vẫn đúng.

Đọc:
1. Source + test gần vị trí lỗi: component, hook, store/query, API client call; caller/callee trực tiếp; thay đổi gần đây (`git log -- <file>`).
2. `docs/knowledge/ISSUE_INDEX.md` (FE) + `../CareNest_BE/docs/knowledge/ISSUE_INDEX.md`: grep chuỗi lỗi, tên màn hình, từ khóa VN/EN.
3. BE module card (`.ai/CONTEXT_MAP.yaml` → `keywords`) — chỉ mục Rules, Known pitfalls — khi cần biết hành vi mong đợi.
4. `.claude/rules/` theo loại file đang sửa.

Không đọc: PROJECT_CONTEXT, ADR, flow BE (trừ khi card trỏ tới).

Phân biệt sớm: lỗi FE (render, state, mapping, điều hướng) hay response/contract BE sai? Nghi BE ⇒ nâng L3 (`profiles/cross-repo.md`).

Nâng lên L2/L3 khi sửa có thể đổi hành vi nghiệp vụ hiển thị, ẩn/hiện theo quyền, auth, hoặc cách xử lý lỗi API (status/`desc`) (`.ai/ESCALATION.md`).
