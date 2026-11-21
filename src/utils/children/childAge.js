// Tuổi trẻ theo tháng, tính giống BE (java.time) để gợi ý, kiểm ở Web không lệch kết quả của máy chủ.
const parts = (iso) => String(iso).slice(0, 10).split('-').map(Number);

/** Số tháng tròn từ ngày from tới ngày to, như ChronoUnit.MONTHS.between (dd/MM chưa tới ngày sinh thì chưa tròn tháng). */
export const fullMonthsBetween = (from, to) => {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

/** Cộng tháng như LocalDate.plusMonths: ngày vượt cuối tháng thì lùi về ngày cuối tháng (31/08 + 3 tháng = 30/11). */
export const addMonthsIso = (iso, months) => {
  const [y, m, d] = parts(iso);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
};
