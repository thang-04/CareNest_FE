/*
 * Bảng mục tiêu năm học theo mẫu MN Thái Dương: mỗi lĩnh vực là danh sách hàng theo thứ tự
 * (lĩnh vực con, nhóm kết quả mong đợi, mục tiêu kèm các nội dung); bảng hiển thị mỗi tầng một cột. Nội dung tích vào chủ đề ở phần B.
 */
import { DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { goalDisplayLabel } from '@/models/education-plan/goalLabels.mjs';

export const DOMAIN_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const domainRoman = (name) => DOMAIN_ROMAN[DOMAINS.indexOf(name)] || String(DOMAINS.indexOf(name) + 1 || '');

export const HEADING_LABEL = { sub: 'Lĩnh vực con', group: 'Nhóm kết quả mong đợi' };

/**
 * (Không còn áp tự động từ 05/11 — Tiền: một lĩnh vực có thể có hoặc không có lĩnh vực con, các dòng đứng trước lĩnh vực
 * con đầu tiên thuộc thẳng lĩnh vực; thêm/xóa lĩnh vực con không kéo các dòng khác lên.)
 * Lĩnh vực đã có lĩnh vực con thì mọi nhóm kết quả / mục tiêu phải nằm trong một lĩnh vực con:
 * các hàng đứng trước lĩnh vực con đầu tiên được đưa vào lĩnh vực con đó (đưa dòng lĩnh vực con lên đầu lĩnh vực).
 */
export const nestUnderFirstSub = (rows) => {
  const i = rows.findIndex((r) => r.kind === 'sub');
  return i > 0 ? [rows[i], ...rows.slice(0, i), ...rows.slice(i + 1)] : rows;
};

export const subDomainBranch = (rows, subId) => {
  const start = rows.findIndex((row) => row.kind === 'sub' && row.id === subId);
  if (start < 0) return [];
  const end = rows.findIndex((row, i) => i > start && row.kind === 'sub');
  return rows.slice(start, end < 0 ? rows.length : end);
};

/** Bộ mục tiêu đã lưu → hàng của bảng. Bộ cũ (mục tiêu + YCCĐ có mã) được đổi YCCĐ thành nội dung, bỏ mã. */
export const toRows = (domain, uid) => {
  if (domain.rows) return domain.rows.map((r) => (r.kind === 'goal' ? { ...r, contents: r.contents || [] } : r));
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

/** Id các chủ đề có tên viết tắt trùng chủ đề khác (bỏ khoảng trắng, không phân biệt hoa thường; ô trống không tính) — BE:EDU-42 (7012). */
export const duplicateAbbrThemeIds = (themes) => {
  const key = (t) => (t.abbr || '').trim().toLowerCase();
  const count = new Map();
  themes.forEach((t) => key(t) && count.set(key(t), (count.get(key(t)) || 0) + 1));
  return new Set(themes.filter((t) => count.get(key(t)) > 1).map((t) => t.id));
};
export const DUPLICATE_ABBR_MESSAGE = 'Tên viết tắt đã có';

/** Khóa so trùng tên: bỏ khoảng trắng đầu/cuối, gộp khoảng trắng giữa, không phân biệt hoa thường (giữ dấu tiếng Việt). */
export const nameKey = (text = '') => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * BE:EDU-51 (7036) — id các ô trùng tên ở bảng mục tiêu: lĩnh vực con trùng nhau trong một lĩnh vực; trong cùng một lĩnh vực con
 * thì nhóm kết quả mong đợi trùng nhau, mục tiêu trùng nhau; nội dung trùng nhau trong cùng một mục tiêu. Ô trống không tính.
 */
export const duplicateNameIds = (domains) => {
  const dup = new Set();
  const mark = (items) => {
    const byKey = new Map();
    items.forEach((it) => {
      const k = nameKey(it.text);
      if (k) byKey.set(k, [...(byKey.get(k) || []), it.id]);
    });
    byKey.forEach((ids) => ids.length > 1 && ids.forEach((id) => dup.add(id)));
  };
  domains.forEach((d) => {
    mark(d.rows.filter((r) => r.kind === 'sub'));
    const branches = [[]];
    d.rows.forEach((r) => (r.kind === 'sub' ? branches.push([]) : branches[branches.length - 1].push(r)));
    branches.forEach((rows) => {
      mark(rows.filter((r) => r.kind === 'group'));
      const goals = rows.filter((r) => r.kind === 'goal');
      mark(goals);
      goals.forEach((r) => mark(r.contents || []));
    });
  });
  return dup;
};

/**
 * EDU-53 (Tiền 05/11): một lĩnh vực hoặc không có lĩnh vực con nào, hoặc mọi nhóm / mục tiêu đều thuộc một lĩnh vực con.
 * Trả về tên các lĩnh vực đang lẫn: có lĩnh vực con (có tên) mà vẫn còn dòng có chữ nằm trước lĩnh vực con đầu tiên.
 * Nháp vẫn lưu; gửi / ban hành bị chặn (BE 7038).
 */
const rowHasText = (r) => !!r.text?.trim() || (r.kind === 'goal' && (r.contents || []).some((c) => c.text?.trim()));
export const mixedSubDomains = (domains) =>
  domains
    .filter((d) => {
      const rows = d.rows.filter((r) => (r.kind === 'sub' ? r.text?.trim() : rowHasText(r)));
      return rows.some((r) => r.kind === 'sub') && rows[0].kind !== 'sub';
    })
    .map((d) => d.name);

/** BE:EDU-52 (7037) — chủ đề chưa chọn đủ Từ ngày, Đến ngày: chặn gửi duyệt và ban hành. */
export const themeWithoutDates = (themes) => themes.find((t) => !t.start || !t.end) || null;

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
  const ids = themeGoalIds(domains, theme).filter((id) => numbers[id]);
  const rows = domains.flatMap((d) => d.rows.filter((r) => ids.includes(r.id) && r.kind === 'goal'));
  if (rows.some((r) => r.displayLabel?.trim())) return rows.map((r) => goalDisplayLabel(r, numbers[r.id])).join(', ');
  const nos = ids
    .map((id) => numbers[id])
    .filter(Boolean)
    .sort((a, b) => a - b);
  // Chỉ liệt kê MT, không thêm số đếm (Tiền 31/10: ít chữ)
  return nos.length ? mtList(nos) : '';
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

/** Thứ Hai của tuần học đầu tiên: bắt đầu vào Thứ 7 / Chủ nhật thì tính từ Thứ Hai kế tiếp. */
export const firstTeachingMonday = (iso) => {
  const day = toDate(iso).getUTCDay();
  return day === 6 ? addDays(iso, 2) : day === 0 ? addDays(iso, 1) : mondayOf(iso);
};

/** Đợt nghỉ chứa ngày iso (đợt một ngày được để trống ngày kết thúc). */
export const breakOn = (breaks, iso) => breaks.find((b) => b.start && iso >= b.start && iso <= (b.end || b.start)) || null;

/** Đợt nghỉ của từng ngày Thứ 2 → Thứ 6 trong tuần bắt đầu monday (null = ngày học). */
export const weekBreaks = (breaks, monday) => [0, 1, 2, 3, 4].map((i) => breakOn(breaks, addDays(monday, i)));

/** BE:EDU-41 — tuần chỉ bị bỏ khi đợt nghỉ phủ cả Thứ 2 → Thứ 6; nghỉ vài ngày vẫn là tuần học. */
export const isWholeWeekOff = (breaks, monday) => weekBreaks(breaks, monday).every(Boolean);

/**
 * Ngày gợi ý cho chủ đề thêm vào cuối (Tiền 12/11/2026): Thứ 2 sau chủ đề trước (hoặc tuần học đầu năm), bỏ tuần nghỉ trọn tuần,
 * kéo đủ `weeks` tuần học tới Thứ 6. Không có chỗ trong năm học hoặc chủ đề trước thiếu ngày ⇒ null (để người lập tự chọn, EDU-39).
 */
export const nextThemeDates = (themes, breaks = [], yearRange = {}, weeks = 2) => {
  const last = themes[themes.length - 1];
  if (last && !last.end) return null;
  if (!last && !yearRange.start) return null;
  let start = last ? addDays(mondayOf(last.end), 7) : firstTeachingMonday(yearRange.start);
  if (yearRange.start && start < yearRange.start) start = addDays(start, 7);
  while (isWholeWeekOff(breaks, start)) start = addDays(start, 7);
  let monday = start;
  // ponytail: tối đa 60 tuần lịch để không lặp mãi khi đợt nghỉ phủ hết phần còn lại
  for (let n = 0, guard = 0; guard < 60; monday = addDays(monday, 7), guard += 1) {
    if (!isWholeWeekOff(breaks, monday)) n += 1;
    if (n >= Math.max(1, weeks)) break;
  }
  const end = addDays(monday, 4);
  return yearRange.end && end > yearRange.end ? null : { start, end };
};

/** Số tuần học (Thứ 2 → Thứ 6) của chủ đề, bỏ các tuần nghỉ trọn tuần. */
export const weekCount = (theme, breaks = []) => {
  if (!theme.start || !theme.end || theme.end < theme.start) return 0;
  let n = 0;
  for (let m = firstTeachingMonday(theme.start); m <= theme.end; m = addDays(m, 7)) {
    if (!isWholeWeekOff(breaks, m)) n += 1;
  }
  return n;
};

const weekdayOf = (iso) => toDate(iso).getUTCDay();

/** BE:EDU-40 — chủ đề trọn tuần học: bắt đầu Thứ 2, kết thúc Thứ 6. */
export const isWholeWeekTheme = (theme) => !theme.start || !theme.end || (weekdayOf(theme.start) === 1 && weekdayOf(theme.end) === 5);

export const durationRangeIssue = (range, breaks, limits, label) => {
  if (
    !limits ||
    !Number.isInteger(limits.minWeeks) ||
    !Number.isInteger(limits.maxWeeks) ||
    !range.start ||
    !range.end ||
    range.end < range.start ||
    !isWholeWeekTheme(range)
  )
    return null;
  const weeks = weekCount(range, breaks);
  return weeks < limits.minWeeks || weeks > limits.maxWeeks
    ? `${label} cần từ ${limits.minWeeks} đến ${limits.maxWeeks} tuần học (hiện tại ${weeks} tuần).`
    : null;
};

/** BE:EDU-39 — tên các chủ đề khác trùng thời gian với chủ đề này. */
export const overlappingThemes = (theme, themes) =>
  theme.start && theme.end
    ? themes.filter((x) => x.id !== theme.id && x.start && x.end && x.start <= theme.end && theme.start <= x.end)
    : [];

/** Kiểm tra khoảng trống ngày học (Thứ 2 đến Thứ 6) giữa các chủ đề liên tiếp. */
export const themeGapIssue = (themes, breaks = []) => {
  const dated = (themes || []).filter((t) => t.start && t.end && t.start <= t.end).sort((a, b) => a.start.localeCompare(b.start));
  if (dated.length < 2) return null;

  const minStart = dated[0].start;
  const maxEnd = dated.reduce((max, t) => (t.end > max ? t.end : max), dated[0].end);

  let gapStart = null;
  let gapEnd = null;

  for (let d = minStart; d <= maxEnd; d = addDays(d, 1)) {
    const w = weekdayOf(d);
    if (w >= 1 && w <= 5) {
      const inTheme = dated.some((t) => d >= t.start && d <= t.end);
      const inBreak = (breaks || []).some((b) => b.start && d >= b.start && d <= (b.end || b.start));
      if (!inTheme && !inBreak) {
        if (!gapStart) {
          gapStart = d;
        }
        gapEnd = d;
      } else if (gapStart) {
        break;
      }
    }
  }

  if (gapStart && gapEnd) {
    const fmt = (iso) => {
      const [y, m, day] = iso.slice(0, 10).split('-');
      return `${day}/${m}/${y}`;
    };
    return gapStart === gapEnd
      ? `Bị trống ngày chưa tạo chủ đề (ngày ${fmt(gapStart)}).`
      : `Bị trống ngày chưa tạo chủ đề (từ ${fmt(gapStart)} đến ${fmt(gapEnd)}).`;
  }
  return null;
};

/** Lỗi lịch chủ đề kiểm khi gửi / ban hành (EDU-39, EDU-40); nháp vẫn lưu được (EDU-23). */
export const themeScheduleIssue = (themes, breaks = []) => {
  const misaligned = themes.find((t) => !isWholeWeekTheme(t));
  if (misaligned) return `Chủ đề "${misaligned.name || misaligned.abbr}" phải bắt đầu vào Thứ 2 và kết thúc vào Thứ 6.`;
  const overlapped = themes.find((t) => overlappingThemes(t, themes).length > 0);
  if (overlapped) return `Chủ đề "${overlapped.name || overlapped.abbr}" trùng thời gian với chủ đề khác.`;
  const gap = themeGapIssue(themes, breaks);
  if (gap) return gap;
  return null;
};

/** Ghi số mục tiêu liền chữ MT (Tiền 21/10): "MT1", nhiều MT thì "MT1, MT2, MT5". */
export const mtList = (nos) => nos.map((n) => `MT${n}`).join(', ');
