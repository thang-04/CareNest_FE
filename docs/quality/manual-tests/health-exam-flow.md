# Kịch bản thử tay — Đợt khám và phiếu Phụ lục II (từ tạo đợt tới đóng đợt)

Mục đích: đi hết luồng **Hiệu trưởng tạo đợt → giáo viên nhập phiếu cùng bác sĩ → theo dõi sau khám → đóng, mở lại đợt** bằng bộ số cố định. Mỗi trẻ ứng với 1 trường hợp, gồm cả số ở ngưỡng, số sai và quyết định của bác sĩ khác gợi ý của hệ thống. Kết quả mong đợi đã kiểm bằng kịch bản tự động (backend giả) ngày 2026-10-17.

Nghiệp vụ: [plan phiếu khám Phụ lục II](../../plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md). Dữ liệu là dữ liệu giả.

## 0. Chuẩn bị

1. Chạy `npm run dev`, mở `http://localhost:5173`.
2. Đăng nhập bất kỳ, bấm **tên/ảnh đại diện ở góc trên bên phải → Khôi phục dữ liệu demo → Khôi phục dữ liệu**. Hệ thống đưa mọi dữ liệu về bản mẫu ban đầu rồi đăng xuất. Làm lại bước này mỗi khi muốn chạy lại kịch bản từ đầu.
3. Mật khẩu mọi tài khoản: `123456`. "Hôm nay" là ngày trên máy.

| Vai | Tài khoản | Phạm vi |
| --- | --- | --- |
| Hiệu trưởng | `hung.pham@carenest.edu.vn` | Cả 2 điểm trường |
| Phó hiệu trưởng Campus 2 | `duc.trinh@carenest.edu.vn` | Chỉ xem Campus 2 |
| Giáo viên Lớp Mầm 1 (Campus 2) | `tuan.hoang@carenest.edu.vn` | Trẻ T1–T6 |
| Giáo viên Lớp Lá A (Campus 2) | `ngoc.vu@carenest.edu.vn` | Trẻ T7–T12 |

Kịch bản dùng Campus 2: Campus 1 đã có đợt đang diễn ra với dữ liệu mẫu.

## A. Hiệu trưởng tạo đợt

| Bước | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| A1 | **Đợt khám sức khỏe → Tạo đợt khám**. Điểm trường Campus 2, nhập đủ các ô như A3, bấm **Tạo đợt khám** | Không tạo được. Ô điểm trường báo: *Điểm trường đang có đợt "Khám sức khỏe định kỳ tháng …" chưa đóng. Đóng hoặc hủy đợt đó trước khi tạo đợt mới.* |
| A2 | Để trống tên, chọn ngày kết thúc trước ngày bắt đầu, bấm **Tạo đợt khám** | Lỗi *Nhập tên đợt khám* và *Ngày kết thúc không được trước ngày bắt đầu* |
| A3 | Mở đợt "Khám sức khỏe định kỳ tháng …" của Campus 2 (Sắp diễn ra) → **Hủy đợt** → xác nhận | *Đã hủy đợt khám.* (Đợt chưa có kết quả nên hủy được.) |
| A4 | **Tạo đợt khám**: tên `Khám sức khỏe đợt thử luồng` · Campus 2 · bắt đầu **hôm nay** · kết thúc **hôm nay + 3** · đơn vị khám `Trạm Y tế phường – BS. Đỗ Minh Khôi` · ghi chú `Giáo viên có mặt cùng bác sĩ, nhập phiếu Phụ lục II từng trẻ.` | Đợt ở trạng thái **Đang diễn ra**. Giáo viên Campus 2 nhận thông báo *Đợt khám sức khỏe mới*. |
| A5 | Đăng nhập Phó hiệu trưởng Campus 2, mở đợt | Thấy tiến độ, không có nút tạo, sửa, đóng |

## B. Giáo viên nhập phiếu cùng bác sĩ

Mở đợt → bấm **Khám trẻ của lớp** → bấm **Khám** cạnh tên trẻ. Phiếu có 5 bước: **1 Hành chính, tiền sử · 2 Sinh tồn, dinh dưỡng · 3 Phát triển, tiêm chủng · 4 Khám lâm sàng · 5 Kết luận**.

**Mặc định, trừ khi bảng ghi khác:**
- Bước 1: giữ người đi cùng hệ thống điền sẵn (bố trong hồ sơ). Sinh non: Không. Tiền sử bản thân, gia đình, tiếp xúc lao: Không.
- Bước 2: tình trạng dinh dưỡng chọn Bình thường.
- Bước 3: phần IV chọn Có, Có; phần V chọn Có, Có, Có.
- Bước 4: giữ nguyên các lựa chọn chọn sẵn.
- Bước 5: kết luận Bình thường; hướng xử lý "Không cần tư vấn hay chuyển khám"; bác sĩ kết luận `BS. Đỗ Minh Khôi`.

