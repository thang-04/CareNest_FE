---
title: Deploy Web lên VPS bằng Docker + GitHub Actions
status: in-progress
owner: thangnd
jira: G94-215
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-19
updated: 2026-10-21
---
# Deploy Web lên VPS bằng Docker + GitHub Actions

## Context
FE chưa có CI/CD, Dockerfile hay cấu hình nginx. Cần deploy FE lên VPS qua subdomain có SSL. `VITE_*` nhúng lúc build (`src/config/env.js:1-3`); `BrowserRouter` (`src/App.jsx:10`) cần SPA fallback. BE chưa deploy.

Bổ sung 2026-10-21: sắp deploy thêm BE + Keycloak + module AI trên cùng VPS. `BE:compose.yaml:70,78,82` gọi `postgres`/`keycloak` theo tên service (cần mạng bridge) và publish cổng ra `0.0.0.0` (`:10-11,49-50,86-87`), trong khi VPS mất chain iptables Docker (`docs/knowledge/TROUBLESHOOTING.md:34-37`) nên FE đang chạy mạng host (`compose.yaml:10,20`). File Caddy trên VPS đặt tay, CI không đụng (`docs/integration/DEPLOYMENT.md:86`) ⇒ bản trong repo và bản trên VPS có thể lệch.

## Quyết định đã chốt
1. GitHub Actions verify, rsync source lên VPS, VPS tự build Docker (`docker compose up -d --build`), không dùng GHCR — user, 2026-10-19 (đổi từ phương án GHCR cùng ngày).
2. ~~Chỉ deploy từ `main`~~ ⇒ deploy khi push `dev` (+ chạy tay), khớp `.github/workflows/deploy.yml:5` — user, 2026-10-21 (đổi từ `main`).
3. `/api` proxy cùng subdomain sang BE `127.0.0.1:8080` — user, 2026-10-19.
4. Domain `carenest.edu.vn`; subdomain `web.carenest.edu.vn` (đề xuất, đổi được) — user, 2026-10-19.
5. Chỉ deploy FE, BE chưa lên ⇒ build `VITE_USE_MOCK=true`; BE lên ⇒ repo variable `VITE_USE_MOCK=false` — user, 2026-10-19.
6. VPS: FE ở `/data/thangnd/CAPSTONE/CareNest_FE` (compose). Server đã có Caddy giữ 80/443 cho site khác ⇒ dùng Caddy thay nginx host + certbot; site file ở `/data/thangnd/CAPSTONE/caddy/`, import từ `/etc/caddy/Caddyfile` — user chọn thư mục riêng, đổi sang Caddy do cổng bị chiếm, 2026-10-19.
7. Cổng vào duy nhất là Caddy host; không thêm gateway trong Docker (Traefik/caddy-docker-proxy). Server dùng chung, site khác không phải của nhóm ⇒ không chiếm được 80/443 — user duyệt thiết kế, 2026-10-21.
8. Chuyển container sang mạng bridge, chỉ publish `127.0.0.1:<port>` cho service public (web, api, keycloak); postgres/AI không publish, gọi nhau theo tên service trong compose BE — user duyệt, 2026-10-21. Điều kiện: Phase 2a tìm được và xử lý được nguyên nhân mất chain; không được ⇒ giữ mạng host. **Kết quả gate 2026-10-21: không xử lý được (kubelet crash-loop, bảng iptables không đọc được) ⇒ giữ mạng host cho mọi service; mỗi service tự bind `127.0.0.1:<port>`, gọi nhau qua `127.0.0.1`.**
9. Mỗi repo sở hữu file site Caddy của mình (FE: `web.carenest.edu.vn` gồm `/api`; BE: `auth.carenest.edu.vn`); CI FE đồng bộ file FE lên VPS và reload Caddy qua sudoers chỉ cho đúng lệnh reload — user duyệt, 2026-10-21.

## Làm rõ nghiệp vụ
Không đổi nghiệp vụ hay giao diện; chỉ hạ tầng build/deploy.

### Câu hỏi mở
- [x] Subdomain: dùng `web.carenest.edu.vn` đến khi user đổi.

