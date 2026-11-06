---
title: Chọn một phụ huynh nhận tài khoản trên form và Excel
status: done
owner: thang-04
jira: G94-180 / FE-FEAT-43
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [children, guardian]
rules: [AUTH-04, AUTH-18, AUTH-19, PCK-02]
risk: high
created: 2026-11-05
updated: 2026-11-05
---
# Chọn một phụ huynh nhận tài khoản

## Context
Plan chính [BE](../../../../CareNest_BE/docs/plans/completed/2026-11-05-selected-parent-account.md), [thiết kế màn hình](../../features/selected-parent-account.md). Đây là delta nghiệp vụ mới, khác plan guardian wiring 01/11 của G94-272/branch dev.
User đã chốt form kích hoạt ngay, Excel kích hoạt sau; cả hai chọn một người, màn tài khoản chỉ hiện người đó. Hiện mock/helper kích hoạt mọi pending guardian và parser file chỉ đọc một guardian.

## Quyết định đã chốt
Một recipient mỗi trẻ; giữ đủ phụ huynh/ảnh/người đón; thời điểm form/Excel theo user. Giữ quyền và cơ chế mật khẩu/thông báo hiện có.

## Làm rõ nghiệp vụ
G94-180/AUTH-20 giữ timing và ngoại lệ quyền; AUTH-04/18/19 cho tài khoản, PCK-02 cho người đón. User yêu cầu thay tập được tạo/link từ cả danh sách thành người được chọn. Không coi recipient là điều kiện quyền đón.

### Câu hỏi mở
- [x] User duyệt thiết kế và cho triển khai cùng plan chính BE.

## Acceptance criteria
AC-1..8 ở BE Domain Spec013; radio/preview đúng người, file cũ một guardian vẫn dùng, account list/panel/count chỉ người chọn, BE enforcement và giữ ảnh/link cũ.

## Key decisions
Radio chung nhóm trên các thẻ phụ huynh; một người tự chọn, nhiều người cần chọn rõ. Dropdown ở mỗi dòng preview Excel, CCCD tùy chọn để chọn sẵn. Field lựa chọn đi cùng guardian và được BE lưu, không chỉ giữ state ở UI.

## Phases
### Phase 1 — Sau duyệt, thực hiện cùng lượt BE
- ChildInfoFields/EnrollChildPage: radio, xóa/đổi thứ tự, xem lại và kết quả tạo/link chỉ người chọn; giữ File ảnh đúng người.
- IMPORT_COLUMNS/template/parser/ImportChildrenPage: các nhóm guardian tùy chọn 2/3, header cũ, dropdown row, lỗi selection và nhập hồ sơ không kích hoạt.
- ParentActivationPage/GuardianPanel/guardianCoverage/hooks/mock/API: một recipient, trạng thái và số đếm đúng, thao tác kích hoạt chỉ người chọn.
- Exit: `node scripts/verify.mjs` → VERIFY PASS full; `node scripts/check-ai-layer.mjs` exit 0; browser 1440/375 cho form, preview Excel và activation; đối chiếu BE contract/read scope.
- **Dừng chờ user review cùng BE.**

## Rủi ro & rollback
Danh sách tài khoản và danh sách người đón khác nhau; không lọc guardian gốc làm mất ảnh/liên hệ. Dữ liệu nhiều tài khoản cũ không tự khóa/gỡ link; theo phương án migration trong plan chính. Không đổi nguồn demo/API toàn module ngoài phạm vi.

## Validation log
- [x] Thiết kế UI/contract và timing đã tách rõ.
- [x] Chỉ tài liệu ở bước này; không tuyên bố tính năng đã code/test.

## Progress log
### 2026-11-05 — Thiết kế chờ review
- Tạo thiết kế UI, liên kết Domain/plan/contract BE, giữ các file ứng dụng hiện tại.
- Thời điểm được user xác nhận: form ngay khi lưu, Excel sau nhập ở Tài khoản phụ huynh.
- Check-ai-layer/diff whitespace chạy sau thay đổi cuối; chưa chạy test tính năng vì chưa implement.

### 2026-11-05 — User yêu cầu triển khai
- User: “hãy thực hiện code phần vừa thiết kế về chọn 1 phụ huynh làm tài khoản”. Đây là phê duyệt triển khai thiết kế/contract/migration FE và BE, một phase rồi review; chưa cho commit/push.

### 2026-11-05 — Triển khai và rà soát
- Phục hồi đúng stash vào nhánh G94-180 sau khi workspace được chuyển sang dev; giữ stash dự phòng, không commit/push.
- Form radio, preview CSV/XLSX nhiều phụ huynh, lựa chọn theo dòng, activation panel/scope/counters và API adapters đã triển khai. Hồ sơ giữ ảnh/liên hệ, historical links không bị thu hồi tự động.
- Review độc lập đã xử lý stale selection, projection theo accountId, CAS CCCD, batch CHD-04, scope pending, profile-edit selection, migration legacy.
- FE full gate đạt 808 bài, không fail/skip; browser mock1440/375 đạt các luồng và 12/12 URL ảnh được thu hồi mỗi viewport. Kiểm tra cuối ở docs/quality/VERIFICATION.md.

### 2026-11-05 — Hoàn tất phase triển khai, sẵn sàng user review
- BE: VERIFY PASS full | tests1087 fail0 err0 skip0 | archunit/snapshot/spotless đạt, sau clean và source/test cuối; log target/verify.log.
- FE: VERIFY PASS full | tests808 fail0 skip0; browser mock1440/375 đạt, 0 lỗi JS, ảnh12/12 URL thu hồi mỗi viewport. Không tuyên bố live FE-to-BE/Keycloak/SMS/S3.
- Review đọc source độc lập đã kiểm lại CAS ở form/legacy/activation, khóa recipient và projection theo user_id; không còn blocker. Bổ sung test scope trẻ đã nghỉ để không mở rộng quyền PHT.
- Check-ai-layer cuối 0 lỗi; không commit/push/deploy, giữ stash dự phòng.
