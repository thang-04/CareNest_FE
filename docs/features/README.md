# Features — feature nghiệp vụ → màn hình Web

File này **không chứa business rule**. Rule, flow, PENDING nằm ở BE module card/flow; ở đây chỉ map feature sang màn hình Web và chỉ chỗ đọc. Actor và permission từng màn hình: `docs/architecture/ROUTE_MAP.md`.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## Quyết định ghép chọn lọc hai nhánh — 2026-10-18

Ngoại lệ sidebar được user chốt lại 2026-10-19 sau ảnh menu mới: **nhóm Thực đơn lấy điều hướng mới của G94-191/G94-209**, không giữ nhóm cũ. PHT: Quy trình → Thiết lập dinh dưỡng → Thực phẩm → Món ăn → Thực đơn mẫu → Thực đơn tuần; Hiệu trưởng: Thiết lập dinh dưỡng, Thực đơn tuần (đúng guard đang có). Giữ các nhóm khác, bộ lọc mảng phụ trách của PHT và toàn bộ đường dẫn legacy; không nhận menu Con người hoặc thay quyền/phân công. AI/thay thế/cân đối dùng trong luồng màn mới, không cần mục sidebar riêng.

Cập nhật 2026-10-19: user chọn phương án 1 cho Phase 2 — nhận UI phân quyền G94-209 nhưng cấu hình demo độc lập, không áp vào quyền/auth/phân công hiện tại. Đã đưa ba tab và wizard vào bản làm việc; xem [trung tâm phân quyền demo](permission-center-demo.md). Phụ huynh/hồ sơ trẻ Phase 3 chưa ghép; chưa commit/push.

Nguồn: người dùng trực tiếp trong chat, CONFIRMED cho phạm vi tích hợp Web demo; không thay trạng thái rule/contract BE.

- Giữ bản dev cho điểm danh, sức khỏe, suất ăn, đăng nhập/phiên, menu và quy tắc Git.
- Lấy dinh dưỡng/bếp từ G94-191 và phần chung có ở G94-209; lấy màn phân quyền, phụ huynh/hồ sơ trẻ từ G94-209. User làm rõ: **UI bên trong màn phân quyền (tab, bảng, bộ lọc, hộp thoại) lấy G94-209**, không giữ layout quyền cũ; giữ menu chỉ là giữ sidebar và entry Vai trò & quyền hiện tại để mở màn mới.
- **Phân công giáo viên giữ code dev**, không nhận roster/nguồn phân công mới. Quyền mới phải tương thích auth và scope hiện tại, không tự làm rộng quyền.
- User đồng ý thêm `read-excel-file@9.3.10`. Không đổi BE/App, không coi thông báo demo là push thật; các stash và WIP unlock giữ nguyên.
- UI hồ sơ trẻ có thể đổi theo nhánh nguồn nhưng dữ liệu cũ/liên kết sức khỏe, đón trẻ, đánh giá và giáo dục phải được bảo toàn bằng migration/adapter.
- Đã duyệt kế hoạch; ngày 2026-10-19 Phase 1 dinh dưỡng/bếp và Phase 2 phân quyền demo độc lập có trong working tree, chưa commit/push. Phụ huynh/hồ sơ trẻ Phase 3 chưa triển khai, chờ review. Bằng chứng kiểm tra: [kế hoạch ghép chọn lọc](../plans/active/2026-10-18-selective-nutrition-permission-merge.md). Không coi đây là đã merge toàn bộ hai nhánh.
- Bếp mới đọc snapshot số suất từng bữa của attendance hiện tại, không thay cơ chế xác nhận suất hay menu bên trái. Giữ tương thích dữ liệu chế biến lịch sử và không trừ tồn lại khi nâng cấp mock; xem [bẫy ghép bếp](../knowledge/incidents/FE-BUG-261019-selective-kitchen-merge-compat.md). API mới chỉ demo, chưa xác nhận contract BE.

