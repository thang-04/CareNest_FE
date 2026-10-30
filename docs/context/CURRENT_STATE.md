# Current State — CareNest_FE

Cập nhật: 2026-10-20 (bảng screen group theo source; mọi màn chạy trên mock, chưa nối BE thật); 2026-10-28 và 2026-10-29 đồng bộ rule BE. Cập nhật file này khi một screen group bắt đầu có code hoặc hoàn thành.

## Đồng bộ nghiệp vụ BE 2026-10-29

Nguồn: `BE:docs/business/BUSINESS_RULES.md` (khảo sát team 210/210, user chốt 2026-10-29). Đã đóng: P-01 ⇒ EDU-29, OBS-07 · P-02 ⇒ AI-09 · P-12 ⇒ OBS-06 · P-13 ⇒ HLT-03 · P-13b ⇒ PAR-03 · P-16b ⇒ OBS-09. `REMOVED`: OBS-08 (thay bằng nhóm EDU), FAC-01..04 (CSVC). ADR-0006 ACCEPTED; ADR-0019 SUPERSEDED bởi ADR-0020 (user chốt 29/10: kế hoạch giáo dục theo code G94-226). Rule mới: HLT-08..14, OBS-12..14, EDU-29..38 (trên `dev` là EDU-01..10; EDU-31/32/35/38 SUPERSEDED theo code — `BE:docs/business/flows/education-plan.md`), PCK-01..04, PAR-05, PAR-06, RPT-01..03, AI-07..10; AUTH-03 mở rộng (GV cũ xem lại lớp/năm từng dạy, chỉ đọc — BE chưa code). PENDING mới: P-29..P-35.

UI mock **lệch BE (29/10), cần sửa khi tích hợp**:
- Kế hoạch giáo dục (`/education/*`): đủ luồng theo BE EDU-01..28, EDU-39..41 (mục tiêu năm học + phiên bản, cấu hình, tài liệu lớp, hồ sơ chủ đề, duyệt theo chuỗi người ký), gọi BE thật khi `VITE_USE_MOCK=false`. Trang "Kế hoạch toàn trường" của HT còn đọc dữ liệu chủ đề/giáo án kiểu cũ nên trống khi nối BE.
- Đánh giá hằng ngày (`/assessment/daily`): mock 3 nhóm, kiến thức–kỹ năng Đạt/Chưa đạt, PHT/HT mở lại ngày đã khóa. BE: 7 mặt, mức Đạt / Cần cố gắng / Chưa đạt (OBS-02), hết ngày thì khóa, không có bước mở lại (OBS-12). Chi tiết: [daily-assessment](../features/daily-assessment.md) mục "Lệch BE".
- Sức khỏe (`/children/health-*`): mock có phiếu khám Phụ lục II, mức theo dõi, phiếu theo dõi; bác sĩ chọn tình trạng dinh dưỡng thay nhãn tự tính. BE: tự phân loại theo WHO, GV chỉnh kèm lý do (HLT-03, HLT-10); suy dinh dưỡng/thừa cân chỉ đánh dấu, không có quy trình theo dõi (HLT-12, OBS-03); nội dung ghi từ đợt khám bác sĩ chưa có rule (HLT-08). Cần team chốt trước khi tích hợp. Từ 2026-10-31 mock có kỳ cân đo (HT/PHT mở, cảnh báo dưới 2 tháng 15 ngày), đợt khám 1 lần/năm, bỏ cân đo lẻ ngoài đợt — chờ BE sửa HLT-01 ("3 lần/năm, cấu hình được"), HLT-08 ("2 lần/năm"); plan `docs/plans/completed/2026-10-31-health-measurement-rounds.md`.
- Đón trẻ (`/pickup/*`): mock xác minh bằng ảnh người giám hộ hoặc phụ huynh đồng ý qua điện thoại, gần PCK-02. Nguồn ảnh đối chiếu còn P-33; người lạ đón phải ghi lý do (PCK-02); không đăng ký trước người đón hộ (PCK-03).
- CSVC (`/facility/*`): giữ ẩn (`FACILITY_ENABLED=false`), không phát triển thêm.

Card education-plan, flow pickup và flow education-plan có ở BE nhánh G94-226 (đã merge `dev`); docs FE ghi link `BE:`.

## Đồng bộ nghiệp vụ BE 2026-10-28

