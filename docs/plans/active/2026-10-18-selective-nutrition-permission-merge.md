---
title: Ghép chọn lọc dinh dưỡng, bếp, phân quyền và hồ sơ trẻ
status: in-progress
owner: CareNest FE
jira: 'G94-191 / FE-FEAT-48; G94-209 / FE-FEAT-53'
branch: dev
modules: [nutrition, identity-access, child, school-structure]
rules: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-07, AUTH-08, ATT-01, ATT-02, ATT-07, NUT-01, NUT-03, NUT-05, NUT-06, NUT-08, NUT-09]
risk: high
created: 2026-10-18
updated: 2026-10-19
---

# Ghép chọn lọc dinh dưỡng, bếp, phân quyền và hồ sơ trẻ

## Context

- Bản được bảo vệ: `dev` tại `43e680b8045c2582cfa7940553c775925ed83018`; chưa áp dụng merge.
- Nguồn dinh dưỡng N: `origin/feature/G94-191-FE-FEAT-48-nutrition-management` tại `e69d37603c38f61795c41b3b0d12d30af4b20284`.
- Nguồn phân quyền P: `origin/feature/G94-209-FE-FEAT-53-permission-management` tại `b1126d659ab93512a2b157cabd0ab4b8cb8181f4`.
- P chứa phần dinh dưỡng chung đến `04020d9` và bản sửa bàn giao tương đương ở `246bf8f`; không phải hậu duệ chính xác của tip N. Không ghép hai lần phần chung. Preview riêng với dev: N có 13 file conflict, P có 46; tổng tập file cùng sửa là 69.
- Dev `src/mocks/attendanceSeed.js:35,43` dùng `sessionsOf`, trong khi caller incoming N ở `src/services/attendance/mock/attendanceMockRepository.js:138` không truyền callback này. Không lấy nguyên repo điểm danh mới.
- Dev `src/mocks/authMockRepository.js:42-50` dùng catalog quyền cũ và `vpAssignments`; `src/services/school-config/mock/schoolConfigMockRepository.js:1420-1431` ghi phân công vào `classes.teacherIds`. Không thay bằng nguồn phân công mới `staffAssignments`.
- Dev `src/mocks/dailyHealthMockRepository.js:266` tìm người nhận theo `child.guardians[].accountStatus` và email. Incoming P đổi sang `users`/`guardianLinks`; cần tương thích dữ liệu để bảo toàn luồng sức khỏe.
- Dev `src/layouts/menuConfig.js:57-58` giữ các entry Phân công giáo viên và Vai trò & quyền. UI mới phải đi qua entry hiện có, không tự tái cấu trúc sidebar.

## Quyết định đã chốt

Nguồn: người dùng trực tiếp trong chat ngày 2026-10-18. Đây là lựa chọn tích hợp Web demo, không nâng trạng thái rule BE đang PENDING/OPEN.

1. Giữ UI và logic điểm danh, sức khỏe và suất ăn của dev; bao gồm lớp/ngày/năm học, đơn nghỉ, cờ ăn, số suất từng bữa cấu hình, tổng hợp và xuất file đang có.
2. Giữ đăng nhập, phiên/token, HTTP client chung và cấu hình auth hiện tại; không nhận gateway auth của P.
3. Chỉ giữ menu điều hướng bên trái (sidebar): nhãn, thứ tự, phân nhóm và đường vào hiện có; không thêm nhóm Con người hoặc chuyển sidebar từ incoming. **Không giữ UI màn phân quyền cũ**: bấm entry Vai trò & quyền hiện tại sẽ mở UI phân quyền mới từ G94-209. Các tab, bảng, bộ lọc và hộp thoại bên trong màn phân quyền lấy theo G94-209.
4. Giữ quy tắc Git hiện tại, `AGENTS.md`, git hooks và các hướng dẫn commit/PR; không lấy bộ Conventional Commits từ P.
5. Lấy UI/luồng dinh dưỡng và bếp từ N/P, bao gồm phần demo kho đã có trên nhánh nguồn; không tự bổ sung nghiệp vụ ngoài nhánh hoặc tạo entity/API BE. Các phần kho/NCC vẫn là demo, không coi NUT-11/12 hay ADR-0009 đã được chốt.
6. Lấy UI màn phân quyền mới từ P (G94-209), gồm quyền mặc định, ngoại lệ người dùng, lịch sử và các tab/bảng/bộ lọc/hộp thoại tương ứng; không dùng lại layout màn phân quyền cũ của dev. Chỉ điều chỉnh phần tích hợp dữ liệu/quyền cần thiết để tương thích đăng nhập và scope hiện tại, không đổi tổ trưởng thành giáo viên hay làm rộng quyền campus/lớp ngầm.
7. Giữ phân công giáo viên hiện tại của dev. Không bật màn roster/assignment mới làm nguồn phân công thay thế; giữ phân công phó hiệu trưởng, tổ trưởng và năm học đang có.
8. Lấy UI/luồng phụ huynh và hồ sơ trẻ từ P; giữ dữ liệu cũ và liên kết cần cho sức khỏe, đón trẻ, đánh giá, giáo dục. Các màn sức khỏe riêng không thuộc phạm vi thay thế.
9. Người dùng đồng ý thêm đúng `read-excel-file@9.3.10`; không nâng/thêm thư viện khác hoặc đổi công cụ build.
10. Hiểu câu trả lời "Ghép vào đi bạn" là chuẩn bị tích hợp trên checkout dev hiện tại. Chưa tạo branch/commit/push/PR. Trước khi cần commit, hỏi nhánh làm việc theo AGENTS; không tự commit trên dev.
11. Giữ nguyên mọi stash. WIP mở lại điểm danh trong `stash@{0}` chưa được áp dụng hoặc đưa vào đợt này.
12. Không sửa CareNest_BE hoặc CareNest_APP. Không tuyên bố App đã nhận thông báo thật.

