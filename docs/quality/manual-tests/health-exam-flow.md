# Kịch bản thử tay — Đợt khám, phiếu Phụ lục II, kỳ cân đo và cảnh báo ở Sổ sức khỏe

Mục đích: đi hết luồng **cảnh báo BMI ở kỳ cân đo có sẵn → Hiệu trưởng tạo đợt → giáo viên nhập phiếu cùng bác sĩ → xem cảnh báo ở Sổ sức khỏe → đóng, mở lại đợt → kỳ cân đo mới** bằng bộ số cố định. Mỗi trẻ ứng với 1 trường hợp, gồm cả số ở ngưỡng, số sai và quyết định của bác sĩ khác gợi ý của hệ thống.

Nghiệp vụ: [plan phiếu khám Phụ lục II](../../plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md), [plan kỳ cân đo](../../plans/completed/2026-10-31-health-measurement-rounds.md), [plan cảnh báo ở Sổ sức khỏe, bỏ phiếu theo dõi](../../plans/active/2026-11-04-health-warnings-book.md) (user quyết định 2026-11-04; BE HLT-16 REMOVED, HLT-18, HLT-19). Dữ liệu là dữ liệu giả. Kết quả mong đợi của backend giả kiểm bằng `tests/health/health-warnings-book.test.mjs`, `tests/health/bmi-for-age.test.mjs` (2026-11-04). Trên trình duyệt (2026-11-04, vai Hiệu trưởng) đã chạy A0.1–A0.9; A0.4 xem qua danh sách lớp sổ xuống ở chi tiết kỳ, chưa đăng nhập giáo viên. Các phần A–I chưa chạy lại sau thay đổi này.

Từ 2026-11-04 **không còn phiếu theo dõi sức khỏe**: không có màn, menu, ghi trao đổi phụ huynh, kết quả khám chuyên khoa, đóng phiếu, nhắc hay thông báo của phiếu. Kết luận bác sĩ (đợt khám) và mức BMI theo tuổi (kỳ cân đo) là cảnh báo ở Sổ sức khỏe, không ai phải xử lý.

## 0. Chuẩn bị

1. Chạy `npm run dev`, mở `http://localhost:5173`.
2. Đăng nhập bất kỳ, bấm **tên/ảnh đại diện ở góc trên bên phải → Khôi phục dữ liệu demo → Khôi phục dữ liệu**. Hệ thống đưa mọi dữ liệu về bản mẫu ban đầu rồi đăng xuất. Làm lại bước này mỗi khi muốn chạy lại kịch bản từ đầu.
3. Mật khẩu mọi tài khoản: `123456`. "Hôm nay" là ngày trên máy.

| Vai | Tài khoản | Phạm vi |
| --- | --- | --- |
| Hiệu trưởng | `hung.pham@carenest.edu.vn` | Cả 2 điểm trường |
| Phó hiệu trưởng Campus 2 | `duc.trinh@carenest.edu.vn` | Tạo, sửa, đóng đợt khám và kỳ cân đo của Campus 2 (từ 2026-10-31) |
| Giáo viên Lớp Mầm 1 (Campus 2) | `tuan.hoang@carenest.edu.vn` | Trẻ T1–T6 |
| Giáo viên Lớp Lá A (Campus 2) | `ngoc.vu@carenest.edu.vn` | Trẻ T7–T12 |

Kịch bản dùng Campus 2: Campus 1 đã có đợt khám đang diễn ra với dữ liệu mẫu; Campus 2 có kỳ cân đo "Cân đo định kỳ tháng …" đang diễn ra — Lớp Lá A đã cân đo đủ 6 trẻ (Ngô Phương Linh *Gầy còm*, 5 trẻ *Bình thường*), Lớp Mầm 1 đã cân đo 2 trẻ (Đỗ Phương Linh *Béo phì*, Bùi Gia Bảo *Nguy cơ thừa cân*), 4 trẻ chưa nhập. Mức BMI mẫu đi theo các lần đo trước của chính trẻ.

## A0. Cảnh báo BMI ở kỳ cân đo có sẵn (trước khi đóng kỳ)

