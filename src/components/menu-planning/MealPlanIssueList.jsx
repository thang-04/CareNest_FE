import { StatusBadge } from '@/components/ui/StatusBadge';
import { groupIssuesByDate } from '@/utils/menu-planning/mealPlanGrid';

const SEVERITY = { BLOCKING: ['red', 'Cần sửa'], WARNING: ['orange', 'Cảnh báo'], INFO: ['teal', 'Lưu ý'] };

/** Lỗi / cảnh báo của kế hoạch tuần do BE trả, gom theo ngày; câu BE đã nêu ngày, nhóm tuổi (hoặc khối) và lý do. */
export function MealPlanIssueList({ issues }) {
  return (
    <div className="td-issue-groups">
      {groupIssuesByDate(issues).map((group) => (
        <section key={group.date || 'week'} className="td-issue-group" aria-label={group.label}>
          <h4 className="td-issue-day">{group.label}</h4>
          <ul className="td-issue-list">
            {group.issues.map((issue, i) => {
              const [tone, label] = SEVERITY[issue.severity] || SEVERITY.INFO;
              return (
                <li key={`${issue.code}-${issue.ageGroupId}-${issue.dishId}-${i}`} className="td-issue">
                  <StatusBadge tone={tone} label={label} />
                  <span className="td-issue__text">{issue.message}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