## Làm rõ nghiệp vụ

- Actor: các role Web hiện có; không thêm actor được đọc dữ liệu trẻ chỉ vì nhận UI mới. Outcome: ghép đúng các vùng được chọn, không hồi quy vùng được bảo vệ.
- Rule nền được dẫn chiếu, không chép lại: AUTH-01..04, AUTH-07..08; ATT-01/02/07; NUT-01/03/05/06/08/09 từ `../../../../CareNest_BE/docs/business/BUSINESS_RULES.md` (CONFIRMED/ACCEPTED).
- Flow: attendance và meal-management trong `../../../../CareNest_BE/docs/business/flows/`; identity-access, child và school-structure theo module card. Phần PENDING/OPEN giữ trạng thái và hành vi demo, không coi endpoint incoming là contract đã xác nhận.
- Ảnh hưởng: `/menu/*`, `/kitchen/*`, màn quyền qua `/school/roles`, tài khoản phụ huynh và `/children/*`; giữ `/attendance*`, sức khỏe, đón trẻ, đánh giá, giáo dục, phân công và cấu hình năm học hiện có.
- Dữ liệu: migration bảo toàn ID, liên kết, account status, hồ sơ hành chính/tiền sử và dữ liệu demo đã lưu; không reset storage hoặc tự đánh dấu phiếu kho cũ thành đã xuất.
- Tài liệu BE hiện còn skeleton ở auth và OPEN ở kho/NCC; chỉ ghép client demo đã được user chọn, không đổi contract, cơ chế auth hoặc kết luận quyền thật.

### Câu hỏi mở

- [x] Người dùng duyệt triển khai bằng tin nhắn "merge đi bạn" ngày 2026-10-18; bắt đầu Phase 1, giữ cổng review giữa các phase.

| Câu hỏi                                            | Trả lời                                  | Ai         | Ngày       | Doc                        |
| -------------------------------------------------- | ---------------------------------------- | ---------- | ---------- | -------------------------- |
| Giữ điểm danh/sức khỏe/suất ăn, auth, menu và Git? | Giữ dev                                  | Người dùng | 2026-10-18 | `../../features/README.md` |
| Phân quyền và phân công giáo viên?                 | Quyền lấy P; phân công giáo viên giữ dev | Người dùng | 2026-10-18 | `../../features/README.md` |
| Dinh dưỡng/bếp, phụ huynh/hồ sơ trẻ?               | Lấy N/P, tương thích với vùng giữ lại    | Người dùng | 2026-10-18 | Plan này                   |
| Dependency Excel?                                  | Đồng ý read-excel-file 9.3.10            | Người dùng | 2026-10-18 | Plan này                   |

## Acceptance criteria

- **AC-1** (ATT-01, ATT-02, ATT-07, NUT-01, NUT-03): điểm danh/health/summary/meal-count hiện tại giữ UI và kết quả; bếp mới chỉ đọc nguồn suất hiện tại, hỗ trợ bữa MORNING khi lớp cấu hình; không hồi sinh childMealPlans riêng làm nguồn tính suất.
- **AC-2** (AUTH-02, AUTH-03, AUTH-07): phân công giáo viên và phạm vi phó hiệu trưởng/tổ trưởng giữ nguồn dev, không tạo hai màn có quyền ghi hai nguồn độc lập.
- **AC-3** (AUTH-01, AUTH-02, AUTH-07): từ entry Vai trò & quyền hiện tại mở được UI G94-209, không phải layout quyền cũ; các tab/bảng/bộ lọc/hộp thoại mới thao tác và lưu được bằng mock. Adapter không truyền array vào consumer cần object hoặc ngược lại. Không suy diễn mapping quyền chưa có trong source; thiếu mapping ảnh hưởng quyền thì dừng hỏi.
- **AC-4** (AUTH-04, AUTH-07): UI phụ huynh/hồ sơ trẻ lấy P, dữ liệu cũ còn nguyên; nhiều guardian không trùng user ID; liên hệ và thông báo sức khỏe demo vẫn tìm đúng tài khoản active, không gửi trùng/nhầm người.
- **AC-5** (NUT-03, NUT-05, NUT-06, NUT-08, NUT-09): UI dinh dưỡng/bếp mới dùng được, dữ liệu kho lịch sử không bị đổi nghĩa hoặc trừ tồn lại; AI/dinh dưỡng vẫn theo trạng thái nguồn, không tự đổi rule BE.
- **AC-6** (AUTH-07, AUTH-08): đăng nhập/token/HTTP client chung, menu và Git giữ nguyên; route cần thiết bổ sung/ánh xạ tại router hoặc trang hiện có, không sửa sidebar để vượt quyền.
- **AC-7** (AUTH-02, AUTH-03, AUTH-08): health-check, health-follow-up, pickup, assessment, education, campus/năm học và phòng ban không bị loại route/menu hoặc mất dữ liệu; mọi stash giữ nguyên.
- **AC-8**: dependency chỉ thêm phiên bản đã duyệt; verify đầy đủ và kiểm tra AI layer có output thật sau lần sửa cuối; browser và API thật chưa thử thì ghi rõ, không báo đạt thay.
- **AC-9**: ba màn phân quyền dùng header, tab, bảng, avatar, modal/form/state chung; không còn CSS `staff-hub` hoặc utility không tồn tại; desktop và 375px không tràn trang.
- **AC-10**: UI dinh dưỡng/bếp dùng component/class chung cho các khối thông thường; bố cục lịch, nhập liệu, sticky, print và style động vẫn giữ hành vi.

