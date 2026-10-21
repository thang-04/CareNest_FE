---
title: Danh sách trẻ — thao tác Xem/Sửa/Cho nghỉ học và panel xem nhanh gọn hơn
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: dev
modules: [child]
rules: []
risk: high           # đổi quyền theo role (Hiệu trưởng được sửa), API mới cho nghỉ học (PROPOSED)
created: 2026-10-14
updated: 2026-10-14
---
# Danh sách trẻ — thao tác Xem/Sửa/Cho nghỉ học và panel xem nhanh gọn hơn

## Context
- Cột thao tác hiện có Xem (đi trang hồ sơ) + Sổ sức khỏe (`src/pages/children/ChildrenListPage.jsx:297-310`); bấm dòng lại mở panel xem nhanh (`:258`) ⇒ hai kiểu "xem" khác nhau.
- Dòng `tr.row-click` chỉ có `onClick`, không `tabIndex`/Enter (`ChildrenListPage.jsx:258`) — lệch DESIGN.md mục 2.2 luật 18.
- Panel `src/components/children/ChildQuickPanel.jsx` chép gần đủ trang hồ sơ (cả lịch sử xếp lớp), không có thao tác; dị ứng rỗng hiện "Không có" (`:81-90`).
- Chưa có cách cho trẻ nghỉ học: trạng thái `LEFT` chỉ có trong seed; không có API.
- Quyền sửa chỉ Phó hiệu trưởng (`src/utils/children/childrenPermissions.js:40-44`, route `src/routes/AppRoutes.jsx:305`); `canPlaceChild/canDeclareHealth/canActivateParent` đang là alias của `canEditChild`.

## Quyết định đã chốt
1. "Xóa" = **Cho nghỉ học**: không xóa dữ liệu; chuyển `LEFT`, bắt buộc ngày nghỉ + lý do, giữ lịch sử, hộp xác nhận nguy hiểm — user, 2026-10-14.
2. Sửa và Cho nghỉ học: **Phó hiệu trưởng (điểm trường của trẻ) và Hiệu trưởng (toàn trường)**; giáo viên chỉ Xem — user, 2026-10-14.
3. Nút Xem mở **panel xem nhanh** (như bấm dòng) — user, 2026-10-14.
4. Sổ sức khỏe chuyển vào panel xem nhanh (và trang hồ sơ) — user, 2026-10-14.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Actor: Phó hiệu trưởng (campus), Hiệu trưởng (toàn trường). Outcome: hồ sơ trẻ thôi học không còn trong lớp/điểm danh, dữ liệu cũ giữ nguyên. Rule BE: chưa có rule cho nghỉ học/sửa của Hiệu trưởng ⇒ quyết định user, đề xuất BE.
- **Đối chiếu:** permission matrix SRS cho sửa hồ sơ là Phó hiệu trưởng (`childrenPermissions.js:4-8`); QĐ 2 mở rộng cho Hiệu trưởng ⇒ cần cập nhật SRS/BE.
- **Ảnh hưởng:** FE `/children` (bảng + panel), `/children/:id/edit` (thêm Principal). Các quyền xếp lớp, khai báo sức khỏe, kích hoạt tài khoản **giữ Phó hiệu trưởng**. Trẻ `LEFT`: lớp không đếm sĩ số (mock `activeCount` chỉ đếm ACTIVE), tài khoản phụ huynh giữ nguyên liên kết.

### Câu hỏi mở
- [x] Xóa nghĩa là gì ⇒ Cho nghỉ học.
- [x] Ai sửa/xóa ⇒ Phó hiệu trưởng + Hiệu trưởng.
- [x] Xem mở gì ⇒ panel.
- [x] Sổ sức khỏe ⇒ trong panel.

Ngoài phạm vi (ghi lại, chưa làm): cho học lại trẻ đã nghỉ; phụ huynh còn xem trẻ đã nghỉ trên app không; nút Cho nghỉ học trên trang hồ sơ.

