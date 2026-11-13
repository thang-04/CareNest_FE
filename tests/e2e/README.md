# Playwright — Kế hoạch giáo dục (integration + system)

Chạy với **BE thật**: không dùng mock. Không nằm trong `scripts/verify.mjs`, vì cần Docker, Keycloak và BE đang chạy.

## Chuẩn bị

1. Docker: Postgres `carenest_be-postgres-1` và Keycloak `:8180`, realm dev có client `carenest-dev` (xem `CareNest_BE/docs/system/KEYCLOAK.md`).
2. Chạy BE profile `dev` ở `:8080`. Spring không đọc file `.env`: phải nạp biến môi trường bằng PowerShell, vì Git Bash đổi `API_PREFIX=/api` thành đường dẫn Windows.
   `Get-Content .env | % { $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k,$v,'Process') }; .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"`
3. Chromium của Playwright 1.63 (`npx playwright install chromium` nếu máy chưa có).

## Chạy

- `npm run test:e2e`: integration rồi system. Playwright tự build FE với `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=/be-api`, rồi chạy `vite preview` ở cổng `5181`.
- `npm run test:e2e:integration` / `npm run test:e2e:system`.
- Báo cáo HTML nằm trong `playwright-report/`, ảnh và trace của lần chạy lỗi nằm trong `test-results/`. Cả hai đã có trong `.gitignore`.

## Dữ liệu

- Bộ test chỉ dùng năm học 2027-2028, nhóm Mẫu giáo nhỡ, lớp B1 của năm đó. Kế hoạch năm do test tạo có tiêu đề bắt đầu bằng `[E2E]`.
- Bộ test thêm phân công Tổ trưởng tạm (`valid_from = 2026-01-01`). Ở system test, phân công Tổ trưởng sẵn có của teacher1 bị dời `valid_from` +100 năm vì shim đăng nhập dev của Web chỉ đọc phân công Tổ trưởng đầu tiên.
- `cleanup()` chạy trước và sau mỗi bộ: xóa đúng các dòng trên và khôi phục phân công Tổ trưởng cũ. Đặt `E2E_KEEP_DATA=1` để giữ dữ liệu lại khi cần soi lỗi.
- Tài khoản dev là `<user>@gmail.com`, mật khẩu chung của realm dev: **bắt buộc** đặt biến môi trường `E2E_DEV_PASSWORD` trước khi chạy (repo không ghi mật khẩu; thiếu biến thì test báo lỗi ngay).
- Postgres: test đọc/xóa dữ liệu qua `docker exec <container> psql`. Mặc định container `carenest_be-postgres-1`, DB `carenest`, user `postgres`; đổi bằng `E2E_PG_CONTAINER`, `E2E_PG_DB`, `E2E_PG_USER` (ví dụ máy dùng DB riêng `carenest_local`, user `carenest`).

## Hồ sơ trẻ, sức khỏe (`system/children-records.spec.mjs`)

- Một trẻ riêng `Bé Kiểm Thử Tự Động` (tạo qua `POST /children/enrollments` bằng Hiệu trưởng) đi hết vòng: danh sách, hồ sơ, sửa hồ sơ, xếp lớp vào lớp của teacher1, kỳ cân đo do PHT tạo (tên bắt đầu `[E2E]`), GV nhập và sửa số đo, Tài khoản phụ huynh, cho nghỉ học, mở lại hồ sơ.
- Phụ huynh của trẻ là một phụ huynh dữ liệu mẫu đã có tài khoản và còn con đang học (chọn bằng SQL): tiếp nhận chỉ liên kết tài khoản, không tạo user Keycloak mới; cho nghỉ học không khóa tài khoản đó.
- Cần năm học đang hoạt động, teacher1 dạy một lớp còn chỗ, điểm trường của lớp đó chưa có đợt khám/kỳ cân đo nào đang mở.
- `cleanup()` xóa trẻ (mọi bảng tham chiếu `children`), kỳ cân đo `[E2E]%` và thông báo của chúng.
- Chạy riêng: `npx playwright test tests/e2e/system/children-records.spec.mjs --project=system --no-deps`.
