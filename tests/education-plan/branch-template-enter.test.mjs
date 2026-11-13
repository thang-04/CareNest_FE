import { numberGoals } from '../../src/models/education-plan/goalTable.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source = await readFile(new URL('../../src/components/education-plan/GoalTables.jsx', import.meta.url), 'utf8');
const fn = source.slice(source.indexOf('function BranchTemplateNames('), source.indexOf('export function ThemeEventTable('));
const stubs = `import React from ${JSON.stringify(import.meta.resolve('react'))};
import {branchDateIssues} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/branchTemplateSchedule.mjs'))};
export const focused=[]; const useCellFocus=()=>id=>focused.push(id); const enterKey=e=>e.key==='Enter'&&!e.isComposing; const CellInput=()=>null, DatePickerCell=()=>null, X=()=>null;`;
const { code } = await transformWithOxc(stubs + '\nexport ' + fn, 'BranchTemplateNames.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { BranchTemplateNames, focused } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const inputs = (node) =>
  !React.isValidElement(node)
    ? []
    : [...(node.props['data-focus'] ? [node] : []), ...React.Children.toArray(node.props.children).flatMap(inputs)];
test('Enter inserts an empty branch row immediately below and focuses it without changing another theme', () => {
  const theme = { id: 'a', name: 'A' };
  let templates = [{ id: 'other', themeId: 'b', name: 'B' }];
  const render = () => BranchTemplateNames({ theme, templates, onChange: (next) => (templates = next), readOnly: false });
  inputs(render())[0].props.onChange({ target: { value: 'D' } });
  assert.equal(templates.length, 2);
  assert.equal(templates[0].themeId, 'b');
  assert.equal(templates[1].name, 'D');
  templates.push({ id: 'later', themeId: 'a', name: 'Later' });
  let prevented = false;
  inputs(render())[0].props.onKeyDown({ key: 'Enter', preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  assert.equal(templates.length, 4);
  assert.equal(templates[2].name, '');
  assert.equal(templates[2].themeId, 'a');
  assert.equal(templates[3].id, 'later');
  assert.equal(focused.at(-1), `branch-${templates[2].id}`);
  inputs(render())[1].props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.equal(templates.length, 4);
  inputs(render())[1].props.onChange({ target: { value: 'N' } });
  assert.deepEqual(
    templates.filter((t) => t.themeId === 'a').map((t) => t.name),
    ['D', 'N', 'Later'],
  );
});
test('read-only branch/project column displays source names without edit inputs', () => {
  const tree = BranchTemplateNames({ theme: { id: 'a' }, templates: [{ id: 't', themeId: 'a', name: 'Dự án' }], readOnly: true });
  assert.equal(inputs(tree).length, 0);
});

test('branch date pickers stay within their parent theme and reject typed dates outside it', () => {
  const theme = { id: 'a', name: 'A', start: '2026-09-07', end: '2026-10-02' };
  let templates = [{ id: 't', themeId: 'a', name: 'Nhánh', startDate: '', endDate: '' }];
  const walk = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)]);
  const render = () =>
    walk(BranchTemplateNames({ theme, templates, onChange: (next) => (templates = next), readOnly: false })).filter(
      (node) => node.props.label?.startsWith('Từ nhánh') || node.props.label?.startsWith('Đến nhánh'),
    );
  const [start, end] = render();
  assert.equal(start.props.min, theme.start);
  assert.equal(end.props.max, theme.end);
  assert.equal(start.props.disabled, false);
  assert.deepEqual(start.props.range, { start: '', end: '' });
  start.props.onChange('2026-09-14');
  assert.equal(templates[0].startDate, '2026-09-14');
  render()[1].props.onChange('2026-10-09');
  assert.equal(templates[0].endDate, '');
  render()[1].props.onChange('2026-09-18');
  assert.equal(templates[0].endDate, '2026-09-18');
  assert.equal(render().length, 2);
  assert.equal(render()[0].props.compact, true);
});

