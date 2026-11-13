import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { eduError } from './eduMockErrors';
import {
  MAX_PER_SECTION,
  defaultLinkTitle,
  deleteLock,
  deletableText,
  dmy,
  matchOf,
  norm,
  normalizeLink,
  rankResources,
  todayVn,
} from '@/models/education-plan/learningResources.mjs';

/*
 * BE giả của kho học liệu cá nhân (BE:EDU-82…88, spec 901). Học liệu = mục kho (tệp/link) của đúng một người + dòng gắn vào
 * giáo án ngày. Nhãn tự thêm gắn với dòng gắn (attachmentId), gỡ dòng gắn là mất; nhãn thêm tay (attachmentId null) chỉ bỏ tay.
 * Dữ liệu mock cũ có scope/shareStatus/hidden: bỏ qua, coi như kho của người tạo. Tệp chỉ giữ trong phiên (object URL).
 */
const blobs = new Map();
const KEY_RE = /^\d{4}-\d{2}-\d{2}#(hoc|ngoai_troi|goc|chieu)$/;
const now = () => new Date().toISOString();

const store = (db) => {
  db.eduResources ||= { seq: 0, items: [], attachments: [] };
  return db.eduResources;
};
const nextId = (s) => (s.seq += 1);
// Nhãn mock cũ chưa có id: lấy id theo nội dung để bỏ nhãn được ổn định
const tagKey = (t) => `${t.kind}:${t.refId ?? ''}:${norm(t.name)}:${t.schoolYearId ?? ''}`;
const tagId = (t) => t.id ?? tagKey(t);

const requireOwned = (s, user, id) => {
  const item = s.items.find((i) => i.id === Number(id));
  if (!item || item.ownerId !== user?.id) throw eduError('RESOURCE_ITEM_NOT_FOUND');
  return item;
};

/* Giáo án ngày dd_X dùng chung khóa với giáo án tuần wp_X; trạng thái theo giáo án tuần + hồ sơ chủ đề. */
const PENDING = new Set([EDU_STATUS.REVIEW, EDU_STATUS.SENT, EDU_STATUS.PENDING_TL, EDU_STATUS.PENDING_VP, EDU_STATUS.PENDING_HT]);
const weekOf = (db, docKey) => (db.eduClassWeek || []).find((w) => w.id === `wp_${String(docKey).replace(/^dd_/, '')}`) || null;
const dayStatusOf = (db, docKey) => {
  const week = weekOf(db, docKey);
  if (!week) return EDU_STATUS.DRAFT;
  const dossier = (db.eduClassTheme || []).find(
    (t) => t.classId === week.classId && t.yearPlanId === week.yearPlanId && t.themeId === week.themeId,
  );
  const states = [week.status, dossier?.status];
  if (states.some((x) => PENDING.has(x))) return 'REVIEW';
  return states.includes(EDU_STATUS.APPROVED) ? EDU_STATUS.APPROVED : EDU_STATUS.DRAFT;
};
const schoolYearOf = (db, docKey) => {
  const week = weekOf(db, docKey);
  return (db.eduGoals || []).find((g) => g.id === week?.yearPlanId)?.schoolYear ?? null;
};

/** Nhãn tự thêm của một dòng gắn: chủ đề của ngày (+ năm học của lớp) và MT của mục. */
const autoTags = (db, s, tags, attachmentId, schoolYear) => {
  if (!tags) return [];
  const goals = (db.eduGoals || []).flatMap((p) => p.rows || p.goals || []);
  const year = { schoolYearId: schoolYear, schoolYearName: schoolYear };
  const out = [];
  if (tags.themeId != null || tags.themeName)
    out.push({ kind: 'THEME', refId: tags.themeId ?? null, curriculumGoalId: null, name: tags.themeName || null, ...year });
  for (const id of [...new Set(tags.goalIds || [])]) {
    const g = goals.find((x) => String(x.id) === String(id));
    out.push({ kind: 'GOAL', refId: id, curriculumGoalId: g?.curriculumGoalId ?? g?.curriculumId ?? null, name: null, ...year });
  }
  return out.map((t) => ({ ...t, id: nextId(s), attachmentId }));
};

