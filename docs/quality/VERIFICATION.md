# Verification — bằng chứng trước khi báo xong (FE)

## FE-BUG-261106-xlsx-writer-merge — 06/11/2026

- Trên `dev` sau pull: hai test `growth-report-sheet.test.mjs` fail vì `exportXlsx` chỉ nhận mảng dòng; test XLSX cũ vẫn pass. Dùng lại writer từ `9d299ad` làm test tăng trưởng pass nhưng test cũ fail; nhánh tương thích cho mảng dòng làm cả 7/7 test liên quan pass.
- `node scripts/verify.mjs`: `VERIFY PASS full` sau sửa source. Chưa kiểm bằng trình duyệt hoặc BE thật; chi tiết trong [incident](../knowledge/incidents/FE-BUG-261106-xlsx-writer-merge.md).

## G94-191 — chuyển thay đổi bán trú/dinh dưỡng sang nhánh tính năng, 06/11/2026

- Nền `origin/dev` (`6a0554c`) trước khi chuyển diff: `node scripts/verify.mjs` thất bại ở 2 ca của `tests/health/growth-report-sheet.test.mjs` (dòng 158, 174: `rows.map is not a function`, `undefined is not a function`); đây là lỗi có sẵn, ngoài phần bán trú.
- Sau khi chuyển diff: `node scripts/verify.mjs` vẫn thất bại đúng 2 ca trên; các nhóm auth, menu, kitchen, integration, hardening, dashboard trước bước health đều 0 lỗi. `npm.cmd run check` đạt (lint 0 lỗi, 1 cảnh báo ở `ImportGoalFileModal.jsx`; format, design, API contract, build đạt). `node scripts/check-ai-layer.mjs` đạt: 0 lỗi, 21 cảnh báo tài liệu cũ.
- Chưa kiểm trình duyệt hoặc BE thật trong worktree G94-191 này. Các file phân quyền trường và công cụ cục bộ ở nhánh G94-272 không được chuyển.

## Đánh giá UI/UX chuyên sâu luồng bán trú — 04/11/2026
## UI tiếp nhận trẻ theo phiếu khám — 05/11/2026

- Theo yêu cầu user: tham khảo HealthExamFormPage/ExamAdminStep, tái dùng ExamSheetTable/ExamSheetBand và FormField. Bước thông tin có ba phần trẻ/hành chính/phụ huynh, ảnh chân dung cạnh bảng, người nhận tài khoản có radio/viền/StatusBadge role. Mobile xếp nhãn trên input để không cắt CCCD và SĐT.
- Thay đổi trình bày trong năm file source của children; không đổi trường, validation, quyền, bốn bước, upload hoặc tài khoản. Chế độ sheet chỉ dùng tiếp nhận, màn sửa hồ sơ giữ chế độ mặc định. Không sửa BE/APP hoặc dependency.
- Sau source cuối: node scripts/verify.mjs → VERIFY PASS full, 808 tests, 0 fail/skip; lint/format/design/API/build đạt. node scripts/check-ai-layer.mjs: 0 lỗi, 20 cảnh báo cũ.
- Chromium với app/mock tại 1440/375: nhãn liên kết đúng ô để điền dữ liệu, chọn/bỏ/thay ảnh, thêm/xóa phụ huynh, chọn người thứ hai, đi qua các bước/lưu/mở lại/reload giữ đúng ảnh và một tài khoản. CSV selection và activation sau cũng đạt. 0 lỗi JS, không tràn ngang; 12/12 object URL thu hồi mỗi viewport. Ảnh desktop/mobile đã xem trực tiếp; artifacts node_modules/.cache/intake-ui/.
- Browser dùng dữ liệu tổng hợp; chưa kiểm FE nối BE thật trong thay đổi UI này. Không commit/push. Thiết kế tại docs/features/enrollment-intake-ui.md.

## Chọn một phụ huynh nhận tài khoản — 05/11/2026

- Đã triển khai radio trên form, giữ toàn bộ liên hệ/ảnh; chỉ người được chọn có kết quả tài khoản. Import CSV/XLSX có nhóm phụ huynh 2/3, cột CCCD chọn tùy chọn và dropdown từng dòng; giữ lỗi thông tin khi sửa lựa chọn. XLS có parser BE.
- Màn tài khoản hiển thị recipient kể cả chưa kích hoạt, đếm đúng account được chọn, cho đổi người trước kích hoạt và chọn ở hồ sơ cũ mơ hồ; hiển thị số liên kết cũ để không hiểu nhầm là đã thu hồi quyền. Profile edit không tự đổi recipient hoặc tạo tài khoản cho liên hệ khác.
- Sau source cuối: node scripts/verify.mjs → VERIFY PASS full, 808 tests, 0 fail/skip. API route snapshot đồng bộ từ OpenAPI BE, không khai pending để lách gate.
- Chromium thực tế với app/mock tại 1440/375: chọn người thứ hai, lưu form tạo đúng một account, giữ ảnh cả hai người, nhập file chọn theo dòng, import chưa có account, mở panel và kích hoạt sau đúng người. 0 lỗi JS; 12/12 object URL ảnh được thu hồi mỗi viewport. Artifacts tại node_modules/.cache/selected-parent/; dùng dữ liệu tổng hợp.
- Review độc lập đã xử lý các findings về scope/identity/CAS/projection/stale selection/batch; không còn blocker trực tiếp. Chưa kiểm browser nối BE/Keycloak/SMS/S3 thật; nguồn demo/API của module children/pickup giữ cấu hình hiện có. Không commit/push.

## Tải ảnh trẻ và phụ huynh khi tiếp nhận — 05/11/2026

