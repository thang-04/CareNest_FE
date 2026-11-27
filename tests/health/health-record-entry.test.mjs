import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

const source = await readFile(new URL('../../src/pages/children/ChildHealthRecordPage.jsx', import.meta.url), 'utf8');
const stubs = `import React, { useMemo, useState } from 'react';
const useParams=()=>({id:'entry_child'}), useAuth=()=>({user:{}}), useChildYearLock=()=>false;
const useHealthRecord=()=>({record:globalThis.__entryRecord,loading:false,error:null});
const useHealthCheckClass=()=>globalThis.__entryRoster;
const canRecordMeasurement=()=>true, canEditMeasurement=()=>true;
const CAMPAIGN_KIND={MEASUREMENT:'MEASUREMENT',EXAM:'EXAM'}, CAMPAIGN_KIND_LABELS={};
const EXAM_STATUS={DRAFT:'DRAFT',CONCLUDED:'CONCLUDED'}, MEASUREMENT_SOURCE={EXAM:'EXAM'}, MEASUREMENT_SOURCE_LABELS={};
const ABSENT_TODAY_HINT='absent today';
const childCrumb=()=>null,childrenCrumbs=()=>[],formatDate=()=>'',formatDateTime=()=>'',formatAgeMonths=()=>'',hasHealthWarning=()=>false;
const Link=({to,children})=><a href={to}>{children}</a>;
const Button=({children,disabledReason})=><button disabled={!!disabledReason} title={disabledReason}>{children}</button>;
const ErrorState=({onRetry})=>{globalThis.__entryRetry=onRetry;return <div role="alert">Roster unavailable<button onClick={onRetry}>Retry</button></div>};
const EmptyState=({action})=><div>{action}</div>;
const Plus=()=>null,LineChart=()=>null,History=()=>null,ArrowLeft=()=>null,HeartPulse=()=>null,RotateCcw=()=>null,Stethoscope=()=>null;
const YearLockedNotice=()=>null,Breadcrumb=()=>null,Modal=()=>null,LoadingState=()=>null,RowActions=()=>null,HealthWarningCell=()=>null,MeasurementDetailModal=()=>null,ExamDetailModal=()=>null,ChildAccessState=()=>null,BmiStatusBadge=()=>null,ConclusionCategoryBadge=()=>null,FollowUpLevelBadge=()=>null;
`;
const { code } = await transformWithOxc(
  stubs + source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '').replace(/^import '[^']+';\r?\n/gm, ''),
  'ChildHealthRecordPage.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' } },
);
const { default: Page } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
const retry = () => {};
const render = (kind, rosterState) => {
  globalThis.__entryRecord = {
    child: { id: 'entry_child', classId: 'entry_class', fullName: 'Trẻ kiểm thử' },
    measurements: [],
    openCampaign: { id: 'entry_campaign', kind, resultStatus: 'DRAFT' },
  };
  globalThis.__entryRoster = { reload: retry, ...rosterState };
  return renderToStaticMarkup(React.createElement(Page));
};
const loaded = { children: [{ childId: 'entry_child', absentToday: false }] };
for (const kind of ['MEASUREMENT', 'EXAM']) {
  test(`${kind}: entry stays locked while roster loads or fails and retry is available`, () => {
    for (const state of [
      { loading: true, roster: null },
      { loading: false, roster: null },
      { loading: false, roster: loaded, error: new Error('network') },
    ]) {
      const html = render(kind, state);
      assert.match(html, /<button disabled=""/);
      assert.doesNotMatch(html, /href="[^"]*(?:health\/new|\/exam\/)/);
      assert.match(html, /href="\/children\/health-trends/);
      if (state.error) {
        assert.match(html, /role="alert"/);
        assert.equal(globalThis.__entryRetry, retry);
      }
    }
  });
  test(`${kind}: successful roster enables entry only for a present row`, () => {
    assert.match(render(kind, { roster: loaded }), /href="[^"]*(?:health\/new|\/exam\/)/);
    for (const children of [[], [{ childId: 'entry_child', absentToday: true }]]) {
      assert.doesNotMatch(render(kind, { roster: { children } }), /href="[^"]*(?:health\/new|\/exam\/)/);
    }
  });
}
