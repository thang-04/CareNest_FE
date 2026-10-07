import { ListChecks, AlertTriangle } from 'lucide-react';
import { Widget, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { APPROVAL_TYPE_META } from '@/models/dashboard/dashboardConstants';
import { formatWhen, sortKey } from '@/utils/dashboard/dashboardFormat';

/**
 * "Chờ bạn duyệt" on the Principal / Vice Principal / Team Leader dashboards: one row per type with its count,
 * linking to #126. `approvals` = result of usePendingApprovals(); `campusId` narrows rows for the Principal filter.
 */
export function ApprovalsWidget({ approvals, campusId }) {
  const { groups, loading, error, reload } = approvals;
  const scoped = groups.map((g) => ({ ...g, items: g.items.filter((i) => !campusId || !i.campusId || i.campusId === campusId) }));
  const oldest = scoped
    .flatMap((g) => g.items)
    .sort((a, b) => sortKey(a.at).localeCompare(sortKey(b.at)))
    .slice(0, 3);

  return (
    <Widget
      title="Chờ bạn duyệt"
      icon={ListChecks}
      to="/approvals"
      linkLabel="Mở danh sách chờ duyệt"
      loading={loading}
      error={error}
      onRetry={reload}
    >
      <ShortList
        rows={scoped.map((g) => ({
          key: g.type,
          to: `/approvals?type=${g.type}`,
          icon: g.error ? AlertTriangle : undefined,
          title: APPROVAL_TYPE_META[g.type].label,
          meta: g.error ? 'Không tải được nhóm này – mở danh sách để thử lại' : undefined,
          end: g.error ? <span className="muted">—</span> : <TaskCount value={g.items.length} />,
        }))}
      />
      {oldest.length > 0 && (
        <>
          <div className="subsection-title mt-16">Chờ lâu nhất</div>
          <ShortList
            rows={oldest.map((i) => ({
              key: i.key,
              to: i.to,
              code: i.code,
              title: i.title,
              meta: `${APPROVAL_TYPE_META[i.type].short} · ${i.by} · ${formatWhen(i.at)}`,
            }))}
          />
        </>
      )}
    </Widget>
  );
}
