import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { findInventoryLock } from '@/mocks/inventoryLock';
import { uid } from '@/utils/id';
import { normalizeText } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import {
  TRANSFER_STATUS,
  TRANSFER_TYPES,
  ACTIVE_STATUSES,
  SIGNATURE_TYPES,
  RESOLUTION_CHOICES,
  PART_CHOICES,
  DISCREPANCY_PARTS,
  DISCREPANCY_PART_LABELS,
  TRANSFER_TYPE_LOCATION_TYPES,
} from '@/models/facility-transfer/transferConstants';
import { CRITICAL_FIELDS } from '@/models/facility-transfer/FacilityTransfer';
import { expectedReceiveQuantity, discrepancyParts, isBadCondition } from '@/models/facility-transfer/FacilityTransferItem';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';
import { validateWholeTransfer, validateItems, hasErrors, firstError } from '@/utils/facility-transfer/transferValidation';
import {
  canEditTransfer,
  canCancelTransfer,
  canHandover,
  canRequestRevision,
  canReceive,
  canResolveDiscrepancy,
  canViewTransfer,
  canCreateTransfer,
  isSupplementMode,
} from '@/utils/facility-transfer/transferPermissions';

/*
 * Fake Spring Boot backend for the facility transfer module.
 * Every rule here (validation, role checks, status transitions, signatures)
 * is what the real API must enforce too.
 */

const now = () => new Date().toISOString();

const fail = (status, message, details) => {
  throw new ApiError(status, message, details);
};

const findTransfer = (db, id) => db.transfers.find((t) => t.id === id) || fail(404, 'Không tìm thấy phiếu luân chuyển');
const findUser = (db, id) => db.users.find((u) => u.id === id);
const userName = (db, id) => findUser(db, id)?.fullName || '';
const locName = (db, id) => locationLabel(db.locations.find((l) => l.id === id));

const addHistory = (t, action, user, note = '') => {
  t.history.push({ id: uid('h'), action, userId: user.id, at: now(), note, version: t.version });
};

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** A signature must be one saved on the signer's account or an image uploaded in this step. */
const assertOwnSignature = (db, user, signatureUrl) => {
  if (!signatureUrl) fail(400, 'Vui lòng chọn hoặc tải lên chữ ký');
  const saved = (db.signatures || []).some((s) => s.userId === user.id && s.imageUrl === signatureUrl);
  if (!saved && !/^data:image\//.test(signatureUrl)) fail(422, 'Chữ ký không thuộc tài khoản của bạn');
};

const addSignature = (db, t, type, user, signatureUrl) => {
  assertOwnSignature(db, user, signatureUrl);
  t.signatures.push({
    id: uid('ts'),
    type,
    signedBy: user.id,
    signedByName: user.fullName,
    signatureUrl,
    signedAt: now(),
    documentVersion: t.version,
    valid: true,
    invalidatedAt: null,
    invalidReason: null,
  });
};

const invalidateSignatures = (t, type, reason) => {
  let count = 0;
  t.signatures.forEach((s) => {
    if (s.type === type && s.valid) {
      s.valid = false;
      s.invalidatedAt = now();
      s.invalidReason = reason;
      count += 1;
    }
  });
  return count;
};

const snapshotOf = (t) => ({
  type: t.type,
  fromCampusId: t.fromCampusId,
  toCampusId: t.toCampusId,
  fromLocationId: t.fromLocationId,
  toLocationId: t.toLocationId,
  reason: t.reason,
  note: t.note,
  expectedHandoverDate: t.expectedHandoverDate,
  handoverUserId: t.handoverUserId,
  receiverUserId: t.receiverUserId,
  items: t.items.map((i) => ({ assetId: i.assetId, assetCode: i.assetCode, assetName: i.assetName, unit: i.unit, quantity: i.quantity })),
});

const addRevision = (t, user, changeNote, revisionRequestId = null) => {
  t.revisions.push({
    id: uid('rev'),
    version: t.version,
    createdAt: now(),
    createdBy: user.id,
    changeNote,
    snapshot: snapshotOf(t),
    revisionRequestId,
  });
};

/** True when assets, quantities or locations changed between two snapshots. */
const hasCriticalChange = (before, after) => {
  if (CRITICAL_FIELDS.some((f) => before[f] !== after[f])) return true;
  const key = (items) =>
    items
      .map((i) => `${i.assetId}:${i.quantity}`)
      .sort()
      .join('|');
  return key(before.items) !== key(after.items);
};

/** Quantity of an asset reserved by other active transfers. */
const reservedQuantity = (db, assetId, excludeTransferId) =>
  db.transfers
    .filter((t) => t.id !== excludeTransferId && ACTIVE_STATUSES.includes(t.status))
    .flatMap((t) => t.items)
    .filter((i) => i.assetId === assetId)
    .reduce((sum, i) => sum + Math.max(0, i.quantity - (i.cancelledQuantity || 0)), 0);

const availabilityMap = (db, locationId, excludeTransferId) => {
  const map = {};
  db.assets
    .filter((a) => a.locationId === locationId)
    .forEach((a) => {
      map[a.id] = Math.max(0, a.quantity - reservedQuantity(db, a.id, excludeTransferId));
    });
  return map;
};

const nextCode = (db) => {
  const max = db.transfers.reduce((m, t) => Math.max(m, parseInt(String(t.code).replace(/\D/g, ''), 10) || 0), 0);
  return `LC${String(max + 1).padStart(3, '0')}`;
};

/** Copies only the fields the client is allowed to send. */
const sanitizePayload = (db, payload) => {
  const isInter = payload.type === TRANSFER_TYPES.INTER_CAMPUS;
  const items = (payload.items || []).map((raw) => {
    const asset = db.assets.find((a) => a.id === raw.assetId) || fail(400, `Tài sản ${raw.assetCode || raw.assetId} không tồn tại`);
    if (asset.locationId !== payload.fromLocationId) fail(400, `Tài sản ${asset.code} không thuộc nơi đi`);
    return {
      id: `item_${asset.id}`,
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      unit: asset.unit,
      categoryId: asset.categoryId,
      imageUrl: asset.imageUrl || null,
      quantity: Number(raw.quantity),
      condition: raw.condition || asset.condition,
      handoverQuantity: null,
      handoverCondition: null,
      handoverNote: '',
      handoverImages: [],
      receivedQuantity: null,
      receivedCondition: null,
      receivedNote: '',
      receivedImages: [],
      acceptedQuantity: null,
      cancelledQuantity: 0,
      supplementRequired: null,
      supplementHistory: [],
    };
  });
  return {
    type: payload.type,
    createdDate: payload.createdDate,
    expectedHandoverDate: payload.expectedHandoverDate,
    fromCampusId: payload.fromCampusId,
    toCampusId: isInter ? payload.toCampusId : payload.fromCampusId,
    fromLocationId: payload.fromLocationId,
    toLocationId: payload.toLocationId,
    reason: (payload.reason || '').trim(),
    note: (payload.note || '').trim(),
    attachments: (payload.attachments || []).map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      type: a.type,
      dataUrl: a.dataUrl || null,
    })),
    items,
    handoverUserId: payload.handoverUserId || null,
    receiverUserId: payload.receiverUserId || null,
    handoverPickMode: payload.handoverPickMode || 'SUGGESTED',
    receiverPickMode: payload.receiverPickMode || 'SUGGESTED',
    // BF-07 step 3: both sides are always notified.
    notifyOnSubmit: true,
    draftSignatureUrl: payload.creatorSignatureUrl || null,
    draftSignatureId: payload.creatorSignatureId || null,
  };
};