**Hỏi lại trước khi lưu:** bác sĩ không chuyển khám (và không có nguy cơ lao) mà khối "Điểm cần bác sĩ xem lại" còn mục nào, thì bấm **Lưu kết luận** sẽ hiện hộp **"Bác sĩ vẫn kết luận như vậy?"** liệt kê các điểm. Bấm **Quay lại xem** để xem lại, hoặc **Lưu theo bác sĩ** để lưu. Hộp không chặn việc lưu.

**Gợi ý gộp sinh tồn:** 1/3 chỉ số (nhiệt độ, mạch, nhịp thở) ngoài khoảng ⇒ dòng vàng *Gợi ý: cần theo dõi*; từ 2/3 ⇒ dòng đỏ *Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận*.

**Công bố:** phiếu có người đi cùng tự công bố cho phụ huynh khi bấm **Lưu kết luận** (kể cả khi lưu lại sau sửa). Phiếu không có người đi cùng (T4) giáo viên công bố sau, khi đã ghi trao đổi.

Khi nhập số ở bước 2, trạng thái tự chọn theo khoảng của nhóm tuổi; trừ khi bảng ghi khác, giữ trạng thái hệ thống chọn. Khoảng tham khảo của trẻ 3–5 tuổi: mạch 80–120, nhịp thở 20–28 lần/phút. Nhiệt độ: sốt từ 37,5 °C, hạ thân nhiệt dưới 36 °C.

### Lớp Mầm 1 — `tuan.hoang@carenest.edu.vn`

**T1 · Vũ Tuấn Kiệt (40 tháng) — Bình thường, số ở cận trên**
- Bước 1: thấy số định danh, địa chỉ đã điền sẵn từ phiếu ngày 6/10.
- Bước 2: nhiệt độ `37.4` · mạch `120` · nhịp thở `28` · chiều cao `98.5` · cân nặng `15.2` · vòng đầu `48.5` · vòng cánh tay `160`. Cả 3 trạng thái là **Bình thường**. Vòng đầu tự chọn Bình thường (khoảng tạm 46,5–52,0 cm).
- Bước 5: thấy *Không có mục nào được ghi bất thường*. Bấm **Lưu kết luận**.
- Mong đợi: nhãn **Bình thường**, mức **Không ghi nhận bất thường**, không mở phiếu theo dõi mới. Bước 5 có dòng *Có người đi cùng trẻ: khi lưu kết luận, phiếu được công bố cho phụ huynh ngay*. Sau khi lưu, phiếu **đã công bố** (*Đã công bố cho phụ huynh khi lưu kết luận*), không cần bấm công bố.
- Phiếu theo dõi cũ (Tai mũi họng) vẫn mở: kết luận bình thường không tự đóng phiếu (đóng ở bước C3).

**T2 · Đỗ Phương Linh (34 tháng) — Khoảng tham khảo đổi theo tuổi**
- Bước 2: thấy *Khoảng tham khảo của trẻ 12–35 tháng: 98–140 lần/phút* và *22–37 lần/phút*.
  - Nhập nhiệt độ `37.0` · mạch `135` · nhịp thở `30` · chiều cao `93.0` · cân nặng `12.4` · vòng đầu `47.0`.
  - Mạch và nhịp thở vẫn **Bình thường**. Với trẻ 3–5 tuổi, 2 số này sẽ là Nhanh và Thở nhanh.
  - Tình trạng dinh dưỡng: chọn **Dấu hiệu thiếu máu** (không chọn Bình thường).
- Bước 4: Lòng bàn tay → **Không bình thường (nhợt)**.
- Bước 5:
  - Chọn **Có vấn đề về sức khỏe** (nếu đã tích Bình thường, ô đó tự bỏ), ghi rõ `Lòng bàn tay nhợt, có dấu hiệu thiếu máu.`
  - Chọn **Tư vấn**, lời tư vấn `Bổ sung thực phẩm giàu sắt; đưa trẻ đi khám nếu mệt, xanh xao.`
- Mong đợi:
  - Điểm cần xem lại không có dòng sinh tồn. Có 2 mục: *Tình trạng dinh dưỡng: Dấu hiệu thiếu máu*, *Lòng bàn tay: Không bình thường (nhợt)*.
  - Bấm **Lưu kết luận**: hiện hộp hỏi lại với 2 điểm trên (bác sĩ chỉ tư vấn) → bấm **Lưu theo bác sĩ**.
  - Sau khi lưu: **Có vấn đề, tư vấn**, mức **Cần theo dõi**, không mở phiếu theo dõi.

