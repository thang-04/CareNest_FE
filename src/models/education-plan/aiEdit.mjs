// BE:EDU-95 "Sửa theo yêu cầu": áp các ô AI đề xuất (đường dẫn kiểu days.0.sections.hoc.aims) vào bản đang soạn.
// Ô đã khác bản AI đọc (cô vừa sửa, chưa lưu) thì bỏ qua để không ghi đè chữ của cô.

const keysOf = (path) => String(path).split('.');

export function valueAt(doc, path) {
  return keysOf(path).reduce((node, k) => (node == null ? undefined : node[k]), doc);
}

/** Trả { doc, applied, skipped }; doc là bản sao đã áp, không đổi bản truyền vào. */
export function applyCellChanges(doc, changes) {
  const next = structuredClone(doc);
  const applied = [];
  const skipped = [];
  for (const c of changes || []) {
    const keys = keysOf(c.path);
    const parent = keys.slice(0, -1).reduce((node, k) => (node == null ? undefined : node[k]), next);
    const last = keys[keys.length - 1];
    if (parent == null || typeof parent !== 'object' || (parent[last] ?? '') !== (c.before ?? '')) skipped.push(c);
    else {
      parent[last] = c.after;
      applied.push(c);
    }
  }
  return { doc: next, applied, skipped };
}
