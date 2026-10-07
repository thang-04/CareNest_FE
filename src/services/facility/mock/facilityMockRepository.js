import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { lockedLocationMap } from '@/mocks/inventoryLock';
import { buildSeedFacility } from '@/mocks/facilitySeed';
import { uid } from '@/utils/id';
import { normalizeText } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import { ROLES } from '@/models/User';
import { ASSET_CONDITION_LABELS } from '@/models/Asset';
import {
  ISSUE_STATUS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  REQUEST_STATUS,
  REQUEST_ITEM_MODES,
  PROPOSAL_STATUS,
  PROPOSAL_ACTION_LABELS,
  SOURCE_TYPES,
} from '@/models/facility/facilityConstants';
import {
  validateIssue,
  validateRequest,
  validateProposal,
  validateReason,
  hasErrors,
  firstError,
} from '@/utils/facility/facilityValidation';
import {
  facilityLocationIds,
  inScope,
  canReportIssue,
  canViewIssueList,
  canViewIssue,
  canDecideIssue,
  canCreateRequest,
  canViewRequestList,
  canViewRequest,
  canReviewRequest,
  canPrincipalDecideRequest,
  canCreateProposal,
  canViewProposalList,
  canViewProposal,
  canEditProposal,
  canCancelProposal,
  canDecideProposal,
  canAddToProposal,
} from '@/utils/facility/facilityPermissions';

/*
 * Fake backend of the facility module (UC 7.2 Report Facility Issue, UC 7.3/7.4 Request / Review Facility Request,
 * Create / Approve-Reject Facility Proposals; GBR-FAC-01..10). Spring Boot must enforce the same rules.
 */

const COLLECTIONS = ['facilityIssues', 'facilityRequests', 'facilityProposals'];

// Databases saved before this module existed have no facility data yet.
const ensureSeeded = (db) => {
  const seed = buildSeedFacility();
  COLLECTIONS.forEach((key) => {
    db[key] ||= clone(seed[key]);
  });
  return db;
};

const readSeeded = () => {
  if (COLLECTIONS.some((key) => !readDb()[key])) writeDb(ensureSeeded);
  return readDb();
};

const now = () => new Date().toISOString();
const fail = (status, message, details) => {
  throw new ApiError(status, message, details);
};
const requireUser = (db, user) => {
  if (!user?.id) fail(401, 'Bạn chưa đăng nhập');
  // Role and campus come from the account record, never from what the client sent.
  return db.users.find((u) => u.id === user.id) || user;
};
const scopeOf = (db, me) => facilityLocationIds(me, { locations: db.locations, classes: db.classes || [] });
const locName = (db, id) => locationLabel(db.locations.find((l) => l.id === id));
const addHistory = (doc, action, me, note = '') => doc.history.push({ id: uid('fh'), action, userId: me.id, at: now(), note });

