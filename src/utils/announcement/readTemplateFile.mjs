import { ALLOWED_ATTR, ALLOWED_TAGS, ALLOWED_URI } from './richText.mjs';

export const TEMPLATE_FILE_ACCEPT = '.txt,.docx';
export const TEMPLATE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export class TemplateFileError extends Error {}

const extensionOf = (name = '') => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

// Ký tự BOM U+FEFF đầu tệp UTF-8 (dựng bằng mã để tệp nguồn không chứa ký tự vô hình)
const BOM_PATTERN = new RegExp(`^${String.fromCharCode(0xfeff)}`);

/** Chuẩn hóa chữ lấy từ tệp: bỏ BOM, thống nhất xuống dòng, bỏ khoảng trắng cuối dòng, gộp dòng trống thừa. */
export const normalizeTemplateText = (text) =>
  String(text || '')
    .replace(BOM_PATTERN, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

async function readTxt(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new TemplateFileError('Tệp không phải mã hóa UTF-8. Hãy lưu lại tệp ở dạng UTF-8 hoặc dùng tệp Word (.docx).');
  }
}

// Thư viện đọc Word chỉ tải khi người dùng chọn tệp .docx để không làm nặng gói chính.
const defaultLoadMammoth = async () => {
  const module = await import('mammoth');
  return module.default || module;
};

const defaultSanitizeHtml = async (html) => {
  const { default: DOMPurify } = await import('dompurify');
  if (typeof DOMPurify.sanitize !== 'function') throw new TemplateFileError('Không thể xử lý tệp Word trên thiết bị này.');
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOWED_URI_REGEXP: ALLOWED_URI, ALLOW_DATA_ATTR: false });
};

async function readDocx(file, loadMammoth, sanitizeHtml) {
  try {
    const mammoth = await loadMammoth();
    const input = { arrayBuffer: await file.arrayBuffer() };
    const [converted, raw] = await Promise.all([
      mammoth.convertToHtml(input, {
        styleMap: ['u => u'],
        includeEmbeddedStyleMap: false,
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
      }),
      mammoth.extractRawText(input),
    ]);
    return { text: raw.value, html: await sanitizeHtml(converted.value) };
  } catch (error) {
    if (error instanceof TemplateFileError) throw error;
    throw new TemplateFileError('Không đọc được tệp Word. Hãy kiểm tra tệp còn nguyên vẹn rồi thử lại.');
  }
}

/**
 * Đọc nội dung từ tệp .txt (UTF-8) hoặc .docx (chỉ giữ các định dạng được hỗ trợ, bỏ bảng và ảnh).
 * Ném TemplateFileError với thông báo tiếng Việt khi tệp không dùng được; không tự cắt chữ vượt `maxLength`.
 */
export async function readTemplateFile(file, { maxLength, loadMammoth = defaultLoadMammoth, sanitizeHtml = defaultSanitizeHtml } = {}) {
  const extension = extensionOf(file?.name);
  if (!['.txt', '.docx'].includes(extension)) throw new TemplateFileError('Chỉ nhận tệp .txt hoặc .docx.');
  if (file.size > TEMPLATE_FILE_MAX_BYTES) throw new TemplateFileError('Tệp quá lớn, tối đa 5 MB.');
  const result = extension === '.txt' ? { text: await readTxt(file) } : await readDocx(file, loadMammoth, sanitizeHtml);
  const text = normalizeTemplateText(result.text);
  if (!text) throw new TemplateFileError('Tệp không có nội dung chữ.');
  if (maxLength && text.length > maxLength) {
    throw new TemplateFileError(
      `Nội dung trong tệp dài ${text.length.toLocaleString('vi-VN')} ký tự, vượt giới hạn ${maxLength.toLocaleString('vi-VN')} ký tự.`,
    );
  }
  if (result.html && result.html.length > 20000) throw new TemplateFileError('Nội dung định dạng vượt giới hạn 20.000 ký tự HTML.');
  return { text, ...(result.html ? { html: result.html } : {}), name: file.name };
}