**T3 · Trần Đăng Khoa (42 tháng) — Gợi ý 2 dấu hiệu, kết quả vào phiếu đang mở**
- Danh sách lớp: trẻ có link *Đang có phiếu theo dõi* (đã trao đổi ngày 16/9, đã được nhắc sau 30 ngày).
- Bước 2: `36.9` · `105` · `24` · chiều cao `97.0` · cân nặng `14.6` · vòng đầu `46.0`. Vòng đầu tự chọn **Đầu nhỏ** (khoảng tạm 46,6–52,1).
- Bước 3: Phát triển vận động → **Không**.
- Bước 5:
  - Thấy gợi ý: **Gợi ý: cân nhắc chuyển khám chuyên khoa — 2/3 dấu hiệu**.
  - Chọn **Có vấn đề**, ghi rõ `Vòng đầu nhỏ, vận động chưa theo kịp độ tuổi.`
  - Chọn **Chuyển khám chuyên khoa**: `Nhi khoa – khám phát triển`, lời tư vấn `Đưa trẻ đi khám trong tháng này.`
- Mong đợi:
  - Mức **Cần theo dõi sát**. Màn kết quả: *Hệ thống đã mở phiếu theo dõi và ghi lần trao đổi tại buổi khám.*
  - Mở phiếu theo dõi: **vẫn là phiếu cũ**, không có phiếu thứ hai. Dòng thời gian có *Kết quả khám mới … – bắt đầu vòng theo dõi mới* và lần trao đổi *tại buổi khám*. Trạng thái **Đã trao đổi, đề nghị khám chuyên khoa**.

**T4 · Hoàng Khánh An (37 tháng) — Chuyển khám, KHÔNG có người đi cùng**
- Bước 1: chọn **Không có người đi cùng**.
- Bước 2: `36.7` · `110` · `26` · chiều cao `96.0` · cân nặng `14.0` · vòng đầu `52.3`. Vòng đầu tự chọn **Đầu to** (khoảng tạm 46,3–51,8).
- Bước 5:
  - Gợi ý chỉ là *cần theo dõi* (1/3 dấu hiệu).
  - Bác sĩ vẫn đề nghị chuyển khám: chọn **Có vấn đề**, ghi rõ `Vòng đầu to so với tuổi.`; **Chuyển khám chuyên khoa** `Nhi khoa – thần kinh`.
- Mong đợi:
  - Mức **Cần theo dõi sát**, theo kết luận bác sĩ, không theo gợi ý.
  - Bước 5 có dòng *Không có người đi cùng: lưu kết luận chưa công bố cho phụ huynh*. Phiếu **không** tự công bố.
  - Màn kết quả có cảnh báo vàng: chưa ghi trao đổi với phụ huynh, cần trao đổi trong 7 ngày. Có nút **Ghi trao đổi trong phiếu theo dõi** thay cho nút Công bố.
  - Phiếu theo dõi mới ở trạng thái **Chờ trao đổi phụ huynh**, hạn = hôm nay + 7.

**T5 · Bùi Gia Bảo (44 tháng) — Nguy cơ lao, người đi cùng là bà**
- Bước 1:
  - Người đi cùng: sửa họ tên thành `Bùi Thị Tám`, quan hệ **Ông/bà**, SĐT `0912 345 029`, CCCD `999196200029`.
  - Tiền sử gia đình **Có**: `Ông nội đang điều trị lao`. Tiền sử tiếp xúc với người bệnh lao **Có**.
- Bước 2: `37.1` · `112` · `27` · chiều cao `99.0` · cân nặng `15.0` · vòng đầu `49.5`.
- Bước 5:
  - Chọn **Có nguy cơ mắc lao (tiền sử tiếp xúc)** (không chọn Bình thường).
  - **Chuyển khám chuyên khoa** `Lao và bệnh phổi – Trung tâm Y tế`, lời tư vấn `Đưa trẻ đi khám sàng lọc lao trong tuần.`
- Mong đợi:
  - Điểm cần xem lại có *Tiền sử gia đình: Có (Ông nội đang điều trị lao)* và *Tiền sử tiếp xúc với người bệnh lao: Có*.
  - Sau khi lưu: nhãn **Nguy cơ lao**, khung đỏ báo đã gửi thông báo.
  - Đăng nhập Hiệu trưởng và Phó hiệu trưởng Campus 2: chuông có *Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)*.
  - Phiếu theo dõi có nhãn đỏ nguy cơ lao; lần trao đổi ghi *Bùi Thị Tám (Ông/bà)*.
  - Danh sách lớp không hiện số CCCD.

