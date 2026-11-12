const keyOf = (doc) => JSON.stringify(doc);

export const yearPlanContentKey = (doc) =>
  JSON.stringify({
    title: doc.title,
    description: doc.description || '',
    schoolYear: doc.schoolYear,
    ageGroupId: doc.ageGroupId,
    domains: (doc.domains || []).map((d) => ({
      name: d.name,
      rows: (d.rows || []).map((r) => ({
        id: r.id,
        kind: r.kind,
        text: r.text,
        displayLabel: r.displayLabel,
        contents: r.contents,
      })),
    })),
    themes: doc.themes || [],
    branchTemplates: doc.branchTemplates || [],
    breaks: doc.breaks || [],
  });

export function reconcileYearPlanIds(current, snapshot, saved) {
  const ids = new Map();
  const branchIds = new Map();
  const pair = (before = [], after = [], target = ids) =>
    before.forEach((item, i) => {
      if (after[i]) target.set(item.id, after[i].id);
    });
  pair(snapshot.themes, saved.themes);
  pair(snapshot.breaks, saved.breaks);
  pair(snapshot.branchTemplates, saved.branchTemplates, branchIds);
  for (const domain of snapshot.domains || []) {
    const target = saved.domains?.find((d) => d.name === domain.name) || saved.domains?.[snapshot.domains.indexOf(domain)];
    pair(domain.rows, target?.rows);
    domain.rows?.forEach((row, i) => pair(row.contents, target?.rows?.[i]?.contents));
  }
  const idOf = (id) => ids.get(id) ?? id;
  return {
    ...current,
    id: saved.id,
    revision: saved.revision,
    contentRevision: saved.contentRevision,
    previousSourcePlanId: saved.previousSourcePlanId,
    reviewItems: saved.reviewItems,
    newItems: saved.newItems,
    status: saved.status,
    permissions: saved.permissions,
    editing: saved.editing,
    themes: (current.themes || []).map((t) => ({ ...t, id: idOf(t.id) })),
    branchTemplates: (current.branchTemplates || []).map((t) => ({
      ...t, id: branchIds.get(t.id) ?? t.id, themeId: idOf(t.themeId),
    })),
    breaks: (current.breaks || []).map((b) => ({ ...b, id: idOf(b.id) })),
    domains: (current.domains || []).map((d) => ({
      ...d,
      rows: (d.rows || []).map((r) => ({
        ...r,
        id: idOf(r.id),
        ...(r.contents ? { contents: r.contents.map((c) => ({ ...c, id: idOf(c.id), themes: (c.themes || []).map(idOf) })) } : {}),
      })),
    })),
  };
}

// Chỉ ghi lên hệ thống khi người dùng bấm Lưu/Ctrl+S hoặc gửi/ban hành (Tiền chốt 27/10: bỏ tự lưu lên hệ thống).
export function createSaveQueue({ read, write, accept, onState, enabled = () => true, uuid = () => crypto.randomUUID() }) {
  let clean = keyOf(read());
  let flight = null;
  let attempt = null;
  let disposed = false;
  const dirty = () => !!attempt || keyOf(read()) !== clean;
  const run = () => {
    if (flight) return flight;
    if (!dirty()) return Promise.resolve(true);
    if (!enabled() || disposed) return Promise.resolve(false);
    // Lần lưu trước mất phản hồi thì gửi lại đúng requestId đó trước khi gửi nội dung mới
    attempt ??= { doc: structuredClone(read()), requestId: uuid() };
    const sending = attempt;
    onState('saving');
    flight = (async () => {
      try {
        const saved = await write(sending.doc, sending.requestId);
        if (!saved) throw new Error('Chưa lưu được');
        clean = keyOf(accept(saved, sending.doc));
        attempt = null;
        onState('saved');
        return true;
      } catch (error) {
        // EDU-62: phản hồi từ chối xác định không được replay payload cũ sau khi đổi nguồn/phiên.
        if (error.status >= 400 && error.status < 500) attempt = null;
        onState(error.status === 409 || error.status === 403 ? 'conflict' : 'error', error);
        return false;
      } finally {
        flight = null;
      }
    })();
    return flight;
  };
  return {
    dirty,
    markClean(doc) {
      clean = keyOf(doc);
      attempt = null;
    },
    async flush() {
      while (dirty()) {
        if (!(await run())) return false;
      }
      return true;
    },
    async settle() {
      return flight ? flight : true;
    },
    resume() {
      disposed = false;
    },
    dispose() {
      disposed = true;
    },
  };
}

export const recoveryKey = (userId, planKey) => `carenest:year-plan-recovery:${userId}:${planKey}`;

export function recoveryText(doc) {
  return [
    doc.title || 'Kế hoạch đang soạn',
    doc.schoolYear,
    doc.description,
    ...(doc.domains || []).flatMap((d) => [
      d.name,
      ...(d.rows || []).flatMap((r) => [
        r.text,
        ...(r.contents || []).map(
          (c) =>
            `${c.text}${c.themes?.length ? ` — Chủ đề: ${c.themes.map((id) => (doc.themes || []).find((theme) => String(theme.id) === String(id))?.name || id).join(', ')}` : ''}`,
        ),
      ]),
    ]),
    ...(doc.themes || []).map((t) => `${t.name || ''} (${t.abbr || ''}) ${t.start || ''} — ${t.end || ''}\n${t.note || ''}`),
    ...(doc.breaks || []).map((b) => `${b.label || ''}: ${b.start || ''} — ${b.end || ''}`),
  ]
    .filter(Boolean)
    .join('\n\n');
}
