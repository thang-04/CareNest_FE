# Troubleshooting — CareNest_FE

Cách xử lý nhanh lỗi môi trường, build, dev server, kết nối BE local, deploy Web. Mỗi mục: triệu chứng (chuỗi lỗi nguyên văn) → nguyên nhân → cách xử lý → link `FE-ENV-YYMMDD-slug` nếu có incident.

> Chưa có mục nào (chưa có source). Thêm ngay khi gặp lỗi môi trường tốn >15 phút. Lỗi chạy BE local: `../CareNest_BE/docs/knowledge/TROUBLESHOOTING.md`.

## Format

```markdown
### <chuỗi lỗi hoặc triệu chứng ngắn>
- Nguyên nhân: ...
- Xử lý: lệnh/bước cụ thể
- Đã thử không hiệu quả: ...
- Incident: FE-ENV-YYMMDD-slug
```

### Màn hình trắng, console `ReferenceError: <TÊN> is not defined` dù source đã đúng và `verify` pass
- Nguyên nhân: sửa một file bằng nhiều lần ghi liên tiếp (script/codemod). Dev server Vite trên Windows nhận và cache bản trung gian (đã đổi import nhưng chưa đổi chỗ dùng); lần ghi sau không được biên dịch lại. React lỗi khi render ⇒ cả cây bị gỡ ⇒ trắng màn.
- Kiểm tra: `curl -s http://localhost:5173/src/<đường dẫn file> | grep <TÊN>` — còn thấy tên cũ ⇒ module cache cũ.
- Xử lý: ghi lại file (save lần nữa) hoặc khởi động lại `npm run dev`, rồi tải lại trang (F5). Khi sửa bằng script, ghi mỗi file **một lần** với nội dung cuối.
- Đã thử không hiệu quả: chỉ chạy `node scripts/verify.mjs` (build tĩnh không thấy cache của dev server).
- Incident: FE-ENV-261015-vite-stale-intermediate-module
