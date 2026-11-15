import { FAIL, INSPECTION_COLUMNS, INSPECTION_REQUIRED, PASS } from '@/models/kitchen/inspectionConstants';

/*
 * Biểu mẫu kiểm thực M1–M3: chuyển dữ liệu BE ↔ ô nhập, tích cả cột và kiểm định dạng ô. Chỉ kiểm cách gõ (giờ, ngày, số);
 * ngưỡng đạt / không đạt và điều kiện ký do BE quyết định.
 * form = { header: { place, checkedAt }, rows: { [key dòng]: { [cột]: chữ } } }.
 */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

/** Cột người dùng nhập (không gồm cột BE điền sẵn). */
export const editableColumns = (tab) => (INSPECTION_COLUMNS[tab] || []).filter((c) => !c.readOnly);

const toText = (value) => (value == null ? '' : String(value));

// Dữ liệu cũ ngoài lựa chọn của ô tích (vd. "NO") coi như chưa tích
const normalize = (col, raw) => {
  const value = toText(raw);
  if (col.type === 'check') return value === col.checkedValue ? value : '';
  if (col.type === 'passfail') return value === PASS || value === FAIL ? value : '';
  return value;
};

/** `2026-11-04T07:30` → { date, time }; chưa có thì rỗng. BE giữ một chuỗi, màn hình nhập ngày và giờ gõ tay riêng. */
export const splitDateTime = (value) => {
  const [date = '', time = ''] = toText(value).split('T');
  return { date, time };
};

/** Ngày + giờ đủ và đúng ⇒ `2026-11-04T07:30`; thiếu một phần ⇒ giữ nguyên chữ để validateForm báo lỗi. */
export const joinDateTime = (date, time) => {
  const d = toText(date).trim();
  const t = toText(time).trim();
  if (!d && !t) return '';
  return `${d}T${t}`;
};

/** Ô nhập của một mẫu từ dữ liệu BE ({ rows, header }). */
export const toForm = (tab, data) => ({
  header: {
    place: toText(data?.header?.place),
    checkedDate: splitDateTime(data?.header?.checkedAt).date,
    checkedTime: splitDateTime(data?.header?.checkedAt).time,
  },
  rows: Object.fromEntries(
    (data?.rows || []).map((row) => [
      row.key,
      Object.fromEntries(editableColumns(tab).map((col) => [col.key, normalize(col, row[col.key])])),
    ]),
  ),
});

/** Nội dung gửi BE: { header, rows: [{ key, ...ô nhập }] }; ô số rỗng gửi null. */
export const formToRequest = (tab, form) => ({
  header: {
    place: toText(form?.header?.place).trim(),
    checkedAt: joinDateTime(form?.header?.checkedDate, form?.header?.checkedTime),
  },
  rows: Object.entries(form?.rows || {}).map(([key, values]) => ({
    key,
    ...Object.fromEntries(
      editableColumns(tab).map((col) => {
        const raw = toText(values[col.key]).trim();
        if (col.type === 'number') return [col.key, raw === '' ? null : Number(raw)];
        return [col.key, raw];
      }),
    ),
  })),
});

const fieldError = (col, raw) => {
  if (raw === '') return '';
  if (col.type === 'time' && !TIME.test(raw)) return 'Nhập giờ dạng 07:30.';
  if (col.type === 'date' && !isRealDate(raw)) return 'Nhập ngày dạng 09/11/2026.';
  if (col.type === 'datetime' && !DATETIME.test(raw)) return 'Nhập đủ ngày và giờ.';
  if (col.type === 'number' && !(Number(raw) >= 0)) return 'Nhập số không âm.';
  return '';
};