- `ui-review/boarding-focus-2026-11-04/UI_AUDIT.md` đánh giá 20 màn/trạng thái (19 route bán trú chính và form tạo phiếu nhập), dùng 5 ảnh user đánh dấu lưu trong `user-evidence/` cùng báo cáo 38 ảnh trực tiếp. Phân biệt ảnh có nội dung, loading, empty và quan sát source; không tuyên bố đã thử bàn phím, submit hoặc App bếp.
- Báo cáo HTML 38 ảnh được cập nhật để dẫn tới đánh giá chi tiết. `verify-boarding-report.mjs`: 38 ảnh JPEG hợp lệ, 38 card, không trùng ID, không có liên kết anchor đứt hoặc mật khẩu demo. Các liên kết tệp cục bộ trong `UI_AUDIT.md`: 0 thiếu. Trình duyệt tự động không được phép mở URL `file:`; QA giao diện của chính tệp báo cáo chưa thực hiện.
- Các đề xuất giữ BE làm nguồn của rule/quyền, giữ brand CareNest. Chỉ đánh giá, chưa thay mã nguồn giao diện. `node scripts/check-ai-layer.mjs` → 0 lỗi, 20 cảnh báo tài liệu cũ; `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (chạy lại sau phiên công cụ ngắt giữa chừng).

## Báo cáo chuyên đề luồng bán trú — 04/11/2026

- Báo cáo HTML tự chứa ảnh: `ui-review/boarding-focus-2026-11-04/CareNest-luong-ban-tru-2026-11-04.html`. 38 màn theo vai trò (18 Hiệu trưởng, 19 Phó hiệu trưởng, 1 Giáo viên liên quan), 38 ảnh JPEG. Chụp lại trực tiếp màn Kế hoạch tuần của hai vai trò, Cân đối khẩu phần, Thiết lập dinh dưỡng và Dự trù hàng tươi của Phó hiệu trưởng sau khi trang tải xong; các ảnh còn tải từ lượt đầu được gắn nhãn.
- Quan sát: Phó hiệu trưởng demo chỉ xem Kế hoạch tuần nhưng lời dẫn hướng dẫn sửa; Cân đối khẩu phần nằm trong cùng menu nhưng hiện banner dữ liệu demo cục bộ. Đã ghi `FE-BUG-261104-weekly-readonly-intro` và `FE-CASE-261104-nutrition-demo-route`. Không thực hiện lưu/công bố/xác nhận/duyệt/nhập kho; không kiểm tra App bếp/phụ huynh.
- `node ui-review/boarding-focus-2026-11-04/verify-boarding-report.mjs`: 38/38 JPEG hợp lệ, 38 mục màn, không trùng ID hoặc liên kết nội bộ đứt, không có mật khẩu demo. Trình duyệt tự động chặn URL `file:` trong lượt trước; chưa xác nhận hiển thị HTML bằng browser, chỉ xác minh tĩnh.
- Cổng repo: `node scripts/check-ai-layer.mjs` → 0 lỗi, 20 cảnh báo tài liệu cũ; `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`. Không commit/push/deploy.

## Kiểm tra trực tiếp CareNest Web theo ba vai trò — 04/11/2026

- Đăng nhập bản demo trực tiếp bằng Hiệu trưởng, Phó hiệu trưởng Cơ sở A và Giáo viên A. Báo cáo tự chứa ảnh: `ui-review/live-audit-2026-11-04/CareNest-web-3-vai-tro-2026-11-04.html`; 141 mục màn theo vai trò, 132 ảnh (gồm đăng nhập và lỗi 504), 11 mục không chụp được nội dung. Chỉ quan sát giao diện, không gửi/duyệt/xóa dữ liệu.
- Nhiều route Kế hoạch giáo dục kẹt `Đang tải dữ liệu...`; cuối phiên trang chủ từng trả HTTP 504. Chưa có network trace/root cause; xem `FE-BUG-261104-live-education-loading`. Lời dẫn màn Chờ duyệt Hiệu trưởng không khớp 4 yêu cầu suất ăn; xem `FE-BUG-261104-approval-intro-mismatch`.
- `node ui-review/live-audit-2026-11-04/verify-report.mjs`: 132 JPEG hợp lệ, 141 mục màn, không trùng ID/liên kết đứt, không có mật khẩu demo. Không mở được HTML trong browser automation vì chính sách chặn `file:`; kiểm tra cú pháp và tính toàn vẹn ở mức tệp, chưa xác nhận tương tác tìm kiếm trong trình duyệt.
- Cổng chất lượng sau khi tạo báo cáo: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`; `node scripts/check-ai-layer.mjs` → 0 lỗi, 20 cảnh báo tài liệu cũ. Không commit/push/deploy.

## EDU-48 xóa nhánh và Lĩnh vực ellipsis — 02/11/2026

- Convergence ảnh cuối phát hiện ordinal xác nhận dùng subNo mutable: appendT023, local RED1→2 rồi capture const theo block. Local browser GREEN và real E2E chạy lại1/1passed20.3s, cleanupAPI0; assertion số thứ tự trong E2E. Review lại không gap. Các mốc386tests/15.7s bên dưới là vòng trước T023; cổng full cuối được chạy sau hồ sơ và source T023, output bàn giao là kết quả sau cùng.

- User chốt nghiệp vụ và duyệt delta plan L006 bằng “Duyệt kế hoạch và triển khai tới khi sạch”. Helper subDomainBranch lấy đoạn theo ID/boundary; GoalTables xác nhận số nhóm/goal/content/tick rồi bỏ đủ nhánh, giữ read-only/normalize/manual save. Cur-domain/cur-target dùng ga-cur-select--ellipsis, title domain đầy đủ, không cắt value/options. Không đổi API/schema/dependency/quyền.
- RED11unit thiếu helper; baseline browser dùng GoalTables cũ từ Git chứng minh con sống sót/đổi cha sau xóa. GREEN11unit,44targeted; full sau source386tests fail0/skip0, VERIFY PASS full, lint/format/design/build đạt. Local browser source/CSS thật: counts2/3/4/5, Quay lại không đổi form, chỉ xóa đúng nhánh/ticks, read-only,4viewport360/390/768/1440, keyboard/ellipsis/title/value/target/filter,0lỗiJS.
- Real-BE/Keycloak: tests/e2e/system/year-plan-subdomain-delete.spec.mjs dùng API-only fixture marker riêng, slot trống, cleanup xác minh marker rồi DELETE đúng ownedID; không SQL/cấu hình DB hay bỏ guard suite cũ. Lệnh node --env-file=.env.e2e.local node_modules/@playwright/test/cli.js test tests/e2e/system/year-plan-subdomain-delete.spec.mjs --project=system --no-deps --reporter=line →1passed(15.7s). Chưa PUT trước Lưu; sau lưu/mở lại chỉ3hàng nhánh giữ, cùngID/content/tick, goalNo1, themes/breaks giữ; select4viewport. Kiểm API sau cleanup:0ownedtestplans. Lượt trước vướng selector Đóng trùng icon/footer, đã sửa test vào footer; suite nhập file cũ giữ byte như HEAD.
- Review độc lập không blocker source/test/API-only cleanup; reviewer chạy11unit đạt. Trace/ảnh real E2E ở test-results; log node_modules/.cache/subdomain-real-e2e.log; harness/ảnh local subdomain-delete-review.mjs/subdomain-delete-shots cùng cache. Tham chiếu BE:specs/006-year-plan-goal-hierarchy/quickstart.md cho analyze/task/converge và Attempts.
- Cổng cuối sau hồ sơ: node scripts/verify.mjs và check-ai-layer; output bàn giao/log verify.log. Không commit/push/deploy. Fixture tổng hợp; không sửa kế hoạch/người dùng có sẵn hoặc dọn tiêu đề trùng cũ.

## Giao diện chọn mục tiêu/nội dung Bộ — 02/11/2026

- User duyệt ảnh chức năng hiện có và cho triển khai/commit/push FE/BE. Bản fix LVC đã tách commit 994002c, push thành công trước sửa UI. Delta UI: GoalPicker, CurriculumGoalsModal và CSS module; không đổi callback/quyền, contract, nguồn danh mục hoặc logic ghép. Phạm vi/tính năng được duyệt ghi trong year-plan-import.md.
- Browser source/CSS/Modal/Tabs thật, dữ liệu giáo dục tổng hợp từ mock seed và hook/callback giả: 84 mục tiêu; chọn/bỏ tất cả; chọn theo lĩnh vực và giữ lựa chọn qua bộ lọc; tìm không dấu; checkbox nhóm/lĩnh vực; mở nội dung đi kèm; khóa khi chưa có đích; lọc/thêm hai gợi ý giữ hộp mở và bỏ lựa chọn sau thêm; chọn mục tiêu bằng Space rồi nhập bằng helper thật. Các trạng thái loading/error/retry/empty/no-target được kiểm. Không tràn body/modal tại360/390/768/1440;0lỗi JavaScript.
- Artifacts cục bộ: node_modules/.cache/curriculum-ui-review.mjs và curriculum-ui-shots. Lượt baseline phát hiện nút chọn tất cả còn tông thường; điều chỉnh kiểm màu theo token outline chung (viền nhạt không bằng màu chữ). Fixture nhập ban đầu có goal ngoài sub nên helper chặn đúng EDU-28; sửa fixture thành nhánh có sub/group rồi harness PASS. Đây là chỉnh kỳ vọng/fixture, không vá production để lách guard. Không thêm test chỉ soi markup cho delta trình bày có thể hoàn tác.
- Review độc lập read-only không thấy finding trong delta; đã truy caller ImportGoalsModal/CurriculumSourcesPage/ImportThemesModal, phạm vi selector và mobile/accessibility; reviewer không tự chạy browser/full verify. Check-design đạt baseline44hex/16cssPx/37inlineStyle. Cổng cuối `node scripts/verify.mjs` và check-ai-layer chạy sau hồ sơ; output bàn giao/log verify.log là bằng chứng cuối.
- Chưa kiểm API/lưu-mở lại với BE thật; browser dùng dữ liệu/callback giả, chỉ bước ghép mục tiêu dùng helper thật. Không tự dọn dữ liệu trùng cũ, không triển khai lại các chức năng chỉ có trong đề xuất đầu. Chỉ tài liệu BE được đồng bộ trong lượt này.

