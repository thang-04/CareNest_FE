import { useState } from 'react';
import { Button } from '@/components';
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, pointerWithin, useSensor, useSensors } from '@dnd-kit/core';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, RotateCcw } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Spinner } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AiDraftLabel } from '@/components/menu-planning/MenuBadges';
import { MealPlanIssueList } from '@/components/menu-planning/MealPlanIssueList';
import { MenuAiDraftGrid } from '@/components/menu-planning/MenuAiDraftGrid';
import { MenuAiDishPalette, selectedCellLabel } from '@/components/menu-planning/MenuAiDishPalette';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { MENU_AI_CHECK_LABELS, MENU_AI_CHECK_TONES } from '@/models/menu-planning/menuPlanningConstants';
import { sourceText } from '@/utils/menu-planning/menuAiDraft';
import { columnsOf, dataLimitNote, dropBlocker, replaceCell, swapCells, unmetDays } from '@/utils/menu-planning/menuAiDraftGrid';

// Bốn tiêu chí hiện thẳng trên thanh trạng thái; còn lại nằm trong bảng kiểm đầy đủ
const HEADLINE_CHECKS = ['NORM_BALANCE', 'OVER_BUDGET', 'DISH_REPEATED', 'DRY_STOCK_OUT'];
const HEADLINE_LABELS = { NORM_BALANCE: 'Định mức', OVER_BUDGET: 'Giá suất', DISH_REPEATED: 'Lặp món', DRY_STOCK_OUT: 'Kho khô' };

/**
 * Bản gợi ý tuần sửa được (AI-02): bảng thực đơn 7 phần, cột món của trường 3 phần. Kéo món vào ô để thay, kéo thẻ trong
 * bảng sang ngày khác cùng hàng để đổi chỗ; không dùng chuột thì chọn ô rồi bấm món. Mỗi lần đổi, BE chấm lại điểm, lỗi
 * và bảng kiểm (hook `useMenuAiDraftEditor`); FE không tự tính dinh dưỡng (NUT-05).
 */
