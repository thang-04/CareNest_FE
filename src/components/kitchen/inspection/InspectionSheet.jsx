import { useEffect, useRef, useState } from 'react';
import { BodyCell } from '@/components/kitchen/inspection/InspectionCells';
import { ColumnFillDialog } from '@/components/kitchen/inspection/InspectionDialogs';
import { DateInput, TimeInput } from '@/components/kitchen/inspection/InspectionInputs';
import { FormField } from '@/components/form/FormField';
import { Clock, ListChecks, PenLine } from '@/components/ui/icons';
import { INSPECTION_ACTIONS, INSPECTION_COLUMNS, INSPECTION_DECISION, INSPECTION_FORMS } from '@/models/kitchen/inspectionConstants';
import { buildHeader, columnTick } from '@/utils/kitchen/inspectionForm';
import { isFailed } from '@/utils/kitchen/inspectionRules';

const LIST_COLUMNS = new Set([
  'supplierName',
  'supplierContact',
  'deliveryPerson',
  'manufacturer',
  'manufacturerAddress',
  'mainIngredients',
  'note',
]);
const longDate = (iso) => {
  const [y, m, d] = String(iso).split('-');
  return y && m && d ? `Ngày ${d} tháng ${m} năm ${y}` : '';
};
const FILLABLE = new Set(['text', 'time', 'date', 'select', 'number']);
const DRAGGABLE = FILLABLE;
const EDGE = 40; // khoảng cách tới mép khung cuộn (px) thì bảng bắt đầu tự cuộn khi kéo
const canDrag = (col) => !col.readOnly && DRAGGABLE.has(col.type);

/** Lớp của ô thân bảng: căn giữa giá trị ngắn, có chấm kéo điền, và tô vùng đang kéo. */
const cellClass = (leaf, index, drag) => {
  const { col } = leaf;
  const classes = [col.wide && !col.type.match(/check|passfail/) ? '' : 'kr-sheet__center'];
  if (canDrag(col)) classes.push('kr-fill-cell');
  if (drag && drag.colKey === col.key) {
    if (index === drag.from) classes.push('kr-fill-src');
    else if (index >= Math.min(drag.from, drag.to) && index <= Math.max(drag.from, drag.to)) classes.push('kr-fill-range');
  }
  return classes.filter(Boolean).join(' ');
};
const nowHourMinute = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Biểu tượng bút cạnh nhãn cột nhập chữ, giờ, ngày, lựa chọn: mở hộp thoại điền một giá trị cho cả cột. */
function FillButton({ col, editable, onOpen }) {
  if (!editable || col.readOnly || !FILLABLE.has(col.type)) return null;
  const label = `Điền hoặc xóa cả cột ${col.label}`;
  return (
    <button type="button" className="icon-btn kr-fillbtn" title={label} aria-label={label} onClick={() => onOpen(col)}>
      <PenLine size={16} aria-hidden="true" />
    </button>
  );
}

/** Ô tích cả cột ở tiêu đề: tích hết thì bỏ hết; một phần thì hiện dấu gạch. Đổi trạng thái ngay, chưa lưu. */
function ColumnTick({ form, tick, editable, onToggle }) {
  const state = columnTick(form, tick.col, tick.value);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <label className="kr-tick-all">
      <input
        ref={ref}
        type="checkbox"
        className="kr-tick"
        checked={state === 'all'}
        disabled={!editable}
        aria-label={`Tích tất cả "${tick.text}" cột ${tick.col.label}`}
        onChange={() => onToggle(tick.col, tick.value)}
      />
      <span>{tick.text}</span>
    </label>
  );
}