/** Lỗi theo `key.cột` (và `header.checkedAt`) cho các ô sai định dạng. */
export const validateForm = (tab, form) => {
  const errors = {};
  const checkedAt = joinDateTime(form?.header?.checkedDate, form?.header?.checkedTime);
  if (checkedAt && !(DATETIME.test(checkedAt) && isRealDate(checkedAt.slice(0, 10)))) {
    errors['header.checkedAt'] = 'Nhập đủ ngày (09/11/2026) và giờ (07:30).';
  }
  Object.entries(form?.rows || {}).forEach(([key, values]) =>
    editableColumns(tab).forEach((col) => {
      const message = fieldError(col, toText(values[col.key]).trim());
      if (message) errors[`${key}.${col.key}`] = message;
    }),
  );
  return errors;
};

/** Đã sửa so với dữ liệu BE trả về. */
export const isFormDirty = (tab, data, form) => JSON.stringify(toForm(tab, data)) !== JSON.stringify(form || {});

/**
 * Hai hàng tiêu đề + dãy cột lá của bảng mẫu (cột nhóm gộp ở hàng trên, Đạt / Không đạt và ô tích cả cột ở hàng dưới).
 * top: [{ key, label, colSpan, rowSpan }]; sub: [{ key, label?, tick?: { col, value, text } }] (đúng thứ tự cột lá);
 * leaves: [{ key, col, value? }] (value có ở ô tích) — dùng cho hàng số thứ tự cột và ô thân bảng.
 */
export const buildHeader = (columns) => {
  const top = [];
  const sub = [];
  const leaves = [];
  const leavesOf = (col) =>
    col.type === 'passfail'
      ? [
          { key: `${col.key}:${PASS}`, col, value: PASS, text: 'Đạt' },
          { key: `${col.key}:${FAIL}`, col, value: FAIL, text: 'Không đạt' },
        ]
      : [{ key: col.key, col, value: col.type === 'check' ? col.checkedValue : undefined, text: col.checkLabel }];
  let i = 0;
  while (i < columns.length) {
    const col = columns[i];
    if (col.group) {
      let end = i;
      while (end < columns.length && columns[end].group === col.group) end += 1;
      const members = columns.slice(i, end);
      members.forEach((m) => {
        const [leaf] = leavesOf(m);
        leaves.push(leaf);
        sub.push({
          key: m.key,
          col: m,
          label: m.label,
          tick: m.type === 'check' ? { col: m, value: m.checkedValue, text: m.checkLabel } : null,
        });
      });
      top.push({ key: `group:${col.group}`, label: col.group, colSpan: members.length, rowSpan: 1 });
      i = end;
    } else if (col.type === 'passfail') {
      const pair = leavesOf(col);
      pair.forEach((leaf) => {
        leaves.push(leaf);
        sub.push({ key: leaf.key, tick: { col, value: leaf.value, text: leaf.text } });
      });
      top.push({ key: col.key, label: col.label, colSpan: 2, rowSpan: 1 });
      i += 1;
    } else if (col.type === 'check') {
      const [leaf] = leavesOf(col);
      leaves.push(leaf);
      sub.push({ key: col.key, tick: { col, value: col.checkedValue, text: col.checkLabel } });
      top.push({ key: col.key, label: col.label, colSpan: 1, rowSpan: 1 });
      i += 1;
    } else {
      leaves.push(leavesOf(col)[0]);
      top.push({ key: col.key, label: col.label, colSpan: 1, rowSpan: 2, plain: true, col });
      i += 1;
    }
  }
  return { top, sub, leaves };
};

/**
 * Chuẩn hóa giờ gõ nhanh về HH:MM: "730" → "07:30", "1030" → "10:30", "7:5" → "07:05", "9" → "09:00".
 * Không đọc được hoặc ngoài khoảng giờ thì trả nguyên chữ để màn báo sai định dạng.
 */
