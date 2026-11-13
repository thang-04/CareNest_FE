import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import {
  INSPECTION_COLUMNS,
  INSPECTION_REQUIRED,
  INSPECTION_STATUS,
  INSPECTION_TAB,
  INSPECTION_TAB_ORDER,
} from '@/models/kitchen/inspectionConstants';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { kitchenMockRepository as kitchen } from '@/services/kitchen/mock/kitchenMockRepository';
import { canAccessCampus, canFillInspection, canViewInspection } from '@/utils/kitchen/kitchenPermissions';

/*
 * BE giả của kiểm thực ba bước M1–M3 (P-27): khung mỗi mẫu lấy từ thực đơn công bố, suất đã xác nhận, kiểm nhận hàng tươi và phiếu
 * nhập kho khô (nhà cung cấp, hạn dùng điền sẵn); PHT nhập các ô còn lại, lưu nháp rồi ký bằng ảnh chữ ký.
 * Ảnh chữ ký được chép vào mẫu lúc ký. Mẫu đã ký bị khóa: muốn sửa phải "Sửa lại" kèm lý do (chữ ký cũ vào lịch sử, mẫu về chưa ký,
 * ký lại sau khi sửa). Ký cần mọi dòng đã chọn Đạt / Không đạt. Thay bằng `/inspections/*` khi BE có.
 */
const MSG_FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const forbid = () => {
  throw new ApiError(403, MSG_FORBIDDEN);
};
const guardView = (user, campusId) => {
  if (!canViewInspection(user) || !campusId || !canAccessCampus(user, campusId)) forbid();
};
const guardFill = (user, campusId) => {
  if (!canFillInspection(user, campusId)) forbid();
};
const tabOrFail = (tab) => {
  if (!INSPECTION_TAB_ORDER.includes(tab)) throw new ApiError(404, 'Không có mẫu kiểm thực này.');
};

const storeOf = (db) => (db.inspections ||= []);
const recordOf = (db, campusId, date, tab) => storeOf(db).find((r) => r.campusId === campusId && r.date === date && r.tab === tab) || null;
const nowIso = () => new Date().toISOString();
const isSigned = (record) => record?.status === INSPECTION_STATUS.SIGNED && record.signature?.valid !== false;

/* ---- Khung dòng của từng mẫu (lấy từ dữ liệu bếp; ô nhập có giá trị điền sẵn thì PHT chỉ cần soát) ---- */

const contactOf = (supplier) => [supplier.address, supplier.phone].filter(Boolean).join(', ');
const timeOf = (text) =>
  String(text || '')
    .match(/(\d{2}):(\d{2})/)
    ?.slice(1, 3)
    .join(':') || '';

const freshSkeleton = async ({ campusId, date }, user, suppliers) => {
  const receipt = await kitchen.getFreshReceipt({ campusId, date }, user);
  const supplier = suppliers.find((s) => s.name === receipt.supplierName);
  return (receipt.lines || []).map((line) => ({
    key: String(line.foodId),
    name: line.name,
    unit: line.unit,
    quantity: line.received ?? line.delivered ?? null,
    supplierName: receipt.supplierName || '',
    supplierContact: supplier ? contactOf(supplier) : '',
    deliveryPerson: supplier?.contactName || '',
    receivedAt: timeOf(receipt.deliveredAt),
  }));
};

const drySkeleton = async ({ campusId, date }, user, suppliers) => {
  const [view, receipts] = await Promise.all([
    kitchen.getStockIssues({ campusId, from: date, to: date }, user),
    kitchen.getStockReceipts({ campusId }, user),
  ]);
  const issue = (view.issues || []).find((i) => i.date === date);
  // Phiếu nhập mới nhất (không sau ngày kiểm tra) có thực phẩm đó cho biết nhà cung cấp, ngày nhập, hạn dùng;
  // dữ liệu mẫu có phiếu nhập sau ngày kiểm tra, chưa có phiếu trước đó thì lấy phiếu sớm nhất có thực phẩm này
  const sorted = [...(receipts || [])].sort((a, b) => b.date.localeCompare(a.date));
  const hasFood = (r, foodId) => (r.items || []).some((it) => it.foodId === foodId);
  return (issue?.items || []).map((item) => {
    const receipt =
      sorted.find((r) => r.date <= date && hasFood(r, item.foodId)) || [...sorted].reverse().find((r) => hasFood(r, item.foodId));
    const line = receipt?.items.find((it) => it.foodId === item.foodId);
    const supplier = suppliers.find((s) => s.id === receipt?.supplierId) || suppliers.find((s) => s.name === receipt?.supplierName);
    return {
      key: String(item.foodId),
      name: item.name,
      unit: item.unit,
      quantity: item.issuedQty || item.requiredQty || null,
      supplierName: supplier?.name || receipt?.supplierName || '',
      supplierContact: supplier ? contactOf(supplier) : '',
      deliveryPerson: supplier?.contactName || '',
      receivedAt: receipt?.date || '',
      expiryDate: line?.expiryDate || '',
    };
  });
};

