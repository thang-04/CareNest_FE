import { useId } from 'react';
import { Info } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';

/** Một câu của phiếu Phụ lục II: nhóm radio theo lựa chọn của mẫu. Lựa chọn bất thường đang chọn thì viền cảnh báo; option.disabled khóa riêng lựa chọn đó. */
export function ExamChoiceField({ name, label, options, value, onChange, error, hint, required = true, disabled }) {
  const flagged = options.find((o) => o.value === value)?.abnormal;
  return (
    <fieldset className={`field tr-fieldset tr-exam-choice ${flagged ? 'tr-exam-choice--flag' : ''}`}>
      <legend className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </legend>
      <div className="tr-radio-row">
        {options.map((o) => (
          <label key={o.value} className={`radio ${disabled || o.disabled ? 'radio--disabled' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={disabled || o.disabled}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </fieldset>
  );
}

/** Ô số của phiếu (cm, kg, lần/phút…). */
export function ExamNumberField({ label, value, onChange, error, hint, required, min, max, step = '0.1', disabled }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <input
        type="number"
        className="input"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

/** Ô chữ của phiếu. */
export function ExamTextField({ label, value, onChange, error, hint, required, maxLength = 100, disabled, multiline }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {multiline ? (
        <textarea
          className="textarea"
          rows={2}
          maxLength={maxLength}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="input" maxLength={maxLength} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </FormField>
  );
}

/*
 * Phiếu khám dạng bảng (user chọn theo bảng phần IV–V, 2026-11-04): mọi phần một kiểu bảng 3 cột TT, nội dung kiểm tra, kết quả,
 * không dòng tiêu đề cột, mọi ô nền trắng; phần I–VI và Kết luận là dải xanh đậm chữ in hoa, nhóm con là dải xanh nhạt; TT đánh lại
 * từ 1 sau mỗi dải.
 */

/** Tên các phần của mẫu, ghi trên dải xanh đậm (form và trang xem phiếu). */
export const EXAM_SECTIONS = {
  admin: 'I. Thông tin hành chính',
  vitals: 'II. Đánh giá dấu hiệu sinh tồn',
  nutrition: 'III. Đánh giá dinh dưỡng',
  development: 'IV. Đánh giá phát triển tinh thần – vận động',
  immunization: 'V. Đánh giá tiêm chủng',
  clinical: 'VI. Khám lâm sàng',
  conclusion: 'Kết luận và tư vấn',
};

const cx = (...names) => names.filter(Boolean).join(' ') || undefined;

/** Lựa chọn đang chọn là bất thường theo mẫu (tô nền cảnh báo ô kết quả). */
const abnormalOf = (options, value) => !!options.find((o) => o.value === value)?.abnormal;

/** Card của một bước: tiêu đề = tên bước, hướng dẫn ngắn (info) trên bảng, ghi chú mờ (note) dưới bảng. */
export function ExamSheetCard({ title, info, note, children }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
      </div>
      <div className="card__body">
        {info && (
          <div className="alert alert--info mb-12">
            <Info size={18} />
            <div>{info}</div>
          </div>
        )}
        {children}
        {note && <p className="tr-exam-note muted text-sm">{note}</p>}
      </div>
    </section>
  );
}

/**
 * Bảng phiếu 3 cột (TT, nội dung kiểm tra, kết quả), không dòng tiêu đề cột (user bỏ 2026-11-04): dải phần là tiêu đề. Con là dải
 * (ExamSheetBand) và dòng (ExamSheetRows).
 */
export function ExamSheetTable({ label, children }) {
  return (
    <div className="table-wrap">
      <table className="table table--grid tr-exam-sheet" aria-label={label}>
        <colgroup>
          <col className="tr-exam-sheet__col--tt" />
          <col className="tr-exam-sheet__col--item" />
          <col />
        </colgroup>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Dải trải hết bảng: primary = phần của mẫu (xanh đậm, chữ in hoa như dải lĩnh vực của Kế hoạch chủ đề); còn lại = nhóm con. */
export function ExamSheetBand({ primary, children }) {
  return (
    <tr>
      <td colSpan={3} className={cx('tr-exam-sheet__band', primary && 'tr-exam-sheet__band--primary')}>
        <h3>{children}</h3>
      </td>
    </tr>
  );
}

/**
 * Các dòng của một nhóm, TT đánh lại từ 1. rows: { key, label, id, required, cell } — id của ô nhãn để ô nhập, nhóm lựa chọn lấy
 * làm tên (aria-labelledby); cell là ô kết quả (<td> hoặc ExamSheet*Cell); phần tử rỗng (dòng có điều kiện) bị bỏ.
 */
export function ExamSheetRows({ rows }) {
  return rows.filter(Boolean).map((r, i) => (
    <tr key={r.key}>
      <td className="num">{i + 1}</td>
      <th scope="row" id={r.id}>
        {r.label}
        {r.required && <span className="req">*</span>}
      </th>
      {r.cell}
    </tr>
  ));
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

function CellMessage({ id, error, hint }) {
  if (error)
    return (
      <span className="field__error" id={`${id}-error`} role="alert">
        {error}
      </span>
    );
  return hint ? (
    <span className="field__hint" id={`${id}-hint`}>
      {hint}
    </span>
  ) : null;
}

/** Nhóm radio của mẫu, xếp ngang (xuống dòng khi hẹp). */
function Choices({ name, labelledBy, ariaLabel, describedBy: describedById, options, value, onChange, disabled }) {
  return (
    <fieldset className="tr-fieldset" aria-labelledby={labelledBy} aria-label={ariaLabel} aria-describedby={describedById}>
      <div className="tr-exam-sheet__options">
        {options.map((o) => (
          <label key={o.value} className={cx('radio', (disabled || o.disabled) && 'radio--disabled')}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={disabled || o.disabled}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Ô kết quả là một nhóm radio; children (ô nhập phụ khi trả lời "Có") vẽ dưới nhóm. Lựa chọn bất thường ⇒ tô nền cảnh báo cả ô. */
export function ExamSheetChoiceCell({ name, labelledBy, ariaLabel, options, value, onChange, error, hint, disabled, children }) {
  const id = useId();
  return (
    <td className={abnormalOf(options, value) ? 'tr-exam-sheet__flag' : undefined}>
      <Choices
        name={name}
        labelledBy={labelledBy}
        ariaLabel={ariaLabel}
        describedBy={describedBy(id, error, hint)}
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      <CellMessage id={id} error={error} hint={hint} />
      {children}
    </td>
  );
}

/** Ô tích chọn nhiều (tình trạng dinh dưỡng, kết luận); có lựa chọn bất thường đang tích thì tô nền cảnh báo như ô radio. */
export function ExamSheetChecksCell({ labelledBy, options, values, onToggle, error, hint, disabled }) {
  const id = useId();
  const flagged = options.some((o) => o.abnormal && values.includes(o.value));
  return (
    <td className={flagged ? 'tr-exam-sheet__flag' : undefined}>
      <fieldset className="tr-fieldset" aria-labelledby={labelledBy} aria-describedby={describedBy(id, error, hint)}>
        <div className="tr-exam-sheet__options">
          {options.map((o) => (
            <label key={o.value} className={cx('checkbox', (disabled || o.disabled) && 'radio--disabled')}>
              <input
                type="checkbox"
                checked={values.includes(o.value)}
                disabled={disabled || o.disabled}
                onChange={() => onToggle(o.value)}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <CellMessage id={id} error={error} hint={hint} />
    </td>
  );
}

const inputClass = (size, error) => cx('input', size && `tr-exam-sheet__input--${size}`, error && 'is-invalid');

/**
 * Ô kết quả là một ô nhập (số, chữ, ngày; multiline ⇒ ô nhiều dòng); lỗi, gợi ý dưới ô nhập. size: num | date | short giới hạn độ
 * rộng ô ngắn; children vẽ thêm sau ô nhập (datalist).
 */
export function ExamSheetInputCell({ labelledBy, value, onChange, error, hint, disabled, multiline, size, children, ...inputProps }) {
  const id = useId();
  const common = {
    id,
    value: value ?? '',
    disabled,
    'aria-labelledby': labelledBy,
    'aria-invalid': !!error || undefined,
    'aria-describedby': describedBy(id, error, hint),
    onChange: (e) => onChange(e.target.value),
  };
  return (
    <td>
      {multiline ? (
        <textarea className={cx('textarea', error && 'is-invalid')} rows={2} {...common} {...inputProps} />
      ) : (
        <input className={inputClass(size, error)} {...common} {...inputProps} />
      )}
      {children}
      <CellMessage id={id} error={error} hint={hint} />
    </td>
  );
}

/**
 * Ô số đo kèm trạng thái (sinh tồn, vòng đầu): ô số và nhóm radio cùng một dòng; dưới là lỗi, khoảng tham khảo (mờ), gợi ý.
 * status: { name, labelledBy | ariaLabel, options, value, onChange, error, hint }.
 */
export function ExamSheetMeasureCell({ labelledBy, value, onChange, error, min, max, step, disabled, status, reference }) {
  const id = useId();
  const statusId = `${id}-status`;
  return (
    <td className={abnormalOf(status.options, status.value) ? 'tr-exam-sheet__flag' : undefined}>
      <div className="tr-exam-sheet__line">
        <input
          type="number"
          inputMode="decimal"
          className={inputClass(null, error)}
          id={id}
          value={value ?? ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-labelledby={labelledBy}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <Choices
          name={status.name}
          labelledBy={status.labelledBy}
          ariaLabel={status.ariaLabel}
          describedBy={describedBy(statusId, status.error, status.hint)}
          options={status.options}
          value={status.value}
          onChange={status.onChange}
          disabled={disabled}
        />
      </div>
      <CellMessage id={id} error={error} />
      <CellMessage id={statusId} error={status.error} />
      {reference && <span className="field__hint">{reference}</span>}
      {!status.error && <CellMessage id={statusId} hint={status.hint} />}
    </td>
  );
}

/** Ô nhập phụ trong ô kết quả (tên bệnh, ngày tiếp xúc khi trả lời "Có"): nhãn ngắn trước ô nhập, lỗi dưới. */
export function ExamSheetDetail({ label, required, value, onChange, error, size, disabled, ...inputProps }) {
  const id = useId();
  return (
    <div className="tr-exam-sheet__detail">
      <label htmlFor={id} className="tr-exam-sheet__detail-label">
        {label}
        {required && <span className="req">*</span>}
      </label>
      <input
        id={id}
        className={inputClass(size, error)}
        value={value ?? ''}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...inputProps}
      />
      <CellMessage id={id} error={error} />
    </div>
  );
}
