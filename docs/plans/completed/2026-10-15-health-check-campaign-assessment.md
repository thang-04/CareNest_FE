---
title: Sức khỏe — đợt khám, chỉ số đánh giá và phiếu theo dõi
status: done        # draft → approved (chỉ user duyệt) → in-progress → done | blocked | cancelled
owner: ATPX48-69
jira: none           # hỏi khi user yêu cầu commit
branch: dev
modules: [health, child]
rules: [HLT-01, HLT-02, HLT-04, HLT-05, PAR-02]
risk: high           # dữ liệu sức khỏe + nhãn sàng lọc (ROUTER bảng 2), thực thể mới (đợt khám, phiếu theo dõi), contract health PROPOSED, menu theo role
created: 2026-10-15
updated: 2026-10-15
---
# Sức khỏe — đợt khám, chỉ số đánh giá và phiếu theo dõi

> 2026-10-17: quyết định 2, 4, 5–7, 11 và AC-13 được thay bởi [plan phiếu khám Phụ lục II](2026-10-17-health-exam-form-doctor-conclusion.md) (bảng "Đổi quyết định đã chốt"). Cách tính 3 tiêu chí chỉ còn cho dữ liệu mẫu cũ.

Plan chỉ phần client. BE chưa có API health. User quyết định FE dẫn nghiệp vụ, BE làm theo sau (2026-10-15). Contract đề xuất ở mục "Đề xuất cho BE". Tài liệu BE đọc ở bản local `D:/project_capstone/project/be/CareNest_BE` (không có `../CareNest_BE`).

Plan này thay plan nháp cùng ngày `docs/plans/completed/2026-10-15-health-head-arm-circumference.md` (vòng đầu + vòng cánh tay + cờ trung tính). Plan nháp chưa được duyệt và chưa code. User đã bỏ vòng cánh tay và đổi quyết định phụ huynh xem gì.

## Context
Nhà trường muốn đánh giá sức khỏe theo đợt khám, không chỉ cân đo. Mỗi đợt có bác sĩ, nhân viên y tế và giáo viên. Giáo viên phụ trách lớp nhập kết quả. Hệ thống phân loại BMI và xếp mức theo dõi để nhà trường biết trẻ nào cần chú ý, trẻ nào cần đề nghị phụ huynh cho khám chuyên khoa.

Hiện trạng:
- Form nhập chỉ có ngày đo, chiều cao, cân nặng, ghi chú (`src/pages/children/HealthMeasurementFormPage.jsx:28`, các ô ở `:213-258`). Validation ở `src/utils/children/childrenValidation.js:60-74`.
- Mock rule BMI dùng ngưỡng placeholder nhưng trả nhãn "Suy dinh dưỡng/Béo phì" (`src/services/children/mock/nutritionRule.js:3-29`, nhãn `src/models/children/childrenConstants.js:54-66`, badge `src/components/children/ChildBadges.jsx:17`). Điều này trái Known pitfalls của `BE:docs/modules/health.md`. Incident `FE-CASE-261014-health-role-flow-alignment` đang mở cho điểm này.
- Chưa có khái niệm đợt khám. Mỗi lần đo là bản ghi lẻ của 1 trẻ. Mock lưu/công bố ở `src/services/children/mock/childrenMockRepository.js:643-706`, AI giả ở `:708-767`, seed ở `src/mocks/childrenSeed.js:16-51`. Dữ liệu demo nằm trong localStorage (`src/mocks/mockDatabase.js:52-68`), bản ghi cũ có sẵn `nutritionStatus`.
- Hiển thị: Sổ sức khỏe `src/pages/children/ChildHealthRecordPage.jsx:92-120` (lần đo gần nhất), `:163-287` (bảng). Xu hướng `src/pages/children/HealthTrendPage.jsx:274-329`. Biểu đồ `src/components/children/GrowthChart.jsx`. Menu nhóm "Quản lý trẻ" ở `src/layouts/menuConfig.js:55-59`, `:124-170`. Route sức khỏe ở `src/routes/AppRoutes.jsx:303-312`.
- Quyền nhập/sửa/công bố: giáo viên phụ trách lớp của trẻ (`src/utils/children/childrenPermissions.js:51-55`).

## Quyết định đã chốt
Nguồn: user, 2026-10-15, mức PROPOSED (chưa ghi vào BE). Không đảo khi chưa hỏi user.

1. **Luồng 4 bước.** (1) Hiệu trưởng tạo đợt khám. (2) Ngày khám có bác sĩ, nhân viên y tế, giáo viên; giáo viên phụ trách lớp nhập kết quả. (3) Khi lưu, hệ thống phân loại BMI và xếp mức theo dõi. (4) Hiệu trưởng đóng đợt khám.
2. **Chỉ số.** Chiều cao, cân nặng, vòng đầu: nhập tay. Vận động thô, vận động tinh: chọn "Không ghi nhận bất thường" hoặc "Có bất thường". Ghi chú khám: như hiện tại. Bỏ vòng cánh tay (thay quyết định 1–2 của plan nháp).
3. **Trẻ trên 60 tháng tuổi tại ngày đo.** Không đo vòng đầu (form ẩn ô này). Chỉ xét 2 tiêu chí vận động.
4. **Phân loại BMI.** "BMI thấp hơn chuẩn" / "BMI bình thường" / "BMI cao hơn chuẩn", theo chuẩn WHO BMI theo tuổi. BE giữ rule. Phân loại BMI không tính vào mức theo dõi.
5. **Mức theo dõi.** Có 3 tiêu chí: vòng đầu ngoài chuẩn WHO theo tuổi (to hơn hoặc bé hơn), vận động thô có bất thường, vận động tinh có bất thường.
   - 0 tiêu chí: "Không ghi nhận bất thường".
   - 1 tiêu chí: "Cần theo dõi".
   - Từ 2 tiêu chí: "Cần theo dõi sát – đề nghị khám chuyên khoa". Nhãn này thay "Nguy cơ có vấn đề sức khỏe" để tránh hiểu là chẩn đoán (Exclusions `BE:docs/context/PROJECT_CONTEXT.md:66`).
   - Trẻ trên 60 tháng: 1/2 tiêu chí ⇒ "Cần theo dõi"; 2/2 ⇒ "Cần theo dõi sát".
