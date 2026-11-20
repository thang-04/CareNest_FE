import { AlertCircle } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AiDraftLabel } from '@/components/menu-planning/MenuBadges';
import { MealPlanIssueList } from '@/components/menu-planning/MealPlanIssueList';
import { MenuAiDraftGrid } from '@/components/menu-planning/MenuAiDraftGrid';
import { MENU_AI_CHECK_LABELS, MENU_AI_CHECK_TONES, MENU_AI_STATUS } from '@/models/menu-planning/menuPlanningConstants';
import { isUnmetDraft, sourceText } from '@/utils/menu-planning/menuAiDraft';
import { cellsOf, columnsOf } from '@/utils/menu-planning/menuAiDraftGrid';

/**
 * Kết quả nháp AI gợi ý thực đơn do BE trả: nhãn nháp, nguồn (AI hoặc theo quy tắc kèm lý do), điểm, bảng kiểm tiêu chí,
 * bảng món theo ngày và hàng loại món (chỉ xem), lưu ý. Nháp chưa đạt định mức vẫn hiện món kèm cảnh báo. Mọi số liệu, đánh giá là của BE (AI-01,
 * NUT-09); FE chỉ hiển thị.
 */
export function MenuAiDraftResult({ draft, dayLabel, dishById, kcalAgeGroup }) {
  const noPlan = draft.status === MENU_AI_STATUS.NO_FEASIBLE;
  const { ai, baseline } = draft.score || {};
  return (
    <div className="td-ai-form">
      <div className="row td-chips">
        <AiDraftLabel />
        {draft.source && <span className="chip chip--gray">{sourceText(draft)}</span>}
        {baseline != null && (
          <span className="text-sm muted">
            Điểm: AI {ai ?? '—'} · Theo quy tắc {baseline}
          </span>
        )}
      </div>
      {noPlan && (
        <div className="alert alert--danger">
          <AlertCircle size={18} />
          <div>Chưa có phương án đạt kiểm tra. Xem nguyên nhân bên dưới để bổ sung món hoặc định mức, hoặc soạn tay.</div>
        </div>
      )}
      {isUnmetDraft(draft) && (
        <div className="alert alert--warning">
          <AlertCircle size={18} />
          <div>
            <strong>Chưa đạt định mức, cần sửa tay.</strong> Món đang dùng của trường chưa ghép được thực đơn đạt định mức. Bạn có thể dùng
            gợi ý này làm điểm bắt đầu rồi sửa theo các lỗi bên dưới; thực đơn chỉ công bố được khi hết lỗi.
          </div>
        </div>
      )}
      {!noPlan && (
        <MenuAiDraftGrid
          columns={columnsOf(draft)}
          slots={draft.slots || []}
          cells={cellsOf(draft)}
          issues={draft.issues}
          dishById={dishById}
          kcalAgeGroup={kcalAgeGroup}
          dayLabel={dayLabel}
        />
      )}
      {draft.checks.length > 0 && (
        <section className="td-checks" aria-label="Bảng kiểm tiêu chí">
          <h3 className="td-issue-day">Bảng kiểm tiêu chí (hệ thống tính)</h3>
          <ul className="td-issue-list">
            {draft.checks.map((check) => (
              <li key={check.code} className="td-issue">
                <StatusBadge
                  tone={MENU_AI_CHECK_TONES[check.status] || 'gray'}
                  label={MENU_AI_CHECK_LABELS[check.status] || check.status}
                />
                <span className="td-issue__text">
                  <strong>{check.label}:</strong> {check.detail}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {draft.issues.length > 0 && <MealPlanIssueList issues={draft.issues} />}
    </div>
  );
}