## Key decisions

| Quyết định            | Chọn                                                                      | Phương án khác                 | Vì sao                                                           |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| Cách ghép             | Ghép thủ công theo vùng, giữ lịch sử nguồn và kiểm tra từng diff          | Lấy toàn bộ ours/theirs        | Hai cách lấy toàn bộ đều trái lựa chọn user                      |
| Quyền mới với auth cũ | Chuẩn hóa tại service/helper consumer quyền, giữ contract auth hiện có    | Thay gateway/auth provider     | User giữ đăng nhập; adapter phải có test không làm rộng scope    |
| Phân công             | dev là nguồn ghi; màn mới chỉ dùng dữ liệu tương thích nếu cần            | Bật staffAssignments song song | User giữ phân công giáo viên hiện tại                            |
| Menu cũ, màn mới      | Giữ sidebar, gắn màn mới vào route/tab/entry hiện có                      | Chuyển sang People Hub menu    | User giữ menu                                                    |
| Dữ liệu phụ huynh     | Migration idempotent có cầu nối cho health/pickup                         | Reset hoặc seed lại toàn bộ    | Không được mất thông báo và liên kết cũ                          |
| Phạm vi nhiều file    | Ba phase có cổng review; đề xuất tách commit theo task sau khi chọn nhánh | Một lần merge mù toàn bộ       | Dễ kiểm tra và phát hiện hồi quy từng vùng; chưa có quyền commit |
| UI sau merge          | Bảng nhân sự và component/class chung của repo làm chuẩn                 | Giữ CSS riêng từ hai nhánh       | User duyệt ngày 2026-10-19; giảm style trùng và lệch giữa module      |

## Phases

### Phase 1 — Dinh dưỡng và bếp tương thích nguồn suất hiện tại

- Files: C/M `src/components/menu-planning/`, `src/components/kitchen/`, `src/pages/menu-planning/`, `src/pages/kitchen/`, `src/services/menu-planning/`, `src/services/kitchen/`, mocks/models/utils/style modules tương ứng; M `src/routes/AppRoutes.jsx`, `src/components/index.js`, `package.json`, `package-lock.json`; C test tích hợp trong `tests/integration/selective-merge/`.
- Giữ attendance, daily health, meal-count page/service/seed, auth, menu, phân công và Git. Ghép shared icons/styles theo selector, không thay nguyên components.css. Route cũ của bếp/thực đơn còn entry thì phải dẫn được đến màn tương ứng.
- Nối bếp vào suất được xác nhận hiện tại; xử lý session cấu hình và trạng thái phiếu kho cũ bằng migration bảo toàn. Không tự reset hoặc tự coi phiếu pending/approved là issued.
- Tests: AC-1/5/6/8; test nutrition/kitchen incoming, test source suất MORNING và dữ liệu legacy. API mới giữ mock/PENDING BE, không bật transport thật.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → exit 0. Browser smoke menu/bếp có/không dữ liệu ghi bước và kết quả riêng.
- **Dừng chờ user review trước Phase 2.**

### Phase 2 — Màn quyền mới, giữ auth và phân công hiện tại

- Files: C màn/components/hooks/service/model/utils quyền mới từ P, test tương thích; M router, service/helper đọc quyền cần thiết. Giữ catalog cũ nếu consumer phân công còn dùng; không xóa chỉ vì P xóa file.
- Giữ source auth/token/HTTP client và cơ chế phiên. Không đổi user.permissions legacy object thành array toàn app; helper quyền mới nhận dữ liệu đúng shape. Route quyền cũ dùng đầy đủ UI phân quyền G94-209 (tab, bảng, bộ lọc, hộp thoại), chỉ giữ sidebar hiện tại; không lấy layout trang quyền cũ thay cho UI đã chọn.
- Không bật roster mới làm nguồn phân công; không map TEAM_LEADER sang TEACHER ngầm. Nếu mapping quyền mới/cũ chưa xác định được bằng source thì trình bảng mapping cho user trước khi áp dụng.
- Tests: AC-2/3/6/8; defaults, override, history, refresh user/đổi user, campus/class, teacher/team leader, account không quyền; source protected diff so với mốc dev.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → exit 0; ghi rõ phạm vi demo, không coi UI guard là BE authorization.
- **Dừng chờ user review trước Phase 3.**

### Phase 3 — Phụ huynh/hồ sơ trẻ mới và regression toàn luồng

- Files: C/M components/hooks/service/model/utils phụ huynh và hồ sơ trẻ từ P, route/tab tương ứng; M cầu nối/migration dữ liệu mock; C test guardian compatibility và test hồi quy liên module. M docs tính năng/route/verification theo thay đổi thực tế.
- Giữ dữ liệu cũ, hồ sơ hành chính/tiền sử, health campaign/follow-up, pickup và notifications. Nhiều guardian có ID duy nhất; migration chạy lặp không reset liên kết cũ. Giữ snapshot lịch sử, không seed lại collection đã chủ ý xóa.
- Không sửa BE/App hoặc báo push thật. Không áp dụng stash unlock. So sánh diff UI/logic protected trước handoff; chưa commit/push/PR.
- Tests: AC-4/6/7/8; user/guardian mới và cũ, nhiều người giám hộ, tài khoản active/inactive, liên hệ sức khỏe và pickup; toàn bộ test incoming được nhận, lint/format/build, browser các role.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → exit 0. Browser/API thật chưa thử phải ghi rõ; không kết luận toàn bộ pass từ build đơn thuần.
- **Dừng chờ user review và chọn nhánh làm việc trước commit.**

### Phase 4 — Đồng bộ UI phân quyền sau merge