## Sửa trùng lĩnh vực con khi lấy lại mục tiêu Bộ — 02/11/2026

- User cho phép sửa CareNest_FE trong chat. Phạm vi một nhóm giáo dục: helper dùng lại lĩnh vực con/nhóm theo ID nguồn Bộ, fallback câu chỉ khi cả hai thiếu ID cha; chèn vào đúng đoạn cha, giữ normalize guard và dữ liệu cũ. Không đổi giao diện chọn hoặc tự dọn tiêu đề đã trùng.
- RED trước sửa: curriculum 16 tests, pass12/fail4/skip0; lỗi đúng ở sub/group mới được tạo. Thêm regression hỗn hợp từ review: RED added1/unavailable manual thay vì added2. GREEN sau source cuối: 39/39 targeted curriculum/import-goals/import-goal-file; reviewer độc lập chạy lại đạt exit0 và không còn finding. Sáu ca mới bao phủ nhập lại ba chu kỳ, cha sửa tên/cùng tên khác ID, nhóm mới/sub cũ, mock thiếu ID, nhóm không-sub và chép nguồn Bộ/tự gõ.
- Cổng cuối chạy sau hồ sơ bằng `node scripts/verify.mjs`; log `verify.log`, dòng VERIFY trong output bàn giao. Prettier đã chạy trực tiếp cho hai file .mjs vì glob format chung chỉ quét js/jsx/css. Đối chiếu DoD: đúng phạm vi, regression RED/GREEN, review và cổng thực tế; không có component/API mới cần kiểm role/responsive.
- Tri thức: [incident](../knowledge/incidents/FE-BUG-261102-curriculum-reimport-headings.md), ISSUE_INDEX và bẫy trong year-plan-import. Chỉ sửa FE; incident BE trước đây giữ nguyên vì lượt này không có quyền sửa BE. Chưa kiểm trình duyệt/lưu-mở lại với BE thật; không commit/push/deploy.

## Pre-PR review fixes — 02/11/2026

- User requested fixing four findings in `2026-11-02-pre-pr-flow-review.md`. RED three demo regressions → GREEN nine focused tests. Full `node scripts/verify.mjs` passes, 487 tests, zero failures/skips, after final source edits.
- Chrome 9/9 demo pages pass with runtime-error and duplicate-key-warning checks. Fresh seed 413 unique children; persisted duplicates archived without storage reset. Mock rewards count ticket periods without a missing schoolYear field. Backend monthly roster fix verified separately in sibling BE; no browser-to-real-BE/mobile E2E claim.

## Phase2 hai chế độ nhập file —02/11/2026

- User duyệt phase1 bằng “duyệt”; triển khai T013..T017 theo spec009/EDU-46. Modal radio full/present, mặc định full; preview phần thay/xóa/giữ và callback mang mode mới nhất. Model thay nguyên phần/clear hoặc keep phần thiếu, không mutate form/file, không patch fixed fields; ID mới không trùng, remap tick khi giữ cây nhưng thay chủ đề và báo liên kết mất. Page truyền range cấu hình thật vào preview/apply, thiếu range khóa apply; giữ parser/API/DB/lease/save/khôi phục/guard và nút lấy từ kế hoạch/Bộ.
- RED model10fail/11 → GREEN11/11; modal RED3fail/7 → GREEN7/7; targeted28/28; toàn suite giáo dục133/133. Cổng đầu sau source cuối: `VERIFY PASS full | npm run verify | log verify.log`,369tests fail0/skip0, lint/format/design/build đạt (1cảnh báo lint hiện hữu). Expectation targetName/additive được thay theo quyết định mới, vẫn giữ ca trùng mã/khác tên để kiểm thay nguyên danh sách; incident đóng vì nhánh cũ không còn áp dụng, không thêm getter giả.
- Browser harness source/CSS thật, đọc file/lease/save giả: full/present tại1440/375 đúng title/description/goals/themes/ticks, preview không đổi form, Hủy giữ form, missing yearRange khóa apply, readonly QH-DN-BH3dòng, keyboard tick giữ mã,0lỗi JS và không tràn body. Ảnh file-full/file-present ở node_modules/.cache/goal-ui-shots; log goal-import-browser.log. Hai test EDU-46 E2E đổi sang mode present để chủ động giữ lịch và expectation thay cây; thêm ca full clear/lưu/mở lại khi có BE credential. `node --check` đạt; cả ba E2E chưa chạy vì môi trường thiếu credential.
- Review độc lập read-only không thấy Critical/Important/Minor mới có đủ bằng chứng trong delta; reviewer chạy lại model/modal18/18 và kiểm save mapper. Review không thay kiểm BE thật và không khẳng định full verify độc lập.
- BE/Keycloak có listener8080/8180 nhưng E2E_DEV_PASSWORD không được cấu hình; không chạy E2E BE thật hoặc tuyên bố đã lưu/mở lại server. Chỉ sửa tài liệu BE, không source/schema/API/DB/dependency. Theo plan, dừng review phase2 trước phase3/converge; T018..20 không tự đánh dấu đã xong. Check-ai-layer và cổng FE chạy lại sau hồ sơ cuối; output bàn giao là bằng chứng cuối.


## Mã tick xuống dòng, kế hoạch hai chế độ nhập — 02/11/2026

- Sửa trình bày độc lập: GoalTables hiển thị từng thành phần mã ghép theo dòng, CSS pre-line/overflow-wrap thay nowrap/hidden; giữ abbr dữ liệu và hành vi tick. Browser source/CSS thật/dịch vụ giả: QH-DN-BH hiển thị đúng QH\nDN\nBH, hàng tự cao74.5px (scrollHeight75 làm tròn), 0 lỗi JavaScript; các ca card/nhập dòng/Back giữ đạt trong cùng harness.
- Hai chế độ nhập theo yêu cầu mới chưa code: user đã duyệt [plan](../plans/active/2026-11-02-year-plan-file-replacement.md) và quyền tài liệu BE. Phase1 đã cập nhật Domain14/spec/clarify/plan/model/research/contract/tasks và EDU-46/module/impact; constitution giữ1.0.0. Analyze manual13/13 FR có task,0critical/high blockers, script kiểm14mục/20task IDs unique/9task delta/16quality items. T012 hoàn tất tài liệu; T013..20 còn mở. Theo cổng phase1 đã duyệt, chờ review trước logic nhập; chưa có test/converge hai mode mới.
- Verify/check-ai-layer và lint/format/design/build chạy sau thay đổi cuối; kết quả ở output bàn giao/verify.log. Lỗi targetName cũ không được coi đã sửa. Không commit/push, chưa kiểm BE thật.

## Thu cột nhãn, tách ô nhập dòng mới — 02/11/2026

