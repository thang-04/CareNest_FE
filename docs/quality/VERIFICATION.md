# Verification — bằng chứng trước khi báo xong (FE)

## Iron Law
Không nói "xong / pass / đã sửa" khi chưa có **output lệnh chạy trong lượt này, sau lần sửa cuối**. Suy luận, kết quả lượt trước không phải bằng chứng. **Skip hoặc chưa chạy = chưa kiểm chứng** — báo đúng (`Verify: chưa chạy — <lý do>`).

Lệnh chuẩn: `node scripts/verify.mjs` — chưa có code (`package.json`) ⇒ in `VERIFY SKIP`; khi có code gọi `npm run verify` (team định nghĩa: lint + typecheck + test + build). Output tóm tắt, log ở `verify.log`.

## Bằng chứng
| Claim | Bằng chứng |
| --- | --- |
| Xong (khi có code) | Dòng `VERIFY PASS …` trong lượt |
| Bug đã sửa | Output test **fail trước fix** + **pass sau fix** (chưa có test runner ⇒ bước kiểm tay ghi rõ, trình duyệt) |
| Khớp contract BE | Đối chiếu `BE:docs/api/openapi.yaml` (snapshot BE khóa bằng test) + source DTO BE, dẫn `file:line` |
| Chạy trên trình duyệt | Bước + kết quả `x/y`, môi trường (BE thật hay mock) |
| AI layer nhất quán | `node scripts/check-ai-layer.mjs` exit 0 |

## Báo cáo cuối task
```text
Làn S (≤3 dòng):  Đã làm: … · Verify: <dòng VERIFY | chưa chạy — lý do> · Memory: <chỉ khi có trigger>
Làn M (≤8 dòng):  Đã làm · Rule/AC · Verify · Chưa kiểm chứng (trình duyệt, BE thật) · Chờ BE · Memory
Làn L:            ghi đủ vào Progress log của plan; chat chỉ tóm tắt + link plan
```