Mức BMI theo tuổi do hệ thống tính theo chuẩn WHO (HLT-18), chỉ để sàng lọc, không phải chẩn đoán. Mọi tuổi: dưới −3SD *Gầy còm nặng*, dưới −2SD *Gầy còm*. Trẻ đến 60 tháng: trên +1SD *Nguy cơ thừa cân*, trên +2SD *Thừa cân*, trên +3SD *Béo phì*; từ 61 tháng: trên +1SD *Thừa cân*, trên +2SD *Béo phì*. Hệ thống làm tròn z-score 2 chữ số (từ 5 làm tròn lên) rồi mới so ngưỡng, ví dụ z +1,004 ⇒ +1,00 ⇒ *Bình thường*; z +1,006 ⇒ +1,01 ⇒ *Nguy cơ thừa cân*. Số đo mẫu dựng theo ngày mở kỳ nên BMI, z-score có thể lệch nhẹ so với số ghi dưới đây; mức BMI không đổi.

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| A0.1 | Hiệu trưởng | **Đợt khám, kỳ cân đo** | Cột **Cảnh báo**: kỳ "Cân đo định kỳ tháng …" ghi *3 trẻ có cảnh báo BMI*; đợt khám ghi *n cần theo dõi* / *n cần theo dõi sát* (đỏ) hoặc —. Không còn mục menu **Phiếu theo dõi sức khỏe** |
| A0.2 | Hiệu trưởng | Mở kỳ cân đo của Campus 2 | Khối **Cảnh báo BMI theo tuổi**: Gầy còm nặng 0 · Gầy còm 1 · Nguy cơ thừa cân 1 · Thừa cân 0 · Béo phì 1 (thẻ đỏ cho gầy còm nặng, béo phì; cam cho các mức còn lại; mức 0 vẫn hiện), dòng chú thích *chỉ để sàng lọc, không phải chẩn đoán*. Bảng **Tiến độ theo lớp** có cột **Cảnh báo BMI**: Lớp Mầm 1 2, Lớp Lá A 1, các lớp khác — |
| A0.3 | Hiệu trưởng | Tab **Trẻ có cảnh báo BMI** | 3 trẻ, thứ tự do backend giả trả (gầy còm nặng, béo phì trước; rồi gầy còm, thừa cân; rồi nguy cơ thừa cân; cùng mức xếp theo tên): Đỗ Phương Linh (Lớp Mầm 1, BMI 20,7, *Béo phì*), Ngô Phương Linh (Lớp Lá A, BMI 12, *Gầy còm*), Bùi Gia Bảo (Lớp Mầm 1, BMI 17, *Nguy cơ thừa cân*); mỗi dòng có lớp, ngày đo, BMI, badge mức và **Mở sổ sức khỏe**. Không có trẻ mức Bình thường (ví dụ Đỗ Gia Bảo) |
| A0.4 | Cô Ngọc | Mở kỳ → danh sách Lớp Lá A | Cột **BMI** (dấu phẩy, ví dụ `12`, `15,9`) và **Cảnh báo BMI**; 5 trẻ *Bình thường* (xanh), Ngô Phương Linh *Gầy còm* (cam). Tích **Chỉ trẻ có cảnh báo BMI** ⇒ còn 1 trẻ, chip *Có cảnh báo BMI*; **Đặt lại bộ lọc** bỏ tích. Thầy Tuấn (Lớp Mầm 1): Đỗ Phương Linh *Béo phì*, Bùi Gia Bảo *Nguy cơ thừa cân*; 4 trẻ *Chưa cân đo* có nút **Nhập số đo** |
| A0.5 | Hiệu trưởng | Từ tab A0.3 mở **Sổ sức khỏe** của Ngô Phương Linh (T9) | Trang chỉ có bảng **Lịch sử khám, cân đo** (không thẻ cảnh báo, lần đo gần nhất, thông tin tiếp nhận; không hộp thông báo). Bảng kẻ ô như phiếu Tiếp nhận trẻ, dòng tiêu đề xanh đậm chữ in hoa. Cột: **TT**, **Tên đợt khám**, **Ngày khám**, **Người nhập**, **Kết luận sức khỏe**, **Thao tác**. Dòng phiếu khám *Khám bổ sung đầu tháng 10/2026…* (dòng phụ *Đợt khám sức khỏe*): *Chuyển khám chuyên khoa* + *Chuyển khám: Mắt*. Dòng kỳ cân đo (dòng phụ *Kỳ cân đo*): *Gầy còm* + *BMI 12*. Ba đợt khám đã đóng (tháng 3, 6, 9/2026; dòng phụ *Đợt khám sức khỏe*, không còn *Mẫu cũ*): *Có vấn đề, tư vấn* + *Thiếu cân so với tuổi.* |
| A0.6 | Hiệu trưởng | Bấm nút xem ở dòng kỳ cân đo | Hộp *Lần đo ngày …*: đợt, tuổi lúc đo, người nhập, *Đã công bố*, số đo; dòng **BMI theo tuổi** có badge *Gầy còm* và *Z-score -2,60 · hệ thống tính theo chuẩn WHO, chỉ để sàng lọc, không phải chẩn đoán* |
| A0.7 | Hiệu trưởng | Bấm nút xem ở dòng phiếu khám | Hộp tiêu đề *{tên đợt} · {ngày}*: badge nhóm kết luận, mức theo dõi, *Đã công bố*; phiếu Phụ lục II đầy đủ (I. Thông tin hành chính … Kết luận và tư vấn); chân hộp nút **Mở trang phiếu khám** mở đúng phiếu. Tích **Chỉ lần có cảnh báo** ⇒ chỉ còn dòng có BMI khác Bình thường hoặc mức Cần theo dõi / Cần theo dõi sát / Vấn đề đã biết; khoảng ngày không có lần nào ⇒ *Không có lần khám phù hợp* với nút **Đặt lại bộ lọc** |
| A0.8 | Hiệu trưởng | Sổ sức khỏe của Đặng Tuấn Kiệt (T8) | Dòng phiếu khám: *Bình thường*; dòng kỳ cân đo: *Bình thường* (xanh) + *Theo BMI …* |
| A0.9 | Hiệu trưởng | Sổ sức khỏe của Đỗ Phương Linh (T2, Lớp Mầm 1) | Dòng kỳ cân đo: *Béo phì* (đỏ) + *Theo BMI 20,7*; xem chi tiết ⇒ *Z-score +3,21*. Phiếu đợt tháng 10 chưa kết luận khi đóng đợt không có trong bảng |

## A. Hiệu trưởng tạo đợt

| Bước | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| A1 | **Đợt khám, kỳ cân đo → Tạo đợt khám**. Điểm trường Campus 2, nhập đủ các ô như A4, bấm **Tạo đợt khám sức khỏe** | Hộp *Lịch sát với đợt khám, kỳ cân đo khác* hiện trước (xem A4). Bấm **Vẫn tạo**: không tạo được, ô điểm trường báo *Điểm trường đang có kỳ cân đo "Cân đo định kỳ tháng …" chưa đóng. Đóng hoặc hủy trước khi tạo mới.* |
| A2 | Để trống tên, chọn ngày kết thúc trước ngày bắt đầu, bấm **Tạo đợt khám sức khỏe** | Lỗi *Nhập tên đợt khám* và *Ngày kết thúc không được trước ngày bắt đầu* |
| A3 | Mở kỳ "Cân đo định kỳ tháng …" của Campus 2 (Đang diễn ra) → **Đóng sớm kỳ cân đo** → xác nhận | Không có nút **Hủy kỳ** (kỳ đã có số đo). Hộp xác nhận báo số trẻ chưa cân đo sẽ ghi *Vắng cân đo*. Sau khi đóng: 4 trẻ chưa cân của Lớp Mầm 1 (và trẻ chưa cân của các lớp khác) *Vắng cân đo*; 8 số đo đã nhập giữ nguyên và vẫn là cảnh báo BMI ở Sổ sức khỏe |
| A4 | **Tạo đợt khám**: tên `Khám sức khỏe đợt thử luồng` · Campus 2 · bắt đầu **hôm nay** · kết thúc **hôm nay + 3** · đơn vị khám `Trạm Y tế phường – BS. Đỗ Minh Khôi` · ghi chú `Giáo viên có mặt cùng bác sĩ, nhập phiếu Phụ lục II từng trẻ.` | Hộp cảnh báo nêu *Năm học này đã có đợt khám "Khám sức khỏe đầu năm học 2026–2027"* và các đợt, kỳ bắt đầu cách chưa tới 2 tháng 15 ngày (gồm kỳ cân đo vừa đóng ở A3). Bấm **Vẫn tạo**: đợt ở trạng thái **Đang diễn ra**. Giáo viên Campus 2 nhận thông báo *Đợt khám sức khỏe mới*. |
| A5 | Đăng nhập Phó hiệu trưởng Campus 2, mở đợt | Thấy tiến độ và các nút **Sửa thông tin**, **Đóng sớm đợt khám** (PHT quản lý điểm trường của mình). Form tạo chỉ chọn được Campus 2 |

