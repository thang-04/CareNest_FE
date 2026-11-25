---
title: Sửa 3 mục tab Test (25/11) — phần FE
status: done  # 2026-11-25, VERIFY PASS full 1830/1830
owner: ATPX48-69
jira: G94-180 / FE-FIX-14
branch: fix/G94-180-FE-FIX-14-school-year-scope
modules: [children]
rules: [BE:G94-180/CHD-03, BE:G94-180/CHD-04, BE:HLT-08]
risk: medium
created: 2026-11-25
updated: 2026-11-25
---
# Sửa 3 mục tab Test (25/11) — phần FE

> **Cho agent thực thi:** làm theo `superpowers:subagent-driven-development`, từng task một. Plan BE (nguồn luật và contract): `BE:docs/plans/active/2026-11-25-test-log-round-2.md` (`BE:` = `../be-school-year-scope/`).

**Mục tiêu:** làm phần FE của 3 mục user ghi ở tab "Test" ngày 25/11/2026:
1. Ô nhiệt độ của phiếu khám.
2. "Ngày bắt đầu đi học" (FE không sửa gì; BE trả ngày).
3. Cho nghỉ học chọn ngày bất kỳ trong năm học, trẻ vẫn Đang học tới ngày nghỉ, có Hủy lịch nghỉ.

## Global Constraints

- **Chạy test bằng PowerShell, không dùng Git Bash.** Git Bash dùng ổ `d:` chữ thường nên nạp React 2 lần và báo lỗi `useState` giả.
  - Lệnh: `node --import ./scripts/register-auth-test-loader.mjs --test <file>`.
  - Kiểm chứng: `node scripts/verify.mjs --quick` sau mỗi task, full ở cuối.
- **Không sửa file dùng chung** (`src/components/ui/**`, `src/components/form/**`, `src/utils/*.js`…), trừ hai ngoại lệ:
  - Được **xóa** `src/components/form/Radio.jsx`, là file tôi thêm hôm 24/11 và chưa được duyệt.
  - Mọi thay đổi khác ở file dùng chung phải dừng lại và hỏi.
- **Component:** dùng `DateInput` có sẵn (đã có `min`/`max`) và `ConfirmationModal` (đã có `confirmDisabled`).
- **Không tự tính nghiệp vụ** (AGENTS.md bất biến 2):
  - Ngày nhỏ nhất/lớn nhất, việc có được chọn hôm nay hay không: lấy từ BE `GET /children/{id}/leave-options`.
  - FE chỉ nhắc nhập liệu (đúng dạng, trong khoảng BE trả).
  - Mock (`src/services/children/mock/`) là BE giả: được chứa luật, ghi rule ID.
- **Commit:** nhỏ, dòng đầu `G94-180: <động từ tiếng Anh ...>`, ≤72 ký tự, chỉ ASCII. Không push.

## Contract BE (Task 3–4 của plan BE)

- `GET /children/{id}/leave-options` ⇒ `{ today, todayAllowed, todayBlockedReason, minDate, maxDate }`. Bỏ trường `nextSchoolDay`.
- `POST /children/{id}/withdraw` `{ leftAt, reason }`:
  - `leftAt` = hôm nay ⇒ nghỉ ngay.
  - `leftAt` sau hôm nay ⇒ đặt lịch: trẻ vẫn `ACTIVE`, có `scheduledLeaveOn`, `scheduledLeaveReason`.
  - Lỗi trả theo ô `leftAt`.
- `DELETE /children/{id}/scheduled-leave` ⇒ trả hồ sơ trẻ (giống `withdraw`).
- Hồ sơ trẻ thêm `scheduledLeaveOn`, `scheduledLeaveReason`. Dòng danh sách trẻ thêm `scheduledLeaveOn`.
- Lịch sử hồ sơ có thêm 2 action:
  - `LEAVE_SCHEDULED` ⇒ nhãn "Hẹn nghỉ học";
  - `LEAVE_CANCELLED` ⇒ nhãn "Hủy lịch nghỉ học".
- Phiếu khám: lỗi ô `exam.vitals.temperatureC`, câu lỗi `Nhập nhiệt độ gồm 2 chữ số, tối đa 2 chữ số sau dấu phẩy (vd 36,5)`.

---

### Task 1: Ô nhiệt độ phiếu khám (mục 1)

**Files:**
- Sửa: `src/components/children/exam/ExamMeasureStep.jsx` (dòng nhiệt độ).
- Tạo hoặc sửa: hàm kiểm tra trong `src/utils/children/` (ví dụ `healthExamHints.js`).
- Test: `tests/children/` (thêm file test mới hoặc mở rộng file có sẵn).

**Hành vi:**
- Ô nhiệt độ nhận cả `,` và `.`.
- Không khớp dạng `^\d{2}([.,]\d{1,2})?$` thì hiện lỗi ngay dưới ô, đúng câu BE ở trên.
- Gửi lên BE dạng số (đổi `,` thành `.`).
- Lỗi BE ở ô `exam.vitals.temperatureC` hiện đúng ô này.
- Phân loại "Bình thường / Sốt / Hạ thân nhiệt" chỉ chạy khi giá trị hợp lệ.

- [x] Test (fail trước):
  - Hàm kiểm tra: `3115345` sai; `9,5` sai; `36,555` sai; `36` đúng; `36,5` đúng; `36.55` đúng.
  - Ô hiện lỗi khi nhập `3115345`.
- [x] Sửa, chạy test (PowerShell), verify quick, commit.

### Task 2: Hộp "Cho nghỉ học" chọn ngày (mục 3)