test('branch endpoints are always independently editable compact dates with sibling ranges', () => {
  const theme = { id: 'a', name: 'A', start: '2026-09-07', end: '2026-10-02' };
  let templates = [
    { id: 'range', themeId: 'a', name: 'Nhánh', startDate: '2026-09-07', endDate: '2026-09-18' },
    { id: 'other', themeId: 'a', name: 'Khác', startDate: '2026-09-21', endDate: '2026-09-25' },
  ];
  const walk = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)]);
  const render = (readOnly = false) => walk(BranchTemplateNames({ theme, templates, onChange: (next) => (templates = next), readOnly }));
  const controls = () => render().filter((node) => node.props.label?.endsWith('nhánh Nhánh'));
  assert.equal(controls().length, 2);
  assert.equal(controls()[0].props.compact, true);
  assert.equal(controls()[1].props.value, '2026-09-18');
  assert.deepEqual(controls()[0].props.taken, [{ start: '2026-09-21', end: '2026-09-25', label: 'nhánh "Khác"' }]);
  controls()[0].props.onChange('2026-09-14');
  assert.equal(controls()[0].props.value, '2026-09-14');
  assert.equal(controls()[1].props.value, '2026-09-18');
  assert.ok(render(true).some((node) => node.props.children === '14/09/2026'));
  assert.equal(render(true).filter((node) => node.type === 'button').length, 0);
  templates[0].startDate = '';
  templates[0].endDate = '';
  assert.equal(controls().length, 2);
  assert.equal(controls()[0].props.value, '');
  templates[0].startDate = '2026-09-08';
  templates[0].endDate = '2026-09-25';
  const warning = render().find((node) => node.props.role === 'alert');
  const messages = React.Children.toArray(warning.props.children)
    .map((node) => node.props.children)
    .join(' ');
  assert.match(messages, /Thứ 2/);
  assert.match(messages, /Trùng/);
});

const tableStubs = `
import {branchDateIssues} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/branchTemplateSchedule.mjs'))};
import React, {Fragment,useState,useRef,useEffect,useMemo} from ${JSON.stringify(import.meta.resolve('react'))};
const cloneElement=React.cloneElement;
const SourceItemMark=()=>null;
import {curriculumOptions} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/curriculum.mjs'))};
const useCurriculum=()=>({goals:[],contents:[],sources:[],loading:false,error:null,reload(){}});
const useLayoutEffect=()=>{};
import {removeThemeReferences} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
import {fillGoalLabels,goalDisplayLabel} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/goalLabels.mjs'))};
import {suggestBreakDates,suggestThemeDates} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/importThemes.mjs'))};
import {${source
  .match(/import \{([\s\S]*?)\} from '@\/models\/education-plan\/goalTable';/)[1]
  .split('import {')
  .at(-1)}} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/goalTable.js'))};
const Trash2=()=>null, X=()=>null, domainLabel=v=>v, fmtDate=v=>v;
const FloatingPanel=({children})=>children, DatePickerCell=()=> <button data-calendar="true"/>;
const expectedResultsFor=()=>[], normalizeText=v=>String(v||'').toLowerCase();
const ConfirmationModal=()=>null, NATIVE_FIT=true, fitHeight=()=>{}, moveItem=items=>items;
const RenumberButton=()=>null, SortButtons=()=>null, SortHandle=()=> <button data-drag-handle="true"/>, SortIndex=({index})=><span>{index+1}</span>;
const SortableList=({children})=>children, SortableRow=({children,as:Tag='tr',...props})=><Tag data-group={props.id}>{children}</Tag>;
`;
const fullTableCode = await transformWithOxc(tableStubs + source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''), 'GoalTables.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { GoalTable, ThemeEventTable } = await import('data:text/javascript;base64,' + Buffer.from(fullTableCode.code).toString('base64'));

test('bảng năm học báo thời lượng chủ đề và nhánh ngay khi đủ ngày', () => {
  const themes = [{ id: 't', name: 'A', abbr: 'A', start: '2026-09-07', end: '2026-09-11' }];
  const branchTemplates = [{ id: 'b', themeId: 't', name: 'B', startDate: '2026-09-07', endDate: '2026-09-25' }];
  const durationPolicy = { theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } };
  const html = renderToStaticMarkup(React.createElement(ThemeEventTable, { themes, branchTemplates, durationPolicy, breaks: [], domains: [], hideGoals: true, onChange() {} }));
  assert.match(html, /Chủ đề cần từ 2 đến 4 tuần học \(hiện tại 1 tuần\)/);
  assert.match(html, /Nhánh cần từ 1 đến 2 tuần học \(hiện tại 3 tuần\)/);
});
const domains = [
  {
    name: 'Thể chất',
    rows: [
      { id: 's', kind: 'sub', text: 'Lĩnh vực con' },
      { id: 'r', kind: 'group', text: 'Kết quả mong đợi' },
      { id: 'g', kind: 'goal', text: 'Mục tiêu', contents: [{ id: 'c', text: 'Nội dung', themes: [] }] },
    ],
  },
];