export const normalizeTime = (text) => {
  const raw = toText(text).trim();
  if (!raw) return '';
  let hour;
  let minute;
  const split = raw.match(/^(\d{1,2})[:.hH](\d{1,2})$/);
  if (split) [hour, minute] = [split[1], split[2]];
  else if (/^\d{3,4}$/.test(raw)) [hour, minute] = [raw.slice(0, raw.length - 2), raw.slice(-2)];
  else if (/^\d{1,2}$/.test(raw)) [hour, minute] = [raw, '0'];
  else return raw;
  const h = Number(hour);
  const m = Number(minute);
  if (h > 23 || m > 59) return raw;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Ngày ISO `2026-11-04` có thật trên lịch (không nhận 2026-02-30). */
export const isRealDate = (text) => {
  if (!DATE.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const toIso = (y, m, d) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Chuẩn hóa ngày gõ nhanh về `YYYY-MM-DD`: "9/11", "09.11.2026", "091126", "09112026", "0911" (thiếu năm lấy `defaultYear`).
 * Không đọc được hoặc ngày không có thật thì trả nguyên chữ để màn báo sai định dạng.
 */
export const normalizeDate = (text, defaultYear) => {
  const raw = toText(text).trim();
  if (!raw || DATE.test(raw)) return raw;
  let day;
  let month;
  let year = defaultYear ? String(defaultYear) : '';
  const parts = raw.split(/[/.\-\s]+/).filter(Boolean);
  if (parts.length >= 2 && parts.length <= 3 && parts.every((p) => /^\d+$/.test(p))) {
    [day, month] = parts;
    if (parts[2]) year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  } else if (/^\d{4}$/.test(raw)) {
    [day, month] = [raw.slice(0, 2), raw.slice(2)];
  } else if (/^\d{6}$/.test(raw)) {
    [day, month, year] = [raw.slice(0, 2), raw.slice(2, 4), `20${raw.slice(4)}`];
  } else if (/^\d{8}$/.test(raw)) {
    [day, month, year] = [raw.slice(0, 2), raw.slice(2, 4), raw.slice(4)];
  } else return raw;
  if (!year || year.length !== 4) return raw;
  const iso = toIso(year, Number(month), Number(day));
  return isRealDate(iso) ? iso : raw;
};

/** `2026-11-04` → `04/11/2026` để hiển thị trong ô gõ; chữ chưa chuẩn hóa giữ nguyên. */
export const toDisplayDate = (value) => {
  const text = toText(value);
  return DATE.test(text) ? `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}` : text;
};

/** Đang gõ toàn số thì tự chèn dấu "/": 0911 → 09/11, 09112026 → 09/11/2026. Có dấu phân cách thì giữ nguyên. */
export const maskDate = (text) => {
  const raw = toText(text);
  // Có dấu "." "-" hay khoảng trắng thì người gõ tự quyết định cách ngăn
  if (/[^0-9/]/.test(raw)) return raw;
  const parts = raw.split('/');
  // Ngày, tháng tối đa 2 số: số thừa chuyển sang phần kế (gõ từng ký tự hay dán liền đều ra cùng kết quả)
  for (let i = 0; i < 2; i += 1) {
    if (parts[i]?.length > 2) {
      parts[i + 1] = parts[i].slice(2) + (parts[i + 1] ?? '');
      parts[i] = parts[i].slice(0, 2);
    }
  }
  if (parts[2] !== undefined) parts[2] = parts[2].slice(0, 4);
  return parts.slice(0, 3).join('/');
};

/** Chép giá trị ô của dòng trên xuống dòng này (Ctrl+D như bảng tính); dòng đầu hoặc không có dòng trên thì giữ nguyên form. */
export const copyDown = (form, rowKey, colKey) => {
  const keys = Object.keys(form?.rows || {});
  const above = keys[keys.indexOf(rowKey) - 1];
  if (above === undefined) return form;
  return { ...form, rows: { ...form.rows, [rowKey]: { ...form.rows[rowKey], [colKey]: form.rows[above][colKey] } } };
};

/** Kéo chấm điền: chép ô của dòng `fromKey` sang mọi dòng từ đó tới `toKey` (kéo xuống hoặc lên), cùng một cột. */
export const fillRange = (form, colKey, fromKey, toKey) => {
  const keys = Object.keys(form?.rows || {});
  const from = keys.indexOf(fromKey);
  const to = keys.indexOf(toKey);
  if (from < 0 || to < 0 || from === to) return form;
  const value = form.rows[fromKey][colKey];
  const rows = { ...form.rows };
  keys.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((key) => {
    if (key !== fromKey) rows[key] = { ...rows[key], [colKey]: value };
  });
  return { ...form, rows };
};

/** Cột Nơi cung cấp: điền nhanh từ một nhà cung cấp trong danh mục. */
export const SUPPLIER_FIELDS = { supplierName: 'name', supplierContact: 'contact', deliveryPerson: 'contactName' };

/** Điền một giá trị cho cả cột: chỉ dòng còn trống hoặc mọi dòng. */
export const fillColumn = (form, colKey, value, onlyEmpty) => ({
  ...form,
  rows: Object.fromEntries(
    Object.entries(form.rows).map(([key, values]) => [
      key,
      onlyEmpty && toText(values[colKey]).trim() !== '' ? values : { ...values, [colKey]: value },
    ]),
  ),
});

/** Điền một cột cho đúng các dòng đã chọn; `value` rỗng thì xóa nội dung ô. */
export const fillRows = (form, colKey, value, rowKeys) => {
  const chosen = new Set(rowKeys);
  return {
    ...form,
    rows: Object.fromEntries(
      Object.entries(form.rows).map(([key, values]) => [key, chosen.has(key) ? { ...values, [colKey]: value } : values]),
    ),
  };
};

/** Điền Nơi cung cấp (tên cơ sở, địa chỉ + điện thoại, người giao hàng) từ một nhà cung cấp cho các dòng. */
export const applySupplier = (form, supplier, onlyEmpty) => {
  const source = {
    name: supplier.name,
    contact: [supplier.address, supplier.phone].filter(Boolean).join(', '),
    contactName: supplier.contactName,
  };
  return Object.entries(SUPPLIER_FIELDS).reduce(
    (next, [colKey, field]) => fillColumn(next, colKey, toText(source[field]), onlyEmpty),
    form,
  );
};

/** Khóa các dòng chưa chọn Đạt / Không đạt ở cột cảm quan, theo thứ tự dòng; mẫu không bắt buộc cột này (M5) trả mảng rỗng. */
export const rowsMissing = (tab, form) => {
  const required = INSPECTION_REQUIRED[tab];
  if (!required) return [];
  return Object.entries(form?.rows || {})
    .filter(([, values]) => values[required] !== PASS && values[required] !== FAIL)
    .map(([key]) => key);
};

/** Chữ ký đang còn hiệu lực của một mẫu. */
export const hasValidSignature = (tabData) => !!tabData?.signature && tabData.signature.valid !== false;

/** Giá trị khi tích một ô của cột: ô tích dùng `checkedValue`, cột Đạt / Không đạt truyền PASS hoặc FAIL. */
export const tickValue = (col, passFail) => (col.type === 'check' ? col.checkedValue : passFail);

/** Trạng thái tích của cả cột: 'all' | 'some' | 'none' (ô tiêu đề dùng để tích tất cả). */
export const columnTick = (form, col, value) => {
  const keys = Object.keys(form?.rows || {});
  if (!keys.length) return 'none';
  const ticked = keys.filter((key) => form.rows[key][col.key] === value).length;
  if (ticked === 0) return 'none';
  return ticked === keys.length ? 'all' : 'some';
};

/** Tích tất cả dòng của cột (hoặc bỏ tích khi đã tích hết); trả về form mới. */
export const toggleColumn = (form, col, value) => {
  const clear = columnTick(form, col, value) === 'all';
  return {
    ...form,
    rows: Object.fromEntries(Object.entries(form.rows).map(([key, values]) => [key, { ...values, [col.key]: clear ? '' : value }])),
  };
};

/** Tích một ô của một dòng: bấm lại ô đang tích thì bỏ tích; Đạt và Không đạt loại trừ nhau. */
export const toggleCell = (form, rowKey, col, value) => {
  const current = form.rows[rowKey]?.[col.key];
  return { ...form, rows: { ...form.rows, [rowKey]: { ...form.rows[rowKey], [col.key]: current === value ? '' : value } } };
};
