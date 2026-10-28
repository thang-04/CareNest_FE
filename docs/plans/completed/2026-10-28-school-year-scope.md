---
title: Dữ liệu của nhánh theo năm học (đón trẻ, hồ sơ trẻ, tiếp nhận, đợt khám, phiếu theo dõi)
status: done   # chế độ tự chạy (CLAUDE.md): tự duyệt, giả định chờ user soát
owner: carenestg94@gmail.com
jira: G94-180 / FE-FEAT-43   # theo nhánh hiện tại; xác nhận task Jira khi commit
branch: feature/G94-180-FE-FEAT-43-child-health-pickup
modules: [child, health, pickup, school-structure]
rules: [CHD-01, CHD-02, CMR-04]
risk: high
created: 2026-10-28
updated: 2026-10-28
---
# Dữ liệu của nhánh theo năm học

## Context
User hỏi các phần dữ liệu của nhánh có đi theo năm học chọn ở thanh trên không (2026-10-28). Đối chiếu: danh sách trẻ, tiếp nhận, xếp lớp, xu hướng sức khỏe theo năm (chỉ theo lớp **hiện tại** của trẻ: `listChildren`, `src/services/children/mock/childrenMockRepository.js:870`); tài khoản phụ huynh, đợt khám (`listHealthChecks`, `src/services/children/mock/healthCheckMockRepository.js:418`), phiếu theo dõi (`listHealthFollowUps`, `:595`), đón trẻ (`usePickupClasses`, `src/hooks/pickup/usePickups.js:9` lấy mọi lớp; `getPickupBoard`, `src/services/pickup/mock/pickupMockRepository.js:92` không kiểm ngày) không theo năm. Tiếp nhận, xếp lớp không chặn năm đã kết thúc/sắp diễn ra (`src/pages/children/EnrollChildPage.jsx:59`, `src/pages/children/ClassPlacementPage.jsx:36`).

User chốt 2026-10-28: "Y-1 A, Y-2 Z, Y-3 A, Y-4 A, Y-5 A".

## Quyết định đã chốt
1. Y-1 A — Đón trẻ chỉ lớp của năm học đang hoạt động, như điểm danh — user, 2026-10-28.
2. Y-2 (user gõ "Z", hiểu là A — xem câu hỏi mở) — Chọn năm cũ ở thanh trên thì danh sách trẻ hiện đúng trẻ đã học năm đó, theo lớp năm đó.
3. Y-3 A — Tiếp nhận, xếp lớp chỉ vào lớp của năm học đang hoạt động; năm đã kết thúc chỉ xem; xếp lớp cho năm sau ở màn "Xếp lớp năm học mới" — user, 2026-10-28.
4. Y-4 A — Đợt khám lọc theo năm (theo ngày khám); phiếu theo dõi đang mở luôn hiện, phiếu đã đóng theo năm — user, 2026-10-28.
5. Y-5 A — Tài khoản phụ huynh không theo năm — user, 2026-10-28.

## Làm rõ nghiệp vụ
- **Hiểu nghiệp vụ:** actor HT, PHT, giáo viên · outcome: chọn năm ở thanh trên thì dữ liệu nhánh khớp năm đó; việc trong ngày (đón trẻ) và việc ghi (tiếp nhận, xếp lớp) luôn ở năm đang hoạt động · rule: CHD-01, CHD-02, CMR-04 (dữ liệu cũ theo lớp tại ngày đó).
- **Ảnh hưởng:** FE `/children`, `/children/new`, `/children/import`, `/children/placement`, `/children/health-checks`, `/children/health-follow-ups`, `/pickup`; bảng tổng quan HT/PHT (số trẻ theo năm) · BE: tham số năm cho danh sách trẻ, đợt khám, phiếu theo dõi; lớp xếp phải thuộc năm đang hoạt động · dữ liệu cũ: không đổi.

