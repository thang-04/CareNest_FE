# Deploy Web lên VPS (Docker + Caddy + GitHub Actions)

Luồng: push lên `main` (merge PR từ `release/*`; PR vào `main` chỉ chạy verify, commit chỉ sửa tài liệu không chạy) ⇒ `.github/workflows/deploy.yml` chạy `npm run verify` ⇒ rsync source lên `/data/thangnd/CAPSTONE/CareNest_FE` ⇒ VPS chạy `docker compose up -d --build` (build Vite trong Docker ngay trên VPS) ⇒ CI đồng bộ file site Caddy và reload nếu file đổi ⇒ Caddy trên host phục vụ `https://web.carenest.edu.vn`.

```
Trình duyệt ─HTTPS─▶ Caddy host (giữ 80/443 cho mọi site trên server, HTTPS tự động)
                       ├─ /      ─▶ 127.0.0.1:18300  container carenest-web (nginx:alpine + dist, mạng host)
                       └─ /api/  ─▶ 127.0.0.1:18310  BE (BE:compose.vps.yaml)
```

Thư mục trên VPS:

```
/data/thangnd/CAPSTONE/
├── CareNest_BE/              (để sau)
├── CareNest_FE/              source do CI rsync (Dockerfile, compose.yaml, src/, package.json…)
└── caddy/
    └── carenest-web.caddy    CI đồng bộ từ deploy/caddy/carenest-web.caddy; import từ /etc/caddy/Caddyfile
```

| File trong repo | Vai trò |
| --- | --- |
| `Dockerfile` | Build Vite (Node 22) rồi copy `dist` vào nginx:alpine |
| `docker/nginx/default.conf.template` | nginx trong container (cổng nghe = `NGINX_LISTEN`, VPS: `127.0.0.1:18300`): SPA fallback cho `BrowserRouter`, cache `/assets`, `index.html` no-cache |
| `compose.yaml` | Build (mạng host) + chạy container `carenest-web` bằng mạng host, nghe `127.0.0.1:18300` |
| `.dockerignore` | Loại file khỏi docker build và khỏi rsync lên VPS |
| `deploy/caddy/carenest-web.caddy` | Site Caddy cho subdomain; sửa ở repo, CI đẩy lên VPS (không sửa tay trên VPS — lần deploy sau sẽ ghi đè) |
| `.github/workflows/deploy.yml` | verify → rsync source → `docker compose up -d --build` qua SSH → đồng bộ site Caddy (reload khi đổi, lỗi ⇒ khôi phục file cũ) → kiểm HTTPS |

rsync dùng `--delete`: file trên VPS không còn trong repo sẽ bị xoá, trừ file khớp `.dockerignore` (vd. `.env` đặt tay). Không để dữ liệu khác trong `/data/thangnd/CAPSTONE/CareNest_FE`.

Vì sao mạng host: VPS mất chain iptables của Docker (bridge không ra Internet, không tạo được network mới); gốc ở tầng k8s của server, ngoài quyền nhóm ⇒ không sửa iptables, không restart Docker — xem `docs/knowledge/TROUBLESHOOTING.md`.

## Mạng host: quy tắc và bảng cổng

Mọi service CareNest trên VPS (FE, sau này BE, Keycloak, Postgres, AI) chạy `network_mode: host` và gọi nhau qua `127.0.0.1:<port>` (không có DNS theo tên service).

- **Chỉ bind `127.0.0.1`**, không `0.0.0.0`: firewalld/ufw trên VPS đang tắt ⇒ cổng bind ra ngoài là lộ thẳng Internet. Kiểm sau mỗi lần thêm service: `sudo ss -ltnp | grep <port>` chỉ thấy `127.0.0.1:<port>`.
- **Chọn cổng chưa dùng** (server chung): `sudo ss -ltnp | grep :<port>` rỗng rồi mới ghi vào bảng.
- Chỉ service cần truy cập từ trình duyệt/app mới có site Caddy; Postgres, AI không có.

| Service | Cổng `127.0.0.1` | Site Caddy |
| --- | --- | --- |
| `carenest-web` (FE) | 18300 | `web.carenest.edu.vn` |
| api (BE) | 18310 (`BE:compose.vps.yaml`, prefix `/api`; route `/api/*` trong site FE; 8080 của server là app khác) | dùng chung `web.carenest.edu.vn` |
| Keycloak, Postgres, AI | chưa chốt — điền khi deploy BE | Keycloak: file site riêng của repo BE |

