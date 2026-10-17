---
title: Sức khỏe — phiếu kiểm tra sức khỏe theo Phụ lục II (TT 33/2026) và kết luận bác sĩ
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: feature/FE-FEAT-43-child-health-pickup
modules: [health, child]
rules: [HLT-01, HLT-02, HLT-04, HLT-05, PAR-02]
risk: high           # dữ liệu sức khỏe nhạy cảm (tâm lý, nguy cơ tự kỷ, lao), đổi nguồn mở phiếu theo dõi, đổi quyết định đã chốt, nâng cấp dữ liệu demo
created: 2026-10-17
updated: 2026-10-17
---
# Sức khỏe — phiếu kiểm tra sức khỏe theo Phụ lục II (TT 33/2026) và kết luận bác sĩ

Plan chỉ phần client. User chốt 2026-10-17: bỏ qua BE khi thiết kế tính năng này, vì BE là bản cũ và sẽ sửa sau khi FE hoàn thiện. FE dẫn nghiệp vụ bằng backend giả. Plan nối tiếp [plan đợt khám](../completed/2026-10-15-health-check-campaign-assessment.md) và [plan phiếu theo dõi dài hạn](../completed/2026-10-16-health-follow-up-long-lived.md).

## Luồng chi tiết (bản để duyệt)
Mã trong ngoặc (D1, D2…) trỏ tới mục "Mặc định đề xuất" bên dưới.

### A. Khám 1 trẻ tại bàn khám
1. **Mở phiếu** (D1, D3). Giáo viên vào đợt khám đang diễn ra, mở danh sách lớp mình, bấm "Khám" cạnh tên trẻ. Mỗi trẻ có 1 phiếu trong 1 đợt.
   - Phần I điền sẵn: họ tên, ngày sinh, giới, tên trường, ngày khám, cơ sở khám (lấy từ đơn vị khám của đợt).
   - Dân tộc, đối tượng, nguồn chi trả, nhóm máu, sinh non, tuần thai, nơi ở: lấy từ phiếu lần trước của trẻ. Lần đầu khám thì giáo viên hỏi phụ huynh rồi nhập.
   - Các ô này chỉ lưu trên phiếu, không sửa hồ sơ trẻ.
2. **Chọn người đi cùng** (D3, D4). Giáo viên chọn từ danh sách phụ huynh của trẻ; tên, quan hệ, SĐT tự điền.
   - Người đi cùng không có trong danh sách (ví dụ bà, cô) thì giáo viên nhập tên, quan hệ, SĐT.
   - Ô CCCD/mã định danh của trẻ và của người đi cùng: nhập được, không bắt buộc; lần sau điền sẵn từ phiếu trước (D4).
3. **Hỏi tiền sử.** Giáo viên hỏi phụ huynh 3 việc rồi nhập: tiền sử bệnh của trẻ, tiền sử bệnh của gia đình, trẻ có tiếp xúc với người bệnh lao không. Lần khám sau, phần này điền sẵn từ phiếu này.
4. **Đo** (bước 2 của phiếu; D5, D6). Nhân viên y tế đo nhiệt độ, mạch, nhịp thở, chiều cao, cân nặng, vòng đầu, vòng cánh tay. Giáo viên nhập.
   - Nhập số xong, hệ thống tự chọn trạng thái theo ngưỡng tham khảo của nhóm tuổi (D23): nhiệt độ (Bình thường / Sốt / Hạ thân nhiệt), mạch (Bình thường / Nhanh), nhịp thở (Bình thường / Thở nhanh / Thở chậm). Bác sĩ nói khác thì giáo viên đổi.
   - Ô vòng đầu ẩn khi trẻ trên 60 tháng. Vòng cánh tay không bắt buộc.
   - Ô SD (chiều dài/tuổi, cân nặng/tuổi): nhập số bác sĩ đọc, không bắt buộc. Hệ thống chưa tự tính.
   - Tình trạng dinh dưỡng: bác sĩ chọn (bình thường, suy dinh dưỡng, thừa cân…). Ô này không chọn sẵn.
5. **Phát triển và tiêm chủng** (bước 3; D5).
   - Bác sĩ đánh giá phát triển tinh thần và vận động.
   - Giáo viên xem sổ tiêm chủng phụ huynh mang theo.
   - Các câu ở bước này không chọn sẵn, giáo viên phải chọn từng câu.
   - Câu "nguy cơ tự kỷ" chỉ hiện với trẻ 16–30 tháng.
6. **Khám lâm sàng** (bước 4; D5). Bác sĩ khám da, đầu cổ, mắt, tai, mũi họng, miệng răng, cơ xương và thần kinh. Các mục chọn sẵn "Bình thường" hoặc "Không". Giáo viên chỉ đổi mục bác sĩ nói bất thường.
7. **Tự lưu nháp** (D2). Mỗi lần chuyển bước, hệ thống tự lưu. Danh sách lớp hiện "Đang khám". Bị gián đoạn (đóng trình duyệt, mất mạng) thì mở lại phiếu, tiếp tục ở bước đang dừng.
8. **Cảnh báo trước khi kết luận** (D7, D23, D24). Ở bước 5, hệ thống hiện khối "Điểm cần bác sĩ xem lại" gồm 3 nhóm:
   - **Dấu hiệu sinh tồn ngoài ngưỡng theo tuổi:** nhiệt độ (sốt, hạ thân nhiệt), mạch (nhanh, hoặc thấp hơn khoảng tham khảo), nhịp thở (thở nhanh, thở chậm). Mỗi dòng ghi số đo và khoảng tham khảo của nhóm tuổi. Ví dụ: "Mạch 135 lần/phút, trên khoảng tham khảo 80–120 của trẻ 3–5 tuổi".
   - **Gợi ý kết hợp vòng đầu và phát triển:** hệ thống đếm 3 dấu hiệu: vòng đầu ngoài khoảng tham khảo (to hoặc nhỏ), phát triển tinh thần "Không", phát triển vận động "Không". Có 1 dấu hiệu: "Gợi ý: cần theo dõi". Có từ 2 dấu hiệu: "Gợi ý: cân nhắc chuyển khám chuyên khoa". Trẻ trên 60 tháng không đo vòng đầu, chỉ xét 2 dấu hiệu phát triển.
   - **Các mục khác:** mục đã ghi bất thường ở phần VI, tiền sử "Có", tiếp xúc lao "Có".

   Giáo viên đọc cho bác sĩ nghe. Đây là gợi ý, không phải kết luận. Bác sĩ quyết định ở mục 9.
9. **Kết luận** (D8). Bác sĩ kết luận và nói trực tiếp với phụ huynh. Giáo viên nhập:
   - Kết luận: "Bình thường", hoặc "Có nguy cơ mắc lao", hoặc "Có vấn đề về sức khỏe" (ghi rõ vấn đề). Hai ô sau chọn cùng lúc được.
   - Hướng xử lý: "Không cần", "Tư vấn" (ghi lời dặn), hoặc "Chuyển khám chuyên khoa" (ghi chuyên khoa, ví dụ Mắt).
   - Tên bác sĩ kết luận. Ô này gợi ý các tên đã nhập trong đợt.

   Giáo viên bấm "Lưu kết luận" hoặc "Lưu kết luận và khám trẻ tiếp theo". Thiếu ô bắt buộc thì hệ thống báo lỗi và mở bước có lỗi.

### B. Ngay khi lưu kết luận, hệ thống tự làm
10. **Khóa phiếu** (D12). Muốn sửa phải ghi lý do. Hệ thống lưu ai sửa, lúc nào, giá trị cũ và mới. Giáo viên phụ trách lớp sửa được tới khi đợt đóng.
11. **Xếp mức theo dõi theo kết luận** (D9). Hệ thống không tự đổi mức theo số đo.
    - Bình thường: mức "Không ghi nhận bất thường". Không tạo việc. Lời dặn (nếu có) vẫn lưu.
    - Có vấn đề, không chuyển khám: mức "Cần theo dõi". Trẻ vào danh sách theo dõi của đợt. Không mở phiếu, không nhắc.
    - Chuyển khám chuyên khoa, hoặc có nguy cơ lao: mức "Cần theo dõi sát – đề nghị khám chuyên khoa". Hệ thống mở phiếu theo dõi. Trẻ đã có phiếu đang mở thì phiếu đó sang vòng mới.