### Câu hỏi mở
Chế độ tự chạy: tự chọn phương án khuyến nghị, ghi giả định để user soát.
- [x] S1 — Y-2 "Z" không có trong lựa chọn: hiểu là A (phím cạnh A, các mục khác đều A, A là khuyến nghị). Báo user xác nhận.
- [x] S2 — Ngày thuộc năm học: năm gần nhất đã bắt đầu tính tới ngày đó (hè giữa hai năm tính vào năm vừa qua) — để đợt khám/phiếu theo dõi ngày nào cũng thuộc đúng một năm.
- [x] S3 — Danh sách trẻ năm X: trẻ có lớp thuộc năm X (lớp cuối cùng trong năm X, từ lịch sử xếp lớp và chuyển năm); trẻ chờ xếp lớp chỉ hiện ở năm đang hoạt động; trẻ nghỉ khi chưa có lớp hiện ở năm của ngày nghỉ. Trạng thái vẫn là trạng thái hiện tại. Phạm vi xem vẫn theo điểm trường hiện tại của trẻ.
- [x] S4 — Đón trẻ: ngày xem từ ngày bắt đầu năm đang hoạt động tới hôm nay (năm chưa bắt đầu thì không chặn ngày cũ); lớp năm khác ⇒ 422. Danh sách trẻ của lớp vẫn theo lớp hiện tại như điểm danh.
- [x] S5 — Thanh trên đang ở năm đã kết thúc: màn tiếp nhận, nhập Excel, xếp lớp chỉ hiện thông báo + nút chuyển sang năm đang hoạt động; năm sắp diễn ra: vẫn làm, vào năm đang hoạt động, có thông báo chỉ màn Xếp lớp năm học mới.
- [x] S6 — Phiếu theo dõi đã đóng thuộc mọi năm mà phiếu còn mở trong khoảng đó (từ ngày mở tới ngày đóng).

| Câu hỏi | Trả lời | Ai | Ngày | Rule/doc đã cập nhật |
| --- | --- | --- | --- | --- |
| S1–S6 | Như trên (giả định chế độ tự chạy, chờ user soát) | Claude | 2026-10-28 | `docs/features/README.md`, `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` |

## Acceptance criteria
- **AC-1** (Y-1): danh sách lớp ở Đón trẻ chỉ lớp năm đang hoạt động; BE giả: lớp năm khác ⇒ 422 `classId`; ngày trước năm đang hoạt động hoặc ở tương lai ⇒ 422 `date`.
- **AC-2** (Y-2): `listChildren({ schoolYear: X })` trả trẻ đã học năm X với lớp của năm X (cả trẻ đã chuyển lên lớp năm sau); trẻ chờ xếp lớp chỉ ở năm đang hoạt động.
- **AC-3** (Y-3): tiếp nhận/xếp lớp vào lớp năm khác năm đang hoạt động ⇒ 422 `classId`; danh sách lớp xếp chỉ năm đang hoạt động; thanh trên ở năm đã kết thúc ⇒ màn chỉ hiện thông báo.
- **AC-4** (Y-4): `listHealthChecks({ schoolYear })` theo ngày bắt đầu đợt; `listHealthFollowUps({ schoolYear })` gồm phiếu đang mở + phiếu đã đóng có khoảng mở giao năm đó; số đếm theo cùng phạm vi.
- **AC-5** (Y-5): màn Tài khoản phụ huynh không đổi.

## Key decisions
| Quyết định | Chọn | Phương án khác | Vì sao |
| --- | --- | --- | --- |
| Lớp của trẻ theo năm (BE giả) | Suy từ lịch sử xếp lớp (`childPlacements`) và lịch sử chuyển năm (`history` `PLACEMENT_*`) | Thêm bảng enrollment vào BE giả | Đủ dữ liệu sẵn có; BE thật dùng `enrollments` |
| Năm của một ngày | Năm gần nhất đã bắt đầu | Chỉ trong khoảng start–end | Không có ngày "mồ côi" ở kỳ hè |

## Phases
### Phase 1 — BE giả + test
- Files: C `src/mocks/schoolYearScope.js` · M `src/services/children/mock/childrenMockRepository.js` · M `src/services/children/mock/healthCheckMockRepository.js` · M `src/services/pickup/mock/pickupMockRepository.js` · C `tests/children/school-year-scope.test.mjs`
- Exit: `npm run test:children`, `test:health`, `test:hardening`, `test:dashboard`, `test:merge` pass

### Phase 2 — Màn hình
- Files: M `src/contexts/SchoolYearContext.jsx` · C `src/components/children/ActiveYearNotice.jsx` · M `src/hooks/children/useChildRecords.js` · M `src/pages/children/EnrollChildPage.jsx`, `ImportChildrenPage.jsx`, `ClassPlacementPage.jsx`, `HealthCheckListPage.jsx`, `HealthFollowUpListPage.jsx` · M `src/hooks/pickup/usePickups.js` · M `src/pages/pickup/PickupListPage.jsx`
- Exit: `node scripts/verify.mjs` → `VERIFY PASS full`

### Phase 3 — Contract + tài liệu
- Files: M `src/services/children/api/childrenApi.js`, `healthCheckApi.js`, `src/services/pickup/api/pickupApi.js` (chú thích contract) · M `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` · M `docs/features/README.md` · plan → `completed/`
- Exit: `node scripts/check-ai-layer.mjs` 0 lỗi; `node scripts/verify.mjs` → `VERIFY PASS full`

