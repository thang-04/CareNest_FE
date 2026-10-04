> **Status: CHƯA CÓ NỘI DUNG — không dùng làm nguồn.** Thư viện state/cache chưa chốt. Mục "Nguyên tắc" bên dưới có hiệu lực ngay (ACCEPTED theo ownership BE/FE).

# State Management

## Nguyên tắc (dùng được)

- Server state vs UI state, refetch sau mutation, optimistic update, không persist dữ liệu trẻ, xóa cache khi logout, filter scope: **`.claude/rules/state.md`** (nguồn duy nhất, không chép lại ở đây).
- Không tính lại nghiệp vụ ở client; dữ liệu dẫn xuất đã xác nhận là snapshot: FP-NO-CLIENT-RECOMPUTE (`docs/knowledge/PATTERNS.md`), BE ADR-0005.
- Trạng thái DRAFT/APPROVED của nội dung AI do BE quản lý; client chỉ phản ánh (FP-AI-DRAFT-UI).

## Cần quyết định (điền khi chốt)

- Thư viện server-state/cache và chiến lược invalidate theo vùng nghiệp vụ.
- Có cần global store không; nếu có, chứa gì.
- Chính sách refetch (focus, interval) cho dashboard.
