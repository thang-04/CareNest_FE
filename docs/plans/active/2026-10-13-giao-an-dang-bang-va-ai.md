---
title: Giáo án dạng bảng theo nghiệp vụ MN Thái Dương + AI tạo nháp
status: draft
owner: carenestg94@gmail.com
jira: G94-178
branch: feature/G94-178-FE-FEAT-41-lesson-assessment-parent
modules: [education-plan]
rules: []
risk: medium
created: 2026-10-13
updated: 2026-10-13
---
# Giáo án dạng bảng theo MN Thái Dương + AI tạo nháp

Làn L: 4–5 màn soạn và màn duyệt, khoảng 12 file, thêm mock AI.

## Context
- Ngày 13/10 Tiền gửi 3 file giáo án thật của Trường MN Thái Dương (Thượng Hồng) và yêu cầu "làm giao diện đáp ứng được nghiệp vụ này". Từ nay **Yên Định chỉ để tham khảo**.
- Tóm tắt nghiệp vụ: `/mnt/project-files/knowledge/mn_thai_duong/INDEX.md` (bản sao trên project files, không nằm trong repo).
- Yêu cầu khách hàng ngày 13/10 (Tiền chuyển lại):
  - Phó HT và tổ trưởng cùng soạn mục tiêu năm.
  - Chủ đề và giáo án do 2 giáo viên của lớp soạn.
  - Giáo án duyệt theo thứ tự tổ trưởng → Phó HT.
- Hiện trạng code:
  - `GoalFormPage` đã là bảng (`ga-goal-table`).
  - `ThemeFormPage` bước 2 là các thẻ.
  - `LessonFormPage` là nhóm thẻ.
  - Bảng chỉ đọc cho tuần và ngày nằm ở `lessonShared.jsx`.

## Phạm vi (theo file Thái Dương)
1. **Kế hoạch năm của khối:**
   - Bảng nhiều tầng: lĩnh vực I–V → lĩnh vực con → nhóm kết quả mong đợi → **mục tiêu đánh số 1…n** → nhiều **nội dung**.
   - Mỗi nội dung có các cột **tích chủ đề** (MN, BT, GĐ…).
   - Bảng thứ 2 là **dự kiến chủ đề, sự kiện**: tên, số MT tự tính từ các ô đã tích, ngày lễ hội, từ → đến, ghi chú.
   - Phó HT và tổ trưởng cùng soạn, mỗi người phụ trách một số lĩnh vực.
   - Có nút AI gợi ý mục tiêu và nội dung.
2. **Chủ đề nhánh theo lớp:**
   - Bảng Tháng | Chủ đề | Chủ đề nhánh | Tuần n (từ → đến) | Ghi chú.
   - Hệ thống tự chia tuần theo thời gian của chủ đề, có thêm dòng nghỉ (Tết, ôn tập).
3. **Kế hoạch giáo dục chủ đề theo lớp:**
   - Bảng Mục tiêu (lấy các MT đã tích cho chủ đề) | Nội dung | **Hoạt động giáo dục**.
   - Có thêm phần **Môi trường giáo dục** trong lớp và ngoài lớp.
   - AI điền cột Hoạt động giáo dục.
4. **Kế hoạch tuần:**
   - Mục đích chia Kiến thức / Kỹ năng / Thái độ, kèm phần Chuẩn bị.
   - Bảng **8 dòng cố định × Thứ 2–6**, có lựa chọn "gộp cả tuần" cho từng dòng.
   - AI điền các ô trống.
5. **Kế hoạch ngày:**
   - Mục đích và Chuẩn bị.
   - Bảng **Hoạt động của cô | Hoạt động của trẻ | Ghi chú** với 3 dòng: Hoạt động học, Ngoài trời, Buổi chiều.
   - Ghi sau khi dạy: Đánh giá trẻ trong ngày, Điều chỉnh bổ sung.
   - Nút AI "Soạn tiến trình" cho dòng Hoạt động học.
6. **Duyệt theo tuần:** mỗi lần gửi duyệt gồm kế hoạch tuần và các kế hoạch ngày của tuần đó. Tổ trưởng duyệt trước, rồi Phó HT. Người duyệt nhận xét và ký.
7. **AI chạy bằng mock** (`aiDraftMock.js`) và hiện trong `AiDraftPanel` dựng trên `SidePanel`. Mỗi đề xuất có nút Dùng / Bỏ, nội dung đã dùng mang nhãn "Nháp AI".

## Ngoài phạm vi đợt này
- Nhiều người sửa cùng lúc kèm kiểm tra phiên bản. Phần này cần BE; FE chỉ hiện tên người phụ trách.
- API AI thật.

## Ràng buộc
- Không đổi style; dùng lại class có sẵn. Nếu cần CSS mới thì hỏi trước.
- Không commit.

## Câu hỏi mở
- [ ] Tiền duyệt plan.
- [ ] Đổi mã mục tiêu từ TC1.1 sang **số MT 1…n** và **tích nội dung theo chủ đề**, bỏ tháng thực hiện/đánh giá (quyết định cũ lấy từ Yên Định và GoKids)?

## Progress log
