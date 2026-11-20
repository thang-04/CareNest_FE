import { useEffect, useState } from 'react';
import { AlertCircle, Check, CircleCheck, Lightbulb, RotateCcw, Scale, Sparkles, Users, Utensils, Wallet } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { dismissAiDraft, generateAiSuggestion } from '@/services/menu-planning/menuPlanningService';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/useAiRun';
import { AiBrief } from '@/components/menu-planning/AiBrief';
import { AiDraftLabel } from '@/components/menu-planning/MenuBadges';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { AI_DRAFT_KIND, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const WISH_HINTS = ['Ít chiên rán', 'Có món nước', 'Nhiều rau xanh'];

/**
 * Modal "AI soạn thực đơn mẫu": bước 1 điều kiện AI bám theo + mùa, mong muốn; bước 2 món từng bữa (chip), lý do và
 * kết quả kiểm tra tự động. AI chỉ nhận nhóm tuổi, định mức, số trẻ dị ứng tổng hợp (không tên trẻ). "Dùng bản này"
 * chỉ điền vào form, người soạn vẫn sửa rồi bấm Lưu.
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

  const problems = draft ? checkDayMenu({ meals: draft.meals, ageGroupId, catalog, date }).problems : [];
  const dishesOf = (code) =>
    (draft.meals.find((x) => x.session === code)?.items || []).map((i) => catalog.dishById[i.dishId]?.name).filter(Boolean);

  const footer = draft ? (
    <>
      <Button variant="ghost" onClick={discard}>
        Bỏ bản này
      </Button>
      <Button icon={RotateCcw} loading={running} onClick={run}>
        Soạn lại
      </Button>
      <Button
        variant="primary"
        icon={Check}
        disabled={running}
        onClick={() => {
          onUse(draft);
          onClose();
        }}
      >
        Dùng bản này
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Hủy
      </Button>
      <Button variant="primary" icon={Sparkles} loading={running} onClick={run}>
        Soạn
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={draft ? discard : onClose}
      closeOnBackdrop={!draft}
      size={draft ? 'xl' : 'lg'}
      title={draft ? `Bản AI soạn · ${groupName}` : 'AI soạn thực đơn mẫu'}
      footer={footer}
    >
      {!draft ? (
        <AiBrief
          intro={`AI chọn món có sẵn của trường cho từng bữa của ${groupName}. Bạn xem trước rồi mới điền vào form.`}
          facts={[
            { icon: Users, label: 'Nhóm tuổi', value: groupName },
            { icon: Scale, label: 'Dinh dưỡng', value: 'Đủ chất theo định mức của nhóm' },
            ...(price != null ? [{ icon: Wallet, label: 'Tiền ăn', value: `${formatMoney(price)}/ngày` }] : []),
          ]}
          allergyRows={allergyRows}
          season={season}
          onSeason={setSeason}
          wishes={wishes}
          onWishes={setWishes}
          wishHints={WISH_HINTS}
          replaceNote={hasDishes ? 'Dùng bản AI sẽ thay các món đang có trong form.' : null}
        />
      ) : (
        <div className="td-aim">
          <div className="td-aim__head">
            <AiDraftLabel />
            {problems.length ? (
              <span className="chip chip--orange">
                <AlertCircle size={14} /> {problems.length} điểm cần xem
              </span>
            ) : (
              <span className="chip chip--green">
                <CircleCheck size={14} /> Đạt kiểm tra tự động
              </span>
            )}
          </div>
          <div className="td-aim__body">
            <section className="td-aim__meals" aria-label="Món AI chọn">
              {mealList.map((m) => {
                const dishes = dishesOf(m.code);
                return (
                  <div key={m.code} className="td-aim__meal">
                    <div className="td-aim__meal-head">
                      <Utensils size={16} aria-hidden="true" />
                      <span className="td-aim__meal-name">{m.name}</span>
                      <span className="text-xs muted">{dishes.length} món</span>
                    </div>
                    {dishes.length ? (
                      <div className="td-chips">
                        {dishes.map((d) => (
                          <span key={d} className="chip td-aim__dish">
                            {d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm muted">Chưa có món</span>
                    )}
                  </div>
                );
              })}
            </section>
            <aside className="td-aim__side">
              {draft.reasons?.length > 0 && (
                <section className="td-aim__panel">
                  <h3 className="td-aim__title">
                    <Lightbulb size={16} aria-hidden="true" /> Vì sao AI chọn
                  </h3>
                  <ul className="td-aim__list">
                    {draft.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className={`td-aim__panel td-aim__panel--${problems.length ? 'warn' : 'ok'}`}>
                <h3 className="td-aim__title">
                  {problems.length ? <AlertCircle size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />} Kiểm tra
                  tự động
                </h3>
                {problems.length ? (
                  <>
                    <ul className="td-aim__list">
                      {problems.map((p) => (
                        <li key={p.text}>{p.text}</li>
                      ))}
                    </ul>
                    <p className="text-xs td-flat">Bạn sửa thêm trong form sau khi dùng bản này.</p>
                  </>
                ) : (
                  <p className="text-sm td-flat">Không thấy điểm nào cần sửa.</p>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}
      {running && <AiWorkingOverlay kind="cooking" text="Đang nấu thực đơn mẫu…" />}
    </Modal>
  );
}
