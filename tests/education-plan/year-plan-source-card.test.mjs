import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const source = await readFile(new URL('../../src/components/education-plan/YearPlanSourceCard.jsx', import.meta.url), 'utf8');
const stubs = `import React from ${JSON.stringify(import.meta.resolve('react'))};
import {planRoute} from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/planLevel.mjs'))};
const Link=({to,children})=><a href={to}>{children}</a>;
const Card=({title,className,children})=><section className={className}><h2>{title}</h2>{children}</section>;
const Notice=({children})=><p>{children}</p>;`;
const transformed = await transformWithOxc(stubs + source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''), 'YearPlanSourceCard.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { default: YearPlanSourceCard } = await import('data:text/javascript;base64,' + Buffer.from(transformed.code).toString('base64'));
const render = (props) => renderToStaticMarkup(React.createElement(YearPlanSourceCard, props));

test('source card links the exact inherited annual ID and displays its own title and version', () => {
  const html = render({ plan: { curriculumSourcePlanId: '41' }, source: { id: '41', title: 'Nguồn <năm học>', versionNo: 2 } });
  assert.match(html, /href="\/education\/school-year-plans\/41"/);
  assert.match(html, /Nguồn &lt;năm học&gt;/);
  assert.match(html, /Phiên bản nguồn/);
  assert.match(html, /class="ga-info-emphasis">2</);
});

test('missing loaded source metadata still links the inherited ID without inventing a version', () => {
  const html = render({ plan: { curriculumSourcePlanId: 41 } });
  assert.match(html, /href="\/education\/school-year-plans\/41"/);
  assert.match(html, /Xem kế hoạch năm học nguồn/);
  assert.doesNotMatch(html, /Phiên bản nguồn/);
});

test('legacy plans and the unselected creation form have distinct source messages', () => {
  assert.match(render({ plan: {} }), /Kế hoạch giáo dục tổ cũ chưa liên kết/);
  const html = render({ plan: {}, children: React.createElement('select', { id: 'annual-source' }) });
  assert.match(html, /id="annual-source"/);
  assert.doesNotMatch(html, /Kế hoạch giáo dục tổ cũ|href=/);
});
