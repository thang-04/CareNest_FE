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
const { reapplyTeamDraft, inheritAnnual } = await import('../../src/models/education-plan/planLevel.mjs');
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
test('TEAM can edit and add contents while keeping goal structure read only', () => {
  const html = renderToStaticMarkup(React.createElement(GoalTable, {
    ...props, fixedCells: true, canEditContents: true, canAssignContents: true, onChange() {},
  }));
  assert.match(html, /aria-label="Nội dung 1 của mục tiêu 1"/);
  assert.match(html, /aria-label="Nội dung đầu tiên của mục tiêu 1"/);
  assert.doesNotMatch(html, /aria-label="Mục tiêu 1 lĩnh vực/);
  assert.doesNotMatch(html, /aria-label="Xóa nội dung/);
});
test('annual goal table identifies required groups, goals and contents for assistive technology', () => {
  const html = renderToStaticMarkup(React.createElement(GoalTable, { ...props, readOnly: false, onChange() {} }));
  assert.equal((html.match(/Bắt buộc khi gửi duyệt/g) || []).length >= 3, true);
});
test('restoring team draft retains edited and newly added content and ticks', () => {
  const fresh = { themes: [{ id: 't' }], domains: [{ id: 'd', rows: [{ id: 'g', contents: [{ id: 'c', text: 'Nguồn', themes: [] }] }] }] };
  const draft = { title: 'Tổ', themes: fresh.themes, domains: [{ id: 'd', rows: [{ id: 'g', contents: [
    { id: 'c', text: 'Tổ sửa', themes: ['t'] }, { id: 'new', text: 'Tổ thêm', themes: ['t'] },
  ] }] }] };
  const restored = reapplyTeamDraft(fresh, draft).domains[0].rows[0].contents;
  assert.deepEqual(restored.map(({ id, text, themes }) => ({ id, text, themes })), draft.domains[0].rows[0].contents);
});
test('changing year source retains team edited and added contents', () => {
  const makeYear = (text) => ({ id: 'y', themes: [{ id: 't' }], domains: [{ id: 'd', rows: [{ id: 'g', kind: 'goal', contents: [{ id: 'c', text, themes: [] }] }] }] });
  const oldYear = makeYear('Hát A');
  const newYear = makeYear('Hát C');
  const team = makeYear('Hát B');
  team.domains[0].rows[0].contents[0].themes = ['t'];
  team.domains[0].rows[0].contents.push({ id: 'extra', text: 'Tổ thêm', themes: ['t'] });
  const result = inheritAnnual(newYear, team, oldYear).domains[0].rows[0].contents;
  assert.deepEqual(result.map((c) => c.text), ['Hát B', 'Tổ thêm']);
  assert.deepEqual(result.map((c) => c.themes), [['t'], ['t']]);
});
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
