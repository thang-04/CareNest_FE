---
id: FE-BUG-261012-auth-cookie-order
type: bug
screens: [auth/login, account/password]
be_modules: [identity-access]
rules: [AUTH-07]
status: fixed
date: 2026-10-12
keywords: [Set-Cookie, logout, generation, Web Locks, BroadcastChannel, restoreBlocked]
similar_to: []
---
# FE-BUG-261012-auth-cookie-order — Cookie login muộn vượt logout fence

## Symptom
Logout rồi response login pending đến muộn vẫn đặt cookie; memory generation từ chối token nhưng reload có thể restorecookie. Peer logout đến muộn hoặc failedlogin sauoffline logout cũng phải không mở lại restore cũ.

## Điều kiện tái hiện
Deferred Axios adapter mô phỏng browser áp Set-Cookie trước promise resolution; nhiều auth operations phối hợp như các tab. Toàn bộ fixture giả.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Memory generation fence | RED: finalcookie=new-cookie sau logout | JS fence không ngăn browser áp Set-Cookie |
| 2 | WebLocks đơn thuần | Review chỉ ra queuedlogin/lateBroadcast order | Không giả định BC đã giao trước lockhandoff |
| 3 | Sharedversion dướilock +ignoreoldpeer |38 tests pass | Metadata khôngcredential phối hợp queue |
| 4 | Intenttype login/password thaylogoutmarker sớm |2/40 RED failedrestore tests | Pending intent không đồng nghĩa verified session |
| 5 | Independent restoreBlocked chỉclear bởi successfullogin |40 tests pass + final static recheck no blocker | Offline logout không được fallback cookie cũ |

## Root cause
HTTP cookie mutations không theo memory lifecycle; BroadcastChannel delivery async; intent metadata từng được dùng nhầm làm committed restore disposition.

## Fix
src/services/http/authBoundary.js + authService.js: native same-origin lock, sharedversion/type/source/restoreBlocked, queuedintent invalidation, no unsafe fallback; context bỏ stale response/peer event.

## Regression test
tests/auth/service.test.mjs: delayedlogin-cookie+logout+reload, queuedlogin, stalepeerlogout, offline logout thenfailedlogin/reset. Đây là model test, không claim actualbrowsermultitab.

## Ảnh hưởng
Web client, không đổi BEcontract/MobilePKCE. Không deploy hoặc sửa dữ liệu thật.

## Lesson
Cookie ordering cần phối hợp HTTPlifecycle, không chỉ memory; proof/token không được đưa vào sharedmetadata.
