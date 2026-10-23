# Kịch bản thử tay — Đợt khám và phiếu Phụ lục II (từ tạo đợt tới đóng đợt)

Mục đích: đi hết luồng **Hiệu trưởng tạo đợt → giáo viên nhập phiếu cùng bác sĩ → theo dõi sau khám → đóng, mở lại đợt** bằng bộ số cố định. Mỗi trẻ ứng với 1 trường hợp, gồm cả số ở ngưỡng, số sai và quyết định của bác sĩ khác gợi ý của hệ thống. Kết quả mong đợi đã kiểm bằng kịch bản tự động (backend giả) ngày 2026-10-17.

Nghiệp vụ: [plan phiếu khám Phụ lục II](../../plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md), [plan khám trẻ đang có phiếu theo dõi, đóng phiếu có kết quả](../../plans/completed/2026-10-21-health-follow-up-close-outcome.md). Dữ liệu là dữ liệu giả. Kết quả mong đợi của các bước có ghi "phiếu theo dõi", "đóng phiếu", "vấn đề đã biết" kiểm bằng `tests/health/follow-up-exam.test.mjs` ngày 2026-10-21; các bước giao diện chưa chạy trên trình duyệt.

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

Mở đợt → danh sách trẻ của lớp hiện ngay dưới phần thông tin đợt (màn giáo viên không có hàng thẻ tiến độ và bảng tiến độ theo lớp) → bấm **Khám** cạnh tên trẻ. Phiếu có 5 bước: **1 Hành chính, tiền sử · 2 Sinh tồn, dinh dưỡng · 3 Phát triển, tiêm chủng · 4 Khám lâm sàng · 5 Kết luận**.

**Mặc định, trừ khi bảng ghi khác:**
- Bước 1: hành chính chỉ xem (lấy từ hồ sơ trẻ). Giữ người đi cùng hệ thống chọn sẵn (phụ huynh đầu tiên của hồ sơ). Tiền sử giữ bản điền sẵn từ khai báo sức khỏe (dữ liệu demo: Không).
- Bước 2: tình trạng dinh dưỡng chọn Bình thường.
- Bước 3: phần IV chọn Có, Có; phần V chọn Có, Có, Có.
- Bước 4: giữ nguyên các lựa chọn chọn sẵn.
- Bước 5: kết luận Bình thường; hướng xử lý "Không cần tư vấn hay chuyển khám"; bác sĩ kết luận `BS. Đỗ Minh Khôi`.

**Hỏi lại trước khi lưu:** bác sĩ không chuyển khám (và không có nguy cơ lao) mà khối "Điểm cần bác sĩ xem lại" còn mục nào, thì bấm **Lưu kết luận** sẽ hiện hộp **"Bác sĩ vẫn kết luận như vậy?"** liệt kê các điểm. Bấm **Quay lại xem** để xem lại, hoặc **Lưu theo bác sĩ** để lưu. Hộp không chặn việc lưu.

**Gợi ý gộp sinh tồn:** 1/3 chỉ số (nhiệt độ, mạch, nhịp thở) ngoài khoảng ⇒ dòng vàng *Gợi ý: cần theo dõi*; từ 2/3 ⇒ dòng đỏ *Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận*.

**Công bố (2026-10-23):** mọi kết quả tự công bố cho phụ huynh khi lưu (phiếu khám: **Lưu kết luận**, kể cả lưu lại sau sửa; cân đo ngoài đợt: **Lưu số đo**); không còn nút **Công bố**. Kết luận mức *Cần theo dõi sát* có người đi cùng thì bước 5 bắt buộc ô **Ý kiến phụ huynh**; phiếu ghi **Đã trao đổi phụ huynh**. Không có người đi cùng (T4) thì phiếu ghi **Chưa trao đổi phụ huynh** tới khi giáo viên ghi trao đổi trong phiếu theo dõi.

**Trẻ đang có phiếu theo dõi (T1, T3, T9)** (user chốt 2026-10-21): bước 5 có khối *Trẻ đang có phiếu theo dõi từ ngày …*. Thay cho 2 nhóm "Kết luận về sức khỏe" và "Cần được tư vấn/chuyển khám chuyên khoa" là 1 câu **So với vấn đề đang theo dõi, bác sĩ kết luận**: *Chưa ghi nhận thêm bất thường* · *Tư vấn* · *Có thêm bất thường mới*. Lưu kết luận không đóng phiếu theo dõi.

**Có vấn đề mà không chuyển khám (T2, T7, T10):** sau khi chọn hướng xử lý, chọn thêm **Vấn đề này**: *Vấn đề mới hoặc có thay đổi* (mức Cần theo dõi) hoặc *Vấn đề đã biết, không thay đổi so với trước* (mức Vấn đề đã biết, ổn định). Câu này không chọn sẵn.

