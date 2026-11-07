---
title: Sửa P1 review E2E phía Web (FLOW-007…018)
status: in-progress
owner: thangnd
jira: G94-272
branch: dev
modules: [attendance, meal-count, identity-access, school-config, education-plan, dashboard]
rules: [ATT-02, ATT-09, NUT-02, NUT-03, NUT-04, AUTH-18, EDU-10]
risk: high
created: 2026-11-01
updated: 2026-11-01
---

# Sửa P1 review E2E phía Web (FLOW-007…018)

## Context

Nguồn: `../plans/reports/final-261101-1407-carenest-e2e-business-flow-review-report.md` (FLOW-007…018, bảng "Đã chốt" D1–D14, user chốt 2026-11-01) và `../plans/reports/uiux-loading-feedback-261101-1407-carenest-review-report.md` (LD-001/002, phác thảo `useAsync`). BE đổi song song, tương thích ngược; FE code theo contract đã thống nhất:

- Lưu điểm danh: BE bỏ qua `meals`, suất suy từ `status` (ATT-02) ⇒ FE bỏ công tắc "Tham gia ăn", không gửi `meals`.
- `POST /meal-counts/adjustments`: FE gửi `normal: null`, chỉ sửa `substitute` (NUT-02, D2).
- Xác nhận sổ: BE trả 4xx khi lớp trong cơ sở–ngày còn trẻ chưa điểm danh (`missing` > 0 trong `GET /meal-counts`) ⇒ UI nêu lớp thiếu, khóa nút xác nhận (D10).
- GV không chọn được `EXCUSED` (ATT-09, D6); bản ghi EXCUSED cũ vẫn hiển thị.

Chế độ tự chạy (CLAUDE.md): không chờ duyệt plan; quyết định ghi dưới.

## Thiết kế `useAsync` (hook dùng chung — FLOW-017)

- Khóa phạm vi = mảng `deps` (so `Object.is` từng phần tử như React, qua token `useMemo(() => ({}), deps)`), không `JSON.stringify` (deps có thể chứa object/hàm).
- Lưu `dataScope`/`errorScope` = phạm vi của lần tải đã xong. Trả `data` chỉ khi `dataScope === scope` hiện tại, ngược lại `null`; dữ liệu phạm vi cũ ra `stale`.
- `loading` = đang tải **hoặc** phạm vi mới chưa có kết quả (bật `enabled`) ⇒ ngay render đầu sau khi đổi deps đã `loading: true, data: null` (code cũ kiểu `if (loading) …; data.map` không vỡ).
- Thêm `initialLoading` (chưa có gì để hiện: không `data`, không `stale`) và `refreshing` (đang tải mà còn `data` cùng phạm vi hoặc `stale`). `error` cũng theo phạm vi.
- `setData` gắn vào phạm vi hiện tại. Tương thích ngược: giữ `{ data, setData, loading, error, reload }`, cùng phạm vi thì hành vi không đổi (tải lại im lặng giữ dữ liệu).
- Logic suy ra tách thành hàm thuần `deriveAsyncState` (`src/hooks/asyncState.js`) để test bằng `node:test` (repo không có renderer React cho test).
- Áp dụng: TeacherAssignment, AgeGroupsClasses, YearPlacement (đều `loading && !data ⇒ LoadingState`) và `EducationPlanProvider` (đổi năm ⇒ khung chờ thay vì dữ liệu năm cũ) — tự đúng khi hook đổi; kiểm lại từng màn không giữ state suy từ phạm vi cũ.

## Quyết định (tự chọn phương án khuyến nghị)