const toTag = (t) => ({
  id: tagId(t),
  kind: t.kind,
  refId: t.refId ?? null,
  curriculumGoalId: t.curriculumGoalId ?? null,
  name: t.name ?? null,
  schoolYearId: t.schoolYearId ?? null,
  schoolYearName: t.schoolYearName ?? t.schoolYearId ?? null,
  auto: t.attachmentId != null,
});
// Chủ đề đã dạy = nhãn THEME có tên, gộp trùng theo tên chuẩn hóa + năm học
const taughtOf = (tags) => {
  const seen = new Map();
  for (const t of tags.filter((x) => x.kind === 'THEME' && norm(x.name))) {
    const key = `${norm(t.name)}|${t.schoolYearId ?? ''}`;
    if (!seen.has(key)) seen.set(key, { name: t.name.trim(), schoolYearId: t.schoolYearId, schoolYearName: t.schoolYearName });
  }
  return [...seen.values()];
};
const toItem = (s, i, extra = {}) => {
  const tags = (i.tags || []).map(toTag);
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    url: i.url || null,
    fileName: i.originalName || null,
    contentType: i.contentType || null,
    byteSize: i.byteSize || null,
    ownerId: i.ownerId,
    ageGroupId: i.ageGroupId ?? null,
    tags,
    taughtThemes: taughtOf(tags),
    usageCount: s.attachments.filter((a) => a.itemId === i.id).length,
    match: null,
    attached: false,
    updatedAt: i.updatedAt,
    ...extra,
  };
};

const newItem = (s, user, fields) => {
  const at = now();
  const item = { id: nextId(s), ownerId: user.id, ageGroupId: null, tags: [], createdAt: at, updatedAt: at, ...fields };
  s.items.push(item);
  return item;
};

const linkItem = (s, user, rawUrl, title) => {
  const url = normalizeLink(rawUrl);
  if (!url) throw eduError('RESOURCE_LINK_INVALID');
  // BE:EDU-83 — dán lại link đã có trong kho của mình thì dùng lại học liệu cũ
  const existing = s.items.find((i) => i.ownerId === user.id && i.kind === 'LINK' && i.url === url);
  return existing || newItem(s, user, { kind: 'LINK', title: title?.trim() || defaultLinkTitle(url), url });
};

const fileItem = (s, user, file) => {
  const item = newItem(s, user, {
    kind: 'FILE',
    title: file.name.replace(/\.[^.]+$/, '') || file.name,
    originalName: file.name,
    contentType: file.type || 'application/octet-stream',
    byteSize: file.size,
  });
  if (typeof URL !== 'undefined' && URL.createObjectURL) blobs.set(item.id, URL.createObjectURL(file));
  return item;
};

/** Nơi đang dùng + khóa (BE:EDU-85, spec 901). */
const usagesOf = (db, s, itemId) => {
  const today = todayVn();
  const rows = s.attachments
    .filter((a) => a.itemId === itemId)
    .map((a) => {
      const status = dayStatusOf(db, a.docKey);
      const date = a.activityKey.split('#')[0];
      return {
        attachmentId: a.id,
        docKey: a.docKey,
        classroomId: weekOf(db, a.docKey)?.classId ?? null,
        date,
        activityKey: a.activityKey,
        activityLabel: a.activityLabel,
        status,
        locked: status === 'REVIEW' || (status === EDU_STATUS.APPROVED && date >= today),
      };
    });
  return { rows, ...deleteLock(rows, today) };
};
const requireUnlocked = (db, s, item) => {
  const lock = usagesOf(db, s, item.id);
  if (!lock.locked) return lock;
  const className = (id) => (db.classes || []).find((c) => c.id === id)?.name || 'Lớp';
  const where = lock.reasons.map((u) => `${className(u.classroomId)} – ${dmy(u.date)} – ${u.activityLabel}`).join('; ');
  throw eduError('RESOURCE_ITEM_LOCKED', where, deletableText(lock.deletableFrom));
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
  };
};