## Chế độ build: mock hoặc BE thật

Mặc định (chưa đặt Variables) image build với `VITE_AUTH_MODE=mock`, `VITE_USE_MOCK=true`: đăng nhập bằng tài khoản demo trong `README.md`, dữ liệu mock lưu localStorage của trình duyệt. `VITE_*` nhúng vào bundle lúc build, đổi giá trị ⇒ chạy lại workflow.

Nối BE thật (BE chạy ở `127.0.0.1:18310`, đã bật gateway `CARENEST_AUTH_ENABLED=true` theo `BE:docs/system/DEPLOYMENT.md`): GitHub › Settings › Secrets and variables › Actions › **Variables** › đặt `VITE_AUTH_MODE=gateway`, `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=/api` (khớp `handle /api/*` của Caddy, cùng origin nên cookie phiên gateway path `/api/auth` dùng được), rồi chạy lại workflow. `gateway` đăng nhập qua `/api/auth/*` (`docs/integration/AUTH_FLOW.md`) và bật luôn các màn đã nối BE qua `beClient` (`SCHOOL_CONFIG_API` trong `src/config/env.js`). Kiểm tra: `curl -s https://web.carenest.edu.vn/api/auth/csrf` trả 200 `{code, desc, data}`. Phía BE: `CARENEST_AUTH_WEB_ORIGIN=https://web.carenest.edu.vn`.

## Cài một lần trên VPS

Server hiện tại (`k8selchat`): Caddy chạy bằng systemd (`/etc/caddy/Caddyfile`) giữ cổng 80/443 cho các site khác; SELinux `Disabled`. Không cài/bật nginx host, không certbot.

1. **DNS:** bản ghi A `web` của `carenest.edu.vn` trỏ IP VPS. Kiểm tra: `dig +short web.carenest.edu.vn` ra đúng IP **trước** khi thêm site vào Caddy (sai DNS ⇒ Caddy xin chứng chỉ thất bại và thử lại liên tục).
2. **Gói cần có:** `docker compose version` chạy được; `rsync` (`sudo dnf install -y rsync`).
3. **User `thangnd` (CI SSH bằng user này) dùng được Docker không cần sudo:**
   ```bash
   sudo usermod -aG docker thangnd   # đăng xuất/đăng nhập lại rồi thử: docker ps
   ```
4. **SSH key riêng cho CI** (trên máy cá nhân):
   ```bash
   ssh-keygen -t ed25519 -f carenest-deploy -C github-actions -N ""
   ```
   Dán nội dung `carenest-deploy.pub` vào cuối `/data/thangnd/.ssh/authorized_keys` trên VPS (home của `thangnd` là `/data/thangnd`; `.ssh` 700, file 600, chủ `thangnd`). Thử `ssh -i carenest-deploy thangnd@<IP>`.
   > User trong nhóm `docker` có quyền tương đương root: key này chỉ dùng cho CI, chỉ lưu trong GitHub Secrets.
5. **Lần chạy đầu** (upload tay/zip bằng root ⇒ trả quyền cho `thangnd`, nếu không rsync của CI sẽ lỗi `Permission denied`): `chown -R thangnd:thangnd /data/thangnd/CAPSTONE/CareNest_FE`. Container phải trả 200 trước khi nối Caddy:
   ```bash
   cd /data/thangnd/CAPSTONE/CareNest_FE && docker compose up -d --build
   curl -sI http://127.0.0.1:18300/ | head -1   # HTTP/1.1 200 OK
   ```
6. **Site Caddy** (root):
   ```bash
   mkdir -p /data/thangnd/CAPSTONE/caddy
   # dán nội dung deploy/caddy/carenest-web.caddy
   nano /data/thangnd/CAPSTONE/caddy/carenest-web.caddy
   cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%Y%m%d)
   printf '\nimport /data/thangnd/CAPSTONE/caddy/*.caddy\n' >> /etc/caddy/Caddyfile
   caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   systemctl reload caddy
   ```
   - Caddy chạy bằng user `caddy`, mà `/data/thangnd` là `drwx------` ⇒ cấp riêng quyền đi qua (không mở cho user khác, không cho liệt kê): `setfacl -m u:caddy:x /data/thangnd`. Kiểm tra: `sudo -u caddy cat /data/thangnd/CAPSTONE/caddy/carenest-web.caddy >/dev/null && echo READ_OK` (chạy **trước** `validate`/`reload`).
   - `validate` lỗi ⇒ không reload; khôi phục: `cp /etc/caddy/Caddyfile.bak-<ngày> /etc/caddy/Caddyfile`.
   - `reload` không làm gián đoạn các site khác đang chạy trên Caddy.
   - Caddyfile là cấu hình chung của server: hỏi người quản lý server trước khi sửa.
