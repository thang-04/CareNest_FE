import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transformWithOxc } from 'vite';

const source = await readFile(new URL('../../src/components/account/useActivationCode.jsx', import.meta.url), 'utf8');
const stubs = `import React from ${JSON.stringify(import.meta.resolve('react'))};
let state=[], cursor=0, pending={current:false};
const useState=(initial)=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>{state[i]=v}]};
const useRef=()=>pending;
const useAuth=()=>({user:{id:'test'}});
const useToast=()=>globalThis.__activationToast;
const resendActivationCode=(id,user)=>globalThis.__activationSend(id,user);
const ConfirmationModal=()=>null;
export const reset=()=>{state=[];pending={current:false}};
export const render=()=>{cursor=0;return useActivationCode()};
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm,''), 'activation.jsx', {lang:'jsx',jsx:{runtime:'classic'}});
const hook = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('resending waits for confirmation; failed SMS exposes no activation slip or code', async () => {
  hook.reset();
  const sent=[], messages=[];
  globalThis.__activationToast={success:(...a)=>messages.push(['success',...a]),warning:(...a)=>messages.push(['warning',...a]),error:(...a)=>messages.push(['error',...a])};
  globalThis.__activationSend=async(id)=>{sent.push(id);return {username:'test',smsStatus:'FAILED',activationCode:'must-not-render'}};
  let result=hook.render();
  result.resend('parent');
  assert.equal(sent.length,0);
  result=hook.render();
  assert.equal(result.dialog.props.title,'Gửi lại mã kích hoạt?');
  await result.dialog.props.onConfirm();
  assert.deepEqual(sent,['parent']);
  assert.equal(messages[0][0],'warning');
  assert.equal(hook.render().dialog,false);
  assert.doesNotMatch(JSON.stringify(messages),/must-not-render/);
});
