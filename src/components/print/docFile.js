/*
 * Xuất tài liệu dạng HTML: tải file .doc (Word mở được, không cần thư viện) hoặc mở trang in để in giấy / lưu PDF.
 * Dùng chung cho các module có nút "Xuất Word" + "In / Lưu PDF".
 */

export const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Bỏ ký tự Windows không cho dùng trong tên file. */
export const fileTitle = (text) =>
  String(text || '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const downloadDoc = (html, baseName) => {
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Trả false khi trình duyệt chặn cửa sổ mới. */
export const printDoc = (html) => {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
};
