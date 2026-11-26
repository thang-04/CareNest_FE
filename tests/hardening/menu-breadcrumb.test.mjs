import assert from 'node:assert/strict';
import { test } from 'node:test';

const { alignCrumbs, menuEntryFor } = await import('@/utils/menuBreadcrumb');

const MENU = [
  { key: 'home', label: 'Trang chủ', to: '/' },
  { key: 'approvals', label: 'Chờ duyệt', to: '/approvals' },
  {
    key: 'children',
    label: 'Quản lý trẻ',
    children: [
      { key: 'childList', label: 'Danh sách trẻ', to: '/children' },
      { key: 'childEnroll', label: 'Tiếp nhận trẻ', to: '/children/new' },
    ],
  },
  {
    key: 'attendance',
    label: 'Điểm danh & suất ăn',
    children: [
      { key: 'attendance', label: 'Điểm danh & báo ăn', to: '/attendance', exact: true },
      { key: 'summary', label: 'Tổng hợp điểm danh', to: '/attendance/summary' },
    ],
  },
  {
    key: 'nutrition',
    label: 'Thực đơn & dinh dưỡng',
    children: [
      { key: 'weekly', label: 'Kế hoạch tuần & công bố', to: '/menu/weekly' },
      { key: 'stats', label: 'Thống kê định lượng', to: '/menu/statistics' },
    ],
  },
  { key: 'kitchenOps', label: 'Vận hành bếp', children: [{ key: 'forecast', label: 'Bản dự trù', to: '/kitchen/forecast' }] },
];
const HOME = { label: 'Trang chủ', to: '/' };
const labels = (items) => items.map((c) => c.label).join(' > ');

test('màn của mục sidebar: breadcrumb dùng đúng tên nhóm và tên mục của sidebar', () => {
  const page = [HOME, { label: 'Thực đơn', to: '/menu' }, { label: 'Thực đơn tuần' }];
  assert.equal(labels(alignCrumbs(page, MENU, '/menu/weekly')), 'Trang chủ > Thực đơn & dinh dưỡng > Kế hoạch tuần & công bố');
  const stats = [
    HOME,
    { label: 'Thực đơn' },
    { label: 'Thực đơn tuần', to: '/menu/weekly' },
    { label: 'Thống kê định lượng · ngày 10/11' },
  ];
  assert.equal(labels(alignCrumbs(stats, MENU, '/menu/statistics')), 'Trang chủ > Thực đơn & dinh dưỡng > Thống kê định lượng');
});

test('trang con giữ cấp con sau crumb trỏ về mục; mục sidebar thành liên kết quay lại', () => {
  const detail = [HOME, { label: 'Hồ sơ trẻ', to: '/children' }, { label: 'Bé An' }, { label: 'Sửa hồ sơ' }];
  const out = alignCrumbs(detail, MENU, '/children/c12/edit');
  assert.equal(labels(out), 'Trang chủ > Quản lý trẻ > Danh sách trẻ > Bé An > Sửa hồ sơ');
  assert.equal(out[2].to, '/children');
  assert.equal(out[1].to, undefined, 'nhóm không có trang riêng nên không là liên kết');
  // Trang con không có crumb trỏ về mục: giữ tên trang hiện tại
  const loose = [HOME, { label: 'Thực đơn' }, { label: 'Tuần 09/11' }];
  assert.equal(
    labels(alignCrumbs(loose, MENU, '/menu/weekly/w1')),
    'Trang chủ > Thực đơn & dinh dưỡng > Kế hoạch tuần & công bố > Tuần 09/11',
  );
});

test('chọn mục có đường dẫn dài nhất, khớp theo ranh giới "/", tôn trọng exact', () => {
  assert.equal(menuEntryFor(MENU, '/children/new').item.key, 'childEnroll');
  assert.equal(menuEntryFor(MENU, '/children/c1').item.key, 'childList');
  assert.equal(menuEntryFor(MENU, '/children-archive'), null);
  assert.equal(menuEntryFor(MENU, '/attendance/summary').item.key, 'summary');
  assert.equal(menuEntryFor(MENU, '/attendance/health'), null, 'mục exact không nhận màn con');
  assert.equal(menuEntryFor(MENU, '/approvals').group, null);
});

test('màn mở từ màn khác bám theo crumb cha; màn ngoài sidebar và Trang chủ giữ nguyên', () => {
  const market = [
    HOME,
    { label: 'Bếp & kho thực phẩm', to: '/kitchen' },
    { label: 'Bản dự trù hàng tươi', to: '/kitchen/forecast' },
    { label: 'Đi chợ theo ngày' },
  ];
  assert.equal(labels(alignCrumbs(market, MENU, '/kitchen/market-day')), 'Trang chủ > Vận hành bếp > Bản dự trù > Đi chợ theo ngày');
  // Trang con vẫn mang tên mục: không lặp "Bản dự trù > Bản dự trù"
  const same = [HOME, { label: 'Bếp', to: '/kitchen' }, { label: 'Bản dự trù' }];
  assert.equal(labels(alignCrumbs(same, MENU, '/kitchen/forecast/new')), 'Trang chủ > Vận hành bếp > Bản dự trù');
  const outside = [HOME, { label: 'Màn lạ' }];
  assert.equal(alignCrumbs(outside, MENU, '/somewhere'), outside);
  const home = [{ label: 'Trang chủ' }];
  assert.equal(alignCrumbs(home, MENU, '/'), home);
  assert.equal(labels(alignCrumbs([HOME, { label: 'Yêu cầu chờ duyệt' }], MENU, '/approvals')), 'Trang chủ > Chờ duyệt');
});