## B. Giáo viên nhập phiếu cùng bác sĩ

Mở đợt → danh sách trẻ của lớp hiện ngay dưới phần thông tin đợt (màn giáo viên không có hàng thẻ tiến độ và bảng tiến độ theo lớp) → bấm **Khám** cạnh tên trẻ. Phiếu có 5 bước: **1 Hành chính, tiền sử · 2 Sinh tồn, dinh dưỡng · 3 Phát triển, tiêm chủng · 4 Khám lâm sàng · 5 Kết luận**. Mọi phiếu mới dùng mẫu kết luận thường (không còn mẫu *So với vấn đề đang theo dõi*).

**Mặc định, trừ khi bảng ghi khác:**
- Bước 1: hành chính chỉ xem (lấy từ hồ sơ trẻ). Giữ người đi cùng hệ thống chọn sẵn (phụ huynh đầu tiên của hồ sơ). Tiền sử giữ bản điền sẵn từ khai báo sức khỏe (dữ liệu demo: Không).
- Bước 2: tình trạng dinh dưỡng chọn Bình thường.
- Bước 3: phần IV chọn Có, Có; phần V chọn Có, Có, Có.
- Bước 4: giữ nguyên các lựa chọn chọn sẵn.
- Bước 5: kết luận Bình thường; hướng xử lý "Không cần tư vấn hay chuyển khám"; bác sĩ kết luận `BS. Đỗ Minh Khôi`.

**Hỏi lại trước khi lưu:** bác sĩ không chuyển khám (và không có nguy cơ lao) mà khối "Điểm cần bác sĩ xem lại" còn mục nào, thì bấm **Lưu kết luận** sẽ hiện hộp **"Bác sĩ vẫn kết luận như vậy?"** liệt kê các điểm. Bấm **Quay lại xem** để xem lại, hoặc **Lưu theo bác sĩ** để lưu. Hộp không chặn việc lưu.

**Gợi ý gộp sinh tồn:** 1/3 chỉ số (nhiệt độ, mạch, nhịp thở) ngoài khoảng ⇒ dòng vàng *Gợi ý: cần theo dõi*; từ 2/3 ⇒ dòng đỏ *Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận*.

**Công bố (2026-10-23):** mọi kết quả tự công bố cho phụ huynh khi lưu (phiếu khám: **Lưu kết luận**, kể cả lưu lại sau sửa; số đo của kỳ cân đo: **Lưu số đo**); không còn nút **Công bố**. Kết luận mức *Cần theo dõi sát* (nguy cơ lao, chuyển khám) có người đi cùng thì bước 5 bắt buộc ô **Ý kiến phụ huynh**. Không có trạng thái "Đã/Chưa trao đổi phụ huynh" và không có việc theo dõi sau khám.

**Vấn đề đã biết (câu "Vấn đề này"):** chỉ hỏi khi trẻ có vấn đề đã biết — lần khám đã kết luận gần nhất ở mức *Vấn đề đã biết, ổn định*, hoặc (chưa có) tiền sử bản thân đã khai trong Khai báo sức khỏe — và bác sĩ ghi "Có vấn đề về sức khỏe" mà không chuyển khám, không nguy cơ lao. Chọn *Vấn đề mới hoặc có thay đổi* (mức Cần theo dõi) hoặc *Vấn đề đã biết, không thay đổi so với trước* (mức Vấn đề đã biết, ổn định). Câu này không chọn sẵn.

Khi nhập số ở bước 2, trạng thái tự chọn theo khoảng của nhóm tuổi; trừ khi bảng ghi khác, giữ trạng thái hệ thống chọn. Khoảng tham khảo của trẻ 3–5 tuổi: mạch 80–120, nhịp thở 20–28 lần/phút. Nhiệt độ: sốt từ 37,5 °C, hạ thân nhiệt dưới 36 °C.

### Lớp Mầm 1 — `tuan.hoang@carenest.edu.vn`

**T1 · Vũ Tuấn Kiệt (40 tháng) — Lần khám trước chuyển khám; lần này bình thường, số ở cận trên**
- Bước 1: số định danh, địa chỉ lấy từ hồ sơ trẻ, chỉ xem; ngày khám là chữ, hệ thống ghi (từ 2026-11-04); tiền sử điền sẵn từ khai báo sức khỏe. Đầu phiếu có dòng *Lần khám trước (06/10/2026, Khám bổ sung đầu tháng 10/2026 …): Đáp ứng âm thanh kém, tai phải chảy dịch. Chuyển khám chuyên khoa: Tai mũi họng…*; không có dòng kết quả khám chuyên khoa hay link phiếu theo dõi.
- Bước 2: nhiệt độ `37.4` · mạch `120` · nhịp thở `28` · chiều cao `98.5` · cân nặng `15.2` · vòng đầu `48.5` · vòng cánh tay `160`. Cả 3 trạng thái là **Bình thường**. Vòng đầu tự chọn Bình thường (khoảng tạm 46,5–52,0 cm).
- Bước 5: mặc định (Bình thường). Không có ô Ý kiến phụ huynh (không phải mức Cần theo dõi sát).
- Mong đợi:
  - Nhãn **Bình thường**, mức **Không ghi nhận bất thường**; màn kết quả không có thông báo nào về phiếu theo dõi.
  - Bước 5 có dòng *Lưu kết luận là công bố cho phụ huynh ngay… Kết luận là cảnh báo của lần khám ở Sổ sức khỏe.* Sau khi lưu, phiếu **Đã công bố**.
  - Sổ sức khỏe: khối **Kết luận bác sĩ** đổi sang lần khám này (*Khám sức khỏe đợt thử luồng · hôm nay*), không nền đỏ.

