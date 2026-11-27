import { E2E, sql } from './realBe.mjs';

// Năm học của bộ test (năm sắp tới) chỉ lập/sửa kế hoạch từ ngày mở chuẩn bị (EDU-89) ⇒ mở tạm khi chạy, trả lại ngày cũ sau khi xong
export default function openTestYear() {
  const where = `name = '${E2E.schoolYear}'`;
  const original = sql(`select coalesce(prep_date::text, '') from school_years where ${where}`);
  sql(`update school_years set prep_date = '${E2E.markerDate}' where ${where}`);
  return () => sql(`update school_years set prep_date = ${original ? `'${original}'` : 'null'} where ${where}`);
}