## Acceptance criteria
- **AC-1:** Cột Thao tác: Xem (mọi vai trò) · Sửa · Cho nghỉ học (chỉ khi `canEditChild`); trẻ đã nghỉ chỉ có Xem. Icon có `aria-label`/`title`.
- **AC-2:** Bấm dòng, Enter/Space trên dòng, hoặc nút Xem đều mở panel; dòng nhận focus bằng Tab.
- **AC-3:** Panel: đầu (avatar, tên, mã · lớp, trạng thái) + hàng nút Sửa (theo quyền) · Sổ sức khỏe · Khai báo sức khỏe; mục Thông tin, Dị ứng (theo trạng thái khai báo: có/không/chưa cung cấp), Phụ huynh (SĐT bấm gọi được); chân panel "Mở trang hồ sơ". Bỏ lịch sử xếp lớp khỏi panel.
- **AC-4:** Cho nghỉ học: hộp xác nhận đỏ có Ngày nghỉ (mặc định hôm nay) + Lý do bắt buộc; thiếu lý do báo lỗi dưới trường, không đóng hộp; xong toast + danh sách cập nhật, trẻ sang "Đã nghỉ".
- **AC-5:** Hiệu trưởng mở được `/children/:id/edit` và lưu; giáo viên vẫn bị chặn (route + mock 403).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Tách quyền | `canEditChild`/`canWithdrawChild` = VP campus hoặc Principal; `canPlaceChild/canDeclareHealth/canActivateParent` = VP campus | Giữ alias chung | QĐ 2 chỉ mở Sửa/Nghỉ học cho Hiệu trưởng |
| Form nghỉ học | `ConfirmationModal danger` có children (ngày + lý do) | Trang riêng | Ít bước, đúng DESIGN 6.4 (hộp xác nhận nguy hiểm) |
| API | `POST /children/{id}/withdraw { leftAt, reason }` (PROPOSED) | `DELETE /children/{id}` | Không xóa dữ liệu (QĐ 1) |

## Phases
### Phase 1 — Quyền + API nghỉ học
- Files: M `src/utils/children/childrenPermissions.js` · M `src/routes/AppRoutes.jsx` (edit thêm Principal) · M `src/services/children/mock/childrenMockRepository.js` (`withdrawChild`) · M `src/services/children/childrenService.js` · M `src/services/children/api/childrenApi.js`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 2 — Danh sách + panel
- Files: M `src/pages/children/ChildrenListPage.jsx` · M `src/components/children/ChildQuickPanel.jsx` · C `src/components/children/WithdrawChildModal.jsx` · M `src/styles/modules/children.css`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full` + DESIGN 13.1 không thêm dòng mới
- **Dừng chờ user review.**

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-5 | QĐ 2 | Kiểm tay mock (Principal/VP/Teacher) + verify | 1 | |
| AC-1..4 | QĐ 1,3,4 | Kiểm tay mock + verify | 2 | |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Lệch permission matrix SRS | Tài liệu nộp khác code | Ghi đề xuất BE/SRS khi xong | Revert phase |
| BE chưa có API nghỉ học | Tắt mock sẽ 404 | Ghi PROPOSED trong `childrenApi.js` | Revert phase |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer: `ChildrenListPage` (withdraw), `EditChildPage` (Principal)
- [x] Mỗi AC có cách kiểm; mỗi phase có Exit
- [x] >8 file ⇒ tách 2 phase
- [x] Không dùng rule PENDING như đã chốt
- [x] Tự review: không placeholder

## Đề xuất cho BE (chưa sửa repo BE)
Nguồn: user, 2026-10-14.

| File BE | Rule/mục | Đề xuất |
| --- | --- | --- |
| `BE:docs/modules/child.md` | Vòng đời trẻ | Thêm "Cho nghỉ học": trạng thái LEFT, `leftAt` + `reason` bắt buộc, không xóa dữ liệu; trẻ LEFT không vào sĩ số/điểm danh/suất ăn từ ngày nghỉ |
| Contract child (PROPOSED) | API | `POST /children/{id}/withdraw { leftAt, reason }` — 422 khi ngày tương lai/trước ngày tiếp nhận/thiếu lý do; 403 ngoài quyền |
| `BE:docs/business/USER_ROLES.md` | Quyền | Sửa hồ sơ trẻ + cho nghỉ học: Phó hiệu trưởng (campus) và Hiệu trưởng (toàn trường); xếp lớp/khai báo/kích hoạt tài khoản giữ Phó hiệu trưởng |
| `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` | Còn mở | Phụ huynh còn xem trẻ đã nghỉ trên app không; cho học lại trẻ đã nghỉ; lệch permission matrix SRS (Hiệu trưởng sửa hồ sơ) |

## Progress log
### 2026-10-14 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Khác plan: không. Route `:id/edit` = Principal + Vice Principal.
### 2026-10-14 — Phase 2 (done)
- Commit: chưa commit
- Verify: node scripts/verify.mjs → VERIFY PASS full (chạy sau lần sửa code cuối)
- Khác plan: Hiệu trưởng cũng thấy nút "Sửa" trên trang hồ sơ (`ChildProfilePage` dùng chung `canEditChild`). Dị ứng "Chưa cung cấp" trong panel hiện chip cam. Chưa kiểm tay AC-1..5 trên trình duyệt.
- Tiếp: user review; sau đó ghi đề xuất BE (API withdraw, quyền Hiệu trưởng sửa hồ sơ).
- Đóng: user chốt 2026-10-14; chưa commit; BE chưa cập nhật theo đề xuất.