**T2 · Đỗ Phương Linh (34 tháng) — Khoảng tham khảo đổi theo tuổi**
- Bước 2: thấy *Khoảng tham khảo của trẻ 12–35 tháng: 98–140 lần/phút* và *22–37 lần/phút*.
  - Nhập nhiệt độ `37.0` · mạch `135` · nhịp thở `30` · chiều cao `93.0` · cân nặng `12.4` · vòng đầu `47.0`.
  - Mạch và nhịp thở vẫn **Bình thường**. Với trẻ 3–5 tuổi, 2 số này sẽ là Nhanh và Thở nhanh.
  - Tình trạng dinh dưỡng: chọn **Dấu hiệu thiếu máu** (không chọn Bình thường).
- Bước 4: Lòng bàn tay → **Không bình thường (nhợt)**.
- Bước 5:
  - Chọn **Có vấn đề về sức khỏe** (nếu đã tích Bình thường, ô đó tự bỏ), ghi rõ `Lòng bàn tay nhợt, có dấu hiệu thiếu máu.`
  - Chọn **Tư vấn**, lời tư vấn `Bổ sung thực phẩm giàu sắt; đưa trẻ đi khám nếu mệt, xanh xao.`
  - Không có câu **Vấn đề này** (trẻ không có vấn đề đã biết).
- Mong đợi:
  - Điểm cần xem lại không có dòng sinh tồn. Có 2 mục: *Tình trạng dinh dưỡng: Dấu hiệu thiếu máu*, *Lòng bàn tay: Không bình thường (nhợt)*.
  - Bấm **Lưu kết luận**: hiện hộp hỏi lại với 2 điểm trên (bác sĩ chỉ tư vấn) → bấm **Lưu theo bác sĩ**.
  - Sau khi lưu: **Có vấn đề, tư vấn**, mức **Cần theo dõi**.

**T3 · Trần Đăng Khoa (42 tháng) — Gợi ý 2 dấu hiệu, bác sĩ chuyển khám**
- Bước 2: `36.9` · `105` · `24` · chiều cao `97.0` · cân nặng `14.6` · vòng đầu `46.0`. Vòng đầu tự chọn **Đầu nhỏ** (khoảng tạm 46,6–52,1).
- Bước 3: Phát triển vận động → **Không**.
- Bước 5:
  - Thấy gợi ý **Gợi ý: cân nhắc chuyển khám chuyên khoa — 2/3 dấu hiệu**.
  - Chọn **Có vấn đề về sức khỏe** `Vòng đầu nhỏ, vận động chưa theo kịp độ tuổi.` · **Chuyển khám chuyên khoa** `Nhi khoa – khám phát triển`, lời tư vấn `Đưa trẻ đi khám trong tháng này.`
  - Để trống **Ý kiến phụ huynh**, bấm **Lưu kết luận** ⇒ lỗi *Ghi ý kiến của phụ huynh (người đi cùng) về kết luận*. Nhập `Mẹ đồng ý đưa trẻ đi khám trong tháng.` rồi lưu lại.
- Mong đợi: nhãn **Chuyển khám chuyên khoa**, mức **Cần theo dõi sát – đề nghị khám chuyên khoa**; bấm lưu không hiện hộp hỏi lại (đã chuyển khám). Không có phiếu theo dõi, không có việc trao đổi sau khám.

**T4 · Hoàng Khánh An (37 tháng) — Chuyển khám, KHÔNG có người đi cùng**
- Bước 1: chọn **Không có người đi cùng**.
- Bước 2: `36.7` · `110` · `26` · chiều cao `96.0` · cân nặng `14.0` · vòng đầu `52.3`. Vòng đầu tự chọn **Đầu to** (khoảng tạm 46,3–51,8).
- Bước 5:
  - Gợi ý chỉ là *cần theo dõi* (1/3 dấu hiệu).
  - Bác sĩ vẫn đề nghị chuyển khám: chọn **Có vấn đề**, ghi rõ `Vòng đầu to so với tuổi.`; **Chuyển khám chuyên khoa** `Nhi khoa – thần kinh`.
- Mong đợi:
  - Mức **Cần theo dõi sát**, theo kết luận bác sĩ, không theo gợi ý.
  - Bước 5 không có ô Ý kiến phụ huynh (không có người đi cùng). Phiếu vẫn **tự công bố** khi lưu.
  - Màn kết quả không có cảnh báo trao đổi phụ huynh, không có nút Công bố.

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
  - Sau khi lưu: nhãn **Nguy cơ lao**; khung đỏ *Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc). Cảnh báo hiện ở Sổ sức khỏe của trẻ và danh sách trẻ cần theo dõi của đợt khám.* Không gửi thông báo của phiếu theo dõi.
  - Khai báo sức khỏe của trẻ: tiền sử gia đình *Có — Ông nội đang điều trị lao*, tiếp xúc lao *Có — gần nhất ngày 01/10/2026*; lịch sử *Cập nhật tiền sử từ phiếu khám*.
  - Phần Kết luận của phiếu có *Ý kiến phụ huynh*; không có dòng *Trao đổi phụ huynh*. Danh sách lớp không hiện số CCCD.

**T6 · Nguyễn Bảo Ngọc (38 tháng) — Phiếu khám dở**
- Bước 2: `36.8` · `100` · `25` · `97.5` · `14.4` · `49.0`.
- Đi tới bước 4, bấm **Lưu nháp**, rồi **Về đợt khám**.
- Mong đợi:
  - Danh sách lớp hiện **Đang khám** và nút **Tiếp tục khám**. Mở lại thì phiếu mở đúng bước 4.
  - Phiếu không hiện ở Sổ sức khỏe.

### Lớp Lá A — `ngoc.vu@carenest.edu.vn`

**T7 · Phạm Thảo Vy (58 tháng) — Vấn đề đã biết từ khai báo, thừa cân, ghi rõ hành vi; sau đó sửa phiếu**
- Bước 1 có tiền sử bản thân *Có — Bàn chân bẹt – mang giày chỉnh hình* (khai báo sức khỏe).
- Bước 2:
  - `36.6` · `98` · `22` · chiều cao `106.0` · chiều dài/tuổi `0.5` · cân nặng `24.5` · cân nặng/tuổi `2.3` · vòng đầu `50.0` · vòng cánh tay `210`.
  - Tình trạng dinh dưỡng: **Thừa cân/béo phì**.
