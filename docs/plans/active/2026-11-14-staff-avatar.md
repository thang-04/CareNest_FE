---
title: Ảnh đại diện nhân sự trên Web
status: in-progress
owner: thangnd
jira: G94-356 / FE-FEAT-57 (BE: G94-355 / BE-FEAT-57)
branch: feature/G94-356-FE-FEAT-57-staff-avatar
modules: [account]
rules: [AUTH-27]
risk: medium
created: 2026-11-14
updated: 2026-11-14
---
# Ảnh đại diện nhân sự trên Web

Plan liên repo, nghiệp vụ và contract: `BE:docs/plans/active/2026-11-14-staff-avatar.md`, `BE:specs/019-staff-avatar/` (user duyệt 14/11/2026). File này chỉ phần client.

## Context
`src/components/ui/Avatar.jsx` chỉ vẽ chữ cái đầu, dùng ở ~13 chỗ (UserMenu, thẻ Hồ sơ, danh bạ nhân sự, phân công PHT, ghi đè quyền…). BE mở `PUT/DELETE /accounts/me/photo` cho nhân sự và thêm `POST /accounts/photos/urls` (AUTH-27).

## Quyết định đã chốt
1. Chỉ Web; App phase sau — user, 14/11/2026.
2. Avatar lấy link qua bộ gom dùng chung (1 request/màn), không thêm `photoUrl` vào từng DTO — user, 14/11/2026.
3. Chế độ mock (`AUTH_USE_MOCK`) không gọi API, giữ chữ cái đầu.

### Câu hỏi mở
Không còn.

## Acceptance criteria
- **AC-1** (`AUTH-27`): Given nhân sự đăng nhập thật, When mở Hồ sơ, Then thấy nút "Đổi ảnh"/"Xóa ảnh"; đổi xong mọi Avatar của mình cập nhật không cần tải lại trang.
- **AC-2** (`AUTH-27`): Given màn có nhiều người, When hiển thị, Then gọi `POST /accounts/photos/urls` một lần (≤100 id/lần); người không có ảnh/không được xem hiện chữ cái đầu.
- **AC-3**: Given link lỗi hoặc BE lỗi, Then Avatar hiện chữ cái đầu, không toast.
- **AC-4**: Upload sai định dạng/quá 2 MB ⇒ toast lỗi BE (8004/8005); tài khoản kiêm phụ huynh xóa ảnh ⇒ toast 1145.

## Phases
### Phase 1 — Avatar + đổi ảnh
- Files: C `utils/account/photoUrlBatcher.js`, `services/account/api/accountPhotoApi.js`, `services/account/accountPhotoService.js`, `hooks/useAccountPhotoUrl.js`, `components/account/AccountPhotoActions.jsx`, `tests/auth/account-photo-batcher.test.mjs` · M `components/ui/Avatar.jsx`, `components/account/AccountSideCard.jsx`, `styles/modules/account.css`, `config/integrationModules.js`, `docs/integration/be-api-routes.json`.
- Tests: AC-2, AC-3 → `tests/auth/account-photo-batcher.test.mjs`; AC-1, AC-4 thử tay trên dev sau khi BE lên.
- Exit: `npm run test:auth`, `npm run lint`, `npm run build`, `node scripts/check-api-contract.mjs` sạch.

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Avatar ở màn danh sách dài gọi BE | Thêm 1 request/màn | Gom lô, cache tới hạn link, cache "không có ảnh" 5 phút | Revert `Avatar.jsx` về chữ cái đầu |
| FE lên trước BE | `POST /accounts/photos/urls` 404 ⇒ chữ cái đầu | Merge BE (G94-355) trước | Không cần |

## Progress log
### 2026-11-14 — Phase 1 (code xong, chờ BE lên dev để thử tay)
- Commit: chưa commit
- Verify: `npm run test:auth` → pass 98 fail 0 (5 test AUTH-27 mới) · `npm run lint` sạch · `npm run build` ✓ · `node scripts/check-api-contract.mjs` 0 lỗi (snapshot route sync từ BE nhánh G94-355).
- Chưa kiểm: thử tay trên trình duyệt (cần BE G94-355 lên dev).
