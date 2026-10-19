---
title: Đồng bộ UI màn Quản lý trẻ và Khám sức khỏe
status: in-progress
owner: carenestg94@gmail.com
jira: none
branch: dev
modules: []
rules: []
risk: medium
created: 2026-10-19
updated: 2026-10-19
---

# Đồng bộ UI màn Quản lý trẻ và Khám sức khỏe

## Context

- User yêu cầu "check các màn quản lý trẻ, khám sức khỏe chưa được đồng bộ, hãy xem và đồng bộ" (2026-10-19). Chuẩn đối chiếu: màn Nhân sự và nhóm dinh dưỡng/bếp vừa đồng bộ trong `2026-10-18-selective-nutrition-permission-merge.md`; quy tắc bảng ở `docs/architecture/CODING_GUIDE.md:155`.
- Rà chỉ đọc (chưa sửa file), 12 bảng còn kiểu sọc `.table` không kẻ ô: `src/pages/children/ChildHealthRecordPage.jsx:310`, `ChildProfilePage.jsx:191`, `ChildrenListPage.jsx:249`, `ClassPlacementPage.jsx:138`, `HealthCheckDetailPage.jsx:289`, `HealthCheckDetailPage.jsx:334`, `HealthCheckListPage.jsx:102`, `HealthFollowUpDetailPage.jsx:414`, `HealthFollowUpListPage.jsx:152`, `HealthTrendPage.jsx:325`, `ImportChildrenPage.jsx:241`, `src/components/children/HealthCheckClassRoster.jsx:38`.
- Danh sách trẻ (`ChildrenListPage.jsx:252-261`): cột Họ và tên, Phụ huynh quá hẹp, tên xuống 3 dòng và phụ huynh 5 dòng ở 1440px.
- 22 inline style `gap` cố định trái `.claude/rules/ui-style.md` (style chỉ cho giá trị động) ở 7 trang: ChildHealthRecord 4, ChildProfile 5, ChildrenList 3, EnrollChild 1, HealthDeclaration 1, HealthTrend 4, ImportChildren 4. Utility `gap-*` đã có tại `src/styles/utilities.css:114-146`.
- Màu primitive `var(--gray-50)` tại `src/styles/modules/children.css:224`. Màu dòng `tr-row-error` (`children.css:257`) và `tr-row-selected` (`children.css:394`) sẽ bị `.table--grid` ép nền trắng nếu không nâng selector (`src/styles/components.css` rule `.table.table--grid tbody tr td`).
- Plan `2026-10-19-css-cleanup.md` đang Phase 1 và sửa `children.css`; user chọn chờ plan đó dừng review rồi mới code plan này.

## Quyết định đã chốt

1. Chờ `2026-10-19-css-cleanup.md` xong Phase 1 (dừng review) mới bắt đầu code — user, 2026-10-19.
2. Phạm vi đủ 4 hạng mục: bảng kẻ ô, độ rộng cột danh sách trẻ, inline gap → class, token màu — user, 2026-10-19.
3. Giữ nghiệp vụ, route, quyền, service, mock và dữ liệu; chỉ đổi class/CSS trình bày. Không thêm dependency, không sửa BE/APP. Skill shadcn/Tailwind chỉ áp nguyên tắc.

## Làm rõ nghiệp vụ

- **Hiểu nghiệp vụ:** actor HT/PHT/GV xem hồ sơ trẻ và khám sức khỏe; outcome cùng hình thức với màn khác; không đổi rule nào.
- **Đối chiếu thiết kế:** `DESIGN.md` mục 6/8.1 (bảng kẻ ô `table--grid`) và `CODING_GUIDE.md:155`.
- **Ảnh hưởng:** FE `/children`, `/children/:id`, `/children/:id/health`, `/children/placement`, `/children/import`, `/children/health-checks`(+chi tiết), `/children/health-follow-ups`(+chi tiết), `/children/health-trends`, `/children/new`, khai báo sức khỏe. Dữ liệu cũ không đổi.

