import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, numberGoals } from '@/models/education-plan/goalTable';
import { cardText, contentLinesOf, newCard, normalizeTheme, slotLabel, themeGoalBlocks } from '@/models/education-plan/classPlan';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Adjustments, Plus, RotateCcw, Sparkles } from '@/components/ui/icons';
import { ActionsMenu, AiPick, RagRefLine } from '@/components/education-plan/reviewUi';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/education-plan/useAiRun';
import ThemeGoalPickerModal from '@/components/education-plan/ThemeGoalPickerModal';
import ActivityCardEditor from '@/components/education-plan/ActivityCardEditor';
import { AiClassContentModal } from '@/components/education-plan/AiClassContentModal';
import {
  activityDrafts,
  activityTargets,
  applyRewrite,
  cardsLostByRewrite,
  restoreCards,
  rewriteRequestGoals,
} from '@/models/education-plan/aiClassContent.mjs';
import { AI_CONTENT_SOURCE_LABELS } from '@/models/education-plan/aiGoalContent.mjs';
import { Button } from '@/components';

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
function CardChips({ cards, editable, onEdit, pending = {}, onKeep, onDrop }) {
  // Chỉ xem: từng dòng "- Loại giờ: tên" như ô chữ cũ và bản in; đang soạn: dòng bấm được để sửa, cùng kiểu dòng gợi ý của
  // kế hoạch tuần (tự xuống dòng, không tràn ô)
  if (!editable) return <div className="ga-goal-table__pad ga-cell-text">{cards.map((c) => `- ${cardText(c)}`).join('\n')}</div>;
  return (
    <div className="ga-goal-table__pad">
      {cards.map((c) => {
        const colon = c.legacy ? c.name.indexOf(':') : -1;
        const type = c.slot ? slotLabel(c.slot) : '';
        return (
          <Fragment key={c.id}>
            <button type="button" className="ga-sug" aria-label={`Sửa hoạt động ${cardText(c)}`} onClick={() => onEdit(c)}>
              <span className="ga-sug__body">
                {c.slot ? <span className="ga-sug__type">{type}</span> : <span className="text-danger text-sm">Chưa rõ loại giờ</span>}
                <span className="ga-sug__text">{colon > 0 && c.slot ? c.name.slice(colon + 1).trim() : c.name}</span>
              </span>
            </button>
            {c.id in pending && (
              <>
                {pending[c.id] && <RagRefLine refs={[pending[c.id]]} />}
                <AiPick label={cardText(c)} onKeep={() => onKeep(c.id)} onDrop={() => onDrop(c.id)} />
              </>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** BE:EDU-115: dưới ô Nội dung — nút AI cả mục tiêu và từng dòng (khi có nhiều dòng), hoặc nháp AI chờ ✓/✗. */
function ContentAi({ goal, lines, pending, busy, onAsk, onKeep, onDrop }) {
  if (pending)
    return (
      <div className="ga-goal-table__pad">
        <div className="text-sm muted">Gợi ý AI · {pending.sources.map((s) => AI_CONTENT_SOURCE_LABELS[s] || s).join(', ')}</div>
        <RagRefLine refs={[...new Map(pending.refs.map((r) => [r.id, r])).values()]} />
        <AiPick label={`Nội dung MT${goal.no}`} onKeep={onKeep} onDrop={onDrop} />
      </div>
    );
  return (
    <div className="ga-goal-table__pad">
      {lines.length > 1 &&
        lines.map((line, i) => (
          <div key={`${i}-${line}`} className="row row--middle gap-2 text-sm">
            <span className="muted">
              {i + 1}. {line}
            </span>
            <span className="spacer" />
            <Button
              variant="icon"
              icon={Sparkles}
              title={`Viết lại dòng ${i + 1} (AI)`}
              aria-label={`Viết lại dòng ${i + 1} của MT${goal.no} bằng AI`}
              disabled={busy}
              onClick={() => onAsk(i)}
            />
          </div>
        ))}
      <div className="text-right">
        <Button
          variant="icon"
          icon={Sparkles}
          title={`Viết lại nội dung MT${goal.no} (AI)`}
          aria-label={`Viết lại toàn bộ nội dung MT${goal.no} bằng AI`}
          disabled={busy}
          onClick={() => onAsk(null)}
        />
      </div>
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
  // AI gợi ý hoạt động (bản giả), báo kết quả
  suggestActivities = null,
  notify = () => {},
  unsaved = true,
  // BE:EDU-115: AI viết lại nội dung; null khi chỉ xem
  rewriteContents = null,
  // Chỗ đặt menu "Lấy / gợi ý hoạt động" ở trái hàng nút của trang (phần tử DOM do trang cấp)
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
  const lineGoals = () => goals.map((g) => ({ id: g.id, no: g.no, text: g.text, lines: contentLinesOf(rowOf(g).contents) }));
  // BE:EDU-114: gợi ý theo dòng nội dung (nút chung: dòng chưa có hoạt động; nút từng MT: mọi dòng của MT)
  const [ai, setAi] = useState({ busy: false, goalId: null });
  const activityRun = useAiRun();
  const rewriteRun = useAiRun();
  const cancelActivities = () => {
    activityRun.cancel();
    setAi({ busy: false, goalId: null });
  };
  const cancelRewrite = () => {
    rewriteRun.cancel();
    setRewrite({ scope: null, busy: false });
  };
  const askAi = async (goalId = null) => {
    const targets = activityTargets(lineGoals(), cards, goalId);
    if (!targets.length) {
      notify('Mục tiêu chưa có nội dung để gợi ý', 'warn');
      return;
    }
    setAi({ busy: true, goalId });
    const live = activityRun.begin();
    try {
      const items = await suggestActivities({
        themeName: currentTheme.name,
        goals: targets.map(({ id, no, text, lines }) => ({ id: String(id), no, text, lines })),
      });
      if (!live()) return;
      const now = latest.current;
      const { drafts, skipped } = activityDrafts(items, targets, Object.fromEntries(now.lines.map((g) => [g.id, g.lines])));
      // Điền thẳng vào bảng (Tiền 25/11/2026): thẻ thành nháp chờ ✓/✗; Lưu mà không bấm ⇒ giữ hết
      const next = drafts.map(({ ref, ...d }) => ({ ...newCard(d), ref }));
      if (next.length) now.setField('activities', [...now.cards, ...next.map(({ ref: _ref, ...c }) => c)]);
      setAiPending((p) => ({ ...p, ...Object.fromEntries(next.map((c) => [c.id, c.ref || null])) }));
      if (!next.length) notify('AI chưa có gợi ý phù hợp', 'warn');
      else if (skipped) notify('Mục tiêu đã sửa trong lúc chờ AI được giữ nguyên', 'warn');
    } catch (error) {
      if (!live()) return;
      notify(error.message || 'Chưa gợi ý được, thử lại sau', 'err');
    } finally {
      if (live()) setAi({ busy: false, goalId: null });
    }
  };
  // Thẻ AI đang chờ: { [cardId]: ref RAG | null } — chỉ ở màn hình, không lưu vào kế hoạch
  const [aiPending, setAiPending] = useState({});
  const settleAi = (id) => setAiPending(({ [id]: _, ...rest }) => rest);
  const dropAi = (id) => {
    putCards(cards.filter((c) => c.id !== id));
    settleAi(id);
  };
  // EDU-115: nội dung AI viết lại đang chờ ✓/✗, theo MT; scope = {} (tất cả) | { goalId } | { goalId, lineIndex }
  const [contentPending, setContentPending] = useState({});
  const [rewrite, setRewrite] = useState({ scope: null, busy: false });
  // Đã lưu ⇒ giữ hết gợi ý đang chờ
  useEffect(() => {
    if (!unsaved) {
      setAiPending({});
      setContentPending({});
    }
  }, [unsaved]);
  const rewriteGoals = (scope) =>
    rewriteRequestGoals(
      lineGoals().filter((g) => !(g.id in contentPending)),
      scope,
    );
  // Bảng mới nhất tại thời điểm AI trả lời (cô có thể vẫn đang gõ trong lúc chờ)
  const latest = useRef(null);
  const runRewrite = async (situation) => {
    const requestGoals = rewriteGoals(rewrite.scope);
    setRewrite((r) => ({ ...r, busy: true }));
    const live = rewriteRun.begin();
    try {
      const res = await rewriteContents({ situation, goals: requestGoals });
      if (!live()) return;
      const now = latest.current;
      const result = applyRewrite({
        requestGoals,
        current: Object.fromEntries(now.lines.map((g) => [g.id, { text: now.rowOf(g).contents, lines: g.lines }])),
        cards: now.cards,
        matches: res?.matches,
      });
      now.lines.filter((g) => g.id in result.rows).forEach((g) => now.setRow(g, 'contents', result.rows[g.id]));
      if (result.cards.length !== now.cards.length) now.setField('activities', result.cards);
      setContentPending((p) => ({ ...p, ...result.pending }));
      if (!result.changed) notify('AI chưa có nội dung phù hợp để thay', 'warn');
      else if (result.skipped) notify('Mục tiêu đã sửa trong lúc chờ AI được giữ nguyên', 'warn');
      setRewrite({ scope: null, busy: false });
    } catch (error) {
      if (!live()) return;
      setRewrite((r) => ({ ...r, busy: false }));
      notify(error.message || 'AI chưa viết được nội dung, thử lại sau', 'err');
    }
  };
  const keepContent = (goalId) => setContentPending(({ [goalId]: _, ...rest }) => rest);
  const dropContent = (g) => {
    const entry = contentPending[g.id];
    setRow(g, 'contents', entry.before);
    if (entry.removed.length) putCards(restoreCards(cards, entry.removed));
    keepContent(g.id);
  };
  latest.current = { lines: lineGoals(), rowOf, cards, setRow, setField };
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
            <span className="text-success text-xs nowrap">
              {goals.length} mục tiêu · {goals.filter((g) => !cardsOf(g).length).length} chưa có hoạt động
            </span>
          )
        }
        bodyClass={null}
        collapsed={foldedGoals}
        onToggle={() => setFoldedGoals((v) => !v)}
      >
        <div className="card__body">
          {/* Gọn một dòng: một nút "Thao tác" trong card gom lấy/gợi ý hoạt động và mục tiêu của chủ đề (Tiền 18/11/2026) */}
          {editable && (
            <div className="ga-theme-goal-head mb-8 row row--wrap row--middle gap-2">
              <ActionsMenu
                items={[
                  { label: 'Tùy chọn mục tiêu', icon: Adjustments, onClick: () => setShowGoalModal(true) },
                  { label: 'Khôi phục mặc định', icon: RotateCcw, onClick: resetToDefault, disabled: !hasCustomTicks },
                ]}
              />
              {hasCustomTicks && (
                <span className="chip chip--orange text-sm" title="Mục tiêu đã được tùy chỉnh khác với Kế hoạch năm">
                  Đã tùy chỉnh mục tiêu
                </span>
              )}
              {/* Nút AI bên phải hàng nút (Tiền 25/11/2026) */}
              <span className="spacer" />
              {suggestActivities && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  icon={Sparkles}
                  loading={ai.busy && !ai.goalId}
                  disabled={ai.busy || !activityTargets(lineGoals(), cards).length}
                  title={goals.length && !activityTargets(lineGoals(), cards).length ? 'Mọi dòng nội dung đã có hoạt động' : undefined}
                  onClick={() => askAi()}
                >
                  Gợi ý hoạt động cho nội dung chưa có
                </Button>
              )}
              {rewriteContents && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  icon={Sparkles}
                  disabled={rewrite.busy || !rewriteGoals({}).length}
                  onClick={() => setRewrite({ scope: {}, busy: false })}
                >
                  Viết lại nội dung (AI)
                </Button>
              )}
            </div>
          )}

          {/* Nhắc dạng chữ đỏ nhỏ, căn phải như bước tạo chủ đề ở mục tiêu năm học, nằm ngay bên trên bảng */}
          {goals.length === 0 && <p className="text-danger text-sm text-right mb-8">Kế hoạch năm chưa tích nội dung nào vào chủ đề này.</p>}
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
          {ai.busy && <AiWorkingOverlay lock onCancel={cancelActivities} text="AI đang gợi ý hoạt động…" />}
          {rewrite.busy && <AiWorkingOverlay lock onCancel={cancelRewrite} text="AI đang viết lại nội dung…" />}
          {rewrite.scope && (
            <AiClassContentModal
              scopeLabel={
                rewrite.scope.goalId == null
                  ? 'mọi mục tiêu của chủ đề'
                  : `MT${goals.find((g) => String(g.id) === String(rewrite.scope.goalId))?.no}${
                      rewrite.scope.lineIndex == null ? '' : `, dòng ${rewrite.scope.lineIndex + 1}`
                    }`
              }
              lostCards={cardsLostByRewrite(cards, rewriteGoals(rewrite.scope))}
              usedCellsOf={usedCellsOf}
              busy={rewrite.busy}
              onSubmit={runRewrite}
              onClose={() => !rewrite.busy && setRewrite({ scope: null, busy: false })}
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
                          {editable && rewriteContents && (
                            <ContentAi
                              goal={g}
                              lines={contentLinesOf(rowOf(g).contents)}
                              pending={contentPending[g.id]}
                              busy={rewrite.busy}
                              onAsk={(lineIndex) => setRewrite({ scope: { goalId: g.id, lineIndex }, busy: false })}
                              onKeep={() => keepContent(g.id)}
                              onDrop={() => dropContent(g)}
                            />
                          )}
                        </td>
                        <td>
                          {cardsOf(g).length > 0 ? (
                            <CardChips
                              cards={cardsOf(g)}
                              editable={editable}
                              onEdit={(card) => setEditing({ card })}
                              pending={aiPending}
                              onKeep={settleAi}
                              onDrop={dropAi}
                            />
                          ) : (
                            !editable && (
                              <div className="ga-goal-table__pad ga-cell-text">
                                <span className="muted">—</span>
                              </div>
                            )
                          )}
                          {editable && (
                            <div className="ga-goal-table__pad row row--middle gap-1">
                              <Button
                                variant="icon"
                                title="Thêm hoạt động (chọn loại giờ, mục tiêu, nội dung)"
                                aria-label={`Thêm hoạt động cho MT${g.no}`}
                                onClick={() => setEditing({ card: null, goalIds: [g.id] })}
                              >
                                <Plus size={16} aria-hidden />
                              </Button>
                              {suggestActivities && (
                                <Button
                                  variant="icon"
                                  title={`Gợi ý hoạt động (AI) cho MT${g.no}`}
                                  aria-label={`Gợi ý hoạt động bằng AI cho MT${g.no}`}
                                  loading={ai.busy && String(ai.goalId) === String(g.id)}
                                  disabled={ai.busy}
                                  onClick={() => askAi(g.id)}
                                >
                                  <Sparkles size={16} aria-hidden />
                                </Button>
                              )}
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
