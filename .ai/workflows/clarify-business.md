# Workflow — Làm rõ nghiệp vụ (cổng trước khi code, FE)

Bước 1 của `implement-feature`, `plan-change`, và `fix-bug` khi chưa rõ "hành vi đúng". Áp mọi làn khi task **đổi hành vi nghiệp vụ hoặc thứ người dùng thấy/được làm**. Chưa qua cổng ⇒ không code.

Làn S: 1 dòng `Rule: <ID> (<status>)`. Chưa CONFIRMED/ACCEPTED hoặc lệch tài liệu ⇒ nâng làn M, chạy đủ dưới đây.

1. **Hiểu nghiệp vụ** — block ≤8 dòng (làn L: ghi vào plan, mục "Làm rõ nghiệp vụ"):
   ```text
   Actor/role: … · Outcome: …
   Rule: ATT-04 (CONFIRMED) · P-20 (PENDING)        ← BE là nguồn: grep "| ATT-" BE:docs/business/BUSINESS_RULES.md
   Flow: [B] … → [S] …                               ← BE module card + flow
   Ảnh hưởng: màn hình/route (`docs/architecture/ROUTE_MAP.md`) · quyền theo role · dữ liệu BE trả · BE contract · APP dùng chung
   Tài liệu vs yêu cầu: <khớp | lệch: tài liệu ghi X (file:line), yêu cầu Y>
   ```
2. **Phân loại điểm chưa rõ:** (a) **nghiệp vụ / hiển thị** — field được xem, role nào làm gì, trạng thái UI theo rule, rule PENDING/OPEN, yêu cầu lệch tài liệu ⇒ **bắt buộc hỏi user**; (b) kỹ thuật đã có convention (`.claude/rules`, source) ⇒ tự làm; (c) kỹ thuật chưa có convention, ảnh hưởng lớn (thư viện nền, lưu token) ⇒ đề xuất rồi hỏi.
3. **Hỏi theo vòng** — mỗi vòng gộp ≤5 câu độc lập; câu phụ thuộc thì hỏi lần lượt. Mỗi câu: phương án (trắc nghiệm) · đề xuất + lý do · hệ quả · nguồn. **Lặp tới khi hết câu (a).** Trả lời mơ hồ ⇒ hỏi tiếp.
4. **Lệch tài liệu** ⇒ trình bày cả hai (tài liệu X `file:line` · yêu cầu Y), hỏi chọn. Không âm thầm theo bên nào.
5. **Ghi câu trả lời ngay:** phần hiển thị/client ⇒ `docs/features/` (theo `update-knowledge.md`); phần rule nghiệp vụ ⇒ đề xuất cập nhật `BE:docs/business/BUSINESS_RULES.md` (T1) — chỉ sửa repo BE khi user cho phép. Mục đích: lần sau không hỏi lại.

Có ≥2 phương án thiết kế (làn M/L) ⇒ bảng 2–3 phương án (trade-off, đề xuất trước), user chọn; làn L ghi vào "Key decisions" của plan.

## Bản tác động (trước khi sửa vùng dùng chung hoặc module của người khác)

Điểm dừng cứng của AGENTS.md › "Chế độ làm việc". Chạy `node scripts/ai-layer/impact.mjs <file>` rồi trình bày ≤12 dòng, **chờ người làm chọn** mới sửa:

```text
Thay đổi: <sửa gì, ở file nào>
Ảnh hưởng: <dán phần chính của output impact.mjs: số màn, nhóm màn, route>
Luồng người dùng: <role nào thấy/thao tác khác đi thế nào; không đổi ⇒ ghi "không đổi">
Module của: <thành viên phụ trách các phần bị ảnh hưởng>
Phương án: A <…> · B <…> · (C <…>) — đề xuất <A/B/C> vì <lý do>
Cách kiểm: <test/verify nào, màn nào cần mở lại>
```

Ưu tiên phương án không chạm phần dùng chung (thêm biến thể/prop mới, giữ hành vi cũ làm mặc định) khi nó đủ đáp ứng yêu cầu.
