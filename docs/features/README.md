# Features — feature nghiệp vụ → màn hình Web

File này **không chứa business rule**. Rule, flow, PENDING nằm ở BE module card/flow; ở đây chỉ map feature sang màn hình Web và chỉ chỗ đọc. Actor và permission từng màn hình: `docs/architecture/ROUTE_MAP.md`.

`BE:<path>` = `../CareNest_BE/<path>` (xem `AGENTS.md`).

## Bảng map

| Feature V1 (BE) | Màn hình Web (screen group) | Module card | Flow | Rule nhóm |
| --- | --- | --- | --- | --- |
| Điểm danh + báo ăn | Teacher: Điểm danh + báo ăn | `BE:docs/modules/attendance.md` | `BE:docs/business/flows/attendance.md` | ATT |
| Số suất đã xác nhận → bếp | Actor PENDING P-05 (theo `meal-count:confirm`): Xác nhận số suất | `BE:docs/modules/nutrition.md` | `BE:docs/business/flows/meal-management.md` | NUT |
| Báo nghỉ (phụ huynh gửi qua app, không duyệt) | Teacher: Báo nghỉ của lớp · BGH: Báo nghỉ của campus (chỉ xem) | `BE:docs/modules/attendance.md` | `BE:docs/business/flows/leave-request.md` | ATT-04, ATT-05, ATT-05b |
| Thực đơn (MealPlan), dinh dưỡng; AI gợi ý thực đơn có duyệt | BGH: Duyệt thực đơn | `BE:docs/modules/nutrition.md` | `BE:docs/business/flows/meal-management.md` | NUT, AI |
| Hồ sơ sức khỏe định kỳ, trend, AI diễn giải có duyệt; đợt khám; phiếu theo dõi | **Từ 2026-10-17: kết quả trong đợt nhập bằng phiếu Phụ lục II, mức theo dõi theo kết luận bác sĩ, bỏ phân loại BMI, nhập lẻ chỉ cân đo — xem mục "Phiếu khám sức khỏe Phụ lục II" bên dưới; phần chỉ số/phân loại/mức theo 3 tiêu chí dưới đây chỉ còn áp cho dữ liệu mẫu cũ.** Principal: Đợt khám sức khỏe (tạo theo từng điểm trường, sửa, hủy khi chưa có kết quả, đóng, mở lại) · VP: xem đợt khám, tiến độ, danh sách theo dõi của campus · Teacher phụ trách lớp của trẻ: nhập/sửa/công bố kết quả (trong đợt hoặc nhập lẻ ngoài đợt, cùng form), cập nhật phiếu theo dõi · BGH: Sổ sức khỏe, Xu hướng, Phiếu theo dõi (chỉ xem) · Chỉ số: chiều cao, cân nặng, vòng đầu (không đo khi trẻ trên 60 tháng), vận động thô và tinh ("Không ghi nhận bất thường" / "Có bất thường"), ghi chú khám; bỏ vòng cánh tay · Hệ thống phân loại BMI (thấp hơn chuẩn / bình thường / cao hơn chuẩn, WHO) và mức theo dõi theo 3 tiêu chí vòng đầu, vận động thô, vận động tinh (0 / 1 / ≥2 ⇒ Không ghi nhận bất thường / Cần theo dõi / Cần theo dõi sát – đề nghị khám chuyên khoa); "Cần theo dõi sát" mở phiếu theo dõi dài hạn (mỗi trẻ 1 phiếu chưa đóng; kết quả mới ở mức này đưa phiếu về "Chờ trao đổi phụ huynh"; hạn trao đổi 7 ngày, quá hạn thì nhắc giáo viên và BGH; ghi nhiều lần trao đổi và kết quả khám bên ngoài, có ngày hẹn khám lại; kết quả "Cần theo dõi sát" chỉ công bố sau khi đã ghi trao đổi; lời bác sĩ chuyên khoa hiện ở Sổ sức khỏe và đợt khám sau; cho trẻ nghỉ học thì phiếu tự đóng; đóng phiếu không có nghĩa là trẻ đã khỏe — user chốt 2026-10-16, plan `docs/plans/completed/2026-10-16-health-follow-up-long-lived.md`); nhãn trung tính, không chẩn đoán · Phụ huynh xem tất cả của bản đã công bố · Liên kết BMI sang thực đơn: plan sau (user chốt 2026-10-14 và 2026-10-15, PROPOSED, chờ BE ghi HLT-01/P-13/P-13b; plan `docs/plans/completed/2026-10-15-health-check-campaign-assessment.md`) | `BE:docs/modules/health.md` | `BE:docs/business/flows/health-check.md` | HLT, AI |
| Quan sát hằng ngày; summary; hồ sơ phát triển | Teacher: Quan sát, Review summary · BGH: Summary & hồ sơ phát triển | `BE:docs/modules/learning-observation.md` | `BE:docs/business/flows/child-observation.md` | OBS, AI |
| Báo & theo dõi sự cố CSVC | Teacher: Báo sự cố · BGH: Theo dõi sự cố | `BE:docs/modules/facility-issue.md` | `BE:docs/business/flows/facility-issue.md` | FAC |
| Báo cáo lớp/campus/trường | BGH: Dashboard báo cáo | `BE:docs/modules/reporting.md` | — | AUTH-08 |
| Tài khoản, phân quyền, phân công | Admin: Tài khoản, Role, Phân công | `BE:docs/modules/identity-access.md`, `BE:docs/modules/school-structure.md` | — | AUTH |
| Hồ sơ trẻ, ghi danh, dị ứng | VP: Danh sách trẻ, Tiếp nhận (lớp không bắt buộc ⇒ "Chờ xếp lớp"; phụ huynh "Đã có tài khoản" chọn từ tài khoản của điểm trường, liên kết ngay khi lưu — API `parent-account-options` PROPOSED), Import, Xếp lớp, Khai báo sức khỏe (dị ứng chốt ngay, không chờ Hiệu trưởng), Tài khoản phụ huynh · Danh sách: bấm tên = panel xem nhanh · Xem = trang hồ sơ · Sửa · Cho nghỉ học (VP campus + Principal, không xóa dữ liệu; API `withdraw` PROPOSED, plan `docs/plans/completed/2026-10-14-children-list-actions.md`) · Principal: xem — user chốt 2026-10-14, chờ BE đóng P-17; plan `docs/plans/completed/2026-10-14-children-enrollment-allergy-decisions.md` | `BE:docs/modules/child.md` | — | AUTH-04, HLT-06, P-17 |
| Đón trẻ (bàn giao lúc về) | Teacher: Danh sách đón, Xác minh người đón, Kết quả — phụ huynh không đồng ý ⇒ ghi nhận không trả trẻ ngay, không lấy thông tin người đón; không liên lạc được ⇒ thông tin người đón theo lời khai (không bắt buộc), chưa trả trẻ, danh sách hiện "Chờ phụ huynh gọi lại" (user chốt 2026-10-15, chờ BE ghi) | — (BE chưa có card pickup) | — | — |
| Ngữ cảnh hoạt động/học tập | **Không làm** — OPEN (ADR-0006) | `BE:docs/modules/learning-observation.md` | — | OBS-07 |

