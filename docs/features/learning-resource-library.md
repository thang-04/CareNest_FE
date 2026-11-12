# Kho học liệu cho giáo án ngày (spec 900)

Nguồn: `UI-giaoan/specs/900-learning-resource-library/` · rule `BE:EDU-81`, `EDU-82…88` (PROPOSED, Tiền 13/11/2026) · Jira G94-900.

## Hành vi đã chốt

- **Kho + dòng gắn** (EDU-82): tệp/link lưu một lần làm học liệu trong kho; giáo án ngày chỉ giữ dòng gắn theo mục hoạt động
  `ngày#hoc|ngoai_troi|goc|chieu` (EDU-81). Một mục tối đa 20 học liệu, không gắn trùng.
- **Ở mục III của kế hoạch giáo dục ngày** (`components/education-plan/DayResources.jsx`): mỗi mục có *Tải lên*, *Dán link*,
  *Chọn từ kho*. Học liệu tạo từ mục tự mang nhãn nhóm tuổi của lớp, chủ đề của tuần, MT của các hoạt động đã xếp vào mục.
- **Dán link** (EDU-83, `ResourceLinkForm.jsx`): chỉ https YouTube (chuẩn hóa `watch?v=<id>`; watch, youtu.be, shorts, embed,
  live) và Google Drive/Docs; lỗi hiện dưới ô khi rời ô; dán lại link đã có trong kho của mình thì dùng lại học liệu cũ.
- **Chọn từ kho** (EDU-87, `ResourcePickerModal.jsx`): tab Tất cả / Của tôi / Của lớp / Của trường, tìm theo tên (chờ 300 ms),
  BE xếp Cùng MT (id hoặc mã mục tiêu Bộ, kể cả năm trước) → Cùng chủ đề (id hoặc tên) → mới nhất; học liệu đã gắn ghi
  "Đã gắn", không tích được; xem trước trong modal; 50 dòng mỗi lần + "Xem thêm". Không bao giờ tự gắn.
- **Gỡ / ẩn / xóa** (EDU-85): gỡ chỉ xóa dòng gắn; xóa khỏi kho bị chặn khi còn dùng ⇒ hộp thoại đề nghị *Ẩn khỏi kho*;
  ẩn hiện lại được ở tab Đã ẩn; học liệu ẩn vẫn xem/trình chiếu được trong giáo án cũ (EDU-86).
- **Trang Kho học liệu** `/education/resources` (menu Kế hoạch giáo dục, `pages/education-plan/ResourceLibraryPage.jsx`):
  khung như các trang kế hoạch giáo dục (đầu trang → thẻ lọc → tab → hàng nút → thẻ bảng). Bảng: học liệu, nhãn, đang dùng
  (bấm xem lớp – ngày – mục, mở giáo án ngày), phạm vi, cập nhật, menu thao tác.
- **Phạm vi** (EDU-84): Của tôi → Chia sẻ cho lớp (lớp mình dạy) → Đề nghị lên kho trường; tổ trưởng nhóm tuổi (không tự duyệt)
  hoặc PHT duyệt / trả lại (bắt buộc lý do) ở tab *Chờ duyệt*; PHT đưa thẳng và gỡ khỏi kho trường.
- **Trình chiếu / trình xem** (`LearningResourceViewer.jsx`): YouTube nhúng `youtube-nocookie.com`, không tự phát, nút
  "Mở trên YouTube"; Drive/Docs thẻ "Mở trong tab mới".
- File Word giáo án ngày không liệt kê học liệu (EDU-21).

## Kỹ thuật

- Facade `services/education-plan/learningResourceService.js` (dòng gắn) và `resourceLibraryService.js` (kho); mock dùng chung
  `mock/learningResourceMockRepository.js`. Lớp API đổi mã nhóm tuổi `ag-3` ↔ id số qua `loadEduRefs()`.
- Model `models/education-plan/learningResources.mjs`: `normalizeLink` (cùng quy tắc BE), `youtubeEmbed`, `matchOf`, `rankResources`.
- Test: `tests/education-plan/resource-library.test.mjs`.
- Sửa ở trang kho: tên, nhóm tuổi, bỏ nhãn chủ đề/MT không đúng (nhãn được thêm khi tạo từ mục hoạt động — spec 900 vòng 13).
- Chưa làm (ponytail): đổi thứ tự học liệu trong mục, chọn thêm MT bằng tay ở trang kho, thông báo khi duyệt/trả lại.