## Acceptance criteria
- **AC-1:** Given commit vào `main`, When workflow chạy, Then verify → rsync source → VPS build → container `carenest-web` chạy trên VPS.
- **AC-2:** Given trình duyệt mở `https://web.carenest.edu.vn/<route con>`, When F5, Then không 404.
- **AC-3:** Given container chạy mạng host, When `sudo ss -ltnp` trên VPS, Then cổng CareNest (18300, sau này api/keycloak/postgres/AI) chỉ xuất hiện ở `127.0.0.1`, không ở `0.0.0.0`/`*` (firewalld/ufw inactive ⇒ bind ngoài là lộ ra Internet).
- **AC-4:** Given `deploy/caddy/carenest-web.caddy` đổi trong commit, When CI deploy, Then file trên VPS khớp repo và Caddy reload; file lỗi ⇒ CI fail, file cũ được khôi phục, site khác vẫn chạy.
- ~~**AC-5:** network bridge tạo được sau restart Docker~~ — bỏ, gate 2a chọn giữ mạng host (2026-10-21).

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Reverse proxy | Caddy host định tuyến thẳng tới `127.0.0.1:<port>` | Gateway Docker sau Caddy; gateway Docker giữ 80/443 | 2–3 host public, AI chỉ nội bộ ⇒ tầng thứ 2 không bớt việc; giữ 80/443 phải chuyển site của người khác |
| Mạng container | Mạng host, mọi service bind `127.0.0.1:<port>` (gate 2a, 2026-10-21) | Bridge + publish `127.0.0.1:` (ý định ban đầu) | Bridge cần iptables, VPS hỏng do kubelet; sửa iptables/restart Docker có thể làm dockerd không lên lại trên server chung |
| Phục vụ file tĩnh | Giữ container nginx | Caddy host `file_server` thẳng `dist` | Giữ image tái lập được, cùng cách deploy với BE |
| Cấu hình Caddy | CI đồng bộ file của repo + reload | Đặt tay | Bỏ lệch repo/VPS; reload Caddy từ chối cấu hình lỗi |

## Phases
### Phase 1 — Dockerfile, nginx, workflow, tài liệu
- Files: C `Dockerfile` · C `.dockerignore` · C `docker/nginx/default.conf.template` · C `.github/workflows/deploy.yml` · C `deploy/caddy/carenest-web.caddy` · C `compose.yaml` · C `docs/integration/DEPLOYMENT.md` · M `docs/INDEX.md` · M `README.md`
- Tests: AC-2 → `docker build` + `docker run` local, F5 route con; AC-1 → chạy workflow trên GitHub sau khi user cấu hình secrets
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`

### Phase 2a — Chẩn đoán mạng Docker trên VPS (draft, chờ user duyệt)
- Files: không sửa repo; ghi kết quả vào Progress log + `docs/knowledge/TROUBLESHOOTING.md`.
- Steps (user chạy trên VPS, chỉ đọc):
  1. `docker version --format '{{.Server.Version}}'`; `cat /etc/docker/daemon.json` (tìm `"iptables": false`, `"live-restore"`).
  2. `systemctl is-active firewalld ufw k3s kubelet`; `sudo iptables -V` (nft hay legacy); `sudo iptables -t filter -L DOCKER-FORWARD -n | head`; `sudo iptables -t nat -L DOCKER -n | head`.
  3. `docker network create carenest-probe && docker network rm carenest-probe`.
- Gate (user quyết sau khi xem kết quả):
  - Nguyên nhân là firewalld reload / chạy tay ⇒ sang 2b.
  - kube-proxy/k3s hoặc script ngoài nhóm ghi đè iptables định kỳ ⇒ dừng, giữ mạng host; BE deploy theo mạng host (`127.0.0.1:<port>` thay tên service) — ghi lại quyết định.
- **Dừng chờ user review.**

### Phase 2b — Giữ mạng host, CI đồng bộ Caddy, quy tắc cổng (draft, chờ user duyệt)
Gate 2a (2026-10-21) ⇒ không chuyển bridge; `compose.yaml`, `Dockerfile`, file Caddy giữ nguyên.
- Điều kiện trước: người quản lý server đồng ý thêm sudoers.
- Files: M `.github/workflows/deploy.yml` · M `docs/integration/DEPLOYMENT.md`
- Steps:
  1. VPS (root, một lần): `chown thangnd /data/thangnd/CAPSTONE/caddy`; sudoers `thangnd ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy` (đường dẫn theo `command -v systemctl`), `visudo -c`. <!-- carenest:allow-secret (cờ sudoers NOPASSWD, không phải mật khẩu) -->
  2. `deploy.yml`: sau bước build, chỉ khi file Caddy khác bản trên VPS (`cmp`): giữ bản cũ `.bak` ⇒ ghi file mới ⇒ `sudo -n systemctl reload caddy`; reload lỗi ⇒ khôi phục `.bak`, reload lại, `exit 1`. Không dùng `rsync --delete` cho thư mục `caddy/` (file `.caddy` của BE nằm chung). Thêm smoke `curl -fsSI https://web.carenest.edu.vn/`.
  3. `DEPLOYMENT.md`: nhánh `dev` (thay `main`); CI quản file Caddy + bước sudoers; mục **Bảng cổng** (18300 web; api/keycloak/postgres/AI điền khi BE chốt, kiểm trống bằng `sudo ss -ltnp` vì server chung); quy tắc mạng host: mọi service bind `127.0.0.1`, không `0.0.0.0` (firewalld/ufw inactive).
