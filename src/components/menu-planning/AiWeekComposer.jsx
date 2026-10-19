import { useEffect, useState } from 'react';
import { AlertCircle, CircleCheck, RotateCcw, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { dismissAiDraft, generateAiSuggestion } from '@/services/menu-planning/menuPlanningService';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { WeekGrid } from '@/components/menu-planning/WeekGrid';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import { AI_DRAFT_KIND, AI_LABEL, REPEAT_WINDOW_DAYS, formatMoney, weekLabel } from '@/models/menu-planning/menuPlanningConstants';

const SEASONS = ['Xuân', 'Hạ', 'Thu', 'Đông'];

/** Câu tóm tắt AI sẽ làm gì, viết cho giáo viên đọc một lần là hiểu. */
export const aiWeekSummary = ({ groupName, weekStart, price, allergyRows }) => {
  const avoid = allergyRows.length
    ? `tránh ${allergyRows.map((r) => `${r.allergen.toLowerCase()} (${r.childCount} trẻ)`).join(', ')}`
    : 'nhóm không có trẻ dị ứng';
  return (
    `AI sẽ chọn thực đơn mẫu của trường cho 5 ngày ${weekLabel(weekStart)}: đủ chất theo định mức ${groupName || ''}` +
    `${price != null ? `, trong tiền ăn ${formatMoney(price)}/ngày` : ''}, ${avoid}, không lặp món mặn trong ${REPEAT_WINDOW_DAYS} ngày.`
  );
};

/**
 * Modal "AI soạn thực đơn tuần": bước 1 tóm tắt + mùa, mong muốn; bước 2 xem trước cả tuần như bảng thật kèm lý do
 * từng ngày. AI chỉ nhận nhóm tuổi, tuần, định mức, số trẻ dị ứng tổng hợp. Bấm "Dùng bản này" mới ghi vào bản nháp tuần.
 */
export function AiWeekComposer({
  open,
  onClose,
  ageGroupId,
  groupName,
  weekStart,
  catalog,
  menus,
  allergyRows,
  allergyMenus,
  current,
  busy,
  onUse,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [season, setSeason] = useState('');
  const [wishes, setWishes] = useState('');
  const [running, setRunning] = useState(false);
  const [draft, setDraft] = useState(null);
  const price = priceOn(catalog.mealPrices, ageGroupId, weekStart)?.price ?? null;

  useEffect(() => {
    if (open) setDraft(null);
  }, [open]);

  const run = async () => {
    setRunning(true);
    try {
      setDraft(
        await generateAiSuggestion(
          { kind: AI_DRAFT_KIND.WEEKLY, ageGroupId, weekStart, avoidAllergens: true, noRepeatDays: REPEAT_WINDOW_DAYS, season, wishes },
          user,
        ),
      );
    } catch (err) {
      toast.error(`${err.message} Bạn vẫn có thể soạn tay.`, 'AI chưa soạn được');
    } finally {
      setRunning(false);
    }
  };
  const discard = async () => {
    if (draft) {
      try {
        await dismissAiDraft(draft.id, user);
      } catch {
        /* Bỏ bản nháp ở máy là đủ; lỗi ghi vết không chặn người dùng */
      }
    }
    onClose();
  };
  const use = async () => {
    if (await onUse(draft)) onClose();
  };

  // Món khác so với bản đang soạn thì tô nền để người duyệt thấy AI đổi gì
  const isNew = (date, session, dishId) => {
    const was = current?.days.find((d) => d.date === date);
    if (!current || !was) return false;
    return !(was.meals || []).find((m) => m.session === session)?.items.some((i) => i.dishId === dishId);
  };
  const dayNotes = Object.fromEntries(
    (draft?.days || []).map((d) => {
      const ok = !checkDayMenu({ meals: d.meals, ageGroupId, catalog, date: d.date }).problems.length;
      const Icon = ok ? CircleCheck : AlertCircle;
      return [
        d.date,
        <span key={d.date} className={`td-ai-note td-${ok ? 'ok' : 'warn'}`}>
          <Icon size={14} aria-hidden="true" /> {draft.reasons?.[d.date] || ''}
        </span>,
      ];
    }),
  );

  const footer = draft ? (
    <>
      <button type="button" className="btn btn--ghost" onClick={discard} disabled={busy}>
        Bỏ
      </button>
      <button type="button" className="btn" onClick={run} disabled={running || busy}>
        {running ? <Spinner small /> : <RotateCcw size={15} />} Soạn lại
      </button>
      <button type="button" className="btn btn--primary" onClick={use} disabled={busy || running}>
        Dùng bản này
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn--ghost" onClick={onClose}>
        Hủy
      </button>
      <button type="button" className="btn btn--primary" onClick={run} disabled={running || busy}>
        {running ? <Spinner small /> : <Sparkles size={15} />} Soạn
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={draft ? discard : onClose}
      closeOnBackdrop={!draft}
      size={draft ? 'xl' : 'md'}
      title={draft ? `Bản AI soạn · ${weekLabel(weekStart)}` : 'AI soạn thực đơn tuần'}
      footer={footer}
    >
      {!draft ? (
        <div className="td-ai-form">
          <p className="td-flat">{aiWeekSummary({ groupName, weekStart, price, allergyRows })}</p>
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
                placeholder="Ví dụ: thứ Sáu có món nước"
                value={wishes}
                onChange={(e) => setWishes(e.target.value)}
              />
            </label>
          </div>
          {current && <p className="text-sm td-warn td-flat">Dùng bản AI sẽ thay các ngày đang soạn của tuần này.</p>}
          <p className="text-xs muted td-flat">
            AI chỉ nhận số trẻ dị ứng, không nhận tên trẻ. Kết quả là bản nháp, bạn xem trước rồi mới dùng.
          </p>
        </div>
      ) : (
        <div className="td-ai-form">
          <div className="row td-chips">
            <span className="chip chip--purple">
              <Sparkles size={13} /> {AI_LABEL}
            </span>
            {current && <span className="text-sm muted">Ô tô xanh là món khác với bản đang soạn.</span>}
          </div>
          {draft.note && (
            <div className="alert alert--warning">
              <AlertCircle size={18} />
              <div>{draft.note}</div>
            </div>
          )}
          <div className="td-ai-preview">
            <WeekGrid
              wm={{ ageGroupId, days: draft.days }}
              catalog={catalog}
              menus={menus}
              allergyRows={allergyRows}
              allergyMenus={allergyMenus}
              editable={false}
              dayNotes={dayNotes}
              isNew={isNew}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
