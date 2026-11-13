// BE:EDU-81 — học liệu gắn một mục hoạt động của một ngày trong kế hoạch giáo dục ngày: activityKey = "yyyy-MM-dd#mục".
export const sectionKey = (date, section) => `${date}#${section}`;

/** Học liệu đang gắn đúng mục của ngày (BE trả `active` = mục còn hợp lệ trong tuần). */
export const resourcesOf = (items, date, section) =>
  items.filter((r) => r.active && r.activityKey === sectionKey(date, section));

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
export const resourceKind = (r) =>
  r?.kind === 'LINK' ? (youtubeId(r.url) ? 'youtube' : 'google') : mediaKind(r?.contentType || '');

export const KIND_LABELS = { youtube: 'Video YouTube', google: 'Google Drive/Docs', image: 'Ảnh', video: 'Video', pdf: 'PDF', file: 'Tệp' };
export const SCOPE_LABELS = { MINE: 'Của tôi', CLASS: 'Của lớp', SCHOOL: 'Của trường' };

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

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