## Test matrix
| AC | Rule | Test (tầng) | Phase | Kết quả |
| --- | --- | --- | --- | --- |
| AC-1..AC-4 | CHD-01, CHD-02, CMR-04 | `school-year-scope.test.mjs` (mock) | 1 | 5/5 pass |
| AC-3 (màn), AC-5 | — | `verify` (build, lint); không đổi màn tài khoản | 2 | xem Progress log |

## Rủi ro & rollback
| Rủi ro | Tác động | Giảm thiểu | Rollback |
| --- | --- | --- | --- |
| Danh sách đợt khám mặc định chỉ còn năm đang hoạt động | Người dùng tưởng mất đợt cũ | Chọn năm cũ ở thanh trên; câu trống nói rõ năm | Bỏ lọc |
| Giáo viên không đọc được danh sách năm học | Ô ngày Đón trẻ không có giới hạn dưới | BE giả vẫn kiểm (422) | — |
| Test cũ đếm đợt khám/phiếu | Đổi số | Lọc năm chỉ khi có tham số | — |

## Validation log
- [x] Khẳng định về code có `file:line`
- [x] Đổi contract ⇒ consumer: `GET /children` (`schoolYear` theo lịch sử lớp), `GET /children/placement-classes` (bỏ `schoolYear`), `GET /health-checks`, `GET /health-follow-ups` (+`schoolYear`), pickup board/results (lớp, ngày)
- [x] Mỗi AC có test; mỗi phase có Exit
- [x] >8 file: không tách — một quyết định năm học
- [x] Không dùng rule PENDING/OPEN như đã chốt
- [x] Tự review

## Progress log
### 2026-10-28 — Plan
- Chế độ tự chạy: plan tự duyệt theo CLAUDE.md; giả định S1–S6 chờ user soát.
- Commit: chưa commit

### 2026-10-28 — Phase 1 (done)
- `src/mocks/schoolYearScope.js` (`schoolYearIdOfDate`, `overlapsSchoolYear`); children mock: `classInYear`, `inSchoolYear` cho `listChildren({ schoolYear })`, `getPlacementClasses` chỉ năm đang hoạt động, `assertClassAvailable` chặn lớp năm khác; health check mock: lọc `schoolYear` cho đợt khám, phiếu theo dõi; pickup mock: lớp năm đang hoạt động, ngày trong năm đang hoạt động.
- Test: `school-year-scope.test.mjs` 5/5; `test:children` 78/78, `test:health` 19/19, `test:hardening` 27/27, `test:dashboard` 12/12, `test:merge` 46/46.
- Commit: chưa commit

### 2026-10-28 — Phase 2 (done)
- `SchoolYearContext` thêm `activeYear`; `ActiveYearNotice` (module trẻ); tiếp nhận, nhập Excel, xếp lớp theo năm đang hoạt động, năm đã kết thúc chỉ hiện thông báo; danh sách đợt khám, phiếu theo dõi truyền `schoolYear`; Đón trẻ: lớp năm đang hoạt động, `min` ngày, thông báo khi header khác năm đang hoạt động.
- Prettier, ESLint các file đã sửa: sạch.
- Trình duyệt (mock, cổng 5199): HT — đợt khám năm 2026-2027 chỉ đợt từ 15/09/2026, năm 2025-2026 hiện 4 đợt cũ; Tiếp nhận ở năm 2025-2026 chỉ hiện thông báo, nút chuyển năm đưa về 2026-2027 và hiện form; danh sách trẻ năm 2025-2026 trống (dữ liệu demo chưa có lớp năm đó). Giáo viên — Đón trẻ: lớp "Lớp Chồi 1", ngày từ 05/09/2026 tới 28/10/2026; chọn năm 2025-2026 thì hiện thông báo, lớp không đổi. Console 0 lỗi.
- Commit: chưa commit

### 2026-10-28 — Phase 3 (done)
- Chú thích contract `childrenApi.js`, `healthCheckApi.js`, `pickupApi.js`; đặc tả BE mục 9 (+ 4.1, 4.4); `docs/features/README.md`; `docs/architecture/ROUTE_MAP.md` (Đón trẻ). Plan chuyển sang `docs/plans/completed/`.
- Commit: chưa commit

### 2026-10-28 — User xác nhận
- C-7: Y-2 = A (S1 đúng). Ghi ở `docs/features/README.md`, `docs/integration/CHILD_ENROLLMENT_BE_SPEC.md` mục 9.
- Commit: chưa commit
