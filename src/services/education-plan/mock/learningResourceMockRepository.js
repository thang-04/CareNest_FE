import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { ROLES } from '@/models/User';
import { eduError } from './eduMockErrors';
import {
  MAX_PER_SECTION,
  defaultLinkTitle,
  matchOf,
  normalizeLink,
  rankResources,
} from '@/models/education-plan/learningResources.mjs';

/*
 * BE giả của kho học liệu (BE:EDU-82…88, spec 900). Học liệu = mục kho (tệp/link) + dòng gắn vào giáo án ngày.
 * Tệp chỉ giữ trong phiên (object URL); danh mục lưu localStorage như các mock khác.
 */
const blobs = new Map();
const KEY_RE = /^\d{4}-\d{2}-\d{2}#(hoc|ngoai_troi|goc|chieu)$/;
const now = () => new Date().toISOString();

const store = (db) => {
  db.eduResources ||= { seq: 0, items: [], attachments: [] };
  return db.eduResources;
};
const nextId = (s) => (s.seq += 1);
const meOf = (db, user) => (db.users || []).find((u) => u.id === user?.id) || user || {};
// BE:EDU-84 — lớp người dùng đang dạy; tổ trưởng duyệt đề nghị của nhóm tuổi mình
const classIdsOf = (db, user) => (db.classes || []).filter((c) => (c.teacherIds || []).includes(user?.id)).map((c) => c.id);
const viewerOf = (db, user) => {
  const me = meOf(db, user);
  return {
    id: user?.id,
    vice: user?.role === ROLES.VICE_PRINCIPAL,
    classIds: classIdsOf(db, user),
    leaderAgeGroups: user?.role === ROLES.TEAM_LEADER && me.ageGroupId ? [me.ageGroupId] : [],
  };
};
const canReview = (v, i) =>
  i.shareStatus === 'PENDING' && i.ownerId !== v.id && (v.vice || (i.ageGroupId != null && v.leaderAgeGroups.includes(i.ageGroupId)));
const canEdit = (v, i) => i.ownerId === v.id || (v.vice && i.scope === 'SCHOOL');
const visible = (v, i) =>
  i.ownerId === v.id || i.scope === 'SCHOOL' || (i.scope === 'CLASS' && v.classIds.includes(i.classroomId)) || canReview(v, i);
const inView = (v, i, view) => {
  const mine = i.ownerId === v.id;
  if (view === 'MINE') return mine && !i.hidden;
  if (view === 'CLASS') return i.scope === 'CLASS' && !i.hidden && (mine || v.classIds.includes(i.classroomId));
  if (view === 'SCHOOL') return i.scope === 'SCHOOL' && !i.hidden;
  if (view === 'PENDING') return canReview(v, i);
  if (view === 'HIDDEN') return i.hidden && canEdit(v, i);
  return !i.hidden && (mine || i.scope !== 'MINE');
};

const usageOf = (s, id) => s.attachments.filter((a) => a.itemId === id).length;
const toItem = (s, v, i, extra = {}) => ({
  ...clone(i),
  fileName: i.originalName || null,
  mine: i.ownerId === v.id,
  usageCount: usageOf(s, i.id),
  canEdit: canEdit(v, i),
  canReview: canReview(v, i),
  match: null,
  attached: false,
  ...extra,
});

const requireItem = (s, v, id, edit = false) => {
  const item = s.items.find((i) => i.id === Number(id));
  if (!item || !visible(v, item)) throw eduError('RESOURCE_ITEM_NOT_FOUND');
  if (edit && !canEdit(v, item)) throw eduError('RESOURCE_ITEM_FORBIDDEN');
  return item;
};

const tagsFrom = (db, tags) => {
  if (!tags) return [];
  const goals = (db.eduGoals || []).flatMap((p) => p.rows || p.goals || []);
  const out = [];
  if (tags.themeId != null || tags.themeName) out.push({ kind: 'THEME', refId: tags.themeId ?? null, curriculumGoalId: null, name: tags.themeName || null });
  for (const id of [...new Set(tags.goalIds || [])]) {
    const g = goals.find((x) => String(x.id) === String(id));
    out.push({ kind: 'GOAL', refId: id, curriculumGoalId: g?.curriculumGoalId ?? g?.curriculumId ?? null, name: null });
  }
  return out;
};

const newItem = (db, s, user, fields, tags) => {
  const at = now();
  const item = {
    id: nextId(s),
    ownerId: user.id,
    scope: 'MINE',
    classroomId: null,
    shareStatus: null,
    shareReason: null,
    ageGroupId: null,
    hidden: false,
    tags: tagsFrom(db, tags),
    createdAt: at,
    updatedAt: at,
    ...fields,
  };
  s.items.push(item);
  return item;
};

const linkItem = (db, s, user, rawUrl, title, ageGroupId, tags) => {
  const url = normalizeLink(rawUrl);
  if (!url) throw eduError('RESOURCE_LINK_INVALID');
  // BE:EDU-83 — dán lại link đã có trong kho của mình thì dùng lại học liệu cũ
  const existing = s.items.find((i) => i.ownerId === user.id && i.kind === 'LINK' && i.url === url);
  if (existing) return existing;
  return newItem(db, s, user, { kind: 'LINK', title: title?.trim() || defaultLinkTitle(url), url, ageGroupId: ageGroupId ?? null }, tags);
};

