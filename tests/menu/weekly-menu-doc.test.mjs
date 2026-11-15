import assert from 'node:assert/strict';
import { test } from 'node:test';

// Cố định múi giờ trường để ca "công bố trước 7 giờ sáng" cho cùng kết quả trên máy dev và CI (UTC)
process.env.TZ = 'Asia/Ho_Chi_Minh';

const { weeklyMenuFile } = await import('@/utils/menu-planning/weeklyMenuDoc');

const day = (date, items = [], extra = {}) => ({ date, off: false, note: '', items, ...extra });
const item = (block, session, dishName) => ({ block, session, dishId: 1, dishName });
const plan = {
  status: 'PUBLISHED',
  publishedAt: '2026-11-13T09:30:00',
  blocks: [
    { block: 'NURSERY', sessions: ['MORNING', 'LUNCH', 'AFTERNOON'] },
    { block: 'KINDERGARTEN', sessions: ['LUNCH', 'AFTERNOON'] },
  ],
  days: [
    day('2026-11-16', [item('NURSERY', 'LUNCH', 'Cơm thịt kho'), item('NURSERY', 'LUNCH', 'Canh bí'), item('KINDERGARTEN', 'LUNCH', 'Cá sốt <script>')]),
    day('2026-11-17'),
    day('2026-11-18', [], { off: true, note: 'Nghỉ lễ 20/11 bù' }),
    day('2026-11-19'),
    day('2026-11-20'),
  ],
};
const count = (html, needle) => html.split(needle).length - 1;

test('mỗi khối một bảng, hàng là bữa của khối, cột là 5 thứ', () => {
  // Chỉ đếm phần bảng thực đơn, bỏ bảng chỗ ký ở cuối
  const html = weeklyMenuFile(plan, '2026-11-16').html.split('<table class="sign">')[0];
  assert.equal(count(html, '<table>'), 2);
  assert.match(html, /Khối Nhà trẻ/);
  assert.match(html, /Khối Mẫu giáo/);
  assert.equal(count(html, '<th class="session">Bữa</th>'), 2);
  // Nhà trẻ 3 bữa + Mẫu giáo 2 bữa, mỗi bảng thêm 1 hàng tiêu đề
  assert.equal(count(html, '<tr>'), 3 + 1 + 2 + 1);
  assert.match(html, /Thứ Hai<br\/>16\/11/);
  assert.match(html, /Thứ Sáu<br\/>20\/11/);
  assert.match(html, /Cơm thịt kho<br\/>Canh bí/);
});

test('ngày nghỉ gộp mọi bữa thành một ô "Nghỉ" kèm ghi chú', () => {
  const { html } = weeklyMenuFile(plan, '2026-11-16');
  assert.match(html, /<td class="off" rowspan="3">Nghỉ<br\/>Nghỉ lễ 20\/11 bù<\/td>/);
  assert.match(html, /<td class="off" rowspan="2">Nghỉ<br\/>Nghỉ lễ 20\/11 bù<\/td>/);
});

test('tên món được escape, không chèn HTML thô', () => {
  const { html } = weeklyMenuFile(plan, '2026-11-16');
  assert.ok(!html.includes('<script>'));
  assert.match(html, /Cá sốt &lt;script&gt;/);
});

test('chỗ ký người lập: ngày theo lúc công bố, có họ tên khi điền, để trống cho ký tay', () => {
  const signed = weeklyMenuFile(plan, '2026-11-16', { preparerName: '  Nguyễn Thị Lan  ' }).html;
  assert.match(signed, /Thượng Hồng, ngày 13 tháng 11 năm 2026/);
  assert.match(signed, /NGƯỜI LẬP/);
  assert.match(signed, /<b>Nguyễn Thị Lan<\/b><\/td><\/tr><\/table>/);
  const blank = weeklyMenuFile(plan, '2026-11-16').html;
  assert.match(blank, /NGƯỜI LẬP/);
  assert.match(blank, /<b><\/b><\/td><\/tr><\/table>/);
  assert.match(weeklyMenuFile(plan, '2026-11-16', { preparerName: '<b>x' }).html, /&lt;b&gt;x/);
});

test('ngày ở chỗ ký theo giờ Việt Nam khi BE trả Instant UTC', () => {
  // 20:30 UTC ngày 12 = 03:30 sáng ngày 13 giờ Việt Nam
  const html = weeklyMenuFile({ ...plan, publishedAt: '2026-11-12T20:30:00Z' }, '2026-11-16').html;
  assert.match(html, /Thượng Hồng, ngày 13 tháng 11 năm 2026/);
  assert.match(html, /Công bố lúc 13\/11\/2026 03:30/);
});

test('tiêu đề tuần, thời điểm công bố và tên file', () => {
  const file = weeklyMenuFile(plan, '2026-11-16');
  assert.match(file.html, /Từ thứ hai 16\/11\/2026 đến thứ sáu 20\/11\/2026/);
  assert.match(file.html, /Công bố lúc 13\/11\/2026 09:30/);
  assert.equal(file.name, 'Thực đơn tuần 16-11-2026');
});
