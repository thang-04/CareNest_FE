import { Send } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { SubmitOverlay } from '@/components/ui/States';
import { MealPlanIssueList } from '@/components/menu-planning/MealPlanIssueList';
import { issuesBySeverity } from '@/utils/menu-planning/mealPlanGrid';
import { weekLabel } from '@/models/menu-planning/menuPlanningConstants';

/**
 * Hộp thoại công bố cả tuần: liệt kê lỗi chặn (theo ngày, nhóm tuổi, lý do) và cảnh báo do BE trả. Nút Công bố chỉ bấm được khi
 * BE báo `publishable`. `error` là câu BE trả khi từ chối (409), `issues` đã được nạp lại sau lần từ chối đó.
 */
export function PublishWeekDialog({ open, plan, busy, error, onConfirm, onClose }) {
  if (!plan) return null;
  const { blocking, warning, info } = issuesBySeverity(plan.issues);
  const rest = [...warning, ...info];
  return (
    <Modal
      open={open}
      title="Công bố kế hoạch tuần"
      size="lg"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Quay lại
          </button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy || !plan.publishable}>
            <Send size={16} /> Công bố tuần
          </button>
        </>
      }
    >
      {busy && <SubmitOverlay state="sending" text="Đang công bố…" />}
      <div className="td-publish">
        <p className="td-flat">
          Công bố kế hoạch tuần {weekLabel(plan.weekStart)} cho mọi khối. Sau khi công bố, lưới bị khóa và không sửa được nữa.
        </p>
        {error && (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        )}
        {blocking.length > 0 ? (
          <div>
            <h3 className="td-publish__title">Cần sửa trước khi công bố ({blocking.length})</h3>
            <MealPlanIssueList issues={blocking} />
          </div>
        ) : (
          <div className="alert alert--success">Không còn lỗi chặn, có thể công bố.</div>
        )}
        {rest.length > 0 && (
          <div>
            <h3 className="td-publish__title">Cảnh báo và lưu ý ({rest.length})</h3>
            <p className="text-sm muted td-publish__hint">Không chặn công bố, nên xem lại trước khi công bố.</p>
            <MealPlanIssueList issues={rest} />
          </div>
        )}
      </div>
    </Modal>
  );
}
