import { CheckCircle2, FileEdit, FileQuestion, PauseCircle, Replace, Sparkles } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/States';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { StatusPage } from '@/components/ui/StatusPage';
import { useMasterData } from '@/hooks/useMasterData';
import { formatDateTime } from '@/utils/format';
import {
  AI_LABEL,
  DISH_STATUS_LABELS,
  HISTORY_LABELS,
  MEAL_PLAN_STATUS_LABELS,
  NORM_STATUS_LABELS,
  RECORD_STATUS_LABELS,
  WEEKLY_STATUS_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';

/* Tones follow the shared convention in components/ui/StatusBadge.jsx */
export const RecordStatusBadge = createStatusBadge(
  { ACTIVE: ['green', CheckCircle2], INACTIVE: ['gray', PauseCircle] },
  RECORD_STATUS_LABELS,
);

// Món: Nháp (chưa dùng được cho thực đơn) cùng tông chờ xử lý như thực đơn tuần nháp
export const DishStatusBadge = createStatusBadge(
  { DRAFT: ['gray', FileEdit], ACTIVE: ['green', CheckCircle2], INACTIVE: ['gray', PauseCircle] },
  DISH_STATUS_LABELS,
);

export const WeeklyStatusBadge = createStatusBadge(
  { DRAFT: ['gray', FileEdit], PUBLISHED: ['green', CheckCircle2], REPLACED: ['gray', Replace] },
  WEEKLY_STATUS_LABELS,
);

// Kế hoạch tuần theo khối (BE): chưa lập / nháp cùng tông xám, đã công bố xanh
export const MealPlanStatusBadge = createStatusBadge(
  { NONE: ['gray', FileQuestion], DRAFT: ['gray', FileEdit], PUBLISHED: ['green', CheckCircle2] },
  MEAL_PLAN_STATUS_LABELS,
);

export const NormStatusChip = createStatusBadge(
  {
    OK: ['green', null],
    LOW: ['orange', null],
    HIGH: ['orange', null],
    NA: ['gray', null],
    INCOMPLETE: ['gray', null],
    NO_DISHES: ['gray', null],
  },
  NORM_STATUS_LABELS,
);

/** Allergens are a "needs attention" label (red), see DESIGN.md §3.2. */
export function AllergenChips({ allergens, empty = '—' }) {
  if (!allergens?.length) return <span className="muted">{empty}</span>;
  return (
    <span className="td-chips">
      {allergens.map((a) => (
        <span key={a} className="chip chip--red">
          {a}
        </span>
      ))}
    </span>
  );
}

/** GBR-AI-02: AI content is labelled wherever it is shown before a person approves it. */
export const AiDraftLabel = () => (
  <span className="chip chip--purple td-ai-label">
    <Sparkles size={13} /> {AI_LABEL}
  </span>
);

/** Shown instead of a form when the account may only read menu data. */
export const NoManageAccess = () => (
  <StatusPage
    kind="403"
    title="Bạn không có quyền thay đổi dữ liệu thực đơn"
    description="Chỉ Phó hiệu trưởng được Hiệu trưởng giao phụ trách dịch vụ chung (bán trú toàn trường) mới lập và sửa thực phẩm, món ăn, giá suất ăn và thực đơn."
  />
);

/** Change history of a record. */
export function HistoryCard({ history }) {
  const md = useMasterData();
  const list = [...(history || [])].reverse();
  return (
    <div className="card mt-16">
      <div className="card__header">
        <div className="card__title">Lịch sử thay đổi</div>
      </div>
      <div className="card__body">
        {list.length === 0 ? (
          <EmptyState title="Chưa có lịch sử" description="Mỗi lần tạo, sửa, duyệt sẽ được ghi lại ở đây." />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid table--compact td-history-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {list.map((h) => (
                  <tr key={h.id}>
                    <td className="nowrap">{formatDateTime(h.at)}</td>
                    <td>{md.userById(h.userId)?.fullName || 'Người dùng'}</td>
                    <td className="fw-600">{HISTORY_LABELS[h.action] || h.action}</td>
                    <td>{h.note || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
