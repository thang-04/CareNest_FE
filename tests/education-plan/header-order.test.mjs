import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as espree from 'espree';

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
const hasClass = (node, name) =>
  node.type === 'JSXElement' &&
  node.openingElement.attributes.some((attr) => attr.name?.name === 'className' && attr.value?.value?.split(' ').includes(name));
const containsToolbar = (node) => {
  let found = false;
  walk(node, (child) => {
    if (hasClass(child, 'ga-year-toolbar')) found = true;
  });
  return found;
};

test('EDU-92: thanh thao tác đứng trước bộ lọc/tab trong DOM ở mọi khung giáo dục có toolbar', async () => {
  const dir = new URL('../../src/pages/education-plan/', import.meta.url);
  let checked = 0;
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.jsx'))) {
    const source = await readFile(new URL(file, dir), 'utf8');
    assert.doesNotMatch(source, /ga-year-toolbar__title/, `${file}: không hiện thêm tên tài liệu trong thanh thao tác khi cuộn`);
    if (file === 'OverduePlansPage.jsx')
      assert.doesNotMatch(source, /ga-year-toolbar|ResponsiveToolbar/, 'Mở hạn không có header thao tác riêng');
    const ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } });
    walk(ast, (node) => {
      if (!hasClass(node, 'ga-sticky-head')) return;
      const children = node.children.filter(
        (child) => child.type !== 'JSXText' && !(child.type === 'JSXExpressionContainer' && child.expression.type === 'JSXEmptyExpression'),
      );
      const toolbar = children.findIndex(
        (child) => containsToolbar(child) || (child.type === 'JSXExpressionContainer' && child.expression.name === 'toolbar'),
      );
      if (toolbar < 0) return;
      const head = children.findIndex((child) => child.type === 'JSXElement' && child.openingElement.name.name === 'PageHead');
      assert.equal(toolbar, head + 1, `${file}: thao tác phải ngay sau khai báo đầu trang, trước bộ lọc/tab`);
      checked += 1;
    });
  }
  assert.ok(checked >= 9, `Đã kiểm ${checked} khung có toolbar, ngoại lệ trang Mở hạn`);
});
