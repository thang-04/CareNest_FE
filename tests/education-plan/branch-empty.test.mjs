import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const source = await readFile(new URL('../../src/pages/education-plan/BranchPlanPage.jsx', import.meta.url), 'utf8');
const start = source.indexOf('export default function BranchPlanPage()');
const end = source.indexOf('// Bản gửi đi khi lưu', start);
const stubs = `
  import React from ${JSON.stringify(import.meta.resolve('react'))};
  let ctx, route, navigate;
  export const setContext = (value, id, onNavigate) => { ctx = value; route = id; navigate = onNavigate; };
  const useParams = () => ({ classId: route });
  const useNavigate = () => navigate;
  const classFilterPath = (base, id, age) => id ? base + "/" + id : base + "/no-class?ageGroup=" + encodeURIComponent(age);
  const useClassPlanContext = () => ctx;
  const LoadingState = () => <p>Đang tải</p>;
  export let pick;
  function ClassPageEmpty({ classes, emptyTitle, onPick }) {
    pick = onPick;
    return <section>{emptyTitle}<select aria-label="Lớp">{classes.map(c => <option key={c.id}>{c.name}</option>)}</select></section>;
  }
  const BranchPlanInner = ({ ctx }) => <p>Soạn kế hoạch {ctx.yearPlan.id}</p>;
`;
const { code } = await transformWithOxc(stubs + source.slice(start, end), 'BranchPlanPage.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const page = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

test('empty branch group keeps the class picker and can return to a group with plans', () => {
  const classes = [
    { id: 'empty', name: 'Lớp chưa có kế hoạch' },
    { id: 'ready', name: 'Lớp có kế hoạch' },
  ];
  let to;
  page.setContext({ cls: classes[0], classes, yearPlan: null }, 'empty', (path) => {
    to = path;
  });
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.match(html, /chưa được ban hành/);
  assert.match(html, /Lớp có kế hoạch/);
  assert.doesNotMatch(html, /Soạn kế hoạch/);
  page.pick('ready');
  assert.equal(to, '/education/branches/ready');

  page.setContext({ cls: classes[1], classes, yearPlan: { id: 'team' }, canComposeClassDocs: true }, 'ready');
  assert.match(renderToStaticMarkup(React.createElement(page.default)), /Soạn kế hoạch team/);
});

test('missing class renders an empty state', () => {
  page.setContext({ cls: null, classes: [], yearPlan: null }, 'unavailable');
  assert.match(renderToStaticMarkup(React.createElement(page.default)), /Không tìm thấy lớp/);
});

test('empty age selection retains the requested age in the route', () => {
  let to;
  page.setContext({ cls: null, classes: [], yearPlan: null }, 'no-class', (path) => {
    to = path;
  });
  renderToStaticMarkup(React.createElement(page.default));
  page.pick(null, 'ag-x');
  assert.equal(to, '/education/branches/no-class?ageGroup=ag-x');
});