12. **Ghi trao đổi tại buổi khám** (D10).
    - Phiếu có người đi cùng: phiếu theo dõi ghi sẵn 1 lần trao đổi (ngày khám, người đi cùng và quan hệ, chuyên khoa, lời dặn). Phiếu theo dõi ở trạng thái "Đã trao đổi, đề nghị khám chuyên khoa". Không có hạn 7 ngày.
    - Phiếu không có người đi cùng: giữ cách cũ. Trạng thái "Chờ trao đổi phụ huynh", hạn 7 ngày, chưa công bố được tới khi giáo viên ghi trao đổi.
13. **Nguy cơ lao** (D11). Hệ thống gửi thông báo "Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)" cho Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp. Phiếu theo dõi có nhãn này. Người xem được giống Sổ sức khỏe.
14. **Công bố cho phụ huynh** (D17). Giáo viên bấm "Công bố". Hộp xác nhận nói phụ huynh sẽ xem toàn bộ phiếu trên APP. Phiếu có người đi cùng công bố được ngay.

### C. Cuối buổi khám — bỏ (user 2026-10-17)
Không in phiếu, không lấy chữ ký bác sĩ, không đánh dấu bản ký trên hệ thống. Mục 15–17 bỏ; giữ số thứ tự các mục sau để không lệch tham chiếu.

### D. Sau buổi khám
18. **Trẻ chuyển khám chuyên khoa** (D15). Phụ huynh đưa trẻ đi khám rồi báo lại. Giáo viên ghi vào phiếu theo dõi:
    - ngày khám;
    - chuyên khoa / nơi khám (bắt buộc);
    - lời bác sĩ chuyên khoa;
    - ngày hẹn khám lại;
    - ảnh giấy kết quả (tùy chọn).

    Không có form chỉ số, vì mỗi nơi khám làm xét nghiệm khác nhau.
19. **Nhắc** (D16). 30 ngày sau lần trao đổi (thường là ngày khám) mà chưa có kết quả chuyên khoa, hệ thống nhắc giáo viên hỏi phụ huynh. Mỗi vòng nhắc 1 lần. Có ngày hẹn khám lại thì tới ngày đó hệ thống nhắc (đã có).
20. **Đóng phiếu theo dõi.** Giáo viên đóng phiếu khi xong việc, ghi lý do (đã có). Trẻ nghỉ học thì phiếu tự đóng (đã có).
21. **Trẻ "Cần theo dõi".** Giáo viên để ý ở lớp. Đợt sau bác sĩ xem lại.
22. **Sổ sức khỏe.**
    - Hiện kết luận, lời dặn, kết quả chuyên khoa gần nhất, tình trạng dinh dưỡng theo bác sĩ, nút xem phiếu.
    - Không còn nhãn "BMI thấp/cao hơn chuẩn". Chỉ hiện số BMI.
23. **Đóng đợt** (D13, D20). Hiệu trưởng đóng đợt.
    - Hộp xác nhận báo số trẻ vắng khám, số phiếu chưa kết luận, số phiếu chờ trao đổi.
    - Phiếu đang nháp hiện "Chưa kết luận", không tính là vắng khám.
    - Tiến độ đợt hiện số trẻ theo kết luận (bình thường, có vấn đề, chuyển khám, nguy cơ lao).
24. **Đợt khám sau** (D18). Phiếu mới điền sẵn thông tin hành chính và tiền sử. Phiếu hiện kết luận, lời dặn, chuyên khoa lần trước và kết quả chuyên khoa gần nhất để bác sĩ tham khảo.

### E. Ngoài đợt khám và dữ liệu cũ
25. **Nhập lẻ ngoài đợt** (D19), ví dụ cân đo tại lớp, không có bác sĩ. Form chỉ có chiều cao, cân nặng, vòng đầu, ghi chú. Không có kết luận, không mở phiếu. Kết quả ghi "Cân đo, chưa có kết luận bác sĩ".
26. **Kết quả cũ** (D21). Kết quả nhập trước tính năng này giữ nguyên, có nhãn "Mẫu cũ". Phiếu theo dõi đang mở không đổi.
27. **AI** (D22). AI giải thích xu hướng chỉ nhận số đo và số BMI. AI không nhận phần phát triển, khám lâm sàng, kết luận.

### F. Khác với cách đang chạy — user đồng ý cả 6 mục (2026-10-17)
1. **Ai xếp mức theo dõi.** Hiện nay hệ thống tự xếp từ vòng đầu và 2 câu vận động. Sau khi đổi: bác sĩ quyết định qua kết luận.
2. **Chỉ số vận động, vòng cánh tay.** Hiện nay có 2 câu vận động thô/tinh và không có vòng cánh tay. Sau khi đổi: theo mẫu (phần IV; có vòng cánh tay, không bắt buộc).
3. **Nhãn BMI.** Hiện nay hệ thống tự gắn nhãn "BMI thấp / bình thường / cao hơn chuẩn". Sau khi đổi: bỏ nhãn, chỉ hiện số BMI; bác sĩ chọn tình trạng dinh dưỡng. Plan thực đơn sau dùng lựa chọn của bác sĩ.
4. **Nhập lẻ.** Hiện nay nhập lẻ dùng form đầy đủ và mở được phiếu. Sau khi đổi: nhập lẻ chỉ cân đo (mục 25).
5. **Chữ "Suy dinh dưỡng", "Béo phì".** Hiện nay code cấm 2 chữ này. Sau khi đổi: 2 chữ được có trong lựa chọn của bác sĩ (mẫu Bộ Y tế). Hệ thống vẫn không tự gắn.
6. **Hạn trao đổi 7 ngày.** Hiện nay mọi phiếu theo dõi chờ trao đổi 7 ngày và chặn công bố. Sau khi đổi: chỉ áp khi không có người đi cùng.

## Context
Nhà trường dùng mẫu "Phiếu kiểm tra sức khỏe học sinh" Phụ lục II, Thông tư 33/2026/TT-BYT. Mẫu có các phần: I. Thông tin hành chính, II. Dấu hiệu sinh tồn, III. Dinh dưỡng, IV. Phát triển tinh thần – vận động, V. Tiêm chủng, VI. Khám lâm sàng, và Kết luận và tư vấn. Bác sĩ ký và đóng dấu ở phần "Người kết luận".

Hiện trạng code:
- Form nhập kết quả chỉ có số đo, vòng đầu, vận động thô/tinh, ghi chú (`src/pages/children/HealthMeasurementFormPage.jsx:390-453`).
- Hệ thống tự tính mức theo dõi từ 3 tiêu chí (`src/services/children/mock/healthScreeningRule.js:33-86`).
- Lưu kết quả gọi `trackFollowUp`. Hàm này mở phiếu khi mức là "Cần theo dõi sát" (`src/services/children/mock/childrenMockRepository.js:793-865`, `src/services/children/mock/healthCheckRule.js:127-172`).
- Công bố bị chặn tới khi giáo viên ghi trao đổi (`src/services/children/mock/healthCheckRule.js:175-182`, `src/services/children/mock/childrenMockRepository.js:867-889`).
- Kết quả khám bên ngoài chỉ có ngày, nội dung, ngày hẹn (`src/services/children/mock/healthCheckMockRepository.js:522-535`).
- Hồ sơ trẻ có họ tên, giới, ngày sinh, lớp, dị ứng, phụ huynh (tên, quan hệ, SĐT) (`src/mocks/schoolSeed.js:85-104`). Hồ sơ không có dân tộc, nơi ở, nhóm máu.
- Đã có sẵn để dùng lại:
  - Ô tải ảnh, nén về 640px (`src/components/upload/ImageUploader.jsx:8`).
  - `Stepper` (`src/components/index.js:15`).
