import { SEED_YOUNG_CHILD_ID } from './schoolSeed';

/*
 * DB demo đã lưu (một lần): trẻ viết tay Phạm Gia Khánh từng mang id ch_037, trùng trẻ bổ sung của Lớp Mầm 1
 * (FE-BUG-261023-seed-duplicate-child-id-ch037). Đổi trẻ viết tay sang id mới; các bản ghi seed sinh cho cả hai trẻ cùng
 * childId 'ch_037' thì bản sinh sau thuộc trẻ viết tay (seed duyệt trẻ bổ sung trước) nên chuyển sang id mới.
 */
const OLD = 'ch_037';
const NEW = SEED_YOUNG_CHILD_ID;
const YOUNG = { fullName: 'Phạm Gia Khánh', code: 'HS26037' };
const YOUNG_PHONE = '0987012037';
const digits = (v) => String(v || '').replace(/\s/g, '');
const renameId = (id) => String(id).replace(OLD, NEW);

/** Bản ghi thứ hai trở đi của cùng một khóa (theo ngày/thời điểm) với childId cũ ⇒ của trẻ viết tay. */
const moveLaterCopies = (list, keyOf) => {
  const seen = new Set();
  list.forEach((row) => {
    if (row?.childId !== OLD) return;
    const key = keyOf(row);
    if (!seen.has(key)) {
      seen.add(key);
      return;
    }
    row.childId = NEW;
    if (typeof row.id === 'string' && row.id.includes(OLD)) row.id = renameId(row.id);
  });
};

export const fixDuplicateSeedChildId = (db) => {
  const children = db.children || [];
  const young = children.find((c) => c.id === OLD && c.fullName === YOUNG.fullName && c.code === YOUNG.code);
  if (!young || children.some((c) => c.id === NEW)) return;
  const shared = children.filter((c) => c.id === OLD).length > 1;
  young.id = NEW;
  young.code = 'HS26902';
  (young.guardians || []).forEach((g) => {
    if (g.email === 'phuhuynh037@example.com') g.email = 'phuhuynh902@example.com';
  });
  // Tài khoản phụ huynh của trẻ viết tay (theo SĐT của mẹ).
  (db.parentAccounts || []).forEach((a) => {
    if (digits(a.phone) !== YOUNG_PHONE) return;
    a.childIds = (a.childIds || []).map((id) => (id === OLD ? NEW : id));
    if (a.email === 'phuhuynh037@example.com') a.email = 'phuhuynh902@example.com';
    if (a.id === 'pa_ch_037') a.id = 'pa_ch_902';
    (young.guardians || []).forEach((g) => {
      if (digits(g.phone) === YOUNG_PHONE && g.accountId) g.accountId = a.id;
    });
  });
  if (!shared) {
    // Chỉ có trẻ viết tay mang id cũ: mọi bản ghi theo id cũ là của trẻ này.
    Object.values(db).forEach(
      (list) =>
        Array.isArray(list) &&
        list.forEach((row) => {
          if (row?.childId !== OLD) return;
          row.childId = NEW;
          if (typeof row.id === 'string' && row.id.includes(OLD)) row.id = renameId(row.id);
        }),
    );
    (db.healthFollowUps || []).forEach((f) => (f.measurementIds = (f.measurementIds || []).map(renameId)));
    return;
  }
  // Phiếu khám mẫu "nguy cơ tự kỷ" (hm_ch_037_open) là của trẻ viết tay; bản gắn nhầm cho trẻ bổ sung thì bỏ.
  const measurements = db.healthMeasurements || [];
  const firstOpen = measurements.findIndex((m) => m.id === 'hm_ch_037_open' && m.childId === OLD);
  const openCount = measurements.filter((m) => m.id === 'hm_ch_037_open').length;
  if (firstOpen >= 0 && openCount > 1) measurements.splice(firstOpen, 1);
  moveLaterCopies(measurements, (m) => (m.id === 'hm_ch_037_open' ? 'open-again' : m.id));
  const open = measurements.find((m) => m.id === 'hm_ch_037_open' && m.childId === OLD);
  if (open) Object.assign(open, { id: renameId(open.id), childId: NEW });
  (db.healthFollowUps || []).forEach((f) => {
    if (f.childId !== OLD || !(f.measurementIds || []).includes('hm_ch_037_open')) return;
    f.childId = NEW;
    f.measurementIds = f.measurementIds.map(renameId);
    (f.history || []).forEach((e) => {
      if (e.measurementId) e.measurementId = renameId(e.measurementId);
    });
  });
  moveLaterCopies(db.healthDeclarations || [], () => 'declaration');
  // Bản ghi theo ngày của các module khác (điểm danh, đón trẻ, đánh giá…): bản thứ hai cùng ngày là của trẻ viết tay.
  const handled = new Set(['children', 'parentAccounts', 'healthMeasurements', 'healthFollowUps', 'healthDeclarations']);
  Object.entries(db).forEach(([name, list]) => {
    if (!handled.has(name) && Array.isArray(list)) moveLaterCopies(list, (row) => row.date ?? row.at ?? '');
  });
};
