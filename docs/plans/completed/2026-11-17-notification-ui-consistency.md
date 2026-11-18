---
title: Đồng bộ giao diện thông báo với kế hoạch năm học
status: done
owner: Tiền
jira: G94-288 / FE-FEAT-55
branch: feature/G94-288-FE-FEAT-55-school-notifications
modules: [notification]
rules: [PAR-05, PAR-07, PAR-08, PAR-09, PAR-10]
risk: medium
created: 2026-11-17
updated: 2026-11-17
---

# Đồng bộ giao diện thông báo với kế hoạch năm học

Nguồn: Tiền yêu cầu ngày 17/11/2026 dùng ui-ux-pro-max sửa các trang FE-FEAT-55 theo module kế hoạch năm học.

## Phạm vi và tác động

- Chín màn theo route: danh sách/chi tiết thông báo cá nhân, danh sách/soạn/sửa/chi tiết thông báo trường, mẫu, quy tắc, lịch lặp.
- Dùng PageHeader, DataTable, Button, Field, RowActions, ConfirmationModal, badge và trạng thái chung; chỉ CSS có tiền tố announcement.
- Giữ nguyên role guards, hợp đồng API, payload, preview chống race và quy tắc PAR-05/07..10. Màn kế hoạch năm học chỉ được đọc làm mẫu, không sửa.
- Thành phần người nhận/đính kèm được dùng bởi soạn/sửa và lịch: sửa đồng bộ mọi nơi gọi. Không sửa primitives, token, menu, backend hoặc App.

## Quyết định

Tái sử dụng design system hiện có thay vì tạo bảng màu/font/component mới. Danh sách có một thẻ chứa thanh công cụ và bảng; form dài chia khối, có nút đầu/cuối; quản lý mẫu/lịch dùng bảng và modal chung. Nhãn hành động cụ thể bằng tiếng Việt; trạng thái có chữ và màu. Không thêm chỉ số nghiệp vụ tự tính trên UI.

### Điều chỉnh theo yêu cầu tiếp của Tiền 17/11/2026

Hoàn tất ô nhập gọn/đính kèm trước (9 test, lint/format/build đạt), rồi thực hiện yêu cầu rà toàn bộ module. Tiêu đề soạn thông báo nằm riêng một dòng. Thay quyết định nút đầu/cuối bằng một thanh thao tác ghim dưới header như giáo dục: dùng PageToolbar chung dựa trên ResponsiveToolbar, nút outline cỡ sm, nhóm không xuống hàng và menu ba gạch khi thiếu chỗ. Áp cho 9 route và nút modal/tải tệp; các ô ngắn trong modal mẫu/lịch cũng giới hạn độ rộng. Account detail chỉ import primitive chung, không import module announcement. Chỉ thêm primitive/CSS opt-in, không đổi hành vi nền hoặc sửa nguồn giáo dục; tham khảo EDU-92 và giao diện EDU-82/83/87, giữ PAR-05/07..10, API, quyền và luồng xác nhận. Kiểm chứng render mọi trang, test notification/API/mock/auth liên quan, lint/format/build; không e2e hoặc gọi API thật.

### Kết quả rà toàn bộ module — 17/11/2026

- Xong theo thứ tự user yêu cầu: ô ngắn/đính kèm trước, tiếp đến dòng tiêu đề riêng và header toàn module. Đính kèm thêm dồn nhiều lần, bỏ riêng tệp, giữ lại tệp cũ; cùng helper validation với gửi để không lệch giới hạn. Đã kiểm nơi gọi soạn/sửa và chi tiết chỉ đọc; form người nhận dùng lại ở lịch lặp được thu gọn theo `.announcement-form`.
- Thêm PageToolbar opt-in: cùng offset/nền/viền/tokens như thanh giáo dục, tái sử dụng ResponsiveToolbar, nhóm nút không xuống hàng, menu khi thiếu chỗ. Summary-only không tạo menu rỗng. Không sửa ResponsiveToolbar/Button/Modal hoặc nguồn giáo dục. Bổ sung export, UI kit và UI_CARD để nơi khác dùng lại.
- Kiểm callers/luồng trước sửa: 9 route, AnnouncementHeader, form soạn/sửa, attachments, RecipientTargetForm, API multipart và coordinator; các nút tạo/sửa/lưu/tải và modal. Account detail giữ service account/notification riêng, dùng primitive chung. Hành động xóa/hủy giữ xác nhận và cảnh báo; quyền do BE và canEdit/editable/mandatory quyết định như cũ.
- `node --import ./scripts/register-auth-test-loader.mjs --test tests/notifications/*.test.mjs tests/auth/*.test.mjs tests/hardening/modal-stack.test.mjs`: exit 0, **128/128 test đạt, 0 fail/skip**. Bao gồm SSR 9 route kiểm một PageToolbar, không còn footer `.page-actions`; form bật/khóa nút, tệp chờ/read-only, validation tổng số tệp cũ+mới, API/mock/preview/nhãn/auth/modal.
- `npm run lint`: exit 0, không warning sau khi bỏ import ResponsiveToolbar không dùng ở UI kit. Prettier check tất cả JSX/CSS/helper/test liên quan: exit 0. `git diff --check`: exit 0 (chỉ cảnh báo chuẩn hóa CRLF có sẵn).
- `npm run build`: exit 0, built in 2.11s; cảnh báo eval/annotation ở module khác như trước. Không xem SSR là bằng chứng layout thực tế: chưa kiểm trực quan ghim/menu trên trình duyệt, chưa gửi qua BE thật, không chạy e2e vì user chưa yêu cầu.
- Không chạy lại test giáo dục/menu độc lập đã đạt trước đó vì không đổi nguồn/guard/menu của chúng; CSS PageToolbar có tiền tố opt-in, không tác động selector ga-*. Đối chiếu EDU-92 và tham chiếu EDU-82/83/87, giữ PAR-05/07..10; không phát sinh rule nghiệp vụ mới hoặc thay đổi cần cập nhật bản chuẩn giáo dục. Feature doc và UI_CARD đã đồng bộ; không commit/push.

