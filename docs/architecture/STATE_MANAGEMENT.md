> **Status: CHƯA CÓ NỘI DUNG — không dùng làm nguồn.** Thư viện state/cache chưa chốt. Mục "Nguyên tắc" bên dưới có hiệu lực ngay (ACCEPTED theo ownership BE/FE).

# State Management

## Nguyên tắc (dùng được)

1. **Server state từ BE là nguồn sự thật.** FE cache để hiển thị, không biến cache thành bản ghi chính.
2. **Không tính lại nghiệp vụ ở client:** số suất ăn, định lượng, trend sức khỏe, tổng hợp báo cáo, trạng thái duyệt — hiển thị giá trị BE trả. Dữ liệu dẫn xuất đã xác nhận ở BE là snapshot (BE ADR-0005); client không "sửa cho khớp".
3. **Sau mutation ⇒ refetch/invalidate** dữ liệu liên quan từ BE. Optimistic update chỉ cho thay đổi không có hệ quả nghiệp vụ, phải rollback khi lỗi.
4. **UI state tách khỏi server state:** form, filter (campus/lớp/ngày), tab, modal.
5. **Phạm vi dữ liệu không suy luận ở client:** danh sách campus/lớp được chọn lấy từ BE theo user.
6. **Không persist dữ liệu trẻ/sức khỏe** ở storage trình duyệt. Logout/đổi user ⇒ xóa toàn bộ cache.
7. Trạng thái DRAFT/APPROVED của nội dung AI do BE quản lý; client chỉ phản ánh.

Rule code tương ứng: `.claude/rules/state.md`.

## Cần quyết định (điền khi chốt)

- Thư viện server-state/cache và chiến lược invalidate theo vùng nghiệp vụ.
- Có cần global store không; nếu có, chứa gì.
- Chính sách refetch (focus, interval) cho dashboard.