- Đề xuất cho BE (không sửa `CareNest_BE` khi chưa được cho phép): compose server riêng, mọi service `network_mode: host` + build `network: host`; postgres `listen_addresses=127.0.0.1` + cổng riêng (tránh trùng 5432 của site khác); keycloak `--http-host=127.0.0.1`; api `server.address=127.0.0.1`; env `DB_URL`, `KEYCLOAK_BASE_URL`, `KEYCLOAK_JWK_SET_URI` trỏ `127.0.0.1:<port>` thay tên service; `deploy/caddy/carenest-auth.caddy` cho `auth.carenest.edu.vn` ⇒ keycloak; module AI bind `127.0.0.1`, không có site Caddy.
- Tests: AC-3 → `sudo ss -ltnp | grep 18300` trên VPS; AC-4 → commit đổi comment trong file Caddy, xem CI reload; thử file lỗi ở nhánh thử ⇒ CI fail, `curl -I` site khác vẫn 200; AC-2 lặp lại.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` pass (sửa `docs/`).
- **Dừng chờ user review.**

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| `npm run verify` fail trên CI | Không deploy | Chạy verify local trước khi merge `main` | — |
| Image mới lỗi | Web lỗi | Smoke `curl` sau khi chạy container | Re-run workflow của commit cũ hoặc revert trên `main` |
| Lộ SSH key CI | Chiếm quyền VPS (nhóm docker ≈ root) | Key riêng, chỉ lưu ở GitHub Secrets | Xoá key khỏi `authorized_keys` |
| File Caddy lỗi do CI đẩy | Server reboot ⇒ Caddy không lên, mọi site chết | Reload lỗi ⇒ khôi phục `.bak` ngay trong CI | Khôi phục `.bak` tay rồi `systemctl reload caddy` |
| Service mạng host bind `0.0.0.0` | Lộ thẳng ra Internet (firewalld/ufw inactive), vd. postgres | Quy tắc bind `127.0.0.1`; AC-3 kiểm `ss -ltnp` mỗi lần thêm service | Sửa cấu hình bind, `docker compose up -d` |
| Trùng cổng với service khác trên host | Container không lên / chiếm cổng site khác | Bảng cổng trong `DEPLOYMENT.md`; kiểm `ss -ltnp` trước khi chọn | Đổi cổng + route Caddy |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có cách kiểm
- [x] ≤8 file, 1 phase
- [x] Không dùng rule PENDING/OPEN

## Progress log
### 2026-10-19 — Phase 1 (chờ review)
- Commit: chưa commit
- Verify: xem báo cáo trong chat
- Khác plan: build mặc định mock vì BE chưa deploy (user nêu giữa lượt); deploy bằng compose trong `/data/thangnd/CAPSTONE/CareNest_FE` thay `docker run`, nginx conf đặt ở `/data/thangnd/CAPSTONE/nginx/` (user chọn)
- Tiếp: user bật Docker Desktop để build thử local; cấu hình VPS + GitHub Secrets theo `docs/integration/DEPLOYMENT.md`

### 2026-10-19 — Deploy tay lần đầu (AC-2 đạt trên VPS)
- VPS: upload zip, `docker compose up -d --build` ⇒ `curl http://127.0.0.1:18300/` 200; Caddy import site ⇒ `curl -I https://web.carenest.edu.vn/` 200 (user báo).
- Khác plan: không có nginx host/certbot — Caddy giữ 80/443; container mạng host do VPS mất chain iptables Docker; `npm ci --legacy-peer-deps` (npm 10 chặn peer vite 8); ACL `u:caddy:x` trên `/data/thangnd`.
- Verify local: FAIL — `node_modules` máy dev thiếu `@tabler/icons-react`, `read-excel-file` (bị thay đổi ngoài phiên lúc 22:53); cần `npm ci --legacy-peer-deps` rồi chạy lại.
- Tiếp: AC-1 (CI) — user `thangnd`: nhóm docker, `chown` thư mục FE cho `thangnd`, SSH key + secrets, commit file deploy (cần mã Jira).