const nextCode = (list, prefix) => {
  const max = list.reduce((m, x) => Math.max(m, parseInt(String(x.code).replace(/\D/g, ''), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};

const vicePrincipalsOf = (db, campusId) => db.users.filter((u) => u.role === ROLES.VICE_PRINCIPAL && u.campusId === campusId);
const principals = (db) => db.users.filter((u) => u.role === ROLES.PRINCIPAL);
const notify = (db, users, payload) => users.forEach((u) => pushNotification(db, { ...payload, userId: u.id || u }));

const matchesKeyword = (keyword, ...texts) => {
  const q = normalizeText(keyword || '');
  return !q || texts.some((t) => normalizeText(t || '').includes(q));
};

const proposalById = (db, id) => (id ? db.facilityProposals.find((p) => p.id === id) : undefined);

/** Adds read-only facts the UI needs (lock, linked proposal) without storing them. */
const withExtras = (db, doc) => {
  const p = proposalById(db, doc.proposalId);
  return {
    ...clone(doc),
    lockedBy: lockedLocationMap(db)[doc.locationId] || null,
    proposal: p ? { id: p.id, code: p.code, status: p.status } : null,
  };
};

/* ---------------- Facility list (#109) ---------------- */

const listAssets = async (filters = {}, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  const scope = scopeOf(db, me);
  const locks = lockedLocationMap(db);
  const openByAsset = {};
  db.facilityIssues
    .filter((i) => i.status === ISSUE_STATUS.SUBMITTED)
    .forEach((i) => {
      openByAsset[i.assetId] = (openByAsset[i.assetId] || 0) + 1;
    });
  const locationById = Object.fromEntries(db.locations.map((l) => [l.id, l]));
  return clone(
    db.assets
      // GBR-FAC-01: food stock is not a facility item; it is kept in another collection, so every asset line counts.
      .filter((a) => a.quantity > 0 && inScope(scope, a.locationId))
      .filter((a) => !filters.campusId || locationById[a.locationId]?.campusId === filters.campusId)
      .filter((a) => !filters.locationId || a.locationId === filters.locationId)
      .filter((a) => !filters.categoryId || a.categoryId === filters.categoryId)
      .filter((a) => !filters.condition || a.condition === filters.condition)
      .filter((a) => matchesKeyword(filters.keyword, a.name, a.code))
      .map((a) => ({
        ...a,
        campusId: locationById[a.locationId]?.campusId,
        openIssueCount: openByAsset[a.id] || 0,
        lockedBy: locks[a.locationId] || null,
      })),
  );
};

const getScopeLocations = async (user) => {
  await delay(60);
  const db = readSeeded();
  const me = requireUser(db, user);
  const scope = scopeOf(db, me);
  return clone(db.locations.filter((l) => inScope(scope, l.id)));
};

/* ---------------- Issues (#110, #112, #117, #118) ---------------- */

const findIssue = (db, id) => db.facilityIssues.find((i) => i.id === id) || fail(404, 'Không tìm thấy báo cáo sự cố');

/** GBR-FAC-04: one open report per item and issue type. */
const findOpenIssue = (db, assetId, type) =>
  db.facilityIssues.find((i) => i.assetId === assetId && i.type === type && i.status === ISSUE_STATUS.SUBMITTED);

const checkOpenIssue = async (assetId, type, user) => {
  await delay(60);
  const db = readSeeded();
  requireUser(db, user);
  const found = findOpenIssue(db, assetId, type);
  return found ? { id: found.id, code: found.code, reporterId: found.reporterId, createdAt: found.createdAt } : null;
};

const listIssues = async (filters = {}, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  if (!canViewIssueList(me)) fail(403, 'Bạn không có quyền xem danh sách sự cố');
  return db.facilityIssues
    .filter((i) => canViewIssue(i, me))
    .filter((i) => !filters.status || filters.status === 'ALL' || i.status === filters.status)
    .filter((i) => !filters.type || i.type === filters.type)
    .filter((i) => !filters.campusId || i.campusId === filters.campusId)
    .filter((i) => !filters.locationId || i.locationId === filters.locationId)
    .filter((i) => matchesKeyword(filters.keyword, i.code, i.assetName, i.assetCode, i.description))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => withExtras(db, i));
};

const getIssue = async (id, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  const issue = findIssue(db, id);
  if (!canViewIssue(issue, me)) fail(403, 'Bạn không có quyền xem báo cáo này');
  return withExtras(db, issue);
};

const createIssue = async (payload, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    if (!canReportIssue(me)) fail(403, 'Chỉ giáo viên và nhân viên bếp được báo sự cố cơ sở vật chất');
    const asset = db.assets.find((a) => a.id === payload.assetId) || fail(404, 'Tài sản không còn trong danh sách');
    // GBR-FAC-03: only the facilities of the reporter's own class / kitchen.
    if (!inScope(scopeOf(db, me), asset.locationId)) fail(403, 'Bạn chỉ báo được sự cố cho tài sản của lớp/phòng mình phụ trách');
    const form = { ...payload, locationId: asset.locationId };
    const errors = validateIssue(form, asset);
    if (hasErrors(errors)) fail(422, firstError(errors), errors);

    const existing = findOpenIssue(db, asset.id, payload.type);
    if (existing) {
      // GBR-FAC-04: a second report of the same open issue is linked to the first one instead of creating a new record.
      const already = existing.reporterId === me.id || existing.linkedReports.some((r) => r.userId === me.id);
      if (!already) {
        existing.linkedReports.push({ userId: me.id, at: now(), description: form.description.trim() });
        addHistory(existing, 'LINKED', me, form.description.trim());
      }
      return { duplicate: true, alreadyLinked: already, issue: withExtras(db, existing) };
    }

    const location = db.locations.find((l) => l.id === asset.locationId);
    const issue = {
      id: uid('fi'),
      code: nextCode(db.facilityIssues, 'BH'),
      campusId: location.campusId,
      locationId: asset.locationId,
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      unit: asset.unit,
      type: payload.type,
      quantity: Number(payload.quantity),
      currentQuantity: payload.type === ISSUE_TYPES.INSUFFICIENT ? Number(payload.currentQuantity) : null,
      description: form.description.trim(),
      images: payload.images || [],
      status: ISSUE_STATUS.SUBMITTED,
      reporterId: me.id,
      createdAt: now(),
      responseNote: '',
      rejectReason: '',
      newCondition: null,
      assetChange: null,
      decidedAt: null,
      decidedBy: null,
      decidedByRole: null,
      linkedReports: [],
      proposalId: null,
      history: [],
    };
    addHistory(issue, 'SUBMITTED', me);
    db.facilityIssues.unshift(issue);
    // GBR-FAC-06: routed to the Vice Principal of the item's campus.
    notify(db, vicePrincipalsOf(db, issue.campusId), {
      type: 'FACILITY_ISSUE_SUBMITTED',
      title: `Báo sự cố mới ${issue.code}`,
      message: `${me.fullName} báo ${ISSUE_TYPE_LABELS[issue.type].toLowerCase()}: ${issue.assetName} – ${locName(db, issue.locationId)}.`,
      link: `/facility/issues/${issue.id}`,
    });
    return { duplicate: false, issue: withExtras(db, issue) };
  });
};