- Bước 4: *Có biểu hiện buồn bã, lo âu, mất ngủ kéo dài không* → **Có**. Ô *Nếu có, ghi rõ* thành bắt buộc: `Gần đây trẻ khó ngủ, hay lo khi xa mẹ (người đi cùng kể).`
- Bước 5: **Có vấn đề** `Thừa cân; khó ngủ kéo dài.` · **Tư vấn** `Giảm đồ ngọt, tăng vận động; giữ giờ ngủ cố định.`
  - Có câu **Vấn đề này** với gợi ý *Trẻ có vấn đề đã biết: Bàn chân bẹt – mang giày chỉnh hình…* (lấy từ tiền sử bản thân). Bấm **Lưu kết luận** khi chưa chọn → lỗi *Chọn vấn đề mới hay vấn đề đã biết*. Chọn **Vấn đề mới hoặc có thay đổi**.
- Mong đợi: bấm **Lưu kết luận** hiện hộp hỏi lại (thừa cân, buồn bã kéo dài, ghi rõ) → **Lưu theo bác sĩ**. Mức **Cần theo dõi**, phiếu tự công bố. Sổ sức khỏe: khối Kết luận bác sĩ *Cần theo dõi*; khối BMI vẫn theo số đo của kỳ cân đo (*Bình thường*, dù bác sĩ chọn Thừa cân/béo phì ở phiếu): phiếu khám không xếp mức BMI.
- Thử sửa phiếu (từ màn kết quả bấm **Xem phiếu**):
  1. Bấm **Sửa phiếu**, ở bước 2 đổi cân nặng thành `24.1`.
  2. Ở bước 5 bấm **Lưu kết luận** khi chưa ghi lý do → lỗi *Nhập lý do sửa phiếu đã có kết luận*.
  3. Ghi lý do `Cân lại sau khi trẻ cởi áo khoác.` rồi lưu.
- Mong đợi sau khi sửa: **Lịch sử sửa phiếu** có *Cân nặng (kg): 24,5 → 24,1*. Phiếu **tự công bố lại** khi lưu.

**T8 · Đặng Tuấn Kiệt (65 tháng) — Trên 60 tháng, số ở cận dưới**
- Bước 2: không có ô vòng đầu (*Trẻ trên 60 tháng tuổi tại ngày khám: không đo vòng đầu*).
  - Nhập `36.0` · `80` · `20` · chiều cao `110.0` · cân nặng `18.5`. Cả 3 trạng thái là **Bình thường**.
- Mong đợi: không có điểm cần xem lại; gợi ý kết hợp chỉ xét 2 dấu hiệu phát triển; phiếu tự công bố.

**T9 · Ngô Phương Linh (60 tháng) — Lần khám trước chuyển khám Mắt, kỳ cân đo gầy còm, số ngay dưới ngưỡng**
- Bước 2: nhiệt độ `35.9` → **Hạ thân nhiệt** · mạch `79` → vẫn **Bình thường** · nhịp thở `19` → **Thở chậm** · `107.0` · `17.2` · vòng đầu `50.0`.
  - Dưới ô trạng thái mạch có ghi chú: thấp hơn khoảng tham khảo; mẫu không có ô "chậm".
- Bước 4: Mí mắt và kết mạc → **Chảy ghèn/mủ**.
- Bước 5: **Có vấn đề** `Mắt chảy ghèn; thân nhiệt thấp khi khám.` · **Chuyển khám chuyên khoa** `Mắt` · ý kiến phụ huynh `Bố hẹn đưa trẻ khám mắt cuối tuần.`
- Mong đợi:
  - Điểm cần xem lại có 3 dòng: *Nhiệt độ 35,9 °C: hạ thân nhiệt (dưới 36 °C)*, *Mạch 79 lần/phút, dưới khoảng tham khảo 80–120 của trẻ 3–5 tuổi*, *Nhịp thở 19 lần/phút, dưới khoảng tham khảo 20–28 của trẻ 3–5 tuổi*.
  - Dưới 3 dòng sinh tồn có dòng đỏ *Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận — 3/3*. Đã chuyển khám nên **không** có hộp hỏi lại.
  - Sổ sức khỏe: khối Kết luận bác sĩ theo lần khám này (Cần theo dõi sát, nền đỏ nhạt); khối BMI vẫn *Gầy còm* của kỳ cân đo.

**T10 · Lê Đăng Khoa (66 tháng) — Gợi ý mạnh nhưng bác sĩ chỉ tư vấn**
- Bước 2: `36.8` · `95` · `23` · `112.0` · `19.0`.
- Bước 3: phát triển tinh thần **Không**, phát triển vận động **Không**.
- Bước 5:
  - Thấy **Gợi ý: cân nhắc chuyển khám chuyên khoa — 2/2 dấu hiệu**.
  - Bác sĩ chỉ tư vấn: **Có vấn đề** `Chậm hơn bạn cùng tuổi về ngôn ngữ và vận động.` · **Tư vấn** `Theo dõi thêm 3 tháng, tăng hoạt động vận động ở lớp.`
- Mong đợi: bấm **Lưu kết luận** hiện hộp hỏi lại (gợi ý cân nhắc chuyển khám) → **Lưu theo bác sĩ**. Mức **Cần theo dõi**. Gợi ý không phải quyết định.

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
  - Sau khi lưu: **Bình thường**, mức **Không ghi nhận bất thường**. Hệ thống không tự đổi mức theo số đo; lời tư vấn vẫn được lưu. Khối BMI ở Sổ sức khỏe vẫn *Bình thường* của kỳ cân đo (phiếu khám không xếp mức BMI).

**T12 · Đỗ Gia Bảo (69 tháng) — Vắng khám**: không nhập gì.

