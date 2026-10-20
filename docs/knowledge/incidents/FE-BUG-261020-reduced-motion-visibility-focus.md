---
id: FE-BUG-261020-reduced-motion-visibility-focus
type: bug
screens: [row-menu, popover]
be_modules: []
rules: []
status: fixed
date: 2026-10-20
keywords: [focus, visibility hidden, prefers-reduced-motion, transition 0.01ms, RowMenu, portal, popover, activeElement body]
similar_to: []
---

# FE-BUG-261020-reduced-motion-visibility-focus — Mở menu "…" nhưng focus không vào mục đầu

## Symptom

`RowMenu` đã mở (panel hiện), nhưng `focus()` gọi trong layout effect không có tác dụng: `document.activeElement` vẫn là `body`, không phát sinh sự kiện `focusin`. Có lúc panel còn nằm kẹt ở `top: -9999px`.

```text
{ pvis: "hidden", vis: "hidden", inline: "visible", eq: false }   // computed visibility vẫn hidden ngay sau khi gán inline visible
```

## Điều kiện tái hiện

Bật giảm chuyển động (hoặc môi trường giả lập bật sẵn), mở menu "…" ở `/children`. Panel ban đầu đặt `visibility: hidden`, layout effect gán `visible` rồi gọi `focus()`.

## Attempts — đã thử

| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `useEffect([open, pos])` focus sau khi set state vị trí | Vẫn `body` | Không do thứ tự effect |
| 2 | Focus trong `requestAnimationFrame` | Vẫn `body` | Pane nền không chạy khung hình; không phải gốc lỗi |
| 3 | Gán style thẳng DOM rồi focus trong layout effect | Vẫn `body` | Computed visibility vẫn `hidden` |
| 4 | Đo `getComputedStyle`: inline `visible`, computed `hidden` | Ra nguyên nhân | Có transition trên `visibility` |
| 5 | Panel ban đầu đặt ngoài màn (`top: -9999`), không dùng `visibility`; `.row-menu__panel { transition-property: none }`; `focus({ preventScroll: true })` | Đạt | — |

## Root cause

`src/styles/base.css` có rule cho `prefers-reduced-motion: reduce`, áp cho mọi phần tử (trừ `.toast__timer`): `transition-duration: 0.01ms !important`. Vì `transition-property` mặc định là `all`, việc đổi `visibility` (và cả `top`/`right`) trở thành một transition. Ngay tại thời điểm gọi `focus()`, phần tử vẫn đang "hidden" nên không nhận focus. Trên trang không vẽ khung hình (pane nền), transition còn không chạy tiếp, nên vị trí đứng yên ở giá trị ban đầu.

## Fix

`src/components/ui/RowMenu.jsx`:
- Panel render qua portal; style ban đầu là hằng `OFFSCREEN = { top: -9999, right: 0 }`.
- `place()` gán `top`/`right` trực tiếp lên DOM trong `useLayoutEffect`, sau đó `focus({ preventScroll: true })`.
- Khi cuộn hoặc đổi kích thước thì gọi lại `place()` thay vì đóng menu.

`components.css`: `.row-menu__panel { transition-property: none }`.

## Regression test

Chưa có test tự động. Kiểm tay trên browser ở 360px: Enter mở menu thì `activeElement` là mục đầu (`role=menuitem`); Esc đóng menu và trả focus về nút.

## Ảnh hưởng

Mọi popover/menu khác dùng `visibility: hidden` rồi focus ngay (vd. menu tự viết). Không liên quan BE.

## Lesson

Đừng dùng `visibility`/`opacity` để ẩn phần tử cần focus ngay sau khi hiện. Rule giảm chuyển động toàn cục biến mọi thuộc tính thành transition. Phần tử định vị bằng JS thì đặt `transition-property: none`.
