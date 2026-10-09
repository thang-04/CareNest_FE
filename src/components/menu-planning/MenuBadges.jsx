import { CheckCircle2, FileEdit, PauseCircle, Replace, Sparkles, Lock } from '@/components/ui/icons';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/States';
import { useMasterData } from '@/hooks/useMasterData';
import { formatDateTime } from '@/utils/format';
import {
  AI_LABEL,
  HISTORY_LABELS,
  NORM_STATUS_LABELS,
  RECORD_STATUS_LABELS,
  WEEKLY_STATUS_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';

/* Tones follow the shared convention in components/ui/StatusBadge.jsx */
export const RecordStatusBadge = createStatusBadge(
  { ACTIVE: ['green', CheckCircle2], INACTIVE: ['gray', PauseCircle] },
  RECORD_STATUS_LABELS,
);

export const WeeklyStatusBadge = createStatusBadge(
  { DRAFT: ['gray', FileEdit], PUBLISHED: ['green', CheckCircle2], REPLACED: ['gray', Replace] },
  WEEKLY_STATUS_LABELS,
);

const NORM_TONES = { OK: 'green', LOW: 'orange', HIGH: 'orange', NA: 'gray' };
export const NormStatusChip = ({ status }) => (
  <span className={`chip chip--${NORM_TONES[status] || 'gray'}`}>{NORM_STATUS_LABELS[status]}</span>
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
  <div className="card">
    <EmptyState
      icon={Lock}
      title="Bạn không có quyền thay đổi dữ liệu thực đơn"
      description="Chỉ Phó hiệu trưởng được Hiệu trưởng giao phụ trách dịch vụ chung (bán trú toàn trường) mới lập và sửa thực phẩm, món ăn, giá suất ăn và thực đơn."
    />
  </div>
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
          <div className="muted">Chưa có lịch sử.</div>
        ) : (
          <ul className="history-list">
            {list.map((h) => (
              <li key={h.id}>
                <div className="history-list__dot" />
                <div>
                  <div className="fw-600">{HISTORY_LABELS[h.action] || h.action}</div>
                  <div className="text-sm muted">
                    {md.userById(h.userId)?.fullName || 'Người dùng'} · {formatDateTime(h.at)}
                  </div>
                  {h.note && <div className="text-sm">{h.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