## Kiểm chứng

Node tests notifications/auth/menu catalog và kiểm tra contract liên quan; ESLint, Prettier, Vite build. Không chạy e2e theo AGENTS.md; chưa kiểm UI bằng trình duyệt.

## Tiến độ

- Đã đọc nguồn màn năm học, component dùng chung và danh sách callers/tests trước sửa. Skill search React: áp dụng hướng dẫn liên kết label/control, không áp API React 19 vào dự án React 18.
- Đã triển khai các trang, component người nhận/đính kèm và CSS riêng thông báo; account detail giữ ranh giới module, dùng primitives chung. Không sửa primitives, token, route/menu, API facade hoặc module giáo dục.

## Kết quả 17/11/2026

- `node --import ./scripts/register-auth-test-loader.mjs --test tests/notifications/*.test.mjs tests/menu/catalog-routes.test.mjs tests/auth/*.test.mjs`: exit 0, 119 test đạt, 0 fail/skip. Bao gồm preview chống race, payload lịch/quy tắc, quyền mock, contract adapter, file/auth và menu.
- `npm run lint`: exit 0. Lint phát hiện import chéo account → announcement trong bản đầu; đã thay bằng primitives chung và giữ tải tệp qua service account hiện có.
- Prettier check trên các file JSX/CSS thay đổi: exit 0; `git diff --check`: exit 0. Thay đổi cuối sau build/test chỉ định dạng JSX.
- `npm run build`: exit 0; có cảnh báo annotation từ thư viện bên thứ ba.
- Smoke render bằng ReactDOMServer/Vite SSR cho 8 component trang (9 route do soạn/sửa cùng component): exit 0, đủ heading. Môi trường đầu thiếu window; đã dùng EventTarget/storage giả cho kiểm tra ban đầu. React cảnh báo useLayoutEffect không chạy phía server là giới hạn của phép kiểm; không coi đây là bằng chứng tương tác/modal/responsive trên trình duyệt.
- Không chạy e2e hoặc kiểm UI trực quan theo kích thước; không gọi API môi trường thật. Test giáo dục độc lập không chạy lại vì không sửa nguồn, shared primitives hay navigation của giáo dục.
- Không commit/push. Phần hiển thị đã ghi lại tại `docs/features/school-notifications.md`; không có quyết định nghiệp vụ mới cần sửa rule.


## Bổ sung sidebar — yêu cầu Tiền 17/11/2026

- Trước sửa đã kiểm menuConfig, Sidebar, breadcrumb resolver, route guards và các test gọi getMenuForRole. Tác động đã nêu trong chat: mọi role có nhóm Thông báo ở menu chính; hệ thống giữ khu Chung. Tái sử dụng cơ chế nhóm/flyout/active hiện có, không viết lại Sidebar.
- Cấu hình 5 mục con khai báo một lần: thông báo của tôi, nhà trường, mẫu, quy tắc, lịch; tập mục theo role giữ quyền PAR-05/07..10. Mẫu có lối vào sidebar mới nhưng route và quyền BGH vốn đã tồn tại. Không thêm trang con chi tiết/soạn/sửa thành mục độc lập.
- `node --import ./scripts/register-auth-test-loader.mjs --test <các file tests chứa getMenuForRole/menuEntryFor/alignCrumbs/Sidebar.jsx>`: exit 0, 76 test đạt, 0 fail/skip. Gồm 3 ca mới cho nhóm mọi role/fallback, tài khoản BE và breadcrumb/active trang con; cùng các test phụ thuộc menu của giáo dục, trẻ, bán trú, quyền PHT.
- `npm run lint`, `npm run build`, Prettier check trên menuConfig/Sidebar/test mới, `git diff --check`: exit 0. Build có cảnh báo annotation thư viện như trước. Không chạy e2e hoặc kiểm giao diện trực quan. Nhóm notification API/forms đã đạt 119 test ở bước trước không chạy lại vì thay đổi này chỉ chạm menu/sidebar.
- Đồng bộ `docs/features/school-notifications.md`, `docs/architecture/ROUTE_MAP.md`; không đổi nghiệp vụ, API hay quyền route. Chưa commit/push.