Nguồn: `BE:docs/business/BUSINESS_RULES.md` (khảo sát team 27/10, user chốt 2026-10-28). Đã đóng: P-03 ⇒ ATT-06 · P-04 ⇒ ATT-03, NUT-04 · P-05 ⇒ NUT-02 · P-06 ⇒ AUTH-05 · P-07 ⇒ NUT-13 · P-08 ⇒ NUT-11 · P-09 ⇒ NUT-12 · P-10 ⇒ NUT-18 · P-17 ⇒ HLT-06, NUT-23. NUT-14, NUT-15 `REMOVED`. ADR-0009 ACCEPTED (bản 28/10). PENDING mới: P-19..P-28.

UI mock còn theo quyết định cũ; **lệch BE (28/10), cần sửa UI khi tích hợp**: công tắc Tham gia ăn (ATT-02), bàn giao suất + trạng thái nấu (NUT-14/15 REMOVED), route bếp trên Web (AUTH-21), giờ chốt mặc định cứng khi chưa cấu hình (ATT-06), kho/hàng tươi/NCC/thực đơn thay thế dị ứng. Chi tiết: [nutrition-inventory](../features/nutrition-inventory.md) mục "Lệch BE", [daily-reception](../features/daily-reception.md).

## Cập nhật phạm vi 2026-10-19

Phase 2 đã nhận UI phân quyền G94-209: ba tab, wizard và lịch sử; user chọn lưu demo riêng, không áp vào quyền thật hoặc nguồn assignment. Entry `/school/roles` giữ sidebar cũ. Xem [feature và giới hạn](../features/permission-center-demo.md). Phase 3 phụ huynh/hồ sơ trẻ vẫn chưa bắt đầu.

Source thực tế hiện có React/JS, router, mock và build; mô tả baseline 2026-10-04 bên dưới là lịch sử, không phải trạng thái source hiện tại. Không thay stack/auth trong đợt ghép này. Phase 1 dinh dưỡng/bếp và Phase 2 UI phân quyền demo độc lập đã ghép vào working tree, giữ attendance/sức khỏe/suất ăn, login/sidebar và phân công. Phase 3 phụ huynh/hồ sơ trẻ chưa bắt đầu. Chưa commit/push; xem [plan, cổng kiểm tra và giới hạn](../plans/active/2026-10-18-selective-nutrition-permission-merge.md). Các endpoint dinh dưỡng mới vẫn PROPOSED; màn quyền non-mock trả 501, không chứng minh BE đã tích hợp.

## Tổng quan baseline 2026-10-04 (lịch sử)

- **Chưa có source code** (`src/`, `package.json` chưa tồn tại). Chỉ có lớp AI-context + docs.
- Framework, router, state/cache, UI kit, auth flow: chưa chốt (PROPOSED: React + TypeScript, Next.js) ⇒ hỏi trước khi chọn; docs SKELETON không dùng làm nguồn.
- Màn hình có actor PENDING (xác nhận suất — nay đã chốt NUT-02; nhập đo sức khỏe — nay đã chốt HLT-09) ⇒ ẩn/hiện theo permission BE, không hard-code role.
- BE: đã scaffold Spring Boot với response chuẩn `{code, desc, data}`; trạng thái module BE xem `BE:docs/context/CURRENT_STATE.md`.

## Screen group

Status: `—` chưa bắt đầu · `đang làm` · `xong`. Định nghĩa group: `docs/architecture/ROUTE_MAP.md`.

