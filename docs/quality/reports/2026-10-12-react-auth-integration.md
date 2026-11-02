# React auth integration — Phase3

2026-10-12; user duyệt Phase2 và cho phép ghép React trong tin nhắn “duyệt”. Existing FE branch dev preserved; parent plan BE:docs/plans/active/2026-10-11-react-auth-keycloak.md. Không commit/push/new branch/dependency/version/lockfile change; .env của user giữ nguyên. Dirty .claude/settings.json, ui-review/, mockups/ có trước giữ nguyên.

## Thay đổi
- Ghép form login(username/email), first-login428, forgot/OTP/reset, current-password vào API đúng contract BE.
- Separate auth mode/data mode; gateway default, mock explicit. Token memory, cookie bootstrap, CSRF,401 coalescing/once retry,403/503 không logout.
- Proof memory-only ngoài router history/URL/storage; metadata logout credential-free, Web Locks và version/restoreBlocked chống stale cookie/queued intent.
- Role/scope/profile từ /accounts/me; không TEAM_LEADER grant/default campus/class; unsupported-role landing; profile thật readonly vì chưa có PATCH contract.
- Giữ CSS/layout/components hiện có; thêm nhãn dữ liệu nghiệp vụ mẫu khi real auth + business mock.

## Bằng chứng local
| Check | Kết quả |
| --- | --- |
| Baseline FE verify trước sửa | PASS lint/format/build |
| Auth module tests |40 pass, fail0, skipped0; actual services/transport/storage/profile/challenge modules |
| Full FE verify sau sửa review |VERIFY PASS full; test:auth + lint + format:check + Vite build |
| Real HTTP auth smoke |9/9 pass; Keycloak26.8.0/PostgreSQL17/Mailpit + Java backend và Vite riêng |
| Independent review | P1 cookie ordering +P2 wrong-password/session-expiry fixed; sharedversion+restoreBlocked follow-up fixed; final narrow review no blocker (static) |

HTTP9 smokes: CSRF, email login+opaque cookie, Bearer profile, force refresh, logout, typed temporary428 no session, temporary reset->newlogin, generic forgot known/unknown, MailpitOTP->verify->reset->newlogin. Runtime project carenest-react-e2e-99836f597ad1 đã dọn; chỉ test processes/tmpfs/labels của runner, không đụng stack/volume user.

## RED/GREEN
- Initial31 auth tests pass + lint/build.
- Review regressions:35 tests có3 failures (cookie resurrection, missing coordination rejection, pre-refresh401 wrongly treated); fix WebLocks + shared metadata ->38 pass gồm queued intent/late peer event/offline logout marker.
- Added failed-login/reset-after-offline-logout regressions ->40 tests có2 failures; tách restoreBlocked khỏi intent type, chỉ verified successful login mở lại ->40 pass.
- E2E first attempt missing image, rebuild local artifact; second attempt5/6 vì fixture thiếu remember boolean, sửa fixture (UI luôn gửi); final9/9 including email recovery.
- Source rules/known limits unchanged: no production deployment, no real user secrets/child data in artifacts.

## Chưa kiểm chứng
- Browser UI/keyboard/responsive/real multi-tab: CUA inventory không có browser; create IAB và Chrome đều trả Browser is not available. Không dùng API tests để tuyên bố UI đã quan sát. Chờ kết nối browser để kết thúc gate này.
- Native Web Locks across real tabs dựa platform API + unit cookie ordering model, chưa quan sát browser thực tế.
- Source auth gateway đã ghép; backend thật của user chưa bật/không tự đổi realm/.env. Stack HTTP tests là isolated test, không chứng minh deployment.
- Existing Vite/plugin-react deprecation warning giữ nguyên; không tự đổi toolchain. Business endpoints ngoài auth vẫn theo mock/config hiện có.

## Handoff
Contract/config/run instructions: docs/integration/AUTH_FLOW.md. API base includes prefix; process VITE_AUTH_MODE=gateway, business VITE_USE_MOCK riêng. Backend opt-in setup theo BE README; Secure cookie cho HTTPS, local HTTP chỉ loopback. Cần browser kết nối để quan sát form và final multi-tab/UI check; plan giữ in-progress cho tới khi kiểm xong hoặc user đổi phạm vi verification.

## AI layer và tài liệu sau kiểm tra

Lần check đầu báo 1 lỗi: index của incident hồ sơ còn `open` trong khi incident đã là `workaround`. Đã đồng bộ index, chuyển AUTH_FLOW sang available và cập nhật plan Progress log. Các cảnh báo tồn tại trước task về plan UI và glob TypeScript tương lai không được dùng để nhận định chất lượng auth mới; lệnh cuối và giới hạn được ghi sau khi chạy lại.

AI layer cuối: 0 lỗi, 4 cảnh báo còn lại (một đường dẫn KidsArt trong plan UI cũ đang planned và ba glob TypeScript/TSX chưa có file). Không có cảnh báo auth contract/incident mới.
