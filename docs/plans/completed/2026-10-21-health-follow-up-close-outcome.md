---
title: Sức khỏe — khám trẻ đang có phiếu theo dõi, đóng phiếu theo kết quả chuyên khoa
status: done         # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: G94-180
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [health, child]
rules: [HLT-01]
risk: high           # dữ liệu sức khỏe; đổi vòng đời phiếu theo dõi và mẫu kết luận đã chốt; thêm mức theo dõi (contract PROPOSED); nâng cấp dữ liệu demo
created: 2026-10-21
updated: 2026-10-21
---
# Sức khỏe — khám trẻ đang có phiếu theo dõi, đóng phiếu theo kết quả chuyên khoa

Plan chỉ phần client; FE dẫn nghiệp vụ bằng backend giả, BE làm theo sau (user chốt 2026-10-17). Nối tiếp [plan phiếu theo dõi dài hạn](../completed/2026-10-16-health-follow-up-long-lived.md) và [plan phiếu khám Phụ lục II](../completed/2026-10-17-health-exam-form-doctor-conclusion.md). User yêu cầu 2026-10-21: lưu phần đóng phiếu vào plan; cùng ngày user đổi: lưu kết luận không đóng phiếu, trẻ có phiếu mở dùng mẫu kết luận riêng.

## Luồng (bản để duyệt)
Mã trong ngoặc (D1, D2…) trỏ tới mục "Mặc định đề xuất".

### A. Lúc khám trẻ đang có phiếu theo dõi
1. **Hiện phiếu đang mở** (D1). Bước Kết luận hiện khối "Trẻ đang có phiếu theo dõi": ngày mở, chuyên khoa đã đề nghị, trạng thái, kết quả chuyên khoa gần nhất, ngày hẹn khám lại, nhãn nguy cơ lao. Dữ liệu lấy từ chính phiếu theo dõi, nên vẫn hiện khi giữa hai đợt có lần cân đo ngoài đợt.
2. **Một câu kết luận thay cho 2 nhóm cũ** (D2). Nhóm "Kết luận" (Bình thường / Có vấn đề…) và nhóm "Hướng xử lý" (Không cần / Tư vấn / Chuyển khám) được thay bằng câu "So với vấn đề đang theo dõi, bác sĩ kết luận", không chọn sẵn:
   - "Chưa ghi nhận thêm bất thường";
   - "Tư vấn": có vấn đề nhỏ mới, bác sĩ chỉ tư vấn; ghi rõ vấn đề và lời tư vấn;
   - "Có thêm bất thường mới": ghi rõ bất thường; chuyên khoa đề nghị và lời tư vấn ghi nếu có.
   Ô "Có nguy cơ mắc lao (tiền sử tiếp xúc)" và tên bác sĩ kết luận giữ nguyên. Hộp "Bác sĩ vẫn kết luận như vậy?" vẫn hiện khi còn điểm cần xem lại mà bác sĩ chọn "Chưa ghi nhận thêm" hoặc "Tư vấn".
3. **Nguy cơ lao** (D3). Tích ô nguy cơ lao thì xử lý như "Có thêm bất thường mới", kèm nhãn và thông báo lao như hiện nay.

### A2. Lúc khám trẻ không có phiếu theo dõi đang mở
3a. **Có vấn đề thì hỏi "mới hay đã biết"** (D13). Mẫu kết luận giữ như hiện nay. Bác sĩ tích "Có vấn đề về sức khỏe" mà không chuyển khám, không có nguy cơ lao thì giáo viên chọn thêm, không chọn sẵn:
   - "Vấn đề mới hoặc có thay đổi": trẻ ở mức Cần theo dõi;
   - "Vấn đề đã biết, không thay đổi so với trước": trẻ ở mức Vấn đề đã biết, ổn định.

### B. Khi lưu kết luận
4. **Chưa ghi nhận thêm bất thường, hoặc Tư vấn** (D4, D5). Phiếu theo dõi giữ mở, giữ trạng thái, không có nhắc hay thông báo mới. Lần khám hiện trên dòng thời gian của phiếu với nhãn lựa chọn. Công bố như thường: có người đi cùng thì tự công bố.
5. **Có thêm bất thường mới** (D5). Phiếu sang vòng theo dõi mới như chuyển khám hiện nay. Có người đi cùng: hệ thống ghi sẵn lần trao đổi tại buổi khám. Không có người đi cùng: "Chờ trao đổi phụ huynh", hạn 7 ngày, chưa công bố được tới khi ghi trao đổi. Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp nhận thông báo.
6. **Lưu kết luận không bao giờ đóng phiếu.** Mức hiện tại của trẻ giữ "Cần theo dõi sát" tới khi giáo viên đóng phiếu (D4, D10).
7. **Sửa phiếu đã kết luận** (D6). Đổi lựa chọn thì vòng và trạng thái của phiếu tính lại; phiếu không đóng, trao đổi đã ghi giữ nguyên. Phiếu khám đã mở ra phiếu theo dõi thì khi sửa vẫn dùng mẫu kết luận thường.

### C. Sau buổi khám, ở phiếu theo dõi
8. **Ghi kết quả chuyên khoa không có ngày hẹn thì mở hộp đóng phiếu** (D7). Giáo viên chọn "Để phiếu mở" hoặc "Đóng phiếu". Có ngày hẹn khám lại thì phiếu vẫn mở để hệ thống nhắc đúng ngày.
9. **Đóng phiếu phải chọn kết quả** (D8). Lý do vẫn bắt buộc.
   - "Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường)": trẻ sang mức Không ghi nhận bất thường.
   - "Chuyên khoa xác định có vấn đề, đã có hướng điều trị", kèm tên vấn đề (ví dụ "Cận thị – đeo kính"): trẻ sang mức Vấn đề đã biết, ổn định.
   - "Không có kết quả chuyên khoa" (phụ huynh không đưa trẻ đi khám, mất liên lạc…): giữ mức của lần khám gần nhất tới đợt sau.
   - Còn cần khám chuyên khoa, tái khám hoặc cần quan sát tiếp thì không đóng phiếu (user 2026-10-21, 1b).
10. **Ghi vấn đề đã biết vào tiền sử** (D9). Chọn "Chuyên khoa xác định có vấn đề" thì hệ thống thêm tên vấn đề vào tiền sử bản thân, ghi lịch sử "Cập nhật tiền sử từ phiếu theo dõi ngày …". Đợt khám sau phiếu khám điền sẵn tiền sử này.