const attachAll = (db, s, user, docKey, binding, items, tags) => {
  if (!KEY_RE.test(binding.activityKey || '')) throw eduError('ACTIVITY_CHANGED');
  const here = s.attachments.filter((a) => a.docKey === docKey && a.activityKey === binding.activityKey);
  if (items.some((i) => here.some((a) => a.itemId === i.id))) throw eduError('RESOURCE_ALREADY_ATTACHED');
  if (here.length + items.length > MAX_PER_SECTION) throw eduError('RESOURCE_SECTION_FULL', MAX_PER_SECTION);
  const year = schoolYearOf(db, docKey);
  return items.map((i) => {
    // Gắn sau đứng sau (BE:EDU-82: trùng số thì xếp theo id)
    const a = {
      id: nextId(s),
      docKey,
      activityKey: binding.activityKey,
      activityLabel: binding.activityLabel,
      itemId: i.id,
      sortOrder: here.length,
      createdBy: user.id,
      createdAt: now(),
    };
    s.attachments.push(a);
    i.tags = [...(i.tags || []), ...autoTags(db, s, tags, a.id, year)];
    return rowOf(s, a);
  });
};

// Xóa dòng gắn kéo theo nhãn tự thêm của dòng đó
const dropAttachments = (s, ids) => {
  const gone = new Set(ids);
  s.attachments = s.attachments.filter((a) => !gone.has(a.id));
  s.items.forEach((i) => {
    i.tags = (i.tags || []).filter((t) => !gone.has(t.attachmentId));
  });
};