export function MenuAiWeekEditor({ draft, editor, dishById, kcalAgeGroup }) {
  const toast = useToast();
  const [selected, setSelected] = useState(null);
  const [active, setActive] = useState(null);
  const [showChecks, setShowChecks] = useState(false);
  // Chuột phải rê 6px mới tính là kéo để bấm chọn ô không bị nhấc món; cảm ứng dùng cách chọn ô rồi bấm món
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const columns = columnsOf(draft);
  const { cells, original, bySlot, assessment } = editor;
  const { ai, baseline } = draft.score || {};
  const unmet = unmetDays(assessment.issues, columns);
  const limitNote = dataLimitNote(assessment.checks);

  const blockerAt = (day, slot, dishId) => dropBlocker({ cells, original, bySlot, day, slot, dishId });
  const place = (day, slot, dish) => {
    if (String(cells[day]?.[slot]?.dishId) === String(dish.dishId)) return;
    const blocker = blockerAt(day, slot, dish.dishId);
    if (blocker) toast.error(blocker);
    else editor.change(replaceCell(cells, day, slot, dish));
  };
  const swap = (from, to) => {
    const a = cells[from.day]?.[from.slot];
    const b = cells[to.day]?.[to.slot];
    if (!a || !b) return;
    // Đổi chỗ phải hợp lệ ở cả hai ô sau khi đổi
    const next = swapCells(cells, from.day, to.day, from.slot);
    const blocker =
      dropBlocker({ cells: next, original, bySlot, day: to.day, slot: to.slot, dishId: a.dishId }) ||
      dropBlocker({ cells: next, original, bySlot, day: from.day, slot: from.slot, dishId: b.dishId });
    if (blocker) toast.error(blocker);
    else editor.change(next);
  };
  // Ô nhận được món đang kéo: từ cột món ⇒ món hợp ô; từ bảng ⇒ chỉ ô khác cùng hàng
  const canDropAt = (day, slot) => {
    if (!active) return false;
    if (active.from === 'cell') return active.slot === slot && active.day !== day;
    return !blockerAt(day, slot, active.dish.dishId);
  };
  const onDragEnd = ({ over }) => {
    const source = active;
    setActive(null);
    const target = over?.data?.current;
    if (!source || !target) return;
    if (source.from === 'palette') place(target.day, target.slot, source.dish);
    else if (source.slot === target.slot && source.day !== target.day) swap(source, target);
    else if (source.slot !== target.slot) toast.error('Chỉ đổi chỗ được giữa các ngày của cùng một hàng');
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active: item }) => setActive(item.data.current)}
      onDragCancel={() => setActive(null)}
      onDragEnd={onDragEnd}
    >
      <div className="td-aie">
        <div className="td-aie__bar" aria-live="polite">
          <AiDraftLabel />
          {draft.source && (
            <span className="chip chip--gray">
              {sourceText(draft)}
              {editor.edited > 0 && ` · đã sửa ${editor.edited} ô`}
            </span>
          )}
          <span className="td-aie__score">
            {editor.evaluating ? (
              <>
                <Spinner small /> Đang chấm lại…
              </>
            ) : (
              <>
                Điểm <strong>{assessment.total ?? '—'}</strong>
                {editor.edited > 0 && <span className="muted"> (gợi ý gốc {draft.source === 'AI' ? ai : baseline})</span>}
              </>
            )}
          </span>
          {editor.evaluateError && (
            <span className="td-aie__stale">
              <AlertCircle size={15} aria-hidden="true" /> Chưa chấm lại được
              <Button variant="ghost" size="sm" onClick={editor.reevaluate}>
                Chấm lại
              </Button>
            </span>
          )}
          <span className="td-aie__checks">
            {assessment.checks
              .filter((check) => HEADLINE_CHECKS.includes(check.code))
              .map((check) => (
                <StatusBadge
                  key={check.code}
                  tone={MENU_AI_CHECK_TONES[check.status] || 'gray'}
                  label={`${HEADLINE_LABELS[check.code]}: ${MENU_AI_CHECK_LABELS[check.status] || check.status}`}
                />
              ))}
          </span>
          <span className="td-aie__actions">
            <Button variant="ghost" size="sm" onClick={editor.undo} disabled={!editor.canUndo}>
              <RotateCcw size={14} /> Hoàn tác
            </Button>
            <Button variant="ghost" size="sm" onClick={editor.reset} disabled={editor.edited === 0}>
              Về gợi ý gốc
            </Button>
          </span>
        </div>
        {draft.feasible === false && editor.edited === 0 && (
          <div className="alert alert--warning">
            <AlertCircle size={18} />
            <div>
              <strong>Chưa đạt định mức, cần sửa tay.</strong> Món đang dùng của trường chưa ghép được thực đơn đạt định mức. Đổi món ở các
              ngày còn lỗi; thực đơn chỉ công bố được khi hết lỗi.
            </div>
          </div>
        )}
        <div className="td-aie__body">
          <div className="td-aie__main">
            <MenuAiDraftGrid
              columns={columns}
              slots={draft.slots || []}
              cells={cells}
              original={original}
              issues={assessment.issues}
              evaluations={assessment.evaluations}
              dishById={dishById}
              kcalAgeGroup={kcalAgeGroup}
              editor={{ selected, onSelect: setSelected, dragging: !!active, canDropAt }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="td-aie__toggle"
              aria-expanded={showChecks}
              onClick={() => setShowChecks((v) => !v)}
            >
              {showChecks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showChecks ? 'Ẩn bảng kiểm' : `Xem ${assessment.checks.length} tiêu chí và lưu ý`}
            </Button>
            {showChecks && (
              <section className="td-checks" aria-label="Bảng kiểm tiêu chí">
                <ul className="td-issue-list">
                  {assessment.checks.map((check) => (
                    <li key={check.code} className="td-issue">
                      <StatusBadge
                        tone={MENU_AI_CHECK_TONES[check.status] || 'gray'}
                        label={MENU_AI_CHECK_LABELS[check.status] || check.status}
                      />
                      <span className="td-issue__text">
                        <strong>{check.label}:</strong> {check.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                {assessment.issues.length > 0 && <MealPlanIssueList issues={assessment.issues} />}
              </section>
            )}
          </div>
          <MenuAiDishPalette
            candidates={editor.candidates}
            error={editor.candidatesError}
            onRetry={editor.reloadCandidates}
            selected={selected}
            selectedLabel={selectedCellLabel(selected, columns, draft.slots)}
            cells={cells}
            dishById={dishById}
            kcalAgeGroup={kcalAgeGroup}
            onPick={(dish) => selected && place(selected.day, selected.slot, dish)}
            onClearSelection={() => setSelected(null)}
            swap={editor.swapFor(selected)}
            onSuggestSwap={() => selected && editor.suggestSwaps(selected, kcalAgeGroup)}
          />
        </div>
        <p className="text-sm td-aie__foot" aria-live="polite">
          {unmet === 0 ? 'Mọi ngày đạt định mức.' : `Còn ${unmet} ngày chưa đạt định mức. Vẫn dùng được để sửa tiếp, chưa công bố được.`}
        </p>
        {limitNote && (
          <p className="text-sm td-aie__limit" role="note">
            <AlertTriangle size={15} aria-hidden="true" /> {limitNote}
          </p>
        )}
      </div>
      <DragOverlay dropAnimation={null}>
        {active?.dish && (
          <span className={`td-dish td-aig__dish td-aie__ghost ${dishTypeClass(active.dish.dishType)}`}>{active.dish.dishName}</span>
        )}
      </DragOverlay>
    </DndContext>
  );
}