6. **Mức "Cần theo dõi".** Trẻ vào danh sách theo dõi của đợt. Đợt sau hiện kết quả lần trước để so sánh. Không mở phiếu.
7. **Mức "Cần theo dõi sát".** Hệ thống mở phiếu theo dõi. Trạng thái: Chờ trao đổi phụ huynh → Đã trao đổi, đề nghị khám chuyên khoa → Đã có kết quả khám bên ngoài → Đã đóng (có lý do). Giáo viên phụ trách lớp cập nhật. Hiệu trưởng và Phó hiệu trưởng điểm trường chỉ xem. Phiếu vẫn mở sau khi đóng đợt.
8. **Đợt khám.** Hiệu trưởng tạo riêng cho từng điểm trường. Thông tin: tên đợt, điểm trường, ngày khám từ–đến, đơn vị khám/bác sĩ, ghi chú. Mỗi điểm trường chỉ có 1 đợt chưa đóng. Hiệu trưởng sửa được khi đợt chưa đóng, hủy được khi đợt chưa có kết quả nào. Phó hiệu trưởng điểm trường xem tiến độ và danh sách theo dõi, không tạo, không đóng.
9. **Đóng đợt.** Hiệu trưởng đóng. Trẻ chưa có kết quả ⇒ "Vắng khám". Sau khi đóng, không nhập/sửa kết quả của đợt. Cần sửa ⇒ Hiệu trưởng mở lại đợt.
10. **Công bố cho phụ huynh.** Giáo viên phụ trách lớp công bố từng trẻ (giữ quyết định 2026-10-14).
11. **Nhập số đo ngoài đợt.** Giữ nút "Nhập số đo" ở Sổ sức khỏe. Form đầy đủ như đợt khám, có phân loại và phiếu theo dõi. Nguồn ghi "Ngoài đợt khám".
12. **Phụ huynh (APP) xem tất cả của bản đã công bố:** số đo, biểu đồ, đánh giá vận động, phân loại BMI, mức theo dõi, ghi chú khám. Quyết định này thay quyết định 6 của plan nháp.
13. **Plan này không làm phía thực đơn.** Phân loại BMI là đầu vào cho plan thực đơn sau (điều chỉnh khẩu phần).
14. Giữ từ trước: nhân viên y tế không có tài khoản, giáo viên nhập; phân loại do hệ thống tính (BE giữ rule); FE dẫn nghiệp vụ, BE theo sau.

**Mặc định đề xuất, duyệt cùng plan:**
- Ngày đo trong đợt nằm trong khoảng ngày khám của đợt.
- Lần đo cũ (trước tính năng) thiếu vòng đầu/vận động ⇒ mức theo dõi "Chưa đủ dữ liệu", ô thiếu hiện "—". Khi sửa lần đo cũ, các ô mới không bắt buộc.
- Mỗi trẻ có tối đa 1 phiếu theo dõi chưa đóng. Lần đo mới ở mức "Cần theo dõi sát" khi trẻ đã có phiếu mở ⇒ ghi thêm vào phiếu đó, không mở phiếu mới.
- Sửa số đo làm mức theo dõi giảm ⇒ phiếu không tự đóng; giáo viên đóng phiếu, ghi lý do.
- Có thể đóng phiếu ở mọi trạng thái, bắt buộc ghi lý do (ví dụ trẻ chuyển trường).
- Hộp xác nhận đóng đợt cảnh báo số trẻ sẽ thành "Vắng khám" và số phiếu còn "Chờ trao đổi phụ huynh". Cảnh báo không chặn việc đóng.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** Hiệu trưởng tạo, sửa, đóng, mở lại, hủy đợt khám theo điểm trường. Phó hiệu trưởng điểm trường xem. Giáo viên phụ trách lớp nhập, sửa, công bố kết quả, cập nhật phiếu theo dõi. Phụ huynh xem bản đã công bố trên APP. Outcome: mỗi đợt có tiến độ theo lớp. Mỗi kết quả có phân loại BMI và mức theo dõi. Trẻ "Cần theo dõi sát" có phiếu theo dõi tới khi đóng. Rule: HLT-01 (CONFIRMED, cần mở rộng chỉ số và đợt khám) · HLT-02, HLT-04, HLT-05 (CONFIRMED) · HLT-03/P-13 chuẩn tham chiếu (PENDING, user chọn WHO) · PAR-02 (ACCEPTED) · PAR-03/P-13b (PENDING, user chọn "xem tất cả"). Flow: `[B]` Hiệu trưởng lên lịch khám với đơn vị y tế → `[S]` tạo đợt khám → `[B]` ngày khám: bác sĩ khám, nhân viên y tế đo → `[S]` giáo viên nhập kết quả từng trẻ → `[S]` BE tính BMI, phân loại, mức theo dõi, mở phiếu → `[S]` giáo viên công bố → `[S]` Hiệu trưởng đóng đợt → `[B]` giáo viên trao đổi phụ huynh, phụ huynh cho trẻ đi khám → `[S]` giáo viên cập nhật phiếu.
- **Đối chiếu thiết kế ban đầu:**
  - HLT-01 chỉ ghi "chiều cao, cân nặng, tình trạng sức khỏe, ghi chú" (`BE:docs/business/BUSINESS_RULES.md:61`). Yêu cầu thêm vòng đầu và 2 đánh giá vận động.
  - Flow ghi "Đợt đo định kỳ … Nhập HealthRecord theo lớp" (`BE:docs/business/flows/health-check.md:6-7`). Đợt khám khớp hướng này. Ngoài ra yêu cầu giữ thêm nhập lẻ ngoài đợt.
  - Flow ghi "chưa chọn chuẩn ⇒ chưa gắn cờ bất thường" (`BE:docs/business/flows/health-check.md:10`). User chọn WHO. Mock dùng ngưỡng tạm và ghi rõ trên UI cho tới khi BE chốt P-13.
  - Exclusions có "chẩn đoán y tế · chẩn đoán tâm lý/rối loạn phát triển" (`BE:docs/context/PROJECT_CONTEXT.md:66`). Mức theo dõi chỉ là sàng lọc theo ngưỡng, dùng nhãn trung tính, luôn kèm "không phải chẩn đoán". Kết quả khám bên ngoài là ghi nhận lời bác sĩ; hệ thống không tự kết luận.
  - Module card `health` không có đợt khám, phiếu theo dõi (`BE:docs/modules/health.md:8-9`). Đây là thực thể mới, cần BE ghi.