- Phân loại BMI đang hiện ở `src/components/children/ChildBadges.jsx:41`, `src/components/children/MeasurementSummary.jsx:33`, `src/pages/children/ChildHealthRecordPage.jsx:320`, `src/pages/children/HealthTrendPage.jsx:144` và `:332`. AI giả cũng dùng phân loại này (`src/services/children/mock/childrenMockRepository.js:907-951`).

## Quyết định đã chốt
Nguồn: user, 2026-10-17, CONFIRMED. Không đảo khi chưa hỏi user.
1. Web nhập được toàn bộ mẫu Phụ lục II. Giáo viên nhập trực tiếp lúc khám.
2. Khi khám 1 trẻ có mặt: giáo viên (nhập thông tin), bác sĩ và nhân viên y tế (khám), trẻ, phụ huynh của trẻ. Bác sĩ và nhân viên y tế không có tài khoản (giữ quyết định 2026-10-15).
3. Bỏ qua BE khi thiết kế. FE dẫn nghiệp vụ. Đề xuất contract gom lại gửi BE sau khi FE hoàn thiện.
4. Đồng ý cả 6 mục ở phần F: bác sĩ quyết định mức theo dõi qua kết luận; chỉ số theo mẫu (phần IV, có vòng cánh tay); bỏ nhãn BMI tự tính; nhập lẻ chỉ cân đo; chữ "Suy dinh dưỡng"/"Béo phì" được có trong lựa chọn của bác sĩ; hạn 7 ngày chỉ áp khi không có người đi cùng.
5. Bỏ phần C: không in phiếu, không lấy chữ ký, không đánh dấu bản ký (D14 bỏ).
6. Mục A8: hệ thống cảnh báo thêm dấu hiệu sinh tồn ngoài ngưỡng theo nhóm tuổi (nhiệt độ, mạch, nhịp thở) và gợi ý kết hợp vòng đầu với phát triển (D23, D24). Bảng số và cách hiểu "2 loại vận động" còn ở "Câu hỏi mở".

**Mặc định đề xuất, duyệt cùng plan** (D = đề xuất):

*Nhập phiếu*
- **D1.** Phiếu gắn với đợt khám, mỗi trẻ 1 phiếu mỗi đợt (giữ luật hiện tại).
- **D2.** Phiếu có 5 bước:
  1. Hành chính và tiền sử (phần I).
  2. Sinh tồn và dinh dưỡng (phần II–III).
  3. Phát triển và tiêm chủng (phần IV–V).
  4. Khám lâm sàng (phần VI).
  5. Kết luận và tư vấn.

  Chuyển bước thì hệ thống tự lưu nháp. Bản nháp không bắt buộc ô nào.
- **D3.** Phần I điền sẵn họ tên, ngày sinh, giới, tên trường, ngày khám và cơ sở khám (lấy từ đơn vị khám của đợt).
  - Các ô dân tộc, đối tượng, nguồn chi trả, nhóm máu, sinh non, tuần thai, nơi ở: lấy từ phiếu gần nhất của trẻ, sửa được. Hệ thống không ghi ngược các ô này vào hồ sơ trẻ.
  - Người đi cùng: chọn từ danh sách phụ huynh của trẻ (tên, quan hệ, SĐT tự điền), hoặc nhập người khác.
- **D4.** (User đổi 2026-10-17: có lưu CCCD.) Phiếu lưu số CC/CCCD/hộ chiếu/mã định danh của trẻ (ô 2) và của người đi cùng (ô 16), không bắt buộc. Số của trẻ lấy từ phiếu gần nhất; số của người đi cùng lấy từ phiếu gần nhất có cùng người đi cùng. Validation chỉ hỗ trợ nhập: 12 chữ số, hoặc hộ chiếu (chữ và số, 6–12 ký tự). Số chỉ hiện trong phiếu (người xem được Sổ sức khỏe và phụ huynh của trẻ); không hiện ở danh sách, thông báo, AI. Seed dùng số giả bắt đầu bằng `999` (không có mã tỉnh này). Nhóm máu được lưu khi phụ huynh biết (mẫu ghi "nếu có").
- **D5.** Mặc định chọn sẵn:
  - Trạng thái dấu hiệu sinh tồn do hệ thống chọn theo ngưỡng của nhóm tuổi khi nhập số (D23); giáo viên đổi được.
  - Các mục phần VI chọn sẵn "Bình thường" hoặc "Không".
  - Phần IV, phần V và tình trạng dinh dưỡng không chọn sẵn.
  - Câu nguy cơ tự kỷ chỉ hiện khi trẻ 16–30 tháng tuổi tại ngày khám.
  - Ô vòng đầu ẩn khi trẻ trên 60 tháng (giữ quyết định 2026-10-15).
- **D6.** Chỉ số SD (chiều dài/tuổi, cân nặng/tuổi): giáo viên nhập theo số bác sĩ đọc, không bắt buộc. Hệ thống chưa tự tính, vì không chép bảng WHO vào FE. BE tính sau.

*Kết luận và theo dõi*
- **D7.** Ở bước Kết luận, hệ thống hiện khối "Điểm cần bác sĩ xem lại". Khối liệt kê:
  - dấu hiệu sinh tồn ngoài ngưỡng theo nhóm tuổi, kèm số đo và khoảng tham khảo (D23);
  - gợi ý kết hợp vòng đầu và phát triển (D24);
  - mọi mục khác đang chọn lựa chọn bất thường;
  - tiền sử "Có";
  - tiếp xúc lao "Có".

  Khối kèm câu "Gợi ý để bác sĩ xem lại, không phải kết luận."
- **D8.** Phần kết luận theo mẫu:
  - Ô kết luận: "Bình thường" (chọn ô này thì không chọn được 2 ô kia) · "Có nguy cơ mắc lao (tiền sử tiếp xúc)" · "Có vấn đề về sức khỏe" (bắt buộc ghi rõ).
  - Dòng "Cần được tư vấn/chuyển khám chuyên khoa" tách thành 3 lựa chọn: Không cần · Tư vấn (ghi lời tư vấn) · Chuyển khám chuyên khoa (bắt buộc ghi chuyên khoa, lời tư vấn tùy chọn).
  - Bắt buộc ghi tên bác sĩ kết luận. Ô này gợi ý các tên đã nhập trong đợt.
- **D9.** Kết luận bác sĩ quyết định mức theo dõi (phương án A). Hệ thống không tự đổi mức theo số đo.

  | Kết luận | Mức theo dõi | Hệ thống làm |
  | --- | --- | --- |
  | Bình thường, không chuyển khám (có thể có lời tư vấn) | Không ghi nhận bất thường | Không tạo việc |
  | Có vấn đề, không chuyển khám | Cần theo dõi | Vào danh sách theo dõi của đợt, không mở phiếu |
  | Chuyển khám chuyên khoa, hoặc có nguy cơ lao | Cần theo dõi sát – đề nghị khám chuyên khoa | Mở phiếu theo dõi, hoặc mở vòng mới nếu phiếu đang mở |
- **D10.** Phiếu có người đi cùng: khi lưu kết luận, phiếu theo dõi ghi sẵn 1 lần trao đổi tại buổi khám. Lần trao đổi ghi ngày khám, người đi cùng và quan hệ, chuyên khoa, lời tư vấn.
  - Phiếu theo dõi ở trạng thái "Đã trao đổi, đề nghị khám chuyên khoa". Không có hạn 7 ngày. Công bố không bị chặn.
  - Mọi quan hệ có trong mẫu đều tính là đã trao đổi: cha, mẹ, ông/bà, anh/chị, họ hàng, khác.
  - Không có người đi cùng: giữ luồng cũ (chờ trao đổi, hạn 7 ngày, chặn công bố).
