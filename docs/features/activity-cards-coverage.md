# Thẻ hoạt động gắn MT, Bảng phủ MT, kế hoạch tuần theo hồ sơ chủ đề

Nguồn: `BE:docs/business/BUSINESS_RULES.md` EDU-78, EDU-79, EDU-80; spec `specs/006-activity-cards-mt-map` (Tiền 12/11/2026).
BE quyết định kiểm thẻ, MT của lượt xếp, bản tuần hiệu lực (`effectiveWeek`) và chặn gửi (7396/7397); màn chỉ hiển thị.

## Kế hoạch chủ đề (`ClassThemePlanPage` → `ThemePlanBody`)

- Cột "Hoạt động giáo dục" = các thẻ của MT, chip "Loại giờ: tên"; thẻ nhiều MT hiện ở mọi MT. Nút "+ Thêm hoạt động" mở
  `ActivityCardEditor` (loại giờ \*, tên \* ≤ 300 ký tự, MT \* nhiều, nội dung tùy chọn của các MT đã chọn; xóa thì hỏi, nêu số ô
  tuần đang dùng).
- Thẻ chuyển từ dữ liệu cũ không rõ loại giờ: chip đỏ, chữ đỏ nhỏ "Có hoạt động chưa rõ loại giờ."; lưu được.
- Nút "Bảng / Dạng cây": dạng cây MT → nội dung → thẻ; nội dung chưa có thẻ chip cam "chưa có hoạt động", MT chưa có thẻ chip đỏ;
  nhánh "Chưa gắn nội dung". Chỉ cảnh báo.
- Lưu: gửi `activities` (bản cũ chuyển khi lưu), `rows[goalId]` chỉ còn `contents`. Xuất file: mỗi MT liệt kê "- Loại giờ: tên";
  bản cũ chưa có thẻ in nguyên ô chữ.

## Kế hoạch tuần (`WeekTab`)

- Ô hiện chip MT của từng lượt xếp ("MT3, MT23", theo thẻ). Gợi ý: thẻ đúng loại giờ trước, nhóm "Khác" sau; một thẻ xếp được
  nhiều ô, nhiều tuần. Thẻ dòng học tên "Môn: đề tài" điền Môn và Đề tài.
- Ô gõ tay: chip đỏ "Chưa gắn MT" + nút "Tạo thẻ từ hoạt động này". Trang Kế hoạch tuần: thẻ thêm vào kế hoạch chủ đề (lưu chủ đề
  ngay), ô trỏ tới thẻ, tuần lưu khi bấm Lưu. Trang ngày (sửa theo hồ sơ): thẻ lưu kèm `day.content.week.cards`, nhãn "Bổ sung theo
  hồ sơ chủ đề".
- Dòng tổng dưới bảng: lượt xếp, MT tuần phủ, ô gõ tay chưa MT, MT cả chủ đề đã phủ/tổng, MT còn thiếu (link tab Bảng phủ MT).

## Tab "Bảng phủ MT" (`CoverageTab`, `?tab=coverage` của trang kế hoạch chủ đề)

- Tab cuối hàng tab chung (sau tuần cuối). Hàng MT theo lĩnh vực, cột tuần, ô = các thứ đã dạy (bấm mở tuần, cuộn tới cột ngày),
  cột "Lần". MT chưa dạy chữ đỏ + chip "chưa dạy"; bấm MT xem nội dung, nội dung chưa có hoạt động chip cam. Lọc: Tất cả / MT chưa
  dạy / Nội dung chưa có hoạt động. Hàng cuối "Hoạt động chưa gắn MT".
- Người soạn thấy bản lưu mới nhất (cả bản tuần sửa theo hồ sơ đang nháp); người khác thấy bản hiệu lực (`effectiveWeek`). Tuần
  dùng bản sửa theo hồ sơ có nhãn "đã sửa theo chủ đề".

## Trang Kế hoạch giáo dục ngày

