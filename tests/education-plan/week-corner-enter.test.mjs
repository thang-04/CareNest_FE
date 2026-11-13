import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { transformWithOxc } from 'vite';
import * as cp from '../../src/models/education-plan/classPlan.js';

const source = await readFile(new URL('../../src/components/education-plan/WeekPlanBody.jsx', import.meta.url), 'utf8');
const imports = [...source.matchAll(/^import ([\s\S]*?) from '([^']+)';\r?\n/gm)];
const stubs = imports
  .filter(([, , path]) => !path.includes('classPlan') && path !== 'react')
  .flatMap(([, names]) =>
    names
      .replace(/[{}]/g, '')
      .split(',')
      .map((name) => `const ${name.trim()}=()=>null;`),
  )
  .join('\n');
const modelNames = imports.find(([, , path]) => path.endsWith('/classPlan'))[1];
const hooks = `
import React, {Fragment} from ${JSON.stringify(import.meta.resolve('react'))};
import ${modelNames} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/classPlan.js'))};
let slots=[], index=0;
const useState=initial=>{const i=index++; if(!(i in slots)) slots[i]=initial; return [slots[i],v=>slots[i]=v];};
const useRef=initial=>{const i=index++; return slots[i] ||= {current:initial};};
const useEffect=()=>{};
export function render(props,reset=false){if(reset) slots=[]; index=0; return WeekTab(props);}
`;
const { code } = await transformWithOxc(hooks + stubs + source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''), 'WeekPlanBody.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const component = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const nodes = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]);

test('Enter in each corner column inserts immediately below, preserves picks and updates the weekly grid', () => {
  for (const label of ['Tên góc 1', 'Nội dung Góc một', 'Mục đích, yêu cầu Góc một', 'Chuẩn bị Góc một', 'Cách tiến hành Góc một']) {
    let draft = cp.emptyWeekPlan({ classId: 'c', yearPlanId: 'y', weekStart: '2026-11-16' });
    draft.corners = [
      { ...cp.newCorner(), id: 'first', name: 'Góc một', content: 'Xếp hình' },
      { ...cp.newCorner(), id: 'last', name: 'Góc hai' },
    ];
    draft.picks = { 'goc.all': [{ cardId: 'card', cornerId: 'first' }] };
    const props = () => ({
      draft,
      editable: true,
      week: { start: '2026-11-16' },
      update: (fn) => {
        draft = fn(structuredClone(draft));
      },
    });
    let tree = component.render(props(), true);
    const field = nodes(tree).find((n) => n.props.label === label);
    let prevented = false;
    field.props.onKeyDown({
      key: 'Enter',
      nativeEvent: {},
      preventDefault() {
        prevented = true;
      },
    });
    assert.equal(prevented, true, label);
    assert.equal(draft.corners.length, 3);
    assert.equal(draft.corners[1].name, '');
    assert.equal(draft.corners[2].id, 'last');
    assert.equal(draft.picks['goc.all'][0].cornerId, 'first');
    assert.equal(draft.grid.goc.common, 'Góc một: Xếp hình\nGóc hai');
    tree = component.render(props());
    nodes(tree)
      .find((n) => n.props.label === label)
      .props.onKeyDown({ key: 'Enter', nativeEvent: {}, preventDefault() {} });
    assert.equal(draft.corners.length, 3, 'reuse the existing empty next row');
    for (const event of [{ shiftKey: true }, { isComposing: true }, { nativeEvent: { isComposing: true } }]) {
      nodes(tree)
        .find((n) => n.props.label === label)
        .props.onKeyDown({
          key: 'Enter',
          preventDefault() {
            assert.fail('preserve newline/IME');
          },
          ...event,
        });
      assert.equal(draft.corners.length, 3);
    }
  }
});

