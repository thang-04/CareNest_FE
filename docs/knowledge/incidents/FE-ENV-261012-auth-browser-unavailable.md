---
id: FE-ENV-261012-auth-browser-unavailable
type: env
screens: [auth/login, account/password]
be_modules: [identity-access]
rules: []
status: open
date: 2026-10-12
keywords: [Browser is not available, iab, chrome, CUA, UI verification]
similar_to: []
---
# FE-ENV-261012-auth-browser-unavailable — Chưa có browser để quan sát UI

## Symptom
CUA inventory apps/browsers rỗng; mở iab và chrome đều báo Browser is not available.

## Attempts
| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | CUA getState | apps=[], browsers=[] | Không có surfaceenabled |
| 2 | createBrowserTab iab | unavailable | Không phải lỗi trang React |
| 3 | createBrowserTab chrome | unavailable | Cần kết nối browser từ ứng dụng |
| 4 | Node/API verification |40 tests +9 real HTTP smokes pass | Không thay thế UI/keyboard/viewport observations |

## Root cause
Surface trình duyệt chưa khả dụng trong phiên công cụ. Chưa xác định cấu hình client của user; không tự sửa browser/OS settings.

## Fix
Pending: kết nối browser rồi chạy UI checks. User đã được hỏi async; chưa có câu trả lời ở thời điểm ghi.

## Regression test
Login/first-login/OTP/reset/change-password, reload, two tabs, keyboard và narrow viewport; chỉ dùng fixtureisolated khibrowserenabled.

## Ảnh hưởng
Source/build/authAPI kiểm được; visual và realbrowsermultitab gate chưa xong.
