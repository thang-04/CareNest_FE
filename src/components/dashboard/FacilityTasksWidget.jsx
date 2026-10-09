import { Repeat, ClipboardCheck, Building2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTransfers } from '@/hooks/facility-transfer/useTransfers';
import { useInspections } from '@/hooks/inventory-inspection/useInspections';
import { Widget, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { ROLES } from '@/models/User';
import { TRANSFER_STATUS_LABELS } from '@/models/facility-transfer/transferConstants';
import { SHEET_STATUS_LABELS } from '@/models/inventory-inspection/inspectionConstants';
import {
  canHandover,
  canReceive,
  canEditTransfer,
  canResolveDiscrepancy,
  staffTransferPath,
} from '@/utils/facility-transfer/transferPermissions';
import { canCountSheet, canReviewSheet, canApproveRound } from '@/utils/inventory-inspection/inspectionPermissions';

const MAX_ROWS = 4;

/**
 * Transfer and inventory tasks of the signed-in user (moved from the former home page):
 * the Vice Principal adjusts / resolves transfers and reviews inspections; staff hand over, receive and count.
 */
export function FacilityTasksWidget() {
  const { user } = useAuth();
  const transfersQ = useTransfers({});
  const inspectionsQ = useInspections({});
  const vp = user.role === ROLES.VICE_PRINCIPAL;

  const transferTasks = transfersQ.transfers
    .filter((t) =>
      vp
        ? (canEditTransfer(t, user) && t.status !== 'DRAFT') || canResolveDiscrepancy(t, user)
        : canHandover(t, user) || canReceive(t, user),
    )
    .map((t) => ({
      key: `t:${t.id}`,
      to: vp
        ? canResolveDiscrepancy(t, user)
          ? `/facility/transfers/${t.id}/discrepancy`
          : `/facility/transfers/${t.id}/edit`
        : staffTransferPath(t, user),
      icon: Repeat,
      code: t.code,
      title: t.reason,
      meta: TRANSFER_STATUS_LABELS[t.status],
    }));

  const inspectionTasks = inspectionsQ.rounds.flatMap((r) => {
    const sheets = (r.sheets || [])
      .filter((s) => (vp ? canReviewSheet(r, s, user) : canCountSheet(r, s, user)))
      .map((s) => ({
        key: `s:${s.id}`,
        to: `/facility/inspections/${r.id}/sheets/${s.id}`,
        icon: ClipboardCheck,
        code: s.code,
        title: r.name,
        meta: SHEET_STATUS_LABELS[s.status],
      }));
    const round =
      vp && canApproveRound(r, user)
        ? [
            {
              key: `r:${r.id}`,
              to: `/facility/inspections/${r.id}`,
              icon: ClipboardCheck,
              code: r.code,
              title: r.name,
              meta: 'Đợt kiểm kê chờ phê duyệt',
            },
          ]
        : [];
    return [...round, ...sheets];
  });

  const loading = (transfersQ.loading && !transfersQ.transfers.length) || (inspectionsQ.loading && !inspectionsQ.rounds.length);
  const error = transfersQ.error && inspectionsQ.error ? transfersQ.error : null;
  const retry = () => {
    transfersQ.reload();
    inspectionsQ.reload();
  };
  const items = [...transferTasks, ...inspectionTasks].slice(0, MAX_ROWS);

  return (
    <Widget title="Tài sản: việc cần làm" icon={Building2} loading={loading} error={error} onRetry={retry}>
      <ShortList
        rows={[
          {
            key: 'transfers',
            to: '/facility/transfers',
            icon: Repeat,
            title: 'Luân chuyển tài sản',
            meta: transfersQ.error
              ? 'Không tải được phiếu luân chuyển'
              : vp
                ? 'Phiếu cần bạn điều chỉnh / xử lý chênh lệch'
                : 'Phiếu cần bạn bàn giao / xác nhận nhận',
            end: transfersQ.error ? <span className="muted">—</span> : <TaskCount value={transferTasks.length} />,
          },
          {
            key: 'inspections',
            to: '/facility/inspections',
            icon: ClipboardCheck,
            title: 'Kiểm kê tài sản',
            meta: inspectionsQ.error
              ? 'Không tải được đợt kiểm kê'
              : vp
                ? 'Phiếu kiểm kê chờ duyệt / đợt chờ phê duyệt'
                : 'Phiếu kiểm kê cần bạn kiểm đếm',
            end: inspectionsQ.error ? <span className="muted">—</span> : <TaskCount value={inspectionTasks.length} />,
          },
        ]}
      />
      {items.length > 0 && (
        <>
          <div className="subsection-title mt-16">Cần xử lý</div>
          <ShortList rows={items} />
        </>
      )}
    </Widget>
  );
}
