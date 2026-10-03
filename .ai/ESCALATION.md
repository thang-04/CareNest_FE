# Escalation — mở rộng context theo mức

`BE:` = `../CareNest_BE/` (sibling) hoặc https://github.com/thang-04/CareNest_BE.git nếu không có sibling (nói rõ đã đọc remote). Không mức nào đọc toàn bộ `docs/` trừ FULL. Đọc theo thứ tự; dừng khi đủ bằng chứng.

| Mức | Khi nào | Đọc FE (cộng dồn) | Đọc BE (cộng dồn) |
| --- | --- | --- | --- |
| L1 cục bộ | Bug/sửa trong 1 component/hook/màn hình | Source + test gần nhất · dòng liên quan `docs/knowledge/ISSUE_INDEX.md` · `.claude/rules/` theo file | Module card `BE:docs/modules/<m>.md` (Rules, Known pitfalls) · grep `BE:docs/knowledge/ISSUE_INDEX.md` |
| L2 feature | Màn hình mới / đổi luồng / gọi API mới | + `docs/architecture/ROUTE_MAP.md` · `docs/features/README.md` · `docs/integration/BACKEND_INTEGRATION.md` | + flow trong card (`BE:docs/business/flows/`) · rule ID nhóm module trong `BE:docs/business/BUSINESS_RULES.md` · `BE:docs/business/USER_ROLES.md` (permission) · `BE:docs/contracts/API_CONVENTIONS.md`, `ERROR_CONTRACT.md` |
| L3 liên repo / nhiều vùng | Contract cần đổi, nghi bug BE, ảnh hưởng APP, chạm tín hiệu Bảng 2 router | + `docs/architecture/STATE_MANAGEMENT.md` · `docs/integration/AUTH_FLOW.md` (nếu auth) | + `BE:docs/system/CROSS_REPO_MAP.md` · `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` · card các module chạm · ADR được card trỏ tới |
| L4 hệ thống | Kiến trúc client, security, auth, chọn thư viện nền | + `docs/architecture/*` · `docs/context/*` | + `BE:docs/system/SYSTEM_ARCHITECTURE.md` · `BE:docs/architecture/SECURITY.md` · `BE:docs/contracts/AUTH_CONTRACT.md` · `BE:docs/context/PROJECT_CONTEXT.md` · ADR liên quan |
| FULL | Onboarding, audit, thiết kế lại | `docs/INDEX.md` → toàn bộ FE docs | `BE:docs/INDEX.md` theo nhu cầu |

## Quy tắc

- Phát hiện dependency ngoài phạm vi đang đọc ⇒ nâng 1 mức, nói rõ lý do.
- Gặp rule/actor PENDING hoặc OPEN ⇒ không suy đoán: nêu khoảng trống, đề xuất cấu hình được, hoặc hỏi.
- File có header `Status: CHƯA CÓ NỘI DUNG` (FE hoặc BE) ⇒ không dùng làm nguồn.
- Code, docs, yêu cầu mâu thuẫn ⇒ nêu xung đột, xác minh intended behavior trước khi sửa. FE docs ≠ BE docs ⇒ BE thắng.
- Đường dẫn trong `CONTEXT_MAP.yaml > planned` chưa tồn tại — không viện dẫn.