Parent visibility (PAR-*) và gửi báo nghỉ thuộc APP. Kitchen trên Web: chỉ khi được yêu cầu (`BE:docs/business/USER_ROLES.md`).

## Cách dùng khi làm một feature

1. Tìm hàng trong bảng (hoặc grep `.ai/CONTEXT_MAP.yaml` → `keywords`).
2. Đọc module card BE (Rules, PENDING, Known pitfalls) → flow: chỉ bước `[S]` thành hành động UI.
3. Ghi rule ID liên quan vào doc feature/PR; **không chép nội dung rule**.
4. Màn hình phức tạp (nhiều trạng thái, nhiều role, có AI) ⇒ tạo `docs/features/<feature>.md` theo template dưới, thêm vào `docs/INDEX.md` và `.ai/CONTEXT_MAP.yaml` (`available.docs` + `keywords`).

## Template `docs/features/<feature>.md`

```markdown
# Feature — <tên>
Status: thiết kế | đang code | xong · BE card: `../CareNest_BE/docs/modules/<m>.md` · Rule: <ID,...>
## Actor & permission     (dẫn ROUTE_MAP; actor PENDING ghi rõ)
## Màn hình & route       (route thực tế, entry point, điều hướng)
## API dùng               (method + path + DTO BE; endpoint chưa có ⇒ "cần thống nhất")
## Trạng thái UI          (loading / empty / error / 403 / 404 / DRAFT-APPROVED)
## Server state / UI state (key cache, invalidate sau mutation nào)
## PENDING ảnh hưởng UI   (ID P-xx + cách UI xử lý tạm: theo permission / cấu hình)
## Known pitfalls         (1 dòng/bẫy, link incident FE nếu có)
## Test                   (component/e2e chính)
```

