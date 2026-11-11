import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { chromium } = require('@playwright/test');
const html = `<!doctype html><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {GoalTable,ThemeEventTable} from '/src/components/education-plan/GoalTables.jsx';
import '/src/styles/index.css';import '/src/styles/modules/education-plan.css';
const themes=[{id:'t',name:'Chủ đề kiểm thử',abbr:'CD',start:'2026-09-07',end:'2026-09-18'}];
const domains=[{id:'d',name:'Phát triển thể chất',rows:[{id:'group',kind:'group',text:'Nhóm kết quả'},...Array.from({length:50},(_,i)=>({id:'g'+i,kind:'goal',text:'Mục tiêu đầy đủ '+i,contents:[{id:'c'+i,text:'Nội dung đã tick '+i,themes:['t']},{id:'u'+i,text:'Nội dung chưa tick '+i,themes:[]}]}))]}];
const props={themes,breaks:[{id:'break',label:'Nghỉ kiểm thử',start:'2026-09-21',end:'2026-09-25'}],domains,numbers:Object.fromEntries(Array.from({length:50},(_,i)=>['g'+i,i+1])),branchTemplates:[{id:'b',themeId:'t',name:'Nhánh nguồn',startDate:'2026-09-07',endDate:'2026-09-11'}],readOnly:true};
function Preview(){const [data,setData]=React.useState(()=>JSON.parse(localStorage.getItem('013-ui-draft')||'null')||domains);return React.createElement('div',null,React.createElement('main',{className:'ga-team-plan ga-year-page'},React.createElement(GoalTable,{...props,domains:data,fixedCells:true,canAssignContents:true,onChange:setData}),React.createElement(ThemeEventTable,{...props,domains:data,fixedFields:true}),React.createElement('button',{id:'save-ui',onClick:()=>localStorage.setItem('013-ui-draft',JSON.stringify(data))},'Lưu kiểm thử')),React.createElement('aside',{className:'ga-annual-plan'},React.createElement(ThemeEventTable,{...props,hideGoals:true,readOnly:false})));}createRoot(document.getElementById('root')).render(React.createElement(Preview));
</script>`;
const server = await createServer({
  server: { port: 0, host: '127.0.0.1' },
  plugins: [
    {
      name: 'ui-fixture',
      configureServer(s) {
        s.middlewares.use('/__feature013__', async (req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(await s.transformIndexHtml('/__feature013__', html));
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE', m.text());
  });
  await page.goto('http://127.0.0.1:' + port + '/__feature013__');
  await page.waitForSelector('select');
  for (const width of [1440, 698, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const dateOverflow = await page.locator('.ga-branch-date-range').evaluateAll((ranges) =>
      ranges.flatMap((range) => {
        const cell = range.closest('td').getBoundingClientRect();
        const walker = document.createTreeWalker(range, NodeFilter.SHOW_TEXT);
        const overflow = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const text = document.createRange();
          text.selectNodeContents(walker.currentNode);
          for (const rect of text.getClientRects()) {
            if (rect.left < cell.left - 1 || rect.right > cell.right + 1) overflow.push(walker.currentNode.textContent);
          }
        }
        return overflow;
      }),
    );
    assert.deepEqual(dateOverflow, [], `date text must stay inside theme/branch columns at ${width}px`);
    const styles = await page
      .locator('.ga-curriculum-fixed thead th')
      .evaluateAll((ns) => ns.slice(0, 4).map((n) => getComputedStyle(n).backgroundColor));
    assert.equal(new Set(styles).size, 1);
    assert.notEqual(styles[0], 'rgba(0, 0, 0, 0)');
    const themeStyles = await page
      .locator('.ga-theme-edit-fixed th,.ga-theme-edit-fixed td')
      .evaluateAll((ns) => ns.map((n) => getComputedStyle(n).backgroundColor));
    assert.equal(new Set(themeStyles).size, 1);
    const overflow = await page
      .locator('.ga-team-plan .table-wrap')
      .evaluateAll((ns) => ns.map((n) => [getComputedStyle(n).overflowX, getComputedStyle(n).overflowY, getComputedStyle(n).maxHeight]));
    assert.ok(overflow.every((x) => x.join() === 'visible,visible,none'));
    await page.getByRole('combobox').selectOption('g49');
    await page.locator('.ga-theme-goal-preview [role=status]').waitFor();
    assert.match(await page.locator('.ga-theme-goal-preview [role=status]').innerText(), /Mục tiêu đầy đủ 49/);
    assert.match(await page.locator('.ga-theme-goal-preview [role=status]').innerText(), /Nội dung đã tick 49/);
    assert.doesNotMatch(await page.locator('.ga-theme-goal-preview [role=status]').innerText(), /chưa tick/);
    assert.equal(await page.locator('.ga-theme-edit-fixed input,.ga-theme-edit-fixed textarea,.ga-theme-edit-fixed button').count(), 0);
    const fullText = await page.locator('.ga-curriculum-fixed').innerText();
    for (let i = 0; i < 50; i++) {
      assert.ok(fullText.includes('Mục tiêu đầy đủ ' + i));
      assert.ok(fullText.includes('Nội dung đã tick ' + i));
      assert.ok(fullText.includes('Nội dung chưa tick ' + i));
    }
    await page.getByRole('combobox').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.ok((await page.locator('.ga-annual-plan textarea').count()) > 0);
    assert.equal(await page.locator('.ga-annual-plan select').count(), 0);
    console.log(
      'PASS real CSS/component viewport ' +
        width +
        ': gray headers/table, branches, select detail/ticks, page scroll, 50 goals/100 contents',
    );
  }
  await page.getByRole('combobox').selectOption('g49');
  const tick = page.locator('.ga-curriculum-fixed button.ga-theme-tick').last();
  await tick.focus();
  await page.keyboard.press('Space');
  assert.equal(await tick.getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('.ga-theme-goal-preview [role=status]').innerText(), /Nội dung chưa tick 49/);
  await page.locator('#save-ui').click();
  await page.reload();
  await page.waitForSelector('select');
  await page.getByRole('combobox').selectOption('g49');
  assert.match(await page.locator('.ga-theme-goal-preview [role=status]').innerText(), /Nội dung chưa tick 49/);
  console.log('PASS keyboard tick -> local draft save/reopen; annual editable inputs preserved; selection reveals ticked content only');
} finally {
  await browser?.close();
  await server.close();
}