### 2026-10-20 — Ghi chú từ plan `2026-10-20-fe-hardening.md` (chưa sửa)
- `Dockerfile:16` copy `docker/nginx/default.conf.template`, nhưng trên đĩa máy dev chỉ có `docker/nginx/defaultconf.txt` ⇒ `docker build` từ thư mục này sẽ fail ở bước `COPY`.
- Cần kiểm lại: bản đã deploy trên VPS build từ file nào (zip upload có thể khác máy dev); sau đó đổi tên file hoặc sửa `Dockerfile` cho khớp trước khi commit file deploy.

### 2026-10-20 — Commit file deploy (G94-215)
- Tên file nginx đã khớp `Dockerfile` (`docker/nginx/default.conf.template`).
- Verify: `node scripts/verify.mjs` ⇒ VERIFY PASS full; HEAD kiểm thêm trên checkout sạch ⇒ test fail 0, build ok.
- Tiếp: AC-1 — theo dõi lần chạy workflow `Deploy production` đầu tiên trên GitHub Actions (cần secrets `VPS_*` + environment `production`).

### 2026-10-21 — Thiết kế Phase 2 (draft, chờ duyệt plan)
- Commit: chưa commit
- Verify: chưa sửa code
- Khác plan: quyết định 2 đổi sang deploy từ `dev`; thêm quyết định 7–9, AC-3..5, Phase 2a/2b do sắp deploy BE + Keycloak + AI.
- Tiếp: user duyệt Phase 2a ⇒ chạy lệnh chẩn đoán trên VPS, dán kết quả.
- 2026-10-21: user duyệt Phase 2a ("ok"); Phase 2b còn chờ kết quả gate.

### 2026-10-21 — Phase 2a done (gate: giữ mạng host)
- Commit: chưa commit
- Verify: chỉ đọc trên VPS (user chạy): Docker 29.4.2, không `daemon.json`, firewalld/ufw/k3s inactive, `kubelet` `activating`, `iptables -L` filter/nat ⇒ `Incompatible with this kernel`, `docker network create` ⇒ `No chain/target/match by that name`.
- Khác plan: Phase 2b viết lại theo mạng host (bỏ sửa iptables/restart Docker, bỏ AC-5, AC-3 đổi thành kiểm bind `127.0.0.1`); ghi tri thức vào `docs/knowledge/TROUBLESHOOTING.md`.
- Tiếp: user duyệt Phase 2b mới; xin người quản lý server dòng sudoers.

### 2026-10-21 — Phase 2b (chờ review)
- Commit: chưa commit
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` → 0 lỗi; YAML workflow parse OK; script `Apply Caddy site` `bash -n` OK + mô phỏng 5 tình huống (không đổi / đổi + reload ok / đổi + reload lỗi ⇒ khôi phục / file đầu + ok / file đầu + lỗi ⇒ xoá) đúng.
- Khác plan: smoke HTTPS chạy từ runner (đi đúng đường Internet), không từ VPS; thêm bước VPS số 7 (chown + sudoers) vào `DEPLOYMENT.md`.
- Tiếp: AC-3, AC-4 cần VPS — người quản lý thêm sudoers, push `dev`, xem run CI; kiểm `sudo ss -ltnp | grep 18300`.
- 2026-10-30: VPS bước 7 xong (user chạy bằng root): `chown thangnd` thư mục `caddy/`, `/etc/sudoers.d/carenest-caddy` `visudo -c` OK, `sudo -u thangnd sudo -n systemctl reload caddy` ⇒ `RELOAD_OK`. Còn: commit + push `dev`, xem run CI.
