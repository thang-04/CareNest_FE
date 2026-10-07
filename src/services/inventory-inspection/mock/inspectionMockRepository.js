import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { lockedLocationMap } from '@/mocks/inventoryLock';
import { uid } from '@/utils/id';
import { normalizeText } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import { ROUND_STATUS, SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { validateRound, validateSheet, hasErrors, firstError } from '@/utils/inventory-inspection/inspectionValidation';
import { candidateLocations, matchesAssetScope, scopeCampusIds } from '@/utils/inventory-inspection/inspectionScope';
import {
  canManageRounds,
  canEditRound,
  canCancelRound,
  canCountSheet,
  canReviewSheet,
  canApproveRound,
  canViewRound,
} from '@/utils/inventory-inspection/inspectionPermissions';

/*
 * Fake backend of the inventory module (BF-11, UC 7.1).
 * The Spring Boot API must enforce the same rules.
 */

const now = () => new Date().toISOString();
const fail = (status, message, details) => {
  throw new ApiError(status, message, details);
};
const rounds = (db) => {
  if (!db.inspections) db.inspections = [];
  return db.inspections;
};
const findRound = (db, id) => rounds(db).find((r) => r.id === id) || fail(404, 'Không tìm thấy đợt kiểm kê');
const findSheet = (round, sheetId) => round.sheets.find((s) => s.id === sheetId) || fail(404, 'Không tìm thấy phiếu kiểm kê');
const locName = (db, id) => locationLabel(db.locations.find((l) => l.id === id));
const requireUser = (user) => user || fail(401, 'Bạn chưa đăng nhập');

const addHistory = (r, action, user, note = '') => r.history.push({ id: uid('h'), action, userId: user.id, at: now(), note });

const nextCode = (db) => {
  const max = rounds(db).reduce((m, r) => Math.max(m, parseInt(String(r.code).replace(/\D/g, ''), 10) || 0), 0);
  return `KK${String(max + 1).padStart(3, '0')}`;
};

/** Round status follows its sheets: all approved -> waiting for final approval. */
const refreshRoundStatus = (r) => {
  if (![ROUND_STATUS.IN_PROGRESS, ROUND_STATUS.PENDING_APPROVAL].includes(r.status)) return;
  const active = r.sheets.filter((s) => s.status !== SHEET_STATUS.CANCELLED);
  r.status =
    active.length && active.every((s) => s.status === SHEET_STATUS.APPROVED) ? ROUND_STATUS.PENDING_APPROVAL : ROUND_STATUS.IN_PROGRESS;
};

const sanitizeRound = (db, payload) => {
  const scopeDef = {
    locationMode: payload.locationMode || 'CAMPUS',
    campusIds: payload.campusIds || [],
    locationTypes: payload.locationTypes || [],
    locationIds: payload.locationIds || [],
    assetMode: payload.assetMode || 'ALL',
    categoryIds: payload.categoryIds || [],
    assetCodes: payload.assetCodes || [],
  };
  // Only rooms that really belong to the WHERE axis are kept.
  const allowed = candidateLocations(scopeDef, db.locations, db.campuses).map((l) => l.id);
  return {
    name: (payload.name || '').trim(),
    type: payload.type,
    ...scopeDef,
    campusIds: scopeCampusIds(scopeDef, db.campuses),
    startDate: payload.startDate,
    deadline: payload.deadline,
    note: (payload.note || '').trim(),
    scope: (payload.scope || [])
      .filter((s) => allowed.includes(s.locationId))
      .map((s) => ({ locationId: s.locationId, inspectorUserId: s.inspectorUserId || null })),
  };
};

/** Creates one sheet per location with the locked book quantities. */
const buildSheets = (db, round) =>
  round.scope.map((s, idx) => ({
    id: uid('sh'),
    code: `${round.code}-${String(idx + 1).padStart(2, '0')}`,
    locationId: s.locationId,
    inspectorUserId: s.inspectorUserId,
    status: SHEET_STATUS.ASSIGNED,
    items: db.assets
      .filter((a) => a.locationId === s.locationId && a.quantity > 0 && matchesAssetScope(a, round))
      .map((a) => ({
        assetId: a.id,
        assetCode: a.code,
        assetName: a.name,
        unit: a.unit,
        categoryId: a.categoryId,
        bookQuantity: a.quantity,
        bookCondition: a.condition,
        actualQuantity: null,
        actualCondition: null,
        note: '',
        images: [],
        flagged: false,
      })),
    inspectorSignature: null,
    recountRequests: [],
    submitCount: 0,
    savedAt: null,
    submittedAt: null,
    approvedAt: null,
    approvedBy: null,
  }));

const sanitizeCounts = (sheet, items) => {
  sheet.items.forEach((item) => {
    const input = items.find((x) => x.assetId === item.assetId);
    if (!input) return;
    const q = input.actualQuantity;
    item.actualQuantity = q === '' || q === null || q === undefined ? null : Number(q);
    item.actualCondition = input.actualCondition || null;
    item.note = (input.note || '').trim();
    item.images = input.images || [];
  });
};

export const inspectionMockRepository = {
  async list(filters = {}, user) {
    await delay();
    requireUser(user);
    const db = readDb();
    const kw = normalizeText(filters.keyword || '');
    return clone(
      rounds(db)
        .filter((r) => canViewRound(r, user))
        .filter((r) => !filters.status || filters.status === 'ALL' || r.status === filters.status)
        .filter((r) => !kw || normalizeText(`${r.code} ${r.name}`).includes(kw))
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    );
  },

  async getById(id, user) {
    await delay();
    requireUser(user);
    const r = findRound(readDb(), id);
    if (!canViewRound(r, user)) fail(403, 'Bạn không có quyền xem đợt kiểm kê này');
    return clone(r);
  },

  /** Locations currently locked by a running round: { locationId: roundCode }. */
  async getLockedLocations() {
    await delay(60);
    return lockedLocationMap(readDb());
  },

  /**
   * Assets of every location that match the WHAT axis of a scope
   * (used for counts and the "Xem trước danh sách tài sản" preview).
   */
  async getScopeAssets(assetScope) {
    await delay(80);
    const db = readDb();
    const result = {};
    db.locations.forEach((l) => {
      const assets = db.assets.filter((a) => a.locationId === l.id && a.quantity > 0 && matchesAssetScope(a, assetScope));
      result[l.id] = {
        lines: assets.length,
        units: assets.reduce((sum, a) => sum + a.quantity, 0),
        items: assets.map((a) => ({
          code: a.code,
          name: a.name,
          unit: a.unit,
          quantity: a.quantity,
          condition: a.condition,
          categoryId: a.categoryId,
        })),
      };
    });
    return clone(result);
  },

  /** Distinct asset types of the school, for "Chọn tài sản cụ thể". */
  async getAssetCatalog() {
    await delay(80);
    const map = {};
    readDb()
      .assets.filter((a) => a.quantity > 0)
      .forEach((a) => {
        const row =
          map[a.code] || (map[a.code] = { code: a.code, name: a.name, unit: a.unit, categoryId: a.categoryId, total: 0, locations: 0 });
        row.total += a.quantity;
        row.locations += 1;
      });
    return Object.values(map).sort((x, y) => x.code.localeCompare(y.code));
  },

  /** Unfinished transfers touching these locations (warning before starting). */
  async getActiveTransfersAt(locationIds) {
    await delay(60);
    const active = ['PENDING_HANDOVER', 'REVISION_REQUESTED', 'PENDING_RECEIPT', 'PENDING_RESOLUTION'];
    return clone(
      (readDb().transfers || [])
        .filter((t) => active.includes(t.status) && (locationIds.includes(t.fromLocationId) || locationIds.includes(t.toLocationId)))
        .map((t) => ({ id: t.id, code: t.code, fromLocationId: t.fromLocationId, toLocationId: t.toLocationId, status: t.status })),
    );
  },

  /* ---------------- Vice Principal ---------------- */

  async saveDraft(id, payload, user) {
    await delay();
    if (!canManageRounds(user)) fail(403, 'Chỉ Phó hiệu trưởng được tạo đợt kiểm kê');
    return writeDb((db) => {
      const data = sanitizeRound(db, payload);
      if (!data.name) fail(422, 'Vui lòng nhập tên đợt kiểm kê trước khi lưu nháp');
      if (id) {
        const r = findRound(db, id);
        if (!canEditRound(r, user)) fail(409, 'Chỉ đợt nháp mới được sửa');
        Object.assign(r, data, { updatedAt: now() });
        addHistory(r, 'UPDATED', user);
        return clone(r);
      }
      const r = {
        id: uid('kk'),
        code: nextCode(db),
        ...data,
        createdBy: user.id,
        status: ROUND_STATUS.DRAFT,
        sheets: [],
        signatures: [],
        adjustments: [],
        applyAdjustments: true,
        approvalNote: '',
        history: [],
        createdAt: now(),
        updatedAt: now(),
      };
      addHistory(r, 'CREATED', user);
      rounds(db).push(r);
      return clone(r);
    });
  },

  /** Sign and start: locks asset data and creates one sheet per location. */
  async start(id, payload, user) {
    await delay(400);
    if (!canManageRounds(user)) fail(403, 'Chỉ Phó hiệu trưởng được bắt đầu kiểm kê');
    return writeDb((db) => {
      const data = sanitizeRound(db, payload);
      const errors = validateRound(data);
      if (hasErrors(errors)) fail(422, firstError(errors), errors);
      if (!payload.creatorSignatureUrl) fail(422, 'Vui lòng chọn chữ ký người lập');
      const locked = lockedLocationMap(db);
      const clash = data.scope.find((s) => locked[s.locationId]);
      if (clash) fail(409, `${locName(db, clash.locationId)} đang thuộc đợt kiểm kê ${locked[clash.locationId]} chưa hoàn thành`);

      let r;
      if (id) {
        r = findRound(db, id);
        if (!canEditRound(r, user)) fail(409, 'Đợt kiểm kê này đã được bắt đầu');
        Object.assign(r, data);
      } else {
        r = {
          id: uid('kk'),
          code: nextCode(db),
          ...data,
          createdBy: user.id,
          signatures: [],
          adjustments: [],
          applyAdjustments: true,
          approvalNote: '',
          history: [],
          createdAt: now(),
        };
        rounds(db).push(r);
      }
      r.status = ROUND_STATUS.IN_PROGRESS;
      r.sheets = buildSheets(db, r);
      if (r.sheets.some((s) => s.items.length === 0)) {
        const empty = r.sheets.find((s) => s.items.length === 0);
        fail(422, `${locName(db, empty.locationId)} không có tài sản nào để kiểm kê`);
      }
      r.signatures = [
        { type: 'CREATOR', signedBy: user.id, signedByName: user.fullName, signatureUrl: payload.creatorSignatureUrl, signedAt: now() },
      ];
      r.updatedAt = now();
      addHistory(r, 'STARTED', user, `${r.sheets.length} phiếu kiểm kê`);
      r.sheets.forEach((s) =>
        pushNotification(db, {
          userId: s.inspectorUserId,
          type: 'INSPECTION_ASSIGNED',
          title: `Phiếu kiểm kê mới ${s.code}`,
          message: `Bạn được giao kiểm kê ${locName(db, s.locationId)} (${s.items.length} tài sản). Hạn hoàn thành ${r.deadline.split('-').reverse().join('/')}.`,
          link: `/facility/inspections/${r.id}/sheets/${s.id}`,
        }),
      );
      return clone(r);
    });
  },

  async approveSheet(id, sheetId, note, user) {
    await delay();
    return writeDb((db) => {
      const r = findRound(db, id);
      const s = findSheet(r, sheetId);
      if (!canReviewSheet(r, s, user)) fail(409, 'Phiếu chưa được nộp hoặc đã xử lý');
      s.status = SHEET_STATUS.APPROVED;
      s.approvedAt = now();
      s.approvedBy = user.id;
      s.reviewNote = (note || '').trim();
      s.items.forEach((i) => {
        i.flagged = false;
      });
      addHistory(r, 'SHEET_APPROVED', user, `${s.code} – ${locName(db, s.locationId)}`);
      refreshRoundStatus(r);
      r.updatedAt = now();
      pushNotification(db, {
        userId: s.inspectorUserId,
        type: 'INSPECTION_SHEET_APPROVED',
        title: `Phiếu ${s.code} đã được duyệt`,
        message: `PHT đã duyệt kết quả kiểm kê ${locName(db, s.locationId)}.`,
        link: `/facility/inspections/${r.id}/sheets/${s.id}`,
      });
      return clone(r);
    });
  },

  async requestRecount(id, sheetId, { reason, itemIds }, user) {
    await delay();
    return writeDb((db) => {
      const r = findRound(db, id);
      const s = findSheet(r, sheetId);
      if (!canReviewSheet(r, s, user)) fail(409, 'Chỉ yêu cầu kiểm lại phiếu đã nộp');
      if (!reason?.trim()) fail(422, 'Vui lòng nhập lý do kiểm lại');
      s.status = SHEET_STATUS.RECOUNT_REQUESTED;
      s.items.forEach((i) => {
        i.flagged = (itemIds || []).includes(i.assetId);
      });
      s.recountRequests.push({ reason: reason.trim(), itemIds: itemIds || [], requestedBy: user.id, requestedAt: now() });
      s.inspectorSignature = null;
      addHistory(r, 'RECOUNT_REQUESTED', user, `${s.code}: ${reason.trim()}`);
      refreshRoundStatus(r);
      r.updatedAt = now();
      pushNotification(db, {
        userId: s.inspectorUserId,
        type: 'INSPECTION_RECOUNT',
        title: `Yêu cầu kiểm lại ${s.code}`,
        message: `${locName(db, s.locationId)}: ${reason.trim()}`,
        link: `/facility/inspections/${r.id}/sheets/${s.id}`,
      });
      return clone(r);
    });
  },

  /** Final approval: sign, update stock / condition, close the round. */
  async complete(id, { signatureUrl, note, applyAdjustments }, user) {
    await delay(400);
    return writeDb((db) => {
      const r = findRound(db, id);
      if (!canApproveRound(r, user)) fail(409, 'Chỉ phê duyệt được khi tất cả phiếu đã được duyệt');
      if (!signatureUrl) fail(422, 'Vui lòng chọn chữ ký phê duyệt');
      r.adjustments = [];
      r.sheets
        .filter((s) => s.status === SHEET_STATUS.APPROVED)
        .forEach((s) => {
          s.items.forEach((i) => {
            const changedQty = i.actualQuantity !== i.bookQuantity;
            const changedCond = i.actualCondition !== i.bookCondition;
            if (!changedQty && !changedCond) return;
            r.adjustments.push({
              locationId: s.locationId,
              assetId: i.assetId,
              assetCode: i.assetCode,
              assetName: i.assetName,
              unit: i.unit,
              bookQuantity: i.bookQuantity,
              actualQuantity: i.actualQuantity,
              difference: i.actualQuantity - i.bookQuantity,
              bookCondition: i.bookCondition,
              actualCondition: i.actualCondition,
              note: i.note,
            });
            if (applyAdjustments) {
              const asset = db.assets.find((a) => a.id === i.assetId);
              if (asset) {
                asset.quantity = i.actualQuantity;
                asset.condition = i.actualCondition;
              }
            }
          });
        });
      r.applyAdjustments = !!applyAdjustments;
      r.approvalNote = (note || '').trim();
      r.signatures.push({ type: 'APPROVER', signedBy: user.id, signedByName: user.fullName, signatureUrl, signedAt: now() });
      r.status = ROUND_STATUS.COMPLETED;
      r.updatedAt = now();
      addHistory(
        r,
        'COMPLETED',
        user,
        applyAdjustments ? `Cập nhật ${r.adjustments.length} dòng tài sản theo số thực tế` : 'Không cập nhật tồn kho',
      );
      r.sheets.forEach((s) =>
        pushNotification(db, {
          userId: s.inspectorUserId,
          type: 'INSPECTION_COMPLETED',
          title: `Kiểm kê ${r.code} đã hoàn thành`,
          message: `PHT đã phê duyệt kết quả đợt "${r.name}".`,
          link: `/facility/inspections/${r.id}/sheets/${s.id}`,
        }),
      );
      return clone(r);
    });
  },

  async cancel(id, reason, user) {
    await delay();
    return writeDb((db) => {
      const r = findRound(db, id);
      if (!canCancelRound(r, user)) fail(409, 'Không thể hủy đợt kiểm kê ở trạng thái hiện tại');
      if (!reason?.trim()) fail(422, 'Vui lòng nhập lý do hủy');
      r.status = ROUND_STATUS.CANCELLED;
      r.sheets.forEach((s) => {
        if (s.status !== SHEET_STATUS.APPROVED) s.status = SHEET_STATUS.CANCELLED;
      });
      r.updatedAt = now();
      addHistory(r, 'CANCELLED', user, reason.trim());
      r.sheets.forEach((s) =>
        pushNotification(db, {
          userId: s.inspectorUserId,
          type: 'INSPECTION_CANCELLED',
          title: `Đợt kiểm kê ${r.code} đã hủy`,
          message: `Lý do: ${reason.trim()}`,
          link: `/facility/inspections/${r.id}`,
        }),
      );
      return clone(r);
    });
  },

  /* ---------------- Inspector ---------------- */

  async saveSheet(id, sheetId, items, user) {
    await delay(200);
    return writeDb((db) => {
      const r = findRound(db, id);
      const s = findSheet(r, sheetId);
      if (!canCountSheet(r, s, user)) fail(403, 'Bạn không thể cập nhật phiếu kiểm kê này');
      sanitizeCounts(s, items);
      if (s.status === SHEET_STATUS.ASSIGNED) s.status = SHEET_STATUS.IN_PROGRESS;
      s.savedAt = now();
      r.updatedAt = now();
      return clone(r);
    });
  },

  async submitSheet(id, sheetId, { items, signatureUrl }, user) {
    await delay(400);
    return writeDb((db) => {
      const r = findRound(db, id);
      const s = findSheet(r, sheetId);
      if (!canCountSheet(r, s, user)) fail(403, 'Bạn không thể nộp phiếu kiểm kê này');
      sanitizeCounts(s, items);
      const errors = validateSheet(s.items);
      if (hasErrors(errors)) fail(422, `${s.items.find((i) => errors[i.assetId]).assetName}: ${firstError(errors)}`, errors);
      if (!signatureUrl) fail(422, 'Vui lòng chọn chữ ký người kiểm kê');
      s.status = SHEET_STATUS.SUBMITTED;
      s.submitCount += 1;
      s.submittedAt = now();
      s.inspectorSignature = { signatureUrl, signedAt: now(), signedBy: user.id, signedByName: user.fullName };
      addHistory(
        r,
        'SHEET_SUBMITTED',
        user,
        `${s.code} – ${locName(db, s.locationId)}${s.submitCount > 1 ? ` (lần ${s.submitCount})` : ''}`,
      );
      r.updatedAt = now();
      pushNotification(db, {
        userId: r.createdBy,
        type: 'INSPECTION_SUBMITTED',
        title: `${user.fullName} đã nộp phiếu ${s.code}`,
        message: `${locName(db, s.locationId)}: ${s.items.filter((i) => i.actualQuantity !== i.bookQuantity).length} tài sản lệch sổ sách. Vui lòng xem và duyệt.`,
        link: `/facility/inspections/${r.id}/sheets/${s.id}`,
      });
      return clone(r);
    });
  },
};