/** Gợi ý khi gõ chữ: các giá trị đã nhập ở cột đó (nhà cung cấp, nguyên liệu...) và, với ghi chú, các biện pháp xử lý theo QĐ 1246. */
function ColumnSuggestions({ tab, form }) {
  return (
    <>
      {[...LIST_COLUMNS].map((key) => {
        const used = Object.values(form.rows).map((values) => (values[key] || '').trim());
        const options = new Set([...(key === 'note' ? INSPECTION_ACTIONS[tab] || [] : []), ...used.filter(Boolean)]);
        return (
          <datalist key={key} id={`kr-list-${key}`}>
            {[...options].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        );
      })}
    </>
  );
}

// Enter xuống ô cùng cột của dòng dưới (Shift+Enter lên dòng trên); Ctrl+D chép ô dòng trên xuống; Tab sang ô bên là mặc định
const keyboardNav = (onCopyDown) => (event) => {
  const cell = event.target.dataset?.cell;
  if (!cell) return;
  const [index, col] = cell.split(':');
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    onCopyDown(event.target.closest('tr')?.dataset.rowKey, col);
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  const next = event.currentTarget.querySelector(`[data-cell="${Number(index) + (event.shiftKey ? -1 : 1)}:${col}"]`);
  next?.focus();
  next?.select?.();
};

/** Phần đầu biểu mẫu theo QĐ 1246: đơn vị, người kiểm tra, thời gian (ngày + giờ gõ tay), địa điểm kiểm tra. */
function SheetHead({ date, campusName, inspectorName, form, errors, editable, onHeader }) {
  const year = String(date || '').slice(0, 4);
  const failed = errors['header.checkedAt'];
  return (
    <div className="kr-sheet__head">
      <FormField label="Tên đơn vị">
        <input className="input" value={campusName || ''} readOnly aria-readonly="true" />
      </FormField>
      <FormField label="Người kiểm tra">
        <input className="input" value={inspectorName || ''} readOnly aria-readonly="true" />
      </FormField>
      <FormField label="Thời gian kiểm tra" error={failed}>
        <div className="kr-when">
          <DateInput
            className={`input ${failed ? 'input--error' : ''}`}
            value={form.header.checkedDate}
            defaultYear={year}
            disabled={!editable}
            aria-label="Ngày kiểm tra"
            onChange={(v) => onHeader('checkedDate', v)}
          />
          <TimeInput
            className={`input ${failed ? 'input--error' : ''}`}
            value={form.header.checkedTime}
            disabled={!editable}
            aria-label="Giờ kiểm tra"
            onChange={(v) => onHeader('checkedTime', v)}
          />
          {editable && (
            <button
              type="button"
              className="btn btn--sm"
              title="Điền ngày của biên bản và giờ hiện tại"
              onClick={() => {
                onHeader('checkedDate', date);
                onHeader('checkedTime', nowHourMinute());
              }}
            >
              <Clock size={14} /> Bây giờ
            </button>
          )}
        </div>
      </FormField>
      <FormField label="Địa điểm kiểm tra">
        <input
          className="input"
          maxLength={100}
          value={form.header.place}
          disabled={!editable}
          onChange={(e) => onHeader('place', e.target.value)}
        />
      </FormField>
    </div>
  );
}

/**
 * Khung biểu mẫu kiểm thực theo Quyết định 1246/QĐ-BYT như PMS: tiêu đề mẫu, phần đầu (đơn vị, người kiểm tra, thời gian, địa điểm),
 * bảng hai hàng tiêu đề có hàng số cột. Ô Đạt / Không đạt và các ô "Có", "Đảm bảo" là ô tích; ô tiêu đề tích cả cột; nút "Điền cột" ở
 * tiêu đề mở hộp thoại điền một giá trị cho cả cột. Giờ, ngày gõ bằng bàn phím. Chữ dài căn trái, giá trị ngắn căn giữa (DESIGN §8). Dòng Không đạt được tô nhẹ.
 */
export function InspectionSheet({
  tab,
  date,
  campusName,
  inspectorName,
  data,
  form,
  errors,
  editable,
  onField,
  onHeader,
  onTick,
  onTickAll,
  onFillRows,
  onFillRange,
  onCopyDown,
  onSupplier,
}) {
  const meta = INSPECTION_FORMS[tab];
  const { top, sub, leaves } = buildHeader(INSPECTION_COLUMNS[tab]);
  const hasSupplier = tab === 'fresh' || tab === 'dry';
  const [fillCol, setFillCol] = useState(null);
  const [drag, setDrag] = useState(null);
  const year = String(date || '').slice(0, 4);

  // Kéo chấm ở góc ô: tô các dòng trong vùng kéo, thả chuột thì chép giá trị ô nguồn sang vùng đó; kéo sát mép thì bảng tự cuộn
  const startDrag = (event, colKey, from) => {
    event.preventDefault();
    const scroller = event.currentTarget.closest('.kr-sheet__scroll');
    let current = { colKey, from, to: from };
    setDrag(current);
    const move = (e) => {
      if (scroller) {
        const box = scroller.getBoundingClientRect();
        const headBottom = box.top + (scroller.querySelector('thead')?.offsetHeight || 0);
        if (e.clientY > box.bottom - EDGE) scroller.scrollTop += EDGE / 2;
        else if (e.clientY < headBottom + EDGE) scroller.scrollTop -= EDGE / 2;
      }
      const tr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr[data-row-index]');
      const to = tr ? Number(tr.dataset.rowIndex) : null;
      if (to !== null && to !== current.to) {
        current = { ...current, to };
        setDrag(current);
      }
    };
    const stop = (apply) => () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setDrag(null);
      if (apply && current.to !== current.from) onFillRange(colKey, data.rows[current.from].key, data.rows[current.to].key);
    };
    const onUp = stop(true);
    const onCancel = stop(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  return (
    <div className={`kr-sheet ${drag ? 'is-dragging' : ''}`}>
      <div className="kr-sheet__title">
        <div className="kr-sheet__ref">
          Số: {INSPECTION_DECISION}
          <br />
          {meta.form}
        </div>
        <h2>
          {meta.step}: {meta.title}
        </h2>
        <div>{longDate(date)}</div>
      </div>
      <SheetHead
        date={date}
        campusName={campusName}
        inspectorName={inspectorName}
        form={form}
        errors={errors}
        editable={editable}
        onHeader={onHeader}
      />
      <div className="kr-sheet__bar">
        {meta.part && <div className="kr-sheet__part">{meta.part}</div>}
        <div className="kr-sheet__tools">
          {hasSupplier && editable && (
            <button type="button" className="btn btn--sm" onClick={onSupplier}>
              <ListChecks size={14} /> Chọn nhà cung cấp cho cả bảng
            </button>
          )}
        </div>
      </div>
      <ColumnSuggestions tab={tab} form={form} />
      <div className="kr-sheet__scroll">
        <table className="table table--grid kr-sheet__table">
          <thead>
            <tr>
              <th rowSpan={2} className="kr-sheet__tt">
                TT
              </th>
              {top.map((cell) => (
                <th
                  key={cell.key}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  className={cell.colSpan > 1 || !cell.plain ? 'kr-sheet__group' : ''}
                >
                  <span className="kr-sheet__labelrow">
                    <span className="kr-sheet__label">{cell.label}</span>
                    {cell.col && <FillButton col={cell.col} editable={editable} onOpen={setFillCol} />}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              {sub.map((cell) => (
                <th key={cell.key} className="kr-sheet__sub">
                  {cell.label && (
                    <span className="kr-sheet__labelrow">
                      <span className="kr-sheet__label">{cell.label}</span>
                      {cell.col && <FillButton col={cell.col} editable={editable} onOpen={setFillCol} />}
                    </span>
                  )}
                  {cell.tick && <ColumnTick form={form} tick={cell.tick} editable={editable} onToggle={onTickAll} />}
                </th>
              ))}
            </tr>
            <tr className="kr-sheet__nums">
              <th className="kr-sheet__tt">1</th>
              {leaves.map((leaf, index) => (
                <th key={leaf.key}>{index + 2}</th>
              ))}
            </tr>
          </thead>
          <tbody onKeyDown={keyboardNav(onCopyDown)}>
            {data.rows.map((row, index) => {
              const values = form.rows[row.key] || {};
              const failed = isFailed(values);
              return (
                <tr key={row.key} data-row-key={row.key} data-row-index={index} className={failed ? 'kr-row--fail' : ''}>
                  <td className="kr-sheet__tt">{index + 1}</td>
                  {leaves.map((leaf) => (
                    <td key={leaf.key} className={cellClass(leaf, index, drag)}>
                      <BodyCell
                        tab={tab}
                        leaf={leaf}
                        row={row}
                        value={values[leaf.col.key] ?? ''}
                        error={errors[`${row.key}.${leaf.col.key}`]}
                        editable={editable}
                        failed={failed && !!INSPECTION_ACTIONS[tab]}
                        defaultYear={year}
                        listId={LIST_COLUMNS.has(leaf.col.key) ? `kr-list-${leaf.col.key}` : undefined}
                        onChange={onField}
                        onTick={onTick}
                        cellId={`${index}:${leaf.col.key}`}
                      />
                      {editable && canDrag(leaf.col) && (values[leaf.col.key] ?? '') !== '' && (
                        <span
                          className="kr-handle"
                          title="Kéo xuống hoặc lên để chép ô này sang các dòng khác"
                          onPointerDown={(e) => startDrag(e, leaf.col.key, index)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {fillCol && (
        <ColumnFillDialog
          col={fillCol}
          defaultYear={year}
          rows={data.rows.map((row) => ({
            key: row.key,
            name: row.name || row.dishName,
            value: form.rows[row.key]?.[fillCol.key] ?? '',
          }))}
          onApply={onFillRows}
          onClose={() => setFillCol(null)}
        />
      )}
      {editable && (
        <p className="text-xs muted kr-sheet__keys">
          Gõ giờ liền (730 → 07:30), ngày liền (09112026). Enter: xuống ô dưới · Shift+Enter: lên · Ctrl+D: chép ô dòng trên · Tab: sang ô
          bên. Nhập một ô rồi kéo chấm ở góc ô xuống (hoặc lên) để chép cho các dòng khác.
        </p>
      )}
    </div>
  );
}
