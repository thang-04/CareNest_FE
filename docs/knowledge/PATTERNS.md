# Patterns & Lessons — CareNest_FE

Bài học tổng quát, mỗi pattern có nguồn. Pattern lấy từ thiết kế chỉ là 1 dòng trỏ tới nguồn; chi tiết đọc ở nguồn. Pattern rút ra từ incident thật thì ghi đủ: bối cảnh / quy tắc / ví dụ sai / nguồn. Pattern phía BE: `BE:docs/knowledge/PATTERNS.md`.

| ID | Quy tắc (1 dòng) | Nguồn |
| --- | --- | --- |
| FP-NO-CLIENT-RECOMPUTE | Số suất, định lượng, trend, tổng hợp báo cáo, trạng thái duyệt hiển thị đúng giá trị BE trả; client chỉ format (sai: đếm trẻ "có mặt" rồi hiển thị như số suất) | BE ADR-0005, PAT-STALE-DERIVED |
| FP-UI-HIDE-IS-NOT-AUTHZ | Ẩn nút/menu theo permission BE chỉ là UX; màn hình vẫn xử lý 403/404; không lọc dữ liệu theo scope ở client | BE `CROSS_REPO_MAP.md`, ADR-0003 |
| FP-REFETCH-AFTER-MUTATION | Sau lưu/xác nhận/duyệt ⇒ invalidate và lấy lại từ BE, không tự sửa cache số liệu dẫn xuất | `.claude/rules/state.md` |
| FP-AI-DRAFT-UI | Nội dung AI hiển thị nhãn DRAFT, có bước duyệt theo quyền; màn hình dùng được khi AI trả 503/504 | BE ADR-0008, PAT-AI-DRAFT |
| FP-NO-PARSE-DESC | Phân nhánh theo HTTP status; `desc` chỉ để hiển thị; cần phân biệt hơn ⇒ đề xuất BE thêm mã | `BE:docs/contracts/ERROR_CONTRACT.md`, FE-KI-002 |

## Format pattern từ incident

```markdown
## FP-<SLUG> — <tên>
- Bối cảnh / Quy tắc / Ví dụ sai
- Nguồn: FE-BUG-YYMMDD-slug | FE-CASE-...
```
