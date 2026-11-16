import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '../../src/models/children/childrenConstants.js';
import { CAMPAIGN_KIND } from '../../src/models/children/healthCheckConstants.js';

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

const { MeasurementSummary } = await loadView(
  'components/children/MeasurementSummary.jsx',
  `
const MEASUREMENT_SOURCE=${JSON.stringify(MEASUREMENT_SOURCE)}, MEASUREMENT_SOURCE_LABELS=${JSON.stringify(MEASUREMENT_SOURCE_LABELS)};
const CAMPAIGN_KIND=${JSON.stringify(CAMPAIGN_KIND)};
const formatNumber=(v)=>v ?? '—', formatSigned=(v)=>v ?? '—';
const BmiStatusBadge=()=>null, ConclusionCategoryBadge=()=>null, FollowUpLevelBadge=()=>null, HeadCircumferenceBadge=()=>null, MotorResultBadge=()=>null;
const ISSUE_KIND_LABELS={}, NUTRITION_STATUS_OPTIONS=[], conclusionActionLabelOf=()=>'', conclusionLabelOf=()=>'', labelOf=()=>'';
const Link=({to,children})=><a href={to}>{children}</a>;
const ChildInfoTable=({rows})=><table><tbody>{rows.filter(Boolean).map((r)=><tr key={r.label}><th>{r.label}</th><td>{r.value}</td></tr>)}</tbody></table>;
`,
);

const measurement = {
  id: 'measurement-test',
  date: '2026-11-01',
  heightCm: 100,
  weightKg: 16,
  bmi: 16,
  headCircumferenceCm: 49,
  headCircumferenceStatus: 'NORMAL',
};
const summary = (overrides) =>
  renderToStaticMarkup(React.createElement(MeasurementSummary, { measurement: { ...measurement, ...overrides } }));

test('kết quả kỳ cân đo không hiện vòng đầu kể cả dữ liệu cũ còn số đo', () => {
  for (const source of Object.values(MEASUREMENT_SOURCE)) {
    const html = summary({ source, campaignKind: CAMPAIGN_KIND.MEASUREMENT });
    assert.doesNotMatch(html, /Vòng đầu/);
    assert.match(html, /Chiều cao \(cm\)/);
    assert.match(html, /Cân nặng \(kg\)/);
    assert.match(html, /BMI/);
  }
  assert.doesNotMatch(summary({ source: MEASUREMENT_SOURCE.MEASUREMENT_ONLY }), /Vòng đầu/);
});

test('phiếu khám và mẫu cũ ngoài kỳ cân đo vẫn hiện vòng đầu khi có số', () => {
  const exam = { nutrition: { statuses: [] }, conclusion: {} };
  assert.match(summary({ source: MEASUREMENT_SOURCE.EXAM, campaignKind: CAMPAIGN_KIND.EXAM, exam }), /Vòng đầu \(cm\)/);
  assert.match(summary({ source: MEASUREMENT_SOURCE.LEGACY }), /Vòng đầu \(cm\)/);
  assert.doesNotMatch(summary({ source: MEASUREMENT_SOURCE.EXAM, exam, headCircumferenceCm: null }), /Vòng đầu/);
});

const { default: HealthTrendPage, context } = await loadView(
  'pages/children/HealthTrendPage.jsx',
  `
export const context={view:'chart',measurement:${JSON.stringify(measurement)}};
const {useEffect,useMemo,useRef}=React, useState=(v)=>React.useState(v==='chart' ? context.view : v);
const child={id:'child-test',fullName:'Trẻ minh họa',code:'TEST',status:'ACTIVE',className:'Lớp thử'};
const useAuth=()=>({user:{}}), useSchoolYear=()=>({schoolYear:'2026 – 2027'});
const useSearchParams=()=>[new URLSearchParams('childId=child-test'),()=>{}];
const useMasterData=()=>({campuses:[]}), useChildRecords=()=>({children:[child],loading:false});
const useHealthRecord=()=>({record:{child,measurements:[context.measurement]},loading:false});
const CHILD_STATUS={ACTIVE:'ACTIVE'}, isPrincipal=()=>false, isVicePrincipal=()=>false, canReviewHealthTrend=()=>false;
const sortByName=(v)=>v, suggestAgeGroupId=()=>'', growthAxesFor=()=>({}), ageGroupById=()=>null;
const TREND_PERIODS=[{key:'ALL',label:'Toàn bộ'}], withinTrendPeriod=(items)=>items;
const useClassOptions=()=>({year:null,ageGroups:[]}), ageGroupIn=()=>null;
const NUTRITION_STATUS={NORMAL:'NORMAL'}, NUTRITION_STATUS_OPTIONS=[], labelOf=()=>'';
const formatDate=(v)=>v, formatNumber=(v)=>v ?? '—', childrenCrumbs=()=>[];
const GrowthChart=({title,points})=><figure><figcaption>{title}</figcaption><span>{points.map(p=>p.value).join(',')}</span></figure>;
const Link=({to,children,...props})=><a href={to} {...props}>{children}</a>;
const Breadcrumb=()=>null, TrendChildList=()=>null, AiTrendPanel=()=>null, HealthWarningCell=()=>null, ChildAccessState=()=>null, ChildAvatar=()=>null;
const EmptyState=()=>null, LoadingState=()=>null;
const Tabs=({items})=>React.createElement('div',{role:'tablist'},items.map((t)=>React.createElement('button',{key:t.key,role:'tab'},t.label)));
const LineChart=()=>null, HeartPulse=()=>null, ArrowLeft=()=>null, ChevronLeft=()=>null, ChevronRight=()=>null;
`,
);

test('xu hướng chỉ có biểu đồ chiều cao, cân nặng dù kết quả có vòng đầu', () => {
  context.view = 'chart';
  const html = renderToStaticMarkup(React.createElement(HealthTrendPage));
  assert.equal((html.match(/<figure>/g) || []).length, 2);
  assert.match(html, /<figcaption>Chiều cao<\/figcaption>/);
  assert.match(html, /<figcaption>Cân nặng<\/figcaption>/);
  assert.doesNotMatch(html, /[Vv]òng đầu/);
});

test('bảng xu hướng bỏ cột vòng đầu, giữ ngày đo, chiều cao, cân nặng, BMI, cảnh báo', () => {
  context.view = 'table';
  const html = renderToStaticMarkup(React.createElement(HealthTrendPage));
  assert.doesNotMatch(html, /[Vv]òng đầu/);
  assert.equal((html.match(/<th[ >]/g) || []).length, 5);
  assert.equal((html.match(/<td[ >]/g) || []).length, 5);
  for (const label of ['Ngày đo', 'Chiều cao (cm)', 'Cân nặng (kg)', 'BMI', 'Cảnh báo']) assert.ok(html.includes(label));
});
