---
id: FE-ENV-261021-pre-push-rechecks-remote-commits
type: env
screens: []
be_modules: []
rules: []
status: fixed
date: 2026-10-21
keywords: [pre-push, githooks, push bị chặn, Push bị chặn, dòng đầu phải dạng, merge dev, fast-forward, rev-list]
similar_to: []
---

# FE-ENV-261021-pre-push-rechecks-remote-commits — push nhánh bị chặn vì commit cũ đã có trên `origin/dev`

## Symptom
Sau khi kéo `origin/dev` về nhánh feature (fast-forward), `git push` bị `.githooks/pre-push` chặn:
```text
[CareNest] LỖI: dòng đầu phải dạng '<mã-jira>: <mô tả>' (...) — đang là: [FE-FEAT-42] G94-179: update school, facility and attendance UI
[CareNest] Push bị chặn (6 lỗi).
```
Các commit bị báo lỗi đều đã có trên `origin/dev`; commit mới của nhánh đúng định dạng.

## Điều kiện tái hiện
Nhánh remote đã tồn tại và đứng sau `origin/dev`. Kéo `origin/dev` về (merge/fast-forward), thêm 1 commit đúng định dạng, rồi push. `git rev-list HEAD --not --remotes` chỉ ra 1 commit mới; `git rev-list origin/<nhánh>..HEAD` ra 53 commit.

## Attempts — đã thử (cập nhật mỗi phiên điều tra, để phiên sau không lặp lại)
| # | Cách thử | Kết quả | Vì sao không đúng / bài học |
| --- | --- | --- | --- |
| 1 | `git push origin <nhánh>` | Bị chặn, 6 lỗi định dạng ở commit cũ từ `dev` | Hook kiểm cả commit đã có trên remote khác |
| 2 | Đổi range thành `git rev-list "$lsha" --not "$rsha" --remotes`, chạy hook giả lập qua stdin | HEAD sau khi kéo `dev`: exit 0; commit mới sai định dạng (`git commit-tree`): vẫn bị chặn, exit 1 | Đúng nguyên nhân |

## Root cause
Khi nhánh remote đã tồn tại, hook lấy `range=$(git rev-list "$rsha..$lsha")`, không loại commit đã có trên các remote ref khác. Commit cũ sai định dạng đã nằm trên `origin/dev` (trước khi có hook) nên bị kiểm lại. Nhánh remote mới thì hook đã dùng `--not --remotes` nên không gặp lỗi này.

## Fix
`.githooks/pre-push`: `range=$(git rev-list "$lsha" --not "$rsha" --remotes)` — chỉ kiểm commit chưa có trên remote nào, vẫn bắt commit mới tạo bằng `--no-verify`. Hook dùng chung ba repo ⇒ cần đồng bộ sang `CareNest_BE`, `CareNest_APP` (chưa làm, chờ user cho phép sửa repo khác).

## Regression test
Kéo `origin/dev` có commit cũ sai định dạng về nhánh feature đã có trên remote, thêm 1 commit đúng định dạng: `git push` phải qua hook.