Khi nhập số ở bước 2, trạng thái tự chọn theo khoảng của nhóm tuổi; trừ khi bảng ghi khác, giữ trạng thái hệ thống chọn. Khoảng tham khảo của trẻ 3–5 tuổi: mạch 80–120, nhịp thở 20–28 lần/phút. Nhiệt độ: sốt từ 37,5 °C, hạ thân nhiệt dưới 36 °C.

### Lớp Mầm 1 — `tuan.hoang@carenest.edu.vn`

**T1 · Vũ Tuấn Kiệt (40 tháng) — Đang có phiếu theo dõi, "Chưa ghi nhận thêm bất thường", số ở cận trên**
- Bước 1: số định danh, địa chỉ lấy từ hồ sơ trẻ, chỉ xem; tiền sử điền sẵn từ khai báo sức khỏe.
- Bước 2: nhiệt độ `37.4` · mạch `120` · nhịp thở `28` · chiều cao `98.5` · cân nặng `15.2` · vòng đầu `48.5` · vòng cánh tay `160`. Cả 3 trạng thái là **Bình thường**. Vòng đầu tự chọn Bình thường (khoảng tạm 46,5–52,0 cm).
- Bước 5:
  - Thấy khối *Trẻ đang có phiếu theo dõi* (Tai mũi họng, kết quả chuyên khoa ngày 14/10, hẹn khám lại 14/11) và *Không có mục nào được ghi bất thường*.
  - Không có ô "Bình thường". Chọn **Chưa ghi nhận thêm bất thường**, để trống **Ý kiến phụ huynh**, bấm **Lưu kết luận** ⇒ lỗi *Ghi ý kiến của phụ huynh (người đi cùng) về kết luận*. Nhập `Mẹ cho biết trẻ vẫn tái khám theo hẹn.` rồi lưu lại.
- Mong đợi:
  - Nhãn **Đang theo dõi, chưa ghi nhận thêm**; không có nhãn "Cần theo dõi sát – đề nghị khám chuyên khoa".
  - Màn kết quả: *Phiếu theo dõi giữ nguyên: lần khám được ghi vào dòng thời gian của phiếu, không mở vòng mới.*
  - Bước 5 có dòng *Lưu kết luận là công bố cho phụ huynh ngay*. Sau khi lưu, phiếu **Đã công bố** và **Đã trao đổi phụ huynh**; phần Kết luận có *Ý kiến phụ huynh*.
  - Phiếu theo dõi Tai mũi họng vẫn mở, giữ trạng thái *Đã có kết quả khám bên ngoài*; dòng thời gian có *Kết quả khám trong lúc đang theo dõi*. Lưu kết luận không đóng phiếu (đóng ở bước C5).

**T2 · Đỗ Phương Linh (34 tháng) — Khoảng tham khảo đổi theo tuổi**
- Bước 2: thấy *Khoảng tham khảo của trẻ 12–35 tháng: 98–140 lần/phút* và *22–37 lần/phút*.
  - Nhập nhiệt độ `37.0` · mạch `135` · nhịp thở `30` · chiều cao `93.0` · cân nặng `12.4` · vòng đầu `47.0`.
  - Mạch và nhịp thở vẫn **Bình thường**. Với trẻ 3–5 tuổi, 2 số này sẽ là Nhanh và Thở nhanh.
  - Tình trạng dinh dưỡng: chọn **Dấu hiệu thiếu máu** (không chọn Bình thường).
- Bước 4: Lòng bàn tay → **Không bình thường (nhợt)**.
- Bước 5:
  - Chọn **Có vấn đề về sức khỏe** (nếu đã tích Bình thường, ô đó tự bỏ), ghi rõ `Lòng bàn tay nhợt, có dấu hiệu thiếu máu.`
  - Chọn **Tư vấn**, lời tư vấn `Bổ sung thực phẩm giàu sắt; đưa trẻ đi khám nếu mệt, xanh xao.`
  - Bấm **Lưu kết luận** khi chưa chọn **Vấn đề này** → lỗi *Chọn vấn đề mới hay vấn đề đã biết*. Chọn **Vấn đề mới hoặc có thay đổi**.
- Mong đợi:
  - Điểm cần xem lại không có dòng sinh tồn. Có 2 mục: *Tình trạng dinh dưỡng: Dấu hiệu thiếu máu*, *Lòng bàn tay: Không bình thường (nhợt)*.
  - Bấm **Lưu kết luận**: hiện hộp hỏi lại với 2 điểm trên (bác sĩ chỉ tư vấn) → bấm **Lưu theo bác sĩ**.
  - Sau khi lưu: **Có vấn đề, tư vấn**, mức **Cần theo dõi**, không mở phiếu theo dõi.

