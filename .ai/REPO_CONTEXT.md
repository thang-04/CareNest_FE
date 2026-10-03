# CareNest — bối cảnh Web

Nguồn: brief CareNest do chủ dự án cung cấp ngày 23/09/2026. CareNest_FE là client Web, chủ yếu phục vụ Admin, Ban giám hiệu và Giáo viên. Repo này sở hữu trải nghiệm Web, điều hướng, trạng thái, accessibility và tích hợp API; không sở hữu business rule hoặc hợp đồng API chính thức.

Backend (`CareNest_BE`) là nguồn nghiệp vụ và API dùng chung; mobile (`CareNest_APP`) là client khác. Hiện ba repo chưa có source code hoặc bộ `docs/` chính thức. Khi task cần quy tắc, xem BE tương ứng (repo sibling nếu có, hoặc `https://github.com/thang-04/CareNest_BE.git`) và ghi rõ nếu nguồn chưa được tạo.

React/Next.js là phương án dự kiến, chưa chốt. Không giả định router, thư viện state, UI kit hoặc cách lưu token trước khi có quyết định và source. Thông tin trẻ em/sức khỏe yêu cầu hiển thị và quyền truy cập theo hợp đồng BE; không dựa vào ẩn nút trên giao diện như biện pháp phân quyền duy nhất.

