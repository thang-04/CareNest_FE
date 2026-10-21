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
updated: 2026-10-19
---
# Deploy Web lên VPS bằng Docker + GitHub Actions

## Context
FE chưa có CI/CD, Dockerfile hay cấu hình nginx. Cần deploy FE lên VPS qua subdomain có SSL. `VITE_*` nhúng lúc build (`src/config/env.js:1-3`); `BrowserRouter` (`src/App.jsx:10`) cần SPA fallback. BE chưa deploy.

## Quyết định đã chốt
1. GitHub Actions verify, rsync source lên VPS, VPS tự build Docker (`docker compose up -d --build`), không dùng GHCR — user, 2026-10-19 (đổi từ phương án GHCR cùng ngày).
2. Chỉ deploy từ `main` (+ chạy tay) — user, 2026-10-19.
3. `/api` proxy cùng subdomain sang BE `127.0.0.1:8080` — user, 2026-10-19.
4. Domain `carenest.edu.vn`; subdomain `web.carenest.edu.vn` (đề xuất, đổi được) — user, 2026-10-19.
5. Chỉ deploy FE, BE chưa lên ⇒ build `VITE_USE_MOCK=true`; BE lên ⇒ repo variable `VITE_USE_MOCK=false` — user, 2026-10-19.
6. VPS: FE ở `/data/thangnd/CAPSTONE/CareNest_FE` (compose). Server đã có Caddy giữ 80/443 cho site khác ⇒ dùng Caddy thay nginx host + certbot; site file ở `/data/thangnd/CAPSTONE/caddy/`, import từ `/etc/caddy/Caddyfile` — user chọn thư mục riêng, đổi sang Caddy do cổng bị chiếm, 2026-10-19.

## Làm rõ nghiệp vụ
Không đổi nghiệp vụ hay giao diện; chỉ hạ tầng build/deploy.

### Câu hỏi mở
- [x] Subdomain: dùng `web.carenest.edu.vn` đến khi user đổi.

## Acceptance criteria
- **AC-1:** Given commit vào `main`, When workflow chạy, Then verify → rsync source → VPS build → container `carenest-web` chạy trên VPS.
- **AC-2:** Given trình duyệt mở `https://web.carenest.edu.vn/<route con>`, When F5, Then không 404.

## Phases
### Phase 1 — Dockerfile, nginx, workflow, tài liệu
- Files: C `Dockerfile` · C `.dockerignore` · C `docker/nginx/default.conf.template` · C `.github/workflows/deploy.yml` · C `deploy/caddy/carenest-web.caddy` · C `compose.yaml` · C `docs/integration/DEPLOYMENT.md` · M `docs/INDEX.md` · M `README.md`
- Tests: AC-2 → `docker build` + `docker run` local, F5 route con; AC-1 → chạy workflow trên GitHub sau khi user cấu hình secrets
- Exit: `node scripts/verify.mjs` → `VERIFY PASS`

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| `npm run verify` fail trên CI | Không deploy | Chạy verify local trước khi merge `main` | — |
| Image mới lỗi | Web lỗi | Smoke `curl` sau khi chạy container | Re-run workflow của commit cũ hoặc revert trên `main` |
| Lộ SSH key CI | Chiếm quyền VPS (nhóm docker ≈ root) | Key riêng, chỉ lưu ở GitHub Secrets | Xoá key khỏi `authorized_keys` |

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
