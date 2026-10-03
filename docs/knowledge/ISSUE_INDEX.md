# Issue Index — CareNest_FE

> Giữ file nhỏ để grep rẻ: **1 issue = 1 dòng**, root cause 1 câu; chi tiết, stack, các cách đã thử nằm trong file incident. Không dán log vào đây.

**File đầu tiên agent search khi gặp bug UI/client, lỗi build/dev, hoặc case hiển thị lạ.** Mỗi issue 1 dòng. Grep theo: chuỗi lỗi nguyên văn (console, network `desc`, build output), tên màn hình/component, từ khóa nghiệp vụ (VN/EN).

Phạm vi: lỗi **UI/client** (render, state, routing, form, API client, build). Lỗi **contract/nghiệp vụ** (BE trả sai, thiếu field, rule sai) ⇒ ghi ở BE `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md` (đề xuất cho người có quyền ở BE); luôn grep thêm `../CareNest_BE/docs/knowledge/ISSUE_INDEX.md`.

## Cách dùng

1. Grep chuỗi lỗi chính (vd. `Cannot read properties of undefined`, `status 403`, `Hydration failed`) và từ khóa (vd. `điểm danh`, `meal count`, `dashboard`).
2. Có match ⇒ đọc incident: xem **Attempts** (cách đã thử thất bại — đừng lặp lại) và **Fix**.
3. Incident cũ chỉ là **manh mối**: kiểm chứng với code hiện tại trước khi kết luận cùng root cause.
4. Không match ⇒ điều tra bình thường (`.ai/workflows/fix-bug.md`).

## Khi nào phải ghi

Ghi khi ít nhất một điều đúng: lỗi không hiển nhiên · phải thử >1 cách · có thể lặp lại ở màn hình khác · lỗi môi trường/build tốn >15 phút. Không ghi lỗi gõ nhầm/hiển nhiên. **Không tạo incident giả hoặc chưa xác nhận root cause** (ghi vào `KNOWN_ISSUES.md` thay vì vậy).

Ghi gồm: (1) file `incidents/<ID>-<slug>.md` từ `incidents/_TEMPLATE.md`, (2) 1 dòng bảng dưới, (3) 1 dòng "Known pitfalls" trong `docs/features/<feature>.md` nếu có, (4) `PATTERNS.md` nếu tổng quát hóa được.

ID: `FE-BUG-xxx` (bug code) · `FE-CASE-xxx` (edge case hiển thị/nghiệp vụ phía UI) · `FE-ENV-xxx` (môi trường/build/deploy). Prefix `FE-` để không trùng ID với BE. Số tăng dần, không tái sử dụng.

## Index

| ID | Màn hình / vùng | Triệu chứng (từ khóa + chuỗi lỗi) | Root cause (1 câu) | Status | File |
| --- | --- | --- | --- | --- | --- |
| — | — | Chưa có issue | — | — | — |
