---
id: FE-BUG-261012-password-session-expiry
type: bug
screens: [account/password]
be_modules: [identity-access]
rules: [AUTH-07]
status: fixed
date: 2026-10-12
keywords: [currentPassword, refresh401, sessionExpired, skipAuthRefresh]
similar_to: []
---
# FE-BUG-261012-password-session-expiry — Hết phiên bị coi là sai mật khẩu

## Symptom
Pre-refresh401 khi đổi mật khẩu bị form hiển thị currentPassword sai dù PUT /me/password chưa gửi.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | skipAuthRefresh choPUT, raw pre-refresh | RED: sessionExpired undefined, unauthorized khôngphát | Cần phân biệt bước bị401 |
| 2 | Markpreflight401+UNAUTHORIZED_EVENT/endLocal; PUT401 giữfielderror | Regression pass trong40 auth tests | Không retry credentials cũ để logout nhầm |

## Root cause
Auth transport401 khôngphát business unauthorized event; form từng map mọi401 thànhfielderror.

## Fix
accountApi.changePassword bắt preflight401, gắn sessionExpired, cập nhật logoutmetadata rồi kết thúc local phiên; form chỉ map PUT401 thiếuflag sangcurrentPassword error.

## Regression test
tests/auth/service.test.mjs: pre-refresh401 không PUT, eventphát; wrong-current PUT401 khôngexpire/retry.

## Ảnh hưởng
Chỉ Web password UX; không đổi DTO/API/status BE.

## Lesson
Giữ machine-readable stage marker trongclienterror, không parse desc.