- Files: M ba page quyền, `src/components/permissions/`, `src/styles/modules/permissions.css`; D `src/styles/modules/staff-hub.css`; M test/docs liên quan.
- Dùng `page__head`, tab segmented, `table--grid table--compact`, Avatar/FormField/Modal/state chung; giữ link route và toàn bộ handler/state/mock hiện tại.
- Hợp nhất ma trận, thanh lưu và wizard vào `permissions.css`; loại selector trùng, utility không tồn tại, màu/kích thước viết cứng.
- Tests: regression UI contract, test merge; browser desktop + 375px, tab active, modal và draft 2→3→2.
- Exit: `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs`; **dừng review trước Phase 5.**

### Phase 5 — Đồng bộ UI dinh dưỡng/bếp và dọn CSS

- Files: M page/component dinh dưỡng-bếp, `menu-planning.css`, `kitchen.css`, test/docs liên quan.
- Áp dụng component/class chung cho header, bảng, filter, form, badge, modal và state; giữ lịch tuần, ma trận, sticky, print và giá trị style động.
- Xóa selector chỉ sau khi kiểm tra consumer tĩnh, class động, responsive và print.
- Exit: các test menu/kitchen, browser desktop/tablet/375px, `node scripts/verify.mjs`, `node scripts/check-ai-layer.mjs`.

## Test matrix

| AC   | Rule                    | Test dự kiến                                                                        | Phase | Kết quả hiện tại        |
| ---- | ----------------------- | ----------------------------------------------------------------------------------- | ----- | ----------------------- |
| AC-1 | ATT-01/02/07, NUT-01/03 | Session cấu hình/MORNING, có phép, cờ ăn, summary và luồng sức khỏe; unit + browser | 1     | Chưa chạy bản tích hợp  |
| AC-2 | AUTH-02/03/07           | Phân công/năm học/campus/class; scope regression                                    | 2     | Chưa chạy               |
| AC-3 | AUTH-01/02/07           | Permission shape/default/override/history và account không quyền                    | 2     | Chưa chạy               |
| AC-4 | AUTH-04/07              | Guardian migration/id uniqueness/health notify/pickup                               | 3     | Chưa chạy               |
| AC-5 | NUT-03/05/06/08/09      | Tests nutrition/kitchen incoming và stock legacy                                    | 1     | Chưa chạy               |
| AC-6 | AUTH-07/08              | Protected diff, route entry và menu/browser từng role                               | 1–3   | Chưa chạy               |
| AC-7 | AUTH-02/03/08           | Health/pickup/assessment/education + bảo toàn stash                                 | 3     | Chưa chạy               |
| AC-8 | Cổng kỹ thuật repo      | verify + check-ai-layer; dependency diff                                            | 1–3   | Chưa có source tích hợp |
| AC-9 | UI contract chung        | Regression source + browser desktop/375px, tab/modal/draft                          | 4     | Đã chạy               |
| AC-10 | UI contract chung       | Regression menu/kitchen + browser desktop/tablet/375px và print                 | 5     | Chưa chạy               |

## Rủi ro & rollback

| Rủi ro                                     | Tác động                        | Giảm thiểu                                             | Rollback                                                                      |
| ------------------------------------------ | ------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Quyền object/array không tương thích       | Lỗi runtime hoặc vượt quyền     | Adapter tại consumer; test scope/shape                 | Hoàn tác riêng patch tích hợp quyền sau khi user đồng ý; không reset checkout |
| Parent model đổi                           | Mất người nhận sức khỏe/đón trẻ | Migration idempotent; giữ trạng thái và ID             | Giữ snapshot demo trước migration, không ghi đè dữ liệu có sẵn                |
| Bếp đọc model session cũ                   | Bỏ bữa sáng, số suất lệch       | Nguồn suất dev; test theo cấu hình                     | Giữ service nguồn dev, chưa bật adapter lỗi                                   |
| CSS/global/routes tự ghép sai              | Mất UI/route khác               | Ghép từng selector/entry và kiểm tra diff protected    | Hoàn tác patch đúng file của tác vụ, không đụng thay đổi người dùng           |
| Merge có conflict mới sau khi ref thay đổi | Kế hoạch không còn đúng base    | Khóa SHA nêu trên; kiểm tra trạng thái trước mỗi phase | Dừng và trình phần chồng lấn mới; không auto-resolve                          |

## Validation log

- [x] Khẳng định cốt lõi có file:line và SHA phiên bản.
- [x] Không đổi contract BE hoặc auth; các consumer cần cầu nối đã nêu cụ thể: kitchen sessions, permission consumers, health/pickup guardian lookup.
- [x] Mỗi AC có test và phase; mỗi phase có cổng verify/AI layer.
- [x] Hơn 8 file: đề xuất tách ba phase, review giữa các phase và commit theo task sau khi chọn nhánh.
- [x] Không dùng rule PENDING/OPEN làm nghiệp vụ đã chốt; kho/NCC chỉ nhận demo nguồn theo yêu cầu.
- [x] Người dùng đã duyệt triển khai ngày 2026-10-18; chỉ bắt đầu source sau sự đồng ý này.

## Progress log

### 2026-10-19 — Tiếp tục tinh chỉnh thực đơn dị ứng

