/*
 * Chỗ ký trong file xuất (Tiền 03/11): mọi tài liệu kế hoạch dùng ô `<b>Chức danh</b><br/><div class="sign"></div>Họ tên`.
 * Đọc / sửa thẳng trên HTML để hộp xem trước cho sửa tên, thêm người ký mà không đổi từng hàm xuất; không ghi hệ thống.
 */
const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

const slotOf = (div) => {
  const cell = div.parentElement;
  let name = '';
  for (let n = div.nextSibling; n; n = n.nextSibling) name += n.textContent;
  return { title: (cell.querySelector('b')?.textContent || '').trim(), name: name.trim() };
};

/** Các chỗ ký theo thứ tự trong tài liệu: [{ title, name }]. */
export const readSigners = (html) => [...parse(html).querySelectorAll('div.sign')].map(slotOf);

const setCell = (div, { title, name }) => {
  const cell = div.parentElement;
  const b = cell.querySelector('b');
  if (b) b.textContent = title;
  while (div.nextSibling) div.nextSibling.remove();
  div.after(cell.ownerDocument.createTextNode(name));
};

/**
 * Ghi lại chỗ ký: signers dài hơn số chỗ ký sẵn có thì thêm ô vào hàng ký cuối (chia đều chiều rộng).
 * Trả HTML đầy đủ để xem trước / xuất.
 */
export function applySigners(html, signers) {
  const doc = parse(html);
  const slots = [...doc.querySelectorAll('div.sign')];
  if (!slots.length) return html;
  slots.forEach((div, i) => signers[i] && setCell(div, signers[i]));
  const last = slots[slots.length - 1].parentElement;
  const row = last.parentElement;
  signers.slice(slots.length).forEach((s) => {
    const cell = last.cloneNode(true);
    setCell(cell.querySelector('div.sign'), s);
    row.appendChild(cell);
  });
  // Dòng "ngày … tháng …" phía trên gộp ngang theo số người ký (kế hoạch năm) ⇒ giãn theo số ô mới
  const above = row.previousElementSibling?.lastElementChild;
  if (above && above.colSpan > 1 && signers.length > slots.length) above.colSpan += signers.length - slots.length;
  if (signers.length > slots.length) {
    // Hàng chỉ gồm ô ký thì chia đều; có ô đệm (giáo án tuần) thì để ô ký tự giãn
    const cells = [...row.children];
    const signCells = cells.filter((td) => td.querySelector('div.sign'));
    const width = signCells.length === cells.length ? `${Math.floor(100 / cells.length)}%` : '';
    signCells.forEach((td) => (td.style.width = width));
  }
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}