**T6 · Nguyễn Bảo Ngọc (38 tháng) — Phiếu khám dở**
- Bước 2: `36.8` · `100` · `25` · `97.5` · `14.4` · `49.0`.
- Đi tới bước 4, bấm **Lưu nháp**, rồi **Về đợt khám**.
- Mong đợi:
  - Danh sách lớp hiện **Đang khám** và nút **Tiếp tục khám**. Mở lại thì phiếu mở đúng bước 4.
  - Phiếu không hiện ở Sổ sức khỏe.

### Lớp Lá A — `ngoc.vu@carenest.edu.vn`

**T7 · Phạm Thảo Vy (58 tháng) — Thừa cân, chỉ số SD, ghi rõ hành vi; sau đó sửa phiếu**
- Bước 2:
  - `36.6` · `98` · `22` · chiều cao `106.0` · chiều dài/tuổi `0.5` · cân nặng `24.5` · cân nặng/tuổi `2.3` · vòng đầu `50.0` · vòng cánh tay `210`.
  - Tình trạng dinh dưỡng: **Thừa cân/béo phì**.
- Bước 4: *Có biểu hiện buồn bã, lo âu, mất ngủ kéo dài không* → **Có**. Ô *Nếu có, ghi rõ* thành bắt buộc: `Gần đây trẻ khó ngủ, hay lo khi xa mẹ (người đi cùng kể).`
- Bước 5: **Có vấn đề** `Thừa cân; khó ngủ kéo dài.` · **Tư vấn** `Giảm đồ ngọt, tăng vận động; giữ giờ ngủ cố định.`
- Mong đợi: bấm **Lưu kết luận** hiện hộp hỏi lại (thừa cân, buồn bã kéo dài, ghi rõ) → **Lưu theo bác sĩ**. Mức **Cần theo dõi**, phiếu tự công bố (có người đi cùng).
- Thử sửa phiếu (từ màn kết quả bấm **Xem phiếu**):
  1. Bấm **Sửa phiếu**, ở bước 2 đổi cân nặng thành `24.1`.
  2. Ở bước 5 bấm **Lưu kết luận** khi chưa ghi lý do → lỗi *Nhập lý do sửa phiếu đã có kết luận*.
  3. Ghi lý do `Cân lại sau khi trẻ cởi áo khoác.` rồi lưu.
- Mong đợi sau khi sửa: **Lịch sử sửa phiếu** có *Cân nặng (kg): 24,5 → 24,1*. Phiếu vẫn có người đi cùng nên **tự công bố lại** khi lưu.

**T8 · Đặng Tuấn Kiệt (65 tháng) — Trên 60 tháng, số ở cận dưới**
- Bước 2: không có ô vòng đầu (*Trẻ trên 60 tháng tuổi tại ngày khám: không đo vòng đầu*).
  - Nhập `36.0` · `80` · `20` · chiều cao `110.0` · cân nặng `18.5`. Cả 3 trạng thái là **Bình thường**.
- Mong đợi: không có điểm cần xem lại; gợi ý kết hợp chỉ xét 2 dấu hiệu phát triển; phiếu tự công bố.

**T9 · Ngô Phương Linh (60 tháng) — Số ngay dưới ngưỡng, gộp vào phiếu đang quá hạn**
- Danh sách lớp: trẻ có phiếu theo dõi đỏ *Quá hạn*.
- Bước 2: nhiệt độ `35.9` → **Hạ thân nhiệt** · mạch `79` → vẫn **Bình thường** · nhịp thở `19` → **Thở chậm** · `107.0` · `17.2` · vòng đầu `50.0`.
  - Dưới ô trạng thái mạch có ghi chú: thấp hơn khoảng tham khảo; mẫu không có ô "chậm".
- Bước 4: Mí mắt và kết mạc → **Chảy ghèn/mủ**.
- Bước 5: **Có vấn đề** `Mắt chảy ghèn; thân nhiệt thấp khi khám.` · **Chuyển khám chuyên khoa** `Mắt`.
- Mong đợi:
  - Điểm cần xem lại có 3 dòng: *Nhiệt độ 35,9 °C: hạ thân nhiệt (dưới 36 °C)*, *Mạch 79 lần/phút, dưới khoảng tham khảo 80–120 của trẻ 3–5 tuổi*, *Nhịp thở 19 lần/phút, dưới khoảng tham khảo 20–28 của trẻ 3–5 tuổi*.
  - Dưới 3 dòng sinh tồn có dòng đỏ *Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận — 3/3*. Bác sĩ chuyển khám nên **không** có hộp hỏi lại.
  - Phiếu theo dõi cũ **không** mở vòng mới: kết quả gộp vào vòng đang chờ. Có lần trao đổi tại buổi khám nên **hết Quá hạn**, trạng thái **Đã trao đổi**.

