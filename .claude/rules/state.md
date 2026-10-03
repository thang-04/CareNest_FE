---
paths:
  - "src/**/*store*.ts"
  - "src/**/*store*.tsx"
  - "src/**/*state*.ts"
  - "src/**/*query*.ts"
  - "src/**/hooks/**/*.ts"
  - "src/**/use*.ts"
  - "src/**/use*.tsx"
---

# State rules

> Thư viện state/cache: chưa chốt (hỏi trước). Nguyên tắc: `docs/architecture/STATE_MANAGEMENT.md`.

- **Server state** (dữ liệu từ BE) và **UI state** (form, filter, tab, modal) tách riêng. BE là nguồn sự thật của server state; không sao chép server state vào global store rồi sửa tay.
- Sau mutation (lưu điểm danh, xác nhận suất, duyệt thực đơn/summary...) ⇒ refetch/invalidate dữ liệu liên quan từ BE; không tự cập nhật số liệu dẫn xuất ở client. Optimistic update chỉ cho thay đổi không có hệ quả nghiệp vụ, và phải rollback khi lỗi.
- Không lưu dữ liệu trẻ/sức khỏe vào `localStorage`/`sessionStorage`/IndexedDB. Token: theo `docs/integration/AUTH_FLOW.md` (chưa chốt).
- Đổi user/logout ⇒ xóa toàn bộ cache server state và UI state của user cũ.
- Filter đang chọn (campus, lớp, ngày) là UI state; danh sách campus/lớp được phép chọn lấy từ BE, không tự suy luận theo role.
- Request phụ thuộc filter phải chống race (bỏ response cũ khi filter đổi).
- Effect phải cleanup (abort request, unsubscribe) khi unmount.