test('fixed TEAM curriculum has no edit/delete controls but keeps content allocation available', () => {
  const html = renderToStaticMarkup(
    React.createElement(GoalTable, {
      domains,
      numbers: { g: 1 },
      themes: [{ id: 't', name: 'Chủ đề', abbr: 'CĐ' }],
      fixedCells: true,
      canAssignContents: true,
      onChange() {},
    }),
  );
  assert.match(html, /ga-curriculum-fixed/);
  assert.match(html, /ga-goal-table__subband/);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /<textarea|<input|Xóa|Thêm|icon-btn--danger|ga-goal-table__del/);
});

test('fixed TEAM themes and breaks have no date, edit, reorder or delete controls; annual tables keep them', () => {
  const props = {
    themes: [{ id: 't', name: 'Chủ đề', abbr: 'CĐ', start: '2026-09-07', end: '2026-09-18' }],
    breaks: [{ id: 'b', label: 'Nghỉ', start: '2026-09-21', end: '2026-09-25' }],
    domains: [],
    numbers: {},
    onChange() {},
  };
  const html = renderToStaticMarkup(React.createElement(ThemeEventTable, { ...props, fixedFields: true }));
  assert.equal((html.match(/ga-theme-edit-fixed/g) || []).length, 2);
  assert.match(html, /07\/09\/2026/);
  assert.match(html, /Nghỉ/);
  assert.doesNotMatch(html, /<textarea|data-calendar|Xóa|Thêm|Sắp xếp|icon-btn--danger|ga-goal-table__del/);
  const annual = renderToStaticMarkup(React.createElement(ThemeEventTable, { ...props, hideGoals: true }));
  assert.match(annual, /data-calendar/);
  assert.match(annual, /<th>Chủ đề nhánh \/ dự án<\/th>/);
  assert.match(annual, /<th class="center">Viết tắt/);
  assert.match(annual, /Xóa chủ đề/);
  assert.match(annual, /Xóa đợt nghỉ/);
  assert.equal((annual.match(/<th class="cell--actions">Thao tác<\/th>/g) || []).length, 2);
  assert.doesNotMatch(annual, /<th[^>]*>Sắp xếp|<th[^>]*>Xóa<|ga-goal-table__sort/);
  assert.equal((annual.match(/data-drag-handle="true"/g) || []).length, 2);
  assert.match(annual, /data-drag-handle="true"[\s\S]*?aria-label="Xóa chủ đề 1"/);

  const breakTable = annual.split('</table>')[1];
  assert.doesNotMatch(breakTable, /<th>Từ ngày|<th>Đến ngày|ga-col-date/);
  const breakNameCell = breakTable.match(/<td>([\s\S]*?Tên đợt nghỉ 1[\s\S]*?)<\/td>/)?.[1];
  assert.ok(breakNameCell);
  assert.equal((breakNameCell.match(/data-calendar="true"/g) || []).length, 2);

  assert.doesNotMatch(annual, /ga-theme-edit-fixed/);
});

