---
title: Điểm danh và ghi nhận sức khỏe demo
status: in-progress
owner: FE
branch: dev
modules: [attendance, health]
rules: [GBR-ATT-02, GBR-ATT-04, GBR-ATT-08]
risk: medium
created: 2026-10-12
updated: 2026-10-12
---
# Điểm danh và ghi nhận sức khỏe demo

## Quyết định đã chốt

Người dùng yêu cầu code vào CareNest_FE và trả lời “Triển khai FE bằng dữ liệu demo trước”. Phạm vi: hai cột Web, điểm danh Có mặt/Vắng, một công tắc ăn, sức khỏe nhiều lần/ngày không phụ thuộc khóa điểm danh. Không sửa BE/APP, dependency, branch, commit hay endpoint thật. Chi tiết: `docs/features/daily-reception.md`.

## Acceptance criteria

- AC-1 (cập nhật người dùng 2026-10-12): Danh sách lớp tìm kiếm được, chọn bất kỳ trẻ, tích Có mặt mở form ngay; một nút lưu qua hai service theo thứ tự điểm danh rồi sức khỏe. Nếu sức khỏe lỗi sau khi điểm danh thành công, giữ dữ liệu và cho thử lại phần sức khỏe.
- AC-2: Chọn Vắng tắt báo ăn; giữ trạng thái vắng cũ nếu không sửa. Không mất luồng hủy suất sau khóa đang có (GBR-ATT-08).
- AC-3: Trẻ Có mặt đã lưu có thể có nhiều ghi nhận sức khỏe sau khóa, mỗi lần có thời gian và tác giả; gửi lại cùng mã không tạo trùng.
- AC-4: Ngày quá khứ, trẻ không thuộc lớp, giáo viên không được phân công không thể ghi; form lỗi giữ dữ liệu; đổi trẻ/lớp/ngày hỏi bỏ thay đổi.
- AC-5: Hai cột desktop, một cột màn hình nhỏ; không chẩn đoán; dữ liệu demo được thông báo rõ.

## API và câu hỏi mở

Không còn câu hỏi chặn demo. Contract thật chưa có trong BE attendance/health; chốt sau, không sử dụng yêu cầu bổ sung như rule BE đã phê duyệt. APP chưa trong phạm vi sửa; quyền xem phụ huynh cần thống nhất riêng.

## Phase 1 — UI và repository demo

Files: trang attendance, DailyHealthPanel, dailyHealthService, dailyHealthMockRepository, dailyHealthValidation, attendance repository, attendance CSS; feature doc và map tài liệu.

Tests: smoke test repository với storage và đồng hồ cách ly, Browser QA, `node scripts/verify.mjs`, `node scripts/check-ai-layer.mjs`.

## Rủi ro và rollback

Mock không đại diện API thật; service mới từ chối chế độ không mock. Giữ nguyên data store và trạng thái điểm danh cũ. Giữ thay đổi của người dùng đang có, không reset worktree. Rollback chỉ diff của feature này; không xóa dữ liệu demo đã lưu.

## Progress log

### 2026-10-12 — Thu gọn UI liên hệ theo review

- Form NOTED chỉ thêm một nút Liên hệ phụ huynh, mở modal nhỏ với tên/số điện thoại/Gọi. Bỏ trường trao đổi, ghi chú và preview dài khỏi form chính; lịch sử còn nhãn thông báo và retry khi cần.
- Giữ điều phối lưu và notification demo; không xóa dữ liệu contact/notification đã lưu, không thay BE/APP.

### 2026-10-12 — Liên hệ và thông báo phụ huynh demo

- Người dùng yêu cầu liên kết thông báo với sức khỏe và xác nhận chỉ FE demo trước, không sửa BE/APP.
- Phạm vi bổ sung: contact từ hồ sơ, tel, kết quả trao đổi, nội dung minh họa, lưu nối tiếp attendance/health/notification, lịch sử trạng thái và gửi lại theo entryId. Không có gửi thật hoặc endpoint App tự đặt.
- Smoke repository PASS: outbox gắn đúng health/child/guardian ACTIVE, dedup retry, push chung, từ chối 403/normal/missing contact, health vẫn được giữ khi notification lỗi.
- Cần BE/APP chốt contract và policy ADR-0010 trước khi phụ huynh xem thật. Không dùng ghi chú nội bộ làm nội dung gửi.
- Browser demo PASS contact xuất hiện khi NOTED; lưu thông báo gắn bản ghi, hiển thị trạng thái và nội dung, không gửi ghi chú nội bộ. Coordinator test PASS notification lỗi vẫn trả healthSaved.
- Verify: `VERIFY PASS full | npm run verify | log verify.log`; AI layer 0 lỗi, 17 cảnh báo có sẵn. Chưa kiểm browser missing-account/retry, App thật, network failure thật. Chưa commit; server QA cách ly dừng sau kiểm tra.

### 2026-10-12 — Bổ sung luồng lưu chung và chọn lại trẻ

- Người dùng yêu cầu nhập ngay sau tích Có mặt, một nút lưu qua hai service; đã triển khai điều phối tuần tự và xử lý thành công một phần, không giả lập transaction.
- Test điều phối PASS: thứ tự attendance → health; lỗi attendance không gọi health; health lỗi báo attendanceSaved; retry không đổi attendance chỉ gọi health.
- Browser mock PASS: trẻ chưa điểm danh tích Có mặt mở form ngay, một nút lưu tạo điểm danh và ghi nhận, sau lưu hiện Thêm lần ghi nhận và lịch sử. Chọn lại radio checked của trẻ cũ fail trước/pass sau sửa click dòng; xem incident trong Issue Index.
- Chưa kiểm browser lỗi API thật/rollback, quota/multiple tabs; tất cả đang mock. Chưa commit.

### 2026-10-12 — Phase 1 đã triển khai, chờ review giao diện

- Chưa commit; triển khai trực tiếp theo yêu cầu người dùng và lựa chọn demo.
- `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` sau chỉnh code cuối.
- Smoke repository: PASS, hai ghi nhận sau khóa, chống gửi trùng, không sửa attendance, từ chối ngày cũ/format lỗi/403/404, tổng đếm nhất quán.
- Browser mock: chế độ khóa hiển thị đúng; lưu Có mặt mở form, ghi nhận hai lần hiển thị lịch sử; đổi trẻ khi nhập dở mở xác nhận, Quay lại giữ dữ liệu. Desktop 1366px hai cột, 390px một cột, scrollWidth bằng clientWidth. Test trên origin riêng với đồng hồ giả lập, không đổi giờ máy hoặc cấu hình trường; server QA đã dừng.
- `node scripts/check-ai-layer.mjs` → 0 lỗi, 17 cảnh báo có sẵn về planned files/glob TypeScript. Không chỉnh ngoài scope để xử lý cảnh báo này.
- Chưa kiểm: backend thật, APP native, luồng Lưu & trẻ tiếp theo bằng browser (đã triển khai nhưng chưa smoke riêng), mất mạng/quota storage và nhiều tab đồng thời.
- Khác workflow plan: ghi nhận plan theo scope user đã yêu cầu code và xác nhận demo; không yêu cầu duyệt lại cùng lựa chọn. Review kết quả ở cuối lượt.