/** GBR-FAC-07: an approved report updates the facility list; quantities change only here and are logged before/after. */
const applyAssetChange = (db, issue, newCondition) => {
  if (issue.type === ISSUE_TYPES.INSUFFICIENT) return null;
  const asset = db.assets.find((a) => a.id === issue.assetId && a.locationId === issue.locationId);
  if (!asset || asset.quantity <= 0)
    fail(409, `${issue.assetName} không còn ở ${locName(db, issue.locationId)}. Hãy từ chối báo cáo kèm lý do.`);
  const qty = Math.min(issue.quantity, asset.quantity);

  if (issue.type === ISSUE_TYPES.MISSING) {
    const from = asset.quantity;
    // GBR-FAC-09: the line is never deleted, only its quantity goes down.
    asset.quantity -= qty;
    return { kind: 'QUANTITY', assetCode: asset.code, quantity: qty, fromQuantity: from, toQuantity: asset.quantity };
  }

  const fromCondition = asset.condition;
  if (fromCondition === newCondition)
    return { kind: 'CONDITION', assetCode: asset.code, quantity: qty, fromCondition, toCondition: newCondition };
  // Damaged units move to a stock line of the new condition (same convention as transfers: one line per code + condition).
  const target = db.assets.find((a) => a.locationId === asset.locationId && a.code === asset.code && a.condition === newCondition);
  if (qty === asset.quantity && !target) {
    asset.condition = newCondition;
  } else {
    asset.quantity -= qty;
    if (target) target.quantity += qty;
    else {
      const baseId = `a_${asset.locationId}_${asset.code}_${newCondition}`;
      db.assets.push({ ...asset, id: db.assets.some((a) => a.id === baseId) ? uid('a') : baseId, quantity: qty, condition: newCondition });
    }
  }
  return { kind: 'CONDITION', assetCode: asset.code, quantity: qty, fromCondition, toCondition: newCondition };
};

const decideIssueNotify = (db, issue, title, message) =>
  notify(db, [issue.reporterId, ...issue.linkedReports.map((r) => r.userId)], {
    type: 'FACILITY_ISSUE_DECIDED',
    title,
    message,
    link: `/facility/issues/${issue.id}`,
  });