test('annual branches are real child rows with merged parent cells, separate borders and short date labels', () => {
  const html = renderToStaticMarkup(
    React.createElement(ThemeEventTable, {
      themes: [{ id: 'parent', name: 'Chủ đề cha', abbr: 'CHA', start: '2026-09-07', end: '2026-09-18' }],
      breaks: [],
      domains: [],
      numbers: {},
      hideGoals: true,
      branchTemplates: [
        { id: 'one', themeId: 'parent', name: 'Nhánh một' },
        { id: 'two', themeId: 'parent', name: 'Nhánh hai' },
      ],
      onChange() {},
    }),
  );
  const group = html.match(/<tbody[^>]*data-group="parent"[^>]*>([\s\S]*?)<\/tbody>/)?.[1];
  assert.ok(group, 'each theme is a sortable group of actual table rows');
  const themeTable = html.split('</table>')[0];
  assert.doesNotMatch(themeTable, /<th>Từ ngày|<th>Đến ngày|ga-col-date/);
  const nameCell = group.match(/<td rowspan="3">([\s\S]*?)<\/td>/)?.[1];
  assert.match(nameCell, /Tên chủ đề 1/);
  assert.equal((nameCell.match(/data-calendar="true"/g) || []).length, 2);
  assert.equal((group.match(/<tr\b/g) || []).length, 3);
  assert.equal((group.match(/rowspan="3"/g) || []).length, 7);
  assert.equal((group.match(/<td class="ga-branch-template-cell(?: [^"]+)?"/g) || []).length, 3);
  assert.equal((group.match(/data-calendar="true"/g) || []).length, 6);
  assert.equal((group.match(/ga-branch-date-endpoint/g) || []).length, 6);
  assert.doesNotMatch(group, />Từ:|>Đến:|>Từ ngày|>Đến ngày/);
  const readOnly = renderToStaticMarkup(
    React.createElement(ThemeEventTable, {
      themes: [{ id: 'parent', name: 'Chủ đề cha', abbr: 'CHA' }],
      breaks: [],
      domains: [],
      numbers: {},
      hideGoals: true,
      readOnly: true,
      branchTemplates: [
        { id: 'one', themeId: 'parent', name: 'Nhánh một' },
        { id: 'two', themeId: 'parent', name: 'Nhánh hai' },
      ],
    }),
  );
  const viewGroup = readOnly.match(/<tbody[^>]*data-group="parent"[^>]*>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((viewGroup.match(/<tr\b/g) || []).length, 2);
  assert.equal((viewGroup.match(/rowspan="2"/g) || []).length, 6);
  assert.doesNotMatch(viewGroup, /<textarea|<button|<input/);
});

const controlledHooks = `
let slots=[], index=0, effects=[], cleanups=[];
const useState=initial=>{const i=index++; if(!(i in slots)) slots[i]=typeof initial==='function'?initial():initial; return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];};
const useRef=initial=>{const i=index++; return slots[i] ||= {current:initial};};
const useEffect=fn=>effects.push(fn);
const useMemo=fn=>fn();
export function renderControlled(props){cleanups.forEach(fn=>fn?.()); effects=[]; index=0; const tree=GoalTable(props); cleanups=effects.map(fn=>fn()); return tree;}
export function renderThemesControlled(props){cleanups.forEach(fn=>fn?.()); effects=[]; index=0; const tree=ThemeEventTable(props); cleanups=effects.map(fn=>fn()); return tree;}
export function renderSuggestionControlled(props){cleanups.forEach(fn=>fn?.()); effects=[]; index=0; const tree=Suggest(props); cleanups=effects.map(fn=>fn()); return tree;}
export function dispose(){cleanups.forEach(fn=>fn?.()); slots=[]; cleanups=[];}
`;
const controlledCode = await transformWithOxc(
  tableStubs.replace('{Fragment,useState,useRef,useEffect,useMemo}', '{Fragment}') +
    controlledHooks +
    source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''),
  'ControlledGoalTables.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const controlled = await import(
  'data:text/javascript;base64,' + Buffer.from(controlledCode.code + '\n//# sourceURL=ControlledGoalTables.js').toString('base64')
);
const nodes = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]);

