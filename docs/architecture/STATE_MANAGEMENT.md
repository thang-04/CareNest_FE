# State Management

Nguyên tắc (server vs UI state, refetch sau mutation, không persist dữ liệu trẻ, xóa khi logout, chống race): **`.claude/rules/state.md`** — nguồn duy nhất, không chép lại. Không tính lại nghiệp vụ ở client: FP-NO-CLIENT-RECOMPUTE (`docs/knowledge/PATTERNS.md`), BE ADR-0005. DRAFT/APPROVED của nội dung AI do BE quản lý (FP-AI-DRAFT-UI).

## Hiện thực (đã chốt theo source, 2026-10-20)

| Loại state | Cách làm | File |
| --- | --- | --- |
| Server state | `useAsync(loader, deps, { refreshOnDataChange, enabled })`; hook module bọc lại (`useXxx(id, { live })`) | `src/hooks/useAsync.js`, `src/hooks/<module>/` |
| Sau khi ghi | Gọi facade rồi `reload({ silent: true })`; không sửa tay số liệu dẫn xuất | CODING_GUIDE §4 |
| Chống race | `useAsync` bỏ response cũ (`latestRequest.js`) | `src/hooks/latestRequest.js` |
| UI state toàn cục | Context: user/phiên, toast, năm học, giao diện | `src/contexts/` |
| Bộ lọc giữ khi quay lại | `useFilterParams` (lưu lên URL khi cần) | `src/hooks/useFilterParams.js` |
| Thư viện cache (React Query…) | Không dùng; thêm ⇒ làn L, hỏi trước | — |

Hook mới **dùng `useAsync`**, không tự viết lại cơ chế tải/epoch (nợ: `hooks/account/usePermissions.js`, `useGuardianQuery.js`, `hooks/kitchen/useKitchen.js`).