| Screen group                               | Actor                                         | Module BE                         | Status        |
| ------------------------------------------ | --------------------------------------------- | --------------------------------- | ------------- |
| Đăng nhập / phiên                          | Tất cả                                        | identity-access                   | UI mock (`pages/auth`) |
| Quản trị tài khoản, role, phân công        | System Admin                                  | identity-access, school-structure | UI mock (`school-config`, `account`, `permissions`) |
| Cấu trúc trường: campus, lớp, năm học      | System Admin                                  | school-structure                  | UI mock (`school-config`) |
| Cấu hình hệ thống / master data            | System Admin                                  | nhiều                             | một phần (`school-config`, `menu-planning`) |
| Hồ sơ trẻ / ghi danh                       | Vice Principal mảng chuyên môn (CHD-01); FE mock: Principal toàn trường, Vice Principal theo "Hồ sơ trẻ" — tiếp nhận, nhập Excel, xếp lớp (user chốt 2026-10-27) | child                             | UI mock (`children`) |
| Dashboard báo cáo lớp/campus/trường        | Principal, Vice Principal                     | reporting                         | UI mock (`dashboard`) |
| Xác nhận số suất ăn                        | Vice Principal tại cơ sở; Principal thay khi vắng (NUT-02) | nutrition                         | UI mock (`attendance`, `kitchen`) |
| Xuất bản thực đơn tuần (BA: PHT công bố)   | Vice Principal mảng dinh dưỡng (NUT-08: công bố = duyệt; còn lệch, xem features/nutrition-inventory.md) | nutrition                         | UI mock (`menu-planning`) |
| Xem nhận xét định kỳ / hồ sơ phát triển    | Principal, Vice Principal                     | learning-observation              | UI mock (`assessment`) |
| Kế hoạch giáo dục: duyệt, ban hành         | Phó HT ban hành mục tiêu năm (EDU-05); chủ đề nhánh, hồ sơ chủ đề theo chuỗi người ký, Tổ trưởng chỉ lớp nhóm tuổi mình (EDU-18) | education-plan | BE + UI (`education`) |
| Tổng quan sức khỏe                         | Principal, Vice Principal                     | health                            | UI mock (`children`, `attendance`) |
| ~~Theo dõi sự cố CSVC~~                    | —                                             | — (FAC REMOVED 29/10)             | UI mock, ẩn (`FACILITY_ENABLED=false`) |
| Báo nghỉ của campus (chỉ xem, không duyệt) | Principal, Vice Principal                     | attendance                        | hiển thị trong điểm danh |
| Điểm danh + báo ăn                         | Teacher                                       | attendance                        | UI mock (`attendance`) |
| Đánh giá hằng ngày                         | Teacher                                       | learning-observation              | UI mock (`assessment`), lệch BE 29/10 |
| Nhận xét định kỳ (GV xác nhận — OBS-05)    | Teacher                                       | learning-observation              | UI mock (`assessment`) |
| Kế hoạch giáo dục lớp (chủ đề nhánh, tuần, ngày) | Teacher của lớp (EDU-12..17)            | education-plan                    | BE + UI (`education`) |
| Đón trẻ                                    | Teacher (PCK-02, PCK-04)                      | attendance                        | UI mock (`pickup`) |
| Nhập đo sức khỏe                           | Teacher (HLT-09)                              | health                            | UI mock (`children`), lệch BE 29/10 |
| ~~Báo sự cố CSVC~~                         | —                                             | — (FAC REMOVED 29/10)             | UI mock, ẩn (`FACILITY_ENABLED=false`) |
| Báo nghỉ của lớp (chỉ xem, không duyệt)    | Teacher                                       | attendance                        | hiển thị trong điểm danh |

## Quyết định đang chờ ảnh hưởng FE

| Chủ đề                                 | Status               | Nguồn                                                                 |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Framework/router/state/UI kit          | Đã chốt theo source (2026-10-20) | `docs/architecture/FRONTEND_ARCHITECTURE.md`                          |
| Auth flow, lưu token                   | chưa chốt            | `docs/integration/AUTH_FLOW.md`, `BE:docs/contracts/AUTH_CONTRACT.md` |
| Actor xác nhận suất ăn                 | Đã chốt NUT-02 (đóng P-05, 2026-10-28) | `BE:docs/business/BUSINESS_RULES.md`                                  |
| Người nhập đo sức khỏe                 | Đã chốt HLT-09: GV (2026-10-29) | `BE:docs/modules/health.md`                                           |
| Ngữ cảnh hoạt động                     | Đã chốt OBS-07: MT của giáo án tuần/ngày đã duyệt (EDU-19, ADR-0006) | `BE:docs/modules/education-plan.md`                                   |
| Màn hình hồ sơ trẻ / ghi danh trên Web | Actor chốt CHD-01 (PHT chuyên môn, form/Excel); FE mock xong (`/children/new`, `/children/import`, `/children/placement`), chờ contract BE | `docs/features/README.md`                                             |

Đã chốt gần đây: báo nghỉ = thông báo của phụ huynh qua app, **không có bước duyệt**; GV/BGH trong scope chỉ xem, GV không tạo thay phụ huynh (ATT-05, đóng 2026-10-02, bổ sung 27/10 — `BE:docs/business/flows/leave-request.md`).