- **Ảnh hưởng:**
  - Module `health` (chủ) và `child` (scope lớp/điểm trường).
  - FE: `/children/:id/health`, `/children/:id/health/new`, `/children/:id/health/:measurementId/edit`, `/children/health-trends`. Mới: `/children/health-checks`, `/children/health-checks/new`, `/children/health-checks/:campaignId`, `/children/health-checks/:campaignId/edit`, `/children/health-follow-ups`, `/children/health-follow-ups/:followUpId`. Menu nhóm "Quản lý trẻ" của Hiệu trưởng, Phó hiệu trưởng, giáo viên, tổ trưởng.
  - APP: màn sức khỏe phụ huynh thêm vòng đầu, vận động, phân loại BMI, mức theo dõi, kèm "không phải chẩn đoán".
  - AI: input `interpretHealthTrend` thêm vòng đầu và phân loại BMI. Không gửi đánh giá vận động cho AI, để tránh AI viết lời mang tính chẩn đoán phát triển.
  - Thực đơn: chưa đổi; plan sau dùng phân loại BMI.
  - Dữ liệu cũ: xem mục "Mặc định đề xuất".

### Câu hỏi mở
Không còn câu hỏi nghiệp vụ. Ngưỡng WHO cụ thể (số SD) thuộc BE, ghi ở "Đề xuất cho BE". FE mock dùng ngưỡng tạm.

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| Vòng cánh tay | Bỏ | user | 2026-10-15 | `docs/features/README.md` |
| Phạm vi đợt khám | Hiệu trưởng tạo cho từng điểm trường | user | 2026-10-15 | `docs/features/README.md` |
| Nhập số đo ngoài đợt | Giữ nút; form đầy đủ, có phân loại và phiếu | user | 2026-10-15 | `docs/features/README.md` |
| Xử lý mức nguy cơ | Phiếu theo dõi có trạng thái; nhãn "Cần theo dõi sát – đề nghị khám chuyên khoa" | user | 2026-10-15 | `docs/features/README.md` |
| Liên kết thực đơn | Chưa làm trong plan này | user | 2026-10-15 | `docs/features/README.md` |
| Trẻ trên 60 tháng | Không đo vòng đầu, xét 2 tiêu chí vận động | user | 2026-10-15 | `docs/features/README.md` |
| Phụ huynh xem gì | Tất cả của bản đã công bố | user | 2026-10-15 | `docs/features/README.md` |
| Đóng đợt, công bố | Giáo viên công bố từng trẻ; Hiệu trưởng đóng, khóa, mở lại | user | 2026-10-15 | `docs/features/README.md` |
| Vai trò Phó hiệu trưởng | Xem tiến độ và danh sách theo dõi của điểm trường | user | 2026-10-15 | `docs/features/README.md` |
| Ai cập nhật phiếu | Giáo viên phụ trách lớp; Hiệu trưởng, Phó hiệu trưởng xem | user | 2026-10-15 | `docs/features/README.md` |
| Thông tin đợt | Khoảng ngày; 1 đợt chưa đóng mỗi điểm trường; sửa khi chưa đóng, hủy khi chưa có kết quả | user | 2026-10-15 | `docs/features/README.md` |
| Mức "Cần theo dõi" | Danh sách + so sánh đợt sau, không mở phiếu | user | 2026-10-15 | `docs/features/README.md` |

