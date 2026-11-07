import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = await readFile(new URL('../../src/components/education-plan/ImportBranchFileModal.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
import {PLAN_IMPORT_ACCEPT as ACCEPT,validatePlanImportFile} from '${new URL('../../src/utils/education-plan/planImportFile.js', import.meta.url).href}';
const useRef = () => ({current:null}), useState = value => [value?.status ? (globalThis.branchModalTestState || value) : value, () => {}];
const Upload=()=>null, Download=()=>null, LoadingState=()=>null, ConfirmationModal=()=>null;
const Modal=({children,footer,width})=>React.createElement('section',{'data-width':width},children,footer);
const Notice=({children})=>React.createElement('aside',{},children);
export const reads=[];
const USE_MOCK=false, previewBranchFile=async file=>{reads.push(file);return {matches:[],warnings:[]};}, branchFileChanges=(_draft,preview)=>preview.matches;
const branchTemplateFile=args=>({html:'template-'+args.cls.name,name:'Mẫu nhập chủ đề nhánh'});
export const downloads=[]; const downloadDoc=(html,name)=>downloads.push({html,name});
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'ImportBranchFileModal.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const module = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
const props = { classId: '1', yearPlanId: '2', templateArgs: { cls: { name: 'Mẫu' } }, draft: { names: {} }, onImport: () => true };
const buttons = (element) => {
  if (!React.isValidElement(element)) return [];
  return [
    ...(element.type === 'button' ? [element] : []),
    ...React.Children.toArray(element.props.children).flatMap(buttons),
    ...React.Children.toArray(element.props.footer).flatMap(buttons),
  ];
};

test('modal giống mục tiêu: width720, chọn file và tải mẫu cùng hàng, nút tải dùng dữ liệu tuần', () => {
  const element = module.ImportBranchFileModal(props);
  assert.equal(element.props.width, 720);
  const download = buttons(element).find((button) => React.Children.toArray(button.props.children).join('').includes('Tải file mẫu'));
  assert.ok(download);
  assert.equal(download.props.className, 'btn btn--ghost');
  download.props.onClick();
  assert.deepEqual(module.downloads.at(-1), { html: 'template-Mẫu', name: 'Mẫu nhập chủ đề nhánh' });
  const html = renderToStaticMarkup(element);
  assert.match(html, /class="row row--wrap gap-2"/);
  assert.match(html, /Chọn file/);
});

test('modal rút gọn cảnh báo còn8 dòng và báo số còn lại như mục tiêu', () => {
  globalThis.branchModalTestState = {
    status: 'ready',
    preview: { matches: [], warnings: Array.from({ length: 10 }, (_, i) => ({ row: i + 1, message: `Cảnh báo ${i + 1}` })) },
  };
  try {
    const html = renderToStaticMarkup(module.ImportBranchFileModal(props));
    assert.equal((html.match(/<li>/g) || []).length, 9);
    assert.match(html, /và 2 dòng khác/);
    assert.doesNotMatch(html, /Cảnh báo 9/);
  } finally {
    delete globalThis.branchModalTestState;
  }
});

test('nhập nhánh chặn file sai trước API và chấp nhận file hợp lệ', async () => {
  const findInput = (element) => {
    if (!React.isValidElement(element)) return null;
    if (element.type === 'input' && element.props.type === 'file') return element;
    return React.Children.toArray(element.props.children).map(findInput).find(Boolean);
  };
  const before = module.reads.length;
  for (const file of [
    { name: 'plan.exe', size: 12 },
    { name: 'plan.docx', size: 0 },
    { name: 'plan.docx', size: 2097153 },
  ]) {
    await findInput(module.ImportBranchFileModal(props)).props.onChange({ target: { files: [file] } });
  }
  assert.equal(module.reads.length, before);
  await findInput(module.ImportBranchFileModal(props)).props.onChange({ target: { files: [{ name: 'plan.DOCX', size: 2097152 }] } });
  assert.equal(module.reads.length, before + 1);
});
