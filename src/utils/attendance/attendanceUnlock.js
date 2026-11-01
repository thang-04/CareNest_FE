// Cần chốt 21/10/2026: mở lại được cả ngày cũ trong năm học; lần mở lại còn hiệu lực tới hạn "Mở đến" do HT / PHT chọn
// (không tự khóa lúc sang ngày, không quá ngày kết thúc năm học)
export const isAttendanceUnlockActive = (unlock, now = new Date()) =>
  !!unlock && Number.isFinite(Date.parse(unlock.validUntil)) && Date.parse(unlock.validUntil) > now.getTime();