- **D11.** Có nguy cơ lao: hệ thống gửi thông báo tiêu đề "Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)" tới Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp. Phiếu theo dõi có nhãn này. Phạm vi xem giữ như Sổ sức khỏe (`canViewHealth`, `src/utils/children/childrenPermissions.js:30`).
- **D12.** Sau khi lưu kết luận, phiếu bị khóa.
  - Sửa phải ghi lý do. Lịch sử lưu người sửa, thời điểm, giá trị cũ và mới (như sửa kết quả đã công bố hiện nay).
  - Giáo viên phụ trách lớp sửa được khi đợt chưa đóng.
  - Sửa làm mức giảm thì phiếu theo dõi không tự đóng (giữ luật cũ).
- **D13.** Đóng đợt: hộp xác nhận báo thêm số phiếu chưa kết luận, nhưng không chặn việc đóng. Phiếu nháp giữ nguyên, hiện "Chưa kết luận", không tính là "Vắng khám".

*Sau kết luận*
- **D14.** Bỏ (user 2026-10-17): không in phiếu, không lấy chữ ký, không đánh dấu bản ký.
- **D15.** Kết quả khám chuyên khoa ghi chữ tự do, không có form chỉ số. Thêm ô "Chuyên khoa / nơi khám" (bắt buộc) và ảnh giấy kết quả (tùy chọn, tối đa 3). Giữ các ô ngày khám, nội dung, ngày hẹn.
- **D16.** Nhắc hỏi kết quả chuyên khoa: 30 ngày sau lần trao đổi đầu tiên của vòng mà chưa có kết quả khám bên ngoài, hệ thống nhắc giáo viên lớp. Mỗi vòng nhắc 1 lần.
- **D17.** Phụ huynh xem toàn bộ phiếu đã công bố (giữ quyết định 2026-10-15). Hộp xác nhận công bố nói rõ phụ huynh sẽ xem toàn bộ phiếu. Phần APP sửa sau, ngoài repo này.
- **D18.** Đợt khám sau: form hiện kết luận, lời tư vấn, chuyên khoa được chuyển của lần trước, và kết quả chuyên khoa gần nhất.
- **D19.** Nhập lẻ ngoài đợt (không có bác sĩ): chỉ nhập chiều cao, cân nặng, vòng đầu, ghi chú. Không có kết luận, không có mức theo dõi, không mở phiếu. Kết quả ghi "Cân đo, chưa có kết luận bác sĩ".
- **D20.** Tiến độ đợt thêm số trẻ theo kết luận: bình thường, có vấn đề, chuyển khám, nguy cơ lao.
- **D21.** Dữ liệu cũ (kết quả có trước tính năng này) hiển thị như hiện tại, có nhãn "Mẫu cũ". Mức theo dõi của dữ liệu cũ giữ cách tính cũ, để phiếu theo dõi đang mở không đổi.
- **D22.** AI giả không nhận phần IV, phần VI và phần kết luận (HLT-04). AI chỉ nhận số đo và số BMI.
- **D23.** Ngưỡng dấu hiệu sinh tồn theo nhóm tuổi. Bảng nằm trong backend giả, UI ghi "ngưỡng tham khảo tạm" tới khi bác sĩ/nhân viên y tế của trường xác nhận. Số liệu đề xuất (chờ xác nhận ở "Câu hỏi mở"):

  | Nhóm tuổi tại ngày khám | Mạch bình thường (lần/phút, lúc thức) | Nhịp thở bình thường (lần/phút) |
  | --- | --- | --- |
  | Dưới 12 tháng | 100–180 | 30–53 |
  | 12–35 tháng | 98–140 | 22–37 |
  | 36–71 tháng | 80–120 | 20–28 |
  | Từ 72 tháng | 75–118 | 18–25 |

  - Nguồn mạch và nhịp thở: bảng AHA PALS 2020 (user chọn 2026-10-17), đọc qua bản trích của San Francisco EMS (bản dự thảo); số mạch của nhóm dưới 12 tháng chưa đối chiếu. Bác sĩ xác nhận bảng số trước khi dùng thật (user chốt 2026-10-17).
  - Mạch trên khoảng: "Nhanh". Mạch dưới khoảng: chỉ cảnh báo, vì mẫu không có ô "chậm".
  - Nhịp thở trên khoảng: "Thở nhanh". Dưới khoảng: "Thở chậm".
  - Nhiệt độ (đo ở nách, mọi nhóm tuổi): bình thường 36,0–37,4 °C; sốt từ 37,5 °C; hạ thân nhiệt dưới 36,0 °C (user đồng ý 2026-10-17).
  - Không dùng ngưỡng "thở nhanh" của WHO IMCI (user chọn PALS).
- **D24.** Gợi ý kết hợp vòng đầu và phát triển: đếm vòng đầu ngoài khoảng tham khảo (to hoặc nhỏ), phát triển tinh thần "Không", phát triển vận động "Không". 1 dấu hiệu: "Gợi ý: cần theo dõi". Từ 2 dấu hiệu: "Gợi ý: cân nhắc chuyển khám chuyên khoa". Trẻ trên 60 tháng chỉ xét 2 dấu hiệu phát triển. Khoảng vòng đầu vẫn là ngưỡng tạm hiện có (`src/services/children/mock/healthScreeningRule.js:16`), không chép bảng WHO vào FE. Gợi ý không đổi mức theo dõi (D9).

### Đổi quyết định đã chốt (user đồng ý cả 6 dòng, 2026-10-17)
| Quyết định cũ | Nguồn | Đổi thành |
| --- | --- | --- |
| Hệ thống tính mức theo dõi từ vòng đầu, vận động thô, vận động tinh; mức "Cần theo dõi sát" mở phiếu | [plan 2026-10-15](../completed/2026-10-15-health-check-campaign-assessment.md) QĐ 5–7 | Kết luận bác sĩ quyết định (D9). Cách tính cũ chỉ còn cho dữ liệu cũ (D21) |
| Chỉ số gồm vận động thô và vận động tinh; bỏ vòng cánh tay | plan 2026-10-15 QĐ 2 | Theo mẫu: phần IV (tinh thần, vận động, nguy cơ tự kỷ). Có lại vòng cánh tay (mm), không bắt buộc |
| Hệ thống phân loại BMI (thấp hơn / bình thường / cao hơn chuẩn) | plan 2026-10-15 QĐ 4, 13 | Bỏ nhãn tự tính, chỉ hiện số BMI. Bác sĩ chọn tình trạng dinh dưỡng trên phiếu. Plan thực đơn sau dùng tình trạng dinh dưỡng của bác sĩ |
| Nhập lẻ ngoài đợt dùng form đầy đủ, có phân loại và phiếu | plan 2026-10-15 QĐ 11 | D19 |
| Trong `src` không có chữ "Suy dinh dưỡng", "Béo phì" | plan 2026-10-15 AC-13 | Được xuất hiện trong lựa chọn của bác sĩ trên phiếu (mẫu Bộ Y tế). Hệ thống vẫn không tự gắn các nhãn này |
| Hạn trao đổi 7 ngày; chặn công bố tới khi ghi trao đổi | [plan 2026-10-16](../completed/2026-10-16-health-follow-up-long-lived.md) QĐ 1–2 | Giữ, nhưng chỉ áp khi phiếu không có người đi cùng (D10) |

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor:
    - Giáo viên phụ trách lớp: nhập phiếu, lưu kết luận, công bố, cập nhật phiếu theo dõi.
    - Bác sĩ và nhân viên y tế: khám, không có tài khoản.
    - Phụ huynh: có mặt khi khám; xem phiếu đã công bố trên APP.
    - Hiệu trưởng, Phó hiệu trưởng: xem; nhận thông báo nguy cơ lao và nhắc quá hạn.
  - Outcome: mỗi trẻ trong đợt có 1 phiếu đầy đủ theo mẫu Bộ Y tế và kết luận của bác sĩ. Mỗi trẻ chuyển khám có phiếu theo dõi tới khi có kết quả chuyên khoa.
  - Rule: HLT-01 (CONFIRMED, mở rộng phạm vi phiếu) · HLT-04, HLT-05 (CONFIRMED, AI) · PAR-02 (ACCEPTED). Rule đợt khám và phiếu theo dõi vẫn ở mức đề xuất của 2 plan trước. User bỏ qua BE ở lượt này.
  - Flow:
    - `[S]` Giáo viên mở phiếu từ danh sách lớp.
    - `[B]` Phụ huynh khai tiền sử. `[S]` Giáo viên nhập.
    - `[B]` Nhân viên y tế đo. `[S]` Giáo viên nhập.
    - `[B]` Bác sĩ khám. `[S]` Giáo viên nhập; hệ thống hiện điểm cần xem lại.
    - `[B]` Bác sĩ kết luận, nói với phụ huynh. `[S]` Giáo viên lưu kết luận.
    - `[S]` Hệ thống khóa phiếu, chia hướng, mở phiếu theo dõi và ghi trao đổi tại buổi khám.
    - `[S]` Giáo viên công bố.
    - `[B]` Phụ huynh đưa trẻ đi khám chuyên khoa. `[S]` Giáo viên ghi kết quả chuyên khoa.
    - `[S]` Đợt khám sau hiện lại kết luận và kết quả chuyên khoa.