**Files:**
- Sửa: `src/components/children/WithdrawChildModal.jsx`. Thay 2 lựa chọn radio bằng `DateInput`, với `min` = `minDate`, `max` = `maxDate` lấy từ `leave-options`.
- Chữ gợi ý dưới ô:
  - Trường hợp thường: `Chọn từ dd/mm/yyyy tới dd/mm/yyyy (hết năm học)`.
  - Khi `todayAllowed=false`, thêm `todayBlockedReason` và nói rõ chỉ chọn được từ ngày mai.
- Ngày sau hôm nay: thêm dòng giải thích `Trẻ vẫn học tới hết ngày dd/mm/yyyy, hệ thống tự chuyển sang Đã nghỉ học từ ngày đã chọn.`
- Nút xác nhận khóa (`confirmDisabled`) trong các trường hợp:
  - đang tải `leave-options`;
  - tải lỗi;
  - chưa có ngày hợp lệ.
- Lỗi BE ở ô `leftAt` hiện dưới ô ngày.
- Sửa mock `src/services/children/mock/childrenMockRepository.js` (`getLeaveOptions`, `withdrawChild`) theo luật mới của BE:
  - ngày bất kỳ từ hôm nay tới hết năm học;
  - hôm nay bị chặn khi có dữ liệu;
  - ngày sau hôm nay thì đặt lịch.
- Xóa `src/components/children/ChoiceGroup.jsx` và `src/components/form/Radio.jsx` nếu không còn nơi nào dùng. Đi kèm, gỡ export ở `src/components/index.js`, mẫu ở `/ui-kit` (`src/pages/UiKitPage.jsx`), dòng ở `DESIGN.md` mục 6.3 và `docs/design/UI_CARD.md`.
- Sửa test cũ của hộp nghỉ học (đang kiểm "Hôm nay / Ngày học kế tiếp").

- [x] Test (fail trước):
  - Hộp dùng `minDate`/`maxDate`.
  - `todayAllowed=false` ⇒ gợi ý chỉ chọn từ ngày mai.
  - Mock: nghỉ từ thứ Bảy hoặc từ ngày cách 3 tuần ⇒ trẻ vẫn `ACTIVE` và có `scheduledLeaveOn`.
  - Mock: ngày sau năm học ⇒ lỗi ô `leftAt`.
- [x] Sửa, test, verify quick, commit.

### Task 3: Hiện lịch nghỉ và Hủy lịch nghỉ (mục 3)

**Files:**
- `src/pages/children/ChildrenListPage.jsx`:
  - Có `scheduledLeaveOn` thì dưới nhãn trạng thái thêm chữ nhỏ `Nghỉ từ dd/mm/yyyy`.
  - Trong thao tác của dòng, thay "Cho nghỉ học" bằng "Hủy lịch nghỉ". Ai thấy nút thì theo đúng quyền như "Cho nghỉ học".
- `src/pages/children/ChildProfilePage.jsx`:
  - Có lịch nghỉ thì hiện thông báo `Lịch nghỉ học: từ dd/mm/yyyy · Lý do: …` kèm nút "Hủy lịch nghỉ" (cùng quyền).
  - Ẩn "Cho nghỉ học" khi đã có lịch.
- Hộp xác nhận hủy dùng `ConfirmationModal`: tiêu đề `Hủy lịch nghỉ học của <tên>?`, nội dung `Trẻ tiếp tục học như chưa cho nghỉ. Quyết định Nghỉ học trên bảng xếp lớp năm mới cũng bị bỏ.`
  - Thành công ⇒ `toast` + tải lại trang (`reload({ silent: true })`).
  - Lỗi ⇒ `toast.error(err, 'Không hủy được lịch nghỉ')`.
- **API, facade, mock:**
  - `childrenApi.cancelScheduledLeave(childId)` gọi `DELETE /children/{id}/scheduled-leave`.
  - Facade `cancelScheduledLeave` trong `childrenService.js`.
  - Mock hủy lịch.
  - Mock áp lịch khi tới ngày: khi đọc dữ liệu, `scheduledLeaveOn ≤ hôm nay` ⇒ chuyển `LEFT`.
- **Nhãn lịch sử:** thêm `LEAVE_SCHEDULED: 'Hẹn nghỉ học'`, `LEAVE_CANCELLED: 'Hủy lịch nghỉ học'` vào `src/models/children/childrenConstants.js`.
- **Tài liệu:** đoạn nghỉ học trong `docs/features/` của module trẻ; thêm incident vào `docs/knowledge/ISSUE_INDEX.md` nếu có lỗi không hiển nhiên.
- **Đồng bộ contract** sau khi BE xong Task 3–4, chạy:
  - `node scripts/check-api-contract.mjs --sync ../be-school-year-scope/docs/api/openapi.yaml`
  - `node scripts/ai-layer/api-index.mjs --from ../be-school-year-scope`
  - `node scripts/check-api-contract.mjs --consumers`

- [x] Test (fail trước):
  - Danh sách hiện `Nghỉ từ …` và thao tác "Hủy lịch nghỉ".
  - Hồ sơ hiện thông báo và nút.
  - Hủy gọi đúng facade.
  - Mock hủy làm mất lịch.
- [x] Sửa, test, verify quick, commit.

## Progress log

- 2026-11-25: plan viết sau khi user trả lời 4 câu hỏi.
- 2026-11-25: done. Task 1 51516be3, 753c775a · Task 2 836c16e1, 905dc860 · Task 3 40132074, bc0fd4f5, bb6c4373 · contract sync 43677e73 · final review fix wave efa1aaef..92484a44 (11 findings). `node scripts/verify.mjs` VERIFY PASS full, 1830/1830.