**T3 · Trần Đăng Khoa (42 tháng) — Đang có phiếu theo dõi, "Có thêm bất thường mới" (gợi ý 2 dấu hiệu)**
- Danh sách lớp: trẻ có link *Đang có phiếu theo dõi* (đã trao đổi ngày 16/9, đã được nhắc sau 30 ngày).
- Bước 2: `36.9` · `105` · `24` · chiều cao `97.0` · cân nặng `14.6` · vòng đầu `46.0`. Vòng đầu tự chọn **Đầu nhỏ** (khoảng tạm 46,6–52,1).
- Bước 3: Phát triển vận động → **Không**.
- Bước 5:
  - Thấy khối *Trẻ đang có phiếu theo dõi* và gợi ý **Gợi ý: cân nhắc chuyển khám chuyên khoa — 2/3 dấu hiệu**.
  - Chọn **Có thêm bất thường mới**, ghi rõ `Vòng đầu nhỏ, vận động chưa theo kịp độ tuổi.`
  - Chuyên khoa bác sĩ đề nghị `Nhi khoa – khám phát triển`, lời tư vấn `Đưa trẻ đi khám trong tháng này.`
- Mong đợi:
  - Nhãn **Đang theo dõi, có bất thường mới**. Bấm lưu không hiện hộp hỏi lại (đã ghi bất thường mới).
  - Màn kết quả: *Phiếu theo dõi sang vòng mới và đã ghi lần trao đổi tại buổi khám.*
  - Mở phiếu theo dõi: **vẫn là phiếu cũ**, không có phiếu thứ hai. Dòng thời gian có *Kết quả khám mới … – bắt đầu vòng theo dõi mới* và lần trao đổi *tại buổi khám*. Trạng thái **Đã trao đổi, đề nghị khám chuyên khoa**.
  - Hiệu trưởng, Phó hiệu trưởng Campus 2 nhận thông báo *Trẻ có thêm bất thường mới*.

**T4 · Hoàng Khánh An (37 tháng) — Chuyển khám, KHÔNG có người đi cùng**
- Bước 1: chọn **Không có người đi cùng**.
- Bước 2: `36.7` · `110` · `26` · chiều cao `96.0` · cân nặng `14.0` · vòng đầu `52.3`. Vòng đầu tự chọn **Đầu to** (khoảng tạm 46,3–51,8).
- Bước 5:
  - Gợi ý chỉ là *cần theo dõi* (1/3 dấu hiệu).
  - Bác sĩ vẫn đề nghị chuyển khám: chọn **Có vấn đề**, ghi rõ `Vòng đầu to so với tuổi.`; **Chuyển khám chuyên khoa** `Nhi khoa – thần kinh`.
- Mong đợi:
  - Mức **Cần theo dõi sát**, theo kết luận bác sĩ, không theo gợi ý.
  - Bước 5 không có ô Ý kiến phụ huynh (không có người đi cùng). Phiếu vẫn **tự công bố** khi lưu.
  - Màn kết quả có cảnh báo vàng: phiếu ghi *Chưa trao đổi phụ huynh*, trao đổi với phụ huynh rồi ghi vào phiếu theo dõi. Không có nút Công bố.
  - Phiếu theo dõi mới ở trạng thái **Chờ trao đổi phụ huynh**, hạn = hôm nay + 7.

**T5 · Bùi Gia Bảo (44 tháng) — Nguy cơ lao, tiền sử giáo viên ghi ở phiếu**
- Bước 1:
  - Người đi cùng là phụ huynh trong hồ sơ (không gõ tay người khác được).
  - Tiền sử gia đình **Có**: `Ông nội đang điều trị lao`. Tiền sử tiếp xúc với người bệnh lao **Có**, ngày tiếp xúc gần nhất `01/10/2026`.
- Bước 2: `37.1` · `112` · `27` · chiều cao `99.0` · cân nặng `15.0` · vòng đầu `49.5`.
- Bước 5:
  - Chọn **Có nguy cơ mắc lao (tiền sử tiếp xúc)** (không chọn Bình thường).
  - **Chuyển khám chuyên khoa** `Lao và bệnh phổi – Trung tâm Y tế`, lời tư vấn `Đưa trẻ đi khám sàng lọc lao trong tuần.`; ý kiến phụ huynh `Gia đình đồng ý đưa trẻ đi khám trong tuần.`
- Mong đợi:
  - Điểm cần xem lại có *Tiền sử gia đình: Có (Ông nội đang điều trị lao)* và *Tiền sử tiếp xúc với người bệnh lao: Có*.
  - Sau khi lưu: nhãn **Nguy cơ lao**, khung đỏ báo đã gửi thông báo.
  - Khai báo sức khỏe của trẻ: tiền sử gia đình *Có — Ông nội đang điều trị lao*, tiếp xúc lao *Có — gần nhất ngày 01/10/2026*; lịch sử *Cập nhật tiền sử từ phiếu khám*.
  - Đăng nhập Hiệu trưởng và Phó hiệu trưởng Campus 2: chuông có *Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)*.
  - Phiếu theo dõi có nhãn đỏ nguy cơ lao; lần trao đổi ghi *Bùi Thị Tám (Ông/bà)* kèm *Ý kiến phụ huynh: Gia đình đồng ý…*.
  - Danh sách lớp không hiện số CCCD.

