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