- Nguồn: user chọn cả Theo ngày, Theo tuần và Quy trình bếp, sau đó yêu cầu "triển khai đi". Tiếp tục phần UI bếp của Phase 5; không commit/push/PR.
- Thiết kế triển khai: phương án A đã đề xuất — chỉ ghi "Thay món X bằng món Y" (hoặc "Bỏ món X"), lý do dị ứng và nút mắt. Modal tên trẻ/lớp/chất dị ứng, không link hồ sơ; mỗi phương án dị ứng giữ riêng, không trộn món thay thế.
- Tham chiếu: BE `docs/business/BUSINESS_RULES.md` AUTH-05/AUTH-07/NUT-08/NUT-09; cards `nutrition.md`, `child.md`. API nutrition chưa có: đây là read model mock đề xuất, không phải contract BE đã thống nhất; không sửa BE/APP hay cơ chế quyền, tính suất/định lượng.
- AC: ba nơi hiển thị cùng thông tin; không lặp món giữ nguyên; giữ trường hợp bỏ món/nhiều phương án; mock trả trẻ ACTIVE đúng nhóm tuổi/campus được phép, chỉ tên/lớp/dị ứng liên quan; đổi bộ lọc không giữ modal cũ.
- Thực hiện: test repository trước (mapping và scope), bổ sung read model và hook theo campus, component dùng chung + tích hợp hai trang/CSS, ghi feature/verification. Kiểm tra test mới fail/pass, `node scripts/verify.mjs`, `node scripts/check-ai-layer.mjs`, browser nếu môi trường cho phép. Phần này vượt 8 file cả tài liệu nên ghi tiến độ trong plan L hiện tại.
- Kết quả phần triển khai: component `AllergyMenuChanges` dùng chung ba view; read model giữ từng phương án và bỏ món; hook hủy response cũ, xóa dữ liệu khi đổi key/người dùng/campus; không sửa shared useAsync. Không thay tính suất, mua hàng, route hoặc dependency.
- Focused test 4/4; review phát hiện fallback seed/legacy mất tên món, test fail trước/pass sau và review lại sạch lỗi quan trọng. Incident/index: FE-BUG-261019-published-allergy-legacy. Feature doc ghi rõ dữ liệu demo, contract còn đề xuất và giới hạn lịch sử enrollment.
- Browser Chrome mock PHT: ba view đều có thay món + lý do + modal tên/lớp/dị ứng; Escape/Đóng và đổi nhóm tuổi hoạt động. Responsive 375/768px đã kiểm ở Quy trình bếp, 375px ở trang công bố; viewport reset. Chi tiết tại `docs/quality/VERIFICATION.md`. Full verify đạt sau fix legacy (121 test), AI layer 0 lỗi/18 cảnh báo; chạy lại sau lần cập nhật docs cuối trước bàn giao. Chưa kiểm UI role khác/BE thật. Chưa commit/push/PR.

### 2026-10-19 — User duyệt Phase 4, bắt đầu Phase 5

- Nguồn: user "duyệt" sau báo cáo Phase 4. Bắt đầu đồng bộ UI dinh dưỡng/bếp theo cùng chuẩn; chưa commit/push/PR.
- Đối chiếu: header các màn đã dùng `page__head` hoặc `h1.page__title` (DESIGN mục 7 cho phép cả hai) ⇒ không đổi. Lệch chính là bảng: 36 bảng thường chuyển sang `table table--grid` (giữ `table--compact`/class riêng). Giữ nguyên lịch tuần `td-week`, ma trận `td-ai-meals`/`td-balance` và bản in `ps-table`.
- `.table--grid` ép nền trắng ô thân bảng (0,2,3) ⇒ nâng selector màu dòng/cột (`td-row--*`, `td-grp-row`, `td-hl__total`, `kb-tr--*`, `td.kb-col-today`) lên `.table.table--grid …`. Bỏ lề ô `td-hl`, padding-right `td-norm td.right`, đậm tfoot trùng `.table tfoot`, viền trái `td-norm__range` trùng grid, `.td-range` khai báo 2 lần; `999px` → `--radius-full`. Không đổi token, service, mock, route, quyền.
- TDD: `tests/menu/ui-table-standard.test.mjs` chạy trên source HEAD 0/2, sau sửa 2/2; test:menu 44/44, test:kitchen 33/33.
- Browser mock 5196, PHT: chụp trước/sau 14 route; bảng kẻ ô giống màn nhân sự, cột hôm nay của dự trù giữ màu, bảng định mức rowSpan và đầu cột Đạm/Béo/Bột đúng. 375px/768px: 11 route không tràn body, trừ `/menu/nutrition` 430px ở 375px — do khối `td-kv`/chip ngoài bảng, bản HEAD cũng 430px ⇒ lỗi có sẵn, chưa sửa. `meal-count` không có bảng vì chưa có dữ liệu xác nhận. Chưa kiểm print, role bếp/HT, API thật.
- Cổng: `node scripts/verify.mjs` → `VERIFY PASS full` (lần đầu FAIL do script sửa CSS ghi CRLF, đã chuẩn hóa LF); `check-ai-layer` 0 lỗi/18 cảnh báo baseline. Chưa commit/push/PR. Dừng review Phase 5.
- User "có" (sửa tràn + DESIGN) và báo "các màn thực đơn tuần chưa fix": bỏ ngoại lệ, `td-week`, `td-balance`, `td-ai-meals` cũng dùng `table--grid`; ô thấp/cao định mức nâng thành `.table.table--grid.td-balance .td-low/.td-high`. Test bỏ danh sách ngoại lệ (chỉ `ps-table` bản in ngoài phạm vi).
- Tràn 375px `/menu/nutrition`: nguyên nhân gốc là `.page-actions` chung thiếu `flex-wrap` (2 nút dài), cộng 3 thẻ ngày/hàng. Thêm `flex-wrap: wrap` ở `components.css` và 2 cột thẻ ngày ≤640px. Kiểm 375/768/1440: nutrition, weekly, weekly/new, menus, foods/new, stock-receipts/new, staff, attendance, children không tràn.
- DESIGN.md cột Web: "bảng sọc" → bảng kẻ ô `table--grid` (mục 2, 6, 8.1). App không sửa (chỉ được phép FE).
- User "thực đơn đã công bố cũng chưa fix": tab Theo tuần đổi từ thẻ xếp chồng (~4.900px) sang bảng `table--grid` hàng = bữa × nhóm tuổi/loại, cột = ngày (~1.820px); thực đơn dị ứng tô `--warning-25`. User báo tiếp "vẫn thế" (tab mặc định Theo ngày): đổi nốt sang bảng Bữa | Nhóm tuổi | Món ăn | Định lượng / suất, mỗi món một dòng, ô bữa/nhóm gộp hàng có viền phải; bỏ `MenuCard`, `.kb-week`, `.kb-menu-grid` (giữ `.kb-menu` cho IssueBlocks).
- User yêu cầu rà cột thao tác lệch tiêu đề toàn app (kèm /ui-ux-pro-max:ui-styling; skill dựa shadcn/Tailwind nên chỉ áp nguyên tắc, không thêm dependency). Script đo mép chữ tiêu đề so với nội dung ô trên mọi route sidebar PHT/HT/GV. Lệch padding pill/nút (≤9px "Trạng thái", ≤13px "Thao tác") coi là chuẩn. Lệch thật đã sửa: Tài khoản phụ huynh (tách cột Phụ huynh/Tài khoản/Thao tác, dòng con cùng chiều cao, `table--grid`); Dự trù (chấm "đã sửa" chiếm 12px ⇒ đè góc ô nhập). Báo nhầm ở nhóm Đánh giá do skeleton lúc tải.
- Token không tồn tại: `--staff-directory-gap` (17 chỗ, gap = 0 ⇒ "BốTài khoản") ⇒ `--space-3`; `--fs-base` ⇒ `--fs-sm` (giữ cỡ 13px đang kế thừa).
- Thực đơn đã công bố: user yêu cầu tách mỗi nhóm tuổi một bảng; cả tab ngày/tuần render một card + bảng cho từng nhóm (cột "Thực đơn" = thường/thay thế dị ứng), bộ lọc rỗng ⇒ EmptyState.
- Chi tiết thực phẩm: user yêu cầu "Thông tin chung lên trên, lịch sử chỗ khác". Bố cục theo trang chi tiết món: trái = Thông tin chung (gộp dải tóm tắt + Quy đổi & đơn giá, hết lặp) rồi Định lượng trong món; phải = Dinh dưỡng rồi Lịch sử. Bỏ `td-strip`, `td-two`, `td-gap-section`; thêm `min-width: 0` cho `td-aside-stack` (bảng đẩy card tràn 375px).
- Quy trình bếp (`/kitchen/preparation`): user báo thực đơn dài kéo trang. "Thực đơn trong ngày" rời cột phải thành bảng full-width nhóm tuổi × bữa, món nối "A · B"; trang 2.016px → 1.403px, 375/768 không tràn. Skill `ui-ux-pro-max:design` thiên brand/logo/banner nên chỉ áp nguyên tắc.
- Phát hiện ngoài phạm vi: seed module Đánh giá ~7M ký tự vượt quota localStorage ⇒ màn Đánh giá báo "Bộ nhớ trình duyệt đã đầy"; có từ G94-179. Ghi `../../knowledge/incidents/FE-BUG-261019-assessment-seed-quota.md`, chưa sửa.