const fileItem = (db, s, user, file, title, ageGroupId, tags) => {
  const item = newItem(
    db,
    s,
    user,
    {
      kind: 'FILE',
      title: title?.trim() || file.name.replace(/\.[^.]+$/, '') || file.name,
      originalName: file.name,
      contentType: file.type || 'application/octet-stream',
      byteSize: file.size,
      ageGroupId: ageGroupId ?? null,
    },
    tags,
  );
  if (typeof URL !== 'undefined' && URL.createObjectURL) blobs.set(item.id, URL.createObjectURL(file));
  return item;
};

/* ---------- Dòng gắn của giáo án ngày ---------- */

const rowOf = (s, a) => {
  const i = s.items.find((x) => x.id === a.itemId) || {};
  return {
    id: a.id,
    docKey: a.docKey,
    activityKey: a.activityKey,
    activityLabel: a.activityLabel,
    fileName: i.title,
    contentType: i.kind === 'LINK' ? 'text/uri-list' : i.contentType,
    byteSize: i.byteSize || 0,
    uploadedBy: a.createdBy,
    createdAt: a.createdAt,
    active: true,
    itemId: i.id,
    kind: i.kind,
    title: i.title,
    url: i.url || null,
    scope: i.scope,
  };
};

const attachAll = (s, user, docKey, binding, items) => {
  if (!KEY_RE.test(binding.activityKey || '')) throw eduError('ACTIVITY_CHANGED');
  const here = s.attachments.filter((a) => a.docKey === docKey && a.activityKey === binding.activityKey);
  if (items.some((i) => here.some((a) => a.itemId === i.id))) throw eduError('RESOURCE_ALREADY_ATTACHED');
  if (here.length + items.length > MAX_PER_SECTION) throw eduError('RESOURCE_SECTION_FULL', MAX_PER_SECTION);
  return items.map((i) => {
    const a = { id: nextId(s), docKey, activityKey: binding.activityKey, activityLabel: binding.activityLabel, itemId: i.id, createdBy: user.id, createdAt: now() };
    s.attachments.push(a);
    return rowOf(s, a);
  });
};

export const learningResourceMockRepository = {
  async list(_user, docKey) {
    await delay();
    const s = store(clone(readDb()));
    return s.attachments.filter((a) => a.docKey === docKey).map((a) => rowOf(s, a));
  },
  async upload(user, docKey, file, binding, _requestId, tags) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      return attachAll(s, user, docKey, binding, [fileItem(db, s, user, file, null, null, tags)])[0];
    });
  },
  async addLink(user, docKey, { url, title, activityKey, activityLabel, tags }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      return attachAll(s, user, docKey, { activityKey, activityLabel }, [linkItem(db, s, user, url, title, null, tags)])[0];
    });
  },
  async attach(user, docKey, { itemIds, activityKey, activityLabel }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const v = viewerOf(db, user);
      return attachAll(s, user, docKey, { activityKey, activityLabel }, [...new Set(itemIds)].map((id) => requireItem(s, v, id)));
    });
  },
  async detach(_user, docKey, id) {
    await delay();
    writeDb((db) => {
      const s = store(db);
      const at = s.attachments.findIndex((a) => a.id === Number(id) && a.docKey === docKey);
      if (at < 0) throw eduError('LEARNING_RESOURCE_NOT_FOUND');
      // BE:EDU-85 — chỉ xóa dòng gắn
      s.attachments.splice(at, 1);
    });
  },
  async contentUrl(_user, docKey, id) {
    await delay();
    const s = store(clone(readDb()));
    const a = s.attachments.find((x) => x.id === Number(id) && x.docKey === docKey);
    const i = a && s.items.find((x) => x.id === a.itemId);
    if (!i) throw eduError('LEARNING_RESOURCE_NOT_FOUND');
    if (i.kind === 'LINK') return i.url;
    if (!blobs.has(i.id)) throw eduError('STORAGE_NOT_CONFIGURED');
    return blobs.get(i.id);
  },
};

/* ---------- Trang Kho học liệu ---------- */

