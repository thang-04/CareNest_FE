# Workflow — Cập nhật tri thức (nghiệp vụ mới, PENDING được chốt, bug mới)

Chạy **ngay trong lượt** khi gặp trigger, không đợi cuối task. `BE:<path>` = `../CareNest_BE/<path>`.

## Trigger

| Trigger | Ví dụ |
| --- | --- |
| T1. User đưa thông tin nghiệp vụ mới / chốt PENDING / đổi quyết định | "BGH được xem báo cáo cả 2 campus", "chọn Next.js" |
| T2. Gặp **bug mới** (chưa có trong `ISSUE_INDEX` FE lẫn BE) — kể cả khi chưa fix xong | Lỗi render, sai route theo role, lệch contract API |
| T3. Edge case UI/nghiệp vụ đáng nhớ | Danh sách lớp trống khi giáo viên chuyển lớp giữa năm |

## T1 — Thông tin mới

1. Ghi nguồn (ai, ngày) và mức (CONFIRMED / PROPOSED); không tự nâng mức; mơ hồ ⇒ hỏi lại.
2. **Nghiệp vụ, quyền, contract thuộc BE** ⇒ FE **không** ghi rule. Soạn đề xuất cập nhật cho BE (file + rule ID + nội dung) theo `BE:.ai/workflows/update-knowledge.md` và đưa cho user; chỉ sửa repo BE khi user cho phép.
3. Quyết định riêng Web (framework, route, state, UX) ⇒ cập nhật `docs/architecture/*`, `docs/features/`, `docs/context/CURRENT_STATE.md`; file SKELETON có nội dung thật ⇒ bỏ header skeleton và cập nhật `.ai/CONTEXT_MAP.yaml`.
4. Mâu thuẫn với nguồn CONFIRMED ⇒ không ghi đè, hỏi user.

## T2 — Bug mới

1. Grep `docs/knowledge/ISSUE_INDEX.md` + `BE:docs/knowledge/ISSUE_INDEX.md`. Có ⇒ dùng incident đó, bổ sung Attempts.
2. Chưa rõ root cause ⇒ 1 dòng `docs/knowledge/KNOWN_ISSUES.md` (triệu chứng, lỗi nguyên văn, màn hình, ngày, "đang điều tra").
3. Ghi lại từng cách thử + kết quả trong lúc điều tra.
4. Đã chứng minh root cause + fix ⇒ incident theo `docs/knowledge/incidents/_TEMPLATE.md` (kèm Attempts thất bại), 1 dòng `ISSUE_INDEX.md`, xóa dòng ở `KNOWN_ISSUES.md`, `PATTERNS.md` nếu tổng quát được.
5. Root cause ở contract/nghiệp vụ BE ⇒ soạn mục cho `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` và đưa cho user.

## T3 — Edge case

Incident `type: edge-case` + 1 dòng index; cần rule nghiệp vụ mới ⇒ T1 bước 2.

## Quy tắc

Ghi ngắn, đúng chỗ, link thay vì chép; không dữ liệu trẻ thật/secret/log dài. Báo user các file đã cập nhật; không commit khi chưa được yêu cầu.
