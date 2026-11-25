---
id: FE-BUG-261119-mock-quota-fresh-profile
type: bug
screens: [children-health-declaration]
be_modules: []
rules: []
status: open
date: 2026-11-19
keywords: [dữ liệu mẫu, mock, localStorage, quota, 507, Bộ nhớ trình duyệt đã đầy, playwright]
similar_to: [FE-BUG-261023-pickup-seed-quota, FE-BUG-261019-assessment-seed-quota]
---

# FE-BUG-261119-mock-quota-fresh-profile — Chế độ mock: màn Khai báo sức khỏe báo hết bộ nhớ ngay sau khi xóa dữ liệu demo

## Symptom
Mock mode (`VITE_USE_MOCK=true`), trình duyệt kiểm thử Playwright MCP. Đăng nhập Hiệu trưởng demo, vào trang chủ rồi mở `/children/ch_009/health-declaration`. Màn hiện lỗi thay cho nội dung:
```text
Không tải được dữ liệu
Bộ nhớ trình duyệt đã đầy. Hãy dùng ảnh nhỏ hơn hoặc reset dữ liệu demo.
```
Lỗi do `persist()` trong `src/mocks/mockDatabase.js` gặp lỗi khi `localStorage.setItem` và ném `ApiError(507)`. Console không có lỗi khác.

## Điều kiện tái hiện
Vite mock ở cổng riêng: `VITE_USE_MOCK=true VITE_SCHOOL_CONFIG_API=false VITE_AUTH_MODE=mock npx vite --port 5190 --strictPort`. Trình duyệt Chromium. `localStorage.clear()`, đăng nhập `hung.pham@carenest.edu.vn`, mở trang chủ, rồi mở màn Khai báo sức khỏe của trẻ mẫu `ch_009`.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `localStorage.clear()` + `sessionStorage.clear()`, đăng nhập lại | Vẫn 507 ở cùng màn | Không phải dữ liệu cũ tích lại: một phiên mới cũng vượt hạn mức |
| 2 | Đo `JSON.stringify(buildSeedDatabase())` bằng node | 227.988 ký tự (`children` 154.308) | Seed gốc nhỏ. Phần lớn dữ liệu do repository khác sinh khi trang chủ tải (nghi điểm danh, đánh giá, bếp), chưa đo |
| 3 | Kiểm UI: `page.addInitScript` bọc `Storage.prototype.setItem` bằng try/catch | Màn tải được, dữ liệu giữ trong bộ nhớ trang | Chỉ là cách chạy kiểm thử, không phải fix |

## Root cause
Chưa rõ. Giả thuyết: các mock repository tự sinh dữ liệu mẫu khi trang chủ tải lần đầu và ghi vào cùng khóa `carenest.mockdb.v3`. Sau đó tổng dung lượng vượt hạn mức localStorage, nên lần ghi kế tiếp (màn Khai báo sức khỏe) lỗi. Cùng loại với hai incident `similar_to`, nhưng khóa gây vượt lần này chưa xác định.

## Fix
Chưa có.

## Regression test
Chưa có.

## Ảnh hưởng
Chỉ chế độ mock (demo, ảnh chụp kiểm UI). API thật không bị.

## Lesson
Mỗi lần thêm seed sinh lúc chạy, đo tổng `carenest.mockdb.v3` sau khi tải trang chủ trên hồ sơ trình duyệt mới.
