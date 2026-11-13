import { Fragment, useMemo, useState } from 'react';
import { Card } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, mtList, numberGoals } from '@/models/education-plan/goalTable';
import { cardText, contentLinesOf, newCard, normalizeTheme, slotLabel, themeGoalBlocks, weekRows } from '@/models/education-plan/classPlan';
import { mapActivityCards } from '@/models/education-plan/activityImport.mjs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { createPortal } from 'react-dom';
import { Adjustments, Check, Download, Plus, RotateCcw, Sparkles, X } from '@/components/ui/icons';
import { RowMenu } from '@/components/ui/RowMenu';
import { Modal } from '@/components/ui/Modal';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import ImportActivitiesModal from '@/components/education-plan/ImportActivitiesModal';
import ThemeGoalPickerModal from '@/components/education-plan/ThemeGoalPickerModal';
import ActivityCardEditor from '@/components/education-plan/ActivityCardEditor';
import { Button, SelectField, TextField } from '@/components';

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
  // Nhập nhanh (Tiền 13/11/2026): lấy hoạt động năm trước của lớp, AI gợi ý (bản giả), báo kết quả
  loadPreviousActivities = null,
  suggestActivities = null,
  notify = () => {},
  // Chỗ đặt menu "Lấy / gợi ý hoạt động" ở trái hàng nút của trang (phần tử DOM do trang cấp)
  toolsTarget = null,
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
  const putCards = (next) => setField('activities', next);
  // Nhớ loại giờ vừa dùng làm mặc định cho thẻ mới kế tiếp (nhập nhanh, Tiền 13/11/2026)
  const [lastSlot, setLastSlot] = useState('');
  const saveCard = (card) => {
    if (card.slot) setLastSlot(card.slot);
    putCards(cards.some((c) => c.id === card.id) ? cards.map((c) => (c.id === card.id ? card : c)) : [...cards, card]);
    setEditing(null);
  };
  // Ô gõ nhanh: thẻ nhận loại giờ đang chọn, MT của dòng, tích sẵn mọi nội dung của MT; chưa chọn loại giờ ⇒ mở hộp đầy đủ
  const allRefsOf = (g) => contentLinesOf(rowOf(g).contents).map((_, i) => `${g.id}:${i}`);
  const quickAdd = (g, input) => {
    const name = input.value.trim();
    if (!name) return;
    if (!lastSlot) setEditing({ card: null, goalIds: [g.id], name });
    else putCards([...cards, newCard({ slot: lastSlot, name, goalIds: [g.id], contentRefs: allRefsOf(g) })]);
    input.value = '';
  };
  const lineGoals = () => goals.map((g) => ({ id: g.id, no: g.no, text: g.text, lines: contentLinesOf(rowOf(g).contents) }));
  const [importing, setImporting] = useState(false);
  const importFrom = (source, picked) => {
    const { cards: added, skipped } = mapActivityCards(picked, source.goals, lineGoals(), cards, newCard);
    if (added.length) putCards([...cards, ...added]);
    const skipText = skipped.map((x) => `${x.name} (${x.reason})`).join('; ');
    notify(
      `Đã thêm ${added.length} hoạt động${skipped.length ? ` · bỏ qua ${skipped.length}: ${skipText}` : ''}`,
      added.length ? 'ok' : 'warn',
    );
    setImporting(false);
  };
  // AI gợi ý (EDU-20 mở rộng): chỉ cho MT chưa có hoạt động; mỗi gợi ý Dùng / Bỏ, chưa dùng thì chưa thành thẻ
  const [ai, setAi] = useState({ busy: false, items: [] });
  const askAi = async () => {
    setAi({ busy: true, items: [] });
    try {
      const items = await suggestActivities({ themeName: currentTheme.name, goals: lineGoals().filter((g) => !cardsOf(g).length) });
      setAi({ busy: false, items });
    } catch (error) {
      setAi({ busy: false, items: [] });
      notify(error.message || 'Chưa gợi ý được, thử lại sau', 'err');
    }
  };
  const takeAi = (list) => {
    const next = list.map((it) => {
      const g = goals.find((x) => String(x.id) === it.goalId);
      return newCard({ slot: it.slot, name: it.name, goalIds: [it.goalId], contentRefs: g ? allRefsOf(g) : [] });
    });
    putCards([...cards, ...next]);
    setAi((a) => ({ ...a, items: a.items.filter((it) => !list.includes(it)) }));
  };
  const dropAi = (list) => setAi((a) => ({ ...a, items: a.items.filter((it) => !list.includes(it)) }));
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
        // Dòng đếm tiến độ chữ xám luôn hiện như kế hoạch năm (Tiền 13/11/2026)
        actions={
          goals.length > 0 && (
            <span className="muted text-xs nowrap">
              {goals.length} mục tiêu · {goals.filter((g) => !cardsOf(g).length).length} chưa có hoạt động
            </span>
          )
        }
        bodyClass={null}
        collapsed={foldedGoals}
        onToggle={() => setFoldedGoals((v) => !v)}
      >
        <div className="card__body">
          {/* Gọn một dòng (Tiền 13/11/2026): menu Mục tiêu + loại giờ gõ nhanh; nút lấy/gợi ý hoạt động ở trái hàng nút */}
          {editable && (
            <div className="ga-theme-goal-head mb-8 row row--wrap row--middle gap-2">
              <RowMenu
                label="Mục tiêu của chủ đề"
                text="Mục tiêu"
                icon={<Adjustments size={16} aria-hidden />}
                className="btn btn--sm btn--outline-primary"
                items={[
                  { label: 'Tùy chọn mục tiêu cho chủ đề này', icon: Adjustments, onClick: () => setShowGoalModal(true) },
                  {
                    label: 'Khôi phục mục tiêu mặc định của năm',
                    icon: RotateCcw,
                    onClick: resetToDefault,
                    disabled: !hasCustomTicks,
                  },
                ]}
              />
              {goals.length > 0 && (
                <label className="row row--middle gap-2 text-sm" title="Loại giờ gán cho hoạt động gõ nhanh trong bảng">
                  <span className="nowrap">Gõ nhanh:</span>
                  <SelectField
                    className="input"
                    aria-label="Loại giờ khi gõ nhanh"
                    value={lastSlot}
                    onChange={(e) => setLastSlot(e.target.value)}
                  >
                    <option value="">Chọn loại giờ</option>
                    {weekRows().map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </SelectField>
                </label>
              )}
              {hasCustomTicks && (
                <span className="chip chip--orange text-sm" title="Mục tiêu đã được tùy chỉnh khác với Kế hoạch năm">
                  Đã tùy chỉnh mục tiêu
                </span>
              )}
            </div>
          )}
          {editable &&
            toolsTarget &&
            (loadPreviousActivities || suggestActivities) &&
            createPortal(
              <RowMenu
                label="Lấy và gợi ý hoạt động"
                text="Lấy / gợi ý"
                icon={<Download size={16} aria-hidden />}
                className="btn btn--sm btn--outline-primary"
                items={[
                  ...(loadPreviousActivities
                    ? [{ label: 'Lấy hoạt động năm trước', icon: Download, onClick: () => setImporting(true) }]
                    : []),
                  ...(suggestActivities
                    ? [
                        {
                          label: 'Gợi ý hoạt động (AI)',
                          icon: Sparkles,
                          onClick: askAi,
                          disabled: ai.busy || !goals.some((g) => !cardsOf(g).length),
                        },
                      ]
                    : []),
                ]}
              />,
              toolsTarget,
            )}

          {/* Nhắc dạng chữ đỏ nhỏ, căn phải như bước tạo chủ đề ở mục tiêu năm học, nằm ngay bên trên bảng */}
          {goals.length === 0 && <p className="text-danger text-sm text-right mb-8">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</p>}
          {/* MT chưa có thẻ thì kế hoạch tuần không có gợi ý, cuối chủ đề không phủ được MT đó */}
          {editable && goals.some((g) => !cardsOf(g).length) && (
            // Rút gọn: số MT + 5 MT đầu, đủ danh sách ở title (Tiền 13/11/2026)
            <p className="text-danger text-sm text-right mb-8" title={mtList(goals.filter((g) => !cardsOf(g).length).map((g) => g.no))}>
              {(() => {
                const missing = goals.filter((g) => !cardsOf(g).length).map((g) => g.no);
                return `${missing.length} MT chưa có hoạt động giáo dục (${mtList(missing.slice(0, 5))}${missing.length > 5 ? '…' : ''}) nên kế hoạch tuần sẽ không có gợi ý cho các MT này.`;
              })()}
            </p>
          )}
          {editable && cards.some((c) => c.legacy && !c.slot) && (
            <p className="text-danger text-sm text-right mb-8">Có hoạt động chưa rõ loại giờ.</p>
          )}
          {editable && dupes.length > 0 && (
            <p className="text-danger text-sm text-right mb-8">Trùng hoạt động: {dupes.map((c) => cardText(c)).join('; ')}.</p>
          )}
          {editing && (
            <ActivityCardEditor
              card={editing.card}
              goals={goals}
              contentsOf={(g) => rowOf(g).contents}
              defaultGoalIds={editing.goalIds || []}
              defaultSlot={editing.card ? '' : lastSlot}
              defaultName={editing.name || ''}
              usedCells={editing.card ? usedCellsOf(editing.card.id) : 0}
              onSave={saveCard}
              onDelete={(card) => {
                putCards(cards.filter((c) => c.id !== card.id));
                setEditing(null);
              }}
              onClose={() => setEditing(null)}
            />
          )}

          {importing && <ImportActivitiesModal load={loadPreviousActivities} onImport={importFrom} onClose={() => setImporting(false)} />}
          {ai.busy && <AiWorkingOverlay text="AI đang gợi ý hoạt động…" />}
          {ai.items.length > 0 && (
            <Modal
              open
              size="xl"
              title="Gợi ý hoạt động (AI)"
              onClose={() => dropAi(ai.items)}
              footer={
                <>
                  <Button onClick={() => dropAi(ai.items)}>
                    <X size={16} aria-hidden /> Bỏ tất cả
                  </Button>
                  <Button variant="success" onClick={() => takeAi(ai.items)}>
                    <Check size={16} aria-hidden /> Dùng tất cả
                  </Button>
                </>
              }
            >
              <AiDraftTag />
              <p className="muted text-sm mb-12">Bấm ✓ để dùng, ✗ để bỏ. Hoạt động đã dùng vẫn sửa được như hoạt động gõ tay.</p>
              <ul className="ga-ai-review">
                {ai.items.map((it) => {
                  const g = goals.find((x) => String(x.id) === it.goalId);
                  return (
                    <li key={it.goalId} className="ga-ai-review__item">
                      <div className="ga-ai-review__week">
                        <b>MT{g?.no}</b> <span className="muted text-sm">· {slotLabel(it.slot)}</span>
                      </div>
                      <div className="ga-ai-review__name">
                        <ins>{it.name}</ins>
                      </div>
                      <Button variant="icon" aria-label={`Dùng gợi ý cho MT${g?.no}`} onClick={() => takeAi([it])}>
                        <Check size={16} aria-hidden />
                      </Button>
                      <Button variant="icon" aria-label={`Bỏ gợi ý cho MT${g?.no}`} onClick={() => dropAi([it])}>
                        <X size={16} aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Modal>
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
          <div className="table-wrap">
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
                            <div className="ga-goal-table__pad row row--middle gap-1">
                              <TextField
                                name={`quick-activity-${g.id}`}
                                autoComplete="off"
                                aria-label={`Gõ nhanh hoạt động cho MT${g.no}`}
                                placeholder="Gõ tên hoạt động, Enter"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    quickAdd(g, e.currentTarget);
                                  }
                                }}
                              />
                              <Button
                                variant="icon"
                                title="Thêm hoạt động (chọn loại giờ, mục tiêu, nội dung)"
                                aria-label={`Thêm hoạt động cho MT${g.no}`}
                                onClick={() => setEditing({ card: null, goalIds: [g.id] })}
                              >
                                <Plus size={16} aria-hidden />
                              </Button>
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
