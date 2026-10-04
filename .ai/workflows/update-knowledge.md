# Workflow — Cập nhật tri thức (nghiệp vụ mới, PENDING được chốt, bug mới)

Chạy **ngay trong lượt** khi gặp trigger, không đợi cuối task. Đây là nguồn duy nhất cho "khi nào / ghi gì / ghi ở đâu" ở FE; các workflow khác chỉ trỏ về đây. `BE:<path>` = `../CareNest_BE/<path>`.

| Trigger | Ví dụ |
| --- | --- |
| T1. Thông tin nghiệp vụ mới / chốt PENDING / đổi quyết định | "BGH được xem báo cáo cả 2 campus", "chọn Next.js" |
| T2. Bug mới chưa có trong `ISSUE_INDEX` FE lẫn BE (kể cả chưa fix xong) | Lỗi render, sai route theo role, lệch contract API |
| T3. Edge case UI/nghiệp vụ đáng nhớ | Danh sách lớp trống khi giáo viên chuyển lớp giữa năm |

## T1 — Nghiệp vụ mới / PENDING được chốt

1. **Nguồn:** ghi người nói, ngày, mức độ (CONFIRMED / PROPOSED). Không tự nâng mức. Mơ hồ ⇒ hỏi lại 1 câu.
2. **Nghiệp vụ, quyền, contract thuộc BE** ⇒ FE **không** ghi rule. Soạn đề xuất cho BE (file + rule ID + nội dung) theo `BE:.ai/workflows/update-knowledge.md` T1 và đưa cho user; chỉ sửa repo BE khi user cho phép.
3. **Grep mọi chỗ tham chiếu ở FE**, sửa từng hit (PENDING đã đóng, permission bỏ đi, actor đổi):
   `grep -rn "P-05\b" docs .ai .claude .agents AGENTS.md CLAUDE.md`
4. Quyết định riêng Web (framework, route, state, UX) ⇒ `docs/architecture/*`, `docs/features/`; file SKELETON có nội dung thật ⇒ bỏ header skeleton và cập nhật `.ai/CONTEXT_MAP.yaml`. Trạng thái dự án/PENDING đổi ⇒ `docs/context/CURRENT_STATE.md`.
5. Mâu thuẫn với nguồn CONFIRMED ⇒ **không ghi đè**; nêu mâu thuẫn, hỏi user.

## T2 — Bug mới

**Ghi khi** ít nhất một điều đúng: không hiển nhiên · phải thử >1 cách · có thể lặp ở màn hình khác · lỗi môi trường/build tốn >15 phút. Không ghi lỗi gõ nhầm.

1. Grep `docs/knowledge/ISSUE_INDEX.md` + `BE:docs/knowledge/ISSUE_INDEX.md` (chuỗi lỗi, màn hình, từ khóa). Đã có ⇒ mở incident, bổ sung Attempts.
2. Chưa có ⇒ tạo ngay `docs/knowledge/incidents/<ID>.md` từ `_TEMPLATE.md` với `status: open` + 1 dòng `ISSUE_INDEX.md` (root cause `?`). ID: `FE-BUG|FE-CASE|FE-ENV-YYMMDD-slug`.
3. Trong lúc điều tra: mỗi cách thử + kết quả ghi vào **Attempts** của incident, không chỉ trong câu trả lời, để phiên sau không mất.
4. Chứng minh root cause + fix ⇒ điền Root cause / Fix / Regression test, đổi status ở cả incident và index.
5. Bẫy đặc thù feature ⇒ 1 dòng Known pitfalls trong `docs/features/<feature>.md` (nếu có). Lỗi môi trường ⇒ mục `TROUBLESHOOTING.md`. Bài học tổng quát ⇒ `PATTERNS.md`.
6. Root cause ở contract/nghiệp vụ BE ⇒ soạn mục cho `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` và đưa cho user (không tự sửa BE). Không phải lỗi code mà do hiểu sai nghiệp vụ ⇒ xử lý như T1/T3.

## T3 — Edge case

Incident `FE-CASE-YYMMDD-slug` (`type: edge-case`) + 1 dòng ISSUE_INDEX + Known pitfalls của feature (nếu có). Cần rule nghiệp vụ mới ⇒ T1 bước 2 (PROPOSED cho tới khi được xác nhận).

## Quy tắc

- 1 dòng ở index, chi tiết ở file chi tiết. Link thay vì chép.
- `KNOWN_ISSUES.md` chỉ cho giới hạn cố ý/chưa làm, không cho bug.
- Không ghi dữ liệu trẻ thật, secret, log dài. Không tạo incident cho chuyện chưa xảy ra.
- Báo user danh sách file tri thức đã cập nhật. Không commit khi user chưa yêu cầu.