## C. Cảnh báo ở Sổ sức khỏe sau đợt khám (thay phần "Theo dõi sau khám" cũ)

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| C1 | Hiệu trưởng | Sổ sức khỏe của T4 | Khối Kết luận bác sĩ nền đỏ nhạt: *Cần theo dõi sát – đề nghị khám chuyên khoa* · *Chuyển khám chuyên khoa*; dòng *Chuyển khám chuyên khoa: Nhi khoa – thần kinh*, *Vấn đề: Vòng đầu to so với tuổi.*, *Bác sĩ: BS. Đỗ Minh Khôi*; *Khám sức khỏe đợt thử luồng · hôm nay*; **Xem phiếu khám** mở đúng phiếu. Không còn khối *Kết quả khám chuyên khoa (phụ huynh báo lại)* |
| C2 | Hiệu trưởng | Sổ sức khỏe của T2 | Khối Kết luận bác sĩ: *Cần theo dõi* · *Có vấn đề, tư vấn*, *Vấn đề: Lòng bàn tay nhợt…*, *Lời dặn: …*; không nền đỏ. Khối BMI vẫn *Béo phì* của kỳ cân đo (nền đỏ nhạt), không đổi theo số đo ở phiếu khám |
| C3 | Hiệu trưởng | Sổ sức khỏe của T5 | Khối Kết luận bác sĩ: *Cần theo dõi sát* · *Nguy cơ lao* (nền đỏ nhạt). Khối BMI: *Nguy cơ thừa cân* (cam, BMI 17) của kỳ cân đo |
| C4 | Hiệu trưởng | Sổ sức khỏe của Lý Gia Phúc (trẻ mới tiếp nhận) | *Chưa có kết luận bác sĩ.* và *Chưa có số đo của kỳ cân đo.* |
| C5 | Hiệu trưởng | Dán `/children/health-follow-ups` | Không có màn phiếu theo dõi (báo không tìm thấy) |

## D. Hiệu trưởng đóng đợt

| Bước | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| D1 | Mở đợt, xem thống kê | Đã có kết luận 10 · Đang khám 1 · Chưa khám 1. Tab **Trẻ cần theo dõi**: 7 trẻ (T2, T3, T4, T5, T7, T9, T10; cần theo dõi sát trước); không có cột phiếu theo dõi |
| D2 | **Đóng sớm đợt khám** | Hộp xác nhận: *1 trẻ chưa khám sẽ ghi Vắng khám. 1 phiếu đang khám chưa có kết luận sẽ giữ nguyên, hiện "Chưa kết luận".* Không còn câu về phiếu theo dõi |
| D3 | Xác nhận | *Đã đóng đợt khám; 1 trẻ ghi vắng khám; 1 phiếu chưa kết luận.* Lớp Lá A: Đỗ Gia Bảo **Vắng khám**. Lớp Mầm 1: Nguyễn Bảo Ngọc **Chưa kết luận** |
| D4 | Giáo viên mở lại phiếu T7 | Có thông báo đợt đã đóng, phiếu bị khóa; không có nút **Sửa phiếu** |

## E. Mở lại đợt, hoàn thành phiếu dở, đóng lại

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| E1 | Hiệu trưởng | **Mở lại đợt**, để trống lý do | Lỗi *Nhập lý do mở lại đợt khám* |
| E2 | Hiệu trưởng | Lý do `Hoàn thành phiếu của trẻ đang khám dở.` | Đợt **Đang diễn ra**; Đỗ Gia Bảo về **Chưa khám**; giáo viên nhận thông báo mở lại |
| E3 | Thầy Tuấn | T6 → **Tiếp tục khám** → bước 3 chọn Có, Có / Có, Có, Có → bước 5 Bình thường → **Lưu kết luận** | Nguyễn Bảo Ngọc **Đã có kết luận** |
| E4 | Hiệu trưởng | **Đóng sớm đợt khám** | Chỉ còn 1 trẻ vắng khám, 0 phiếu chưa kết luận |

## F. Kỳ cân đo mới (giáo viên cân đo, không có bác sĩ)

Số đo chỉ nhập trong kỳ cân đo đang diễn ra; kỳ cân đo tự đóng sau ngày kết thúc như đợt khám (user quyết định 2026-11-04), vẫn đóng sớm được. Làm sau E4 (đợt khám đã đóng).

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| F1 | Cô Ngọc | Đỗ Gia Bảo → **Sổ sức khỏe** | Không có nút **Nhập số đo** (Campus 2 chưa có kỳ cân đo đang diễn ra). Mở thẳng `/children/<mã trẻ>/health/new`: *Điểm trường chưa có kỳ cân đo đang diễn ra* |
| F2 | Phó hiệu trưởng Campus 2 | **Đợt khám, kỳ cân đo → Tạo kỳ cân đo**: bắt đầu **hôm nay**, kết thúc **hôm nay + 3** → **Tạo kỳ cân đo** | Form không có ô đơn vị khám. Hộp cảnh báo nêu đợt "Khám sức khỏe đợt thử luồng", kỳ cân đo đã đóng ở A3 và các đợt khám tháng 9, 10; không có cảnh báo năm học. Bấm **Vẫn tạo**: kỳ **Đang diễn ra**, giáo viên Campus 2 nhận *Kỳ cân đo mới* |
| F3 | Cô Ngọc | Mở kỳ → Lớp Lá A → **Nhập số đo** cạnh Đỗ Gia Bảo: chiều cao `160` | Lỗi *Nhập chiều cao từ 40 đến 150 cm*. **Ngày đo** là chữ (ngày hôm nay, *Hệ thống tự ghi ngày đo khi lưu, không chọn được*), không có ô chọn ngày, không có ô vòng đầu (từ 2026-11-04). Khung hướng dẫn: *chỉ chiều cao, cân nặng, ghi chú; không có kết luận bác sĩ. Hệ thống xếp mức BMI theo tuổi theo chuẩn WHO để sàng lọc* |
| F4 | Cô Ngọc | Chiều cao `115.2` · cân nặng `19.8` · ghi chú `Cân đo tại lớp.` → **Lưu và nhập trẻ tiếp theo** | Thông báo *Đã lưu số đo của Đỗ Gia Bảo và công bố cho phụ huynh. BMI 14,9: Bình thường.* Sang form của trẻ chưa cân kế tiếp. Danh sách lớp của kỳ: Đỗ Gia Bảo *Đã cân đo*, 115,2 / 19,8, BMI 14,9, *Bình thường* |
| F5 | Cô Ngọc | Vũ Khánh An: chiều cao `112.0` · cân nặng `25.5` → **Lưu số đo** | Thông báo *Đã lưu số đo và công bố cho phụ huynh. BMI 20,3: Béo phì.* Màn kết quả: dòng **BMI theo tuổi** *Béo phì*, *Z-score +2,58* (ở 63 tháng; tuổi khác thì số lẻ đổi nhẹ. Trẻ từ 61 tháng: trên +2SD là béo phì). Sổ sức khỏe: khối BMI đổi sang lần đo này, nền đỏ nhạt |
| F6 | Phó hiệu trưởng Campus 2 | Danh sách đợt và kỳ; mở kỳ mới | Cột **Cảnh báo** của kỳ mới: *1 trẻ có cảnh báo BMI*. Chi tiết kỳ: Béo phì 1; tab **Trẻ có cảnh báo BMI** có Vũ Khánh An |
| F7 | Phó hiệu trưởng Campus 2 | Mở kỳ → **Đóng sớm kỳ cân đo** → xác nhận | Trẻ chưa cân thành *Vắng cân đo*; số đo của kỳ bị khóa (cô Ngọc không còn nút **Sửa số đo**) |
| F8 | Phó hiệu trưởng Campus 2 | Khi một kỳ cân đo đã qua ngày kết thúc mà chưa đóng (đợi qua ngày, hoặc dữ liệu thử): mở kỳ → **Mở lại kỳ** | Kỳ đã **Đã đóng** (tự đóng sau ngày kết thúc như đợt khám, từ 2026-11-04); lịch sử *Đóng kỳ cân đo · Hệ thống*, lý do *Hệ thống tự đóng khi qua ngày kết thúc cân đo*; trẻ chưa cân thành *Vắng cân đo*. Hộp mở lại có ô bắt buộc **Ngày kết thúc mới** (từ hôm nay, `dd/mm/yyyy`); mở lại xong kỳ lại tự đóng sau ngày đó |

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
- **Phiếu cũ mẫu FOLLOW_UP** (kết luận khi trẻ còn phiếu theo dõi, trước 2026-11-04): xem và **Sửa phiếu** vẫn dùng câu *So với vấn đề đang theo dõi*, có dòng *Phiếu này đã kết luận theo mẫu cũ…*; nhãn *Đang theo dõi, chưa ghi nhận thêm* (Bùi Phương Linh, Lớp Lá 1) và *Đang theo dõi, có bất thường mới* (Ngô Hoàng Nam, Lớp Mầm 1). Phiếu mới của trẻ khác luôn dùng mẫu thường.
- **Vấn đề đã biết, không thay đổi** (cận thị đang đeo kính): mức **Vấn đề đã biết, ổn định**, không có trong tab *Trẻ cần theo dõi*: Ngô Bảo Ngọc, Lớp Lá 1.
- **Vấn đề đã biết từ khai báo**: Trần Khánh An (Lớp Chồi 1, tiền sử bản thân *Hen phế quản*) — phiếu mới có *Có vấn đề*, không chuyển khám thì hỏi **Vấn đề này**.