const approveIssue = async (id, { note = '', newCondition } = {}, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const issue = findIssue(db, id);
    if (!canDecideIssue(issue, me)) fail(403, 'Chỉ Phó hiệu trưởng của campus được duyệt báo cáo đang chờ duyệt');
    if (issue.type !== ISSUE_TYPES.INSUFFICIENT) {
      // DESIGN 12.5: asset data of a room under inventory is locked.
      const lock = lockedLocationMap(db)[issue.locationId];
      if (lock) fail(409, `${locName(db, issue.locationId)} đang kiểm kê (${lock}). Hãy duyệt sau khi đợt kiểm kê hoàn tất.`);
    }
    if (issue.type === ISSUE_TYPES.DAMAGED && !['NEED_REPAIR', 'BROKEN'].includes(newCondition))
      fail(422, 'Chọn tình trạng mới của tài sản: Cần sửa chữa hoặc Hỏng');
    issue.assetChange = applyAssetChange(db, issue, newCondition);
    issue.newCondition = issue.type === ISSUE_TYPES.DAMAGED ? newCondition : null;
    issue.status = ISSUE_STATUS.APPROVED;
    issue.responseNote = (note || '').trim();
    issue.decidedAt = now();
    issue.decidedBy = me.id;
    issue.decidedByRole = me.role;
    addHistory(issue, 'APPROVED', me, issue.responseNote);
    const effect =
      issue.assetChange?.kind === 'CONDITION'
        ? ` Tình trạng ${issue.assetChange.quantity} ${issue.unit.toLowerCase()} được cập nhật thành "${ASSET_CONDITION_LABELS[newCondition]}".`
        : issue.assetChange?.kind === 'QUANTITY'
          ? ` Số lượng trong danh sách giảm còn ${issue.assetChange.toQuantity}.`
          : '';
    decideIssueNotify(db, issue, `Báo cáo ${issue.code} đã được duyệt`, `${issue.assetName} – ${locName(db, issue.locationId)}.${effect}`);
    return withExtras(db, issue);
  });
};

const rejectIssue = async (id, reason, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const issue = findIssue(db, id);
    if (!canDecideIssue(issue, me)) fail(403, 'Chỉ Phó hiệu trưởng của campus được từ chối báo cáo đang chờ duyệt');
    const err = validateReason(reason, 'lý do từ chối');
    if (err) fail(422, err);
    issue.status = ISSUE_STATUS.REJECTED;
    issue.rejectReason = reason.trim();
    issue.decidedAt = now();
    issue.decidedBy = me.id;
    issue.decidedByRole = me.role;
    addHistory(issue, 'REJECTED', me, issue.rejectReason);
    // GBR-FAC-07: a rejected report leaves the facility list unchanged.
    decideIssueNotify(db, issue, `Báo cáo ${issue.code} bị từ chối`, `Lý do: ${issue.rejectReason}`);
    return withExtras(db, issue);
  });
};

/* ---------------- Additional facility requests (#111, #119) ---------------- */

const findRequest = (db, id) => db.facilityRequests.find((r) => r.id === id) || fail(404, 'Không tìm thấy đề nghị bổ sung');

const listRequests = async (filters = {}, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  if (!canViewRequestList(me)) fail(403, 'Bạn không có quyền xem danh sách đề nghị');
  return db.facilityRequests
    .filter((r) => canViewRequest(r, me))
    .filter((r) => !filters.status || filters.status === 'ALL' || r.status === filters.status)
    .filter((r) => !filters.campusId || r.campusId === filters.campusId)
    .filter((r) => !filters.locationId || r.locationId === filters.locationId)
    .filter((r) => matchesKeyword(filters.keyword, r.code, r.itemName, r.reason))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => withExtras(db, r));
};

const getRequest = async (id, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  const req = findRequest(db, id);
  if (!canViewRequest(req, me)) fail(403, 'Bạn không có quyền xem đề nghị này');
  return withExtras(db, req);
};