## Thực đơn dị ứng trong màn bếp — 2026-10-19

Nguồn: user chọn cả Theo ngày, Theo tuần và Quy trình bếp, sau đó yêu cầu triển khai. Dùng phương án A đã đề xuất: dòng vàng chỉ ghi món đổi "Thay X bằng Y" hoặc "Bỏ món X", lý do dị ứng và nút mắt. Mỗi thực đơn dị ứng là một phương án riêng, không trộn các phương án. Modal hiện tên trẻ, lớp, chất dị ứng liên quan; không liên kết hồ sơ.

Read model **mock đề xuất**, tham chiếu `BE:docs/modules/nutrition.md`, `BE:docs/modules/child.md` và AUTH-05/AUTH-07/NUT-08/NUT-09. Hook truyền điểm trường đang xem; mock kiểm scope trước khi trả trẻ ACTIVE trong nhóm tuổi/campus đó. Hiệu trưởng chọn điểm trường; PHT/bếp dùng điểm trường được phân công. Danh sách dị ứng không xác định số trẻ tham gia ăn và không sửa MealCount đã chốt. Mock hiện dùng lớp đang gắn trên trẻ, chưa có enrollment lịch sử để chứng minh scope theo ngày quá khứ.

API thật cần BE thống nhất dữ liệu cặp món gốc/món thay thế hoặc bỏ món, lý do, các phương án và danh sách tối thiểu tên/lớp/dị ứng trong scope người gọi theo ngày. Không tạo hoặc sửa endpoint thật trong đợt này, không coi mock là phân quyền BE đã thực thi. Không thay APP.

Known pitfall: dữ liệu cũ chỉ có hai danh sách món thì hiển thị riêng món bỏ/món thêm và ghi rõ chưa có cặp thay món; không đoán lý do hay tên trẻ. Xem [fallback legacy](../knowledge/incidents/FE-BUG-261019-published-allergy-legacy.md).

## Bảng map

Ngày 2026-10-12, người dùng làm rõ báo cáo giáo viên: một cột Suất ăn thay bữa trưa/chiều, theo tích Có/Không tham gia ăn bên điểm danh. Demo trả `mealTotal` theo lượt trẻ tham gia ăn/ngày, không cộng lặp một trẻ vì có nhiều bữa; UI, tổng Theo trẻ và CSV dùng cùng đơn vị. Không lấy riêng số Có mặt thay MealParticipation (tham chiếu NUT-01), không thay MealCount của bếp. Contract summary thật chưa có; đề xuất BE trả số lượt trẻ/ngày cho báo cáo này, phân biệt số suất theo từng bữa ở nutrition. Excel hai sheet vẫn đang chờ Phase 2.

Demo tiếp nhận trẻ tại `/attendance`: xem `daily-reception.md` (điểm danh/báo ăn và ghi nhận sức khỏe nhiều lần/ngày; chưa có contract thật).

Tổng hợp `/attendance/summary`: người dùng chốt 2026-10-12 giữ lọc từ ngày–đến ngày dd/mm/yyyy, bỏ giới hạn 31 ngày demo và phân trang riêng Theo ngày (20 dòng mặc định, 10/20/50 tùy chọn). Theo trẻ giữ cả lớp, tổng/biểu đồ cho toàn kỳ. Dữ liệu không khớp bộ lọc, đang tải, lỗi hoặc ngày sai không được xuất. Mock vẫn tải toàn kỳ, không phải server pagination; lớp/trẻ lịch sử chưa đầy đủ nên không dùng làm quyết toán. Đề xuất API thật trả phân trang ngày, tổng toàn kỳ, summary theo trẻ và xuất đầy đủ theo scope AUTH-08; chưa đặt endpoint. Plan `../plans/active/2026-10-12-attendance-summary-export.md` có Phase 2 .xlsx hai sheet, chờ sau review Phase 1; hiện CSV cũ còn giữ, không coi là .xlsx.

