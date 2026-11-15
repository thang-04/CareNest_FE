## Task Jira

- <mã-jira>: <link>

## Thay đổi

-

## Tác động

<!-- Bắt buộc khi PR chạm vùng dùng chung (guard.sharedGlobs trong .claude/hooks/harness.config.json) hoặc module của người khác.
     Dán phần chính của: node scripts/ai-layer/impact.mjs <file> -->

- Vùng dùng chung / module người khác: không | có —
- Màn hình/route/role bị ảnh hưởng, luồng người dùng đổi thế nào:
- Người phụ trách phần bị ảnh hưởng đã xem:

## Kiểm thử

- Lệnh + kết quả thật (chưa chạy ⇒ ghi rõ): `node scripts/verify.mjs` →

## Checklist giao diện (PR có sửa màn hình — docs/design/UI_CARD.md)

- [ ] Dùng component nền (`ListPage`, `DataTable`, `Button`, `TextField`…); không viết tay `<button>/<table>/<input>`.
- [ ] Chỉ token; CSS module không đè `.btn/.card/.table/.modal`, không import CSS module khác.
- [ ] Đủ đang tải / trống / lỗi / 403 / 404; nút gửi khóa khi đang gửi; có hộp xác nhận cho thao tác không hoàn tác.
- [ ] Đã mở màn ở 360, 768, 1440px; dùng được bằng bàn phím.
- [ ] Component chung mới có trong `/ui-kit` và bảng UI_CARD §1.
