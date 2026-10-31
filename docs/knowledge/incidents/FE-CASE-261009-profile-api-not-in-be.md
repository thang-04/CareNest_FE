---
id: FE-CASE-261009-profile-api-not-in-be
type: case
screens: [account/profile]
be_modules: [identity-access]
rules: []
status: workaround
date: 2026-10-09
keywords: [hồ sơ cá nhân, ProfilePage, /me/profile, /accounts/me, MyAccountResponse, assignments, username, contract]
similar_to: []
---

# FE-CASE-261009-profile-api-not-in-be — Màn Hồ sơ cá nhân gọi API BE chưa có

## Symptom

`accountApi.getProfile` gọi `GET /me/profile` và `updateProfile` sửa SĐT, ngày sinh, giới tính, địa chỉ. BE (bản local 2026-10-09) không có endpoint này; chỉ có `GET /accounts/me` (`MyAccountResponse`: userId, username, fullName, email, roles, assignments, childIds). Màn chỉ chạy được với mock (`VITE_USE_MOCK=true`).

## Điều kiện tái hiện

`VITE_USE_MOCK=false`, mở `/account/profile` ⇒ 404 từ `/me/profile`.

## Attempts

| #   | Cách thử                                                                                             | Kết quả                                                                                                             | Bài học                                                       |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Grep BE `me/profile`, đọc `AccountController`, `MyAccountResponse`, `StaffAssignmentSummaryResponse` | Không có endpoint hồ sơ; `assignments` chỉ gồm phân công còn hiệu lực, trả id (campusId, classroomId) không trả tên | Không hiển thị "lịch sử phân công" vì BE không có dữ liệu này |

## Root cause

FE dựng màn theo SRS 1.5 trước khi BE có API hồ sơ; BE chưa có trường SĐT/ngày sinh/giới tính/địa chỉ cho tài khoản nhân sự.

## Fix

Phase3 workaround2026-10-12: auth gateway đọc GET /accounts/me và map actualrole/assignment, không inferfield thiếu; UI read-only, không gọi PATCH chưa có. Extra profilefields vẫn chưa có API. Đề xuất còn lại với BE: (a) thêm API đọc/sửa hồ sơ nhân sự, hoặc (b) FE đọc `GET /accounts/me` và tra tên điểm trường/lớp từ id. Mock đã trả `assignments` cùng dạng `StaffAssignmentSummaryResponse` (staffRole theo enum BE) kèm tên để hiển thị. Đề xuất ghi `BE:docs/knowledge/CROSS_MODULE_ISSUES.md` khi user cho phép sửa repo BE.

## Regression test

Khi nối API thật: `/account/profile` hiện tên, email, vai trò, phân công đang hiệu lực với ngày bắt đầu/kết thúc; trường BE chưa có hiện "Chưa cập nhật".

## Phase 3 follow-up 2026-10-12

FE đọc `GET /accounts/me` cho auth thật, ánh xạ role/phân công từ BE và giữ form hồ sơ ở chế độ chỉ đọc. Không gọi endpoint sửa hồ sơ chưa có. Dữ liệu SĐT/ngày sinh/địa chỉ vẫn chờ contract BE, nên incident ở trạng thái workaround, chưa đóng.