### D. Mức hiện tại của trẻ
11. **Mức hiện tại** (D10). Trẻ có phiếu mở: "Cần theo dõi sát". Không có phiếu mở: kết luận gần nhất của bác sĩ, lấy lần khám có kết luận hoặc lần đóng phiếu có kết quả, lần nào mới hơn. Cân đo ngoài đợt và phiếu nháp không tính.
12. **Mức mới "Vấn đề đã biết, ổn định"** (D11). Sinh từ đóng phiếu có kết quả "Chuyên khoa xác định có vấn đề", hoặc từ lần khám chọn "Vấn đề đã biết, không thay đổi". Tông nhãn thông tin, không phải cảnh báo. Danh sách trẻ hiện "Vấn đề đã biết, ổn định · Cận thị – đeo kính" và ngày của kết quả. Bộ lọc có thêm mức này. Đóng với "Không có kết quả chuyên khoa" thì danh sách giữ mức lần khám, thêm dòng "Phiếu đã đóng ngày …, chưa có kết quả chuyên khoa".

### E. Giữ nguyên
13. Giáo viên phụ trách lớp đóng tay được bất cứ lúc nào. Trẻ nghỉ học thì phiếu tự đóng, không chọn kết quả. Phiếu nháp, cân đo ngoài đợt và kết quả mẫu cũ không mở, không đổi phiếu. Trẻ không có phiếu mở dùng mẫu kết luận như hiện nay. Câu "Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường." giữ nguyên.

### Ngoài phạm vi plan này
- Có nguy cơ lao thì bắt buộc chuyển khám (đề xuất 2026-10-20, user chưa chốt).
- Hiện tên vấn đề cạnh nhãn "Cần theo dõi" ở danh sách trẻ (đề xuất 2026-10-21, user chưa chốt).

## Context
User rà phiếu theo dõi (2026-10-20, 2026-10-21) và thấy 3 chỗ không hợp lý: lần khám sau bác sĩ kết luận bình thường mà phiếu cũ vẫn mở; đóng phiếu xong danh sách trẻ vẫn "Cần theo dõi sát" tới đợt sau; trẻ có vấn đề đã biết (ví dụ cận thị đang đeo kính) bị gắn cảnh báo mỗi đợt. Hiện trạng:
- Mẫu kết luận có 2 nhóm "Kết luận" và "Hướng xử lý" cho mọi trẻ (`src/models/children/healthExamForm.js:239-258`); mức và nhóm kết luận tính ở `src/services/children/mock/healthScreeningRule.js:171-179`; kiểm nhập ở `src/utils/children/healthExamValidation.js:156-166`.
- Lưu kết luận chỉ đưa kết quả "Cần theo dõi sát" vào phiếu; mức khác không đụng phiếu đang mở (`src/services/children/mock/healthCheckRule.js:164`). Kết quả mới vào phiếu đã trao đổi thì mở vòng mới (`healthCheckRule.js:52-90`); chặn công bố theo vòng (`healthCheckRule.js:222-228`).
- Phiếu còn mở thì nhắc chạy: quá hạn trao đổi, 30 ngày chưa có kết quả, ngày hẹn khám lại (`healthCheckRule.js:246-270`).
- Đóng phiếu chỉ nhận lý do (`src/services/children/mock/healthCheckMockRepository.js:600-614`, `src/utils/children/childrenValidation.js:147-149`). Ghi kết quả chuyên khoa không gợi ý đóng phiếu (`healthCheckMockRepository.js:574-598`). Lời nhắc ở trang phiếu nói phiếu "tiếp tục mở để theo dõi ở các đợt khám sau" (`src/pages/children/HealthFollowUpDetailPage.jsx:329`). Hộp đóng phiếu chỉ có ô lý do (`HealthFollowUpDetailPage.jsx:584-617`).
- Mức trên danh sách trẻ chỉ lấy lần khám gần nhất có xếp mức (`src/services/children/mock/childrenMockRepository.js:217-226`); bộ lọc và nhãn ở `src/pages/children/ChildrenListPage.jsx:36-43`, `:70`, `:342-347`; tông nhãn ở `src/components/children/ChildBadges.jsx:67-77`; các mức ở `src/models/children/childrenConstants.js:98-108`.
- Phiếu khám chỉ thấy phiếu theo dõi qua "Lần khám trước" và kết quả chuyên khoa gần nhất; lần đo gần nhất là cân đo ngoài đợt thì mất phần chuyển khám (`src/services/children/mock/healthExamMockRepository.js:306-308`, `src/pages/children/HealthExamFormPage.jsx:90-93`).
- Hộp hỏi lại ở `HealthExamFormPage.jsx:346` (hộp ở `:680-712`); màn kết quả chỉ báo khi mở phiếu (`HealthExamFormPage.jsx:450-473`). Lưu kết luận gọi `trackFollowUp` (`healthExamMockRepository.js:455-458`); cân đo ngoài đợt gọi với mức "Chưa có kết luận bác sĩ" (`childrenMockRepository.js:1009`, `:1020`).
- Thống kê đợt đếm theo nhóm kết luận (`healthCheckMockRepository.js:158`). Kết luận hiện ở `src/components/children/exam/ExamSummary.jsx:43`, `:190` và `src/components/children/MeasurementSummary.jsx`.
- Ghi ngược tiền sử từ phiếu khám đã có mẫu (`healthExamMockRepository.js:116-150`). Tiền sử bản thân là `{ state, text }` (`src/models/children/childProfile.js:17-20`).
- Dữ liệu demo: `HEALTH_SEED_VERSION = 8` (`childrenMockRepository.js:83`), nâng cấp phiếu theo dõi ở `childrenMockRepository.js:121-133`.
- Kiểm thử: repo đã chạy `node:test` với backend giả (`tests/kitchen/dry-stock.test.mjs`), chưa có bộ cho sức khỏe; `npm run verify` gom các bộ test (`package.json:16`).
- Kịch bản thử tay T1 và C5 đang ghi luật cũ (`docs/quality/manual-tests/health-exam-flow.md:58`, `:211`).

