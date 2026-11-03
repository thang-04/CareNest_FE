// Lịch sử phiên bản cho nội dung cấp lớp của đánh giá trẻ, làm theo kế hoạch giáo dục (Tiền chốt 03/11; bản riêng theo
// Cần chốt 03/11): bản đã lưu + tối đa 2 mốc chưa lưu trên máy, so khác biệt theo dòng.
export const MAX_DRAFTS = 2;

/** Mỗi lần soạn (session) một mốc, cập nhật tại chỗ; mới nhất trước, quá MAX_DRAFTS thì bỏ mốc cũ nhất. */
export function upsertDraft(list, entry, max = MAX_DRAFTS) {
  return [entry, ...(list || []).filter((x) => x.session !== entry.session)].sort((a, b) => b.savedAt - a.savedAt).slice(0, max);
}

/** Đọc bộ nhớ máy: dạng mới { entries } hoặc bản giữ cũ một mốc { doc, base, savedAt }. */
export function draftsOf(raw) {
  if (Array.isArray(raw?.entries)) return raw.entries.filter((x) => x?.doc);
  return raw?.doc ? [{ ...raw, session: 'legacy' }] : [];
}

const META = new Set(['id', 'key', 'status', 'history', 'revision', 'permissions', 'editing', 'version', 'signature', 'signers']);
const isMeta = (k) => META.has(k) || /(?:Id|Ids|At|Key)$/.test(k);

/** Dòng nội dung của tài liệu lớp: mọi chuỗi chữ theo thứ tự trong tài liệu, bỏ trường kỹ thuật. */
export function docLines(doc) {
  const out = [];
  const walk = (v, k) => {
    if (k && isMeta(k)) return;
    if (typeof v === 'string') {
      v.split('\n').forEach((line) => line.trim() && out.push(line.trim()));
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([key, x]) => walk(x, key));
  };
  walk(doc);
  return out;
}

/**
 * Khác biệt theo dòng từ `from` (bản đang mở) sang `to` (bản chọn xem): add = có ở bản chọn, del = chỉ có ở bản đang mở.
 * LCS O(n·m); quá lớn thì coi cả khối giữa là thay đổi để không treo trình duyệt.
 */
export function diffLines(from, to, limit = 4_000_000) {
  let start = 0;
  while (start < from.length && start < to.length && from[start] === to[start]) start++;
  let endA = from.length;
  let endB = to.length;
  while (endA > start && endB > start && from[endA - 1] === to[endB - 1]) {
    endA--;
    endB--;
  }
  const a = from.slice(start, endA);
  const b = to.slice(start, endB);
  const same = (xs) => xs.map((text) => ({ type: 'same', text }));
  let middle;
  if ((a.length + 1) * (b.length + 1) > limit) {
    middle = [...a.map((text) => ({ type: 'del', text })), ...b.map((text) => ({ type: 'add', text }))];
  } else {
    const n = a.length;
    const m = b.length;
    const len = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--) len[i][j] = a[i] === b[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    middle = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        middle.push({ type: 'same', text: a[i] });
        i++;
        j++;
      } else if (len[i + 1][j] >= len[i][j + 1]) middle.push({ type: 'del', text: a[i++] });
      else middle.push({ type: 'add', text: b[j++] });
    }
    while (i < n) middle.push({ type: 'del', text: a[i++] });
    while (j < m) middle.push({ type: 'add', text: b[j++] });
  }
  return [...same(from.slice(0, start)), ...middle, ...same(from.slice(endA))];
}
