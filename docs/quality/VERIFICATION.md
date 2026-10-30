# Verification — bằng chứng trước khi báo xong (FE)

## Iron Law
Không nói "xong / pass / đã sửa" khi chưa có **output lệnh chạy trong lượt này, sau lần sửa cuối**. Suy luận, kết quả lượt trước không phải bằng chứng. **Skip hoặc chưa chạy = chưa kiểm chứng** — báo đúng (`Verify: chưa chạy — <lý do>`).

Lệnh chuẩn: `node scripts/verify.mjs` — chưa có code (`package.json`) ⇒ in `VERIFY SKIP`; khi có code gọi `npm run verify` (team định nghĩa: lint + typecheck + test + build). Output tóm tắt, log ở `verify.log`.

## Bằng chứng

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
