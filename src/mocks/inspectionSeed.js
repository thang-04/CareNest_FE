import { makeSignatureSvg } from './signatureArt';

/**
 * Demo inventory rounds.
 * KK001 – completed last school year (Campus 1 classes).
 * KK002 – running on Campus 1 office, medical room and music room.
 */
const sheetItems = (assets, locationId, counts = {}) =>
  assets
    .filter((a) => a.locationId === locationId && a.quantity > 0)
    .map((a) => {
      const c = counts[a.code];
      return {
        assetId: a.id,
        assetCode: a.code,
        assetName: a.name,
        unit: a.unit,
        categoryId: a.categoryId,
        bookQuantity: a.quantity,
        bookCondition: a.condition,
        actualQuantity: c ? (c.qty ?? a.quantity) : null,
        actualCondition: c ? c.cond || a.condition : null,
        note: c?.note || '',
        images: [],
        flagged: false,
      };
    });

const allCounted = (assets, locationId, overrides = {}) => {
  const counts = {};
  assets
    .filter((a) => a.locationId === locationId)
    .forEach((a) => {
      counts[a.code] = overrides[a.code] || {};
    });
  return sheetItems(assets, locationId, counts);
};

const sig = (userId, name, at, variant = 0) => ({
  signatureUrl: makeSignatureSvg(name, variant),
  signedAt: at,
  signedBy: userId,
  signedByName: name,
});

const sheet = (code, locationId, inspectorUserId, status, items, extra = {}) => ({
  id: `sh_${code}`,
  code,
  locationId,
  inspectorUserId,
  status,
  items,
  inspectorSignature: null,
  recountRequests: [],
  submitCount: 0,
  savedAt: null,
  submittedAt: null,
  approvedAt: null,
  approvedBy: null,
  ...extra,
});