**T10 · Lê Đăng Khoa (66 tháng) — Gợi ý mạnh nhưng bác sĩ chỉ tư vấn**
- Bước 2: `36.8` · `95` · `23` · `112.0` · `19.0`.
- Bước 3: phát triển tinh thần **Không**, phát triển vận động **Không**.
- Bước 5:
  - Thấy **Gợi ý: cân nhắc chuyển khám chuyên khoa — 2/2 dấu hiệu**.
  - Bác sĩ chỉ tư vấn: **Có vấn đề** `Chậm hơn bạn cùng tuổi về ngôn ngữ và vận động.` · **Tư vấn** `Theo dõi thêm 3 tháng, tăng hoạt động vận động ở lớp.`
- Mong đợi: bấm **Lưu kết luận** hiện hộp hỏi lại (gợi ý cân nhắc chuyển khám) → **Lưu theo bác sĩ**. Mức **Cần theo dõi**, không mở phiếu theo dõi. Gợi ý không phải quyết định.

**T11 · Vũ Khánh An (62 tháng) — Nhập sai, số ngay trên ngưỡng, bác sĩ chọn khác gợi ý**

Lần 1, nhập sai rồi bấm **Lưu kết luận** ở bước 5:

| Bước | Nhập | Lỗi mong đợi |
| --- | --- | --- |
| 1 | CCCD trẻ `12345678` | *Nhập 12 chữ số (CCCD/mã định danh) hoặc số hộ chiếu 6–12 ký tự* |
| 1 | SĐT người đi cùng `12345` | *Nhập số điện thoại hợp lệ, ví dụ 0912 345 678* |
| 1 | CCCD người đi cùng `B7654321` | Không lỗi (số hộ chiếu) |
| 2 | Nhiệt độ `43` | *Nhập nhiệt độ từ 34 đến 42 °C* |
| 2 | Mạch `250` | *Nhập mạch từ 40 đến 220 lần/phút* |
| 2 | Chiều cao `160` · cân nặng `2` | *Nhập chiều cao/chiều dài từ 40 đến 150 cm* · *Nhập cân nặng từ 3 đến 60 kg* |
| 2 | Chiều dài/tuổi `7` · vòng cánh tay `40` | *Nhập chiều dài/tuổi (SD) từ -6 đến 6* · *Nhập chu vi vòng cánh tay từ 50 đến 300 mm* |
| 2 | Tích **Suy dinh dưỡng** rồi tích **Bình thường** | Ô Suy dinh dưỡng tự bỏ tích: "Bình thường" không chọn cùng mục khác |
| 3 | Để trống *Tiêm chủng đầy đủ…* | *Chọn Có hoặc Không* |
| 5 | Bỏ tích kết luận · chọn **Tư vấn** nhưng để trống lời tư vấn · xóa tên bác sĩ | *Chọn kết luận của bác sĩ* · *Ghi lời tư vấn của bác sĩ* · *Nhập họ tên bác sĩ kết luận* |

Mong đợi: thông báo *Phiếu còn thiếu thông tin*. Phiếu nhảy về **bước 1** (bước đầu tiên có lỗi), ô lỗi viền đỏ. Sửa ô nào thì lỗi ô đó mất.

Lần 2, sửa cho đúng:
- Bước 1: CCCD trẻ `999202100035` · SĐT `0912 345 035`.
- Bước 2:
  - Nhiệt độ `37.5` → tự chọn **Sốt**.
  - Mạch `121` → tự chọn **Nhanh**; đổi sang **Bình thường** theo bác sĩ. Dưới ô hiện *Hệ thống gợi ý: Nhanh*.
  - Nhịp thở `29` → **Thở nhanh**.
  - Chiều cao `109.0` · cân nặng `18.0` · chiều dài/tuổi `0.2` · vòng cánh tay `165`.
