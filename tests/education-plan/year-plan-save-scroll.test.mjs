import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../src/hooks/education-plan/useYearPlanAutosave.js', import.meta.url), 'utf8');
const isolated = source.replace(/^import [\s\S]*? from '[^']+';\r?\n/gm, '');
const stubs = `
import { createSaveQueue, reconcileYearPlanIds, yearPlanContentKey } from ${JSON.stringify(import.meta.resolve('../../src/models/education-plan/yearPlanAutosave.mjs'))};
export const hooks = { refs: [], index: 0, layouts: [] };
const useRef = (value) => hooks.refs[hooks.index++] ||= { current: value };
const useState = (value) => [typeof value === 'function' ? value() : value, () => {}];
const useEffect = () => {};
const useLayoutEffect = (effect) => hooks.layouts.push(effect);
const findYearPlanDrafts = () => [];
const removeYearPlanRecovery = () => {};
const pruneYearPlanDrafts = () => {};
const storeYearPlanRecovery = () => {};
`;
const { useYearPlanAutosave, hooks } = await import(`data:text/javascript;base64,${Buffer.from(stubs + isolated).toString('base64')}`);

test('lưu thay ID dòng vẫn giữ vị trí trang và cuộn ngang tại lúc nhận phản hồi', async () => {
  const previousDocument = globalThis.document;
  const previousOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine');
  const page = { scrollTop: 1000, scrollLeft: 0 };
  const table = { scrollTop: 0, scrollLeft: 120 };
  globalThis.document = { scrollingElement: page, querySelectorAll: () => [table] };
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  try {
    for (const fails of [false, true]) {
      hooks.refs = [];
      let doc = { id: '1', title: 'Kế hoạch', domains: [{ name: 'Thể chất', rows: [{ id: 'temp', text: 'kn1.10', contents: [] }] }] };
      let respond;
      const render = () => {
        hooks.index = 0;
        const saver = useYearPlanAutosave({
          doc,
          enabled: true,
          mayBackup: false,
          userId: 'u',
          planKey: '1',
          save: () =>
            new Promise((resolve, reject) => {
              respond = { resolve, reject };
            }),
          setDoc: (saved) => {
            doc = saved;
            // Mô phỏng bảng dựng lại sau khi ID tạm được thay bằng ID server.
            page.scrollTop = 100;
            table.scrollLeft = 0;
          },
        });
        hooks.layouts.splice(0).forEach((effect) => effect());
        return saver;
      };
      render().markClean(doc);
      doc = { ...doc, title: 'Đã nhập thêm' };
      const saving = render().save();
      // Người dùng tiếp tục cuộn trong lúc đang chờ server.
      page.scrollTop = 2400;
      table.scrollLeft = 300;
      if (fails) respond.reject(new Error('Mất mạng'));
      else respond.resolve({ ...doc, domains: [{ name: 'Thể chất', rows: [{ id: '42', text: 'kn1.10', contents: [] }] }] });
      assert.equal(await saving, !fails);
      render();
      assert.equal(page.scrollTop, 2400);
      assert.equal(table.scrollLeft, 300);
      assert.equal(doc.domains[0].rows[0].id, fails ? 'temp' : '42');
      page.scrollTop = 2600;
      render();
      assert.equal(page.scrollTop, 2600, 'không kéo về vị trí cũ ở lần render tiếp theo');
    }
  } finally {
    globalThis.document = previousDocument;
    if (previousOnline) Object.defineProperty(navigator, 'onLine', previousOnline);
    else delete navigator.onLine;
  }
});
