# Patterns & Lessons — CareNest_FE

Bài học **đã tổng quát hóa** từ incident FE hoặc quyết định thiết kế. Mỗi pattern có nguồn. Pattern từ thiết kế (chưa có incident) đánh dấu `nguồn: thiết kế`. Pattern phía BE: `../CareNest_BE/docs/knowledge/PATTERNS.md`.

## FP-NO-CLIENT-RECOMPUTE — Không tính lại nghiệp vụ ở client
- Quy tắc: số suất, định lượng, trend, tổng hợp báo cáo, trạng thái duyệt hiển thị đúng giá trị BE trả; client chỉ format.
- Ví dụ sai: đếm số trẻ "có mặt" trên bảng điểm danh rồi hiển thị như số suất ăn.
- Nguồn: thiết kế (BE ADR-0005, P-STALE-DERIVED).

## FP-UI-HIDE-IS-NOT-AUTHZ — Ẩn UI không phải phân quyền
- Quy tắc: ẩn nút/menu theo permission BE là UX; màn hình vẫn xử lý 403/404; không lọc dữ liệu theo scope ở client.
- Nguồn: thiết kế (BE `CROSS_REPO_MAP.md`, ADR-0003).

## FP-REFETCH-AFTER-MUTATION — Refetch sau thay đổi
- Quy tắc: sau lưu/xác nhận/duyệt ⇒ invalidate và lấy lại dữ liệu từ BE thay vì tự sửa cache số liệu dẫn xuất.
- Nguồn: thiết kế.

## FP-AI-DRAFT-UI — Nội dung AI luôn là bản nháp
- Quy tắc: hiển thị nhãn DRAFT, có bước duyệt theo quyền; màn hình dùng được khi AI trả 503/504.
- Nguồn: thiết kế (BE ADR-0008).

## FP-NO-PARSE-DESC — Không phân nhánh theo text lỗi
- Quy tắc: phân nhánh theo HTTP status; `desc` chỉ để hiển thị. Cần phân biệt hơn ⇒ đề xuất BE thêm mã.
- Nguồn: thiết kế (envelope `{code, desc, data}` của BE).

## Format thêm mới

```markdown
## FP-<SLUG> — <tên>
- Bối cảnh / Quy tắc / Ví dụ sai
- Nguồn: FE-BUG-xxx | thiết kế
```
