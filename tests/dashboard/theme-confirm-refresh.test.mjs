import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';

const source = await readFile(new URL('../../src/pages/assessment/ThemeEvaluationPage.jsx', import.meta.url), 'utf8');
const stubs = `import React from 'react';
const useState=v=>{const i=globalThis.themeTest.index++; const slots=globalThis.themeTest.slots; if(!(i in slots))slots[i]=v;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];};
const useSchoolYear=()=>({schoolYear:1,schoolYears:[{id:1,label:"2026 – 2027"}]}),AssessmentFormHeading=()=>null;
const useEffect=()=>{},useMemo=f=>f(),useAuth=()=>({user:{id:'teacher'}});
const useToast=()=>({success:m=>globalThis.themeTest.events.push('success'),error:e=>globalThis.themeTest.events.push('error')});
const useLeaveGuard=()=>({leave:f=>f(),modal:{}});
const useThemeClasses=()=>({classes:[{classId:1,name:'TEST class'}],loading:false});
const useThemeList=()=>({themes:[{themeId:2,name:'TEST theme',period:'ENDED',status:globalThis.themeTest.ev.status}],loading:false,reload:async()=>{globalThis.themeTest.events.push('list');await globalThis.themeTest.list;}});
const useThemeEvaluation=()=>({evaluation:globalThis.themeTest.ev,loading:false,reload:()=>{throw Error('unexpected stale GET');},setEvaluation:v=>{globalThis.themeTest.ev=v;globalThis.themeTest.events.push('detail');}});
const confirmThemeEvaluation=()=>globalThis.themeTest.save,saveThemeEvaluation=()=>globalThis.themeTest.save;
const Breadcrumb=()=>null,ConfirmationModal=()=>null,LeaveConfirmModal=()=>null,EmptyState=()=>null,ErrorState=()=>null,LoadingState=()=>null,Spinner=()=>null,ThemeEvaluationPreviewModal=()=>null;
const CheckCircle2=()=>null,Download=()=>null,Printer=()=>null,Save=()=>null;
const assessmentCrumbs=()=>[],SECTIONS={},themeEvaluationFile=()=>{},downloadXlsx=()=>{},formatDate=x=>x,formatDateTime=x=>x;
`;
const {code}=await transformWithOxc(stubs+source.replace(/^import .*;\r?\n/gm,''),'ThemeEvaluationPage.jsx',{lang:'jsx',jsx:{runtime:'classic'}});
const {default:Page}=await import(`data:text/javascript;base64,${Buffer.from(code.replace('from "react"',`from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`);
const walk=node=>!React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(walk)];
const render=()=>{globalThis.themeTest.index=0;return walk(Page());};

test('confirmation locks inputs while saving, applies response before list reload and waits for list before success', async()=>{
  let saved, listed;
  const initial={canEdit:true,canConfirm:true,status:'DRAFT',period:'ENDED',note:'',goals:[],rows:[]};
  globalThis.themeTest={index:0,slots:[],events:[],ev:initial,save:new Promise(r=>{saved=r;}),list:new Promise(r=>{listed=r;})};
  try {
    const nodes=render();
    const modal=nodes.find(n=>n.props.title==='Xác nhận đánh giá cuối chủ đề?');
    const pending=modal.props.onConfirm();
    assert.equal(render().find(n=>n.type==='textarea').props.disabled,true);
    saved({...initial,status:'CONFIRMED',canEdit:false,canConfirm:false,confirmedAt:'2026-11-05T09:00:00Z'});
    await new Promise(r=>setImmediate(r));
    assert.deepEqual(globalThis.themeTest.events,['detail','list']);
    assert.equal(render().some(n=>n.type==='textarea'),false);
    assert.ok(render().some(n=>n.type==='span'&&n.props.children==='Đã xác nhận'));
    listed();await pending;
    assert.deepEqual(globalThis.themeTest.events,['detail','list','success']);
  } finally {delete globalThis.themeTest;}
});