/** Handover / receiver must be the person in charge of the sending / receiving room (SRS UC 7.5 actors). */
const assertResponsiblePerson = (db, location, userId, side) => {
  if (!location.managerUserId)
    fail(422, `${locationLabel(location)} chưa có người phụ trách. Cập nhật người phụ trách trước khi luân chuyển.`);
  if (!findUser(db, userId)) fail(422, `Người ${side} không tồn tại`);
  if (userId !== location.managerUserId)
    fail(422, `Người ${side} phải là người phụ trách ${locationLabel(location)} (${userName(db, location.managerUserId)})`);
};

/** The VP may only send assets of their own campus (GBR-FAC-06). */
const assertOwnCampus = (data, user) => {
  if (data.fromCampusId !== user.campusId) fail(403, 'Bạn chỉ được luân chuyển tài sản thuộc campus mình phụ trách');
};

/** Every line of the document must be answered exactly once. */
const assertAllLines = (t, inputs, what) => {
  const ids = (inputs || []).map((x) => x.itemId);
  const unique = new Set(ids);
  if (unique.size !== ids.length) fail(422, `Mỗi tài sản chỉ được ${what} một lần`);
  if (unique.size !== t.items.length || t.items.some((i) => !unique.has(i.id)))
    fail(422, `Vui lòng ${what} đủ tất cả ${t.items.length} tài sản trên phiếu`);
};

/** Server-side validation of a document before it leaves the draft state. */
const assertValidDocument = (db, data, excludeTransferId) => {
  const available = availabilityMap(db, data.fromLocationId, excludeTransferId);
  const errors = validateWholeTransfer(data, available);
  if (hasErrors(errors)) fail(422, firstError(errors), errors);

  const from = db.locations.find((l) => l.id === data.fromLocationId);
  const to = db.locations.find((l) => l.id === data.toLocationId);
  if (!from || !to) fail(422, 'Nơi đi hoặc nơi đến không tồn tại');
  if (from.campusId !== data.fromCampusId || to.campusId !== data.toCampusId) fail(422, 'Lớp/phòng không thuộc campus đã chọn');
  const allowed = TRANSFER_TYPE_LOCATION_TYPES[data.type];
  if ([from.type, to.type].includes('STORAGE'))
    fail(422, 'Kho tổng không dùng luân chuyển. Xuất kho / nhập kho thực hiện qua chức năng Cấp phát tài sản.');
  if (!allowed.includes(from.type) || !allowed.includes(to.type)) fail(422, 'Nơi đi/nơi đến không phù hợp với loại luân chuyển');
  assertResponsiblePerson(db, from, data.handoverUserId, 'bàn giao');
  assertResponsiblePerson(db, to, data.receiverUserId, 'nhận');
};

const resetReceived = (t) =>
  t.items.forEach((i) => {
    i.receivedQuantity = null;
    i.receivedCondition = null;
    i.receivedNote = '';
    i.receivedImages = [];
  });