const mealSkeleton = async ({ campusId, date }, user) => {
  const log = await kitchen.getFoodSampleLog({ campusId, date }, user);
  return (log.meals || []).flatMap((meal) =>
    (meal.dishes || []).map((dish) => ({
      key: `${meal.session}:${dish.dishId}`,
      session: meal.session,
      sessionLabel: MEAL_SESSION_LABELS[meal.session] || meal.session,
      dishName: dish.name,
      servings: meal.servings,
    })),
  );
};

// M5: sổ lưu mẫu do bếp ghi; chỉ các bữa đã lấy mẫu, mỗi món một dòng với khối lượng, dụng cụ chứa, nhiệt độ, giờ lấy và hủy mẫu
const sampleSkeleton = async ({ campusId, date }, user) => {
  const log = await kitchen.getFoodSampleLog({ campusId, date }, user);
  return (log.meals || [])
    .filter((meal) => meal.takenAt)
    .flatMap((meal) =>
      (meal.dishes || []).map((dish) => ({
        key: `${meal.session}:${dish.dishId}`,
        session: meal.session,
        sessionLabel: MEAL_SESSION_LABELS[meal.session] || meal.session,
        dishName: dish.name,
        servings: meal.servings,
        weight: dish.weight || '',
        container: dish.container || '',
        temperature: dish.temperature || '',
        takenAt: meal.takenAt,
        destroyedAt: meal.destroyedAt || '',
      })),
    );
};

const suppliersOf = async (user) => (await kitchen.getSuppliers({}, user)).filter((s) => s.status !== 'INACTIVE');

const skeletonOf = async (tab, { campusId, date }, user) => {
  if (tab === INSPECTION_TAB.FRESH || tab === INSPECTION_TAB.DRY) {
    const suppliers = await suppliersOf(user);
    return (tab === INSPECTION_TAB.FRESH ? freshSkeleton : drySkeleton)({ campusId, date }, user, suppliers);
  }
  if (tab === INSPECTION_TAB.SAMPLE) return sampleSkeleton({ campusId, date }, user);
  return mealSkeleton({ campusId, date }, user);
};

const editableKeys = (tab) => INSPECTION_COLUMNS[tab].filter((c) => !c.readOnly).map((c) => c.key);

const tabView = (tab, skeleton, record, canEdit) => {
  const stored = record?.rows || {};
  const rows = skeleton.map((base) => {
    const saved = stored[base.key] || {};
    const row = { ...base };
    editableKeys(tab).forEach((key) => {
      // Ô đã nhập thắng giá trị điền sẵn (số lượng hàng nhập, nhà cung cấp…)
      if (saved[key] !== undefined && saved[key] !== null && saved[key] !== '') row[key] = saved[key];
      else if (row[key] === undefined) row[key] = key === 'quantity' ? null : '';
    });
    return row;
  });
  const signed = isSigned(record);
  return {
    tab,
    rows,
    status: record?.status || INSPECTION_STATUS.DRAFT,
    version: record?.version || 0,
    updatedAt: record?.updatedAt || null,
    updatedByName: record?.updatedByName || null,
    signature: record?.signature || null,
    history: record?.history || [],
    header: { place: record?.header?.place || '', checkedAt: record?.header?.checkedAt || '' },
    // Mẫu đã ký bị khóa; chỉ "Sửa lại" (kèm lý do) mới mở khóa
    canEdit: canEdit && !signed,
    canReopen: canEdit && signed,
  };
};

/* ---- Kiểm ô nhập ---- */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

