import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

/* Xu hướng sức khỏe (user yêu cầu 2026-11-10): danh sách trẻ không ghi kết luận sức khỏe, xếp theo tên. Dữ liệu giả. */
async function loadView(path, stubs) {
  const source = await readFile(new URL(`../../src/${path}`, import.meta.url), 'utf8');
  const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '').replace(/^import '[^']+';\r?\n/gm, '');
  const { code } = await transformWithOxc(`import React from 'react';\n${stubs}\n${isolated}`, path, {
    lang: 'jsx',
    jsx: { runtime: 'classic' },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
  );
}

const { TrendChildList, sortByName } = await loadView(
  'components/children/TrendChildList.jsx',
  `
const {useMemo,useRef,useState}=React;
const Search=()=>null, SidebarCollapse=()=>null, SidebarExpand=()=>null;
const normalizeText=(v)=>String(v || '').toLowerCase();
`,
);

test('Xu hướng sức khỏe: danh sách trẻ chỉ có tên, mã, lớp; xếp theo tên', () => {
  const items = sortByName([
    { id: 'b', fullName: 'Trần Khánh An', code: 'HS2', className: 'Lớp Chồi 1', latestHealth: { followUpLevel: 'CLOSE_WATCH' } },
    { id: 'a', fullName: 'Bùi Bảo Ngọc', code: 'HS1', className: 'Lớp Chồi 1' },
  ]);
  assert.deepEqual(
    items.map((c) => c.id),
    ['a', 'b'],
  );
  const html = renderToStaticMarkup(React.createElement(TrendChildList, { items, selectedId: 'a', onSelect: () => {}, showClass: true }));
  assert.match(html, /Bùi Bảo Ngọc/);
  assert.match(html, /HS1 · Lớp Chồi 1/);
  assert.doesNotMatch(html, /kết luận|Cần theo dõi|badge/i);
});
