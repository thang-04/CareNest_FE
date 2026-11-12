import { Fragment, useMemo, useState } from 'react';
import { Card } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, mtList, numberGoals } from '@/models/education-plan/goalTable';
import { cardText, contentLinesOf, normalizeTheme, slotLabel, themeGoalBlocks, themeTree } from '@/models/education-plan/classPlan';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Adjustments, RotateCcw } from '@/components/ui/icons';
import ThemeGoalPickerModal from '@/components/education-plan/ThemeGoalPickerModal';
import ActivityCardEditor from '@/components/education-plan/ActivityCardEditor';

/**
 * Dòng của một mục tiêu. Nội dung giáo dục do Phó HT / Tổ trưởng lập ở kế hoạch năm (các nội dung đã tích cho chủ đề),
 * giáo viên không sửa; giáo viên chỉ viết hoạt động giáo dục.
 */
export const themeRowOf = (draft, g) => ({
  activities: draft?.rows?.[g.id]?.activities || '',
  contents: draft?.rows?.[g.id]?.contents !== undefined ? draft.rows[g.id].contents : g.contents.map((c) => `- ${c}`).join('\n'),
});

/**
 * Thẻ hoạt động của một MT (BE:EDU-78): chip "Loại giờ: tên"; thẻ nhiều MT hiện ở mọi MT của nó, sửa một chỗ đổi mọi chỗ.
 * Thẻ cũ chưa rõ loại giờ có nhãn cảnh báo (FR-006, clarify 12/11).
 */
