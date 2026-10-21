---
paths:
  - "src/hooks/**/*.js"
  - "src/hooks/**/*.jsx"
  - "src/contexts/**/*.jsx"
---

# State rules

> Hiện thực: server state bằng `useAsync` (`src/hooks/useAsync.js`), UI state toàn cục bằng Context (`src/contexts/`), không thư viện cache — `docs/architecture/STATE_MANAGEMENT.md`. Thêm thư viện state/cache ⇒ làn L, hỏi trước.

- Hook đọc dữ liệu mới **dùng `useAsync(loader, deps, { refreshOnDataChange, enabled })`**, không tự viết lại epoch/sự kiện/loading. Hook module nhận `{ live }`; trang đang nhập liệu dùng `live: false` để không mất dữ liệu đang gõ.
- **Server state** (từ BE/service) và **UI state** (form, filter, tab, modal) tách riêng; không sao chép server state vào Context rồi sửa tay.
- Sau mutation ⇒ `reload({ silent: true })` / refetch từ service; không tự cập nhật số liệu dẫn xuất ở client. Optimistic update chỉ cho thay đổi không có hệ quả nghiệp vụ, phải rollback khi lỗi.
- Không lưu dữ liệu trẻ/sức khỏe vào `localStorage`/`sessionStorage`/IndexedDB. Token chỉ qua `services/http/tokenStorage.js`.
- Đổi user/logout ⇒ xóa toàn bộ state của user cũ.
- Filter đang chọn (campus, lớp, ngày) là UI state; cần giữ khi quay lại ⇒ `useFilterParams`. Danh sách campus/lớp được chọn lấy từ service, không tự suy theo role.
- Request phụ thuộc filter phải chống race (`useAsync` đã bỏ response cũ); effect tự viết phải cleanup khi unmount.
- Hook/context không import `@/mocks/*` (đi qua service).