## Quyết định đã chốt
Nguồn: user, CONFIRMED. Không đảo khi chưa hỏi user.
1. "Cần theo dõi" nghĩa là vấn đề có thể chuyển biến. Vấn đề đã biết, không thay đổi ở mức mới "Vấn đề đã biết, ổn định" — user, 2026-10-21 (vòng 1, 1a).
2. Câu "mới hay đã biết" cho trẻ không có phiếu mở không chọn sẵn — user, 2026-10-21 (vòng 1, 2a). Gộp vào plan này — user, 2026-10-21 (vòng 3, 2a).
3. Lưu kết luận không đóng phiếu theo dõi — user, 2026-10-21.
4. Trẻ có phiếu đang mở: gộp 2 nhóm "Kết luận" và "Hướng xử lý" thành 1 câu 3 lựa chọn "Chưa ghi nhận thêm bất thường", "Tư vấn", "Có thêm bất thường mới" — user, 2026-10-21 (vòng 2, 1a).
5. "Tư vấn" là có vấn đề nhỏ mới, bác sĩ chỉ tư vấn, không thêm vào phiếu — user, 2026-10-21 (vòng 2, 2a).
6. "Có thêm bất thường mới" đưa phiếu sang vòng mới, trao đổi lại với phụ huynh, có thể ghi chuyên khoa — user, 2026-10-21 (vòng 2, 3a).
7. Phiếu còn mở thì mức hiện tại của trẻ giữ "Cần theo dõi sát" tới khi đóng phiếu; lần khám hiện "Chưa ghi nhận thêm bất thường" — user, 2026-10-21 (vòng 2, 4a).
8. Kết quả đóng phiếu "Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường)" — user, 2026-10-21 (vòng 2, 5a).
8b. Không có kết quả đóng phiếu "Cần theo dõi tiếp ở lớp"; trẻ còn cần quan sát thì giữ phiếu mở — user, 2026-10-21 (vòng 3, 1b).
9. Giữ: 1 phiếu dài hạn mỗi trẻ; phiếu đã đóng thì lần chuyển khám sau mở phiếu mới ([plan 2026-10-16](../completed/2026-10-16-health-follow-up-long-lived.md) dòng 32, 45); câu "Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường."

**Mặc định đề xuất, duyệt cùng plan** (D = đề xuất):
- **D1.** Phiếu khám trả `conclusionMode`: `FOLLOW_UP` khi trẻ có phiếu theo dõi đang mở mà phiếu khám này không phải phiếu đã mở ra phiếu đó; còn lại `STANDARD`. Kèm `openFollowUp`: id, ngày mở, trạng thái, số ngày quá hạn, chuyên khoa đề nghị gần nhất, nguy cơ lao, kết quả chuyên khoa gần nhất (ngày, nơi khám, lời bác sĩ, ngày hẹn). UI vẽ mẫu theo `conclusionMode`, không tự xét.
- **D2.** Mẫu `FOLLOW_UP` lưu `exam.conclusion.followUpFinding`: `NO_NEW_FINDING` · `ADVICE` (bắt buộc ghi rõ vấn đề và lời tư vấn) · `NEW_FINDING` (bắt buộc ghi rõ bất thường; chuyên khoa, lời tư vấn tùy chọn). Các ô `normal`, `healthIssue`, `action` của mẫu thường để trống. Không chọn sẵn. Hộp hỏi lại hiện khi còn điểm cần xem lại và lựa chọn là `NO_NEW_FINDING` hoặc `ADVICE`, không tích nguy cơ lao.
- **D3.** Mẫu `FOLLOW_UP` có tích nguy cơ lao ⇒ xử lý như `NEW_FINDING`; nhóm kết luận và thông báo lao như hiện nay.
- **D4.** Lần khám mẫu `FOLLOW_UP` có mức "Cần theo dõi sát" (trẻ vẫn trong phiếu). Sổ sức khỏe, xem phiếu và dòng thời gian hiện nhãn lựa chọn ("Chưa ghi nhận thêm bất thường", "Tư vấn: …", "Có thêm bất thường mới: …") thay cho nhãn mức. Nhóm kết luận cho tiến độ đợt: `NO_NEW_FINDING` ⇒ nhóm mới "Đang theo dõi, chưa ghi nhận thêm"; `ADVICE` ⇒ "Có vấn đề, tư vấn"; `NEW_FINDING` ⇒ nhóm mới "Đang theo dõi, có bất thường mới"; nguy cơ lao ⇒ "Nguy cơ lao".
- **D5.** Lưu kết luận mẫu `FOLLOW_UP`:
  - `NO_NEW_FINDING`, `ADVICE`: thêm sự kiện `MEASUREMENT_ADDED` với `newFinding: false`; không mở vòng mới, không đổi trạng thái, không thông báo, không chặn công bố.
  - `NEW_FINDING` hoặc nguy cơ lao: `MEASUREMENT_ADDED` với `newFinding: true`, mở vòng mới như chuyển khám hiện nay (trao đổi tại buổi khám khi có người đi cùng; không có ⇒ hạn 7 ngày, chặn công bố). Thông báo tiêu đề "Trẻ có thêm bất thường mới" (nguy cơ lao giữ tiêu đề lao) tới Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp, trừ người lưu.
- **D6.** Sửa lần khám mẫu `FOLLOW_UP`: đổi lựa chọn ⇒ cập nhật `newFinding` của sự kiện, vòng và trạng thái tính lại; không đóng phiếu, không xóa trao đổi đã ghi; sửa sang `NEW_FINDING` thì gửi thông báo như lưu mới. Phiếu theo dõi đã đóng sau lần khám đó ⇒ sửa không mở lại phiếu.
- **D7.** Lưu kết quả chuyên khoa không có ngày hẹn khám lại ⇒ trang phiếu mở hộp đóng phiếu ngay, với dòng "Kết quả không có ngày hẹn khám lại. Đóng phiếu nếu nhà trường đã xong việc theo dõi." Nút "Để phiếu mở" / "Đóng phiếu".
- **D8.** Đóng phiếu bắt buộc chọn `outcome`, không chọn sẵn:
  - `DOCTOR_NORMAL` — Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường); chọn được khi phiếu có kết quả khám bên ngoài hoặc có lần khám sau ngày mở phiếu;
  - `KNOWN_CONDITION` — Chuyên khoa xác định có vấn đề, đã có hướng điều trị; bắt buộc `conditionText` (tên vấn đề, tối đa 100 ký tự); chọn được khi phiếu có kết quả khám bên ngoài;
  - `NO_SPECIALIST_RESULT` — Không có kết quả chuyên khoa.
  - Lựa chọn không đủ điều kiện ⇒ 422. Lý do vẫn bắt buộc. Đóng do trẻ nghỉ học không có `outcome`.