const createRequest = async (payload, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    if (!canCreateRequest(me)) fail(403, 'Chỉ giáo viên và nhân viên bếp được đề nghị bổ sung cơ sở vật chất');
    if (!inScope(scopeOf(db, me), payload.locationId)) fail(403, 'Bạn chỉ đề nghị được cho lớp/phòng mình phụ trách');
    const errors = validateRequest(payload);
    if (hasErrors(errors)) fail(422, firstError(errors), errors);
    let item;
    if (payload.itemMode === REQUEST_ITEM_MODES.EXISTING) {
      const asset =
        db.assets.find((a) => a.id === payload.assetId && a.locationId === payload.locationId) ||
        fail(404, 'Tài sản không còn trong danh sách của lớp/phòng');
      item = { assetId: asset.id, assetCode: asset.code, itemName: asset.name, unit: asset.unit, categoryId: asset.categoryId };
    } else {
      item = {
        assetId: null,
        assetCode: null,
        itemName: payload.itemName.trim(),
        unit: payload.unit.trim(),
        categoryId: payload.categoryId || null,
      };
    }
    const location = db.locations.find((l) => l.id === payload.locationId);
    const req = {
      id: uid('fr'),
      code: nextCode(db.facilityRequests, 'YC'),
      campusId: location.campusId,
      locationId: location.id,
      itemMode: payload.itemMode,
      ...item,
      quantity: Number(payload.quantity),
      reason: payload.reason.trim(),
      status: REQUEST_STATUS.SUBMITTED,
      requesterId: me.id,
      createdAt: now(),
      responseNote: '',
      rejectReason: '',
      forwardNote: '',
      forwardedAt: null,
      forwardedBy: null,
      decidedAt: null,
      decidedBy: null,
      decidedByRole: null,
      proposalId: null,
      history: [],
    };
    addHistory(req, 'REQUEST_SUBMITTED', me);
    db.facilityRequests.unshift(req);
    // GBR-FAC-07 of UC 7.3: routed to the Vice Principal responsible for the campus.
    notify(db, vicePrincipalsOf(db, req.campusId), {
      type: 'FACILITY_REQUEST_SUBMITTED',
      title: `Đề nghị bổ sung mới ${req.code}`,
      message: `${me.fullName} đề nghị bổ sung ${req.quantity} ${req.unit.toLowerCase()} ${req.itemName} – ${locName(db, req.locationId)}.`,
      link: `/facility/requests/${req.id}`,
    });
    return withExtras(db, req);
  });
};

const approveRequest = async (id, note, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const req = findRequest(db, id);
    const byVp = canReviewRequest(req, me);
    const byPrincipal = canPrincipalDecideRequest(req, me);
    if (!byVp && !byPrincipal) fail(403, 'Bạn không có quyền duyệt đề nghị này ở trạng thái hiện tại');
    req.status = REQUEST_STATUS.APPROVED;
    req.responseNote = (note || '').trim();
    req.decidedAt = now();
    req.decidedBy = me.id;
    req.decidedByRole = me.role;
    addHistory(req, 'APPROVED', me, req.responseNote);
    const receivers = byPrincipal ? [req.requesterId, req.forwardedBy].filter(Boolean) : [req.requesterId];
    notify(db, receivers, {
      type: 'FACILITY_REQUEST_DECIDED',
      title: `Đề nghị ${req.code} đã được duyệt`,
      message: `${byPrincipal ? 'Hiệu trưởng' : 'Phó hiệu trưởng'} đã duyệt đề nghị bổ sung ${req.quantity} ${req.unit.toLowerCase()} ${req.itemName}.`,
      link: `/facility/requests/${req.id}`,
    });
    return withExtras(db, req);
  });
};

const rejectRequest = async (id, reason, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const req = findRequest(db, id);
    const byVp = canReviewRequest(req, me);
    const byPrincipal = canPrincipalDecideRequest(req, me);
    if (!byVp && !byPrincipal) fail(403, 'Bạn không có quyền từ chối đề nghị này ở trạng thái hiện tại');
    const err = validateReason(reason, 'lý do từ chối');
    if (err) fail(422, err);
    req.status = REQUEST_STATUS.REJECTED;
    req.rejectReason = reason.trim();
    req.decidedAt = now();
    req.decidedBy = me.id;
    req.decidedByRole = me.role;
    addHistory(req, 'REJECTED', me, req.rejectReason);
    const receivers = byPrincipal ? [req.requesterId, req.forwardedBy].filter(Boolean) : [req.requesterId];
    notify(db, receivers, {
      type: 'FACILITY_REQUEST_DECIDED',
      title: `Đề nghị ${req.code} bị từ chối`,
      message: `Lý do: ${req.rejectReason}`,
      link: `/facility/requests/${req.id}`,
    });
    return withExtras(db, req);
  });
};

