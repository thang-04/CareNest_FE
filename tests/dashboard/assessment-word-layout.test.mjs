import assert from 'node:assert/strict';
import { test } from 'node:test';

const { themeEvaluationHtml } = await import('@/utils/assessment/themeEvaluationDoc');
const { semesterAssessmentFile } = await import('@/utils/assessment/semesterAssessmentDoc');
const { classRatingHtml } = await import('@/utils/assessment/classRatingDoc');
const { yearEndSheetHtml } = await import('@/utils/assessment/yearEndSheetDoc');

const goals = (n) => Array.from({ length: n }, (_, i) => ({ goalId: i, goalNo: i + 1, metChildren: 1, rate: 100 }));
const theme = (n) =>
  themeEvaluationHtml({ themeName: 'T', className: 'L', startDate: '2026-11-02', endDate: '2026-11-27', goals: goals(n), rows: [] });
const semester = semesterAssessmentFile({ semester: 1, className: 'L', domains: [{ domainId: 1, name: 'Thể chất' }], rows: [] }).html;
const rating = classRatingHtml({ title: 'X', headers: ['STT', 'Tên lớp', 'A', 'Ghi chú'], rows: [] }, [{ title: 'Hiệu trưởng', name: '' }]);
const yearEnd = yearEndSheetHtml({ sheet: { domains: [{ name: 'Thể chất', goals: [] }] }, ev: {}, child: {}, comment: '' });

// Word chỉ nhận khổ giấy, hướng giấy khai ở @page đặt tên gắn vào một div bao nội dung
const assertPage = (html, size, orientation) => {
  assert.match(html, new RegExp(`@page Section1 \\{ size: ${size}; mso-page-orientation: ${orientation};`));
  assert.match(html, /div\.Section1 \{ page: Section1; \}/);
  assert.match(html, /<body><div class="Section1">/);
};
const PORTRAIT = '595\\.3pt 841\\.9pt';
const LANDSCAPE = '841\\.9pt 595\\.3pt';

test('bản Word đánh giá khai đúng khổ A4 và hướng giấy', () => {
  assertPage(theme(18), PORTRAIT, 'portrait');
  assertPage(theme(30), LANDSCAPE, 'landscape');
  assertPage(semester, LANDSCAPE, 'landscape');
  assertPage(rating, LANDSCAPE, 'landscape');
  assertPage(yearEnd, PORTRAIT, 'portrait');
});

test('bảng có độ rộng cột cố định, tổng không vượt vùng in', () => {
  for (const [html, content] of [
    [theme(18), 519],
    [theme(30), 774],
    [semester, 757],
    [rating, 774],
  ]) {
    const table = html.match(/<table class="grid"[^>]*style="width:([\d.]+)pt; table-layout:fixed"/);
    assert.ok(table, 'bảng chính khai độ rộng');
    assert.ok(Number(table[1]) <= content, `${table[1]} <= ${content}`);
    const cols = [...html.matchAll(/<col width="\d+" style="width:([\d.]+)pt"\/>/g)].map((m) => Number(m[1]));
    assert.ok(cols.length >= 4 && cols.reduce((sum, w) => sum + w, 0) <= content + 0.01, cols.join(','));
  }
  assert.ok(!theme(18).includes('white-space: nowrap'), 'tên trẻ được xuống dòng, không đẩy bảng tràn lề');
});

test('xếp loại nhóm lớp: ô tiêu đề khai độ rộng để Word chia cột giống bản xem', () => {
  assert.match(rating, /<th style="width:150pt">Tên lớp<\/th>/);
});

test('chỗ ký giữ khoảng trống bằng đoạn trống, khung ảnh là ô bảng', () => {
  for (const html of [theme(18), semester, rating, yearEnd]) {
    assert.match(html, /<div class="sign"><p>&nbsp;<\/p><p>&nbsp;<\/p><p>&nbsp;<\/p><\/div>/);
    assert.doesNotMatch(html, /\.sign \{ height/);
  }
  assert.match(yearEnd, /<table class="photo"[^>]*>[\s\S]*?<td[^>]*border:1px solid black[^>]*>Ảnh của trẻ<\/td>/);
  assert.match(yearEnd, /<i>Nhận xét:<\/i><br\/>\./);
});

test('xem trên màn: đúng bề rộng vùng in, nằm giữa, phóng hoặc thu cả trang cho đầy khung nên giống bản in', () => {
  for (const [html, width] of [
    [theme(18), 518],
    [theme(30), 765],
    [semester, 756],
    [rating, 773],
    [yearEnd, 496],
  ]) {
    assert.ok(html.includes(`div.Section1 { width: ${width}pt; margin: 0 auto; }`), String(width));
    // Khung rộng 1040px (hộp xem trước): trang được phóng gần đầy khung, không để trống hai bên
    const rules = [...html.matchAll(/\(min-width: (\d+)px\) \{ body \{ zoom: ([\d.]+); \} \}/g)];
    const zoom = Math.max(...rules.filter((r) => Number(r[1]) <= 1040).map((r) => Number(r[2])));
    const filled = ((width * 4) / 3) * zoom;
    assert.ok(filled <= 1010 && filled >= 940, `${width}pt x ${zoom} = ${filled}px`);
    // Không đổi cách chia cột khi xem: bản xem trước và bản in dùng chung độ rộng
    assert.doesNotMatch(html, /table-layout: auto/);
  }
});