## Nhãn loại — Tiền yêu cầu cả BE/FE 17/11/2026

- Kiểm callers của DTO và mapper, enum BE, adapter FE, model account và các nơi render (list/detail/bell) trước sửa. BE thêm field response `typeLabel` và switch nhãn cho tất cả NotificationType hiện có; giữ type/readAt và toàn bộ logic phát sự kiện (PAR-03/05/09), quyền đọc. Không đổi schema, không sửa lịch sử/luồng EDU; App đọc JSON theo key không cần thay code.
- FE ưu tiên nhãn BE, fallback dùng chung cho mock/backend cũ; loại và trạng thái đọc dùng hai badge riêng. Danh sách, chi tiết và chuông thống nhất, không thêm CSS/token hay dependency.
- BE: `mvnw.cmd -q -Dtest=NotificationServiceImplTest,NotificationControllerTest,OpenApiSnapshotTest test`: exit 0, 10 test (4 service, 2 controller, 4 snapshot), 0 fail/error/skip. OpenAPI thêm đúng một field; test service kiểm nhãn trên feed/detail/markRead, giữ unreadCount/type/readAt. Spotless check exit 0 sau format; thay đổi sau test chỉ định dạng Java.
- FE: `node --import ./scripts/register-auth-test-loader.mjs --test tests/notifications/*.test.mjs tests/auth/*.test.mjs`: exit 0, 114 test, 0 fail/skip. Bao gồm nhãn BE mới, type lạ, thiếu nhãn và giữ trạng thái đọc. Lint, build, Prettier check đạt; build có cảnh báo thư viện như trước.
- Không chạy e2e, không kiểm UI trực quan hoặc deploy. Nhóm sidebar/giáo dục độc lập đã đạt trước đó không chạy lại; chưa commit/push. Docs BE module notification/OpenAPI và FE feature đã đồng bộ.


## Đọc thông báo trước khi mở hồ sơ — Tiền chốt 17/11/2026

- Yêu cầu mới thay hành vi mở thẳng link trước đó: mọi loại thông báo trong danh sách và chuông mở `/notifications/:id`; chỉ nút Xem chi tiết trong màn đọc tin mới mở `notification.link`. Tin không có link không hiện nút; nội dung/tệp vẫn xem được như trước.
- Trước sửa đã kiểm hai callers của notificationTarget, account service mock/API, trang chi tiết và GET /me/notifications/{id}. Backend đã cung cấp nội dung, nhãn và link với kiểm chủ sở hữu; không cần đổi BE, App, API hoặc quyền giáo dục. Không đổi thời điểm gửi/duyệt/quyền EDU-73/74.
- Sửa helper dùng chung và nhãn nút; test regression kiểm tin có/không có announcementId/link, các loại EDU/đón trẻ/sức khỏe/đơn nghỉ/thực đơn luôn qua màn đọc và vẫn giữ link cho bước sau.
- `node --import ./scripts/register-auth-test-loader.mjs --test tests/notifications/*.test.mjs tests/auth/*.test.mjs`: exit 0, 114 test, 0 fail/skip. `npm run lint`, `npm run build`, `git diff --check` đạt. Build có cảnh báo thư viện như trước. Không chạy e2e hoặc kiểm UI trực quan. BE và sidebar độc lập không chạy lại test đã đạt. Chưa commit/push.

## Căn trái/phải và kéo sát header — yêu cầu tiếp Tiền 17/11/2026

PageToolbar có leading riêng cho Quay lại trái; Gửi/Xem chi tiết và các hành động khác ở phải. Mọi root trang thông báo opt-in page--toolbar để bỏ padding trên và khoảng trống page__head chỉ chứa h1 ẩn. Giữ title truy cập, breadcrumb, menu ba gạch, quyền và handlers. Cùng lượt thay thứ tự thanh giáo dục trước thẻ lọc/tab theo EDU-92 mới; chi tiết ảnh hưởng/canonical và kiểm chứng ở plan `2026-11-17-education-header-actions.md`. 27 test liên quan đạt (gồm 9 ca model thông báo có render 9 route và nhóm trái/phải); lint/format/build/diff đạt. Các test API/mock/auth 128 ca đã đạt bước trước không chạy lại vì không đổi service/state/contract. Chưa kiểm browser, không e2e; không commit/push.
