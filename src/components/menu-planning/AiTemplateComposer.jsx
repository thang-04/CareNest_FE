import { useEffect, useState } from 'react';
import { AlertCircle, CircleCheck, RotateCcw, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { dismissAiDraft, generateAiSuggestion } from '@/services/menu-planning/menuPlanningService';
import { Modal } from '@/components/ui/Modal';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/useAiRun';
import { AiDraftLabel } from '@/components/menu-planning/MenuBadges';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { AI_DRAFT_KIND, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const SEASONS = ['Xuân', 'Hạ', 'Thu', 'Đông'];
const lowerFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * Modal "AI soạn thực đơn mẫu": bước 1 tóm tắt + mùa, mong muốn; bước 2 xem trước món từng bữa kèm lý do và kết quả
 * kiểm tra. AI chỉ nhận nhóm tuổi, định mức, số trẻ dị ứng tổng hợp (không tên trẻ). "Dùng bản này" chỉ điền vào form,
 * người soạn vẫn sửa rồi bấm Lưu.
 */
export function AiTemplateComposer({
  open,
  onClose,
  ageGroupId,
  groupName,
  mealList,
  catalog,
  date,
  price,
  allergyRows,
  hasDishes,
  onUse,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [season, setSeason] = useState('');
  const [wishes, setWishes] = useState('');
  const { running, run: runAi } = useAiRun();
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (open) setDraft(null);
  }, [open]);

  const run = async () => {
    try {
      setDraft(
        await runAi(() => generateAiSuggestion({ kind: AI_DRAFT_KIND.DAILY, ageGroupId, avoidAllergens: true, season, wishes }, user)),
      );
    } catch (err) {
      toast.error(`${err.message} Bạn vẫn có thể soạn tay.`, 'AI chưa soạn được');
    }
  };
  const discard = async () => {
    if (draft) await dismissAiDraft(draft.id, user).catch(() => null);
    onClose();
  };

  const avoid = allergyRows.length
    ? `tránh ${allergyRows.map((r) => `${r.allergen.toLowerCase()} (${r.childCount} trẻ)`).join(', ')}`
    : 'nhóm không có trẻ dị ứng';
  const problems = draft ? checkDayMenu({ meals: draft.meals, ageGroupId, catalog, date }).problems : [];

  const footer = draft ? (
    <>
      <button type="button" className="btn btn--ghost" onClick={discard}>
        Bỏ
      </button>
      <button type="button" className="btn" onClick={run} disabled={running}>
        <RotateCcw size={15} /> Soạn lại
      </button>
      <button
        type="button"
        className="btn btn--primary"
        disabled={running}
        onClick={() => {
          onUse(draft);
          onClose();
        }}
      >
        Dùng bản này
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn--ghost" onClick={onClose}>
        Hủy
      </button>
      <button type="button" className="btn btn--primary" onClick={run} disabled={running}>
        <Sparkles size={15} /> Soạn
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={draft ? discard : onClose}
      closeOnBackdrop={!draft}
      size={draft ? 'lg' : 'md'}
      title={draft ? 'Bản AI soạn' : 'AI soạn thực đơn mẫu'}
      footer={footer}
    >
      {!draft ? (
        <div className="td-ai-form">
          <p className="td-flat">
            AI sẽ chọn món có sẵn của trường cho từng bữa của {groupName}: đủ chất theo định mức
            {price != null ? `, trong tiền ăn ${formatMoney(price)}/ngày` : ''}, {avoid}.
          </p>
          <div className="td-form-grid td-form-grid--2">
            <label className="field">
              <span className="field__label">Mùa</span>
              <select className="select" value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="">Không chọn</option>
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Mong muốn thêm</span>
              <input
                className="input"
                maxLength={200}
                placeholder="Ví dụ: ít chiên rán, có món nước"
                value={wishes}
                onChange={(e) => setWishes(e.target.value)}
              />
            </label>
          </div>
          {hasDishes && <p className="text-sm td-warn td-flat">Dùng bản AI sẽ thay các món đang có trong form.</p>}
          <p className="text-xs muted td-flat">
            AI chỉ nhận số trẻ dị ứng, không nhận tên trẻ. Kết quả là bản nháp, bạn xem trước rồi mới dùng.
          </p>
        </div>
      ) : (
        <div className="td-ai-form">
          <div className="td-self-start">
            <AiDraftLabel />
          </div>
          <div className="table-wrap">
            <table className="table table--grid td-ai-meals">
              <tbody>
                {mealList.map((m) => (
                  <tr key={m.code}>
                    <th scope="row">{m.name}</th>
                    <td>
                      {(draft.meals.find((x) => x.session === m.code)?.items || [])
                        .map((i) => catalog.dishById[i.dishId]?.name)
                        .filter(Boolean)
                        .join(', ') || <span className="muted">Chưa có món</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="fw-600 td-flat">Vì sao AI chọn</p>
            <ul className="td-ai-reasons">
              {(draft.reasons || []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          {problems.length ? (
            <div className="alert alert--warning">
              <AlertCircle size={18} />
              <div>Kiểm tra tự động: {problems.map((p) => lowerFirst(p.text)).join('; ')}. Bạn sửa thêm sau khi dùng.</div>
            </div>
          ) : (
            <p className="td-ok td-flat td-ai-note">
              <CircleCheck size={14} aria-hidden="true" /> Kiểm tra tự động: đạt hết.
            </p>
          )}
        </div>
      )}
      {running && <AiWorkingOverlay kind="cooking" text="Đang nấu thực đơn mẫu…" />}
    </Modal>
  );
}
