import { useEffect, useState } from 'react';
import { CopyPlus } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useMenuTemplates } from '@/hooks/menu-planning/useMenuTemplates';
import { MEAL_BLOCK_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { TEMPLATE_WEEKS, weekItemCounts } from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Chọn một tuần của bộ thực đơn mẫu (cùng khối, đang dùng) để sao vào bản nháp kế hoạch tuần (NUT-13).
 * `onConfirm(template, weekNo)`; chép chỉ đổi bản nháp trên màn, người lập Lưu nháp sau khi xem lại.
 */
export function CopyTemplateDialog({ open, block, onConfirm, onClose }) {
  const { data, loading, error, reload } = useMenuTemplates({ block, status: 'ACTIVE' });
  const templates = data || [];
  const [templateId, setTemplateId] = useState('');
  const [weekNo, setWeekNo] = useState(1);
  const picked = templates.find((t) => String(t.id) === String(templateId)) || templates[0];
  const counts = picked ? weekItemCounts(picked.items) : {};

  useEffect(() => {
    if (open) setWeekNo(1);
  }, [open]);

  return (
    <Modal
      open={open}
      size="lg"
      title={`Sao từ bộ thực đơn mẫu · ${MEAL_BLOCK_LABELS[block] || block}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Quay lại
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!picked || !counts[weekNo]}
            onClick={() => onConfirm(picked, weekNo)}
          >
            <CopyPlus size={16} /> Sao vào tuần này
          </button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : templates.length === 0 ? (
        <EmptyState
          title="Chưa có bộ thực đơn mẫu cho khối này"
          description="Lập bộ 4 tuần ở Thực đơn & dinh dưỡng › Bộ thực đơn mẫu rồi quay lại sao."
        />
      ) : (
        <div className="td-copy-template">
          <label className="field">
            <span className="field__label">Bộ thực đơn mẫu</span>
            <select className="select" value={picked?.id ?? ''} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.seasonLabel ? ` · ${t.seasonLabel}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field__label">Tuần trong bộ</span>
            <div className="tabs tabs--pill" role="tablist" aria-label="Tuần trong bộ">
              {TEMPLATE_WEEKS.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="tab"
                  aria-selected={w === weekNo}
                  className={`tab ${w === weekNo ? 'tab--active' : ''}`}
                  onClick={() => setWeekNo(w)}
                >
                  Tuần {w} <span className="muted">({counts[w] || 0} món)</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm muted td-flat">
            Món của khối {MEAL_BLOCK_LABELS[block] || block} trong tuần đang lập sẽ được thay bằng tuần {weekNo} của bộ; khối khác và ngày
            nghỉ giữ nguyên. Xem lại rồi bấm Lưu nháp.
          </p>
        </div>
      )}
    </Modal>
  );
}
