---
id: FE-BUG-261020-spinner-reduced-motion-loop
type: bug
screens: [ui-kit, weekly-menu]
be_modules: []
rules: []
status: fixed
date: 2026-10-20
keywords: [spinner, loading, giật, reduced-motion, infinite, animation-duration]
similar_to: [FE-BUG-261020-reduced-motion-visibility-focus]
---

# FE-BUG-261020-spinner-reduced-motion-loop — Ba chấm vẫn giật sau khi giãn chu kỳ

## Symptom

User báo "vẫn giật lắm" sau khi chu kỳ ba chấm đổi từ 1s sang 1.6s. User chỉ muốn chậm animation, không giữ loading thêm.

## Điều kiện tái hiện

Chrome bật `prefers-reduced-motion: reduce`, mở `/ui-kit` trên Vite local, đăng nhập tài khoản mock. Không dùng dữ liệu thật.

## Attempts — đã thử

| # | Cách thử | Kết quả | Bài học |
| --- | --- | --- | --- |
| 1 | Giãn chu kỳ 1s thành 1.6s, độ trễ 0.24s/0.48s | User vẫn thấy giật | Chưa kiểm style thực tế nên bỏ sót override |
| 2 | Đọc computed style trên 9 chấm ở `/ui-kit` | Cả 9: duration `1e-05s`, iteration `infinite`, name `spinner-hop`; reduced motion = true | Rule toàn cục ghi đè chu kỳ |
| 3 | Thêm media rule tắt animation-name của chấm | Cả 9 chấm: name `none`, transform `none`, opacity `0.7` | Tắt đúng animation, không chỉ kéo dài duration |
| 4 | User vẫn báo "3 chấm nháy, giật". Máy user: `SPI_GETCLIENTAREAANIMATION = false` ⇒ Chrome luôn ở chế độ giảm chuyển động. Đọc computed style mọi khung chờ | `.skeleton` còn `skeleton-breathe` 0.01ms vô hạn (nền nhấp nháy); `loading-reveal` 0.01ms ⇒ khung chờ tàng hình 300 ms rồi bật phụt; chấm đứng yên chỉ bật/tắt; `chip-halo`, `progress-stripe` cũng lặp 0.01ms | Lần 3 chỉ vá chấm, sót mọi animation vô hạn khác |

## Root cause

FE: `src/styles/base.css` ép animation-duration xuống 0.01ms bằng `!important` khi giảm chuyển động, nhưng `.spinner > i` trong `src/styles/components.css` vẫn lặp vô hạn. Computed style Chrome xác nhận chu kỳ thực tế là 0.01ms, không phải 1.6s. Không liên quan timeout hay contract BE.

## Fix

`src/styles/components.css`, chế độ giảm chuyển động (cùng nguyên tắc toast: không dịch chuyển, chỉ mờ):
- `.spinner > i` dùng `spinner-fade` (chỉ opacity) chu kỳ 1.6s, giữ độ trễ lệch từng chấm.
- `.skeleton` giữ nhịp thật `loading-reveal` 300 ms + `skeleton-breathe` 1.5s; `.state--loading`, `.spinner--deferred` fade vào 300 ms.
- `chip-halo`, `progress-stripe` (có dịch chuyển) ⇒ `animation-name: none`.
Phải dùng `animation-duration: … !important` vì rule toàn cục `base.css` cũng `!important`; không dùng shorthand `animation` vì sẽ xóa `animation-delay` từng chấm. Chế độ thường không đổi.

## Regression test

Chrome local mock `/ui-kit` (2026-10-20, lần 4), đọc computed style cả hai chế độ:
- Giảm chuyển động: chấm `spinner-fade 1.6s` delay 0/0.24/0.48s; skeleton `0.3s, 1.5s`; `.state--loading`/`.spinner--deferred` `0.3s`; halo/sọc `none`.
- Thường: chấm `spinner-hop 1.6s`; halo `1.8s`, sọc `1s` — không đổi.
- Trang chủ (giảm chuyển động): khung chờ gắn 1 lần ~198 ms, gỡ hết ~913 ms, không gắn/gỡ lặp; 2 long task 64/54 ms.
Không kiểm request BE thật.

## Ảnh hưởng

Mọi Spinner thường/nhỏ, gồm nút AI và lớp phủ gửi form. Không đổi thời gian request, không sửa BE/APP.

## Lesson

Khi sửa nhịp animation phải kiểm computed style và chế độ giảm chuyển động. Animation cực ngắn vẫn lặp vô hạn không tương đương tắt chuyển động. Thêm animation `infinite` mới ⇒ phải kèm rule giảm chuyển động (giữ nhịp nếu chỉ đổi độ mờ/màu, tắt nếu dịch chuyển). Máy dev Windows tắt Animation effects thì Chrome luôn ở chế độ giảm chuyển động.
