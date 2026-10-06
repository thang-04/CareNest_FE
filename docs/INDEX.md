# Docs Index — CareNest_FE

Người đọc muốn hiểu kiến trúc tài liệu AI (3 repo, thư mục nào làm gì): `BE:docs/README_AI.md`.

Không đọc hết. Task thường: `.ai/ROUTER.md` → BE module card + FE doc được map trong `.ai/CONTEXT_MAP.yaml`. Status: **FULL** = dùng làm nguồn · **SKELETON** = chưa có nội dung, không dùng làm nguồn.

Nghiệp vụ, rule, contract, kiến trúc hệ thống **không nằm ở đây** — xem `../CareNest_BE/docs/INDEX.md` (source of truth).

| Nhóm | File | Nội dung | Status |
| --- | --- | --- | --- |
| context | `context/REPOSITORY_CONTEXT.md` | Trách nhiệm Web, actor phục vụ, FE không sở hữu gì | FULL |
| | `context/CURRENT_STATE.md` | Trạng thái source/màn hình | FULL |
| architecture | `architecture/ROUTE_MAP.md` | Role → screen group (actor PENDING được đánh dấu) | FULL (mức screen group) |
| | `architecture/STATE_MANAGEMENT.md` | Nguyên tắc server state / UI state | SKELETON + nguyên tắc |
| | `architecture/FRONTEND_ARCHITECTURE.md` | Kiến trúc client | SKELETON + ràng buộc đã biết |
| | `architecture/FOLDER_STRUCTURE.md` | Cấu trúc thư mục `src/` | SKELETON |
| features | `features/README.md` | Feature nghiệp vụ → màn hình Web → BE card/flow; template doc feature | FULL |
| integration | `integration/BACKEND_INTEGRATION.md` | Envelope, lỗi, 403/404, phân quyền phía client | FULL (theo BE hiện tại) |
| | `integration/AUTH_FLOW.md` | Đăng nhập, token, phiên | SKELETON |
| knowledge | `knowledge/ISSUE_INDEX.md` | **Search đầu tiên khi debug** (bug UI/client, kể cả bug đang `open`) | FULL (chưa có issue) |
| | `knowledge/incidents/_TEMPLATE.md` | Mẫu incident (có Attempts) | FULL |
| | `knowledge/KNOWN_ISSUES.md` | Known Limitations: giới hạn cố ý/chưa làm (không phải bug) | FULL |
| | `knowledge/TROUBLESHOOTING.md` | Lỗi build/dev/môi trường | FULL (chưa có mục) |
| | `knowledge/PATTERNS.md` | Bài học tổng quát hóa | FULL |
| quality | `quality/DEFINITION_OF_DONE.md` | Tiêu chí hoàn thành FE + memory checklist | FULL |
| | `quality/VERIFICATION.md` | Bằng chứng trước khi báo xong (Iron Law, theo làn) | FULL |
| plans | `plans/_TEMPLATE.md`, `plans/active/`, `plans/completed/` | Plan làn L (`.ai/workflows/plan-change.md`) | FULL |

## Đọc ở BE (thường dùng)

| Cần | File BE |
| --- | --- |
| Bối cảnh dự án, scope V1, exclusions | `../CareNest_BE/docs/context/PROJECT_CONTEXT.md` |
| Role, scope, permission | `../CareNest_BE/docs/business/USER_ROLES.md` |
| Rule ID + Pending register | `../CareNest_BE/docs/business/BUSINESS_RULES.md` |
| Module card (điểm đọc chính theo nghiệp vụ) | `../CareNest_BE/docs/modules/README.md` |
| Ownership BE/FE/APP | `../CareNest_BE/docs/system/CROSS_REPO_MAP.md` |
| API / lỗi | `../CareNest_BE/docs/contracts/API_CONVENTIONS.md`, `ERROR_CONTRACT.md` |
| Issue nghiệp vụ/contract | `../CareNest_BE/docs/knowledge/ISSUE_INDEX.md`, `CROSS_MODULE_ISSUES.md` |
