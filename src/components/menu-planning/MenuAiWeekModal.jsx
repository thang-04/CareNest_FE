import { useEffect, useMemo, useState } from 'react';
import { Button, SelectField, TextField } from '@/components';
import { RotateCcw, Sparkles } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/useAiRun';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { MenuAiDraftResult } from '@/components/menu-planning/MenuAiDraftResult';
import { MenuAiWeekEditor } from '@/components/menu-planning/MenuAiWeekEditor';
import { useMenuAiDraftEditor } from '@/hooks/menu-planning/useMenuAiDraftEditor';
import { menuAiDraftApi } from '@/services/menuAiDraftApi';
import { MEAL_BLOCK_LABELS, MEAL_SESSION_LABELS, MENU_AI_KIND } from '@/models/menu-planning/menuPlanningConstants';
import { fixOptions, isPendingDraft, isUnmetDraft } from '@/utils/menu-planning/menuAiDraft';
import { toGridRequest } from '@/utils/menu-planning/menuAiDraftGrid';
import { formatWeekdayDate } from '@/utils/format';

const MODES = [
  { key: 'week', label: 'Cả tuần' },
  { key: 'fix', label: 'Thay một món' },
];

/**
 * AI gợi ý cho kế hoạch tuần của một khối (AI-07): soạn cả tuần hoặc thay một món đã lưu. BE lọc món, gọi AI, kiểm và
 * chấm điểm; người duyệt xem rồi mới "Dùng" (ghi vào tuần nháp, không công bố — NUT-08) hoặc "Bỏ". AI tắt vẫn có phương
 * án theo quy tắc (AI-03). Màn còn thay đổi chưa lưu thì không cho dùng, tránh mất món đang sửa. Gợi ý cả tuần mở ở
 * hộp thoại rộng: bảng thực đơn + cột món kéo thả, đổi món xong BE chấm lại rồi mới dùng (AI-02).
 */