**T6 · Nguyễn Bảo Ngọc (38 tháng) — Phiếu khám dở**
- Bước 2: `36.8` · `100` · `25` · `97.5` · `14.4` · `49.0`.
- Đi tới bước 4, bấm **Lưu nháp**, rồi **Về đợt khám**.
- Mong đợi:
  - Danh sách lớp hiện **Đang khám** và nút **Tiếp tục khám**. Mở lại thì phiếu mở đúng bước 4.
  - Phiếu không hiện ở Sổ sức khỏe.

### Lớp Lá A — `ngoc.vu@carenest.edu.vn`

**T7 · Phạm Thảo Vy (58 tháng) — Thừa cân, chỉ số SD, ghi rõ hành vi; sau đó sửa phiếu**
- Trước khi khám, danh sách trẻ hiện **Vấn đề đã biết, ổn định · Bàn chân bẹt – mang giày chỉnh hình** (phiếu theo dõi đã đóng ngày 5/10 với kết quả "Chuyên khoa xác định có vấn đề"). Bước 1 có tiền sử bản thân *Có — Bàn chân bẹt – mang giày chỉnh hình*.
- Bước 2:
  - `36.6` · `98` · `22` · chiều cao `106.0` · chiều dài/tuổi `0.5` · cân nặng `24.5` · cân nặng/tuổi `2.3` · vòng đầu `50.0` · vòng cánh tay `210`.
  - Tình trạng dinh dưỡng: **Thừa cân/béo phì**.
- Bước 4: *Có biểu hiện buồn bã, lo âu, mất ngủ kéo dài không* → **Có**. Ô *Nếu có, ghi rõ* thành bắt buộc: `Gần đây trẻ khó ngủ, hay lo khi xa mẹ (người đi cùng kể).`
- Bước 5: **Có vấn đề** `Thừa cân; khó ngủ kéo dài.` · **Tư vấn** `Giảm đồ ngọt, tăng vận động; giữ giờ ngủ cố định.` · **Vấn đề mới hoặc có thay đổi**.
- Mong đợi: bấm **Lưu kết luận** hiện hộp hỏi lại (thừa cân, buồn bã kéo dài, ghi rõ) → **Lưu theo bác sĩ**. Mức **Cần theo dõi**, phiếu tự công bố. Danh sách trẻ đổi sang **Cần theo dõi** (lần khám mới hơn phiếu đã đóng).
- Thử sửa phiếu (từ màn kết quả bấm **Xem phiếu**):
  1. Bấm **Sửa phiếu**, ở bước 2 đổi cân nặng thành `24.1`.
  2. Ở bước 5 bấm **Lưu kết luận** khi chưa ghi lý do → lỗi *Nhập lý do sửa phiếu đã có kết luận*.
  3. Ghi lý do `Cân lại sau khi trẻ cởi áo khoác.` rồi lưu.
- Mong đợi sau khi sửa: **Lịch sử sửa phiếu** có *Cân nặng (kg): 24,5 → 24,1*. Phiếu **tự công bố lại** khi lưu.

**T8 · Đặng Tuấn Kiệt (65 tháng) — Trên 60 tháng, số ở cận dưới**
- Bước 2: không có ô vòng đầu (*Trẻ trên 60 tháng tuổi tại ngày khám: không đo vòng đầu*).
  - Nhập `36.0` · `80` · `20` · chiều cao `110.0` · cân nặng `18.5`. Cả 3 trạng thái là **Bình thường**.
- Mong đợi: không có điểm cần xem lại; gợi ý kết hợp chỉ xét 2 dấu hiệu phát triển; phiếu tự công bố.

**T9 · Ngô Phương Linh (60 tháng) — Đang có phiếu quá hạn, "Có thêm bất thường mới", số ngay dưới ngưỡng**
- Danh sách lớp: trẻ có phiếu theo dõi đỏ *Quá hạn*.
- Bước 2: nhiệt độ `35.9` → **Hạ thân nhiệt** · mạch `79` → vẫn **Bình thường** · nhịp thở `19` → **Thở chậm** · `107.0` · `17.2` · vòng đầu `50.0`.
  - Dưới ô trạng thái mạch có ghi chú: thấp hơn khoảng tham khảo; mẫu không có ô "chậm".
- Bước 4: Mí mắt và kết mạc → **Chảy ghèn/mủ**.
- Bước 5: thấy khối *Trẻ đang có phiếu theo dõi* có nhãn quá hạn. Chọn **Có thêm bất thường mới** `Mắt chảy ghèn; thân nhiệt thấp khi khám.` · chuyên khoa `Mắt`.
- Mong đợi:
  - Điểm cần xem lại có 3 dòng: *Nhiệt độ 35,9 °C: hạ thân nhiệt (dưới 36 °C)*, *Mạch 79 lần/phút, dưới khoảng tham khảo 80–120 của trẻ 3–5 tuổi*, *Nhịp thở 19 lần/phút, dưới khoảng tham khảo 20–28 của trẻ 3–5 tuổi*.
  - Dưới 3 dòng sinh tồn có dòng đỏ *Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận — 3/3*. Đã ghi bất thường mới nên **không** có hộp hỏi lại.
  - Phiếu theo dõi cũ **không** mở vòng mới: kết quả gộp vào vòng đang chờ (*Kết quả được ghi vào vòng theo dõi hiện tại…*). Có lần trao đổi tại buổi khám nên **hết Quá hạn**, trạng thái **Đã trao đổi**.