## Acceptance criteria
- **AC-1** (`HLT-01`): Given Hiệu trưởng, When tạo đợt cho điểm trường đang có đợt chưa đóng, Then không lưu được và hiện lỗi nêu tên đợt đang mở.
- **AC-2** (`HLT-01`): Given Phó hiệu trưởng điểm trường A, When mở danh sách đợt khám, Then chỉ thấy đợt của điểm trường A và không có nút tạo, sửa, đóng. Given giáo viên, Then chỉ thấy đợt của điểm trường lớp mình và chỉ thấy danh sách trẻ lớp mình.
- **AC-3** (`HLT-01`): Given đợt đang diễn ra, When giáo viên phụ trách lớp bấm "Nhập kết quả" cho 1 trẻ, Then form có ngày đo giới hạn trong khoảng ngày khám, và có nút "Lưu và nhập trẻ tiếp theo".
- **AC-4** (`HLT-01`): Given form tạo mới, When để trống chiều cao, cân nặng, vòng đầu hoặc 1 trong 2 đánh giá vận động, Then không lưu được và từng ô báo lỗi. Given trẻ trên 60 tháng tại ngày đo, Then form không có ô vòng đầu.
- **AC-5** (`HLT-03`/P-13 PENDING): Given đã lưu, Then khung kết quả hiện BMI và phân loại BMI, trạng thái vòng đầu, 2 đánh giá vận động, mức theo dõi kèm tiêu chí nào đạt, và dòng "Sàng lọc theo ngưỡng tham chiếu tạm, không phải chẩn đoán".
- **AC-6** (`HLT-03`/P-13 PENDING): Given 0, 1, 2, 3 tiêu chí đạt, Then mức lần lượt là "Không ghi nhận bất thường", "Cần theo dõi", "Cần theo dõi sát", "Cần theo dõi sát". Given trẻ trên 60 tháng có 1 tiêu chí vận động, Then "Cần theo dõi"; 2 tiêu chí, Then "Cần theo dõi sát".
- **AC-7** (`HLT-01`): Given lần đo mới ở mức "Cần theo dõi sát" và trẻ chưa có phiếu mở, Then có phiếu trạng thái "Chờ trao đổi phụ huynh". Given trẻ đã có phiếu mở, Then không có phiếu thứ hai; phiếu cũ ghi thêm lần đo.
- **AC-8** (`HLT-01`): Given giáo viên phụ trách lớp, When ghi "Đã trao đổi" (bắt buộc ngày và nội dung), ghi "Kết quả khám bên ngoài" (bắt buộc nội dung), hoặc đóng phiếu (bắt buộc lý do), Then trạng thái đổi và lịch sử có người, thời điểm. Given Hiệu trưởng hoặc Phó hiệu trưởng, Then chỉ xem, không có nút cập nhật.
- **AC-9** (`HLT-01`): Given Hiệu trưởng bấm "Đóng đợt", Then hộp xác nhận nêu số trẻ sẽ thành "Vắng khám" và số phiếu còn "Chờ trao đổi phụ huynh". After đóng: nút nhập/sửa của đợt ẩn; mock trả 409 nếu vẫn gọi lưu. Hiệu trưởng mở lại được khi điểm trường không có đợt khác chưa đóng, bắt buộc lý do.
- **AC-10** (`HLT-01`): Given Sổ sức khỏe, When giáo viên phụ trách lớp bấm "Nhập số đo", Then form đầy đủ như đợt khám, nguồn ghi "Ngoài đợt khám", có phân loại và mở phiếu như AC-7.
- **AC-11** (`HLT-02`): Given trẻ có ≥2 lần đo, When mở Sổ sức khỏe và Xu hướng sức khỏe, Then thấy vòng đầu, 2 đánh giá vận động, phân loại BMI, mức theo dõi, đợt khám/nguồn, và biểu đồ vòng đầu. Lần đo thiếu chỉ số hiện "—" và biểu đồ bỏ qua điểm đó.
- **AC-12** (`PAR-02`; P-13b PENDING): Given giáo viên bấm "Công bố", Then hộp xác nhận liệt kê phụ huynh sẽ xem: số đo, biểu đồ, đánh giá vận động, phân loại BMI, mức theo dõi, ghi chú khám.
- **AC-13** (`HLT-04`, `HLT-05`): Then trong `src/` không còn "Suy dinh dưỡng", "Béo phì", `MALNOURISHED`, `OBESE`. Input AI giả không có tên trẻ, có vòng đầu, không có đánh giá vận động. Bản AI vẫn là DRAFT, không dùng lời chẩn đoán.
- **AC-14** (`HLT-01`): Given trình duyệt còn dữ liệu demo cũ trong localStorage, When mở Sổ sức khỏe, danh sách đợt khám, phiếu theo dõi, Then trang hiển thị đúng, không lỗi.
- **AC-15** (`HLT-02`): Given đợt có trẻ "Cần theo dõi" và trẻ đó có kết quả ở đợt trước, When mở danh sách theo dõi của đợt, Then thấy mức và ngày của lần trước bên cạnh lần này.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Lưu kết quả đợt khám | 1 collection measurement, thêm `campaignId` (null = ngoài đợt) | Collection riêng cho kết quả đợt | Sổ sức khỏe, xu hướng, công bố, lịch sử sửa dùng chung; nhập lẻ và nhập trong đợt cùng 1 form |
| Vị trí code | Trong module `children` (nơi sức khỏe đang ở), tách file riêng: `healthCheck*`, `healthFollowUp*` | Module mới `health-check/` | Đo lường đang ở `children`; module mới phải import chéo (`CODING_GUIDE.md` mục 2 cấm); tách file giữ `childrenMockRepository.js` (767 dòng) không phình thêm |
| Nhập trong đợt | Danh sách trẻ của lớp có trạng thái + form từng trẻ, nút "Lưu và nhập trẻ tiếp theo" | Bảng nhập cả lớp | 2 nhóm radio + 3 ô số + ghi chú mỗi trẻ ⇒ bảng tràn ở 375px; form từng trẻ dùng lại form nhập lẻ, dễ báo lỗi từng ô |
| Phân loại trong mock | Ngưỡng tạm, `reference.code = 'PLACEHOLDER'`; UI ghi "ngưỡng tham chiếu tạm" | Chép bảng WHO vào mock | FE không giữ business rule; tránh chép sai số liệu y tế; P-13 chưa ghi ở BE |
| Dữ liệu demo cũ | Mock tính lại phân loại khi đọc (`toMeasurementView`); collection mới khởi tạo bằng `||=` | Đổi `DB_KEY` để reset | Đổi khóa xóa dữ liệu demo của mọi module; tính khi đọc giống BE trả giá trị dẫn xuất |
| Trạng thái đợt | BE trả `UPCOMING`/`IN_PROGRESS`/`CLOSED`/`CANCELLED`; FE chỉ hiển thị | FE tự tính từ ngày | Không tính lại nghiệp vụ ở component (`.claude/rules/component.md`) |
| Phạm vi plan | 1 plan, 3 phase, dừng review sau mỗi phase | Tách 3 plan (chỉ số, đợt khám, phiếu) | Cùng 1 contract measurement; tách plan phải sửa contract 3 lần. Mỗi phase >8 file ⇒ user chọn ở bước duyệt |

