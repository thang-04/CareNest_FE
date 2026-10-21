# Deploy Web lên VPS (Docker + Caddy + GitHub Actions)

Luồng: merge vào `main` ⇒ `.github/workflows/deploy.yml` chạy `npm run verify` ⇒ rsync source lên `/data/thangnd/CAPSTONE/CareNest_FE` ⇒ VPS chạy `docker compose up -d --build` (build Vite trong Docker ngay trên VPS) ⇒ Caddy trên host phục vụ `https://web.carenest.edu.vn`.

```
Trình duyệt ─HTTPS─▶ Caddy host (giữ 80/443 cho mọi site trên server, HTTPS tự động)
                       ├─ /      ─▶ 127.0.0.1:18300  container carenest-web (nginx:alpine + dist, mạng host)
                       └─ /api/  ─▶ 127.0.0.1:8080   BE (chưa deploy)
```

Thư mục trên VPS:

```
/data/thangnd/CAPSTONE/
├── CareNest_BE/              (để sau)
├── CareNest_FE/              source do CI rsync (Dockerfile, compose.yaml, src/, package.json…)
└── caddy/
    └── carenest-web.caddy    đặt tay từ deploy/caddy/carenest-web.caddy; import từ /etc/caddy/Caddyfile
```

| File trong repo | Vai trò |
| --- | --- |
| `Dockerfile` | Build Vite (Node 22) rồi copy `dist` vào nginx:alpine |
| `docker/nginx/default.conf.template` | nginx trong container (cổng nghe = `NGINX_LISTEN`, VPS: `127.0.0.1:18300`): SPA fallback cho `BrowserRouter`, cache `/assets`, `index.html` no-cache |
| `compose.yaml` | Build (mạng host) + chạy container `carenest-web` bằng mạng host, nghe `127.0.0.1:18300` |
| `.dockerignore` | Loại file khỏi docker build và khỏi rsync lên VPS |
| `deploy/caddy/carenest-web.caddy` | Mẫu site Caddy cho subdomain |
| `.github/workflows/deploy.yml` | verify → rsync source → `docker compose up -d --build` qua SSH |

rsync dùng `--delete`: file trên VPS không còn trong repo sẽ bị xoá, trừ file khớp `.dockerignore` (vd. `.env` đặt tay). Không để dữ liệu khác trong `/data/thangnd/CAPSTONE/CareNest_FE`.

Vì sao mạng host: VPS mất chain iptables của Docker (bridge không ra Internet, không tạo được network mới) — xem `docs/knowledge/TROUBLESHOOTING.md`.

## Chế độ build hiện tại: mock

BE chưa deploy nên image build với `VITE_USE_MOCK=true` (dữ liệu mock lưu localStorage của trình duyệt, đăng nhập bằng tài khoản demo trong `README.md`). `VITE_*` nhúng vào bundle lúc build, đổi giá trị ⇒ build lại.

Khi BE đã chạy trên VPS ở `127.0.0.1:8080`: GitHub › Settings › Secrets and variables › Actions › **Variables** › thêm `VITE_USE_MOCK=false`, rồi chạy lại workflow. Phía BE cần đặt `CARENEST_AUTH_WEB_ORIGIN=https://web.carenest.edu.vn` và `CARENEST_CORS_ALLOWED_ORIGINS=https://web.carenest.edu.vn` (`BE:src/main/resources/application.yml`).

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

## Cấu hình GitHub (repo CareNest_FE)

1. Settings › Secrets and variables › Actions › **Secrets**:
   - `VPS_HOST`: IP VPS
   - `VPS_PORT`: `22` (bắt buộc điền)
   - `VPS_USER`: `thangnd`
   - `VPS_SSH_KEY`: toàn bộ private key `carenest-deploy`, gồm dòng BEGIN/END
2. **Variables** (tuỳ chọn): `VITE_USE_MOCK` (mặc định `true`), `VITE_API_BASE_URL` (mặc định `/api`).
3. Settings › Environments › tạo `production` (có thể bật Required reviewers để duyệt trước mỗi lần deploy).

Thư mục deploy cố định trong workflow (`APP_DIR` trong `.github/workflows/deploy.yml`). Không cần GHCR/registry: image build ngay trên VPS (cần VPS ra được Internet qua mạng host để pull `node:22-alpine`, `nginx:alpine` và chạy `npm ci`). Workflow chạy khi có commit vào `main` (theo quy tắc nhánh: chỉ `release/*` merge vào `main`). Nút "Run workflow" chỉ hiện sau khi file workflow đã có trên `main`. Job `verify` fail (test/lint/format/build) ⇒ không deploy. CI không đụng `/data/thangnd/CAPSTONE/caddy/` và Caddyfile.

## Kiểm tra sau deploy

- Tab Actions: 2 job `verify`, `deploy` xanh.
- VPS: `cd /data/thangnd/CAPSTONE/CareNest_FE && docker compose ps` thấy `carenest-web` Up; `curl -I https://web.carenest.edu.vn` trả 200.
- Trình duyệt: F5 ở route con (vd. `/children`, `/login`) không 404.
- Lỗi HTTPS: `journalctl -u caddy -n 50 --no-pager | grep -i carenest`.

## Rollback

VPS chỉ giữ bản source mới nhất. Quay về bản cũ: GitHub › Actions › mở run của commit cũ › Re-run jobs (rsync source cũ rồi build lại), hoặc revert commit trên `main`.

Gỡ site: xoá dòng `import /data/thangnd/CAPSTONE/caddy/*.caddy` khỏi Caddyfile (hoặc khôi phục bản `.bak`), `caddy validate` rồi `systemctl reload caddy`.

## Chạy thử ở máy local

```bash
docker build -t carenest-web . && docker run --rm -p 3000:80 carenest-web   # mở http://localhost:3000
```