/** Assets of a location under inventory must not move (SRS: the round locks asset data). */
const assertNotLocked = (db, t) => {
  const lock = findInventoryLock(db, [t.fromLocationId, t.toLocationId]);
  if (lock)
    fail(409, `${locName(db, lock.locationId)} đang kiểm kê (đợt ${lock.round.code}). Tạm khóa luân chuyển đến khi kiểm kê hoàn thành.`);
};

/**
 * Final step: move stock (minus at the sending room, plus at the receiving room) by each line's
 * quantity to receive, then complete. Needs the three valid signatures.
 */
const completeTransfer = (db, t, user, note) => {
  t.stockMovements = [];
  t.items.forEach((item) => {
    const qty = expectedReceiveQuantity(item);
    if (qty <= 0 && item.quantity <= 0) return;
    const source = db.assets.find((a) => a.id === item.assetId) || fail(409, `${item.assetCode} không còn ở nơi đi`);
    if (source.quantity < qty) fail(409, `${item.assetCode}: tồn kho nơi đi chỉ còn ${source.quantity}`);
    const condition = item.receivedCondition || source.condition;
    const fromBefore = source.quantity;
    let toBefore = 0;
    if (qty > 0) {
      // One stock line per (room, asset code, condition), so a received "need repair" unit is not merged into good stock.
      const baseId = `a_${t.toLocationId}_${item.assetCode}`;
      const target = db.assets.find((a) => a.locationId === t.toLocationId && a.code === item.assetCode && a.condition === condition);
      toBefore = target ? target.quantity : 0;
      source.quantity -= qty;
      if (target) target.quantity += qty;
      else
        db.assets.push({
          ...source,
          id: db.assets.some((a) => a.id === baseId) ? `${baseId}_${condition}` : baseId,
          locationId: t.toLocationId,
          quantity: qty,
          condition,
        });
    }
    t.stockMovements.push({
      itemId: item.id,
      assetCode: item.assetCode,
      assetName: item.assetName,
      unit: item.unit,
      documentQuantity: item.quantity,
      handoverQuantity: item.handoverQuantity ?? item.quantity,
      // Differences against the document, kept so the ledger always reconciles.
      shortfall: Math.max(0, item.quantity - qty),
      surplus: Math.max(0, qty - item.quantity),
      damagedReturned: item.damagedReturned || 0,
      condition,
      quantity: qty,
      fromLocationId: t.fromLocationId,
      fromBefore,
      fromAfter: fromBefore - qty,
      toLocationId: t.toLocationId,
      toBefore,
      toAfter: toBefore + qty,
      at: now(),
    });
  });
  const missing = Object.values(SIGNATURE_TYPES).filter((type) => !getValidSignature(t, type));
  if (missing.length) fail(409, 'Phiếu hoàn thành phải có đủ 3 chữ ký hợp lệ');
  t.status = TRANSFER_STATUS.COMPLETED;
  t.updatedAt = now();
  addHistory(t, 'COMPLETED', user, note || 'Đã cập nhật vị trí và số lượng tài sản');
  [t.createdBy, t.handoverUserId, t.receiverUserId]
    .filter((id, i, all) => id !== user.id && all.indexOf(id) === i)
    .forEach((userId) =>
      pushNotification(db, {
        userId,
        type: 'TRANSFER_COMPLETED',
        title: `${t.code} đã hoàn thành`,
        message: `Phiếu ${t.code} đã hoàn thành, tồn kho hai nơi đã được cập nhật.`,
        link: `/facility/transfers/${t.id}`,
      }),
    );
};

const requireUser = (user) => user || fail(401, 'Bạn chưa đăng nhập');

/** Completed / cancelled documents are read-only. */
const assertOpen = (t) => {
  if (t.status === TRANSFER_STATUS.COMPLETED) fail(409, `Phiếu ${t.code} đã hoàn thành, không thể thao tác thêm`);
  if (t.status === TRANSFER_STATUS.CANCELLED) fail(409, `Phiếu ${t.code} đã bị hủy`);
};

/* ---------------- Queries ---------------- */

const matchesFilters = (db, t, filters = {}) => {
  if (filters.status && filters.status !== 'ALL' && t.status !== filters.status) return false;
  if (filters.type && filters.type !== 'ALL' && t.type !== filters.type) return false;
  if (filters.fromDate && t.createdDate < filters.fromDate) return false;
  if (filters.toDate && t.createdDate > filters.toDate) return false;
  if (filters.keyword) {
    const haystack = normalizeText(
      [
        t.code,
        t.reason,
        locName(db, t.fromLocationId),
        locName(db, t.toLocationId),
        userName(db, t.handoverUserId),
        userName(db, t.receiverUserId),
        ...t.items.map((i) => `${i.assetCode} ${i.assetName}`),
      ].join(' '),
    );
    if (!haystack.includes(normalizeText(filters.keyword))) return false;
  }
  return true;
};

