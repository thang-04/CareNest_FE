import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const { ALLOWED_ATTR, ALLOWED_TAGS, ALLOWED_URI, estimateTextLength, normalizeEditorHtml, normalizeLinkUrl, textToHtml } = await import(
  '@/utils/announcement/richText.mjs'
);

test('chữ thường thành đoạn HTML: dòng trống tách đoạn, xuống dòng đơn thành <br>', () => {
  assert.equal(textToHtml('Một\n\nHai\nba'), '<p>Một</p><p>Hai<br>ba</p>');
  assert.equal(textToHtml('  \r\n Xin chào \r\n\r\n\r\nTạm biệt  '), '<p>Xin chào</p><p>Tạm biệt</p>');
  assert.equal(textToHtml(''), '');
  assert.equal(textToHtml(null), '');
});

test('chữ thường chứa ký tự thẻ được thoát, không thành HTML', () => {
  assert.equal(textToHtml('<script>alert(1)</script> & "x"'), '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;</p>');
});

test('trình soạn trống không bị coi là có nội dung', () => {
  assert.equal(normalizeEditorHtml('<p></p>'), '');
  assert.equal(normalizeEditorHtml('  <p></p> '), '');
  assert.equal(normalizeEditorHtml(null), '');
  assert.equal(normalizeEditorHtml('<p>Xin chào</p>'), '<p>Xin chào</p>');
});

test('ước lượng số ký tự chữ bỏ thẻ và đếm xuống dòng giữa các đoạn', () => {
  assert.equal(estimateTextLength(''), 0);
  assert.equal(estimateTextLength('<p>Xin <strong>chào</strong></p>'), 8);
  assert.equal(estimateTextLength('<p>Một</p><p>Hai</p>'), 'Một\nHai'.length);
  assert.equal(estimateTextLength('<p>a &amp; b &lt;c&gt;</p>'), 'a & b <c>'.length);
});

test('địa chỉ liên kết chỉ nhận https, mailto, tel và tự thêm giao thức khi thiếu', () => {
  assert.equal(normalizeLinkUrl('https://truong.example/lich'), 'https://truong.example/lich');
  assert.equal(normalizeLinkUrl('  truong.example/lich  '), 'https://truong.example/lich');
  assert.equal(normalizeLinkUrl('co@truong.example'), 'mailto:co@truong.example');
  assert.equal(normalizeLinkUrl('mailto:co@truong.example'), 'mailto:co@truong.example');
  assert.equal(normalizeLinkUrl('tel:+84225123456'), 'tel:+84225123456');
  for (const bad of [
    '',
    '   ',
    null,
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html;base64,AAAA',
    'vbscript:msgbox(1)',
    'http://truong.example',
    'ftp://truong.example',
    'file:///etc/passwd',
    '//evil.example/x',
    'có khoảng trắng.example',
    'chuoi-khong-co-mien',
    '/duong-dan-tuong-doi',
  ]) {
    assert.equal(normalizeLinkUrl(bad), null, `phải từ chối: ${bad}`);
  }
});

test('danh sách thẻ, thuộc tính và giao thức hiển thị khớp bộ định dạng đã chốt', () => {
  assert.deepEqual(ALLOWED_TAGS, ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a']);
  assert.deepEqual(ALLOWED_ATTR, ['href', 'target', 'rel']);
  assert.ok(ALLOWED_URI.test('https://x.example'));
  assert.ok(ALLOWED_URI.test('mailto:a@b.c'));
  assert.ok(ALLOWED_URI.test('tel:+84'));
  for (const bad of ['javascript:alert(1)', 'http://x.example', 'data:text/html,x', 'vbscript:x']) {
    assert.ok(!ALLOWED_URI.test(bad), bad);
  }
});

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(jsx?|mjs)$/.test(name) ? [path] : [];
  });
}

test('HTML người dùng chỉ được đưa vào trang qua RichBody (đã lọc), không nơi nào khác', () => {
  const offenders = sourceFiles('src')
    .filter((file) => /dangerouslySetInnerHTML|\binnerHTML\b/.test(readFileSync(file, 'utf8')))
    .map((file) => file.replaceAll('\\', '/'));
  assert.deepEqual(offenders, ['src/components/ui/RichBody.jsx']);
});
