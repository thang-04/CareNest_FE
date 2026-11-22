import test from 'node:test';
import assert from 'node:assert/strict';
import { isChainReviewer, isReviewTurn, waitingLabel } from '../../src/models/education-plan/reviewTurn.mjs';

const LABELS = { TEAM_LEADER: 'Tổ trưởng', VICE_PRINCIPAL: 'Phó hiệu trưởng', PRINCIPAL: 'Hiệu trưởng' };
const dossier = (permissions, waitingRole = 'VICE_PRINCIPAL') => ({
  status: 'REVIEW',
  review: { roles: ['TEAM_LEADER', 'VICE_PRINCIPAL'], waitingRole },
  permissions,
});

test('EDU-93: người đúng lượt giữ nhãn Chờ duyệt (không có nhãn đang chờ)', () => {
  const doc = dossier({ canApprove: true, canReturn: true });
  assert.equal(isReviewTurn(doc), true);
  assert.equal(waitingLabel(doc, LABELS), null);
});

test('EDU-93: người không đúng lượt thấy "Đang chờ <vai trò> duyệt"', () => {
  assert.equal(waitingLabel(dossier({ canApprove: false, canReturn: false }), LABELS), 'Đang chờ Phó hiệu trưởng duyệt');
  assert.equal(waitingLabel(dossier({ canApprove: false }, 'TEAM_LEADER'), LABELS), 'Đang chờ Tổ trưởng duyệt');
});

test('EDU-93: chỉ cần một trong các cờ duyệt/trả lại là đúng lượt (kế hoạch năm dùng canIssue)', () => {
  assert.equal(isReviewTurn({ permissions: { canIssue: true } }), true);
  assert.equal(isReviewTurn({ permissions: { canReject: true } }), true);
  assert.equal(isReviewTurn({ permissions: {} }), false);
});

test('EDU-93: không kèm quyền, không ở Chờ duyệt hoặc thiếu vai trò chờ ⇒ giữ nhãn cũ', () => {
  assert.equal(isReviewTurn({ status: 'REVIEW' }), null);
  assert.equal(waitingLabel({ status: 'REVIEW', review: { waitingRole: 'PRINCIPAL' } }, LABELS), null);
  assert.equal(waitingLabel({ ...dossier({ canApprove: false }), status: 'APPROVED' }, LABELS), null);
  assert.equal(waitingLabel({ status: 'REVIEW', permissions: { canApprove: false } }, LABELS), null);
});

test('EDU-93: vai trò chưa có nhãn ⇒ hiện mã vai trò, không bỏ trống', () => {
  assert.equal(waitingLabel(dossier({ canApprove: false }, 'CUSTOM_ROLE'), LABELS), 'Đang chờ CUSTOM_ROLE duyệt');
});

test('EDU-93: Tổ trưởng thuộc chuỗi chỉ với nhóm tuổi mình; PHT với lớp được giao; ngoài chuỗi ⇒ không', () => {
  const doc = dossier({ canApprove: false });
  assert.equal(isChainReviewer(doc, { role: 'TEAM_LEADER', ageGroupId: 4 }, { ageGroupId: 4 }), true);
  assert.equal(isChainReviewer(doc, { role: 'TEAM_LEADER', ageGroupId: 4 }, { ageGroupId: '3' }), false);
  assert.equal(isChainReviewer(doc, { role: 'VICE_PRINCIPAL' }, { ageGroupId: 3 }), true);
  assert.equal(isChainReviewer(doc, { role: 'PRINCIPAL' }, { ageGroupId: 3 }), false);
  assert.equal(isChainReviewer(doc, { role: 'VICE_PRINCIPAL' }, null), false);
  assert.equal(isChainReviewer({ ...doc, status: 'DRAFT' }, { role: 'VICE_PRINCIPAL' }, { ageGroupId: 3 }), false);
});