export const transferMockRepository = {
  async list(filters, user) {
    await delay();
    requireUser(user);
    const db = readDb();
    const visible = db.transfers.filter((t) => canViewTransfer(t, user));
    return clone(
      visible.filter((t) => matchesFilters(db, t, filters)).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    );
  },

  async getById(id, user) {
    await delay();
    requireUser(user);
    const db = readDb();
    const t = findTransfer(db, id);
    if (!canViewTransfer(t, user)) fail(403, 'Bạn không có quyền xem phiếu này');
    return clone(t);
  },

  /**
   * Current stock of each transfer line at both locations (for the
   * "Biến động tồn kho" block before the transfer is completed).
   */
  async getStockSnapshot(id, user) {
    await delay(120);
    requireUser(user);
    const db = readDb();
    const t = findTransfer(db, id);
    if (!canViewTransfer(t, user)) fail(403, 'Bạn không có quyền xem phiếu này');
    return clone(
      t.items.map((item) => {
        const source = db.assets.find((a) => a.id === item.assetId);
        const toQuantity = db.assets
          .filter((a) => a.locationId === t.toLocationId && a.code === item.assetCode)
          .reduce((sum, a) => sum + a.quantity, 0);
        return {
          itemId: item.id,
          fromQuantity: source?.quantity ?? 0,
          toQuantity,
          reservedElsewhere: source ? reservedQuantity(db, source.id, t.id) : 0,
        };
      }),
    );
  },

  /** Assets at a location with quantity still free to transfer. */
  async getAvailableAssets(locationId, excludeTransferId) {
    await delay(150);
    const db = readDb();
    const available = availabilityMap(db, locationId, excludeTransferId);
    return clone(
      db.assets.filter((a) => a.locationId === locationId && a.quantity > 0).map((a) => ({ ...a, availableQuantity: available[a.id] })),
    );
  },

  /* ---------------- Vice Principal commands ---------------- */

  async saveDraft(id, payload, user) {
    await delay();
    if (!canCreateTransfer(user)) fail(403, 'Chỉ Phó hiệu trưởng được tạo phiếu luân chuyển');
    return writeDb((db) => {
      const data = sanitizePayload(db, payload);
      if (!data.fromLocationId) fail(422, 'Vui lòng chọn ít nhất nơi đi trước khi lưu nháp');
      assertOwnCampus(data, user);
      if (id) {
        const t = findTransfer(db, id);
        if (!canEditTransfer(t, user) || t.status !== TRANSFER_STATUS.DRAFT) fail(409, 'Chỉ phiếu nháp mới được lưu nháp');
        Object.assign(t, data, { updatedAt: now() });
        addHistory(t, 'UPDATED', user);
        return clone(t);
      }
      const t = {
        id: uid('t'),
        code: nextCode(db),
        ...data,
        createdBy: user.id,
        status: TRANSFER_STATUS.DRAFT,
        version: 0,
        signatures: [],
        revisions: [],
        revisionRequests: [],
        discrepancies: [],
        history: [],
        createdAt: now(),
        updatedAt: now(),
      };
      addHistory(t, 'CREATED', user);
      db.transfers.push(t);
      return clone(t);
    });
  },

  /** Creates (or takes a draft) and sends it: DRAFT -> PENDING_HANDOVER. */
  async submit(id, payload, user) {
    await delay(400);
    if (!canCreateTransfer(user)) fail(403, 'Chỉ Phó hiệu trưởng được gửi phiếu luân chuyển');
    return writeDb((db) => {
      const data = sanitizePayload(db, payload);
      assertOwnCampus(data, user);
      // Document date is set by the server when the document is sent.
      data.createdDate = today();
      if (data.expectedHandoverDate < data.createdDate) fail(422, 'Ngày dự kiến bàn giao phải từ hôm nay trở đi');
      assertValidDocument(db, data, id);
      assertNotLocked(db, data);
      let t;
      if (id) {
        t = findTransfer(db, id);
        if (t.status !== TRANSFER_STATUS.DRAFT) fail(409, 'Phiếu này đã được gửi trước đó');
        if (!canEditTransfer(t, user)) fail(403, 'Bạn không có quyền gửi phiếu này');
        Object.assign(t, data);
      } else {
        t = {
          id: uid('t'),
          code: nextCode(db),
          ...data,
          createdBy: user.id,
          signatures: [],
          revisions: [],
          revisionRequests: [],
          discrepancies: [],
          history: [],
          createdAt: now(),
        };
        db.transfers.push(t);
      }
      t.status = TRANSFER_STATUS.PENDING_HANDOVER;
      t.version = 1;
      t.updatedAt = now();
      addSignature(db, t, SIGNATURE_TYPES.CREATOR, user, payload.creatorSignatureUrl);
      addRevision(t, user, 'Phiên bản đầu tiên');
      addHistory(t, 'SUBMITTED', user);

      pushNotification(db, {
        userId: t.handoverUserId,
        type: 'TRANSFER_ASSIGNED',
        title: `Phiếu luân chuyển mới ${t.code}`,
        message: `Bạn là người bàn giao của phiếu ${t.code} (${locName(db, t.fromLocationId)} → ${locName(db, t.toLocationId)}). Vui lòng kiểm tra và xác nhận bàn giao.`,
        link: `/facility/transfers/${t.id}/handover`,
      });
      pushNotification(db, {
        userId: t.receiverUserId,
        type: 'TRANSFER_ASSIGNED',
        title: `Bạn là người nhận phiếu ${t.code}`,
        message: `Phiếu ${t.code} sẽ được bàn giao dự kiến ngày ${t.expectedHandoverDate.split('-').reverse().join('/')}. Bạn xác nhận nhận sau khi người bàn giao ký.`,
        link: `/facility/transfers/${t.id}/receive`,
      });
      return clone(t);
    });
  },

  /** REVISION_REQUESTED -> PENDING_HANDOVER with a new version; history is kept. */
  async resubmit(id, payload, user) {
    await delay(400);
    return writeDb((db) => {
      const t = findTransfer(db, id);
      if (!canEditTransfer(t, user) || t.status !== TRANSFER_STATUS.REVISION_REQUESTED)
        fail(409, 'Chỉ phiếu "Cần điều chỉnh" mới được gửi lại');
      const data = sanitizePayload(db, payload);
      assertOwnCampus(data, user);
      data.createdDate = t.createdDate;
      assertValidDocument(db, data, id);
      assertNotLocked(db, data);

      const before = snapshotOf(t);
      Object.assign(t, data);
      const critical = hasCriticalChange(before, snapshotOf(t));
      t.version += 1;
      t.status = TRANSFER_STATUS.PENDING_HANDOVER;
      t.updatedAt = now();

      // Signatures belong to one document version.
      invalidateSignatures(t, SIGNATURE_TYPES.CREATOR, `Phiếu được điều chỉnh lên phiên bản ${t.version}`);
      if (critical && invalidateSignatures(t, SIGNATURE_TYPES.HANDOVER, 'Dữ liệu quan trọng thay đổi sau khi ký')) {
        addHistory(t, 'SIGNATURE_INVALIDATED', user, 'Chữ ký bàn giao cũ không còn hiệu lực');
      }
      addSignature(db, t, SIGNATURE_TYPES.CREATOR, user, payload.creatorSignatureUrl);

      const openRequest = t.revisionRequests.find((r) => !r.resolvedAt);
      if (openRequest) {
        openRequest.resolvedAt = now();
        openRequest.resolvedVersion = t.version;
      }
      addRevision(t, user, payload.changeNote || 'Điều chỉnh theo yêu cầu', openRequest?.id || null);
      addHistory(t, 'RESUBMITTED', user, payload.changeNote || '');

      pushNotification(db, {
        userId: t.handoverUserId,
        type: 'TRANSFER_RESUBMITTED',
        title: `Phiếu ${t.code} đã được điều chỉnh`,
        message: `Phó hiệu trưởng đã điều chỉnh phiếu ${t.code} (phiên bản ${t.version}). Vui lòng kiểm tra lại và xác nhận bàn giao.`,
        link: `/facility/transfers/${t.id}/handover`,
      });
      return clone(t);
    });
  },

  async cancel(id, reason, user) {
    await delay();
    return writeDb((db) => {
      const t = findTransfer(db, id);
      assertOpen(t);
      if (!canCancelTransfer(t, user)) fail(409, 'Không thể hủy phiếu ở trạng thái hiện tại');
      if (!reason?.trim()) fail(422, 'Vui lòng nhập lý do hủy');
      t.status = TRANSFER_STATUS.CANCELLED;
      t.updatedAt = now();
      addHistory(t, 'CANCELLED', user, reason.trim());
      [t.handoverUserId, t.receiverUserId].forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'TRANSFER_CANCELLED',
          title: `Phiếu ${t.code} đã bị hủy`,
          message: `Lý do: ${reason.trim()}`,
          link: `/facility/transfers/${t.id}`,
        }),
      );
      return clone(t);
    });
  },

  /**
   * VP decides each problem part of each line (see PART_CHOICES).
   * All "Chấp nhận" -> completed right away with the received quantities (the receiver already signed the report).
   * Any "giao thêm / trả lại / đổi" -> back to the handover person for that follow-up only, then the receiver confirms.
   */
  async resolveDiscrepancy(id, { note, decisions }, user) {
    await delay(400);
    return writeDb((db) => {
      const t = findTransfer(db, id);
      assertOpen(t);
      if (t.fromCampusId !== user.campusId) fail(403, 'Chỉ Phó hiệu trưởng campus gửi tài sản được xử lý chênh lệch');
      if (!canResolveDiscrepancy(t, user)) fail(409, 'Phiếu không ở trạng thái chờ xử lý chênh lệch');
      const discrepancy = t.discrepancies.find((d) => d.status === 'OPEN') || fail(409, 'Không có chênh lệch đang mở');
      if (!note?.trim()) fail(422, 'Vui lòng nhập nội dung xử lý');

      let followUp = false;
      const plan = discrepancy.lines.map((line) => {
        const item = t.items.find((i) => i.id === line.itemId) || fail(422, 'Tài sản không thuộc phiếu');
        const parts = discrepancyParts(line);
        const d = (decisions || []).find((x) => x.itemId === line.itemId) || {};
        const choice = {};
        DISCREPANCY_PARTS.forEach((part) => {
          if (!parts[part]) return;
          if (!PART_CHOICES[part].includes(d[part]))
            fail(422, `${item.assetName}: vui lòng chọn cách xử lý phần ${DISCREPANCY_PART_LABELS[part].toLowerCase()}`);
          choice[part] = d[part];
        });
        const deliver =
          (choice.shortage === RESOLUTION_CHOICES.SUPPLEMENT ? parts.shortage : 0) +
          (choice.damaged === RESOLUTION_CHOICES.REPLACE ? parts.damaged : 0);
        const takeBack = choice.surplus === RESOLUTION_CHOICES.RETURN ? parts.surplus : 0;
        if (deliver || takeBack) followUp = true;
        return { item, line, parts, choice, deliver, takeBack, finalQuantity: parts.good + deliver - takeBack };
      });

      // Accepted surplus also leaves the sending room, so it must not be reserved by another transfer.
      const available = availabilityMap(db, t.fromLocationId, t.id);
      plan.forEach(({ item, finalQuantity }) => {
        if (finalQuantity > item.quantity && finalQuantity > (available[item.assetId] ?? 0))
          fail(422, `${item.assetCode}: nơi đi chỉ còn ${available[item.assetId] ?? 0} khả dụng, không đủ để giữ phần thừa`);
      });

      plan.forEach(({ item, line, parts, choice, deliver, takeBack, finalQuantity }) => {
        item.acceptedQuantity = finalQuantity;
        item.supplementRequired = deliver || null;
        item.returnRequired = takeBack || null;
        item.damagedReturned = (item.damagedReturned || 0) + parts.damaged;
        line.decision = choice;
      });
      t.items.forEach((item) => {
        // Lines without a problem keep what the receiver counted.
        if (!plan.some((p) => p.item.id === item.id)) item.acceptedQuantity = expectedReceiveQuantity(item);
      });

      discrepancy.status = 'RESOLVED';
      discrepancy.resolution = {
        note: note.trim(),
        decisions: plan.map(({ item, choice, deliver, takeBack }) => ({ itemId: item.id, ...choice, deliver, takeBack })),
        resolvedBy: user.id,
        resolvedAt: now(),
      };
      t.updatedAt = now();
      addHistory(t, 'DISCREPANCY_RESOLVED', user, note.trim());

      if (!followUp) {
        // Everything accepted: the counts in the report are final.
        t.items.forEach((item) => {
          item.receivedQuantity = expectedReceiveQuantity(item);
        });
        completeTransfer(db, t, user, `PHT chấp nhận số lượng thực nhận: ${note.trim()}`);
        return clone(t);
      }

      // The receiver will check again after the follow-up, so the report signature no longer closes the document.
      invalidateSignatures(t, SIGNATURE_TYPES.RECEIVER, 'Chờ giao thêm / trả lại theo xử lý chênh lệch');
      resetReceived(t);
      t.status = TRANSFER_STATUS.PENDING_HANDOVER;
      const tasks = plan
        .filter((p) => p.deliver || p.takeBack)
        .map(
          (p) =>
            `${p.item.assetName}: ${[p.deliver && `giao thêm ${p.deliver}`, p.takeBack && `lấy về ${p.takeBack} (giao thừa)`].filter(Boolean).join(', ')}`,
        )
        .join('; ');
      pushNotification(db, {
        userId: t.handoverUserId,
        type: 'DISCREPANCY_RESOLVED',
        title: `Cần giao thêm / lấy lại phiếu ${t.code}`,
        message: `PHT đã xử lý chênh lệch: ${tasks}. ${note.trim()}`,
        link: `/facility/transfers/${t.id}/handover`,
      });
      pushNotification(db, {
        userId: t.receiverUserId,
        type: 'DISCREPANCY_RESOLVED',
        title: `Chênh lệch phiếu ${t.code} đã được xử lý`,
        message: `${tasks}. Sau khi người bàn giao thực hiện, bạn kiểm tra và xác nhận nhận.`,
        link: `/facility/transfers/${t.id}/receive`,
      });
      return clone(t);
    });
  },

  /* ---------------- Handover person ---------------- */

  async requestRevision(id, reason, user) {
    await delay();
    return writeDb((db) => {
      const t = findTransfer(db, id);
      if (!canRequestRevision(t, user)) fail(403, 'Chỉ người bàn giao được yêu cầu điều chỉnh khi phiếu đang chờ bàn giao');
      if (!reason?.trim()) fail(422, 'Vui lòng nhập lý do yêu cầu điều chỉnh');
      t.revisionRequests.push({
        id: uid('rr'),
        requestedBy: user.id,
        requestedAt: now(),
        reason: reason.trim(),
        version: t.version,
        resolvedAt: null,
        resolvedVersion: null,
      });
      t.status = TRANSFER_STATUS.REVISION_REQUESTED;
      t.updatedAt = now();
      addHistory(t, 'REVISION_REQUESTED', user, reason.trim());
      pushNotification(db, {
        userId: t.createdBy,
        type: 'REVISION_REQUESTED',
        title: `Yêu cầu điều chỉnh ${t.code}`,
        message: `${user.fullName}: ${reason.trim()}`,
        link: `/facility/transfers/${t.id}`,
      });
      return clone(t);
    });
  },

  async confirmHandover(id, { items, signatureUrl }, user) {
    await delay(400);
    return writeDb((db) => {
      const t = findTransfer(db, id);
      assertOpen(t);
      if (!canHandover(t, user)) fail(403, 'Bạn không thể xác nhận bàn giao phiếu này');
      if (isSupplementMode(t)) fail(409, 'Phiếu đang chờ giao bổ sung, hãy dùng "Xác nhận giao bổ sung"');
      assertNotLocked(db, t);
      assertAllLines(t, items, 'nhập số lượng bàn giao cho');
      items.forEach((input) => {
        const item = t.items.find((i) => i.id === input.itemId) || fail(422, 'Tài sản không thuộc phiếu');
        const qty = Number(input.handoverQuantity);
        if (!Number.isInteger(qty) || qty < 0) fail(422, `${item.assetCode}: số lượng bàn giao không hợp lệ`);
        if (qty > item.quantity) fail(422, `${item.assetCode}: số lượng bàn giao không được vượt số lượng theo phiếu (${item.quantity})`);
        if (qty !== item.quantity && !input.handoverNote?.trim())
          fail(422, `${item.assetCode}: vui lòng ghi chú lý do số lượng bàn giao khác phiếu`);
        if (!input.handoverCondition) fail(422, `${item.assetCode}: vui lòng chọn tình trạng`);
        item.handoverQuantity = qty;
        item.handoverCondition = input.handoverCondition;
        item.handoverNote = input.handoverNote?.trim() || '';
        item.handoverImages = input.handoverImages || [];
      });
      if (t.items.every((i) => !i.handoverQuantity)) fail(422, 'Tổng số lượng bàn giao phải lớn hơn 0');
      addSignature(db, t, SIGNATURE_TYPES.HANDOVER, user, signatureUrl);
      t.status = TRANSFER_STATUS.PENDING_RECEIPT;
      t.updatedAt = now();
      addHistory(t, 'HANDOVER_CONFIRMED', user);
      pushNotification(db, {
        userId: t.receiverUserId,
        type: 'HANDOVER_CONFIRMED',
        title: `Chờ xác nhận nhận ${t.code}`,
        message: `${user.fullName} đã bàn giao phiếu ${t.code}. Vui lòng kiểm tra thực tế và xác nhận nhận.`,
        link: `/facility/transfers/${t.id}/receive`,
      });
      pushNotification(db, {
        userId: t.createdBy,
        type: 'HANDOVER_CONFIRMED',
        title: `${t.code} đã bàn giao`,
        message: `${user.fullName} đã ký bàn giao.`,
        link: `/facility/transfers/${t.id}`,
      });
      return clone(t);
    });
  },

  /** Follow-up asked by the VP: deliver missing / replacement units and take back surplus units. */
  async confirmSupplement(id, { items, signatureUrl }, user) {
    await delay(400);
    return writeDb((db) => {
      const t = findTransfer(db, id);
      assertOpen(t);
      if (!canHandover(t, user) || !isSupplementMode(t)) fail(409, 'Phiếu không ở trạng thái chờ giao thêm / lấy lại');
      assertNotLocked(db, t);
      assertOwnSignature(db, user, signatureUrl);
      const notes = [];
      t.items
        .filter((i) => i.supplementRequired > 0 || i.returnRequired > 0)
        .forEach((item) => {
          const input = items.find((x) => x.itemId === item.id) || {};
          const note = (input.note || '').trim();
          const need = item.supplementRequired || 0;
          const back = item.returnRequired || 0;
          const delivered = Number(input.quantity ?? 0);
          const returned = Number(input.returnedQuantity ?? 0);
          if (!Number.isInteger(delivered) || delivered < 0 || delivered > need)
            fail(422, `${item.assetCode}: số giao thêm phải từ 0 đến ${need}`);
          if (!Number.isInteger(returned) || returned < 0 || returned > back)
            fail(422, `${item.assetCode}: số lấy về phải từ 0 đến ${back}`);
          if ((delivered < need || returned < back) && !note) fail(422, `${item.assetCode}: làm chưa đủ theo yêu cầu, vui lòng ghi lý do`);
          // What was not delivered / not taken back changes the final quantity the receiver keeps.
          item.acceptedQuantity = (item.acceptedQuantity ?? expectedReceiveQuantity(item)) - (need - delivered) + (back - returned);
          item.supplementHistory = [
            ...(item.supplementHistory || []),
            { quantity: delivered, returned, note, images: input.images || [], by: user.id, at: now() },
          ];
          item.supplementRequired = null;
          item.returnRequired = null;
          notes.push(`${item.assetName}: giao thêm ${delivered}/${need}${back ? `, lấy về ${returned}/${back}` : ''}`);
        });
      invalidateSignatures(t, SIGNATURE_TYPES.HANDOVER, 'Cập nhật sau khi giao thêm / lấy lại');
      addSignature(db, t, SIGNATURE_TYPES.HANDOVER, user, signatureUrl);
      t.status = TRANSFER_STATUS.PENDING_RECEIPT;
      t.updatedAt = now();
      addHistory(t, 'SUPPLEMENT_DELIVERED', user, notes.join('; '));
      [t.receiverUserId, t.createdBy].forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'SUPPLEMENT_DELIVERED',
          title: `${t.code}: đã giao thêm / lấy lại`,
          message: `${user.fullName}: ${notes.join('; ')}.${userId === t.receiverUserId ? ' Vui lòng kiểm tra và xác nhận nhận.' : ''}`,
          link: userId === t.receiverUserId ? `/facility/transfers/${t.id}/receive` : `/facility/transfers/${t.id}`,
        }),
      );
      return clone(t);
    });
  },

  /* ---------------- Receiver ---------------- */

  async confirmReceipt(id, { items, signatureUrl }, user) {
    await delay(400);
    return writeDb((db) => {
      const t = findTransfer(db, id);
      assertOpen(t);
      if (!canReceive(t, user)) fail(403, 'Bạn chỉ xác nhận nhận được sau khi người bàn giao đã ký');
      assertNotLocked(db, t);
      assertAllLines(t, items, 'kiểm tra và xác nhận');
      items.forEach((input) => {
        const item = t.items.find((i) => i.id === input.itemId) || fail(422, 'Tài sản không thuộc phiếu');
        const expected = expectedReceiveQuantity(item);
        if (Number(input.receivedQuantity) !== expected)
          fail(422, `${item.assetCode}: số lượng thực nhận khác số cần nhận. Hãy dùng "Báo chênh lệch".`);
        if (input.receivedCondition === 'BROKEN' && expected > 0) fail(422, `${item.assetCode}: tài sản hỏng. Hãy dùng "Báo chênh lệch".`);
        item.receivedQuantity = expected;
        item.receivedCondition = input.receivedCondition || item.handoverCondition;
        item.receivedNote = input.receivedNote?.trim() || '';
        item.receivedImages = input.receivedImages || [];
      });

      addSignature(db, t, SIGNATURE_TYPES.RECEIVER, user, signatureUrl);
      addHistory(t, 'RECEIPT_CONFIRMED', user);
      completeTransfer(db, t, user);
      return clone(t);
    });
  },

  /** Receiver reports what was actually received; the report is signed, so "Chấp nhận" can close the document. */
  async reportDiscrepancy(id, { description, items, signatureUrl }, user) {
    await delay(400);
    return writeDb((db) => {
      const t = findTransfer(db, id);
      assertOpen(t);
      if (!canReceive(t, user)) fail(403, 'Bạn chỉ báo chênh lệch được sau khi người bàn giao đã ký');
      if (!description?.trim()) fail(422, 'Vui lòng mô tả chênh lệch');
      assertAllLines(t, items, 'kiểm tra');
      const lines = [];
      items.forEach((input) => {
        const item = t.items.find((i) => i.id === input.itemId) || fail(422, 'Tài sản không thuộc phiếu');
        const qty = Number(input.receivedQuantity);
        if (!Number.isInteger(qty) || qty < 0) fail(422, `${item.assetCode}: số lượng thực nhận không hợp lệ`);
        if (!input.receivedCondition) fail(422, `${item.assetCode}: vui lòng chọn tình trạng thực nhận`);
        // A bad condition without a count means every received unit is damaged.
        let damaged = Number(input.damagedQuantity ?? 0);
        if (!damaged && isBadCondition(input.receivedCondition)) damaged = qty;
        if (!Number.isInteger(damaged) || damaged < 0 || damaged > qty) fail(422, `${item.assetCode}: số hỏng phải từ 0 đến ${qty}`);
        item.receivedQuantity = qty;
        item.receivedCondition =
          damaged === qty && qty > 0 ? input.receivedCondition : isBadCondition(input.receivedCondition) ? 'GOOD' : input.receivedCondition;
        item.receivedNote = input.receivedNote?.trim() || '';
        item.receivedImages = input.receivedImages || [];
        const expected = expectedReceiveQuantity(item);
        if (qty !== expected || damaged > 0) {
          lines.push({
            itemId: item.id,
            documentQuantity: item.quantity,
            handoverQuantity: item.handoverQuantity ?? item.quantity,
            expectedQuantity: expected,
            receivedQuantity: qty,
            damagedQuantity: damaged,
            difference: qty - expected,
            condition: input.receivedCondition,
            note: item.receivedNote,
            images: item.receivedImages,
          });
        }
      });
      if (!lines.length) fail(422, 'Không phát hiện thiếu, thừa hoặc hỏng. Nếu mọi thứ đúng, hãy chọn "Xác nhận nhận".');
      invalidateSignatures(t, SIGNATURE_TYPES.RECEIVER, 'Ký lại khi báo chênh lệch');
      addSignature(db, t, SIGNATURE_TYPES.RECEIVER, user, signatureUrl);
      t.discrepancies.push({
        id: uid('dc'),
        reportedBy: user.id,
        reportedAt: now(),
        description: description.trim(),
        lines,
        status: 'OPEN',
        resolution: null,
      });
      t.status = TRANSFER_STATUS.PENDING_RESOLUTION;
      t.updatedAt = now();
      addHistory(t, 'DISCREPANCY_REPORTED', user, description.trim());
      pushNotification(db, {
        userId: t.createdBy,
        type: 'DISCREPANCY_REPORTED',
        title: `Báo chênh lệch ${t.code}`,
        message: `${user.fullName}: ${description.trim()}`,
        link: `/facility/transfers/${t.id}/discrepancy`,
      });
      pushNotification(db, {
        userId: t.handoverUserId,
        type: 'DISCREPANCY_REPORTED',
        title: `Phiếu ${t.code} có chênh lệch khi nhận`,
        message: `${user.fullName} báo: ${description.trim()}. Phó hiệu trưởng sẽ quyết định giao thêm / trả lại hay chấp nhận.`,
        link: `/facility/transfers/${t.id}/handover`,
      });
      return clone(t);
    });
  },

  /** Exposed for the wizard: server-side quantity check without saving. */
  async validateItemsAgainstStock(locationId, items, excludeTransferId) {
    await delay(50);
    const db = readDb();
    return validateItems(items, availabilityMap(db, locationId, excludeTransferId));
  },
};