- Bước 3: tiêm chủng đủ → **Có**.
- Bước 5: **Bình thường** · **Tư vấn** `Theo dõi nhiệt độ ở nhà, cho trẻ uống đủ nước.` · bác sĩ `BS. Đỗ Minh Khôi`.
- Mong đợi:
  - Điểm cần xem lại: *Nhiệt độ 37,5 °C: sốt (từ 37,5 °C)*, *Mạch 121 lần/phút, trên khoảng tham khảo 80–120 của trẻ 3–5 tuổi*, *Nhịp thở 29 lần/phút, trên khoảng tham khảo 20–28 của trẻ 3–5 tuổi*.
  - Dưới 3 dòng có dòng đỏ gợi ý gộp (3/3). Bấm **Lưu kết luận**: hộp *Bác sĩ vẫn kết luận như vậy?* liệt kê 3 chỉ số và gợi ý gộp, kết luận đang chọn *Bình thường · Tư vấn*. Thử **Quay lại xem** (không lưu), rồi bấm lại và chọn **Lưu theo bác sĩ**.
  - Sau khi lưu: **Bình thường**, mức **Không ghi nhận bất thường**. Hệ thống không tự đổi mức theo số đo; lời tư vấn vẫn được lưu.

**T12 · Đỗ Gia Bảo (69 tháng) — Vắng khám**: không nhập gì.

## D. Hiệu trưởng đóng đợt

| Bước | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| D1 | Mở đợt, xem thống kê | Đã có kết luận 10 · Đang khám 1 · Chưa khám 1. Theo kết luận: Bình thường 3 · Có vấn đề, tư vấn 3 · Chuyển khám chuyên khoa 3 · Nguy cơ lao 1. Tab **Trẻ cần theo dõi**: 7 trẻ |
| D2 | **Đóng đợt khám** | Hộp xác nhận: *1 trẻ chưa khám sẽ ghi Vắng khám. 1 phiếu đang khám chưa có kết luận sẽ giữ nguyên, hiện "Chưa kết luận". Còn 1 phiếu theo dõi chờ trao đổi với phụ huynh…* (của T4) |
| D3 | Xác nhận | *Đã đóng đợt khám; 1 trẻ ghi vắng khám; 1 phiếu chưa kết luận.* Lớp Lá A: Đỗ Gia Bảo **Vắng khám**. Lớp Mầm 1: Nguyễn Bảo Ngọc **Chưa kết luận** |
| D4 | Giáo viên mở lại phiếu T7 | Có thông báo đợt đã đóng, phiếu bị khóa; không có nút **Sửa phiếu** |

## C. Theo dõi sau khám (vẫn làm được khi đợt đã đóng)

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| C1 | Thầy Tuấn | Mở phiếu theo dõi của T4 | Nút **Ghi kết quả khám chuyên khoa** mờ: phải ghi trao đổi trước |
| C2 | Thầy Tuấn | **Ghi trao đổi với phụ huynh**: ngày hôm nay, `Đã gọi điện cho bố, đề nghị đưa trẻ khám thần kinh nhi.` | Trạng thái **Đã trao đổi**. Ở **Sổ sức khỏe** của T4, kết quả đợt này có nút **Công bố** (trước đó là *Ghi trao đổi để công bố*) |
| C3 | Thầy Tuấn | Phiếu theo dõi của T3 → **Ghi kết quả khám chuyên khoa**: để trống chuyên khoa · chọn ngày hẹn = ngày khám | Lỗi *Nhập chuyên khoa / nơi khám, ví dụ Mắt — Bệnh viện Nhi* · *Ngày hẹn khám lại phải sau ngày khám* |
| C4 | Thầy Tuấn | Nhập đúng: ngày hôm nay · `Nhi khoa – khám phát triển, Bệnh viện Nhi Hải Phòng` · `Bác sĩ hẹn đánh giá lại sau 1 tháng, tập vận động tại nhà.` · hẹn hôm nay + 30 · thêm 1 ảnh bất kỳ (không dùng giấy khám thật) | Trạng thái **Đã có kết quả khám bên ngoài**. Sổ sức khỏe của T3 hiện kết quả chuyên khoa kèm chuyên khoa và ảnh |
| C5 | Thầy Tuấn | Phiếu theo dõi Tai mũi họng của T1 → **Đóng phiếu**, lý do `Đã khám chuyên khoa, kết quả khám đợt này bình thường.` | Hộp đóng phiếu có câu *Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường.* Phiếu **Đã đóng** |

## E. Mở lại đợt, hoàn thành phiếu dở, đóng lại

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| E1 | Hiệu trưởng | **Mở lại đợt**, để trống lý do | Lỗi *Nhập lý do mở lại đợt khám* |
| E2 | Hiệu trưởng | Lý do `Hoàn thành phiếu của trẻ đang khám dở.` | Đợt **Đang diễn ra**; Đỗ Gia Bảo về **Chưa khám**; giáo viên nhận thông báo mở lại |
| E3 | Thầy Tuấn | T6 → **Tiếp tục khám** → bước 3 chọn Có, Có / Có, Có, Có → bước 5 Bình thường → **Lưu kết luận** | Nguyễn Bảo Ngọc **Đã có kết luận** |
| E4 | Hiệu trưởng | **Đóng đợt khám** | Chỉ còn 1 trẻ vắng khám, 0 phiếu chưa kết luận |

