# Đánh giá lại UI/UX kế hoạch năm học và tổ — 08/11/2026

Đánh giá bằng skill UI/UX Pro Max, ảnh user và source hiện tại sau các chỉnh sửa. Không sửa giao diện trong lượt này. Không mở browser theo chỉ đạo FE: chiều cao thực, overflow, contrast và thao tác trên thiết bị chưa được đo; không dùng kết quả test logic để khẳng định bố cục đã đẹp/đạt chuẩn.

## Nhận định

Cấu trúc ba phần, nhập trực tiếp trong bảng và lưu tay phù hợp công việc soạn kế hoạch nhiều dữ liệu. Các điểm user đã chốt hiện nhất quán hơn: ô thêm lĩnh vực con ở đầu từ khi trống, nhãn “Nhập lĩnh vực con” ngắn, STT nhập trước mục tiêu, dấu cộng điền nhãn chỉ commit sau khi thả, cột thao tác dùng icon chung. Không cần đổi phong cách tổng thể; ưu tiên kiểm tính đọc được và thao tác chính xác trước khi thêm trang trí.

## Phát hiện theo ưu tiên

### P2 — Ngày một dòng có nguy cơ vượt cột ở màn hình hẹp
- **Bằng chứng:** `src/styles/modules/education-plan.css:2169` trở đi dùng bảng fixed/width100%, bốn cột chia đều; `:2214` buộc khoảng ngày nowrap. Hai ngày đầy đủ năm cần chiều rộng lớn hơn một cột khi khung bị thu hẹp.
- **Tác động:** có thể tràn vào ô khác hoặc phát sinh cuộn ngang, trái mục tiêu bảng vừa khung. Đây là rủi ro suy ra từ CSS, chưa xác nhận trên viewport thực.
- **Đề xuất:** kiểm 375/768/1024/1440px và zoom200%; giữ bố cục desktop hiện tại. Nếu không đủ chỗ, cần chốt phương án màn hẹp (dạng thẻ hoặc khoảng ngày xuống dòng). Không tự nới yêu cầu ngày một dòng/không cuộn ngang đã chốt.

### P2 — Vùng bấm dấu cộng STT còn nhỏ
- **Bằng chứng:** `.ga-goal-label-fill` tại `src/styles/modules/education-plan.css:559` dùng20×20px; xóa nhánh tại `:2157` dùng24×24px, nút icon chung32×32px.
- **Tác động:** dấu cộng hiển thị gọn theo yêu cầu, nhưng cần độ chính xác cao khi kéo, nhất là touchpad/cảm ứng. Đây là kích thước xác định từ token; chưa thử thao tác thật.
- **Đề xuất:** giữ dấu cộng nhìn nhỏ, tăng vùng bắt đầu kéo bằng khoảng đệm vô hình nếu không chồng vùng nhập; ưu tiên kiểm và điều chỉnh riêng `pointer: coarse`. Không quay lại icon lớn hoặc nền xanh user đã bỏ.

### P2 — Đổi thứ tự chưa có cách thay thế bằng thao tác click đơn
- **Bằng chứng:** `ThemeEventTable.actionCell` ở `src/components/education-plan/GoalTables.jsx:1146` chỉ có SortHandle và xóa; `src/components/ui/Sortable.jsx` có KeyboardSensor nhưng bảng đã bỏ nút lên/xuống theo yêu cầu user.
- **Tác động:** người dùng không kéo chuột được cần dùng bàn phím; hỗ trợ bàn phím chưa tương đương một cách thay thế chỉ bằng click/chạm.
- **Đề xuất:** nếu cần tăng accessibility, có thể dùng menu phụ “Chuyển lên/xuống” hoặc chọn vị trí, giữ cột Thao tác gọn. Đây là đánh đổi của lựa chọn đã chốt; không tự thêm lại nút mũi tên.

### P3 — Nhãn STT mới thiếu ngữ cảnh cho người dùng đọc màn hình
- **Bằng chứng:** `src/components/education-plan/GoalTables.jsx:364` dùng cùng aria-label “STT mục tiêu mới” cho nhiều lĩnh vực/nhóm; `:475` có thể cùng “Nhãn mục tiêu mới” cho các goal chưa có câu.
- **Tác động:** khi Tab qua trang dài, các tên control trùng nhau khó xác định thuộc lĩnh vực nào. Không cần đưa placeholder trở lại.
- **Đề xuất:** thêm tên lĩnh vực/nhóm hoặc số hàng vào aria-label, giữ nguyên giao diện nhìn thấy và các nhãn ngắn user đã chốt.

### P3 — Thanh công cụ kế hoạch tổ còn nhiều thao tác bị vô hiệu hóa
- **Bằng chứng:** `src/pages/education-plan/GoalFormPage.jsx:684` trở đi vẫn dựng nhóm lấy kế hoạch/lấy từ Bộ/nhập file với `disabled={!annual}`.
- **Tác động:** trên kế hoạch tổ, các nút không dùng được vẫn chiếm chỗ, làm thanh đầu trang dài và có thể xuống hàng.
- **Đề xuất:** gom hành động nhập nguồn vào menu hoặc chỉ hiện hành động phù hợp trạng thái/quyền. Cần giữ rõ cách lấy nguồn năm học hiện có; không tự thay quyền hoặc nghiệp vụ.

## Những điểm nên giữ

- Thứ tự Thông tin → Mục tiêu/nội dung → Chủ đề/sự kiện dễ theo dõi.
- Tên kế hoạch một dòng, bộ đếm cạnh bên; label liên kết id và lỗi có aria-describedby/role alert.
- Ô nội dung/mục tiêu dài vẫn tự cao theo chữ, không ép một chiều cao cố định.
- Nhập kết quả/nội dung/STT liên tục, ô chờ mới xuất hiện ngay; không tạo thêm mục tiêu khi đã nhập STT trước.
- STT bảng Mục tiêu theo nền các cột bên cạnh; STT các phần khác giữ xám/khóa theo user, không đồng loạt ép trắng.
- Xóa có modal xác nhận; kéo điền chỉ đổi nhãn khi thả, có Escape/hủy và bàn phím; lưu vẫn do user bấm Lưu.
- Dải vàng lĩnh vực con và xanh tiêu đề là lựa chọn đã chốt: không đề nghị đổi chỉ vì khác mẫu UI hiện đại.

## Cơ sở UI/UX Pro Max

Tra local: `text reflow spacing --domain ux`, `dragging movements touch target --domain ux`, `form input accessible label --stack react`. Các kết quả phù hợp: đọc được khi thu hẹp/zoom, thao tác không đòi độ chính xác quá cao, cách thay thế kéo bằng một pointer, label rõ ngữ cảnh và controlled input. Không đánh đồng44pt/48dp của app native với mọi control web; không tuyên bố đạt/không đạt WCAG khi chưa kiểm đầy đủ.

## Trình tự ưu tiên đề xuất

1. Kiểm viewport/zoom, khoảng ngày, nhãn dài và nhiều nhánh trên giao diện thực.
2. Giữ dấu cộng nhỏ nhưng kiểm vùng bấm/kéo và đường Tab/focus.
3. Làm rõ aria-label và giảm thao tác disabled trong kế hoạch tổ.
4. Cân nhắc phương án click thay thế kéo nếu cần nâng accessibility.

Lượt đánh giá không sửa source, không chạy build/test vì không thay code. Chưa kiểm browser, viewport, đo màu/contrast hay thiết bị cảm ứng thực.