export const resourceLibraryMockRepository = {
  async list(user, query = {}) {
    await delay();
    const db = clone(readDb());
    const s = store(db);
    const v = viewerOf(db, user);
    const q = (query.q || '').trim().toLowerCase();
    const goals = (db.eduGoals || []).flatMap((p) => p.rows || p.goals || []);
    const curriculumIds = (query.goalIds || []).map((id) => goals.find((g) => String(g.id) === String(id))?.curriculumGoalId).filter((x) => x != null);
    const attached = new Set(
      s.attachments.filter((a) => a.docKey === query.docKey && a.activityKey === query.activityKey).map((a) => a.itemId),
    );
    const rows = s.items
      .filter((i) => visible(v, i) && inView(v, i, query.view || 'ALL'))
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .filter((i) => !query.kind || i.kind === query.kind)
      .filter((i) => !query.ageGroupId || i.ageGroupId == null || String(i.ageGroupId) === String(query.ageGroupId))
      .map((i) =>
        toItem(s, v, i, {
          match: matchOf(i.tags, { goalIds: query.goalIds || [], curriculumIds, themeId: query.themeId, themeName: query.themeName }),
          attached: attached.has(i.id),
        }),
      );
    const size = Math.min(50, query.size || 50);
    const page = query.page || 0;
    const ranked = rankResources(rows);
    return { items: ranked.slice(page * size, page * size + size), page, size, totalElements: ranked.length, totalPages: Math.ceil(ranked.length / size) };
  },
  async upload(user, file, { title, ageGroupId } = {}) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      return toItem(s, viewerOf(db, user), fileItem(db, s, user, file, title, ageGroupId));
    });
  },
  async addLink(user, { url, title, ageGroupId }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      return toItem(s, viewerOf(db, user), linkItem(db, s, user, url, title, ageGroupId));
    });
  },
  async update(user, id, patch) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const v = viewerOf(db, user);
      const i = requireItem(s, v, id, true);
      if (patch.title != null) i.title = patch.title.trim() || i.title;
      if (patch.clearAgeGroup) i.ageGroupId = null;
      else if (patch.ageGroupId != null) i.ageGroupId = patch.ageGroupId;
      if (patch.hidden != null) i.hidden = !!patch.hidden;
      if (patch.tags) i.tags = tagsFrom(db, patch.tags);
      i.updatedAt = now();
      return toItem(s, v, i);
    });
  },
  async share(user, id, { scope, classroomId }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const v = viewerOf(db, user);
      const i = requireItem(s, v, id, true);
      if (i.shareStatus === 'PENDING') throw eduError('RESOURCE_PENDING_REVIEW');
      if (scope === 'CLASS') {
        if (i.ownerId !== v.id || !v.classIds.includes(classroomId)) throw eduError('RESOURCE_ITEM_FORBIDDEN');
        Object.assign(i, { scope: 'CLASS', classroomId, shareStatus: null });
      } else if (scope === 'SCHOOL') {
        if (i.scope === 'SCHOOL') throw eduError('RESOURCE_SHARE_STATE');
        // BE:EDU-84 — PHT đưa thẳng; giáo viên/tổ trưởng gửi đề nghị
        if (v.vice) Object.assign(i, { scope: 'SCHOOL', classroomId: null, shareStatus: null });
        else Object.assign(i, { shareStatus: 'PENDING', shareReason: null });
      } else Object.assign(i, { scope: 'MINE', classroomId: null, shareStatus: null });
      i.updatedAt = now();
      return toItem(s, v, i);
    });
  },
  async withdraw(user, id) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const v = viewerOf(db, user);
      const i = requireItem(s, v, id);
      if (i.ownerId !== v.id) throw eduError('RESOURCE_ITEM_FORBIDDEN');
      if (i.shareStatus !== 'PENDING') throw eduError('RESOURCE_SHARE_STATE');
      i.shareStatus = null;
      i.updatedAt = now();
      return toItem(s, v, i);
    });
  },
  async review(user, id, { approve, reason }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const v = viewerOf(db, user);
      const i = requireItem(s, v, id);
      if (i.shareStatus !== 'PENDING') throw eduError('RESOURCE_SHARE_STATE');
      if (!canReview(v, i)) throw eduError('RESOURCE_ITEM_FORBIDDEN');
      if (!approve && !reason?.trim()) throw eduError('RESOURCE_REVIEW_REASON_REQUIRED');
      if (approve) Object.assign(i, { scope: 'SCHOOL', classroomId: null, shareStatus: null, shareReason: null });
      else Object.assign(i, { shareStatus: 'REJECTED', shareReason: reason.trim() });
      i.updatedAt = now();
      return toItem(s, v, i);
    });
  },
  async remove(user, id) {
    await delay();
    writeDb((db) => {
      const s = store(db);
      const i = requireItem(s, viewerOf(db, user), id, true);
      if (i.shareStatus === 'PENDING') throw eduError('RESOURCE_PENDING_REVIEW');
      const used = usageOf(s, i.id);
      if (used) throw eduError('RESOURCE_ITEM_IN_USE', used);
      s.items = s.items.filter((x) => x.id !== i.id);
      blobs.delete(i.id);
    });
  },
  async usages(user, id) {
    await delay();
    const db = clone(readDb());
    const s = store(db);
    requireItem(s, viewerOf(db, user), id);
    return s.attachments
      .filter((a) => a.itemId === Number(id))
      .map((a) => ({ attachmentId: a.id, docKey: a.docKey, classroomId: null, date: a.activityKey.split('#')[0], activityKey: a.activityKey, activityLabel: a.activityLabel }));
  },
  async contentUrl(user, id) {
    await delay();
    const db = clone(readDb());
    const s = store(db);
    const i = requireItem(s, viewerOf(db, user), id);
    if (i.kind === 'LINK') return i.url;
    if (!blobs.has(i.id)) throw eduError('STORAGE_NOT_CONFIGURED');
    return blobs.get(i.id);
  },
};
