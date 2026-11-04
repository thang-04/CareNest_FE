import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAttendanceRefresh, leaveStateChanged, reconcileAttendanceDraft } from '@/utils/attendance/reconcileAttendance';

const row=(id,status='',leaveRequest=null)=>({child:{id},record:status?{status}:null,leaveRequest});
const sheet=(...children)=>({children});
const draft={a:{childId:'a',status:'PRESENT'},b:{childId:'b',status:'UNEXCUSED'}};

test('đơn mới khóa đúng trẻ, giữ nháp trẻ khác và đồng bộ bản ghi chưa sửa',()=>{
  const old=sheet(row('a'),row('b'),row('c'));
  const fresh=sheet(row('a','EXCUSED',{id:'leave'}),row('b'),row('c','PRESENT'));
  const merged=reconcileAttendanceDraft(draft,old,fresh);
  assert.equal(merged.a.status,'EXCUSED');
  assert.equal(merged.b.status,'UNEXCUSED');
  assert.equal(merged.c.status,'PRESENT');
  assert.equal(leaveStateChanged(old,fresh),true);
});
test('hủy đơn trả trẻ về chưa điểm danh, giữ nháp khác và bỏ trẻ không còn trong sheet',()=>{
  const old=sheet(row('a','EXCUSED',{id:'leave'}),row('b'),row('removed'));
  const fresh=sheet(row('a'),row('b'));
  const merged=reconcileAttendanceDraft({...draft,removed:{childId:'removed',status:'PRESENT'}},old,fresh);
  assert.equal(merged.a.status,'');
  assert.equal(merged.b.status,'UNEXCUSED');
  assert.equal(merged.removed,undefined);
  assert.equal(leaveStateChanged(old,fresh),true);
});
test('lưu một trẻ nhận trạng thái BE; không xóa nháp trẻ còn lại',()=>{
  const old=sheet(row('a'),row('b'));
  const fresh=sheet(row('a','PRESENT'),row('b'));
  const merged=reconcileAttendanceDraft(draft,old,fresh,['a']);
  assert.equal(merged.a.status,'PRESENT');
  assert.equal(merged.b.status,'UNEXCUSED');
});
test('phản hồi nền không ghi đè sau khi bắt đầu lưu hoặc khi đang lưu',async()=>{
  let resolve;let busy=false;const applied=[];
  const sync=createAttendanceRefresh({read:()=>new Promise(r=>{resolve=r;}),busy:()=>busy,apply:x=>applied.push(x)});
  const pending=sync.refresh();sync.invalidate();busy=true;resolve(sheet(row('a')));
  assert.equal(await pending,null);assert.equal(applied.length,0);
  assert.equal(await sync.refresh(),null);
});
test('khôi phục sau lỗi vẫn tải sheet khi cờ đang lưu bật và giữ thông tin trẻ đã lưu',async()=>{
  const applied=[];const fresh=sheet(row('a','EXCUSED',{id:'new'}));
  const sync=createAttendanceRefresh({read:async()=>fresh,busy:()=>true,apply:(s,ids)=>applied.push([s,ids])});
  assert.equal(await sync.refresh({force:true,savedIds:['b']}),fresh);
  assert.deepEqual(applied,[[fresh,['b']]]);
});
test('chỉ phản hồi mới nhất được dùng; đổi lớp/rời màn bỏ phản hồi đang chờ',async()=>{
  const pending=[];const applied=[];
  const sync=createAttendanceRefresh({read:()=>new Promise(r=>pending.push(r)),busy:()=>false,apply:x=>applied.push(x)});
  const a=sync.refresh(),b=sync.refresh();pending[1]('new');await b;pending[0]('old');await a;
  assert.deepEqual(applied,['new']);
  const c=sync.refresh();sync.dispose();pending[2]('unmounted');await c;
  assert.deepEqual(applied,['new']);
});