export const learningResourceMockRepository = {
  async list(_user, docKey) {
    await delay();
    const s = store(clone(readDb()));
    return s.attachments
      .filter((a) => a.docKey === docKey)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)
      .map((a) => rowOf(s, a));
  },
  async upload(user, docKey, file, binding, _requestId, tags) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      return attachAll(db, s, user, docKey, binding, [fileItem(s, user, file)], tags)[0];
    });
  },
  async addLink(user, docKey, { url, title, activityKey, activityLabel, tags }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      return attachAll(db, s, user, docKey, { activityKey, activityLabel }, [linkItem(s, user, url, title)], tags)[0];
    });
  },
  /** Chỉ gắn học liệu trong kho của người gắn (FR-013). */
  async attach(user, docKey, { itemIds, activityKey, activityLabel, tags }) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const items = [...new Set(itemIds)].map((id) => requireOwned(s, user, id));
      return attachAll(db, s, user, docKey, { activityKey, activityLabel }, items, tags);
    });
  },
  async detach(_user, docKey, id) {
    await delay();
    writeDb((db) => {
      const s = store(db);
      const a = s.attachments.find((x) => x.id === Number(id) && x.docKey === docKey);
      if (!a) throw eduError('LEARNING_RESOURCE_NOT_FOUND');
      // BE:EDU-85 — chỉ xóa dòng gắn, học liệu vẫn ở kho
      dropAttachments(s, [a.id]);
    });
  },
  async reorder(user, docKey, { activityKey, ids }) {
    await delay();
    writeDb((db) => {
      const s = store(db);
      const here = s.attachments.filter((a) => a.docKey === docKey && a.activityKey === activityKey);
      // BE:EDU-82 — phải gửi đủ đúng các dòng gắn đang có của mục
      if (ids.length !== here.length || !here.every((a) => ids.map(Number).includes(a.id))) throw eduError('RESOURCE_ORDER_STALE');
      here.forEach((a) => {
        a.sortOrder = ids.map(Number).indexOf(a.id);
      });
    });
    return this.list(user, docKey);
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

/* ---------- Trang Kho học liệu (chỉ chủ sở hữu) ---------- */

export const resourceLibraryMockRepository = {
  async list(user, query = {}) {
    await delay();
    const db = clone(readDb());
    const s = store(db);
    const q = (query.q || '').trim().toLowerCase();
    const theme = norm(query.teachThemeName);
    const year = query.schoolYearId ?? null;
    const goals = (db.eduGoals || []).flatMap((p) => p.rows || p.goals || []);
    const curriculumIds = (query.goalIds || [])
      .map((id) => goals.find((g) => String(g.id) === String(id))?.curriculumGoalId)
      .filter((x) => x != null);
    const attached = new Set(
      s.attachments.filter((a) => a.docKey === query.docKey && a.activityKey === query.activityKey).map((a) => a.itemId),
    );
    const taught = (i) =>
      (i.tags || []).some(
        (t) => t.kind === 'THEME' && (!theme || norm(t.name) === theme) && (year == null || String(t.schoolYearId) === String(year)),
      );
    const rows = s.items
      .filter((i) => i.ownerId === user?.id)
      .filter((i) => !q || i.title.toLowerCase().includes(q))
      .filter((i) => !query.kind || i.kind === query.kind)
      .filter((i) => !query.ageGroupId || i.ageGroupId == null || String(i.ageGroupId) === String(query.ageGroupId))
      .filter((i) => (!theme && year == null) || taught(i))
      .map((i) =>
        toItem(s, i, {
          match: matchOf(i.tags, { goalIds: query.goalIds || [], curriculumIds, themeId: query.themeId, themeName: query.themeName }),
          attached: attached.has(i.id),
        }),
      );
    const size = Math.min(50, query.size || 50);
    const page = query.page || 0;
    const ranked = rankResources(rows);
    return {
      items: ranked.slice(page * size, page * size + size),
      page,
      size,
      totalElements: ranked.length,
      totalPages: Math.ceil(ranked.length / size),
    };
  },
  /** patch: { title?, ageGroupId?, clearAgeGroup?, themes?: [{ themeId?, name, schoolYearId? }], goals?: [{ goalId, curriculumGoalId?, name? }], removeTagIds? } */
  async update(user, id, patch) {
    await delay();
    return writeDb((db) => {
      const s = store(db);
      const i = requireOwned(s, user, id);
      if (patch.title != null && patch.title.trim() && patch.title.trim() !== i.title) {
        requireUnlocked(db, s, i);
        i.title = patch.title.trim();
      }
      if (patch.clearAgeGroup) i.ageGroupId = null;
      else if (patch.ageGroupId != null) i.ageGroupId = patch.ageGroupId;
      // Chỉ bỏ được nhãn thêm tay; nhãn tự thêm đi theo dòng gắn
      const drop = new Set((patch.removeTagIds || []).map(String));
      i.tags = (i.tags || []).filter((t) => t.attachmentId != null || !drop.has(String(tagId(t))));
      const added = [
        ...(patch.themes || [])
          .filter((t) => norm(t.name))
          .map((t) => ({
            kind: 'THEME',
            refId: t.themeId ?? null,
            curriculumGoalId: null,
            name: t.name.trim(),
            schoolYearId: t.schoolYearId ?? null,
            schoolYearName: t.schoolYearId ?? null,
          })),
        ...(patch.goals || []).map((g) => ({
          kind: 'GOAL',
          refId: g.goalId,
          curriculumGoalId: g.curriculumGoalId ?? null,
          name: g.name ?? null,
          schoolYearId: null,
          schoolYearName: null,
        })),
      ];
      for (const t of added)
        if (!i.tags.some((x) => x.attachmentId == null && tagKey(x) === tagKey(t)))
          i.tags.push({ ...t, id: nextId(s), attachmentId: null });
      i.updatedAt = now();
      return toItem(s, i);
    });
  },
  /** Xóa vĩnh viễn: bị khóa ⇒ 7137; còn lại xóa mọi dòng gắn, nhãn và học liệu (EDU-85, spec 901). */
  async remove(user, id) {
    await delay();
    writeDb((db) => {
      const s = store(db);
      const i = requireOwned(s, user, id);
      requireUnlocked(db, s, i);
      dropAttachments(
        s,
        s.attachments.filter((a) => a.itemId === i.id).map((a) => a.id),
      );
      s.items = s.items.filter((x) => x.id !== i.id);
      blobs.delete(i.id);
    });
  },
  async usages(user, id) {
    await delay();
    const db = clone(readDb());
    const s = store(db);
    const { rows, locked, deletableFrom } = usagesOf(db, s, requireOwned(s, user, id).id);
    return { rows, locked, deletableFrom };
  },
  async contentUrl(user, id) {
    await delay();
    const s = store(clone(readDb()));
    const i = requireOwned(s, user, id);
    if (i.kind === 'LINK') return i.url;
    if (!blobs.has(i.id)) throw eduError('STORAGE_NOT_CONFIGURED');
    return blobs.get(i.id);
  },
};
