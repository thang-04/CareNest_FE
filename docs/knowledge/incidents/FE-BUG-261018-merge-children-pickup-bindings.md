---
id: FE-BUG-261018-merge-children-pickup-bindings
type: bug
screens: [children, pickup]
be_modules: [child]
rules: [AUTH-08]
status: fixed
date: 2026-10-18
keywords: [merge, campusOptions, canEditChild, canWithdrawChild, VERIFICATION, no-undef]
similar_to: []
---

# Merge children/pickup: thiếu binding sau auto-merge

## Symptom và tái hiện

Merge G94-180 vào G94-179 với `--no-commit --no-ff -X ours`, sau đó chạy `node scripts/verify.mjs`. Lint lỗi `campusOptions`, `canEditChild`, `canWithdrawChild` và `VERIFICATION` không được định nghĩa. Không có conflict marker nhưng UI có thể lỗi runtime.

## Root cause

Hai nhánh sửa cùng import/bộ lọc. Auto-merge ưu tiên hunk của G94-179 giữ import và cách lấy lớp toàn trường, trong khi JSX/action từ G94-180 cần binding mới. ChildrenListPage có thêm cột sức khỏe nhưng số cột loading/empty còn cũ. Đây là lỗi tích hợp FE, không phải contract BE.

## Attempts

1. Auto-merge thành công về text; verify FAIL với 5 no-undef và 2 unused warnings.
2. Bổ sung import quyền/VERIFICATION và campusOptions từ dữ liệu children có scope; giữ cách lấy lớp của G94-179. Xóa binding dị ứng không còn dùng, cập nhật số cột. Verify full PASS.
3. AI layer phát hiện 8 incident mới thiếu index do auto-merge ưu tiên bảng cũ; ghép các hàng mới, không bỏ hàng hiện tại. AI layer PASS, 0 lỗi/17 cảnh báo có sẵn. Ghép các menu healthChecks/healthFollowUps mới vào menu hiện tại cho các role tương ứng của nhánh nhập.

## Fix và ảnh hưởng

Sửa hẹp ChildrenListPage và PickupListPage. Giữ nguyên các màn điểm danh, đánh giá, giáo dục và cấu hình của G94-179. Giữ package/lock của G94-179 để không tự nâng plugin build theo nhánh nhập. Không sửa BE/APP hoặc quyền nghiệp vụ. Chưa kiểm UI/browser/API thật.

## Regression test

Verify full PASS sau sửa; index không còn unmerged. So với HEAD trước merge `9380ab4`, package/lock và các trang/component điểm danh, đánh giá, giáo dục, cấu hình được kiểm bằng `git diff HEAD --exit-code`: không đổi. Nhánh nhập ở `cb653ec`.

Smoke ngoài repo trong workspace Codex: `work/summary-range-smoke.mjs` PASS khoảng dài, lượt tham gia ăn, scope và ngày lỗi; `work/merge-child-health-smoke.mjs` PASS list/profile trẻ, scope giáo viên, đợt khám/roster, health 403 và pickup board với storage giả cô lập. Lần thử đầu của smoke pickup dùng nhầm child.classId không có trong DTO rút gọn; sửa assertion đối chiếu childId với DB, không sửa source để chiều test. Chưa kiểm browser/API thật.

## Lesson

`-X ours` chỉ ưu tiên hunk xung đột, không kiểm tra tham chiếu giữa import, khai báo và JSX. Luôn verify trước khi commit merge.
