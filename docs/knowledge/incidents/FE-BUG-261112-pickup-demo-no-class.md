---
id: FE-BUG-261112-pickup-demo-no-class
type: bug
screens: [pickup]
be_modules: [attendance]
rules: [PCK-01]
status: fixed
date: 2026-11-12
keywords: [đón trẻ, pickup, chưa được phân công lớp, dữ liệu demo, tài khoản mẫu, demoActorOf, teacherIds]
similar_to: [FE-ENV-261108-education-real-auth-mock-data]
---

# FE-BUG-261112-pickup-demo-no-class — Đón trẻ trên dev luôn báo "Bạn chưa được phân công lớp"

## Symptom

Bản dev (`dev.carenest.edu.vn/pickup`), giáo viên/tổ trưởng đã được phân công lớp, đăng nhập qua BE. Màn hiện dải vàng "Dữ liệu demo … Đang xem bằng tài khoản mẫu: Trần Thu Hà" và:

```text
Bạn chưa được phân công lớp — Chỉ giáo viên của lớp trả trẻ cho người đón.
```

## Điều kiện tái hiện

Build nối BE (`VITE_USE_MOCK=false`), module `pickup` và `school-lookup` là `demo` trong `src/config/integrationModules.js`; đăng nhập bằng tài khoản giáo viên thật của BE.

## Attempts — đã thử

| #   | Cách thử                                              | Kết quả    | Vì sao không đúng / bài học                                                                             |
| --- | ----------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Xem như thiếu quyền đón trẻ trên BE                   | Sai        | BE dev cấp sẵn `PICKUP_RECORD` cho GV/tổ trưởng (V114); lỗi nằm ở FE                                    |
| 2   | Lọc bằng `demoActorOf(user)` trong hook               | Không chọn | Vẫn là dữ liệu mẫu; user cần đón trẻ thật trước khi làm App                                             |
| 3   | Lấy lớp từ `GET /attendance/classes` (cờ `canRecord`) | Không chọn | Cờ theo `ATTENDANCE_RECORD`, lệch quyền `PICKUP_RECORD`; App cũng sẽ phải dùng ⇒ BE thêm endpoint riêng |

## Root cause

FE. `usePickupClasses` lấy lớp từ `school-lookup` (demo ⇒ mock chạy bằng tài khoản mẫu cùng vai trò qua `demoActorOf`), rồi lọc `canHandOverChildren(c, user)` bằng **user BE thật**. `teacherIds` của lớp mẫu chỉ chứa id mẫu (`u_ha`…) nên không bao giờ khớp id BE ⇒ danh sách rỗng. Bằng chứng: bundle dev `pickupService-BRiQ05a4.js` có `(e.teacherIds||[]).includes(t.id)` và `pickup:{source:'demo'}`.

## Fix

- BE: `GET /pickups/classes` (`PickupController#listClasses`) — lớp năm đang hoạt động, quyền `PICKUP_RECORD`, GV đang phân công.
- FE: `pickup` → `api`; `createPickupApi(beClient)` gồm `getPickupClasses` (beClient đổi id số ↔ chuỗi; adapter đổi mã quan hệ → chữ, chỉ gửi field BE nhận); mock có `getPickupClasses` cùng shape; hook đọc lớp qua facade, không lọc theo role/teacherIds.
- FE: bỏ form cũ `/pickup/result?childId&verification` (nhập người đón tự do, `PHONE_UNREACHABLE` — BE không nhận; bị bỏ từ 2026-10-24 nhưng chưa dọn); link cũ chuyển về danh sách Đón trẻ và mở modal tương ứng.

## Regression test

`tests/hardening/pickup-api-be.test.mjs` (adapter + mock danh sách lớp); BE `PickupIntegrationTest#listsOnlyClassesTheTeacherHandsOverToday`.

## Ảnh hưởng

Chỉ 3 màn `/pickup`. App (màn đón trẻ của GV) dùng cùng `GET /pickups/classes`.

## Lesson

Màn demo dùng tài khoản mẫu (`demoActorOf`) thì mọi phép so `user.id` với dữ liệu mẫu ở tầng UI/hook đều sai; lọc phạm vi phải nằm trong repo (mock hoặc BE), không ở hook.