function CardChips({ cards, editable, onEdit }) {
  // Chỉ xem: từng dòng "- Loại giờ: tên" như ô chữ cũ và bản in; đang soạn: dòng bấm được để sửa, cùng kiểu dòng gợi ý của
  // kế hoạch tuần (tự xuống dòng, không tràn ô)
  if (!editable) return <div className="ga-goal-table__pad ga-cell-text">{cards.map((c) => `- ${cardText(c)}`).join('\n')}</div>;
  return (
    <div className="ga-goal-table__pad">
      {cards.map((c) => {
        const colon = c.legacy ? c.name.indexOf(':') : -1;
        const type = c.slot ? slotLabel(c.slot) : '';
        return (
          <button key={c.id} type="button" className="ga-sug" aria-label={`Sửa hoạt động ${cardText(c)}`} onClick={() => onEdit(c)}>
            <span className="ga-sug__body">
              {c.slot ? <span className="ga-sug__type">{type}</span> : <span className="text-danger text-sm">Chưa rõ loại giờ</span>}
              <span className="ga-sug__text">{colon > 0 && c.slot ? c.name.slice(colon + 1).trim() : c.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Nội dung kế hoạch chủ đề (I. mục tiêu, nội dung, hoạt động; II. môi trường). Dùng ở trang soạn và chỉ đọc ở trang
 * duyệt giáo án tuần đầu của chủ đề (kế hoạch chủ đề duyệt chung với tuần đó).
 */
export function ThemePlanBody({
  yearPlan,
  themeId,
  draft,
  editable = false,
  setRow,
  setField,
  flagOf = () => null,
  added = null,
  usedCellsOf = () => 0,
}) {
  const blocks = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId, draft?.customTicks);
  const goals = blocks.flatMap((b) => b.goals);
  const rowOf = (g) => themeRowOf(draft, g);
  // Thẻ của kế hoạch chủ đề; bản cũ dựng từ ô chữ (FR-006)
  const cards = normalizeTheme(
    draft,
    goals.map((g) => g.id),
  );
  const cardsOf = (g) => cards.filter((c) => (c.goalIds || []).map(String).includes(String(g.id)));
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('table');
  const tree = themeTree(blocks, cards, (g) => contentLinesOf(rowOf(g).contents));
  const putCards = (next) => setField('activities', next);
  const saveCard = (card) => {
    putCards(cards.some((c) => c.id === card.id) ? cards.map((c) => (c.id === card.id ? card : c)) : [...cards, card]);
    setEditing(null);
  };
  // Trùng tên và loại giờ: chỉ cảnh báo (edge case)
  const dupes = cards.filter((c, i) => cards.findIndex((x) => x.slot === c.slot && x.name.trim() === c.name.trim()) !== i);
  // Mục I và II là hai thẻ riêng, mỗi thẻ thu gọn / mở được như các phần khác (Tiền 12/11/2026)
  const [foldedGoals, setFoldedGoals] = useState(false);
  const [foldedEnv, setFoldedEnv] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const currentTheme = yearPlan?.themes?.find((t) => t.id === themeId) || { id: themeId, name: '' };

  const hasCustomTicks = useMemo(() => {
    if (!draft?.customTicks) return false;
    return Object.keys(draft.customTicks).length > 0;
  }, [draft?.customTicks]);

  const resetToDefault = () => {
    if (setField) setField('customTicks', {});
  };
  return (
    <>
      <Card
        title="I. Mục tiêu, nội dung và hoạt động giáo dục"
        bodyClass={null}
        collapsed={foldedGoals}
        onToggle={() => setFoldedGoals((v) => !v)}
      >
        <div className="card__body">
          <div className="ga-theme-goal-head mb-8">
            {editable && (
              <div className="row row--between row--wrap row--middle gap-2">
                <div className="row row--wrap row--middle gap-2">
                  <button type="button" className="btn btn--outline-primary btn--sm" onClick={() => setShowGoalModal(true)}>
                    <Adjustments size={16} aria-hidden /> Tùy chọn mục tiêu cho chủ đề này
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline-secondary btn--sm"
                    onClick={resetToDefault}
                    disabled={!hasCustomTicks}
                    title="Khôi phục danh sách mục tiêu về nguyên bản theo kế hoạch năm"
                  >
                    <RotateCcw size={16} aria-hidden /> Khôi phục về mặc định mục tiêu sẵn có của năm
                  </button>
                </div>
                {hasCustomTicks && (
                  <div className="row row--wrap row--middle gap-2">
                    <span className="chip chip--orange text-sm" title="Mục tiêu đã được tùy chỉnh khác với Kế hoạch năm">
                      Đã tùy chỉnh mục tiêu
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Nhắc dạng chữ đỏ nhỏ, căn phải như bước tạo chủ đề ở mục tiêu năm học, nằm ngay bên trên bảng */}
          {goals.length === 0 && <p className="text-danger text-sm text-right mb-8">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</p>}
          {/* MT chưa có thẻ thì kế hoạch tuần không có gợi ý, cuối chủ đề không phủ được MT đó */}
          {editable && goals.some((g) => !cardsOf(g).length) && (
            <p className="text-danger text-sm text-right mb-8">
              {mtList(goals.filter((g) => !cardsOf(g).length).map((g) => g.no))} chưa có hoạt động giáo dục nên kế hoạch tuần sẽ không có
              gợi ý cho các MT này.
            </p>
          )}
          {editable && cards.some((c) => c.legacy && !c.slot) && (
            <p className="text-danger text-sm text-right mb-8">Có hoạt động chưa rõ loại giờ.</p>
          )}
          {editable && dupes.length > 0 && (
            <p className="text-danger text-sm text-right mb-8">Trùng hoạt động: {dupes.map((c) => cardText(c)).join('; ')}.</p>
          )}
          {goals.length > 0 && (
            <div className="row row--wrap gap-2 mb-8" role="group" aria-label="Cách xem">
              {[
                ['table', 'Bảng'],
                ['tree', 'Dạng cây'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  className={`btn btn--sm ${view === key ? 'btn--primary' : 'btn--outline-primary'}`}
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {editing && (
            <ActivityCardEditor
              card={editing.card}
              goals={goals}
              contentsOf={(g) => rowOf(g).contents}
              defaultGoalIds={editing.goalIds || []}
              usedCells={editing.card ? usedCellsOf(editing.card.id) : 0}
              onSave={saveCard}
              onDelete={(card) => {
                putCards(cards.filter((c) => c.id !== card.id));
                setEditing(null);
              }}
              onClose={() => setEditing(null)}
            />
          )}

          {showGoalModal && (
            <ThemeGoalPickerModal
              open={showGoalModal}
              onClose={() => setShowGoalModal(false)}
              theme={currentTheme}
              yearPlan={yearPlan}
              customTicks={draft?.customTicks || {}}
              onApply={(nextTicks) => {
                if (setField) setField('customTicks', nextTicks);
              }}
              onResetDefault={resetToDefault}
            />
          )}
          {view === 'tree' && (
            // FR-004: MT → nội dung → thẻ; nội dung chưa có thẻ vàng, MT chưa có thẻ đỏ (chỉ cảnh báo)
            <ul className="stack">
              {tree.map((t) => (
                <li key={t.goal.id}>
                  <div className="fw-600">
                    <span className="ga-goal-code">MT{t.goal.no}</span> {t.goal.text}{' '}
                    {t.warn === 'red' && <span className="text-danger text-sm"> · chưa có hoạt động</span>}
                  </div>
                  <ul className="stack ga-goal-table__pad">
                    {t.contents.map((c) => (
                      <li key={c.index}>
                        {c.text} {c.warn === 'yellow' && <span className="text-danger text-sm"> · chưa có hoạt động</span>}
                        {c.cards.length > 0 && <CardChips cards={c.cards} editable={false} />}
                      </li>
                    ))}
                    {t.unlinkedCards.length > 0 && (
                      <li>
                        <span className="muted">Chưa gắn nội dung</span>
                        <CardChips cards={t.unlinkedCards} editable={false} />
                      </li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          <div className="table-wrap" hidden={view === 'tree'}>
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-goal-table__del" />
                <col className="ga-goal-table__goaltext" />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className={editable ? 'cell--fixed ga-stt' : 'ga-stt'}>TT</th>
                  <th className={editable ? 'cell--fixed' : ''}>Mục tiêu giáo dục</th>
                  <th className={editable ? 'ga-th-editable' : ''}>Nội dung giáo dục</th>
                  <th className={editable ? 'ga-th-editable' : ''}>Hoạt động giáo dục</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b, i) => (
                  <Fragment key={`${b.domain}-${b.sub}-${i}`}>
                    {(i === 0 || blocks[i - 1].domain !== b.domain) && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__domain">
                          <div className="ga-goal-table__pad">
                            <h3>
                              {domainRoman(b.domain)}. {domainLabel(b.domain).toUpperCase()}
                            </h3>
                          </div>
                        </td>
                      </tr>
                    )}
                    {b.sub && (
                      <tr>
                        <td colSpan={4} className="ga-goal-table__subband">
                          <div className="ga-goal-table__subname">{b.sub}</div>
                        </td>
                      </tr>
                    )}
                    {b.goals.map((g) => (
                      <tr key={g.id}>
                        <td className={editable ? 'cell--fixed ga-stt' : 'ga-stt'}>
                          <div className="ga-goal-table__pad">
                            <span className="ga-goal-code">MT{g.no}</span>
                            {/* Phiên bản kế hoạch năm mới (BE:EDU-26): MT đổi hiện đỏ, MT mới có nhãn "mới" */}
                            {flagOf(g.id) && <StatusBadge tone="red" label="Đổi" size="sm" />}
                            {added?.has(g.id) && <StatusBadge tone="blue" label="Mới" size="sm" />}
                          </div>
                        </td>
                        <td className={editable ? 'cell--fixed' : ''}>
                          <div className="ga-goal-table__pad">
                            {g.text}
                            {flagOf(g.id) && <div className="field__error">{flagOf(g.id).message}</div>}
                          </div>
                        </td>
                        <td className={editable ? 'ga-cell-editable' : ''}>
                          <Cell
                            editable={editable}
                            value={rowOf(g).contents}
                            label={`Nội dung của MT${g.no}`}
                            onChange={(v) => setRow(g, 'contents', v)}
                          />
                        </td>
                        <td>
                          {cardsOf(g).length > 0 ? (
                            <CardChips cards={cardsOf(g)} editable={editable} onEdit={(card) => setEditing({ card })} />
                          ) : (
                            !editable && (
                              <div className="ga-goal-table__pad ga-cell-text">
                                <span className="muted">—</span>
                              </div>
                            )
                          )}
                          {editable && (
                            <div className="ga-goal-table__pad">
                              <button
                                type="button"
                                className="btn btn--outline-primary btn--sm"
                                aria-label={`Thêm hoạt động cho MT${g.no}`}
                                onClick={() => setEditing({ card: null, goalIds: [g.id] })}
                              >
                                + Thêm hoạt động
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card
        title="II. Môi trường giáo dục"
        className="mt-16"
        bodyClass={null}
        collapsed={foldedEnv}
        onToggle={() => setFoldedEnv((v) => !v)}
      >
        <div className="card__body">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <thead>
                <tr>
                  <th>1. Trong lớp</th>
                  <th>2. Ngoài lớp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envIn}
                      label="Môi trường trong lớp"
                      placeholder="Trang trí, góc chơi, đồ dùng…"
                      onChange={(v) => setField('envIn', v)}
                    />
                  </td>
                  <td>
                    <Cell
                      editable={editable}
                      value={draft.envOut}
                      label="Môi trường ngoài lớp"
                      placeholder="Sân chơi, khu vực ngoài lớp…"
                      onChange={(v) => setField('envOut', v)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </>
  );
}
