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
    const doc = { status: 'DRAFT', history: [{ action: 'reject', note: 'Sửa lịch' }] };
    for (const Badge of [EduStatusBadge, YearPlanStatusBadge]) {
      const html = renderToStaticMarkup(React.createElement(Badge, { status: doc.status, doc }));
      assert.match(html, /chip--red/);
      assert.match(html, /Trả lại/);
      assert.doesNotMatch(html, /Nháp/);
    }
  } finally {
    await server.close();
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
