# Feature — Đánh giá hằng ngày (3 nhóm)

Status: demo FE (mock), 2026-10-15 · BE card: `../CareNest_BE/docs/modules/learning-observation.md` · Rule: OBS-01, OBS-02, OBS-07, OBS-12, OBS-13 (BE, chốt 29/10; trước đó GBR-OBS-01..05), ATT, AI

## Lệch BE (29/10)

Mock dưới đây làm trước khi BE chốt nhóm OBS; cần sửa khi tích hợp:
- Mặt và mức: BE có 7 mặt (ăn uống, ngủ, cảm xúc, hành vi/quan hệ với bạn, tham gia hoạt động, kiến thức–kỹ năng, sức khỏe), mức Đạt / Cần cố gắng / Chưa đạt (OBS-02). Mock dùng 3 nhóm với thang riêng từng cột, kiến thức–kỹ năng chỉ Đạt/Chưa đạt. Tiêu chí cố định hay trường cấu hình: P-11.
- Khóa ngày: BE hết ngày thì khóa, không có bước mở lại (OBS-12). Mock có PHT/HT mở lại ngày đã khóa (`/assessment/day-unlocks`).
- Mặc định: BE mọi trẻ có mặt mặc định "bình thường", GV chỉ sửa trẻ khác thường (OBS-01); mock điền sẵn phần lớn ô, khớp ý này.
- Kiến thức–kỹ năng: BE chấm theo mục tiêu hoạt động của kế hoạch ngày (OBS-07). Câu hỏi "MT hay YCCĐ" bên dưới nghiêng về MT; ghép mã với module kế hoạch giáo dục khi BE có API.
- Bữa ăn: mock còn cố định "Không ăn" cho bữa tắt "Tham gia ăn"; BE có mặt là ăn mọi bữa (ATT-02).
- Phụ huynh xem đánh giá ngày sau khi GV lưu (OBS-13) — thuộc APP.

Người dùng (Cần) yêu cầu ngày 2026-10-15: đánh giá theo 3 nhóm của Chương trình GDMN (TT 17/2009, TT 28/2016, TT 51/2020, VBHN 01/2021). Mục đích: dữ liệu dạng ô tích để tổng hợp tuần/tháng và làm đầu vào cho AI, dựa trên giáo án. Chỉ sửa màn đánh giá; không đổi luồng của điểm danh, khám sức khỏe, giáo án.

## Actor & permission

Giáo viên của lớp (route `/assessment/daily`). Chỉ người đã ghi nhận được sửa.

## Khóa ngày (Cần chốt 2026-10-15, thay GBR-OBS-03 "sửa đến hết ngày học tiếp theo")

- Đánh giá ngày D khóa sau 23:59:59 của chính ngày D: không ghi mới, không sửa, không còn "Điều chỉnh + lý do".
- Quên đánh giá: giáo viên tự gửi mail (ngoài hệ thống) cho Phó hiệu trưởng điểm trường hoặc Hiệu trưởng.
- PHT điểm trường / Hiệu trưởng mở lại ngày đó cho lớp ở `/assessment/day-unlocks` (menu "Mở lại ngày đánh giá"); lý do tùy chọn. Người mở chọn hạn "Mở đến" (ngày + giờ, mặc định 23:59 hôm nay, sau hiện tại, tối đa `UNLOCK_MAX_DAYS` = 7 ngày — PROPOSED); giáo viên sửa được đến hạn đó, quá hạn thì khóa lại. Giáo viên của lớp nhận thông báo có link tới ngày đó. Sửa bản đã ghi trong ngày mở lại được ghi vết `corrections` kèm người mở.
- Dữ liệu mock `assessmentDayUnlocks { classId, campusId, date, reason, unlockedBy, unlockedAt, validUntil }`. PENDING BE: `GET/POST /assessment/day-unlocks`; BE phải kiểm tra khóa khi lưu. Cần ghi Decision Log ở BE vì đổi rule GBR-OBS-03.

## Màn hình `/assessment/daily`

Bảng một dòng / trẻ **có mặt**. Lớp chưa điểm danh: trạng thái rỗng và nút "Điểm danh ngay". Trẻ vắng / chưa điểm danh: một dòng tên phía trên bảng. Tiêu đề 2 tầng và cột tên trẻ dính khi cuộn. Ở 1366×768 bảng vừa khung, không cuộn ngang.

