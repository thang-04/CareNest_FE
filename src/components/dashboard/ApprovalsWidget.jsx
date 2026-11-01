import { ListChecks } from '@/components/ui/icons';
import { BarList } from '@/components/charts/MiniCharts';
import { Widget, ShortList } from '@/components/dashboard/DashboardWidgets';
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
      {(() => {
        // Cùng dữ liệu/link như trước, chỉ sắp xếp nhiều → ít (nhóm lỗi xuống cuối) để đọc nhanh
        const rows = scoped
          .map((g) => ({
            key: g.type,
            to: `/approvals?type=${g.type}`,
            label: APPROVAL_TYPE_META[g.type].label,
            value: g.items.length,
            color: 'var(--purple)',
            error: !!g.error,
            meta: g.error ? 'Không tải được nhóm này – mở danh sách để thử lại' : undefined,
          }))
          .sort((x, y) => Number(x.error) - Number(y.error) || y.value - x.value);
        const total = rows.reduce((sum, r) => sum + (r.error ? 0 : r.value), 0);
        const top = rows.find((r) => !r.error && r.value > 0);
        const failedCount = rows.filter((r) => r.error).length;
        return (
          <>
            <div className="db-appr-sum">
              {/* Không nhóm nào tải được ⇒ chưa biết số lượng, không hiển thị 0 */}
              <b className="db-appr-sum__num">{failedCount === rows.length ? '—' : total}</b>
              <span className="db-appr-sum__text">
                <span className="db-appr-sum__title">yêu cầu đang chờ bạn duyệt</span>
                {top && (
                  <span className="db-appr-sum__meta">
                    Nhiều nhất: <b>{top.label}</b> ({top.value})
                  </span>
                )}
                {failedCount > 0 && <span className="db-appr-sum__meta">{failedCount} nhóm không tải được – số trên có thể chưa đủ</span>}
              </span>
            </div>
            <div className="db-approvals">
              <BarList rows={rows} />
            </div>
          </>
        );
      })()}
      {oldest.length > 0 && (
        <>
          <div className="db-eyebrow mt-16">Chờ lâu nhất</div>
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
