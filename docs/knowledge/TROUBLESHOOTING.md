# Troubleshooting — CareNest_FE

Cách xử lý nhanh lỗi môi trường, build, dev server, kết nối BE local, deploy Web. Mỗi mục: triệu chứng (chuỗi lỗi nguyên văn) → nguyên nhân → cách xử lý → link `FE-ENV-YYMMDD-slug` nếu có incident.

> Thêm ngay khi gặp lỗi môi trường tốn >15 phút. Lỗi chạy BE local: `../CareNest_BE/docs/knowledge/TROUBLESHOOTING.md`.

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

### Deploy VPS: `docker compose up --build` lỗi ở `RUN npm ci` — `getaddrinfo EAI_AGAIN registry.npmjs.org`
- Nguyên nhân: VPS chặn đường ra Internet của mạng Docker bridge (`docker run --rm node:22-alpine nslookup registry.npmjs.org` ⇒ `write to '8.8.8.8': Host is unreachable`); host và `--network host` thì ra được. Không phải lỗi code; cảnh báo `ERESOLVE overriding peer dependency` (vite 8 / plugin-react 4) không liên quan.
- Xử lý: `compose.yaml` › `build.network: host` (chỉ bước build cần Internet; container chạy: xem mục `Failed to Setup IP tables` bên dưới). Build tay: `docker build --network host -t carenest-web:latest .`
- Đã thử không hiệu quả: không có proxy (`systemctl show docker --property=Environment` rỗng), `/etc/resolv.conf` là `8.8.8.8` — đổi DNS không giúp vì cả đường ra bị chặn. Tránh sửa `/etc/docker/daemon.json` + restart docker khi máy chạy dịch vụ khác.

### Docker/CI: `npm ci` lỗi `ERESOLVE could not resolve` — `peer vite@"^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0" from @vitejs/plugin-react@4.7.0`
- Nguyên nhân: lockfile dùng `vite@8.3.3` + `@vitejs/plugin-react@4.7.0` (peer chỉ tới vite 7). npm 12 trên máy dev cho qua, npm 10 trong `node:22-alpine`/GitHub Actions Node 22 chặn.
- Xử lý: `npm ci --legacy-peer-deps` trong `Dockerfile` và `.github/workflows/deploy.yml` (cài đúng như máy dev, không đổi version). Gốc: nâng `@vitejs/plugin-react` lên 6.x (peer `vite ^8`) — đổi dependency, cần team duyệt.
- Đã thử không hiệu quả: —
- Máy dev Windows (npm 10.9.8) cũng chặn ⇒ cài bằng `npm ci --legacy-peer-deps`. Đang chạy `npm run dev` thì `npm ci` xóa gần hết `node_modules` rồi lỗi `EPERM ... unlink ... rolldown-binding.win32-x64-msvc.node` (vite giữ file) ⇒ cài bù bằng `npm install --legacy-peer-deps` (giữ file đang khóa), sau đó `git restore package-lock.json` vì diff chỉ bỏ trường `libc`; dev server đang chạy cần khởi động lại.

### Deploy VPS: `failed to create network carenest-fe_default: ... Failed to Setup IP tables ... DOCKER-FORWARD ... No chain/target/match by that name`
- Nguyên nhân: chain iptables của Docker trên VPS đã bị xoá (firewalld/k8s/script nạp lại iptables) ⇒ Docker không tạo được network bridge mới; cùng gốc với lỗi bridge không ra Internet ở trên.
- Xử lý: `compose.yaml` › `network_mode: host` + `NGINX_LISTEN: 127.0.0.1:18300` (nginx trong container nghe localhost, không đụng cổng 80/443 do Caddy host giữ, không cần iptables). Template `docker/nginx/default.conf.template`, mặc định `NGINX_LISTEN=80` cho chạy local.
- Đã thử không hiệu quả: —. Không tự `systemctl restart docker` trên server dùng chung (dừng mọi container; firewalld reload lại mất chain).