- **Đối chiếu thiết kế ban đầu:** xem bảng "Đổi quyết định đã chốt". Nhu cầu nhập toàn bộ mẫu đã ghi ở `docs/features/README.md:50-57`. Ghi lại lời bác sĩ không phải hệ thống chẩn đoán. Hệ thống chỉ liệt kê mục đã ghi bất thường, không tự kết luận.
- **Ảnh hưởng:**
  - Module `health` (chủ) và `child` (phụ huynh, scope lớp).
  - Route mới: `/children/health-checks/:campaignId/exam/:childId` (phiếu khám).
  - Route đổi: `/children/health-checks/:campaignId`, `/children/:id/health`, `/children/:id/health/new` (nhập lẻ, D19), `/children/health-trends`, `/children/health-follow-ups`, `/children/health-follow-ups/:followUpId`.
  - Quyền không đổi: nhập và sửa theo `canRecordMeasurement`; xem theo `canViewHealth`.
  - APP: màn sức khỏe phụ huynh hiện toàn bộ phiếu (sửa sau).
  - Dữ liệu cũ: D21. Seed tăng `HEALTH_SEED_VERSION` (`src/services/children/mock/childrenMockRepository.js:69`).

### Câu hỏi mở
Không còn câu hỏi mở (user trả lời 2026-10-17, bảng dưới).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Nhập toàn bộ mẫu Phụ lục II, ai nhập | Có; giáo viên nhập lúc khám | user | 2026-10-17 | `docs/features/README.md` |
| Ai có mặt khi khám | Giáo viên, bác sĩ, nhân viên y tế, trẻ, phụ huynh | user | 2026-10-17 | `docs/features/README.md` |
| Có đối chiếu BE không | Bỏ qua; BE sửa sau khi FE xong | user | 2026-10-17 | `docs/features/README.md` |
| Ai quyết định mở phiếu theo dõi | Kết luận bác sĩ (D9) | user | 2026-10-17 | plan này |
| Mục khác mẫu (vận động, vòng cánh tay, BMI), nhập lẻ, chữ dinh dưỡng, hạn 7 ngày | Đồng ý cả 6 mục phần F | user | 2026-10-17 | plan này |
| In và ký | Bỏ phần C | user | 2026-10-17 | plan này |
| Cảnh báo trước khi kết luận | Thêm sinh tồn theo nhóm tuổi và gợi ý kết hợp vòng đầu, vận động (D23, D24) | user | 2026-10-17 | plan này |
| "2 loại vận động" | Giống mẫu: 2 câu phần IV (phát triển tinh thần, phát triển vận động) | user | 2026-10-17 | D24 |
| Ngưỡng mạch, nhịp thở | PALS cho cả 2; bác sĩ xác nhận bảng số trước khi dùng thật | user | 2026-10-17 | D23 |
| Nhiệt độ | Đo ở nách; sốt từ 37,5 °C; hạ thân nhiệt dưới 36,0 °C | user | 2026-10-17 | D23 |
| Các mục còn lại (A1–A7, A9, B, D, E; D10, D17) | Giữ | user | 2026-10-17 | plan này |
| CCCD | Có lưu (đổi D4) | user | 2026-10-17 | D4 |

## Acceptance criteria
- **AC-1** (`HLT-01`): Given giáo viên phụ trách lớp mở phiếu của 1 trẻ từ danh sách lớp của đợt, Then:
  - phần I có sẵn họ tên, ngày sinh, giới, tên trường, ngày khám, cơ sở khám;
  - các ô hành chính khác lấy từ phiếu gần nhất;
  - người đi cùng chọn được từ phụ huynh của trẻ (tên, quan hệ, SĐT tự điền);
  - ô CCCD/mã định danh của trẻ và người đi cùng nhập được, không bắt buộc, sai định dạng thì báo lỗi; danh sách lớp không hiện số này.
- **AC-2** (`HLT-01`): Given phiếu đang nhập, When chuyển bước, Then phiếu được lưu nháp và danh sách lớp hiện "Đang khám". Mở lại phiếu thì tiếp tục ở bước đã dừng.
- **AC-3** (`HLT-01`): Given phiếu mới, Then:
  - phần VI đã chọn sẵn "Bình thường"/"Không";
  - nhập nhiệt độ, mạch, nhịp thở thì trạng thái tự chọn theo bảng D23 của nhóm tuổi; giáo viên đổi được;
  - phần IV, phần V và tình trạng dinh dưỡng chưa chọn;
  - câu nguy cơ tự kỷ chỉ hiện khi trẻ 16–30 tháng tại ngày khám;
  - ô vòng đầu ẩn khi trẻ trên 60 tháng.
- **AC-4**: Given bước Kết luận, Then khối "Điểm cần bác sĩ xem lại" liệt kê đúng các mục ở D7, kèm câu "Gợi ý để bác sĩ xem lại, không phải kết luận". Không có mục nào thì khối hiện "Không có mục nào được ghi bất thường".
  - Given trẻ 36–71 tháng có mạch 135, Then có dòng "Mạch 135 lần/phút, trên khoảng tham khảo 80–120". Tương tự cho nhịp thở, nhiệt độ ở mỗi nhóm tuổi của D23.
  - Given 0, 1, 2, 3 dấu hiệu ở D24, Then lần lượt: không có gợi ý, "Gợi ý: cần theo dõi", "Gợi ý: cân nhắc chuyển khám chuyên khoa", "Gợi ý: cân nhắc chuyển khám chuyên khoa". Mức theo dõi vẫn theo kết luận bác sĩ.
- **AC-5** (`HLT-01`): When lưu kết luận, Then:
  - thiếu ô bắt buộc: báo lỗi từng ô và nhảy tới bước có lỗi;
  - chọn "Bình thường" thì không chọn được 2 ô kết luận còn lại;
  - chọn "Có vấn đề" thì bắt buộc ghi rõ;
  - chọn "Chuyển khám chuyên khoa" thì bắt buộc ghi chuyên khoa;
  - bắt buộc tên bác sĩ kết luận.
- **AC-6**: Given lưu kết luận, Then mức theo dõi và việc mở phiếu đúng bảng D9. Đổi số đo không làm đổi mức.
- **AC-7**: Given phiếu có người đi cùng và kết luận chuyển khám, Then:
  - phiếu theo dõi ở "Đã trao đổi, đề nghị khám chuyên khoa";
  - dòng thời gian có lần trao đổi tại buổi khám, ghi ngày khám, người đi cùng và quan hệ, chuyên khoa, lời tư vấn;
  - phiếu không có cờ quá hạn;
  - công bố được ngay.

  Given phiếu không có người đi cùng, Then phiếu ở "Chờ trao đổi phụ huynh", hạn 7 ngày, công bố bị chặn.
