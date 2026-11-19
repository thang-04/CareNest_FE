import { useEffect, useState } from 'react';
import { AlertCircle, Check, CircleCheck, Lightbulb, Repeat, RotateCcw, Scale, Sparkles, Users, Wallet } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { dismissAiDraft, generateAiSuggestion } from '@/services/menu-planning/menuPlanningService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/useAiRun';
import { WeekGrid } from '@/components/menu-planning/WeekGrid';
import { AiBrief } from '@/components/menu-planning/AiBrief';
import { AiDraftLabel } from '@/components/menu-planning/MenuBadges';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import { AI_DRAFT_KIND, REPEAT_WINDOW_DAYS, WEEKDAY_LABELS, formatMoney, weekLabel } from '@/models/menu-planning/menuPlanningConstants';

const WISH_HINTS = ['Thứ Sáu có món nước', 'Ít chiên rán'];

/**
 * Modal "AI soạn thực đơn tuần": bước 1 điều kiện AI bám theo + mùa, mong muốn; bước 2 xem trước cả tuần như bảng thật
 * kèm lý do từng ngày. AI chỉ nhận nhóm tuổi, tuần, định mức, số trẻ dị ứng tổng hợp. Bấm "Dùng bản này" mới ghi vào bản nháp tuần.
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
  const { running, run: runAi } = useAiRun();
  const [draft, setDraft] = useState(null);
  const price = priceOn(catalog.mealPrices, ageGroupId, weekStart)?.price ?? null;

  useEffect(() => {
    if (open) setDraft(null);
  }, [open]);

  const run = async () => {
    try {
      setDraft(
        await runAi(() =>
          generateAiSuggestion(
            { kind: AI_DRAFT_KIND.WEEKLY, ageGroupId, weekStart, avoidAllergens: true, noRepeatDays: REPEAT_WINDOW_DAYS, season, wishes },
            user,
          ),
        ),
      );
    } catch (err) {
      toast.error(`${err.message} Bạn vẫn có thể soạn tay.`, 'AI chưa soạn được');
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
  const dayOk = Object.fromEntries(
    (draft?.days || []).map((d) => [d.date, !checkDayMenu({ meals: d.meals, ageGroupId, catalog, date: d.date }).problems.length]),
  );
  const badDays = Object.values(dayOk).filter((ok) => !ok).length;
  // Lý do dài để ở khung riêng dưới bảng, đầu cột giữ gọn (bảng đã có nhãn định mức từng ngày)
  const dayReasons = (draft?.days || []).map((d, i) => ({ ...d, label: WEEKDAY_LABELS[i], reason: draft.reasons?.[d.date] }));

  const footer = draft ? (
    <>
      <Button variant="ghost" onClick={discard} disabled={busy}>
        Bỏ bản này
      </Button>
      <Button icon={RotateCcw} loading={running} disabled={busy} onClick={run}>
        Soạn lại
      </Button>
      <Button variant="primary" icon={Check} loading={busy} disabled={running} onClick={use}>
        Dùng bản này
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Hủy
      </Button>
      <Button variant="primary" icon={Sparkles} loading={running} disabled={busy} onClick={run}>
        Soạn
      </Button>
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
        <AiBrief
          intro={`AI chọn thực đơn mẫu của trường cho 5 ngày ${weekLabel(weekStart)}. Bạn xem cả tuần trước rồi mới dùng.`}
          facts={[
            ...(groupName ? [{ icon: Users, label: 'Nhóm tuổi', value: groupName }] : []),
            { icon: Scale, label: 'Dinh dưỡng', value: 'Đủ chất theo định mức của nhóm' },
            ...(price != null ? [{ icon: Wallet, label: 'Tiền ăn', value: `${formatMoney(price)}/ngày` }] : []),
            { icon: Repeat, label: 'Không lặp', value: `Món mặn không lặp trong ${REPEAT_WINDOW_DAYS} ngày` },
          ]}
          allergyRows={allergyRows}
          season={season}
          onSeason={setSeason}
          wishes={wishes}
          onWishes={setWishes}
          wishHints={WISH_HINTS}
          replaceNote={current ? 'Dùng bản AI sẽ thay các ngày đang soạn của tuần này.' : null}
        />
      ) : (
        <div className="td-aim">
          <div className="td-aim__head">
            <AiDraftLabel />
            {badDays ? (
              <span className="chip chip--orange">
                <AlertCircle size={14} /> {badDays} ngày cần xem
              </span>
            ) : (
              <span className="chip chip--green">
                <CircleCheck size={14} /> Cả tuần đạt kiểm tra tự động
              </span>
            )}
            {current && <span className="text-sm muted td-aim__legend">Ô tô xanh là món khác với bản đang soạn.</span>}
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
              isNew={isNew}
            />
          </div>
          {dayReasons.some((d) => d.reason) && (
            <section className="td-aim__panel" aria-label="Vì sao AI chọn từng ngày">
              <h3 className="td-aim__title">
                <Lightbulb size={16} aria-hidden="true" /> Vì sao AI chọn
              </h3>
              <ul className="td-aim__days">
                {dayReasons.map((d) => {
                  const Icon = dayOk[d.date] ? CircleCheck : AlertCircle;
                  return (
                    <li key={d.date} className="td-aim__day">
                      <span className={`td-aim__day-name td-${dayOk[d.date] ? 'ok' : 'warn'}`}>
                        <Icon size={15} aria-hidden="true" /> {d.label}
                      </span>
                      <span className="text-sm">{d.reason || '—'}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
      {running && <AiWorkingOverlay kind="cooking" text="Đang nấu thực đơn tuần…" />}
    </Modal>
  );
}