### 2026-10-19 — Phase 4: đồng bộ UI phân quyền (chờ review)

- User duyệt bảng nhân sự làm mẫu và yêu cầu dùng rule/component hiện có. Ba route quyền đã chuyển sang `page__head`, tab segmented và `table--grid table--compact`; wizard dùng `Avatar`, `FormField`, `Modal` và class/token chung.
- Hợp nhất CSS ma trận, wizard và thanh lưu vào `permissions.css`; xóa `staff-hub.css` 305 dòng, các selector `sh-*`, `perm-matrix-v2`, `perm-floating-bar`, mã màu fallback và utility không tồn tại. Không đổi token, service, mock, route hoặc permission.
- TDD: test UI contract thất bại đúng trước sửa, sau đó `npm.cmd run test:merge` đạt 38/38. Cổng full phát hiện test menu cũ chưa cập nhật `attendanceDayUnlocks` đã được user duyệt trong Progress log; đã sửa expectation và format 10 file của source merge để khôi phục cổng Prettier.
- Browser mock trên server local đang chạy: desktop hiển thị bảng kẻ ô; 375px không tràn body, bảng cuộn trong `.table-wrap`; tab active đúng route; modal không tràn; wizard 2→3→2 giữ giá trị switch. History rỗng hiển thị EmptyState. Không ghi dữ liệu demo khi kiểm tra.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. Chưa commit/push/PR; không sửa BE/App. Tiếp: user review Phase 4 trước Phase 5.
- Tiếp nối phiên (Claude Code): `check-ai-layer` báo E4 do incident reopen-handover-snapshot (commit 58e3b0a) chỉ có gạch đầu dòng, chưa có dòng bảng ISSUE_INDEX; đã chuyển thành dòng bảng → 0 lỗi/18 cảnh báo baseline. Chạy lại verify sau sửa.

### 2026-10-19 — User duyệt Phase 3 và ghép lại WIP mở điểm danh

