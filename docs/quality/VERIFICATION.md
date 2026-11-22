# Verification — bằng chứng trước khi báo xong (FE)

## 2026-11-20 — Danh mục nhóm tuổi kế hoạch giáo dục

- Đối chiếu EDU-01/28/54/73 trong bản chuẩn; API config → `SchoolStructureService` → `age_groups`. Không đổi nghiệp vụ/contract/schema.
- `npm run test:edu`: 389/400 đạt ở lần đầu; 11 ca lỗi do fixture danh mục và expectation mapper cũ.
- Sau cập nhật fixture, `node --import ./scripts/register-auth-test-loader.mjs --test tests/education-plan/age-group-catalog.test.mjs tests/education-plan/full-year-file-import.test.mjs tests/education-plan/import-goal-file-modal.test.mjs tests/education-plan/year-plan-api.test.mjs`: 44/44 đạt, gồm toàn bộ 11 ca lỗi. Các file độc lập đã đạt không chạy lại.
- `npm run build`: đạt; cảnh báo annotation `@__PURE__` có sẵn ở mock module khác.
- ESLint 5 source sửa: đạt. `git diff --check`: đạt.
- Chưa kiểm tra trình duyệt/API/DB live. Không chạy Playwright/e2e vì user không yêu cầu.
- Nguồn dữ liệu còn ở FE và phạm vi ảnh hưởng: [báo cáo rà soát](../knowledge/incidents/FE-BUG-261120-education-age-group-catalog.md).

## Iron Law
Không nói "xong / pass / đã sửa" khi chưa có **output lệnh chạy trong lượt này, sau lần sửa cuối**. Suy luận, kết quả lượt trước không phải bằng chứng. **Skip hoặc chưa chạy = chưa kiểm chứng** — báo đúng (`Verify: chưa chạy — <lý do>`).

Lệnh chuẩn: `node scripts/verify.mjs` (full = `npm run verify`: mọi bộ test + lint + format + check design/api + build) hoặc `--quick` cho làn S (lint + format + check design/api + bộ test khớp file đổi, không build). Làn M/L cần full. Output tóm tắt, log ở `verify.log`.

## Bằng chứng

| Claim | Bằng chứng |
| --- | --- |
| Xong (khi có code) | Dòng `VERIFY PASS …` trong lượt |
| Bug đã sửa | Output test **fail trước fix** + **pass sau fix** (chưa có test runner ⇒ bước kiểm tay ghi rõ, trình duyệt) |
| Khớp contract BE | Đối chiếu `BE:docs/api/openapi.yaml` (snapshot BE khóa bằng test) + source DTO BE, dẫn `file:line` |
| Chạy trên trình duyệt | Bước + kết quả `x/y`, môi trường (BE thật hay mock) |
| AI layer nhất quán | `node scripts/check-ai-layer.mjs` exit 0 |
| Không dính file rác | `node scripts/ai-layer/junk-files.mjs` exit 0 (verify tự chạy; cảnh báo `[JUNK] WARN` ⇒ commit hoặc thêm `.gitignore`) |

## Báo cáo cuối task

```text
Làn S (≤3 dòng):  Đã làm: … · Verify: <dòng VERIFY | chưa chạy — lý do> · Memory: <chỉ khi có trigger>
Làn M (≤8 dòng):  Đã làm · Rule/AC · Verify · Chưa kiểm chứng (trình duyệt, BE thật) · Chờ BE · Memory
Làn L:            ghi đủ vào Progress log của plan; chat chỉ tóm tắt + link plan
```

## Bằng chứng ghi ở đâu

Không ghi nhật ký từng task vào file này (file này chỉ chứa quy tắc, để đọc nhanh). Bằng chứng của task: làn S/M ghi trong báo cáo cuối task; làn L ghi vào Progress log của plan; khi mở PR ghi vào mục "Kiểm thử". Nhật ký cũ (trước 12/11/2026) lưu ở `docs/quality/VERIFICATION_LOG.md` — không cần đọc khi làm task.

## 22/11/2026 — Tổng quan kết quả Hoạt động chung đã lưu

- User phản ánh các ô bình thường/ngủ tốt trống sau GV lưu. DB local xác nhận 19 dòng NGU_TOT, HAPPY, BINH_THUONG; UI cũ chủ động ẩn giá trị không cần chú ý.
- Chỉnh riêng assessment: chi tiết ngày đọc phiếu đã lưu, phân biệt generalRecorded với skillsRecorded, hiện nhãn thật cho sáu tiêu chí. Không đổi API, phân quyền hay DB.
- Node: `node --import ./scripts/register-auth-test-loader.mjs --test tests/dashboard/daily-overview-values.test.mjs tests/dashboard/daily-general-default-save.test.mjs tests/dashboard/class-assessment-overview.test.mjs tests/dashboard/assessment-be-api.test.mjs` → 27/27, 0 fail/skip.
- `npx eslint src/utils/assessment/dailyOverviewValues.js src/pages/assessment/ClassAssessmentOverviewPage.jsx tests/dashboard/daily-overview-values.test.mjs` → đạt.
- `node node_modules/vite/bin/vite.js build` → đạt; cảnh báo deprecated/annotation/eval có sẵn ở plugin/module khác.
- UI local thật: teacher2 lưu General rồi Skills; tổ trưởng/PHT/HT mở chi tiết cùng ngày thấy rõ Bình thường, Ngủ tốt, Vui vẻ, các bữa; PHT campus1, HT có cả hai campus, TL chỉ nhóm4–5 ở overview. Ảnh logs/ui-proof (không commit).
- Đây là kết quả của bug hiển thị; không suy thành toàn bộ ma trận UI thời gian/quyền/chuyển lớp đã đạt. Xem BE:docs/quality/2026-11-22-ui-execution.md cho giới hạn và ca còn lại.

## 22/11/2026 — Xếp thủ công năm mới khác nhóm tuổi

- Yêu cầu Cần: cho chọn lớp khác nhóm tuổi, chưa làm lớp ghép; gợi ý/tự động vẫn theo tuổi. Đồng bộ BE CFG-YR-03, UI hai tab và mock. Giữ năm/phạm vi/campus/sĩ số/ngày hiệu lực; không sửa chuyển lớp giữa năm hay giáo án.
- Sửa thêm lỗi tab trẻ mới tự reset lựa chọn khi parent nhận dirty (memo danh sách đầu vào).
- `node --import ./scripts/register-auth-test-loader.mjs --test` với các file dashboard/hardening/integration-selective-merge → 282 tests, 0 fail/skip; log logs/manual-placement-fe-tests.log.
- ESLint sáu source/test sửa đạt. Build API bằng VITE_USE_MOCK=false, VITE_SCHOOL_CONFIG_API=true đạt; log logs/manual-placement-build.log. Diff check đạt.
- UI thật trên DB clone: trẻ đang học và trẻ mới chọn khác nhóm, lưu/reload giữ lớp; nhãn nhóm/campus/sĩ số hiện đầy đủ. Chưa kích hoạt năm2027 qua UI vì chưa tới cửa sổ, kiểm bằng BE integration18/18.
