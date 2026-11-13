import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const name = 'Phát triển thể chất';
const catalog = {
  sources: [],
  goals: [
    { id: 1, sourceId: 1, domainId: 1, domainName: name, subDomainId: 100, subDomain: 'Nhánh A', expectedResultId: 200, groupText: 'Nhóm A', goalText: 'Mục tiêu A', contents: ['Gợi ý A', 'Gợi ý A thêm'] },
    { id: 2, sourceId: 1, domainId: 1, domainName: name, subDomainId: 101, subDomain: 'Nhánh B', expectedResultId: 201, groupText: 'Nhóm B', goalText: 'Mục tiêu B', contents: ['Gợi ý B'] },
    { id: 3, sourceId: 1, domainId: 1, domainName: name, subDomainId: 100, subDomain: 'Nhánh A', expectedResultId: 200, groupText: 'Nhóm A', goalText: 'Mục tiêu A thêm', contents: ['Từ mục tiêu khác cùng nhóm'] },
    ...Array.from({ length: 16 }, (_, i) => ({ id: 100 + i, sourceId: 1, domainId: 1, domainName: name, subDomainId: 100, subDomain: 'Nhánh A', expectedResultId: 200, groupText: 'Nhóm A', goalText: `Lựa chọn dài ${i}`, contents: [] })),
  ],
  contents: [
    { id: 10, sourceId: 1, domainId: 1, domainName: name, subDomainId: 100, subDomain: 'Nhánh A', text: 'Mục C A', category: 'A' },
    { id: 11, sourceId: 1, domainId: 1, domainName: name, subDomainId: 101, subDomain: 'Nhánh B', text: 'Mục C B', category: 'B' },
  ],
};
const form = { id: 'fixture', ageGroupId: 'ag-3', domains: [{ id: 'd', name, rows: [
  { id: 's1', kind: 'sub', text: 'Nhánh A', curriculumSubDomainId: 100 },
  { id: 'r1', kind: 'group', text: 'Nhóm A', curriculumExpectedResultId: 200 },
  { id: 'g1', kind: 'goal', text: 'Mục tiêu A', contents: [{ id: 'c1', text: 'Giữ nguyên', themes: ['t'] }] },
  { id: 's2', kind: 'sub', text: 'Nhánh B', curriculumSubDomainId: 101 },
  { id: 'r2', kind: 'group', text: 'Nhóm B', curriculumExpectedResultId: 201 },
  { id: 'g2', kind: 'goal', text: 'Mục tiêu B', contents: [] },
] }] };
catalog.goals.sort((a, b) => a.subDomainId - b.subDomainId);
const html = `<!doctype html><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';
import Modal from '/src/components/education-plan/CurriculumGoalsModal.jsx';import{GoalTable}from'/src/components/education-plan/GoalTables.jsx';
import{numberGoals}from'/src/models/education-plan/goalTable.js';import{addSuggestedContents}from'/src/models/education-plan/curriculum.mjs';
import '/src/styles/index.css';import '/src/styles/modules/education-plan.css';
window.catalog=${JSON.stringify(catalog)};window.requests=[];window.calls=[];
function App(){const[f,setF]=React.useState(${JSON.stringify(form)});const[open,setOpen]=React.useState(true);const[readonly,setReadonly]=React.useState(false);const[age,setAge]=React.useState('ag-3');
window.form=f;window.setForm=setF;window.setReadonly=setReadonly;window.setAge=setAge;window.openModal=()=>setOpen(true);
return React.createElement(MemoryRouter,null,React.createElement('main',null,open&&React.createElement(Modal,{ageGroupId:age,form:f,onClose:()=>setOpen(false),onImportGoals:()=>true,onAddContents:(target,items)=>{window.calls.push({target,items});setF(old=>({...old,domains:addSuggestedContents(old,target,items,()=>crypto.randomUUID()).domains}));return true;}}),React.createElement(GoalTable,{domains:f.domains,ageGroupId:age,numbers:numberGoals(f.domains),themes:[],readOnly:readonly,fixedCells:readonly,canSuggest:!readonly,suggestionScope:f.id,onChange:domains=>setF(old=>({...old,domains}))})));}
createRoot(document.getElementById('root')).render(React.createElement(App));</script>`;
const service = `export const getCurriculumSources=async()=>window.catalog.sources;
const load=async(kind,age)=>{window.requests.push({kind,age});const value=window.catalog[kind],fail=window.failCatalog,delay=window.catalogDelay;if(delay)await new Promise(r=>setTimeout(r,delay));if(fail)throw new Error('Tải lỗi kiểm thử');return value;};
export const getCurriculumGoals=age=>load('goals',age);export const getCurriculumContents=age=>load('contents',age);`;
const asyncHook = `import {useAsync as actual} from '/src/hooks/useAsync.js?fixture-original';
export function useAsync(...args){const result=actual(...args);window.reloadFixtureCatalog=result.reload;return result;}`;
const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, plugins: [{
  name: 'curriculum-fixture', enforce: 'pre',
  resolveId(id) { if (/\/services\/education-plan\/educationPlanService(?:\.js)?$/.test(id)) return '\0curriculum-fixture-service'; if (/\/hooks\/useAsync(?:\.js)?$/.test(id)) return '\0curriculum-fixture-async'; },
  load(id) { if (id === '\0curriculum-fixture-service') return service; if (id === '\0curriculum-fixture-async') return asyncHook; },
  configureServer(s) { s.middlewares.use('/__curriculum014__', async (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(await s.transformIndexHtml('/__curriculum014__', html)); }); },
}] });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error('PAGE', e.message); });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__curriculum014__`);
  await page.getByRole('tab', { name: /Gợi ý nội dung/ }).click();
  await page.locator('#cur-domain').selectOption({ label: name }).catch(async (error) => { console.error(await page.locator('body').innerText()); throw error; });
  await page.locator('#cur-sub').selectOption({ label: 'Nhánh A' });
  assert.equal(await page.locator('#cur-target option').count(), 2, 'only target A plus placeholder');
  await page.locator('#cur-target').selectOption('g1');
  await page.getByText('Mục C A', { exact: true }).click();
  const before = await page.evaluate(() => structuredClone(window.form));
  await page.locator('#cur-sub').selectOption({ label: 'Nhánh B' });
  assert.equal(await page.locator('#cur-target').inputValue(), '', 'changing parent clears stale target');
  assert.equal(await page.getByRole('button', { name: /Thêm .*nội dung/ }).isEnabled(), false);
  assert.deepEqual(await page.evaluate(() => window.form), before);
  assert.equal(await page.locator('#cur-target option[value="g1"]').count(), 0);
  await page.locator('#cur-target').selectOption('g2');
  await page.getByRole('dialog').getByText('Mục C B', { exact: true }).click();
  await page.getByRole('button', { name: /Thêm .*nội dung/ }).click();
  assert.equal((await page.evaluate(() => window.calls)).at(-1).target, 'g2');
  assert.deepEqual(await page.evaluate(() => window.form.domains[0].rows[2].contents), before.domains[0].rows[2].contents);
  const afterAdd = await page.evaluate(() => structuredClone(window.form));
  await page.getByRole('dialog').getByText('Mục C B', { exact: true }).click();
  await page.evaluate(() => window.setForm((old) => ({ ...old, domains: old.domains.map((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== 'g2') })) })));
  await page.waitForFunction(() => !window.form.domains[0].rows.some((r) => r.id === 'g2'));
  assert.equal(await page.locator('#cur-target').inputValue(), '', 'removed target is no longer selected');
  assert.equal(await page.getByRole('button', { name: /Thêm .*nội dung/ }).isEnabled(), false);
  assert.equal(await page.evaluate(() => window.calls.length), 1);
  await page.evaluate((saved) => window.setForm(saved), afterAdd);
  await page.getByRole('button', { name: 'Đóng', exact: true }).first().click();
  console.log('PASS modal: strict target hierarchy, stale selection removed, added data/ticks retained');
  const goalInput = page.locator('[data-focus="g1"]');
  await goalInput.focus();
  await goalInput.fill('');
  assert.equal(await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).count(), 1, 'goal input suggests only group A');
  assert.equal(await page.getByRole('option', { name: 'Mục tiêu B', exact: true }).count(), 0);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await goalInput.inputValue(), 'Mục tiêu A');
  assert.equal(await page.evaluate(() => window.form.domains[0].rows.filter((r) => r.kind === 'goal').length), 2);
  assert.equal(await page.evaluate(() => window.form.domains[0].rows[2].curriculumGoalId), 1);
  console.log('PASS inline: focus/query/group identity, Enter picks once without creating a row');
  const groupInput = page.getByLabel('Nhóm kết quả mong đợi', { exact: true }).first();
  await groupInput.fill('');
  await page.getByRole('option', { name: 'Nhóm A', exact: true }).tap();
  assert.equal(await groupInput.inputValue(), 'Nhóm A');
  assert.equal(await page.getByRole('option', { name: 'Nhóm B', exact: true }).count(), 0);
  const contentInput = page.getByLabel('Nội dung 1 của mục tiêu 1', { exact: true });
  await contentInput.fill('');
  await page.getByRole('option', { name: 'Từ mục tiêu khác cùng nhóm', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.form.domains[0].rows.find((r) => r.id === 'g1').contents[0].themes), ['t']);
  assert.equal(await contentInput.inputValue(), 'Từ mục tiêu khác cùng nhóm');
  const addGoal = page.getByLabel(`Thêm mục tiêu lĩnh vực ${name}`, { exact: true }).first();
  await addGoal.focus();
  assert.equal(await page.getByRole('option').count(), 18, 'all matches beyond twelve are accessible');
  await page.getByRole('option', { name: 'Mục tiêu A thêm', exact: true }).click();
  assert.equal(await page.evaluate(() => window.form.domains[0].rows.filter((r) => r.kind === 'goal').length), 3);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await goalInput.fill('');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.equal(await goalInput.getAttribute('aria-expanded'), 'false');
    await goalInput.click();
    await page.getByRole('option', { name: 'Lựa chọn dài 15', exact: true }).click();
    assert.equal(await goalInput.inputValue(), 'Lựa chọn dài 15');
    await goalInput.evaluate((input) => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })));
    assert.equal(await page.evaluate(() => window.form.domains[0].rows.filter((r) => r.kind === 'goal').length), 3);
    await goalInput.fill('');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
  }
  await goalInput.fill('');
  await page.keyboard.press('ArrowUp');
  assert.ok(await goalInput.getAttribute('aria-activedescendant'), 'ArrowUp must highlight an option');
  await page.keyboard.press('Escape');
  await goalInput.fill('Mục tiêu A');
  await goalInput.press('Shift+Enter');
  assert.match(await goalInput.inputValue(), /\n/);
  assert.equal(await page.evaluate(() => window.form.domains[0].rows.filter((r) => r.kind === 'goal').length), 3);
  await goalInput.fill('Mục tiêu A');
  console.log('PASS group/content/new goal: source metadata, group-wide contents, tick preservation, keyboard/touch1440/390 and >12 matches');
  await page.evaluate(() => window.setForm((old) => ({ ...old, domains: [{ ...old.domains[0], rows: [...old.domains[0].rows,
    { id: 'sm', kind: 'sub', text: 'Nhánh nhập tay' }, { id: 'rm', kind: 'group', text: 'Nhóm nhập tay' },
    { id: 'gm', kind: 'goal', text: 'Mục tiêu nhập tay', contents: [] },
  ] }] })));
  const manual = page.getByLabel(`Mục tiêu 4 lĩnh vực ${name}`, { exact: true });
  await manual.focus();
  await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).selectOption('100');
  await page.getByLabel('Kết quả mong đợi nguồn', { exact: true }).selectOption('200');
  assert.equal(await page.evaluate(() => window.form.domains[0].rows.find((r) => r.id === 'rm').curriculumExpectedResultId), undefined);
  await manual.fill('');
  await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).click();
  assert.equal(await page.evaluate(() => window.form.domains[0].rows.find((r) => r.id === 'gm').curriculumGoalId), 1);
  console.log('PASS manual context: explicit source selection without guessing or changing parent provenance');
  const newContent = page.getByLabel('Nội dung đầu tiên của mục tiêu 4', { exact: true });
  await newContent.focus();
  await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).selectOption('100');
  await page.getByLabel('Kết quả mong đợi nguồn', { exact: true }).selectOption('200');
  await newContent.pressSequentially('T');
  const newContentId = await page.evaluate(() => document.activeElement.getAttribute('data-focus'));
  await page.locator(`[data-focus="${newContentId}"]`).click();
  assert.equal(await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).inputValue(), '100');
  assert.equal(await page.getByLabel('Kết quả mong đợi nguồn', { exact: true }).inputValue(), '200');
  await page.getByRole('option', { name: 'Từ mục tiêu khác cùng nhóm', exact: true }).waitFor();
  console.log('PASS source context survives typing in a new content row');
  const manualNew = page.getByLabel(`Thêm mục tiêu lĩnh vực ${name}`, { exact: true }).last();
  await manualNew.focus();
  await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).selectOption('100');
  await page.getByLabel('Kết quả mong đợi nguồn', { exact: true }).selectOption('200');
  await manualNew.pressSequentially('M');
  const createdId = await page.evaluate(() => document.activeElement.getAttribute('data-focus'));
  const createdInput = page.locator(`[data-focus="${createdId}"]`);
  await createdInput.waitFor();
  await createdInput.click();
  assert.equal(await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).inputValue(), '100');
  assert.equal(await page.getByLabel('Kết quả mong đợi nguồn', { exact: true }).inputValue(), '200');
  await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).waitFor();
  console.log('PASS source context survives materializing a new typed row');
  await page.evaluate((id) => window.setForm((old) => {
    const rows = [...old.domains[0].rows]; const row = rows.splice(rows.findIndex((r) => r.id === id), 1)[0];
    rows.splice(rows.findIndex((r) => r.id === 'r2') + 1, 0, row); return { ...old, domains: [{ ...old.domains[0], rows }] };
  }), createdId);
  await page.waitForTimeout(100);
  await page.evaluate((id) => window.setForm((old) => {
    const rows = [...old.domains[0].rows]; const row = rows.splice(rows.findIndex((r) => r.id === id), 1)[0];
    rows.splice(rows.findIndex((r) => r.id === 'rm') + 1, 0, row); return { ...old, domains: [{ ...old.domains[0], rows }] };
  }), createdId);
  await page.locator(`[data-focus="${createdId}"]`).click();
  assert.equal(await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).inputValue(), '', 'moving out and back must not resurrect old context');
  console.log('PASS context invalidated after moving a row between branches');
  const newGroup = page.getByLabel(`Thêm nhóm kết quả lĩnh vực ${name}`, { exact: true }).last();
  await newGroup.focus();
  await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).selectOption('100');
  await newGroup.pressSequentially('N');
  const newGroupId = await page.evaluate(() => document.activeElement.getAttribute('data-focus'));
  await page.locator(`[data-focus="${newGroupId}"]`).click();
  assert.equal(await page.getByLabel('Lĩnh vực con nguồn', { exact: true }).inputValue(), '100');
  await page.getByRole('option', { name: 'Nhóm A', exact: true }).waitFor();
  console.log('PASS source context survives typing in a new group');
  await goalInput.fill('');
  const prior = await page.evaluate(() => structuredClone(window.form));
  await page.evaluate(() => { window.catalogDelay = 350; window.failCatalog = true; window.reloadFixtureCatalog(); });
  await page.getByRole('status').filter({ hasText: 'Đang tải gợi ý' }).waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.form), prior, 'hidden loading options cannot be committed');
  await page.getByRole('alert').filter({ hasText: 'Không tải được gợi ý' }).waitFor();
  await goalInput.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.form), prior, 'hidden error options cannot be committed');
  await page.evaluate(() => { window.catalogDelay = 0; window.failCatalog = false; });
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await goalInput.focus();
  await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).waitFor();
  await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).click();
  console.log('PASS loading/error: hidden old options cannot be selected by keyboard');
  await page.evaluate(() => window.setReadonly(true));
  await page.waitForTimeout(100);
  const requestsBefore = await page.evaluate(() => window.requests.length);
  await page.evaluate(() => window.setAge('ag-4'));
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.requests.length), requestsBefore, 'readonly must not fetch catalog on age change');
  assert.equal(await page.locator('.ga-curriculum-fixed textarea').count(), 0);
  const saved = await page.evaluate(() => structuredClone(window.form));
  await page.evaluate(() => { window.failCatalog = true; window.setReadonly(false); });
  const firstInput = page.locator('[data-focus="g1"]');
  await firstInput.click();
  await page.getByRole('alert').filter({ hasText: 'Không tải được gợi ý' }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.form), saved, 'failed catalog load must retain the draft');
  await page.evaluate(() => { window.failCatalog = false; });
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await firstInput.fill('');
  await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).waitFor();
  await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).click();
  console.log('PASS readonly/no-fetch and catalog failure/retry without draft loss');
  await firstInput.fill('');
  await page.evaluate(() => { window.catalogDelay = 900; window.setAge('ag-4'); });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.catalog = { ...window.catalog, goals: window.catalog.goals.map((g) => g.id === 1 ? { ...g, goalText: 'Dữ liệu tuổi mới' } : g) };
    window.catalogDelay = 0;
    window.setAge('ag-5');
  });
  await page.waitForTimeout(100);
  await firstInput.click();
  await page.getByRole('option', { name: 'Dữ liệu tuổi mới', exact: true }).waitFor();
  await page.waitForTimeout(1000);
  assert.equal(await page.getByRole('option', { name: 'Mục tiêu A', exact: true }).count(), 0);
  assert.equal(await page.getByRole('option', { name: 'Dữ liệu tuổi mới', exact: true }).count(), 1);
  console.log('PASS age change: late response cannot replace the current catalog');
  const beforeEmpty = await page.evaluate(() => structuredClone(window.form));
  await page.evaluate(() => { window.catalog = { sources: [], goals: [], contents: [] }; window.setAge('ag-2'); });
  await page.waitForTimeout(150);
  await firstInput.click();
  await page.getByRole('status').filter({ hasText: 'Chưa có dữ liệu của Bộ cho nhóm tuổi này' }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.form), beforeEmpty);
  console.log('PASS empty catalog reports its scope without changing the draft');
  assert.deepEqual(errors, []);
} finally { await browser?.close(); await server.close(); }