**T10 · Lê Đăng Khoa (66 tháng) — Gợi ý mạnh nhưng bác sĩ chỉ tư vấn**
- Bước 2: `36.8` · `95` · `23` · `112.0` · `19.0`.
- Bước 3: phát triển tinh thần **Không**, phát triển vận động **Không**.
- Bước 5:
  - Thấy **Gợi ý: cân nhắc chuyển khám chuyên khoa — 2/2 dấu hiệu**.
  - Bác sĩ chỉ tư vấn: **Có vấn đề** `Chậm hơn bạn cùng tuổi về ngôn ngữ và vận động.` · **Tư vấn** `Theo dõi thêm 3 tháng, tăng hoạt động vận động ở lớp.` · **Vấn đề mới hoặc có thay đổi**.
- Mong đợi: bấm **Lưu kết luận** hiện hộp hỏi lại (gợi ý cân nhắc chuyển khám) → **Lưu theo bác sĩ**. Mức **Cần theo dõi**, không mở phiếu theo dõi. Gợi ý không phải quyết định.

**T11 · Vũ Khánh An (62 tháng) — Nhập sai, số ngay trên ngưỡng, bác sĩ chọn khác gợi ý**

Lần 1, nhập sai rồi bấm **Lưu kết luận** ở bước 5:

| Bước | Nhập | Lỗi mong đợi |
| --- | --- | --- |
| 2 | Nhiệt độ `43` | *Nhập nhiệt độ từ 34 đến 42 °C* |
| 2 | Mạch `250` | *Nhập mạch từ 40 đến 220 lần/phút* |
| 2 | Chiều cao `160` · cân nặng `2` | *Nhập chiều cao/chiều dài từ 40 đến 150 cm* · *Nhập cân nặng từ 3 đến 60 kg* |
| 2 | Chiều dài/tuổi `7` · vòng cánh tay `40` | *Nhập chiều dài/tuổi (SD) từ -6 đến 6* · *Nhập chu vi vòng cánh tay từ 50 đến 300 mm* |
| 2 | Tích **Suy dinh dưỡng** rồi tích **Bình thường** | Ô Suy dinh dưỡng tự bỏ tích: "Bình thường" không chọn cùng mục khác |
| 3 | Để trống *Tiêm chủng đầy đủ…* | *Chọn Có hoặc Không* |
| 5 | Bỏ tích kết luận · chọn **Tư vấn** nhưng để trống lời tư vấn · xóa tên bác sĩ | *Chọn kết luận của bác sĩ* · *Ghi lời tư vấn của bác sĩ* · *Nhập họ tên bác sĩ kết luận* |

Mong đợi: thông báo *Phiếu còn thiếu thông tin*. Phiếu nhảy về **bước 2** (bước đầu tiên có lỗi; bước 1 không còn ô nhập hành chính), ô lỗi viền đỏ. Sửa ô nào thì lỗi ô đó mất.

Lần 2, sửa cho đúng:
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
| D1 | Mở đợt, xem thống kê | Đã có kết luận 10 · Đang khám 1 · Chưa khám 1. Không có khối "Theo kết luận của bác sĩ". Tab **Trẻ cần theo dõi**: 8 trẻ |
| D2 | **Đóng đợt khám** | Hộp xác nhận: *1 trẻ chưa khám sẽ ghi Vắng khám. 1 phiếu đang khám chưa có kết luận sẽ giữ nguyên, hiện "Chưa kết luận". Còn 1 phiếu theo dõi chờ trao đổi với phụ huynh…* (của T4) |
| D3 | Xác nhận | *Đã đóng đợt khám; 1 trẻ ghi vắng khám; 1 phiếu chưa kết luận.* Lớp Lá A: Đỗ Gia Bảo **Vắng khám**. Lớp Mầm 1: Nguyễn Bảo Ngọc **Chưa kết luận** |
| D4 | Giáo viên mở lại phiếu T7 | Có thông báo đợt đã đóng, phiếu bị khóa; không có nút **Sửa phiếu** |

