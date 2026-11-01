import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
const source = await readFile(new URL('../../src/components/education-plan/ImportGoalFileModal.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import .*;\r?\n/gm, '');
const stubs = `import React from 'react';
import {prepareFileImport,previewSummary} from '${new URL('../../src/models/education-plan/importGoalFile.mjs', import.meta.url).href}';
import {AGE_GROUPS,domainLabel} from '${new URL('../../src/models/education-plan/educationPlanConstants.js', import.meta.url).href}';
export const h={states:[],refs:[],si:0,ri:0,started:false,cleanup:null,reader:()=>Promise.resolve(null)};
const useState=(initial)=>{const i=h.si++;if(!(i in h.states))h.states[i]=initial;return [h.states[i],v=>{h.states[i]=typeof v==='function'?v(h.states[i]):v;}];};
const useRef=(v)=>h.refs[h.ri++] ||= {current:v};
const useEffect=(f)=>{if(!h.started){h.started=true;h.cleanup=f();}};
const previewGoalFile=(file)=>h.reader(file), Download=()=>null,Upload=()=>null,LoadingState=()=>null;
const fmtDate=(v)=>v||'—',downloadDoc=()=>{},goalTemplateFile=()=>({});
const Modal=({children,footer})=><div role="dialog">{children}{footer}</div>, Notice=({children})=><div>{children}</div>;
`;
const { code } = await transformWithOxc(stubs + isolated, 'ImportGoalFileModal.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { ImportGoalFileModal, h } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
const form = { title: 'Nhập tay', ageGroupId: 'ag-3', schoolYear: '2026 – 2027', themes: [], breaks: [], domains: [] };
const preview = {
  metadata: { title: 'Từ file', schoolYear: '2025-2026', ageFromMonths: 36, ageToMonths: 48 },
  themes: [{ name: 'Trường', abbr: 'MN', start: '2025-09-08', end: '2025-09-26' }],
  breaks: [{ name: 'Nghỉ', start: '2026-02-16', end: '2026-02-20' }],
  domains: [{ name: 'Phát triển thể chất', rows: [{ kind: 'goal', text: 'G', contents: [{ text: 'C', themes: ['MN'] }] }] }],
  warnings: [],
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((ok, no) => {
    resolve = ok;
    reject = no;
  });
  return { promise, resolve, reject };
};
const reset = () => {
  Object.assign(h, { states: [], refs: [], si: 0, ri: 0, started: false, cleanup: null });
};
const render = (props) => {
  h.si = 0;
  h.ri = 0;
  return ImportGoalFileModal({ form, onImport: () => true, onClose: () => {}, ...props });
};
const find = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children, node.props?.footer].flat(Infinity)) {
    const hit = find(child, predicate);
    if (hit) return hit;
  }
  return null;
};
const input = (tree) => find(tree, (node) => node.type === 'input');
const confirm = (tree) => find(tree, (node) => node.type === 'button' && node.props.className === 'btn btn--primary');

test('file cũ phản hồi sau file mới không ghi đè preview; lỗi đọc khóa xác nhận', async () => {
  reset();
  const a = deferred(),
    b = deferred();
  h.reader = (f) => (f.name === 'a' ? a.promise : b.promise);
  const tree = render();
  const first = input(tree).props.onChange({ target: { files: [{ name: 'a' }] } });
  const second = input(tree).props.onChange({ target: { files: [{ name: 'b' }] } });
  b.resolve(preview);
  await second;
  a.resolve({ ...preview, metadata: { ...preview.metadata, title: 'Sai cũ' } });
  await first;
  assert.equal(h.states[0].name, 'b');
  assert.equal(h.states[0].preview.metadata.title, 'Từ file');
  h.reader = () => Promise.reject(new Error('Không đọc được'));
  await input(render()).props.onChange({ target: { files: [{ name: 'error' }] } });
  assert.equal(confirm(render()).props.disabled, true);
});

test('đóng hoặc unmount khi đọc: phản hồi muộn không trở thành preview/applied', async () => {
  for (const unmount of [false, true]) {
    reset();
    const pending = deferred();
    h.reader = () => pending.promise;
    let closes = 0,
      applies = 0;
    const tree = render({
      onClose: () => closes++,
      onImport: () => {
        applies++;
        return true;
      },
    });
    const task = input(tree).props.onChange({ target: { files: [{ name: 'a' }] } });
    if (unmount) h.cleanup();
    else tree.props.onClose();
    pending.resolve(preview);
    await task;
    assert.equal(h.states[0].status, 'loading');
    assert.equal(applies, 0);
    assert.equal(closes, unmount ? 0 : 1);
  }
});

test('preview đủ thông tin/dời năm, xác nhận chỉ một lần; callback mất quyền giữ modal', async () => {
  reset();
  h.reader = () => Promise.resolve(preview);
  let applied = 0,
    closed = 0;
  const props = {
    onImport: (raw) => {
      assert.equal(raw, preview);
      applied++;
      return true;
    },
    onClose: () => closed++,
  };
  await input(render(props)).props.onChange({ target: { files: [{ name: 'plan.doc' }] } });
  const tree = render(props),
    html = renderToStaticMarkup(tree);
  assert.match(html, /Thông tin chung/);
  assert.match(html, /Chủ đề trong file/);
  assert.match(html, /Đợt nghỉ trong file/);
  assert.match(html, /2026-09-08/);
  assert.match(html, /Nhập tay/);
  assert.match(html, /Bổ sung vào kế hoạch/);
  const button = confirm(tree);
  button.props.onClick();
  button.props.onClick();
  assert.equal(applied, 1);
  assert.equal(closed, 1);
  reset();
  h.reader = () => Promise.resolve(preview);
  await input(render()).props.onChange({ target: { files: [{ name: 'a' }] } });
  confirm(render({ onImport: () => false, onClose: () => closed++ })).props.onClick();
  assert.equal(closed, 1);
  assert.match(renderToStaticMarkup(render()), /Chưa thể bổ sung/);
});

test('khác nhóm tuổi khóa xác nhận, không gọi onImport dù handler bị gọi trực tiếp', async () => {
  reset();
  h.reader = () => Promise.resolve(preview);
  let count = 0;
  const props = { form: { ...form, ageGroupId: 'ag-4' }, onImport: () => count++ };
  await input(render(props)).props.onChange({ target: { files: [{ name: 'a' }] } });
  const tree = render(props);
  assert.equal(confirm(tree).props.disabled, true);
  confirm(tree).props.onClick();
  assert.equal(count, 0);
  assert.match(renderToStaticMarkup(tree), /khác nhóm tuổi/);
});