## Phases
### Phase 1 — Chỉ số mới và phân loại (nhập lẻ, Sổ sức khỏe, Xu hướng)
- Files: M `src/models/children/childrenConstants.js` · C `src/services/children/mock/healthScreeningRule.js` · D `src/services/children/mock/nutritionRule.js` · M `src/utils/children/childrenValidation.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/mocks/childrenSeed.js` · M `src/components/children/ChildBadges.jsx` · M `src/components/children/GrowthChart.jsx` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/pages/children/HealthTrendPage.jsx` · M `src/styles/modules/children.css`
- Steps:
  1. Constants: bỏ `NUTRITION_STATUS`; thêm `MOTOR_RESULT` (`NO_ABNORMALITY`, `ABNORMAL`), `BMI_STATUS` (`LOW`, `NORMAL`, `HIGH`, `UNAVAILABLE`), `HEAD_CIRCUMFERENCE_STATUS` (`NORMAL`, `SMALL`, `LARGE`, `NOT_MEASURED`), `FOLLOW_UP_LEVEL` (`NONE`, `WATCH`, `CLOSE_WATCH`, `UNAVAILABLE`), `SCREENING_CRITERIA`, nhãn tiếng Việt; typedef measurement mới; trục biểu đồ vòng đầu theo nhóm tuổi (chỉ là khung hiển thị).
  2. `healthScreeningRule.js` thay `nutritionRule.js`: BMI + phân loại BMI, trạng thái vòng đầu, đếm tiêu chí, mức theo dõi, quy tắc trên 60 tháng; ngưỡng tạm có ghi chú.
  3. Validation hỗ trợ nhập liệu: vòng đầu 30–60 cm, bước 0,1, bắt buộc khi ≤60 tháng tại ngày đo; 2 đánh giá vận động bắt buộc khi tạo mới; lần đo cũ không bắt buộc ô mới khi sửa.
  4. Mock: lưu field mới, lịch sử sửa có nhãn field mới, tính lại phân loại khi đọc (AC-14), AI giả theo AC-13.
  5. Seed: thêm vòng đầu và vận động cho các lần đo trừ lần đầu (minh họa dữ liệu cũ); vài trẻ đủ 1 và 2 tiêu chí để demo đủ mức. Không dữ liệu thật.
  6. Badge: `BmiStatusBadge`, `FollowUpLevelBadge` qua `createStatusBadge`; tông theo `DESIGN.md` mục 3.2 (theo dõi = cảnh báo, theo dõi sát = nguy hiểm nhẹ, không dùng chữ chẩn đoán).
  7. Form: 2 nhóm radio dùng `fieldset`/`legend`; ẩn vòng đầu khi trên 60 tháng; khung kết quả theo AC-5; hộp công bố theo AC-12.
  8. Sổ sức khỏe và Xu hướng: thẻ lần gần nhất, bảng thêm cột (bảng cuộn ngang trong card, kiểm 375px), biểu đồ vòng đầu, chú thích "không phải chẩn đoán".
- Tests: AC-4, AC-5, AC-6, AC-10 (phần form, chưa có phiếu), AC-11, AC-12, AC-13, AC-14 → kiểm tra thủ công trên trình duyệt (vai giáo viên phụ trách lớp, Phó hiệu trưởng, Hiệu trưởng) + `grep -rn -E "Suy dinh dưỡng|Béo phì|MALNOURISHED|OBESE" src` → 0 kết quả.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; lệnh tự kiểm `DESIGN.md` mục 13.1 không ra dòng mới.
- **Dừng chờ user review.**

### Phase 2 — Đợt khám
- Files: C `src/models/children/healthCheckConstants.js` · M `src/utils/children/childrenPermissions.js` · C `src/services/children/mock/healthCheckMockRepository.js` · C `src/services/children/api/healthCheckApi.js` · C `src/services/children/healthCheckService.js` · C `src/hooks/children/useHealthChecks.js` · C `src/mocks/healthCheckSeed.js` · C `src/pages/children/HealthCheckListPage.jsx` · C `src/pages/children/HealthCheckFormPage.jsx` · C `src/pages/children/HealthCheckDetailPage.jsx` · M `src/components/children/ChildBadges.jsx` · M `src/services/children/mock/childrenMockRepository.js` · M `src/pages/children/HealthMeasurementFormPage.jsx` · M `src/utils/children/breadcrumbs.js` · M `src/routes/AppRoutes.jsx` · M `src/layouts/menuConfig.js` · M `src/styles/modules/children.css`
- Steps:
  1. Constants + typedef đợt khám, `CAMPAIGN_STATUS`, `CHILD_RESULT_STATUS` (`NOT_RECORDED`, `RECORDED`, `ABSENT`).
  2. Quyền (UX, mock kiểm lại): `canManageHealthCheck` (Hiệu trưởng), `canViewHealthCheck` (Hiệu trưởng; Phó hiệu trưởng theo điểm trường; giáo viên/tổ trưởng theo điểm trường của lớp mình).
  3. Mock + API + facade + hook: danh sách, chi tiết theo lớp, tạo, sửa, hủy, đóng (trả số vắng khám), mở lại (có lý do); luật 1 đợt chưa đóng/điểm trường (AC-1); seed 1 đợt đã đóng + 1 đợt đang diễn ra cho mỗi điểm trường.
  4. `saveMeasurement` nhận `campaignId`: kiểm đợt đang diễn ra, cùng điểm trường, ngày trong khoảng; đợt đã đóng ⇒ 409 (AC-9).
  5. Trang danh sách (bộ lọc điểm trường, trạng thái), form đợt, trang chi tiết: thông tin đợt, tiến độ theo lớp (Hiệu trưởng, Phó hiệu trưởng), danh sách trẻ lớp mình (giáo viên) với nút nhập/sửa, danh sách theo dõi của đợt (AC-15), hành động đóng/mở lại/hủy có `ConfirmationModal`.
  6. Form số đo: đọc `?campaignId=`, giới hạn ngày, nút "Lưu và nhập trẻ tiếp theo" (AC-3).
  7. Route + menu "Đợt khám sức khỏe" cho Hiệu trưởng, Phó hiệu trưởng, giáo viên, tổ trưởng.
- Tests: AC-1, AC-2, AC-3, AC-9 (phần đợt), AC-15 → thủ công trình duyệt với 4 vai.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; lệnh tự kiểm `DESIGN.md` mục 13.1 không ra dòng mới.
- **Dừng chờ user review.**

### Phase 3 — Phiếu theo dõi
- Files: M `src/models/children/healthCheckConstants.js` · M `src/utils/children/childrenPermissions.js` · M `src/services/children/mock/healthCheckMockRepository.js` · M `src/services/children/api/healthCheckApi.js` · M `src/services/children/healthCheckService.js` · M `src/hooks/children/useHealthChecks.js` · M `src/services/children/mock/childrenMockRepository.js` · C `src/pages/children/HealthFollowUpListPage.jsx` · C `src/pages/children/HealthFollowUpDetailPage.jsx` · M `src/pages/children/HealthCheckDetailPage.jsx` · M `src/pages/children/ChildHealthRecordPage.jsx` · M `src/routes/AppRoutes.jsx` · M `src/layouts/menuConfig.js`
- Steps:
  1. `FOLLOW_UP_STATUS` (`WAITING_PARENT_CONTACT`, `PARENT_CONTACTED`, `EXTERNAL_RESULT_RECORDED`, `CLOSED`), nhãn, typedef phiếu.
  2. Quyền: `canUpdateFollowUp` (giáo viên phụ trách lớp hiện tại của trẻ); xem theo cùng scope với Sổ sức khỏe.
  3. Mock: tự mở phiếu khi lưu kết quả "Cần theo dõi sát", 1 phiếu mở/trẻ (AC-7); 3 hành động cập nhật có kiểm trạng thái (409 khi sai trạng thái) và lịch sử (AC-8); số phiếu chờ trao đổi trong kết quả đóng đợt (AC-9).
  4. Trang danh sách phiếu (lọc điểm trường, lớp, trạng thái) và trang chi tiết (thông tin trẻ, tiêu chí, các lần đo liên quan, lịch sử, hành động theo quyền). Chữ "kết quả khám bên ngoài" kèm hint "ghi đúng lời bác sĩ đã báo, không tự kết luận".
  5. Sổ sức khỏe: thẻ "Phiếu theo dõi đang mở" có link. Chi tiết đợt: cột phiếu trong danh sách theo dõi; hộp đóng đợt thêm số phiếu chờ trao đổi.
  6. Route + menu "Phiếu theo dõi sức khỏe".
- Tests: AC-7, AC-8, AC-9 (phần phiếu), AC-10 (phần phiếu), AC-14 → thủ công trình duyệt với 4 vai.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`, skip 0; lệnh tự kiểm `DESIGN.md` mục 13.1 không ra dòng mới.
- **Dừng chờ user review.**