Danh sách đầy đủ: bảng `EXAM_CASES` và `ROUND_BMI_Z` trong `src/mocks/childrenSeed.js`.

## H. Cảnh báo ở danh sách trẻ và Xu hướng sức khỏe

Từ 2026-10-31 mức theo dõi không còn ở danh sách trẻ (cột, bộ lọc); từ 2026-11-04 cảnh báo xem ở cột **Kết luận sức khỏe** của Sổ sức khỏe (bản tối giản, chỉ còn bảng). Tổng hợp trẻ cần chú ý: tab **Trẻ cần theo dõi** (đợt khám), **Trẻ có cảnh báo BMI** (kỳ cân đo) và **Xu hướng sức khỏe**.

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| H1 | Hiệu trưởng | **Hồ sơ trẻ → Danh sách trẻ** | Không có cột Theo dõi sức khỏe, không có bộ lọc mức theo dõi |
| H2 | Hiệu trưởng | **Xu hướng sức khỏe**, chọn Campus 2 | Danh sách trẻ xếp theo tên, mỗi dòng chỉ tên, mã, lớp; không ghi kết luận sức khỏe (không còn nhãn mức theo dõi, không còn *Chưa có kết luận bác sĩ*) |
| H3 | Hiệu trưởng | Xu hướng của Ngô Phương Linh → **Bảng số liệu** | Một cột **Cảnh báo** như Sổ sức khỏe (Bác sĩ: … / BMI: …), không còn cột Kết luận, Mức theo dõi |
| H4 | Cô Ngọc | Sau bước F, Sổ sức khỏe của Đỗ Gia Bảo | Khối BMI theo lần đo của kỳ F (*Bình thường*); khối Kết luận bác sĩ vẫn theo lần khám có kết luận trước đó (số đo của kỳ cân đo, phiếu nháp không tính) |
| H5 | Hiệu trưởng | **Cho nghỉ học** một trẻ bất kỳ (chỉ thử trên dữ liệu demo) | Hộp xác nhận không còn dòng về phiếu theo dõi; giáo viên lớp nhận *… nghỉ học từ ngày …* không kèm câu phiếu theo dõi |

## I. Hành chính, tiền sử nhập khi tiếp nhận; phiếu khám chỉ xem hành chính (Campus 1)

Nghiệp vụ: [plan hồ sơ hành chính, tiền sử](../../plans/completed/2026-10-17-enrollment-admin-medical-history.md), thay một phần bởi [plan phiếu khám chỉ xem Phần I](../../plans/completed/2026-10-22-exam-admin-from-profile.md). Làm sau bước 0 (khôi phục dữ liệu demo). Tài khoản thêm: Phó hiệu trưởng Campus 1 `lan.nguyen@carenest.edu.vn`, giáo viên Lớp Chồi 1 `minhanh.le@carenest.edu.vn`.

