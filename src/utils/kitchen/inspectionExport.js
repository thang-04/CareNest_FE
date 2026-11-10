import {
  INSPECTION_COLUMNS,
  INSPECTION_COMBINED_COLUMNS,
  INSPECTION_DECISION,
  INSPECTION_FORMS,
  INSPECTION_PRINT_VARIANTS,
  INSPECTION_VARIANT_FORMS,
} from '@/models/kitchen/inspectionConstants';
import { buildHeader } from '@/utils/kitchen/inspectionForm';
import { formatDate, formatDateTime, formatQty } from '@/utils/format';

/*
 * Nội dung in và xuất Excel của biểu mẫu kiểm thực M1–M3, M5 và các bản in M3 gộp lưu mẫu, M4 nhãn mẫu: chép lại đúng dữ liệu đã
 * lưu, ô tích in dấu "x" như biểu mẫu giấy. Dùng chung cho bản in và file Excel để hai bản không lệch nhau.
 * variant: 'main' (chính mẫu) | 'combined' (M3 + lưu mẫu, cần dữ liệu M5) | 'label' (M4 nhãn, từ dữ liệu M5).
 */
const longDate = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return y && m && d ? `Ngày ${d} tháng ${m} năm ${y}` : '';
};

const SAMPLE_KEYS = ['weight', 'container', 'temperature', 'takenAt', 'destroyedAt', 'qualityNote'];

/** Cột của bản in: M3 gộp có thêm các cột lưu mẫu. */
export const inspectionColumns = (tab, variant = 'main') =>
  variant === 'combined' ? INSPECTION_COMBINED_COLUMNS : INSPECTION_COLUMNS[tab];

/** Dòng của bản in: M3 gộp ghép dòng M3 với dòng M5 cùng bữa, món. */
export const inspectionRows = (tab, variant, data, sampleData) => {
  if (variant !== 'combined') return data.rows;
  const byKey = Object.fromEntries((sampleData?.rows || []).map((row) => [row.key, row]));
  return data.rows.map((row) => ({ ...row, ...Object.fromEntries(SAMPLE_KEYS.map((key) => [key, byKey[row.key]?.[key] ?? ''])) }));
};

/** Chữ trong một ô thân bảng theo cột lá (leaf của buildHeader). */
export const inspectionCellText = (leaf, row) => {
  const { col } = leaf;
  const value = row[col.key];
  if (col.type === 'check' || col.type === 'passfail') return value === leaf.value ? 'x' : '';
  if (col.type === 'timestamp') return value ? formatDateTime(value) : '';
  if (col.readOnly) return col.type === 'number' ? (value == null ? '' : formatQty(value)) : String(value ?? '');
  if (value == null || value === '') return '';
  if (col.type === 'select') return col.options.find((o) => o.value === value)?.label || '';
  if (col.type === 'date') return formatDate(value);
  if (col.type === 'number') return `${formatQty(value)}${col.unitKey && row[col.unitKey] ? ` ${row[col.unitKey]}` : ''}`;
  return String(value);
};

/** Tên cột lá cho dòng tiêu đề phẳng (Excel): "Nơi cung cấp · Tên cơ sở", "Kiểm tra cảm quan · Đạt". */
export const inspectionLeafLabels = (columns) =>
  buildHeader(columns).leaves.map((leaf) => {
    const base = leaf.col.group ? `${leaf.col.group} · ${leaf.col.label}` : leaf.col.label;
    return leaf.col.type === 'passfail' ? `${base} · ${leaf.text}` : base;
  });

/** Thông tin tiêu đề biểu mẫu để in: số hiệu, mẫu, tiêu đề, ngày. */
export const inspectionTitle = (tab, date, variant = 'main') => {
  const meta = variant === 'main' ? INSPECTION_FORMS[tab] : INSPECTION_VARIANT_FORMS[variant];
  return {
    decision: `Số: ${INSPECTION_DECISION}`,
    form: meta.form,
    title: meta.step ? `${meta.step}: ${meta.title}` : meta.title,
    part: meta.part,
    date: longDate(date),
  };
};

/** M4: mỗi bữa một nhãn gồm tên các mẫu thức ăn và giờ lấy mẫu (BE ghi theo bữa, các món cùng một giờ). */
export const inspectionLabels = (data) => {
  const groups = new Map();
  data.rows.forEach((row) => {
    if (!groups.has(row.session))
      groups.set(row.session, { session: row.session, sessionLabel: row.sessionLabel, dishes: [], takenAt: row.takenAt });
    groups.get(row.session).dishes.push(row.dishName);
  });
  return [...groups.values()];
};

const variantLabel = (tab, variant) => INSPECTION_PRINT_VARIANTS[tab].find((v) => v.key === variant)?.label || '';

/** Dòng cho file Excel: tiêu đề, phần đầu, bảng, người ký. Dòng tiêu đề bảng nằm ở `headerRow`. */
export const inspectionExportRows = (tab, data, { date, campusName, variant = 'main', sampleData } = {}) => {
  const head = inspectionTitle(tab, date, variant);
  const fileBase = `kiem-thuc-${tab}${variant === 'main' ? '' : `-${variant}`}-${date}`;
  const sheetName = variantLabel(tab, variant).replace(/[·]/g, '-').slice(0, 31);
  if (variant === 'label') {
    const intro = [[head.title], [`${head.decision} · ${head.form}`], [head.date]];
    return {
      rows: [
        ...intro,
        ['Bữa ăn', 'Tên mẫu thức ăn', 'Thời gian lấy mẫu'],
        ...inspectionLabels(data).map((l) => [l.sessionLabel, l.dishes.join(', '), l.takenAt ? formatDateTime(l.takenAt) : '']),
      ],
      headerRow: intro.length,
      fileBase,
      sheetName,
    };
  }
  const columns = inspectionColumns(tab, variant);
  const { leaves } = buildHeader(columns);
  const rowsOut = inspectionRows(tab, variant, data, sampleData);
  const intro = [
    [head.title],
    [`${head.decision} · ${head.form}`],
    [head.date],
    ['Tên đơn vị', campusName || ''],
    ['Thời gian kiểm tra', data.header?.checkedAt ? formatDateTime(data.header.checkedAt) : ''],
    ['Địa điểm kiểm tra', data.header?.place || ''],
    ...(head.part ? [[head.part]] : []),
  ];
  const sig = data.signature && data.signature.valid !== false ? data.signature : null;
  const rows = [
    ...intro,
    ['TT', ...inspectionLeafLabels(columns)],
    ...rowsOut.map((row, index) => [index + 1, ...leaves.map((leaf) => inspectionCellText(leaf, row))]),
    [],
    ['Người kiểm tra', sig ? `${sig.signedByName} (ký ảnh lúc ${formatDateTime(sig.signedAt)})` : 'Chưa xác nhận'],
  ];
  return { rows, headerRow: intro.length, fileBase, sheetName };
};