## C. Theo dõi sau khám (vẫn làm được khi đợt đã đóng)

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| C1 | Thầy Tuấn | Mở phiếu theo dõi của T4 | Nút **Ghi kết quả khám chuyên khoa** mờ: phải ghi trao đổi trước |
| C2 | Thầy Tuấn | **Ghi trao đổi với phụ huynh**: ngày hôm nay, `Đã gọi điện cho bố, đề nghị đưa trẻ khám thần kinh nhi.` | Trạng thái **Đã trao đổi**. Phiếu khám của T4 đổi từ *Chưa trao đổi phụ huynh* sang **Đã trao đổi phụ huynh**, kèm ngày trao đổi |
| C3 | Thầy Tuấn | Phiếu theo dõi của T3 → **Ghi kết quả khám chuyên khoa**: để trống chuyên khoa · chọn ngày hẹn = ngày khám | Lỗi *Nhập chuyên khoa / nơi khám, ví dụ Mắt — Bệnh viện Nhi* · *Ngày hẹn khám lại phải sau ngày khám* |
| C4 | Thầy Tuấn | Nhập đúng: ngày hôm nay · `Nhi khoa – khám phát triển, Bệnh viện Nhi Hải Phòng` · `Bác sĩ hẹn đánh giá lại sau 1 tháng, tập vận động tại nhà.` · hẹn hôm nay + 30 · thêm 1 ảnh bất kỳ (không dùng giấy khám thật) | Trạng thái **Đã có kết quả khám bên ngoài**. Sổ sức khỏe của T3 hiện kết quả chuyên khoa kèm chuyên khoa và ảnh |
| C5 | Cô Ngọc | Phiếu theo dõi của T9 → **Ghi kết quả khám chuyên khoa**: ngày hôm nay · `Mắt – Bệnh viện Mắt Hải Phòng` · `Bác sĩ kết luận viêm kết mạc, đã tra thuốc khỏi; không hẹn khám lại.` · để trống ngày hẹn | Lưu xong, hộp **Đóng phiếu theo dõi?** mở ngay (*Kết quả không có ngày hẹn khám lại…*), có nút **Để phiếu mở** |
| C6 | Cô Ngọc | Trong hộp đó bấm **Đóng phiếu** khi chưa chọn kết quả, rồi chọn **Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường)**, lý do `Đã khám chuyên khoa Mắt, trẻ đã khỏi.` | Lỗi *Chọn kết quả theo lời bác sĩ*. Sau khi đóng: thẻ **Đóng phiếu** có *Kết quả: Bác sĩ kết luận bình thường…*; hộp có câu *Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường.* Danh sách trẻ: T9 **Không ghi nhận bất thường** · *Theo kết quả chuyên khoa …* |
| C7 | Thầy Tuấn | Phiếu Tai mũi họng của T1 → **Ghi kết quả khám chuyên khoa** (lần khám lại): ngày hôm nay · `Tai mũi họng – Bệnh viện Trẻ em Hải Phòng` · `Bác sĩ kết luận nghe kém nhẹ tai phải, không cần điều trị; theo dõi tại nhà, không hẹn khám lại.` · để trống ngày hẹn | Hộp **Đóng phiếu theo dõi?** mở ngay |
| C8 | Thầy Tuấn | Chọn **Chuyên khoa xác định có vấn đề, đã có hướng điều trị**, để trống tên vấn đề, bấm **Đóng phiếu**; rồi nhập `Nghe kém nhẹ tai phải – theo dõi tại nhà`, lý do `Đã khám lại chuyên khoa, không còn lịch khám.` | Lỗi *Nhập tên vấn đề, ví dụ Cận thị – đeo kính*. Sau khi đóng: **Khai báo sức khỏe** của T1 có tiền sử bản thân *Có — Nghe kém nhẹ tai phải – theo dõi tại nhà*, lịch sử *Cập nhật tiền sử từ phiếu theo dõi*. Danh sách trẻ: T1 **Vấn đề đã biết, ổn định** (nhãn thông tin, không phải cảnh báo) kèm tên vấn đề |
| C9 | Thầy Tuấn | Phiếu theo dõi của T4 → **Đóng phiếu** | Chỉ chọn được **Không có kết quả chuyên khoa**; có dòng giải thích phải ghi kết quả khám chuyên khoa trước. Bấm **Quay lại**, không đóng |

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
| G2 | Phó hiệu trưởng Campus 2 | Mở phiếu của T1 | Chỉ xem, không có nút sửa |

## Trường hợp có sẵn ở dữ liệu mẫu (Campus 1)

Các trường hợp sau phụ thuộc tuổi hoặc ngày nên không dựng trong kịch bản này. Xem ở đợt đang diễn ra của Campus 1 (giáo viên `an.nguyen@carenest.edu.vn`, `mai.tran@carenest.edu.vn`, `hoa.le@carenest.edu.vn`, `minhanh.le@carenest.edu.vn`):
- **Câu nguy cơ tự kỷ** (chỉ hỏi trẻ 16–30 tháng): Phạm Gia Khánh, Lớp Mầm 1.
- **Phiếu nháp ở bước Kết luận** với hạ thân nhiệt, mạch thấp, thở chậm, vòng đầu to: Lê Khánh An, Lớp Chồi 2.
- **Nguy cơ lao kèm có vấn đề**, người đi cùng là ông, nhiều mục bất thường: Đỗ Bảo Ngọc, Lớp Chồi 2.
- **Trẻ có phiếu theo dõi, chưa khám đợt này** (khám từ đầu bằng mẫu *So với vấn đề đang theo dõi*): Phạm Thảo Vy, Lớp Chồi 1.
- **"Chưa ghi nhận thêm bất thường"**: phiếu giữ nguyên (có kết quả chuyên khoa, hẹn khám lại): Bùi Phương Linh, Lớp Lá 1.
- **"Có thêm bất thường mới", không có người đi cùng**: vòng mới, chờ trao đổi; phiếu đã công bố, ghi *Chưa trao đổi phụ huynh*: Ngô Hoàng Nam, Lớp Mầm 1.
- **Vấn đề đã biết, không thay đổi** (cận thị đang đeo kính): mức **Vấn đề đã biết, ổn định**, không có trong tab *Trẻ cần theo dõi*: Ngô Bảo Ngọc, Lớp Lá 1.

