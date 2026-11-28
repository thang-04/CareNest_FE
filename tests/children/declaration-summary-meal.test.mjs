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

// Một bảng (bước Xem lại khi tiếp nhận): Báo ăn là một dòng của bảng.
test('một bảng: báo ăn hiện dị ứng', () => {
  const html = render({ declaration: declaration(), sheet: true });
  assert.match(html, /<b>Báo ăn<\/b>Có/);
  assert.match(html, /Dị ứng/);
  assert.match(html, /Chế độ ăn/);
});

test('một bảng: không báo ăn ẩn dị ứng, chế độ ăn', () => {
  const html = render({ declaration: declaration({ mealRegistered: false }), sheet: true });
  assert.match(html, /<b>Báo ăn<\/b>Không/);
  assert.doesNotMatch(html, /Dị ứng/);
  assert.doesNotMatch(html, /Chế độ ăn/);
  assert.match(html, /Thông tin khác/);
});

// Hai bảng (màn Khai báo sức khỏe, user duyệt 19/11/2026): Báo ăn, người chốt ở dòng trên.
const mealOf = (html) => html.match(/<dt>Báo ăn<\/dt><dd[^>]*>([^<]*)<\/dd>/)?.[1];

test('hai bảng: I. Dị ứng và chế độ ăn rồi II. Tiền sử và sức khỏe khác, Báo ăn ở dòng trên', () => {
  const html = render({ declaration: declaration() });
  assert.equal(mealOf(html), 'Có');
  const bangI = html.indexOf('I. Dị ứng và chế độ ăn');
  const bangII = html.indexOf('II. Tiền sử và sức khỏe khác');
  assert.ok(bangI > 0 && bangII > bangI);
  const diUng = html.indexOf('<b>Dị ứng thực phẩm / thuốc</b>');
  const cheDo = html.indexOf('<b>Chế độ ăn</b>');
  assert.ok(diUng > bangI && cheDo > diUng && cheDo < bangII);
  assert.ok(html.indexOf('Thông tin sức khỏe khác') > html.indexOf('Tiền sử bản thân'));
});

test('hai bảng, không báo ăn: chỉ còn bảng I. Tiền sử và sức khỏe khác', () => {
  const html = render({ declaration: declaration({ mealRegistered: false }) });
  assert.equal(mealOf(html), 'Không');
  assert.doesNotMatch(html, /Dị ứng/);
  assert.doesNotMatch(html, /Chế độ ăn/);
  assert.match(html, /<h2>I\. Tiền sử và sức khỏe khác<\/h2>/);
  assert.doesNotMatch(html, /II\. Tiền sử/);
});

test('hai bảng: người chốt hiện khi đã có ngày chốt', () => {
  assert.doesNotMatch(render({ declaration: declaration() }), /Người chốt/);
  const html = render({ declaration: declaration({ declaredAt: '2026-11-18T10:32', declaredByName: 'Người chốt mẫu' }) });
  assert.match(html, /<dt>Người chốt<\/dt><dd><span class="fw-600">Người chốt mẫu<\/span> · 2026-11-18T10:32<\/dd>/);
});

test('prop mealRegistered ghi đè khai báo; null/undefined coi là báo ăn', () => {
  assert.equal(mealOf(render({ declaration: declaration(), mealRegistered: false })), 'Không');
  assert.equal(mealOf(render({ declaration: declaration({ mealRegistered: false }), mealRegistered: true })), 'Có');
  assert.equal(mealOf(render({ declaration: declaration({ mealRegistered: null }) })), 'Có');
  assert.equal(mealOf(render({ declaration: declaration(), mealRegistered: null })), 'Có');
});

test('một bảng: dòng Thông tin khác nằm sau các dòng tiền sử, cùng thứ tự với form', () => {
  const html = render({ declaration: declaration(), sheet: true });
  assert.ok(html.indexOf('Thông tin khác') > html.indexOf('Tiền sử'));
});