Luồng phòng `/school/rooms` được người dùng yêu cầu đổi tên hiển thị thành Phòng ban ngày 2026-10-12 (menu, breadcrumb, tiêu đề). Mọi loại Location có ô Sức chứa và cột danh sách hiển thị số đã lưu. Phòng học giữ required và ràng buộc lớp đang dùng phòng; loại khác tùy chọn, nếu nhập phải là số nguyên dương. Không đặt số mặc định cho dữ liệu cũ; mock lưu capacity cho mọi loại thay vì bỏ số của phòng không phải CLASS. Không đổi mã loại/route/quyền, không sửa BE/APP. Source of truth thật vẫn ở `BE:docs/modules/school-structure.md`; capacity ngoài CLASS là mở rộng demo, cần BE chốt trước tích hợp API.

| Feature V1 (BE)                                             | Màn hình Web (screen group)                                         | Module card                                                                 | Flow                                          | Rule nhóm               |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- | ----------------------- |
| Điểm danh + báo ăn                                          | Teacher: Điểm danh + báo ăn                                         | `BE:docs/modules/attendance.md`                                             | `BE:docs/business/flows/attendance.md`        | ATT                     |
| Số suất đã xác nhận → bếp                                   | Actor PENDING P-05 (theo `meal-count:confirm`): Xác nhận số suất    | `BE:docs/modules/nutrition.md`                                              | `BE:docs/business/flows/meal-management.md`   | NUT                     |
| Báo nghỉ (phụ huynh gửi qua app, không duyệt)               | Teacher: Báo nghỉ của lớp · BGH: Báo nghỉ của campus (chỉ xem)      | `BE:docs/modules/attendance.md`                                             | `BE:docs/business/flows/leave-request.md`     | ATT-04, ATT-05, ATT-05b |
| Thực đơn (MealPlan), dinh dưỡng; AI gợi ý thực đơn có duyệt | PHT: Xuất bản thực đơn tuần ([BA](nutrition-inventory.md))          | `BE:docs/modules/nutrition.md`                                              | `BE:docs/business/flows/meal-management.md`   | NUT, AI                 |
| Hồ sơ sức khỏe định kỳ, trend, AI diễn giải có duyệt        | Teacher: Nhập đo (actor PENDING) · BGH: Tổng quan sức khỏe          | `BE:docs/modules/health.md`                                                 | `BE:docs/business/flows/health-check.md`      | HLT, AI                 |
| Quan sát hằng ngày; summary; hồ sơ phát triển               | Teacher: Quan sát, Review summary · BGH: Summary & hồ sơ phát triển | `BE:docs/modules/learning-observation.md`                                   | `BE:docs/business/flows/child-observation.md` | OBS, AI                 |
| Báo & theo dõi sự cố CSVC                                   | Teacher: Báo sự cố · BGH: Theo dõi sự cố                            | `BE:docs/modules/facility-issue.md`                                         | `BE:docs/business/flows/facility-issue.md`    | FAC                     |
| Báo cáo lớp/campus/trường                                   | BGH: Dashboard báo cáo                                              | `BE:docs/modules/reporting.md`                                              | —                                             | AUTH-08                 |
| Tài khoản, phân quyền, phân công                            | Admin: Tài khoản, Role, Phân công                                   | `BE:docs/modules/identity-access.md`, `BE:docs/modules/school-structure.md` | —                                             | AUTH                    |
| Hồ sơ trẻ, ghi danh, dị ứng                                 | (màn hình Web chưa xác định — hỏi)                                  | `BE:docs/modules/child.md`                                                  | —                                             | AUTH-04, HLT-06         |
| Ngữ cảnh hoạt động/học tập                                  | **Không làm** — OPEN (ADR-0006)                                     | `BE:docs/modules/learning-observation.md`                                   | —                                             | OBS-07                  |