1. Điểm danh: bỏ cột "Tham gia ăn"; ghi chú "Có mặt là ăn đủ các bữa của nhóm tuổi (ATT-02)". Bản nháp chỉ còn `status`. Vắng ⇒ `EXCUSED` chỉ khi có báo nghỉ (mock), còn lại `UNEXCUSED`.
2. Sổ báo ăn: modal sửa chỉ còn "Suất thay thế" + lý do; gửi `normal: null`. Nút xác nhận (bữa + tất cả) disabled khi `missing` > 0 ở lớp bất kỳ của cơ sở–ngày; cảnh báo nêu tên lớp (số BE trả).
3. Mock (BE giả): lưu điểm danh suy `meals` từ `status` (ATT-02); từ chối EXCUSED khi không có báo nghỉ (ATT-09); điều chỉnh bỏ `normal`, giữ `substitute` khi điểm danh đổi (NUT-02); chặn xác nhận khi còn lớp thiếu điểm danh (NUT-02, D10).
4. Menu/route theo quyền BE: `hasBePermission(user, ...codes)` — chỉ lọc khi có `user.bePermissions` (gateway); chế độ mock không có dữ liệu quyền BE ⇒ giữ menu theo vai trò. `/children/activation` mở cho HT + PHT có `PARENT_ACCOUNT_MANAGE`; HT có mục menu.
5. Câu chữ hứa thông báo ở module `api` (cutoff, phân công GV/tổ trưởng, mở lại điểm danh) ⇒ "Đã lưu. Hãy báo trực tiếp cho …". Module demo (mock có phát thông báo) giữ nguyên.
6. Rời màn: `useLeaveGuard` + `LeaveConfirmModal`. Ma trận quyền và ngoại lệ cần lý do ⇒ hộp không có nút Lưu (`canSave={false}`), Hủy giữ nháp. Điểm danh: Lưu chỉ khi không có nháp sức khỏe.

## Phases

- [x] P1 `useAsync` + `asyncState.js` + test.
- [x] P2 Điểm danh / sổ báo ăn / mock (FLOW-007/008/009/D10).
- [x] P3 Quyền menu/route (FLOW-013), câu chữ (FLOW-014) + chỉ báo "cần xác nhận lại" trên dashboard PHT.
- [x] P4 Xóa KH năm (FLOW-015), dashboard GV (FLOW-016).
- [x] P5 Rời màn (FLOW-018).
- [x] P6 Docs (ROUTE_MAP, DESIGN §9, STATE_MANAGEMENT, incident) + `node scripts/verify.mjs`.
- [ ] P7 Kiểm tay trên trình duyệt với BE thật (chưa chạy: không khởi động dev server trong phiên này).

## Progress log

### 2026-11-01

- Bắt đầu; đọc report FLOW-007…018, D1–D14, LD report mục (e).
- Xong P1–P6. Test mới: `tests/hardening/use-async-scope.test.mjs` (9), `tests/integration/selective-merge/attendance-meal-rules.test.mjs` (4), `tests/menu/menu-be-permissions.test.mjs` (4). Test bếp/mở lại điểm danh cũ chốt sổ trên ngày còn trẻ chưa điểm danh ⇒ thêm helper `tests/kitchen/complete-attendance.mjs` ghi đủ điểm danh trước khi chốt (đúng NUT-02/D10), kèm assert bị chặn 409 trước đó.
- Mock: kiểm "còn trẻ chưa điểm danh" tính lại từ điểm danh hiện tại (không từ ảnh chụp lúc tổng hợp); suất từ trạng thái cho cả sổ và tổng hợp (ATT-02); điều chỉnh suất thay thế lưu `substituteOverrides` để điểm danh mở lại không ghi đè.
- Giả định: demo hôm nay lớp Chồi 1 (cố ý để GV tự điểm danh) chặn PHT cơ sở 1 xác nhận tới khi điểm danh đủ — đúng D10. Câu chữ hứa thông báo chỉ sửa ở module `api`; module demo (phân công PHT, tài khoản nhân sự, bàn giao suất) giữ vì mock có phát thông báo.
- Bẫy môi trường: script Python ghi file trên Windows tự đổi sang CRLF (Prettier `endOfLine: lf`) ⇒ đã đổi lại LF.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`.