- Cột nhãn Thông tin chung máy tính192px, mobile40%, giữ card rộng. Dòng thêm chủ đề/đợt nghỉ bỏ ô colspan, chia đủ cột, ô tên nằm riêng cột2; không đổi logic tạo dòng, nhập ngày, sắp xếp/xóa.
- Browser source/CSS thật/dịch vụ giả: RED phát hiện dòng thêm gộp cột → GREEN chủ đề11ô, đợt nghỉ6ô, mọi colspan1 và textbox ở cột2; nhập tên tạo dòng tương ứng và giữ đúng giá trị, label-width192px, không lỗi JS. Các kiểm tra đồng nhất card/bảng, Back và responsive hiện có vẫn chạy cùng harness.
- BE updateYearPlan chỉ updateInfo(title,description) và saveContent, không đổi ageGroupId. Sau khi được giải thích tác động, user chốt Phó HT chỉ chọn nhóm lúc lập mới, bản đã lưu giữ cố định; giữ select khóa khi sửa, không sửa BE/APP.
- User bổ sung: tổ trưởng chỉ một nhóm, nhóm đã có kế hoạch dù chưa ban hành phải khóa khi lập mới. Theo EDU-01/02, FE làm mờ option có nhãn “Đã có kế hoạch” trong cùng năm cho mọi người lập; tổ trưởng vẫn cố định nhóm, có thông báo mở danh sách nếu trùng. RED option chưa khóa → GREEN render4/4, bao phủ DRAFT/PENDING_VP/APPROVED, khác năm không khóa, tổ trưởng cố định. Browser lập mới Phó HT: select bật, ag-5 có bản nháp bị khóa, ag-4 trống chọn được, 0 lỗi JS.
- Cổng verify/check-ai-layer và lint/format/design/build chạy sau thay đổi cuối; kết quả thực tế ở output/verify.log. Lỗi targetName hiện hữu ngoài phần bố cục vẫn được ghi riêng; chưa kiểm BE thật.

## Bổ sung cuối — viền bảng và đồng nhất card chi tiết, 02/11/2026

- User tiếp tục chốt tuần tự: bảng Thông tin chung dùng viền đậm như phần 2/3; card chi tiết cũng dài bằng hai phần sau. Bỏ giới hạn width riêng của card chi tiết, dùng Card chung; bảng nhập thêm lớp ga-goal-table có sẵn, không sao chép CSS viền.
- Browser computed-style RED: viền bảng chung nhạt rgb(227,233,242), wrapper bo12px, header12px/lề12–20px; sau dùng chung lớp, header/ô nhãn/khung và bảng phần2/3 khớp solid1px rgb(163,174,189), góc0, header13px/700/lề8px12px. So các ô trong lưới cùng loại, không nhầm ô cuối hàng hoặc ô gộp lĩnh vực (border-right/bottom khác do cấu trúc).
- Browser source/CSS thật, dữ liệu/phiên sửa giả: cả chi tiết và chỉnh sửa, ba card bằng nhau về width/left/background/border/radius/shadow/padding header-body/font title. Desktop1440: mỗi card1400px, mobile375:351px; radius20px, title18px/700; 0 lỗi JS và không tràn trang. Các ca Back sạch/Không lưu/Lưu giả lập vẫn đạt. Ảnh/log kiểm tra ở node_modules/.cache/goal-ui-shots và goal-browser-results.log (artifact cục bộ, không commit).
- Cổng kiểm tra được chạy sau bản cuối; không báo toàn bộ pass khi test nhập file targetName hiện hữu vẫn thất bại. Chưa kiểm lưu/ban hành với BE thật.

## Bổ sung mới nhất — Back Chrome và card chỉnh sửa, 02/11/2026

- User yêu cầu bỏ nút Thoát ở cả hai trang, trạng thái lưu bên trái nút Lưu trên máy tính; card Thông tin chung khi chỉnh sửa rộng bằng phần 2/3. Thay quyết định thu hẹp bảng nhập của lượt trước; card chi tiết vẫn gọn.
- Root cause Back: `state.backTo` không sửa browser history; liên kết sửa trước đây push nên Back vẫn gặp detail. Cả Chỉnh sửa/Tạo phiên bản từ detail nay replace, giữ nguyên guard dùng chung. Browser RED: Back → Không lưu không về list; GREEN: danh sách → chi tiết → sửa → Back về list khi sạch, khi chọn Không lưu (1440/375), và khi chọn Lưu (giả lập lưu thành công). Không tuyên bố lưu BE thật.
- Harness source/CSS thật, dịch vụ/phiên sửa giả: không nút Thoát, ba card form đều 1400px ở viewport1440, trạng thái lưu đứng bên trái và cùng hàng nút Lưu, mobile375 không tràn trang; sticky top64px, 0 lỗi JS. Ban đầu harness markClean rỗng làm ca sạch bị coi là bẩn; mô phỏng đúng markClean rồi chạy lại toàn bộ đạt. Test render 3/3, kiểm cả vị trí trạng thái và replace của liên kết sửa.
- Cổng đầy đủ, lint/format/design/build và check-ai-layer chạy lại sau thay đổi cuối; kết quả cuối ở output bàn giao/verify.log. Lỗi nhập file targetName nêu dưới vẫn ngoài phạm vi; chưa kiểm BE/Keycloak thật, không commit/push.

## Đồng bộ chi tiết/chỉnh sửa mục tiêu năm học — 02/11/2026

- Làn M, user cho phép sửa FE và chốt [bố cục](../features/year-plan-preview-edit.md): cùng ba phần, không tab chi tiết, header cố định/nút outline, Nhập file bên trái, Lưu/Ban hành/Xuất bên phải; thông tin chung cả hai trang 448px theo token, bảng nhập xám trắng; Thoát form về danh sách qua guard.
- Test render `year-plan-layout.test.mjs`: RED chi tiết còn tab → GREEN 3/3, gồm thứ tự phần, kiểu nút, nhóm nhập/xuất và đích thoát của liên kết sửa. Browser harness dùng source/CSS thật và dữ liệu/phiên sửa giả lập: 1440px/375px không tràn trang, cả hai summary 448px/351px; sticky form top64px khi cuộn; sửa mô tả → Thoát → Không lưu về danh sách ở cả hai kích thước, 0 lỗi JS.
- `npm run check` đạt lint/format/design/build; còn 1 cảnh báo lint hiện hữu trong ImportGoalFileModal. `check-ai-layer` đạt 0 lỗi/14 cảnh báo sau khi bổ sung memory.
- Cổng đầy đủ chưa đạt: `node scripts/verify.mjs` báo `VERIFY FAIL full`, suite education-plan 126/127, lỗi targetName khi chủ đề nhập trùng mã khác tên; test/model liên quan không thuộc diff này. Test riêng tái hiện cùng lỗi. Đã ghi [incident đang mở](../knowledge/incidents/FE-BUG-261102-import-target-name.md); không sửa logic nhập file trong task UI. Chạy lại cổng sau tài liệu cuối, kết quả bàn giao và verify.log là bằng chứng cuối.
- Chưa chạy E2E với BE/Keycloak thật, chưa xác minh lưu/ban hành thật. Không commit/push.

## Mục tiêu năm học một trang — 02/11/2026

- User chốt [bố cục một trang](../features/year-plan-preview-edit.md): nhập/lấy dữ liệu ở đầu, thông tin chung → chủ đề (2) → mục tiêu (3); bỏ bước/tab/duyệt lại/thanh Đóng. Giữ lưu/gửi/ban hành/phiên sửa và guard; không đổi BE/APP/API/dependency.
- Test render bố cục RED thiếu nút nhập trên đầu → GREEN 1/1; cổng FE đạt `VERIFY PASS full`, 347 tests, fail0/skip0; chạy lại sau thay đổi cuối, đối chiếu output bàn giao/verify.log. Cập nhật ba suite E2E bỏ thao tác bước/tab và kiểm Back/cảnh báo chưa lưu theo một trang.
- Browser harness dùng source/CSS thật, dữ liệu tổng hợp và hook dữ liệu/lưu giả lập: 1440px/375px đủ ba phần đúng thứ tự, không tab/footer, scrollWidth bằng viewport, 0 lỗi JavaScript; mở được hộp Nhập file. Lượt harness đầu thiếu CSS module nên báo tràn ngang, nạp đủ CSS và kiểm lại đạt. Chưa chạy E2E với BE/Keycloak thật, chưa kiểm lưu/ban hành thật.