Sau Phase 3: cập nhật `docs/architecture/ROUTE_MAP.md` (cột route thực tế), `FE-CASE-261014-health-role-flow-alignment`, `docs/knowledge/ISSUE_INDEX.md`, `docs/features/README.md`; chạy `node scripts/check-ai-layer.mjs`.

## Đề xuất cho BE (chưa sửa repo BE — cần user cho phép)
- `BE:docs/business/BUSINESS_RULES.md`:
  - HLT-01 (sửa): chỉ số gồm chiều cao, cân nặng, vòng đầu (chỉ trẻ ≤60 tháng tại ngày đo), vận động thô và vận động tinh ("Không ghi nhận bất thường" / "Có bất thường"), ghi chú khám. Nhập theo đợt khám hoặc ngoài đợt. Giáo viên phụ trách lớp nhập, sửa, công bố.
  - HLT-07 (mới) đợt khám: Hiệu trưởng tạo theo điểm trường; 1 đợt chưa đóng mỗi điểm trường; sửa khi chưa đóng; hủy khi chưa có kết quả; đóng ⇒ trẻ chưa có kết quả là "Vắng khám", khóa kết quả; Hiệu trưởng mở lại có lý do. Phó hiệu trưởng điểm trường xem.
  - HLT-08 (mới) phân loại: BMI theo tuổi WHO ⇒ thấp hơn chuẩn / bình thường / cao hơn chuẩn. Mức theo dõi theo 3 tiêu chí (vòng đầu theo tuổi WHO, vận động thô, vận động tinh): 0 / 1 / ≥2 ⇒ Không ghi nhận bất thường / Cần theo dõi / Cần theo dõi sát – đề nghị khám chuyên khoa; trẻ >60 tháng xét 2 tiêu chí vận động. BMI không tính vào mức theo dõi. Ngưỡng đề xuất: ngoài −2 SD / +2 SD (z-score WHO) — BE chốt.
  - HLT-09 (mới) phiếu theo dõi: tự mở ở mức "Cần theo dõi sát"; 1 phiếu mở/trẻ; trạng thái và actor như quyết định 7. **Đã thay bằng bản phiếu dài hạn** ở `docs/plans/completed/2026-10-16-health-follow-up-long-lived.md` (user chốt 2026-10-16).
- P-13 → WHO (user, 2026-10-15). Ngưỡng SD còn chờ BE xác nhận.
- P-13b → phụ huynh xem tất cả của bản đã công bố (user, 2026-10-15). APP ghi "Kết quả sàng lọc, không phải chẩn đoán".
- Exclusions: mức theo dõi là sàng lọc theo ngưỡng; "kết quả khám bên ngoài" là ghi nhận lời bác sĩ; hệ thống không chẩn đoán.
- `BE:docs/modules/health.md`: Owns thêm HealthCheckCampaign, HealthFollowUp; bỏ PENDING "người nhập measurement".
- `BE:docs/business/USER_ROLES.md` / permission PROPOSED: `health-check:manage` (Hiệu trưởng), `health-check:view` (Hiệu trưởng, Phó hiệu trưởng theo điểm trường, giáo viên theo lớp), `health:record` (giáo viên phụ trách lớp), `health-follow-up:update` (giáo viên phụ trách lớp).
- `BE:docs/knowledge/CROSS_MODULE_ISSUES.md`: phân loại BMI sẽ là đầu vào cho nutrition (điều chỉnh khẩu phần) ở plan sau.
- Contract PROPOSED:
  - Đợt khám: `GET /health-checks?campusId&status` · `POST /health-checks` `{ name, campusId, startDate, endDate, examiner, note }` · `PUT /health-checks/{id}` · `POST /health-checks/{id}/cancel` · `POST /health-checks/{id}/close` → `{ absentCount, waitingFollowUpCount }` · `POST /health-checks/{id}/reopen` `{ reason }` · `GET /health-checks/{id}` → đợt + `classes: [{ classId, className, total, recorded, absent, watch, closeWatch }]` · `GET /health-checks/{id}/classes/{classId}/children` → `[{ childId, code, fullName, ageMonths, result: 'NOT_RECORDED'|'RECORDED'|'ABSENT', measurementId, followUpLevel, published }]` · `GET /health-checks/{id}/watch-list` → trẻ `WATCH`/`CLOSE_WATCH` kèm `previous: { date, followUpLevel }`. Đợt trả `status: 'UPCOMING'|'IN_PROGRESS'|'CLOSED'|'CANCELLED'`.
  - Measurement: body `POST /children/{childId}/health/measurements`, `PUT …/{measurementId}`: `{ campaignId|null, date, heightCm, weightKg, headCircumferenceCm|null, grossMotor: 'NO_ABNORMALITY'|'ABNORMAL', fineMotor, note?, reason? }`. Trả thêm: `campaignId`, `campaignName`, `headCircumferenceCm`, `grossMotor`, `fineMotor`, `bmi`, `bmiStatus`, `headCircumferenceStatus`, `criteria: [{ key: 'HEAD_CIRCUMFERENCE'|'GROSS_MOTOR'|'FINE_MOTOR', flagged }]`, `followUpLevel`, `followUpId|null`, `reference: { code, label }`; bỏ `nutritionStatus`. Lỗi: 409 đợt đã đóng/hủy; 422 ngày ngoài khoảng đợt, thiếu vòng đầu khi ≤60 tháng.
  - Phiếu: contract mới ở `docs/plans/completed/2026-10-16-health-follow-up-long-lived.md` (tài nguyên `parent-contacts`, `external-results`, `timeline[]`, lọc `overdue`).