export const buildSeedInspections = (assets) => [
  {
    id: 'kk_001',
    code: 'KK001',
    name: 'Kiểm kê cuối năm học 2024 - 2025',
    type: 'PERIODIC',
    locationMode: 'LOCATION_TYPE',
    campusIds: ['c1'],
    locationTypes: ['CLASS'],
    locationIds: [],
    assetMode: 'ALL',
    categoryIds: [],
    assetCodes: [],
    startDate: '2025-05-26',
    deadline: '2025-05-30',
    note: 'Kiểm kê toàn bộ bàn ghế, thiết bị các lớp trước kỳ nghỉ hè.',
    createdBy: 'u_lan',
    status: 'COMPLETED',
    scope: [
      { locationId: 'loc_c1_l1', inspectorUserId: 'u_hoa' },
      { locationId: 'loc_c1_c2', inspectorUserId: 'u_mai' },
    ],
    sheets: [
      sheet(
        'KK001-01',
        'loc_c1_l1',
        'u_hoa',
        'APPROVED',
        allCounted(assets, 'loc_c1_l1', { TS0013: { note: '3 thùng nắp gãy, đã báo sửa' } }),
        {
          inspectorSignature: sig('u_hoa', 'Lê Thị Hoa', '2025-05-28T03:00:00.000Z'),
          submitCount: 1,
          submittedAt: '2025-05-28T03:00:00.000Z',
          approvedAt: '2025-05-29T02:00:00.000Z',
          approvedBy: 'u_lan',
        },
      ),
      sheet('KK001-02', 'loc_c1_c2', 'u_mai', 'APPROVED', allCounted(assets, 'loc_c1_c2'), {
        inspectorSignature: sig('u_mai', 'Trần Thị Mai', '2025-05-28T04:00:00.000Z', 1),
        submitCount: 1,
        submittedAt: '2025-05-28T04:00:00.000Z',
        approvedAt: '2025-05-29T02:10:00.000Z',
        approvedBy: 'u_lan',
      }),
    ],
    signatures: [
      {
        type: 'CREATOR',
        signedBy: 'u_lan',
        signedByName: 'Nguyễn Thị Lan',
        signatureUrl: makeSignatureSvg('Nguyễn Thị Lan', 0),
        signedAt: '2025-05-26T01:00:00.000Z',
      },
      {
        type: 'APPROVER',
        signedBy: 'u_lan',
        signedByName: 'Nguyễn Thị Lan',
        signatureUrl: makeSignatureSvg('Nguyễn Thị Lan', 0),
        signedAt: '2025-05-30T02:00:00.000Z',
      },
    ],
    adjustments: [],
    applyAdjustments: true,
    approvalNote: 'Số liệu khớp sổ sách, ghi nhận 3 thùng rác cần sửa.',
    history: [
      { id: 'kh1', action: 'STARTED', userId: 'u_lan', at: '2025-05-26T01:00:00.000Z', note: '2 phiếu kiểm kê' },
      { id: 'kh2', action: 'COMPLETED', userId: 'u_lan', at: '2025-05-30T02:00:00.000Z', note: '' },
    ],
    createdAt: '2025-05-26T01:00:00.000Z',
    updatedAt: '2025-05-30T02:00:00.000Z',
  },
  {
    id: 'kk_002',
    code: 'KK002',
    name: 'Kiểm kê đột xuất phòng chức năng tháng 10',
    type: 'ADHOC',
    locationMode: 'CUSTOM',
    campusIds: ['c1'],
    locationTypes: [],
    locationIds: ['loc_c1_office', 'loc_c1_medical', 'loc_c1_music'],
    assetMode: 'ALL',
    categoryIds: [],
    assetCodes: [],
    startDate: '2026-10-05',
    deadline: '2026-10-10',
    note: 'Rà soát thiết bị văn phòng, phòng y tế và phòng âm nhạc trước đợt kiểm tra của Phòng GD.',
    createdBy: 'u_lan',
    status: 'IN_PROGRESS',
    scope: [
      { locationId: 'loc_c1_office', inspectorUserId: 'u_yen' },
      { locationId: 'loc_c1_medical', inspectorUserId: 'u_thu' },
      { locationId: 'loc_c1_music', inspectorUserId: 'u_huong' },
    ],
    sheets: [
      sheet(
        'KK002-01',
        'loc_c1_office',
        'u_yen',
        'SUBMITTED',
        allCounted(assets, 'loc_c1_office', {
          TS0031: { qty: 1, note: '1 máy in đã chuyển sang phòng y tế từ tháng 9, chưa làm phiếu luân chuyển' },
          TS0030: { cond: 'NEED_REPAIR', note: '1 máy tính hay treo, cần kiểm tra' },
        }),
        {
          inspectorSignature: sig('u_yen', 'Đặng Hải Yến', '2026-10-06T08:00:00.000Z'),
          submitCount: 1,
          submittedAt: '2026-10-06T08:00:00.000Z',
        },
      ),
      sheet('KK002-02', 'loc_c1_medical', 'u_thu', 'ASSIGNED', sheetItems(assets, 'loc_c1_medical')),
      sheet('KK002-03', 'loc_c1_music', 'u_huong', 'IN_PROGRESS', sheetItems(assets, 'loc_c1_music', { TS0015: {}, TS0010: {} }), {
        savedAt: '2026-10-06T09:00:00.000Z',
      }),
    ],
    signatures: [
      {
        type: 'CREATOR',
        signedBy: 'u_lan',
        signedByName: 'Nguyễn Thị Lan',
        signatureUrl: makeSignatureSvg('Nguyễn Thị Lan', 0),
        signedAt: '2026-10-05T01:00:00.000Z',
      },
    ],
    adjustments: [],
    applyAdjustments: true,
    approvalNote: '',
    history: [
      { id: 'kh3', action: 'STARTED', userId: 'u_lan', at: '2026-10-05T01:00:00.000Z', note: '3 phiếu kiểm kê' },
      { id: 'kh4', action: 'SHEET_SUBMITTED', userId: 'u_yen', at: '2026-10-06T08:00:00.000Z', note: 'KK002-01 – Văn phòng nhà trường' },
    ],
    createdAt: '2026-10-05T01:00:00.000Z',
    updatedAt: '2026-10-06T09:00:00.000Z',
  },
];

export const seedInspectionNotifications = [
  {
    id: 'n_kk1',
    userId: 'u_lan',
    type: 'INSPECTION_SUBMITTED',
    title: 'Đặng Hải Yến đã nộp phiếu KK002-01',
    message: 'Văn phòng nhà trường: 1 tài sản lệch sổ sách. Vui lòng xem và duyệt.',
    link: '/facility/inspections/kk_002/sheets/sh_KK002-01',
    read: false,
    createdAt: '2026-10-06T08:00:00.000Z',
  },
  {
    id: 'n_kk2',
    userId: 'u_thu',
    type: 'INSPECTION_ASSIGNED',
    title: 'Phiếu kiểm kê mới KK002-02',
    message: 'Bạn được giao kiểm kê Phòng Y tế (Phòng 002). Hạn hoàn thành 10/10/2026.',
    link: '/facility/inspections/kk_002/sheets/sh_KK002-02',
    read: false,
    createdAt: '2026-10-05T01:00:00.000Z',
  },
  {
    id: 'n_kk3',
    userId: 'u_huong',
    type: 'INSPECTION_ASSIGNED',
    title: 'Phiếu kiểm kê mới KK002-03',
    message: 'Bạn được giao kiểm kê Phòng Âm nhạc (Phòng 102). Hạn hoàn thành 10/10/2026.',
    link: '/facility/inspections/kk_002/sheets/sh_KK002-03',
    read: false,
    createdAt: '2026-10-05T01:00:00.000Z',
  },
];