Danh sách đầy đủ: bảng `EXAM_CASES` trong `src/mocks/childrenSeed.js`.

## H. Danh sách trẻ cần theo dõi qua mọi đợt

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| H1 | Hiệu trưởng | **Hồ sơ trẻ → Danh sách trẻ**, bộ lọc **Cần theo dõi** | Chỉ còn trẻ có lần khám gần nhất ở mức Cần theo dõi, ví dụ T2, T7, T10 của kịch bản. Cột **Theo dõi sức khỏe** có nhãn mức và ngày khám (bấm ngày mở Sổ sức khỏe) |
| H2 | Hiệu trưởng | Đổi bộ lọc sang **Cần theo dõi sát** | Có T3, T4, T5 và trẻ còn phiếu theo dõi mở (dòng *Đang có phiếu theo dõi*). T1, T9 không còn: đã đóng phiếu ở bước C |
| H2b | Hiệu trưởng | Đổi bộ lọc sang **Vấn đề đã biết, ổn định** | Có T1 (*Nghe kém nhẹ tai phải – theo dõi tại nhà* · *Theo kết quả chuyên khoa …*) và Ngô Bảo Ngọc, Lớp Lá 1 (cận thị, theo lần khám) |
| H3 | Cô Ngọc | Sau bước F (cân đo ngoài đợt cho Đỗ Gia Bảo) xem cột Theo dõi sức khỏe | Mức vẫn theo lần khám có kết luận trước đó: cân đo ngoài đợt và phiếu nháp không tính |
| H4 | Hiệu trưởng | Bộ lọc **Chưa có kết quả khám** | Trẻ chưa có lần khám nào được xếp mức, ví dụ trẻ mới tiếp nhận Lý Gia Phúc |

## I. Hành chính, tiền sử nhập khi tiếp nhận; phiếu khám chỉ xem hành chính (Campus 1)

