# Chọn context cho task Web

Đọc `AGENTS.md` và mô tả task trước. Chọn một hàng chính; chỉ mở thêm context khi tác động thực tế yêu cầu.

| Task | Profile | Workflow | Mức đầu tiên |
| --- | --- | --- | --- |
| Bug UI, validation, refactor cục bộ | `profiles/code.md` | `workflows/fix-bug.md` | L1 |
| Màn hình hoặc chức năng Web mới | `profiles/feature.md` | `workflows/implement-feature.md` | L2 |
| Review code Web | `profiles/code.md` | `workflows/review-code.md` | L1 |
| Tích hợp endpoint, auth hoặc thay đổi contract | `profiles/feature.md` | `workflows/integrate-api.md` | L2; L3 nếu đổi BE/APP |
| Thay đổi ảnh hưởng BE/APP hoặc nhiều domain | `profiles/cross-repo.md` | Workflow theo loại thay đổi | L3 |
| Kiến trúc client, security hoặc triển khai lớn | `profiles/cross-repo.md` | Chọn workflow hiện có nếu phù hợp | L4 |

Mức L1–L4 ở `ESCALATION.md`. Chỉ các đường dẫn trong `CONTEXT_MAP.yaml` mục `available` được coi là đã tồn tại.