- **D9.** `KNOWN_CONDITION` ⇒ tiền sử bản thân thành "Có", tên vấn đề nối vào nội dung đang có (bỏ qua nếu đã có đúng tên đó), giữ trong giới hạn độ dài của ô tiền sử; vượt thì báo lỗi ở ô tên vấn đề. Lịch sử khai báo ghi `UPDATED_FROM_FOLLOW_UP` kèm giá trị cũ và mới. Không gửi thông báo. Trẻ chưa có khai báo thì tạo phần tiền sử như ghi ngược từ phiếu khám.
- **D10.** `latestHealth` của trẻ:
  - có phiếu mở ⇒ "Cần theo dõi sát", `source: 'FOLLOW_UP_OPEN'`, kèm ngày lần khám gần nhất;
  - không có phiếu mở ⇒ mục mới hơn giữa lần khám có xếp mức gần nhất và phiếu đóng gần nhất có `outcome` `DOCTOR_NORMAL` (⇒ Không ghi nhận bất thường) hoặc `KNOWN_CONDITION` (⇒ Vấn đề đã biết, ổn định); so ngày khám với ngày đóng phiếu, trùng ngày lấy phiếu đóng;
  - `NO_SPECIALIST_RESULT` không sinh mức; trả `closedWithoutResultOn` khi phiếu đóng kiểu này sau lần khám đang hiện;
  - field thêm: `source` (`EXAM` | `FOLLOW_UP_OPEN` | `FOLLOW_UP_CLOSED`), `knownCondition`, `resultOn`, `followUpId`, `closedWithoutResultOn`.
- **D11.** Mức `KNOWN_STABLE` "Vấn đề đã biết, ổn định", tông `teal` (nhãn thông tin, `DESIGN.md` mục 3.2). Sinh từ đóng phiếu `KNOWN_CONDITION` (tên vấn đề = `conditionText`) hoặc lần khám chọn "đã biết" (tên vấn đề = vấn đề bác sĩ ghi). Danh sách trẻ hiện tên vấn đề và ngày của kết quả. Bộ lọc thêm mức này. Tab "Trẻ cần theo dõi" của đợt chỉ gồm "Cần theo dõi" và "Cần theo dõi sát", nên không có mức này.
- **D13.** Mẫu thường lưu `exam.conclusion.issueKind`: `NEW` "Vấn đề mới hoặc có thay đổi" (⇒ Cần theo dõi) · `KNOWN` "Vấn đề đã biết, không thay đổi so với trước" (⇒ Vấn đề đã biết, ổn định). Bắt buộc khi tích "Có vấn đề về sức khỏe", không chuyển khám, không nguy cơ lao; không chọn sẵn. Chuyển khám hoặc nguy cơ lao thì bỏ qua câu này. Nhóm kết luận cho tiến độ đợt giữ "Có vấn đề, tư vấn". Phiếu cũ không có `issueKind` giữ mức "Cần theo dõi".
- **D12.** Dữ liệu demo lên seed v9:
  - đợt đang diễn ra có lần khám mẫu `FOLLOW_UP` đủ 3 lựa chọn và 1 ca tích nguy cơ lao;
  - thêm phiếu đã đóng với mỗi `outcome`; giữ phiếu Tai mũi họng đang mở của T1 để thử tay mẫu `FOLLOW_UP`;
  - DB cũ: lần khám đã lưu giữ nguyên mẫu thường; phiếu đã đóng không có `outcome` hiện "Không ghi kết quả khi đóng";
  - số liệu giả, không có dữ liệu thật.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:**
  - Actor:
    - Giáo viên phụ trách lớp: nhập phiếu khám, ghi kết quả chuyên khoa, đóng phiếu, chọn kết quả.
    - Bác sĩ trường (không có tài khoản): quyết định qua kết luận.
    - Phụ huynh: đưa trẻ đi khám, báo lại kết quả.
    - Hiệu trưởng, Phó hiệu trưởng: xem danh sách trẻ, phiếu theo dõi; nhận thông báo.
  - Outcome: trẻ đang có phiếu theo dõi được khám theo mẫu so với vấn đề đang theo dõi; phiếu chỉ đóng khi giáo viên đã xong việc và ghi kết quả; mức hiện tại của trẻ khớp phiếu đang mở hoặc kết luận gần nhất của bác sĩ; vấn đề đã biết không mang nhãn cảnh báo.
  - Rule: HLT-01 (CONFIRMED). HLT-08, HLT-09 là đề xuất FE từ các plan trước, chưa có ở BE.
  - Flow:
    - `[S]` Bước Kết luận hiện phiếu đang mở và mẫu `FOLLOW_UP`.
    - `[B]` Bác sĩ kết luận so với vấn đề đang theo dõi. `[S]` Giáo viên lưu.
    - `[S]` Chưa ghi nhận thêm hoặc Tư vấn ⇒ phiếu giữ nguyên. Có thêm bất thường mới ⇒ vòng mới.
    - `[B]` Phụ huynh đưa trẻ đi khám, báo lại. `[S]` Giáo viên ghi kết quả; không có ngày hẹn ⇒ hộp đóng phiếu.
    - `[S]` Giáo viên chọn kết quả, đóng phiếu. `[S]` Danh sách trẻ cập nhật mức.
- **Đối chiếu thiết kế ban đầu:**
  - [Plan 2026-10-17](../completed/2026-10-17-health-exam-form-doctor-conclusion.md): mọi trẻ dùng 1 mẫu kết luận theo Phụ lục II. Plan này thêm mẫu `FOLLOW_UP` cho trẻ có phiếu mở; bản in theo mẫu Bộ Y tế không còn trong phạm vi (phần C đã bỏ), nên không lệch bản giấy.
  - [Plan 2026-10-16](../completed/2026-10-16-health-follow-up-long-lived.md): đóng phiếu khi nhà trường xong việc, chỉ ghi lý do. Plan này thêm kết quả khi đóng.
  - Kịch bản thử tay T1, C5 (`docs/quality/manual-tests/health-exam-flow.md:58`, `:211`) phải viết lại.
- **Ảnh hưởng:**
  - Module `health` (chủ), `child` (danh sách trẻ, khai báo sức khỏe).
  - Route: `/children/health-checks/:campaignId/exam/:childId`, `/children/health-checks/:campaignId` (tiến độ), `/children/health-follow-ups/:followUpId`, `/children/:id/health`, `/children` (danh sách trẻ).
  - Quyền không đổi: đóng phiếu theo `canUpdateFollowUp`; lưu kết luận theo `canRecordMeasurement`.
  - APP: phụ huynh xem phiếu khám đã công bố; phần kết luận mẫu `FOLLOW_UP` cần hiện trên APP (sửa sau, ngoài repo này).
  - Dữ liệu cũ: D12.
  - Trùng file với plan đang chạy [2026-10-19-children-health-ui-sync](../active/2026-10-19-children-health-ui-sync.md) (branch `dev`, đồng bộ UI danh sách trẻ và trang sức khỏe): kiểm khi gộp nhánh.