test('suggestion Enter chọn một lần; Shift+Enter và IME giữ cho ô nhập xử lý', () => {
  const oldDocument = globalThis.document;
  globalThis.document = { getElementById: () => null };
  const picked = [];
  const props = { query: '', options: [{ key: 'source-1', text: 'Gợi ý' }], label: 'Gợi ý', onPick: (option) => picked.push(option.key), children: React.createElement('textarea') };
  const event = (key, extra = {}) => ({ key, shiftKey: false, nativeEvent: { isComposing: false }, target: { tagName: 'TEXTAREA' }, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...extra });
  try {
    let view = controlled.renderSuggestionControlled(props);
    view.props.onFocus();
    view = controlled.renderSuggestionControlled(props);
    const down = event('ArrowDown');
    view.props.onKeyDownCapture(down);
    view = controlled.renderSuggestionControlled(props);
    const composing = event('Enter', { nativeEvent: { isComposing: true } });
    view.props.onKeyDownCapture(composing);
    assert.equal(composing.prevented, false);
    const shifted = event('Enter', { shiftKey: true });
    view.props.onKeyDownCapture(shifted);
    assert.equal(shifted.prevented, false);
    const enter = event('Enter');
    view.props.onKeyDownCapture(enter);
    assert.equal(enter.prevented, true);
    assert.equal(enter.stopped, true);
    assert.deepEqual(picked, ['source-1']);
  } finally {
    controlled.dispose();
    globalThis.document = oldDocument;
  }
});

