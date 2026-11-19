// BE:EDU-81 — học liệu gắn một mục hoạt động của một ngày trong kế hoạch giáo dục ngày: activityKey = "yyyy-MM-dd#mục".
export const sectionKey = (date, section) => `${date}#${section}`;

/** Học liệu đang gắn đúng mục của ngày (BE trả `active` = mục còn hợp lệ trong tuần). */
export const resourcesOf = (items, date, section) => items.filter((r) => r.active && r.activityKey === sectionKey(date, section));

/** Thứ tự id mới khi đưa một học liệu lên (-1) / xuống (+1) trong mục; ra ngoài biên thì giữ nguyên. */
export const moveId = (ids, id, delta) => {
  const at = ids.indexOf(id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
};

export const MEDIA_ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.pdf,.pptx,.docx,.xlsx,.txt,.csv';
export const mediaKind = (type = '') =>
  type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type === 'application/pdf' ? 'pdf' : 'file';
export const formatBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

/* ---------- Spec 900: kho học liệu (BE:EDU-82…88) ---------- */

export const MAX_PER_SECTION = 20;
export const LINK_ERROR = 'Chỉ nhận link YouTube hoặc Google Drive/Docs (https).';
const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
const GOOGLE_HOSTS = ['drive.google.com', 'docs.google.com'];
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Cùng quy tắc với BE LearningResourcePolicy.normalizeLink (EDU-83); không hợp lệ ⇒ null. */
export function normalizeLink(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length > 2000) return null;
  let u;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (GOOGLE_HOSTS.includes(host)) return text;
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (YOUTUBE_HOSTS.includes(host)) {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else id = (u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/) || [])[1];
  }
  return id && VIDEO_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Id video của link YouTube đã chuẩn hóa; link Google ⇒ null. */
export const youtubeId = (url) => (String(url || '').match(/^https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})$/) || [])[1] || null;

/** FR-016: phát qua tên miền không cookie, không tự phát. */
export const youtubeEmbed = (url) => (youtubeId(url) ? `https://www.youtube-nocookie.com/embed/${youtubeId(url)}?rel=0` : null);

export const defaultLinkTitle = (url) => (youtubeId(url) ? 'Video YouTube' : 'Tài liệu Google');

/** Loại hiển thị của học liệu kho / dòng gắn: youtube | google | image | video | pdf | file. */
export const resourceKind = (r) => (r?.kind === 'LINK' ? (youtubeId(r.url) ? 'youtube' : 'google') : mediaKind(r?.contentType || ''));

export const KIND_LABELS = { youtube: 'Video YouTube', google: 'Google Drive/Docs', image: 'Ảnh', video: 'Video', pdf: 'PDF', file: 'Tệp' };

export const norm = (s) =>
  String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/**
 * EDU-87 — mức gợi ý của một học liệu so với mục đang soạn: 'GOAL' (cùng id MT hoặc cùng mã mục tiêu Bộ) > 'THEME'
 * (cùng id chủ đề hoặc cùng tên chủ đề) > null. BE tính khi có server; mock dùng cùng hàm này.
 */
export function matchOf(tags = [], { goalIds = [], curriculumIds = [], themeId = null, themeName = '' } = {}) {
  const goals = new Set(goalIds.map(String));
  const codes = new Set(curriculumIds.filter((x) => x != null).map(String));
  const hitGoal = tags.some(
    (t) => t.kind === 'GOAL' && (goals.has(String(t.refId)) || (t.curriculumGoalId != null && codes.has(String(t.curriculumGoalId)))),
  );
  if (hitGoal) return 'GOAL';
  const name = norm(themeName);
  const hitTheme = tags.some(
    (t) => t.kind === 'THEME' && ((themeId != null && String(t.refId) === String(themeId)) || (name && norm(t.name) === name)),
  );
  return hitTheme ? 'THEME' : null;
}

const RANK = { GOAL: 0, THEME: 1 };

/** Xếp gợi ý: Cùng MT → Cùng chủ đề → cập nhật mới trước (SC-005). Không đổi mảng gốc. */
export const rankResources = (items) =>
  [...items].sort(
    (a, b) =>
      (RANK[a.match] ?? 2) - (RANK[b.match] ?? 2) ||
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) ||
      Number(b.id) - Number(a.id),
  );

export const MATCH_LABELS = { GOAL: 'Cùng MT', THEME: 'Cùng chủ đề' };

/* ---------- Spec 901: kho cá nhân, chủ đề đã dạy, khóa xóa/đổi tên ---------- */

/** Ngày hôm nay (yyyy-MM-dd) theo giờ Việt Nam. */
export const todayVn = (at = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(at);

const nextDay = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
export const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * EDU-85 (spec 901): học liệu bị khóa xóa/đổi tên khi gắn ở giáo án ngày Chờ duyệt, hoặc đã ban hành mà ngày dạy là hôm nay
 * hoặc chưa tới. deletableFrom = ngày dạy bị khóa muộn nhất + 1; có Chờ duyệt ⇒ null (chờ duyệt hoặc trả lại).
 */
export function deleteLock(usages = [], today = todayVn()) {
  const reasons = usages.filter((u) => u.status === 'REVIEW' || (u.status === 'APPROVED' && u.date >= today));
  if (!reasons.length) return { locked: false, deletableFrom: null, reasons };
  if (reasons.some((u) => u.status === 'REVIEW')) return { locked: true, deletableFrom: null, reasons };
  return {
    locked: true,
    deletableFrom: nextDay(
      reasons
        .map((u) => u.date)
        .sort()
        .at(-1),
    ),
    reasons,
  };
}

/** Câu "xóa được khi nào" của thông báo chặn (cùng câu với BE 7137). */
export const deletableText = (deletableFrom) =>
  deletableFrom ? `Xóa được từ ${dmy(deletableFrom)}.` : 'Xóa được sau khi giáo án được duyệt hoặc trả lại.';

export const NO_THEME = 'Chưa ghi chủ đề';

/**
 * Nhóm học liệu theo chủ đề đã dạy + năm học (`taughtThemes`); một học liệu dạy nhiều chủ đề có ở mọi nhóm.
 * Năm mới trước, tên A→Z; nhóm "Chưa ghi chủ đề" cuối.
 */
export function taughtThemeGroups(items = []) {
  const groups = new Map();
  const add = (key, base, item) => {
    if (!groups.has(key)) groups.set(key, { key, ...base, items: [] });
    groups.get(key).items.push(item);
  };
  for (const item of items) {
    const themes = (item.taughtThemes || []).filter((t) => norm(t.name));
    if (!themes.length) add('', { name: NO_THEME, schoolYearId: null, schoolYearName: null }, item);
    for (const t of themes)
      add(
        `${norm(t.name)}|${t.schoolYearId ?? ''}`,
        { name: t.name.trim(), schoolYearId: t.schoolYearId ?? null, schoolYearName: t.schoolYearName ?? null },
        item,
      );
  }
  return [...groups.values()].sort(
    (a, b) =>
      (a.key === '') - (b.key === '') ||
      String(b.schoolYearName || '').localeCompare(String(a.schoolYearName || '')) ||
      a.name.localeCompare(b.name, 'vi'),
  );
}