### Câu hỏi mở

Không còn.

## Acceptance criteria

- **AC-1:** Mọi `.table` trong `src/pages/children` và `src/components/children` có `table--grid`; dòng lỗi nhập Excel và dòng đang chọn vẫn giữ màu.
- **AC-2:** Danh sách trẻ ở 1440px: tên trẻ không ngắt giữa họ tên quá 2 dòng; phụ huynh hiển thị tên + quan hệ + SĐT không quá 3 dòng; 375/768px không tràn trang.
- **AC-3:** Không còn `style={{ gap: <số> }}` cố định trong các trang trên; inline style chỉ còn giá trị động.
- **AC-4:** `children.css` không dùng primitive màu.
- **AC-5:** `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` exit 0.

## Key decisions

| Quyết định               | Chọn                                         | Phương án khác        | Vì sao                                                  |
| ------------------------ | -------------------------------------------- | --------------------- | ------------------------------------------------------- |
| Thời điểm                | Sau Phase 1 dọn CSS                          | Làm ngay chỉ JSX      | Tránh đè patch và làm lệch ảnh so sánh của plan dọn CSS |
| Màu dòng trong bảng kẻ ô | Nâng selector `.table.table--grid .tr-row-*` | Bỏ màu dòng           | Giữ tín hiệu lỗi/đang chọn, cùng cách đã làm ở bếp      |
| Inline gap               | Utility `gap-*` có sẵn                       | Thêm class module mới | Không thêm CSS mới, đúng token spacing                  |

## Phases

### Phase 1 — Đồng bộ bảng, cột, inline style, token