- Sau bản xem thử G94-209 trên cổng 5194, user yêu cầu "merge vào đi bạn" cho phụ huynh/hồ sơ trẻ. Bắt đầu Phase 3: nhận UI nhưng giữ hành chính, tiền sử, latestHealth, quick panel và scope cũ; không chép đè toàn bộ childrenMockRepository.
- Parent UI đọc/ghi qua adapter tương thích parentAccounts/child.guardians cũ, không nhận gateway auth hoặc quyền array của P. HT xem theo quyền sẵn có; các thao tác ghi giữ quyền kích hoạt phụ huynh của PHT và phạm vi children hiện tại.
- User trả lời rõ "Có, ghép cả mở lại điểm danh". Cho phép lấy chọn lọc WIP 6f1d329 từ stash, không apply/pop cả stash và không đổi/xóa stash. Giữ phạm vi đã duyệt trong plan WIP: HT toàn trường, PHT campus mình, chỉ lớp năm học đang hoạt động/ngày hôm nay, thời hạn và lý do; snapshot suất chốt không sửa ngầm.
- Hai phần được kiểm tra riêng và regression chung; chưa commit/push/PR. WIP cũ cho biết browser chưa kiểm; không dùng kết quả cũ làm bằng chứng hiện tại.

### 2026-10-19 — User duyệt Phase 2 và chọn lưu demo độc lập

- Nguồn: user "làm đi bạn", sau đó chọn "1 đi bạn": lấy đầy đủ UI phân quyền G94-209, lưu cấu hình demo riêng; không áp quyền mới vào đăng nhập, phân công hoặc các luồng hiện tại. Đây là làm rõ quyết định 6/Phase 2, không tự mapping catalog mới sang grants legacy.
- Giữ nguyên `user.permissions` object, TEAM_LEADER, scope campus/lớp, auth/session, sidebar và các nguồn assignment. Chỉ Principal theo guard hiện có mở màn. Màn mới có banner thông báo cấu hình demo chưa tác động quyền đang chạy.
- Kho dữ liệu demo mới dùng collection có tiền tố permissionCenter, không ghi rolePermissions/vpAssignments/classes hay collections quyền legacy. Không nhận gateway auth, roster hoặc endpoint chưa chốt từ incoming; non-mock trả trạng thái chưa hỗ trợ.
- Bắt đầu triển khai Phase 2; chưa commit/push; Phase 3 vẫn chờ review.

### 2026-10-18 — Chuẩn bị kế hoạch, chờ review

