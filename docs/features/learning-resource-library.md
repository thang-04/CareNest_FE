# Kho học liệu cá nhân cho giáo án ngày (spec 900 → 901)

Nguồn: `UI-giaoan/specs/901-personal-resource-library/` (thay phần phạm vi của `specs/900-learning-resource-library/`) ·
rule `BE:EDU-81`, `EDU-82…88` (CONFIRMED, Tiền 13–14/11/2026) · Jira G94-900.

## Hành vi đã chốt

- **Kho chỉ cá nhân** (EDU-84): mỗi giáo viên (gồm tổ trưởng) một kho; không Của lớp / Của trường, không đề nghị/duyệt,
  không thông báo duyệt, không Ẩn. PHT/HT không có trang Kho (route `resources` chỉ `TEAM_LEADER`, `TEACHER`).
- **Học liệu tự vào kho** (EDU-88): chỉ thêm ở giáo án ngày (tải lên / dán link); trang Kho không có Tải lên / Dán link.
- **Kho + dòng gắn** (EDU-82): tệp/link lưu một lần; giáo án ngày giữ dòng gắn theo mục `ngày#hoc|ngoai_troi|goc|chieu`
  (EDU-81). Một mục tối đa 20 học liệu, không gắn trùng; chỉ gắn học liệu trong kho của mình.
- **Mục III giáo án ngày** (`components/education-plan/DayResources.jsx`): mỗi mục một nút **"+ Thêm học liệu"** (tắt khi đủ 20)
  mở hộp gộp `ResourcePickerModal.jsx`: tìm, lọc chủ đề đã dạy và nhóm tuổi (mặc định nhóm tuổi của lớp), Gợi ý / Tất cả
  (`aria-pressed`), nhãn "Cùng MT" / "Cùng chủ đề · <năm>", "Đã gắn" (không chọn được), 50 dòng + "Xem thêm"; phía dưới
  Tải lên và Dán link; kho trống ⇒ trạng thái trống kèm 2 thao tác đó. Học liệu đã gắn là thẻ `file-row` trong `SortableList`
  (kéo + nút lên/xuống, lỗi 7136 khi danh sách đã đổi), menu Xem / Gỡ khỏi mục; chỉ xem khi giáo án không sửa được.
- **Nhãn** (EDU-87): học liệu thêm/gắn từ mục tự mang nhãn chủ đề của ngày (kèm năm học) + MT của mục, gắn với dòng gắn
  (gỡ là mất); nhãn thêm tay ở trang Kho chỉ bỏ bằng tay. BE xếp Cùng MT (id hoặc mã Bộ) → Cùng chủ đề (id hoặc tên, mọi năm).
- **Dán link** (EDU-83, `ResourceLinkForm.jsx`): chỉ https YouTube (chuẩn hóa `watch?v=<id>`) và Google Drive/Docs.
- **Trang Kho** `/education/resources` (`pages/education-plan/ResourceLibraryPage.jsx`): nhóm theo chủ đề đã dạy + năm học
  ("Chưa ghi chủ đề" cuối), tìm, lọc chủ đề / loại / nhóm tuổi. Menu: Xem, Đổi tên, Sửa nhãn (`ResourceTagsModal.jsx`:
  nhóm tuổi, chủ đề, MT; nhãn tự thêm không bỏ được), Nơi đang dùng, Xóa vĩnh viễn.
- **Xóa / đổi tên** (EDU-85, EDU-88): gọi `usages` trước. Bị khóa (gắn giáo án Chờ duyệt, hoặc đã ban hành mà ngày dạy là
  hôm nay hoặc chưa tới) ⇒ thông báo chặn nêu lớp – ngày – mục và "Xóa được từ dd/mm/yyyy" / "sau khi giáo án được duyệt
  hoặc trả lại"; không khóa mà đang dùng ⇒ xác nhận kèm danh sách, xóa là gỡ khỏi mọi giáo án (trạng thái giáo án giữ nguyên).
  BE chặn bằng 7137.
- **Xem học liệu** (EDU-86): ai xem được giáo án ngày thì mở được học liệu đã gắn trong giáo án đó (kể cả của người khác).
- **Trình chiếu / trình xem** (`LearningResourceViewer.jsx`): YouTube nhúng `youtube-nocookie.com`, không tự phát, nút
  "Mở trên YouTube"; Drive/Docs "Mở trong tab mới". File Word giáo án ngày không liệt kê học liệu (EDU-21).

## Kỹ thuật

- Facade `services/education-plan/learningResourceService.js` (dòng gắn) và `resourceLibraryService.js` (kho: `list`,
  `update`, `remove`, `usages`, `contentUrl`); mock `mock/learningResourceMockRepository.js` theo cùng quy tắc khóa và nhãn.
- Model `models/education-plan/learningResources.mjs`: `normalizeLink`, `youtubeEmbed`, `deleteLock`, `deletableText`,
  `taughtThemeGroups`.
- Test: `tests/education-plan/learning-resources.test.mjs`, `resource-library.test.mjs`, `learning-resources-api.test.mjs`.
- Giới hạn: danh sách chủ đề để lọc lấy từ các trang học liệu đã tải (chưa có API "chủ đề đã dạy").