### Câu hỏi mở
Không còn câu hỏi mở (user trả lời 2026-10-21, bảng dưới).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Tên mức cho vấn đề đã biết | "Vấn đề đã biết, ổn định" (vòng 1, 1a) | user | 2026-10-21 | `docs/features/README.md` |
| Câu "mới hay đã biết" có chọn sẵn | Không, bác sĩ phải nói (vòng 1, 2a) | user | 2026-10-21 | `docs/features/README.md` |
| Lưu kết luận có đóng phiếu không | Không; trẻ có phiếu mở dùng 3 lựa chọn | user | 2026-10-21 | plan này |
| 3 lựa chọn thay ô nào | Gộp "Kết luận" và "Hướng xử lý" (vòng 2, 1a) | user | 2026-10-21 | plan này |
| "Tư vấn" nghĩa là gì | Vấn đề nhỏ mới, chỉ tư vấn, không thêm vào phiếu (vòng 2, 2a) | user | 2026-10-21 | plan này |
| "Có thêm bất thường mới" | Vòng mới, trao đổi lại, có thể ghi chuyên khoa (vòng 2, 3a) | user | 2026-10-21 | plan này |
| Mức khi phiếu còn mở | Giữ "Cần theo dõi sát" tới khi đóng (vòng 2, 4a) | user | 2026-10-21 | plan này |
| Bác sĩ trường thấy vấn đề cũ đã hết | Kết quả "Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường)" (vòng 2, 5a) | user | 2026-10-21 | plan này |
| Thêm kết quả đóng "Cần theo dõi tiếp ở lớp" | Không; còn cần quan sát thì giữ phiếu mở (vòng 3, 1b) | user | 2026-10-21 | plan này |
| Gộp câu "mới hay đã biết" cho trẻ không có phiếu mở | Gộp vào plan này (vòng 3, 2a) | user | 2026-10-21 | plan này |

## Acceptance criteria
- **AC-1** (`HLT-01`): Given trẻ có phiếu theo dõi do lần khám trước mở, When mở bước Kết luận của đợt mới, Then có khối phiếu đang mở (D1), kể cả khi lần đo gần nhất là cân đo ngoài đợt; mẫu kết luận là 1 câu 3 lựa chọn, ô nguy cơ lao, tên bác sĩ; không có "Bình thường" và nhóm "Hướng xử lý". Given trẻ không có phiếu mở, Then mẫu kết luận như hiện nay.
- **AC-2** (`HLT-01`): When lưu kết luận mẫu `FOLLOW_UP`, Then bắt buộc chọn 1 lựa chọn; "Tư vấn" bắt buộc ghi rõ vấn đề và lời tư vấn; "Có thêm bất thường mới" bắt buộc ghi rõ bất thường; thiếu ⇒ 422 và mở bước 5. Còn điểm cần xem lại mà chọn "Chưa ghi nhận thêm" hoặc "Tư vấn" ⇒ hộp hỏi lại.
- **AC-3**: Given lựa chọn "Chưa ghi nhận thêm bất thường" hoặc "Tư vấn", Then phiếu theo dõi vẫn mở, giữ trạng thái và vòng; dòng thời gian có lần khám với nhãn lựa chọn; không có thông báo; công bố không bị chặn (có người đi cùng ⇒ tự công bố).
- **AC-4**: Given "Có thêm bất thường mới" hoặc tích nguy cơ lao, Then phiếu sang vòng mới: có người đi cùng ⇒ "Đã trao đổi" với lần trao đổi tại buổi khám; không có ⇒ "Chờ trao đổi phụ huynh", hạn = ngày lưu + 7, công bố bị chặn. Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp (trừ người lưu) nhận thông báo.
- **AC-5**: Given phiếu nháp, cân đo ngoài đợt, kết quả mẫu cũ, Then phiếu theo dõi không đổi. Given trẻ không có phiếu mở, Then lưu kết luận như hiện nay (hồi quy, gồm mở phiếu khi chuyển khám).
- **AC-6**: Given sửa lần khám mẫu `FOLLOW_UP` đổi giữa "Có thêm bất thường mới" và "Chưa ghi nhận thêm", Then vòng và trạng thái tính lại, phiếu không đóng, trao đổi đã ghi giữ nguyên. Given sửa lần khám đã mở phiếu theo dõi, Then dùng mẫu thường.
- **AC-7**: Given lưu kết quả chuyên khoa không có ngày hẹn, Then hộp đóng phiếu mở ngay; có ngày hẹn thì không mở.
- **AC-8**: When đóng phiếu, Then bắt buộc kết quả và lý do; `KNOWN_CONDITION` bắt buộc tên vấn đề ≤100 ký tự; kết quả không đủ điều kiện D8 ⇒ 422. Given Hiệu trưởng hoặc Phó hiệu trưởng, Then không có nút đóng; gọi API ⇒ 403.
- **AC-9**: Given đóng với `KNOWN_CONDITION`, Then tiền sử bản thân là "Có" và có tên vấn đề (không lặp tên đã có); lịch sử khai báo có dòng cập nhật từ phiếu theo dõi; không có thông báo.
- **AC-10**: Given trẻ có phiếu mở, Then danh sách trẻ hiện "Cần theo dõi sát". Given đóng với `DOCTOR_NORMAL`, `KNOWN_CONDITION`, `NO_SPECIALIST_RESULT`, Then danh sách hiện lần lượt "Không ghi nhận bất thường" kèm ngày kết quả; "Vấn đề đã biết, ổn định · <tên vấn đề>" tông teal; mức của lần khám kèm "Phiếu đã đóng ngày …, chưa có kết quả chuyên khoa". Bộ lọc có "Vấn đề đã biết, ổn định". Given sau đó có lần khám có kết luận mới hơn, Then mức theo lần khám đó.
- **AC-11**: Given đợt có lần khám mẫu `FOLLOW_UP`, Then tiến độ đợt đếm vào nhóm theo D4; tab "Trẻ cần theo dõi" có các trẻ này.
- **AC-12**: Given DB demo seed v8, Then các trang sức khỏe mở được; phiếu đóng cũ hiện "Không ghi kết quả khi đóng"; seed v9 có đủ trường hợp D12, không có dữ liệu thật.
- **AC-13** (`HLT-01`): Given trẻ không có phiếu mở, tích "Có vấn đề về sức khỏe", không chuyển khám, không nguy cơ lao, When lưu kết luận, Then bắt buộc chọn "mới hay đã biết" (không chọn sẵn). "Đã biết" ⇒ mức "Vấn đề đã biết, ổn định", danh sách trẻ hiện vấn đề bác sĩ ghi, trẻ không vào tab "Trẻ cần theo dõi". "Mới" ⇒ "Cần theo dõi". Chuyển khám hoặc nguy cơ lao ⇒ không hỏi.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Lần khám khi trẻ có phiếu mở | Mẫu `FOLLOW_UP`: 1 câu so với vấn đề đang theo dõi (user) | Mẫu thường kèm câu phụ | User chốt 2026-10-21; "Bình thường" không hợp với trẻ còn vấn đề đang theo dõi |
| Lưu kết luận và phiếu cũ | Không đóng phiếu (user) | Tự đóng khi không chuyển khám (bản nháp đầu) | User chốt 2026-10-21; phiếu chỉ đóng khi giáo viên đã xong việc |
| Mức khi phiếu còn mở | Giữ "Cần theo dõi sát" (user 4a) | Theo lần khám | Không còn cảnh "bình thường mà phiếu vẫn mở" |
| Mức sau khi đóng phiếu | Giáo viên chọn kết quả (D8) | Giữ mức lần khám tới đợt sau | Danh sách khớp kết luận gần nhất của bác sĩ; không tự đoán từ chữ tự do |
| Chọn mẫu kết luận | Backend giả trả `conclusionMode` (D1) | UI tự xét phiếu mở | BE sở hữu luật; UI chỉ vẽ |
| Kiểm thử | Bộ `tests/health/*.test.mjs` (node:test, backend giả) và script `test:health` thêm vào `npm run verify` | Kịch bản trong scratchpad như các plan trước | Repo đã có node:test; giữ test để chạy hồi quy. Chỉ thêm script, không thêm dependency |

