#!/usr/bin/env node
// Render tranh nguồn (HTML) thành PNG nền trong suốt bằng Chrome headless (không cần thư viện ngoài).
// Dùng: node mockups/illustrations/render.mjs <file.html> <out.png> <width> <height> [scale]
// Sau đó nén WebP: python -c "from PIL import Image; Image.open('out.png').save('out.webp', quality=82, method=6)"
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [input, output, w, h, scaleArg] = process.argv.slice(2);
const width = Number(w);
const height = Number(h);
const scale = Number(scaleArg) || 2;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9341;

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cn-render-'))}`,
  '--no-first-run',
  '--disable-extensions',
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 120 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === 'page' && t.url === 'about:blank');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch {
    /* Chrome chưa sẵn sàng */
  }
  if (!ws) await sleep(250);
}
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

await send('Page.enable');
// Phóng chính SVG thay vì deviceScaleFactor (DPR 2 + filter nặng làm Chrome treo)
await send('Emulation.setDeviceMetricsOverride', { width: width * scale, height: height * scale, deviceScaleFactor: 1, mobile: false });
await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
await send('Page.navigate', { url: pathToFileURL(resolve(input)).href });
await sleep(1500);
await send('Runtime.evaluate', {
  expression: `(() => { const s = document.querySelector('svg'); s.setAttribute('width', ${width * scale}); s.setAttribute('height', ${height * scale}); })()`,
});
await sleep(4000); // chờ font + filter
const { result } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: width * scale, height: height * scale, scale: 1 } });
writeFileSync(output, Buffer.from(result.data, 'base64'));
ws.close();
chrome.kill();
console.log('rendered', output);
process.exit(0);
