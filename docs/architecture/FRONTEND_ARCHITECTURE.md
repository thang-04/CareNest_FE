> **Status: CHƯA CÓ NỘI DUNG — không dùng làm nguồn.** Kiến trúc client chưa được quyết định; chỉ mục "Ràng buộc đã biết" bên dưới có hiệu lực.

# Frontend Architecture

## Ràng buộc đã biết (dùng được)

| Ràng buộc | Status | Nguồn |
| --- | --- | --- |
| BE là source of truth cho rule, authorization, contract | CONFIRMED | `../CareNest_BE/docs/system/CROSS_REPO_MAP.md` |
| 1 trường / 2 campus, không multi-tenant; scope dữ liệu do BE áp | CONFIRMED | `../CareNest_BE/docs/context/PROJECT_CONTEXT.md` |
| Response BE dạng `{code, desc, data}`, prefix cấu hình được (mặc định `/api`) | CONFIRMED (theo source BE) | `docs/integration/BACKEND_INTEGRATION.md` |
| AI output là DRAFT, cần người duyệt; UI dùng được khi AI tắt | CONFIRMED | BE ADR-0008 |
| React + TypeScript | PROPOSED | `docs/context/REPOSITORY_CONTEXT.md` |
| Next.js (SSR/App Router) | PROPOSED — chưa chốt | — |
| Router, state/cache, UI kit, HTTP client, test tool | Chưa chốt — hỏi trước | `AGENTS.md` "Hỏi trước khi làm" |
| Team 5 người, thời gian giới hạn ⇒ kiến trúc đơn giản đủ dùng | CONFIRMED | BE PROJECT_CONTEXT |

## Cần quyết định (điền khi chốt)

- Rendering: SPA hay SSR.
- Router và cấu trúc layout theo role.
- Server-state/cache library; global UI state (nếu cần).
- UI kit / design system; i18n (chỉ tiếng Việt?).
- Auth: xem `docs/integration/AUTH_FLOW.md`.
- Test: unit/component/e2e tool.

Khi chốt: bỏ header status, ghi quyết định + lý do, cập nhật `docs/INDEX.md` và `.ai/CONTEXT_MAP.yaml`.
