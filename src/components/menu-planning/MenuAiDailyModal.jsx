import { useEffect, useState } from 'react';
import { Button, TextField } from '@/components';
import { RotateCcw, Sparkles } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/useAiRun';
import { MenuAiDraftResult } from '@/components/menu-planning/MenuAiDraftResult';
import { menuAiDraftApi } from '@/services/menuAiDraftApi';
import { MEAL_BLOCK_LABELS, MENU_AI_KIND } from '@/models/menu-planning/menuPlanningConstants';
import { isPendingDraft } from '@/utils/menu-planning/menuAiDraft';

/**
 * AI gợi ý thực đơn mẫu một ngày cho khối (AI-07, NUT-13). "Điền vào ngày đang sửa" thay món các bữa của ngày đó trong
 * form và báo BE đã dùng; mẫu chỉ được lưu khi người dùng bấm "Lưu mẫu" (BE kiểm như lập tay).
 */
export function MenuAiDailyModal({ open, onClose, block, seasonLabel, dayLabel, onFill }) {
  const toast = useToast();
  const { running, run: runAi } = useAiRun();
  const [season, setSeason] = useState('');
  const [wishes, setWishes] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(null);
      setSeason(seasonLabel || '');
    }
  }, [open, seasonLabel]);

  const create = async () => {
    try {
      setDraft(await runAi(() => menuAiDraftApi.createDraft({ kind: MENU_AI_KIND.DAILY, block, season, wishes })));
    } catch (err) {
      toast.error(err, 'Chưa tạo được gợi ý');
    }
  };
  // Đóng hoặc gợi ý lại khi nháp còn chờ duyệt ⇒ ghi nhận "bỏ"; lỗi ghi vết không chặn người dùng
  const dismiss = async () => {
    if (isPendingDraft(draft)) await menuAiDraftApi.dismissDraft(draft.id).catch(() => null);
  };
  const close = async () => {
    await dismiss();
    onClose();
  };
  const retry = async () => {
    await dismiss();
    setDraft(null);
  };
  const fill = async () => {
    setBusy(true);
    try {
      onFill(await menuAiDraftApi.markDailyUsed(draft.id));
      toast.success('Đã điền món theo gợi ý. Bấm "Lưu mẫu" để lưu.');
      onClose();
    } catch (err) {
      toast.error(err, 'Chưa dùng được gợi ý');
    } finally {
      setBusy(false);
    }
  };

  const footer = draft ? (
    <>
      <Button variant="ghost" onClick={close} disabled={busy}>
        Bỏ
      </Button>
      <Button onClick={retry} disabled={busy || running}>
        <RotateCcw size={15} /> Gợi ý lại
      </Button>
      {isPendingDraft(draft) && (
        <Button variant="primary" onClick={fill} disabled={busy || running}>
          Điền vào {dayLabel || 'ngày đang sửa'}
        </Button>
      )}
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        Hủy
      </Button>
      <Button variant="primary" onClick={create} disabled={running}>
        <Sparkles size={15} /> Gợi ý
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={draft ? close : onClose}
      closeOnBackdrop={!draft}
      size={draft ? 'lg' : 'md'}
      title={`AI gợi ý thực đơn một ngày · ${MEAL_BLOCK_LABELS[block] || block}`}
      footer={footer}
    >
      {draft ? (
        <MenuAiDraftResult draft={draft} dayLabel={dayLabel} />
      ) : (
        <div className="td-ai-form">
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
              placeholder="Ví dụ: có món nước"
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
            />
          </div>
          <p className="text-xs muted td-flat">
            AI chỉ chọn trong món đang dùng của trường; hệ thống kiểm định mức theo ngày hôm nay. Kết quả là bản nháp, món của{' '}
            {dayLabel || 'ngày đang sửa'} chỉ thay khi bạn bấm điền.
          </p>
        </div>
      )}
      {running && <AiWorkingOverlay kind="cooking" text="Đang gợi ý thực đơn…" />}
    </Modal>
  );
}