Nghiệp vụ: [plan hồ sơ hành chính, tiền sử](../../plans/completed/2026-10-17-enrollment-admin-medical-history.md), thay một phần bởi [plan phiếu khám chỉ xem Phần I](../../plans/completed/2026-10-22-exam-admin-from-profile.md). Làm sau bước 0 (khôi phục dữ liệu demo). Tài khoản thêm: Phó hiệu trưởng Campus 1 `lan.nguyen@carenest.edu.vn`, giáo viên Lớp Chồi 1 `minhanh.le@carenest.edu.vn`.

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| I1 | Phó hiệu trưởng Campus 1 | **Hồ sơ trẻ → Tiếp nhận trẻ**. Bước 1 nhập tên, ngày sinh, giới, phụ huynh; để trống khối **Thông tin hành chính**, bấm **Tiếp tục** | Không qua được. Lỗi *Chọn trẻ có sinh non hay không*, *Nhập dân tộc*, *Nhập đối tượng*, *Nhập nguồn chi trả*, *Nhập tỉnh/thành nơi ở*, *Nhập phường/xã nơi ở*, *Nhập số nhà/thôn/xóm nơi ở*. Số định danh và nhóm máu không báo lỗi. Sinh non chỉ có Không/Có |
| I2 | Phó hiệu trưởng Campus 1 | Số định danh `123`, sinh non **Có**, để trống tuần thai, bấm **Tiếp tục**; rồi tuần thai `50` | *Nhập 12 chữ số (CCCD/mã định danh) hoặc số hộ chiếu 6–12 ký tự*, *Nhập tuần thai khi sinh của trẻ sinh non*, rồi *Nhập tuần thai từ 20 đến 42*. Sửa thành `999222000888`, `35` tuần, dân tộc `Kinh`, đối tượng `Trẻ em dưới 6 tuổi`, nguồn chi trả `BHYT`, nhóm máu `O`, nơi ở `Hải Phòng` · `Phường Thượng Hồng` · `Số 5 ngõ 2` |
| I3 | Phó hiệu trưởng Campus 1 | Bước Xếp lớp chọn **Lớp Chồi 1**. Bước Khai báo sức khỏe, phần **Tiền sử**: không chọn gì, bấm **Tiếp tục**; rồi bản thân chọn Có, để trống | Ba mục chỉ có Có/Không, chưa chọn sẵn. Lỗi *Chọn Có hoặc Không cho tiền sử bản thân*, *… cho tiền sử gia đình*, *Tiếp xúc người bệnh lao chọn Có hoặc Không*. Rồi *Ghi rõ tên bệnh*. Nhập `Viêm phổi lúc 1 tuổi`, gia đình Không |
| I4 | Phó hiệu trưởng Campus 1 | Tiếp xúc với người bệnh lao chọn **Có**, ngày tiếp xúc gần nhất `15/09/2026` | Hiện ghi chú: khi lưu, hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp |
| I5 | Phó hiệu trưởng Campus 1 | Bước Xem lại, rồi **Lưu hồ sơ tiếp nhận** | Thẻ Thông tin trẻ có mục Thông tin hành chính (số định danh, *Có · 35 tuần*, nhóm máu O). Thẻ Khai báo sức khỏe có 3 dòng tiền sử, ví dụ *Có — Viêm phổi lúc 1 tuổi* |
| I6 | Hiệu trưởng, cô Minh Anh | Mở chuông thông báo | Có *Trẻ có tiền sử tiếp xúc với người bệnh lao* kèm ngày tiếp xúc. Phó hiệu trưởng Campus 1 (người lưu) không nhận |
| I7 | Hiệu trưởng | **Danh sách trẻ**, xem nhanh trẻ vừa nhận | Không có số định danh hay tiền sử tiếp xúc lao trong danh sách |
| I8 | Hiệu trưởng | Mở hồ sơ trẻ vừa nhận → **Sửa hồ sơ**, xóa trống Dân tộc, nhập lý do, lưu | Không lưu được: *Nhập dân tộc* (sửa hồ sơ cũng bắt buộc) |
| I9 | Hiệu trưởng | Mở **Khai báo sức khỏe** của trẻ vừa nhận | Có nút **Sửa khai báo** (Hiệu trưởng sửa được như Phó hiệu trưởng). Tiền sử chỉ Có/Không, có dấu bắt buộc |
| I10 | Phó hiệu trưởng Campus 1 | **Nhập từ Excel → Tải file mẫu** | Dòng mẫu điền đủ các cột hành chính, tiền sử. Thêm 1 dòng để trống Dân tộc và Tiền sử bản thân: xem trước báo *Nhập dân tộc*, *Chọn Có hoặc Không cho tiền sử bản thân* đúng dòng. File mẫu cũ thiếu cột thì báo *Thiếu cột: …* |
| I11 | Cô Minh Anh | Đợt khám Campus 1 → Lớp Chồi 1 → **Khám** Trần Khánh An | Bước 1 có ghi chú *Hành chính lấy từ hồ sơ trẻ, không sửa ở phiếu khám*. Không có ô nhập hành chính: số định danh `999222009007`, sinh non *Có · 35 tuần*, nhóm máu A, nơi ở Số 12 ngõ 5. Tiền sử là ô chọn, điền sẵn: bản thân Có *Hen phế quản*, gia đình Không, tiếp xúc lao Không |
| I12 | Cô Minh Anh | **Khám** Bùi Bảo Ngọc | Hồ sơ đủ (dữ liệu demo điền đầy): nhóm máu O; tiếp xúc lao *Có — gần nhất ngày 28/07/2026* |
| I13 | Cô Minh Anh | Trần Khánh An, khối **Người đi cùng trẻ**: chọn **Có người đi cùng** | Chỉ chọn được phụ huynh trong hồ sơ (nút tên phụ huynh); họ tên, quan hệ, SĐT, CCCD hiện theo hồ sơ, không sửa được. Có dòng *Người đi cùng không có trong hồ sơ: báo Hiệu trưởng hoặc Phó hiệu trưởng thêm vào hồ sơ trẻ* |
| I14 | Cô Minh Anh | Trần Khánh An: tiền sử gia đình **Có** `Tăng huyết áp (bà ngoại)`, **Lưu nháp**; rồi điền đủ phiếu, **Lưu kết luận** | Sau lưu nháp khai báo chưa đổi. Sau lưu kết luận: hồ sơ trẻ (hành chính) không đổi. Khai báo sức khỏe: tiền sử gia đình *Có — Tăng huyết áp (bà ngoại)*, lịch sử *Cập nhật tiền sử từ phiếu khám*, *Tiền sử gia đình: Không → Có — Tăng huyết áp (bà ngoại)* |
| I15 | Phó hiệu trưởng Campus 1 | **Sửa hồ sơ** Trần Khánh An: nhóm máu `AB`, lý do, lưu. Cô Minh Anh mở lại phiếu đã kết luận | Phiếu vẫn hiện nhóm máu A (giữ thông tin lúc lưu kết luận). Phiếu mới hoặc phiếu nháp thì hiện hồ sơ hiện tại |
| I16 | Hiệu trưởng | Mở hồ sơ Nguyễn Hoàng Nam (trẻ tiếp nhận từ trước) | Đủ thông tin hành chính và tiền sử (dữ liệu demo điền đầy, 2026-10-22) |