## Phases
### Phase 1 — Mẫu kết luận khi có phiếu mở, đóng phiếu có kết quả, mức hiện tại (backend giả)
- Files: M `src/models/children/healthExamForm.js` · M `src/models/children/childrenConstants.js` · M `src/models/children/healthCheckConstants.js` · M `src/utils/children/healthExamValidation.js` · M `src/utils/children/childrenValidation.js` · M `src/services/children/mock/healthScreeningRule.js` · M `src/services/children/mock/healthCheckRule.js` · M `src/services/children/mock/healthCheckMockRepository.js` · M `src/services/children/mock/healthExamMockRepository.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/api/healthCheckApi.js` · M `src/services/children/api/childrenApi.js` · M `src/mocks/healthCheckSeed.js` · M `src/mocks/childrenSeed.js` · C `tests/health/follow-up-exam.test.mjs` · M `package.json` (chỉ thêm script `test:health`)
- Steps:
  1. Hằng số và cấu hình mẫu: lựa chọn `followUpFinding`, `issueKind`, 2 nhóm kết luận mới, mức `KNOWN_STABLE`, `outcome` đóng phiếu và nhãn (D2, D4, D8, D11, D13).
  2. Kiểm nhập mẫu `FOLLOW_UP`, câu "mới hay đã biết" và đóng phiếu, chỉ hỗ trợ nhập (D2, D8, D13).
  3. Mức và nhóm kết luận của lần khám mẫu `FOLLOW_UP` (D4) và lần khám chọn "đã biết" (D13).
  4. `trackFollowUp`, `followUpState`, `publishBlockOf` theo `newFinding`; thông báo "Trẻ có thêm bất thường mới" (D3, D5, D6).
  5. Phiếu khám trả `conclusionMode`, `openFollowUp`; lưu kết luận theo mẫu backend giả chọn (D1).
  6. `closeFollowUp` nhận `outcome`, `conditionText`; ghi tiền sử (D8, D9); phiếu theo dõi trả `closeOutcome`, `closeConditionText`.
  7. `latestHealth` theo D10; thống kê đợt theo D4.
  8. Seed v9 và nâng cấp DB cũ (D12); ghi contract PROPOSED trong `healthCheckApi.js`, `childrenApi.js`.
- Tests: AC-2..AC-6, AC-8..AC-13 → `tests/health/follow-up-exam.test.mjs`; chạy lại các bộ test có sẵn.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0.

### Phase 2 — Giao diện
- Files: M `src/pages/children/HealthExamFormPage.jsx` · M `src/components/children/exam/ExamConclusionStep.jsx` · M `src/components/children/exam/ExamSummary.jsx` · M `src/components/children/MeasurementSummary.jsx` · M `src/pages/children/HealthFollowUpDetailPage.jsx` · M `src/pages/children/HealthCheckDetailPage.jsx` · M `src/pages/children/ChildrenListPage.jsx` · M `src/components/children/ChildBadges.jsx`
- Steps:
  1. Bước Kết luận: khối phiếu đang mở và mẫu `FOLLOW_UP` (D1–D3); câu "mới hay đã biết" ở mẫu thường (D13); hộp hỏi lại theo D2; màn kết quả báo phiếu giữ nguyên hoặc sang vòng mới.
  2. Xem phiếu khám, Sổ sức khỏe: nhãn lựa chọn mẫu `FOLLOW_UP` (D4).
  3. Trang phiếu theo dõi: hộp đóng phiếu có kết quả và tên vấn đề (D8); mở hộp sau khi ghi kết quả không có ngày hẹn (D7); dòng thời gian hiện lần khám không mở vòng; thẻ "Đóng phiếu" hiện kết quả; sửa lời nhắc ở `HealthFollowUpDetailPage.jsx:329`.
  4. Tiến độ đợt: 2 nhóm kết luận mới (D4).
  5. Danh sách trẻ: nhãn `KNOWN_STABLE`, tên vấn đề, ngày kết quả, dòng phiếu đóng chưa có kết quả; bộ lọc (D10, D11).
- Tests: AC-1, AC-7, AC-10 và AC-11 (phần hiển thị): render thử bằng `react-dom/server` trong scratchpad và kiểm tay trên trình duyệt (giáo viên, Phó hiệu trưởng, Hiệu trưởng), màn 375px.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0 (gồm `scripts/check-design.mjs`).