- Commit: chưa commit. Bản tích hợp source: chưa tạo.
- Đã chốt phạm vi qua chat và lưu tại plan này cùng `../../features/README.md`.
- Người dùng làm rõ dòng giữ menu: chỉ giữ sidebar; UI bên trong màn phân quyền vẫn lấy G94-209. Đã làm rõ quyết định 3/6, AC-3 và Phase 2; source vẫn chưa merge.
- Verify tài liệu/baseline: `node scripts/check-ai-layer.mjs` → exit 0, 0 lỗi, 17 cảnh báo hiện hữu (planned paths và glob TypeScript); `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. Đây là bản dev với thay đổi tài liệu, không phải bằng chứng cho source tích hợp chưa tạo.
- Khác plan: không có; stash giữ nguyên.
- Tiếp: user duyệt draft; sau đó Phase 1. Không tự tạo merge commit hoặc push trên dev.

### 2026-10-18 — Phase 1 (đang triển khai)

- Nguồn duyệt: user "merge đi bạn" sau khi làm rõ UI quyền mới/sidebar cũ.
- Commit: chưa commit; không push, không áp dụng stash.
- Verify: chưa chạy trên source tích hợp; sẽ ghi output sau lần sửa cuối.
- Tiếp: ghép dinh dưỡng/bếp và kiểm tra hồi quy; dừng review trước Phase 2.

### 2026-10-19 — Phase 1: ghép source và kiểm tra tương thích

- Đã ghép chọn lọc UI dinh dưỡng/bếp từ N vào working tree, không dùng merge toàn nhánh. Thêm các route bếp mới; URL cũ được ánh xạ, sidebar/auth/attendance/daily health/phân công và Git không nhận code incoming. HEAD vẫn 43e680b, chưa commit/push/PR, không áp dụng stash.
- Compatibility: bếp đọc snapshot suất từng bữa hiện tại; giữ MORNING theo cấu hình lớp, forecast không đòi LUNCH. Constant hai bữa và adapter chế biến legacy vẫn phục vụ luồng bàn giao cũ. Không seed lại mảng đã lưu rỗng, không xuất lại ngày legacy đã chốt, không đổi phiếu pending thành issued.
- Review độc lập hai vòng: phát hiện và xử lý dependency gián tiếp làm đổi attendance, wrapper dashboard, URL chi tiết, count thiếu menu, session forecast/filter và doanh thu nhóm chỉ ăn sáng trong campus hỗn hợp. Kết luận vòng 2 PASS_WITH_RISK sau các sửa cuối; chỉ review tĩnh, không xác nhận API BE. Memory: `../../knowledge/incidents/FE-BUG-261019-selective-kitchen-merge-compat.md`.
- Dependency duy nhất được duyệt: read-excel-file 9.3.10 cùng transitive; không nâng package cũ. Cài theo workaround ERESOLVE đã ghi incident môi trường; giữ metadata libc cũ. Thêm mẫu Excel từ nguồn và test import.
- Kiểm tra riêng trước cổng cuối: test:menu 43/43, test:kitchen 33/33, test:merge 11/11 (không skip). Bao gồm mixed MORNING-only/LUNCH, source counts, legacy confirm handover và migration idempotent.
- Browser smoke mock tại 127.0.0.1:5191, role Principal: 4/4 đường đọc đã kiểm tra — menu cũ mở thực đơn tuần mới; Số suất ăn mở đủ MORNING/LUNCH/AFTERNOON; ngày dd/mm/yyyy; breadcrumb mở quy trình bếp và liên kết kho khô có bảng dữ liệu. Chưa kiểm tra toàn bộ mutation, responsive mobile, role giáo viên/bếp/VP hoặc API thật. Trang chủ còn báo lỗi tải một nhóm reward approvals (module không thay đổi), không kết luận toàn app sạch lỗi.
- Theo DESIGN bổ sung demo primitive trong `/ui-kit` và tài liệu Web; không đổi token. App không đồng bộ vì user chỉ cho phép FE. Dữ liệu kiểm thử giả, không reset dữ liệu demo của user.
- Cổng Phase 1: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (87/87 test, lint, format, build). `node scripts/check-ai-layer.mjs` → exit 0, 0 lỗi/17 cảnh báo baseline. `git diff --check` sạch; audit protected paths không có diff, ba stash giữ nguyên SHA. So JSON lock: không package cũ nào đổi metadata/version; thêm đúng 6 package gồm thư viện được duyệt và transitive. Sau cập nhật log này chạy lại cổng để bằng chứng nằm sau lần sửa cuối.
- Dừng review Phase 1 trước Phase 2. UI phân quyền mới G94-209, phụ huynh/hồ sơ trẻ chưa ghép; không báo toàn bộ hai nhánh đã merge.

### 2026-10-19 — Phase 2: UI phân quyền G94-209, demo độc lập

- User duyệt Phase 2 và chọn phương án 1 sau khi đã nêu khác biệt catalog Bật/Tắt với grants Xem/Sửa/campus cũ. Quyết định này cụ thể hóa và thay phần tích hợp quyền trong Phase 2: chỉ lưu demo độc lập, KHÔNG mapping hoặc áp vào auth/assignment hiện tại.
- Nhận đầy đủ UI ba tab, ma trận nghiệp vụ, wizard chọn người/thiết lập/xác nhận, đặt lại ngoại lệ, lịch sử/filter/pagination từ P. Entry `/school/roles` mở UI mới; giữ sidebar, auth/session, nguồn phân công, TEAM_LEADER. Các URL `/permissions/*` được guard Principal giống entry cũ. Không thêm endpoint hoặc dependency; non-mock trả 501.
- Dữ liệu chỉ ghi ba collection `permissionCenterRoleRows/Overrides/ChangeLogs` cùng migration version riêng. Test snapshot bảo toàn toàn bộ dữ liệu không thuộc các collection này và refresh phiên giữ object permissions/areas/campus. Không nhận roster/phụ huynh/hồ sơ trẻ mới trong đợt này.
- Review độc lập hai vòng: xử lý draft bị mất khi 2→3→2 và link lịch sử bỏ userId; vòng 2 PASS_WITH_RISK, không High/Critical. Memory: `../../knowledge/incidents/FE-BUG-261019-permission-wizard-draft-history.md`. Source từ nhánh có tham chiếu ADR/rule chưa có trong BE local: không coi là contract; ghi giới hạn trong feature doc.
- Cổng trước chỉnh CSS/docs cuối đã đạt `VERIFY PASS full` gồm 103/103 test (menu43, kitchen33, integration27), lint/format/build. Chạy lại sau lần sửa cuối trước handoff; không dùng kết quả cũ để báo xong.
- Browser mock riêng 127.0.0.1:5192 Principal: giữ luồng đăng nhập cũ; entry/menu cũ mở UI mới; lưu role kèm lý do; tạo ngoại lệ; bước 2→3→2 giữ công tắc; lưu ngoại lệ hiển thị đúng; lịch sử hiển thị thay đổi role và người. Link tên trong lịch sử mở query userId (đã xác nhận URL; dữ liệu đích kiểm tra tiếp trước handoff). Chưa kiểm browser role khác/mobile/API thật; không nói quyền thật đã áp dụng. Không reset dữ liệu demo user ở cổng khác.
- Docs cập nhật: feature permission-center-demo, route map/current state, quyết định README và incident/index. Theo DESIGN tái sử dụng Switch/Modal/token hiện có, CSS phần mới giới hạn theo class riêng; không sửa token/App. Protected diff và ba stash vẫn nguyên; chưa commit/push/PR.
- Dừng review trước Phase 3. Phụ huynh/hồ sơ trẻ vẫn chưa ghép; trạng thái toàn plan còn in-progress.

### 2026-10-19 — User duyệt ngoại lệ sidebar nhóm Thực đơn

- Nguồn: user gửi ảnh màn Quy trình và nói "gộp vào cái mới nữa chứ bạn" sau khi được hỏi đổi riêng nhóm Thực đơn. Thay quyết định giữ menu cho đúng nhóm này, không mở rộng sang Bếp & kho/Con người hay nhóm khác.
- PHT dùng 6 mục mới theo thứ tự nguồn: Quy trình, Thiết lập dinh dưỡng, Thực phẩm, Món ăn, Thực đơn mẫu, Thực đơn tuần; Principal dùng Thiết lập dinh dưỡng/Thực đơn tuần theo nguồn và route hiện có. Không mở route VP cho Principal, không sửa vớiVpAreas hoặc teacher assignment.
- Giữ các route cũ, cập nhật test điều hướng theo lựa chọn mới, kiểm tra các nhóm khác byte-equivalent trước/sau và cổng verify/docs. Chưa commit/push, Phase 3 chưa bắt đầu.
- Kết quả: diff menu chỉ thêm 2 item và thay 2 mảng nhóm Thực đơn; các nhóm khác/helper scope không đổi. Review độc lập PASS_WITH_RISK, không dead link/role expansion mới. Browser mock 5192: Principal vẫn bị chặn `/menu/flow`; đăng nhập PHT hiện đủ 6 link mới và mở màn Quản lý dinh dưỡng. Ảnh bàn giao lưu ngoài repo tại outputs/nutrition-menu-new.png. `node scripts/verify.mjs` đã trả VERIFY PASS full (104 test); AI layer 0 lỗi/17 cảnh báo baseline, diff-check sạch. Chạy lại cổng sau bổ sung log này; API thật/mobile chưa kiểm, không commit/push.
