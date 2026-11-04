import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { Route } from 'react-router-dom';

const { lazyPage, prefetchPath, registerRouteTree, isPageLoading } = await import('@/routes/routePrefetch');

const Guard = ({ children }) => children;

test('lazyPage: tải trước gọi import một lần, dùng lại cho các lần sau; tải trước không bật "đang mở trang"', async () => {
  let calls = 0;
  const Page = lazyPage(async () => {
    calls += 1;
    return { default: () => null };
  });
  const [a, b] = [Page.preload(), Page.preload()];
  assert.equal(a, b);
  await a;
  assert.equal(calls, 1);
  assert.equal(isPageLoading(), false);
});

test('lazyPage: import lỗi thì lần tải trước sau thử lại', async () => {
  let calls = 0;
  const Page = lazyPage(async () => {
    calls += 1;
    if (calls === 1) throw new Error('mạng lỗi');
    return { default: () => null };
  });
  await assert.rejects(Page.preload());
  await Page.preload();
  assert.equal(calls, 2);
});

test('prefetchPath: tìm trang theo đường dẫn menu (kể cả route lồng, trang bọc trong guard) và chỉ tải trang khớp', async () => {
  const loaded = [];
  const page = (name) => lazyPage(async () => (loaded.push(name), { default: () => null }));
  const Foods = page('foods');
  const FoodDetail = page('food-detail');
  const Dishes = page('dishes');
  registerRouteTree(() => [
    createElement(
      Route,
      { key: 'menu', path: 'menu' },
      createElement(Route, { key: 'f', path: 'foods', element: createElement(Guard, null, createElement(Foods)) }),
      createElement(Route, { key: 'fd', path: 'foods/:id', element: createElement(FoodDetail) }),
      createElement(Route, { key: 'd', path: 'dishes', element: createElement(Dishes) }),
    ),
  ]);
  prefetchPath('/menu/foods');
  prefetchPath('/menu/foods');
  prefetchPath('/khong-co');
  await Foods.preload();
  assert.deepEqual(loaded, ['foods']);
});
