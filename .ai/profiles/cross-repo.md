# Profile CROSS-REPO — FE + BE (+ APP)

Mức: L3.

1. Đọc `../CareNest_BE/docs/system/CROSS_REPO_MAP.md`: ownership + điểm chạm. Không có sibling ⇒ đọc https://github.com/thang-04/CareNest_BE.git, nói rõ đã đọc remote.
2. Liệt kê thay đổi thuộc FE / BE / APP / contract dùng chung.
3. Nếu `../CareNest_APP` có sẵn và endpoint/auth dùng chung, đọc `AGENTS.md` + `.ai/ROUTER.md` của APP; không giả định cả ba repo được checkout.
4. BE sở hữu rule + contract; FE sở hữu UI/route/state/integration. Không copy business rule sang FE; không "vá" ở FE để che lỗi contract/nghiệp vụ BE.
5. Contract chưa có hoặc cần đổi ⇒ mô tả thay đổi cần thống nhất (endpoint, request/response, status, `desc`) trước khi code. **Không tự sửa repo BE/APP.**
6. Bug contract/nghiệp vụ phát hiện qua FE ⇒ đề xuất nội dung ghi vào `../CareNest_BE/docs/knowledge/CROSS_MODULE_ISSUES.md` (để người có quyền ở BE ghi); phía FE ghi incident nếu có thay đổi/workaround ở client.
7. Báo rõ: đã kiểm chứng gì với BE thật, phần nào chỉ đọc tĩnh, phần nào chờ BE.