### Phase 3 — Tài liệu
- Files: M `docs/features/README.md` · M `docs/quality/manual-tests/health-exam-flow.md` (T1 thành ca mẫu `FOLLOW_UP`; C5; thêm bước thử các kết quả đóng phiếu) · M `.ai/CONTEXT_MAP.yaml` (từ khóa) · plan này (Progress log, "Đề xuất cho BE").
- Exit: `node scripts/check-ai-layer.mjs` → 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`.

## Đề xuất cho BE (gom sau khi FE hoàn thiện)
- `BE:docs/business/BUSINESS_RULES.md`:
  - HLT-01 (phiếu khám): trẻ có phiếu theo dõi đang mở thì kết luận theo mẫu so với vấn đề đang theo dõi (`NO_NEW_FINDING` | `ADVICE` | `NEW_FINDING`).
  - HLT-09 (phiếu theo dõi): lưu kết luận không đóng phiếu; `NEW_FINDING` hoặc nguy cơ lao mở vòng mới; đóng tay phải có `outcome` theo điều kiện D8.
  - HLT-08 (mức theo dõi): thêm `KNOWN_STABLE`; trẻ có phiếu mở ở mức "Cần theo dõi sát"; không có phiếu mở thì lấy mục mới hơn giữa lần khám có xếp mức và lần đóng phiếu có kết quả.
  - HLT-06 (khai báo): kết quả `KNOWN_CONDITION` ghi vào tiền sử bản thân.
- Contract PROPOSED:
  - phiếu khám trả `conclusionMode`, `openFollowUp`; lưu nhận `exam.conclusion.followUpFinding`;
  - nhóm kết luận thêm 2 giá trị cho tiến độ đợt;
  - `POST /health-follow-ups/{id}/close` nhận `{ reason, outcome, conditionText? }`; phiếu theo dõi trả `closeOutcome`, `closeConditionText`; dòng thời gian có `MEASUREMENT_ADDED { newFinding }`;
  - `GET /children`: `latestHealth` thêm `source`, `knownCondition`, `resultOn`, `followUpId`, `closedWithoutResultOn`.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-2..AC-6 | HLT-01 | `tests/health/follow-up-exam.test.mjs` (backend giả) | 1 | Đạt (10/10 cả bộ) |
| AC-8..AC-13 | HLT-01 | `tests/health/follow-up-exam.test.mjs` (backend giả) | 1 | Đạt (10/10 cả bộ) |
| AC-1, AC-7 | HLT-01 | Render thử + kiểm tay trên trình duyệt | 2 | Render thử đạt (bước Kết luận 2 mẫu, khối phiếu đang mở) · Hộp đóng phiếu sau khi ghi kết quả (AC-7): chưa kiểm tay · Trình duyệt: chưa chạy |
| AC-10, AC-11 (hiển thị) | — | Render thử + kiểm tay | 2 | Render thử đạt (nhãn mới, Sổ sức khỏe) · Danh sách trẻ, thống kê đợt: chưa kiểm tay |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Giáo viên chọn "Chưa ghi nhận thêm" khi bác sĩ thấy bất thường mới | Không trao đổi lại với phụ huynh | Hộp hỏi lại khi còn điểm cần xem lại (D2); sửa phiếu đổi lựa chọn (D6) | Sửa phiếu khám |
| Phiếu mở lâu, trẻ ở "Cần theo dõi sát" lâu | Danh sách nhiều trẻ đỏ | Hộp đóng phiếu ngay sau khi ghi kết quả không có ngày hẹn (D7); nhắc 30 ngày vẫn chạy | — |
| Đóng phiếu nguy cơ lao khi chưa khám sàng lọc | Trẻ không được sàng lọc lao | `DOCTOR_NORMAL` cần kết quả khám hoặc lần khám sau (D8); đề xuất "nguy cơ lao bắt buộc chuyển khám" chờ user chốt | — |
| Thêm 2 nhóm kết luận làm thống kê đợt khó đọc | Báo cáo khó hiểu | Nhãn ghi rõ "Đang theo dõi, …" | Gộp nhóm trong hằng số |
| Mẫu `FOLLOW_UP` khác mẫu in Bộ Y tế | Lệch bản giấy nếu sau này in lại | Phần in đã bỏ (plan 2026-10-17); ghi vào đề xuất cho BE | — |
| Trùng file với plan UI đang chạy trên `dev` | Xung đột khi gộp nhánh | Sửa gọn, dùng class chung; kiểm khi gộp | Gộp tay |
| BE chọn luật hoặc field khác | Sửa lại FE | Contract gom ở `api/` và backend giả; UI đọc giá trị trả về | Revert theo phase |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `HealthExamFormPage`, `ExamConclusionStep`, `ExamSummary`, `MeasurementSummary`, `HealthFollowUpDetailPage`, `HealthCheckDetailPage`, `ChildrenListPage`, `ChildBadges`; APP màn phiếu khám của phụ huynh (sửa sau)
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file: không tách plan, vì Phase 2–3 phụ thuộc dạng dữ liệu của Phase 1; tách thì giao diện chạy với luật cũ giữa chừng; 3 phase
- [x] Không dùng rule PENDING/OPEN như đã chốt (HLT-08, HLT-09 ghi là đề xuất)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-21 — Plan draft (chờ duyệt)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Tiếp: user trả lời câu hỏi mở và duyệt D1–D12.

### 2026-10-21 — Viết lại theo trả lời của user (chờ 2 câu hỏi mở)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Nội dung: bỏ tự đóng phiếu khi lưu kết luận; thêm mẫu `FOLLOW_UP` cho trẻ có phiếu mở (vòng 2: 1a, 2a, 3a, 4a, 5a).
- Tiếp: user trả lời 2 câu hỏi mở rồi duyệt; chạy liên tục Phase 1–3 (user duyệt trước plan làn L, 2026-10-15), verify sau mỗi phase.

### 2026-10-21 — Plan approved
- User trả lời vòng 3: 1b (không thêm kết quả "Cần theo dõi tiếp ở lớp"), 2a (gộp câu "mới hay đã biết", thêm D13, AC-13). Chạy liên tục Phase 1–3.

### 2026-10-21 — Phase 1 (done, verify FAIL do môi trường)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log`. Nguyên nhân: `node_modules` thiếu gói `read-excel-file` (đã khai ở `package.json`, commit `58e3b0a`) ⇒ `tests/menu/food-bulk-import.test.mjs` lỗi import và `npm run build` không resolve `read-excel-file/browser` (`src/utils/menu-planning/foodImport.js`). `npm ci` bị chặn vì `node_modules` có `@vitejs/plugin-react` 6.1.2 còn lockfile ghi 4.7.0 (peer vite ≤7). Không sửa dependency (cần user quyết).
- Chạy riêng: `test:health` 10/10 · `test:kitchen` 50/50 · `test:merge` 46/46 · `test:hardening` 20/20 · `test:dashboard` 12/12 · `test:menu` 92 pass, 1 fail (lỗi import trên) · `lint` ok · `format:check` ok · `check:design` ok.
- Khác plan:
  - Hàm ngày `localDateOf` thêm vào `src/utils/format.js` (dùng chung, thay hàm riêng trong `healthCheckRule.js`).
  - `ensureDeclarationOf`, `selfHistoryWith`, `recordKnownCondition` đặt ở `childrenMockRepository.js` (chủ khai báo sức khỏe); ghi ngược từ phiếu khám dùng chung `ensureDeclarationOf`.
  - Seed v9: mẫu `FOLLOW_UP` có "Có thêm bất thường mới" (ch_003, không người đi cùng) và "Chưa ghi nhận thêm" (ch_019); "Tư vấn" và nguy cơ lao ở mẫu `FOLLOW_UP` thử bằng test và kịch bản thử tay (c1 không còn trẻ có phiếu mở từ đợt trước để dựng thêm). Vấn đề đã biết: ch_023 (lần khám), ch_031 (đóng phiếu `KNOWN_CONDITION`). Phiếu đóng cũ: ch_014 `DOCTOR_NORMAL`, ch_025 (tháng 6) `NO_SPECIALIST_RESULT`.
  - DB cũ: phiếu khám seed chưa sửa nhận bản seed mới (như các lần nâng cấp trước); phiếu theo dõi cũ chưa có cờ `newFinding` được gắn theo phiếu khám.