| Bước | Ai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| I1 | Phó hiệu trưởng Campus 1 | **Hồ sơ trẻ → Tiếp nhận trẻ**. Bước 1 nhập tên, ngày sinh, giới, phụ huynh; để trống khối **Thông tin hành chính**, bấm **Tiếp tục** | Không qua được. Lỗi *Chọn trẻ có sinh non hay không*, *Nhập tuần thai khi sinh* (ô tuần thai luôn có dấu bắt buộc, từ 2026-11-04), *Nhập dân tộc*, *Nhập đối tượng*, *Nhập tỉnh/thành nơi ở*, *Nhập phường/xã nơi ở*, *Nhập số nhà/thôn/xóm nơi ở*. Số định danh và nhóm máu không báo lỗi. Sinh non chỉ có Không/Có |
| I2 | Phó hiệu trưởng Campus 1 | Số định danh `123`, sinh non **Có**, để trống tuần thai, bấm **Tiếp tục**; rồi tuần thai `50`; rồi `38` | *Nhập 12 chữ số (CCCD/mã định danh) hoặc số hộ chiếu 6–12 ký tự*, *Nhập tuần thai khi sinh*, rồi *Nhập tuần thai từ 20 đến 42*, rồi *Trẻ sinh non có tuần thai dưới 37* (sinh non **Không** với `34` tuần thì *Dưới 37 tuần là sinh non: chọn Sinh non là Có hoặc sửa tuần thai*). Sửa thành `999222000888`, `35` tuần, dân tộc `Kinh`, đối tượng `Trẻ em dưới 6 tuổi`, nhóm máu `O`, nơi ở `Hải Phòng` · `Phường Thượng Hồng` · `Số 5 ngõ 2` |
| I3 | Phó hiệu trưởng Campus 1 | Bước Xếp lớp chọn **Lớp Chồi 1**. Bước Khai báo sức khỏe, phần **Tiền sử**: không chọn gì, bấm **Tiếp tục**; rồi bản thân chọn Có, để trống | Ba mục chỉ có Có/Không, chưa chọn sẵn. Lỗi *Chọn Có hoặc Không cho tiền sử bản thân*, *… cho tiền sử gia đình*, *Tiếp xúc người bệnh lao chọn Có hoặc Không*. Rồi *Ghi rõ tên bệnh*. Nhập `Viêm phổi lúc 1 tuổi`, gia đình Không |
| I4 | Phó hiệu trưởng Campus 1 | Tiếp xúc với người bệnh lao chọn **Có**, ngày tiếp xúc gần nhất `15/09/2026` | Hiện ghi chú: khi lưu, hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp |
| I5 | Phó hiệu trưởng Campus 1 | Bước Xem lại, rồi **Lưu hồ sơ tiếp nhận** | Thẻ Thông tin trẻ có mục Thông tin hành chính (số định danh, Sinh non *Có*, Tuần thai khi sinh *35 tuần* là dòng riêng, nhóm máu O). Thẻ Khai báo sức khỏe có 3 dòng tiền sử, ví dụ *Có — Viêm phổi lúc 1 tuổi* |
| I6 | Hiệu trưởng, cô Minh Anh | Mở chuông thông báo | Có *Trẻ có tiền sử tiếp xúc với người bệnh lao* kèm ngày tiếp xúc. Phó hiệu trưởng Campus 1 (người lưu) không nhận |
| I7 | Hiệu trưởng | **Danh sách trẻ**, xem nhanh trẻ vừa nhận | Không có số định danh hay tiền sử tiếp xúc lao trong danh sách |
| I8 | Hiệu trưởng | Mở hồ sơ trẻ vừa nhận → **Sửa hồ sơ**, xóa trống Dân tộc, nhập lý do, lưu | Không lưu được: *Nhập dân tộc* (sửa hồ sơ cũng bắt buộc) |
| I9 | Hiệu trưởng | Mở **Khai báo sức khỏe** của trẻ vừa nhận | Có nút **Sửa khai báo** (Hiệu trưởng sửa được như Phó hiệu trưởng). Tiền sử chỉ Có/Không, có dấu bắt buộc |
| I10 | Phó hiệu trưởng Campus 1 | **Nhập từ Excel → Tải file mẫu** | Dòng mẫu điền đủ các cột hành chính, tiền sử. Thêm 1 dòng để trống Dân tộc và Tiền sử bản thân: xem trước báo *Nhập dân tộc*, *Chọn Có hoặc Không cho tiền sử bản thân* đúng dòng. File mẫu cũ thiếu cột thì báo *Thiếu cột: …* |
| I11 | Cô Minh Anh | Đợt khám Campus 1 → Lớp Chồi 1 → **Khám** Trần Khánh An | Bước 1 có ghi chú *Hành chính lấy từ hồ sơ trẻ, không sửa ở phiếu khám*. Không có ô nhập hành chính: số định danh `999222009007`, sinh non *Có*, tuần thai *35 tuần*, nhóm máu A, nơi ở Số 12 ngõ 5. Dòng **Ngày kiểm tra sức khỏe** là chữ (hôm nay, *Hệ thống ghi ngày khám khi lưu phiếu*), không có ô chọn ngày, không dấu bắt buộc (từ 2026-11-04). Tiền sử là ô chọn, điền sẵn: bản thân Có *Hen phế quản*, gia đình Không, tiếp xúc lao Không |
| I12 | Cô Minh Anh | **Khám** Bùi Bảo Ngọc | Hồ sơ đủ (dữ liệu demo điền đầy): nhóm máu O; tiếp xúc lao *Có — gần nhất ngày 28/07/2026* |
| I13 | Cô Minh Anh | Trần Khánh An, khối **Người đi cùng trẻ**: chọn **Có người đi cùng** | Chỉ chọn được phụ huynh trong hồ sơ (nút tên phụ huynh); họ tên, quan hệ, SĐT, CCCD hiện theo hồ sơ, không sửa được. Có dòng *Người đi cùng không có trong hồ sơ: báo Hiệu trưởng hoặc Phó hiệu trưởng thêm vào hồ sơ trẻ* |
| I14 | Cô Minh Anh | Trần Khánh An: tiền sử gia đình **Có** `Tăng huyết áp (bà ngoại)`, **Lưu nháp**; rồi điền đủ phiếu, **Lưu kết luận** | Sau lưu nháp khai báo chưa đổi. Sau lưu kết luận: hồ sơ trẻ (hành chính) không đổi. Khai báo sức khỏe: tiền sử gia đình *Có — Tăng huyết áp (bà ngoại)*, lịch sử *Cập nhật tiền sử từ phiếu khám*, *Tiền sử gia đình: Không → Có — Tăng huyết áp (bà ngoại)* |
| I15 | Phó hiệu trưởng Campus 1 | **Sửa hồ sơ** Trần Khánh An: nhóm máu `AB`, lý do, lưu. Cô Minh Anh mở lại phiếu đã kết luận | Phiếu vẫn hiện nhóm máu A (giữ thông tin lúc lưu kết luận). Phiếu mới hoặc phiếu nháp thì hiện hồ sơ hiện tại |
| I16 | Hiệu trưởng | Mở hồ sơ Nguyễn Hoàng Nam (trẻ tiếp nhận từ trước) | Đủ thông tin hành chính và tiền sử (dữ liệu demo điền đầy, 2026-10-22) |