/** UC 7.3 step 12.1: beyond the VP's authority -> Pending Principal Approval. */
const forwardRequest = async (id, note, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const req = findRequest(db, id);
    if (!canReviewRequest(req, me)) fail(403, 'Chỉ Phó hiệu trưởng của campus được chuyển đề nghị đang chờ duyệt');
    req.status = REQUEST_STATUS.PENDING_PRINCIPAL;
    req.forwardNote = (note || '').trim();
    req.forwardedAt = now();
    req.forwardedBy = me.id;
    addHistory(req, 'FORWARDED', me, req.forwardNote);
    notify(db, principals(db), {
      type: 'FACILITY_REQUEST_FORWARDED',
      title: `Đề nghị ${req.code} chờ Hiệu trưởng duyệt`,
      message: `${me.fullName} chuyển đề nghị bổ sung ${req.quantity} ${req.unit.toLowerCase()} ${req.itemName} – ${locName(db, req.locationId)}.`,
      link: `/facility/requests/${req.id}`,
    });
    notify(db, [req.requesterId], {
      type: 'FACILITY_REQUEST_FORWARDED',
      title: `Đề nghị ${req.code} đã chuyển Hiệu trưởng`,
      message: 'Đề nghị vượt thẩm quyền duyệt của Phó hiệu trưởng và đang chờ Hiệu trưởng quyết định.',
      link: `/facility/requests/${req.id}`,
    });
    return withExtras(db, req);
  });
};

/* ---------------- Reporter history (#112) ---------------- */

