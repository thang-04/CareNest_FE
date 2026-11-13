import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source = await readFile(new URL('../../src/hooks/education-plan/useEducationPlan.jsx', import.meta.url), 'utf8');
const stubs = `import React,{createContext,useCallback,useContext,useMemo} from ${JSON.stringify(import.meta.resolve('react'))};
export let failure=null; export const setFailure=e=>failure=e;
let retained={goals:[],eduConfig:{}};const effects=[];const useEffect=fn=>effects.push(fn);
export const flushEffects=()=>effects.splice(0).forEach(fn=>fn());
export const setRetained=next=>{retained=next;effects.length=0;};
const useAuth=()=>({user:{id:'test',role:'TEACHER',fullName:'Người thử'}}),useToast=()=>({}),useSchoolYear=()=>({schoolYear:1,schoolYears:[{id:1,label:'2098 - 2099'}],setSchoolYear:()=>{}});
const useAsync=()=>({data:retained,loading:false,error:failure,setData:next=>{retained=next;},reload:()=>{}});
const service=new Proxy({},{get:()=>()=>{}}),ROLES={TEACHER:'TEACHER',TEAM_LEADER:'TEAM_LEADER'},ROLE_LABELS={},AGE_GROUPS=[],CLASSES=[],EDU_STATUS={};
const withDefaults=x=>x,applyEduConfig=()=>{},toEduYear=x=>x,fromEduYear=x=>x;
const LoadingState=()=>null,ErrorState=()=> <p>ACCESS ERROR</p>;`;
const transformed = await transformWithOxc(stubs + source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, ''), 'Provider.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { EducationPlanProvider, useEducationPlan, setFailure, setRetained, flushEffects } = await import(
  'data:text/javascript;base64,' + Buffer.from(transformed.code).toString('base64')
);
test('403 from a re-read masks retained plan data instead of rendering stale content', () => {
  setFailure({ status: 403 });
  const html = renderToStaticMarkup(React.createElement(EducationPlanProvider, null, 'SENSITIVE-OLD-CONTENT'));
  assert.match(html, /ACCESS ERROR/);
  assert.doesNotMatch(html, /SENSITIVE-OLD-CONTENT/);
});
test('transient refresh failure retains the existing non-denied rendering behavior', () => {
  setFailure({ status: 500 });
  assert.match(renderToStaticMarkup(React.createElement(EducationPlanProvider, null, 'OLD-CONTENT')), /OLD-CONTENT/);
});

test('403 clears retained plans before retry and later500, authorized success can render new data', () => {
  const Content = () =>
    React.createElement(
      'p',
      null,
      useEducationPlan()
        .goals.map((g) => g.title)
        .join(','),
    );
  const render = () => renderToStaticMarkup(React.createElement(EducationPlanProvider, null, React.createElement(Content)));
  setRetained({ goals: [{ id: 'old', title: 'DENIED OLD PLAN' }], eduConfig: {} });
  setFailure({ status: 403 });
  assert.doesNotMatch(render(), /DENIED OLD PLAN/);
  flushEffects();
  setFailure(null);
  assert.doesNotMatch(render(), /DENIED OLD PLAN/);
  flushEffects();
  setFailure({ status: 500 });
  assert.doesNotMatch(render(), /DENIED OLD PLAN/);
  flushEffects();
  setRetained({ goals: [{ id: 'new', title: 'AUTHORIZED NEW PLAN' }], eduConfig: {} });
  setFailure(null);
  assert.match(render(), /AUTHORIZED NEW PLAN/);
});