test('Enter in a parent theme moves to the next parent, skipping its branch rows', () => {
  const oldDocument = globalThis.document;
  const focused = [];
  globalThis.document = { querySelector: (selector) => ({ value: '', focus: () => focused.push(selector), setSelectionRange() {} }) };
  const props = {
    themes: [
      { id: 'parent', name: 'Một', abbr: 'M' },
      { id: 'next-parent', name: 'Hai', abbr: 'H' },
    ],
    breaks: [],
    domains: [],
    numbers: {},
    hideGoals: true,
    branchTemplates: [{ id: 'one', themeId: 'parent', name: 'Nhánh một' }],
    onChange() {},
  };
  try {
    const render = () => nodes(controlled.renderThemesControlled(props));
    const group = render().find((node) => node.props.theme?.id === 'parent');
    nodes(group.props.leadingCells)
      .find((node) => node.props['data-focus'] === 'parent')
      .props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: false }, preventDefault() {} });
    render();
    assert.deepEqual(focused, ['[data-focus="next-parent"]']);
  } finally {
    controlled.dispose();
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test('annual labels change only on release or confirmation; selection and cancel preserve old labels', () => {
  const listeners = new Map();
  const previousDocument = globalThis.document;
  globalThis.document = {
    addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: (key, fn) => {
      if (listeners.get(key) === fn) listeners.delete(key);
    },
  };
  let current = [{ name: 'Thể chất', rows: [1, 2, 3].map((n) => ({ id: `g${n}`, kind: 'goal', text: `Goal ${n}`, contents: [] })) }];
  const render = () =>
    nodes(
      controlled.renderControlled({
        domains: current,
        themes: [],
        numbers: { g1: 1, g2: 2, g3: 3 },
        editLabels: true,
        onChange: (next) => (current = next),
      }),
    );
  const input = (tree, n) => tree.find((node) => node.props['aria-label'] === `Nhãn mục tiêu ${n}`);
  const handle = (tree, n) => tree.find((node) => node.type === 'button' && node.props['aria-label'] === `Điền nhãn từ mục tiêu ${n}`);
  const key = (value) => ({ key: value, preventDefault() {} });
  try {
    assert.equal(handle(render(), 1).props.className, 'ga-goal-label-fill');
    assert.equal(handle(render(), 1).props.children, undefined);
    input(render(), 1).props.onChange({ target: { value: 'Mục tiêu 01' } });
    let releasedPointer;
    handle(render(), 1).props.onPointerDown({
      button: 0,
      pointerId: 7,
      preventDefault() {},
      stopPropagation() {},
      currentTarget: { hasPointerCapture: (id) => id === 7, releasePointerCapture: (id) => (releasedPointer = id) },
    });
    assert.equal(releasedPointer, 7);
    render()
      .find((node) => node.type === 'td' && nodes(node).some((child) => child.props?.['aria-label'] === 'Nhãn mục tiêu 3'))
      .props.onPointerEnter();
    assert.equal(input(render(), 3).props.value, 'MT3');
    assert.equal(current[0].rows[2].displayLabel, undefined);
    listeners.get('pointerup')();
    assert.equal(current[0].rows[2].displayLabel, 'Mục tiêu 03');
    handle(render(), 1).props.onPointerDown({ button: 0, preventDefault() {}, stopPropagation() {} });
    render();
    listeners.get('pointercancel')();
    assert.equal(current[0].rows[2].displayLabel, 'Mục tiêu 03');
    input(render(), 1).props.onChange({ target: { value: 'Đích 10' } });
    handle(render(), 1).props.onKeyDown(key('ArrowDown'));
    assert.equal(input(render(), 2).props.value, 'Mục tiêu 02');
    handle(render(), 1).props.onKeyDown(key('Escape'));
    assert.equal(input(render(), 2).props.value, 'Mục tiêu 02');
    handle(render(), 1).props.onKeyDown(key('ArrowDown'));
    handle(render(), 1).props.onKeyDown(key('Enter'));
    assert.equal(current[0].rows[1].displayLabel, 'Đích 11');
    assert.equal(current[0].rows[1].text, 'Goal 2');
    assert.equal(current[0].rows[2].displayLabel, 'Mục tiêu 03');
  } finally {
    controlled.dispose();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('deleting a branch requires confirmation and cancel preserves every branch', () => {
  const props = {
    themes: [{ id: 'parent', name: 'Chủ đề', abbr: 'CĐ' }],
    breaks: [],
    domains: [],
    numbers: {},
    hideGoals: true,
    branchTemplates: [
      { id: 'one', themeId: 'parent', name: 'Nhánh một' },
      { id: 'two', themeId: 'parent', name: 'Nhánh hai' },
      { id: 'other', themeId: 'other-parent', name: 'Nhánh khác' },
    ],
    onChange(patch) {
      Object.assign(props, patch);
    },
  };
  const render = () => nodes(controlled.renderThemesControlled(props));
  const modal = () => render().find((node) => node.props.confirmLabel === 'Xóa');
  const clickDelete = () => {
    const group = render().find((node) => node.props.theme?.id === 'parent');
    const child = nodes(BranchTemplateNames(group.props));
    child.find((node) => node.props['aria-label'] === 'Xóa nhánh gợi ý Nhánh một').props.onClick();
  };
  try {
    clickDelete();
    assert.equal(props.branchTemplates.length, 3);
    assert.equal(modal().props.open, true);
    assert.equal(modal().props.danger, true);
    assert.match(modal().props.message, /Nhánh một/);
    modal().props.onClose();
    assert.equal(modal().props.open, false);
    assert.equal(props.branchTemplates.length, 3);
    clickDelete();
    modal().props.onConfirm();
    assert.deepEqual(
      props.branchTemplates.map((t) => t.id),
      ['two', 'other'],
    );
    assert.equal(modal().props.open, false);
  } finally {
    controlled.dispose();
  }
});

test('expected results and contents keep a fresh entry after typing without Enter', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { querySelector: () => ({ value: '', focus() {}, setSelectionRange() {} }) };
  let current = [
    {
      name: 'Thể chất',
      rows: [
        { id: 'group', kind: 'group', text: 'Kết quả ban đầu' },
        { id: 'goal', kind: 'goal', text: 'Mục tiêu', contents: [{ id: 'content', text: 'Nội dung ban đầu', themes: ['theme'] }] },
      ],
    },
  ];
  const render = (extra = {}) =>
    nodes(
      controlled.renderControlled({
        domains: current,
        themes: [],
        numbers: { goal: 1 },
        onChange: (next) => {
          current = next;
        },
        ...extra,
      }),
    );
  const blank = (placeholder) => render().find((node) => node.props.placeholder === placeholder && node.props.value === '');
  try {
    assert.ok(blank('Nhập kết quả mong đợi'));
    assert.ok(blank('Nhập nội dung'));
    blank('Nhập kết quả mong đợi').props.onChange({ target: { value: 'Kết quả mới' } });
    assert.ok(blank('Nhập kết quả mong đợi'));
    assert.equal(current[0].rows.filter((row) => row.kind === 'group').length, 2);
    blank('Nhập nội dung').props.onChange({ target: { value: 'Nội dung mới' } });
    assert.ok(blank('Nhập nội dung'));
    const goal = current[0].rows.find((row) => row.id === 'goal');
    assert.deepEqual(
      goal.contents.map((content) => content.text),
      ['Nội dung ban đầu', 'Nội dung mới'],
    );
    assert.deepEqual(goal.contents[0].themes, ['theme']);
    assert.equal(
      goal.contents.some((content) => !content.text),
      false,
    );
    assert.equal(
      render({ readOnly: true }).some((node) => node.props.placeholder),
      false,
    );
  } finally {
    controlled.dispose();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('subdomain delete button occupies the same final column as goal deletion', () => {
  const html = renderToStaticMarkup(React.createElement(GoalTable, { domains, themes: [], numbers: { g: 1 }, onChange() {} }));
  assert.match(html, /<td colSpan="4" class="ga-goal-table__subband"|<td colspan="4" class="ga-goal-table__subband"/);
  const subRow = html.match(/<tr><td col[Ss]pan="4" class="ga-goal-table__subband">([\s\S]*?)<\/tr>/)?.[1];
  assert.ok(subRow);
  assert.match(subRow, /<\/td><td class="center ga-goal-table__subband(?: [^"]+)?">[\s\S]*aria-label="Xóa lĩnh vực con 1"/);
  assert.match(html, /aria-label="Xóa mục tiêu 1"/);
});

test('annual STT can be entered before goal text and is not replaced when text arrives', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { querySelector: () => ({ value: '', focus() {}, setSelectionRange() {} }) };
  let current = [{ name: 'A', rows: [] }];
  const render = () =>
    nodes(
      controlled.renderControlled({
        domains: current,
        themes: [],
        numbers: numberGoals(current),
        editLabels: true,
        onChange: (next) => {
          current = next;
        },
      }),
    );
  const blankLabel = () =>
    render().find(
      (node) => node.props['aria-label']?.startsWith('STT mục tiêu mới lĩnh vực ') && !node.props['data-focus'],
    );
  const label = (id) => render().find((node) => node.props['data-focus'] === `label-${id}`);
  const goalText = (id) => render().find((node) => node.props['data-focus'] === id);
  try {
    assert.ok(blankLabel());
    blankLabel().props.onChange({ target: { value: 'MTR20' } });
    const first = current[0].rows[0];
    assert.equal(first.text, '');
    assert.equal(label(first.id).props.value, 'MTR20');
    label(first.id).props.onChange({ target: { value: 'MTR21' } });
    goalText(first.id).props.onChange({ target: { value: 'Mục tiêu đầu' } });
    assert.equal(current[0].rows.length, 1);
    assert.equal(label(first.id).props.value, 'MTR21');
    render()
      .find((node) => node.props.placeholder === 'Nhập mục tiêu mới')
      .props.onChange({ target: { value: 'Mục tiêu sau' } });
    const second = current[0].rows.find((row) => row.kind === 'goal' && row.id !== first.id);
    assert.equal(label(second.id).props.value, 'MT2');
    blankLabel().props.onChange({ target: { value: 'X' } });
    const third = current[0].rows.at(-1);
    label(third.id).props.onChange({ target: { value: '' } });
    assert.equal(label(third.id).props.value, '');
    goalText(third.id).props.onChange({ target: { value: 'Mục tiêu ba' } });
    assert.equal(label(third.id).props.value, 'MT3');
    assert.equal(current[0].rows.filter((row) => row.kind === 'goal').length, 3);
  } finally {
    controlled.dispose();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('empty domain keeps the subdomain entry above expected results and goals; STT has no placeholder', () => {
  const render = (rows) =>
    renderToStaticMarkup(
      React.createElement(GoalTable, { domains: [{ name: 'A', rows }], themes: [], numbers: {}, editLabels: true, onChange() {} }),
    );
  for (const rows of [[], [{ id: 'group', kind: 'group', text: 'Kết quả', contents: [] }]]) {
    const html = render(rows);
    const sub = html.indexOf('placeholder="Nhập lĩnh vực con"');
    assert.ok(sub >= 0);
    assert.ok(sub < html.indexOf('Nhập mục tiêu mới'));
    assert.ok(sub < html.indexOf('Nhập kết quả mong đợi'));
    assert.equal((html.match(/placeholder="Nhập lĩnh vực con"/g) || []).length, 1);
    assert.doesNotMatch(html, /placeholder="Nhập STT"/);
    assert.match(html, /aria-label="STT mục tiêu mới lĩnh vực A"/);
  }
});