| Nhóm                        | Cột                | Nguồn / cách nhập                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                             | Trẻ                | Ảnh đại diện, tên, mã trẻ (cột dính khi cuộn)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Sức khỏe                    | Sức khỏe           | Cô chọn "Bình thường" hoặc biểu hiện (danh mục `HEALTH_SYMPTOMS` của khám sức khỏe: Sốt, Ho, Sổ mũi, Cảm cúm, Mệt mỏi, Khác) + ghi chú. Điền sẵn từ lần khám sức khỏe mới nhất trong ngày; thân nhiệt từ mức Sốt (≥ 38,0 °C) điền thêm "Sốt". Cô chưa sửa: tự theo lần khám mới nhất. Cô đã sửa: giữ lựa chọn; khám sức khỏe có lần mới khác thì hiện "Khám SK hh:mm: … · Áp dụng". Không hiện thân nhiệt ở màn này; không ghi ngược vào dữ liệu khám sức khỏe. |
|                             | Ăn                 | Mỗi bữa của nhóm tuổi (`ageGroup.mealSessions`): Ăn hết / Ăn ít / Không ăn, mặc định Ăn hết. Bữa đã tắt "Tham gia ăn" khi điểm danh: cố định Không ăn                                                                                                                                                                                                                                                                                                           |
|                             | Ngủ trưa           | Ngủ tốt / Ngủ ít / Không ngủ, mặc định Ngủ tốt (chưa có cấu hình nhóm tuổi không ngủ trưa nên luôn hiện)                                                                                                                                                                                                                                                                                                                                                        |
| Cảm xúc – thái độ – hành vi | Cảm xúc            | `EMOTION` có sẵn                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|                             | Hành vi            | Ô tích trong khung mở; không tích = Bình thường; kèm "Điểm nổi bật trong ngày"                                                                                                                                                                                                                                                                                                                                                                                  |
|                             | Tham gia           | Tích cực / Bình thường / Chưa tích cực, theo hoạt động đang chọn; khóa khi không có giáo án duyệt                                                                                                                                                                                                                                                                                                                                                               |
| Kiến thức, kỹ năng          | Kiến thức, kỹ năng | Mục tiêu (MT) của hoạt động đó trong giáo án tuần đã duyệt. Bấm: chưa đánh giá → Đạt → Chưa đạt. Tiêu đề cột có nút ✓ "Cả lớp đạt" (không có chọn nhiều trẻ, bỏ theo yêu cầu 15/10)                                                                                                                                                                                                                                                                             |
|                             | Cờ, Nhận xét       | Như cũ; ô nhận xét giãn rộng khi đang gõ                                                                                                                                                                                                                                                                                                                                                                                                                        |

Mọi ô điền sẵn mặc định; ô khác mặc định tô vàng / đỏ. Không còn cột Trạng thái: viền trái của dòng (xanh lá đã ghi nhận, xanh dương chưa lưu, cam chưa đánh giá, đỏ lỗi) + tooltip. Khung mở (Ăn, Hành vi, Cả lớp đạt) vẽ ra ngoài bảng, Esc / bấm ra ngoài để đóng.

Danh mục ô tích: `src/models/assessment/dailyObservationOptions.js` (thêm / bớt mục ở đây, không đổi mã đã dùng).

Ô Sức khỏe chỉ hiện tiêu chí (vd. "Sốt"), không hiện xử trí (Cần chốt 2026-10-16); tổng hợp kỳ vẫn có `health.actionDays` (xem `daily-reception.md`).

## Giáo án (phụ thuộc module Kế hoạch giáo dục)

Sau khi merge FEAT-41, giáo án lớp là giáo án tuần (`eduClassWeek`, duyệt cả tuần) có 5 kế hoạch ngày. Mục tiêu của một giờ = các MT của hoạt động đã chọn ở ô (dòng giờ, ngày) trong `picks`; dòng gộp cả tuần dùng ô `all`. Giờ sinh hoạt → dòng: Hoạt động học → `hoc`, ngoài trời → `ngoai_troi`, trong lớp / góc → `goc`, chiều → `chieu`, Thể dục → `the_duc`. Bộ mục tiêu năm mới không có mã YCCĐ (requirements rỗng) nên màn hình dùng mã MT. NEEDS VERIFICATION: nhóm cần chốt chấm theo MT hay YCCĐ, và ghép mã lớp chung với module giáo án.

## Dữ liệu (mock, PROPOSED)

- `dailyObservations`: 1 bản ghi / trẻ / ngày `{ childId, classId, date, healthOverridden, healthSigns[], healthNote, healthSetAt, meals{MORNING|LUNCH|AFTERNOON: AN_HET|AN_IT|KHONG_AN}, nap, emotion, behaviors[], behaviorNote, recordedBy, recordedAt, updatedAt }`. `healthSigns` rỗng = Bình thường; chỉ chốt khi `healthOverridden`, nếu không thì luôn lấy theo khám sức khỏe mới nhất.
- `dailyAssessments` (theo hoạt động): thêm `participation`, `criteriaNotMet[]`, `lessonPlanId`, `themeId`. Bản ghi cũ giữ `healthStatus` để màn hồ sơ đọc.

## API dùng (cần thống nhất với BE)

- `GET /assessment/daily-sheet?classId&date&activity`: mỗi dòng trả thêm `observation`, `health { signs, note, overridden, check { prefill, time }, update { time, signs } | null }`, `skippedMeals[]`; sheet trả `mealSessions`, `plan { id, code, themeId, topic }`, `criteria` (MT).
- `PUT /assessment/daily-assessments`: entry `{ childId, healthSigns, healthNote, healthOverridden, meals, nap, emotion, behaviors, behaviorNote, participation, criteriaMet, criteriaNotMet, flag, comment, correctionReason? }`. BE kiểm tra: trẻ có mặt, lớp đã điểm danh, mục tiêu thuộc giáo án.
- Tổng hợp kỳ: `GET /assessment/evaluations/{kind}/{id}` trả `summary.structured`.