- `BE:docs/modules/ai-assistance.md`: input `interpretHealthTrend` thêm vòng đầu, phân loại BMI; không gửi đánh giá vận động.

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1 | HLT-01 | Thủ công: tạo đợt thứ 2 cùng điểm trường | 2 | Mock: đạt (422) · Trình duyệt: chưa chạy |
| AC-2 | HLT-01 | Thủ công: Phó hiệu trưởng, giáo viên mở danh sách/chi tiết đợt | 2 | Mock: đạt (phạm vi 3 vai) · Trình duyệt: chưa chạy |
| AC-3 | HLT-01 | Thủ công: nhập từ đợt, "Lưu và nhập trẻ tiếp theo" | 2 | Mock: đạt (ngày ngoài khoảng đợt bị chặn) · Trình duyệt: chưa chạy |
| AC-4 | HLT-01 | Thủ công: form trống; trẻ Mẫu giáo lớn trên 60 tháng | 1 | Mock: đạt (422 từng ô; trẻ 65 tháng không có vòng đầu) · Trình duyệt: chưa chạy |
| AC-5 | P-13 | Thủ công: khung kết quả sau lưu | 1 | Build đạt · Trình duyệt: chưa chạy |
| AC-6 | P-13 | Thủ công: nhập đủ tổ hợp 0–3 tiêu chí, trẻ trên 60 tháng | 1 | Mock: đạt (seed + kịch bản 0–3 tiêu chí, trên 60 tháng) |
| AC-7 | HLT-01 | Thủ công: 2 lần đo "theo dõi sát" liên tiếp | 3 | Mock: đạt (mở phiếu; lần 2 ghi thêm vào phiếu cũ) |
| AC-8 | HLT-01 | Thủ công: cập nhật phiếu bằng giáo viên; xem bằng Hiệu trưởng | 3 | Mock: đạt (giáo viên cập nhật; Hiệu trưởng 403) |
| AC-9 | HLT-01 | Thủ công: đóng, thử lưu, mở lại | 2, 3 | Mock: đạt (vắng khám, 409, khóa, mở lại cần lý do) · Trình duyệt: chưa chạy |
| AC-10 | HLT-01 | Thủ công: nhập lẻ từ Sổ sức khỏe | 1, 3 | Mock: đạt · Trình duyệt: chưa chạy |
| AC-11 | HLT-02 | Thủ công: Sổ sức khỏe, Xu hướng ở 1280px và 375px | 1 | Build đạt · Trình duyệt: chưa chạy |
| AC-12 | PAR-02 | Thủ công: hộp xác nhận công bố | 1 | Build đạt · Trình duyệt: chưa chạy |
| AC-13 | HLT-04, HLT-05 | `grep` nhãn cũ trong `src` + đọc input AI giả | 1 | `grep` → 0 dòng; input AI giả đã đọc lại: không tên, có vòng đầu, không vận động |
| AC-14 | HLT-01 | Thủ công: giữ localStorage cũ, mở các trang | 1, 3 | Kịch bản nâng cấp localStorage cũ: đạt |
| AC-15 | HLT-02 | Thủ công: danh sách theo dõi của đợt đang diễn ra | 2 | Mock: đạt (lần trước kèm đợt) · Trình duyệt: chưa chạy |

Repo chưa có framework unit test (`package.json` chỉ có `dev`, `build`, `preview`, `lint`). Thêm framework là thêm dependency ⇒ phải hỏi user, không nằm trong plan này. "Mock" = kịch bản gọi trực tiếp backend giả (bundle esbuild + localStorage giả, chạy trong scratchpad, không lưu vào repo).

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Mức theo dõi bị hiểu là chẩn đoán (phụ huynh xem tất cả) | Phụ huynh lo lắng, trái Exclusions | Nhãn trung tính, dòng "không phải chẩn đoán" ở web và đề xuất cho APP; giáo viên trao đổi trước qua phiếu | Đổi nhãn ở constants |
| Ngưỡng tạm bị hiểu là chuẩn WHO thật | Báo sai cho phụ huynh | UI ghi "ngưỡng tham chiếu tạm" tới khi BE trả `reference` thật | — |
| BE chọn field, trạng thái, ngưỡng khác đề xuất | Sửa lại FE | Contract gom ở constants + mock + api; UI chỉ đọc giá trị trả về | Revert theo phase |
| Đóng đợt nhầm | Giáo viên không nhập tiếp được | Hộp xác nhận nêu số vắng khám; Hiệu trưởng mở lại được | Mở lại đợt |
| Bảng Sổ sức khỏe quá rộng | Tràn ngang ở màn hẹp | Cuộn ngang trong card; ghép vận động vào 1 cột; kiểm 375px | — |
| Dữ liệu demo cũ trong localStorage | Trang lỗi khi thiếu field/collection | Tính lại khi đọc; `||=` cho collection mới | "Khôi phục dữ liệu demo" ở menu người dùng |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer cụ thể: `HealthMeasurementFormPage`, `ChildHealthRecordPage`, `HealthTrendPage`, `GrowthChart`, `ChildBadges`, mock AI, 5 trang mới; APP màn sức khỏe phụ huynh
- [x] Mỗi AC có test; mỗi phase có Exit = lệnh + kết quả mong đợi
- [x] >8 file hoặc >3 phase ⇒ đã đề xuất tách plan (Key decisions, dòng "Phạm vi plan"; user chọn khi duyệt)
- [x] Không dùng rule PENDING/OPEN như đã chốt (P-13, P-13b ghi PENDING ở BE; quyết định user ghi PROPOSED; ngưỡng là tạm)
- [x] Tự review: không placeholder · không mâu thuẫn · scope vừa 1 plan · không câu mơ hồ