7. **Cho CI đồng bộ site Caddy** (root; người quản lý server đồng ý trước):
   ```bash
   chown thangnd /data/thangnd/CAPSTONE/caddy
   command -v systemctl   # dùng đúng đường dẫn này trong dòng sudoers
   echo 'thangnd ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy' > /etc/sudoers.d/carenest-caddy   # carenest:allow-secret (cờ sudoers, không phải mật khẩu)
   chmod 440 /etc/sudoers.d/carenest-caddy && visudo -c
   sudo -u thangnd sudo -n systemctl reload caddy && echo RELOAD_OK
   ```
   - Chỉ cho đúng lệnh reload. Thiếu bước này: CI fail ở bước `Apply Caddy site` khi file Caddy đổi (file cũ được giữ, site không ảnh hưởng); file không đổi thì CI bỏ qua reload.
   - File site của repo khác (vd. BE) nằm chung thư mục: CI FE chỉ ghi `carenest-web.caddy`, không xoá file khác.

## Cấu hình GitHub (repo CareNest_FE)

1. Settings › Secrets and variables › Actions › **Secrets**:
   - `VPS_HOST`: IP VPS
   - `VPS_PORT`: `22` (bắt buộc điền)
   - `VPS_USER`: `thangnd`
   - `VPS_SSH_KEY`: toàn bộ private key `carenest-deploy`, gồm dòng BEGIN/END
2. **Variables** (tuỳ chọn): `VITE_AUTH_MODE` (mặc định `mock`), `VITE_USE_MOCK` (mặc định `true`), `VITE_API_BASE_URL` (mặc định `/api`).
3. Settings › Environments › tạo `production` (có thể bật Required reviewers để duyệt trước mỗi lần deploy).

Thư mục deploy cố định trong workflow (`APP_DIR` trong `.github/workflows/deploy.yml`). Không cần GHCR/registry: image build ngay trên VPS (cần VPS ra được Internet qua mạng host để pull `node:22-alpine`, `nginx:alpine` và chạy `npm ci`). Workflow chạy khi push `main` (verify + deploy) và PR vào `main` (chỉ verify); commit chỉ sửa tài liệu bỏ qua (đổi 2026-10-31, trước đó chạy mỗi commit vào `dev` từ 2026-10-21). Environment `production` phải cho phép deploy từ `main`. Nút "Run workflow" chỉ hiện sau khi file workflow đã có trên nhánh mặc định của repo. Job `verify` fail (test/lint/format/build) ⇒ không deploy. CI chỉ ghi `/data/thangnd/CAPSTONE/caddy/carenest-web.caddy` (reload khi nội dung đổi); không sửa `/etc/caddy/Caddyfile`.

## Kiểm tra sau deploy

- Tab Actions: 2 job `verify`, `deploy` xanh (bước `Smoke test HTTPS` gọi `https://web.carenest.edu.vn/` từ runner).
- VPS: `sudo ss -ltnp | grep 18300` chỉ thấy `127.0.0.1:18300`.
- VPS: `cd /data/thangnd/CAPSTONE/CareNest_FE && docker compose ps` thấy `carenest-web` Up; `curl -I https://web.carenest.edu.vn` trả 200.
- Trình duyệt: F5 ở route con (vd. `/children`, `/login`) không 404.
- Lỗi HTTPS: `journalctl -u caddy -n 50 --no-pager | grep -i carenest`.

## Rollback

VPS chỉ giữ bản source mới nhất. Quay về bản cũ: GitHub › Actions › mở run của commit cũ › Re-run jobs (rsync source và file Caddy cũ rồi build lại), hoặc revert qua PR vào `main`.

Gỡ site: xoá dòng `import /data/thangnd/CAPSTONE/caddy/*.caddy` khỏi Caddyfile (hoặc khôi phục bản `.bak`), `caddy validate` rồi `systemctl reload caddy`.

## Chạy thử ở máy local

```bash
docker build -t carenest-web . && docker run --rm -p 3000:80 carenest-web   # mở http://localhost:3000
```