## Tổng hợp và AI

`periodSummaryOf` đếm thẳng từ ô tích: ngày có ghi nhận; sức khỏe (biểu hiện theo ô Sức khỏe của đánh giá: ngày bình thường, ngày theo biểu hiện; thân nhiệt lấy nội bộ từ khám sức khỏe, lần cao nhất trong ngày, đếm ngày theo mức); ăn theo bữa; ngủ; cảm xúc; hành vi tích cực / cần lưu ý; mức tham gia; mục tiêu đạt / chưa đạt theo chủ đề, lĩnh vực, MT. Màn duyệt đánh giá tuần / tháng hiện bảng "Số liệu từ đánh giá hằng ngày". Bản nháp AI chỉ nhận bảng số này và mục tiêu đã có trong giáo án của kỳ; câu chữ mô tả số lần quan sát, không kết luận sức khỏe; vẫn gắn nhãn bản nháp chờ giáo viên duyệt.

### Màn Đánh giá tuần / tháng (`/assessment/periodic/:id`, cập nhật 2026-10-18)

- Đầu trang: avatar, trạng thái, lớp, kỳ, số ngày có mặt, số ngày có đánh giá hằng ngày (bỏ thanh tiến trình, thẻ thông tin, cờ bé ngoan).
- Hai cột: Bản nháp AI (nhãn chờ giáo viên duyệt, "Tổng hợp từ N ngày đánh giá hằng ngày", Dùng bản nháp này / Tạo lại / Dữ liệu AI đã dùng) và Đánh giá chính thức (cô sửa rồi Xác nhận và công bố).
- Bên dưới: bảng "Số liệu từ đánh giá hằng ngày" và bảng "Đánh giá hằng ngày trong kỳ" mỗi ngày một dòng cùng cột với màn hằng ngày (Sức khỏe, Ăn, Ngủ, Cảm xúc, Hành vi, Kiến thức kỹ năng: chip xanh đạt / cam chưa đạt, Nhận xét); ngày bấm được để mở màn hằng ngày.
- Bản nháp AI (mock) khi kỳ có dữ liệu 3 nhóm: mở đầu số ngày đi học / được đánh giá, mục tiêu đạt, cần hỗ trợ, cảm xúc, sức khỏe, ăn, ngủ, hành vi, gợi ý phối hợp gia đình theo đúng điểm cần hỗ trợ. Bản ghi cũ vẫn dùng cách tổng hợp theo tiêu chí.
- API chi tiết thêm `days[]` (theo ngày) và `mealSessions`; `summary.assessedDays` thay `flagCount`, `activities`. PENDING BE.
- Demo: các ngày seed được bổ sung dữ liệu 3 nhóm hư cấu (`assessmentObsDemoVersion`) và tạo lại bản nháp chưa xác nhận.
- Danh sách bỏ khung thông báo.

## Trạng thái UI

Đang tải (skeleton) · lớp chưa có trẻ · lớp chưa điểm danh (nút Điểm danh ngay) · không có trẻ có mặt · không có giáo án duyệt (cột kiến thức khóa) · giờ không có mục tiêu · đã khóa (nút Điều chỉnh + lý do) · do giáo viên khác ghi nhận (chỉ xem) · lỗi dòng (viền đỏ + chữ lỗi dưới tên).

## Decision Log

Repo FE không có Decision Log; nhật ký quyết định ở `BE:docs/decisions/`. Đề xuất ghi: (1) 3 nhóm và danh mục ô tích; (2) ô Sức khỏe cô chọn, điền sẵn từ khám sức khỏe, thân nhiệt từ mức Sốt điền "Sốt" (cần đối chiếu quyết định 14/10/2026 "hệ thống không tự tích biểu hiện" của khám sức khỏe); (3) chấm theo MT của giáo án tuần.

## Known pitfalls

- Mock chỉ có giáo án tuần mẫu ở trạng thái Nháp, nên mặc định cột kiến thức khóa. Muốn thử phải có giáo án tuần đã duyệt có chọn hoạt động.
- Seed đánh giá cũ dùng bộ tiêu chí cũ (`crit_*`); tổng hợp vẫn đếm chúng ở mục tiêu, tiêu chí.

## Test

Tay, 2026-10-15, Lê Minh Anh, Lớp Chồi 1, 1366×768: ngày có giáo án (14/10, giáo án tuần duyệt tạm) và ngày không có (09/10). Lưu ăn ít, hành vi, MT1 đạt / MT2 chưa đạt, chấm hàng loạt; ô Sức khỏe điền sẵn, tự theo lần khám mới, giữ lựa chọn của cô và hiện Áp dụng khi khám mới 38,2 °C (→ Sốt); số trong `periodSummaryOf` và bản nháp AI khớp ô tích. Trẻ vắng bị từ chối khi lưu.