## F. Cân đo ngoài đợt (không có bác sĩ)

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| F1 | Cô Ngọc | Đỗ Gia Bảo → **Sổ sức khỏe → Nhập cân đo ngoài đợt**: chiều cao `160` | Lỗi *Nhập chiều cao từ 40 đến 150 cm* |
| F2 | Cô Ngọc | Chiều cao `115.2` · cân nặng `19.8` · ghi chú `Cân đo tại lớp.` (không có ô vòng đầu vì trẻ trên 60 tháng) → **Lưu số đo** | *Cân đo, chưa có kết luận bác sĩ*; không mở phiếu theo dõi; mức *Chưa có kết luận bác sĩ* |

## G. Phạm vi xem

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| G1 | Cô Ngọc | Dán đường dẫn phiếu khám của T1 (trẻ lớp thầy Tuấn) | *Không tìm thấy đợt khám* (ngoài phạm vi trả 404) |
| G2 | Phó hiệu trưởng Campus 2 | Mở phiếu của T1 | Chỉ xem, không có nút sửa hay công bố |

## Trường hợp có sẵn ở dữ liệu mẫu (Campus 1)

Ba trường hợp sau phụ thuộc tuổi hoặc ngày nên không dựng trong kịch bản này. Xem ở đợt đang diễn ra của Campus 1 (giáo viên `an.nguyen@carenest.edu.vn`, `mai.tran@carenest.edu.vn`):
- **Câu nguy cơ tự kỷ** (chỉ hỏi trẻ 16–30 tháng): Phạm Gia Khánh, Lớp Mầm 1.
- **Phiếu nháp ở bước Kết luận** với hạ thân nhiệt, mạch thấp, thở chậm, vòng đầu to: Lê Khánh An, Lớp Chồi 2.
- **Nguy cơ lao kèm có vấn đề**, người đi cùng là ông, nhiều mục bất thường: Đỗ Bảo Ngọc, Lớp Chồi 2.

Danh sách đầy đủ: bảng `EXAM_CASES` trong `src/mocks/childrenSeed.js`.

## H. Danh sách trẻ cần theo dõi qua mọi đợt

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| H1 | Hiệu trưởng | **Hồ sơ trẻ → Danh sách trẻ**, bộ lọc **Cần theo dõi** | Chỉ còn trẻ có lần khám gần nhất ở mức Cần theo dõi, ví dụ T2, T7, T10 của kịch bản. Cột **Theo dõi sức khỏe** có nhãn mức và ngày khám (bấm ngày mở Sổ sức khỏe) |
| H2 | Hiệu trưởng | Đổi bộ lọc sang **Cần theo dõi sát** | Có T3, T4, T5, T9 và trẻ có phiếu theo dõi từ đợt trước |
| H3 | Cô Ngọc | Sau bước F (cân đo ngoài đợt cho Đỗ Gia Bảo) xem cột Theo dõi sức khỏe | Mức vẫn theo lần khám có kết luận trước đó: cân đo ngoài đợt và phiếu nháp không tính |
| H4 | Hiệu trưởng | Bộ lọc **Chưa có kết quả khám** | Trẻ chưa có lần khám nào được xếp mức, ví dụ trẻ mới tiếp nhận Lý Gia Phúc |

## I. Hành chính, tiền sử hỏi khi tiếp nhận (Campus 1)