## Progress log
### 2026-10-15 — Plan draft (chờ review)
- Commit: chưa commit
- Verify: chưa chạy (chưa sửa code)
- Khác plan: thay plan nháp `2026-10-15-health-head-arm-circumference.md` (bỏ vòng cánh tay, thêm đợt khám, vận động, phiếu theo dõi; phụ huynh xem tất cả)
- Tiếp: user duyệt plan và chọn 1 plan 3 phase hay tách ⇒ Phase 1.

### 2026-10-15 — Phase 1 (done, user duyệt chạy liên tục không dừng review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Kiểm thêm: bundle seed + rule bằng esbuild (scratchpad) — lần đo 2026-09-15: 22 "Không ghi nhận bất thường", 5 "Cần theo dõi", 5 "Cần theo dõi sát"; trẻ 61 tháng không có vòng đầu, xét 2 tiêu chí. `grep -rn -E "Suy dinh dưỡng|Béo phì|MALNOURISHED|OBESE" src` → 0.
- Khác plan: thêm `src/components/children/MeasurementSummary.jsx` (khối kết quả dùng chung form + Sổ sức khỏe); `ChildProfilePage.jsx` đổi 1 dòng mô tả; mock nâng cấp dữ liệu demo cũ trong localStorage (`HEALTH_SEED_VERSION`) để bản ghi seed chưa sửa có vòng đầu/vận động. Hộp xác nhận công bố thêm ở trang kết quả sau lưu. Chưa kiểm thủ công trên trình duyệt (không có công cụ trình duyệt trong phiên).
- Tiếp: Phase 2.

### 2026-10-15 — Phase 2 (done)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Kiểm thêm: kịch bản backend giả (esbuild bundle trong scratchpad, localStorage giả) 25/25 đạt — phạm vi Hiệu trưởng/PHT/giáo viên, AC-1 (đợt thứ 2 chưa đóng bị chặn), hủy đợt chưa có kết quả, AC-4 (thiếu vòng đầu/vận động), ngày ngoài khoảng đợt, 1 kết quả/trẻ/đợt, AC-6, AC-9 (đóng ⇒ vắng khám, lưu 409, khóa; mở lại cần lý do), trẻ 65 tháng không đo vòng đầu.
- Khác plan: thêm `src/services/children/mock/healthCheckRule.js` (trạng thái đợt dùng chung 2 mock), `src/components/children/HealthCheckClassRoster.jsx` (danh sách trẻ theo lớp trong trang chi tiết), icon `Stethoscope` trong `icons.js`; `ChildAccessState` nhận `text` để dùng cho trang đợt khám; Sổ sức khỏe có banner "Nhập kết quả trong đợt" khi đợt đang diễn ra. `ensureSeeded` của mock trẻ được export thành `ensureChildRecordsSeeded` để mock đợt khám dùng chung seed.
- Tiếp: Phase 3.

### 2026-10-15 — Phase 3 (done) + đóng plan
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Kiểm thêm: kịch bản backend giả 44/44 đạt (thêm phiếu theo dõi: mở phiếu, ghi thêm lần đo, 3 bước cập nhật, quyền Hiệu trưởng chỉ xem, phiếu đã đóng 409); kịch bản dữ liệu demo cũ trong localStorage (không có vòng đầu/vận động/đợt/phiếu, còn `nutritionStatus`) đạt. Tự kiểm `DESIGN.md` 13.1: không mã màu, px cỡ chữ/bo góc, import Tabler mới; `style={{}}` còn lại là dòng cũ.
- Khác plan: danh sách phiếu trả `{ items, counts }` (số đếm theo trạng thái do service tính, không đếm ở UI); `ChildProfilePage`, `HealthDeclarationPage` đổi câu chữ "số đo" thành "kết quả khám". Chưa kiểm thủ công trên trình duyệt (phiên không có công cụ trình duyệt) — cần chạy `npm run dev` và đi luồng 4 vai trước khi demo.
- Tiếp: user kiểm trên trình duyệt; xin phép sửa repo BE để ghi mục "Đề xuất cho BE"; plan thực đơn dùng phân loại BMI (tách riêng).

### 2026-10-15 — Bổ sung dữ liệu demo cho các đợt khám đã đóng (yêu cầu sau khi đóng plan)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`
- Nội dung: thêm đợt tháng 3/2026 cho 2 điểm trường; đợt 3, 6, 9 có vòng đầu, vận động, ghi chú khám, trẻ "Cần theo dõi"/"Cần theo dõi sát", trẻ vắng khám; phiếu theo dõi đã đóng của đợt 3 và 6; cân đo tại lớp 12/2025 (dữ liệu cũ). Seed lên `HEALTH_SEED_VERSION = 3`: localStorage cũ được cập nhật bản ghi seed chưa sửa và thêm phần thiếu, không xóa gì.
- Kiểm thêm: DB mới và DB v2 giả lập cho cùng số liệu đợt đã đóng; kịch bản backend giả 44/44; nâng cấp DB v1 đạt.

### 2026-10-16 — Sửa lỗi phiếu trùng khi sửa kết quả (phát hiện khi rà luồng phiếu với user)
- Commit: chưa commit
- Verify: xem dòng VERIFY trong báo cáo của lượt này
- Nội dung: sửa kết quả đã thuộc phiếu đã đóng không còn mở phiếu mới (`FE-BUG-261016-health-follow-up-duplicate-on-edit`). Mở `FE-CASE-261016-health-follow-up-child-withdrawn`: trẻ nghỉ học khi phiếu còn mở thì không ai đóng được phiếu; chờ user chọn cách xử lý. Mở `FE-CASE-261016-health-follow-up-repeat-close-watch`: phiếu đã qua bước trao đổi mà lần khám sau lại "Cần theo dõi sát" thì kết quả mới không có bước trao đổi nào; chờ user chọn cách xử lý.
- Kiểm thêm: kịch bản tái hiện (sửa ghi chú không mở phiếu, lần khám sau vẫn mở phiếu mới); kịch bản backend giả 44/44; nâng cấp DB cũ đạt; số liệu các đợt đã đóng không đổi.
