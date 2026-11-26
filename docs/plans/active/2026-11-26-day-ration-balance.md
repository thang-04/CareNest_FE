# Cân đối khẩu phần theo ngày (FE-FEAT-185 · G94-487…493)

Nguồn: đề xuất luồng bán trú của người phụ trách module, chốt ngày 26/11/2026. Làn L.

## Luồng đích

Kế hoạch tuần (chỉ chọn món) → cân đối lần 1 theo ngày → công bố tuần (đạt lượng, chất, tiền) → dự trù → kiểm nhận lần 1 →
chốt suất → cân đối lần 2 → kiểm nhận lần 2 (gọi thêm / trả lại / giữ dùng).

## Giai đoạn

1. G94-487 (FE): gộp ô thực đơn tuần ở Bán trú hôm nay, đổi thứ tự menu, kế hoạch tuần chỉ liệt kê món, đồng bộ bữa chung.
2. G94-488 (BE+FE): P:L:G tổng 100%, biên tiền cấu hình được, ba kết luận.
3. G94-489 (BE): bản cân đối lần 1, làm tròn, chia điểm trường.
4. G94-490 (FE): màn cân đối lần 1.
5. G94-491 (BE+FE): công bố theo cân đối, đổi nguồn số liệu. Deploy cùng giai đoạn 4.
6. G94-492 (BE+FE): cân đối và kiểm nhận lần 2.
7. G94-493: tài liệu nghiệp vụ, dữ liệu dev, E2E.

## Progress log

- 26/11/2026 · G94-487: code xong; `npm run verify` đạt. Chưa commit. Chưa kiểm trên trình duyệt với BE thật.
  - Công tắc "Đồng bộ bữa chung" mặc định bật, không lưu; áp cho thêm/đổi/xóa, chép ngày, mẫu ngày, sửa ngày và sửa ngoại lệ.
    Gợi ý tuần bằng AI và màn Cân đối khẩu phần chưa đồng bộ.
  - Bỏ `WeekDaySummary`, `MealPlanEvaluations`; lý do chặn công bố vẫn ở hộp thoại công bố, kèm link "Mở cân đối".