- Tiếp: Phase 2.

### 2026-10-21 — Phase 2 (done, verify FAIL do môi trường)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` (cùng nguyên nhân thiếu `read-excel-file`, xem Phase 1). `lint` ok · `format:check` ok · `check:design` ok (hex 44/44, cssPx 16/16, inlineStyle 36/36) · `test:health` 10/10.
- Kiểm thêm: render thử bằng `react-dom/server` qua Vite SSR (scratchpad, dữ liệu seed) 15/15: bước Kết luận mẫu `FOLLOW_UP` (3 lựa chọn, khối phiếu đang mở, ô theo lựa chọn), mẫu thường có câu "mới hay đã biết", xem phiếu và Sổ sức khỏe của lần khám "Chưa ghi nhận thêm" và "đã biết", nhãn mới, 5 trang đã sửa nạp được. **Chưa kiểm tay trên trình duyệt.**
- Khác plan:
  - Kết quả khám trả thêm `followUpEffect` (`OPENED` | `NEW_ROUND` | `MERGED` | `NOTED`) để màn kết quả báo đúng việc hệ thống đã làm, UI không tự suy luận.
  - Lần khám mẫu `FOLLOW_UP` không hiện nhãn mức "Cần theo dõi sát – đề nghị khám chuyên khoa" (dễ hiểu là đề nghị chuyển khám mới); hiện nhóm kết luận và dòng "Trẻ đang trong phiếu theo dõi".
  - Thêm `src/pages/children/HealthDeclarationPage.jsx` (nhãn lịch sử "Cập nhật tiền sử từ phiếu theo dõi").
  - Hàm hiển thị kết luận dùng chung `conclusionLabelOf`, `conclusionActionLabelOf` ở `src/models/children/healthExamForm.js`.
- Tiếp: Phase 3.

### 2026-10-21 — Phase 3 (done; plan chưa đóng)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY FAIL full | npm run verify | log verify.log` (môi trường, như Phase 1). Chạy riêng sau lần sửa cuối: `test:health` 10/10 · `test:kitchen` 50/50 · `test:merge` 46/46 · `test:hardening` 20/20 · `test:dashboard` 12/12 · `test:menu` 92 pass, 1 fail (thiếu `read-excel-file`) · `lint` ok · `format:check` ok · `check:design` ok · `build` fail (thiếu `read-excel-file/browser`). `node scripts/check-ai-layer.mjs` → 0 lỗi.
- Nội dung: `docs/features/README.md` (mục khám trẻ đang có phiếu theo dõi, đóng phiếu có kết quả, mức Vấn đề đã biết); `docs/quality/manual-tests/health-exam-flow.md` (T1, T3, T9 dùng mẫu FOLLOW_UP; T2, T7, T10 chọn "mới hay đã biết"; D1 số mới; C5–C9 đóng phiếu có kết quả; H2b bộ lọc mới; ca có sẵn ở Campus 1); `.ai/CONTEXT_MAP.yaml` (từ khóa, test).
- Còn lại trước khi đóng plan:
  - cài lại dependency cho khớp lockfile (thiếu `read-excel-file`; `@vitejs/plugin-react` trong `node_modules` khác lockfile) rồi chạy lại `node scripts/verify.mjs` — cần user quyết;
  - kiểm tay trên trình duyệt theo kịch bản (mục B, C, H);
  - gửi "Đề xuất cho BE" khi user cho phép sửa repo BE.

### 2026-10-21 — Verify PASS, đóng plan
- Commit: chưa commit
- Môi trường: user cho phép chạy `npm install --legacy-peer-deps` ⇒ `node_modules` theo lockfile (`read-excel-file` 9.3.10, `@vitejs/plugin-react` 4.7.0, vite 8.3.3). `package-lock.json` chỉ mất các trường `libc` của gói tùy chọn theo nền tảng (khác bản npm), không đổi version; chưa khôi phục (chờ user).
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 96/96 · kitchen 50/50 · merge 46/46 · hardening 20/20 · dashboard 12/12 · health 10/10 · lint · format · check-design · build). Chạy lại sau khi chuyển plan sang `completed/`.
- Chưa kiểm chứng: thao tác trên trình duyệt (kịch bản `docs/quality/manual-tests/health-exam-flow.md` mục B, C, H); BE thật (FE dẫn nghiệp vụ bằng backend giả).
- Chờ: gửi "Đề xuất cho BE" khi user cho phép sửa repo BE; user chưa chốt "nguy cơ lao bắt buộc chuyển khám" và "hiện tên vấn đề cạnh nhãn Cần theo dõi"; APP hiện kết luận mẫu `FOLLOW_UP` cho phụ huynh (sửa sau, ngoài repo này).
