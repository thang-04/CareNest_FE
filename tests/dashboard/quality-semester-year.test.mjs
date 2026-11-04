import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { monthInSemester, semestersOf } from '@/utils/semesters';

globalThis.qualitySemesterFns = { monthInSemester, semestersOf };
const source = await readFile(new URL('../../src/pages/assessment/QualityReportPage.jsx', import.meta.url), 'utf8');
const stubs = `import React from ${JSON.stringify(import.meta.resolve('react'))};
const useState=v=>{const i=globalThis.qualityStateIndex++;return [i===0?'year':i===3?'S1':i===4?globalThis.qualityOldSemester:typeof v==='function'?v():v,()=>{}];};
const useAuth=()=>({user:{role:'PRINCIPAL'}}),isLeader=()=>true,useSchoolYear=()=>globalThis.qualityYearFixture;
const useQualityReport=()=>({report:{months:['2027-09','2027-10','2028-02'],rows:[{classId:'test',className:'TEST class',avgPresentByMonth:{'2027-09':3,'2027-10':4}}],totals:[],campuses:[]},loading:false}),useProgramCompletion=()=>({});
const Breadcrumb=()=>null,EmptyState=()=>null,ErrorState=()=>null,SkeletonRows=()=>null,Tabs=()=>null,Download=()=>null,SemesterSelect=()=>null;
const assessmentCrumbs=()=>[],SECTIONS={},downloadXlsx=(rows)=>{globalThis.qualityExport=rows;};
const {monthInSemester,semestersOf}=globalThis.qualitySemesterFns;
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import[\s\S]*?;\r?\n/gm, ''), 'QualityReportPage.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { default: QualityReportPage } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const walk = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(walk)]);

test('đổi năm học dùng mốc học kỳ năm mới cho cả bảng và Excel', () => {
  globalThis.qualityStateIndex = 0;
  globalThis.qualityOldSemester = { start: '2026-09-01', end: '2027-01-15', key: 'S1' };
  globalThis.qualityYearFixture = {
    schoolYear: 'new',
    schoolYears: [{ id: 'new', startDate: '2027-09-01', endDate: '2028-05-31', semester1Start: '2027-09-01', semester1End: '2028-01-15' }],
  };
  const tree = QualityReportPage();
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Tháng 9\/2027/);
  assert.match(html, /Tháng 10\/2027/);
  assert.doesNotMatch(html, /Tháng 2\/2028/);
  walk(tree)
    .find((n) => n.type === 'button' && React.Children.toArray(n.props.children).includes(' Xuất Excel'))
    .props.onClick();
  assert.deepEqual(globalThis.qualityExport[1], ['Lớp', 'Tháng 9/2027', 'Tháng 10/2027']);
});