Agent: gặp bẫy UI đặc thù feature ⇒ thêm 1 dòng **Known pitfalls** vào doc feature (và link incident).

## Phiếu khám sức khỏe Phụ lục II (TT 33/2026) — FE xong, chờ BE

- Nguồn: user, 2026-10-17, CONFIRMED. Plan: [2026-10-17-health-exam-form-doctor-conclusion](../plans/completed/2026-10-17-health-exam-form-doctor-conclusion.md). Thay một số quyết định của [plan đợt khám](../plans/completed/2026-10-15-health-check-campaign-assessment.md) và [plan phiếu dài hạn](../plans/completed/2026-10-16-health-follow-up-long-lived.md) (bảng "Đổi quyết định đã chốt" trong plan).
- Khi khám 1 trẻ có mặt: giáo viên (nhập), bác sĩ và nhân viên y tế (khám, không có tài khoản), trẻ, phụ huynh. Bỏ qua BE khi thiết kế; BE sửa sau khi FE hoàn thiện.
- Web: danh sách lớp của đợt có nút "Khám" ⇒ `/children/health-checks/:campaignId/exam/:childId`, phiếu 5 bước theo phần I–VI và Kết luận; tự lưu nháp khi chuyển bước; trước khi kết luận hiện "Điểm cần bác sĩ xem lại" (sinh tồn theo nhóm tuổi — mạch, nhịp thở AHA PALS 2020, nhiệt độ nách sốt từ 37,5 °C, hạ thân nhiệt dưới 36,0 °C, chờ bác sĩ xác nhận bảng số; gợi ý kết hợp vòng đầu + 2 câu phần IV; các mục ghi bất thường). Gợi ý không phải kết luận.
- Gợi ý gộp sinh tồn: 1/3 chỉ số ngoài khoảng ⇒ "cần theo dõi", từ 2/3 ⇒ "nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận". Bác sĩ không chuyển khám mà còn điểm cần xem lại ⇒ hộp hỏi lại, không chặn (user chốt 2026-10-17).
- Kết luận bác sĩ quyết định mức theo dõi: bình thường ⇒ không tạo việc; có vấn đề, tư vấn ⇒ "Cần theo dõi"; chuyển khám chuyên khoa hoặc nguy cơ lao ⇒ "Cần theo dõi sát" + phiếu theo dõi. Có người đi cùng ⇒ hệ thống ghi trao đổi tại buổi khám, không hạn 7 ngày, công bố được ngay. Nguy cơ lao ⇒ thông báo Hiệu trưởng, Phó hiệu trưởng điểm trường, giáo viên lớp.
- Công bố: phiếu có người đi cùng tự công bố cho phụ huynh khi lưu kết luận (kể cả lưu lại sau sửa); không có người đi cùng thì giáo viên công bố sau khi ghi trao đổi (user chốt 2026-10-17).
- Sau kết luận phiếu khóa; sửa cần lý do, lịch sử che số CCCD. Không in phiếu, không lấy chữ ký trên hệ thống. Có lưu CCCD/mã định danh của trẻ và người đi cùng (không bắt buộc, chỉ hiện trong phiếu).
- Kết quả khám chuyên khoa: chữ tự do + chuyên khoa / nơi khám (bắt buộc) + ảnh giấy kết quả (≤3); 30 ngày sau lần trao đổi chưa có kết quả ⇒ nhắc giáo viên.
- Danh sách trẻ lọc được theo mức theo dõi của lần khám gần nhất có xếp mức (Cần theo dõi, Cần theo dõi sát, Không ghi nhận bất thường, Chưa có kết quả khám); phiếu nháp và cân đo ngoài đợt không tính.
- Bỏ nhãn phân loại BMI tự tính (chỉ số BMI); bác sĩ chọn tình trạng dinh dưỡng. Nhập lẻ ngoài đợt chỉ cân đo, không kết luận, không mở phiếu. Kết quả trước 2026-10-17 hiện nhãn "Mẫu cũ", giữ cách tính cũ.
- Đề xuất gửi BE (chưa sửa BE): mục "Đề xuất cho BE" của plan — HLT-01, HLT-08, HLT-09, contract phiếu khám.
