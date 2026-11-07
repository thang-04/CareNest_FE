import { crc32 } from 'node:zlib';

/*
 * Dựng file Word .docx tối thiểu cho kiểm thử nhập file mục tiêu (BE:EDU-46): zip không nén (store) chứa
 * [Content_Types].xml và word/document.xml có một bảng. Ô: { text, span?, merge?: 'restart' | 'continue' }.
 */
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const cell = (c) => {
  const { text = '', span = 1, merge } = typeof c === 'string' ? { text: c } : c;
  const pr =
    (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') +
    (merge === 'continue' ? '<w:vMerge/>' : merge === 'restart' ? '<w:vMerge w:val="restart"/>' : '');
  const paragraphs = String(text)
    .split('\n')
    .map((line) => `<w:p><w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`)
    .join('');
  return `<w:tc>${pr ? `<w:tcPr>${pr}</w:tcPr>` : ''}${paragraphs}</w:tc>`;
};

const documentXml = (rows) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>` +
  `<w:p><w:r><w:t>KẾ HOẠCH GIÁO DỤC NĂM HỌC</w:t></w:r></w:p><w:tbl>` +
  rows.map((r) => `<w:tr>${r.map(cell).join('')}</w:tr>`).join('') +
  '</w:tbl><w:sectPr/></w:body></w:document>';

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

export function zipStore(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // tên file UTF-8
    local.writeUInt16LE(0, 8); // store
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** rows: mảng dòng, mỗi dòng mảng ô (chuỗi hoặc { text, span, merge }). */
export const goalTableDocx = (rows) => zipStore({ '[Content_Types].xml': CONTENT_TYPES, 'word/document.xml': documentXml(rows) });
