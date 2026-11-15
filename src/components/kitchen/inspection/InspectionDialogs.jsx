import { useState } from 'react';
import { DateInput } from '@/components/kitchen/inspection/InspectionInputs';
import { FormField } from '@/components/form/FormField';
import { PenLine } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useInspectionSuppliers } from '@/hooks/kitchen/useInspectionDay';
import { formatDateTime } from '@/utils/format';
import { normalizeDate, normalizeTime, toDisplayDate } from '@/utils/kitchen/inspectionForm';

/** Nhóm thẻ chọn một trong nhiều phương án (mỗi thẻ có tiêu đề và dòng chú thích). */
function RadioCards({ legend, name, value, options, onChange, inline }) {
  return (
    <fieldset className={`kr-scope ${inline ? 'kr-scope--inline' : ''}`}>
      <legend className="kr-scope__legend">{legend}</legend>
      {options.map((option) => (
        <label key={String(option.value)} className={`kr-scope__opt ${value === option.value ? 'is-active' : ''}`}>
          <input type="radio" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
          <span className="kr-scope__text">
            <strong>{option.title}</strong>
            <span className="text-xs muted">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Chọn áp cho dòng còn trống hay mọi dòng (mặc định chỉ dòng trống, không đè phần đã nhập). */
const SCOPES = [
  { value: true, title: 'Chỉ các dòng còn trống', hint: 'Giữ nguyên những ô đã nhập' },
  { value: false, title: 'Tất cả các dòng', hint: 'Ghi đè cả những ô đã nhập' },
];

function ScopeChoice({ value, onChange }) {
  return <RadioCards legend="Áp dụng cho" name="kr-scope" value={value} options={SCOPES} onChange={onChange} />;
}

function DialogFooter({ onClose, onApply, disabled, applyLabel, danger }) {
  return (
    <>
      <button type="button" className="btn" onClick={onClose}>
        Hủy
      </button>
      <button type="button" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} disabled={disabled} onClick={onApply}>
        {applyLabel}
      </button>
    </>
  );
}

const FILL_HINTS = {
  text: 'Gõ nội dung rồi nhấn Enter để điền.',
  time: 'Chọn giờ bằng biểu tượng đồng hồ hoặc gõ giờ, phút. Nhấn Enter để điền.',
  date: 'Gõ ngày liền, ví dụ 09112026 thành 09/11/2026. Nhấn Enter để điền.',
  select: 'Chọn một giá trị để điền cho cả cột.',
  number: 'Gõ số rồi nhấn Enter để điền.',
};

const FILL_MODES = [
  { value: 'fill', title: 'Điền giá trị', hint: 'Gõ hoặc chọn một giá trị' },
  { value: 'clear', title: 'Xóa nội dung', hint: 'Để trống các ô của cột' },
];

const cellText = (col, value) => {
  if (col.type === 'select') return col.options.find((o) => o.value === value)?.label || '';
  return col.type === 'date' ? toDisplayDate(value) : String(value ?? '');
};

/** Danh sách dòng để tích chọn một số dòng (kèm giá trị hiện có của cột). */
function RowPicker({ col, rows, picked, onChange }) {
  const toggle = (key) => {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };
  return (
    <div className="kr-pick">
      <div className="kr-pick__tools">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange(new Set(rows.map((r) => r.key)))}>
          Chọn tất cả
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange(new Set())}>
          Bỏ chọn
        </button>
        <span className="text-xs muted">
          Đã chọn {picked.size}/{rows.length} dòng
        </span>
      </div>
      <ul className="kr-pick__list">
        {rows.map((row, index) => (
          <li key={row.key}>
            <label className="checkbox kr-pick__row">
              <input type="checkbox" checked={picked.has(row.key)} onChange={() => toggle(row.key)} />
              <span className="kr-pick__name">
                {index + 1}. {row.name}
              </span>
              <span className="text-xs muted kr-pick__value">{cellText(col, row.value)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Điền hoặc xóa một cột: điền một giá trị hay xóa nội dung, áp cho các dòng còn trống, tất cả, hoặc chỉ những dòng tích chọn.
 * `rows`: [{ key, name, value }] giá trị hiện có của cột. `onApply(colKey, value, rowKeys)`; value rỗng nghĩa là xóa. Enter áp dụng.
 */
export function ColumnFillDialog({ col, defaultYear, rows, onApply, onClose }) {
  const [mode, setMode] = useState('fill');
  const [scope, setScope] = useState('empty');
  const [picked, setPicked] = useState(() => new Set());
  const [value, setValue] = useState('');
  const clearing = mode === 'clear';
  const normalized = col.type === 'time' ? normalizeTime(value) : col.type === 'date' ? normalizeDate(value, defaultYear) : value.trim();
  const emptyKeys = rows.filter((r) => String(r.value ?? '').trim() === '').map((r) => r.key);
  let targets = emptyKeys;
  if (scope === 'all') targets = rows.map((r) => r.key);
  else if (scope === 'some') targets = rows.filter((r) => picked.has(r.key)).map((r) => r.key);
  const canApply = targets.length > 0 && (clearing || normalized !== '');
  const scopes = [
    ...(clearing ? [] : [{ value: 'empty', title: `Chỉ các dòng còn trống (${emptyKeys.length})`, hint: 'Giữ nguyên những ô đã nhập' }]),
    { value: 'all', title: `Tất cả các dòng (${rows.length})`, hint: clearing ? 'Xóa cả cột' : 'Ghi đè cả những ô đã nhập' },
    { value: 'some', title: 'Chọn một số dòng', hint: 'Tích những dòng cần áp dụng' },
  ];
  const changeMode = (next) => {
    setMode(next);
    if (next === 'clear' && scope === 'empty') setScope('all');
  };
  const apply = () => {
    if (!canApply) return;
    onApply(col.key, clearing ? '' : normalized, targets);
    onClose();
  };
  const onEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    apply();
  };
  let field;
  if (col.type === 'select') {
    field = (
      <select className="select" value={value} onChange={(e) => setValue(e.target.value)} aria-label={col.label} autoFocus>
        <option value="">— Chọn —</option>
        {col.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (col.type === 'time') {
    // Ô giờ gốc của trình duyệt: bấm biểu tượng đồng hồ để chọn, hoặc gõ giờ, phút
    field = (
      <input
        className="input"
        type="time"
        value={value}
        aria-label={col.label}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onEnter}
      />
    );
  } else if (col.type === 'date') {
    field = (
      <DateInput
        className="input"
        value={value}
        defaultYear={defaultYear}
        onChange={setValue}
        aria-label={col.label}
        onKeyDown={onEnter}
        autoFocus
      />
    );
  } else {
    field = (
      <input
        className="input"
        type={col.type === 'number' ? 'number' : 'text'}
        {...(col.type === 'number' ? { min: 0, step: 'any' } : {})}
        value={value}
        aria-label={col.label}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onEnter}
      />
    );
  }
  return (
    <Modal
      open
      size="md"
      title="Điền hoặc xóa cả cột"
      onClose={onClose}
      footer={
        <DialogFooter
          onClose={onClose}
          onApply={apply}
          disabled={!canApply}
          danger={clearing}
          applyLabel={clearing ? `Xóa ${targets.length} ô` : `Điền ${targets.length} ô`}
        />
      }
    >
      <div className="kr-fill__target">
        <PenLine size={16} aria-hidden="true" />
        <span className="text-sm muted">Cột</span>
        <strong>{col.label}</strong>
      </div>
      <RadioCards legend="Thao tác" name="kr-fill-mode" value={mode} options={FILL_MODES} onChange={changeMode} inline />
      {!clearing && (
        <FormField label="Giá trị điền" hint={FILL_HINTS[col.type]}>
          {field}
        </FormField>
      )}
      <RadioCards legend="Áp dụng cho" name="kr-fill-scope" value={scope} options={scopes} onChange={setScope} />
      {scope === 'some' && <RowPicker col={col} rows={rows} picked={picked} onChange={setPicked} />}
    </Modal>
  );
}

/** Chọn một nhà cung cấp trong danh mục để điền tên cơ sở, địa chỉ + điện thoại, người giao hàng cho cả bảng M1. */
export function SupplierFillDialog({ onApply, onClose }) {
  const suppliers = useInspectionSuppliers(true);
  const [id, setId] = useState('');
  const [onlyEmpty, setOnlyEmpty] = useState(true);
  const chosen = (suppliers.data || []).find((s) => String(s.id) === id);
  const apply = () => {
    onApply(chosen, onlyEmpty);
    onClose();
  };
  let body;
  if (suppliers.error) body = <ErrorState error={suppliers.error} onRetry={suppliers.reload} />;
  else if (suppliers.loading || !suppliers.data) body = <LoadingState />;
  else
    body = (
      <>
        <FormField label="Nhà cung cấp" hint="Điền tên cơ sở, địa chỉ + điện thoại và người giao hàng; sửa riêng từng dòng được.">
          <select className="select" value={id} onChange={(e) => setId(e.target.value)} autoFocus>
            <option value="">— Chọn nhà cung cấp —</option>
            {suppliers.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>
        {chosen && (
          <div className="text-sm muted kr-supplier-preview">
            {[chosen.address, chosen.phone].filter(Boolean).join(' · ') || 'Chưa có địa chỉ, điện thoại'}
            {chosen.contactName && <div>Người giao hàng: {chosen.contactName}</div>}
          </div>
        )}
        <ScopeChoice value={onlyEmpty} onChange={setOnlyEmpty} />
      </>
    );
  return (
    <Modal
      open
      size="sm"
      title="Chọn nhà cung cấp cho cả bảng"
      onClose={onClose}
      footer={<DialogFooter onClose={onClose} onApply={apply} disabled={!chosen} applyLabel="Áp dụng" />}
    >
      {body}
    </Modal>
  );
}

/** Sửa lại mẫu đã ký: bắt buộc ghi lý do; chữ ký cũ vào lịch sử, mẫu về chưa ký và phải ký lại. */
export function ReopenDialog({ busy, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const confirm = async () => {
    if (reason.trim().length < 3) {
      setError('Nhập lý do sửa lại (ít nhất 3 ký tự).');
      return;
    }
    if (await onConfirm(reason.trim())) onClose();
  };
  return (
    <Modal
      open
      size="sm"
      title="Sửa lại mẫu đã ký"
      onClose={onClose}
      footer={<DialogFooter onClose={onClose} onApply={confirm} disabled={busy} applyLabel="Mở khóa để sửa" />}
    >
      <p className="text-sm">
        Mẫu đang khóa vì đã ký. Mở khóa thì chữ ký hiện tại được giữ trong lịch sử, mẫu về trạng thái chưa ký và cần ký lại sau khi sửa.
      </p>
      <FormField label="Lý do sửa lại" required error={error}>
        <textarea
          className="input kr-reason"
          rows={3}
          maxLength={300}
          value={reason}
          autoFocus
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
        />
      </FormField>
    </Modal>
  );
}

const ACTION_LABELS = { SIGNED: 'Đã ký', REOPENED: 'Mở khóa để sửa' };

/** Lịch sử ký và sửa lại của mẫu (mới nhất trước). */
export function InspectionHistory({ history }) {
  if (!history?.length) return null;
  return (
    <section className="kr-history">
      <h3 className="text-sm fw-600">Lịch sử</h3>
      <ul>
        {[...history].reverse().map((item, index) => (
          <li key={`${item.at}-${index}`} className="text-sm">
            <span className="fw-600">{ACTION_LABELS[item.action] || item.action}</span> · {item.byName} · {formatDateTime(item.at)}
            {item.note && <span className="muted"> — {item.note}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
