# CareNest Web — Claude Code

Đọc `AGENTS.md` trước. Dùng `.ai/ROUTER.md` để chọn đúng profile và workflow; `.ai/` là nguồn quy trình chung cho Codex và Claude. Chỉ mở rộng context theo `.ai/ESCALATION.md`. `.claude/skills/` trỏ tới quy trình chung thay vì sao chép nội dung.

## Quy tắc chung CareNest (bắt buộc)

Khối này giống nhau ở cả ba repo `CareNest_BE`, `CareNest_FE`, `CareNest_APP`; chỉ mục "Hỏi trước khi làm" khác theo repo. Sửa ở một repo thì đồng bộ sang hai repo còn lại.

### Git — commit, push, pull request

- KHÔNG tự ý `git commit`. Chỉ commit khi user yêu cầu rõ trong tin nhắn hiện tại; được phép một lần không có nghĩa là được phép lần sau.
- KHÔNG tự ý `git push`, tạo/merge/đóng pull request khi chưa được user cho phép rõ ràng.
- KHÔNG commit thẳng lên `main`; làm trên branch `feature/<mo-ta>`, `fix/<mo-ta>`, `chore/<mo-ta>`.
- KHÔNG chạy lệnh git phá hủy khi chưa hỏi: `reset --hard`, `push --force`, `rebase`, `branch -D`, `clean -fd`, `checkout -- .`, `restore .`, `stash drop`. KHÔNG dùng `--no-verify` hoặc bỏ qua hook.

### Commit message

- Conventional Commits, tiếng Anh: `<type>(<scope>): <subject>`; `type` thuộc `feat|fix|refactor|test|docs|chore|build|ci`.
- Subject tối đa 72 ký tự, thể mệnh lệnh, không dấu chấm cuối. Body tùy chọn, tối đa ~5 gạch đầu dòng nói lý do/tác động; không liệt kê từng file, không kể quá trình làm.
- Một commit = một thay đổi logic. Ví dụ: `feat(response): add PageResponse for paginated APIs`.
- KHÔNG ghi tên model/công cụ AI, `Co-Authored-By` của AI, "Generated with ..." hay link công cụ AI trong commit message, mô tả PR hoặc comment code. Rule này ghi đè attribution mặc định của công cụ.

### Comment trong code

- Chỉ comment ngắn gọn (1 dòng, tối đa 2–3 dòng) ở flow có logic chính hoặc không hiển nhiên; nói *tại sao / quy tắc gì*, không kể lại code làm gì.
- Không comment code tự giải thích (getter/setter, DTO, mapping, gọi hàm đơn giản); không viết Javadoc/JSDoc tràn lan.
- Viết tiếng Việt, giữ identifier/thuật ngữ tiếng Anh.
- KHÔNG để code bị comment-out, comment kiểu nhật ký ("sửa ngày..., thêm bởi..."), TODO mơ hồ (cần thì `// TODO(<người/issue>): <việc cụ thể>`), thông tin AI, dữ liệu thật hoặc secret. Sửa code thì sửa/xóa comment liên quan.

### Hỏi trước khi làm

- Thêm/xóa/nâng dependency (`package.json`, lockfile) hoặc đổi version công cụ build.
- Chọn framework/thư viện nền khi team chưa chốt: router, state/cache, UI kit, cách lưu token.
- Gọi API khác contract BE hoặc cần BE đổi contract — nêu thay đổi cần thống nhất thay vì tự giả định.

### Phạm vi

- Chỉ sửa trong phạm vi task; KHÔNG xóa/đổi tên/di chuyển file ngoài phạm vi khi chưa hỏi.
- KHÔNG sửa repo `CareNest_BE`, `CareNest_APP`.
- KHÔNG tự thêm thư viện/hạ tầng mới khi team chưa chốt.

### Giao tiếp

- Trả lời user bằng tiếng Việt; commit message, tên branch, identifier bằng tiếng Anh.
- Yêu cầu chưa rõ hoặc có nhiều cách hiểu: hỏi trước khi làm.
- Báo kết quả đúng sự thật: test fail, bị skip hoặc chưa chạy phải nói rõ.