- Files: M 11 trang trong `src/pages/children/` nêu ở Context · M `src/components/children/HealthCheckClassRoster.jsx` · M `src/styles/modules/children.css` · C `tests/menu/children-ui-standard.test.mjs` (hoặc mở rộng test chuẩn bảng hiện có) · M plan này.
- Steps: 1. Đọc Progress log plan dọn CSS, xác nhận đã dừng review và lấy `children.css` mới nhất. 2. Chụp baseline 1440/768/375 các route ở mục Ảnh hưởng. 3. Thêm `table--grid`; nâng selector màu dòng. 4. Đặt độ rộng tối thiểu cột tên/phụ huynh danh sách trẻ. 5. Đổi inline gap sang `gap-*`. 6. Đổi primitive màu sang token semantic. 7. Chụp sau, so sánh.
- Tests: AC-1/3 → test tĩnh quét class bảng và inline gap (RED trên source hiện tại, GREEN sau sửa); AC-1 màu dòng → assert selector; AC-2 → browser đo số dòng/scrollWidth.
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`; `node scripts/check-ai-layer.mjs` exit 0.
- **Dừng chờ user review.**

## Test matrix

| AC   | Rule              | Test (tầng)                              | Phase | Kết quả   |
| ---- | ----------------- | ---------------------------------------- | ----- | --------- |
| AC-1 | CODING_GUIDE §3.8 | Test tĩnh class bảng + selector màu dòng | 1     | chưa chạy |
| AC-2 | DESIGN §8.1       | Browser 1440/768/375                     | 1     | chưa chạy |
| AC-3 | ui-style rule     | Test tĩnh inline gap                     | 1     | chưa chạy |
| AC-4 | ui-style rule     | grep primitive trong children.css        | 1     | chưa chạy |
| AC-5 | VERIFICATION      | Hai cổng                                 | 1     | chưa chạy |

## Rủi ro & rollback

| Rủi ro                              | Tác động              | Giảm thiểu                                                    | Rollback                        |
| ----------------------------------- | --------------------- | ------------------------------------------------------------- | ------------------------------- |
| Đè thay đổi của plan dọn CSS        | Mất patch             | Chờ Phase 1 dừng review; Edit chính xác, không ghi đè cả file | Hoàn tác đúng hunk của plan này |
| Màu dòng mất trong bảng kẻ ô        | Mất tín hiệu lỗi nhập | Selector `.table.table--grid` + test                          | Bỏ `table--grid` ở bảng đó      |
| Độ rộng cột làm bảng tràn ở màn hẹp | Cuộn ngang            | Bảng cuộn trong `.table-wrap`; đo scrollWidth body            | Giảm min-width                  |

## Validation log

- [x] Khẳng định về code có `file:line`
- [x] Không đổi contract BE
- [x] Mỗi AC có test; phase có Exit
- [x] 13 file trong một phase cùng tính chất (đổi class trình bày); không đề xuất tách vì phụ thuộc chung `children.css`
- [x] Không dùng rule PENDING/OPEN
- [x] Tự review: không placeholder, không mâu thuẫn

## Progress log

### 2026-10-19 — Duyệt, bắt đầu Phase 1

- Nguồn: user "check đi xong rồi kìa" sau khi plan dọn CSS ghi "dừng review Phase 1" (xóa 30 dòng `children.css`). Phase 2 dọn CSS chỉ sửa dashboard/attendance/school-config, không trùng file.

### 2026-10-19 — Phase 1 (chờ review)

- TDD: `tests/menu/children-ui-standard.test.mjs` 0/3 trên source trước sửa → 3/3 sau sửa.
- 13 bảng thêm `table--grid`; màu dòng `.tr-row-error`/`.tr-row-selected` nâng thành `.table.table--grid …`. Inline gap cố định ở 7 trang + 4 component con đổi sang `gap-*` (`gap: 18` không có token ⇒ `gap-4`); max/min-width cố định ⇒ class `tr-state-text`, `tr-search-wide`, `tr-col-result`, `tr-field-row` (`--btn-height-lg`, giữ 40px), `tr-field-narrow`, `tr-state-actions`, `flex-1`, `min-w-0`. Chỉ còn inline style động (thanh % tài khoản phụ huynh).
- Token: `--gray-50` ⇒ `--color-surface-muted`; `--success-50/700` ⇒ `--color-success-bg/fg`; `999px` ⇒ `--radius-full`. Giữ alias `--danger-25`, `--primary-25`… vì module khác cũng dùng.
- Danh sách trẻ: nguyên nhân tên xuống 3 dòng là `.tr-name-btn { overflow-wrap: anywhere }` ⇒ `white-space: nowrap`. Bảng vẫn rộng 1.216/1.080px ⇒ **khác plan:** gộp Mã trẻ thành dòng phụ dưới tên (như email dưới tên ở màn Nhân sự) và Giới tính vào dòng tuổi; bỏ 2 cột, `cols` 9/10 ⇒ 7/8. Kết quả 1.080/1.080 ở 1440px, không mất thông tin.
- Tràn 375px có từ trước (bỏ `table--grid` trên DOM còn rộng hơn) ở hồ sơ trẻ, sổ sức khỏe, chi tiết phiếu theo dõi. **Khác plan (CSS chung):** `.detail-layout__main/__aside > * { min-width: 0 }`; `.page__head { flex-wrap: wrap }`; `.grid-2` và `.info-list` về 1 cột ≤640px. Không thuộc file Phase 2 dọn CSS.
- Browser mock 5198 (PHT, profile riêng): 13 route × 375/768/1440 = 39 ca không tràn trang; script đo căn chỉnh không còn lệch thật (chỉ padding pill/nút; cột tiến độ trải hết ô). Chưa kiểm HT/GV, bản in, API thật.
- Verify: `node scripts/verify.mjs` → `VERIFY PASS full | npm run verify | log verify.log` (menu 49/49, kitchen 37/37, merge 38/38). Chưa commit/push/PR.

### 2026-10-19 — Draft, chờ duyệt và chờ plan dọn CSS

- Commit: chưa commit.
- Verify: chưa chạy (chưa sửa source).
- Tiếp: user duyệt plan; khi `2026-10-19-css-cleanup.md` dừng review Phase 1 thì bắt đầu Phase 1.