- **AC-8**: Given kết luận có nguy cơ lao, Then Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp nhận thông báo "Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)". Phiếu theo dõi có nhãn này.
- **AC-9** (`HLT-01`): Given phiếu đã kết luận, When sửa, Then bắt buộc lý do và lịch sử có người sửa, thời điểm, giá trị cũ và mới. Given đợt đã đóng, Then không có nút sửa; nếu vẫn gọi lưu thì nhận 409.
- **AC-10**: Bỏ (phần C bỏ, user 2026-10-17). Then trong UI không có nút in phiếu, không có "Đã có bản ký".
- **AC-11**: Given phiếu theo dõi, When ghi kết quả chuyên khoa, Then bắt buộc "Chuyên khoa / nơi khám"; ảnh giấy kết quả tùy chọn, tối đa 3. Given 30 ngày sau lần trao đổi đầu tiên của vòng mà chưa có kết quả, Then giáo viên lớp nhận nhắc đúng 1 lần.
- **AC-12** (`HLT-02`): Given trẻ có phiếu đã kết luận, Then:
  - Sổ sức khỏe và form đợt sau hiện kết luận, lời tư vấn, chuyên khoa được chuyển, kết quả chuyên khoa gần nhất;
  - tình trạng dinh dưỡng hiện theo lựa chọn của bác sĩ;
  - không còn nhãn phân loại BMI tự tính; số BMI vẫn hiện.
- **AC-13** (`HLT-01`): Given nhập lẻ ngoài đợt, Then form chỉ có chiều cao, cân nặng, vòng đầu, ghi chú. Kết quả ghi "Cân đo, chưa có kết luận bác sĩ" và không mở phiếu.
- **AC-14** (`PAR-02`): Given bấm "Công bố", Then hộp xác nhận nói phụ huynh xem toàn bộ phiếu. Given bấm "Đóng đợt", Then hộp xác nhận nêu số phiếu chưa kết luận; sau khi đóng, các phiếu đó hiện "Chưa kết luận". Tiến độ đợt có số trẻ theo từng kết luận.
- **AC-15** (`HLT-04`, `HLT-05`): Given dữ liệu demo cũ trong localStorage, Then các trang sức khỏe mở được, kết quả cũ có nhãn "Mẫu cũ", phiếu theo dõi đang mở không đổi. Input AI giả không có phần IV, phần VI, kết luận, tên trẻ. Seed có phiếu đủ 4 hướng kết luận và không có dữ liệu thật.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Ai quyết định mức theo dõi | Kết luận bác sĩ (A) | B: hệ thống hoặc bác sĩ, bên nào báo cũng mở phiếu · C: giữ mức hệ thống, kết luận chỉ là ghi chú | Không có 2 nguồn ngược nhau; đúng mẫu Bộ Y tế; hệ thống không tự kết luận |
| Lưu phiếu | Thêm khối `exam` vào kết quả khám (measurement) | Collection phiếu riêng | Sổ sức khỏe, xu hướng, công bố, lịch sử sửa, phiếu theo dõi đang dùng measurement |
| Mô tả các mục của mẫu | 1 file cấu hình (mục, nhãn, lựa chọn, lựa chọn bất thường), UI vẽ theo cấu hình | Viết tay từng mục trong JSX | Mẫu có khoảng 50 mục; dùng chung 1 cấu hình cho form, trang in, khối điểm cần xem lại, lịch sử sửa |
| Trang phiếu | Trang mới `HealthExamFormPage`; `HealthMeasurementFormPage` thu gọn cho nhập lẻ | Mở rộng form hiện có (504 dòng) | Form hiện có đã dài; nhập lẻ không còn kết luận (D19) |
| Bố cục nhập | 5 bước dùng `Stepper`, tự lưu nháp | 1 trang dài | Nhập theo nhịp khám; không mất dữ liệu khi gián đoạn; vừa màn 375px |
| Chỉ số SD | Nhập tay theo bác sĩ | Mock tự tính | Không chép bảng WHO vào FE; số giả dễ bị hiểu là số thật |
| Ngưỡng sinh tồn theo tuổi | Bảng cấu hình trong backend giả, UI ghi "ngưỡng tham khảo tạm" (D23) | Không cảnh báo, để bác sĩ tự chọn trạng thái | User yêu cầu hệ thống cảnh báo (2026-10-17); số chờ bác sĩ trường xác nhận; BE sở hữu sau |
| CCCD | Lưu trong phiếu, không bắt buộc, chỉ hiện trong phiếu | Không lưu | User chọn lưu (2026-10-17); hạn chế chỗ hiện để giảm lộ dữ liệu |

## Phases
### Phase 1 — Mô hình phiếu và backend giả
- Files: C `src/models/children/healthExamForm.js` · M `src/models/children/childrenConstants.js` · M `src/models/children/healthCheckConstants.js` · M `src/services/children/mock/healthScreeningRule.js` · M `src/services/children/mock/healthCheckRule.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/mock/healthCheckMockRepository.js` · M `src/services/children/api/childrenApi.js` · M `src/services/children/api/healthCheckApi.js` · M `src/services/children/childrenService.js` · M `src/services/children/healthCheckService.js` · M `src/utils/children/childrenValidation.js` · M `src/mocks/healthCheckSeed.js` · M `src/mocks/childrenSeed.js`
- Steps:
  1. Cấu hình mẫu Phụ lục II (phần I–VI, kết luận) và typedef `HealthExam`. Measurement thêm `exam`, `examStatus` (`DRAFT`/`CONCLUDED`).
  2. Rule:
     - mức theo dõi theo kết luận (D9);
     - bảng ngưỡng sinh tồn theo nhóm tuổi và trạng thái gợi ý (D23);
     - gợi ý kết hợp vòng đầu và phát triển (D24);
     - điểm cần xem lại (D7);
     - dữ liệu cũ giữ cách tính cũ (D21);
     - bỏ phân loại BMI, giữ số BMI.
  3. Mock:
     - lưu nháp; lưu kết luận (D8); sửa có lý do (D12);
     - trao đổi tại buổi khám (D10); thông báo nguy cơ lao (D11);
     - kết quả chuyên khoa thêm chuyên khoa và ảnh (D15); nhắc sau 30 ngày (D16);
     - đóng đợt đếm phiếu chưa kết luận (D13); tiến độ theo kết luận (D20);
     - trạng thái từng trẻ trong danh sách lớp: chưa khám, đang khám, đã kết luận, vắng khám, chưa kết luận;
     - nhập lẻ thu gọn (D19); input AI giả (D22).
  4. Validation chỉ hỗ trợ nhập liệu (bắt buộc, định dạng). Bản nháp không bắt buộc ô nào.
  5. Seed: phiếu giả đủ 4 hướng kết luận, có và không có người đi cùng; tăng `HEALTH_SEED_VERSION`. Không dữ liệu thật.
- Tests: kịch bản backend giả (scratchpad) cho AC-4 (ngưỡng từng nhóm tuổi, 0–3 dấu hiệu), AC-5..AC-9, AC-11, AC-13..AC-15; chạy lại bộ kịch bản cũ.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.

