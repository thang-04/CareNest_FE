import { FAIL, INSPECTION_REQUIRED } from '@/models/kitchen/inspectionConstants';

/*
 * Điều kiện hiển thị theo Quyết định 1246/QĐ-BYT cho màn kiểm thực. BE quyết định điều kiện ký (INS-02, mã 6090) và là nguồn
 * rule; ở đây chỉ nhắc người nhập sớm (đếm dòng thiếu, cảnh báo số liệu lưu mẫu), không chặn thay BE.
 */

const text = (value) => (value == null ? '' : String(value));

/** Dòng Không đạt (cảm quan hoặc xét nghiệm nhanh): QĐ 1246 Điều 3.1, 4.2, 5.5 yêu cầu ghi rõ biện pháp xử lý. */
export const isFailed = (values) => values?.sensory === FAIL || values?.rapidTest === FAIL;

/** Khóa các dòng Không đạt chưa ghi biện pháp xử lý (cột ghi chú), theo thứ tự dòng; M5 không có cột cảm quan nên rỗng. */
export const actionsMissing = (tab, form) => {
  if (!INSPECTION_REQUIRED[tab]) return [];
  return Object.entries(form?.rows || {})
    .filter(([, values]) => isFailed(values) && text(values.note).trim() === '')
    .map(([key]) => key);
};

const NUMBER = /\d+(?:[.,]\d+)?/g;
const toNumber = (raw) => Number(raw.replace(',', '.'));

/**
 * Cảnh báo ô sổ lưu mẫu (Mẫu 5) ngoài mức QĐ 1246: mẫu tối thiểu 100 g (thức ăn đặc) hoặc 150 ml (thức ăn lỏng) — Điều 7.2;
 * bảo quản 2–8 °C — Điều 8.1. Chữ tự do nên chỉ đọc số kèm đơn vị g/gam/gram/ml/kg/lít; không hiểu thì không cảnh báo.
 * Ô nhiều món dạng "Cơm: 100 g; Canh: 120 ml" kiểm từng phần.
 */
export const sampleWarning = (colKey, value) => {
  const content = text(value).trim();
  if (!content) return '';
  if (colKey === 'temperature') {
    const outside = (content.match(NUMBER) || []).map(toNumber).some((n) => n < 2 || n > 8);
    return outside ? 'Nhiệt độ bảo quản mẫu phải từ 2 °C đến 8 °C (QĐ 1246 Điều 8).' : '';
  }
  if (colKey !== 'weight') return '';
  for (const part of content.split(';')) {
    const match = part.match(/(\d+(?:[.,]\d+)?)\s*(kg|gam|gram|g|ml|lít|lit|l)\b/i);
    if (!match) continue;
    const amount = toNumber(match[1]);
    const unit = match[2].toLowerCase();
    const grams = unit === 'kg' ? amount * 1000 : ['g', 'gam', 'gram'].includes(unit) ? amount : null;
    const millilitres = unit === 'ml' ? amount : ['l', 'lít', 'lit'].includes(unit) ? amount * 1000 : null;
    if (millilitres !== null && millilitres < 150) return 'Thức ăn lỏng lưu tối thiểu 150 ml (QĐ 1246 Điều 7).';
    if (grams !== null && grams < 100) return 'Thức ăn đặc lưu tối thiểu 100 g (QĐ 1246 Điều 7).';
  }
  return '';
};