Parent visibility (PAR-\*) và gửi báo nghỉ thuộc APP. Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`).

## Cách dùng khi làm một feature

1. Tìm hàng trong bảng (hoặc grep `.ai/CONTEXT_MAP.yaml` → `keywords`).
2. Đọc module card BE (Rules, PENDING, Known pitfalls) → flow: chỉ bước `[S]` thành hành động UI.
3. Ghi rule ID liên quan vào doc feature/PR; **không chép nội dung rule**.
4. Màn hình phức tạp (nhiều trạng thái, nhiều role, có AI) ⇒ tạo `docs/features/<feature>.md` theo template dưới, thêm vào `docs/INDEX.md` và `.ai/CONTEXT_MAP.yaml` (`available.docs` + `keywords`).

## Template `docs/features/<feature>.md`

```markdown
# Feature — <tên>

Status: thiết kế | đang code | xong · BE card: `../CareNest_BE/docs/modules/<m>.md` · Rule: <ID,...>

## Actor & permission (dẫn ROUTE_MAP; actor PENDING ghi rõ)

## Màn hình & route (route thực tế, entry point, điều hướng)

## API dùng (method + path + DTO BE; endpoint chưa có ⇒ "cần thống nhất")

## Trạng thái UI (loading / empty / error / 403 / 404 / DRAFT-APPROVED)

## Server state / UI state (key cache, invalidate sau mutation nào)

## PENDING ảnh hưởng UI (ID P-xx + cách UI xử lý tạm: theo permission / cấu hình)

## Known pitfalls (1 dòng/bẫy, link incident FE nếu có)