## Bổ sung 02/11/2026 — tải mẫu và đồng bộ modal nhập nhánh

- Tải mẫu Word bằng helper/khung xuất hiện có, tên chủ đề theo tuần hiển thị, tên nhánh trống; không mang lịch/nháp/người ký. Modal cùng size/hàng nút/footer/cách rút cảnh báo với nhập mục tiêu, giữ preview/xác nhận.
- RED template0/2, modal0/2; GREEN4/4. FE `node scripts/verify.mjs`: VERIFY PASS full, 346 tests, fail0/skip0, lint/format/design/build đạt.
- Browser component source/CSS thật: tải Word đúng tên/header/3 dòng trống, không ngày/tên nháp, chiều rộng bằng modal mục tiêu và các nút cùng hàng; mobile375 không tràn, 0 lỗi JS. Không chạy lại full E2E BE trong lượt UI này; không sửa API/DB/quyền. [Chi tiết](../../../CareNest_BE/specs/008-branch-plan-file-import/quickstart.md).

## Feature008 — nhập chủ đề nhánh, bàn giao 02/11/2026

- User cho phép hoàn thành không dừng giữa phase; [nguồn nghiệp vụ/contract/quy trình](../../../CareNest_BE/specs/008-branch-plan-file-import/quickstart.md). Nhập theo matches server, xem trước/xác nhận thay tên/lưu tay, giữ dữ liệu ngoài matches/AI pending còn lại; Lưu/gửi luôn hiện và khóa đúng quyền/trạng thái.
- Sau source cuối: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log`, 342 tests, fail0/skip0; lint/format/design/build đạt. Có14test mới, mock CSV dùng đúng7124–26 và scope, parser CSV chung giữ export tuyển sinh.
- Real-BE jar cuối: branch3/3 gồm mobile375/chuỗi duyệt và goal17/17 gồm .doc bước2; edu-plan-flows19/19 đạt lượt trước bản vá decoder. Các lần thử lỗi/helper/ID-domain và kết quả cuối được phân biệt trong quickstart BE, không gộp thành một lượt39/39.
- Cấu hình không đổi, local USE_MOCK=false; Word/Excel cần BE thật, mock CSV có hướng dẫn. Không commit/push/deploy; runtime kiểm thử riêng đã dọn.

## Iron Law
Không nói "xong / pass / đã sửa" khi chưa có **output lệnh chạy trong lượt này, sau lần sửa cuối**. Suy luận, kết quả lượt trước không phải bằng chứng. **Skip hoặc chưa chạy = chưa kiểm chứng** — báo đúng (`Verify: chưa chạy — <lý do>`).

Lệnh chuẩn: `node scripts/verify.mjs` — chưa có code (`package.json`) ⇒ in `VERIFY SKIP`; khi có code gọi `npm run verify` (team định nghĩa: lint + typecheck + test + build). Output tóm tắt, log ở `verify.log`.

## Bằng chứng

### Tự đóng đợt khám và hạn nhập bù — 2026-11-01

- Theo yêu cầu user và `BE:docs/modules/health.md` (HLT-17): đợt khám hết ngày kết thúc sẽ tự đóng; kỳ cân đo giữ cách đóng hiện tại. Mock thực hiện đầy đủ đóng đợt khi đọc/ghi dữ liệu: chốt vắng, khóa phiếu, giữ nháp và phiếu theo dõi; ghi lịch sử "Hệ thống". Nút đóng đợt được đổi thành "Đóng sớm đợt khám".
- User chốt đợt mở lại vẫn tự đóng: mở lại đợt khám hết hạn bắt ngày kết thúc mới từ hôm nay, nhập/hiển thị `dd/mm/yyyy`; gửi thêm `endDate` trong body reopen. Request chỉ có `reason` vẫn dùng cho đợt còn hạn và kỳ cân đo. Backend có migration V51 cho actor hệ thống.
- `tests/health/auto-close-campaign.test.mjs`: 8/8 ca đạt (ranh giới nửa đêm Việt Nam khi UTC còn hôm trước, vắng/nháp/theo dõi, khóa ghi, idempotence, không đóng kỳ/hủy/đợt đã đóng, mở lại hạn mới và tự đóng tiếp). Chrome locale en-US: tự đóng sau nửa đêm → mở lại, ngày mặc định đúng `dd/mm/yyyy`, lỗi ngày cũ → lưu hạn mới → vẫn mở hết hạn mới → tự đóng lần hai, không có lỗi runtime. Dữ liệu giả, context riêng; chưa nối UI với API thật.
- `node scripts/verify.mjs` → `VERIFY PASS full`: 468/468 test, không skip; lint, format, design và build đạt. `node scripts/check-ai-layer.mjs` → 0 lỗi; có cảnh báo tài liệu cũ. Không commit/push.

### Ngày tạo đợt khám và kỳ cân đo — 2026-11-01

- Dùng `DateInput` chung cho ngày bắt đầu/kết thúc, hiển thị và nhập `dd/mm/yyyy`. Khi tạo mới, lịch giới hạn từ hôm nay; kiểm tra ngày nhập tay trước khi hỏi cảnh báo và khi xác nhận lưu. Validation phân biệt tạo/sửa để đợt đang diễn ra giữ được ngày bắt đầu cũ; backend kiểm tra theo giờ trường (`BE:docs/modules/health.md`, Known pitfalls).
- Regression: `tests/health/campaign-dates.test.mjs` 19/19, không skip; cả EXAM/MEASUREMENT, hôm qua bị chặn, hôm nay/tương lai hợp lệ, ngày không tồn tại/nhập dở, kết thúc trước bắt đầu, sửa đợt đã bắt đầu. Clock cố định 00:30 Việt Nam khi UTC vẫn là hôm qua.
- Chrome với locale en-US và giờ Việt Nam: kiểm cả hai form hiển thị `dd/mm/yyyy`, min lịch, lỗi ngày quá khứ/không tồn tại/kết thúc trước bắt đầu, tạo hôm nay và sửa ngày bắt đầu cũ; không có lỗi runtime. Dùng dữ liệu giả trong browser context riêng, chưa nối UI với API thật.
- `node scripts/verify.mjs` → `VERIFY PASS full`: 460/460 test, không skip; lint, format, design và build đạt. `node scripts/check-ai-layer.mjs` → 0 lỗi (cảnh báo tài liệu cũ). BE: `node scripts/verify.mjs --quick` → `VERIFY PASS quick`, 101/101 test, không skip (gồm 16 test health với PostgreSQL thật); ArchUnit và Spotless đạt, không chạy snapshot; log target/verify.log của BE (file sinh khi chạy, không commit). Không commit/push.

### Trùng tài khoản nhân sự vẫn tạo tài khoản phụ huynh — 2026-10-29

- Làn M: user chốt lại cùng ngày, thay quyết định sáng 29/10 "chặn 409": SĐT/email phụ huynh trùng nhân sự vẫn tạo tài khoản phụ huynh; người có cả hai tài khoản chọn tài khoản khi đăng nhập app. BE giả hoàn lại đúng bản `989c2a2` (không chặn) bằng bản vá ngược, chỉ sửa comment ở `src/mocks/parentAccountMock.js` và 2 file test; L-18 (`docs/integration/CHILD_ENROLLMENT_BE_GAPS.md`) ghi đề xuất BE/APP A/B/C. Không sửa UI, repo BE, repo APP. Sau đó cùng ngày user bỏ màn chọn tài khoản (L-18): app không cần làm màn này.
- Test: `npm run test:children` 81/81, `npm run test:merge` 46/46, không skip; AC-1 `tests/children/guardian-activation-ready.test.mjs` (trùng SĐT/email nhân sự lưu được, tạo tài khoản, nhân sự giữ nguyên). Chạy thử thêm trên BE giả: bước 1, lưu form, Sửa hồ sơ, kích hoạt với SĐT/email trùng nhân sự đều không chặn. `node scripts/verify.mjs`, `node scripts/check-ai-layer.mjs` chạy sau lần ghi cuối: kết quả ở output bàn giao và `verify.log`. Chưa thử trên trình duyệt; BE thật, APP chưa nối.
- Cùng ngày user chọn cách A (BE làm thử phần nối tài khoản, AUTH-22, chưa commit) rồi bỏ màn chọn tài khoản: BE giả FE bỏ lại phần chặn SĐT nhân sự trùng và test của nó; L-18, `docs/features/README.md`, `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` mục 7 ghi trạng thái cuối. `node scripts/verify.mjs`, `node scripts/check-ai-layer.mjs` chạy sau lần ghi cuối, kết quả ở báo cáo bàn giao.

### Swimlane tiếp nhận trẻ bằng tiếng Anh từ PNG có mã gốc — 2026-10-26

- Làn S: tạo `artifacts/enrollment-swimlane-eng.drawio` từ trang Tiếp nhận trẻ trong `tiep_nhan_tre.drawio.png` do người dùng cung cấp. PNG nhúng mxfile 5 trang; chỉ trích trang `oy8reLlU6jjIu4IcxXmV` và dịch 25 nhãn, kể cả ghi chú ngoài khung. Đầu ra một trang, 4 làn, 82 cell, 38 đường nối; không sửa luồng, vai trò hoặc ứng dụng.
- So sánh mxGraphModel sau khi loại thuộc tính nhãn: bố cục, ID, kiểu hình, nội dung hình học và mọi đầu nối giống bản gốc. XML hợp lệ, ID không trùng, tham chiếu đầy đủ, không còn nhãn tiếng Việt. Đã render bằng trình xem diagrams.net chính thức trên Chrome headless và xem ảnh để kiểm chữ; chưa thao tác trong trình soạn thảo. Đây là chuyển ngữ bản người dùng gửi, không xác nhận lại tính đúng nghiệp vụ của sơ đồ.
- Không thêm test ứng dụng cho thay đổi tài liệu. `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` chạy sau lần ghi cuối; kết quả thực tế trong output bàn giao và `verify.log`.

### Swimlane đón trẻ bằng tiếng Anh từ ảnh — 2026-10-26

- Làn S: tạo `artifacts/pickup-swimlane-eng.drawio`, một trang gồm 3 làn Parent / Teacher / System, 17 nút và 18 đường nối. Giữ bố cục và nhánh của ảnh người dùng cung cấp; dịch nhãn sang tiếng Anh, chuẩn hóa nhãn bị lặp thành `Enter call notes`. Không thay đổi luồng nghiệp vụ, source ứng dụng hoặc bản swimlane tiếng Việt.
- Kiểm XML, ID duy nhất, đầy đủ tham chiếu, nhãn chỉ dùng tiếng Anh; các đường nối vuông góc không cắt qua nút khác. Đã xem bản SVG dựng từ cùng bố cục bằng Chrome headless và review độc lập các nhánh. Chưa mở trực tiếp trong diagrams.net; đây là bản chuyển ảnh, không phải xác nhận contract BE.
- Không thêm test ứng dụng cho thay đổi tài liệu. `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` chạy sau lần ghi cuối; output bàn giao và `verify.log` ghi kết quả cổng thực tế, không suy luận các bước chưa chạy là đạt.

### Swimlane toàn bộ luồng khám sức khỏe — 2026-10-25

- Làn M: cập nhật `artifacts/health-examination-swimlane.drawio`, XML UTF-8 chỉnh sửa được, 4 trang: tổng quan; quản lý đợt; khám và kết luận từng trẻ; theo dõi sau khám. Có 112 nút hoạt động/điều kiện/ghi chú và 104 đường nối; đồng bộ 4 SVG xem trước. Không sửa source ứng dụng hoặc dữ liệu.
- Đối chiếu feature doc, form khám, quản lý đợt, chi tiết theo dõi, health mock repositories và rule hiện tại. Hiệu trưởng quản lý đợt; giáo viên ghi phiếu; bác sĩ khám và kết luận ngoài hệ thống. Lưu hoặc sửa kết luận đều tự công bố; đóng đợt không đóng phiếu theo dõi. Nhánh NOTED giữ vòng hiện tại, không luôn tự ghi lịch sử trao đổi. Có hủy/mở lại đợt, 3 lựa chọn đóng phiếu, nhắc việc độc lập và tự đóng khi trẻ nghỉ học.
- Sibling BE không có; GitHub remote chưa đọc được. Tham khảo card health và flow health-check trong bản BE cũ tại `D:/project_capstone/project/be/CareNest_BE/docs/`. Giữ DRAFT theo FE/mock ngày 25/10/2026, chờ thống nhất BE; không coi là contract BE đã xác nhận.
- Kiểm XML/SVG, Unicode, 4 trang, ID duy nhất từng trang, đủ tham chiếu và hình học đường nối: không cạnh chéo hoặc cắt nút khác. Đã xem cả 4 SVG bằng Chrome headless, sửa nhãn bị sát mép và review độc lập với code. Chưa mở trực tiếp bằng diagrams.net; chưa kiểm BE/App thật.
- Test liên quan: `node --import ./scripts/register-auth-test-loader.mjs --test tests/health/auto-publish.test.mjs tests/health/follow-up-exam.test.mjs tests/health/previous-exam.test.mjs`: 19/19 đạt, không skip. Cổng repo có [incident thực đơn phụ thuộc ngày](../knowledge/incidents/FE-BUG-261024-menu-ai-week-verification.md) đã ghi trước đó; `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` chạy sau lần ghi tài liệu cuối, kết quả thực tế trong output bàn giao và `verify.log`.

### Swimlane kích hoạt tài khoản phụ huynh — 2026-10-24

- Làn M: tạo `artifacts/parent-activation-swimlane.drawio` (XML UTF-8 chỉnh sửa được), 1 trang, 4 làn, 39 nút hoạt động/điều kiện/ghi chú và 39 đường nối; kèm bản xem trước SVG cùng tên. Không sửa source ứng dụng, auth hay dữ liệu.
- Đối chiếu `ParentActivationPage.jsx`, `GuardianPanel.jsx`, guardian mock repository, validation, quyền trên hồ sơ trẻ và mục tài khoản phụ huynh trong `docs/features/README.md`. Thông tin chỉ xem từ hồ sơ; một yêu cầu cho mọi PH đang chờ, lỗi dữ liệu/xung đột hủy cả lô. Kích hoạt gửi yêu cầu ngay, không có hộp xác nhận; cấp mật khẩu mới có xác nhận.
- Phân biệt tài khoản mới ACTIVE và tài khoản có sẵn chỉ liên kết trẻ, giữ trạng thái/mật khẩu, không SMS. SMS lỗi không hủy tài khoản đã tạo. Nhánh cấp mật khẩu mới và gửi lại chỉ cho một tài khoản, không quay về bước tạo/liên kết cả lô. Bước nhận SMS thật ghi rõ dự kiến; không vẽ đăng nhập App hay đổi mật khẩu như đã triển khai.
- Sibling BE không có; GitHub remote không đọc được. Tham khảo card `identity-access`, `child` và AUTH-18..19 tại `D:/project_capstone/project/be/CareNest_BE/docs/`; bản này còn luồng in phiếu, trong khi FE/mock đã chuyển sang SMS theo quyết định riêng Web ghi trong feature doc. Sơ đồ giữ DRAFT, không coi là contract BE đã thống nhất; facade hiện trả 501 khi tắt mock.
- Kiểm XML/SVG, Unicode, ID/tham chiếu, số trang và định tuyến không cắt qua nút; đã xem SVG bằng Chrome headless và review độc lập với source. Chưa mở trực tiếp bằng diagrams.net, chưa kiểm BE thật hoặc gửi SMS thật. Test riêng `node --import ./scripts/register-auth-test-loader.mjs --test tests/children/guardian-activation.test.mjs`: 4/4 đạt, không skip.
- Cổng repo có [incident test thực đơn phụ thuộc ngày](../knowledge/incidents/FE-BUG-261024-menu-ai-week-verification.md) đã ghi từ lần xuất sơ đồ trước. `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` chạy sau lần ghi tài liệu cuối; output bàn giao và `verify.log` là bằng chứng cổng cuối, không suy luận các bước chưa chạy là đạt.

### Swimlane luồng đón trẻ — 2026-10-24

- Làn M: cập nhật `artifacts/pickup-swimlane.drawio` theo code mới và gộp so ảnh, gọi phụ huynh, ghi nhận, bàn giao vào đúng 1 trang. XML UTF-8 chỉnh sửa được, 4 làn, 37 nút hoạt động/điều kiện/ghi chú, 40 đường nối; đồng bộ `pickup-swimlane-overview.svg`, bỏ bản xem trước gọi điện riêng đã được gộp.
- Nguồn hiện tại: mục Đón trẻ trong `docs/features/README.md`, `docs/architecture/ROUTE_MAP.md`, `PickupVerifyFlow.jsx`, pickup mock repository, validation và test nội dung cuộc gọi. Sibling BE không có, remote chưa đọc được ở bước đối chiếu trước; giữ DRAFT theo FE/mock, API PROPOSED, APP chỉ giả lập.
- Hai nút độc lập trên danh sách; không khớp ảnh chuyển sang gọi ngoài hệ thống. Qua gọi: cả Trả và Không trả xác nhận rồi ghi ngay trong modal, không chuyển trang nhập người đón; người đón nằm trong nội dung cuộc gọi, giờ trả chốt lúc bấm Trả. Không liên lạc được ghi Không trả và vẫn Chờ đón. Hủy xác nhận giữ modal/nội dung để sửa, chọn lại; lưu lỗi qua gọi phải xác nhận lại trước khi gửi.
- Kiểm XML/SVG, ID/tham chiếu, một trang, Unicode và định tuyến không cắt qua nút. Đã xem bố cục SVG gộp bằng Chrome headless, review độc lập với source; chỉ có một bước lưu chung. Chưa mở trực tiếp bằng diagrams.net hoặc kiểm BE thật; không sửa source ứng dụng hay dữ liệu.
- Chạy riêng `node --import ./scripts/register-auth-test-loader.mjs --test tests/hardening/pickup-call-note.test.mjs tests/hardening/pickup-seed-size.test.mjs`: 2/2 đạt, không skip, bao gồm trả qua gọi không có tên/quan hệ riêng. Cổng repo có [incident test thực đơn phụ thuộc ngày](../knowledge/incidents/FE-BUG-261024-menu-ai-week-verification.md) đã ghi ở lần xuất trước. `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` được chạy sau lần ghi tài liệu cuối; kết quả bàn giao và `verify.log` là bằng chứng cổng cuối, không suy luận các bước chưa chạy là đạt.

### Swimlane luồng khám sức khỏe — 2026-10-23

- Làn M (kèm ghi nhận kiểm thử ngoài phạm vi): tạo `artifacts/health-examination-swimlane.drawio`, XML UTF-8 chỉnh sửa được, gồm 4 trang: tổng quan; nhập phiếu và công bố; theo dõi sau khám; vòng đời đợt. Gồm 84 nút hoạt động/điều kiện/ghi chú và 86 đường nối; không chứa hồ sơ trẻ hay thông tin tài khoản.
- Đối chiếu `docs/features/README.md`, các plan đã hoàn thành ngày 17/21/22-10 và mock repository hiện tại. Sibling BE không có, GitHub không đọc được; tham khảo bản BE local tại `D:/project_capstone/project/be/CareNest_BE/docs/` (card health và flow health-check, bản cũ). Sơ đồ gắn DRAFT và ghi rõ FE/mock còn chờ thống nhất BE; không thay đổi nghiệp vụ hay ứng dụng.
- Kiểm XML, tham chiếu hình/đường nối, Unicode và bố cục SVG tương ứng; review độc lập các nhánh công bố, trao đổi, đóng/mở lại đợt. Chưa mở trực tiếp bằng diagrams.net; chưa kiểm BE thật.
- Lịch sử cổng repo: lần đầu 5 test `follow-up-exam.test.mjs` không đạt; lần sau 269 test và lint đạt, dừng ở format của `src/components/children/exam/ExamSummary.jsx`. `check-ai-layer`: 0 lỗi, 14 cảnh báo hiện hữu. Ghi [incident kiểm thử](../knowledge/incidents/FE-BUG-261023-health-follow-up-verification.md) và index; không sửa source/test. Cả hai cổng chạy lại sau lần ghi tài liệu cuối; output bàn giao và `verify.log` là kết quả cuối.

### Nhịp ba chấm loading — 2026-10-20

- Kiểm tiếp sau phản hồi "vẫn giật lắm": Chrome local mock `/ui-kit` bật giảm chuyển động. Trước sửa cả 9 chấm vẫn chạy `spinner-hop` infinite với duration `1e-05s` do rule `!important` toàn cục. Sau media rule riêng cho chấm: cả 9 có animation-name `none`, transform `none`, opacity `0.7`. Chế độ thường giữ source 1.6s, chưa giả lập lại; không đổi thời gian loading. Incident: `docs/knowledge/incidents/FE-BUG-261020-spinner-reduced-motion-loop.md`. Cổng verify và check-ai-layer chạy lại sau lần sửa cuối, xem output bàn giao.

- User chốt chỉ làm ba chấm chạy chậm hơn. Làn S: `src/styles/components.css` giãn chu kỳ `spinner-hop` từ 1s lên 1.6s; độ trễ chấm 2/3 từ 0.15s/0.3s lên 0.24s/0.48s, giữ tỷ lệ lệch nhịp. Áp dụng cho Spinner thường và nhỏ, gồm nút AI gợi ý cách sửa.
- Giữ nguyên timeout request, thời gian bật/tắt loading và cơ chế giảm chuyển động. Đây là điều chỉnh nhịp animation theo yêu cầu, không có incident mới; không thêm test riêng cho giá trị CSS.
- Kiểm chứng source: chu kỳ 1600ms, độ trễ 240/480ms. Cổng `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` chạy sau lần sửa cuối, kết quả trong output bàn giao. Chưa đánh giá trực quan trên trình duyệt hoặc kiểm API thật.

| Claim | Bằng chứng |
| --- | --- |
| Xong (khi có code) | Dòng `VERIFY PASS …` trong lượt |
| Bug đã sửa | Output test **fail trước fix** + **pass sau fix** (chưa có test runner ⇒ bước kiểm tay ghi rõ, trình duyệt) |
| Khớp contract BE | Đối chiếu `BE:docs/api/openapi.yaml` (snapshot BE khóa bằng test) + source DTO BE, dẫn `file:line` |
| Chạy trên trình duyệt | Bước + kết quả `x/y`, môi trường (BE thật hay mock) |
| AI layer nhất quán | `node scripts/check-ai-layer.mjs` exit 0 |

## Báo cáo cuối task

### GitHub Actions chạy từ dev — 2026-10-20

- Làn S: đổi bộ lọc push trong `.github/workflows/deploy.yml` từ `main` sang `dev`; giữ nguyên kích hoạt thủ công và các bước verify/deploy VPS.
- Kiểm chứng local: chạy `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs` sau lần sửa cuối; kết quả trong output bàn giao và `verify.log`. Chưa commit/push, chưa chạy trên GitHub runner hoặc kiểm chứng deploy VPS.

### Dọn CSS không dùng — Phase 1, 2026-10-19

- Kế hoạch user duyệt: `docs/plans/active/2026-10-19-css-cleanup.md`; chỉ dọn kỹ thuật, giữ giao diện và dirty work. Xóa 95 rule, giảm 499 dòng ở 12 stylesheet; không xóa file hoặc đổi JSX/token/dependency.
- Kiểm chứng cấu trúc: AST giữ nguyên mọi rule/declaration/thứ tự ngoài danh sách xóa; hash tracked file ngoài phạm vi giữ nguyên. Reviewer độc lập không tìm thấy consumer bị bỏ sót, kể cả template class và selector ghép.
- Chrome mock riêng, 23 màn ở 1440/768 và ba trạng thái tương tác: 49/49 ca giữ nguyên computed style/hình học; không có selector đã xóa khớp DOM hoặc runtime exception. Modal/Escape, bốn loại toast và focus bàn phím hoạt động.
- PNG: 5/49 ảnh trùng pixel tuyệt đối; 49/49 ảnh không lệch quá 2/255 mỗi kênh RGB, tối đa 145 pixel/ảnh (0,0112%) khác do raster chữ. Đã bỏ nhiễu từ full-page screenshot/scrollbar, loading và HMR bằng kiểm lại viewport trên cùng DOM ổn định; không gọi toàn bộ ảnh là trùng tuyệt đối.
- Suite ghi nhận trong `verify.log`: menu 46, kitchen 37, merge 38 đều đạt, 0 fail/skip; lint/format/build đạt. `check-ai-layer`: 0 lỗi/18 cảnh báo hiện hữu. Cổng đầy đủ được chạy lại sau khi ghi log này; xem output bàn giao cuối.
- Bằng chứng ảnh/JSON/snapshot ở thư mục tạm `carenest-css-cleanup-9c9b06d931ea4fecb3080c1e89578396`; ma trận, thống kê và giới hạn trong Progress log của plan. Không kiểm BE thật hoặc triển khai; Phase 2 chờ review.

### Khoảng cách card Quy trình bếp — 2026-10-19

- User báo khối Thực đơn trong ngày dính card phía trên tại `/kitchen/preparation`. Chrome mock đo gap trước sửa: 0px.
- Sửa hẹp `KitchenFlowPage.jsx`: dùng utility `mb-16` có sẵn (`--space-4`) ở hàng `.db-board`; không đổi CSS dùng chung, dữ liệu hoặc hành vi. Kiểm lại khoảng cách bằng bounding rect trên Chrome, cổng đầy đủ `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs`; kết quả cuối trong báo cáo bàn giao/`verify.log`.

### Bằng chứng thực đơn dị ứng — 2026-10-19

- Mock repository: `tests/kitchen/published-allergy-menu.test.mjs` ban đầu 0/3, bổ sung read model đạt 3/3; thêm ca legacy tái hiện 3/4 rồi fix đạt 4/4. Bao phủ đổi/bỏ món, nhiều phương án, bữa không đổi, dữ liệu legacy, scope campus/nhóm tuổi, 403 và trường dữ liệu tối thiểu.
- `node scripts/verify.mjs` sau bổ sung fallback legacy: `VERIFY PASS full`, menu 46 + kitchen 37 + merge 38 = 121 test; lint/format/build đạt. Chạy lại sau chỉnh docs cuối, output tại `verify.log` và báo cáo bàn giao.
- Chrome `localhost:5173`, mock, PHT campus 1, ngày 21/10/2026: Theo ngày, Theo tuần và `/kitchen/preparation` đều có dòng thay món + lý do; nút mắt mở bảng tên/lớp/dị ứng đúng nhóm. Escape và nút Đóng đóng modal; đổi nhóm tuổi về Nhà trẻ không còn modal/dòng dị ứng của Mẫu giáo lớn.
- Quy trình bếp 375px: body 365px, modal khoảng 317px; 768px: body 758px. Theo ngày/tuần 375px: bảng cuộn trong khung, body không vượt viewport sau khi layout ổn định. Viewport đã reset. Không reset DB/session demo của user.
- Review độc lập phát hiện thiếu tên món legacy, đã sửa và review lại không còn lỗi quan trọng. Chưa kiểm UI Principal/bếp, BE thật hoặc scope enrollment lịch sử. `check-ai-layer`: lần đầu thiếu dòng incident đúng định dạng bảng, đã sửa index và đạt 0 lỗi/18 cảnh báo; chạy lại sau docs cuối.

```text
Làn S (≤3 dòng):  Đã làm: … · Verify: <dòng VERIFY | chưa chạy — lý do> · Memory: <chỉ khi có trigger>
Làn M (≤8 dòng):  Đã làm · Rule/AC · Verify · Chưa kiểm chứng (trình duyệt, BE thật) · Chờ BE · Memory
Làn L:            ghi đủ vào Progress log của plan; chat chỉ tóm tắt + link plan
```

## Lấy mục tiêu từ kế hoạch năm có sẵn — 28/10/2026

- VERIFY PASS full | npm run verify | log verify.log sau lần sửa test cuối; 59/59 education-plan tests.
- E2E feature003 trên BE/Keycloak thật: 13 passed (1.0m), zero fail/skip; chọn/reset, quyền/lease, source freshness, lỗi/race, 200 goals/responsive, manual-save retry/reopen/preservation đều qua. Dọn 0 fixture import còn sót.
- Converge cuối 22/22 task, không actionable gap; [bằng chứng/command/giới hạn](../../../CareNest_BE/specs/003-import-year-plan-goals/quickstart.md). Không tuyên bố toàn bộ E2E feature khác đã chạy; không commit hoặc đưa secret vào log.
# Nhãn trạng thái danh sách kế hoạch năm — 05/11/2026

- User chốt: “Phiên bản N” dạng chữ nhỏ xanh nước biển, bỏ mã KHNH và badge phiên bản màu ở danh sách và bảng Phiên bản trên trang chi tiết; cột Trạng thái ghi “Đã thay thế” cho bản đã được thay bằng bản ban hành mới, “Đã ban hành” cho bản hiện hành. Rule: BE EDU-25 (CONFIRMED), không thay workflow/contract/DB. Phạm vi FE: GoalListPage, VersionWidgets, bảng nhãn YearPlanStatusBadge và xóa CSS cột mã không còn dùng.
- Nguyên nhân: danh sách chỉ truyền status APPROVED cho cột trạng thái, thông tin hiện hành nằm ở VersionBadge riêng. UI nay ưu tiên current từ BE; mock dùng currentPlanOf hiện có trên toàn bộ goals trước bộ lọc. REPLACED chỉ là nhãn hiển thị, không ghi vào dữ liệu kế hoạch.
- Regression: `node --import ./scripts/register-auth-test-loader.mjs --test tests/education-plan/goal-list-status.test.mjs`: RED 0/2 → GREEN 2/2. Bao phủ V1/V2 đã ban hành cùng V3 đang sửa, current=false khi thiếu bản hiện hành trong danh sách, current=true, khác nhóm tuổi/năm; số phiên bản hiển thị cả V1.
- Bổ sung sau góp ý màu/mã và ảnh bảng chi tiết: regression màu/mã RED 1/2 → GREEN 2/2; thêm kiểm bảng chi tiết, tổng GREEN 3/3. Dùng class text-xs/text-primary của design system, liên kết mở bản khác chuyển từ cột mã sang số phiên bản; VersionBadge bỏ logic/tone cũ.
- Cổng cuối: chạy `node scripts/verify.mjs` và `node scripts/check-ai-layer.mjs`; kết quả thực tế trong output lượt bàn giao và verify.log. Chưa kiểm giao diện trình duyệt hoặc E2E với BE thật. Không sửa BE/APP, không commit/push.
