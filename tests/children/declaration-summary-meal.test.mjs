import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyDeclaration } from '@/utils/children/childrenHelpers';

const source = await readFile(new URL('../../src/components/children/DeclarationSummary.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const AllergyStateBadge=()=>React.createElement('span',null,'Badge dị ứng');
const DietStateBadge=()=>React.createElement('span',null,'Badge ăn');
const NoteStateBadge=()=>React.createElement('span',null,'Badge ghi chú');
const DECLARATION_STATE={REPORTED:'REPORTED',NONE_REPORTED:'NONE_REPORTED',NOT_PROVIDED:'NOT_PROVIDED'};
const MEDICAL_HISTORY_ITEMS=[{key:'self',label:'Tiền sử bản thân'}];
const historyItemText=()=>'—';
const formatDateTime=(v)=>String(v);
const EmptyState=({title})=>React.createElement('div',null,title);
const IntakeSheet=({title,children})=>React.createElement('div',null,React.createElement('h2',null,title),children);
const IntakeSheetValueRow=({label,children})=>React.createElement('div',null,React.createElement('b',null,label),children);
const ChildInfoTable=({label,rows})=>React.createElement('div',null,React.createElement('h2',null,label),rows.map(([l,v])=>React.createElement('div',{key:l},React.createElement('b',null,l),v)));
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'DeclarationSummary.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { DeclarationSummary } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString(
    'base64',
  )}`
);
const React = await import('react');

const declaration = (overrides = {}) => ({
  ...emptyDeclaration(),
  allergies: { state: 'REPORTED', items: ['Trứng'] },
  ...overrides,
});
const render = (props) => renderToStaticMarkup(React.createElement(DeclarationSummary, props));

for (const sheet of [true, false]) {
  test(`tóm tắt báo ăn hiện dị ứng (sheet=${sheet})`, () => {
    const html = render({ declaration: declaration(), sheet });
    assert.match(html, /Báo ăn/);
    assert.match(html, /<b>Báo ăn<\/b>Có/);
    assert.match(html, /Dị ứng/);
    assert.match(html, /Chế độ ăn/);
  });

  test(`tóm tắt không báo ăn ẩn dị ứng, chế độ ăn (sheet=${sheet})`, () => {
    const html = render({ declaration: declaration({ mealRegistered: false }), sheet });
    assert.match(html, /<b>Báo ăn<\/b>Không/);
    assert.doesNotMatch(html, /Dị ứng/);
    assert.doesNotMatch(html, /Chế độ ăn/);
    assert.match(html, /Thông tin khác/);
  });
}

test('prop mealRegistered ghi đè khai báo; null/undefined coi là báo ăn', () => {
  assert.match(render({ declaration: declaration(), mealRegistered: false }), /<b>Báo ăn<\/b>Không/);
  assert.match(render({ declaration: declaration({ mealRegistered: false }), mealRegistered: true }), /<b>Báo ăn<\/b>Có/);
  assert.match(render({ declaration: declaration({ mealRegistered: null }) }), /<b>Báo ăn<\/b>Có/);
  assert.match(render({ declaration: declaration(), mealRegistered: null }), /<b>Báo ăn<\/b>Có/);
});

test('dòng Thông tin khác nằm sau các dòng tiền sử, cùng thứ tự với form', () => {
  const html = render({ declaration: declaration() });
  assert.ok(html.indexOf('Thông tin khác') > html.indexOf('Tiền sử'));
});
