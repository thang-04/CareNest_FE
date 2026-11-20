import { Fragment, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DishInfoModal } from '@/components/menu-planning/DishInfoModal';
import { DishKcal } from '@/components/menu-planning/MenuBadges';
import { ArrowLeftRight, Info } from '@/components/ui/icons';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { DISH_TYPE_LABELS, EVAL_ROW_LABELS, EVAL_ROW_UNITS, MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { dayBlocking, nutritionRows, sectionsOf } from '@/utils/menu-planning/menuAiDraftGrid';
import { formatQty, formatWeekdayDate } from '@/utils/format';

// Tên ngắn trong bảng gợi ý; cơ cấu đạm–béo–bột đường tính theo % năng lượng nên ghi rõ ở đơn vị
const NUTRIENT_LABELS = { protein: 'Đạm', lipid: 'Béo', glucid: 'Bột đường', glucidG: 'Bột đường (gam)' };
const NUTRIENT_NOTE = { LOW: 'Thấp', HIGH: 'Cao', OK: 'Đạt', NA: 'Chưa đặt định mức', INCOMPLETE: 'Thiếu dữ liệu' };
const KCAL_NOTE = { ...NUTRIENT_NOTE, LOW: 'Thiếu', HIGH: 'Thừa' };
const NUTRIENT_TONE = { LOW: 'low', HIGH: 'high', OK: 'ok' };
const nutrientLabel = (key) => NUTRIENT_LABELS[key] || EVAL_ROW_LABELS[key] || key;
const nutrientUnit = (row, long) => (row.share ? (long ? '% năng lượng' : '%') : ` ${EVAL_ROW_UNITS[row.key] || ''}`);
const nutrientNeed = (row) =>
  row.min == null && row.max == null
    ? ''
    : `Cần ${row.min != null ? formatQty(row.min) : '…'}–${row.max != null ? formatQty(row.max) : '…'}${nutrientUnit(row, true)}`;
const nutrientValue = (row, value) =>
  value == null
    ? '—'
    : `${formatQty(row.key === 'kcal' ? Math.round(Number(value)) : Math.round(Number(value) * 10) / 10)}${nutrientUnit(row)}`;

/**
 * Dinh dưỡng cả ngày so với định mức, cùng kiểu bảng với phần món: mỗi chỉ số một hàng (nhãn hàng ghi mức cần), mỗi ngày
 * một ô ghi số thực tế và chữ Đạt/Thấp/Cao — không chỉ dựa vào màu.
 */
function NutritionRows({ columns, evaluations, kcalAgeGroup }) {
  const dates = columns.filter((col) => !col.off && col.date).map((col) => col.date);
  const { rows, ageGroupName, multiGroup } = nutritionRows(evaluations, dates, kcalAgeGroup);
  if (rows.length === 0) return null;
  return (
    <>
      <tr className="td-week__band">
        <th scope="colgroup" colSpan={columns.length + 1}>
          Dinh dưỡng cả ngày so với định mức
          {multiGroup && ageGroupName && <span className="td-aig__band-note"> · theo {ageGroupName}</span>}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="td-aig__nut">
          <th scope="row" className="td-week__label">
            {nutrientLabel(row.key)}
            {nutrientNeed(row) && <small>{nutrientNeed(row)}</small>}
          </th>
          {columns.map((col) => {
            const cell = col.off ? null : row.cells[col.date];
            if (!cell) return <td key={col.key} className={col.off ? 'td-week__off' : 'td-aig__nut-cell'} />;
            const note = (row.key === 'kcal' ? KCAL_NOTE : NUTRIENT_NOTE)[cell.status] || '';
            return (
              <td key={col.key} className={`td-aig__nut-cell td-aig__nut-cell--${NUTRIENT_TONE[cell.status] || 'muted'}`}>
                <b>{nutrientValue(row, cell.value)}</b>
                <small>{note}</small>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

const slotLabel = (slot) => (slot.dishTypes || []).map((type) => DISH_TYPE_LABELS[type] || type).join(' / ') || 'Món';

/**
 * Bảng gợi ý thực đơn như sổ thực đơn tuần: cột là ngày, mỗi bữa một dải tiêu đề, mỗi ô (hàng) đúng một món. Đầu cột có
 * nhãn kết quả BE chấm ("Đạt" / "N lỗi"), cuối bảng là dinh dưỡng cả ngày so với định mức (mỗi chỉ số một hàng). `editor` có ⇒ ô chọn được và nhận kéo thả
 * (đặt trong DndContext); không có ⇒ chỉ xem (mẫu ngày, thay một món, nháp đã dùng). Thẻ món có cụm icon như lưới kế hoạch
 * tuần: thay món (chọn ô để lấy món ở cột bên phải, chỉ khi sửa được) và thông tin món.
 */
export function MenuAiDraftGrid({ columns, slots, cells, original, issues, evaluations, dishById, kcalAgeGroup, dayLabel, editor }) {
  const sections = sectionsOf(slots);
  const cols = columns.length + 1;
  const showTotals = (evaluations || []).length > 0;
  // Món đang xem thông tin (hộp thoại xem nhanh như ở lưới kế hoạch tuần)
  const [info, setInfo] = useState(null);
  return (
    <div className="table-wrap td-week-wrap td-aig-wrap">
      <table className="table table--grid td-week td-aig">
        <thead>
          <tr>
            <th className="td-week__label">
              <span className="sr-only">Loại món</span>
            </th>
            {columns.map((col) => {
              const blocking = col.date ? dayBlocking(issues, col.date) : [];
              return (
                <th key={col.key} scope="col">
                  <div className="td-week__day">
                    <b>{col.date ? formatWeekdayDate(col.date) : dayLabel || 'Ngày mẫu'}</b>
                    <div className="td-week__day-foot">
                      {col.off ? (
                        <span className="text-xs muted">Nghỉ</span>
                      ) : (
                        col.date && (
                          <StatusBadge
                            tone={blocking.length ? 'red' : 'green'}
                            label={blocking.length ? `${blocking.length} lỗi` : 'Đạt'}
                          />
                        )
                      )}
                    </div>
                    {col.reason && <span className="text-xs muted td-aig__reason">{col.reason}</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.session}>
              <tr className="td-week__band">
                <th scope="colgroup" colSpan={cols}>
                  {MEAL_SESSION_LABELS[section.session] || section.session}
                </th>
              </tr>
              {section.slots.map((slot) => (
                <tr key={slot.key}>
                  <th scope="row" className="td-week__label">
                    {slotLabel(slot)}
                  </th>
                  {columns.map((col) =>
                    col.off ? (
                      <td key={col.key} className="td-week__off" />
                    ) : (
                      <Cell
                        key={col.key}
                        col={col}
                        slot={slot}
                        dish={cells[col.key]?.[slot.key]}
                        changed={
                          !!original &&
                          String(original[col.key]?.[slot.key]?.dishId ?? '') !== String(cells[col.key]?.[slot.key]?.dishId ?? '')
                        }
                        dishById={dishById}
                        kcalAgeGroup={kcalAgeGroup}
                        editor={editor}
                        dayLabel={dayLabel}
                        onInfo={setInfo}
                      />
                    ),
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
          {showTotals && <NutritionRows columns={columns} evaluations={evaluations} kcalAgeGroup={kcalAgeGroup} />}
        </tbody>
      </table>
      {info && <DishInfoModal dishId={info.id} fallbackName={info.name} onClose={() => setInfo(null)} />}
    </div>
  );
}

function Cell({ col, slot, dish, changed, dishById, kcalAgeGroup, editor, dayLabel, onInfo }) {
  const where = `${col.date ? formatWeekdayDate(col.date) : dayLabel || 'ngày mẫu'}, ${MEAL_SESSION_LABELS[slot.session] || slot.session}, ${slotLabel(slot)}`;
  const name = dish?.dishName || 'Món đã xóa';
  const cardClass = dish
    ? `td-dish td-aig__dish ${dishTypeClass(dish.dishType)}${changed ? ' td-aig__dish--changed' : ''}`
    : 'td-aig__dish td-aig__dish--empty';
  const kcal = dish && <DishKcal dish={dishById?.[String(dish.dishId)]} ageGroup={kcalAgeGroup} />;
  const infoButton = dish && (
    <button
      type="button"
      className="icon-action"
      aria-label={`Thông tin ${name}`}
      title={`Thông tin ${name}`}
      onClick={() => onInfo({ id: dish.dishId, name })}
    >
      <Info size={16} aria-hidden="true" />
    </button>
  );
  if (!editor) {
    return (
      <td>
        {dish ? (
          <span className={cardClass}>
            <span className="td-grow td-aig__name">{name}</span>
            {kcal}
            <span className="td-dish__actions">{infoButton}</span>
          </span>
        ) : (
          <span className="text-xs muted">Chưa có món</span>
        )}
      </td>
    );
  }
  return (
    <EditableCell col={col} slot={slot} dish={dish} editor={editor} where={where} name={name} cardClass={cardClass} kcal={kcal}>
      {infoButton}
    </EditableCell>
  );
}

function EditableCell({ col, slot, dish, editor, where, name, cardClass, kcal, children }) {
  const id = `${col.key}|${slot.key}`;
  const drop = useDroppable({ id: `drop:${id}`, data: { day: col.key, slot: slot.key } });
  const drag = useDraggable({ id: `cell:${id}`, data: { from: 'cell', day: col.key, slot: slot.key, dish }, disabled: !dish });
  const selected = editor.selected?.day === col.key && editor.selected?.slot === slot.key;
  const toggle = () => editor.onSelect(selected ? null : { day: col.key, slot: slot.key });
  // Đang kéo: ô nhận được món sáng lên, ô không nhận được mờ đi (không chỉ dựa vào màu: con trỏ và nhãn cũng đổi)
  const state = editor.dragging ? (editor.canDropAt(col.key, slot.key) ? 'ok' : 'no') : '';
  return (
    <td
      ref={drop.setNodeRef}
      className={`td-aig__cell${selected ? ' is-selected' : ''}${state ? ` is-drop-${state}` : ''}${drop.isOver && state === 'ok' ? ' is-over' : ''}`}
    >
      <span className={cardClass}>
        {/* Tên món là tay kéo và nút chọn ô; cụm icon nằm ngoài nút này để không lồng nút trong nút */}
        <button
          type="button"
          ref={drag.setNodeRef}
          className={`td-aig__pick td-aig__name${drag.isDragging ? ' is-dragging' : ''}`}
          aria-pressed={selected}
          aria-label={`${where}: ${dish ? name : 'chưa có món'}. Bấm để chọn ô rồi chọn món thay ở danh sách món`}
          onClick={toggle}
          {...drag.listeners}
          {...drag.attributes}
        >
          {dish ? name : <span className="text-xs muted">Chưa có món</span>}
        </button>
        {kcal}
        <span className="td-dish__actions">
          <button
            type="button"
            className="icon-action"
            aria-pressed={selected}
            aria-label={dish ? `Thay ${name}` : `Chọn món cho ô ${where}`}
            title={dish ? `Thay ${name}: chọn món ở cột bên phải` : 'Chọn món ở cột bên phải'}
            onClick={toggle}
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
          </button>
          {children}
        </span>
      </span>
    </td>
  );
}