const listMyReports = async (user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  const issues = db.facilityIssues
    .filter((i) => i.reporterId === me.id || i.linkedReports.some((r) => r.userId === me.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((i) => withExtras(db, i));
  const requests = db.facilityRequests
    .filter((r) => r.requesterId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => withExtras(db, r));
  return { issues, requests };
};

/* ---------------- Proposals (#120) ---------------- */

const findProposal = (db, id) => db.facilityProposals.find((p) => p.id === id) || fail(404, 'Không tìm thấy đề xuất');
const sourceList = (db, type) => (type === SOURCE_TYPES.ISSUE ? db.facilityIssues : db.facilityRequests);

const listProposals = async (filters = {}, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  if (!canViewProposalList(me)) fail(403, 'Bạn không có quyền xem đề xuất cơ sở vật chất');
  return clone(
    db.facilityProposals
      .filter((p) => canViewProposal(p, me))
      .filter((p) => !filters.status || filters.status === 'ALL' || p.status === filters.status)
      .filter((p) => !filters.campusId || p.campusId === filters.campusId)
      .filter((p) => matchesKeyword(filters.keyword, p.code, p.title))
      .sort((a, b) => (b.submittedAt || b.createdAt).localeCompare(a.submittedAt || a.createdAt)),
  );
};

const getProposal = async (id, user) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  const p = findProposal(db, id);
  if (!canViewProposal(p, me)) fail(403, 'Bạn không có quyền xem đề xuất này');
  return clone(p);
};

/** Approved issues and VP-approved requests of the VP's campus that no active proposal holds. */
const getProposalSources = async (user, proposalId = null) => {
  await delay();
  const db = readSeeded();
  const me = requireUser(db, user);
  if (!canCreateProposal(me)) fail(403, 'Chỉ Phó hiệu trưởng được lập đề xuất');
  const proposalOf = (pid) => (pid === proposalId ? undefined : proposalById(db, pid));
  const toSource = (type) => (x) => ({
    sourceType: type,
    sourceId: x.id,
    sourceCode: x.code,
    itemName: type === SOURCE_TYPES.ISSUE ? x.assetName : x.itemName,
    unit: x.unit,
    locationId: x.locationId,
    quantity: x.quantity,
    issueType: type === SOURCE_TYPES.ISSUE ? x.type : null,
    description: type === SOURCE_TYPES.ISSUE ? x.description : x.reason,
    decidedAt: x.decidedAt,
  });
  return [
    ...db.facilityIssues.filter((i) => canAddToProposal(i, me, proposalOf)).map(toSource(SOURCE_TYPES.ISSUE)),
    ...db.facilityRequests.filter((r) => canAddToProposal(r, me, proposalOf)).map(toSource(SOURCE_TYPES.REQUEST)),
  ];
};

const sanitizeLines = (db, lines, me, proposalId) =>
  (lines || []).map((l) => {
    const line = {
      id: l.id || uid('fpl'),
      sourceType: l.sourceType || SOURCE_TYPES.MANUAL,
      sourceId: l.sourceType && l.sourceType !== SOURCE_TYPES.MANUAL ? l.sourceId : null,
      sourceCode: null,
      itemName: (l.itemName || '').trim(),
      unit: (l.unit || '').trim(),
      locationId: l.locationId || null,
      quantity: Number(l.quantity),
      estimatedCost: l.estimatedCost === '' || l.estimatedCost === null || l.estimatedCost === undefined ? null : Number(l.estimatedCost),
      note: (l.note || '').trim(),
    };
    if (line.sourceId) {
      const src = sourceList(db, line.sourceType).find((x) => x.id === line.sourceId) || fail(404, 'Nguồn của dòng đề xuất không tồn tại');
      const proposalOf = (pid) => (pid === proposalId ? undefined : proposalById(db, pid));
      if (!canAddToProposal(src, me, proposalOf))
        fail(409, `${src.code} không còn đưa vào đề xuất được (đã nằm trong đề xuất khác hoặc chưa được duyệt)`);
      line.sourceCode = src.code;
      line.locationId = src.locationId;
    }
    if (line.locationId) {
      const loc = db.locations.find((x) => x.id === line.locationId);
      if (!loc || loc.campusId !== me.campusId) fail(422, 'Lớp/phòng của dòng đề xuất phải thuộc campus của bạn');
    }
    return line;
  });

/** Sources of the proposal point to it; sources removed from the lines are released. */
const linkSources = (db, p, me) => {
  const held = new Set(p.lines.filter((l) => l.sourceId).map((l) => l.sourceId));
  [...db.facilityIssues, ...db.facilityRequests].forEach((src) => {
    if (src.proposalId === p.id && !held.has(src.id)) src.proposalId = null;
    if (held.has(src.id) && src.proposalId !== p.id) {
      src.proposalId = p.id;
      addHistory(src, 'ADDED_TO_PROPOSAL', me, p.code);
    }
  });
};

const releaseSources = (db, p) =>
  [...db.facilityIssues, ...db.facilityRequests].forEach((src) => {
    if (src.proposalId === p.id) src.proposalId = null;
  });

const upsertProposal = (db, id, payload, me, { forSubmit }) => {
  if (!canCreateProposal(me)) fail(403, 'Chỉ Phó hiệu trưởng được lập đề xuất');
  let p = id ? findProposal(db, id) : null;
  if (p && !canEditProposal(p, me)) fail(409, 'Chỉ sửa được đề xuất đang là bản nháp của bạn');
  const lines = sanitizeLines(db, payload.lines, me, p?.id);
  const form = { title: (payload.title || '').trim(), action: payload.action, reason: (payload.reason || '').trim(), lines };
  const errors = validateProposal(form, { forSubmit });
  if (hasErrors(errors)) fail(422, firstError(errors), errors);
  if (!p) {
    p = {
      id: uid('fp'),
      code: nextCode(db.facilityProposals, 'DX'),
      campusId: me.campusId,
      status: PROPOSAL_STATUS.DRAFT,
      createdBy: me.id,
      createdAt: now(),
      submittedAt: null,
      decidedAt: null,
      decidedBy: null,
      decisionNote: '',
      rejectReason: '',
      cancelReason: '',
      history: [],
    };
    addHistory(p, 'PROPOSAL_CREATED', me);
    db.facilityProposals.unshift(p);
  } else if (!forSubmit) {
    addHistory(p, 'PROPOSAL_UPDATED', me);
  }
  Object.assign(p, form);
  linkSources(db, p, me);
  return p;
};

const saveProposalDraft = async (id, payload, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    return clone(upsertProposal(db, id, payload, me, { forSubmit: false }));
  });
};

