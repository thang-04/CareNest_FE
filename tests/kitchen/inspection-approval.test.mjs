import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapApprovalItem, mapDay } from '@/services/kitchen/api/inspectionMapper';
import { APPROVAL_STATUS } from '@/models/kitchen/inspectionConstants';
import { approvalActionLabel, approvalNotice, isApprovalTextValid } from '@/utils/kitchen/inspectionApproval';

// Mở ghi mẫu ngày cũ cần HT duyệt (INS-05): FE chỉ hiển thị trạng thái BE trả, không tự suy khóa từ ngày trên máy

const sheet = (tab, status = 'DRAFT') => ({
  tab,
  status,
  version: 1,
  saved: true,
  header: {},
  rows: [],
  signature: null,
  history: [],
  updatedAt: null,
});
const approval = (tab, extra = {}) => ({
  tab,
  locked: false,
  status: null,
  approvalId: null,
  reason: null,
  requestedByName: null,
  decisionNote: null,
  expiresAt: null,
  canRequest: false,
  selfOpen: false,
  ...extra,
});
const loadImage = async () => '';
const BE_DAY = {
  campusId: 1,
  date: '2026-11-20',
  canEdit: true,
  sheets: [sheet('FRESH'), sheet('SAMPLE', 'SIGNED')],
  approvals: [
    approval('FRESH', { locked: true, canRequest: true }),
    approval('SAMPLE', { locked: false, status: 'APPROVED', approvalId: 9, expiresAt: '2026-11-25T01:00:00Z' }),
  ],
};

test('ngày cũ chưa được mở: mẫu khóa nên không ghi, không sửa lại; mẫu đã được mở thì như cũ', async () => {
  const day = await mapDay(
    {
      ...BE_DAY,
      sheets: [sheet('FRESH', 'DRAFT'), sheet('DRY', 'DRAFT')],
      approvals: [approval('FRESH', { locked: true }), approval('DRY')],
    },
    loadImage,
  );

  assert.equal(day.tabs.fresh.canEdit, false);
  assert.equal(day.tabs.fresh.approval.locked, true);
  assert.equal(day.tabs.dry.canEdit, true);
});

test('mẫu đã ký ở ngày cũ chỉ "Sửa lại" được sau khi HT mở', async () => {
  const signed = {
    ...sheet('SERVE', 'SIGNED'),
    signature: { signedBy: 1, signedByName: 'PHT', signedAt: '2026-11-20T03:00:00Z', documentVersion: 1, imageKey: 'k' },
  };
  const locked = await mapDay(
    { ...BE_DAY, sheets: [signed], approvals: [approval('SERVE', { locked: true, canRequest: true })] },
    loadImage,
  );
  const opened = await mapDay({ ...BE_DAY, sheets: [signed], approvals: [approval('SERVE', { status: 'APPROVED' })] }, loadImage);

  assert.equal(locked.tabs.serve.canReopen, false);
  assert.equal(opened.tabs.serve.canReopen, true);
  assert.equal(opened.tabs.serve.canEdit, false);
});

test('người xem không có quyền ghi điểm trường thì vẫn không ghi được dù mẫu không khóa', async () => {
  const day = await mapDay({ ...BE_DAY, canEdit: false, sheets: [sheet('DRY')], approvals: [approval('DRY')] }, loadImage);

  assert.equal(day.tabs.dry.canEdit, false);
});

test('BE chưa trả approvals (bản cũ): coi như không khóa, không có hàng chờ', async () => {
  const day = await mapDay({ campusId: 1, date: '2026-11-23', canEdit: true, sheets: [sheet('DRY')] }, loadImage);

  assert.equal(day.tabs.dry.approval.locked, false);
  assert.equal(day.tabs.dry.canEdit, true);
  assert.equal(day.canDecide, false);
});

test('HT (BE đặt selfOpen) xử lý hàng chờ; PHT thì không', async () => {
  const principal = await mapDay({ ...BE_DAY, approvals: BE_DAY.approvals.map((a) => ({ ...a, selfOpen: true })) }, loadImage);
  const vice = await mapDay(BE_DAY, loadImage);

  assert.equal(principal.canDecide, true);
  assert.equal(principal.tabs.fresh.approval.canSelfOpen, true);
  assert.equal(vice.canDecide, false);
  assert.equal(vice.tabs.fresh.approval.canRequest, true);
});

test('mỗi mẫu nhận đúng trạng thái duyệt theo khóa FE', async () => {
  const day = await mapDay(BE_DAY, loadImage);

  assert.equal(day.tabs.sample.approval.status, APPROVAL_STATUS.APPROVED);
  assert.equal(day.tabs.sample.approval.id, 9);
  assert.equal(day.tabs.sample.approval.expiresAt, '2026-11-25T01:00:00Z');
  assert.equal(day.tabs.fresh.approval.status, null);
});

test('mục hàng chờ đổi mã mẫu BE sang khóa FE và giữ người gửi, lý do', () => {
  const item = mapApprovalItem({
    id: 5,
    campusId: 2,
    date: '2026-11-20',
    tab: 'SAMPLE',
    status: 'PENDING',
    selfOpened: false,
    reason: 'Quên ghi mẫu',
    requestedByName: 'Cô Lan',
    requestedAt: '2026-11-24T01:00:00Z',
  });

  assert.equal(item.tab, 'sample');
  assert.equal(item.requestedByName, 'Cô Lan');
  assert.equal(item.decisionNote, '');
  assert.equal(item.selfOpened, false);
});

test('dòng nhắc theo trạng thái: khóa, chờ duyệt, bị từ chối, thu hồi, hết hạn, đang mở, đã ký xong', () => {
  assert.equal(approvalNotice(null), null);
  assert.equal(approvalNotice({ locked: false, status: null }), null);
  assert.match(approvalNotice({ locked: true, status: null }).text, /cần Hiệu trưởng duyệt mở/);
  assert.match(approvalNotice({ locked: true, status: 'PENDING', reason: 'Quên ghi' }).text, /đang chờ Hiệu trưởng duyệt/);
  assert.match(approvalNotice({ locked: true, status: 'REJECTED', decisionNote: 'Không đủ lý do' }).text, /từ chối.*Không đủ lý do/);
  assert.match(approvalNotice({ locked: true, status: 'REVOKED', decisionNote: 'Mở nhầm' }).text, /thu hồi.*Mở nhầm/);
  assert.match(approvalNotice({ locked: true, status: 'EXPIRED', expiresAt: '2026-11-22T01:00:00Z' }).text, /hết hạn lúc/);
  assert.equal(approvalNotice({ locked: true, status: 'CONSUMED' }).kind, 'locked');
  const open = approvalNotice({ locked: false, status: 'APPROVED', expiresAt: '2026-11-25T01:00:00Z' });
  assert.match(open.text, /Hiệu trưởng đã mở mẫu này, sửa và ký trước/);
});

test('nhãn nút: HT mở ngay, PHT gửi yêu cầu; lý do cần đủ ba ký tự', () => {
  assert.equal(approvalActionLabel({ canSelfOpen: true }), 'Mở để sửa');
  assert.equal(approvalActionLabel({ canSelfOpen: false }), 'Yêu cầu HT mở');
  assert.equal(isApprovalTextValid('  ab '), false);
  assert.equal(isApprovalTextValid('abc'), true);
  assert.equal(isApprovalTextValid(undefined), false);
});
