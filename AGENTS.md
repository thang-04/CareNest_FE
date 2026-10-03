# CareNest Web — hướng dẫn cho coding agent

Bạn đang làm việc trong repository Web của CareNest. Đọc `.ai/ROUTER.md` để chọn profile và workflow liên quan; không nạp toàn bộ `.ai/` theo mặc định. `.ai/REPO_CONTEXT.md` mô tả trách nhiệm Web, còn `.ai/CONTEXT_MAP.yaml` phân biệt file hiện có và dự kiến.

- FE sở hữu màn hình, điều hướng, trạng thái client và tích hợp API cho Admin, Ban giám hiệu và Giáo viên. BE sở hữu business rule, authorization và API contract.
- Không sao chép hoặc tự diễn giải quy tắc nghiệp vụ, dữ liệu dinh dưỡng và chính sách sức khỏe vào FE. Khi thiếu contract/quy tắc, tra BE rồi nêu điều cần chốt.
- Không đưa dữ liệu trẻ em, sức khỏe, tài khoản hay secret thật vào prompt, log, fixture hoặc commit.
- Với thay đổi API/auth có tác động đến client khác, dùng profile liên repo và kiểm tra BE/APP khi có thể. Nếu tài liệu và implementation mâu thuẫn, báo xung đột trước khi chọn hành vi.
- React/Next.js chỉ là phương án dự kiến. Đọc source thực tế trước khi áp rule framework.

## Git, commit và comment (bắt buộc)

- Không tự ý commit, push, tạo/merge pull request khi user chưa cho phép rõ trong tin nhắn hiện tại; không commit thẳng `main`.
- Không chạy lệnh git phá hủy (`reset --hard`, `push --force`, `rebase`, `branch -D`, `clean -fd`...) khi chưa hỏi; không `--no-verify`.
- Commit theo Conventional Commits tiếng Anh, subject ≤ 72 ký tự, body ngắn nói lý do; không ghi tên model/công cụ AI hay `Co-Authored-By` của AI.
- Comment code chỉ ngắn gọn ở flow có logic chính; không comment code hiển nhiên, không để code comment-out.
- Hỏi trước khi đổi dependency, contract hoặc thứ ảnh hưởng cả nhóm; không sửa ngoài phạm vi task hoặc repo CareNest khác. Trả lời user bằng tiếng Việt.
- Chi tiết: mục "Quy tắc chung CareNest" trong `CLAUDE.md`.
