import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import * as edu from '../../src/models/education-plan/educationPlanConstants.js';

test('bản nháp có lịch sử trả lại hiển thị Trả lại nhưng không đổi trạng thái lưu', () => {
  const plan = { status: 'DRAFT', history: [{ action: 'submit' }, { action: 'reject', note: 'Sửa lịch' }] };
  assert.equal(edu.educationDisplayStatus(plan), 'REJECTED');
  assert.equal(plan.status, 'DRAFT');
  assert.equal(edu.EDU_STATUS_LABELS.REJECTED, 'Trả lại');
  assert.equal(edu.educationDisplayStatus({ status: 'DRAFT', lastReturnNote: 'Sửa lịch' }), 'REJECTED');
  assert.equal(edu.educationDisplayStatus({ status: 'DRAFT', history: [{ label: 'Trả lại để sửa' }] }), 'REJECTED');
  assert.equal(edu.educationDisplayStatus({ status: 'DRAFT', history: [] }), 'DRAFT');
  assert.equal(edu.educationDisplayStatus({ status: 'DRAFT', returned: false, history: plan.history }), 'DRAFT');
  assert.equal(edu.educationDisplayStatus({ status: 'REVIEW', history: plan.history }), 'REVIEW');
  assert.equal(edu.educationDisplayStatus({ status: 'APPROVED', history: plan.history }), 'APPROVED');
  assert.equal(edu.educationDisplayStatus({ status: 'DRAFT', history: [{ action: 'reject' }, { action: 'submit' }] }), 'DRAFT');
});

test('nhãn hồ sơ giáo dục trả lại hiện màu đỏ ở cả kế hoạch và hồ sơ lớp', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = { addEventListener() {} };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { EduStatusBadge, YearPlanStatusBadge } = await server.ssrLoadModule('/src/components/education-plan/eduUi.jsx');
    const doc = { status: 'DRAFT', returned: true, history: [] };
    for (const Badge of [EduStatusBadge, YearPlanStatusBadge]) {
      const html = renderToStaticMarkup(React.createElement(Badge, { status: doc.status, doc }));
      assert.match(html, /chip--red/);
      assert.match(html, /Trả lại/);
      assert.doesNotMatch(html, /Nháp/);
      const waiting = {
        status: 'REVIEW',
        review: { roles: ['TEAM_LEADER', 'VICE_PRINCIPAL'], waitingRole: 'VICE_PRINCIPAL' },
        permissions: { canApprove: false, canReturn: false },
      };
      const renderWaiting = (isCurrentReviewer) =>
        renderToStaticMarkup(
          React.createElement(Badge, { status: waiting.status, doc: { ...waiting, reviewDeadline: { locked: false, isCurrentReviewer } } }),
        );
      assert.match(renderWaiting(true), />Chờ duyệt</);
      assert.match(renderWaiting(false), />Đang chờ Phó hiệu trưởng duyệt</);
      // EDU-109: hạn duyệt đã khóa ⇒ chỉ một nhãn "Quá hạn" đỏ thay nhãn chờ duyệt
      const locked = renderToStaticMarkup(
        React.createElement(Badge, { status: waiting.status, doc: { ...waiting, reviewDeadline: { locked: true } } }),
      );
      assert.match(locked, /chip--red/);
      assert.match(locked, />Quá hạn</);
      assert.doesNotMatch(locked, /Chờ|chờ/);
    }
    const { RejectedNotice, ReviewHistory } = await server.ssrLoadModule('/src/components/education-plan/reviewUi.jsx');
    const reason = renderToStaticMarkup(
      React.createElement(RejectedNotice, {
        status: 'DRAFT',
        history: [{ tone: 'err', by: 'Người duyệt', at: '2026-11-20 00:41', note: 'Cần bổ sung' }],
      }),
    );
    assert.match(reason, /text-danger/);
    assert.match(reason, /Cần bổ sung/);
    assert.doesNotMatch(reason, /alert--danger/);
    const events = [
      { action: 'Gửi duyệt kế hoạch', code: 'SUBMIT', by: 'Giáo viên', at: '2026-11-16 01:25', note: 'Nhờ xem giúp' },
      { action: 'POLICY_RECONCILED', code: 'POLICY_RECONCILED', at: '2026-11-17T00:00:00Z', note: '{"round":1,"policyRevision":1}' },
      { action: 'reject', tone: 'err', at: '2026-11-20T00:41:00+07:00', note: 'Cần bổ sung' },
    ];
    const open = renderToStaticMarkup(React.createElement(ReviewHistory, { items: events, open: true }));
    assert.match(open, /ga-card-toggle[^>]*aria-expanded="true"/);
    assert.match(open, /Cập nhật quy trình duyệt/);
    assert.match(open, /Hệ thống/);
    assert.match(open, /Trả lại để sửa/);
    assert.match(open, /aria-current="step"/);
    assert.match(open, /text-danger ga-review-timeline__note/);
    assert.doesNotMatch(open, /POLICY_RECONCILED|policyRevision|<summary/);
    const collapsed = renderToStaticMarkup(React.createElement(ReviewHistory, { items: events }));
    assert.match(collapsed, /aria-expanded="false"/);
    assert.match(collapsed, / hidden=""/);
  } finally {
    await server.close();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