export function MenuAiWeekModal({ open, onClose, block, week, plan, dirty, onApplied, dishes = [], kcalAgeGroup }) {
  const toast = useToast();
  const { running, run: runAi } = useAiRun();
  const [mode, setMode] = useState('week');
  const [season, setSeason] = useState('');
  const [wishes, setWishes] = useState('');
  const [fixKey, setFixKey] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const editor = useMenuAiDraftEditor(draft);
  const dishById = useMemo(() => Object.fromEntries(dishes.map((dish) => [String(dish.id), dish])), [dishes]);
  const options = fixOptions(plan, block);
  const target = options.find((o) => o.key === fixKey);

  useEffect(() => {
    if (open) {
      setDraft(null);
      setFixKey('');
    }
  }, [open]);

  const create = async () => {
    try {
      const request =
        mode === 'fix'
          ? {
              kind: MENU_AI_KIND.DAY_FIX,
              block,
              weekStart: week,
              targetDate: target.date,
              targetSession: target.session,
              fromDishId: target.dishId,
              season,
              wishes,
            }
          : { kind: MENU_AI_KIND.WEEKLY, block, weekStart: week, season, wishes };
      setDraft(await runAi(() => menuAiDraftApi.createDraft(request)));
    } catch (err) {
      toast.error(err, 'Chưa tạo được gợi ý');
    }
  };

  // Đóng khi nháp còn chờ duyệt ⇒ ghi nhận "bỏ" để BE đo đúng tỉ lệ dùng/bỏ; lỗi ghi vết không chặn người dùng
  const discard = async (then) => {
    setConfirm(null);
    if (isPendingDraft(draft)) await menuAiDraftApi.dismissDraft(draft.id).catch(() => null);
    then();
  };
  // Đã sửa món mà đóng hoặc gợi ý lại ⇒ hỏi trước để không mất phần đang sửa
  const guard = (then) => (editor.edited > 0 ? setConfirm(() => then) : discard(then));
  const close = () => guard(onClose);
  const retry = () => guard(() => setDraft(null));

  const apply = async () => {
    setBusy(true);
    try {
      await menuAiDraftApi.applyDraft(draft.id, editor.edited > 0 ? toGridRequest(editor.cells) : undefined);
      if (unmet) toast.success('Đã điền gợi ý vào tuần nháp. Sửa các ngày còn lỗi trước khi công bố.');
      else toast.success(mode === 'fix' ? 'Đã thay món theo gợi ý.' : 'Đã dùng gợi ý cho tuần.');
      onApplied();
      onClose();
    } catch (err) {
      toast.error(err, 'Chưa dùng được gợi ý');
    } finally {
      setBusy(false);
    }
  };

  // Bản đang sửa: theo kết quả BE vừa chấm; chưa sửa: theo nháp
  const unmet = editor.editable ? !editor.assessment.feasible : isUnmetDraft(draft);
  // Chấm lại lỗi hoặc đang chấm ⇒ chưa biết bản đang sửa có hợp lệ không, chưa cho dùng
  const unchecked = editor.editable && (editor.evaluating || !!editor.evaluateError);
  const canCreate = mode === 'week' || !!target;
  const footer = draft ? (
    <>
      <Button variant="ghost" onClick={close} disabled={busy}>
        Bỏ
      </Button>
      <Button onClick={retry} disabled={busy || running}>
        <RotateCcw size={15} /> Gợi ý lại
      </Button>
      {isPendingDraft(draft) && (
        <Button
          variant="primary"
          onClick={apply}
          disabled={busy || running || dirty || unchecked}
          title={dirty ? 'Lưu nháp tuần trước khi dùng gợi ý' : undefined}
        >
          {unmet ? 'Dùng để sửa tiếp' : editor.editable ? 'Dùng cho tuần' : 'Dùng gợi ý'}
        </Button>
      )}
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Hủy
      </Button>
      <Button variant="primary" onClick={create} disabled={running || !canCreate}>
        <Sparkles size={15} /> Gợi ý
      </Button>
    </>
  );

  const blockLabel = MEAL_BLOCK_LABELS[block] || block;
  return (
    <Modal
      open={open}
      onClose={draft ? close : onClose}
      closeOnBackdrop={!draft}
      size={draft ? (editor.editable ? 'full' : 'xl') : 'md'}
      title={draft ? `Gợi ý thực đơn · ${blockLabel}` : `AI gợi ý thực đơn · ${blockLabel}`}
      footer={footer}
    >
      {draft ? (
        <>
          {dirty && isPendingDraft(draft) && (
            <p className="text-sm td-warn td-flat">Màn đang có thay đổi chưa lưu. Lưu nháp tuần rồi mở lại để dùng gợi ý.</p>
          )}
          {editor.editable ? (
            <MenuAiWeekEditor draft={draft} editor={editor} dishById={dishById} kcalAgeGroup={kcalAgeGroup} />
          ) : (
            <MenuAiDraftResult draft={draft} dishById={dishById} kcalAgeGroup={kcalAgeGroup} />
          )}
        </>
      ) : (
        <div className="td-ai-form">
          <Tabs ariaLabel="Loại gợi ý" value={mode} onChange={setMode} items={MODES} />
          {mode === 'fix' && (
            <SelectField label="Món cần thay" value={fixKey} onChange={(e) => setFixKey(e.target.value)}>
              <option value="">{options.length ? 'Chọn món đã lưu' : 'Tuần chưa có món đã lưu'}</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {`${formatWeekdayDate(o.date)} · ${MEAL_SESSION_LABELS[o.session] || o.session} · ${o.dishName}`}
                </option>
              ))}
            </SelectField>
          )}
          <div className="td-form-grid td-form-grid--2">
            <TextField
              label="Mùa"
              maxLength={50}
              placeholder="Ví dụ: Mùa đông"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            />
            <TextField
              label="Mong muốn thêm"
              maxLength={300}
              placeholder="Ví dụ: nhiều rau xanh"
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
            />
          </div>
          <p className="text-xs muted td-flat">
            AI chỉ chọn trong món đang dùng của trường, không nhận thông tin trẻ. Hệ thống kiểm định mức, giá suất, lặp món và chỉ giữ gợi ý
            AI khi không kém phương án theo quy tắc. Kết quả là bản nháp, bạn xem trước rồi mới dùng; công bố tuần vẫn làm như cũ.
          </p>
        </div>
      )}
      {running && <AiWorkingOverlay kind="cooking" text="Đang gợi ý thực đơn…" />}
      <ConfirmationModal
        open={!!confirm}
        title="Bỏ các món đã sửa?"
        message={`Bạn đã sửa ${editor.edited} ô trên bản gợi ý. Thoát ra sẽ mất các chỉnh sửa này.`}
        confirmLabel="Bỏ chỉnh sửa"
        cancelLabel="Sửa tiếp"
        danger
        onConfirm={() => discard(confirm)}
        onClose={() => setConfirm(null)}
      />
    </Modal>
  );
}
