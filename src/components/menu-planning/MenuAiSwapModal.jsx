import { useEffect, useState } from 'react';
import { Button, SelectField, TextField } from '@/components';
import { RotateCcw, Sparkles } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { AiDraftLabel } from '@/components/menu-planning/MenuBadges';
import { MealPlanIssueList } from '@/components/menu-planning/MealPlanIssueList';
import { MenuAiMissingFoods } from '@/components/menu-planning/MenuAiMissingFoods';
import { useAiRun } from '@/hooks/useAiRun';
import { menuAiDraftApi } from '@/services/menuAiDraftApi';
import { MEAL_SESSION_LABELS } from '@/models/mealSessions';
import { MENU_AI_KIND, MENU_AI_STATUS } from '@/models/menu-planning/menuPlanningConstants';
import { isPendingDraft, sourceText } from '@/utils/menu-planning/menuAiDraft';

/**
 * AI gợi ý một món thay trong lúc sửa ngoại lệ một ngày đã công bố (AI-07, P-39): chọn món cần thay, AI chọn trong món đang
 * dùng của trường, BE kiểm cân đối ngày đó. "Dùng món này" chỉ đổi trong bảng đang sửa; lưu vẫn là bước xác nhận kèm lý do.
 */
export function MenuAiSwapModal({ open, onClose, block, weekStart, date, options, onUse }) {
  const toast = useToast();
  const { running, run: runAi } = useAiRun();
  const [pick, setPick] = useState('');
  const [wishes, setWishes] = useState('');
  const [missingFoods, setMissingFoods] = useState([]);
  const [draft, setDraft] = useState(null);
  const [used, setUsed] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(null);
      setUsed(false);
      setWishes('');
      setMissingFoods([]);
      setPick(options[0]?.key || '');
    }
  }, [open, options]);

  const target = options.find((o) => o.key === pick);
  const newDish = draft?.days?.[0]?.items?.[0];
  const noPlan = draft && (draft.status === MENU_AI_STATUS.NO_FEASIBLE || !newDish);

  const create = async () => {
    try {
      setDraft(
        await runAi(() =>
          menuAiDraftApi.createDraft({
            kind: MENU_AI_KIND.DAY_FIX,
            block,
            weekStart,
            targetDate: date,
            targetSession: target.session,
            fromDishId: target.dishId,
            wishes,
            unavailableFoodIds: missingFoods,
          }),
        ),
      );
    } catch (err) {
      toast.error(err, 'Chưa tạo được gợi ý');
    }
  };
  // Đóng hoặc gợi ý lại khi nháp chưa dùng ⇒ ghi nhận "bỏ"; lỗi ghi vết không chặn người dùng
  const dismiss = async () => {
    if (!used && isPendingDraft(draft)) await menuAiDraftApi.dismissDraft(draft.id).catch(() => null);
  };
  const close = async () => {
    await dismiss();
    onClose();
  };
  const retry = async () => {
    await dismiss();
    setDraft(null);
  };
  const use = () => {
    setUsed(true);
    onUse({ session: target.session, fromDishId: target.dishId }, draft);
    toast.success('Đã đổi món trong bảng đang sửa. Bấm "Tiếp tục" rồi nhập lý do để lưu.');
    onClose();
  };

  const footer = draft ? (
    <>
      <Button variant="ghost" onClick={close}>
        Bỏ
      </Button>
      <Button onClick={retry} disabled={running}>
        <RotateCcw size={15} /> Gợi ý lại
      </Button>
      {!noPlan && (
        <Button variant="primary" onClick={use} disabled={running}>
          Dùng món này
        </Button>
      )}
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Hủy
      </Button>
      <Button variant="primary" onClick={create} disabled={running || !target}>
        <Sparkles size={15} /> Gợi ý món thay
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={draft ? close : onClose} closeOnBackdrop={!draft} size="md" title="AI gợi ý món thay" footer={footer}>
      {draft ? (
        <div className="td-ai-form">
          <div className="row td-chips">
            <AiDraftLabel />
            {draft.source && <span className="chip chip--gray">{sourceText(draft)}</span>}
          </div>
          {noPlan ? (
            <div className="alert alert--danger">Chưa có món thay đạt kiểm tra cho ô này. Chọn tay món khác trong bảng đang sửa.</div>
          ) : (
            <p>
              Thay <strong>{target?.dishName}</strong> bằng <strong>{newDish.dishName}</strong>.
            </p>
          )}
          {draft.issues.length > 0 && <MealPlanIssueList issues={draft.issues} />}
        </div>
      ) : (
        <div className="td-ai-form">
          <SelectField
            label="Món cần thay"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            options={options.map((o) => ({
              value: o.key,
              label: `${MEAL_SESSION_LABELS[o.session] || o.session} · ${o.dishName}`,
            }))}
          />
          <TextField
            label="Mong muốn thêm"
            maxLength={300}
            placeholder="Ví dụ: không dùng thịt lợn"
            value={wishes}
            onChange={(e) => setWishes(e.target.value)}
          />
          <MenuAiMissingFoods value={missingFoods} onChange={setMissingFoods} />
          <p className="text-xs muted td-flat">
            AI chỉ chọn trong món đang dùng của trường, cùng loại món với món cũ. Món chỉ đổi trong bảng đang sửa; thay đổi có hiệu lực khi
            bạn lưu kèm lý do.
          </p>
        </div>
      )}
      {running && <AiWorkingOverlay kind="cooking" text="Đang gợi ý món thay…" />}
    </Modal>
  );
}