test('typing in the trailing corner keeps its row identity and enables Enter', () => {
  let draft = cp.emptyWeekPlan({ classId: 'c', yearPlanId: 'y', weekStart: '2026-11-16' });
  const props = () => ({
    draft,
    editable: true,
    week: { start: '2026-11-16' },
    update: (fn) => {
      draft = fn(structuredClone(draft));
    },
  });
  const tree = component.render(props(), true);
  nodes(tree)
    .find((n) => n.props.label === 'Tên góc mới')
    .props.onChange('Góc mới');
  const id = draft.corners[0].id;
  const next = component.render(props());
  assert.ok(nodes(next).some((n) => n.props['data-corner-id'] === id));
  nodes(next)
    .find((n) => n.props.label === 'Tên góc 1')
    .props.onKeyDown({ key: 'Enter', nativeEvent: {}, preventDefault() {} });
  assert.equal(draft.corners.length, 2);
  assert.equal(draft.corners[0].id, id);
});

test('semester filter uses BE theme IDs in both layouts and preserves annual data', async () => {
  const page = await readFile(new URL('../../src/pages/education-plan/BranchPlanPage.jsx', import.meta.url), 'utf8');
  const { semesterChoices } = await import('@/models/education-plan/classPlan');
  const themes = [
    { id: 11, start: '2026-09-07' },
    { id: 22, start: '2027-01-11' },
  ];
  const year = { semester1Start: '2026-09-05', semester1End: '2026-12-31', semester2Start: '2027-01-04', semester2End: '2027-05-31' };
  // Gói học kỳ của BE thắng ngày; id chủ đề so theo chuỗi
  const packages = [{ semesterNo: 2, themeIds: [11, '22'], deadline: '2026-12-20' }];
  const before = JSON.stringify({ themes, packages });
  const choices = semesterChoices(year, themes, packages);
  assert.deepEqual(
    choices.map((c) => [c.semesterNo, c.themeIds, c.deadline]),
    [
      [1, ['11'], '2026-09-05'],
      [2, ['11', '22'], '2026-12-20'],
    ],
  );
  // Chưa cấu hình ngày học kỳ: chỉ các học kỳ có gói
  assert.deepEqual(
    semesterChoices({}, themes, packages).map((c) => c.semesterNo),
    [2],
  );
  assert.deepEqual(semesterChoices(undefined, themes, []), []);
  assert.equal(JSON.stringify({ themes, packages }), before);
  assert.match(page, /const inSemester = \(row\) => !visibleThemeIds \|\| visibleThemeIds\.has\(String\(row\.theme\.id\)\)/);
  assert.match(page, /const displayRows = allRows\.filter\(inSemester\)/);
  assert.match(page, /rows=\{teachingWeeks\(yearPlan, draft\)\.filter\(inSemester\)\}/);
});

test('Enter through a composing Vietnamese IME does not leave a newline inside the cell; it inserts a table row', () => {
  for (const label of ['Tên góc 1', 'Cách tiến hành Góc một']) {
    let draft = cp.emptyWeekPlan({ classId: 'c', yearPlanId: 'y', weekStart: '2026-11-16' });
    draft.corners = [{ ...cp.newCorner(), id: 'first', name: 'Góc một', steps: 'Cô giới thiệu' }];
    const props = () => ({
      draft,
      editable: true,
      week: { start: '2026-11-16' },
      update: (fn) => {
        draft = fn(structuredClone(draft));
      },
    });
    const field = nodes(component.render(props(), true)).find((n) => n.props.label === label);
    field.props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() {} });
    const before = label.startsWith('Tên') ? 'Góc một' : 'Cô giới thiệu';
    field.props.onChange(`${before}\n`);
    const key = label.startsWith('Tên') ? 'name' : 'steps';
    assert.equal(draft.corners[0][key], before, label);
    assert.equal(draft.corners.length, 2, label);
    // Shift+Enter ở ô nhiều dòng vẫn xuống dòng trong ô
    if (key === 'steps') {
      const f2 = nodes(component.render(props())).find((n) => n.props.label === label);
      f2.props.onKeyDown({ key: 'Enter', shiftKey: true, nativeEvent: {}, preventDefault() {} });
      f2.props.onChange('Cô giới thiệu\nTrẻ chơi');
      assert.equal(draft.corners[0].steps, 'Cô giới thiệu\nTrẻ chơi');
      assert.equal(draft.corners.length, 2);
    }
  }
});
