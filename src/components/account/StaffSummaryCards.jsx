import { useStaffAccounts } from '@/hooks/account/useStaff';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

export function StaffSummaryCards({ campusId = '', enabled = true }) {
  const totalQuery = useStaffAccounts({ staffOnly: true, campusId, page: 0, size: 1 }, { enabled });
  const activeQuery = useStaffAccounts({ staffOnly: true, campusId, status: 'ACTIVE', page: 0, size: 1 }, { enabled });
  const inactiveQuery = useStaffAccounts({ staffOnly: true, campusId, status: 'INACTIVE', page: 0, size: 1 }, { enabled });
  const teacherQuery = useStaffAccounts({ staffOnly: true, campusId, role: 'TEACHER', page: 0, size: 1 }, { enabled });
  const stats = [
    { label: 'Tổng số nhân sự', query: totalQuery, tone: 'blue' },
    { label: 'Đang hoạt động', query: activeQuery, tone: 'green' },
    { label: 'Đã khóa', query: inactiveQuery, tone: 'orange' },
    { label: 'Giáo viên', query: teacherQuery, tone: 'teal' },
  ];

  return (
    <div className="stat-grid people-stats" aria-label="Tổng quan nhân sự">
      {stats.map((stat) => (
        <div key={stat.label} className={`stat-card stat-card--${stat.tone}`}>
          <span className="stat-card__value">
            {stat.query.loading || stat.query.error || !stat.query.data ? '—' : stat.query.data.totalElements}
          </span>
          <span className="stat-card__label">{stat.label}</span>
          <StatCardIcon tone={stat.tone} />
        </div>
      ))}
    </div>
  );
}
