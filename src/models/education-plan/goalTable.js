/*
 * Bảng mục tiêu năm học theo mẫu MN Thái Dương: mỗi lĩnh vực là danh sách hàng theo thứ tự
 * (lĩnh vực con, nhóm kết quả mong đợi, mục tiêu kèm các nội dung); bảng hiển thị mỗi tầng một cột. Nội dung tích vào chủ đề ở phần B.
 */
import { DOMAINS } from '@/models/education-plan/educationPlanConstants';

export const DOMAIN_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const domainRoman = (name) => DOMAIN_ROMAN[DOMAINS.indexOf(name)] || String(DOMAINS.indexOf(name) + 1 || '');

export const HEADING_LABEL = { sub: 'Lĩnh vực con', group: 'Nhóm kết quả mong đợi' };

/**
 * Lĩnh vực đã có lĩnh vực con thì mọi nhóm kết quả / mục tiêu phải nằm trong một lĩnh vực con:
 * các hàng đứng trước lĩnh vực con đầu tiên được đưa vào lĩnh vực con đó (đưa dòng lĩnh vực con lên đầu lĩnh vực).
 */
export const nestUnderFirstSub = (rows) => {
  const i = rows.findIndex((r) => r.kind === 'sub');
  return i > 0 ? [rows[i], ...rows.slice(0, i), ...rows.slice(i + 1)] : rows;
};

/** Bộ mục tiêu đã lưu → hàng của bảng. Bộ cũ (mục tiêu + YCCĐ có mã) được đổi YCCĐ thành nội dung, bỏ mã. */
export const toRows = (domain, uid) => {
  if (domain.rows) return nestUnderFirstSub(domain.rows.map((r) => (r.kind === 'goal' ? { ...r, contents: r.contents || [] } : r)));
  return (domain.items || []).map((it) => ({
    id: it.id || uid(),
    kind: 'goal',
    text: it.text,
    contents: it.contents || (it.requirements || []).map((r) => ({ id: r.id || uid(), text: r.text, themes: [] })),
  }));
};

/** Số MT đánh liên tục cả năm (qua mọi lĩnh vực) cho các mục tiêu đã có chữ. */
export const numberGoals = (domains) => {
  let n = 0;
  const map = {};
  domains.forEach((d) =>
    d.rows.forEach((r) => {
      if (r.kind === 'goal' && r.text.trim()) map[r.id] = ++n;
    }),
  );
  return map;
};

/** Các mục tiêu của chủ đề: mục tiêu có ít nhất một nội dung được tích vào chủ đề ở cột "Chủ đề thực hiện". */
export const themeGoalIds = (domains, theme) =>
  domains.flatMap((d) => d.rows.filter((r) => r.kind === 'goal' && r.contents.some((c) => c.themes.includes(theme.id))).map((r) => r.id));

/** Chữ cái đầu mỗi từ của tên chủ đề, viết hoa ("Bản thân" → "BT"); dùng tự điền tên viết tắt. */
export const initialsOf = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('');

/** Dòng chủ đề / đợt nghỉ chưa gõ gì (dòng vừa thêm bằng Enter): không lưu, không thành cột tích ở bảng mục tiêu. */
export const isBlankTheme = (t) => ![t.name, t.abbr, t.festivals, t.note].some((v) => v?.trim()) && !t.start && !t.end;
export const isBlankBreak = (b) => !b.label?.trim() && !b.start && !b.end;

/** Tên viết tắt hiển thị ở tiêu đề cột chủ đề: tên viết tắt đã nhập, chưa có thì chữ cái đầu của tên. */
export const themeAbbr = (theme) => theme.abbr?.trim() || initialsOf(theme.name);

/**
 * Bản nháp từng chọn mục tiêu cho chủ đề (theme.goalIds) được đổi thành dấu tích: mục tiêu đã chọn mà chưa có nội dung nào
 * tích vào chủ đề thì tích mọi nội dung của mục tiêu đó; sau đó bỏ goalIds để chỉ còn một nguồn là dấu tích.
 */
export const goalIdsToTicks = (domains, themes) => {
  const legacy = themes.filter((t) => t.goalIds?.length);
  const nextDomains = legacy.length
    ? domains.map((d) => ({
        ...d,
        rows: d.rows.map((r) => {
          if (r.kind !== 'goal') return r;
          const ids = legacy.filter((t) => t.goalIds.includes(r.id) && !r.contents.some((c) => c.themes.includes(t.id))).map((t) => t.id);
          return ids.length ? { ...r, contents: r.contents.map((c) => ({ ...c, themes: [...c.themes, ...ids] })) } : r;
        }),
      }))
    : domains;
  return { domains: nextDomains, themes: themes.map(({ goalIds, ...t }) => t) };
};

/** "MT 1, 2, 4 (3 MT)"; mục tiêu đã xóa (không còn số) tự bỏ qua. */
export const themeGoalLabel = (domains, numbers, theme) => {
  const nos = themeGoalIds(domains, theme)
    .map((id) => numbers[id])
    .filter(Boolean)
    .sort((a, b) => a - b);
  return nos.length ? `MT ${nos.join(', ')} (${nos.length} MT)` : '';
};

/* ---------- Ngày tháng (yyyy-mm-dd, tính theo UTC để không lệch múi giờ) ---------- */

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
const addDays = (iso, n) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const mondayOf = (iso) => {
  const day = toDate(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
};

/** Số tuần học (Thứ 2 → Thứ 6) của chủ đề, bỏ các tuần trùng đợt nghỉ. */
export const weekCount = (theme, breaks = []) => {
  if (!theme.start || !theme.end || theme.end < theme.start) return 0;
  let n = 0;
  for (let m = mondayOf(theme.start); m <= theme.end; m = addDays(m, 7)) {
    const fri = addDays(m, 4);
    if (!breaks.some((b) => b.start && b.end && m <= b.end && fri >= b.start)) n += 1;
  }
  return n;
};