### Phase 2 — Trang phiếu khám và danh sách lớp
- Files: C `src/pages/children/HealthExamFormPage.jsx` · C `src/components/children/exam/ExamChoiceField.jsx` · C `src/components/children/exam/ExamAdminStep.jsx` · C `src/components/children/exam/ExamConclusionStep.jsx` · M `src/components/children/HealthCheckClassRoster.jsx` · M `src/pages/children/HealthCheckDetailPage.jsx` · M `src/routes/AppRoutes.jsx` · M `src/utils/children/breadcrumbs.js` · M `src/styles/modules/children.css`
- Steps:
  1. Trang phiếu 5 bước (`Stepper`), tự lưu nháp khi chuyển bước. Có nút "Lưu kết luận" và "Lưu kết luận và khám trẻ tiếp theo".
  2. Trường chọn vẽ theo cấu hình. Nhóm lựa chọn dùng `fieldset`/`legend`. Lựa chọn bất thường có tông cảnh báo theo `DESIGN.md`.
  3. Bước 2: trạng thái sinh tồn tự chọn khi nhập số, kèm khoảng tham khảo của nhóm tuổi (D23).
  4. Bước Kết luận gồm khối điểm cần xem lại (D7, D23, D24), kết luận và tư vấn (D8), người đi cùng (D10).
  5. Danh sách lớp hiện trạng thái từng trẻ, nút "Khám" / "Tiếp tục khám" / "Xem phiếu".
  6. Chi tiết đợt hiện tiến độ theo kết luận. Hộp đóng đợt nêu số phiếu chưa kết luận.
- Tests: AC-1..AC-5, AC-14 (đóng đợt): kiểm thủ công trên trình duyệt (giáo viên, Phó hiệu trưởng, Hiệu trưởng) và kịch bản backend giả. Kiểm màn 375px.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; tự kiểm `DESIGN.md` mục 13.1 không ra dòng mới.

### Phase 3 — Sau kết luận: phiếu theo dõi, Sổ sức khỏe, nhập lẻ, tài liệu
- Files: M `src/pages/children/HealthFollowUpDetailPage.jsx` · M `src/pages/children/HealthFollowUpListPage.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/pages/children/HealthTrendPage.jsx` · M `src/components/children/MeasurementSummary.jsx` · M `src/components/children/ChildBadges.jsx` · M `src/routes/AppRoutes.jsx` · tài liệu
- Steps:
  1. Trang xem phiếu đã kết luận (chỉ đọc), mở từ danh sách lớp và Sổ sức khỏe; dùng lại các bước của trang phiếu ở chế độ xem.
  2. Chi tiết phiếu theo dõi:
     - hiện kết luận bác sĩ trường, chuyên khoa được chuyển, lần trao đổi tại buổi khám, nhãn nguy cơ lao;
     - form kết quả chuyên khoa thêm chuyên khoa / nơi khám và ảnh;
     - nhắc sau 30 ngày hiện trên dòng thời gian.
  3. Sổ sức khỏe và Xu hướng:
     - hiện kết luận, lời tư vấn, kết quả chuyên khoa gần nhất, tình trạng dinh dưỡng theo bác sĩ, link xem phiếu;
     - bỏ nhãn phân loại BMI tự tính; kết quả cũ có nhãn "Mẫu cũ".
  4. Form nhập lẻ thu gọn (D19). Hộp công bố nói phụ huynh xem toàn bộ phiếu (D17).
  5. Tài liệu: `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`, `.ai/CONTEXT_MAP.yaml`; 2 plan trước trỏ sang plan này; mục "Đề xuất cho BE"; chạy `node scripts/check-ai-layer.mjs`.
- Tests: AC-10 (không còn in/bản ký), AC-11..AC-13, AC-15 bằng kịch bản và kiểm thủ công; đọc lại câu chữ.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; `node scripts/check-ai-layer.mjs` 0 lỗi.

## Đề xuất cho BE (gom sau khi FE hoàn thiện — user chốt 2026-10-17)
- `BE:docs/business/BUSINESS_RULES.md`:
  - HLT-01: phạm vi phiếu theo Phụ lục II; người nhập là giáo viên; người kết luận là bác sĩ (ghi tên, không có tài khoản).
  - HLT-08: bỏ phân loại BMI tự tính; mức theo dõi theo kết luận bác sĩ.
  - HLT-09: trao đổi tại buổi khám, nguy cơ lao, nhắc kết quả chuyên khoa sau 30 ngày.
- Contract PROPOSED (chốt ở Phase 1, ghi trong `src/services/children/api/childrenApi.js` và `src/services/children/api/healthCheckApi.js`):
  - measurement có `exam`, `examStatus`, và các gợi ý BE tính (`vitalFlags[]`, `combinedHint`, `reviewPoints[]`);
  - lưu nháp và lưu kết luận;
  - kết quả khám bên ngoài có `facility`, `images[]`.
- Ngưỡng sinh tồn theo nhóm tuổi (D23) và gợi ý kết hợp (D24) chuyển sang BE sở hữu.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-4 | HLT-01 | Thủ công trình duyệt + kịch bản backend giả + render thử | 1, 2 | Backend giả đạt (điền sẵn, nháp, cảnh báo sinh tồn/kết hợp); render thử 5 bước đạt · Trình duyệt: chưa chạy |
| AC-5, AC-6, AC-9 | HLT-01 | Kịch bản backend giả + thủ công | 1, 2 | Backend giả đạt (422 đúng bước, mức theo kết luận, lý do sửa, 409 khi đợt đóng) · Trình duyệt: chưa chạy |
| AC-7, AC-8, AC-11 | HLT-01 | Kịch bản backend giả + thủ công | 1, 3 | Backend giả đạt (trao đổi tại buổi khám, chặn công bố khi không có người đi cùng, thông báo lao, chuyên khoa bắt buộc, nhắc 30 ngày) · Trình duyệt: chưa chạy |
| AC-10 | — | `grep` không còn nút in phiếu, "Đã có bản ký" | 3 | Đạt: không có trong `src` |
| AC-12, AC-13 | HLT-02 | Thủ công Sổ sức khỏe, Xu hướng, nhập lẻ | 3 | Backend giả đạt (nhập lẻ MEASUREMENT_ONLY, không phiếu; không còn bmiStatus); render thử MeasurementSummary 3 dạng đạt · Trình duyệt: chưa chạy |
| AC-14 | PAR-02 | Thủ công hộp công bố, đóng đợt | 2, 3 | Backend giả đạt (đóng đợt đếm phiếu chưa kết luận, thống kê theo kết luận) · Trình duyệt: chưa chạy |
| AC-15 | HLT-04, HLT-05 | Kịch bản DB cũ + đọc input AI giả | 1 | Đạt: nâng cấp DB v4; input AI chỉ có ngày, chiều cao, cân nặng, vòng đầu, BMI |

Repo chưa có framework unit test. Thêm framework là thêm dependency, phải hỏi user, nên không nằm trong plan này. "Kịch bản backend giả" = bundle esbuild với localStorage giả, chạy trong scratchpad, không lưu vào repo.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Phiếu dài, nhập chậm khi đông trẻ | Buổi khám kéo dài | Chọn sẵn "Bình thường" (D5), nút "khám trẻ tiếp theo", nhập theo bước | Bớt mục bắt buộc trong cấu hình |
| Gián đoạn giữa chừng (đóng tab, mất mạng) | Mất phần đã nhập | Tự lưu nháp mỗi bước | — |
| Giáo viên ghi sai lời bác sĩ | Kết luận sai trên hệ thống | Bước Kết luận hiện lại toàn bộ lựa chọn để giáo viên đọc cho bác sĩ trước khi lưu; sửa có lý do và lịch sử | Sửa phiếu |
| Ngưỡng sinh tồn sai, hoặc trẻ khóc làm mạch và nhịp thở tăng | Cảnh báo thừa hoặc sai | Chỉ là gợi ý, bác sĩ quyết định; UI ghi "ngưỡng tham khảo tạm"; bác sĩ trường xác nhận bảng số | Sửa bảng trong backend giả |
| Lộ dữ liệu nhạy cảm (tâm lý, nguy cơ tự kỷ, lao, CCCD) | Ảnh hưởng trẻ và gia đình | Phạm vi xem như Sổ sức khỏe; không gửi AI; CCCD chỉ hiện trong phiếu, không ở danh sách hay thông báo; seed dùng số giả `999…` | — |
| localStorage đầy vì ảnh | Mock lỗi khi lưu | Nén 640px, tối đa 3 ảnh | Xóa ảnh khỏi seed |
| Bỏ phân loại BMI ảnh hưởng plan thực đơn | Thực đơn thiếu đầu vào | Plan thực đơn dùng tình trạng dinh dưỡng của bác sĩ | Bật lại nhãn ở constants |
| BE chọn field hoặc luật khác đề xuất | Sửa lại FE | Contract gom ở api và mock; UI đọc giá trị trả về | Revert theo phase |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `HealthExamFormPage`, `HealthCheckClassRoster`, `HealthCheckDetailPage`, `HealthFollowUpDetailPage`, `HealthFollowUpListPage`, `ChildHealthRecordPage`, `HealthTrendPage`, `HealthMeasurementFormPage`, `MeasurementSummary`, `ChildBadges`, AI giả; APP màn sức khỏe phụ huynh
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: không tách plan, vì Phase 2–3 phụ thuộc dạng dữ liệu của Phase 1; 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (ngưỡng vòng đầu vẫn là ngưỡng tạm; rule đợt khám và phiếu theo dõi vẫn là đề xuất)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-17 — Plan draft (chờ duyệt)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Tiếp: user duyệt D1–D22 và bảng "Đổi quyết định đã chốt", rồi bắt đầu Phase 1.

