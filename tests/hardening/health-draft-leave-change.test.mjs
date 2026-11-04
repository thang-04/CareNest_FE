import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {transformWithOxc} from 'vite';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';

const source=await readFile(new URL('../../src/components/DailyHealthPanel.jsx',import.meta.url),'utf8');
const stubs=`import React from 'react';
const useState=v=>[typeof v==='function'?globalThis.healthDraftFixture:v,()=>{}],useEffect=()=>{},useRef=v=>({current:v});
const Link=({to,children})=>React.createElement('a',{href:to},children),useToast=()=>({});
const FormField=({children,label})=>React.createElement('label',{},label,children);
const HeartPulse=()=>null,Save=()=>null,ArrowRight=()=>null,Clock=()=>null,CheckCircle2=()=>null,Phone=()=>null,ChevronDown=()=>null,ChevronUp=()=>null;
const EmptyState=()=>null,ErrorState=()=>null,LoadingState=()=>null,SubmitOverlay=()=>null,TemperatureBadge=()=>null,ChildAvatar=()=>null,HealthObservationBadge=()=>null,ParentNotifyBadge=()=>null,ParentNotifyShortBadge=()=>null,ConfirmationModal=()=>null;
const useAsync=()=>({data:{entries:[],contacts:[],canRecord:false},loading:false,error:null,reload:()=>{}});
const getDailyHealth=()=>{},notifyDailyHealth=()=>{},PARENT_NOTIFY_ENABLED=false,HEALTH_ACTIONS={},HEALTH_SYMPTOMS={},actionSummary=()=>'',validateDailyHealth=()=>({}),temperatureLevel=()=>null,formatDateTime=x=>x;
`;
const {code}=await transformWithOxc(stubs+source.replace(/^import .*;\r?\n/gm,''),'DailyHealthPanel.jsx',{lang:'jsx',jsx:{runtime:'classic'}});
const {DailyHealthPanel}=await import(`data:text/javascript;base64,${Buffer.from(code.replace('from "react"',`from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`);
const props={child:{id:'test',fullName:'TEST child'},classId:'A',date:'2026-11-04',user:{id:'teacher'},presentSaved:false,canDraft:true,attendanceDirty:true,onDirty:()=>{},onBusy:()=>{},onNext:()=>{}};
const walk=node=>!React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(walk)];
test('đơn nghỉ đến vẫn hiện nội dung sức khỏe chưa lưu, khóa nhập và có cách bỏ nháp',async()=>{
  globalThis.healthDraftFixture={temperature:'36.8',observation:'NO_CONCERN',symptoms:[],note:'TEST observation kept',actions:[],referral:{place:'',time:'',escort:''}};
  let saves=0;
  try{
    const tree=DailyHealthPanel({...props,presentDraft:false,onSave:()=>{saves++;}});
    const html=renderToStaticMarkup(tree);
    assert.match(html,/TEST observation kept/);
    assert.match(html,/chưa thể lưu khi trẻ vắng/);
    assert.match(html,/Bỏ nội dung sức khỏe đang soạn/);
    assert.match(html,/<fieldset[^>]*disabled/);
    await walk(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
    assert.equal(saves,0);
  }finally{delete globalThis.healthDraftFixture;}
});
test('khi có mặt lại hợp lệ, nháp sức khỏe vẫn còn và form được mở',()=>{
  globalThis.healthDraftFixture={temperature:'36.8',observation:'NO_CONCERN',symptoms:[],note:'TEST observation kept',actions:[],referral:{place:'',time:'',escort:''}};
  try{
    const html=renderToStaticMarkup(DailyHealthPanel({...props,presentDraft:true,onSave:()=>{}}));
    assert.match(html,/TEST observation kept/);
    assert.doesNotMatch(html,/<fieldset[^>]*disabled/);
    assert.doesNotMatch(html,/Bỏ nội dung sức khỏe đang soạn/);
  }finally{delete globalThis.healthDraftFixture;}
});