- Tab "Kế hoạch tuần" sửa được khi gói học kỳ chứa chủ đề đã ban hành, hồ sơ chủ đề còn sửa được và trước ngày bắt đầu chủ đề;
  ngoài khoảng đó chỉ xem. Lưu cùng nút Lưu của giáo án ngày (khóa `week` của `day`, chỉ khi khác bản theo kỳ).
- Ô khác bản theo kỳ có chữ "Khác bản theo kỳ"; nhãn "Đã sửa theo chủ đề", "Bản theo kỳ đã đổi" (mốc `week.base`).
- Mỗi ngày: dòng "MT trong ngày" (chip MT); mục có hoạt động gõ tay có chip "chưa gắn MT"; ô a) còn trống được điền sẵn
  "- MTn: câu MT" một lần; thẻ bị bỏ khỏi ô tuần sau khi soạn ngày ⇒ "Đã đổi ở kế hoạch tuần" (chữ cô viết giữ nguyên).
- Gửi hồ sơ chủ đề bị 7396/7397 ⇒ chữ đỏ nhỏ căn phải "MT chưa được dạy ngày nào: MT…" (từ `data.details`).

## Gói học kỳ (`ClassPlanPage`)

- Hộp xác nhận gửi gói học kỳ liệt kê MT chưa dạy ngày nào (chỉ cảnh báo); học kỳ cuối BE chặn 7397.

- Tiền 13/11/2026 (nhập nhanh thẻ hoạt động): đầu phần I hiện dòng đếm xám "N mục tiêu · M chưa có hoạt động". Thẻ mới tích sẵn mọi nội dung của MT đang đứng (bỏ tích được), mặc định loại giờ vừa dùng ở thẻ trước, Enter ở ô tên là lưu; lưu thiếu thông tin thì con trỏ tới ô lỗi đầu tiên. Ô tên tắt tự điền của trình duyệt (từng bị điền email đăng nhập).
- Tiền 13/11/2026 (phần 4): ô "Gõ tên hoạt động, Enter" ở mỗi dòng MT dùng "Loại giờ khi gõ nhanh" ở đầu phần I (chưa chọn ⇒ mở hộp đầy đủ, điền sẵn tên). "Lấy hoạt động năm trước": kế hoạch chủ đề đã ban hành của lớp mình ở các năm trước, cùng tên chủ đề, theo phạm vi BE trả; ghép MT/nội dung theo câu chữ (`models/education-plan/activityImport.mjs`), thẻ không ghép được thì báo. "Gợi ý hoạt động (AI)": mở rộng EDU-20 PROPOSED, chỉ `services/education-plan/mock/activityAiMock.js` (BE chưa có API, không gọi HTTP), hộp duyệt Dùng/Bỏ từng gợi ý, "Dùng tất cả".
- Tiền 13/11/2026 (gọn trang): menu "Lấy / gợi ý hoạt động" (Lấy năm trước, Gợi ý AI) ở trái hàng nút, đặt bằng portal vào chỗ trang cấp (`toolsTarget`); đầu phần I còn menu "Mục tiêu" (Tùy chọn / Khôi phục) và "Gõ nhanh: loại giờ"; cảnh báo MT chưa có hoạt động ghi số + 5 MT đầu (đủ danh sách ở title); mỗi dòng: ô gõ nhanh + nút "+" mở hộp đầy đủ; thẻ tên một dòng.
- Tiền 13/11/2026 (đồng bộ trang): bỏ "Kiểu hiển thị" (dạng cây) ở kế hoạch chủ đề. Tab Bảng phủ MT: thẻ "Bảng phủ mục tiêu" thu gọn được (theo "Thu gọn tất cả"), dòng đếm "Đã phủ x/y mục tiêu" ở đầu thẻ, ô "Lọc mục tiêu" trong thẻ (không ở hàng lọc trang). Kế hoạch ngày: menu "Lấy / gợi ý" (Lấy từ kế hoạch tuần, Dùng lại bài đã soạn, AI gợi ý tiến trình) ở trái hàng nút cạnh "Dạy học ngày này"; "III. Học liệu theo mục hoạt động" thu gọn được.
