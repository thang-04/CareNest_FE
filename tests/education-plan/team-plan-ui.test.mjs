import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
after(() => server.close());
const { GoalTable, ThemeEventTable } = await server.ssrLoadModule('/src/components/education-plan/GoalTables.jsx');
const { BranchCalendarEditor } = await server.ssrLoadModule('/src/components/education-plan/BranchCalendarEditor.jsx');
const domains = [
  {
    id: 'd',
    name: 'D',
    rows: [
      {
        id: 'g',
        kind: 'goal',
        text: 'Đọc toàn văn mục tiêu',
        contents: [
          { id: 'c1', text: 'Nội dung đã chọn', themes: ['t'] },
          { id: 'c2', text: 'Nội dung không chọn', themes: [] },
        ],
      },
    ],
  },
];
const props = {
  themes: [{ id: 't', name: 'Chủ đề', abbr: 'CD', start: '2026-09-07', end: '2026-09-18' }],
  breaks: [],
  domains,
  numbers: { g: 1 },
  branchTemplates: [{ id: 'b', themeId: 't', name: 'Nhánh kế thừa' }],
  readOnly: true,
};
test('TEAM shows inherited branches and one labeled goal select, no MT list or editing controls', () => {
  const html = renderToStaticMarkup(React.createElement(ThemeEventTable, { ...props, fixedFields: true }));
  assert.match(html, /Chủ đề nhánh \/ dự án/);
  assert.match(html, /Nhánh kế thừa/);
  assert.equal((html.match(/<select\b/g) || []).length, 1);
  assert.match(html, /Xem mục tiêu/);
  assert.match(html, /Đọc toàn văn mục tiêu/);
  assert.doesNotMatch(html, />MT ?1[<,]/);
  assert.doesNotMatch(html, /<(?:input|textarea|button)\b/);
});
test('annual source keeps branch layout without TEAM goal select', () => {
  const html = renderToStaticMarkup(React.createElement(ThemeEventTable, { ...props, hideGoals: true }));
  assert.match(html, /Nhánh kế thừa/);
  assert.doesNotMatch(html, /Xem mục tiêu|<select/);
});

test('nhập ngày sai thời lượng lịch lớp hiện lỗi trước khi gửi', () => {
  const durationPolicy = { theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } };
  const themes = [{ id: 't', name: 'A', abbr: 'A', start: '2026-09-07', end: '2026-09-11' }];
  const plan = { themes, breaks: [], branchTemplates: [] };
  const doc = { themeSchedules: [{ themeId: 't', startDate: '2026-09-07', endDate: '2026-09-11' }], branches: [{ key: 'b', themeId: 't', name: 'B', startDate: '2026-09-07', endDate: '2026-09-25' }], durationPolicySnapshot: { mode: 'BOUNDED', ...durationPolicy } };
  const classHtml = renderToStaticMarkup(React.createElement(BranchCalendarEditor, { plan, doc, editable: true, onChange() {}, toast() {} }));
  assert.match(classHtml, /Chủ đề cần từ 2 đến 4 tuần học/);
  assert.match(classHtml, /Nhánh cần từ 1 đến 2 tuần học/);
});

const { default: TeamSourceReview } = await server.ssrLoadModule('/src/components/education-plan/TeamSourceReview.jsx');
test('review panel separates unresolved/resolved/new items and uses reviewItemId for its action identity', () => {
  const plan = { domains, themes: props.themes,
    reviewItems: [{ reviewItemId: 'review-901', itemKind: 'CONTENT', itemId: 'c1', sourcePlanId: 'annual-2', reason: 'Nội dung đã đổi', resolved: false },
      { reviewItemId: 'review-902', itemKind: 'GOAL', itemId: 'g', reason: 'Đã đối chiếu', resolved: true }],
    newItems: [{ itemKind: 'CONTENT', itemId: 'c2' }] };
  const html = renderToStaticMarkup(React.createElement(TeamSourceReview, { plan, onResolve() {} }));
  assert.match(html, /Còn 1 mục cần rà soát/); assert.match(html, /Nội dung đã đổi/);
  assert.match(html, /Mới: Nội dung không chọn/); assert.match(html, /Đã kiểm tra/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  const table = renderToStaticMarkup(React.createElement(GoalTable, {
    domains, themes: props.themes, numbers: { g: 1 }, readOnly: true, fixedCells: true,
    reviewItems: plan.reviewItems, newItems: plan.newItems,
  }));
  assert.match(table, /text-danger text-xs[^>]*role="note">Cần rà soát: Nội dung đã đổi/);
  assert.match(table, /text-primary text-xs[^>]*role="note">Mới từ nguồn năm học/);
  assert.match(table, /Nội dung không chọn/);
  const refreshed = renderToStaticMarkup(React.createElement(TeamSourceReview, { plan: { ...plan, reviewItems: plan.reviewItems.map((item) => ({ ...item, resolved: true })) } }));
  assert.doesNotMatch(refreshed, /Còn 1 mục|<button/);
  assert.match(refreshed, /Đã rà soát các thay đổi/);
});