### 2026-10-17 — User duyệt một phần (chờ trả lời câu hỏi mở)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Nội dung: user đồng ý cả 6 mục phần F; bỏ phần C (in, ký, bản ký); thêm cảnh báo sinh tồn theo nhóm tuổi và gợi ý kết hợp vòng đầu + phát triển (D23, D24).
- Tiếp: trả lời 4 câu ở "Câu hỏi mở", rồi `status: approved` và bắt đầu Phase 1.

### 2026-10-17 — Plan approved
- User trả lời 4 câu: giống mẫu (phần IV); PALS, bác sĩ xác nhận bảng số; đồng ý nhiệt độ; giữ các mục còn lại, có lưu CCCD (D4 đổi). Chạy liên tục các phase (user duyệt trước plan làn L, 2026-10-15).

### 2026-10-17 — Phase 1 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Kiểm thêm: kịch bản backend giả 60/60 (bundle bằng Vite API trong scratchpad, localStorage giả): danh sách lớp đủ 4 hướng kết luận + phiếu nháp; cảnh báo sinh tồn theo nhóm tuổi, gợi ý kết hợp; lưu nháp, lưu kết luận thiếu ô (422, khóa lỗi đúng bước), sửa cần lý do, lịch sử sửa; chuyển khám có/không người đi cùng (trao đổi tại buổi khám, chặn công bố); thông báo nguy cơ lao; gộp vào phiếu đang mở; nhập lẻ chỉ cân đo; kết quả chuyên khoa cần chuyên khoa/nơi khám, nhắc 30 ngày; đóng đợt với phiếu nháp ("Chưa kết luận"); nâng cấp DB v4.
- Khác plan:
  - Thêm `src/services/children/mock/healthExamMockRepository.js` (API phiếu khám), `src/utils/children/healthExamValidation.js`, `src/utils/children/healthExamHints.js` thay vì dồn vào file cũ (file cũ đã dài).
  - Phiếu nháp nằm trong `healthMeasurements` với `examStatus: 'DRAFT'`; Sổ sức khỏe, xu hướng, phiếu theo dõi, AI bỏ qua phiếu nháp.
  - Nhập lẻ: vòng đầu không bắt buộc (cân đo tại lớp thường chỉ cân, đo chiều cao).
  - Trạng thái vòng đầu trên phiếu do bác sĩ chọn (form gợi ý theo khoảng tạm); gợi ý kết hợp đếm theo lựa chọn này.
  - Lịch sử sửa che số CCCD (chỉ hiện 3 số cuối).
  - Nhãn mức `UNAVAILABLE` đổi thành "Chưa có kết luận bác sĩ".
- Tiếp: Phase 2.

### 2026-10-17 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Khác plan: các bước tách thành `ExamFields.jsx`, `ExamAdminStep.jsx`, `ExamMeasureStep.jsx`, `ExamDevelopmentStep.jsx`, `ExamClinicalStep.jsx`, `ExamConclusionStep.jsx`, `ExamSummary.jsx` (mỗi file 1 bước, dễ đọc); chế độ xem phiếu đã kết luận nằm trong `HealthExamFormPage` (không tạo trang xem riêng); `ChildBadges` thêm `ConclusionCategoryBadge` và trạng thái "Đang khám", "Chưa kết luận".

### 2026-10-17 — Phase 3 (done) + đóng plan
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `node scripts/check-ai-layer.mjs` 0 lỗi.
- Kiểm thêm: kịch bản backend giả 60/60 (chạy lại sau Phase 3); render thử bằng `react-dom/server` 31/31 (5 bước phiếu với phiếu mới và 6 phiếu seed, bản xem phiếu, `MeasurementSummary` 3 dạng, phiếu theo dõi có nguy cơ lao). Tự kiểm `DESIGN.md` 13.1 trên file đã sửa: 0 mã màu, 0 px mới, 0 import Tabler, 0 `style={{}}` mới. `grep` "Suy dinh dưỡng"/"béo phì" chỉ còn trong lựa chọn của bác sĩ (`healthExamForm.js`). **Chưa kiểm thủ công trên trình duyệt** (phiên không có công cụ trình duyệt) — cần chạy `npm run dev` và đi luồng giáo viên Lớp Mầm 1 / Chồi 1, Phó hiệu trưởng, Hiệu trưởng trước khi demo.
- Khác plan: không tạo trang in (phần C bỏ); `ChildProfilePage` đổi nút thành "Nhập cân đo ngoài đợt"; danh sách phiếu theo dõi hiện đề nghị của bác sĩ và chip nguy cơ lao.
- Tiếp: user kiểm trên trình duyệt; bác sĩ trường xác nhận bảng ngưỡng sinh tồn (D23); xin phép sửa repo BE để ghi mục "Đề xuất cho BE"; APP màn sức khỏe phụ huynh hiện toàn bộ phiếu.

### 2026-10-17 — Bổ sung dữ liệu demo đủ trường hợp thử (yêu cầu sau khi đóng plan)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Nội dung: seed v6 (`HEALTH_SEED_VERSION = 6`). Bảng `EXAM_CASES` trong `src/mocks/childrenSeed.js` ghi trường hợp của từng trẻ: đợt đang diễn ra ở c1 có đủ kết luận (bình thường, tư vấn, chuyển khám có/không người đi cùng, nguy cơ lao, lao + vấn đề), phiếu nháp ở bước 1, 2, 4, 5, phiếu đã sửa, kết quả mẫu cũ trong đợt, trẻ 27 tháng có câu nguy cơ tự kỷ (thêm trẻ `ch_037` vào `src/mocks/schoolSeed.js`), cảnh báo sinh tồn đủ loại; Lớp Chồi 1 để trống để khám từ đầu; cân đo ngoài đợt sau 17/10. Thêm đợt đã đóng `hc_c2_2610` ở c2 (phiếu chưa kết luận, đã công bố, phiếu theo dõi có kết quả chuyên khoa kèm ảnh mẫu SVG, phiếu quá hạn). Phiếu theo dõi seed: nhắc 30 ngày (`fu_ch_027`), nhắc ngày hẹn và vòng mới có trao đổi tại buổi khám (`fu_ch_019`).
- Kiểm thêm: kịch bản phủ dữ liệu 34/34 (DB mới), kịch bản backend giả 60/60, render thử 31/31.
- Lưu ý: trẻ mới `ch_037` chỉ có sau "Khôi phục dữ liệu demo" (seed trường không tự nâng cấp DB cũ).
