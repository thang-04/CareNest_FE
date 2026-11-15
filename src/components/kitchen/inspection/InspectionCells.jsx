import { DateInput, TimeInput } from '@/components/kitchen/inspection/InspectionInputs';
import { AlertTriangle } from '@/components/ui/icons';
import { INSPECTION_ACTIONS } from '@/models/kitchen/inspectionConstants';
import { formatDate, formatDateTime, formatQty } from '@/utils/format';
import { sampleWarning } from '@/utils/kitchen/inspectionRules';

/** Gợi ý biện pháp xử lý: bấm để điền vào ô ghi chú (thêm vào sau nếu đã có chữ). */
function ActionChips({ tab, note, onPick }) {
  return (
    <div className="kr-actions" role="group" aria-label="Biện pháp xử lý gợi ý">
      {INSPECTION_ACTIONS[tab].map((action) => (
        <button
          key={action}
          type="button"
          className="kr-action"
          disabled={note.includes(action)}
          onClick={() => onPick(note.trim() ? `${note.trim()}; ${action}` : action)}
        >
          {action}
        </button>
      ))}
    </div>
  );
}

/** Ô chỉ đọc do BE điền sẵn; sổ lưu mẫu (M5) đánh dấu số liệu ngoài mức QĐ 1246 để người soát chú ý. */
function ReadOnlyCell({ tab, col, row }) {
  const value = row[col.key];
  if (col.type === 'timestamp') return <>{value ? formatDateTime(value) : ''}</>;
  if (col.type === 'number') return <>{value == null ? '' : formatQty(value)}</>;
  const warning = tab === 'sample' ? sampleWarning(col.key, value) : '';
  if (!warning) return <>{value}</>;
  return (
    <span className="kr-warn" title={warning}>
      <AlertTriangle size={14} aria-hidden="true" />
      <span>{value}</span>
      <span className="sr-only">{warning}</span>
    </span>
  );
}

/**
 * Một ô thân bảng: chỉ đọc, ô tích, chọn, hoặc ô gõ (giờ, ngày gõ tay; số; chữ có gợi ý từ các dòng đã nhập). Ô ghi chú của dòng
 * Không đạt hiện gợi ý biện pháp xử lý và viền nhắc vì QĐ 1246 yêu cầu ghi rõ biện pháp.
 */
export function BodyCell({ tab, leaf, row, value, error, editable, failed, defaultYear, listId, onChange, onTick, cellId }) {
  const { col } = leaf;
  const ariaLabel = `${col.label}: ${row.name || row.dishName}`;
  const set = (next) => onChange(row.key, col.key, next);
  if (col.readOnly) return <ReadOnlyCell tab={tab} col={col} row={row} />;
  if (col.type === 'check' || col.type === 'passfail') {
    return (
      <input
        type="checkbox"
        className="kr-tick"
        checked={value === leaf.value}
        disabled={!editable}
        aria-label={`${ariaLabel} — ${leaf.text}`}
        onChange={() => onTick(row.key, col, leaf.value)}
      />
    );
  }
  if (!editable) {
    if (col.type === 'select') return <>{col.options.find((o) => o.value === value)?.label || ''}</>;
    if (col.type === 'date') return <>{value ? formatDate(value) : ''}</>;
    return (
      <>
        {value}
        {col.unitKey && value !== '' ? ` ${row[col.unitKey] || ''}` : ''}
      </>
    );
  }
  if (col.type === 'select') {
    return (
      <select
        className={`select ${error ? 'input--error' : ''}`}
        value={value}
        aria-label={ariaLabel}
        data-cell={cellId}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">—</option>
        {col.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  const needsAction = failed && col.key === 'note' && value.trim() === '';
  const common = {
    className: `input ${error ? 'input--error' : ''} ${needsAction ? 'kr-need' : ''}`,
    value,
    'aria-label': ariaLabel,
    'data-cell': cellId,
  };
  let field;
  if (col.type === 'time') field = <TimeInput {...common} onChange={set} />;
  else if (col.type === 'date') field = <DateInput {...common} defaultYear={defaultYear} onChange={set} />;
  else {
    field = (
      <input
        {...common}
        type={col.type === 'number' ? 'number' : 'text'}
        {...(col.type === 'number' ? { min: 0, step: 'any' } : {})}
        {...(listId ? { list: listId } : {})}
        {...(needsAction ? { placeholder: 'Bắt buộc: ghi biện pháp xử lý' } : {})}
        onChange={(e) => set(e.target.value)}
      />
    );
  }
  return (
    <>
      <span className={col.unitKey ? 'kr-qty kr-qty--unit' : col.type === 'time' || col.type === 'date' ? 'kr-qty' : undefined}>
        {field}
        {col.unitKey && (
          <span className="text-xs muted kr-qty__unit" title={row[col.unitKey] || undefined}>
            {row[col.unitKey]}
          </span>
        )}
      </span>
      {failed && col.key === 'note' && <ActionChips tab={tab} note={value} onPick={set} />}
      {error && <div className="field__error">{error}</div>}
    </>
  );
}