const validateRows = (tab, rows, validKeys) => {
  const errors = {};
  const columns = INSPECTION_COLUMNS[tab].filter((c) => !c.readOnly);
  rows.forEach((row) => {
    if (!validKeys.has(row.key)) {
      errors[row.key] = 'Dòng này không còn trong dữ liệu của ngày.';
      return;
    }
    columns.forEach((col) => {
      const value = row[col.key];
      if (value == null || value === '') return;
      const bad =
        (col.type === 'time' && !TIME.test(value)) ||
        (col.type === 'date' && !DATE.test(value)) ||
        (col.type === 'datetime' && !DATETIME.test(value)) ||
        (col.type === 'number' && !(Number(value) >= 0)) ||
        (col.type === 'check' && value !== col.checkedValue) ||
        (col.type === 'passfail' && value !== 'PASS' && value !== 'FAIL') ||
        (col.type === 'select' && !col.options.some((o) => o.value === value));
      if (bad) errors[`${row.key}.${col.key}`] = 'Giá trị không hợp lệ.';
    });
  });
  return errors;
};

const pick = (tab, row) => Object.fromEntries(editableKeys(tab).map((key) => [key, row[key] ?? '']));
const who = (user) => user.fullName || user.name || '';

export const inspectionMockRepository = {
  /** Bốn mẫu của một điểm trường và ngày: dòng, trạng thái, chữ ký, lịch sử, cờ `canEdit` / `canReopen`. */
  async getInspectionDay({ campusId, date }, user) {
    await delay();
    guardView(user, campusId);
    const db = readDb();
    const canEdit = canFillInspection(user, campusId);
    // M2 và M3 dùng chung một khung món theo bữa: đọc một lần, các nguồn đọc song song
    const [fresh, dry, meals, sample] = await Promise.all([
      skeletonOf(INSPECTION_TAB.FRESH, { campusId, date }, user),
      skeletonOf(INSPECTION_TAB.DRY, { campusId, date }, user),
      mealSkeleton({ campusId, date }, user),
      sampleSkeleton({ campusId, date }, user),
    ]);
    const skeletons = {
      [INSPECTION_TAB.FRESH]: fresh,
      [INSPECTION_TAB.DRY]: dry,
      [INSPECTION_TAB.PROCESS]: meals,
      [INSPECTION_TAB.SERVE]: meals,
      [INSPECTION_TAB.SAMPLE]: sample,
    };
    // Mẫu đã ký giữ nguyên các dòng lúc ký (bản chụp), dữ liệu bếp đổi sau đó không làm đổi chứng từ
    const tabs = Object.fromEntries(
      INSPECTION_TAB_ORDER.map((tab) => {
        const record = recordOf(db, campusId, date, tab);
        return [tab, tabView(tab, isSigned(record) && record.snapshot ? record.snapshot : skeletons[tab], record, canEdit)];
      }),
    );
    return clone({ campusId, date, canEdit, tabs });
  },

  /** Nhà cung cấp đang dùng để điền nhanh cột "Nơi cung cấp" của M1. */
  async getInspectionSuppliers(user) {
    await delay();
    if (!canViewInspection(user)) forbid();
    return clone(
      (await suppliersOf(user)).map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address || '',
        phone: s.phone || '',
        contactName: s.contactName || '',
      })),
    );
  },

  /** Lưu nháp một mẫu chưa ký. Mẫu đã ký bị khóa. */
  async saveInspectionTab({ campusId, date, tab, header, rows, version }, user) {
    await delay();
    tabOrFail(tab);
    guardFill(user, campusId);
    if (isSigned(recordOf(readDb(), campusId, date, tab)))
      throw new ApiError(409, 'Mẫu này đã ký nên đang khóa. Bấm "Sửa lại" và ghi lý do nếu cần chỉnh.');
    const skeleton = await skeletonOf(tab, { campusId, date }, user);
    const errors = validateRows(tab, rows || [], new Set(skeleton.map((r) => r.key)));
    if (header?.checkedAt && !DATETIME.test(header.checkedAt)) errors['header.checkedAt'] = 'Giá trị không hợp lệ.';
    if (Object.keys(errors).length) throw new ApiError(422, 'Thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.', errors);
    return writeDb((db) => {
      let record = recordOf(db, campusId, date, tab);
      // BE: lưu lệch phiên bản đang sửa nghĩa là có người lưu trước ⇒ 409, không ghi đè
      if (version != null && version !== (record?.version || 0)) {
        throw new ApiError(409, 'Mẫu vừa được người khác lưu. Tải lại rồi sửa tiếp.');
      }
      if (!record) {
        record = {
          campusId,
          date,
          tab,
          rows: {},
          header: { place: '', checkedAt: '' },
          status: INSPECTION_STATUS.DRAFT,
          version: 0,
          signature: null,
          history: [],
        };
        storeOf(db).push(record);
      }
      const next = Object.fromEntries((rows || []).map((row) => [row.key, pick(tab, row)]));
      const nextHeader = { place: String(header?.place || '').trim(), checkedAt: header?.checkedAt || '' };
      if (JSON.stringify([next, nextHeader]) !== JSON.stringify([record.rows, record.header])) {
        record.rows = next;
        record.header = nextHeader;
        record.version += 1;
        record.updatedAt = nowIso();
        record.updatedByName = who(user);
        record.status = INSPECTION_STATUS.DRAFT;
      }
      return clone({ version: record.version, status: record.status });
    });
  },

  /** Ký mẫu bằng ảnh chữ ký của người đang đăng nhập; ảnh được chép vào mẫu. Cần mọi dòng đã chọn Đạt / Không đạt. */
  async signInspectionTab({ campusId, date, tab, imageUrl }, user) {
    await delay();
    tabOrFail(tab);
    guardFill(user, campusId);
    if (!imageUrl) throw new ApiError(422, 'Chọn một chữ ký để ký.');
    const skeleton = await skeletonOf(tab, { campusId, date }, user);
    return writeDb((db) => {
      const required = INSPECTION_REQUIRED[tab];
      let record = recordOf(db, campusId, date, tab);
      if (!record && !required && skeleton.length) {
        // Mẫu chỉ để soát (M5) không có ô bắt buộc nhập: ký được ngay cả khi chưa lưu nháp
        record = {
          campusId,
          date,
          tab,
          rows: {},
          header: { place: '', checkedAt: '' },
          status: INSPECTION_STATUS.DRAFT,
          version: 1,
          signature: null,
          history: [],
        };
        storeOf(db).push(record);
      }
      if (!record || !record.version) throw new ApiError(409, 'Mẫu chưa được lưu. Bấm "Lưu nháp" rồi ký.');
      if (isSigned(record)) throw new ApiError(409, 'Mẫu này đã được ký. Tải lại trang để xem bản mới nhất.');
      const missing = required ? skeleton.filter((row) => !['PASS', 'FAIL'].includes(record.rows[row.key]?.[required])).length : 0;
      if (missing) throw new ApiError(422, `Còn ${missing} dòng chưa chọn Đạt / Không đạt. Chọn đủ rồi ký.`);
      // BE INS-02 (QĐ 1246 Điều 3.1, 4.2, 5.5): dòng Không đạt phải ghi biện pháp xử lý ở ghi chú
      const noAction = required
        ? skeleton.filter((row) => {
            const saved = record.rows[row.key] || {};
            return (saved.sensory === 'FAIL' || saved.rapidTest === 'FAIL') && !String(saved.note || '').trim();
          }).length
        : 0;
      if (noAction) throw new ApiError(422, `Còn ${noAction} dòng Không đạt chưa ghi biện pháp xử lý (loại bỏ, trả lại, tiêu hủy...).`);
      record.snapshot = clone(skeleton);
      record.signature = {
        userId: user.id,
        signedByName: who(user),
        imageUrl,
        signedAt: nowIso(),
        documentVersion: record.version,
        valid: true,
        invalidReason: '',
      };
      record.status = INSPECTION_STATUS.SIGNED;
      (record.history ||= []).push({ action: 'SIGNED', at: record.signature.signedAt, byName: record.signature.signedByName, note: '' });
      return clone({ status: record.status, signature: record.signature });
    });
  },

  /** Mở khóa mẫu đã ký để sửa: bắt buộc lý do; chữ ký cũ vào lịch sử, mẫu về chưa ký. */
  async reopenInspectionTab({ campusId, date, tab, reason }, user) {
    await delay();
    tabOrFail(tab);
    guardFill(user, campusId);
    const note = String(reason || '').trim();
    if (note.length < 3) throw new ApiError(422, 'Nhập lý do sửa lại.', { reason: 'Nhập lý do sửa lại (ít nhất 3 ký tự).' });
    return writeDb((db) => {
      const record = recordOf(db, campusId, date, tab);
      if (!isSigned(record)) throw new ApiError(409, 'Mẫu này chưa ký nên sửa được ngay.');
      (record.history ||= []).push({
        action: 'REOPENED',
        at: nowIso(),
        byName: who(user),
        note,
        previousSignedAt: record.signature.signedAt,
      });
      record.signature = null;
      record.snapshot = null;
      record.status = INSPECTION_STATUS.DRAFT;
      record.version += 1;
      return clone({ status: record.status });
    });
  },
};
