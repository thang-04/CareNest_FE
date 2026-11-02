# Verification — bằng chứng trước khi báo xong (FE)

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