Nghiệp vụ: [plan hồ sơ hành chính, tiền sử](../../plans/completed/2026-10-17-enrollment-admin-medical-history.md). Làm sau bước 0 (khôi phục dữ liệu demo). Tài khoản thêm: Phó hiệu trưởng Campus 1 `lan.nguyen@carenest.edu.vn`, giáo viên Lớp Chồi 1 `minhanh.le@carenest.edu.vn`.

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| I1 | Phó hiệu trưởng Campus 1 | **Hồ sơ trẻ → Tiếp nhận trẻ**. Bước 1 nhập tên, ngày sinh, giới, phụ huynh; để trống khối **Thông tin hành chính**, bấm **Tiếp tục** | Qua bước được (không bắt buộc). Khối hành chính có 10 ô, Sinh non mặc định **Chưa cung cấp** |
| I2 | Phó hiệu trưởng Campus 1 | Quay lại bước 1: số định danh `123`, tuần thai `50`, bấm **Tiếp tục** | *Nhập 12 chữ số (CCCD/mã định danh) hoặc số hộ chiếu 6–12 ký tự* và *Nhập tuần thai từ 20 đến 42*. Sửa thành `031222000888`, sinh non Có, `35` tuần, nhóm máu `O` |
| I3 | Phó hiệu trưởng Campus 1 | Bước Xếp lớp chọn **Lớp Chồi 1**. Bước Khai báo sức khỏe, phần **Tiền sử**: bản thân chọn Có, để trống, bấm **Tiếp tục** | Ba mục mặc định **Chưa cung cấp**. Lỗi *Ghi rõ tên bệnh*. Nhập `Viêm phổi lúc 1 tuổi` |
| I4 | Phó hiệu trưởng Campus 1 | Tiếp xúc với người bệnh lao chọn **Có** | Hiện ghi chú: khi lưu, hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp |
| I5 | Phó hiệu trưởng Campus 1 | Bước Xem lại, rồi **Lưu hồ sơ tiếp nhận** | Thẻ Thông tin trẻ có mục Thông tin hành chính (số định danh, *Có · 35 tuần*, nhóm máu O). Thẻ Khai báo sức khỏe có 3 dòng tiền sử, ví dụ *Có — Viêm phổi lúc 1 tuổi* |
| I6 | Hiệu trưởng, cô Minh Anh | Mở chuông thông báo | Có *Trẻ có tiền sử tiếp xúc với người bệnh lao*: *Phụ huynh khai … có tiền sử tiếp xúc với người bệnh lao. Nhà trường trao đổi với phụ huynh về việc đưa trẻ đi khám sàng lọc; bác sĩ xem lại ở đợt khám tới.* Phó hiệu trưởng Campus 1 (người lưu) và Phó hiệu trưởng Campus 2 không nhận |
| I7 | Hiệu trưởng | **Danh sách trẻ**, xem nhanh trẻ vừa nhận | Không có số định danh hay tiền sử tiếp xúc lao trong danh sách |
| I8 | Hiệu trưởng | Mở hồ sơ trẻ vừa nhận | Thẻ **Thông tin hành chính**; cột Sức khỏe có 3 dòng tiền sử |
| I9 | Phó hiệu trưởng Campus 1 | **Khai báo sức khỏe → Sửa khai báo**: tiếp xúc lao Không, lưu (lý do); rồi sửa lại Có, lưu; rồi chỉ đổi Thông tin khác, lưu | Lần chuyển sang Có báo lại Hiệu trưởng và cô Minh Anh; lần lưu khi vẫn Có không báo. Lịch sử thay đổi ghi *Tiền sử tiếp xúc với người bệnh lao: Không → Có* |
| I10 | Phó hiệu trưởng Campus 1 | **Nhập từ Excel → Tải file mẫu** | File có thêm 13 cột hành chính, tiền sử. Thêm 1 dòng có số định danh `12ab`, Sinh non `Chắc chắn`: xem trước báo lỗi đúng dòng. File mẫu cũ (9 cột) vẫn nhập được |
| I11 | Cô Minh Anh | Đợt khám Campus 1 → Lớp Chồi 1 → **Khám** Trần Khánh An | Bước 1 có ghi chú *điền sẵn từ hồ sơ trẻ*. Số định danh `999222009007`, sinh non Có 35 tuần, nhóm máu A, nơi ở Số 12 ngõ 5; tiền sử bản thân Có *Hen phế quản*, gia đình Không, tiếp xúc lao Không |
| I12 | Cô Minh Anh | **Khám** Bùi Bảo Ngọc | Hồ sơ thiếu: dân tộc Kinh, nhóm máu O; số định danh trống; tiền sử gia đình trống (Chưa cung cấp); tiếp xúc lao **Có** |
| I13 | Cô Minh Anh | Trần Khánh An: đổi nhóm máu `AB`, bấm **Lưu nháp** | Hồ sơ trẻ vẫn nhóm máu A (phiếu nháp không cập nhật) |
| I14 | Cô Minh Anh | Tiền sử gia đình Có `Tăng huyết áp (bà ngoại)`, điền đủ phiếu, **Lưu kết luận** | Hồ sơ trẻ: nhóm máu AB, dòng *Cập nhật gần nhất: Cập nhật từ phiếu khám ngày …*. Khai báo sức khỏe: lịch sử *Cập nhật tiền sử từ phiếu khám*, *Tiền sử gia đình: Không → Có — Tăng huyết áp (bà ngoại)*. Không có thông báo tiếp xúc lao mới |
| I15 | Hiệu trưởng | Mở hồ sơ Nguyễn Hoàng Nam (trẻ tiếp nhận từ trước) | Thông tin hành chính *Chưa cung cấp*; tiền sử *Chưa cung cấp*. Ở mục B, T1 vẫn điền sẵn từ phiếu 6/10 vì hồ sơ trống |