const submitProposal = async (id, payload, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const p = upsertProposal(db, id, payload, me, { forSubmit: true });
    p.status = PROPOSAL_STATUS.SUBMITTED;
    p.submittedAt = now();
    addHistory(p, 'PROPOSAL_SUBMITTED', me);
    notify(db, principals(db), {
      type: 'FACILITY_PROPOSAL_SUBMITTED',
      title: `Đề xuất ${p.code} chờ phê duyệt`,
      message: `${me.fullName} đề xuất ${PROPOSAL_ACTION_LABELS[p.action].toLowerCase()}: ${p.title} (${p.lines.length} tài sản).`,
      link: `/facility/proposals/${p.id}`,
    });
    return clone(p);
  });
};

const cancelProposal = async (id, reason, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const p = findProposal(db, id);
    if (!canCancelProposal(p, me)) fail(403, 'Chỉ người lập được hủy đề xuất chưa có quyết định');
    const err = validateReason(reason, 'lý do hủy');
    if (err) fail(422, err);
    const wasSent = p.status === PROPOSAL_STATUS.SUBMITTED;
    p.status = PROPOSAL_STATUS.CANCELLED;
    p.cancelReason = reason.trim();
    addHistory(p, 'PROPOSAL_CANCELLED', me, p.cancelReason);
    releaseSources(db, p);
    if (wasSent)
      notify(db, principals(db), {
        type: 'FACILITY_PROPOSAL_CANCELLED',
        title: `Đề xuất ${p.code} đã bị hủy`,
        message: `${me.fullName} hủy đề xuất. Lý do: ${p.cancelReason}`,
        link: `/facility/proposals/${p.id}`,
      });
    return clone(p);
  });
};

const decideProposal = (approve) => async (id, text, user) => {
  await delay();
  return writeDb((db) => {
    ensureSeeded(db);
    const me = requireUser(db, user);
    const p = findProposal(db, id);
    if (!canDecideProposal(p, me)) fail(403, 'Chỉ Hiệu trưởng được phê duyệt đề xuất đang chờ phê duyệt');
    if (!approve) {
      const err = validateReason(text, 'lý do từ chối');
      if (err) fail(422, err);
    }
    p.status = approve ? PROPOSAL_STATUS.APPROVED : PROPOSAL_STATUS.REJECTED;
    p.decidedAt = now();
    p.decidedBy = me.id;
    if (approve) p.decisionNote = (text || '').trim();
    else p.rejectReason = text.trim();
    addHistory(p, approve ? 'APPROVED' : 'REJECTED', me, (text || '').trim());
    // A rejected proposal releases its sources so the Vice Principal can propose them again.
    if (!approve) releaseSources(db, p);
    const title = approve ? `Đề xuất ${p.code} đã được phê duyệt` : `Đề xuất ${p.code} bị từ chối`;
    notify(db, [p.createdBy], {
      type: 'FACILITY_PROPOSAL_DECIDED',
      title,
      message: approve ? p.title : `Lý do: ${p.rejectReason}`,
      link: `/facility/proposals/${p.id}`,
    });
    if (approve) {
      // GBR-FAC-10: accepting a report and approving its proposal are separate; reporters learn the second step too.
      const reporters = new Set();
      p.lines.forEach((l) => {
        if (!l.sourceId) return;
        const src = sourceList(db, l.sourceType).find((x) => x.id === l.sourceId);
        if (!src) return;
        addHistory(src, 'PROPOSAL_DECIDED', me, `${p.code}: đã phê duyệt`);
        reporters.add(src.reporterId || src.requesterId);
      });
      notify(db, [...reporters], {
        type: 'FACILITY_PROPOSAL_DECIDED',
        title: `Đề xuất xử lý ${p.code} đã được phê duyệt`,
        message: `Hiệu trưởng đã phê duyệt ${PROPOSAL_ACTION_LABELS[p.action].toLowerCase()} cho báo cáo/đề nghị của bạn.`,
        link: '/facility/my-reports',
      });
    }
    return clone(p);
  });
};

export const facilityMockRepository = {
  listAssets,
  getScopeLocations,
  checkOpenIssue,
  listIssues,
  getIssue,
  createIssue,
  approveIssue,
  rejectIssue,
  listRequests,
  getRequest,
  createRequest,
  approveRequest,
  rejectRequest,
  forwardRequest,
  listMyReports,
  listProposals,
  getProposal,
  getProposalSources,
  saveProposalDraft,
  submitProposal,
  cancelProposal,
  approveProposal: decideProposal(true),
  rejectProposal: decideProposal(false),
};