## Test (component/e2e chính)
```

Agent: gặp bẫy UI đặc thù feature ⇒ thêm 1 dòng **Known pitfalls** vào doc feature (và link incident).

## Phiếu khám sức khỏe Phụ lục II (TT 33/2026) — FE xong, chờ BE

- Nguồn: user, 2026-10-17, CONFIRMED. Plan: [2026-10-17-health-exam-form-doctor-conclusion](../plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md). Thay một số quyết định của [plan đợt khám](../plans/completed/2026-10-15-health-check-campaign-assessment.md) và [plan phiếu dài hạn](../plans/completed/2026-10-16-health-follow-up-long-lived.md) (bảng "Đổi quyết định đã chốt" trong plan).
- Khi khám 1 trẻ có mặt: giáo viên (nhập), bác sĩ và nhân viên y tế (khám, không có tài khoản), trẻ, phụ huynh. Bỏ qua BE khi thiết kế; BE sửa sau khi FE hoàn thiện.
- Web: danh sách lớp của đợt có nút "Khám" ⇒ `/children/health-checks/:campaignId/exam/:childId`, phiếu 5 bước theo phần I–VI và Kết luận; tự lưu nháp khi chuyển bước; trước khi kết luận hiện "Điểm cần bác sĩ xem lại" (sinh tồn theo nhóm tuổi — mạch, nhịp thở AHA PALS 2020, nhiệt độ nách sốt từ 37,5 °C, hạ thân nhiệt dưới 36,0 °C, chờ bác sĩ xác nhận bảng số; gợi ý kết hợp vòng đầu + 2 câu phần IV; các mục ghi bất thường). Gợi ý không phải kết luận.
- Gợi ý gộp sinh tồn: 1/3 chỉ số ngoài khoảng ⇒ "cần theo dõi", từ 2/3 ⇒ "nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận". Bác sĩ không chuyển khám mà còn điểm cần xem lại ⇒ hộp hỏi lại, không chặn (user chốt 2026-10-17).
- Kết luận bác sĩ quyết định mức theo dõi: bình thường ⇒ không tạo việc; có vấn đề, tư vấn ⇒ "Cần theo dõi"; chuyển khám chuyên khoa hoặc nguy cơ lao ⇒ "Cần theo dõi sát" + phiếu theo dõi. Có người đi cùng ⇒ hệ thống ghi trao đổi tại buổi khám, không hạn 7 ngày, công bố được ngay. Nguy cơ lao ⇒ thông báo Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp.
- **Mức "Vấn đề đã biết, ổn định" (user chốt 2026-10-21, PROPOSED — chờ BE; thay một phần dòng trên):** "Cần theo dõi" nghĩa là vấn đề có thể chuyển biến, cần quan sát. Vấn đề đã biết và không thay đổi (ví dụ cận thị đã khám chuyên khoa, đang đeo kính) không gắn "Cần theo dõi" mà ở mức mới "Vấn đề đã biết, ổn định": tông nhãn thông tin (teal), không phải cảnh báo, hiện kèm tên vấn đề. Bác sĩ ghi "Có vấn đề về sức khỏe" mà không chuyển khám, không nguy cơ lao thì giáo viên chọn thêm "Vấn đề mới hoặc có thay đổi" (⇒ "Cần theo dõi") hoặc "Vấn đề đã biết, không thay đổi so với trước" (⇒ "Vấn đề đã biết, ổn định"); câu này không chọn sẵn, bác sĩ phải nói. Thống kê đợt vẫn đếm theo kết luận, nên trẻ vẫn tính là có vấn đề sức khỏe; tab "Trẻ cần theo dõi" không gồm mức này.
- **Khám trẻ đang có phiếu theo dõi, đóng phiếu có kết quả (user chốt 2026-10-21, PROPOSED — chờ BE; plan `docs/plans/completed/2026-10-21-health-follow-up-close-outcome.md`):**
  - Lưu kết luận không bao giờ đóng phiếu theo dõi.
  - Trẻ có phiếu đang mở (do lần khám khác mở): bước Kết luận hiện phiếu đang mở và thay 2 nhóm "Kết luận", "Hướng xử lý" bằng 1 câu "So với vấn đề đang theo dõi": "Chưa ghi nhận thêm bất thường" (phiếu giữ nguyên) · "Tư vấn" (vấn đề nhỏ mới, chỉ tư vấn, phiếu giữ nguyên) · "Có thêm bất thường mới" (phiếu sang vòng mới, trao đổi lại, có thể ghi chuyên khoa). Ô nguy cơ lao giữ; tích thì như bất thường mới. BE chọn mẫu (`conclusionMode`).
  - **Khóa lựa chọn "bình thường" (user chốt 2026-10-21, PROPOSED — chờ BE):** mẫu thường, đã tích "Có nguy cơ mắc lao" hoặc "Có vấn đề về sức khỏe" thì ô "Bình thường" bị khóa (bỏ tích 2 ô đó mới chọn lại được); đã chọn "Bình thường" mà tích 2 ô này thì tự bỏ "Bình thường". Mẫu có phiếu mở, đã tích nguy cơ lao thì khóa "Chưa ghi nhận thêm bất thường"; đang chọn ô đó mà tích lao thì bỏ chọn để bác sĩ chọn lại. BE từ chối lưu 2 tổ hợp này (`422`, `exam.conclusion.flags` / `exam.conclusion.followUpFinding`).
  - Phiếu còn mở thì mức hiện tại của trẻ là "Cần theo dõi sát" tới khi đóng phiếu.
  - Đóng phiếu bắt buộc chọn kết quả theo lời bác sĩ: "Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường)" (⇒ Không ghi nhận bất thường; cần kết quả chuyên khoa hoặc lần khám sau ngày mở phiếu) · "Chuyên khoa xác định có vấn đề, đã có hướng điều trị" + tên vấn đề (⇒ Vấn đề đã biết, ổn định; ghi vào tiền sử bản thân; cần kết quả chuyên khoa) · "Không có kết quả chuyên khoa" (giữ mức lần khám). Còn cần khám, tái khám hay quan sát tiếp thì để phiếu mở (không có kết quả "Cần theo dõi tiếp ở lớp").
  - Ghi kết quả chuyên khoa không có ngày hẹn khám lại ⇒ hộp đóng phiếu mở ngay ("Để phiếu mở" / "Đóng phiếu").
  - Danh sách trẻ: mức hiện tại = phiếu mở, hoặc mục mới hơn giữa lần khám có xếp mức và phiếu đóng có kết quả; hiện tên vấn đề đã biết, ngày kết quả chuyên khoa, dòng "phiếu đã đóng, chưa có kết quả chuyên khoa"; bộ lọc có "Vấn đề đã biết, ổn định".
- Công bố: phiếu có người đi cùng tự công bố cho phụ huynh khi lưu kết luận (kể cả lưu lại sau sửa); không có người đi cùng thì giáo viên công bố sau khi ghi trao đổi (user chốt 2026-10-17).
- Sau kết luận phiếu khóa; sửa cần lý do, lịch sử che số CCCD. Không in phiếu, không lấy chữ ký trên hệ thống. Có lưu CCCD/mã định danh của trẻ và người đi cùng (không bắt buộc, chỉ hiện trong phiếu).
- Kết quả khám chuyên khoa: chữ tự do + chuyên khoa / nơi khám (bắt buộc) + ảnh giấy kết quả (≤3); 30 ngày sau lần trao đổi chưa có kết quả ⇒ nhắc giáo viên.
- Danh sách trẻ lọc được theo mức theo dõi hiện tại (Cần theo dõi, Cần theo dõi sát, Vấn đề đã biết, ổn định, Không ghi nhận bất thường, Chưa có kết quả khám); phiếu nháp và cân đo ngoài đợt không tính (cách tính mức hiện tại: mục "Khám trẻ đang có phiếu theo dõi" bên trên).
- Bỏ nhãn phân loại BMI tự tính (chỉ số BMI); bác sĩ chọn tình trạng dinh dưỡng. Nhập lẻ ngoài đợt chỉ cân đo, không kết luận, không mở phiếu. Kết quả trước 2026-10-17 hiện nhãn "Mẫu cũ", giữ cách tính cũ.
- **Hành chính, tiền sử hỏi khi tiếp nhận (user chốt 2026-10-17, PROPOSED — chờ BE):** Phó hiệu trưởng nhập phần hành chính (CCCD/mã định danh, sinh non, tuần thai, dân tộc, đối tượng, nguồn chi trả, nhóm máu, nơi ở) ở bước 1 và tiền sử (bản thân, gia đình, tiếp xúc người bệnh lao) ở bước Khai báo sức khỏe; không bắt buộc, tiền sử có "Chưa cung cấp" (1a). Sửa sau: hành chính ở Sửa hồ sơ, tiền sử ở Khai báo sức khỏe. Phiếu khám luôn lấy từ hồ sơ trẻ, ô hồ sơ trống lấy từ phiếu khám gần nhất; lưu kết luận thì cập nhật ngược vào hồ sơ, có ghi lịch sử, phiếu nháp không cập nhật (2b — thay quyết định cũ "phiếu không sửa hồ sơ"). Khai "Có tiếp xúc với người bệnh lao" (tiếp nhận, nhập Excel, sửa khai báo) ⇒ báo Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp, trừ người lưu; câu trung tính, không mở phiếu theo dõi; cập nhật từ phiếu khám không báo (3b). File Excel tiếp nhận thêm các cột này, file mẫu cũ vẫn nhập được (4b). Trẻ đã tiếp nhận để "Chưa cung cấp" (5). Danh sách trẻ không trả phần hành chính. Plan `docs/plans/completed/2026-10-17-enrollment-admin-medical-history.md`.
- Đề xuất gửi BE (chưa sửa BE): mục "Đề xuất cho BE" của plan — HLT-01, HLT-08, HLT-09, contract phiếu khám.
- **Ngày tiếp xúc người bệnh lao gần nhất (user chốt 2026-10-21, PROPOSED — chờ BE; plan `docs/plans/completed/2026-10-21-tb-contact-date.md`; thay một phần 3b ở trên):**
  - Khai "Có" ở mọi chỗ (Khai báo sức khỏe, bước khai báo khi tiếp nhận, nhập Excel, phiếu khám) thì bắt buộc "Ngày tiếp xúc gần nhất": ngày đầy đủ, không nhớ chính xác thì ghi ngày ước lượng theo lời phụ huynh; không ở tương lai, không trước ngày sinh; ở phiếu khám không sau ngày khám. File Excel thêm cột "Ngày tiếp xúc người bệnh lao gần nhất (dd/mm/yyyy)".
  - Phiếu khám điền sẵn "Có" và ngày từ khai báo (khai báo trống thì từ phiếu khám gần nhất); giáo viên hỏi lại, sửa được; lưu kết luận cập nhật ngược vào khai báo.
  - Ngày đã có mà đổi sang ngày khác — khi sửa khai báo hoặc khi lưu kết luận phiếu khám — báo Hiệu trưởng và Phó hiệu trưởng điểm trường, trừ người lưu, không báo giáo viên; câu báo nêu ngày cũ, ngày mới, nơi đổi. Bổ sung ngày cho khai báo cũ chưa có ngày không tính là đổi ngày. Khai lần đầu "Có" vẫn báo như trên, câu báo có ngày.
  - Dữ liệu demo: mọi khai báo và phiếu khám "Có tiếp xúc" đều có ngày (DB cũ bổ sung một lần).
- **CCCD phụ huynh bắt buộc (user chốt 2026-10-21, PROPOSED — chờ BE; plan `docs/plans/completed/2026-10-21-guardian-citizen-id-required.md`):**
  - Mọi chỗ thêm phụ huynh: form tiếp nhận, nhập Excel (cột bắt buộc "Số CCCD phụ huynh" — file mẫu cũ thiếu cột thì không nhập được, khác 4b), Sửa hồ sơ, thêm phụ huynh ở màn Tài khoản phụ huynh. Chỉ CCCD đúng 12 chữ số, không nhận hộ chiếu.
  - Phụ huynh có từ trước chưa có CCCD: bổ sung khi chạm tới (liên kết tài khoản có sẵn vào trẻ mới, sửa hồ sơ). Tài khoản đã có CCCD thì tab "Đã có tài khoản" hiện số, Sửa hồ sơ khóa ô như SĐT đăng nhập. Kích hoạt tài khoản không bắt nhập, chép CCCD từ hồ sơ nếu có.
  - Trùng: hai phụ huynh cùng trẻ không trùng CCCD; CCCD trùng tài khoản có sẵn ⇒ gợi ý "Chọn tài khoản này"; 1 người 1 tài khoản — CCCD đã thuộc phụ huynh khác mà SĐT khác, hoặc SĐT đã ghi cho phụ huynh có CCCD khác ⇒ không lưu (`409`, lỗi dưới ô CCCD; Excel: dòng lỗi, kể cả hai dòng cùng file).
  - Hiển thị: mọi vai xem được thông tin phụ huynh thấy CCCD đầy đủ, như SĐT (hồ sơ trẻ, khung xem nhanh, xem lại khi tiếp nhận, màn Tài khoản phụ huynh). Danh sách trẻ, thông báo, AI không có CCCD.
  - Dữ liệu demo (user yêu cầu 2026-10-21): mọi phụ huynh, tài khoản phụ huynh và người đi cùng là phụ huynh ở phiếu khám đều có CCCD; DB cũ được bổ sung một lần, kể cả phụ huynh người dùng nhập trước quy định (cùng SĐT dùng CCCD đã ghi, không có thì CCCD giả "999" + 9 số cuối SĐT). Phiếu khám: chọn phụ huynh làm người đi cùng thì điền sẵn CCCD của phụ huynh.
