import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  normalizeTemplateText,
  readTemplateFile,
  TemplateFileError,
  TEMPLATE_FILE_MAX_BYTES,
} from '../../src/utils/announcement/readTemplateFile.mjs';

const fileLike = (name, content) => {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
};
const rejectsWith = (promise, pattern) =>
  assert.rejects(promise, (error) => error instanceof TemplateFileError && pattern.test(error.message));

// Mammoth bản Node đọc `buffer`; trình duyệt dùng `arrayBuffer` như mã thật, nên bọc lại cho bài test.
const nodeMammoth = async () => ({
  extractRawText: ({ arrayBuffer }) => mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) }),
  convertToHtml: ({ arrayBuffer }, options) => mammoth.convertToHtml({ buffer: Buffer.from(arrayBuffer) }, options),
  images: mammoth.images,
});

async function buildDocx(paragraphs, { numbering = false, link = false } = {}) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>${numbering ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : ''}</Types>`,
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const body = paragraphs.map((text) => `<w:p>${text.xml || `<w:r><w:t>${text}</w:t></w:r>`}</w:p>`).join('');
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}</w:body></w:document>`,
  );
  if (numbering || link) {
    const relations = [
      numbering
        ? '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'
        : '',
      link
        ? '<Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://truong.example/lich" TargetMode="External"/>'
        : '',
    ].join('');
    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations}</Relationships>`,
    );
  }
  if (numbering) {
    zip.file(
      'word/numbering.xml',
      '<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>',
    );
  }
  return zip.generateAsync({ type: 'uint8array' });
}

test('chuẩn hóa chữ từ tệp: bỏ BOM, thống nhất xuống dòng, gộp dòng trống thừa', () => {
  assert.equal(normalizeTemplateText('﻿Dòng 1  \r\n\r\n\r\n\r\nDòng 2\r\n'), 'Dòng 1\n\nDòng 2');
  assert.equal(normalizeTemplateText(undefined), '');
});

test('đọc .txt UTF-8 hợp lệ, có dấu tiếng Việt và BOM', async () => {
  const result = await readTemplateFile(fileLike('mau.TXT', '﻿Kính mời quý phụ huynh\r\ntham dự họp.'), { maxLength: 4000 });
  assert.deepEqual(result, { text: 'Kính mời quý phụ huynh\ntham dự họp.', name: 'mau.TXT' });
});

test('từ chối sai đuôi, quá lớn, rỗng, vượt giới hạn ký tự và không phải UTF-8', async () => {
  await rejectsWith(readTemplateFile(fileLike('mau.pdf', 'abc')), /\.txt hoặc \.docx/);
  await rejectsWith(
    readTemplateFile({ name: 'mau.txt', size: TEMPLATE_FILE_MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }),
    /tối đa 5 MB/,
  );
  await rejectsWith(readTemplateFile(fileLike('mau.txt', '  \r\n \n')), /không có nội dung/);
  await rejectsWith(readTemplateFile(fileLike('mau.txt', 'a'.repeat(4001)), { maxLength: 4000 }), /4\.001 ký tự, vượt giới hạn 4\.000/);
  await rejectsWith(readTemplateFile(fileLike('mau.txt', new Uint8Array([0xff, 0xfe, 0x41, 0x80]))), /UTF-8/);
  assert.equal((await readTemplateFile(fileLike('mau.txt', 'a'.repeat(4000)), { maxLength: 4000 })).text.length, 4000);
});

test('đọc .docx thật bằng mammoth: giữ chữ và HTML các đoạn', async () => {
  const docx = await buildDocx(['Kính gửi quý phụ huynh', 'Họp lúc 8 giờ sáng thứ Hai.']);
  const result = await readTemplateFile(fileLike('thong-bao.docx', docx), {
    maxLength: 4000,
    loadMammoth: nodeMammoth,
    sanitizeHtml: async (html) => html,
  });
  assert.equal(result.text, 'Kính gửi quý phụ huynh\n\nHọp lúc 8 giờ sáng thứ Hai.');
  assert.match(result.html, /<p>Kính gửi quý phụ huynh<\/p>/);
  assert.equal(result.name, 'thong-bao.docx');
});

test('nhập Word giữ đậm, nghiêng, gạch chân bằng style map giới hạn', async () => {
  const docx = await buildDocx([
    {
      xml: '<w:r><w:t xml:space="preserve">Xin </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>chào</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t> cô</w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t> giáo</w:t></w:r>',
    },
  ]);
  const result = await readTemplateFile(fileLike('dinh-dang.docx', docx), {
    maxLength: 4000,
    loadMammoth: nodeMammoth,
    sanitizeHtml: async (html) => html,
  });
  assert.match(result.html, /<strong>chào<\/strong>/);
  assert.match(result.html, /<em> cô<\/em>/);
  assert.match(result.html, /<u> giáo<\/u>/);
});

test('nhập Word giữ danh sách chấm và liên kết https', async () => {
  const docx = await buildDocx(
    [
      { xml: '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Mục một</w:t></w:r>' },
      {
        xml: '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:hyperlink r:id="rIdLink"><w:r><w:t>Xem lịch</w:t></w:r></w:hyperlink>',
      },
    ],
    { numbering: true, link: true },
  );
  const result = await readTemplateFile(fileLike('danh-sach.docx', docx), {
    maxLength: 4000,
    loadMammoth: nodeMammoth,
    sanitizeHtml: async (html) => html,
  });
  assert.match(result.html, /<ul>/);
  assert.match(result.html, /<li>Mục một<\/li>/);
  assert.match(result.html, /<a href="https:\/\/truong\.example\/lich">Xem lịch<\/a>/);
});

test('.docx hỏng hoặc không có chữ cho thông báo rõ, không đổi nội dung', async () => {
  await rejectsWith(readTemplateFile(fileLike('hong.docx', 'khong phai zip'), { loadMammoth: nodeMammoth }), /Không đọc được tệp Word/);
  await rejectsWith(
    readTemplateFile(fileLike('rong.docx', await buildDocx([''])), { loadMammoth: nodeMammoth, sanitizeHtml: async (html) => html }),
    /không có nội dung/,
  );
});

test('form mẫu: nút Nhập từ tệp nhận .txt và .docx, hỏi xác nhận trước khi ghi đè, tệp lỗi không đổi ô nội dung', () => {
  const form = readFileSync('src/components/announcement/AnnouncementTemplateForm.jsx', 'utf8');
  assert.match(form, /Nhập từ tệp/);
  assert.match(form, /accept=\{TEMPLATE_FILE_ACCEPT\}/);
  assert.match(form, /latest\.current\.body\.trim\(\)\) setPending\(result\)/);
  assert.match(form, /<ConfirmationModal[\s\S]*?apply\(pending\)/);
  assert.match(form, /!form\.readOnly &&/);
  const util = readFileSync('src/utils/announcement/readTemplateFile.mjs', 'utf8');
  assert.match(util, /import\('mammoth'\)/);
  assert.doesNotMatch(util, /^import .*mammoth/m);
});
